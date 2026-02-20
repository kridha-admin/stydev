"""
Kridha Production Scoring Engine — Main Pipeline
=================================================
7-layer scoring pipeline merging domain 4 (10 principle scorers),
domain 3 (fabric resolution), and domain 2 (hemline/sleeve/waist math)
into a unified production engine.

Pipeline:
  Layer 1: Fabric Gate          → resolve fabric properties
  Layer 2: Element Scoring      → 16 scorers
  Layer 3: Perceptual Calibration → zone-based weighting + confidence
  Layer 4: Goal Scoring         → goal_scorers.score_goals()
  Layer 5: Body-Type Params     → body_type_parameterization()
  Layer 6: Context Modifiers    → context_modifiers.apply()
  Layer 7: Composite            → weighted aggregation + silhouette dominance
"""

import math
from typing import Dict, List, Optional, Tuple

from .schemas import (
    BodyProfile, GarmentProfile, ScoreResult, PrincipleResult,
    ZoneScore, ExceptionTriggered, Fix, BodyAdjustedGarment,
    BodyShape, StylingGoal, SkinUndertone,
    FabricConstruction, SurfaceFinish, Silhouette,
    NecklineType, SleeveType, GarmentCategory,
    clamp, score_to_ten, rescale_display,
)
from .rules_data import (
    GOLDEN_RATIO, BUST_DIVIDING_THRESHOLDS,
    PRINCIPLE_CONFIDENCE, get_bust_dividing_threshold,
)
from .fabric_gate import (
    resolve_fabric_properties, ResolvedFabric,
    run_fabric_gates, get_structured_penalty_reduction,
)
from .body_garment_translator import (
    translate_hemline, translate_sleeve, translate_waistline,
    translate_garment_to_body,
)
from .goal_scorers import score_goals
from .context_modifiers import apply_context_modifiers
from .garment_types import (
    get_scorers_to_skip, get_extra_scorer_names, is_layer_garment,
    classify_garment,
    score_top_hemline, score_pant_rise, score_leg_shape,
    score_jacket_scoring, compute_layer_modifications,
    TYPE_SCORER_ZONE_MAPPING, TYPE_SCORER_WEIGHTS,
)


# ================================================================
# UTILITY
# ================================================================

def _neckline_str(g: GarmentProfile) -> str:
    """Get neckline as a simple string for scorer comparisons."""
    return g.neckline.value if hasattr(g.neckline, 'value') else str(g.neckline)


def _has_goal(body: BodyProfile, goal: StylingGoal) -> bool:
    """Check if body has a specific styling goal."""
    return goal in body.styling_goals


# ================================================================
# PRINCIPLE SCORERS 1-10 (ported from domain 4 v4)
# ================================================================
# Each scorer: (garment, body) -> (score, reasoning)
# Score: -1.0 to +1.0, Reasoning: pipe-delimited audit trail

def score_horizontal_stripes(
    g: GarmentProfile, b: BodyProfile
) -> Tuple[float, str]:
    """P1: Helmholtz/Ashida stripe scoring with zone-split and width modifiers."""
    R = []

    if not g.has_horizontal_stripes and not g.has_vertical_stripes:
        return 0.0, "No stripes — N/A"

    # V-stripes-only branch
    if g.has_vertical_stripes and not g.has_horizontal_stripes:
        base = -0.05
        R.append("V stripes vs solid: ~5% wider (Thompson 2011)")
        if b.body_shape == BodyShape.RECTANGLE and g.zone == "torso":
            base = +0.03
            R.append("Rectangle torso: V adds desired shoulder width")
        elif b.body_shape == BodyShape.INVERTED_TRIANGLE and g.zone == "lower_body":
            base = -0.08
            R.append("INVT lower: V thins already-narrow hips")
        return clamp(base), " | ".join(R)

    # H-stripes branch
    base = +0.03
    R.append("H stripe base vs solid: +0.03 (Koutsoumpis 2021)")

    # Body-size gate (Ashida 2013)
    size_mod = 0.0
    if b.is_plus_size:
        size_mod = -0.10
        R.append("Plus-size: Helmholtz nullifies/reverses (Ashida)")
    elif b.is_petite:
        size_mod = +0.05
        R.append("Petite: Helmholtz amplified on small frames")

    # Zone-split
    zone_mod = 0.0
    if b.body_shape == BodyShape.PEAR:
        if g.zone == "torso":
            zone_mod = +0.08
            R.append("Pear top: H adds shoulder width (+)")
        elif g.zone == "lower_body":
            zone_mod = -0.05
            R.append("Pear bottom: attention to hip zone (-)")
    elif b.body_shape == BodyShape.INVERTED_TRIANGLE:
        if g.zone == "torso":
            zone_mod = -0.12
            R.append("INVT top: attention to broad shoulders (-)")
        elif g.zone == "lower_body":
            zone_mod = +0.10
            R.append("INVT bottom: adds hip volume (+)")
    elif b.body_shape == BodyShape.APPLE:
        if g.covers_waist:
            zone_mod = -0.05
            R.append("Apple midsection: H width emphasis (-)")
    elif b.body_shape == BodyShape.RECTANGLE:
        zone_mod = +0.05
        R.append("Rectangle: H adds visual interest (+)")
    elif b.body_shape == BodyShape.HOURGLASS:
        zone_mod = +0.03
        R.append("Hourglass: standard effect")

    # Stripe width
    sw_mod = 0.0
    if g.stripe_width_cm > 0:
        if g.stripe_width_cm < 1.0:
            sw_mod = +0.03
            R.append("Fine stripes: stronger illusion")
        elif g.stripe_width_cm > 2.0 and b.is_plus_size:
            sw_mod = -0.05
            R.append("Wide stripes + plus: measurement markers")

    # Dark-stripe luminance
    lum_mod = 0.0
    if g.is_dark and g.has_horizontal_stripes:
        lum_mod = +0.04
        R.append("Dark H stripes: luminance bonus (Koutsoumpis)")

    return clamp(base + size_mod + zone_mod + sw_mod + lum_mod), " | ".join(R)


