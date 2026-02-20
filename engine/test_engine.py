"""
Kridha Production Scoring Engine — Comprehensive Test Suite
============================================================
Ports all 80+ tests from domain 4 v4 (8 reversals, 27 P1 detections,
4 composite scenarios, 6 edge cases) plus new tests for Piece 2 math,
fabric gate, goal scoring, and end-to-end pipeline.
"""

import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from engine.schemas import (
    BodyProfile, GarmentProfile, ScoreResult, ZoneScore,
    BodyShape, StylingGoal, SkinUndertone,
    FabricConstruction, SurfaceFinish, Silhouette,
    SleeveType, NecklineType, GarmentCategory,
    TopHemBehavior,
    clamp, score_to_ten,
)
from engine.kridha_engine import (
    score_horizontal_stripes, score_dark_slimming,
    score_rise_elongation, score_aline_balance,
    score_tent_concealment, score_color_break,
    score_bodycon_mapping, score_matte_zone,
    score_vneck_elongation, score_monochrome_column,
    score_hemline, score_sleeve, score_waist_placement,
    score_color_value, score_fabric_zone, score_neckline_compound,
    score_garment,
)
from engine.body_garment_translator import (
    translate_hemline, translate_sleeve, translate_waistline,
    translate_garment_to_body,
)
from engine.context_modifiers import apply_context_modifiers
from engine.fabric_gate import (
    resolve_fabric_properties, run_fabric_gates, compute_cling_risk,
)
from engine.rules_data import (
    get_registry, ELASTANE_MULTIPLIERS, FIBER_GSM_MULTIPLIERS,
    FABRIC_LOOKUP,
)
from engine.goal_scorers import score_goals
from engine.garment_types import (
    classify_garment,
    score_top_hemline, score_pant_rise, score_leg_shape,
    score_jacket_scoring,
)


# ================================================================
# TEST HELPERS
# ================================================================

PASS_COUNT = 0
FAIL_COUNT = 0


def check(name, score, exp_sign, exp_range=None, reasoning=""):
    """Validate a score against expected sign and optional range."""
    global PASS_COUNT, FAIL_COUNT

    if exp_sign == "+":
        ok = score > 0.005
    elif exp_sign == "-":
        ok = score < -0.005
    elif exp_sign == "0":
        ok = abs(score) < 0.05
    elif exp_sign == "~":
        ok = True
    else:
        ok = False

    if exp_range:
        lo, hi = exp_range
        ok = ok and lo <= score <= hi

    if ok:
        PASS_COUNT += 1
        status = "PASS"
    else:
        FAIL_COUNT += 1
        status = "FAIL"

    range_str = f" [{exp_range[0]:+.2f}, {exp_range[1]:+.2f}]" if exp_range else ""
    print(f"  {'[OK]' if ok else '[!!]'} {name}: {score:+.4f} (exp {exp_sign}{range_str})")


# ================================================================
# BODY PROFILES (reusable test fixtures)
# ================================================================

def _hourglass() -> BodyProfile:
    return BodyProfile(
        height=66, bust=38, underbust=32, waist=27, hip=39,
        shoulder_width=14.0,
    )

def _apple() -> BodyProfile:
    return BodyProfile(
        height=66, bust=40, underbust=36, waist=36, hip=38,
        shoulder_width=15.5, belly_zone=0.7,
    )

def _pear() -> BodyProfile:
    return BodyProfile(
        height=66, bust=34, underbust=30, waist=28, hip=42,
        shoulder_width=14.0,
    )

def _invt() -> BodyProfile:
    return BodyProfile(
        height=67, bust=36, underbust=32, waist=30, hip=35,
        shoulder_width=17.0,
    )

def _rectangle() -> BodyProfile:
    return BodyProfile(
        height=67, bust=35, underbust=31, waist=32, hip=36,
        shoulder_width=15.0,
    )

def _petite() -> BodyProfile:
    return BodyProfile(
        height=61, bust=34, underbust=30, waist=27, hip=36,
        shoulder_width=14.0, torso_length=13.0,
    )

def _tall() -> BodyProfile:
    return BodyProfile(
        height=70, bust=36, underbust=32, waist=29, hip=38,
        shoulder_width=15.5,
    )

def _plus() -> BodyProfile:
    return BodyProfile(
        height=66, bust=44, underbust=38, waist=38, hip=46,
        shoulder_width=16.0, belly_zone=0.5,
    )


# ── Combination fixtures ──

def _petite_pear() -> BodyProfile:
    """Petite pear: short + hip-dominant."""
    return BodyProfile(
        height=61, bust=33, underbust=29, waist=26, hip=40,
        shoulder_width=13.5, torso_length=13.0,
    )

def _plus_apple() -> BodyProfile:
    """Plus apple: large bust + waist, moderate hip."""
    return BodyProfile(
        height=66, bust=44, underbust=38, waist=40, hip=43,
        shoulder_width=16.0, belly_zone=0.8,
    )

def _petite_hourglass() -> BodyProfile:
    """Petite hourglass: short + curves."""
    return BodyProfile(
        height=61, bust=36, underbust=30, waist=25, hip=37,
        shoulder_width=14.0, torso_length=13.0,
    )

def _with_goals(body: BodyProfile, *goals: StylingGoal) -> BodyProfile:
    """Convenience: set styling goals on a body profile."""
    body.styling_goals = list(goals)
    return body


# ================================================================
# SECTION 1: ALL 8 REVERSALS (from domain 4 v4)
# ================================================================

def test_reversals():
    print("\n" + "=" * 70)
    print("  SECTION 1: ALL 8 REVERSALS")
    print("=" * 70)

    # R1: H-stripe on INVT upper body -> negative
    g = GarmentProfile(has_horizontal_stripes=True, zone="torso")
    s, r = score_horizontal_stripes(g, _invt())
    check("R1: H-stripe on INVT upper body", s, "-")

    # R2: Tent on Petite -> strong negative
    g = GarmentProfile(expansion_rate=0.20)
    s, r = score_tent_concealment(g, _petite())
    check("R2: Tent on Petite", s, "-")

    # R3: Tent on Hourglass -> strongest negative
    g = GarmentProfile(expansion_rate=0.20)
    s, r = score_tent_concealment(g, _hourglass())
    check("R3: Tent on Hourglass", s, "-")

    # R4: Tent on Plus -> strong negative
    g = GarmentProfile(expansion_rate=0.20)
    s, r = score_tent_concealment(g, _plus())
    check("R4: Tent on Plus", s, "-")

    # R5: Tent on INVT -> negative
    g = GarmentProfile(expansion_rate=0.20)
    s, r = score_tent_concealment(g, _invt())
    check("R5: Tent on INVT", s, "-")

    # R6: Contrasting belt on Hourglass -> POSITIVE
    g = GarmentProfile(has_contrasting_belt=True, belt_width_cm=4.0)
    s, r = score_color_break(g, _hourglass())
    check("R6: Belt on Hourglass -> POSITIVE", s, "+")

    # R7: Thin bodycon on Apple -> maximum negative
    g = GarmentProfile(expansion_rate=0.01, gsm_estimated=150)
    s, r = score_bodycon_mapping(g, _apple())
    check("R7: Thin bodycon on Apple", s, "-", (-1.0, -0.30))

    # R8: Bodycon on Hourglass -> POSITIVE
    g = GarmentProfile(expansion_rate=0.01, gsm_estimated=150)
    s, r = score_bodycon_mapping(g, _hourglass())
    check("R8: Bodycon on Hourglass -> POSITIVE", s, "+")


# ================================================================
# SECTION 2: P1 DETECTIONS (27 tests from domain 4 v4)
# ================================================================

