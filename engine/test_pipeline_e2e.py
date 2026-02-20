"""
Kridha Pipeline — End-to-End Tests
=====================================
Simulates the full pipeline: JSON input (as Node.js would send)
-> bridge -> score_garment -> validate ScoreResult.
"""

import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from engine.bridge import build_body_profile, build_garment_profile
from engine.kridha_engine import score_garment
from engine.schemas import BodyShape


# ================================================================
# TEST HELPERS
# ================================================================

PASS_COUNT = 0
FAIL_COUNT = 0


def check(name, actual, expected, tolerance=None):
    global PASS_COUNT, FAIL_COUNT

    if tolerance is not None:
        ok = abs(actual - expected) <= tolerance
    elif isinstance(expected, float):
        ok = abs(actual - expected) < 0.01
    elif isinstance(expected, bool):
        ok = actual == expected
    else:
        ok = actual == expected

    if ok:
        PASS_COUNT += 1
        print(f"  [OK] {name}: {actual}")
    else:
        FAIL_COUNT += 1
        print(f"  [FAIL] {name}: got {actual!r}, expected {expected!r}")


def validate_score_result(name, result, body):
    """Common validations for a ScoreResult."""
    check(f"{name}: overall_score 0-10", 0 <= result.overall_score <= 10, True)
    check(f"{name}: confidence 0-1", 0 <= result.confidence <= 1, True)

    applicable = [p for p in result.principle_scores if p.applicable]
    check(f"{name}: applicable principles >= 5", len(applicable) >= 5, True)
    check(f"{name}: has reasoning_chain", len(result.reasoning_chain) > 0, True)

    # Each principle score should be in range
    for p in result.principle_scores:
        if p.score < -1.01 or p.score > 1.01:
            global FAIL_COUNT
            FAIL_COUNT += 1
            print(f"  [FAIL] {name}: principle {p.name} score {p.score} out of range")
            return

    print(f"  Score: {result.overall_score:.2f}/10 | Composite: {result.composite_raw:+.4f} | "
          f"Confidence: {result.confidence:.2f}")
    print(f"  Body shape: {body.body_shape.value} | "
          f"Principles: {len(applicable)} applicable / {len(result.principle_scores)} total")

    if result.goal_verdicts:
        for gv in result.goal_verdicts:
            print(f"    Goal [{gv.goal.value}]: {gv.verdict} ({gv.score:+.3f})")

    if result.fixes:
        for fix in result.fixes[:3]:
            print(f"    Fix: {fix.what_to_change} (+{fix.expected_improvement:.2f})")


# ================================================================
# E2E TEST 1: H&M Puff-Sleeved Dress on Tall Plus-Size Apple
# ================================================================

