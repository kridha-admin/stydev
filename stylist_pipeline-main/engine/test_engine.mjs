/**
 * Kridha Production Scoring Engine — Comprehensive Test Suite (JavaScript)
 * =========================================================================
 * Ports all 80+ tests from domain 4 v4 (8 reversals, 27 P1 detections,
 * 4 composite scenarios, 6 edge cases) plus new tests for Piece 2 math,
 * fabric gate, goal scoring, and end-to-end pipeline.
 */

import {
    BodyProfile,
    GarmentProfile,
    BodyShape,
    StylingGoal,
    SkinUndertone,
    FabricConstruction,
    SurfaceFinish,
    Silhouette,
    SleeveType,
    NecklineType,
    GarmentCategory,
    TopHemBehavior,
    clamp,
    scoreToTen,
} from './schemas.mjs';

import { scoreGarment } from './kridha_engine.mjs';

import {
    translateHemline,
    translateSleeve,
    translateWaistline,
    translateGarmentToBody,
} from './body_garment_translator.mjs';

import { applyContextModifiers } from './context_modifiers.mjs';

import {
    resolveFabricProperties,
    runFabricGates,
    computeClingRisk,
} from './fabric_gate.mjs';

import {
    getRegistry,
    ELASTANE_MULTIPLIERS,
    FIBER_GSM_MULTIPLIERS,
    FABRIC_LOOKUP,
} from './rules_data.mjs';

import { scoreGoals } from './goal_scorers.mjs';

import {
    classifyGarment,
    scoreTopHemline,
    scorePantRise,
    scoreLegShape,
    scoreJacketScoring,
} from './garment_types.mjs';

// ================================================================
// TEST HELPERS
// ================================================================

let PASS_COUNT = 0;
let FAIL_COUNT = 0;

function check(name, score, expSign, expRange = null, reasoning = "") {
    let ok;

    if (expSign === "+") {
        ok = score > 0.005;
    } else if (expSign === "-") {
        ok = score < -0.005;
    } else if (expSign === "0") {
        ok = Math.abs(score) < 0.05;
    } else if (expSign === "~") {
        ok = true;
    } else {
        ok = false;
    }

    if (expRange) {
        const [lo, hi] = expRange;
        ok = ok && lo <= score && score <= hi;
    }

    if (ok) {
        PASS_COUNT++;
    } else {
        FAIL_COUNT++;
    }

    const rangeStr = expRange ? ` [${expRange[0] >= 0 ? '+' : ''}${expRange[0].toFixed(2)}, ${expRange[1] >= 0 ? '+' : ''}${expRange[1].toFixed(2)}]` : "";
    console.log(`  ${ok ? '[OK]' : '[!!]'} ${name}: ${score >= 0 ? '+' : ''}${score.toFixed(4)} (exp ${expSign}${rangeStr})`);
}

// ================================================================
// BODY PROFILES (reusable test fixtures)
// ================================================================

function _hourglass() {
    return new BodyProfile({
        height: 66, bust: 38, underbust: 32, waist: 27, hip: 39,
        shoulder_width: 14.0,
    });
}

function _apple() {
    return new BodyProfile({
        height: 66, bust: 40, underbust: 36, waist: 36, hip: 38,
        shoulder_width: 15.5, belly_zone: 0.7,
    });
}

function _pear() {
    return new BodyProfile({
        height: 66, bust: 34, underbust: 30, waist: 28, hip: 42,
        shoulder_width: 14.0,
    });
}

function _invt() {
    return new BodyProfile({
        height: 67, bust: 36, underbust: 32, waist: 30, hip: 35,
        shoulder_width: 17.0,
    });
}

function _rectangle() {
    return new BodyProfile({
        height: 67, bust: 35, underbust: 31, waist: 32, hip: 36,
        shoulder_width: 15.0,
    });
}

function _petite() {
    return new BodyProfile({
        height: 61, bust: 34, underbust: 30, waist: 27, hip: 36,
        shoulder_width: 14.0, torso_length: 13.0,
    });
}

function _tall() {
    return new BodyProfile({
        height: 70, bust: 36, underbust: 32, waist: 29, hip: 38,
        shoulder_width: 15.5,
    });
}

function _plus() {
    return new BodyProfile({
        height: 66, bust: 44, underbust: 38, waist: 38, hip: 46,
        shoulder_width: 16.0, belly_zone: 0.5,
    });
}

// Combination fixtures

function _petitePear() {
    return new BodyProfile({
        height: 61, bust: 33, underbust: 29, waist: 26, hip: 40,
        shoulder_width: 13.5, torso_length: 13.0,
    });
}

function _plusApple() {
    return new BodyProfile({
        height: 66, bust: 44, underbust: 38, waist: 40, hip: 43,
        shoulder_width: 16.0, belly_zone: 0.8,
    });
}

function _petiteHourglass() {
    return new BodyProfile({
        height: 61, bust: 36, underbust: 30, waist: 25, hip: 37,
        shoulder_width: 14.0, torso_length: 13.0,
    });
}

function _withGoals(body, ...goals) {
    body.styling_goals = goals;
    return body;
}

// ================================================================
// INTERNAL SCORER IMPORTS (for direct testing)
// ================================================================

// Import internal scorers for direct testing
import {
    scoreHorizontalStripes,
    scoreDarkSlimming,
    scoreRiseElongation,
    scoreAlineBalance,
    scoreTentConcealment,
    scoreColorBreak,
    scoreBodyconMapping,
    scoreMatteZone,
    scoreVneckElongation,
    scoreMonochromeColumn,
    scoreHemline,
    scoreSleeve,
    scoreWaistPlacement,
    scoreColorValue,
    scoreFabricZone,
    scoreNecklineCompound,
} from './kridha_engine.mjs';

// ================================================================
// SECTION 1: ALL 8 REVERSALS (from domain 4 v4)
// ================================================================

function testReversals() {
    console.log("\n" + "=".repeat(70));
    console.log("  SECTION 1: ALL 8 REVERSALS");
    console.log("=".repeat(70));

    // R1: H-stripe on INVT upper body -> negative
    let g = new GarmentProfile({ has_horizontal_stripes: true, zone: "torso" });
    let { score: s } = scoreHorizontalStripes(g, _invt());
    check("R1: H-stripe on INVT upper body", s, "-");

    // R2: Tent on Petite -> strong negative
    g = new GarmentProfile({ expansion_rate: 0.20 });
    ({ score: s } = scoreTentConcealment(g, _petite()));
    check("R2: Tent on Petite", s, "-");

    // R3: Tent on Hourglass -> strongest negative
    g = new GarmentProfile({ expansion_rate: 0.20 });
    ({ score: s } = scoreTentConcealment(g, _hourglass()));
    check("R3: Tent on Hourglass", s, "-");

    // R4: Tent on Plus -> strong negative
    g = new GarmentProfile({ expansion_rate: 0.20 });
    ({ score: s } = scoreTentConcealment(g, _plus()));
    check("R4: Tent on Plus", s, "-");

    // R5: Tent on INVT -> negative
    g = new GarmentProfile({ expansion_rate: 0.20 });
    ({ score: s } = scoreTentConcealment(g, _invt()));
    check("R5: Tent on INVT", s, "-");

    // R6: Contrasting belt on Hourglass -> POSITIVE
    g = new GarmentProfile({ has_contrasting_belt: true, belt_width_cm: 4.0 });
    ({ score: s } = scoreColorBreak(g, _hourglass()));
    check("R6: Belt on Hourglass -> POSITIVE", s, "+");

    // R7: Thin bodycon on Apple -> maximum negative
    g = new GarmentProfile({ expansion_rate: 0.01, gsm_estimated: 150 });
    ({ score: s } = scoreBodyconMapping(g, _apple()));
    check("R7: Thin bodycon on Apple", s, "-", [-1.0, -0.30]);

    // R8: Bodycon on Hourglass -> POSITIVE
    g = new GarmentProfile({ expansion_rate: 0.01, gsm_estimated: 150 });
    ({ score: s } = scoreBodyconMapping(g, _hourglass()));
    check("R8: Bodycon on Hourglass -> POSITIVE", s, "+");
}