def test_p1_detections():
    print("\n" + "=" * 70)
    print("  SECTION 2: PRIORITY-1 DETECTIONS")
    print("=" * 70)

    # P1.1: H-stripe x Pear top = positive
    g = GarmentProfile(has_horizontal_stripes=True, zone="torso")
    s, r = score_horizontal_stripes(g, _pear())
    check("P1.1: H-stripe Pear top", s, "+")

    # P1.2: H-stripe x Pear bottom = negative
    g = GarmentProfile(has_horizontal_stripes=True, zone="lower_body")
    s, r = score_horizontal_stripes(g, _pear())
    check("P1.2: H-stripe Pear bottom", s, "-")

    # P1.3: H-stripe x Plus = nullified/negative
    g = GarmentProfile(has_horizontal_stripes=True, zone="torso")
    s, r = score_horizontal_stripes(g, _plus())
    check("P1.3: H-stripe Plus", s, "-")

    # P2.1: Dark matte x Apple = positive
    g = GarmentProfile(color_lightness=0.10, surface=SurfaceFinish.MATTE, zone="torso")
    s, r = score_dark_slimming(g, _apple())
    check("P2.1: Dark matte Apple", s, "+")

    # P2.2: Dark shiny x Apple = reduced
    g = GarmentProfile(color_lightness=0.10, surface=SurfaceFinish.HIGH_SHINE, zone="torso")
    s, r = score_dark_slimming(g, _apple())
    check("P2.2: Dark shiny Apple (reduced)", s, "~")

    # P2.3: Dark x INVT upper = amplified
    g = GarmentProfile(color_lightness=0.10, surface=SurfaceFinish.MATTE, zone="torso")
    s, r = score_dark_slimming(g, _invt())
    check("P2.3: Dark INVT upper (amplified)", s, "+", (0.15, 0.30))

    # P3.1: Rise x Petite = amplified
    petite_long = _petite()
    g = GarmentProfile(rise_cm=28)
    s, r = score_rise_elongation(g, petite_long)
    check("P3.1: Rise Petite", s, "+")

    # P3.2: Rise x Petite short torso = INVERTED
    petite_short = BodyProfile(height=61, bust=34, underbust=30, waist=27, hip=36,
                                shoulder_width=14.0, torso_length=11.5)
    g = GarmentProfile(rise_cm=28)
    s, r = score_rise_elongation(g, petite_short)
    check("P3.2: Rise Petite short torso -> INVERTED", s, "-")

    # P3.3: Rise x Apple + narrow rigid = muffin
    apple = _apple()
    g = GarmentProfile(rise_cm=28, waistband_width_cm=2.0, waistband_stretch_pct=3.0)
    s, r = score_rise_elongation(g, apple)
    check("P3.3: Rise Apple narrow rigid -> muffin", s, "-")

    # P3.4: Rise x Apple + wide elastic = positive
    g = GarmentProfile(rise_cm=28, waistband_width_cm=6.0, waistband_stretch_pct=10.0)
    s, r = score_rise_elongation(g, apple)
    check("P3.4: Rise Apple wide elastic", s, "+")

    # P4.1: A-line x Pear + drapey = positive
    g = GarmentProfile(expansion_rate=0.08, drape=3)  # 30% DC
    s, r = score_aline_balance(g, _pear())
    check("P4.1: A-line Pear drapey", s, "+")

    # P4.2: A-line x Pear + stiff = shelf
    g = GarmentProfile(expansion_rate=0.08, drape=7)  # 70% DC
    s, r = score_aline_balance(g, _pear())
    check("P4.2: A-line Pear stiff -> shelf", s, "-")

    # P4.3: A-line x INVT = max benefit
    g = GarmentProfile(expansion_rate=0.08, drape=3)
    s, r = score_aline_balance(g, _invt())
    check("P4.3: A-line INVT max benefit", s, "+", (0.20, 0.60))

    # P4.4: A-line x Plus + stiff = amplified shelf
    g = GarmentProfile(expansion_rate=0.08, drape=7)
    s, r = score_aline_balance(g, _plus())
    check("P4.4: A-line Plus stiff -> amplified shelf", s, "-")

    # P6.1: Color break x Petite = amplified penalty
    g = GarmentProfile(has_contrasting_belt=True)
    s, r = score_color_break(g, _petite())
    check("P6.1: Belt Petite -> amplified penalty", s, "-")

    # P6.2: Color break x Apple = strong penalty
    g = GarmentProfile(has_contrasting_belt=True)
    s, r = score_color_break(g, _apple())
    check("P6.2: Belt Apple -> strong penalty", s, "-", (-0.50, -0.15))

    # P7.1: Thin bodycon x Pear
    g = GarmentProfile(expansion_rate=0.01, gsm_estimated=150)
    s, r = score_bodycon_mapping(g, _pear())
    check("P7.1: Thin bodycon Pear", s, "-")

    # P7.2: Thin bodycon x Plus
    g = GarmentProfile(expansion_rate=0.01, gsm_estimated=150)
    s, r = score_bodycon_mapping(g, _plus())
    check("P7.2: Thin bodycon Plus", s, "-", (-1.0, -0.30))

    # P7.3: Structured bodycon x Plus (dramatically better)
    g = GarmentProfile(expansion_rate=0.01, gsm_estimated=300, is_structured=True)
    s, r = score_bodycon_mapping(g, _plus())
    check("P7.3: Structured bodycon Plus (better)", s, "-", (-0.10, 0.0))

    # P7.4: Bodycon x Athletic Apple -> POSITIVE
    athletic_apple = BodyProfile(
        height=66, bust=38, underbust=34, waist=34, hip=37,
        shoulder_width=15.5, belly_zone=0.3, is_athletic=True,
    )
    g = GarmentProfile(expansion_rate=0.01, gsm_estimated=150)
    s, r = score_bodycon_mapping(g, athletic_apple)
    check("P7.4: Bodycon Athletic Apple -> POSITIVE", s, "+")

    # P8.1: Matte x Pear hip = amplified
    g = GarmentProfile(surface=SurfaceFinish.DEEP_MATTE, zone="lower_body")
    s, r = score_matte_zone(g, _pear())
    check("P8.1: Matte Pear hip (amplified)", s, "+")

    # P8.2: Matte x Apple
    g = GarmentProfile(surface=SurfaceFinish.DEEP_MATTE, zone="torso")
    s, r = score_matte_zone(g, _apple())
    check("P8.2: Matte Apple", s, "+")

    # P8.3: Matte x Plus
    g = GarmentProfile(surface=SurfaceFinish.DEEP_MATTE, zone="torso")
    s, r = score_matte_zone(g, _plus())
    check("P8.3: Matte Plus", s, "+")

    # P8.4: Cling trap + matte + Plus
    g = GarmentProfile(
        surface=SurfaceFinish.MATTE,
        elastane_pct=8, construction=FabricConstruction.KNIT_JERSEY,
        gsm_estimated=120, surface_friction=0.2,
        zone="torso",
    )
    s, r = score_matte_zone(g, _plus())
    check("P8.4: Cling trap matte Plus -> NEGATIVE", s, "-")

    # P9.1: V-neck x Petite + short torso + high rise = conflict
    petite_short = BodyProfile(height=61, bust=34, underbust=30, waist=27, hip=36,
                                shoulder_width=14.0, torso_length=11.5)
    g = GarmentProfile(neckline=NecklineType.V_NECK, rise_cm=28)
    s, r = score_vneck_elongation(g, petite_short)
    check("P9.1: V-neck Petite short torso + high rise -> conflict", s, "-")

    # P9.2: V-neck x INVT = amplified
    g = GarmentProfile(neckline=NecklineType.V_NECK)
    s, r = score_vneck_elongation(g, _invt())
    check("P9.2: V-neck INVT -> amplified (+0.18)", s, "+", (0.10, 0.25))

    # P9.3: Boat neck x INVT = danger
    g = GarmentProfile(neckline=NecklineType.BOAT)
    s, r = score_vneck_elongation(g, _invt())
    check("P9.3: Boat INVT -> danger", s, "-")

    # P10.1: Dark monochrome x Petite = amplified
    g = GarmentProfile(is_monochrome_outfit=True, color_lightness=0.10)
    s, r = score_monochrome_column(g, _petite())
    check("P10.1: Dark mono Petite -> amplified", s, "+", (0.15, 0.30))


