"""
Kridha Production Scoring Engine — Piece 2: Body-Garment Translation
====================================================================
Projects how a garment (designed for a reference model) will actually
appear on the user's body. Computes hemline position, sleeve endpoint,
waistline placement, fabric drape adjustment, and proportion shifts.

All measurements in inches unless noted otherwise.
Source: Domain 2 Part III-A (hemline), Part III-B (sleeve), Part VIII (scoring).
"""

import math
from dataclasses import dataclass, field
from typing import List, Optional, Tuple

from .schemas import (
    BodyProfile, GarmentProfile, BodyAdjustedGarment,
    Silhouette, SleeveType, GarmentCategory, clamp,
)
from .rules_data import (
    GOLDEN_RATIO, WAIST_POSITION_MULTIPLIERS, SLEEVE_TYPES,
    HEM_TYPE_MODIFIERS, SHOULDER_WIDTH_MODIFIERS, HEEL_EFFICIENCY,
    PROPORTION_CUT_RATIOS,
)


# ================================================================
# HEMLINE TRANSLATION (Domain 2 Part III-A, lines ~2000-2940)
# ================================================================

@dataclass
class HemlineResult:
    hem_from_floor: float
    hem_zone: str
    danger_zones: List[Tuple[float, float]]  # [(low, high), ...]
    safe_zone: Optional[Tuple[float, float]]
    safe_zone_size: float
    fabric_rise: float                       # inches hem rises from stated
    proportion_cut_ratio: float
    narrowest_point_bonus: float


def _hem_label_to_height(label: str, body: BodyProfile) -> float:
    """Convert a hem label to height-from-floor (domain 2 line ~10091)."""
    mapping = {
        "mini": body.h_knee + 6,
        "above_knee": body.h_knee + 3,
        "knee": body.h_knee,
        "below_knee": body.h_knee - 3,
        "midi": body.h_calf_max,
        "below_calf": body.h_calf_min,
        "ankle": body.h_ankle + 2,
        "floor": 1.0,
    }
    return mapping.get(label, body.h_knee)


def fabric_drape_adjustment(
    silhouette: Silhouette,
    fabric_weight: str,
    hip_circ: float,
    stomach_projection: float,
) -> float:
    """Compute how much a hemline rises from stated length due to fabric/body
    interaction (domain 2 line ~2904).

    Returns inches of ride-up.
    """
    rise = 0.0

    # A-line / flared silhouettes ride up over prominent hips
    if silhouette in (Silhouette.A_LINE, Silhouette.FIT_AND_FLARE):
        if hip_circ > 40:
            rise += 1.0
        if stomach_projection > 2:
            rise += 0.5

    # Fitted/bodycon ride up with movement
    if silhouette == Silhouette.FITTED:
        rise += 0.5

    # Fabric weight modifier
    if fabric_weight == "light":
        rise *= 1.3
    elif fabric_weight == "heavy":
        rise *= 0.7

    return rise