def score_dark_slimming(
    g: GarmentProfile, b: BodyProfile
) -> Tuple[float, str]:
    """P2: Irradiation illusion with skin-tone gate and sheen override."""
    R = []

    if g.color_lightness > 0.65:
        penalty = -0.05 * ((g.color_lightness - 0.65) / 0.35)
        R.append(f"Light color (L={g.color_lightness:.2f}): slight expansion")
        return clamp(penalty), " | ".join(R)

    if g.color_lightness >= 0.25:
        benefit = 0.15 * (1 - (g.color_lightness - 0.10) / 0.55)
        benefit = max(0, benefit)
        R.append(f"Mid color (L={g.color_lightness:.2f}): proportional benefit {benefit:+.2f}")
        return clamp(benefit), " | ".join(R)

    # Dark color path
    base = 0.15
    R.append(f"Dark color (L={g.color_lightness:.2f}): base slimming +0.15")

    bt_mult = 1.0
    if b.is_petite and g.zone == "full_body":
        bt_mult = 0.6
        R.append("Petite all-dark: height collapse (x0.6)")
    elif b.is_petite and g.zone != "full_body":
        bt_mult = 0.9
        R.append("Petite zone-dark: mild reduction (x0.9)")
    elif b.is_tall:
        bt_mult = 1.2
        R.append("Tall: amplified lean silhouette (x1.2)")
    elif b.body_shape == BodyShape.INVERTED_TRIANGLE and g.zone == "torso":
        bt_mult = 1.4
        R.append("INVT upper body: maximum shoulder reduction (x1.4)")
    elif b.body_shape == BodyShape.HOURGLASS:
        bt_mult = 0.7
        R.append("Hourglass: dark flattens curves (x0.7)")

    skin_mult = 1.0
    if g.zone in ("torso", "full_body"):
        if b.skin_undertone == SkinUndertone.WARM:
            sallow_strength = max(0.0, 1.0 - (g.color_lightness / 0.22))
            skin_mult = 1.0 - sallow_strength
            R.append(f"Warm undertone near face: sallow x{sallow_strength:.2f}")
            if skin_mult < 0.3:
                R.append("RECOMMEND: dark chocolate brown or burgundy")
        elif b.skin_darkness > 0.7:
            skin_mult = 0.5
            R.append(f"Dark skin + dark: low contrast (x0.5)")

    sheen_penalty = 0.0
    si = g.sheen_index
    if si > 0.5:
        sheen_penalty = -0.15 * ((si - 0.5) / 0.5)
        if b.body_shape == BodyShape.APPLE or b.is_plus_size:
            sheen_penalty *= 1.5
            R.append("Apple/Plus + high sheen: amplified specular penalty")
        R.append(f"High sheen (SI={si:.2f}): specular invert")

    score = base * bt_mult * max(skin_mult, 0.0) + sheen_penalty
    return clamp(score), " | ".join(R)


def score_rise_elongation(
    g: GarmentProfile, b: BodyProfile
) -> Tuple[float, str]:
    """P3: Rise elongation with waistband gate and petite inversion."""
    R = []

    if g.rise_cm is None:
        return 0.0, "No rise data — N/A"

    MID_RISE = 20.0
    rise_delta = g.rise_cm - MID_RISE
    base = clamp(rise_delta * 0.015, -0.20, +0.20)
    R.append(f"Rise {g.rise_cm:.0f}cm: base {base:+.3f}")

    if b.is_petite:
        if b.torso_score <= -1.0 and g.rise_cm > 26:
            R.append("Petite + short torso + high rise: INVERTED")
            return clamp(-0.30), " | ".join(R)
        elif b.torso_score >= 1.0:
            base *= 1.5
            R.append("Petite + long torso: amplified (x1.5)")
        else:
            base *= 1.3
            R.append("Petite + proportional: amplified (x1.3)")

    if b.is_tall:
        base *= 0.5
        R.append("Tall: diminishing returns (x0.5)")

    if (b.body_shape == BodyShape.APPLE or b.is_plus_size) and b.belly_zone > 0.3:
        if g.waistband_width_cm >= 5.0 and g.waistband_stretch_pct >= 8.0:
            base += 0.10
            R.append("Wide elastic waistband: smooth containment (+0.10)")
        elif g.waistband_width_cm < 3.0 and g.waistband_stretch_pct < 5.0:
            R.append("Narrow rigid waistband: muffin top -> -0.25")
            return clamp(-0.25), " | ".join(R)

    if b.body_shape == BodyShape.HOURGLASS and g.rise_cm and g.rise_cm > 24:
        base += 0.03
        R.append("Hourglass + high rise: smooth waist-to-hip (+0.03)")

    if b.body_shape == BodyShape.INVERTED_TRIANGLE:
        if g.rise_cm and g.rise_cm > 26 and g.expansion_rate < 0.03:
            base *= 0.6
            R.append("INVT + high rise + slim leg (x0.6)")

    return clamp(base), " | ".join(R)


def score_aline_balance(
    g: GarmentProfile, b: BodyProfile
) -> Tuple[float, str]:
    """P4: A-line balance with drape gate and shelf inversion."""
    R = []

    if g.expansion_rate < 0.03:
        return 0.0, "ER < 0.03: not A-line — N/A"

    er = g.expansion_rate
    if er <= 0.06:
        base = 0.10 + (er - 0.03) * (0.15 / 0.03)
    elif er <= 0.12:
        base = 0.25
    elif er <= 0.18:
        base = 0.25 - (er - 0.12) * (0.15 / 0.06)
    else:
        base = max(-0.10, 0.10 - (er - 0.18) * (0.10 / 0.12))
    R.append(f"ER={er:.2f}: base A-line = {base:+.2f}")

    dc = g.drape_coefficient
    drape_mult = 1.0
    if dc < 40:
        R.append(f"DC={dc:.0f}% (drapey): full benefit")
    elif dc < 65:
        drape_mult = 0.7
        R.append(f"DC={dc:.0f}% (medium): x0.7")
    else:
        drape_mult = -0.5
        R.append(f"DC={dc:.0f}% (stiff): shelf effect INVERSION")

    bt_mod = 0.0
    if b.body_shape == BodyShape.INVERTED_TRIANGLE:
        bt_mod = +0.15
        R.append("INVT: max A-line benefit (+0.15)")
    elif b.is_tall:
        bt_mod = +0.10
        R.append("Tall: carries volume (+0.10)")
    elif b.is_petite:
        bt_mod = -0.15 if er > 0.12 else +0.05
        R.append(f"Petite: {'overwhelms frame' if er > 0.12 else 'scale-appropriate'}")
    elif b.body_shape == BodyShape.HOURGLASS:
        bt_mod = +0.05
    elif b.body_shape == BodyShape.PEAR:
        bt_mod = +0.05
    elif b.body_shape == BodyShape.APPLE:
        bt_mod = +0.03

    if b.is_plus_size and drape_mult < 0:
        drape_mult *= 1.5
        R.append("Plus + stiff A-line: shelf amplified")

    hem_mod = 0.0
    if b.body_shape == BodyShape.PEAR:
        if g.hem_position == "mid_thigh":
            hem_mod = -0.10
        elif g.hem_position == "knee":
            hem_mod = +0.05

    score = base * max(drape_mult, -1.0) + bt_mod + hem_mod
    return clamp(score), " | ".join(R)