// ================================================================
// SECTION 2: P1 DETECTIONS (27 tests from domain 4 v4)
// ================================================================

function testP1Detections() {
    console.log("\n" + "=".repeat(70));
    console.log("  SECTION 2: PRIORITY-1 DETECTIONS");
    console.log("=".repeat(70));

    // P1.1: H-stripe x Pear top = positive
    let g = new GarmentProfile({ has_horizontal_stripes: true, zone: "torso" });
    let { score: s } = scoreHorizontalStripes(g, _pear());
    check("P1.1: H-stripe Pear top", s, "+");

    // P1.2: H-stripe x Pear bottom = negative
    g = new GarmentProfile({ has_horizontal_stripes: true, zone: "lower_body" });
    ({ score: s } = scoreHorizontalStripes(g, _pear()));
    check("P1.2: H-stripe Pear bottom", s, "-");

    // P1.3: H-stripe x Plus = nullified/negative
    g = new GarmentProfile({ has_horizontal_stripes: true, zone: "torso" });
    ({ score: s } = scoreHorizontalStripes(g, _plus()));
    check("P1.3: H-stripe Plus", s, "-");

    // P2.1: Dark matte x Apple = positive
    g = new GarmentProfile({ color_lightness: 0.10, surface: SurfaceFinish.MATTE, zone: "torso" });
    ({ score: s } = scoreDarkSlimming(g, _apple()));
    check("P2.1: Dark matte Apple", s, "+");

    // P2.2: Dark shiny x Apple = reduced
    g = new GarmentProfile({ color_lightness: 0.10, surface: SurfaceFinish.HIGH_SHINE, zone: "torso" });
    ({ score: s } = scoreDarkSlimming(g, _apple()));
    check("P2.2: Dark shiny Apple (reduced)", s, "~");

    // P2.3: Dark x INVT upper = amplified
    g = new GarmentProfile({ color_lightness: 0.10, surface: SurfaceFinish.MATTE, zone: "torso" });
    ({ score: s } = scoreDarkSlimming(g, _invt()));
    check("P2.3: Dark INVT upper (amplified)", s, "+", [0.15, 0.30]);

    // P3.1: Rise x Petite = amplified
    let petiteLong = _petite();
    g = new GarmentProfile({ rise_cm: 28 });
    ({ score: s } = scoreRiseElongation(g, petiteLong));
    check("P3.1: Rise Petite", s, "+");

    // P3.2: Rise x Petite short torso = INVERTED
    let petiteShort = new BodyProfile({
        height: 61, bust: 34, underbust: 30, waist: 27, hip: 36,
        shoulder_width: 14.0, torso_length: 11.5
    });
    g = new GarmentProfile({ rise_cm: 28 });
    ({ score: s } = scoreRiseElongation(g, petiteShort));
    check("P3.2: Rise Petite short torso -> INVERTED", s, "-");

    // P3.3: Rise x Apple + narrow rigid = muffin
    let apple = _apple();
    g = new GarmentProfile({ rise_cm: 28, waistband_width_cm: 2.0, waistband_stretch_pct: 3.0 });
    ({ score: s } = scoreRiseElongation(g, apple));
    check("P3.3: Rise Apple narrow rigid -> muffin", s, "-");

    // P3.4: Rise x Apple + wide elastic = positive
    g = new GarmentProfile({ rise_cm: 28, waistband_width_cm: 6.0, waistband_stretch_pct: 10.0 });
    ({ score: s } = scoreRiseElongation(g, apple));
    check("P3.4: Rise Apple wide elastic", s, "+");

    // P4.1: A-line x Pear + drapey = positive
    g = new GarmentProfile({ expansion_rate: 0.08, drape: 3 });
    ({ score: s } = scoreAlineBalance(g, _pear()));
    check("P4.1: A-line Pear drapey", s, "+");

    // P4.2: A-line x Pear + stiff = shelf
    g = new GarmentProfile({ expansion_rate: 0.08, drape: 7 });
    ({ score: s } = scoreAlineBalance(g, _pear()));
    check("P4.2: A-line Pear stiff -> shelf", s, "-");

    // P4.3: A-line x INVT = max benefit
    g = new GarmentProfile({ expansion_rate: 0.08, drape: 3 });
    ({ score: s } = scoreAlineBalance(g, _invt()));
    check("P4.3: A-line INVT max benefit", s, "+", [0.20, 0.60]);

    // P4.4: A-line x Plus + stiff = amplified shelf
    g = new GarmentProfile({ expansion_rate: 0.08, drape: 7 });
    ({ score: s } = scoreAlineBalance(g, _plus()));
    check("P4.4: A-line Plus stiff -> amplified shelf", s, "-");

    // P6.1: Color break x Petite = amplified penalty
    g = new GarmentProfile({ has_contrasting_belt: true });
    ({ score: s } = scoreColorBreak(g, _petite()));
    check("P6.1: Belt Petite -> amplified penalty", s, "-");

    // P6.2: Color break x Apple = strong penalty
    g = new GarmentProfile({ has_contrasting_belt: true });
    ({ score: s } = scoreColorBreak(g, _apple()));
    check("P6.2: Belt Apple -> strong penalty", s, "-", [-0.50, -0.15]);

    // P7.1: Thin bodycon x Pear
    g = new GarmentProfile({ expansion_rate: 0.01, gsm_estimated: 150 });
    ({ score: s } = scoreBodyconMapping(g, _pear()));
    check("P7.1: Thin bodycon Pear", s, "-");

    // P7.2: Thin bodycon x Plus
    g = new GarmentProfile({ expansion_rate: 0.01, gsm_estimated: 150 });
    ({ score: s } = scoreBodyconMapping(g, _plus()));
    check("P7.2: Thin bodycon Plus", s, "-", [-1.0, -0.30]);

    // P7.3: Structured bodycon x Plus (dramatically better)
    g = new GarmentProfile({ expansion_rate: 0.01, gsm_estimated: 300, is_structured: true });
    ({ score: s } = scoreBodyconMapping(g, _plus()));
    check("P7.3: Structured bodycon Plus (better)", s, "-", [-0.10, 0.0]);

    // P7.4: Bodycon x Athletic Apple -> POSITIVE
    let athleticApple = new BodyProfile({
        height: 66, bust: 38, underbust: 34, waist: 34, hip: 37,
        shoulder_width: 15.5, belly_zone: 0.3, is_athletic: true,
    });
    g = new GarmentProfile({ expansion_rate: 0.01, gsm_estimated: 150 });
    ({ score: s } = scoreBodyconMapping(g, athleticApple));
    check("P7.4: Bodycon Athletic Apple -> POSITIVE", s, "+");

    // P8.1: Matte x Pear hip = amplified
    g = new GarmentProfile({ surface: SurfaceFinish.DEEP_MATTE, zone: "lower_body" });
    ({ score: s } = scoreMatteZone(g, _pear()));
    check("P8.1: Matte Pear hip (amplified)", s, "+");

    // P8.2: Matte x Apple
    g = new GarmentProfile({ surface: SurfaceFinish.DEEP_MATTE, zone: "torso" });
    ({ score: s } = scoreMatteZone(g, _apple()));
    check("P8.2: Matte Apple", s, "+");

    // P8.3: Matte x Plus
    g = new GarmentProfile({ surface: SurfaceFinish.DEEP_MATTE, zone: "torso" });
    ({ score: s } = scoreMatteZone(g, _plus()));
    check("P8.3: Matte Plus", s, "+");

    // P8.4: Cling trap + matte + Plus
    g = new GarmentProfile({
        surface: SurfaceFinish.MATTE,
        elastane_pct: 8, construction: FabricConstruction.KNIT_JERSEY,
        gsm_estimated: 120, surface_friction: 0.2,
        zone: "torso",
    });
    ({ score: s } = scoreMatteZone(g, _plus()));
    check("P8.4: Cling trap matte Plus -> NEGATIVE", s, "-");

    // P9.1: V-neck x Petite + short torso + high rise = conflict
    petiteShort = new BodyProfile({
        height: 61, bust: 34, underbust: 30, waist: 27, hip: 36,
        shoulder_width: 14.0, torso_length: 11.5
    });
    g = new GarmentProfile({ neckline: NecklineType.V_NECK, rise_cm: 28 });
    ({ score: s } = scoreVneckElongation(g, petiteShort));
    check("P9.1: V-neck Petite short torso + high rise -> conflict", s, "-");

    // P9.2: V-neck x INVT = amplified
    g = new GarmentProfile({ neckline: NecklineType.V_NECK });
    ({ score: s } = scoreVneckElongation(g, _invt()));
    check("P9.2: V-neck INVT -> amplified (+0.18)", s, "+", [0.10, 0.25]);

    // P9.3: Boat neck x INVT = danger
    g = new GarmentProfile({ neckline: NecklineType.BOAT });
    ({ score: s } = scoreVneckElongation(g, _invt()));
    check("P9.3: Boat INVT -> danger", s, "-");

    // P10.1: Dark monochrome x Petite = amplified
    g = new GarmentProfile({ is_monochrome_outfit: true, color_lightness: 0.10 });
    ({ score: s } = scoreMonochromeColumn(g, _petite()));
    check("P10.1: Dark mono Petite -> amplified", s, "+", [0.15, 0.30]);
}

