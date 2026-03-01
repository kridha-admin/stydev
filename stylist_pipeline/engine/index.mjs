/**
 * Kridha Production Scoring Engine - Main Exports
 * ================================================
 * JavaScript implementation of the complete styling scoring and communication pipeline.
 *
 * Main entry points:
 *   - scoreGarment(garment, body, context) → ScoreResult
 *   - scoreAndCommunicate(garment, body, context) → { score_result, communication }
 *   - buildBodyProfile(measurements) → BodyProfile
 *   - buildGarmentProfile(attributes) → GarmentProfile
 */

// Core schemas and data types
import { BodyProfile, GarmentProfile } from './schemas.mjs';
export {
    // Enums
    BodyShape,
    StylingGoal,
    GarmentCategory,
    GarmentLayer,
    NecklineType,
    SleeveType,
    Silhouette,
    FabricConstruction,
    SurfaceFinish,
    SkinUndertone,
    TopHemBehavior,
    // Classes
    BodyProfile,
    GarmentProfile,
    PrincipleResult,
    GoalVerdict,
    ZoneScore,
    ExceptionTriggered,
    Fix,
    BodyAdjustedGarment,
    ScoreResult,
    // Utilities
    clamp,
    scoreToTen,
    rescaleDisplay,
    hasGoal,
    getGoalWeight,
} from './schemas.mjs';

// Profile builders
export {
    buildBodyProfile,
    buildGarmentProfile,
} from './bridge.mjs';

// Fabric resolution
export {
    ResolvedFabric,
    resolveFabricProperties,
    computeClingRisk,
    photoToRealityDiscount,
    runFabricGates,
    getStructuredPenaltyReduction,
} from './fabric_gate.mjs';

// Body-garment translation
export {
    HemlineResult,
    SleeveResult,
    WaistlineResult,
    ProportionResult,
    translateHemline,
    translateSleeve,
    translateWaistline,
    translateGarmentToBody,
} from './body_garment_translator.mjs';

// Garment type system
export {
    TYPE_SCORER_ZONE_MAPPING,
    TYPE_SCORER_WEIGHTS,
    getScorersToSkip,
    getExtraScorerNames,
    isLayerGarment,
    classifyGarment,
    scoreTopHemline,
    scorePantRise,
    scoreLegShape,
    scoreJacketScoring,
    computeLayerModifications,
} from './garment_types.mjs';

// Goal scoring
export {
    GOAL_PRINCIPLE_MAP,
    scoreGoals,
} from './goal_scorers.mjs';

// Context modifiers
export {
    applyContextModifiers,
} from './context_modifiers.mjs';

// Main scoring engine
export {
    scoreGarment,
} from './kridha_engine.mjs';

// Communication schema
export {
    PinchSegment,
    GoalChip,
    CommunicationOutput,
    selectVerdict,
    buildGoalChips,
    buildSearchPills,
    buildSearchContext,
    buildChatChips,
    buildUserLine,
    buildPhotoNote,
    buildConfidenceNote,
    buildTripleChecks,
    normalizePrincipleKey,
    analyzePrinciples,
} from './communication_schema.mjs';

// Gold generator (phrase bank)
export {
    generateGoldOutput,
} from './gold_generator.mjs';

// Guardrails
export {
    GuardrailViolation,
    GuardrailResult,
    checkOutput,
    checkText,
} from './guardrails.mjs';

// Communication engine
export {
    generateCommunication,
} from './communicate.mjs';

// Rules data constants
export {
    GOLDEN_RATIO,
    PRINCIPLE_CONFIDENCE,
    FABRIC_LOOKUP,
    ELASTANE_MULTIPLIERS,
    FIBER_GSM_MULTIPLIERS,
    SHEEN_MAP,
    getFabricData,
    getBustDividingThreshold,
} from './rules_data.mjs';

// ================================================================
// HIGH-LEVEL API
// ================================================================

