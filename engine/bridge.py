"""
Kridha Bridge — Schema Converter
=================================
Converts the Node.js pipeline's output (Vineeth's merged garment attributes
+ user measurements) into the Python engine's typed BodyProfile and
GarmentProfile dataclasses.
"""

import json
import logging
import os
import re
from dataclasses import dataclass
from typing import Dict, List, Optional, Tuple

from .schemas import (
    BodyProfile,
    BrandTier,
    FabricConstruction,
    GarmentCategory,
    GarmentLayer,
    GarmentProfile,
    NecklineType,
    Silhouette,
    SleeveType,
    StylingGoal,
    SurfaceFinish,
)

logger = logging.getLogger(__name__)

CM_TO_IN = 1 / 2.54

# ================================================================
# ENUM MAPPING TABLES
# ================================================================

NECKLINE_MAP = {
    "v_neck": NecklineType.V_NECK,
    "crew_neck": NecklineType.CREW,
    "scoop_neck": NecklineType.SCOOP,
    "boat_neck": NecklineType.BOAT,
    "square_neck": NecklineType.SQUARE,
    "sweetheart": NecklineType.SCOOP,
    "off_shoulder": NecklineType.OFF_SHOULDER,
    "halter": NecklineType.HALTER,
    "turtleneck": NecklineType.TURTLENECK,
    "mock_neck": NecklineType.TURTLENECK,
    "cowl_neck": NecklineType.COWL,
    "wrap_surplice": NecklineType.WRAP,
    "one_shoulder": NecklineType.OFF_SHOULDER,
    "strapless": NecklineType.OFF_SHOULDER,
    "collared": NecklineType.CREW,
    "plunging": NecklineType.DEEP_V,
    "keyhole": NecklineType.CREW,
    "peter_pan": NecklineType.CREW,
    "mandarin": NecklineType.TURTLENECK,
    "henley": NecklineType.CREW,
    "asymmetric": NecklineType.SCOOP,
}

SILHOUETTE_MAP = {
    "a_line": Silhouette.A_LINE,
    "fit_and_flare": Silhouette.FIT_AND_FLARE,
    "sheath": Silhouette.FITTED,
    "bodycon": Silhouette.FITTED,
    "shift": Silhouette.SHIFT,
    "wrap": Silhouette.WRAP,
    "mermaid": Silhouette.FITTED,
    "cocoon": Silhouette.OVERSIZED,
    "peplum": Silhouette.PEPLUM,
    "empire": Silhouette.EMPIRE,
    "column": Silhouette.SEMI_FITTED,
    "tent": Silhouette.OVERSIZED,
    "princess_seam": Silhouette.SEMI_FITTED,
    "dropped_waist": Silhouette.SHIFT,
    "tiered": Silhouette.A_LINE,
    "asymmetric": Silhouette.SEMI_FITTED,
}

SLEEVE_MAP = {
    "sleeveless": SleeveType.SLEEVELESS,
    "spaghetti_strap": SleeveType.SLEEVELESS,
    "cap": SleeveType.CAP,
    "short": SleeveType.SHORT,
    "elbow": SleeveType.THREE_QUARTER,
    "three_quarter": SleeveType.THREE_QUARTER,
    "full_length": SleeveType.LONG,
    "bell": SleeveType.BELL,
    "puff": SleeveType.PUFF,
    "raglan": SleeveType.RAGLAN,
    "set_in": SleeveType.SET_IN,
    "dolman": SleeveType.DOLMAN,
    "flutter": SleeveType.FLUTTER,
    "cold_shoulder": SleeveType.SHORT,
    "bishop": SleeveType.BELL,
    "lantern": SleeveType.PUFF,
    "leg_of_mutton": SleeveType.PUFF,
    "off_shoulder": SleeveType.SLEEVELESS,
}

SHEEN_MAP = {
    "matte": SurfaceFinish.MATTE,
    "subtle_sheen": SurfaceFinish.SUBTLE_SHEEN,
    "moderate_sheen": SurfaceFinish.MODERATE_SHEEN,
    "shiny": SurfaceFinish.HIGH_SHINE,
}

CATEGORY_MAP = {
    "dress": GarmentCategory.DRESS,
    "top": GarmentCategory.TOP,
    "blouse": GarmentCategory.TOP,
    "shirt": GarmentCategory.TOP,
    "skirt": GarmentCategory.SKIRT,
    "pants": GarmentCategory.BOTTOM_PANTS,
    "jumpsuit": GarmentCategory.JUMPSUIT,
    "romper": GarmentCategory.ROMPER,
    "jacket": GarmentCategory.JACKET,
    "coat": GarmentCategory.COAT,
    "cardigan": GarmentCategory.CARDIGAN,
    "sweater": GarmentCategory.SWEATSHIRT,
    "shorts": GarmentCategory.BOTTOM_SHORTS,
}

