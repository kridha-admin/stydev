"""
Kridha Communication Schema — Output structure for the communication layer.

Defines what Nova Micro must produce and what the UI consumes.
Also contains deterministic components that don't need LLM:
  - verdict selection (threshold)
  - goal chip mapping
  - search pill mapping
  - chat chip suggestions
"""

from dataclasses import dataclass, field, asdict
from typing import List, Dict, Optional, Tuple


# ================================================================
# OUTPUT DATACLASSES
# ================================================================

@dataclass
class PinchSegment:
    """One styled segment of The Pinch text."""
    text: str
    style: str    # "normal" | "positive" | "negative" | "fix"


@dataclass
class GoalChip:
    """UI chip showing how a garment interacts with a user goal."""
    goal: str       # display label: "Look taller", "Streamline hips"
    icon: str
    verdict: str    # "helping" | "fighting" | "mixed"


@dataclass
class CommunicationOutput:
    """Complete UI-ready output from the communication engine."""
    # Core verdict
    verdict: str                               # "this_is_it" | "smart_pick" | "not_this_one"
    verdict_color: str                         # "teal" | "amber" | "rose"

    # LLM-generated content
    headline: str                              # 1 sentence, decisive
    pinch: List[PinchSegment] = field(default_factory=list)  # 2-5 styled segments

    # Deterministic content
    user_line: str = ""                        # "For Piya · 5'3" · Pear · Short torso"
    goal_chips: List[GoalChip] = field(default_factory=list)
    photo_note: Optional[str] = None
    confidence_note: Optional[str] = None
    triple_checks: Optional[List[str]] = None  # top 3 positive principle labels (TII only)
    search_pills: Optional[List[str]] = None   # "ponte dress", "structured knit" (NTO/SP)
    search_context: Optional[str] = None       # empowering redirect line
    chat_chips: List[str] = field(default_factory=list)  # suggested questions

    # Deferred LLM context
    full_take_prompt_context: Optional[str] = None

    def to_dict(self) -> dict:
        d = asdict(self)
        return {k: v for k, v in d.items() if v is not None and not k.startswith("_")}


# ================================================================
# VERDICT SELECTION — deterministic
# ================================================================

def select_verdict(overall_score: float) -> Tuple[str, str]:
    """Returns (verdict_key, color). Pure threshold check.

    Thresholds on the rescaled 0-10 display score:
      - this_is_it:   ≥ 8.0  (top ~20% — clearly great)
      - smart_pick:   5.0–7.9 (middle ~55% — decent with caveats)
      - not_this_one: < 5.0  (bottom ~25% — clear skip)
    """
    if overall_score >= 8.0:
        return "this_is_it", "teal"
    elif overall_score >= 5.0:
        return "smart_pick", "amber"
    else:
        return "not_this_one", "rose"


# ================================================================
# GOAL CHIP MAPPING — deterministic
# ================================================================

GOAL_LABELS = {
    "look_taller":       ("Look taller", "↑"),
    "highlight_waist":   ("Highlight waist", "◇"),
    "hide_midsection":   ("Minimize middle", "○"),
    "slim_hips":         ("Streamline hips", "▯"),
    "look_proportional": ("Proportional", "⬡"),
    "minimize_arms":     ("Streamline arms", "◌"),
    "slimming":          ("Slimming", "↓"),
    "concealment":       ("Smooth silhouette", "○"),
    "emphasis":          ("Emphasis", "◆"),
    "balance":           ("Balance", "⬡"),
}

VERDICT_TO_UI = {
    "pass": "helping",
    "fail": "fighting",
    "caution": "mixed",
}


