"""
Kridha Training Data Builder — Generates JSONL for Nova Micro fine-tuning.

Uses Claude as a teacher model to generate gold-standard headline + pinch
for each scenario. Every output is personalized to the specific body,
garment, and scoring data.

Supports two backends:
  - anthropic: Anthropic Messages API (default, uses ANTHROPIC_API_KEY)
  - bedrock:   AWS Bedrock Runtime

Pipeline:
  1. Run all scenarios through the scoring engine
  2. Build system + user prompts (voice_spec.py)
  3. Call Claude to generate headline + pinch
  4. Validate through guardrails
  5. Export as JSONL for Bedrock Nova fine-tuning

Usage:
  # Using Anthropic API:
  export ANTHROPIC_API_KEY=sk-ant-...
  python -m engine.training_data_builder -o training_data.jsonl

  # Using Bedrock:
  python -m engine.training_data_builder --backend bedrock --env creds.env -o training_data.jsonl

  # Generate small test batch:
  python -m engine.training_data_builder -o test_batch.jsonl --limit 10

  # Validate existing file:
  python -m engine.training_data_builder --validate training_data.jsonl
"""

import json
import os
import sys
import time
import logging
import random
from typing import List, Dict, Optional
from pathlib import Path

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from engine.voice_spec import SYSTEM_PROMPT, build_user_prompt
from engine.guardrails import check_output
from engine.communication_schema import (
    select_verdict, analyze_principles,
    build_search_pills, build_search_context,
)
from engine.scenario_generator import generate_all_scenarios
from engine.bridge import build_body_profile, build_garment_profile
from engine.kridha_engine import score_garment
from engine.scoring_service import dataclass_to_dict
from engine.gold_generator import generate_gold_output

logger = logging.getLogger(__name__)


# ================================================================
# TEACHER MODEL — Anthropic Messages API
# ================================================================

class AnthropicTeacher:
    """Calls Claude via the Anthropic Messages API."""

    def __init__(self, api_key: str = None, model_id: str = None):
        import anthropic

        self.api_key = api_key or os.getenv("ANTHROPIC_API_KEY")
        self.auth_token = os.getenv("ANTHROPIC_AUTH_TOKEN")

        if not self.api_key and not self.auth_token:
            # Try loading from Claude Code credentials
            creds_path = Path.home() / ".claude" / ".credentials.json"
            if creds_path.exists():
                creds = json.loads(creds_path.read_text())
                oauth = creds.get("claudeAiOauth", {})
                self.auth_token = oauth.get("accessToken")

        if not self.api_key and not self.auth_token:
            raise ValueError(
                "Anthropic credentials required. Set ANTHROPIC_API_KEY or "
                "ANTHROPIC_AUTH_TOKEN env var."
            )

        self.model_id = model_id or "claude-sonnet-4-5-20250929"
        if self.auth_token:
            self.client = anthropic.Anthropic(auth_token=self.auth_token)
        else:
            self.client = anthropic.Anthropic(api_key=self.api_key)
        self.backend = "anthropic"

        # Rate limiting
        self._last_call = 0
        self._min_interval = 0.3  # seconds between calls

    def generate(self, system_prompt: str, user_prompt: str,
                 max_retries: int = 3) -> Optional[dict]:
        """Call Claude and return parsed JSON output."""
        for attempt in range(max_retries):
            try:
                # Rate limit
                elapsed = time.time() - self._last_call
                if elapsed < self._min_interval:
                    time.sleep(self._min_interval - elapsed)

                self._last_call = time.time()
                response = self.client.messages.create(
                    model=self.model_id,
                    max_tokens=500,
                    temperature=0.7,
                    system=system_prompt,
                    messages=[
                        {"role": "user", "content": user_prompt},
                    ],
                )

                text = response.content[0].text

                # Parse JSON from response (handle markdown code blocks)
                text = text.strip()
                if text.startswith("```"):
                    text = text.split("\n", 1)[1]
                    text = text.rsplit("```", 1)[0]
                    text = text.strip()

                output = json.loads(text)

                # Validate structure
                if "headline" not in output or "pinch" not in output:
                    logger.warning(f"Missing headline/pinch in response, attempt {attempt+1}")
                    continue

                if not isinstance(output["pinch"], list) or len(output["pinch"]) < 2:
                    logger.warning(f"Invalid pinch structure, attempt {attempt+1}")
                    continue

                return output

            except json.JSONDecodeError as e:
                logger.warning(f"JSON parse error attempt {attempt+1}: {e}")
            except Exception as e:
                err_str = str(e)
                logger.warning(f"Claude call failed attempt {attempt+1}: {e}")
                if "rate_limit" in err_str.lower() or "429" in err_str:
                    wait = min(2 ** (attempt + 1), 30)
                    logger.info(f"Rate limited, waiting {wait}s...")
                    time.sleep(wait)
                elif "overloaded" in err_str.lower():
                    time.sleep(5)
                else:
                    if attempt == max_retries - 1:
                        return None

        return None