def score_tent_concealment(
    g: GarmentProfile, b: BodyProfile
) -> Tuple[float, str]:
    """P5: Tent concealment with dual-goal split and 5 body-type reversals."""
    R = []

    # Semi-fitted optimal zone
    if 0.03 <= g.expansion_rate <= 0.08:
        score = +0.15
        R.append(f"ER={g.expansion_rate:.2f}: semi-fitted optimal")
        if b.body_shape == BodyShape.HOURGLASS:
            score = +0.05
            R.append("Hourglass: semi-fitted slightly masks curves")
        if b.is_plus_size and g.is_structured:
            score = +0.20
            R.append("Plus + structured semi-fitted: smooth containment")
        return clamp(score), " | ".join(R)

    if g.expansion_rate < 0.12:
        return 0.0, f"ER={g.expansion_rate:.2f}: not tent — N/A"

    er = g.expansion_rate

    # Dual-goal split
    has_concealment = _has_goal(b, StylingGoal.CONCEALMENT) or _has_goal(b, StylingGoal.HIDE_MIDSECTION)
    has_slimming = _has_goal(b, StylingGoal.SLIMMING) or _has_goal(b, StylingGoal.SLIM_HIPS)

    if has_concealment and not has_slimming:
        base = +0.35 if er > 0.20 else +0.25
        R.append(f"Goal=concealment: excellent hiding ({base:+.2f})")
    elif has_slimming and not has_concealment:
        base = -0.40 if er > 0.20 else -0.20
        R.append(f"Goal=slimming: perceived bigger ({base:+.2f})")
        R.append("CONCEALMENT PARADOX: hides contours but amplifies size")
    else:
        concealment = 0.35 if er > 0.20 else 0.25
        slimming = -0.40 if er > 0.20 else -0.20
        base = concealment * 0.3 + slimming * 0.7
        R.append(f"Goal=balance: weighted toward slimming ({base:+.2f})")

    # Body-type reversals
    bt_mod = 0.0
    if b.body_shape == BodyShape.HOURGLASS:
        bt_mod = -0.20
        R.append("HOURGLASS REVERSAL: tent destroys WHR (-0.20)")
    elif b.is_petite:
        bt_mod = -0.15
        R.append("PETITE REVERSAL: fabric overwhelms frame (-0.15)")
    elif b.is_plus_size:
        bt_mod = -0.10
        R.append("PLUS REVERSAL: max size overestimate (-0.10)")
    elif b.body_shape == BodyShape.INVERTED_TRIANGLE:
        bt_mod = -0.10
        R.append("INVT: lampshade from shoulders (-0.10)")
    elif b.is_tall:
        bt_mod = +0.10
        R.append("Tall: carries volume (+0.10)")
    elif b.body_shape == BodyShape.RECTANGLE:
        bt_mod = +0.05
        R.append("Rectangle: less curve to hide (+0.05)")

    return clamp(base + bt_mod), " | ".join(R)


def score_color_break(
    g: GarmentProfile, b: BodyProfile
) -> Tuple[float, str]:
    """P6: Belt/color break with hourglass reversal."""
    R = []

    if not g.has_contrasting_belt and not g.has_tonal_belt:
        return 0.0, "No belt/break — N/A"

    if g.has_tonal_belt and not g.has_contrasting_belt:
        return -0.03, "Tonal belt: mild break (-0.03)"

    base = -0.10
    R.append("Contrasting belt: base leg shortening -0.10")

    if b.body_shape == BodyShape.HOURGLASS:
        score = +0.25 if g.belt_width_cm >= 5 else +0.20
        R.append(f"HOURGLASS REVERSAL: belt highlights waist ({score:+.2f})")
        return clamp(score), " | ".join(R)

    if b.is_petite:
        base *= 1.5
        R.append("Petite: can't afford shortening (x1.5)")
    elif b.body_shape == BodyShape.APPLE:
        base = -0.25
        R.append("Apple: belt spotlights widest zone (-0.25)")
    elif b.is_tall:
        base *= 0.3
        R.append("Tall: can afford shortening (x0.3)")
    elif b.body_shape == BodyShape.INVERTED_TRIANGLE:
        base = +0.08
        R.append("INVT: draws eye to waist (+0.08)")
    elif b.body_shape == BodyShape.RECTANGLE:
        base = +0.05
        R.append("Rectangle: creates waist definition (+0.05)")
    elif b.body_shape == BodyShape.PEAR:
        if b.whr < 0.75:
            base = +0.05
            R.append(f"Pear + narrow waist (WHR={b.whr:.2f}): +0.05")
        else:
            base = -0.10
            R.append("Pear + moderate waist: -0.10")

    if b.is_plus_size:
        if b.belly_zone > 0.5:
            base = min(base, -0.20)
            R.append("Plus + belly: belt at widest (-0.20)")
        elif b.belly_zone < 0.2:
            base = max(base, +0.05)
            R.append("Plus + no belly: belt creates waist (+0.05)")

    return clamp(base), " | ".join(R)


def score_bodycon_mapping(
    g: GarmentProfile, b: BodyProfile
) -> Tuple[float, str]:
    """P7: Bodycon contour mapping with fabric construction gate."""
    R = []

    if g.expansion_rate > 0.03:
        return 0.0, f"ER={g.expansion_rate:.2f}: not bodycon — N/A"

    is_thin = g.gsm_estimated < 200 and not g.is_structured
    is_structured = g.gsm_estimated >= 250 or g.is_structured

    if b.body_shape == BodyShape.HOURGLASS:
        score = +0.35 if is_structured else +0.30
        R.append(f"HOURGLASS REVERSAL: bodycon maps best feature ({score:+.2f})")
        if b.belly_zone > 0.5:
            score -= 0.15
            R.append("Belly concern offset (-0.15)")
        return clamp(score), " | ".join(R)

    if b.body_shape == BodyShape.APPLE:
        if b.is_athletic:
            return clamp(+0.20), "Athletic apple: showcases tone (+0.20)"
        score = -0.40 if is_thin else -0.12
        R.append(f"Apple + {'thin' if is_thin else 'structured'} bodycon: {score:+.2f}")
        return clamp(score), " | ".join(R)

    if b.body_shape == BodyShape.PEAR:
        score = -0.30 if is_thin else -0.09
        R.append(f"Pear + {'thin' if is_thin else 'structured'}: {score:+.2f}")
        return clamp(score), " | ".join(R)

    if b.is_plus_size:
        score = -0.40 if is_thin else -0.05
        R.append(f"Plus + {'thin' if is_thin else 'structured (sculpts)'}: {score:+.2f}")
        return clamp(score), " | ".join(R)

    if b.body_shape == BodyShape.INVERTED_TRIANGLE:
        if g.zone == "full_body":
            score = -0.15
        elif g.zone == "lower_body":
            score = -0.05
        else:
            score = -0.10
        R.append(f"INVT bodycon {g.zone}: {score:+.2f}")
        return clamp(score), " | ".join(R)

    if b.body_shape == BodyShape.RECTANGLE:
        return 0.0, "Rectangle + bodycon: neutral"

    return clamp(-0.10), "Default bodycon: mild penalty"


def score_matte_zone(
    g: GarmentProfile, b: BodyProfile
) -> Tuple[float, str]:
    """P8: Matte zone benefit with cling trap override."""
    R = []

    si = g.sheen_index

    if si < 0.15:
        base = +0.08
        R.append(f"Deeply matte (SI={si:.2f}): +0.08")
    elif si < 0.35:
        base = +0.08 * (1 - (si - 0.15) / 0.20)
        R.append(f"Low sheen (SI={si:.2f}): {base:+.3f}")
    elif si <= 0.50:
        base = 0.0
        R.append(f"Neutral sheen (SI={si:.2f})")
    else:
        base = -0.10 * ((si - 0.50) / 0.50)
        R.append(f"High sheen (SI={si:.2f}): {base:+.3f}")

    bt_mult = 1.0
    if b.body_shape == BodyShape.APPLE:
        bt_mult = 1.5
    elif b.is_plus_size:
        bt_mult = 1.5
    elif b.body_shape == BodyShape.PEAR and g.zone in ("lower_body", "full_body"):
        bt_mult = 1.3
    elif b.body_shape == BodyShape.HOURGLASS:
        bt_mult = 0.5
        if 0.35 < si < 0.55:
            base = +0.05
            R.append("Hourglass + moderate sheen: curves enhanced")
    elif b.body_shape == BodyShape.INVERTED_TRIANGLE and g.zone == "torso":
        bt_mult = 1.2

    # Cling trap
    cling = g.cling_risk
    if cling > 0.6 and si < 0.30:
        if b.is_plus_size:
            return clamp(-0.15), "CLING TRAP: matte+clingy on plus (-0.15)"
        elif b.body_shape == BodyShape.PEAR:
            return clamp(-0.10), "CLING TRAP: matte+clingy on pear (-0.10)"
        elif b.body_shape == BodyShape.APPLE:
            return clamp(-0.12), "CLING TRAP: matte+clingy on apple (-0.12)"

    return clamp(base * bt_mult), " | ".join(R)


