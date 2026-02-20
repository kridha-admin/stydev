"""
Kridha Guardrails — Body-Safe Language Checker

Catches body-shaming language, missing redirects, and voice violations
before any text ships to the UI. Every output passes through this.

7 Rules:
  1. Body as negative subject  → BLOCK
  2. Body comparison           → BLOCK
  3. Negative body descriptions → BLOCK
  4. Forbidden body-type labels → BLOCK
  5. Missing redirects (NTO)   → BLOCK
  6. NTO must lead positive    → WARN
  7. Hedge / AI reference      → WARN
"""

import re
from dataclasses import dataclass, field
from typing import List, Tuple


@dataclass
class GuardrailViolation:
    rule: str
    severity: str       # "block" | "warn"
    text: str
    suggestion: str = ""


@dataclass
class GuardrailResult:
    passed: bool
    violations: List[GuardrailViolation] = field(default_factory=list)
    warnings: List[GuardrailViolation] = field(default_factory=list)


# ================================================================
# RULE 1: Body as negative subject
# ================================================================

BODY_AS_NEGATIVE_SUBJECT = [
    (r"your\s+(hips?|arms?|legs?|thighs?|bell(?:y|ies)|stomach|midsection|bust|chest|shoulders?|waist|torso|calves|ankles?|figure|body)\s+(?:is|are|look|looks|seem|seems)\s+(?:too|very|quite|rather|extremely)\s+\w+",
     "body_negative_subject", "block",
     "Flip the subject: 'the fabric clings at the hip' not 'your hips are too wide'"),

    (r"(?:too|very|quite)\s+(?:wide|big|large|thick|heavy|short|long|prominent|broad|narrow|flat|full)\s+(?:hips?|arms?|legs?|thighs?|bust|chest|shoulders?|waist|calves|stomach|midsection)",
     "body_negative_adjective", "block",
     "Remove body-negative adjective. Describe the garment's behavior instead."),

    (r"your\s+(?:body|body\s*type|figure|frame|shape|build)\s+(?:doesn't|does\s+not|can't|cannot|won't|will\s+not|isn't|is\s+not)\s+(?:suit|work|fit|allow|support|handle)",
     "body_as_problem", "block",
     "The garment fails the body, not the other way around."),
]

# ================================================================
# RULE 2: Body comparison
# ================================================================

BODY_COMPARISON = [
    (r"(?:the\s+)?model\s+(?:weighs|is\s+a\s+size|wears?\s+(?:a\s+)?size|is\s+(?:about\s+)?\d+\s*(?:lbs?|pounds?|kg))",
     "model_weight_comparison", "block",
     "Only compare model HEIGHT. Never weight or size."),

    (r"(?:thin|slim|skinny|petite|smaller|larger|bigger|heavier|thinner)\s+(?:people|bodies|women|men|frames|persons|figures)",
     "body_type_comparison", "block",
     "Don't compare body types. Describe what the fabric does."),

    (r"(?:on|for)\s+(?:a|an)\s+(?:thin|slim|skinny|larger|bigger|heavier|plus[\s-]?size|overweight)\s+(?:body|frame|person|figure|woman|man)",
     "body_type_reference", "block",
     "Remove body-type references. Describe the garment's behavior instead."),
]

# ================================================================
# RULE 3: Negative body descriptions
# ================================================================

NEGATIVE_BODY_DESCRIPTIONS = [
    (r"(?:cling|stick|stretch|pull|grab)\w*\s+to\s+every\s+(?:curve|bump|roll|line|contour|inch|part|bit)",
     "every_curve_cling", "block",
     "Say 'follows every contour instead of creating a smooth line'"),

    (r"show(?:s|ing)?\s+(?:every|all|your|the)\s+(?:curve|bump|roll|line|contour|imperfection|flaw)",
     "shows_every", "block",
     "Say 'the fabric doesn't smooth through the midsection'"),

    (r"(?:highlight|emphasize|accentuate|expose|reveal|draw\s+attention\s+to)\s+(?:your|the)\s+(?:belly|stomach|midsection|tummy|gut|love\s+handles|bulge|problem\s+area|trouble\s+spot|flaw)",
     "highlight_body_negative", "block",
     "Say 'draws attention where you want to minimize' or describe the garment action"),

    (r"make(?:s)?\s+your\s+(?:legs?|arms?|hips?|bust|chest|torso|body|figure)\s+look\s+(?:stumpy|stubby|short|fat|wide|big|thick|heavy|bulky|dumpy|frumpy|shapeless)",
     "make_body_look_negative", "block",
     "Say 'cuts your leg line short' not 'makes your legs look stumpy'"),

    (r"(?:problem|trouble)\s+(?:area|spot|zone)s?",
     "problem_area_term", "block",
     "There are no 'problem areas.' Describe the garment interaction."),

    (r"\b(?:strengths?\s+and\s+weaknesses?|weaknesses?\s+and\s+strengths?)\b",
     "strengths_weaknesses", "block",
     "Bodies don't have 'weaknesses.' Say 'what you want to draw attention to.'"),

    (r"\b(?:hide|camouflage|conceal|cover\s+up)\s+(?:your|the)\s+(?:belly|stomach|midsection|tummy|hips?|arms?|thighs?|flaws?)",
     "hide_body_parts", "block",
     "Don't 'hide' body parts. Say 'the fabric skims smoothly' or 'keeps the silhouette clean.'"),
]

# ================================================================
# RULE 4: Forbidden body-type labels
# ================================================================