# ================================================================
# TEACHER MODEL — Bedrock
# ================================================================

class BedrockTeacher:
    """Calls Claude via AWS Bedrock Runtime.

    Supports two auth modes:
      1. Bearer token (default): reads from AWS_BEARER_TOKEN_BEDROCK env var
         or ~/stylist/.bedrock_api_key file. Uses direct HTTPS.
      2. IAM keys: Set BEDROCK_ACCESS_KEY_ID + BEDROCK_SECRET_ACCESS_KEY env vars.
    """

    def __init__(self, region: str = None, access_key: str = None,
                 secret_key: str = None, model_id: str = None,
                 bearer_token: str = None):
        self.region = region or os.getenv("BEDROCK_REGION", "us-east-1")
        self.model_id = model_id or os.getenv(
            "BEDROCK_TEACHER_MODEL_ID",
            "us.anthropic.claude-sonnet-4-5-20250929-v1:0",
        )

        # Try bearer token first (from arg, env var, or .bedrock_api_key file)
        self.bearer_token = bearer_token or os.getenv("AWS_BEARER_TOKEN_BEDROCK")
        if not self.bearer_token:
            key_file = Path(__file__).parent.parent.parent / "stylist" / ".bedrock_api_key"
            if key_file.exists():
                self.bearer_token = key_file.read_text().strip()

        if self.bearer_token:
            self.backend = "bedrock-bearer"
            self.client = None  # Use direct HTTPS for bearer auth
        else:
            # Fall back to IAM keys via boto3
            import boto3
            self.access_key = access_key or os.getenv("BEDROCK_ACCESS_KEY_ID") or os.getenv("AWS_ACCESS_KEY_ID")
            self.secret_key = secret_key or os.getenv("BEDROCK_SECRET_ACCESS_KEY") or os.getenv("AWS_SECRET_ACCESS_KEY")

            if not self.access_key or not self.secret_key:
                raise ValueError(
                    "Bedrock credentials required. Set AWS_BEARER_TOKEN_BEDROCK env var, "
                    "or BEDROCK_ACCESS_KEY_ID + BEDROCK_SECRET_ACCESS_KEY."
                )

            self.client = boto3.client(
                "bedrock-runtime",
                region_name=self.region,
                aws_access_key_id=self.access_key,
                aws_secret_access_key=self.secret_key,
            )
            self.backend = "bedrock-iam"

        # Rate limiting
        self._last_call = 0
        self._min_interval = 0.5

    def _invoke_bearer(self, body: str) -> dict:
        """Call Bedrock via direct HTTPS with bearer token auth."""
        import urllib.request

        model_escaped = self.model_id.replace(":", "%3A")
        url = f"https://bedrock-runtime.{self.region}.amazonaws.com/model/{model_escaped}/invoke"

        req = urllib.request.Request(url, data=body.encode(), method='POST')
        req.add_header('Content-Type', 'application/json')
        req.add_header('Authorization', f'Bearer {self.bearer_token}')

        resp = urllib.request.urlopen(req, timeout=60)
        return json.loads(resp.read())

    def generate(self, system_prompt: str, user_prompt: str,
                 max_retries: int = 3) -> Optional[dict]:
        """Call Claude via Bedrock and return parsed JSON output."""
        for attempt in range(max_retries):
            try:
                elapsed = time.time() - self._last_call
                if elapsed < self._min_interval:
                    time.sleep(self._min_interval - elapsed)

                body = json.dumps({
                    "anthropic_version": "bedrock-2023-05-31",
                    "max_tokens": 500,
                    "temperature": 0.7,
                    "system": system_prompt,
                    "messages": [
                        {"role": "user", "content": user_prompt},
                    ],
                })

                self._last_call = time.time()

                if self.bearer_token:
                    result = self._invoke_bearer(body)
                else:
                    response = self.client.invoke_model(
                        modelId=self.model_id,
                        body=body,
                    )
                    result = json.loads(response["body"].read())

                text = result["content"][0]["text"]

                text = text.strip()
                if text.startswith("```"):
                    text = text.split("\n", 1)[1]
                    text = text.rsplit("```", 1)[0]
                    text = text.strip()

                output = json.loads(text)

                if "headline" not in output or "pinch" not in output:
                    logger.warning(f"Missing headline/pinch in response, attempt {attempt+1}")
                    continue

                if not isinstance(output["pinch"], list) or len(output["pinch"]) < 2:
                    logger.warning(f"Invalid pinch structure, attempt {attempt+1}")
                    continue

                return output

            except json.JSONDecodeError as e:
                logger.warning(f"JSON parse error attempt {attempt+1}: {e}")
            except Exception as e:
                logger.warning(f"Claude call failed attempt {attempt+1}: {e}")
                if "ThrottlingException" in str(e):
                    time.sleep(2 ** attempt)
                elif "ValidationException" in str(e):
                    return None

        return None