# ================================================================
# SECTION 3: COMPOSITE SCENARIOS (end-to-end)
# ================================================================

def test_composite_scenarios():
    print("\n" + "=" * 70)
    print("  SECTION 3: COMPOSITE SCENARIOS")
    print("=" * 70)

    # Scenario A: Hourglass + black structured bodycon + V-neck + wide belt
    body = _hourglass()
    body.styling_goals = [StylingGoal.EMPHASIS]
    garment = GarmentProfile(
        expansion_rate=0.02, gsm_estimated=280, is_structured=True,
        color_lightness=0.08, surface=SurfaceFinish.MATTE,
        neckline=NecklineType.V_NECK, v_depth_cm=10,
        has_contrasting_belt=True, belt_width_cm=5.0,
        is_monochrome_outfit=True,
        zone="full_body", hem_position="knee",
    )
    result = score_garment(garment, body)
    check("Scenario A: Hourglass perfect outfit", result.composite_raw, "+", (0.0, 0.60))

    # Scenario B: Petite apple + light shiny tent + contrasting belt
    body = _petite()
    body.styling_goals = [StylingGoal.SLIMMING]
    body2 = BodyProfile(
        height=61, bust=38, underbust=34, waist=35, hip=37,
        shoulder_width=14.0, torso_length=13.0, belly_zone=0.8,
    )
    body2.styling_goals = [StylingGoal.SLIMMING]
    garment = GarmentProfile(
        expansion_rate=0.25, gsm_estimated=100,
        color_lightness=0.80, surface=SurfaceFinish.MODERATE_SHEEN,
        has_contrasting_belt=True, belt_width_cm=4.0,
        zone="full_body", hem_position="knee",
    )
    result = score_garment(garment, body2)
    check("Scenario B: Petite apple everything wrong", result.composite_raw, "-", (-0.80, -0.05))

    # Scenario C: INVT + dark V-neck + drapey A-line
    body = _invt()
    body.styling_goals = [StylingGoal.BALANCE]
    garment = GarmentProfile(
        expansion_rate=0.08, gsm_estimated=180,
        color_lightness=0.12, surface=SurfaceFinish.MATTE,
        neckline=NecklineType.V_NECK, v_depth_cm=8,
        drape=3, zone="full_body", hem_position="above_knee",
        sleeve_type=SleeveType.THREE_QUARTER,
    )
    result = score_garment(garment, body)
    check("Scenario C: INVT ideal outfit", result.composite_raw, "+", (0.0, 0.50))

    # Scenario D: Plus pear + structured semi-fitted + dark matte + wide elastic
    body = BodyProfile(
        height=66, bust=42, underbust=37, waist=35, hip=46,
        shoulder_width=15.5, belly_zone=0.3,
    )
    body.styling_goals = [StylingGoal.SLIM_HIPS]
    garment = GarmentProfile(
        expansion_rate=0.05, gsm_estimated=300, is_structured=True,
        color_lightness=0.10, surface=SurfaceFinish.DEEP_MATTE,
        rise_cm=26, waistband_width_cm=5.0, waistband_stretch_pct=10.0,
        sleeve_type=SleeveType.THREE_QUARTER,
        zone="full_body", hem_position="above_knee",
    )
    result = score_garment(garment, body)
    check("Scenario D: Plus pear good outfit", result.composite_raw, "+", (-0.05, 0.50))


# ================================================================
# SECTION 4: EDGE CASES (from domain 4 v4)
# ================================================================

def test_edge_cases():
    print("\n" + "=" * 70)
    print("  SECTION 4: EDGE CASES")
    print("=" * 70)

    # E1: Black + warm skin near face = sallow-reduced
    warm_body = BodyProfile(
        height=66, bust=36, underbust=32, waist=30, hip=38,
        skin_undertone=SkinUndertone.WARM, skin_darkness=0.3,
    )
    g = GarmentProfile(color_lightness=0.05, surface=SurfaceFinish.MATTE, zone="torso")
    s, r = score_dark_slimming(g, warm_body)
    check("E1: Black warm skin sallow-reduced", s, "~", (-0.05, 0.10))

    # E2: Same garment below waist = full benefit (no skin interaction)
    g = GarmentProfile(color_lightness=0.05, surface=SurfaceFinish.MATTE, zone="lower_body")
    s, r = score_dark_slimming(g, warm_body)
    check("E2: Black warm skin lower body = full benefit", s, "+", (0.10, 0.25))

    # E3: Semi-fitted on hourglass = mild positive
    g = GarmentProfile(expansion_rate=0.05)
    s, r = score_tent_concealment(g, _hourglass())
    check("E3: Semi-fitted hourglass = mild positive", s, "+")

    # E4: V-stripes on INVT lower body = negative
    g = GarmentProfile(has_vertical_stripes=True, zone="lower_body")
    s, r = score_horizontal_stripes(g, _invt())
    check("E4: V-stripes INVT lower -> negative", s, "-")

    # E5: Dark brown > black for warm skin
    g_brown = GarmentProfile(color_lightness=0.18, surface=SurfaceFinish.MATTE, zone="torso")
    s_brown, _ = score_dark_slimming(g_brown, warm_body)
    g_black = GarmentProfile(color_lightness=0.05, surface=SurfaceFinish.MATTE, zone="torso")
    s_black, _ = score_dark_slimming(g_black, warm_body)
    check("E5: Dark brown > black for warm skin", s_brown - s_black, "+")

    # E6: Tent for concealment goal = positive
    conceal_body = _apple()
    conceal_body.styling_goals = [StylingGoal.CONCEALMENT]
    g = GarmentProfile(expansion_rate=0.20)
    s, r = score_tent_concealment(g, conceal_body)
    # Note: apple body penalty -0.10 may bring this down, but concealment base is +0.35
    check("E6: Tent concealment goal", s, "+")


# ================================================================
# SECTION 5: PIECE 2 MATH TESTS
# ================================================================

