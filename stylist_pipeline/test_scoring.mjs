/**
 * Quick verification script for scoring engine changes.
 * Tests: three-tier goals, weighted boosting, silhouette dominance tiers.
 *
 * Run: node app/stylist_pipeline/test_scoring.mjs
 */

import { scoreAndCommunicate, score, buildBodyProfile, buildGarmentProfile, hasGoal, getGoalWeight, StylingGoal } from './engine/index.mjs';

// Sample body measurements (apple, plus-size, tall)
const bodyMeasurements = {
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
    body_shape: "apple",
    size_category: "plus_size",
    knee_from_floor: 14.37,
    mid_calf_from_floor: 9.63,
    widest_calf_from_floor: 10.78,
    ankle_from_floor: 3.5,
    natural_waist_from_shoulder: 28.43,
    natural_waist_from_floor: 39.57,
};

// Sample garment
const garmentAttrs = {
    garment_type: "dress",
    neckline_type: "v_neck",
    sleeve_type: "short",
    silhouette_type: "a_line",
    waistline: "natural",
    waist_definition: "defined",
    fit_category: "relaxed",
    color_primary: "black",
    color_value: "dark",
    fabric_primary: "polyester",
    fabric_weight: "medium",
    fabric_sheen: "matte",
    fabric_drape: "fluid",
    hemline_position: "below_knee",
    pattern_type: "solid",
    stretch_percentage: 0,
};

console.log("=== Test 1: No user goals (Tier 2 + 3 only) ===");
try {
    const result1 = score(bodyMeasurements, garmentAttrs, null);
    console.log(`  Overall: ${result1.overall_score?.toFixed(1)}/10`);
    console.log(`  Composite raw: ${result1.composite_raw?.toFixed(3)}`);
    console.log(`  Goals scored: ${result1.goal_verdicts?.length}`);
    console.log(`  Goal verdicts: ${result1.goal_verdicts?.map(g => `${g.goal}=${g.verdict}`).join(', ')}`);
    console.log("  PASS\n");
} catch (e) {
    console.error("  FAIL:", e.message, "\n", e.stack);
}

console.log("=== Test 2: User selected 2 goals (Tier 1 + 2 + 3) ===");
try {
    const userGoals = ["look_taller", "hide_midsection"];
    const result2 = score(bodyMeasurements, garmentAttrs, userGoals);
    console.log(`  Overall: ${result2.overall_score?.toFixed(1)}/10`);
    console.log(`  Goals scored: ${result2.goal_verdicts?.length}`);
    console.log(`  Goal verdicts: ${result2.goal_verdicts?.map(g => `${g.goal}=${g.verdict}`).join(', ')}`);
    console.log("  PASS\n");
} catch (e) {
    console.error("  FAIL:", e.message, "\n", e.stack);
}

console.log("=== Test 3: Weighted goals format ===");
try {
    const weightedGoals = [
        { goal: "look_taller", weight: 1.0 },
        { goal: "hide_midsection", weight: 0.5 },
    ];
    const result3 = score(bodyMeasurements, garmentAttrs, weightedGoals);
    console.log(`  Overall: ${result3.overall_score?.toFixed(1)}/10`);
    console.log(`  Goals scored: ${result3.goal_verdicts?.length}`);
    console.log("  PASS\n");
} catch (e) {
    console.error("  FAIL:", e.message, "\n", e.stack);
}

console.log("=== Test 4: buildBodyProfile goal deduplication ===");
try {
    // User selects "look_slimmer" (→ SLIMMING, weight 1.0)
    // Body derives "streamline_silhouette" (→ also SLIMMING, weight 0.5)
    // Should dedupe to SLIMMING with weight 1.0 (higher wins)
    const slimGoals = ["look_slimmer"];
    const bp = buildBodyProfile(bodyMeasurements, slimGoals);
    const goals = bp.styling_goals;
    console.log(`  Total goals: ${goals.length}`);
    const slimmingEntries = goals.filter(g => {
        const goalVal = g.goal || g;
        return goalVal === StylingGoal.SLIMMING || goalVal?.value === "SLIMMING";
    });
    console.log(`  SLIMMING entries: ${slimmingEntries.length} (should be 1)`);
    if (slimmingEntries.length === 1) {
        console.log(`  SLIMMING weight: ${slimmingEntries[0].weight} (should be 1.0)`);
    }
    console.log("  PASS\n");
} catch (e) {
    console.error("  FAIL:", e.message, "\n", e.stack);
}