class LocalTeacher:
    """Generates gold outputs locally using engine scoring data.
    No API calls needed — uses the gold_generator module."""

    def __init__(self, **kwargs):
        self.model_id = "local-gold-generator"
        self.backend = "local"

    def generate_from_scored(self, scored_item: dict) -> Optional[dict]:
        """Generate output from a scored scenario (not from prompts)."""
        try:
            return generate_gold_output(scored_item)
        except Exception as e:
            logger.warning(f"Local generation failed: {e}")
            return None


def create_teacher(backend: str = "anthropic", **kwargs):
    """Factory function to create the appropriate teacher backend."""
    if backend == "anthropic":
        return AnthropicTeacher(**kwargs)
    elif backend == "bedrock":
        return BedrockTeacher(**kwargs)
    elif backend == "local":
        return LocalTeacher(**kwargs)
    else:
        raise ValueError(f"Unknown backend: {backend}. Use 'anthropic', 'bedrock', or 'local'.")


# ================================================================
# SCENARIO SCORING
# ================================================================

def score_scenario(scenario: dict) -> Optional[dict]:
    """Score a scenario through the engine. Returns enriched scenario or None."""
    try:
        body = build_body_profile(
            scenario["user_measurements"],
            styling_goals=scenario["styling_goals"],
        )
        garment = build_garment_profile(scenario["garment_attributes"])
        result = score_garment(garment, body)
        result_dict = dataclass_to_dict(result)

        overall = result_dict["overall_score"]
        verdict, color = select_verdict(overall)

        garment_attrs = scenario["garment_attributes"]
        user_prompt = build_user_prompt(
            result_dict,
            {
                "height": body.height,
                "body_shape": body.body_shape.value,
                "styling_goals": [g.value for g in body.styling_goals],
                "name": scenario.get("user_name", "User"),
                "torso_leg_ratio": getattr(body, "torso_leg_ratio", 0.50),
            },
            {
                "title": garment_attrs.get("title", "Unknown"),
                "category": garment.category.value,
                "model_height": garment_attrs.get("model_height_inches", 0),
                "fabric_composition": garment_attrs.get("fabric_composition", ""),
                "fabric_primary": garment_attrs.get("fabric_primary", ""),
                "fabric_weight": garment_attrs.get("fabric_weight", ""),
                "fabric_drape": garment_attrs.get("fabric_drape", ""),
                "fabric_sheen": garment_attrs.get("fabric_sheen", ""),
                "stretch_percentage": garment_attrs.get("stretch_percentage", 0),
                "fit_category": garment_attrs.get("fit_category", ""),
                "silhouette_type": garment_attrs.get("silhouette_type", ""),
                "brand": garment_attrs.get("brand", ""),
                "price": garment_attrs.get("price", ""),
            },
            verdict,
        )

        analysis = analyze_principles(result_dict.get("principle_scores", []))

        return {
            "scenario_id": scenario["scenario_id"],
            "verdict": verdict,
            "overall_score": overall,
            "user_prompt": user_prompt,
            "score_result": result_dict,
            "body_shape": body.body_shape.value,
            "garment_category": garment.category.value,
            "garment_title": scenario["garment_attributes"].get("title", ""),
            "top_positive_key": analysis["top_positive_key"],
            "top_negative_key": analysis["top_negative_key"],
        }
    except Exception as e:
        logger.error(f"Scoring failed for {scenario['scenario_id']}: {e}")
        return None