COLOR_LIGHTNESS_MAP = {
    "very_dark": 0.10,
    "dark": 0.20,
    "medium_dark": 0.35,
    "medium": 0.50,
    "medium_light": 0.65,
    "light": 0.80,
    "very_light": 0.90,
}

COLOR_SATURATION_MAP = {
    "muted": 0.25,
    "moderate": 0.50,
    "vibrant": 0.80,
}

PATTERN_CONTRAST_MAP = {
    "low": 0.20,
    "medium": 0.50,
    "high": 0.80,
}

GSM_MAP = {
    "very_light": 80,
    "light": 120,
    "medium": 180,
    "heavy": 280,
}

DRAPE_MAP = {
    "stiff": 2.0,
    "structured": 4.0,
    "fluid": 7.0,
    "very_drapey": 9.0,
}

FIT_EXPANSION_MAP = {
    "tight": 0.00,
    "fitted": 0.02,
    "semi_fitted": 0.05,
    "relaxed": 0.10,
    "loose": 0.18,
    "oversized": 0.25,
}

FIT_EASE_MAP = {
    "tight": 0.0,
    "fitted": 1.0,
    "semi_fitted": 2.5,
    "relaxed": 4.0,
    "loose": 6.0,
    "oversized": 8.0,
}

HEM_POSITION_MAP = {
    "mini": "mini",
    "above_knee": "above_knee",
    "at_knee": "knee",
    "below_knee": "below_knee",
    "midi": "midi",
    "tea_length": "below_calf",
    "ankle": "ankle",
    "maxi": "ankle",
    "floor_length": "floor",
    "high_low": "knee",
}

WAIST_POSITION_MAP = {
    "empire": "empire",
    "natural": "natural",
    "drop": "drop",
    "low": "drop",
    "undefined": "no_waist",
    "elasticized": "natural",
}

FIBER_CONSTRUCTION_MAP = {
    "cotton": FabricConstruction.WOVEN,
    "linen": FabricConstruction.WOVEN,
    "silk": FabricConstruction.WOVEN,
    "rayon": FabricConstruction.WOVEN,
    "viscose": FabricConstruction.WOVEN,
    "polyester": FabricConstruction.WOVEN,
    "nylon": FabricConstruction.WOVEN,
    "wool": FabricConstruction.WOVEN,
    "jersey": FabricConstruction.KNIT_JERSEY,
    "knit": FabricConstruction.KNIT,
    "ponte": FabricConstruction.KNIT_DOUBLE,
    "rib": FabricConstruction.KNIT_RIB,
    "denim": FabricConstruction.WOVEN,
    "chiffon": FabricConstruction.WOVEN,
    "satin": FabricConstruction.WOVEN,
    "crepe": FabricConstruction.WOVEN,
    "tweed": FabricConstruction.WOVEN,
    "velvet": FabricConstruction.WOVEN,
}

# Fabric body interaction → expansion_rate adjustment
BODY_INTERACTION_MAP = {
    "clinging": -0.03,       # reduce expansion (fabric clings to body)
    "skimming": 0.0,         # neutral
    "standing_away": 0.05,   # fabric stands away → more expansion
    "draping_away": 0.03,    # drapes loosely
}

# Model apparent size → US numeric size estimate
MODEL_APPARENT_SIZE_MAP = {
    "xs": 0,
    "s": 4,
    "m": 8,
    "l": 12,
    "xl": 16,
    "xxl": 18,
}

GOAL_MAP = {
    "look_taller": StylingGoal.LOOK_TALLER,
    "highlight_waist": StylingGoal.HIGHLIGHT_WAIST,
    "hide_midsection": StylingGoal.HIDE_MIDSECTION,
    "slim_hips": StylingGoal.SLIM_HIPS,
    "minimize_hips": StylingGoal.SLIM_HIPS,
    "look_proportional": StylingGoal.LOOK_PROPORTIONAL,
    "minimize_arms": StylingGoal.MINIMIZE_ARMS,
    "hide_upper_arms": StylingGoal.MINIMIZE_ARMS,
    "slimming": StylingGoal.SLIMMING,
    "look_slimmer": StylingGoal.SLIMMING,
    "elongate_legs": StylingGoal.LOOK_TALLER,
    "streamline_silhouette": StylingGoal.SLIMMING,
    "balance_shoulders": StylingGoal.BALANCE,
    "create_curves": StylingGoal.EMPHASIS,
    "minimize_bust": StylingGoal.CONCEALMENT,
    "show_legs": StylingGoal.EMPHASIS,
}