def score_vneck_elongation(
    g: GarmentProfile, b: BodyProfile
) -> Tuple[float, str]:
    """P9: V-neck elongation with cross-garment neckline x rise interaction."""
    R = []
    neck = _neckline_str(g)

    # Non-V paths
    if neck != "v_neck" and neck != "deep_v":
        if neck == "crew":
            return 0.0, "Crew neck: neutral"
        if neck in ("boat", "off_shoulder"):
            if b.body_shape == BodyShape.INVERTED_TRIANGLE:
                return clamp(-0.15), "Boat/off-shoulder on INVT: widens shoulders (-0.15)"
            elif b.body_shape == BodyShape.RECTANGLE:
                return clamp(+0.08), "Boat on rectangle: adds width (+0.08)"
            elif b.body_shape == BodyShape.PEAR:
                return clamp(+0.05), "Boat on pear: shoulder balance (+0.05)"
            return 0.0, f"Neckline '{neck}': neutral"
        if neck == "scoop":
            base = +0.08 if b.body_shape == BodyShape.INVERTED_TRIANGLE else +0.05
            return clamp(base), f"Scoop: mild elongation ({base:+.2f})"
        if neck == "turtleneck":
            if b.body_shape == BodyShape.INVERTED_TRIANGLE:
                return clamp(-0.05), "Turtleneck on INVT: upper mass (-0.05)"
            if b.is_petite and b.torso_score <= -1.0:
                return clamp(+0.10), "Turtleneck petite short-torso: keeps eye UP (+0.10)"
            return 0.0, "Turtleneck: neutral"
        if neck == "wrap":
            base = +0.08
            R.append("Wrap neckline: mild V-effect (+0.08)")
            return clamp(base), " | ".join(R)
        return 0.0, f"Neckline '{neck}': not scored"

    # V-neck path
    base = +0.10
    R.append("V-neck: base elongation +0.10")

    if b.body_shape == BodyShape.INVERTED_TRIANGLE:
        base = +0.18
        R.append("INVT: narrows shoulder line (+0.18)")
    elif b.body_shape == BodyShape.HOURGLASS:
        base = +0.12
        R.append("Hourglass: frames bust to waist (+0.12)")
    elif b.is_petite:
        if b.torso_score <= -1.0:
            if g.rise_cm and g.rise_cm > 26:
                base = -0.05
                R.append("Petite short-torso + V + high rise: CONFLICT (-0.05)")
            else:
                base = +0.15
                R.append("Petite short-torso + V + mid rise: harmonious (+0.15)")
        else:
            base = +0.12
            R.append("Petite: vertical channel (+0.12)")
    elif b.body_shape == BodyShape.APPLE:
        base = +0.10
        R.append("Apple: eye to face, away from belly (+0.10)")
    elif b.is_tall:
        base = +0.05
        R.append("Tall: diminishing returns (+0.05)")
    elif b.body_shape == BodyShape.PEAR:
        base = +0.10
        R.append("Pear: attention upward (+0.10)")

    return clamp(base), " | ".join(R)


def score_monochrome_column(
    g: GarmentProfile, b: BodyProfile
) -> Tuple[float, str]:
    """P10: Monochrome column elongation."""
    R = []

    if not g.is_monochrome_outfit:
        return 0.0, "Not monochrome — N/A"

    base = +0.08
    dark_bonus = +0.07 if g.is_dark else 0.0

    if b.is_petite:
        base = +0.15
        R.append("Petite: AMPLIFIED monochrome (+0.15)")
    elif b.is_tall:
        base = +0.03
        R.append("Tall: doesn't need height (+0.03)")
    elif b.body_shape == BodyShape.HOURGLASS:
        base = +0.03
        if g.has_contrasting_belt or g.has_tonal_belt:
            base = +0.12
            R.append("Hourglass + mono + belt: best of both (+0.12)")
    elif b.body_shape == BodyShape.INVERTED_TRIANGLE:
        base = +0.05
    elif b.body_shape == BodyShape.APPLE:
        base = +0.08
    elif b.body_shape == BodyShape.PEAR:
        base = +0.12 if g.color_lightness < 0.30 else +0.05
    elif b.is_plus_size:
        base = +0.10

    if b.is_plus_size and g.is_dark:
        dark_bonus = max(dark_bonus, +0.08)
        R.append("Plus + dark mono: most reliable combo")

    return clamp(base + dark_bonus), " | ".join(R)


# ================================================================
# PRINCIPLE SCORERS 11-16 (new, from domain 2/3)
# ================================================================

def score_hemline(
    g: GarmentProfile, b: BodyProfile
) -> Tuple[float, str]:
    """P11: Full hemline scoring from domain 2 — danger zones, body-type mods."""
    R = []

    hem = translate_hemline(g, b)
    zone = hem.hem_zone
    R.append(f"Hem {hem.hem_from_floor:.1f}\" from floor -> {zone}")

    if zone in ("above_knee", "above_knee_near"):
        inches_above = hem.hem_from_floor - b.h_knee
        elongation = min(inches_above * 0.20, 0.60)
        if b.is_petite:
            elongation = min(elongation + (63 - b.height) / 50, 0.80)
            R.append(f"Petite above-knee: elongation {elongation:+.2f}")
        if b.is_tall and b.leg_ratio > 0.62:
            elongation *= 0.65
            R.append("Tall + long legs: diminished above-knee benefit")

        # Thigh penalty
        thigh_penalty = 0.0
        if b.c_thigh_max > 27:
            thigh_penalty = -0.35
        elif b.c_thigh_max > 24:
            thigh_penalty = -0.20
        elif b.c_thigh_max > 22:
            thigh_penalty = -0.10

        if b.goal_legs == "showcase":
            thigh_penalty *= 0.5
        elif b.goal_hip == "narrower":
            thigh_penalty *= 1.2

        # Apple slim-legs bonus
        apple_bonus = 0.0
        if b.body_shape == BodyShape.APPLE:
            if b.c_thigh_max < 22:
                apple_bonus = +0.15
            elif b.c_thigh_max < 24:
                apple_bonus = +0.08

        score = elongation + thigh_penalty + apple_bonus
        return clamp(score), " | ".join(R)

    if zone == "knee_danger":
        score = -0.40 if b.is_petite else -0.30
        R.append(f"Knee danger zone: {score:+.2f}")
        return clamp(score), " | ".join(R)

    if zone == "safe_zone":
        sz = hem.safe_zone
        if sz:
            zone_position = (sz[1] - hem.hem_from_floor) / hem.safe_zone_size
            score = 0.30 if 0.25 <= zone_position <= 0.75 else 0.15
        else:
            score = 0.15
        if b.is_tall:
            score += 0.10
        R.append(f"Safe zone: {score:+.2f}")
        return clamp(score), " | ".join(R)

    if zone == "collapsed_zone":
        R.append("Collapsed safe zone: -0.20")
        return clamp(-0.20), " | ".join(R)

    if zone == "calf_danger":
        calf_prom = b.calf_prominence
        if calf_prom > 1.3:
            base = -0.50
        elif calf_prom > 1.2:
            base = -0.42
        else:
            base = -0.35
        if b.is_petite:
            base *= 1.15
        R.append(f"Calf danger zone: {base:+.2f}")
        return clamp(base), " | ".join(R)

    if zone == "below_calf":
        return clamp(+0.15), "Below calf: safe (+0.15)"

    if zone == "ankle":
        if b.is_petite:
            if g.silhouette in (Silhouette.OVERSIZED, Silhouette.SHIFT):
                score = -0.15
            elif g.silhouette == Silhouette.FITTED and g.has_waist_definition:
                score = +0.40
            elif g.silhouette == Silhouette.FITTED:
                score = +0.15
            else:
                score = +0.10
        elif b.is_tall:
            score = +0.45
        else:
            score = +0.25

        if b.body_shape == BodyShape.HOURGLASS and not g.has_waist_definition:
            score -= 0.15
        R.append(f"Ankle: {score:+.2f}")
        return clamp(score), " | ".join(R)

    if zone == "floor":
        score = +0.15 if b.is_tall else (-0.10 if b.is_petite else +0.05)
        R.append(f"Floor: {score:+.2f}")
        return clamp(score), " | ".join(R)

    return 0.0, f"Unknown zone: {zone} — N/A"