# ================================================================
# GUARDRAIL VALIDATION
# ================================================================

def validate_output(output: dict, verdict: str, top_neg: str,
                    garment_cat: str) -> bool:
    """Run guardrails on a Claude-generated output. Returns True if passed."""
    check_data = {
        "verdict": verdict,
        "headline": output.get("headline", ""),
        "pinch": output.get("pinch", []),
        "search_pills": build_search_pills(verdict, top_neg or "_default", garment_cat),
        "search_context": build_search_context(verdict, top_neg or "_default", garment_cat),
    }
    result = check_output(check_data)

    if not result.passed:
        violations = [f"{v.rule}: {v.text}" for v in result.violations]
        logger.warning(f"Guardrail violations: {violations}")

    return result.passed


# ================================================================
# JSONL FORMATTERS
# ================================================================

def format_bedrock_nova(system_prompt: str, user_prompt: str,
                        assistant_output: str) -> dict:
    """Bedrock Nova fine-tuning format."""
    return {
        "schemaVersion": "bedrock-conversation-2024",
        "system": [{"text": system_prompt}],
        "messages": [
            {"role": "user", "content": [{"text": user_prompt}]},
            {"role": "assistant", "content": [{"text": assistant_output}]},
        ],
    }


def format_openai_compat(system_prompt: str, user_prompt: str,
                          assistant_output: str) -> dict:
    """OpenAI-compatible chat format."""
    return {
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
            {"role": "assistant", "content": assistant_output},
        ],
    }


# ================================================================
# MAIN BUILDER
# ================================================================