# ================================================================
# FABRIC GSM RESOLUTION (5-priority chain)
# ================================================================

# Load the resolution table from JSON
_RESOLUTION_TABLE_PATH = os.path.join(
    os.path.dirname(os.path.abspath(__file__)), "fabric_gsm_resolution.json"
)
_RESOLUTION_TABLE: Optional[dict] = None


def _get_resolution_table() -> dict:
    """Lazy-load the fabric GSM resolution table."""
    global _RESOLUTION_TABLE
    if _RESOLUTION_TABLE is None:
        if os.path.exists(_RESOLUTION_TABLE_PATH):
            with open(_RESOLUTION_TABLE_PATH, "r") as f:
                _RESOLUTION_TABLE = json.load(f)
        else:
            logger.warning("Fabric GSM resolution table not found at %s", _RESOLUTION_TABLE_PATH)
            _RESOLUTION_TABLE = {}
    return _RESOLUTION_TABLE


# Fiber name normalization (inline for speed; JSON version used as fallback)
FIBER_NORMALIZE = {
    "rayon": "rayon", "viscose": "viscose", "livaeco": "viscose",
    "livaeco viscose": "viscose", "polyester": "polyester", "poly": "polyester",
    "cotton": "cotton", "silk": "silk", "wool": "wool", "merino": "wool",
    "cashmere": "wool", "linen": "linen", "flax": "linen", "nylon": "nylon",
    "spandex": "nylon", "elastane": "nylon", "lycra": "nylon",
    "tencel": "tencel", "lyocell": "tencel", "modal": "modal",
    "micromodal": "modal", "bamboo": "viscose", "hemp": "linen",
    "acetate": "viscose", "triacetate": "viscose", "cupro": "viscose",
    "acrylic": "polyester",
}


@dataclass
class FabricResolution:
    """Result of fabric GSM resolution."""
    gsm: float
    fabric_id: Optional[str] = None
    confidence: str = "low"
    resolution_path: str = "fallback"


def _normalize_fiber(fiber_name: Optional[str]) -> str:
    """Normalize a fiber name to a standard key."""
    if not fiber_name:
        return "polyester"
    normalized = FIBER_NORMALIZE.get(fiber_name.lower().strip())
    if normalized:
        return normalized
    # Try partial match
    lower = fiber_name.lower().strip()
    for key, val in FIBER_NORMALIZE.items():
        if key in lower:
            return val
    return lower


def _parse_price(price_str: Optional[str]) -> Optional[float]:
    """Extract numeric price from a price string."""
    if not price_str:
        return None
    match = re.search(r'[\d,.]+', price_str)
    if match:
        try:
            return float(match.group().replace(',', ''))
        except ValueError:
            return None
    return None