def score_sleeve(
    g: GarmentProfile, b: BodyProfile
) -> Tuple[float, str]:
    """P12: Arm width scoring from domain 2 perceived-width model."""
    R = []

    if g.sleeve_type == SleeveType.SLEEVELESS:
        return 0.0, "Sleeveless: baseline — N/A"

    sleeve = translate_sleeve(g, b)
    delta = sleeve.delta_vs_actual
    severity = sleeve.arm_prominence_severity

    R.append(f"Sleeve endpoint {sleeve.endpoint_position:.1f}\", "
             f"delta={delta:+.2f}\", severity={severity:.1f}")

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

    # Apply severity
    if score < 0:
        score *= severity
    else:
        score *= (1 + (severity - 1) * 0.5)

    # Flutter vs cap bonus (domain 2 line ~4260)
    if g.sleeve_type == SleeveType.FLUTTER:
        score += 2.0
        R.append("Flutter: +2 qualitative bonus (visual ambiguity)")

    # Normalize from [-4..+5] to [-1..+1] range
    normalized = clamp(score / 5.0, -1.0, 1.0)
    R.append(f"Raw score {score:+.1f} -> normalized {normalized:+.2f}")

    return normalized, " | ".join(R)


def score_waist_placement(
    g: GarmentProfile, b: BodyProfile
) -> Tuple[float, str]:
    """P13: Golden ratio engine from domain 2."""
    R = []

    if g.waist_position == "no_waist":
        return 0.0, "No waist definition — N/A"

    waist = translate_waistline(g, b)
    prop_score = waist.proportion_score
    R.append(f"Waist={g.waist_position}: visual leg ratio {waist.visual_leg_ratio:.3f} "
             f"(golden={GOLDEN_RATIO}), improvement={waist.proportion_improvement:+.3f}")

    # Empire + hourglass shape loss
    if g.waist_position == "empire" and b.body_shape == BodyShape.HOURGLASS:
        stretch = g.elastane_pct * 1.6  # approximate
        if stretch > 10:
            prop_score -= 0.10
            R.append("Empire + hourglass + stretch: mild shape loss (-0.10)")
        elif g.drape > 7:
            prop_score -= 0.15
            R.append("Empire + hourglass + drapey: shape loss (-0.15)")
        else:
            prop_score -= 0.30
            R.append("Empire + hourglass + stiff: significant shape loss (-0.30)")

    # Empire + large bust tent effect
    if g.waist_position == "empire" and b.bust_differential >= 6:
        bust_proj = b.bust_differential * 0.4
        if g.drape < 4:
            tent_severity = bust_proj * (1.0 - g.drape / 10.0)
            if tent_severity > 2.0:
                prop_score -= 0.45
                R.append(f"Empire + large bust + stiff: tent effect (-0.45)")
            elif tent_severity > 1.0:
                prop_score -= 0.25
            else:
                prop_score -= 0.10

    # Drop waist + short legs
    if g.waist_position == "drop":
        if b.leg_ratio < 0.55:
            prop_score -= 0.30
            R.append("Drop waist + short legs: proportion penalty (-0.30)")
        elif b.leg_ratio < 0.58:
            prop_score -= 0.15

    # Apple + belt at natural waist
    if (b.body_shape == BodyShape.APPLE and g.waist_position == "natural"
            and g.has_contrasting_belt and b.whr > 0.85):
        prop_score -= 0.30 if b.whr > 0.88 else -0.15
        R.append("Apple + belt at natural waist: spotlights widest")

    prop_score = clamp(prop_score, -0.80, 0.80)
    return prop_score, " | ".join(R)


def score_color_value(
    g: GarmentProfile, b: BodyProfile
) -> Tuple[float, str]:
    """P14: Color lightness slimming from domain 2."""
    R = []

    L = g.color_lightness * 100  # convert 0-1 to 0-100

    if L <= 10:
        slim_pct = 0.04
    elif L <= 25:
        slim_pct = 0.03
    elif L <= 40:
        slim_pct = 0.02
    elif L <= 60:
        slim_pct = 0.005
    elif L <= 80:
        slim_pct = -0.005
    else:
        slim_pct = -0.01

    slim_score = slim_pct * 6.25  # maps 4% -> +0.25
    R.append(f"Color L={L:.0f}: slim_pct={slim_pct:+.3f}, score={slim_score:+.3f}")

    # Hourglass shape-loss penalty (dark monochrome)
    shape_loss = 0.0
    if L <= 25 and b.body_shape == BodyShape.HOURGLASS:
        whd = b.bust - b.waist  # approximate waist-hip diff
        if whd >= 8:
            shape_loss = -0.30 * (1.0 - L / 25)
        elif whd >= 6:
            shape_loss = -0.20 * (1.0 - L / 25)
        else:
            shape_loss = -0.10 * (1.0 - L / 25)
        R.append(f"Hourglass dark shape loss: {shape_loss:+.2f}")
    elif L <= 25 and b.body_shape == BodyShape.RECTANGLE:
        shape_loss = +0.05
        R.append("Rectangle dark: clean column bonus (+0.05)")

    # Skin tone contrast (very dark garment)
    contrast_mod = 0.0
    if L <= 15 and g.zone in ("torso", "full_body"):
        skin_garment_contrast = abs(b.skin_tone_L / 100 - L / 100)
        if skin_garment_contrast > 0.70:
            contrast_mod = -0.05
        elif skin_garment_contrast < 0.30:
            contrast_mod = +0.05

    score = slim_score + shape_loss + contrast_mod
    return clamp(score), " | ".join(R)


