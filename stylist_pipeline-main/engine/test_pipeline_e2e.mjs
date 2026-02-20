/**
 * Kridha Pipeline — End-to-End Tests (JavaScript)
 * =================================================
 * Mirrors the Python E2E tests to verify JS engine parity.
 */

import { scoreAndCommunicate } from './index.mjs';

// ================================================================
// TEST HELPERS
// ================================================================

let PASS_COUNT = 0;
let FAIL_COUNT = 0;

function check(name, actual, expected, tolerance = null) {
    let ok;

    if (tolerance !== null) {
        ok = Math.abs(actual - expected) <= tolerance;
    } else if (typeof expected === 'number') {
        ok = Math.abs(actual - expected) < 0.01;
    } else if (typeof expected === 'boolean') {
        ok = actual === expected;
    } else {
        ok = actual === expected;
    }

    if (ok) {
        PASS_COUNT++;
        console.log(`  [OK] ${name}: ${actual}`);
    } else {
        FAIL_COUNT++;
        console.log(`  [FAIL] ${name}: got ${JSON.stringify(actual)}, expected ${JSON.stringify(expected)}`);
    }
}

function validateScoreResult(name, result, bodyShape) {
    check(`${name}: overall_score 0-10`, result.overall_score >= 0 && result.overall_score <= 10, true);
    check(`${name}: confidence 0-1`, result.confidence >= 0 && result.confidence <= 1, true);

    const applicable = result.principle_scores.filter(p => p.applicable !== false);
    check(`${name}: applicable principles >= 5`, applicable.length >= 5, true);
    check(`${name}: has reasoning_chain`, result.reasoning_chain && result.reasoning_chain.length > 0, true);

    // Each principle score should be in range
    for (const p of result.principle_scores) {
        if (p.score < -1.01 || p.score > 1.01) {
            FAIL_COUNT++;
            console.log(`  [FAIL] ${name}: principle ${p.name} score ${p.score} out of range`);
            return;
        }
    }

    console.log(`  Score: ${result.overall_score.toFixed(2)}/10 | Composite: ${result.composite_raw >= 0 ? '+' : ''}${result.composite_raw.toFixed(4)} | Confidence: ${result.confidence.toFixed(2)}`);
    console.log(`  Body shape: ${bodyShape} | Principles: ${applicable.length} applicable / ${result.principle_scores.length} total`);

    if (result.goal_verdicts && result.goal_verdicts.length > 0) {
        for (const gv of result.goal_verdicts) {
            console.log(`    Goal [${gv.goal}]: ${gv.verdict} (${gv.score >= 0 ? '+' : ''}${gv.score.toFixed(3)})`);
        }
    }

    if (result.fixes && result.fixes.length > 0) {
        for (const fix of result.fixes.slice(0, 3)) {
            console.log(`    Fix: ${fix.what_to_change} (+${fix.expected_improvement.toFixed(2)})`);
        }
    }
}

// ================================================================
// E2E TEST 1: H&M Puff-Sleeved Dress on Tall Plus-Size Apple
// ================================================================

function test_e2e_hm_dress_apple() {
    console.log("\n=== E2E 1: H&M Puff-Sleeved Dress on Tall Plus-Size Apple ===");

    const userMeasurements = {
        chest_circumference: 112.7,
        waist_circumference: 102.76,
        hip_circumference: 107.5,
        shoulder_breadth: 42.3164,
        neck_circumference: 44.97,
        thigh_left_circumference: 67.01,
        ankle_left_circumference: 28.64,
        arm_right_length: 75.9968,
        inside_leg_height: 77.66,
        height: 172.72,
        waist_hip_ratio: 0.96,
        bust_hip_ratio: 1.05,
        shoulder_hip_ratio: 1.24,
        torso_leg_ratio: 0.93,
        body_shape: "apple",
        height_category: "tall",
        size_category: "plus_size",
        compound_types: ["apple", "tall", "plus_size"],
        knee_from_floor: 14.37,
        mid_calf_from_floor: 9.63,
        widest_calf_from_floor: 10.78,
        ankle_from_floor: 3.5,
        mid_thigh_from_floor: 22.01,
        elbow_from_shoulder: 17.05,
        widest_upper_arm_from_shoulder: 9.87,
        natural_waist_from_shoulder: 28.43,
        natural_waist_from_floor: 39.57,
    };

    const garmentAttributes = {
        neckline_type: "boat_neck",
        neckline_depth: "shallow",
        neckline_width: "medium",
        sleeve_type: "short",
        sleeve_width: "relaxed",
        silhouette_type: "a_line",
        waistline: "natural",
        waist_definition: "undefined",
        fit_category: "relaxed",
        color_primary: "light green",
        color_value: "medium_light",
        color_temperature: "cool",
        color_saturation: "moderate",
        pattern_type: "floral_small",
        pattern_scale: "small",
        pattern_contrast: "medium",
        pattern_direction: "mixed",
        fabric_sheen: "subtle_sheen",
        fabric_opacity: "semi_opaque",
        fabric_drape: "fluid",
        fabric_texture: "smooth",
        has_darts: null,
        has_seaming: null,
        has_ruching: null,
        has_draping: null,
        has_pleats: null,
        has_gathering: null,
        fabric_primary: "Rayon",
        fabric_secondary: "Linen",
        fabric_composition: "Shell:Rayon 70%, Linen 30%\nLining:Polyester 100%",
        stretch_percentage: 0,
        model_height_inches: 68.9,
        model_size_worn: "S",
        model_bust: 0,
        model_waist: 0,
        model_hips: 0,
        hemline_position: "mini",
        garment_length_inches: 0,
        fabric_weight: "medium",
        garment_type: "dress",
        title: "H&M Puff-Sleeved Dress",
        brand: "H&M",
        price: "$29.99",
        care_instructions: "Use a laundry bag",
        image_confidence: "high",
        text_confidence: "high",
    };

    const stylingGoals = ["hide_midsection", "look_taller"];

    const { scoreResult, communication, bodyProfile } = scoreAndCommunicate(
        userMeasurements,
        garmentAttributes,
        stylingGoals
    );

    check("body shape is apple", bodyProfile.body_shape, "apple");

    validateScoreResult("HM_dress_apple", scoreResult, bodyProfile.body_shape);
}