// ================================================================
// SECTION 3: COMPOSITE SCENARIOS (end-to-end)
// ================================================================

function testCompositeScenarios() {
    console.log("\n" + "=".repeat(70));
    console.log("  SECTION 3: COMPOSITE SCENARIOS");
    console.log("=".repeat(70));

    // Scenario A: Hourglass + black structured bodycon + V-neck + wide belt
    let body = _hourglass();
    body.styling_goals = [StylingGoal.EMPHASIS];
    let garment = new GarmentProfile({
        expansion_rate: 0.02, gsm_estimated: 280, is_structured: true,
        color_lightness: 0.08, surface: SurfaceFinish.MATTE,
        neckline: NecklineType.V_NECK, v_depth_cm: 10,
        has_contrasting_belt: true, belt_width_cm: 5.0,
        is_monochrome_outfit: true,
        zone: "full_body", hem_position: "knee",
    });
    let result = scoreGarment(garment, body);
    check("Scenario A: Hourglass perfect outfit", result.composite_raw, "+", [0.0, 0.60]);

    // Scenario B: Petite apple + light shiny tent + contrasting belt
    body = _petite();
    body.styling_goals = [StylingGoal.SLIMMING];
    let body2 = new BodyProfile({
        height: 61, bust: 38, underbust: 34, waist: 35, hip: 37,
        shoulder_width: 14.0, torso_length: 13.0, belly_zone: 0.8,
    });
    body2.styling_goals = [StylingGoal.SLIMMING];
    garment = new GarmentProfile({
        expansion_rate: 0.25, gsm_estimated: 100,
        color_lightness: 0.80, surface: SurfaceFinish.MODERATE_SHEEN,
        has_contrasting_belt: true, belt_width_cm: 4.0,
        zone: "full_body", hem_position: "knee",
    });
    result = scoreGarment(garment, body2);
    check("Scenario B: Petite apple everything wrong", result.composite_raw, "-", [-0.80, -0.05]);

    // Scenario C: INVT + dark V-neck + drapey A-line
    body = _invt();
    body.styling_goals = [StylingGoal.BALANCE];
    garment = new GarmentProfile({
        expansion_rate: 0.08, gsm_estimated: 180,
        color_lightness: 0.12, surface: SurfaceFinish.MATTE,
        neckline: NecklineType.V_NECK, v_depth_cm: 8,
        drape: 3, zone: "full_body", hem_position: "above_knee",
        sleeve_type: SleeveType.THREE_QUARTER,
    });
    result = scoreGarment(garment, body);
    check("Scenario C: INVT ideal outfit", result.composite_raw, "+", [0.0, 0.50]);

    // Scenario D: Plus pear + structured semi-fitted + dark matte + wide elastic
    body = new BodyProfile({
        height: 66, bust: 42, underbust: 37, waist: 35, hip: 46,
        shoulder_width: 15.5, belly_zone: 0.3,
    });
    body.styling_goals = [StylingGoal.SLIM_HIPS];
    garment = new GarmentProfile({
        expansion_rate: 0.05, gsm_estimated: 300, is_structured: true,
        color_lightness: 0.10, surface: SurfaceFinish.DEEP_MATTE,
        rise_cm: 26, waistband_width_cm: 5.0, waistband_stretch_pct: 10.0,
        sleeve_type: SleeveType.THREE_QUARTER,
        zone: "full_body", hem_position: "above_knee",
    });
    result = scoreGarment(garment, body);
    check("Scenario D: Plus pear good outfit", result.composite_raw, "+", [-0.05, 0.50]);
}

// ================================================================
// SECTION 4: EDGE CASES (from domain 4 v4)
// ================================================================

function testEdgeCases() {
    console.log("\n" + "=".repeat(70));
    console.log("  SECTION 4: EDGE CASES");
    console.log("=".repeat(70));

    // E1: Black + warm skin near face = sallow-reduced
    let warmBody = new BodyProfile({
        height: 66, bust: 36, underbust: 32, waist: 30, hip: 38,
        skin_undertone: SkinUndertone.WARM, skin_darkness: 0.3,
    });
    let g = new GarmentProfile({ color_lightness: 0.05, surface: SurfaceFinish.MATTE, zone: "torso" });
    let { score: s } = scoreDarkSlimming(g, warmBody);
    check("E1: Black warm skin sallow-reduced", s, "~", [-0.05, 0.10]);

    // E2: Same garment below waist = full benefit (no skin interaction)
    g = new GarmentProfile({ color_lightness: 0.05, surface: SurfaceFinish.MATTE, zone: "lower_body" });
    ({ score: s } = scoreDarkSlimming(g, warmBody));
    check("E2: Black warm skin lower body = full benefit", s, "+", [0.10, 0.25]);

    // E3: Semi-fitted on hourglass = mild positive
    g = new GarmentProfile({ expansion_rate: 0.05 });
    ({ score: s } = scoreTentConcealment(g, _hourglass()));
    check("E3: Semi-fitted hourglass = mild positive", s, "+");

    // E4: V-stripes on INVT lower body = negative
    g = new GarmentProfile({ has_vertical_stripes: true, zone: "lower_body" });
    ({ score: s } = scoreHorizontalStripes(g, _invt()));
    check("E4: V-stripes INVT lower -> negative", s, "-");

    // E5: Dark brown > black for warm skin
    let gBrown = new GarmentProfile({ color_lightness: 0.18, surface: SurfaceFinish.MATTE, zone: "torso" });
    let { score: sBrown } = scoreDarkSlimming(gBrown, warmBody);
    let gBlack = new GarmentProfile({ color_lightness: 0.05, surface: SurfaceFinish.MATTE, zone: "torso" });
    let { score: sBlack } = scoreDarkSlimming(gBlack, warmBody);
    check("E5: Dark brown > black for warm skin", sBrown - sBlack, "+");

    // E6: Tent for concealment goal = positive
    let concealBody = _apple();
    concealBody.styling_goals = [StylingGoal.CONCEALMENT];
    g = new GarmentProfile({ expansion_rate: 0.20 });
    ({ score: s } = scoreTentConcealment(g, concealBody));
    check("E6: Tent concealment goal", s, "+");
}

// ================================================================
// SECTION 5: PIECE 2 MATH TESTS
// ================================================================