def translate_hemline(garment: GarmentProfile, body: BodyProfile) -> HemlineResult:
    """Full hemline translation: position, danger zones, safe zone."""

    # Step 1: Compute hem_from_floor
    if garment.garment_length_inches is not None:
        scale = body.height / 66.0  # reference model height 66"
        hem_from_floor = body.height - (garment.garment_length_inches * scale)
    else:
        hem_from_floor = _hem_label_to_height(garment.hem_position, body)

    # Step 2: Fabric drape adjustment
    fabric_weight = "light" if garment.gsm_estimated < 120 else (
        "heavy" if garment.gsm_estimated > 280 else "medium"
    )
    rise = fabric_drape_adjustment(
        garment.silhouette, fabric_weight,
        body.hip, body.belly_projection,
    )
    # Rising hem = higher on the body = higher from floor
    hem_from_floor += rise

    # Step 3: Danger zones
    # Knee danger zone (domain 2)
    knee_center = body.h_knee
    knee_danger = (knee_center - 1.0, knee_center + 1.5)

    # Calf danger zone
    calf_widest = body.h_calf_max
    calf_prominence = body.calf_prominence
    calf_danger_radius = 1.0 + (calf_prominence - 1.0) * 3.0
    calf_danger = (calf_widest - calf_danger_radius, calf_widest + calf_danger_radius)

    # Thigh danger zone
    thigh_widest_h = body.h_knee + 6  # approximate: ~6" above knee
    thigh_danger = (thigh_widest_h - 1.0, thigh_widest_h + 1.0)

    danger_zones = [thigh_danger, knee_danger, calf_danger]

    # Step 4: Safe zone (between knee danger bottom and calf danger top)
    safe_zone_top = knee_danger[0]     # bottom of knee danger
    safe_zone_bottom = calf_danger[1]  # top of calf danger
    safe_zone_size = safe_zone_top - safe_zone_bottom

    safe_zone = None
    if safe_zone_size > 0:
        safe_zone = (safe_zone_bottom, safe_zone_top)

    # Step 5: Zone classification
    if hem_from_floor > knee_center + 2.5:
        hem_zone = "above_knee"
    elif hem_from_floor > knee_danger[1]:
        hem_zone = "above_knee_near"
    elif hem_from_floor >= knee_danger[0]:
        hem_zone = "knee_danger"
    elif safe_zone_size > 0 and hem_from_floor > calf_danger[1]:
        hem_zone = "safe_zone"
    elif safe_zone_size <= 0 and hem_from_floor > calf_danger[1]:
        hem_zone = "collapsed_zone"
    elif hem_from_floor >= calf_danger[0]:
        hem_zone = "calf_danger"
    elif hem_from_floor > body.h_ankle + 2:
        hem_zone = "below_calf"
    elif hem_from_floor > body.h_ankle - 1:
        hem_zone = "ankle"
    else:
        hem_zone = "floor"

    # Step 6: Proportion cut ratio
    cut_ratio = hem_from_floor / body.height if body.height > 0 else 0.3

    # Step 7: Narrowest-point bonus
    narrowest_bonus = 0.0
    narrow_points = {
        "ankle": {"height": body.h_ankle + 2, "bonus": 2},
        "lower_calf": {"height": body.h_calf_min, "bonus": 1},
    }
    for _name, point in narrow_points.items():
        if abs(hem_from_floor - point["height"]) <= 1.5:
            narrowest_bonus = max(narrowest_bonus, point["bonus"])

    return HemlineResult(
        hem_from_floor=hem_from_floor,
        hem_zone=hem_zone,
        danger_zones=danger_zones,
        safe_zone=safe_zone,
        safe_zone_size=safe_zone_size,
        fabric_rise=rise,
        proportion_cut_ratio=cut_ratio,
        narrowest_point_bonus=narrowest_bonus,
    )


# ================================================================
# SLEEVE TRANSLATION (Domain 2 Part III-B, lines ~3126-4400)
# ================================================================

@dataclass
class SleeveResult:
    endpoint_position: float              # inches from shoulder
    perceived_width: float                # inches
    actual_width: float                   # inches (arm diameter at endpoint)
    delta_vs_actual: float                # perceived - actual
    arm_prominence_severity: float        # 0.3-2.0
    arm_prominence_radius: float          # inches
    score_from_delta: float               # -4 to +5
    shoulder_width_effect: float          # inches per side


def _interpolate_arm_circ(body: BodyProfile, position: float) -> float:
    """Piecewise linear interpolation of arm circumference at a given
    position (inches from shoulder). Domain 2 line ~3213."""
    landmarks = [
        (0.0, body.shoulder_width / 2 * math.pi / 2),  # shoulder ~14-18" circ
        (body.c_upper_arm_max_position, body.c_upper_arm_max),
        (body.arm_length * 0.52, body.c_elbow),            # ~12" from shoulder
        (body.arm_length * 0.65, body.c_forearm_max),
        (body.c_forearm_min_position, body.c_forearm_min),
        (body.arm_length, body.c_wrist),
    ]

    # Clamp position
    if position <= landmarks[0][0]:
        return landmarks[0][1]
    if position >= landmarks[-1][0]:
        return landmarks[-1][1]

    # Find bracketing landmarks
    for i in range(len(landmarks) - 1):
        p0, c0 = landmarks[i]
        p1, c1 = landmarks[i + 1]
        if p0 <= position <= p1:
            if p1 == p0:
                return c0
            t = (position - p0) / (p1 - p0)
            return c0 + t * (c1 - c0)

    return body.c_upper_arm_max