def build_goal_chips(goal_verdicts: list) -> List[GoalChip]:
    chips = []
    for gv in goal_verdicts:
        if isinstance(gv, dict):
            goal_key = gv.get("goal", "").lower().replace(" ", "_")
            v = gv.get("verdict", "caution")
        else:
            goal_key = gv.goal.value if hasattr(gv.goal, "value") else str(gv.goal).lower()
            v = gv.verdict

        label, icon = GOAL_LABELS.get(goal_key, (goal_key.replace("_", " ").title(), "·"))
        verdict_ui = VERDICT_TO_UI.get(v, "mixed")
        chips.append(GoalChip(goal=label, icon=icon, verdict=verdict_ui))

    return chips


# ================================================================
# SEARCH PILLS — deterministic, keyed by dominant negative principle
# ================================================================

SEARCH_PILL_BANK = {
    "fabric_structure":     ["sculpting {g}", "ponte {g}", "structured knit", "double-lined"],
    "bodycon_cling":        ["smoothing {g}", "sculpting {g}", "compression", "ponte"],
    "hemline":              ["petite {g}", "mini length", "above-knee {g}"],
    "hemline_long":         ["midi {g}", "knee-length {g}"],
    "rise_elongation":      ["high-waist {g}", "high-rise {g}"],
    "v_neck_elongation":    ["V-neck {g}", "wrap {g}"],
    "a_line_hip":           ["A-line {g}", "fit-and-flare {g}"],
    "wide_leg":             ["wide-leg pants", "palazzo pants", "straight-leg"],
    "sleeve_endpoint":      ["three-quarter sleeve {g}", "long sleeve {g}"],
    "monochrome_column":    ["monochrome {g}", "column of color", "tonal dressing"],
    "_default":             ["structured {g}", "sculpting {g}"],
}

SEARCH_CONTEXT_BANK = {
    "fabric_structure": "A {g} can look incredible on you — you just need one where the fabric does the work.",
    "bodycon_cling":    "The right fitted {g} exists — it just needs fabric with enough weight to smooth, not cling.",
    "hemline":          "The right length makes all the difference. Try these:",
    "a_line_hip":       "The right shape for your goals exists — it just isn't this one. Try these:",
    "wide_leg":         "A different leg shape will work with your frame instead of against it.",
    "_default":         "Here's what will work better for your goals:",
}

GARMENT_WORD_MAP = {
    "dress": "dress", "top": "top", "bottom_pants": "pants",
    "bottom_shorts": "shorts", "skirt": "skirt", "jumpsuit": "jumpsuit",
    "romper": "romper", "jacket": "jacket", "coat": "coat",
    "sweatshirt": "sweatshirt", "cardigan": "cardigan", "vest": "vest",
    "bodysuit": "bodysuit", "loungewear": "loungewear", "activewear": "activewear",
    "saree": "saree", "salwar_kameez": "salwar kameez", "lehenga": "lehenga",
}


def _garment_word(category: str) -> str:
    if hasattr(category, "value"):
        category = category.value
    return GARMENT_WORD_MAP.get(category.lower(), "garment")


def build_search_pills(verdict: str, top_negative_key: str,
                        garment_category: str = "dress") -> Optional[List[str]]:
    if verdict == "this_is_it":
        return None
    g = _garment_word(garment_category)
    templates = SEARCH_PILL_BANK.get(top_negative_key, SEARCH_PILL_BANK["_default"])
    return [t.replace("{g}", g) for t in templates[:4]]


def build_search_context(verdict: str, top_negative_key: str,
                          garment_category: str = "dress") -> Optional[str]:
    if verdict == "this_is_it":
        return None
    g = _garment_word(garment_category)
    template = SEARCH_CONTEXT_BANK.get(top_negative_key, SEARCH_CONTEXT_BANK["_default"])
    return template.replace("{g}", g)


# ================================================================
# CHAT CHIPS — deterministic
# ================================================================