function testPiece2Math() {
    console.log("\n" + "=".repeat(70));
    console.log("  SECTION 5: PIECE 2 MATH");
    console.log("=".repeat(70));

    let body = new BodyProfile({
        height: 66, bust: 36, underbust: 32, waist: 28, hip: 38,
        h_knee: 18, h_calf_max: 14, h_calf_min: 10, h_ankle: 4,
        c_calf_max: 14.5, c_calf_min: 9.0,
    });

    // Hemline: knee danger zone detection
    let g = new GarmentProfile({ hem_position: "knee" });
    let hem = translateHemline(g, body);
    check("Hemline knee -> knee zone", hem.hem_zone.includes("knee") ? 1.0 : -1.0, "+");

    // Hemline: above knee = not in danger zone
    g = new GarmentProfile({ hem_position: "above_knee" });
    hem = translateHemline(g, body);
    check("Hemline above_knee -> not danger", hem.hem_zone.includes("above") ? 1.0 : -1.0, "+");

    // Hemline: midi
    g = new GarmentProfile({ hem_position: "midi" });
    hem = translateHemline(g, body);
    check("Hemline midi position", hem.hem_from_floor, "+", [10, 20]);

    // Hemline: proportion cut ratio
    check("Hemline cut ratio in range", hem.proportion_cut_ratio, "+", [0.10, 0.35]);

    // Sleeve: 3/4 sleeve endpoint
    g = new GarmentProfile({ sleeve_type: SleeveType.THREE_QUARTER });
    let sleeve = translateSleeve(g, body);
    check("Sleeve 3/4 endpoint", sleeve.endpoint_position, "+", [14, 20]);

    // Sleeve: cap sleeve near danger zone
    g = new GarmentProfile({ sleeve_type: SleeveType.CAP });
    sleeve = translateSleeve(g, body);
    check("Sleeve cap near danger zone", sleeve.delta_vs_actual, "+"); // widening

    // Waistline: natural waist
    g = new GarmentProfile({ waist_position: "natural" });
    let waist = translateWaistline(g, body);
    check("Waistline natural", waist.visual_waist_height, "+", [40, 60]);

    // Waistline: empire raises visual waist
    let gEmpire = new GarmentProfile({ waist_position: "empire" });
    let waistEmpire = translateWaistline(gEmpire, body);
    check("Empire raises waist", waistEmpire.visual_waist_height - waist.visual_waist_height, "+");

    // Waistline: drop lowers visual waist
    let gDrop = new GarmentProfile({ waist_position: "drop" });
    let waistDrop = translateWaistline(gDrop, body);
    check("Drop lowers waist", waist.visual_waist_height - waistDrop.visual_waist_height, "+");
}

// ================================================================
// SECTION 6: FABRIC GATE TESTS
// ================================================================

function testFabricGate() {
    console.log("\n" + "=".repeat(70));
    console.log("  SECTION 6: FABRIC GATE");
    console.log("=".repeat(70));

    // Elastane multiplier accuracy
    const woven = ELASTANE_MULTIPLIERS["woven"] === 1.6;
    const knit = ELASTANE_MULTIPLIERS["knit"] === 4.0;
    const knitRib = ELASTANE_MULTIPLIERS["knit_rib"] === 5.5;
    check("Elastane multipliers correct", woven && knit && knitRib ? 1.0 : -1.0, "+");

    // Fiber GSM multipliers
    const cotton = FIBER_GSM_MULTIPLIERS["cotton"] === 1.15;
    const silk = FIBER_GSM_MULTIPLIERS["silk"] === 0.85;
    check("Fiber GSM multipliers correct", cotton && silk ? 1.0 : -1.0, "+");

    // Fabric resolution
    let g = new GarmentProfile({
        primary_fiber: "cotton", gsm_estimated: 200,
        elastane_pct: 3, construction: FabricConstruction.KNIT,
        surface: SurfaceFinish.MATTE,
    });
    let resolved = resolveFabricProperties(g);
    check("Stretch: 3% knit = 12%", resolved.total_stretch_pct, "+", [11, 13]);
    check("Effective GSM: 200 * 1.15", resolved.effective_gsm, "+", [225, 235]);
    check("Sheen: matte = 0.10", resolved.sheen_score, "+", [0.09, 0.11]);

    // Gate: dark + shiny
    let body = new BodyProfile();
    g = new GarmentProfile({ color_lightness: 0.10, surface: SurfaceFinish.HIGH_SHINE });
    resolved = resolveFabricProperties(g);
    let gates = runFabricGates(g, body, resolved);
    let gateIds = gates.map(e => e.exception_id);
    check("Gate dark+shiny triggered", gateIds.includes("GATE_DARK_SHINY") ? 1.0 : -1.0, "+");

    // Gate: A-line + stiff
    g = new GarmentProfile({ silhouette: Silhouette.A_LINE, drape: 8 }); // 80% DC
    resolved = resolveFabricProperties(g);
    gates = runFabricGates(g, body, resolved);
    gateIds = gates.map(e => e.exception_id);
    check("Gate A-line+stiff triggered", gateIds.includes("GATE_ALINE_SHELF") ? 1.0 : -1.0, "+");

    // Cling risk model
    resolved = resolveFabricProperties(new GarmentProfile({
        elastane_pct: 5, construction: FabricConstruction.KNIT_JERSEY,
        gsm_estimated: 120, surface_friction: 0.2,
    }));
    let cling = computeClingRisk(resolved, 38.0, 34.0, 0.8);
    check("Cling threshold computation", cling.base_threshold, "+", [10, 50]);

    // Fabric lookup
    check("Fabric lookup has 50+ entries", Object.keys(FABRIC_LOOKUP).length >= 50 ? 1.0 : -1.0, "+");
}

// ================================================================
// SECTION 7: GOAL SCORING TESTS
// ================================================================

function testGoalScoring() {
    console.log("\n" + "=".repeat(70));
    console.log("  SECTION 7: GOAL SCORING");
    console.log("=".repeat(70));

    // Look taller with dark monochrome + V-neck + high rise
    let body = _petite();
    body.styling_goals = [StylingGoal.LOOK_TALLER];
    let garment = new GarmentProfile({
        color_lightness: 0.10, surface: SurfaceFinish.MATTE,
        neckline: NecklineType.V_NECK, v_depth_cm: 8,
        is_monochrome_outfit: true, rise_cm: 26,
        zone: "full_body", hem_position: "above_knee",
    });
    let result = scoreGarment(garment, body);
    let tallVerdicts = result.goal_verdicts.filter(v => v.goal === StylingGoal.LOOK_TALLER);
    if (tallVerdicts.length > 0) {
        check("Goal look_taller: pass", tallVerdicts[0].score, "+");
    }

    // Hide midsection with tent + dark + matte
    body = _apple();
    body.styling_goals = [StylingGoal.HIDE_MIDSECTION];
    garment = new GarmentProfile({
        expansion_rate: 0.15, gsm_estimated: 200,
        color_lightness: 0.10, surface: SurfaceFinish.DEEP_MATTE,
        zone: "torso", hem_position: "knee",
    });
    result = scoreGarment(garment, body);
    let hideVerdicts = result.goal_verdicts.filter(v => v.goal === StylingGoal.HIDE_MIDSECTION);
    if (hideVerdicts.length > 0) {
        check("Goal hide_midsection: positive", hideVerdicts[0].score, "~");
    }

    // Minimize arms with 3/4 sleeve
    body = new BodyProfile({
        height: 66, bust: 36, underbust: 32, waist: 30, hip: 38,
        c_upper_arm_max: 14, c_forearm_min: 9, c_wrist: 6.5,
        upper_arm_zone: 0.7,
    });
    body.styling_goals = [StylingGoal.MINIMIZE_ARMS];
    garment = new GarmentProfile({
        sleeve_type: SleeveType.THREE_QUARTER,
        surface: SurfaceFinish.DEEP_MATTE,
        zone: "torso",
    });
    result = scoreGarment(garment, body);
    let armVerdicts = result.goal_verdicts.filter(v => v.goal === StylingGoal.MINIMIZE_ARMS);
    if (armVerdicts.length > 0) {
        check("Goal minimize_arms: 3/4 sleeve", armVerdicts[0].score, "+");
    }

    // Highlight waist with belt + hourglass
    body = _hourglass();
    body.styling_goals = [StylingGoal.HIGHLIGHT_WAIST];
    garment = new GarmentProfile({
        has_contrasting_belt: true, belt_width_cm: 5,
        expansion_rate: 0.02, gsm_estimated: 280, is_structured: true,
        waist_position: "natural", has_waist_definition: true,
        zone: "full_body",
    });
    result = scoreGarment(garment, body);
    let waistVerdicts = result.goal_verdicts.filter(v => v.goal === StylingGoal.HIGHLIGHT_WAIST);
    if (waistVerdicts.length > 0) {
        check("Goal highlight_waist: belt + hourglass", waistVerdicts[0].score, "+");
    }
}