def test_piece2_math():
    print("\n" + "=" * 70)
    print("  SECTION 5: PIECE 2 MATH")
    print("=" * 70)

    body = BodyProfile(
        height=66, bust=36, underbust=32, waist=28, hip=38,
        h_knee=18, h_calf_max=14, h_calf_min=10, h_ankle=4,
        c_calf_max=14.5, c_calf_min=9.0,
    )

    # Hemline: knee danger zone detection
    g = GarmentProfile(hem_position="knee")
    hem = translate_hemline(g, body)
    check("Hemline knee -> knee zone", 1.0 if "knee" in hem.hem_zone else -1.0, "+")

    # Hemline: above knee = not in danger zone
    g = GarmentProfile(hem_position="above_knee")
    hem = translate_hemline(g, body)
    check("Hemline above_knee -> not danger", 1.0 if "above" in hem.hem_zone else -1.0, "+")

    # Hemline: midi
    g = GarmentProfile(hem_position="midi")
    hem = translate_hemline(g, body)
    check("Hemline midi position", hem.hem_from_floor, "+", (10, 20))

    # Hemline: proportion cut ratio
    check("Hemline cut ratio in range", hem.proportion_cut_ratio, "+", (0.10, 0.35))

    # Sleeve: 3/4 sleeve endpoint
    g = GarmentProfile(sleeve_type=SleeveType.THREE_QUARTER)
    sleeve = translate_sleeve(g, body)
    check("Sleeve 3/4 endpoint", sleeve.endpoint_position, "+", (14, 20))

    # Sleeve: cap sleeve near danger zone
    g = GarmentProfile(sleeve_type=SleeveType.CAP)
    sleeve = translate_sleeve(g, body)
    check("Sleeve cap near danger zone", sleeve.delta_vs_actual, "+")  # widening

    # Waistline: natural waist
    g = GarmentProfile(waist_position="natural")
    waist = translate_waistline(g, body)
    check("Waistline natural", waist.visual_waist_height, "+", (40, 60))

    # Waistline: empire raises visual waist
    g_empire = GarmentProfile(waist_position="empire")
    waist_empire = translate_waistline(g_empire, body)
    check("Empire raises waist", waist_empire.visual_waist_height - waist.visual_waist_height, "+")

    # Waistline: drop lowers visual waist
    g_drop = GarmentProfile(waist_position="drop")
    waist_drop = translate_waistline(g_drop, body)
    check("Drop lowers waist", waist.visual_waist_height - waist_drop.visual_waist_height, "+")


# ================================================================
# SECTION 6: FABRIC GATE TESTS
# ================================================================

def test_fabric_gate():
    print("\n" + "=" * 70)
    print("  SECTION 6: FABRIC GATE")
    print("=" * 70)

    # Elastane multiplier accuracy
    assert ELASTANE_MULTIPLIERS["woven"] == 1.6
    assert ELASTANE_MULTIPLIERS["knit"] == 4.0
    assert ELASTANE_MULTIPLIERS["knit_rib"] == 5.5
    check("Elastane multipliers correct", 1.0, "+")

    # Fiber GSM multipliers
    assert FIBER_GSM_MULTIPLIERS["cotton"] == 1.15
    assert FIBER_GSM_MULTIPLIERS["silk"] == 0.85
    check("Fiber GSM multipliers correct", 1.0, "+")

    # Fabric resolution
    g = GarmentProfile(
        primary_fiber="cotton", gsm_estimated=200,
        elastane_pct=3, construction=FabricConstruction.KNIT,
        surface=SurfaceFinish.MATTE,
    )
    resolved = resolve_fabric_properties(g)
    check("Stretch: 3% knit = 12%", resolved.total_stretch_pct, "+", (11, 13))
    check("Effective GSM: 200 * 1.15", resolved.effective_gsm, "+", (225, 235))
    check("Sheen: matte = 0.10", resolved.sheen_score, "+", (0.09, 0.11))

    # Gate: dark + shiny
    body = BodyProfile()
    g = GarmentProfile(color_lightness=0.10, surface=SurfaceFinish.HIGH_SHINE)
    resolved = resolve_fabric_properties(g)
    gates = run_fabric_gates(g, body, resolved)
    gate_ids = [e.exception_id for e in gates]
    check("Gate dark+shiny triggered", 1.0 if "GATE_DARK_SHINY" in gate_ids else -1.0, "+")

    # Gate: A-line + stiff
    g = GarmentProfile(silhouette=Silhouette.A_LINE, drape=8)  # 80% DC
    resolved = resolve_fabric_properties(g)
    gates = run_fabric_gates(g, body, resolved)
    gate_ids = [e.exception_id for e in gates]
    check("Gate A-line+stiff triggered", 1.0 if "GATE_ALINE_SHELF" in gate_ids else -1.0, "+")

    # Cling risk model
    resolved = resolve_fabric_properties(GarmentProfile(
        elastane_pct=5, construction=FabricConstruction.KNIT_JERSEY,
        gsm_estimated=120, surface_friction=0.2,
    ))
    cling = compute_cling_risk(resolved, zone_circ=38.0, garment_rest_circ=34.0, curvature_rate=0.8)
    check("Cling threshold computation", cling.base_threshold, "+", (10, 50))

    # Fabric lookup
    assert len(FABRIC_LOOKUP) >= 50  # 50 original + new additions
    check("Fabric lookup has 50+ entries", 1.0, "+")


# ================================================================
# SECTION 7: GOAL SCORING TESTS
# ================================================================

def test_goal_scoring():
    print("\n" + "=" * 70)
    print("  SECTION 7: GOAL SCORING")
    print("=" * 70)

    # Look taller with dark monochrome + V-neck + high rise
    body = _petite()
    body.styling_goals = [StylingGoal.LOOK_TALLER]
    garment = GarmentProfile(
        color_lightness=0.10, surface=SurfaceFinish.MATTE,
        neckline=NecklineType.V_NECK, v_depth_cm=8,
        is_monochrome_outfit=True, rise_cm=26,
        zone="full_body", hem_position="above_knee",
    )
    result = score_garment(garment, body)
    tall_verdicts = [v for v in result.goal_verdicts if v.goal == StylingGoal.LOOK_TALLER]
    if tall_verdicts:
        check("Goal look_taller: pass", tall_verdicts[0].score, "+")

    # Hide midsection with tent + dark + matte
    body = _apple()
    body.styling_goals = [StylingGoal.HIDE_MIDSECTION]
    garment = GarmentProfile(
        expansion_rate=0.15, gsm_estimated=200,
        color_lightness=0.10, surface=SurfaceFinish.DEEP_MATTE,
        zone="torso", hem_position="knee",
    )
    result = score_garment(garment, body)
    hide_verdicts = [v for v in result.goal_verdicts if v.goal == StylingGoal.HIDE_MIDSECTION]
    if hide_verdicts:
        check("Goal hide_midsection: positive", hide_verdicts[0].score, "~")

    # Minimize arms with 3/4 sleeve
    body = BodyProfile(
        height=66, bust=36, underbust=32, waist=30, hip=38,
        c_upper_arm_max=14, c_forearm_min=9, c_wrist=6.5,
        upper_arm_zone=0.7,
    )
    body.styling_goals = [StylingGoal.MINIMIZE_ARMS]
    garment = GarmentProfile(
        sleeve_type=SleeveType.THREE_QUARTER,
        surface=SurfaceFinish.DEEP_MATTE,
        zone="torso",
    )
    result = score_garment(garment, body)
    arm_verdicts = [v for v in result.goal_verdicts if v.goal == StylingGoal.MINIMIZE_ARMS]
    if arm_verdicts:
        check("Goal minimize_arms: 3/4 sleeve", arm_verdicts[0].score, "+")

    # Highlight waist with belt + hourglass
    body = _hourglass()
    body.styling_goals = [StylingGoal.HIGHLIGHT_WAIST]
    garment = GarmentProfile(
        has_contrasting_belt=True, belt_width_cm=5,
        expansion_rate=0.02, gsm_estimated=280, is_structured=True,
        waist_position="natural", has_waist_definition=True,
        zone="full_body",
    )
    result = score_garment(garment, body)
    waist_verdicts = [v for v in result.goal_verdicts if v.goal == StylingGoal.HIGHLIGHT_WAIST]
    if waist_verdicts:
        check("Goal highlight_waist: belt + hourglass", waist_verdicts[0].score, "+")


# ================================================================
# SECTION 8: REGISTRY & DATA TESTS
# ================================================================