import { buildBodyProfile, buildGarmentProfile } from './bridge.mjs';
import { scoreGarment } from './kridha_engine.mjs';
import { generateCommunication } from './communicate.mjs';

/**
 * Score a garment and generate UI-ready communication in one call.
 *
 * @param {Object} userMeasurements - Raw user body measurements
 * @param {Object} garmentAttributes - Raw garment attributes
 * @param {Object} context - Optional context (occasion, culture, etc.)
 * @param {string} userName - User display name
 * @returns {Object} { score_result, communication }
 */
export function scoreAndCommunicate(
    userMeasurements,
    garmentAttributes,
    stylingGoals = null,
    context = null,
    userName = "You"
) {
    // Build profiles
    // console.log("userMeasurements: ", userMeasurements);
    // console.log("garmentAttributes: ", garmentAttributes);
    // console.log("stylingGoals: ", stylingGoals);
    // console.log("context: ", context);
    // console.log("userName: ", userName);

    if(garmentAttributes.is_adult_clothing === false){
        console.log("is_adult_clothing is false, not supported");
        return {
            "is_product_supported": false,
        };
    }
    const bodyProfile = buildBodyProfile(userMeasurements, stylingGoals);
    const garmentProfile = buildGarmentProfile(garmentAttributes);
    // console.log("bodyProfile: ", bodyProfile);
    // console.log("garmentProfile: ", garmentProfile);

    // Score the garment
    const scoreResult = scoreGarment(garmentProfile, bodyProfile, context);
    // console.log("scoreResult: ", JSON.stringify(scoreResult, null, 2));

    // Convert to plain objects for serialization
    const scoreResultDict = scoreResultToDict(scoreResult);

    // Generate communication
    const communication = generateCommunication(
        scoreResultDict,
        bodyProfileToDict(bodyProfile),
        garmentProfileToDict(garmentProfile),
        stylingGoals,
        userName,
        true // run guardrails
    );

    return {
        score_result: scoreResultDict,
        communication,
        bodyProfile: bodyProfileToDict(bodyProfile),
        garmentProfile: garmentProfileToDict(garmentProfile),
        is_product_supported: true,
    };
}

/**
 * Score a garment without communication (just the ScoreResult).
 *
 * @param {Object} userMeasurements - Raw user body measurements
 * @param {Object} garmentAttributes - Raw garment attributes
 * @param {Array} stylingGoals - Optional styling goals
 * @param {Object} context - Optional context (occasion, culture, etc.)
 * @returns {Object} ScoreResult as dict
 */
export function score(userMeasurements, garmentAttributes, stylingGoals = null, context = null) {
    const bodyProfile = buildBodyProfile(userMeasurements, stylingGoals);
    const garmentProfile = buildGarmentProfile(garmentAttributes);
    const scoreResult = scoreGarment(garmentProfile, bodyProfile, context);
    return scoreResultToDict(scoreResult);
}

// ================================================================
// SERIALIZATION HELPERS
// ================================================================