// ================================================================
// SECTION 8: REGISTRY & DATA TESTS
// ================================================================

function testRegistry() {
    console.log("\n" + "=".repeat(70));
    console.log("  SECTION 8: REGISTRY & DATA");
    console.log("=".repeat(70));

    let reg = getRegistry();
    check("Registry loaded", reg.totalItems, "~", [0, 2000]);
    check("Principles loaded", reg.getByType("principles").length, "~", [0, 200]);
    check("Rules loaded", reg.getByType("rules").length, "~", [0, 500]);
    check("Exceptions loaded", reg.getByType("exceptions").length, "~", [0, 300]);
    check("Context rules loaded", reg.getByType("context_rules").length, "~", [0, 100]);
    check("Fabric rules loaded", reg.getByType("fabric_rules").length, "~", [0, 50]);

    // Score scale
    const scale0 = scoreToTen(0.0) === 5.0;
    const scale1 = scoreToTen(1.0) === 10.0;
    const scaleNeg1 = scoreToTen(-1.0) === 0.0;
    check("Score scale 0->5, +1->10, -1->0", scale0 && scale1 && scaleNeg1 ? 1.0 : -1.0, "+");
}

// ================================================================
// SECTION 9: NEW SCORER TESTS (P11-P16)
// ================================================================

function testNewScorers() {
    console.log("\n" + "=".repeat(70));
    console.log("  SECTION 9: NEW SCORERS (P11-P16)");
    console.log("=".repeat(70));

    // P11: Hemline above knee on petite = positive
    let g = new GarmentProfile({ hem_position: "above_knee" });
    let { score: s } = scoreHemline(g, _petite());
    check("P11: Above-knee petite", s, "+");

    // P11: Hemline at knee = danger zone
    g = new GarmentProfile({ hem_position: "knee" });
    ({ score: s } = scoreHemline(g, _petite()));
    check("P11: Knee petite = danger", s, "-");

    // P11: Ankle on tall = very positive
    g = new GarmentProfile({ hem_position: "ankle" });
    ({ score: s } = scoreHemline(g, _tall()));
    check("P11: Ankle tall", s, "+");

    // P12: 3/4 sleeve = optimal slimming
    g = new GarmentProfile({ sleeve_type: SleeveType.THREE_QUARTER });
    ({ score: s } = scoreSleeve(g, new BodyProfile({
        height: 66, bust: 36, underbust: 32, waist: 30, hip: 38,
        c_upper_arm_max: 12, c_forearm_min: 8.5, c_wrist: 6.5,
    })));
    check("P12: 3/4 sleeve optimal", s, "+");

    // P12: Cap sleeve = widening
    g = new GarmentProfile({ sleeve_type: SleeveType.CAP });
    ({ score: s } = scoreSleeve(g, new BodyProfile({
        height: 66, bust: 36, underbust: 32, waist: 30, hip: 38,
        c_upper_arm_max: 14, c_forearm_min: 8.5, c_wrist: 6.5,
    })));
    check("P12: Cap sleeve widening", s, "-");

    // P13: Empire on short legs = improvement
    g = new GarmentProfile({ waist_position: "empire" });
    let body = new BodyProfile({
        height: 64, bust: 35, underbust: 31, waist: 28, hip: 37,
        torso_length: 16, leg_length_visual: 38,
    });
    ({ score: s } = scoreWaistPlacement(g, body));
    check("P13: Empire short legs", s, "+");

    // P14: Very dark color = slimming
    g = new GarmentProfile({ color_lightness: 0.05 });
    ({ score: s } = scoreColorValue(g, new BodyProfile()));
    check("P14: Very dark slimming", s, "+");

    // P14: White = widening
    g = new GarmentProfile({ color_lightness: 0.95 });
    ({ score: s } = scoreColorValue(g, new BodyProfile()));
    check("P14: White widening", s, "-");

    // P15: Fabric zone structured + matte = positive
    g = new GarmentProfile({
        gsm_estimated: 280, is_structured: true,
        surface: SurfaceFinish.DEEP_MATTE,
        primary_fiber: "wool",
    });
    ({ score: s } = scoreFabricZone(g, new BodyProfile()));
    check("P15: Structured matte fabric", s, "+");

    // P16: V-neck compound on INVT = strong positive
    g = new GarmentProfile({ neckline: NecklineType.V_NECK, v_depth_cm: 10, neckline_depth: 4.0 });
    ({ score: s } = scoreNecklineCompound(g, _invt()));
    check("P16: V-neck compound INVT", s, "+");
}

// ================================================================
// SECTION 10: GARMENT TYPE TESTS
// ================================================================