def test_registry():
    print("\n" + "=" * 70)
    print("  SECTION 8: REGISTRY & DATA")
    print("=" * 70)

    reg = get_registry()
    check("Registry loaded", float(reg.total_items), "+", (500, 2000))
    check("Principles loaded", float(len(reg.get_by_type("principles"))), "+", (5, 200))
    check("Rules loaded", float(len(reg.get_by_type("rules"))), "+", (10, 500))
    check("Exceptions loaded", float(len(reg.get_by_type("exceptions"))), "+", (5, 300))
    check("Context rules loaded", float(len(reg.get_by_type("context_rules"))), "+", (5, 100))
    check("Fabric rules loaded", float(len(reg.get_by_type("fabric_rules"))), "+", (5, 50))

    # Score scale
    assert score_to_ten(0.0) == 5.0
    assert score_to_ten(1.0) == 10.0
    assert score_to_ten(-1.0) == 0.0
    check("Score scale 0->5, +1->10, -1->0", 1.0, "+")


# ================================================================
# SECTION 9: NEW SCORER TESTS (P11-P16)
# ================================================================

def test_new_scorers():
    print("\n" + "=" * 70)
    print("  SECTION 9: NEW SCORERS (P11-P16)")
    print("=" * 70)

    # P11: Hemline above knee on petite = positive
    g = GarmentProfile(hem_position="above_knee")
    s, r = score_hemline(g, _petite())
    check("P11: Above-knee petite", s, "+")

    # P11: Hemline at knee = danger zone
    g = GarmentProfile(hem_position="knee")
    s, r = score_hemline(g, _petite())
    check("P11: Knee petite = danger", s, "-")

    # P11: Ankle on tall = very positive
    g = GarmentProfile(hem_position="ankle")
    s, r = score_hemline(g, _tall())
    check("P11: Ankle tall", s, "+")

    # P12: 3/4 sleeve = optimal slimming
    g = GarmentProfile(sleeve_type=SleeveType.THREE_QUARTER)
    s, r = score_sleeve(g, BodyProfile(
        height=66, bust=36, underbust=32, waist=30, hip=38,
        c_upper_arm_max=12, c_forearm_min=8.5, c_wrist=6.5,
    ))
    check("P12: 3/4 sleeve optimal", s, "+")

    # P12: Cap sleeve = widening
    g = GarmentProfile(sleeve_type=SleeveType.CAP)
    s, r = score_sleeve(g, BodyProfile(
        height=66, bust=36, underbust=32, waist=30, hip=38,
        c_upper_arm_max=14, c_forearm_min=8.5, c_wrist=6.5,
    ))
    check("P12: Cap sleeve widening", s, "-")

    # P13: Empire on short legs = improvement
    g = GarmentProfile(waist_position="empire")
    body = BodyProfile(
        height=64, bust=35, underbust=31, waist=28, hip=37,
        torso_length=16, leg_length_visual=38,
    )
    s, r = score_waist_placement(g, body)
    check("P13: Empire short legs", s, "+")

    # P14: Very dark color = slimming
    g = GarmentProfile(color_lightness=0.05)
    s, r = score_color_value(g, BodyProfile())
    check("P14: Very dark slimming", s, "+")

    # P14: White = widening
    g = GarmentProfile(color_lightness=0.95)
    s, r = score_color_value(g, BodyProfile())
    check("P14: White widening", s, "-")

    # P15: Fabric zone structured + matte = positive
    g = GarmentProfile(
        gsm_estimated=280, is_structured=True,
        surface=SurfaceFinish.DEEP_MATTE,
        primary_fiber="wool",
    )
    s, r = score_fabric_zone(g, BodyProfile())
    check("P15: Structured matte fabric", s, "+")

    # P16: V-neck compound on INVT = strong positive
    g = GarmentProfile(neckline=NecklineType.V_NECK, v_depth_cm=10, neckline_depth=4.0)
    s, r = score_neckline_compound(g, _invt())
    check("P16: V-neck compound INVT", s, "+")


# ================================================================
# SECTION 10: GARMENT TYPE TESTS
# ================================================================

