"""
Kridha Communication Engine — End-to-End Pipeline
===================================================
Takes ScoreResult + profiles → returns UI-ready CommunicationOutput JSON.

Zero LLM calls. Zero latency. Zero hallucination risk.
Uses the phrase bank (gold_generator) for headlines + pinch,
deterministic functions for everything else.

Usage:
    from engine.communicate import generate_communication

    comm = generate_communication(
        score_result=result_dict,
        body_profile=body_dict,
        garment_profile=garment_dict,
    )
    # comm is a dict ready for JSON serialization to the UI
"""

import hashlib
from typing import Any, Dict, List, Optional

from .communication_schema import (
    CommunicationOutput,
    select_verdict,
    build_goal_chips,
    build_search_pills,
    build_search_context,
    build_chat_chips,
    build_user_line,
    build_photo_note,
    build_confidence_note,
    build_triple_checks,
    analyze_principles,
)
from .gold_generator import generate_gold_output
from .guardrails import check_output


def _body_shape_str(body_profile: dict) -> str:
    """Extract body shape as a lowercase string."""
    shape = body_profile.get("body_shape", "rectangle")
    if hasattr(shape, "value"):
        shape = shape.value
    return str(shape).lower()


def _garment_category_str(garment_profile: dict) -> str:
    """Extract garment category as a lowercase string."""
    cat = garment_profile.get("category", "dress")
    if hasattr(cat, "value"):
        cat = cat.value
    return str(cat).lower()


def _make_scenario_id(body_profile: dict, garment_profile: dict) -> str:
    """Generate a deterministic scenario ID for phrase bank seeding."""
    height = body_profile.get('height', 0)
    bust = body_profile.get('bust', 0)
    waist = body_profile.get('waist', 0)
    hip = body_profile.get('hip', 0)
    body_shape = _body_shape_str(body_profile)
    garment_cat = _garment_category_str(garment_profile)
    color_lightness = garment_profile.get('color_lightness', 0.5)
    silhouette = garment_profile.get('silhouette', 'fitted')

    # Format height as int if whole number to match JS behavior
    # JS: `${68}` outputs "68", Python: f"{68.0}" outputs "68.0"
    height_str = str(int(height)) if height == int(height) else str(height)

    seed = f"{height_str}{bust}{waist}{hip}{body_shape}{garment_cat}{color_lightness}{silhouette}"

    # DEBUG LOGGING
    print(f"[PY make_scenario_id] height={height_str}, bust={bust}, waist={waist}, hip={hip}")
    print(f"[PY make_scenario_id] body_shape={body_shape}, garment_cat={garment_cat}")
    print(f"[PY make_scenario_id] color_lightness={color_lightness}, silhouette={silhouette}")
    print(f"[PY make_scenario_id] seed={seed}")

    return hashlib.md5(seed.encode()).hexdigest()[:12]