function scoreResultToDict(result) {
    return {
        overall_score: result.overall_score,
        composite_raw: result.composite_raw,
        confidence: result.confidence,
        principle_scores: (result.principle_scores || []).map(p => ({
            name: p.name,
            score: p.score,
            reasoning: p.reasoning,
            weight: p.weight,
            applicable: p.applicable,
            confidence: p.confidence,
            prompt_input_reasoning: p.prompt_input_reasoning || [],
        })),
        goal_verdicts: (result.goal_verdicts || []).map(g => ({
            goal: g.goal?.value || g.goal,
            verdict: g.verdict,
            score: g.score,
            supporting_principles: g.supporting_principles,
            reasoning: g.reasoning,
        })),
        zone_scores: result.zone_scores ? Object.fromEntries(
            Object.entries(result.zone_scores).map(([k, v]) => [k, {
                zone: v.zone,
                score: v.score,
                flags: v.flags,
            }])
        ) : {},
        exceptions: (result.exceptions || []).map(e => ({
            exception_id: e.exception_id,
            rule_overridden: e.rule_overridden,
            reason: e.reason,
            confidence: e.confidence,
        })),
        fixes: (result.fixes || []).map(f => ({
            what_to_change: f.what_to_change,
            expected_improvement: f.expected_improvement,
            priority: f.priority,
        })),
        body_adjusted: result.body_adjusted ? {
            hem_from_floor: result.body_adjusted.hem_from_floor,
            hem_zone: result.body_adjusted.hem_zone,
            hemline_danger_zones: result.body_adjusted.hemline_danger_zones,
            hemline_safe_zone: result.body_adjusted.hemline_safe_zone,
            fabric_rise_adjustment: result.body_adjusted.fabric_rise_adjustment,
            sleeve_endpoint_position: result.body_adjusted.sleeve_endpoint_position,
            perceived_arm_width: result.body_adjusted.perceived_arm_width,
            arm_width_delta: result.body_adjusted.arm_width_delta,
            arm_prominence_severity: result.body_adjusted.arm_prominence_severity,
            visual_waist_height: result.body_adjusted.visual_waist_height,
            visual_leg_ratio: result.body_adjusted.visual_leg_ratio,
            proportion_improvement: result.body_adjusted.proportion_improvement,
            total_stretch_pct: result.body_adjusted.total_stretch_pct,
            effective_gsm: result.body_adjusted.effective_gsm,
            sheen_score: result.body_adjusted.sheen_score,
            photo_reality_discount: result.body_adjusted.photo_reality_discount,
        } : null,
        reasoning_chain: result.reasoning_chain,
        layer_modifications: result.layer_modifications,
        styling_notes: result.styling_notes,
    };
}

function bodyProfileToDict(profile) {
    const dict = { ...profile };

    // Explicitly copy getter values (spread doesn't copy getters)
    dict.body_shape = profile.body_shape;
    dict.torso_leg_ratio = profile.torso_leg_ratio;
    dict.whr = profile.whr;
    dict.bust_differential = profile.bust_differential;
    dict.leg_ratio = profile.leg_ratio;
    dict.is_petite = profile.is_petite;
    dict.is_tall = profile.is_tall;
    dict.is_plus_size = profile.is_plus_size;

    // Convert enums to values
    if (dict.body_shape?.value) dict.body_shape = dict.body_shape.value;
    if (dict.skin_undertone?.value) dict.skin_undertone = dict.skin_undertone.value;
    if (dict.styling_goals) {
        dict.styling_goals = dict.styling_goals.map(entry => {
            if (typeof entry === 'object' && entry.goal) {
                return { goal: entry.goal?.value || entry.goal, weight: entry.weight };
            }
            return entry?.value || entry;
        });
    }
    return dict;
}

function garmentProfileToDict(profile) {
    const dict = { ...profile };

    // Explicitly copy getter values (spread doesn't copy getters)
    dict.is_dark = profile.is_dark;
    dict.sheen_index = profile.sheen_index;
    dict.drape_coefficient = profile.drape_coefficient;
    dict.cling_risk = profile.cling_risk;

    // Convert enums to values
    if (dict.category?.value) dict.category = dict.category.value;
    if (dict.neckline?.value) dict.neckline = dict.neckline.value;
    if (dict.sleeve_type?.value) dict.sleeve_type = dict.sleeve_type.value;
    if (dict.silhouette?.value) dict.silhouette = dict.silhouette.value;
    if (dict.construction?.value) dict.construction = dict.construction.value;
    if (dict.surface?.value) dict.surface = dict.surface.value;
    if (dict.layer?.value) dict.layer = dict.layer.value;
    return dict;
}





