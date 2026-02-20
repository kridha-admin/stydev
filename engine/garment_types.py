"""
Kridha Production Scoring Engine — Garment Type System
======================================================
Per-garment-type zone activation, classification, and type-specific scorers.

Each garment type only scores the zones it controls:
- Tops don't score legs
- Pants don't score necklines
- Jackets are scored independently AND as layer modifiers
"""

from typing import Dict, List, Set, Tuple

from .schemas import (
    BodyProfile, GarmentProfile, BodyShape, StylingGoal,
    GarmentCategory, GarmentLayer, TopHemBehavior,
    Silhouette, clamp,
)


# ================================================================
# SCORER ROUTING
# ================================================================

# Which existing scorers to SKIP for each garment type.
# If category not listed, all 16 scorers run (dress-like).
_SCORERS_TO_SKIP: Dict[GarmentCategory, Set[str]] = {
    GarmentCategory.DRESS: set(),
    GarmentCategory.TOP: {"Hemline"},
    GarmentCategory.SWEATSHIRT: {"Hemline"},
    GarmentCategory.BODYSUIT: {"Hemline"},
    GarmentCategory.BOTTOM_PANTS: {
        "V-Neck Elongation", "Neckline Compound", "Sleeve",
        "Rise Elongation", "Hemline",
    },
    GarmentCategory.BOTTOM_SHORTS: {
        "V-Neck Elongation", "Neckline Compound", "Sleeve",
        "Rise Elongation", "Hemline",
    },
    GarmentCategory.SKIRT: {
        "V-Neck Elongation", "Neckline Compound", "Sleeve",
        "Rise Elongation",
    },
    GarmentCategory.JUMPSUIT: set(),
    GarmentCategory.ROMPER: set(),
    GarmentCategory.JACKET: {"Hemline"},
    GarmentCategory.COAT: set(),
    GarmentCategory.CARDIGAN: {"Hemline"},
    GarmentCategory.VEST: {"Hemline", "Sleeve"},
}

# Which NEW type-specific scorers to ADD for each category.
_EXTRA_SCORERS: Dict[GarmentCategory, List[str]] = {
    GarmentCategory.TOP: ["Top Hemline"],
    GarmentCategory.SWEATSHIRT: ["Top Hemline"],
    GarmentCategory.BODYSUIT: ["Top Hemline"],
    GarmentCategory.CARDIGAN: ["Top Hemline"],
    GarmentCategory.BOTTOM_PANTS: ["Pant Rise", "Leg Shape"],
    GarmentCategory.BOTTOM_SHORTS: ["Pant Rise", "Leg Shape"],
    GarmentCategory.JACKET: ["Jacket Scoring"],
    GarmentCategory.COAT: ["Jacket Scoring"],
}

# Layer garment categories
_LAYER_CATEGORIES: Set[GarmentCategory] = {
    GarmentCategory.JACKET,
    GarmentCategory.COAT,
    GarmentCategory.CARDIGAN,
    GarmentCategory.VEST,
}

# Zone mapping for new scorers (used by _compute_zone_scores)
TYPE_SCORER_ZONE_MAPPING: Dict[str, List[str]] = {
    "Top Hemline": ["hip", "torso"],
    "Pant Rise": ["waist"],
    "Leg Shape": ["hip", "thigh"],
    "Jacket Scoring": ["shoulder", "waist", "hip", "torso"],
}

# Base weights for new scorers
TYPE_SCORER_WEIGHTS: Dict[str, float] = {
    "Top Hemline": 0.15,
    "Pant Rise": 0.18,
    "Leg Shape": 0.15,
    "Jacket Scoring": 0.18,
}


def get_scorers_to_skip(category: GarmentCategory) -> Set[str]:
    """Get set of existing scorer names to skip for this garment type."""
    return _SCORERS_TO_SKIP.get(category, set())


def get_extra_scorer_names(category: GarmentCategory) -> List[str]:
    """Get names of additional type-specific scorers for this category."""
    return _EXTRA_SCORERS.get(category, [])


def is_layer_garment(category: GarmentCategory) -> bool:
    """Check if this garment type is a layer (jacket, coat, etc.)."""
    return category in _LAYER_CATEGORIES


# ================================================================
# GARMENT CLASSIFICATION
# ================================================================