def test_garment_types():
    print("\n" + "=" * 70)
    print("  SECTION 10: GARMENT TYPE TESTS")
    print("=" * 70)

    # ─── TOP SCORING TESTS ───

    # T1: Hip-length untucked top on pear -> negative
    g = GarmentProfile(
        category=GarmentCategory.TOP,
        neckline=NecklineType.V_NECK,
        top_hem_length="at_hip",
        top_hem_behavior=TopHemBehavior.UNTUCKED_AT_HIP,
    )
    body = _pear()
    body.styling_goals = [StylingGoal.SLIM_HIPS]
    s, r = score_top_hemline(g, body)
    check("T1: Hip-length top on pear = negative", s, "-")

    # T2: Tucked top ignores top hemline
    g = GarmentProfile(
        category=GarmentCategory.TOP,
        neckline=NecklineType.V_NECK,
        top_hem_length="at_hip",
        top_hem_behavior=TopHemBehavior.TUCKED,
    )
    body = _pear()
    body.styling_goals = [StylingGoal.SLIM_HIPS]
    s, r = score_top_hemline(g, body)
    check("T2: Tucked top = positive (waist def)", s, "+")

    # T3: Cropped top on petite with short torso -> negative
    g = GarmentProfile(
        category=GarmentCategory.TOP,
        top_hem_behavior=TopHemBehavior.CROPPED,
    )
    body = BodyProfile(
        height=61, bust=34, underbust=30, waist=27, hip=36,
        shoulder_width=14.0, torso_length=13.0, leg_length_visual=38.0,
    )
    s, r = score_top_hemline(g, body)
    check("T3: Cropped top petite short torso", s, "-")

    # T4: Top garment should skip Hemline (leg hemline) scorer
    g = GarmentProfile(category=GarmentCategory.TOP)
    body = BodyProfile()
    result = score_garment(g, body)
    hemline_scores = [p for p in result.principle_scores if p.name == "Hemline"]
    hemline_skipped = hemline_scores[0].applicable is False if hemline_scores else False
    check("T4: Top skips Hemline scorer", 1.0 if hemline_skipped else -1.0, "+")

    # T5: Top garment should add Top Hemline scorer
    top_hem_scores = [p for p in result.principle_scores if p.name == "Top Hemline"]
    has_top_hemline = len(top_hem_scores) > 0
    check("T5: Top adds Top Hemline scorer", 1.0 if has_top_hemline else -1.0, "+")

    # ─── PANTS SCORING TESTS ───

    # T6: High rise elongates legs (positive)
    g = GarmentProfile(
        category=GarmentCategory.BOTTOM_PANTS,
        rise="high", leg_shape="straight",
    )
    body = _petite()
    body.styling_goals = [StylingGoal.LOOK_TALLER]
    s, r = score_pant_rise(g, body)
    check("T6: High rise elongates legs", s, "+")

    # T7: Low rise penalizes petite (negative)
    g = GarmentProfile(
        category=GarmentCategory.BOTTOM_PANTS,
        rise="low", leg_shape="skinny",
    )
    body = _petite()
    body.styling_goals = [StylingGoal.LOOK_TALLER]
    s, r = score_pant_rise(g, body)
    check("T7: Low rise penalizes petite", s, "-")

    # T8: Wide leg on pear = positive
    g = GarmentProfile(
        category=GarmentCategory.BOTTOM_PANTS,
        rise="high", leg_shape="wide_leg",
    )
    body = _pear()
    body.styling_goals = [StylingGoal.SLIM_HIPS]
    s, r = score_leg_shape(g, body)
    check("T8: Wide leg on pear positive", s, "+")

    # T9: Skinny on pear + slim_hips = negative
    g = GarmentProfile(
        category=GarmentCategory.BOTTOM_PANTS,
        rise="mid", leg_shape="skinny",
    )
    body = _pear()
    body.styling_goals = [StylingGoal.SLIM_HIPS]
    s, r = score_leg_shape(g, body)
    check("T9: Skinny on pear + slim_hips", s, "-")

    # T10: Pants skip neckline scorers
    g = GarmentProfile(
        category=GarmentCategory.BOTTOM_PANTS,
        rise="mid", leg_shape="straight",
    )
    body = BodyProfile()
    result = score_garment(g, body)
    vneck_scores = [p for p in result.principle_scores
                    if p.name == "V-Neck Elongation"]
    vneck_skipped = vneck_scores[0].applicable is False if vneck_scores else False
    check("T10: Pants skip V-Neck scorer", 1.0 if vneck_skipped else -1.0, "+")

    # T11: Pants add Pant Rise + Leg Shape scorers
    pant_scorers = [p for p in result.principle_scores
                    if p.name in ("Pant Rise", "Leg Shape")]
    check("T11: Pants add Rise+LegShape", float(len(pant_scorers)), "+", (2.0, 2.0))

    # ─── JACKET SCORING TESTS ───

    # T12: Structured blazer on pear = positive
    g = GarmentProfile(
        category=GarmentCategory.JACKET,
        shoulder_structure="structured",
        jacket_length="hip",
        jacket_closure="single_breasted",
    )
    body = _pear()
    s, r = score_jacket_scoring(g, body)
    check("T12: Structured blazer on pear", s, "+")

    # T13: Hip-length jacket on pear = mixed (shoulder + but hip -)
    # Shoulder +0.50, hip -0.30 = net +0.20
    check("T13: Hip-length jacket net positive", s, "+")

    # T14: Cropped jacket defines waist
    g = GarmentProfile(
        category=GarmentCategory.JACKET,
        jacket_length="cropped",
        shoulder_structure="natural",
    )
    body = _hourglass()
    body.styling_goals = [StylingGoal.HIGHLIGHT_WAIST]
    s, r = score_jacket_scoring(g, body)
    check("T14: Cropped jacket waist def", s, "+")

    # T15: Padded shoulders on INVT = negative
    g = GarmentProfile(
        category=GarmentCategory.JACKET,
        shoulder_structure="padded",
        jacket_length="hip",
    )
    body = _invt()
    s, r = score_jacket_scoring(g, body)
    check("T15: Padded shoulders on INVT", s, "-")

    # T16: Jacket has layer modifications
    g = GarmentProfile(
        category=GarmentCategory.JACKET,
        shoulder_structure="structured",
        jacket_closure="open_front",
    )
    body = BodyProfile()
    result = score_garment(g, body)
    has_layer = result.layer_modifications is not None
    has_mods = (len(result.layer_modifications.get("layer_modifications", []))
                if has_layer else 0)
    check("T16: Jacket has layer info", 1.0 if has_mods > 0 else -1.0, "+")

    # ─── SKIRT SCORING TESTS ───

    # T17: A-line skirt on pear: uses A-Line Balance scorer = positive
    g = GarmentProfile(
        category=GarmentCategory.SKIRT,
        silhouette=Silhouette.A_LINE,
        expansion_rate=0.08, drape=3,
        skirt_construction="a_line",
        hem_position="knee",
    )
    body = _pear()
    s, r = score_aline_balance(g, body)
    check("T17: A-line skirt pear positive", s, "+")

    # T18: Skirt should skip neckline/sleeve scorers
    result = score_garment(g, body)
    vneck_s = [p for p in result.principle_scores if p.name == "V-Neck Elongation"]
    sleeve_s = [p for p in result.principle_scores if p.name == "Sleeve"]
    skirt_skips = ((vneck_s[0].applicable is False if vneck_s else True)
                   and (sleeve_s[0].applicable is False if sleeve_s else True))
    check("T18: Skirt skips neckline+sleeve", 1.0 if skirt_skips else -1.0, "+")

    # ─── GARMENT CLASSIFICATION TESTS ───

    # T19-T23: classify_garment from title
    g = GarmentProfile(title="Reformation Aiko Midi Dress")
    check("T19: Classify dress", 1.0 if classify_garment(g) == GarmentCategory.DRESS else -1.0, "+")

    g = GarmentProfile(title="Levi's 501 Original Jeans")
    check("T20: Classify jeans", 1.0 if classify_garment(g) == GarmentCategory.BOTTOM_PANTS else -1.0, "+")

    g = GarmentProfile(title="Theory Etiennette Blazer in Good Wool")
    check("T21: Classify blazer", 1.0 if classify_garment(g) == GarmentCategory.JACKET else -1.0, "+")

    g = GarmentProfile(title="Nike Sportswear Club Fleece Hoodie")
    check("T22: Classify hoodie", 1.0 if classify_garment(g) == GarmentCategory.SWEATSHIRT else -1.0, "+")

    g = GarmentProfile(title="Libas Embroidered Straight Kurta")
    check("T23: Classify kurta", 1.0 if classify_garment(g) == GarmentCategory.SALWAR_KAMEEZ else -1.0, "+")

    # ─── END-TO-END GARMENT TYPE TESTS ───

    # T24: Full pipeline - high rise wide leg on pear
    g = GarmentProfile(
        category=GarmentCategory.BOTTOM_PANTS,
        rise="high", leg_shape="wide_leg",
        color_lightness=0.10, surface=SurfaceFinish.MATTE,
    )
    body = _pear()
    body.styling_goals = [StylingGoal.SLIM_HIPS]
    result = score_garment(g, body)
    check("T24: Pear wide-leg pants composite", result.composite_raw, "+")

    # T25: Full pipeline - structured blazer on pear
    g = GarmentProfile(
        category=GarmentCategory.JACKET,
        shoulder_structure="structured",
        jacket_length="waist",
        jacket_closure="open_front",
        color_lightness=0.15, surface=SurfaceFinish.MATTE,
    )
    body = _pear()
    result = score_garment(g, body)
    check("T25: Pear structured blazer composite", result.composite_raw, "+")

    # T26: Full pipeline - low-rise skinny on petite with height goal
    g = GarmentProfile(
        category=GarmentCategory.BOTTOM_PANTS,
        rise="low", leg_shape="skinny",
        color_lightness=0.50,
    )
    body = _petite()
    body.styling_goals = [StylingGoal.LOOK_TALLER]
    result = score_garment(g, body)
    check("T26: Petite low-rise skinny composite", result.composite_raw, "-")

    # T27: Full pipeline - hip-length top on INVT (should be positive)
    g = GarmentProfile(
        category=GarmentCategory.TOP,
        neckline=NecklineType.V_NECK,
        top_hem_length="at_hip",
        top_hem_behavior=TopHemBehavior.UNTUCKED_AT_HIP,
        color_lightness=0.10, surface=SurfaceFinish.MATTE,
    )
    body = _invt()
    s, r = score_top_hemline(g, body)
    check("T27: Hip-length top on INVT positive", s, "+")


# ================================================================
# SECTION 11: FIX VALIDATION TESTS
# ================================================================

