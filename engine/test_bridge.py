"""
Kridha Bridge — Test Suite
============================
Tests the schema bridge that converts Node.js pipeline output
into Python engine BodyProfile and GarmentProfile dataclasses.
"""

import sys
import os
import math
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from engine.bridge import (
    build_body_profile,
    build_garment_profile,
    estimate_brand_tier,
    CM_TO_IN,
)
from engine.schemas import (
    BodyProfile, GarmentProfile, ScoreResult,
    BodyShape, StylingGoal,
    FabricConstruction, SurfaceFinish, Silhouette,
    SleeveType, NecklineType, GarmentCategory,
    BrandTier, GarmentLayer,
)
from engine.kridha_engine import score_garment


# ================================================================
# TEST HELPERS
# ================================================================

PASS_COUNT = 0
FAIL_COUNT = 0


def check(name, actual, expected, tolerance=None):
    """Assert actual == expected (or within tolerance for floats)."""
    global PASS_COUNT, FAIL_COUNT

    if tolerance is not None:
        ok = abs(actual - expected) <= tolerance
    elif isinstance(expected, float):
        ok = abs(actual - expected) < 0.01
    else:
        ok = actual == expected

    if ok:
        PASS_COUNT += 1
        print(f"  [OK] {name}: {actual}")
    else:
        FAIL_COUNT += 1
        print(f"  [FAIL] {name}: got {actual!r}, expected {expected!r}")


# ================================================================
# SAMPLE DATA (exact values from run_pipeline.mjs)
# ================================================================

SAMPLE_USER_MEASUREMENTS = {
    "chest_circumference": 112.7,
    "waist_circumference": 102.76,
    "hip_circumference": 107.5,
    "shoulder_breadth": 42.3164,
    "neck_circumference": 44.97,
    "thigh_left_circumference": 67.01,
    "ankle_left_circumference": 28.64,
    "arm_right_length": 75.9968,
    "inside_leg_height": 77.66,
    "height": 172.72,
    # Derived by calc_derived_measurements_and_ratios (already inches)
    "waist_hip_ratio": 0.96,
    "bust_hip_ratio": 1.05,
    "shoulder_hip_ratio": 1.24,
    "torso_leg_ratio": 0.93,
    "body_shape": "apple",
    "height_category": "tall",
    "size_category": "plus_size",
    "compound_types": ["apple", "tall", "plus_size"],
    "knee_from_floor": 14.37,
    "mid_calf_from_floor": 9.63,
    "widest_calf_from_floor": 10.78,
    "ankle_from_floor": 3.5,
    "mid_thigh_from_floor": 22.01,
    "elbow_from_shoulder": 17.05,
    "widest_upper_arm_from_shoulder": 9.87,
    "natural_waist_from_shoulder": 28.43,
    "natural_waist_from_floor": 39.57,
}

SAMPLE_MERGED_ATTRS = {
    "neckline_type": "boat_neck",
    "neckline_depth": "shallow",
    "neckline_width": "medium",
    "sleeve_type": "short",
    "sleeve_width": "relaxed",
    "silhouette_type": "a_line",
    "waistline": "natural",
    "waist_definition": "undefined",
    "fit_category": "relaxed",
    "color_primary": "light green",
    "color_value": "medium_light",
    "color_temperature": "cool",
    "color_saturation": "moderate",
    "pattern_type": "floral_small",
    "pattern_scale": "small",
    "pattern_contrast": "medium",
    "pattern_direction": "mixed",
    "fabric_sheen": "subtle_sheen",
    "fabric_opacity": "semi_opaque",
    "fabric_drape": "fluid",
    "fabric_texture": "smooth",
    "has_darts": None,
    "has_seaming": None,
    "has_ruching": None,
    "has_draping": None,
    "has_pleats": None,
    "has_gathering": None,
    "fabric_primary": "Rayon",
    "fabric_secondary": "Linen",
    "fabric_composition": "Shell:Rayon 70%, Linen 30%\nLining:Polyester 100%",
    "stretch_percentage": 0,
    "model_height_inches": 68.9,
    "model_size_worn": "S",
    "model_bust": 0,
    "model_waist": 0,
    "model_hips": 0,
    "hemline_position": "mini",
    "garment_length_inches": 0,
    "fabric_weight": "medium",
    "garment_type": "dress",
    "title": "H&M Puff-Sleeved Dress",
    "brand": "H&M",
    "price": "$29.99",
    "care_instructions": "Use a laundry bag\nOnly non-chlorine bleach when needed\nLine dry\nMedium iron\nMachine wash cold",
    "image_confidence": "high",
    "text_confidence": "high",
}