_TITLE_KEYWORDS: Dict[GarmentCategory, List[str]] = {
    GarmentCategory.DRESS: [
        "maxi dress", "mini dress", "midi dress", "shift dress",
        "wrap dress", "dress", "gown", "frock",
    ],
    GarmentCategory.TOP: [
        "crop top", "halter top", "t-shirt", "blouse", "shirt", "tee",
        "cami", "camisole", "tank", "tunic", "henley", "polo", "top",
        "bustier", "corset top", "bralette",
    ],
    GarmentCategory.BOTTOM_PANTS: [
        "wide-leg", "straight-leg", "slim pant", "pants", "trouser",
        "jeans", "denim", "chino", "legging", "jogger", "cargo", "palazzo",
        "culottes", "sweatpant",
    ],
    GarmentCategory.BOTTOM_SHORTS: ["shorts", "bermuda", "hot pants"],
    GarmentCategory.SKIRT: [
        "denim skirt", "mini skirt", "midi skirt", "maxi skirt", "pencil skirt",
        "a-line skirt", "pleated skirt", "skirt", "skort",
    ],
    GarmentCategory.JUMPSUIT: ["jumpsuit"],
    GarmentCategory.ROMPER: ["romper", "playsuit"],
    GarmentCategory.JACKET: [
        "denim jacket", "leather jacket", "cropped jacket",
        "jacket", "blazer", "bomber", "moto", "shacket",
    ],
    GarmentCategory.COAT: [
        "overcoat", "trench", "parka", "peacoat", "puffer",
        "down jacket", "rain jacket", "coat",
        "anorak", "cape", "poncho",
    ],
    GarmentCategory.SWEATSHIRT: ["sweatshirt", "hoodie", "pullover", "fleece"],
    GarmentCategory.CARDIGAN: ["cardigan", "kimono", "duster"],
    GarmentCategory.VEST: ["vest", "gilet", "waistcoat"],
    GarmentCategory.BODYSUIT: ["bodysuit"],
    GarmentCategory.ACTIVEWEAR: [
        "sports bra", "yoga pants", "workout top", "athletic",
    ],
    GarmentCategory.LOUNGEWEAR: [
        "pajama", "robe", "loungewear", "nightgown", "sleepwear",
    ],
    GarmentCategory.SAREE: ["saree", "sari"],
    GarmentCategory.SALWAR_KAMEEZ: [
        "salwar", "kameez", "kurta", "kurti", "anarkali", "churidar",
    ],
    GarmentCategory.LEHENGA: ["lehenga", "lehnga", "chaniya choli"],
}


def classify_garment(garment: GarmentProfile) -> GarmentCategory:
    """Classify garment type from title and attributes.

    The product extraction should set category directly;
    this is the fallback classification from garment signals.
    Uses longest-match-wins across all categories.
    """
    title = (garment.title or "").lower()

    if title:
        # Build all (keyword, category) pairs, check longest first
        all_matches = []
        for category, keywords in _TITLE_KEYWORDS.items():
            for keyword in keywords:
                if keyword in title:
                    all_matches.append((len(keyword), keyword, category))
        if all_matches:
            all_matches.sort(reverse=True)  # longest keyword wins
            return all_matches[0][2]

    # Attribute-based fallback
    if garment.rise is not None and garment.leg_shape is not None:
        return GarmentCategory.BOTTOM_PANTS
    if garment.skirt_construction is not None:
        return GarmentCategory.SKIRT
    if garment.jacket_closure is not None:
        return GarmentCategory.JACKET

    return garment.category  # use whatever default is set


# ================================================================
# TYPE-SPECIFIC SCORERS
# ================================================================