def resolve_fabric_gsm(garment_attrs: dict) -> FabricResolution:
    """Resolve fabric GSM using 5-priority chain.

    Priority 1: Text keyword matches (product title, fabric_composition, care text)
    Priority 2: Fiber + construction clue disambiguation (crepe, jersey, satin)
    Priority 3: Fiber + weight + drape signal combination
    Priority 4: (reserved for garment-type heuristic)
    Priority 5: Nuclear fallback — weight category alone

    Args:
        garment_attrs: Merged garment attribute dict from pipeline.

    Returns:
        FabricResolution with gsm, fabric_id, confidence, and resolution_path.
    """
    table = _get_resolution_table()
    if not table:
        # No table available, use old GSM_MAP fallback
        weight = garment_attrs.get("fabric_weight")
        return FabricResolution(
            gsm=GSM_MAP.get(weight, 180) if weight else 180,
            confidence="very_low",
            resolution_path="no_table_fallback",
        )

    # Gather all text signals
    title = (garment_attrs.get("title") or "").lower()
    composition = (garment_attrs.get("fabric_composition") or "").lower()
    care = (garment_attrs.get("care_instructions") or "").lower()
    searchable_text = f"{title} {composition} {care}"

    primary_fiber = _normalize_fiber(garment_attrs.get("fabric_primary"))
    secondary_fiber = _normalize_fiber(garment_attrs.get("fabric_secondary"))
    weight = garment_attrs.get("fabric_weight")  # very_light|light|medium|heavy
    drape = garment_attrs.get("fabric_drape")    # stiff|structured|fluid|very_drapey
    stretch_pct = garment_attrs.get("stretch_percentage", 0) or 0
    price = _parse_price(garment_attrs.get("price"))

    # -------------------------------------------------------------------
    # Priority 1: Text keyword matches
    # -------------------------------------------------------------------
    keyword_matches = table.get("text_keyword_matches", {})

    # Check multi-word keywords first (longest match wins)
    sorted_keywords = sorted(
        [(k, v) for k, v in keyword_matches.items() if k != "_doc"],
        key=lambda x: len(x[0]),
        reverse=True,
    )

    for keyword, match_data in sorted_keywords:
        if keyword in searchable_text:
            gsm = match_data["gsm"]

            # Apply conditional overrides from notes
            if keyword == "chiffon" and primary_fiber == "silk" and price and price > 80:
                gsm = 40
            elif keyword == "charmeuse" and price and price < 50:
                gsm = 130
            elif keyword == "denim" and stretch_pct > 0:
                gsm = 320
            elif keyword == "velvet" and "crushed" in searchable_text:
                gsm = 250
            elif keyword == "satin" and primary_fiber == "silk" and price and price > 80:
                gsm = 90
            elif keyword == "leather" and ("faux" in searchable_text or "vegan" in searchable_text):
                continue  # Skip — will match "faux leather" keyword instead
            elif keyword == "mesh" and "power" in searchable_text:
                gsm = 200  # power mesh is heavier

            return FabricResolution(
                gsm=gsm,
                fabric_id=match_data.get("fabric_id"),
                confidence=match_data.get("confidence", "moderate"),
                resolution_path=f"keyword:{keyword}",
            )

    # -------------------------------------------------------------------
    # Priority 2: Fiber + construction clue disambiguation
    # -------------------------------------------------------------------
    fiber_disambig = table.get("fiber_disambiguation", {})
    for clue_word, fiber_map in fiber_disambig.items():
        if clue_word == "_doc":
            continue
        if clue_word in searchable_text:
            # Check primary fiber, then secondary, then default
            for fiber in [primary_fiber, secondary_fiber]:
                if fiber and fiber in fiber_map:
                    match_data = fiber_map[fiber]
                    return FabricResolution(
                        gsm=match_data["gsm"],
                        fabric_id=match_data.get("fabric_id"),
                        confidence=match_data.get("confidence", "moderate"),
                        resolution_path=f"disambig:{clue_word}+{fiber}",
                    )
            # Use default if no fiber match
            if "default" in fiber_map:
                match_data = fiber_map["default"]
                return FabricResolution(
                    gsm=match_data["gsm"],
                    fabric_id=match_data.get("fabric_id"),
                    confidence=match_data.get("confidence", "low"),
                    resolution_path=f"disambig:{clue_word}+default",
                )

    # -------------------------------------------------------------------
    # Priority 3: Fiber + weight + drape
    # -------------------------------------------------------------------
    fwd_table = table.get("fiber_weight_drape_resolution", {})

    # Normalize drape for lookup key
    drape_key = drape
    if drape_key == "stiff":
        drape_key = "stiff"
    elif drape_key == "structured":
        drape_key = "structured"
    elif drape_key == "fluid":
        drape_key = "fluid"
    elif drape_key == "very_drapey":
        drape_key = "very_drapey"

    for fiber in [primary_fiber, secondary_fiber]:
        if not fiber or fiber not in fwd_table:
            continue
        fiber_entries = fwd_table[fiber]

        # Try exact weight|drape key
        if weight and drape_key:
            lookup_key = f"{weight}|{drape_key}"
            if lookup_key in fiber_entries:
                match_data = fiber_entries[lookup_key]
                return FabricResolution(
                    gsm=match_data["gsm"],
                    fabric_id=match_data.get("fabric_id"),
                    confidence=match_data.get("confidence", "moderate"),
                    resolution_path=f"fwd:{fiber}|{lookup_key}",
                )

        # Try weight|stiff and weight|structured as equivalent for structured fabrics
        if weight and drape_key in ("stiff", "structured"):
            for alt_drape in ("stiff", "structured"):
                alt_key = f"{weight}|{alt_drape}"
                if alt_key in fiber_entries:
                    match_data = fiber_entries[alt_key]
                    return FabricResolution(
                        gsm=match_data["gsm"],
                        fabric_id=match_data.get("fabric_id"),
                        confidence=match_data.get("confidence", "low"),
                        resolution_path=f"fwd:{fiber}|{alt_key}(alt)",
                    )

        # Try weight only (any drape)
        if weight:
            for key, match_data in fiber_entries.items():
                if key.startswith(f"{weight}|"):
                    return FabricResolution(
                        gsm=match_data["gsm"],
                        fabric_id=match_data.get("fabric_id"),
                        confidence="low",
                        resolution_path=f"fwd:{fiber}|{key}(partial)",
                    )

        # Fiber default
        if "default" in fiber_entries:
            match_data = fiber_entries["default"]
            return FabricResolution(
                gsm=match_data["gsm"],
                fabric_id=match_data.get("fabric_id"),
                confidence=match_data.get("confidence", "low"),
                resolution_path=f"fwd:{fiber}|default",
            )

    # -------------------------------------------------------------------
    # Priority 5: Nuclear fallback — weight category alone
    # -------------------------------------------------------------------
    weight_fallback = table.get("fallback_by_weight_only", {})
    if weight and weight in weight_fallback:
        match_data = weight_fallback[weight]
        return FabricResolution(
            gsm=match_data["gsm"],
            confidence="very_low",
            resolution_path=f"weight_only:{weight}",
        )

    # Absolute last resort
    return FabricResolution(
        gsm=180,
        confidence="very_low",
        resolution_path="absolute_fallback",
    )