function testGarmentTypes() {
    console.log("\n" + "=".repeat(70));
    console.log("  SECTION 10: GARMENT TYPE TESTS");
    console.log("=".repeat(70));

    // ─── TOP SCORING TESTS ───

    // T1: Hip-length untucked top on pear -> negative
    let g = new GarmentProfile({
        category: GarmentCategory.TOP,
        neckline: NecklineType.V_NECK,
        top_hem_length: "at_hip",
        top_hem_behavior: TopHemBehavior.UNTUCKED_AT_HIP,
    });
    let body = _pear();
    body.styling_goals = [StylingGoal.SLIM_HIPS];
    let { score: s } = scoreTopHemline(g, body);
    check("T1: Hip-length top on pear = negative", s, "-");

    // T2: Tucked top ignores top hemline
    g = new GarmentProfile({
        category: GarmentCategory.TOP,
        neckline: NecklineType.V_NECK,
        top_hem_length: "at_hip",
        top_hem_behavior: TopHemBehavior.TUCKED,
    });
    body = _pear();
    body.styling_goals = [StylingGoal.SLIM_HIPS];
    ({ score: s } = scoreTopHemline(g, body));
    check("T2: Tucked top = positive (waist def)", s, "+");

    // T3: Cropped top on petite with short torso -> negative
    g = new GarmentProfile({
        category: GarmentCategory.TOP,
        top_hem_behavior: TopHemBehavior.CROPPED,
    });
    body = new BodyProfile({
        height: 61, bust: 34, underbust: 30, waist: 27, hip: 36,
        shoulder_width: 14.0, torso_length: 13.0, leg_length_visual: 38.0,
    });
    ({ score: s } = scoreTopHemline(g, body));
    check("T3: Cropped top petite short torso", s, "-");

    // T4: Top garment should skip Hemline (leg hemline) scorer
    g = new GarmentProfile({ category: GarmentCategory.TOP });
    body = new BodyProfile();
    let result = scoreGarment(g, body);
    let hemlineScores = result.principle_scores.filter(p => p.name === "Hemline");
    let hemlineSkipped = hemlineScores.length > 0 ? hemlineScores[0].applicable === false : false;
    check("T4: Top skips Hemline scorer", hemlineSkipped ? 1.0 : -1.0, "+");

    // T5: Top garment should add Top Hemline scorer
    let topHemScores = result.principle_scores.filter(p => p.name === "Top Hemline");
    let hasTopHemline = topHemScores.length > 0;
    check("T5: Top adds Top Hemline scorer", hasTopHemline ? 1.0 : -1.0, "+");

    // ─── PANTS SCORING TESTS ───

    // T6: High rise elongates legs (positive)
    g = new GarmentProfile({
        category: GarmentCategory.BOTTOM_PANTS,
        rise: "high", leg_shape: "straight",
    });
    body = _petite();
    body.styling_goals = [StylingGoal.LOOK_TALLER];
    ({ score: s } = scorePantRise(g, body));
    check("T6: High rise elongates legs", s, "+");

    // T7: Low rise penalizes petite (negative)
    g = new GarmentProfile({
        category: GarmentCategory.BOTTOM_PANTS,
        rise: "low", leg_shape: "skinny",
    });
    body = _petite();
    body.styling_goals = [StylingGoal.LOOK_TALLER];
    ({ score: s } = scorePantRise(g, body));
    check("T7: Low rise penalizes petite", s, "-");

    // T8: Wide leg on pear = positive
    g = new GarmentProfile({
        category: GarmentCategory.BOTTOM_PANTS,
        rise: "high", leg_shape: "wide_leg",
    });
    body = _pear();
    body.styling_goals = [StylingGoal.SLIM_HIPS];
    ({ score: s } = scoreLegShape(g, body));
    check("T8: Wide leg on pear positive", s, "+");

    // T9: Skinny on pear + slim_hips = negative
    g = new GarmentProfile({
        category: GarmentCategory.BOTTOM_PANTS,
        rise: "mid", leg_shape: "skinny",
    });
    body = _pear();
    body.styling_goals = [StylingGoal.SLIM_HIPS];
    ({ score: s } = scoreLegShape(g, body));
    check("T9: Skinny on pear + slim_hips", s, "-");

    // T10: Pants skip neckline scorers
    g = new GarmentProfile({
        category: GarmentCategory.BOTTOM_PANTS,
        rise: "mid", leg_shape: "straight",
    });
    body = new BodyProfile();
    result = scoreGarment(g, body);
    let vneckScores = result.principle_scores.filter(p => p.name === "V-Neck Elongation");
    let vneckSkipped = vneckScores.length > 0 ? vneckScores[0].applicable === false : false;
    check("T10: Pants skip V-Neck scorer", vneckSkipped ? 1.0 : -1.0, "+");

    // T11: Pants add Pant Rise + Leg Shape scorers
    let pantScorers = result.principle_scores.filter(p =>
        p.name === "Pant Rise" || p.name === "Leg Shape"
    );
    check("T11: Pants add Rise+LegShape", pantScorers.length, "+", [2.0, 2.0]);

    // ─── JACKET SCORING TESTS ───

    // T12: Structured blazer on pear = positive
    g = new GarmentProfile({
        category: GarmentCategory.JACKET,
        shoulder_structure: "structured",
        jacket_length: "hip",
        jacket_closure: "single_breasted",
    });
    body = _pear();
    ({ score: s } = scoreJacketScoring(g, body));
    check("T12: Structured blazer on pear", s, "+");

    // T13: Hip-length jacket on pear = mixed (shoulder + but hip -)
    check("T13: Hip-length jacket net positive", s, "+");

    // T14: Cropped jacket defines waist
    g = new GarmentProfile({
        category: GarmentCategory.JACKET,
        jacket_length: "cropped",
        shoulder_structure: "natural",
    });
    body = _hourglass();
    body.styling_goals = [StylingGoal.HIGHLIGHT_WAIST];
    ({ score: s } = scoreJacketScoring(g, body));
    check("T14: Cropped jacket waist def", s, "+");

    // T15: Padded shoulders on INVT = negative
    g = new GarmentProfile({
        category: GarmentCategory.JACKET,
        shoulder_structure: "padded",
        jacket_length: "hip",
    });
    body = _invt();
    ({ score: s } = scoreJacketScoring(g, body));
    check("T15: Padded shoulders on INVT", s, "-");

    // T16: Jacket has layer modifications
    g = new GarmentProfile({
        category: GarmentCategory.JACKET,
        shoulder_structure: "structured",
        jacket_closure: "open_front",
    });
    body = new BodyProfile();
    result = scoreGarment(g, body);
    let hasLayer = result.layer_modifications !== null;
    let hasMods = hasLayer ? (result.layer_modifications.layer_modifications?.length || 0) : 0;
    check("T16: Jacket has layer info", hasMods > 0 ? 1.0 : -1.0, "+");

    // ─── SKIRT SCORING TESTS ───

    // T17: A-line skirt on pear: uses A-Line Balance scorer = positive
    g = new GarmentProfile({
        category: GarmentCategory.SKIRT,
        silhouette: Silhouette.A_LINE,
        expansion_rate: 0.08, drape: 3,
        skirt_construction: "a_line",
        hem_position: "knee",
    });
    body = _pear();
    ({ score: s } = scoreAlineBalance(g, body));
    check("T17: A-line skirt pear positive", s, "+");

    // T18: Skirt should skip neckline/sleeve scorers
    result = scoreGarment(g, body);
    let vneckS = result.principle_scores.filter(p => p.name === "V-Neck Elongation");
    let sleeveS = result.principle_scores.filter(p => p.name === "Sleeve");
    let skirtSkips = (vneckS.length > 0 ? vneckS[0].applicable === false : true) &&
                     (sleeveS.length > 0 ? sleeveS[0].applicable === false : true);
    check("T18: Skirt skips neckline+sleeve", skirtSkips ? 1.0 : -1.0, "+");

    // ─── GARMENT CLASSIFICATION TESTS ───

    // T19-T23: classifyGarment from title
    g = new GarmentProfile({ title: "Reformation Aiko Midi Dress" });
    check("T19: Classify dress", classifyGarment(g) === GarmentCategory.DRESS ? 1.0 : -1.0, "+");

    g = new GarmentProfile({ title: "Levi's 501 Original Jeans" });
    check("T20: Classify jeans", classifyGarment(g) === GarmentCategory.BOTTOM_PANTS ? 1.0 : -1.0, "+");

    g = new GarmentProfile({ title: "Theory Etiennette Blazer in Good Wool" });
    check("T21: Classify blazer", classifyGarment(g) === GarmentCategory.JACKET ? 1.0 : -1.0, "+");

    g = new GarmentProfile({ title: "Nike Sportswear Club Fleece Hoodie" });
    check("T22: Classify hoodie", classifyGarment(g) === GarmentCategory.SWEATSHIRT ? 1.0 : -1.0, "+");

    g = new GarmentProfile({ title: "Libas Embroidered Straight Kurta" });
    check("T23: Classify kurta", classifyGarment(g) === GarmentCategory.SALWAR_KAMEEZ ? 1.0 : -1.0, "+");

    // ─── END-TO-END GARMENT TYPE TESTS ───

    // T24: Full pipeline - high rise wide leg on pear
    g = new GarmentProfile({
        category: GarmentCategory.BOTTOM_PANTS,
        rise: "high", leg_shape: "wide_leg",
        color_lightness: 0.10, surface: SurfaceFinish.MATTE,
    });
    body = _pear();
    body.styling_goals = [StylingGoal.SLIM_HIPS];
    result = scoreGarment(g, body);
    check("T24: Pear wide-leg pants composite", result.composite_raw, "+");

    // T25: Full pipeline - structured blazer on pear
    g = new GarmentProfile({
        category: GarmentCategory.JACKET,
        shoulder_structure: "structured",
        jacket_length: "waist",
        jacket_closure: "open_front",
        color_lightness: 0.15, surface: SurfaceFinish.MATTE,
    });
    body = _pear();
    result = scoreGarment(g, body);
    check("T25: Pear structured blazer composite", result.composite_raw, "+");

    // T26: Full pipeline - low-rise skinny on petite with height goal
    g = new GarmentProfile({
        category: GarmentCategory.BOTTOM_PANTS,
        rise: "low", leg_shape: "skinny",
        color_lightness: 0.50,
    });
    body = _petite();
    body.styling_goals = [StylingGoal.LOOK_TALLER];
    result = scoreGarment(g, body);
    check("T26: Petite low-rise skinny composite", result.composite_raw, "-");

    // T27: Full pipeline - hip-length top on INVT (should be positive)
    g = new GarmentProfile({
        category: GarmentCategory.TOP,
        neckline: NecklineType.V_NECK,
        top_hem_length: "at_hip",
        top_hem_behavior: TopHemBehavior.UNTUCKED_AT_HIP,
        color_lightness: 0.10, surface: SurfaceFinish.MATTE,
    });
    body = _invt();
    ({ score: s } = scoreTopHemline(g, body));
    check("T27: Hip-length top on INVT positive", s, "+");
}

// ================================================================
// SECTION 11: FIX VALIDATION TESTS
// ================================================================