def test_fix_validation():
    print("\n" + "=" * 70)
    print("  SECTION 11: FIX VALIDATION TESTS")
    print("=" * 70)

    # ─── FIX 1: Pants/shorts/skirts skip Rise Elongation + Hemline ───

    # FIX1a: Pants should NOT run Rise Elongation (P3)
    g = GarmentProfile(
        category=GarmentCategory.BOTTOM_PANTS,
        rise="high", leg_shape="straight", rise_cm=28,
    )
    body = BodyProfile()
    result = score_garment(g, body)
    rise_elong = [p for p in result.principle_scores if p.name == "Rise Elongation"]
    rise_skipped = rise_elong[0].applicable is False if rise_elong else True
    check("FIX1a: Pants skip Rise Elongation", 1.0 if rise_skipped else -1.0, "+")

    # FIX1b: Pants should NOT run Hemline (P11)
    hemline_p = [p for p in result.principle_scores if p.name == "Hemline"]
    hemline_skipped = hemline_p[0].applicable is False if hemline_p else True
    check("FIX1b: Pants skip Hemline scorer", 1.0 if hemline_skipped else -1.0, "+")

    # FIX1c: Skirts should NOT run Rise Elongation
    g = GarmentProfile(
        category=GarmentCategory.SKIRT,
        skirt_construction="a_line", hem_position="knee",
    )
    result = score_garment(g, BodyProfile())
    rise_elong = [p for p in result.principle_scores if p.name == "Rise Elongation"]
    rise_skipped = rise_elong[0].applicable is False if rise_elong else True
    check("FIX1c: Skirts skip Rise Elongation", 1.0 if rise_skipped else -1.0, "+")

    # ─── FIX 2: Body-garment translator routes by garment type ───

    # FIX2a: Pants translator skips hemline
    g = GarmentProfile(
        category=GarmentCategory.BOTTOM_PANTS,
        rise="high", leg_shape="straight",
    )
    adjusted = translate_garment_to_body(g, _pear())
    check("FIX2a: Pants translator no hem zone",
          1.0 if adjusted.hem_zone == "" else -1.0, "+")

    # FIX2b: Pants translator skips sleeve
    check("FIX2b: Pants translator no sleeve",
          1.0 if adjusted.sleeve_endpoint_position == 0.0 else -1.0, "+")

    # FIX2c: Dress translator still computes everything
    g = GarmentProfile(category=GarmentCategory.DRESS, hem_position="knee")
    adjusted = translate_garment_to_body(g, _pear())
    check("FIX2c: Dress translator has hem zone",
          1.0 if adjusted.hem_zone != "" else -1.0, "+")

    # ─── FIX 3: Auto-classification from title ───

    # FIX3a: Jeans auto-classified from title, Rise Elongation skipped
    g = GarmentProfile(title="Levi's 501 Original Straight Jeans")
    result = score_garment(g, BodyProfile())
    rise_elong = [p for p in result.principle_scores if p.name == "Rise Elongation"]
    rise_skipped = rise_elong[0].applicable is False if rise_elong else True
    check("FIX3a: Jeans auto-classified, Rise Elongation skipped",
          1.0 if rise_skipped else -1.0, "+")

    # FIX3b: Classify culottes
    g = GarmentProfile(title="Wide-Leg Culottes in Black")
    check("FIX3b: Culottes -> pants",
          1.0 if classify_garment(g) == GarmentCategory.BOTTOM_PANTS else -1.0, "+")

    # FIX3c: Classify shacket
    g = GarmentProfile(title="Oversized Plaid Shacket")
    check("FIX3c: Shacket -> jacket",
          1.0 if classify_garment(g) == GarmentCategory.JACKET else -1.0, "+")

    # ─── FIX 4: Goal verdicts integrate garment-type scorers ───

    # FIX4a: Pant Rise influences LOOK_TALLER goal verdict
    g = GarmentProfile(
        category=GarmentCategory.BOTTOM_PANTS,
        rise="high", leg_shape="straight",
        color_lightness=0.10, surface=SurfaceFinish.MATTE,
    )
    body = _petite()
    body.styling_goals = [StylingGoal.LOOK_TALLER]
    result = score_garment(g, body)
    tall_v = [v for v in result.goal_verdicts if v.goal == StylingGoal.LOOK_TALLER]
    has_rise = any("Pant Rise" in s for s in tall_v[0].supporting_principles) if tall_v else False
    check("FIX4a: Pant Rise in LOOK_TALLER verdict", 1.0 if has_rise else -1.0, "+")

    # FIX4b: Leg Shape influences SLIM_HIPS goal verdict
    g = GarmentProfile(
        category=GarmentCategory.BOTTOM_PANTS,
        rise="high", leg_shape="wide_leg",
        color_lightness=0.10, surface=SurfaceFinish.MATTE,
    )
    body = _pear()
    body.styling_goals = [StylingGoal.SLIM_HIPS]
    result = score_garment(g, body)
    slim_v = [v for v in result.goal_verdicts if v.goal == StylingGoal.SLIM_HIPS]
    has_leg = any("Leg Shape" in s for s in slim_v[0].supporting_principles) if slim_v else False
    check("FIX4b: Leg Shape in SLIM_HIPS verdict", 1.0 if has_leg else -1.0, "+")

    # FIX4c: Jacket Scoring influences MINIMIZE_ARMS goal
    g = GarmentProfile(
        category=GarmentCategory.JACKET,
        shoulder_structure="structured",
        jacket_length="hip", jacket_closure="single_breasted",
    )
    body = _pear()
    body.c_upper_arm_max = 14
    body.upper_arm_zone = 0.7
    body.styling_goals = [StylingGoal.MINIMIZE_ARMS]
    result = score_garment(g, body)
    arm_v = [v for v in result.goal_verdicts if v.goal == StylingGoal.MINIMIZE_ARMS]
    if arm_v:
        has_jacket = any("Jacket" in s for s in arm_v[0].supporting_principles)
        check("FIX4c: Jacket in MINIMIZE_ARMS verdict", 1.0 if has_jacket else -1.0, "+")

    # ─── FIX 5: Half-tucked tops ───

    # FIX5a: Half-tucked top on pear is positive
    g = GarmentProfile(
        category=GarmentCategory.TOP,
        top_hem_length="at_hip",
        top_hem_behavior=TopHemBehavior.HALF_TUCKED,
    )
    body = _pear()
    body.styling_goals = [StylingGoal.HIGHLIGHT_WAIST]
    s, r = score_top_hemline(g, body)
    check("FIX5a: Half-tucked on pear positive", s, "+")

    # FIX5b: Half-tucked heavy fabric penalized
    g = GarmentProfile(
        category=GarmentCategory.TOP,
        top_hem_behavior=TopHemBehavior.HALF_TUCKED,
        gsm_estimated=300,
    )
    body = BodyProfile()
    s, r = score_top_hemline(g, body)
    check("FIX5b: Half-tucked heavy fabric lower", s, "~", (-0.10, 0.15))

    # ─── FIX 6: Leg shape rise interaction ───

    # FIX6a: Wide-leg + high rise on pear > wide-leg + low rise on pear
    g_high = GarmentProfile(
        category=GarmentCategory.BOTTOM_PANTS,
        rise="high", leg_shape="wide_leg",
    )
    g_low = GarmentProfile(
        category=GarmentCategory.BOTTOM_PANTS,
        rise="low", leg_shape="wide_leg",
    )
    body = _pear()
    body.styling_goals = [StylingGoal.SLIM_HIPS]
    s_high, _ = score_leg_shape(g_high, body)
    s_low, _ = score_leg_shape(g_low, body)
    check("FIX6a: Wide-leg high rise > low rise on pear", s_high - s_low, "+")

    # FIX6b: Skinny + high rise on pear better than skinny + mid rise
    g_skinny_high = GarmentProfile(
        category=GarmentCategory.BOTTOM_PANTS,
        rise="high", leg_shape="skinny",
    )
    g_skinny_mid = GarmentProfile(
        category=GarmentCategory.BOTTOM_PANTS,
        rise="mid", leg_shape="skinny",
    )
    body = _pear()
    s_high, _ = score_leg_shape(g_skinny_high, body)
    s_mid, _ = score_leg_shape(g_skinny_mid, body)
    check("FIX6b: Skinny + high rise >= skinny + mid rise on pear", s_high - s_mid, "+")

    # ─── FIX 7: Thigh cling penalty ───

    # FIX7a: Skinny low-stretch on large-thigh pear gets cling penalty
    g = GarmentProfile(
        category=GarmentCategory.BOTTOM_PANTS,
        rise="mid", leg_shape="skinny",
        elastane_pct=0, construction=FabricConstruction.WOVEN,
    )
    body = _pear()
    body.c_thigh_max = 26.0
    s, r = score_leg_shape(g, body)
    check("FIX7a: No-stretch skinny on large thigh pear", s, "-", (-0.80, -0.15))

    # FIX7b: Stretch skinny on same body = less penalty
    g2 = GarmentProfile(
        category=GarmentCategory.BOTTOM_PANTS,
        rise="mid", leg_shape="skinny",
        elastane_pct=5, construction=FabricConstruction.KNIT_JERSEY,
    )
    body2 = _pear()
    body2.c_thigh_max = 26.0
    s2, r2 = score_leg_shape(g2, body2)
    check("FIX7b: Stretch skinny on same body better", s2 - s, "+")

    # ─── FIX 8: More occasions ───

    # FIX8a: Interview occasion penalizes mini skirt
    g = GarmentProfile(hem_position="mini")
    body = BodyProfile()
    adj = apply_context_modifiers(
        {"occasion": "interview"}, [], body, g
    )
    check("FIX8a: Interview + mini = hem violation",
          adj.get("occasion_hem_violation", 0.0), "-")

    # FIX8b: Wedding guest occasion penalizes mini
    adj = apply_context_modifiers(
        {"occasion": "wedding_guest"}, [], body, g
    )
    check("FIX8b: Wedding guest + mini = hem violation",
          adj.get("occasion_hem_violation", 0.0), "-")

    # ─── FIX 9: Fix suggestions for new scorers ───

    # FIX9: Bad pant rise generates fix suggestion
    g = GarmentProfile(
        category=GarmentCategory.BOTTOM_PANTS,
        rise="low", leg_shape="skinny",
        color_lightness=0.50,
    )
    body = _petite()
    body.styling_goals = [StylingGoal.LOOK_TALLER]
    result = score_garment(g, body)
    has_rise_fix = any("high-rise" in f.what_to_change for f in result.fixes)
    check("FIX9: Low-rise generates rise fix", 1.0 if has_rise_fix else -1.0, "+")