# Known fast-fashion brands
_FAST_FASHION_BRANDS = {
    "h&m", "zara", "shein", "forever 21", "primark", "boohoo",
    "fashion nova", "romwe", "asos",
}
_LUXURY_BRANDS = {
    "gucci", "prada", "chanel", "louis vuitton", "dior", "versace",
    "balenciaga", "valentino", "saint laurent", "burberry",
}
_PREMIUM_BRANDS = {
    "coach", "michael kors", "kate spade", "tory burch", "ted baker",
    "reiss", "sandro", "maje", "allsaints",
}


# ================================================================
# HELPER FUNCTIONS
# ================================================================

def _safe_get(d: dict, key: str, default=None):
    """Get a value from dict, treating None as missing."""
    val = d.get(key)
    return val if val is not None else default


def _map_enum(value, mapping: dict, default, label: str = ""):
    """Map a string value to an enum using a lookup table. Log warning if unknown."""
    if value is None:
        return default
    result = mapping.get(value)
    if result is None:
        logger.warning("Unknown %s value: %r, using default %r", label, value, default)
        return default
    return result


def estimate_brand_tier(price_str: Optional[str], brand: Optional[str]) -> BrandTier:
    """Estimate brand tier from price string and brand name."""
    # Check brand name first
    if brand:
        brand_lower = brand.lower().strip()
        if brand_lower in _FAST_FASHION_BRANDS:
            return BrandTier.FAST_FASHION
        if brand_lower in _LUXURY_BRANDS:
            return BrandTier.LUXURY
        if brand_lower in _PREMIUM_BRANDS:
            return BrandTier.PREMIUM

    # Try to parse price
    if price_str:
        match = re.search(r'[\d,.]+', price_str)
        if match:
            try:
                price = float(match.group().replace(',', ''))
                if price < 30:
                    return BrandTier.FAST_FASHION
                if price < 80:
                    return BrandTier.MASS_MARKET
                if price < 200:
                    return BrandTier.MID_MARKET
                if price < 500:
                    return BrandTier.PREMIUM
                return BrandTier.LUXURY
            except ValueError:
                pass

    return BrandTier.MID_MARKET


def _estimate_model_size(size_str: Optional[str]) -> int:
    """Convert model size string to US numeric size."""
    if not size_str:
        return 2
    s = size_str.strip().upper()
    size_map = {
        "XXS": 0, "XS": 0, "S": 4, "M": 8, "L": 12,
        "XL": 16, "XXL": 18, "XXXL": 20,
    }
    if s in size_map:
        return size_map[s]
    try:
        return int(s)
    except ValueError:
        return 2


def _detect_zone(category: GarmentCategory) -> str:
    """Determine which body zone a garment category covers."""
    full_body = {
        GarmentCategory.DRESS, GarmentCategory.JUMPSUIT, GarmentCategory.ROMPER,
    }
    lower_body = {
        GarmentCategory.BOTTOM_PANTS, GarmentCategory.BOTTOM_SHORTS,
        GarmentCategory.SKIRT,
    }
    if category in full_body:
        return "full_body"
    if category in lower_body:
        return "lower_body"
    return "torso"