def score_top_hemline(
    g: GarmentProfile, b: BodyProfile
) -> Tuple[float, str]:
    """Score where a top's hem falls relative to body landmarks.

    Fundamentally different from dress hemline scoring:
    - Top hemline creates a visual break on torso/hip area, not on legs
    - Tucked tops: hemline invisible, slight positive for waist definition
    - At-hip on pear: horizontal line at widest point = negative
    - Cropped on short-torso petite: further shortens torso = negative
    """
    R = []

    behavior = g.top_hem_behavior
    hem_pos = g.top_hem_length or "at_hip"
    body_shape = b.body_shape

    # TUCKED: top hemline is invisible
    if behavior == TopHemBehavior.TUCKED:
        score = 0.15
        R.append("Tucked: hem invisible, waist definition +0.15")
        if g.gsm_estimated > 250:
            score -= 0.20
            R.append("Heavy fabric tucked: bulk at waist (-0.20)")
        return clamp(score), " | ".join(R)

    # HALF_TUCKED: partial waist definition, asymmetric hemline
    if behavior == TopHemBehavior.HALF_TUCKED:
        score = 0.20
        R.append("Half-tucked: partial waist definition, asymmetric break +0.20")

        if body_shape == BodyShape.PEAR:
            score += 0.10
            R.append("Pear: asymmetric break disrupts hip-level line (+0.10)")
        elif body_shape == BodyShape.APPLE:
            score += 0.05
            R.append("Apple: partial tuck draws eye to waist area (+0.05)")

        if StylingGoal.HIGHLIGHT_WAIST in b.styling_goals:
            score += 0.10
            R.append("highlight_waist: partial definition (+0.10)")

        if g.gsm_estimated > 250:
            score -= 0.15
            R.append("Heavy fabric: bunching at tuck point (-0.15)")

        return clamp(score), " | ".join(R)

    if behavior == TopHemBehavior.BODYSUIT:
        return clamp(0.10), "Bodysuit: no visible hem, smooth line +0.10"

    # CROPPED: visual break above natural waist
    if behavior == TopHemBehavior.CROPPED or hem_pos == "cropped":
        R.append("Cropped top: break above waist")

        if b.is_petite and b.torso_leg_ratio < 0.48:
            score = -0.35
            R.append("Petite + short torso: further shortening (-0.35)")
        elif b.is_petite:
            score = 0.30
            R.append("Petite + proportional torso: lengthens legs (+0.30)")
        else:
            score = 0.15

        # Apple + hide midsection goal
        if (body_shape == BodyShape.APPLE
                and StylingGoal.HIDE_MIDSECTION in b.styling_goals):
            score = -0.70
            R.append("Apple + hide_midsection: crop exposes midsection (-0.70)")

        return clamp(score), " | ".join(R)

    # UNTUCKED: where the hem falls matters
    if hem_pos == "at_waist":
        score = 0.20
        R.append("At waist: defines waist (+0.20)")
        if StylingGoal.HIGHLIGHT_WAIST in b.styling_goals:
            score += 0.15
        return clamp(score), " | ".join(R)

    if hem_pos == "just_below_waist":
        return clamp(0.15), "Just below waist: slight torso lengthening (+0.15)"

    if hem_pos == "at_hip":
        R.append("At hip: critical zone")
        if body_shape == BodyShape.PEAR:
            fit = g.fit_category or g.silhouette_label
            score = -0.30 if fit in ("relaxed", "loose") else -0.45
            R.append(f"Pear: line at widest hip point ({score:+.2f})")
            if StylingGoal.SLIM_HIPS in b.styling_goals:
                score -= 0.10
                R.append("+ slim_hips goal: amplified")
        elif body_shape == BodyShape.INVERTED_TRIANGLE:
            score = 0.35
            R.append("INVT: hip-level hem adds visual weight below (+0.35)")
        elif body_shape == BodyShape.APPLE:
            fit = g.fit_category or g.silhouette_label
            if fit in ("relaxed", "loose"):
                score = 0.20
                R.append("Apple + relaxed: skims past midsection (+0.20)")
            else:
                score = -0.15
                R.append("Apple + fitted: pulls at midsection (-0.15)")
        else:
            score = 0.0
            R.append("Neutral body type: hip-level is default")
        return clamp(score), " | ".join(R)

    if hem_pos in ("below_hip", "tunic_length"):
        R.append(f"{hem_pos}: covers hips, shortens leg line")
        score = 0.0

        if (StylingGoal.SLIM_HIPS in b.styling_goals
                or StylingGoal.HIDE_MIDSECTION in b.styling_goals):
            score += 0.35
            R.append("Coverage goal met: good for hip/midsection hiding (+0.35)")

        if StylingGoal.LOOK_TALLER in b.styling_goals:
            penalty = -0.35 if hem_pos == "tunic_length" else -0.20
            score += penalty
            R.append(f"Shortens leg line ({penalty:+.2f})")

        if b.is_petite and hem_pos == "tunic_length":
            score -= 0.20
            R.append("Petite + tunic: overwhelms frame (-0.20)")

        return clamp(score), " | ".join(R)

    return 0.0, f"Top hemline '{hem_pos}' — N/A"