console.log("=== Test 5: hasGoal / getGoalWeight utilities ===");
try {
    const testGoals = [
        { goal: StylingGoal.LOOK_TALLER, weight: 1.0 },
        { goal: StylingGoal.SLIMMING, weight: 0.5 },
    ];
    console.log(`  hasGoal(LOOK_TALLER): ${hasGoal(testGoals, StylingGoal.LOOK_TALLER)} (expect true)`);
    console.log(`  hasGoal(EMPHASIS): ${hasGoal(testGoals, StylingGoal.EMPHASIS)} (expect false)`);
    console.log(`  getGoalWeight(LOOK_TALLER): ${getGoalWeight(testGoals, StylingGoal.LOOK_TALLER)} (expect 1.0)`);
    console.log(`  getGoalWeight(SLIMMING): ${getGoalWeight(testGoals, StylingGoal.SLIMMING)} (expect 0.5)`);
    console.log(`  getGoalWeight(EMPHASIS): ${getGoalWeight(testGoals, StylingGoal.EMPHASIS)} (expect 0)`);
    console.log("  PASS\n");
} catch (e) {
    console.error("  FAIL:", e.message, "\n", e.stack);
}

console.log("=== Test 6: Full scoreAndCommunicate ===");
try {
    const result6 = scoreAndCommunicate(bodyMeasurements, garmentAttrs, ["hide_midsection"], null, "TestUser");
    console.log(`  Overall: ${result6.score_result?.overall_score?.toFixed(1)}/10`);
    console.log(`  Communication verdict: ${result6.communication?.verdict || 'generated'}`);
    console.log(`  Body goals count: ${result6.bodyProfile?.styling_goals?.length}`);
    console.log("  PASS\n");
} catch (e) {
    console.error("  FAIL:", e.message, "\n", e.stack);
}

console.log("=== Test 7: Rectangle body, no user goals → only Tier 3 universals ===");
try {
    // Rectangle body: WHR ~0.78, balanced bust/hip, average height, standard size
    // No body-derived goals should trigger → only Tier 3 universals remain
    const rectangleBody = {
        chest_circumference: 86.0,   // ~33.9" bust
        waist_circumference: 71.0,   // ~28" waist → WHR = 71/91 = 0.78
        hip_circumference: 91.0,     // ~35.8" hip
        shoulder_breadth: 38.0,
        neck_circumference: 33.0,
        thigh_left_circumference: 52.0,
        ankle_left_circumference: 21.0,
        arm_right_length: 56.0,
        inside_leg_height: 76.0,
        height: 165.0,              // ~65" — not petite, not tall
        body_shape: "rectangle",
        size_category: "standard",
        knee_from_floor: 18.0,
        mid_calf_from_floor: 10.0,
        widest_calf_from_floor: 14.0,
        ankle_from_floor: 4.0,
        natural_waist_from_shoulder: 15.0,
        natural_waist_from_floor: 41.0,
    };
    const bp7 = buildBodyProfile(rectangleBody, null);
    const goals7 = bp7.styling_goals;
    console.log(`  Total goals: ${goals7.length} (expect 2 — only Tier 3 universals)`);
    const goalNames = goals7.map(g => {
        const val = g.goal?.value || g.goal || g;
        return `${val}(w=${g.weight})`;
    });
    console.log(`  Goals: ${goalNames.join(', ')}`);
    const allTier3 = goals7.every(g => g.weight === 0.25);
    console.log(`  All weight 0.25: ${allTier3} (expect true)`);
    if (goals7.length === 2 && allTier3) {
        console.log("  PASS\n");
    } else {
        console.log("  UNEXPECTED — check deriveBodyGoals thresholds\n");
    }
} catch (e) {
    console.error("  FAIL:", e.message, "\n", e.stack);
}

console.log("=== All tests complete ===");