# ================================================================
# TEST 1: BODY PROFILE CONVERSION
# ================================================================

def test_body_profile_conversion():
    print("\n=== TEST 1: Body Profile Conversion ===")

    body = build_body_profile(SAMPLE_USER_MEASUREMENTS)

    # CM -> inches conversions
    check("height", body.height, 172.72 * CM_TO_IN, tolerance=0.01)
    check("bust", body.bust, 112.7 * CM_TO_IN, tolerance=0.01)
    check("waist", body.waist, 102.76 * CM_TO_IN, tolerance=0.01)
    check("hip", body.hip, 107.5 * CM_TO_IN, tolerance=0.01)
    check("shoulder_width", body.shoulder_width, 42.3164 * CM_TO_IN, tolerance=0.01)
    check("neck_circumference", body.neck_circumference, 44.97 * CM_TO_IN, tolerance=0.01)
    check("arm_length", body.arm_length, 75.9968 * CM_TO_IN, tolerance=0.01)
    check("inseam", body.inseam, 77.66 * CM_TO_IN, tolerance=0.01)
    check("c_thigh_max", body.c_thigh_max, 67.01 * CM_TO_IN, tolerance=0.01)
    check("c_ankle", body.c_ankle, 28.64 * CM_TO_IN, tolerance=0.01)

    # Already-in-inches landmarks pass through unchanged
    check("h_knee", body.h_knee, 14.37)
    check("h_calf_max (widest_calf)", body.h_calf_max, 10.78)
    check("h_calf_min (mid_calf)", body.h_calf_min, 9.63)
    check("h_ankle", body.h_ankle, 3.5)
    check("torso_length", body.torso_length, 28.43)
    check("leg_length_visual", body.leg_length_visual, 39.57)

    # Estimated fields
    check("underbust", body.underbust, body.bust - 4.0)
    check("c_upper_arm_max (plus_size)", body.c_upper_arm_max, 14.0)

    # Body shape classification (computed property)
    # With these measurements (bust=44.4, waist=40.5, hip=42.3),
    # bust-waist diff ~3.9, hip-waist diff ~1.8, WHR ~0.96 -> apple
    check("body_shape", body.body_shape, BodyShape.APPLE)

    # Height classification
    # Engine threshold is > 68.0" (5'8"), user is 67.99" — borderline, NOT tall per engine
    check("is_tall", body.is_tall, False)
    check("is_petite", body.is_petite, False)

    # Plus size check
    check("is_plus_size", body.is_plus_size, True)


# ================================================================
# TEST 2: GARMENT PROFILE CONVERSION
# ================================================================