def _detect_covers(category: GarmentCategory, hem_position: str):
    """Determine if garment covers waist and hips."""
    covers_waist = True
    covers_hips = True
    # Crop tops don't cover waist/hips
    if category == GarmentCategory.TOP:
        covers_hips = False
    if hem_position == "mini":
        covers_hips = False  # mini skirts/dresses may not fully cover hips
    return covers_waist, covers_hips


# ================================================================
# BODY PROFILE BUILDER
# ================================================================

def build_body_profile(
    user_measurements: dict,
    styling_goals: Optional[List[str]] = None,
) -> BodyProfile:
    """Convert the Node.js pipeline's user measurements to a BodyProfile.

    Args:
        user_measurements: Dict from run_pipeline.mjs Step 1 output.
            Raw measurements are in CM, derived landmarks are in INCHES.
        styling_goals: Optional list of goal strings (e.g. ["look_taller", "hide_midsection"]).

    Returns:
        BodyProfile with all available measurements converted to inches.
    """
    u = user_measurements

    # --- Core measurements (cm -> inches) ---
    height = _safe_get(u, "height", 167.64) * CM_TO_IN
    bust = _safe_get(u, "chest_circumference", 91.44) * CM_TO_IN
    waist = _safe_get(u, "waist_circumference", 76.2) * CM_TO_IN
    hip = _safe_get(u, "hip_circumference", 96.52) * CM_TO_IN
    shoulder_width = _safe_get(u, "shoulder_breadth", 39.37) * CM_TO_IN
    neck_circumference = _safe_get(u, "neck_circumference", 33.02) * CM_TO_IN
    arm_length = _safe_get(u, "arm_right_length", 58.42) * CM_TO_IN
    inseam = _safe_get(u, "inside_leg_height", 76.2) * CM_TO_IN
    c_thigh_max = _safe_get(u, "thigh_left_circumference", 55.88) * CM_TO_IN
    c_ankle = _safe_get(u, "ankle_left_circumference", 21.59) * CM_TO_IN

    # --- Derived landmarks (already in inches from calc_derived) ---
    h_knee = _safe_get(u, "knee_from_floor", 18.0)
    h_calf_max = _safe_get(u, "widest_calf_from_floor", 14.0)
    h_calf_min = _safe_get(u, "mid_calf_from_floor", 10.0)
    h_ankle = _safe_get(u, "ankle_from_floor", 4.0)
    torso_length = _safe_get(u, "natural_waist_from_shoulder", 15.0)
    leg_length_visual = _safe_get(u, "natural_waist_from_floor", 41.0)

    # --- Estimated fields not in Vineeth's body scan ---
    underbust = bust - 4.0

    # Determine size category for arm estimation
    size_category = _safe_get(u, "size_category", "standard")
    c_upper_arm_max = 14.0 if size_category == "plus_size" else 11.0

    # Estimate calf circumference from ankle
    c_calf_max = c_ankle * 1.6

    # --- Styling goals ---
    goals = []
    if styling_goals:
        for g in styling_goals:
            mapped = GOAL_MAP.get(g)
            if mapped:
                goals.append(mapped)
            else:
                logger.warning("Unknown styling goal: %r", g)

    return BodyProfile(
        height=height,
        bust=bust,
        underbust=underbust,
        waist=waist,
        hip=hip,
        shoulder_width=shoulder_width,
        neck_circumference=neck_circumference,
        torso_length=torso_length,
        leg_length_visual=leg_length_visual,
        inseam=inseam,
        arm_length=arm_length,
        c_upper_arm_max=c_upper_arm_max,
        h_knee=h_knee,
        h_calf_max=h_calf_max,
        h_calf_min=h_calf_min,
        h_ankle=h_ankle,
        c_thigh_max=c_thigh_max,
        c_calf_max=c_calf_max,
        c_ankle=c_ankle,
        styling_goals=goals,
    )


# ================================================================
# GARMENT PROFILE BUILDER
# ================================================================