def score_pant_rise(
    g: GarmentProfile, b: BodyProfile
) -> Tuple[float, str]:
    """Score pant rise — the dominant scoring principle for pants.

    Where the waistband sits changes perceived proportions entirely.
    High rise = shorter torso + longer legs visually.
    Low rise = longer torso + shorter legs visually.
    """
    R = []

    rise = g.rise
    if rise is None:
        # Infer from rise_cm if available
        if g.rise_cm is not None:
            if g.rise_cm > 26:
                rise = "high"
            elif g.rise_cm > 22:
                rise = "mid"
            else:
                rise = "low"
        else:
            return 0.0, "No rise data — N/A"

    body_shape = b.body_shape

    if rise in ("high", "ultra_high"):
        score = 0.25
        R.append("High rise: leg elongation base +0.25")

        if StylingGoal.LOOK_TALLER in b.styling_goals:
            score += 0.25
            R.append("look_taller goal: amplified (+0.25)")

        if StylingGoal.HIGHLIGHT_WAIST in b.styling_goals:
            score += 0.15
            R.append("highlight_waist: waistband cinches (+0.15)")

        # Apple muffin-top risk
        if body_shape == BodyShape.APPLE and b.whr > 0.85:
            if g.waistband_stretch_pct and g.waistband_stretch_pct >= 8.0:
                score -= 0.10
                R.append("Apple: stretch waistband mitigates muffin risk (-0.10)")
            else:
                score -= 0.25
                R.append("Apple: muffin-top risk at midsection (-0.25)")

        if b.is_petite:
            score += 0.10
            R.append("Petite: high rise strongly benefits (+0.10)")

        return clamp(score), " | ".join(R)

    if rise == "mid":
        return clamp(0.05), "Mid rise: neutral-positive +0.05"

    if rise == "low":
        score = -0.15
        R.append("Low rise: shortens leg line -0.15")

        if StylingGoal.LOOK_TALLER in b.styling_goals:
            score -= 0.25
            R.append("look_taller goal: strongly fights (-0.25)")

        if b.is_petite:
            score -= 0.15
            R.append("Petite: low rise significantly shortens leg (-0.15)")

        if StylingGoal.HIDE_MIDSECTION in b.styling_goals:
            score -= 0.15
            R.append("hide_midsection: low rise exposes gap (-0.15)")

        return clamp(score), " | ".join(R)

    return 0.0, f"Rise '{rise}' — N/A"


