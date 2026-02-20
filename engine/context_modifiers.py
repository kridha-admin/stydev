"""
Kridha Production Scoring Engine — Context Modifiers
=====================================================
Cultural, occasion, age, and climate modifiers loaded from the
golden registry context_rules.json (47 rules).

These modifiers adjust scores in Layer 6 of the pipeline.
"""

from typing import Dict, List, Optional

from .schemas import (
    BodyProfile, GarmentProfile, PrincipleResult,
    ExceptionTriggered,
)
from .rules_data import get_registry


# ================================================================
# CONTEXT MODIFIER CATEGORIES
# ================================================================

# Color symbolism by culture (from context_rules.json CTX_001-CTX_010)
_COLOR_SYMBOLISM = {
    "india": {
        "red": {"wedding_bride": +0.95, "wedding_guest": -0.30, "general": 0.0},
        "white": {"celebration": -0.90, "funeral": +0.50, "general": 0.0},
        "black": {"wedding_ceremony": -0.70, "sangeet": -0.20, "general": 0.0},
        "gold": {"wedding": +0.80, "general": +0.20},
    },
    "us": {
        "red": {"general": 0.0},
        "white": {"wedding_bride": +0.90, "wedding_guest": -0.50, "general": 0.0},
        "black": {"evening": +0.90, "funeral": +0.50, "general": 0.0},
    },
}

# Occasion coverage requirements
_OCCASION_COVERAGE = {
    "formal": {
        "min_sleeve": "short",
        "min_hem": "knee",
        "max_neckline_depth": 4.0,
        "structured_preferred": True,
    },
    "business": {
        "min_sleeve": "short",
        "min_hem": "above_knee",
        "max_neckline_depth": 5.0,
        "structured_preferred": True,
    },
    "business_casual": {
        "min_sleeve": "sleeveless",
        "min_hem": "above_knee",
        "max_neckline_depth": 6.0,
        "structured_preferred": False,
    },
    "casual": {
        "min_sleeve": "sleeveless",
        "min_hem": "mini",
        "max_neckline_depth": 8.0,
        "structured_preferred": False,
    },
    "date_night": {
        "min_sleeve": "sleeveless",
        "min_hem": "above_knee",
        "max_neckline_depth": 7.0,
        "structured_preferred": False,
    },
    "wedding_guest": {
        "min_sleeve": "sleeveless",
        "min_hem": "knee",
        "max_neckline_depth": 5.0,
        "structured_preferred": False,
    },
    "interview": {
        "min_sleeve": "short",
        "min_hem": "knee",
        "max_neckline_depth": 5.0,
        "structured_preferred": True,
    },
    "athletic": {
        "min_sleeve": "sleeveless",
        "min_hem": "mini",
        "max_neckline_depth": 6.0,
        "structured_preferred": False,
    },
    "brunch": {
        "min_sleeve": "sleeveless",
        "min_hem": "above_knee",
        "max_neckline_depth": 7.0,
        "structured_preferred": False,
    },
    "evening": {
        "min_sleeve": "sleeveless",
        "min_hem": "above_knee",
        "max_neckline_depth": 8.0,
        "structured_preferred": False,
    },
}

# Hem position ordering for comparison
_HEM_ORDER = [
    "floor", "ankle", "below_calf", "midi", "below_knee",
    "knee", "above_knee", "mini",
]


def _hem_is_above(actual: str, minimum: str) -> bool:
    """Check if actual hem position is above (shorter than) the minimum."""
    try:
        actual_idx = _HEM_ORDER.index(actual)
        min_idx = _HEM_ORDER.index(minimum)
        return actual_idx > min_idx  # higher index = shorter
    except ValueError:
        return False


# ================================================================
# MAIN MODIFIER FUNCTION
# ================================================================

def apply_context_modifiers(
    context: dict,
    principles: List[PrincipleResult],
    body: BodyProfile,
    garment: GarmentProfile,
) -> Dict[str, float]:
    """Apply context modifiers and return adjustments.

    Args:
        context: Dict with optional keys:
            - occasion: str (formal, business, casual, athletic)
            - culture: str (india, us, etc.)
            - event_type: str (wedding_bride, wedding_guest, funeral, etc.)
            - garment_color: str (red, white, black, gold, etc.)
            - age_range: str (18-25, 25-35, 35-50, 50+)
            - climate: str (hot_humid, hot_dry, temperate, cold)

    Returns:
        Dict of adjustment names -> score deltas
    """
    adjustments: Dict[str, float] = {}

    # ── Cultural color modifiers ──
    culture = context.get("culture", "").lower()
    event_type = context.get("event_type", "general")
    garment_color = context.get("garment_color", "").lower()

    if culture in _COLOR_SYMBOLISM and garment_color:
        color_rules = _COLOR_SYMBOLISM[culture].get(garment_color, {})
        cultural_score = color_rules.get(event_type, color_rules.get("general", 0.0))
        if cultural_score != 0.0:
            adjustments["cultural_color"] = cultural_score

    # ── Occasion coverage check ──
    occasion = context.get("occasion", "").lower()
    if occasion in _OCCASION_COVERAGE:
        reqs = _OCCASION_COVERAGE[occasion]

        # Hemline check
        if _hem_is_above(garment.hem_position, reqs["min_hem"]):
            adjustments["occasion_hem_violation"] = -0.20

        # Neckline depth check
        neckline_depth = garment.neckline_depth or (garment.v_depth_cm / 2.54)
        if neckline_depth > reqs.get("max_neckline_depth", 99):
            adjustments["occasion_neckline_violation"] = -0.15

    # ── Climate modifiers ──
    climate = context.get("climate", "").lower()
    if climate == "hot_humid":
        # Prefer lighter fabrics
        if garment.gsm_estimated > 250:
            adjustments["climate_heavy_fabric"] = -0.10
        # Prefer breathable fibers
        if garment.primary_fiber in ("polyester", "nylon") and not garment.fabric_name:
            adjustments["climate_non_breathable"] = -0.05
    elif climate == "cold":
        if garment.gsm_estimated < 120:
            adjustments["climate_light_fabric"] = -0.10

    # ── Age range modifiers (subtle) ──
    age_range = context.get("age_range", "")
    if age_range == "50+":
        # Slightly prefer structured over bodycon for comfort
        for p in principles:
            if p.name == "Bodycon Mapping" and p.score > 0.20:
                adjustments["age_bodycon_comfort"] = -0.05
    elif age_range == "18-25":
        # Trend-forward tolerance slightly higher
        for p in principles:
            if p.name == "Tent Concealment" and p.score < -0.20:
                adjustments["age_oversized_trend"] = +0.05

    return adjustments