// write a function call to buildGarmentProfile with the garmentAttrs
// if this file is executed directly, print the garmentProfile
if (import.meta.url === `file://${process.argv[1]}`) {

    let userMeasurements = {
        chest_circumference: 81.28,
        waist_circumference: 66.04,
        hip_circumference: 99.06,
        shoulder_breadth: 36.83,
        neck_circumference: 31.75,
        thigh_left_circumference: 58.42,
        ankle_left_circumference: 21.59,
        arm_right_length: 53.34,
        inside_leg_height: 68.58,
        height: 154.94,
        body_shape: 'pear',
        size_category: 'standard',
        knee_from_floor: 12.69,
        mid_calf_from_floor: 8.5,
        widest_calf_from_floor: 9.52,
        ankle_from_floor: 3.5,
        natural_waist_from_shoulder: 25,
        natural_waist_from_floor: 36,
        styling_goals: [ 'look_taller', 'minimize_hips' ],
        waist_hip_ratio: 0.67,
        bust_hip_ratio: 0.82,
        shoulder_hip_ratio: 1.17,
        torso_leg_ratio: 0.93,
        height_category: 'petite',
        compound_types: [ 'pear', 'petite' ],
        mid_thigh_from_floor: 19.44,
        elbow_from_shoulder: 11.97,
        widest_upper_arm_from_shoulder: 6.93
      }
    let garmentAttributes = {
        "neckline_type": "boat_neck",
        "neckline_depth": "shallow",
        "neckline_width": "medium",
        "sleeve_type": "short",
        "sleeve_width": "relaxed",
        "silhouette_type": "a_line",
        "waistline": "undefined",
        "waist_definition": "undefined",
        "fit_category": "relaxed",
        "color_primary": "white",
        "color_value": "medium",
        "color_temperature": "cool",
        "color_saturation": "muted",
        "pattern_type": "floral_large",
        "pattern_scale": "large",
        "pattern_contrast": "high",
        "pattern_direction": "mixed",
        "fabric_sheen": "subtle_sheen",
        "fabric_opacity": "opaque",
        "fabric_drape": "fluid",
        "fabric_texture": "smooth",
        "has_darts": false,
        "has_seaming": true,
        "has_ruching": false,
        "has_draping": false,
        "has_pleats": false,
        "has_gathering": false,
        "fabric_body_interaction": "skimming",
        "fabric_stretch_visible": false,
        "fabric_pulling_at_seams": false,
        "fabric_gapping": false,
        "fabric_bunching": false,
        "fabric_primary": "Rayon",
        "fabric_secondary": null,
        "fabric_composition": "Rayon 100%",
        "stretch_percentage": null,
        "model_height_inches": 0,
        "model_size_worn": "M",
        "model_bust": 0,
        "model_waist": 0,
        "model_hips": 0,
        "hemline_position": "midi",
        "garment_length_inches": null,
        "fabric_weight": "heavy",
        "garment_type": "dress",
        "title": "Puff-Sleeved Dress - White/navy blue patterned - Ladies | H&M US",
        "brand": null,
        "price": null,
        "care_instructions": null,
        "image_confidence": "medium",
        "text_confidence": "high"
      }
    let bodyProfile = new BodyProfile({
        height: 60.99999999999999,
        bust: 31.999999999999996,
        underbust: 27.999999999999996,
        waist: 26,
        hip: 39,
        shoulder_width: 14.499999999999998,
        neck_length: 3.5,
        neck_circumference: 12.499999999999998,
        torso_length: 25,
        leg_length_visual: 36,
        inseam: 26.999999999999996,
        arm_length: 21,
        c_upper_arm_max: 11,
        c_upper_arm_max_position: 3,
        c_elbow: 10,
        c_forearm_max: 9.5,
        c_forearm_min: 8.5,
        c_forearm_min_position: 17,
        c_wrist: 6.5,
        h_knee: 12.69,
        h_calf_max: 9.52,
        h_calf_min: 8.5,
        h_ankle: 3.5,
        c_thigh_max: 23,
        c_calf_max: 13.600000000000001,
        c_calf_min: 9,
        c_ankle: 8.5,
        bust_projection: 2,
        belly_projection: 1,
        hip_projection: 1.5,
        body_composition: 'average',
        tissue_firmness: 0.5,
        skin_tone_L: 50,
        contour_smoothness: 0.5,
        skin_undertone: 'neutral',
        skin_darkness: 0.5,
        belly_zone: 0,
        hip_zone: 0,
        upper_arm_zone: 0,
        bust_zone: 0,
        is_athletic: false,
        styling_goals: [
          { goal: 'look_taller', weight: 1 },
          { goal: 'slim_hips', weight: 1 },
          { goal: 'highlight_waist', weight: 0.25 },
          { goal: 'look_proportional', weight: 0.25 }
        ],
        style_philosophy: 'balance',
        _body_shape_override: 'pear',
        _torso_leg_ratio_override: 0.93,
        climate: 'temperate',
        wear_context: 'general',
        goal_bust: null,
        goal_waist: null,
        goal_belly: null,
        goal_hip: null,
        goal_arm: null,
        goal_neck: null,
        goal_legs: null,
        goal_shoulders: null
    });
    let garmentProfile = new GarmentProfile({
        primary_fiber: 'rayon',
        primary_fiber_pct: 100,
        secondary_fiber: null,
        secondary_fiber_pct: 0,
        elastane_pct: 0,
        fabric_name: null,
        construction: 'woven',
        gsm_estimated: 120,
        gsm_confidence: 'low',
        surface: 'subtle_sheen',
        surface_friction: 0.6,
        drape: 7,
        category: 'dress',
        silhouette: 'a_line',
        expansion_rate: 0.1,
        silhouette_label: 'fitted',
        neckline: 'boat',
        v_depth_cm: 3,
        neckline_depth: null,
        sleeve_type: 'short',
        sleeve_length_inches: null,
        sleeve_ease_inches: 2,
        rise_cm: null,
        waistband_width_cm: 3,
        waistband_stretch_pct: 5,
        waist_position: 'no_waist',
        has_waist_definition: false,
        hem_position: 'midi',
        garment_length_inches: null,
        covers_waist: true,
        covers_hips: true,
        zone: 'full_body',
        color_lightness: 0.5,
        color_saturation: 0.5,
        color_temperature: 'cool',
        is_monochrome_outfit: false,
        has_pattern: true,
        pattern_type: 'floral_large',
        has_horizontal_stripes: false,
        has_vertical_stripes: false,
        stripe_width_cm: 0,
        stripe_spacing_cm: 0,
        pattern_scale: 'large',
        pattern_scale_inches: 0,
        pattern_contrast: 0.8,
        has_contrasting_belt: false,
        has_tonal_belt: false,
        belt_width_cm: 0,
        is_structured: false,
        has_darts: false,
        has_lining: false,
        is_faux_wrap: false,
        garment_ease_inches: 4,
        brand_tier: 'mid_market',
        uses_diverse_model: false,
        model_estimated_size: 8,
        model_height_inches: 0,
        garment_layer: 'base',
        title: 'Puff-Sleeved Dress - White/navy blue patterned - Ladies | H&M US',
        fit_category: 'relaxed',
        top_hem_length: null,
        top_hem_behavior: null,
        rise: null,
        leg_shape: null,
        leg_opening_width: null,
        bottom_length: null,
        jacket_closure: null,
        jacket_length: null,
        shoulder_structure: null,
        skirt_construction: null
    });
    let stylingGoals = [ 'look_taller', 'minimize_hips' ]
    let context = null
    let userName = 'You'
    let result = scoreAndCommunicate(userMeasurements, garmentAttributes, stylingGoals, context, userName);
    // let result = scoreGarment(garmentProfile, bodyProfile, context);
    console.log(JSON.stringify(result, null, 2));
    
}