CHAT_CHIP_BANK = {
    "this_is_it": {
        "dress": ["What shoes work?", "Office appropriate?", "What jacket pairs with this?"],
        "top": ["What bottom works?", "How should I style it?", "Tuck or untuck?"],
        "bottom_pants": ["What top goes with this?", "Office appropriate?", "Find more like this"],
        "skirt": ["What top pairs?", "What shoes work?", "For a date night?"],
        "_default": ["How should I style this?", "Find more like this", "Worth the price?"],
    },
    "smart_pick": {
        "dress": ["What shoes work?", "Worth the alteration?", "Find similar but shorter?"],
        "bottom_pants": ["Will the waist stretch?", "Worth the price?", "What belt works?"],
        "_default": ["How do I fix this?", "Worth the price?", "Find something similar?"],
    },
    "not_this_one": {
        "dress": ["Find me a structured version", "What fabric should I look for?", "Will a jacket help?"],
        "bottom_pants": ["Find a high-rise version", "What cut works for me?", "Show me better options"],
        "_default": ["Find me something better", "What should I look for?", "What will work for my goals?"],
    },
}


def build_chat_chips(verdict: str, garment_category: str = "dress") -> List[str]:
    cat = garment_category.lower() if isinstance(garment_category, str) else garment_category.value
    verdict_chips = CHAT_CHIP_BANK.get(verdict, CHAT_CHIP_BANK["smart_pick"])
    return verdict_chips.get(cat, verdict_chips.get("_default", []))[:3]


# ================================================================
# USER LINE — deterministic
# ================================================================