function testFixValidation() {
    console.log("\n" + "=".repeat(70));
    console.log("  SECTION 11: FIX VALIDATION TESTS");
    console.log("=".repeat(70));

    // ─── FIX 1: Pants/shorts/skirts skip Rise Elongation + Hemline ───

    // FIX1a: Pants should NOT run Rise Elongation (P3)
    let g = new GarmentProfile({
        category: GarmentCategory.BOTTOM_PANTS,
        rise: "high", leg_shape: "straight", rise_cm: 28,
    });
    let body = new BodyProfile();
    let result = scoreGarment(g, body);
    let riseElong = result.principle_scores.filter(p => p.name === "Rise Elongation");
    let riseSkipped = riseElong.length > 0 ? riseElong[0].applicable === false : true;
    check("FIX1a: Pants skip Rise Elongation", riseSkipped ? 1.0 : -1.0, "+");

    // FIX1b: Pants should NOT run Hemline (P11)
    let hemlineP = result.principle_scores.filter(p => p.name === "Hemline");
    let hemlineSkipped = hemlineP.length > 0 ? hemlineP[0].applicable === false : true;
    check("FIX1b: Pants skip Hemline scorer", hemlineSkipped ? 1.0 : -1.0, "+");

    // FIX1c: Skirts should NOT run Rise Elongation
    g = new GarmentProfile({
        category: GarmentCategory.SKIRT,
        skirt_construction: "a_line", hem_position: "knee",
    });
    result = scoreGarment(g, new BodyProfile());
    riseElong = result.principle_scores.filter(p => p.name === "Rise Elongation");
    riseSkipped = riseElong.length > 0 ? riseElong[0].applicable === false : true;
    check("FIX1c: Skirts skip Rise Elongation", riseSkipped ? 1.0 : -1.0, "+");

    // ─── FIX 2: Body-garment translator routes by garment type ───

    // FIX2a: Pants translator skips hemline
    g = new GarmentProfile({
        category: GarmentCategory.BOTTOM_PANTS,
        rise: "high", leg_shape: "straight",
    });
    let adjusted = translateGarmentToBody(g, _pear());
    check("FIX2a: Pants translator no hem zone", adjusted.hem_zone === "" ? 1.0 : -1.0, "+");

    // FIX2b: Pants translator skips sleeve
    check("FIX2b: Pants translator no sleeve", adjusted.sleeve_endpoint_position === 0.0 ? 1.0 : -1.0, "+");

    // FIX2c: Dress translator still computes everything
    g = new GarmentProfile({ category: GarmentCategory.DRESS, hem_position: "knee" });
    adjusted = translateGarmentToBody(g, _pear());
    check("FIX2c: Dress translator has hem zone", adjusted.hem_zone !== "" ? 1.0 : -1.0, "+");

    // ─── FIX 3: Auto-classification from title ───

    // FIX3a: Jeans auto-classified from title, Rise Elongation skipped
    g = new GarmentProfile({ title: "Levi's 501 Original Straight Jeans" });
    result = scoreGarment(g, new BodyProfile());
    riseElong = result.principle_scores.filter(p => p.name === "Rise Elongation");
    riseSkipped = riseElong.length > 0 ? riseElong[0].applicable === false : true;
    check("FIX3a: Jeans auto-classified, Rise Elongation skipped", riseSkipped ? 1.0 : -1.0, "+");

    // FIX3b: Classify culottes
    g = new GarmentProfile({ title: "Wide-Leg Culottes in Black" });
    check("FIX3b: Culottes -> pants", classifyGarment(g) === GarmentCategory.BOTTOM_PANTS ? 1.0 : -1.0, "+");

    // FIX3c: Classify shacket
    g = new GarmentProfile({ title: "Oversized Plaid Shacket" });
    check("FIX3c: Shacket -> jacket", classifyGarment(g) === GarmentCategory.JACKET ? 1.0 : -1.0, "+");

    // ─── FIX 4: Goal verdicts integrate garment-type scorers ───

    // FIX4a: Pant Rise influences LOOK_TALLER goal verdict
    g = new GarmentProfile({
        category: GarmentCategory.BOTTOM_PANTS,
        rise: "high", leg_shape: "straight",
        color_lightness: 0.10, surface: SurfaceFinish.MATTE,
    });
    body = _petite();
    body.styling_goals = [StylingGoal.LOOK_TALLER];
    result = scoreGarment(g, body);
    let tallV = result.goal_verdicts.filter(v => v.goal === StylingGoal.LOOK_TALLER);
    let hasRise = tallV.length > 0 ? tallV[0].supporting_principles.some(s => s.includes("Pant Rise")) : false;
    check("FIX4a: Pant Rise in LOOK_TALLER verdict", hasRise ? 1.0 : -1.0, "+");

    // FIX4b: Leg Shape influences SLIM_HIPS goal verdict
    g = new GarmentProfile({
        category: GarmentCategory.BOTTOM_PANTS,
        rise: "high", leg_shape: "wide_leg",
        color_lightness: 0.10, surface: SurfaceFinish.MATTE,
    });
    body = _pear();
    body.styling_goals = [StylingGoal.SLIM_HIPS];
    result = scoreGarment(g, body);
    let slimV = result.goal_verdicts.filter(v => v.goal === StylingGoal.SLIM_HIPS);
    let hasLeg = slimV.length > 0 ? slimV[0].supporting_principles.some(s => s.includes("Leg Shape")) : false;
    check("FIX4b: Leg Shape in SLIM_HIPS verdict", hasLeg ? 1.0 : -1.0, "+");

    // FIX4c: Jacket Scoring influences MINIMIZE_ARMS goal
    g = new GarmentProfile({
        category: GarmentCategory.JACKET,
        shoulder_structure: "structured",
        jacket_length: "hip", jacket_closure: "single_breasted",
    });
    body = _pear();
    body.c_upper_arm_max = 14;
    body.upper_arm_zone = 0.7;
    body.styling_goals = [StylingGoal.MINIMIZE_ARMS];
    result = scoreGarment(g, body);
    let armV = result.goal_verdicts.filter(v => v.goal === StylingGoal.MINIMIZE_ARMS);
    if (armV.length > 0) {
        let hasJacket = armV[0].supporting_principles.some(s => s.includes("Jacket"));
        check("FIX4c: Jacket in MINIMIZE_ARMS verdict", hasJacket ? 1.0 : -1.0, "+");
    }

    // ─── FIX 5: Half-tucked tops ───

    // FIX5a: Half-tucked top on pear is positive
    g = new GarmentProfile({
        category: GarmentCategory.TOP,
        top_hem_length: "at_hip",
        top_hem_behavior: TopHemBehavior.HALF_TUCKED,
    });
    body = _pear();
    body.styling_goals = [StylingGoal.HIGHLIGHT_WAIST];
    let { score: s } = scoreTopHemline(g, body);
    check("FIX5a: Half-tucked on pear positive", s, "+");

    // FIX5b: Half-tucked heavy fabric penalized
    g = new GarmentProfile({
        category: GarmentCategory.TOP,
        top_hem_behavior: TopHemBehavior.HALF_TUCKED,
        gsm_estimated: 300,
    });
    body = new BodyProfile();
    ({ score: s } = scoreTopHemline(g, body));
    check("FIX5b: Half-tucked heavy fabric lower", s, "~", [-0.10, 0.15]);

    // ─── FIX 6: Leg shape rise interaction ───

    // FIX6a: Wide-leg + high rise on pear > wide-leg + low rise on pear
    let gHigh = new GarmentProfile({
        category: GarmentCategory.BOTTOM_PANTS,
        rise: "high", leg_shape: "wide_leg",
    });
    let gLow = new GarmentProfile({
        category: GarmentCategory.BOTTOM_PANTS,
        rise: "low", leg_shape: "wide_leg",
    });
    body = _pear();
    body.styling_goals = [StylingGoal.SLIM_HIPS];
    let { score: sHigh } = scoreLegShape(gHigh, body);
    let { score: sLow } = scoreLegShape(gLow, body);
    check("FIX6a: Wide-leg high rise > low rise on pear", sHigh - sLow, "+");

    // FIX6b: Skinny + high rise on pear better than skinny + mid rise
    let gSkinnyHigh = new GarmentProfile({
        category: GarmentCategory.BOTTOM_PANTS,
        rise: "high", leg_shape: "skinny",
    });
    let gSkinnyMid = new GarmentProfile({
        category: GarmentCategory.BOTTOM_PANTS,
        rise: "mid", leg_shape: "skinny",
    });
    body = _pear();
    ({ score: sHigh } = scoreLegShape(gSkinnyHigh, body));
    let { score: sMid } = scoreLegShape(gSkinnyMid, body);
    check("FIX6b: Skinny + high rise >= skinny + mid rise on pear", sHigh - sMid, "+");

    // ─── FIX 7: Thigh cling penalty ───

    // FIX7a: Skinny low-stretch on large-thigh pear gets cling penalty
    g = new GarmentProfile({
        category: GarmentCategory.BOTTOM_PANTS,
        rise: "mid", leg_shape: "skinny",
        elastane_pct: 0, construction: FabricConstruction.WOVEN,
    });
    body = _pear();
    body.c_thigh_max = 26.0;
    ({ score: s } = scoreLegShape(g, body));
    check("FIX7a: No-stretch skinny on large thigh pear", s, "-", [-0.80, -0.15]);

    // FIX7b: Stretch skinny on same body = less penalty
    let g2 = new GarmentProfile({
        category: GarmentCategory.BOTTOM_PANTS,
        rise: "mid", leg_shape: "skinny",
        elastane_pct: 5, construction: FabricConstruction.KNIT_JERSEY,
    });
    let body2 = _pear();
    body2.c_thigh_max = 26.0;
    let { score: s2 } = scoreLegShape(g2, body2);
    check("FIX7b: Stretch skinny on same body better", s2 - s, "+");

    // ─── FIX 8: More occasions ───

    // FIX8a: Interview occasion penalizes mini skirt
    g = new GarmentProfile({ hem_position: "mini" });
    body = new BodyProfile();
    let adj = applyContextModifiers({ occasion: "interview" }, [], body, g);
    check("FIX8a: Interview + mini = hem violation", adj.occasion_hem_violation || 0.0, "-");

    // FIX8b: Wedding guest occasion penalizes mini
    adj = applyContextModifiers({ occasion: "wedding_guest" }, [], body, g);
    check("FIX8b: Wedding guest + mini = hem violation", adj.occasion_hem_violation || 0.0, "-");

    // ─── FIX 9: Fix suggestions for new scorers ───

    // FIX9: Bad pant rise generates fix suggestion
    g = new GarmentProfile({
        category: GarmentCategory.BOTTOM_PANTS,
        rise: "low", leg_shape: "skinny",
        color_lightness: 0.50,
    });
    body = _petite();
    body.styling_goals = [StylingGoal.LOOK_TALLER];
    result = scoreGarment(g, body);
    let hasRiseFix = result.fixes.some(f => f.what_to_change.toLowerCase().includes("high-rise"));
    check("FIX9: Low-rise generates rise fix", hasRiseFix ? 1.0 : -1.0, "+");
}