def generate_communication(
    score_result: dict,
    body_profile: dict,
    garment_profile: dict,
    styling_goals: Optional[List[str]] = None,
    user_name: str = "You",
    run_guardrails: bool = True,
) -> dict:
    """
    Generate complete UI-ready communication from scoring output.

    Args:
        score_result:    Serialized ScoreResult dict from /score endpoint
        body_profile:    Body profile dict (user_measurements from request)
        garment_profile: Garment profile dict (garment_attributes from request)
        styling_goals:   Optional list of goal strings
        user_name:       User display name
        run_guardrails:  Whether to validate output through guardrails

    Returns:
        Dict with all CommunicationOutput fields + guardrail_result
    """
    overall_score = score_result.get("overall_score", 5.0)
    body_shape = _body_shape_str(body_profile)
    garment_cat = _garment_category_str(garment_profile)
    scenario_id = _make_scenario_id(body_profile, garment_profile)

    # ── Step 1: Verdict ──
    verdict, color = select_verdict(overall_score)

    # ── Step 2: Principle analysis ──
    principle_scores = score_result.get("principle_scores", [])
    analysis = analyze_principles(principle_scores)

    # ── Step 3: Headline + Pinch via phrase bank ──
    scored_dict = {
        "scenario_id": scenario_id,
        "verdict": verdict,
        "body_shape": body_shape,
        "garment_category": garment_cat,
        "top_positive_key": analysis["top_positive_key"],
        "top_negative_key": analysis["top_negative_key"],
        "score_result": score_result,
    }
    gold = generate_gold_output(scored_dict)
    headline = gold.get("headline", "")
    pinch = gold.get("pinch", [])

    # ── Step 4: Goal chips ──
    goal_verdicts = score_result.get("goal_verdicts", [])
    goal_chips = build_goal_chips(goal_verdicts)

    # ── Step 5: Search pills + context (NTO and SP only) ──
    top_neg = analysis["top_negative_key"] or "_default"
    search_pills = build_search_pills(verdict, top_neg, garment_cat)
    search_context = build_search_context(verdict, top_neg, garment_cat)

    # ── Step 6: Chat chips ──
    chat_chips = build_chat_chips(verdict, garment_cat)

    # ── Step 7: User line ──
    body_for_line = dict(body_profile)
    body_for_line.setdefault("name", user_name)
    user_line = build_user_line(body_for_line)

    # ── Step 8: Photo note ──
    body_adjusted = score_result.get("body_adjusted") or {}
    photo_note = build_photo_note(body_profile, garment_profile, body_adjusted)

    # ── Step 9: Confidence note ──
    confidence = score_result.get("confidence", 0.70)
    missing_fields = garment_profile.get("missing_fields", [])
    confidence_note = build_confidence_note(confidence, missing_fields)

    # ── Step 10: Triple checks (TII only) ──
    triple_checks = build_triple_checks(verdict, principle_scores)

    # ── Step 11: Full take prompt context (deferred LLM layer) ──
    full_take_context = _build_full_take_context(
        verdict, overall_score, body_shape, garment_cat,
        analysis, score_result,
    )

    # ── Assemble output ──
    output = CommunicationOutput(
        verdict=verdict,
        verdict_color=color,
        headline=headline,
        pinch=[_seg_to_pinch(s) for s in pinch],
        user_line=user_line,
        goal_chips=goal_chips,
        photo_note=photo_note,
        confidence_note=confidence_note,
        triple_checks=triple_checks,
        search_pills=search_pills,
        search_context=search_context,
        chat_chips=chat_chips,
        full_take_prompt_context=full_take_context,
    )

    result = output.to_dict()
    result["overall_score"] = round(overall_score, 1)

    # ── Step 12: Guardrails ──
    if run_guardrails:
        gr = check_output(result)
        result["guardrail_result"] = {
            "passed": gr.passed,
            "violations": [
                {"rule": v.rule, "severity": v.severity,
                 "text": v.text, "suggestion": v.suggestion}
                for v in gr.violations
            ],
            "warnings": [
                {"rule": w.rule, "severity": w.severity,
                 "text": w.text, "suggestion": w.suggestion}
                for w in gr.warnings
            ],
        }

    return result


def _seg_to_pinch(seg: dict):
    """Convert a pinch segment dict to PinchSegment dataclass."""
    from .communication_schema import PinchSegment
    if isinstance(seg, dict):
        return PinchSegment(text=seg.get("text", ""), style=seg.get("style", "normal"))
    return seg


def _build_full_take_context(
    verdict: str, overall_score: float, body_shape: str,
    garment_cat: str, analysis: dict, score_result: dict,
) -> str:
    """Build context string for the deferred LLM Full Stylist Take.

    This gets passed to the fine-tuned model when the user taps
    "Tell me more" — it's NOT shown in the instant response.
    """
    parts = [
        f"verdict={verdict} score={overall_score:.1f}",
        f"body={body_shape} garment={garment_cat}",
    ]

    # Top 3 positives with reasoning
    for p in analysis.get("positives", [])[:3]:
        name = p.get("name", "")
        score = p.get("score", 0)
        reasoning = p.get("reasoning", "")
        parts.append(f"+{name}({score:+.2f}): {reasoning}")

    # Top 3 negatives with reasoning
    for n in analysis.get("negatives", [])[:3]:
        name = n.get("name", "")
        score = n.get("score", 0)
        reasoning = n.get("reasoning", "")
        parts.append(f"-{name}({score:+.2f}): {reasoning}")

    # Fixes
    fixes = score_result.get("fixes", [])
    if fixes:
        fix_strs = []
        for f in fixes[:3]:
            if isinstance(f, dict):
                fix_strs.append(f.get("what_to_change", ""))
            else:
                fix_strs.append(str(f))
        parts.append(f"fixes=[{'; '.join(fix_strs)}]")

    return " | ".join(parts)