def _arm_prominence_severity(body: BodyProfile) -> Tuple[float, float]:
    """Compute arm prominence severity and danger radius.
    Domain 2 line ~3854. Returns (severity, radius)."""
    combined = body.arm_prominence_combined

    if combined < 1.35:
        return 0.3, 0.5
    elif combined < 1.50:
        return 0.5, 0.75
    elif combined < 1.65:
        return 0.75, 1.0
    elif combined < 1.80:
        return 1.0, 1.5
    elif combined < 2.00:
        return 1.3, 2.0
    elif combined < 2.20:
        return 1.6, 2.5
    else:
        return 2.0, 3.0


def _sleeve_type_to_position(
    sleeve_type: SleeveType, body: BodyProfile
) -> Tuple[float, float, str]:
    """Map SleeveType enum to (endpoint_position, ease, hem_type)."""
    _map = {
        SleeveType.SLEEVELESS: (0.0, 0.0, "clean_hem"),
        SleeveType.CAP: (2.5, -0.5, "clean_hem"),
        SleeveType.SHORT: (6.0, 1.0, "clean_hem"),
        SleeveType.THREE_QUARTER: (17.0, 0.5, "clean_hem"),
        SleeveType.LONG: (body.arm_length, 0.0, "clean_hem"),
        SleeveType.RAGLAN: (body.arm_length, 1.0, "clean_hem"),
        SleeveType.DOLMAN: (body.arm_length, 12.0, "clean_hem"),
        SleeveType.PUFF: (4.0, 6.0, "elastic"),
        SleeveType.FLUTTER: (3.0, 3.0, "flutter"),
        SleeveType.BELL: (body.arm_length * 0.7, 8.0, "clean_hem"),
        SleeveType.SET_IN: (body.arm_length, 1.0, "clean_hem"),
    }
    return _map.get(sleeve_type, (body.arm_length, 1.0, "clean_hem"))


def translate_sleeve(garment: GarmentProfile, body: BodyProfile) -> SleeveResult:
    """Full sleeve translation: endpoint, perceived width, score."""

    # Determine endpoint position
    if garment.sleeve_length_inches is not None:
        endpoint = garment.sleeve_length_inches
        ease = garment.sleeve_ease_inches
        hem_type = "clean_hem"
    else:
        endpoint, ease, hem_type = _sleeve_type_to_position(
            garment.sleeve_type, body
        )

    # Arm circumference at endpoint
    actual_circ = _interpolate_arm_circ(body, endpoint)
    actual_width = actual_circ / math.pi

    # Perceived width (domain 2 line ~3310)
    if ease >= 0:
        frame_width = actual_width + (ease / math.pi)
    elif ease > -1.0:
        # Slight compression
        compression = abs(ease)
        frame_width = actual_width + (compression * 0.3)
    else:
        # Strong compression
        compression = abs(ease)
        frame_width = actual_width + (compression * 0.5)

    # Hem type modifier
    hem_mod = HEM_TYPE_MODIFIERS.get(hem_type, 0.0)
    frame_width += hem_mod

    # Taper impression (visible arm below sleeve contributes 40%)
    if endpoint < body.arm_length:
        # Average visible arm width below sleeve
        mid_visible = (endpoint + body.arm_length) / 2
        visible_circ = _interpolate_arm_circ(body, mid_visible)
        avg_visible_width = visible_circ / math.pi
        taper_impression = (avg_visible_width - frame_width) * 0.4
    else:
        taper_impression = 0.0

    perceived_width = frame_width + taper_impression

    # For very short sleeves (cap/short) near the arm's widest point,
    # the sleeve frames the danger zone — compare against widest arm width
    reference_width = actual_width
    if endpoint <= body.c_upper_arm_max_position + 1.5:
        widest_arm_width = body.c_upper_arm_max / math.pi
        cap_frame_delta = frame_width - widest_arm_width + 0.20
        delta = max(perceived_width - actual_width, cap_frame_delta)
    else:
        delta = perceived_width - actual_width

    # Arm prominence severity
    severity, radius = _arm_prominence_severity(body)

    # Score from delta (domain 2 line ~4076)
    if delta > 0.30:
        score = -4.0
    elif delta > 0.15:
        score = -2.0
    elif delta > 0:
        score = -1.0
    elif delta > -0.30:
        score = 1.0
    elif delta > -0.60:
        score = 3.0
    else:
        score = 5.0

    # Apply severity multiplier
    if score < 0:
        score *= severity
    else:
        score *= (1 + (severity - 1) * 0.5)

    # Shoulder width effect
    sleeve_key = garment.sleeve_type.value if hasattr(garment.sleeve_type, 'value') else "set_in"
    shoulder_effect = SHOULDER_WIDTH_MODIFIERS.get(sleeve_key, 0.0)

    return SleeveResult(
        endpoint_position=endpoint,
        perceived_width=perceived_width,
        actual_width=actual_width,
        delta_vs_actual=delta,
        arm_prominence_severity=severity,
        arm_prominence_radius=radius,
        score_from_delta=score,
        shoulder_width_effect=shoulder_effect,
    )