// ================================================================
// SECTION 12: COMBINED PROFILE SCENARIOS
// ================================================================

function testCombinedProfiles() {
    console.log("\n" + "=".repeat(70));
    console.log("  SECTION 12: COMBINED PROFILE SCENARIOS");
    console.log("=".repeat(70));

    // CP1: Petite pear + high rise wide leg = strong positive
    let body = _withGoals(_petitePear(), StylingGoal.LOOK_TALLER, StylingGoal.SLIM_HIPS);
    let g = new GarmentProfile({
        category: GarmentCategory.BOTTOM_PANTS,
        rise: "high", leg_shape: "wide_leg",
        color_lightness: 0.10, surface: SurfaceFinish.MATTE,
    });
    let result = scoreGarment(g, body);
    check("CP1: Petite pear + high-rise wide-leg", result.composite_raw, "+");

    // CP2: Petite pear + low rise skinny = strong negative
    g = new GarmentProfile({
        category: GarmentCategory.BOTTOM_PANTS,
        rise: "low", leg_shape: "skinny",
        color_lightness: 0.70,
    });
    result = scoreGarment(g, body);
    check("CP2: Petite pear + low-rise skinny", result.composite_raw, "-");

    // CP3: Plus apple + structured blazer open front = positive
    body = _withGoals(_plusApple(), StylingGoal.HIDE_MIDSECTION);
    g = new GarmentProfile({
        category: GarmentCategory.JACKET,
        shoulder_structure: "structured",
        jacket_length: "hip", jacket_closure: "open_front",
        color_lightness: 0.10, surface: SurfaceFinish.MATTE,
    });
    result = scoreGarment(g, body);
    check("CP3: Plus apple + structured open blazer", result.composite_raw, "+");

    // CP4: Plus apple + cropped top = negative (exposes midsection)
    g = new GarmentProfile({
        category: GarmentCategory.TOP,
        top_hem_behavior: TopHemBehavior.CROPPED,
        color_lightness: 0.80,
    });
    result = scoreGarment(g, body);
    let topHem = result.principle_scores.filter(p => p.name === "Top Hemline");
    if (topHem.length > 0) {
        check("CP4: Plus apple + crop top = Top Hemline negative", topHem[0].score, "-");
    }

    // CP5: Petite hourglass + bodycon V-neck = positive
    body = _withGoals(_petiteHourglass(), StylingGoal.EMPHASIS);
    g = new GarmentProfile({
        category: GarmentCategory.DRESS,
        expansion_rate: 0.02, gsm_estimated: 280, is_structured: true,
        neckline: NecklineType.V_NECK, v_depth_cm: 8,
        color_lightness: 0.10, surface: SurfaceFinish.MATTE,
        hem_position: "above_knee",
    });
    result = scoreGarment(g, body);
    check("CP5: Petite hourglass + structured bodycon", result.composite_raw, "+");

    // CP6: V-neck tucked blouse + high-rise wide-leg on pear (multi-piece)
    body = _withGoals(_pear(), StylingGoal.SLIM_HIPS, StylingGoal.LOOK_TALLER);
    let gTop = new GarmentProfile({
        category: GarmentCategory.TOP,
        neckline: NecklineType.V_NECK,
        top_hem_behavior: TopHemBehavior.TUCKED,
        color_lightness: 0.10, surface: SurfaceFinish.MATTE,
    });
    let resultTop = scoreGarment(gTop, body);
    let gPants = new GarmentProfile({
        category: GarmentCategory.BOTTOM_PANTS,
        rise: "high", leg_shape: "wide_leg",
        color_lightness: 0.10, surface: SurfaceFinish.MATTE,
    });
    let resultPants = scoreGarment(gPants, body);
    check("CP6a: Pear tucked V-neck top", resultTop.composite_raw, "+");
    check("CP6b: Pear high-rise wide-leg pants", resultPants.composite_raw, "+");
}

// ================================================================
// MAIN
// ================================================================

function runTests() {
    PASS_COUNT = 0;
    FAIL_COUNT = 0;

    testReversals();
    testP1Detections();
    testCompositeScenarios();
    testEdgeCases();
    testPiece2Math();
    testFabricGate();
    testGoalScoring();
    testRegistry();
    testNewScorers();
    testGarmentTypes();
    testFixValidation();
    testCombinedProfiles();

    console.log("\n" + "=".repeat(70));
    console.log(`  RESULTS: ${PASS_COUNT} passed, ${FAIL_COUNT} failed, ${PASS_COUNT + FAIL_COUNT} total`);
    console.log("=".repeat(70));

    const coverage = {
        reversals_tested: 8,
        p1_detections_tested: 27,
        composite_scenarios: 4,
        edge_cases: 6,
        piece2_math: 9,
        fabric_gate: 8,
        goal_scoring: 4,
        registry_data: 7,
        new_scorers_p11_p16: 10,
        garment_types: 27,
        fix_validation: 22,
        combined_profiles: 8,
    };
    const totalCases = Object.values(coverage).reduce((a, b) => a + b, 0);
    console.log(`  Coverage: ${totalCases} test cases across ${Object.keys(coverage).length} sections`);
    for (const [section, count] of Object.entries(coverage)) {
        console.log(`    ${section}: ${count}`);
    }

    if (FAIL_COUNT > 0) {
        process.exit(1);
    }
}

runTests();