def test_garment_profile_conversion():
    print("\n=== TEST 2: Garment Profile Conversion ===")

    garment = build_garment_profile(SAMPLE_MERGED_ATTRS)

    # Enum mappings
    check("category", garment.category, GarmentCategory.DRESS)
    check("neckline", garment.neckline, NecklineType.BOAT)
    check("silhouette", garment.silhouette, Silhouette.A_LINE)
    check("sleeve_type", garment.sleeve_type, SleeveType.SHORT)
    check("surface", garment.surface, SurfaceFinish.SUBTLE_SHEEN)

    # Numeric conversions
    check("color_lightness", garment.color_lightness, 0.65)
    check("color_saturation", garment.color_saturation, 0.50)
    check("color_temperature", garment.color_temperature, "cool")
    check("gsm_estimated", garment.gsm_estimated, 160)  # rayon + medium + fluid → RAY-002 (160 GSM)
    check("drape", garment.drape, 7.0)
    check("pattern_contrast", garment.pattern_contrast, 0.50)

    # Fit
    check("expansion_rate", garment.expansion_rate, 0.10)
    check("garment_ease_inches", garment.garment_ease_inches, 4.0)

    # Pattern
    check("has_pattern", garment.has_pattern, True)
    check("pattern_type", garment.pattern_type, "floral_small")
    check("has_horizontal_stripes", garment.has_horizontal_stripes, False)
    check("has_vertical_stripes", garment.has_vertical_stripes, False)
    check("pattern_scale", garment.pattern_scale, "small")

    # Waist
    check("waist_position", garment.waist_position, "natural")
    check("has_waist_definition", garment.has_waist_definition, False)

    # Hemline
    check("hem_position", garment.hem_position, "mini")

    # Fabric
    check("primary_fiber", garment.primary_fiber, "rayon")
    check("secondary_fiber", garment.secondary_fiber, "linen")
    check("elastane_pct", garment.elastane_pct, 0)
    check("construction", garment.construction, FabricConstruction.WOVEN)

    # Lining detection
    check("has_lining", garment.has_lining, True)

    # Construction
    check("is_structured", garment.is_structured, False)
    check("has_darts", garment.has_darts, False)

    # Brand
    check("brand_tier", garment.brand_tier, BrandTier.FAST_FASHION)
    check("model_estimated_size", garment.model_estimated_size, 4)

    # Zone
    check("zone", garment.zone, "full_body")
    check("garment_layer", garment.garment_layer, GarmentLayer.BASE)
    check("title", garment.title, "H&M Puff-Sleeved Dress")

    # V-depth from neckline_depth
    check("v_depth_cm (shallow)", garment.v_depth_cm, 3.0)


# ================================================================
# TEST 3: ALL 5 BODY SHAPES
# ================================================================