FORBIDDEN_LABELS = [
    (r"\bplus[\s-]?size\b", "plus_size_label", "block",
     "Never use 'plus size.' Describe the garment behavior instead."),

    (r"\b(?:overweight|heavy[\s-]?set|full[\s-]?figured|obese|fat|chubby|curvy\s+girl)\b",
     "body_label", "block",
     "Never use body-size labels. Describe the garment behavior."),

    # "skinny" is allowed in garment names like "skinny jeans/pants/fit"
    (r"\bskinny\b(?!\s+(?:jeans?|pants?|fit|leg|cut|jean))",
     "thin_label", "warn",
     "Avoid body-size labels even for thin bodies."),

    (r"\b(?:bony|scrawny|stick[\s-]?thin|rail[\s-]?thin)\b",
     "thin_label_strict", "warn",
     "Avoid body-size labels even for thin bodies."),
]

# ================================================================
# RULE 5: Missing redirects for "Not This One"
# ================================================================

def check_redirect_present(output_json: dict) -> List[GuardrailViolation]:
    violations = []
    if output_json.get("verdict") == "not_this_one":
        has_pills = bool(output_json.get("search_pills"))
        has_context = bool(output_json.get("search_context"))
        if not has_pills and not has_context:
            violations.append(GuardrailViolation(
                rule="missing_redirect",
                severity="block",
                text="Not This One verdict has no search pills or redirect context",
                suggestion="Add search_pills and search_context to give the user a next step.",
            ))
    return violations


# ================================================================
# RULE 6: "Not This One" must lead with something positive
# ================================================================

def check_not_this_one_positive_lead(output_json: dict) -> List[GuardrailViolation]:
    violations = []
    if output_json.get("verdict") != "not_this_one":
        return violations

    pinch = output_json.get("pinch", [])
    if isinstance(pinch, dict):
        pinch = pinch.get("segments", [])
    if not pinch:
        return violations

    first_styles = [s.get("style") for s in pinch[:3] if isinstance(s, dict)]
    if first_styles and all(s == "negative" for s in first_styles if s != "normal"):
        violations.append(GuardrailViolation(
            rule="not_this_one_no_positive_lead",
            severity="warn",
            text="Not This One pinch leads with only negatives",
            suggestion="Lead with what's good: 'The design is great. The fabric isn't.'",
        ))
    return violations


# ================================================================
# RULE 7: Hedge language / AI references
# ================================================================

HEDGE_PATTERNS = [
    (r"\b(?:this\s+)?might\s+not\s+(?:be|look|work|fit)\b",
     "hedge_might_not", "warn",
     "Be decisive. 'This won't work' not 'this might not work.'"),

    (r"\byou\s+might\s+want\s+to\s+consider\b",
     "hedge_consider", "warn",
     "Be direct. 'Here's what works better' not 'you might want to consider.'"),

    (r"\bbased\s+on\s+(?:our|the)\s+(?:analysis|algorithm|data|model|scoring)\b",
     "hedge_based_on", "warn",
     "State the finding directly. Don't reference the algorithm."),

    (r"\bour\s+(?:ai|algorithm|model|engine|system)\s+(?:suggests|recommends|thinks|predicts)\b",
     "ai_reference", "warn",
     "Never reference the AI/algorithm. Just state the recommendation."),
]


# ================================================================
# MAIN CHECKER
# ================================================================

ALL_PATTERN_RULES = (
    BODY_AS_NEGATIVE_SUBJECT
    + BODY_COMPARISON
    + NEGATIVE_BODY_DESCRIPTIONS
    + FORBIDDEN_LABELS
    + HEDGE_PATTERNS
)


def _extract_all_text(output_json: dict) -> str:
    parts = []
    if output_json.get("headline"):
        parts.append(output_json["headline"])

    pinch = output_json.get("pinch", [])
    if isinstance(pinch, list):
        for seg in pinch:
            if isinstance(seg, dict):
                parts.append(seg.get("text", ""))
            elif isinstance(seg, str):
                parts.append(seg)
    elif isinstance(pinch, dict):
        for seg in pinch.get("segments", []):
            parts.append(seg.get("text", ""))

    if isinstance(output_json.get("photo_note"), str):
        parts.append(output_json["photo_note"])
    elif isinstance(output_json.get("photo_note"), dict):
        parts.append(output_json["photo_note"].get("text", ""))

    if output_json.get("search_context"):
        parts.append(output_json["search_context"])
    if output_json.get("confidence_note"):
        parts.append(output_json["confidence_note"])
    if output_json.get("full_take"):
        parts.append(output_json["full_take"])

    return " ".join(parts)


def check_patterns(text: str) -> Tuple[List[GuardrailViolation], List[GuardrailViolation]]:
    blocks = []
    warnings = []
    text_lower = text.lower()

    for pattern, rule_name, severity, suggestion in ALL_PATTERN_RULES:
        matches = re.findall(pattern, text_lower)
        if matches:
            match_text = matches[0] if isinstance(matches[0], str) else " ".join(matches[0])
            v = GuardrailViolation(
                rule=rule_name, severity=severity,
                text=match_text, suggestion=suggestion,
            )
            if severity == "block":
                blocks.append(v)
            else:
                warnings.append(v)

    return blocks, warnings


def check_output(output_json: dict) -> GuardrailResult:
    all_text = _extract_all_text(output_json)
    blocks, warnings = check_patterns(all_text)
    blocks.extend(check_redirect_present(output_json))
    warnings.extend(check_not_this_one_positive_lead(output_json))

    return GuardrailResult(
        passed=len(blocks) == 0,
        violations=blocks,
        warnings=warnings,
    )


def check_text(text: str) -> GuardrailResult:
    blocks, warnings = check_patterns(text)
    return GuardrailResult(
        passed=len(blocks) == 0,
        violations=blocks,
        warnings=warnings,
    )