def test_e2e_hm_dress_apple():
    print("\n=== E2E 1: H&M Puff-Sleeved Dress on Tall Plus-Size Apple ===")

    user_measurements = {
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

    garment_attributes = {
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
        "care_instructions": "Use a laundry bag",
        "image_confidence": "high",
        "text_confidence": "high",
    }

    body = build_body_profile(user_measurements, styling_goals=["hide_midsection", "look_taller"])
    garment = build_garment_profile(garment_attributes)

    check("body shape is apple", body.body_shape, BodyShape.APPLE)

    result = score_garment(garment, body)
    validate_score_result("HM_dress_apple", result, body)


# ================================================================
# E2E TEST 2: Dark Bodycon Dress on Petite Pear
# ================================================================

def test_e2e_bodycon_petite_pear():
    print("\n=== E2E 2: Dark Bodycon Dress on Petite Pear ===")

    user_measurements = {
        "chest_circumference": 83.82,   # 33"
        "waist_circumference": 66.04,   # 26"
        "hip_circumference": 99.06,     # 39"
        "shoulder_breadth": 33.02,      # 13"
        "neck_circumference": 30.48,
        "thigh_left_circumference": 60.96,
        "ankle_left_circumference": 20.32,
        "arm_right_length": 53.34,
        "inside_leg_height": 68.58,
        "height": 157.48,              # 5'2"
        "size_category": "standard",
        "knee_from_floor": 16.0,
        "mid_calf_from_floor": 10.7,
        "widest_calf_from_floor": 12.0,
        "ankle_from_floor": 3.5,
        "natural_waist_from_shoulder": 14.0,
        "natural_waist_from_floor": 38.0,
    }

    garment_attributes = {
        "garment_type": "dress",
        "neckline_type": "v_neck",
        "neckline_depth": "medium",
        "sleeve_type": "sleeveless",
        "sleeve_width": "fitted",
        "silhouette_type": "bodycon",
        "waistline": "natural",
        "waist_definition": "defined",
        "fit_category": "tight",
        "color_primary": "black",
        "color_value": "very_dark",
        "color_temperature": "neutral",
        "color_saturation": "muted",
        "pattern_type": "solid",
        "fabric_sheen": "matte",
        "fabric_drape": "structured",
        "fabric_texture": "smooth",
        "fabric_weight": "medium",
        "fabric_primary": "Polyester",
        "stretch_percentage": 5,
        "hemline_position": "at_knee",
        "fabric_composition": "95% Polyester, 5% Elastane",
        "brand": "Unknown",
        "price": "$49.99",
    }

    body = build_body_profile(user_measurements, styling_goals=["slim_hips", "highlight_waist"])
    garment = build_garment_profile(garment_attributes)

    check("body shape is pear", body.body_shape, BodyShape.PEAR)
    check("is petite", body.is_petite, True)
    check("garment is dark", garment.is_dark, True)

    result = score_garment(garment, body)
    validate_score_result("bodycon_petite_pear", result, body)


# ================================================================
# E2E TEST 3: High-Rise Wide-Leg Pants on Rectangle
# ================================================================

def test_e2e_wide_leg_pants_rectangle():
    print("\n=== E2E 3: High-Rise Wide-Leg Pants on Rectangle ===")

    user_measurements = {
        "chest_circumference": 88.9,    # 35" (bwd=5)
        "waist_circumference": 76.2,    # 30" (WHR=0.83, hwd=6)
        "hip_circumference": 91.44,     # 36"
        "shoulder_breadth": 34.29,      # 13.5" (shoulder_hip_diff=2.04)
        "neck_circumference": 33.02,
        "thigh_left_circumference": 53.34,
        "ankle_left_circumference": 21.59,
        "arm_right_length": 58.42,
        "inside_leg_height": 76.2,
        "height": 167.64,              # 5'6"
        "size_category": "standard",
        "knee_from_floor": 17.5,
        "mid_calf_from_floor": 11.0,
        "widest_calf_from_floor": 13.0,
        "ankle_from_floor": 3.5,
        "natural_waist_from_shoulder": 15.5,
        "natural_waist_from_floor": 40.0,
    }

    garment_attributes = {
        "garment_type": "pants",
        "silhouette_type": "shift",
        "waistline": "natural",
        "waist_definition": "defined",
        "fit_category": "relaxed",
        "color_primary": "navy",
        "color_value": "dark",
        "color_temperature": "cool",
        "color_saturation": "moderate",
        "pattern_type": "solid",
        "fabric_sheen": "matte",
        "fabric_drape": "structured",
        "fabric_texture": "woven",
        "fabric_weight": "medium",
        "fabric_primary": "Wool",
        "stretch_percentage": 2,
        "hemline_position": "ankle",
        "fabric_composition": "98% Wool, 2% Elastane",
        "brand": "J.Crew",
        "price": "$128",
    }

    body = build_body_profile(user_measurements, styling_goals=["look_taller", "highlight_waist"])
    garment = build_garment_profile(garment_attributes)

    check("body shape is rectangle", body.body_shape, BodyShape.RECTANGLE)
    check("garment category is pants", garment.category.value, "bottom_pants")
    check("zone is lower_body", garment.zone, "lower_body")

    result = score_garment(garment, body)
    validate_score_result("wide_leg_rectangle", result, body)


# ================================================================
# MAIN
# ================================================================

def main():
    test_e2e_hm_dress_apple()
    test_e2e_bodycon_petite_pear()
    test_e2e_wide_leg_pants_rectangle()

    print(f"\n{'='*50}")
    print(f"Pipeline E2E Tests: {PASS_COUNT} passed, {FAIL_COUNT} failed")
    print(f"{'='*50}")

    if FAIL_COUNT > 0:
        sys.exit(1)


if __name__ == "__main__":
    main()