def score_leg_shape(
    g: GarmentProfile, b: BodyProfile
) -> Tuple[float, str]:
    """Score pant leg shape — the pants equivalent of silhouette.

    Determines how the pant interacts with the leg/hip shape.
    """
    R = []

    leg = g.leg_shape
    if leg is None:
        return 0.0, "No leg shape data — N/A"

    body_shape = b.body_shape

    # Compute thigh cling penalty for skinny/slim legs
    thigh_cling_penalty = 0.0
    if leg in ("skinny", "slim"):
        ease = 1.0 if leg == "skinny" else 2.0
        _CONSTRUCTION_MULT = {
            "woven": 1.6, "knit": 4.0, "knit_rib": 5.5,
            "knit_double": 3.5, "knit_jersey": 4.0,
        }
        constr_val = g.construction.value if hasattr(g.construction, 'value') else str(g.construction)
        total_stretch = g.elastane_pct * _CONSTRUCTION_MULT.get(constr_val, 2.0)
        if total_stretch < 8 and b.c_thigh_max > 24:
            thigh_cling_penalty = -0.10
            R.append(f"Low-stretch skinny + large thigh ({b.c_thigh_max:.0f}\"): cling risk (-0.10)")
        elif total_stretch < 8 and b.c_thigh_max > 22:
            thigh_cling_penalty = -0.05
            R.append(f"Low-stretch {leg} + moderate thigh: mild cling risk (-0.05)")

    if leg in ("skinny", "slim"):
        R.append(f"{leg}: follows body contour")
        if body_shape == BodyShape.PEAR:
            if StylingGoal.SLIM_HIPS in b.styling_goals:
                score = -0.35
                R.append("Pear + slim_hips: emphasizes hip-to-ankle taper (-0.35)")
            else:
                score = -0.10
                R.append("Pear: shows hip curve (-0.10)")
            if g.rise in ("high", "ultra_high"):
                score += 0.10
                R.append("+ high rise: elongation partially offsets (+0.10)")
        elif body_shape == BodyShape.INVERTED_TRIANGLE:
            score = -0.25
            R.append("INVT: narrow bottom emphasizes shoulder width (-0.25)")
        elif body_shape == BodyShape.RECTANGLE:
            score = 0.15
            R.append("Rectangle: clean line (+0.15)")
        elif body_shape == BodyShape.HOURGLASS:
            score = 0.15
            R.append("Hourglass: follows natural curve (+0.15)")
        else:
            score = 0.0
        score += thigh_cling_penalty
        return clamp(score), " | ".join(R)

    if leg in ("wide_leg", "palazzo"):
        R.append(f"{leg}: adds volume at leg")
        if b.is_petite:
            if g.rise in ("high", "ultra_high"):
                score = 0.15
                R.append("Petite + high rise: volume manageable (+0.15)")
            else:
                score = -0.30
                R.append("Petite without high rise: overwhelms frame (-0.30)")
        elif body_shape == BodyShape.PEAR:
            score = 0.40
            R.append("Pear: skims over hips and thighs (+0.40)")
            if g.rise in ("high", "ultra_high"):
                score += 0.10
                R.append("+ high rise: defines waist before volume starts (+0.10)")
            elif g.rise == "low":
                score -= 0.20
                R.append("+ low rise: volume starts too early, no waist anchor (-0.20)")
        elif body_shape == BodyShape.INVERTED_TRIANGLE:
            score = 0.40
            R.append("INVT: leg volume balances shoulders (+0.40)")
            if g.rise in ("high", "ultra_high"):
                score += 0.05
                R.append("+ high rise: clean proportion line (+0.05)")
        elif body_shape == BodyShape.APPLE:
            score = 0.25
            R.append("Apple: volume below balances midsection (+0.25)")
            if g.rise in ("high", "ultra_high") and g.waistband_stretch_pct >= 8.0:
                score += 0.10
                R.append("+ stretch high rise: smooth waist transition (+0.10)")
            elif g.rise == "low":
                score -= 0.15
                R.append("+ low rise: gap at midsection (-0.15)")
        else:
            score = 0.15
        return clamp(score), " | ".join(R)

    if leg == "straight":
        return clamp(0.15), "Straight: clean, balanced line (+0.15)"

    if leg in ("bootcut", "flare"):
        R.append(f"{leg}: volume at hem")
        score = 0.15
        if body_shape == BodyShape.PEAR:
            score = 0.30
            R.append("Pear: flare balances hip width (+0.30)")
        if StylingGoal.LOOK_TALLER in b.styling_goals:
            score += 0.15
            R.append("look_taller: flare + heel creates long line (+0.15)")
        return clamp(score), " | ".join(R)

    if leg == "tapered":
        R.append("Tapered: relaxed through thigh, narrow at ankle")
        if body_shape == BodyShape.PEAR:
            score = -0.15
            R.append("Pear: taper emphasizes hip-ankle contrast (-0.15)")
        else:
            score = 0.10
        return clamp(score), " | ".join(R)

    if leg == "jogger":
        R.append("Jogger: elastic cuff at ankle")
        score = 0.0
        if b.is_petite:
            score = -0.15
            R.append("Petite: elastic cuff shortens leg line (-0.15)")
        return clamp(score), " | ".join(R)

    return 0.0, f"Leg shape '{leg}' — N/A"


def score_jacket_scoring(
    g: GarmentProfile, b: BodyProfile
) -> Tuple[float, str]:
    """Score jacket independently — shoulder structure, length, closure.

    Jackets are scored both independently AND as layer modifiers.
    This function handles independent scoring; layer interaction
    is computed separately via compute_layer_modifications().
    """
    R = []
    score = 0.0
    body_shape = b.body_shape

    # SHOULDER STRUCTURE
    structure = g.shoulder_structure or "natural"

    if structure in ("padded", "structured"):
        if body_shape == BodyShape.PEAR:
            score += 0.50
            R.append("Structured shoulders balance pear hips (+0.50)")
        elif body_shape == BodyShape.INVERTED_TRIANGLE:
            score -= 0.40
            R.append("Padded shoulders widen already-broad shoulders (-0.40)")
        elif body_shape == BodyShape.RECTANGLE:
            score += 0.25
            R.append("Structure creates shape on straight frame (+0.25)")
        else:
            score += 0.10
            R.append(f"Structured shoulders: mild positive")
    elif structure in ("dropped", "oversized"):
        if body_shape == BodyShape.INVERTED_TRIANGLE:
            score += 0.20
            R.append("Dropped shoulders soften broad shoulder line (+0.20)")
        elif b.is_petite:
            score -= 0.30
            R.append("Oversized shoulders overwhelm petite frame (-0.30)")
        else:
            score += 0.05

    # JACKET LENGTH
    length = g.jacket_length or "hip"

    if length == "cropped":
        score += 0.30
        R.append("Cropped jacket defines waist (+0.30)")
        if StylingGoal.LOOK_TALLER in b.styling_goals:
            score += 0.15
            R.append("look_taller: short jacket = longer leg line (+0.15)")
    elif length == "hip":
        if body_shape == BodyShape.PEAR:
            score -= 0.30
            R.append("Hip-length ends at pear's widest point (-0.30)")
        elif body_shape == BodyShape.INVERTED_TRIANGLE:
            score += 0.20
            R.append("Hip-length adds visual weight below (+0.20)")
    elif length in ("mid_thigh", "knee", "below_knee", "full_length"):
        if StylingGoal.LOOK_TALLER in b.styling_goals:
            score -= 0.20
            R.append("Long jacket shortens visible leg line (-0.20)")
        if (StylingGoal.HIDE_MIDSECTION in b.styling_goals
                or StylingGoal.SLIM_HIPS in b.styling_goals):
            score += 0.30
            R.append("Long jacket provides midsection/hip coverage (+0.30)")

    # CLOSURE
    closure = g.jacket_closure
    if closure == "open_front":
        score += 0.20
        R.append("Open front: vertical line elongates torso (+0.20)")
    elif closure == "double_breasted":
        if body_shape == BodyShape.APPLE:
            score -= 0.15
            R.append("Double-breasted adds midsection bulk (-0.15)")
        elif body_shape == BodyShape.RECTANGLE:
            score += 0.10
            R.append("Double-breasted adds dimension (+0.10)")

    return clamp(score), " | ".join(R)