def build_training_data(
    output_path: str = "training_data.jsonl",
    format_type: str = "bedrock_nova",
    limit: int = 0,
    env_file: str = None,
    model_id: str = None,
    backend: str = "anthropic",
    workers: int = 1,
) -> dict:
    """Build the full training dataset using Claude as teacher.

    Args:
        output_path: JSONL output path
        format_type: "bedrock_nova" or "openai_compat"
        limit: Max scenarios to process (0 = all)
        env_file: Optional .env file to load credentials from
        model_id: Override model ID
        backend: "anthropic" or "bedrock"
        workers: Number of parallel workers (1 = sequential)
    """
    # Load env if specified
    if env_file:
        from dotenv import load_dotenv
        load_dotenv(env_file)

    formatter = format_bedrock_nova if format_type == "bedrock_nova" else format_openai_compat

    # Initialize teacher
    teacher_kwargs = {}
    if model_id:
        teacher_kwargs["model_id"] = model_id
    teacher = create_teacher(backend, **teacher_kwargs)
    print(f"Backend: {teacher.backend}")
    print(f"Model: {teacher.model_id}")

    # Generate and score all scenarios
    print("Generating scenarios...")
    scenarios = generate_all_scenarios()
    if limit:
        random.seed(42)
        random.shuffle(scenarios)
        scenarios = scenarios[:limit]
    print(f"  {len(scenarios)} scenarios to process")

    # Score all scenarios first (fast, no API calls)
    print("Scoring scenarios...")
    scored = []
    for s in scenarios:
        result = score_scenario(s)
        if result:
            scored.append(result)

    # Count by verdict
    verdict_counts = {}
    for s in scored:
        verdict_counts[s["verdict"]] = verdict_counts.get(s["verdict"], 0) + 1
    print(f"  Scored: {len(scored)} ({verdict_counts})")

    # Generate outputs
    is_local = isinstance(teacher, LocalTeacher)
    mode_label = "locally" if is_local else "with Claude"
    print(f"\nGenerating {len(scored)} outputs {mode_label}...")
    stats = {
        "total": len(scored), "success": 0, "guardrail_fail": 0,
        "claude_fail": 0, "headline_dupe": 0,
        "by_verdict": {"this_is_it": 0, "smart_pick": 0, "not_this_one": 0},
    }

    seen_headlines = {}  # headline → count
    MAX_HEADLINE_DUPES = 2  # allow at most 2 copies of same headline

    output_file = Path(output_path)
    with open(output_file, "w") as f:
        for i, item in enumerate(scored):
            # Generate output (retry up to 2 times for headline dupes)
            output = None
            for gen_attempt in range(3):
                if is_local:
                    output = teacher.generate_from_scored(item)
                else:
                    output = teacher.generate(SYSTEM_PROMPT, item["user_prompt"])

                if output is None:
                    break

                headline = output.get("headline", "")
                if seen_headlines.get(headline, 0) < MAX_HEADLINE_DUPES:
                    break
                elif not is_local:
                    # Retry with Claude to get a different headline
                    output = None
                    continue
                else:
                    # Local generator is deterministic, skip this scenario
                    output = None
                    break

            if output is None:
                # Distinguish: was it a generation failure or a headline dupe skip?
                if is_local and gen_attempt == 0:
                    stats["claude_fail"] += 1
                    print(f"  [{i+1}/{len(scored)}] GEN FAIL: {item['scenario_id']}")
                elif gen_attempt > 0:
                    stats["headline_dupe"] += 1
                    print(f"  [{i+1}/{len(scored)}] HEADLINE DUPE: {item['scenario_id']}")
                else:
                    stats["claude_fail"] += 1
                    print(f"  [{i+1}/{len(scored)}] CLAUDE FAIL: {item['scenario_id']}")
                continue

            # Validate through guardrails
            if not validate_output(output, item["verdict"],
                                   item["top_negative_key"],
                                   item["garment_category"]):
                stats["guardrail_fail"] += 1
                print(f"  [{i+1}/{len(scored)}] GUARDRAIL FAIL: {item['scenario_id']}")
                continue

            # Track headline
            headline = output.get("headline", "")
            seen_headlines[headline] = seen_headlines.get(headline, 0) + 1

            # Write to JSONL
            assistant_text = json.dumps(output)
            formatted = formatter(SYSTEM_PROMPT, item["user_prompt"], assistant_text)
            f.write(json.dumps(formatted) + "\n")

            stats["success"] += 1
            stats["by_verdict"][item["verdict"]] += 1

            if (i + 1) % 25 == 0:
                print(f"  [{i+1}/{len(scored)}] {stats['success']} written, "
                      f"{stats['claude_fail']} claude fails, "
                      f"{stats['guardrail_fail']} guardrail fails, "
                      f"{stats['headline_dupe']} headline dupes")

    print(f"\n{'='*60}")
    print(f"Training data written to: {output_file}")
    print(f"  Total scored:      {stats['total']}")
    print(f"  Success:           {stats['success']}")
    print(f"  Claude failures:   {stats['claude_fail']}")
    print(f"  Guardrail blocks:  {stats['guardrail_fail']}")
    print(f"  Headline dupes:    {stats['headline_dupe']}")
    print(f"  this_is_it:        {stats['by_verdict']['this_is_it']}")
    print(f"  smart_pick:        {stats['by_verdict']['smart_pick']}")
    print(f"  not_this_one:      {stats['by_verdict']['not_this_one']}")
    print(f"  Unique headlines:  {len(seen_headlines)}")
    print(f"{'='*60}")

    return stats


# ================================================================
# VALIDATION
# ================================================================