def score_fabric_zone(
    g: GarmentProfile, b: BodyProfile
) -> Tuple[float, str]:
    """P15: Per-zone fabric scoring from domain 3 (simplified)."""
    R = []

    resolved = resolve_fabric_properties(g)

    # Weighted sub-scores (domain 3: cling 30%, structure 20%, sheen 15%,
    # drape 10%, color 8%, texture 5%, pattern 5%, silhouette 4%, construction 3%)
    scores = {}

    # Cling sub-score (30%)
    if resolved.cling_risk_base > 0.6:
        cling_score = -0.20
        if b.is_plus_size or b.belly_zone > 0.5:
            cling_score = -0.40
    elif resolved.cling_risk_base > 0.3:
        cling_score = -0.05
    else:
        cling_score = +0.10
    scores["cling"] = (cling_score, 0.30)

    # Structure sub-score (20%)
    if resolved.is_structured:
        struct_score = +0.15
    elif resolved.effective_gsm > 250:
        struct_score = +0.08
    elif resolved.effective_gsm < 100:
        struct_score = -0.10
    else:
        struct_score = 0.0
    scores["structure"] = (struct_score, 0.20)

    # Sheen sub-score (15%) — from P8
    sheen_score, _ = score_matte_zone(g, b)
    scores["sheen"] = (sheen_score, 0.15)

    # Drape sub-score (10%)
    dc = resolved.drape_coefficient
    if dc < 30:
        drape_score = +0.10  # very drapey: good body skimming
    elif dc < 50:
        drape_score = +0.05
    elif dc < 70:
        drape_score = 0.0
    else:
        drape_score = -0.10  # stiff: holds its own shape
    scores["drape"] = (drape_score, 0.10)

    # Remaining sub-scores (simplified)
    scores["color"] = (0.0, 0.08)
    scores["texture"] = (0.0, 0.05)
    scores["pattern"] = (0.0, 0.05)
    scores["silhouette"] = (0.0, 0.04)
    scores["construction"] = (0.0, 0.03)

    # Weighted sum
    total = sum(s * w for s, w in scores.values())
    total_w = sum(w for _, w in scores.values())
    composite = total / total_w if total_w > 0 else 0.0

    R.append(f"Fabric zone: stretch={resolved.total_stretch_pct:.1f}%, "
             f"GSM={resolved.effective_gsm:.0f}, sheen={resolved.sheen_score:.2f}")
    return clamp(composite), " | ".join(R)


def score_neckline_compound(
    g: GarmentProfile, b: BodyProfile
) -> Tuple[float, str]:
    """P16: Neckline compound scoring from domain 2 — bust dividing,
    torso slimming, upper body balance."""
    R = []
    neck = _neckline_str(g)

    if neck not in ("v_neck", "deep_v", "wrap", "scoop"):
        return 0.0, f"Neckline '{neck}': no compound scoring — N/A"

    # V-neck bust dividing (domain 2 line ~9006)
    depth = g.neckline_depth or (g.v_depth_cm / 2.54 if g.v_depth_cm > 0 else 4.0)
    bd = b.bust_differential
    threshold = get_bust_dividing_threshold(bd)

    fabric_stretch = g.elastane_pct * 0.01  # rough approximation
    effective_depth = depth + (fabric_stretch * 1.0)

    if b.body_shape == BodyShape.HOURGLASS and bd >= 6:
        effective_depth += 0.75
    if b.is_plus_size and bd >= 8:
        effective_depth += 1.0

    depth_ratio = effective_depth / threshold if threshold > 0 else 1.0

    if depth_ratio < 0.60:
        bust_score = +0.30
    elif depth_ratio < 0.85:
        bust_score = +0.50
    elif depth_ratio < 1.0:
        if b.goal_bust == "enhance":
            bust_score = +0.70
        elif b.goal_bust == "minimize":
            bust_score = -0.20
        else:
            bust_score = +0.30
    elif depth_ratio < 1.15:
        if b.goal_bust == "enhance":
            bust_score = +0.30
        elif b.goal_bust == "minimize":
            bust_score = -0.60
        else:
            bust_score = -0.15
    else:
        if b.goal_bust == "enhance":
            bust_score = +0.10
        elif b.goal_bust == "minimize":
            bust_score = -0.85
        else:
            bust_score = -0.35

    R.append(f"Bust: depth={depth:.1f}\", threshold={threshold:.1f}\", "
             f"ratio={depth_ratio:.2f}, score={bust_score:+.2f}")

    # Torso slimming by V angle
    v_width = g.v_depth_cm * 0.8  # approximate V width
    v_angle = v_width / depth if depth > 0 else 1.0
    if v_angle < 0.5:
        torso_base = 0.25
    elif v_angle < 1.0:
        torso_base = 0.18
    elif v_angle < 1.5:
        torso_base = 0.10
    else:
        torso_base = 0.05

    if b.body_shape == BodyShape.APPLE:
        torso_base *= 1.30
    elif b.body_shape == BodyShape.RECTANGLE:
        torso_base *= 1.15

    # Upper body balance
    balance = 0.15
    if b.body_shape == BodyShape.INVERTED_TRIANGLE:
        balance = 0.45
    elif b.body_shape == BodyShape.PEAR:
        balance = 0.30
    elif b.body_shape == BodyShape.RECTANGLE:
        balance = 0.20
    elif b.body_shape == BodyShape.HOURGLASS:
        balance = 0.10

    # Weighted compound: bust 40%, torso 30%, balance 30%
    compound = bust_score * 0.40 + torso_base * 0.30 + balance * 0.30
    R.append(f"Compound: bust={bust_score:+.2f}*0.4 + "
             f"torso={torso_base:+.2f}*0.3 + balance={balance:+.2f}*0.3 "
             f"= {compound:+.2f}")

    return clamp(compound), " | ".join(R)


# ================================================================
# COMPOSITE SCORER — 7-LAYER PIPELINE
# ================================================================

# All 16 scorers with names
_SCORERS = [
    ("H-Stripe Thinning", score_horizontal_stripes),
    ("Dark/Black Slimming", score_dark_slimming),
    ("Rise Elongation", score_rise_elongation),
    ("A-Line Balance", score_aline_balance),
    ("Tent Concealment", score_tent_concealment),
    ("Color Break", score_color_break),
    ("Bodycon Mapping", score_bodycon_mapping),
    ("Matte Zone", score_matte_zone),
    ("V-Neck Elongation", score_vneck_elongation),
    ("Monochrome Column", score_monochrome_column),
    ("Hemline", score_hemline),
    ("Sleeve", score_sleeve),
    ("Waist Placement", score_waist_placement),
    ("Color Value", score_color_value),
    ("Fabric Zone", score_fabric_zone),
    ("Neckline Compound", score_neckline_compound),
]

# Dimension weights (domain 2 line ~10947)
_BASE_WEIGHTS = {
    "H-Stripe Thinning": 0.10,
    "Dark/Black Slimming": 0.08,
    "Rise Elongation": 0.08,
    "A-Line Balance": 0.10,
    "Tent Concealment": 0.12,
    "Color Break": 0.08,
    "Bodycon Mapping": 0.12,
    "Matte Zone": 0.06,
    "V-Neck Elongation": 0.10,
    "Monochrome Column": 0.06,
    "Hemline": 0.18,
    "Sleeve": 0.15,
    "Waist Placement": 0.15,
    "Color Value": 0.08,
    "Fabric Zone": 0.10,
    "Neckline Compound": 0.12,
}