# ================================================================
# WAISTLINE TRANSLATION (Domain 2 Part VIII, lines ~10418-10563)
# ================================================================

@dataclass
class WaistlineResult:
    visual_waist_height: float            # from floor
    visual_leg_ratio: float
    proportion_improvement: float         # positive = better
    proportion_score: float               # clamped ±0.80
    waist_position_label: str


def translate_waistline(
    garment: GarmentProfile, body: BodyProfile
) -> WaistlineResult:
    """Compute visual waist position and golden ratio improvement."""

    position = garment.waist_position
    multiplier = WAIST_POSITION_MULTIPLIERS.get(position)

    if multiplier is None:
        # no_waist — use natural waist
        visual_waist_from_shoulder = body.torso_length
    else:
        visual_waist_from_shoulder = body.torso_length * multiplier

    # Visual leg length = actual legs + perceptual shift from waist position
    # Perceptual dampening: ~25% of physical waist shift registers visually
    shift = body.torso_length - visual_waist_from_shoulder
    perceptual_shift = shift * 0.25
    visual_leg_length = body.leg_length_visual + perceptual_shift
    visual_waist_height = body.height - body.torso_length + perceptual_shift
    visual_leg_ratio = visual_leg_length / body.height if body.height > 0 else 0.618

    # Golden ratio improvement
    current_ratio = body.leg_ratio
    deviation_before = abs(current_ratio - GOLDEN_RATIO)
    deviation_after = abs(visual_leg_ratio - GOLDEN_RATIO)
    improvement = deviation_before - deviation_after  # positive = better
    proportion_score = clamp(improvement * 8.0, -0.80, 0.80)

    return WaistlineResult(
        visual_waist_height=visual_waist_height,
        visual_leg_ratio=visual_leg_ratio,
        proportion_improvement=improvement,
        proportion_score=proportion_score,
        waist_position_label=position,
    )


# ================================================================
# PROPORTION SHIFT (Domain 2: heel efficiency, shoe contrast)
# ================================================================

@dataclass
class ProportionResult:
    visual_leg_length: float
    heel_extension: float                 # effective inches added
    shoe_modifier: float                  # +/- inches from shoe type
    total_visual_height: float


def compute_proportion_shift(
    body: BodyProfile,
    heel_height_inches: float = 0.0,
    is_nude_shoe: bool = False,
    is_contrast_shoe: bool = False,
) -> ProportionResult:
    """Compute visual proportion shift from shoe choice."""

    # Heel efficiency by tier
    efficiency = 0.70  # default
    for (lo, hi), eff in HEEL_EFFICIENCY.items():
        if lo <= heel_height_inches < hi:
            efficiency = eff
            break

    heel_extension = heel_height_inches * efficiency

    # Shoe modifiers
    shoe_mod = 0.0
    if is_nude_shoe:
        shoe_mod = min(2.0, heel_height_inches * 0.3)  # up to +2" perceived
    if is_contrast_shoe:
        shoe_mod -= 1.0  # -1" from visual break

    visual_leg_length = body.leg_length_visual + heel_extension + shoe_mod
    total_visual_height = body.height + heel_extension

    return ProportionResult(
        visual_leg_length=visual_leg_length,
        heel_extension=heel_extension,
        shoe_modifier=shoe_mod,
        total_visual_height=total_visual_height,
    )