def _inches_to_display(inches: float) -> str:
    feet = int(inches // 12)
    remaining = int(inches % 12)
    return f"{feet}'{remaining}\""


def build_user_line(body_profile: dict) -> str:
    parts = []
    name = body_profile.get("name", "You")
    parts.append(f"For {name}")

    height = body_profile.get("height", 0)
    if height:
        parts.append(_inches_to_display(height))

    shape = body_profile.get("body_shape", "")
    if shape:
        if hasattr(shape, "value"):
            shape = shape.value
        parts.append(shape.replace("_", " ").title())

    ratio = body_profile.get("torso_leg_ratio", 0.50)
    if ratio < 0.48:
        parts.append("Short torso")
    elif ratio > 0.52:
        parts.append("Long torso")

    return " · ".join(parts)


# ================================================================
# PHOTO NOTE — deterministic template
# ================================================================

def build_photo_note(body_profile: dict, garment_profile: dict,
                     body_adjusted: dict = None) -> Optional[str]:
    user_height = body_profile.get("height", 0)
    model_height = garment_profile.get("model_height", 0) or garment_profile.get("model_height_inches", 0)

    if model_height and user_height and abs(model_height - user_height) >= 3:
        diff = abs(model_height - user_height)
        user_h = _inches_to_display(user_height)
        model_h = _inches_to_display(model_height)
        if diff >= 5:
            return f"The model is {model_h} and you're {user_h}. That {int(diff)}\" changes where everything falls on your body."
        else:
            return f"The model is {model_h} — this will land differently on you at {user_h}."

    if body_adjusted:
        discount = body_adjusted.get("photo_reality_discount", 0)
        if isinstance(discount, (int, float)) and discount > 0.20:
            return "The product photo is styled to hide how this fabric actually behaves."

    return None


# ================================================================
# CONFIDENCE NOTE — deterministic template
# ================================================================

def build_confidence_note(confidence: float, missing_fields: list = None) -> Optional[str]:
    if confidence >= 0.75:
        return None

    if missing_fields:
        if "gsm" in missing_fields or "fabric_weight" in missing_fields:
            return "Fabric thickness not listed — our read is based on the blend and photos."
        if "stretch" in missing_fields:
            return "Stretch percentage estimated from the fabric blend — actual may vary."

    if confidence < 0.60:
        return "We're less certain on this one — some product details weren't available."

    return "Fabric weight estimated from blend and price point."


# ================================================================
# TRIPLE CHECKS — deterministic (top 3 positive principles)
# ================================================================

TRIPLE_CHECK_LABELS = {
    "hemline": "Right length",
    "rise_elongation": "High waist",
    "v_neck_elongation": "V-neckline",
    "monochrome_column": "Dark column",
    "waist_definition": "Defined waist",
    "waist_placement": "Waist placed right",
    "a_line_hip": "A-line shape",
    "a_line_balance": "A-line balance",
    "wide_leg": "Wide leg",
    "fabric_structure": "Good fabric",
    "fabric_zone": "Fabric works",
    "sleeve_endpoint": "Right sleeve",
    "color_value": "Color works",
    "color_harmony": "Color harmony",
    "neckline_compound": "Neckline works",
    "dark_black_slimming": "Dark slimming",
    "matte_zone": "Matte finish",
    "bodycon_mapping": "Fit works",
}


def build_triple_checks(verdict: str, principle_scores: list) -> Optional[List[str]]:
    if verdict != "this_is_it":
        return None

    positives = []
    for p in principle_scores:
        if isinstance(p, dict):
            if not p.get("applicable", True):
                continue
            score = p.get("score", 0)
            name = p.get("name", "")
        else:
            if not getattr(p, "applicable", True):
                continue
            score = p.score
            name = p.name

        if score > 0.05:
            key = name.lower().strip().replace(" ", "_").replace("-", "_")
            positives.append((score, key))

    positives.sort(reverse=True)
    top3 = [TRIPLE_CHECK_LABELS.get(k, k.replace("_", " ").title()) for _, k in positives[:3]]
    return top3 if len(top3) >= 2 else None


# ================================================================
# PRINCIPLE ANALYSIS HELPER
# ================================================================

PRINCIPLE_KEY_MAP = {
    "h-stripe_thinning":    "horizontal_stripes",
    "h_stripe_thinning":    "horizontal_stripes",
    "dark/black_slimming":  "dark_slimming",
    "dark_black_slimming":  "dark_slimming",
    "rise_elongation":      "rise_elongation",
    "a-line_balance":       "a_line_balance",
    "a_line_balance":       "a_line_balance",
    "tent_concealment":     "tent_concealment",
    "color_break":          "color_break",
    "bodycon_mapping":      "bodycon_cling",
    "matte_zone":           "matte_zone",
    "v-neck_elongation":    "v_neck_elongation",
    "v_neck_elongation":    "v_neck_elongation",
    "monochrome_column":    "monochrome_column",
    "hemline":              "hemline",
    "sleeve":               "sleeve_endpoint",
    "waist_placement":      "waist_definition",
    "color_value":          "color_value",
    "fabric_zone":          "fabric_structure",
    "neckline_compound":    "neckline",
}


def normalize_principle_key(name: str) -> str:
    key = name.lower().strip().replace(" ", "_").replace("-", "_")
    return PRINCIPLE_KEY_MAP.get(key, key)


def analyze_principles(principle_scores: list) -> dict:
    applicable = []
    for p in principle_scores:
        if isinstance(p, dict):
            if not p.get("applicable", True):
                continue
            applicable.append(p)
        else:
            if not getattr(p, "applicable", True):
                continue
            applicable.append({
                "name": p.name, "score": p.score,
                "weight": getattr(p, "weight", 1.0),
                "reasoning": getattr(p, "reasoning", ""),
            })

    positives = sorted(
        [p for p in applicable if p["score"] > 0.05],
        key=lambda x: x["score"] * x.get("weight", 1.0), reverse=True,
    )
    negatives = sorted(
        [p for p in applicable if p["score"] < -0.05],
        key=lambda x: x["score"] * x.get("weight", 1.0),
    )

    top_pos_key = normalize_principle_key(positives[0]["name"]) if positives else None
    top_neg_key = normalize_principle_key(negatives[0]["name"]) if negatives else None

    return {
        "positives": positives,
        "negatives": negatives,
        "top_positive_key": top_pos_key,
        "top_negative_key": top_neg_key,
        "top_3_positive_keys": [normalize_principle_key(p["name"]) for p in positives[:3]],
        "top_3_negative_keys": [normalize_principle_key(p["name"]) for p in negatives[:3]],
    }