def build_garment_profile(garment_attrs: dict) -> GarmentProfile:
    """Convert the Node.js pipeline's merged garment attributes to a GarmentProfile.

    Args:
        garment_attrs: Dict from run_pipeline.mjs Step 4 output (mergeAttributes result).

    Returns:
        GarmentProfile with all attributes mapped to engine types.
    """
    g = garment_attrs

    # --- Category ---
    category = _map_enum(
        _safe_get(g, "garment_type"),
        CATEGORY_MAP,
        GarmentCategory.DRESS,
        "garment_type",
    )

    # --- Silhouette ---
    silhouette = _map_enum(
        _safe_get(g, "silhouette_type"),
        SILHOUETTE_MAP,
        Silhouette.SEMI_FITTED,
        "silhouette_type",
    )

    # --- Neckline ---
    neckline = _map_enum(
        _safe_get(g, "neckline_type"),
        NECKLINE_MAP,
        NecklineType.CREW,
        "neckline_type",
    )

    # V-depth estimation from neckline_depth string
    v_depth_cm = 0.0
    neckline_depth_str = _safe_get(g, "neckline_depth")
    if neckline_depth_str:
        depth_map = {"shallow": 3.0, "medium": 8.0, "deep": 14.0, "plunging": 20.0}
        v_depth_cm = depth_map.get(neckline_depth_str, 0.0)

    # --- Sleeve ---
    sleeve_type = _map_enum(
        _safe_get(g, "sleeve_type"),
        SLEEVE_MAP,
        SleeveType.SET_IN,
        "sleeve_type",
    )

    # Sleeve ease from sleeve_width
    sleeve_width = _safe_get(g, "sleeve_width")
    sleeve_ease_map = {
        "fitted": 0.5, "semi_fitted": 1.0, "relaxed": 2.0, "voluminous": 4.0,
    }
    sleeve_ease_inches = sleeve_ease_map.get(sleeve_width, 1.0) if sleeve_width else 1.0

    # --- Surface / Sheen ---
    surface = _map_enum(
        _safe_get(g, "fabric_sheen"),
        SHEEN_MAP,
        SurfaceFinish.MATTE,
        "fabric_sheen",
    )

    # --- Fabric properties ---
    primary_fiber = (_safe_get(g, "fabric_primary") or "polyester").lower()
    primary_fiber = _normalize_fiber(primary_fiber)
    secondary_fiber = _safe_get(g, "fabric_secondary")
    if secondary_fiber:
        secondary_fiber = _normalize_fiber(secondary_fiber.lower())

    fabric_weight = _safe_get(g, "fabric_weight")

    # Resolve GSM using 5-priority chain (replaces old GSM_MAP)
    fabric_resolution = resolve_fabric_gsm(g)
    gsm_estimated = fabric_resolution.gsm
    logger.debug(
        "Fabric GSM resolved: %d gsm via %s (confidence=%s, fabric_id=%s)",
        gsm_estimated, fabric_resolution.resolution_path,
        fabric_resolution.confidence, fabric_resolution.fabric_id,
    )

    drape = DRAPE_MAP.get(_safe_get(g, "fabric_drape"), 5.0)

    # Construction: infer from fiber, override with texture if knit/ribbed
    construction = FIBER_CONSTRUCTION_MAP.get(primary_fiber, FabricConstruction.WOVEN)
    fabric_texture = _safe_get(g, "fabric_texture")
    if fabric_texture in ("knit", "ribbed"):
        construction = FabricConstruction.KNIT if fabric_texture == "knit" else FabricConstruction.KNIT_RIB

    # Stretch
    elastane_pct = _safe_get(g, "stretch_percentage", 0)

    # --- Fit ---
    fit_category = _safe_get(g, "fit_category")
    expansion_rate = FIT_EXPANSION_MAP.get(fit_category, 0.05) if fit_category else 0.05
    garment_ease_inches = FIT_EASE_MAP.get(fit_category, 3.0) if fit_category else 3.0

    # --- Fabric behavior adjustments (v2) ---
    body_interaction = _safe_get(g, "fabric_body_interaction")
    if body_interaction:
        interaction_adj = BODY_INTERACTION_MAP.get(body_interaction, 0.0)
        expansion_rate = max(0.0, expansion_rate + interaction_adj)

    # If stretch is visually apparent, boost elastane estimate
    stretch_visible = _safe_get(g, "fabric_stretch_visible")
    if stretch_visible is True and elastane_pct < 3:
        elastane_pct = max(elastane_pct, 3.0)

    # --- Hemline ---
    hem_position = HEM_POSITION_MAP.get(_safe_get(g, "hemline_position"), "knee")

    # --- Waist ---
    waist_position = WAIST_POSITION_MAP.get(_safe_get(g, "waistline"), "natural")
    waist_def = _safe_get(g, "waist_definition")
    has_waist_definition = waist_def in ("defined", "semi_defined") if waist_def else False

    # --- Color ---
    color_lightness = COLOR_LIGHTNESS_MAP.get(_safe_get(g, "color_value"), 0.50)
    color_saturation = COLOR_SATURATION_MAP.get(_safe_get(g, "color_saturation"), 0.50)
    color_temperature = _safe_get(g, "color_temperature", "neutral")

    # --- Pattern ---
    pattern_type_str = _safe_get(g, "pattern_type")
    has_pattern = pattern_type_str is not None and pattern_type_str != "solid"
    has_horizontal_stripes = pattern_type_str == "horizontal_stripes"
    has_vertical_stripes = pattern_type_str == "vertical_stripes"
    pattern_scale = _safe_get(g, "pattern_scale", "none") or "none"
    if not has_pattern:
        pattern_scale = "none"
    pattern_contrast = PATTERN_CONTRAST_MAP.get(_safe_get(g, "pattern_contrast"), 0.50)

    # --- Construction details ---
    fabric_drape_str = _safe_get(g, "fabric_drape")
    is_structured = (
        _safe_get(g, "has_darts") is True
        or _safe_get(g, "has_seaming") is True
        or fabric_drape_str in ("structured", "stiff")
    )
    has_darts = _safe_get(g, "has_darts") is True

    # Lining detection from fabric_composition
    fabric_composition = _safe_get(g, "fabric_composition", "")
    has_lining = "lining" in fabric_composition.lower() if fabric_composition else False

    # --- Brand tier ---
    brand_tier = estimate_brand_tier(
        _safe_get(g, "price"),
        _safe_get(g, "brand"),
    )

    # --- Model size ---
    # Prefer text-extracted model_size_worn; fall back to vision-estimated apparent size
    model_size_worn = _safe_get(g, "model_size_worn")
    if model_size_worn:
        model_estimated_size = _estimate_model_size(model_size_worn)
    else:
        apparent_size = _safe_get(g, "model_apparent_size_category")
        if apparent_size and apparent_size.lower() in MODEL_APPARENT_SIZE_MAP:
            model_estimated_size = MODEL_APPARENT_SIZE_MAP[apparent_size.lower()]
        else:
            model_estimated_size = _estimate_model_size(None)

    # --- Zone and coverage ---
    zone = _detect_zone(category)
    covers_waist, covers_hips = _detect_covers(category, hem_position)

    # --- Garment length ---
    garment_length_inches = _safe_get(g, "garment_length_inches")
    if garment_length_inches == 0:
        garment_length_inches = None

    # --- Opacity -> surface_friction estimate ---
    opacity = _safe_get(g, "fabric_opacity")
    surface_friction = 0.5
    if opacity == "sheer":
        surface_friction = 0.3
    elif opacity == "opaque":
        surface_friction = 0.6

    return GarmentProfile(
        # Fabric
        primary_fiber=primary_fiber,
        primary_fiber_pct=100.0,  # Not always available as separate field
        secondary_fiber=secondary_fiber,
        secondary_fiber_pct=0.0,
        elastane_pct=elastane_pct,
        construction=construction,
        gsm_estimated=gsm_estimated,
        surface=surface,
        surface_friction=surface_friction,
        drape=drape,
        # Silhouette
        category=category,
        silhouette=silhouette,
        expansion_rate=expansion_rate,
        # Neckline
        neckline=neckline,
        v_depth_cm=v_depth_cm,
        # Sleeve
        sleeve_type=sleeve_type,
        sleeve_ease_inches=sleeve_ease_inches,
        # Waist
        waist_position=waist_position,
        has_waist_definition=has_waist_definition,
        # Hemline
        hem_position=hem_position,
        garment_length_inches=garment_length_inches,
        # Coverage
        covers_waist=covers_waist,
        covers_hips=covers_hips,
        zone=zone,
        # Color
        color_lightness=color_lightness,
        color_saturation=color_saturation,
        color_temperature=color_temperature,
        # Pattern
        has_pattern=has_pattern,
        pattern_type=pattern_type_str,
        has_horizontal_stripes=has_horizontal_stripes,
        has_vertical_stripes=has_vertical_stripes,
        pattern_scale=pattern_scale,
        pattern_contrast=pattern_contrast,
        # Construction
        is_structured=is_structured,
        has_darts=has_darts,
        has_lining=has_lining,
        garment_ease_inches=garment_ease_inches,
        # Brand & model
        brand_tier=brand_tier,
        model_estimated_size=model_estimated_size,
        # Garment layer
        garment_layer=GarmentLayer.BASE,
        title=_safe_get(g, "title"),
        fit_category=fit_category,
    )