# Goal -> which scorers get boosted
_GOAL_WEIGHT_BOOSTS: Dict[StylingGoal, Dict[str, float]] = {
    StylingGoal.LOOK_TALLER: {
        "Monochrome Column": 1.5, "Rise Elongation": 1.3,
        "V-Neck Elongation": 1.3, "Hemline": 1.3,
        "Pant Rise": 1.5, "Top Hemline": 1.2,
    },
    StylingGoal.HIGHLIGHT_WAIST: {
        "Color Break": 1.5, "Bodycon Mapping": 1.3,
        "Waist Placement": 1.5,
        "Pant Rise": 1.3, "Jacket Scoring": 1.2,
    },
    StylingGoal.HIDE_MIDSECTION: {
        "Tent Concealment": 1.5, "Dark/Black Slimming": 1.3,
        "Matte Zone": 1.3, "Fabric Zone": 1.2,
        "Top Hemline": 1.3, "Jacket Scoring": 1.2,
    },
    StylingGoal.SLIM_HIPS: {
        "Dark/Black Slimming": 1.5, "A-Line Balance": 1.3,
        "Matte Zone": 1.3, "Hemline": 1.2,
        "Leg Shape": 1.5, "Top Hemline": 1.3,
    },
    StylingGoal.LOOK_PROPORTIONAL: {
        "Waist Placement": 1.5, "Hemline": 1.3,
        "Rise Elongation": 1.3,
        "Pant Rise": 1.3,
    },
    StylingGoal.MINIMIZE_ARMS: {
        "Sleeve": 1.5, "Matte Zone": 1.3,
        "Jacket Scoring": 1.2,
    },
    StylingGoal.SLIMMING: {
        "Dark/Black Slimming": 1.5, "Matte Zone": 1.5,
        "H-Stripe Thinning": 1.3, "Tent Concealment": 1.5,
    },
    StylingGoal.CONCEALMENT: {
        "Tent Concealment": 1.5, "Matte Zone": 1.3,
    },
    StylingGoal.EMPHASIS: {
        "Bodycon Mapping": 1.5, "Color Break": 1.5,
        "V-Neck Elongation": 1.5,
    },
    StylingGoal.BALANCE: {},
}


def score_garment(
    garment: GarmentProfile,
    body: BodyProfile,
    context: Optional[dict] = None,
) -> ScoreResult:
    """
    Main scoring function — the 7-layer pipeline.

    Args:
        garment: Complete garment description
        body: User's body profile with measurements
        context: Optional context dict (occasion, culture, etc.)

    Returns:
        ScoreResult with overall 0-10 score, breakdowns, and reasoning
    """
    reasoning_chain: List[str] = []
    exceptions: List[ExceptionTriggered] = []
    fixes: List[Fix] = []

    # ── Layer 1: Fabric Gate ──
    resolved = resolve_fabric_properties(garment)
    gate_exceptions = run_fabric_gates(garment, body, resolved)
    exceptions.extend(gate_exceptions)
    penalty_reduction = get_structured_penalty_reduction(gate_exceptions)
    reasoning_chain.append(
        f"L1 Fabric: stretch={resolved.total_stretch_pct:.1f}%, "
        f"GSM={resolved.effective_gsm:.0f}, sheen={resolved.sheen_score:.2f}, "
        f"gates={len(gate_exceptions)}"
    )

    # ── Layer 2: Element Scoring ──
    # Auto-classify if category is still default DRESS but garment has type signals
    category = classify_garment(garment)
    garment.category = category
    reasoning_chain.append(f"Classification: {category.value}")
    scorers_to_skip = get_scorers_to_skip(category)

    principle_results: List[PrincipleResult] = []
    for name, scorer in _SCORERS:
        # Skip scorers irrelevant to this garment type
        if name in scorers_to_skip:
            principle_results.append(PrincipleResult(
                name=name, score=0.0,
                reasoning=f"N/A for {category.value}",
                weight=0.0, applicable=False, confidence=0.0,
            ))
            continue

        try:
            score, reasoning = scorer(garment, body)
        except Exception as e:
            score, reasoning = 0.0, f"ERROR: {e}"

        # Apply structured penalty reduction for negative scores
        if score < 0 and penalty_reduction < 1.0:
            score *= penalty_reduction

        confidence = PRINCIPLE_CONFIDENCE.get(
            name.lower().replace(" ", "_").replace("/", "_"),
            0.70,
        )

        weight = _BASE_WEIGHTS.get(name, 0.10)
        applicable = True

        if abs(score) < 0.001 and "n/a" in reasoning.lower():
            weight = 0.0
            applicable = False

        principle_results.append(PrincipleResult(
            name=name, score=score, reasoning=reasoning,
            weight=weight, applicable=applicable, confidence=confidence,
        ))

    # Add garment-type-specific scorers
    _TYPE_SCORER_FUNCS = {
        "Top Hemline": score_top_hemline,
        "Pant Rise": score_pant_rise,
        "Leg Shape": score_leg_shape,
        "Jacket Scoring": score_jacket_scoring,
    }
    for extra_name in get_extra_scorer_names(category):
        scorer_fn = _TYPE_SCORER_FUNCS.get(extra_name)
        if scorer_fn is None:
            continue
        try:
            score, reasoning = scorer_fn(garment, body)
        except Exception as e:
            score, reasoning = 0.0, f"ERROR: {e}"

        if score < 0 and penalty_reduction < 1.0:
            score *= penalty_reduction

        weight = TYPE_SCORER_WEIGHTS.get(extra_name, 0.10)
        applicable = True
        if abs(score) < 0.001 and "n/a" in reasoning.lower():
            weight = 0.0
            applicable = False

        principle_results.append(PrincipleResult(
            name=extra_name, score=score, reasoning=reasoning,
            weight=weight, applicable=applicable, confidence=0.70,
        ))

    reasoning_chain.append(
        f"L2 Element: {sum(1 for r in principle_results if r.applicable)}/{len(principle_results)} active"
    )

    # ── Layer 3: Perceptual Calibration (goal-based weighting) ──
    for result in principle_results:
        if not result.applicable:
            continue
        for goal in body.styling_goals:
            boosts = _GOAL_WEIGHT_BOOSTS.get(goal, {})
            if result.name in boosts:
                result.weight *= boosts[result.name]

        # Conservative negative amplification
        if result.score < -0.15:
            result.weight *= 1.2

        # Cap single dimension weight
        result.weight = min(result.weight, 0.35 * sum(
            r.weight for r in principle_results if r.applicable
        ) if any(r.applicable for r in principle_results) else 0.35)

    reasoning_chain.append("L3 Calibration: goal weights + negative amplification applied")

    # ── Layer 4: Goal Scoring ──
    goal_verdicts = score_goals(principle_results, body)
    reasoning_chain.append(
        f"L4 Goals: {sum(1 for v in goal_verdicts if v.verdict == 'pass')} pass, "
        f"{sum(1 for v in goal_verdicts if v.verdict == 'fail')} fail"
    )

    # ── Layer 5: Body-Type Parameterization ──
    body_adjusted = translate_garment_to_body(garment, body)
    reasoning_chain.append(
        f"L5 BodyAdj: hem={body_adjusted.hem_from_floor:.1f}\", "
        f"sleeve_delta={body_adjusted.arm_width_delta:+.2f}\", "
        f"leg_ratio={body_adjusted.visual_leg_ratio:.3f}"
    )

    # ── Layer 6: Context Modifiers ──
    context_adjustments = {}
    if context:
        context_adjustments = apply_context_modifiers(
            context, principle_results, body, garment
        )
        reasoning_chain.append(
            f"L6 Context: {len(context_adjustments)} adjustments"
        )
    else:
        reasoning_chain.append("L6 Context: none")

    # ── Layer 7: Composite ──
    active = [r for r in principle_results if r.applicable]
    if not active:
        return ScoreResult(
            overall_score=5.0, composite_raw=0.0, confidence=0.50,
            principle_scores=principle_results,
            goal_verdicts=goal_verdicts,
            body_adjusted=body_adjusted,
            exceptions=exceptions,
            reasoning_chain=reasoning_chain,
        )

    tw = sum(r.weight for r in active)
    if tw == 0:
        composite = 0.0
    else:
        composite = sum(r.score * r.weight * r.confidence for r in active) / (
            sum(r.weight * r.confidence for r in active)
        )

    # Silhouette dominance rule
    sil_names = {"Tent Concealment", "Bodycon Mapping"}
    sil_scores = [r.score for r in active if r.name in sil_names]
    worst_sil = min(sil_scores) if sil_scores else 0.0

    has_slimming = (
        _has_goal(body, StylingGoal.SLIMMING)
        or _has_goal(body, StylingGoal.SLIM_HIPS)
        or _has_goal(body, StylingGoal.HIDE_MIDSECTION)
    )
    if worst_sil < -0.20 and has_slimming and composite > 0:
        composite = worst_sil * 0.3
        reasoning_chain.append(
            f"L7 Silhouette dominance: worst_sil={worst_sil:+.2f} "
            f"overrides positive composite"
        )

    composite = clamp(composite)
    overall = rescale_display(score_to_ten(composite))
    avg_confidence = (
        sum(r.confidence for r in active) / len(active) if active else 0.50
    )

    # Generate zone scores
    zone_scores = _compute_zone_scores(principle_results, body_adjusted)

    # Generate fix suggestions
    fixes = _suggest_fixes(principle_results, exceptions, body)

    reasoning_chain.append(
        f"L7 Composite: raw={composite:+.3f}, overall={overall:.1f}/10, "
        f"confidence={avg_confidence:.2f}"
    )

    # ── Layer interaction (for jackets, coats, cardigans, vests) ──
    layer_modifications = None
    styling_notes: List[str] = []
    if is_layer_garment(category):
        layer_info = compute_layer_modifications(garment, body)
        layer_modifications = layer_info
        styling_notes = layer_info.get("styling_notes", [])
        reasoning_chain.append(
            f"Layer: {len(layer_info.get('layer_modifications', []))} modifications"
        )

    return ScoreResult(
        overall_score=round(overall, 1),
        composite_raw=round(composite, 4),
        confidence=round(avg_confidence, 2),
        principle_scores=principle_results,
        goal_verdicts=goal_verdicts,
        zone_scores=zone_scores,
        exceptions=exceptions,
        fixes=fixes,
        body_adjusted=body_adjusted,
        reasoning_chain=reasoning_chain,
        layer_modifications=layer_modifications,
        styling_notes=styling_notes,
    )