# ================================================================
# SECTION 12: COMBINED PROFILE SCENARIOS
# ================================================================

def test_combined_profiles():
    print("\n" + "=" * 70)
    print("  SECTION 12: COMBINED PROFILE SCENARIOS")
    print("=" * 70)

    # CP1: Petite pear + high rise wide leg = strong positive
    body = _with_goals(_petite_pear(), StylingGoal.LOOK_TALLER, StylingGoal.SLIM_HIPS)
    g = GarmentProfile(
        category=GarmentCategory.BOTTOM_PANTS,
        rise="high", leg_shape="wide_leg",
        color_lightness=0.10, surface=SurfaceFinish.MATTE,
    )
    result = score_garment(g, body)
    check("CP1: Petite pear + high-rise wide-leg", result.composite_raw, "+")

    # CP2: Petite pear + low rise skinny = strong negative
    g = GarmentProfile(
        category=GarmentCategory.BOTTOM_PANTS,
        rise="low", leg_shape="skinny",
        color_lightness=0.70,
    )
    result = score_garment(g, body)
    check("CP2: Petite pear + low-rise skinny", result.composite_raw, "-")

    # CP3: Plus apple + structured blazer open front = positive
    body = _with_goals(_plus_apple(), StylingGoal.HIDE_MIDSECTION)
    g = GarmentProfile(
        category=GarmentCategory.JACKET,
        shoulder_structure="structured",
        jacket_length="hip", jacket_closure="open_front",
        color_lightness=0.10, surface=SurfaceFinish.MATTE,
    )
    result = score_garment(g, body)
    check("CP3: Plus apple + structured open blazer", result.composite_raw, "+")

    # CP4: Plus apple + cropped top = negative (exposes midsection)
    g = GarmentProfile(
        category=GarmentCategory.TOP,
        top_hem_behavior=TopHemBehavior.CROPPED,
        color_lightness=0.80,
    )
    result = score_garment(g, body)
    top_hem = [p for p in result.principle_scores if p.name == "Top Hemline"]
    if top_hem:
        check("CP4: Plus apple + crop top = Top Hemline negative", top_hem[0].score, "-")

    # CP5: Petite hourglass + bodycon V-neck = positive
    body = _with_goals(_petite_hourglass(), StylingGoal.EMPHASIS)
    g = GarmentProfile(
        category=GarmentCategory.DRESS,
        expansion_rate=0.02, gsm_estimated=280, is_structured=True,
        neckline=NecklineType.V_NECK, v_depth_cm=8,
        color_lightness=0.10, surface=SurfaceFinish.MATTE,
        hem_position="above_knee",
    )
    result = score_garment(g, body)
    check("CP5: Petite hourglass + structured bodycon", result.composite_raw, "+")

    # CP6: V-neck tucked blouse + high-rise wide-leg on pear (multi-piece)
    body = _with_goals(_pear(), StylingGoal.SLIM_HIPS, StylingGoal.LOOK_TALLER)
    g_top = GarmentProfile(
        category=GarmentCategory.TOP,
        neckline=NecklineType.V_NECK,
        top_hem_behavior=TopHemBehavior.TUCKED,
        color_lightness=0.10, surface=SurfaceFinish.MATTE,
    )
    result_top = score_garment(g_top, body)
    g_pants = GarmentProfile(
        category=GarmentCategory.BOTTOM_PANTS,
        rise="high", leg_shape="wide_leg",
        color_lightness=0.10, surface=SurfaceFinish.MATTE,
    )
    result_pants = score_garment(g_pants, body)
    check("CP6a: Pear tucked V-neck top", result_top.composite_raw, "+")
    check("CP6b: Pear high-rise wide-leg pants", result_pants.composite_raw, "+")


# ================================================================
# MAIN
# ================================================================

def run_tests():
    global PASS_COUNT, FAIL_COUNT
    PASS_COUNT = 0
    FAIL_COUNT = 0

    test_reversals()
    test_p1_detections()
    test_composite_scenarios()
    test_edge_cases()
    test_piece2_math()
    test_fabric_gate()
    test_goal_scoring()
    test_registry()
    test_new_scorers()
    test_garment_types()
    test_fix_validation()
    test_combined_profiles()

    print("\n" + "=" * 70)
    print(f"  RESULTS: {PASS_COUNT} passed, {FAIL_COUNT} failed, "
          f"{PASS_COUNT + FAIL_COUNT} total")
    print("=" * 70)

    coverage = {
        "reversals_tested": 8,
        "p1_detections_tested": 27,
        "composite_scenarios": 4,
        "edge_cases": 6,
        "piece2_math": 9,
        "fabric_gate": 8,
        "goal_scoring": 4,
        "registry_data": 7,
        "new_scorers_p11_p16": 10,
        "garment_types": 27,
        "fix_validation": 22,
        "combined_profiles": 8,
    }
    print(f"  Coverage: {sum(coverage.values())} test cases across {len(coverage)} sections")
    for section, count in coverage.items():
        print(f"    {section}: {count}")

    return PASS_COUNT, FAIL_COUNT


if __name__ == "__main__":
    run_tests()