# ================================================================
# MASTER TRANSLATION FUNCTION
# ================================================================

def translate_garment_to_body(
    garment: GarmentProfile,
    body: BodyProfile,
) -> BodyAdjustedGarment:
    """Run Piece 2 translations appropriate for this garment type."""

    from .fabric_gate import resolve_fabric_properties

    category = garment.category

    # Categories that have meaningful hemline interaction with legs
    _HEM_CATEGORIES = {
        GarmentCategory.DRESS, GarmentCategory.SKIRT,
        GarmentCategory.JUMPSUIT, GarmentCategory.ROMPER,
        GarmentCategory.COAT,
    }
    # Categories that have sleeves
    _SLEEVE_CATEGORIES = {
        GarmentCategory.DRESS, GarmentCategory.TOP,
        GarmentCategory.JUMPSUIT, GarmentCategory.ROMPER,
        GarmentCategory.JACKET, GarmentCategory.COAT,
        GarmentCategory.SWEATSHIRT, GarmentCategory.CARDIGAN,
        GarmentCategory.BODYSUIT, GarmentCategory.LOUNGEWEAR,
        GarmentCategory.ACTIVEWEAR,
        GarmentCategory.SAREE, GarmentCategory.SALWAR_KAMEEZ,
        GarmentCategory.LEHENGA,
    }
    # Categories that define a waistline
    _WAIST_CATEGORIES = {
        GarmentCategory.DRESS, GarmentCategory.JUMPSUIT,
        GarmentCategory.ROMPER, GarmentCategory.COAT,
        GarmentCategory.BOTTOM_PANTS, GarmentCategory.BOTTOM_SHORTS,
        GarmentCategory.SKIRT,
    }

    # Hemline — only for categories where hem interacts with leg landmarks
    hem_from_floor = 0.0
    hem_zone = ""
    danger_zones = []
    safe_zone = None
    fabric_rise = 0.0
    if category in _HEM_CATEGORIES:
        hem = translate_hemline(garment, body)
        hem_from_floor = hem.hem_from_floor
        hem_zone = hem.hem_zone
        danger_zones = hem.danger_zones
        safe_zone = hem.safe_zone
        fabric_rise = hem.fabric_rise

    # Sleeve — only for categories that have sleeves
    sleeve_endpoint = 0.0
    perceived_width = 0.0
    arm_delta = 0.0
    arm_severity = 0.5
    if category in _SLEEVE_CATEGORIES:
        sleeve = translate_sleeve(garment, body)
        sleeve_endpoint = sleeve.endpoint_position
        perceived_width = sleeve.perceived_width
        arm_delta = sleeve.delta_vs_actual
        arm_severity = sleeve.arm_prominence_severity

    # Waistline — only for categories that define a waist
    visual_waist_height = 0.0
    visual_leg_ratio = GOLDEN_RATIO
    proportion_improvement = 0.0
    if category in _WAIST_CATEGORIES:
        waist = translate_waistline(garment, body)
        visual_waist_height = waist.visual_waist_height
        visual_leg_ratio = waist.visual_leg_ratio
        proportion_improvement = waist.proportion_improvement

    # Fabric resolution always runs
    resolved = resolve_fabric_properties(garment)

    return BodyAdjustedGarment(
        hem_from_floor=hem_from_floor,
        hem_zone=hem_zone,
        hemline_danger_zones=danger_zones,
        hemline_safe_zone=safe_zone,
        fabric_rise_adjustment=fabric_rise,
        sleeve_endpoint_position=sleeve_endpoint,
        perceived_arm_width=perceived_width,
        arm_width_delta=arm_delta,
        arm_prominence_severity=arm_severity,
        visual_waist_height=visual_waist_height,
        visual_leg_ratio=visual_leg_ratio,
        proportion_improvement=proportion_improvement,
        total_stretch_pct=resolved.total_stretch_pct,
        effective_gsm=resolved.effective_gsm,
        sheen_score=resolved.sheen_score,
        photo_reality_discount=resolved.photo_reality_discount,
    )