def validate_training_file(path: str) -> dict:
    """Validate a training JSONL file."""
    stats = {"total": 0, "valid_json": 0, "valid_schema": 0,
             "guardrail_pass": 0, "errors": [], "verdicts": {}}

    with open(path) as f:
        for i, line in enumerate(f, 1):
            stats["total"] += 1
            try:
                data = json.loads(line)
                stats["valid_json"] += 1

                # Extract assistant output
                if "system" in data and "messages" in data:
                    msgs = data["messages"]
                    text = msgs[-1]["content"][0]["text"] if isinstance(msgs[-1].get("content"), list) else msgs[-1].get("content", "")
                elif "messages" in data:
                    text = data["messages"][-1].get("content", "")
                else:
                    stats["errors"].append(f"Line {i}: unknown format")
                    continue

                output = json.loads(text)
                if "headline" not in output or "pinch" not in output:
                    stats["errors"].append(f"Line {i}: missing headline/pinch")
                    continue

                stats["valid_schema"] += 1

                # Check headline quality
                headline = output["headline"]
                if len(headline) > 100:
                    stats["errors"].append(f"Line {i}: headline too long ({len(headline)} chars)")
                if len(headline) < 10:
                    stats["errors"].append(f"Line {i}: headline too short ({len(headline)} chars)")

                # Check pinch segments
                pinch = output["pinch"]
                if len(pinch) < 2:
                    stats["errors"].append(f"Line {i}: pinch has only {len(pinch)} segments")
                valid_styles = {"normal", "positive", "negative", "fix"}
                for seg in pinch:
                    if seg.get("style") not in valid_styles:
                        stats["errors"].append(f"Line {i}: invalid style '{seg.get('style')}'")

                # Extract verdict from user prompt
                user_text = msgs[0]["content"][0]["text"] if isinstance(msgs[0].get("content"), list) else msgs[0].get("content", "")
                for v in ["this_is_it", "smart_pick", "not_this_one"]:
                    if f"VERDICT: {v}" in user_text:
                        stats["verdicts"][v] = stats["verdicts"].get(v, 0) + 1
                        break

                # Run guardrails
                from engine.guardrails import check_text
                all_text = headline + " " + " ".join(s.get("text", "") for s in pinch)
                gr = check_text(all_text)
                if gr.passed:
                    stats["guardrail_pass"] += 1
                else:
                    for v in gr.violations:
                        stats["errors"].append(f"Line {i}: guardrail {v.rule}: '{v.text}'")

            except json.JSONDecodeError as e:
                stats["errors"].append(f"Line {i}: invalid JSON - {e}")

    return stats


# ================================================================
# CLI
# ================================================================

if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(
        description="Build Kridha training data using Claude as teacher model"
    )
    parser.add_argument("--output", "-o", default="training_data.jsonl",
                        help="Output JSONL path")
    parser.add_argument("--format", "-f", default="bedrock_nova",
                        choices=["bedrock_nova", "openai_compat"])
    parser.add_argument("--limit", "-l", type=int, default=0,
                        help="Max scenarios (0 = all)")
    parser.add_argument("--env", "-e", metavar="FILE",
                        help="Load .env file for credentials")
    parser.add_argument("--model", "-m",
                        help="Override model ID")
    parser.add_argument("--backend", "-b", default="local",
                        choices=["anthropic", "bedrock", "local"],
                        help="Backend: local (no API), anthropic, or bedrock")
    parser.add_argument("--validate", "-v", metavar="FILE",
                        help="Validate an existing JSONL file")

    args = parser.parse_args()

    logging.basicConfig(level=logging.WARNING)

    if args.validate:
        stats = validate_training_file(args.validate)
        print(f"\nValidation: {args.validate}")
        print(f"  Total lines:     {stats['total']}")
        print(f"  Valid JSON:      {stats['valid_json']}")
        print(f"  Valid schema:    {stats['valid_schema']}")
        print(f"  Guardrail pass:  {stats['guardrail_pass']}")
        print(f"  Verdicts:        {stats['verdicts']}")
        if stats["errors"]:
            print(f"\n  Issues ({len(stats['errors'])}):")
            for e in stats["errors"][:20]:
                print(f"    {e}")
            if len(stats["errors"]) > 20:
                print(f"    ... and {len(stats['errors'])-20} more")
    else:
        build_training_data(
            output_path=args.output,
            format_type=args.format,
            limit=args.limit,
            env_file=args.env,
            model_id=args.model,
            backend=args.backend,
        )