# ================================================================
# LAYER INTERACTION
# ================================================================

def compute_layer_modifications(
    garment: GarmentProfile, body: BodyProfile
) -> dict:
    """Compute how a layer garment modifies the outfit underneath.

    For v1: score the layer garment independently and provide notes.
    For v1.1: user can specify base garment for combination scoring.
    """
    modifications = []

    is_structured = garment.shoulder_structure in ("padded", "structured")
    is_open = garment.jacket_closure == "open_front"

    if is_structured:
        modifications.append({
            "type": "cling_neutralization",
            "description": "Structured layer reduces cling of underneath garment",
            "zones_affected": ["bust", "midsection", "upper_arm"],
            "score_modification": "reduce_negative_by_70%",
        })

    if is_open:
        modifications.append({
            "type": "vertical_line_creation",
            "description": "Open front creates elongating vertical line",
            "zones_affected": ["torso"],
            "score_modification": "+0.3 to torso elongation",
        })

    fit = garment.fit_category or garment.silhouette_label
    if fit in ("relaxed", "loose", "oversized"):
        modifications.append({
            "type": "volume_addition",
            "description": "Loose layer adds visual volume",
            "zones_affected": ["shoulder", "bust", "torso"],
            "score_modification": "body_type_dependent",
        })

    if garment.jacket_length:
        modifications.append({
            "type": "proportion_break_override",
            "description": (
                f"Jacket hem at {garment.jacket_length} "
                f"becomes the visual break point"
            ),
            "zones_affected": ["proportion"],
            "score_modification": "replaces_base_proportion_break",
        })

    styling_notes = _generate_layer_styling_notes(garment, body)

    return {
        "layer_modifications": modifications,
        "styling_notes": styling_notes,
    }


def _generate_layer_styling_notes(
    garment: GarmentProfile, body: BodyProfile
) -> List[str]:
    """Generate specific pairing suggestions based on body type."""
    notes = []
    body_shape = body.body_shape

    if garment.category in (GarmentCategory.JACKET, GarmentCategory.COAT):
        if body_shape == BodyShape.PEAR:
            notes.append(
                "Pair with wide-leg or straight pants to balance your silhouette"
            )
            if garment.jacket_length == "hip":
                notes.append(
                    "Consider wearing open to create a vertical line past your hips"
                )
        elif body_shape == BodyShape.APPLE:
            notes.append(
                "Pair with a V-neck underneath for maximum elongation"
            )
            if garment.jacket_closure != "open_front":
                notes.append(
                    "Wear unbuttoned to create a slimming vertical line"
                )
        elif body_shape == BodyShape.INVERTED_TRIANGLE:
            notes.append("Balance with wide-leg or flare pants")
    elif garment.category == GarmentCategory.CARDIGAN:
        if StylingGoal.LOOK_TALLER in body.styling_goals:
            notes.append(
                "Wear open with same-color base for an unbroken vertical line"
            )
        if StylingGoal.HIDE_MIDSECTION in body.styling_goals:
            notes.append(
                "Longer cardigan provides coverage without structure"
            )

    return notes
