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
    const bodyProfile = buildBodyProfile(userMeasurements, stylingGoals);
    const garmentProfile = buildGarmentProfile(garmentAttributes);

    // Score the garment
    const scoreResult = scoreGarment(garmentProfile, bodyProfile, context);

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
        dict.styling_goals = dict.styling_goals.map(g => g?.value || g);
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