// ================================================================
// E2E TEST 2: Dark Bodycon Dress on Petite Pear
// ================================================================

function test_e2e_bodycon_petite_pear() {
    console.log("\n=== E2E 2: Dark Bodycon Dress on Petite Pear ===");

    const userMeasurements = {
        chest_circumference: 83.82,   // 33"
        waist_circumference: 66.04,   // 26"
        hip_circumference: 99.06,     // 39"
        shoulder_breadth: 33.02,      // 13"
        neck_circumference: 30.48,
        thigh_left_circumference: 60.96,
        ankle_left_circumference: 20.32,
        arm_right_length: 53.34,
        inside_leg_height: 68.58,
        height: 157.48,              // 5'2"
        size_category: "standard",
        knee_from_floor: 16.0,
        mid_calf_from_floor: 10.7,
        widest_calf_from_floor: 12.0,
        ankle_from_floor: 3.5,
        natural_waist_from_shoulder: 14.0,
        natural_waist_from_floor: 38.0,
    };

    const garmentAttributes = {
        garment_type: "dress",
        neckline_type: "v_neck",
        neckline_depth: "medium",
        sleeve_type: "sleeveless",
        sleeve_width: "fitted",
        silhouette_type: "bodycon",
        waistline: "natural",
        waist_definition: "defined",
        fit_category: "tight",
        color_primary: "black",
        color_value: "very_dark",
        color_temperature: "neutral",
        color_saturation: "muted",
        pattern_type: "solid",
        fabric_sheen: "matte",
        fabric_drape: "structured",
        fabric_texture: "smooth",
        fabric_weight: "medium",
        fabric_primary: "Polyester",
        stretch_percentage: 5,
        hemline_position: "at_knee",
        fabric_composition: "95% Polyester, 5% Elastane",
        brand: "Unknown",
        price: "$49.99",
    };

    const stylingGoals = ["slim_hips", "highlight_waist"];

    const { scoreResult, communication, bodyProfile, garmentProfile } = scoreAndCommunicate(
        userMeasurements,
        garmentAttributes,
        stylingGoals
    );

    check("body shape is pear", bodyProfile.body_shape, "pear");
    check("is petite", bodyProfile.is_petite, true);
    check("garment is dark", garmentProfile.is_dark, true);

    validateScoreResult("bodycon_petite_pear", scoreResult, bodyProfile.body_shape);
}

// ================================================================
// E2E TEST 3: High-Rise Wide-Leg Pants on Rectangle
// ================================================================

function test_e2e_wide_leg_pants_rectangle() {
    console.log("\n=== E2E 3: High-Rise Wide-Leg Pants on Rectangle ===");

    const userMeasurements = {
        chest_circumference: 88.9,    // 35" (bwd=5)
        waist_circumference: 76.2,    // 30" (WHR=0.83, hwd=6)
        hip_circumference: 91.44,     // 36"
        shoulder_breadth: 34.29,      // 13.5" (shoulder_hip_diff=2.04)
        neck_circumference: 33.02,
        thigh_left_circumference: 53.34,
        ankle_left_circumference: 21.59,
        arm_right_length: 58.42,
        inside_leg_height: 76.2,
        height: 167.64,              // 5'6"
        size_category: "standard",
        knee_from_floor: 17.5,
        mid_calf_from_floor: 11.0,
        widest_calf_from_floor: 13.0,
        ankle_from_floor: 3.5,
        natural_waist_from_shoulder: 15.5,
        natural_waist_from_floor: 40.0,
    };

    const garmentAttributes = {
        garment_type: "pants",
        silhouette_type: "shift",
        waistline: "natural",
        waist_definition: "defined",
        fit_category: "relaxed",
        color_primary: "navy",
        color_value: "dark",
        color_temperature: "cool",
        color_saturation: "moderate",
        pattern_type: "solid",
        fabric_sheen: "matte",
        fabric_drape: "structured",
        fabric_texture: "woven",
        fabric_weight: "medium",
        fabric_primary: "Wool",
        stretch_percentage: 2,
        hemline_position: "ankle",
        fabric_composition: "98% Wool, 2% Elastane",
        brand: "J.Crew",
        price: "$128",
    };

    const stylingGoals = ["look_taller", "highlight_waist"];

    const { scoreResult, communication, bodyProfile, garmentProfile } = scoreAndCommunicate(
        userMeasurements,
        garmentAttributes,
        stylingGoals
    );

    check("body shape is rectangle", bodyProfile.body_shape, "rectangle");
    check("garment category is pants", garmentProfile.category, "bottom_pants");
    check("zone is lower_body", garmentProfile.zone, "lower_body");

    validateScoreResult("wide_leg_rectangle", scoreResult, bodyProfile.body_shape);
}

// ================================================================
// MAIN
// ================================================================

function main() {
    test_e2e_hm_dress_apple();
    test_e2e_bodycon_petite_pear();
    test_e2e_wide_leg_pants_rectangle();

    console.log(`\n${'='.repeat(50)}`);
    console.log(`Pipeline E2E Tests: ${PASS_COUNT} passed, ${FAIL_COUNT} failed`);
    console.log(`${'='.repeat(50)}`);

    if (FAIL_COUNT > 0) {
        process.exit(1);
    }
}

main();