# ================================================================
# HELPERS
# ================================================================

def _compute_zone_scores(
    principles: List[PrincipleResult],
    body_adj: BodyAdjustedGarment,
) -> Dict[str, ZoneScore]:
    """Compute per-zone scores from principle results.

    Returns a dict keyed by zone name for direct access.
    """
    zones: Dict[str, dict] = {}

    # Map principles to zones
    zone_mapping = {
        "H-Stripe Thinning": ["torso"],
        "Dark/Black Slimming": ["torso"],
        "Rise Elongation": ["waist"],
        "A-Line Balance": ["hip"],
        "Tent Concealment": ["torso", "hip"],
        "Color Break": ["waist"],
        "Bodycon Mapping": ["torso", "hip", "thigh"],
        "Matte Zone": ["torso", "hip"],
        "V-Neck Elongation": ["bust", "shoulder"],
        "Monochrome Column": ["torso"],
        "Hemline": ["knee", "calf", "ankle"],
        "Sleeve": ["upper_arm", "shoulder"],
        "Waist Placement": ["waist"],
        "Color Value": ["torso"],
        "Fabric Zone": ["torso", "hip"],
        "Neckline Compound": ["bust"],
    }
    # Add zone mappings for type-specific scorers
    zone_mapping.update(TYPE_SCORER_ZONE_MAPPING)

    for p in principles:
        if not p.applicable:
            continue
        for zone in zone_mapping.get(p.name, []):
            if zone not in zones:
                zones[zone] = {"scores": [], "flags": []}
            zones[zone]["scores"].append(p.score)
            if p.score < -0.20:
                zones[zone]["flags"].append(f"{p.name}: {p.score:+.2f}")

    results: Dict[str, ZoneScore] = {}
    for zone_name, data in sorted(zones.items()):
        scores = data["scores"]
        avg = sum(scores) / len(scores) if scores else 0.0
        results[zone_name] = ZoneScore(
            zone=zone_name,
            score=round(avg, 3),
            flags=data["flags"],
        )

    return results


def _suggest_fixes(
    principles: List[PrincipleResult],
    exceptions: List[ExceptionTriggered],
    body: BodyProfile,
) -> List[Fix]:
    """Generate fix suggestions for the worst-scoring principles."""
    fixes = []

    # Find worst scorers
    worst = sorted(
        [p for p in principles if p.applicable and p.score < -0.15],
        key=lambda p: p.score,
    )

    fix_suggestions = {
        "Tent Concealment": ("Try semi-fitted silhouette (ER 0.03-0.08)", 0.20),
        "Bodycon Mapping": ("Add structured layer or choose heavier fabric (GSM 250+)", 0.25),
        "Color Break": ("Remove contrasting belt or switch to tonal belt", 0.10),
        "A-Line Balance": ("Choose fabric with lower drape coefficient (<40%)", 0.15),
        "Rise Elongation": ("Choose wider elastic waistband (5cm+, 8%+ stretch)", 0.15),
        "V-Neck Elongation": ("Choose V-neck instead of boat/turtleneck", 0.12),
        "Hemline": ("Adjust hem to avoid knee/calf danger zones", 0.20),
        "Sleeve": ("Choose 3/4 sleeve for optimal arm slimming", 0.25),
        "H-Stripe Thinning": ("Replace horizontal stripes with solid or vertical lines", 0.10),
        "Dark/Black Slimming": ("Choose dark chocolate/burgundy for warm skin tones", 0.08),
        "Top Hemline": ("Try tucking in or choosing a cropped/waist-length top", 0.20),
        "Pant Rise": ("Choose high-rise pants to elongate your leg line", 0.25),
        "Leg Shape": ("Try wide-leg or straight-leg pants for your body type", 0.20),
        "Jacket Scoring": ("Try a cropped or waist-length jacket with natural shoulders", 0.15),
    }

    for p in worst[:3]:
        if p.name in fix_suggestions:
            what, improvement = fix_suggestions[p.name]
            fixes.append(Fix(
                what_to_change=what,
                expected_improvement=improvement,
                priority=1 if p.score < -0.30 else 2,
            ))

    return fixes