def test_all_body_shapes():
    print("\n=== TEST 3: All 5 Body Shapes ===")

    # Hourglass: bust-waist diff >= 7, hip-waist diff >= 7, balanced shoulders
    hourglass_data = {
        "chest_circumference": 96.52,   # 38"
        "waist_circumference": 68.58,   # 27"
        "hip_circumference": 99.06,     # 39"
        "shoulder_breadth": 35.56,      # 14"
        "height": 167.64,
        "inside_leg_height": 76.2,
        "arm_right_length": 58.42,
        "neck_circumference": 33.02,
        "thigh_left_circumference": 55.88,
        "ankle_left_circumference": 21.59,
    }
    body = build_body_profile(hourglass_data)
    check("hourglass shape", body.body_shape, BodyShape.HOURGLASS)

    # Pear: hip-waist diff dominant, narrow shoulders, bwd < 7
    pear_data = {
        "chest_circumference": 81.28,   # 32" (bwd=5, avoids hourglass)
        "waist_circumference": 68.58,   # 27"
        "hip_circumference": 101.6,     # 40" (hwd=13)
        "shoulder_breadth": 33.02,      # 13" (shr=1.02 < 1.05)
        "height": 160.02,
        "inside_leg_height": 73.66,
        "arm_right_length": 55.88,
        "neck_circumference": 30.48,
        "thigh_left_circumference": 60.96,
        "ankle_left_circumference": 21.59,
    }
    body = build_body_profile(pear_data)
    check("pear shape", body.body_shape, BodyShape.PEAR)

    # Apple: minimal diffs, WHR > 0.85
    apple_data = {
        "chest_circumference": 101.6,   # 40"
        "waist_circumference": 96.52,   # 38"
        "hip_circumference": 101.6,     # 40"
        "shoulder_breadth": 38.1,       # 15"
        "height": 167.64,
        "inside_leg_height": 76.2,
        "arm_right_length": 58.42,
        "neck_circumference": 35.56,
        "thigh_left_circumference": 58.42,
        "ankle_left_circumference": 22.86,
    }
    body = build_body_profile(apple_data)
    check("apple shape", body.body_shape, BodyShape.APPLE)

    # Inverted triangle: shoulders much wider than hips
    invt_data = {
        "chest_circumference": 99.06,   # 39"
        "waist_circumference": 81.28,   # 32"
        "hip_circumference": 88.9,      # 35"
        "shoulder_breadth": 45.72,      # 18"
        "height": 170.18,
        "inside_leg_height": 78.74,
        "arm_right_length": 60.96,
        "neck_circumference": 35.56,
        "thigh_left_circumference": 53.34,
        "ankle_left_circumference": 21.59,
    }
    body = build_body_profile(invt_data)
    check("inverted_triangle shape", body.body_shape, BodyShape.INVERTED_TRIANGLE)

    # Rectangle: close measurements, WHR <= 0.85, bwd >= 5, shoulder_hip_diff <= 3
    rect_data = {
        "chest_circumference": 88.9,    # 35" (bwd=5)
        "waist_circumference": 76.2,    # 30" (WHR=0.83, hwd=6)
        "hip_circumference": 91.44,     # 36"
        "shoulder_breadth": 34.29,      # 13.5" (shoulder_hip_diff=2.04)
        "height": 167.64,
        "inside_leg_height": 76.2,
        "arm_right_length": 58.42,
        "neck_circumference": 33.02,
        "thigh_left_circumference": 53.34,
        "ankle_left_circumference": 21.59,
    }
    body = build_body_profile(rect_data)
    check("rectangle shape", body.body_shape, BodyShape.RECTANGLE)


# ================================================================
# TEST 4: ALL GARMENT CATEGORIES
# ================================================================

def test_all_garment_categories():
    print("\n=== TEST 4: All Garment Categories ===")

    category_tests = {
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

    for garment_type, expected_cat in category_tests.items():
        g = build_garment_profile({"garment_type": garment_type})
        check(f"category:{garment_type}", g.category, expected_cat)


# ================================================================
# TEST 5: NULL HANDLING
# ================================================================

def test_null_handling():
    print("\n=== TEST 5: Null Handling ===")

    # Mostly-null garment attributes
    sparse_attrs = {
        "garment_type": "dress",
        "neckline_type": None,
        "silhouette_type": None,
        "sleeve_type": None,
        "fabric_sheen": None,
        "color_value": None,
        "fabric_weight": None,
        "fabric_drape": None,
        "fit_category": None,
        "hemline_position": None,
        "waistline": None,
        "waist_definition": None,
        "pattern_type": None,
        "fabric_primary": None,
        "fabric_composition": None,
        "has_darts": None,
        "has_seaming": None,
        "brand": None,
        "price": None,
    }

    garment = build_garment_profile(sparse_attrs)

    # Should use defaults
    check("null neckline -> CREW", garment.neckline, NecklineType.CREW)
    check("null silhouette -> SEMI_FITTED", garment.silhouette, Silhouette.SEMI_FITTED)
    check("null sleeve -> SET_IN", garment.sleeve_type, SleeveType.SET_IN)
    check("null surface -> MATTE", garment.surface, SurfaceFinish.MATTE)
    check("null color_lightness -> 0.50", garment.color_lightness, 0.50)
    check("null gsm -> 150", garment.gsm_estimated, 150)
    check("null drape -> 5.0", garment.drape, 5.0)
    check("null expansion_rate -> 0.05", garment.expansion_rate, 0.05)
    check("null hem -> knee", garment.hem_position, "knee")
    check("null waist_position -> natural", garment.waist_position, "natural")
    check("null has_pattern -> False", garment.has_pattern, False)
    check("null pattern_scale -> none", garment.pattern_scale, "none")
    check("null primary_fiber -> polyester", garment.primary_fiber, "polyester")
    check("null has_lining -> False", garment.has_lining, False)
    check("null brand_tier -> MID_MARKET", garment.brand_tier, BrandTier.MID_MARKET)

    # Mostly-null body
    sparse_body = {"height": 165.1}
    body = build_body_profile(sparse_body)
    check("sparse body height", body.height, 165.1 * CM_TO_IN, tolerance=0.01)
    check("sparse body uses defaults", body.h_knee, 18.0)


# ================================================================
# TEST 6: LINING DETECTION
# ================================================================

def test_lining_detection():
    print("\n=== TEST 6: Lining Detection ===")

    # With lining
    g = build_garment_profile({
        "fabric_composition": "Shell:Rayon 70%, Linen 30%\nLining:Polyester 100%",
    })
    check("lining detected", g.has_lining, True)

    # Without lining
    g = build_garment_profile({
        "fabric_composition": "100% Cotton",
    })
    check("no lining", g.has_lining, False)

    # Null composition
    g = build_garment_profile({
        "fabric_composition": None,
    })
    check("null composition -> no lining", g.has_lining, False)


# ================================================================
# TEST 7: BRAND TIER ESTIMATION
# ================================================================

def test_brand_tier():
    print("\n=== TEST 7: Brand Tier Estimation ===")

    check("H&M -> fast_fashion", estimate_brand_tier("$29.99", "H&M"), BrandTier.FAST_FASHION)
    check("Zara -> fast_fashion", estimate_brand_tier("$59.90", "Zara"), BrandTier.FAST_FASHION)
    check("Gucci -> luxury", estimate_brand_tier("$2,400", "Gucci"), BrandTier.LUXURY)
    check("Coach -> premium", estimate_brand_tier("$395", "Coach"), BrandTier.PREMIUM)
    check("unknown $150 -> mid_market", estimate_brand_tier("$150", "Unknown Brand"), BrandTier.MID_MARKET)
    check("unknown $25 -> fast_fashion", estimate_brand_tier("$25", None), BrandTier.FAST_FASHION)
    check("no info -> mid_market", estimate_brand_tier(None, None), BrandTier.MID_MARKET)


# ================================================================
# TEST 8: STYLING GOALS MAPPING
# ================================================================

def test_styling_goals():
    print("\n=== TEST 8: Styling Goals Mapping ===")

    body = build_body_profile(
        SAMPLE_USER_MEASUREMENTS,
        styling_goals=["look_taller", "hide_midsection", "minimize_hips"],
    )
    check("num goals", len(body.styling_goals), 3)
    check("goal 1", body.styling_goals[0], StylingGoal.LOOK_TALLER)
    check("goal 2", body.styling_goals[1], StylingGoal.HIDE_MIDSECTION)
    check("goal 3", body.styling_goals[2], StylingGoal.SLIM_HIPS)

    # Unknown goals should be skipped
    body = build_body_profile(
        SAMPLE_USER_MEASUREMENTS,
        styling_goals=["look_taller", "nonexistent_goal"],
    )
    check("unknown goal skipped", len(body.styling_goals), 1)


# ================================================================
# TEST 9: STRUCTURED DETECTION
# ================================================================

def test_structured_detection():
    print("\n=== TEST 9: Structured Detection ===")

    g = build_garment_profile({"has_darts": True})
    check("darts -> structured", g.is_structured, True)
    check("darts -> has_darts", g.has_darts, True)

    g = build_garment_profile({"has_seaming": True})
    check("seaming -> structured", g.is_structured, True)

    g = build_garment_profile({"fabric_drape": "structured"})
    check("structured drape -> structured", g.is_structured, True)

    g = build_garment_profile({"fabric_drape": "stiff"})
    check("stiff drape -> structured", g.is_structured, True)

    g = build_garment_profile({"fabric_drape": "fluid"})
    check("fluid drape -> not structured", g.is_structured, False)


# ================================================================
# TEST 10: END-TO-END (bridge -> score_garment)
# ================================================================

def test_end_to_end():
    print("\n=== TEST 10: End-to-End (bridge -> score_garment) ===")

    body = build_body_profile(SAMPLE_USER_MEASUREMENTS, styling_goals=["look_taller"])
    garment = build_garment_profile(SAMPLE_MERGED_ATTRS)

    result = score_garment(garment, body)

    check("overall_score in range", 0 <= result.overall_score <= 10, True)
    check("confidence in range", 0 <= result.confidence <= 1, True)
    check("has principle_scores", len(result.principle_scores) > 0, True)
    check("has reasoning_chain", len(result.reasoning_chain) > 0, True)

    # At least some principles should be applicable
    applicable = [p for p in result.principle_scores if p.applicable]
    check("applicable principles >= 5", len(applicable) >= 5, True)

    print(f"\n  Overall score: {result.overall_score:.2f}/10")
    print(f"  Composite raw: {result.composite_raw:+.4f}")
    print(f"  Confidence: {result.confidence:.2f}")
    print(f"  Principles: {len(result.principle_scores)} ({len(applicable)} applicable)")
    print(f"  Goal verdicts: {len(result.goal_verdicts)}")
    print(f"  Reasoning steps: {len(result.reasoning_chain)}")


# ================================================================
# TEST 11: PATTERN STRIPE DETECTION
# ================================================================

def test_pattern_stripes():
    print("\n=== TEST 11: Pattern Stripe Detection ===")

    g = build_garment_profile({"pattern_type": "horizontal_stripes"})
    check("h_stripes detected", g.has_horizontal_stripes, True)
    check("h_stripes has_pattern", g.has_pattern, True)

    g = build_garment_profile({"pattern_type": "vertical_stripes"})
    check("v_stripes detected", g.has_vertical_stripes, True)
    check("v_stripes has_pattern", g.has_pattern, True)

    g = build_garment_profile({"pattern_type": "solid"})
    check("solid no pattern", g.has_pattern, False)
    check("solid pattern_scale", g.pattern_scale, "none")


# ================================================================
# TEST 12: ZONE DETECTION
# ================================================================

def test_zone_detection():
    print("\n=== TEST 12: Zone Detection ===")

    g = build_garment_profile({"garment_type": "dress"})
    check("dress -> full_body", g.zone, "full_body")

    g = build_garment_profile({"garment_type": "top"})
    check("top -> torso", g.zone, "torso")

    g = build_garment_profile({"garment_type": "pants"})
    check("pants -> lower_body", g.zone, "lower_body")

    g = build_garment_profile({"garment_type": "skirt"})
    check("skirt -> lower_body", g.zone, "lower_body")

    g = build_garment_profile({"garment_type": "jumpsuit"})
    check("jumpsuit -> full_body", g.zone, "full_body")

    g = build_garment_profile({"garment_type": "jacket"})
    check("jacket -> torso", g.zone, "torso")


# ================================================================
# MAIN
# ================================================================

def main():
    test_body_profile_conversion()
    test_garment_profile_conversion()
    test_all_body_shapes()
    test_all_garment_categories()
    test_null_handling()
    test_lining_detection()
    test_brand_tier()
    test_styling_goals()
    test_structured_detection()
    test_end_to_end()
    test_pattern_stripes()
    test_zone_detection()

    print(f"\n{'='*50}")
    print(f"Bridge Tests: {PASS_COUNT} passed, {FAIL_COUNT} failed")
    print(f"{'='*50}")

    if FAIL_COUNT > 0:
        sys.exit(1)


if __name__ == "__main__":
    main()
