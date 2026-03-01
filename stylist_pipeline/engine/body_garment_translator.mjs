/**
 * Kridha Production Scoring Engine - Body-Garment Translation
 * ============================================================
 * Projects how a garment will appear on the user's body.
 */

import {
    BodyAdjustedGarment,
    Silhouette,
    SleeveType,
    GarmentCategory,
    clamp,
} from './schemas.mjs';

import {
    GOLDEN_RATIO,
    WAIST_POSITION_MULTIPLIERS,
    HEM_TYPE_MODIFIERS,
    SHOULDER_WIDTH_MODIFIERS,
    HEEL_EFFICIENCY,
} from './rules_data.mjs';

import { resolveFabricProperties } from './fabric_gate.mjs';

// ================================================================
// HEMLINE TRANSLATION
// ================================================================

export class HemlineResult {
    constructor(data = {}) {
        this.hem_from_floor = data.hem_from_floor ?? 0.0;
        this.hem_zone = data.hem_zone ?? "";
        this.danger_zones = data.danger_zones ?? [];
        this.safe_zone = data.safe_zone ?? null;
        this.safe_zone_size = data.safe_zone_size ?? 0.0;
        this.fabric_rise = data.fabric_rise ?? 0.0;
        this.proportion_cut_ratio = data.proportion_cut_ratio ?? 0.0;
        this.narrowest_point_bonus = data.narrowest_point_bonus ?? 0.0;
    }
}

function hemLabelToHeight(label, body) {
    // Maps hemline labels to height-from-floor in inches.
    // "midi" = mid-shin, between widest calf and narrowest calf.
    // Previously mapped to body.h_calf_max (widest calf = center of danger zone),
    // guaranteeing -0.50 for every body. Now maps to midpoint of lower leg.
    const mapping = {
        mini: body.h_knee + 6,
        above_knee: body.h_knee + 3,
        knee: body.h_knee,
        below_knee: body.h_knee - 2,       // Was -3 (too aggressive, overshoots into calf danger)
        midi: (body.h_calf_max + body.h_calf_min) / 2,   // midpoint of calf region
        below_calf: body.h_calf_min,
        ankle: body.h_ankle + 2,
        floor: 1.0,
    };
    return mapping[label] ?? body.h_knee;
}

function fabricDrapeAdjustment(silhouette, fabricWeight, hipCirc, stomachProjection) {
    let rise = 0.0;

    if ([Silhouette.A_LINE, Silhouette.FIT_AND_FLARE].includes(silhouette)) {
        if (hipCirc > 40) rise += 1.0;
        if (stomachProjection > 2) rise += 0.5;
    }

    if (silhouette === Silhouette.FITTED) rise += 0.5;

    if (fabricWeight === "light") rise *= 1.3;
    else if (fabricWeight === "heavy") rise *= 0.7;

    return rise;
}

export function translateHemline(garment, body) {
    // Step 1: Compute hem_from_floor
    let hemFromFloor;
    if (garment.garment_length_inches !== null) {
        const scale = body.height / 66.0;
        hemFromFloor = body.height - (garment.garment_length_inches * scale);
    } else {
        hemFromFloor = hemLabelToHeight(garment.hem_position, body);
    }

    // Step 2: Fabric drape adjustment
    const fabricWeight = garment.gsm_estimated < 120 ? "light" :
        (garment.gsm_estimated > 280 ? "heavy" : "medium");
    const rise = fabricDrapeAdjustment(
        garment.silhouette, fabricWeight,
        body.hip, body.belly_projection
    );
    hemFromFloor += rise;

    // Step 3: Danger zones
    const kneeCenter = body.h_knee;
    const kneeDanger = [kneeCenter - 1.0, kneeCenter + 1.5];

    const calfWidest = body.h_calf_max;
    const calfProminence = body.calf_prominence;
    // Was 3.0 → radius of 2.83" with default prominence, swallowing entire below-knee zone.
    // With 1.5 multiplier + corrected c_calf_min default (prominence 1.261):
    //   radius = 1.0 + (1.261 - 1.0) * 1.5 = 1.39" — a focused zone around widest calf.
    const calfDangerRadius = 1.0 + (calfProminence - 1.0) * 1.5;
    const calfDanger = [calfWidest - calfDangerRadius, calfWidest + calfDangerRadius];

    const thighWidestH = body.h_knee + 6;
    const thighDanger = [thighWidestH - 1.0, thighWidestH + 1.0];

    const dangerZones = [thighDanger, kneeDanger, calfDanger];

    // Step 4: Safe zone
    const safeZoneTop = kneeDanger[0];
    const safeZoneBottom = calfDanger[1];
    const safeZoneSize = safeZoneTop - safeZoneBottom;

    let safeZone = null;
    if (safeZoneSize > 0) {
        safeZone = [safeZoneBottom, safeZoneTop];
    }

    // Step 5: Zone classification
    let hemZone;
    if (hemFromFloor > kneeCenter + 2.5) {
        hemZone = "above_knee";
    } else if (hemFromFloor > kneeDanger[1]) {
        hemZone = "above_knee_near";
    } else if (hemFromFloor >= kneeDanger[0]) {
        hemZone = "knee_danger";
    } else if (safeZoneSize > 0 && hemFromFloor > calfDanger[1]) {
        hemZone = "safe_zone";
    } else if (safeZoneSize <= 0 && hemFromFloor > calfDanger[1]) {
        hemZone = "collapsed_zone";
    } else if (hemFromFloor >= calfDanger[0]) {
        hemZone = "calf_danger";
    } else if (hemFromFloor > body.h_ankle + 2) {
        hemZone = "below_calf";
    } else if (hemFromFloor > body.h_ankle - 1) {
        hemZone = "ankle";
    } else {
        hemZone = "floor";
    }

    // Step 6: Proportion cut ratio
    const cutRatio = body.height > 0 ? hemFromFloor / body.height : 0.3;

    // Step 7: Narrowest-point bonus
    let narrowestBonus = 0.0;
    const narrowPoints = {
        ankle: { height: body.h_ankle + 2, bonus: 2 },
        lower_calf: { height: body.h_calf_min, bonus: 1 },
    };
    for (const point of Object.values(narrowPoints)) {
        if (Math.abs(hemFromFloor - point.height) <= 1.5) {
            narrowestBonus = Math.max(narrowestBonus, point.bonus);
        }
    }

    return new HemlineResult({
        hem_from_floor: hemFromFloor,
        hem_zone: hemZone,
        danger_zones: dangerZones,
        safe_zone: safeZone,
        safe_zone_size: safeZoneSize,
        fabric_rise: rise,
        proportion_cut_ratio: cutRatio,
        narrowest_point_bonus: narrowestBonus,
    });
}

// ================================================================
// SLEEVE TRANSLATION
// ================================================================

export class SleeveResult {
    constructor(data = {}) {
        this.endpoint_position = data.endpoint_position ?? 0.0;
        this.perceived_width = data.perceived_width ?? 0.0;
        this.actual_width = data.actual_width ?? 0.0;
        this.delta_vs_actual = data.delta_vs_actual ?? 0.0;
        this.arm_prominence_severity = data.arm_prominence_severity ?? 0.5;
        this.arm_prominence_radius = data.arm_prominence_radius ?? 1.0;
        this.score_from_delta = data.score_from_delta ?? 0.0;
        this.shoulder_width_effect = data.shoulder_width_effect ?? 0.0;
    }
}

function interpolateArmCirc(body, position) {
    const landmarks = [
        [0.0, body.shoulder_width / 2 * Math.PI / 2],
        [body.c_upper_arm_max_position, body.c_upper_arm_max],
        [body.arm_length * 0.52, body.c_elbow],
        [body.arm_length * 0.65, body.c_forearm_max],
        [body.c_forearm_min_position, body.c_forearm_min],
        [body.arm_length, body.c_wrist],
    ];

    if (position <= landmarks[0][0]) return landmarks[0][1];
    if (position >= landmarks[landmarks.length - 1][0]) return landmarks[landmarks.length - 1][1];

    for (let i = 0; i < landmarks.length - 1; i++) {
        const [p0, c0] = landmarks[i];
        const [p1, c1] = landmarks[i + 1];
        if (p0 <= position && position <= p1) {
            if (p1 === p0) return c0;
            const t = (position - p0) / (p1 - p0);
            return c0 + t * (c1 - c0);
        }
    }

    return body.c_upper_arm_max;
}

function armProminenceSeverity(body) {
    const combined = body.arm_prominence_combined;

    if (combined < 1.35) return [0.3, 0.5];
    if (combined < 1.50) return [0.5, 0.75];
    if (combined < 1.65) return [0.75, 1.0];
    if (combined < 1.80) return [1.0, 1.5];
    if (combined < 2.00) return [1.3, 2.0];
    if (combined < 2.20) return [1.6, 2.5];
    return [2.0, 3.0];
}

function sleeveTypeToPosition(sleeveType, body) {
    const map = {
        [SleeveType.SLEEVELESS]: [0.0, 0.0, "clean_hem"],
        [SleeveType.CAP]: [2.5, -0.5, "clean_hem"],
        [SleeveType.SHORT]: [6.0, 1.0, "clean_hem"],
        [SleeveType.THREE_QUARTER]: [17.0, 0.5, "clean_hem"],
        [SleeveType.LONG]: [body.arm_length, 0.0, "clean_hem"],
        [SleeveType.RAGLAN]: [body.arm_length, 1.0, "clean_hem"],
        [SleeveType.DOLMAN]: [body.arm_length, 12.0, "clean_hem"],
        [SleeveType.PUFF]: [4.0, 6.0, "elastic"],
        [SleeveType.FLUTTER]: [3.0, 3.0, "flutter"],
        [SleeveType.BELL]: [body.arm_length * 0.7, 8.0, "clean_hem"],
        [SleeveType.SET_IN]: [body.arm_length, 1.0, "clean_hem"],
    };
    return map[sleeveType] ?? [body.arm_length, 1.0, "clean_hem"];
}

export function translateSleeve(garment, body) {
    let endpoint, ease, hemType;
    if (garment.sleeve_length_inches !== null) {
        endpoint = garment.sleeve_length_inches;
        ease = garment.sleeve_ease_inches;
        hemType = "clean_hem";
    } else {
        [endpoint, ease, hemType] = sleeveTypeToPosition(garment.sleeve_type, body);
    }

    const actualCirc = interpolateArmCirc(body, endpoint);
    const actualWidth = actualCirc / Math.PI;

    let frameWidth;
    if (ease >= 0) {
        frameWidth = actualWidth + (ease / Math.PI);
    } else if (ease > -1.0) {
        frameWidth = actualWidth + (Math.abs(ease) * 0.3);
    } else {
        frameWidth = actualWidth + (Math.abs(ease) * 0.5);
    }

    const hemMod = HEM_TYPE_MODIFIERS[hemType] ?? 0.0;
    frameWidth += hemMod;

    let taperImpression = 0.0;
    if (endpoint < body.arm_length) {
        const midVisible = (endpoint + body.arm_length) / 2;
        const visibleCirc = interpolateArmCirc(body, midVisible);
        const avgVisibleWidth = visibleCirc / Math.PI;
        taperImpression = (avgVisibleWidth - frameWidth) * 0.4;
    }

    const perceivedWidth = frameWidth + taperImpression;

    let delta;
    if (endpoint <= body.c_upper_arm_max_position + 1.5) {
        const widestArmWidth = body.c_upper_arm_max / Math.PI;
        const capFrameDelta = frameWidth - widestArmWidth + 0.20;
        delta = Math.max(perceivedWidth - actualWidth, capFrameDelta);
    } else {
        delta = perceivedWidth - actualWidth;
    }

    const [severity, radius] = armProminenceSeverity(body);

    let score;
    if (delta > 0.30) score = -4.0;
    else if (delta > 0.15) score = -2.0;
    else if (delta > 0) score = -1.0;
    else if (delta > -0.30) score = 1.0;
    else if (delta > -0.60) score = 3.0;
    else score = 5.0;

    if (score < 0) {
        score *= severity;
    } else {
        score *= (1 + (severity - 1) * 0.5);
    }

    const sleeveKey = garment.sleeve_type;
    const shoulderEffect = SHOULDER_WIDTH_MODIFIERS[sleeveKey] ?? 0.0;

    return new SleeveResult({
        endpoint_position: endpoint,
        perceived_width: perceivedWidth,
        actual_width: actualWidth,
        delta_vs_actual: delta,
        arm_prominence_severity: severity,
        arm_prominence_radius: radius,
        score_from_delta: score,
        shoulder_width_effect: shoulderEffect,
    });
}

// ================================================================
// WAISTLINE TRANSLATION
// ================================================================

export class WaistlineResult {
    constructor(data = {}) {
        this.visual_waist_height = data.visual_waist_height ?? 0.0;
        this.visual_leg_ratio = data.visual_leg_ratio ?? 0.618;
        this.proportion_improvement = data.proportion_improvement ?? 0.0;
        this.proportion_score = data.proportion_score ?? 0.0;
        this.waist_position_label = data.waist_position_label ?? "natural";
    }
}

export function translateWaistline(garment, body) {
    const position = garment.waist_position;
    const multiplier = WAIST_POSITION_MULTIPLIERS[position];

    let visualWaistFromShoulder;
    if (multiplier === null || multiplier === undefined) {
        visualWaistFromShoulder = body.torso_length;
    } else {
        visualWaistFromShoulder = body.torso_length * multiplier;
    }

    const shift = body.torso_length - visualWaistFromShoulder;
    const perceptualShift = shift * 0.25;
    const visualLegLength = body.leg_length_visual + perceptualShift;
    const visualWaistHeight = body.height - body.torso_length + perceptualShift;
    const visualLegRatio = body.height > 0 ? visualLegLength / body.height : 0.618;

    const currentRatio = body.leg_ratio;
    const deviationBefore = Math.abs(currentRatio - GOLDEN_RATIO);
    const deviationAfter = Math.abs(visualLegRatio - GOLDEN_RATIO);
    const improvement = deviationBefore - deviationAfter;
    const proportionScore = clamp(improvement * 8.0, -0.80, 0.80);

    return new WaistlineResult({
        visual_waist_height: visualWaistHeight,
        visual_leg_ratio: visualLegRatio,
        proportion_improvement: improvement,
        proportion_score: proportionScore,
        waist_position_label: position,
    });
}

// ================================================================
// PROPORTION SHIFT
// ================================================================

export class ProportionResult {
    constructor(data = {}) {
        this.visual_leg_length = data.visual_leg_length ?? 0.0;
        this.heel_extension = data.heel_extension ?? 0.0;
        this.shoe_modifier = data.shoe_modifier ?? 0.0;
        this.total_visual_height = data.total_visual_height ?? 0.0;
    }
}

export function computeProportionShift(body, heelHeightInches = 0.0, isNudeShoe = false, isContrastShoe = false) {
    let efficiency = 0.70;
    for (const tier of HEEL_EFFICIENCY) {
        if (tier.min <= heelHeightInches && heelHeightInches < tier.max) {
            efficiency = tier.efficiency;
            break;
        }
    }

    const heelExtension = heelHeightInches * efficiency;

    let shoeMod = 0.0;
    if (isNudeShoe) shoeMod = Math.min(2.0, heelHeightInches * 0.3);
    if (isContrastShoe) shoeMod -= 1.0;

    const visualLegLength = body.leg_length_visual + heelExtension + shoeMod;
    const totalVisualHeight = body.height + heelExtension;

    return new ProportionResult({
        visual_leg_length: visualLegLength,
        heel_extension: heelExtension,
        shoe_modifier: shoeMod,
        total_visual_height: totalVisualHeight,
    });
}

// ================================================================
// MASTER TRANSLATION FUNCTION
// ================================================================

const HEM_CATEGORIES = new Set([
    GarmentCategory.DRESS, GarmentCategory.SKIRT,
    GarmentCategory.JUMPSUIT, GarmentCategory.ROMPER,
    GarmentCategory.COAT,
]);

const SLEEVE_CATEGORIES = new Set([
    GarmentCategory.DRESS, GarmentCategory.TOP,
    GarmentCategory.JUMPSUIT, GarmentCategory.ROMPER,
    GarmentCategory.JACKET, GarmentCategory.COAT,
    GarmentCategory.SWEATSHIRT, GarmentCategory.CARDIGAN,
    GarmentCategory.BODYSUIT, GarmentCategory.LOUNGEWEAR,
    GarmentCategory.ACTIVEWEAR,
    GarmentCategory.SAREE, GarmentCategory.SALWAR_KAMEEZ,
    GarmentCategory.LEHENGA,
]);

const WAIST_CATEGORIES = new Set([
    GarmentCategory.DRESS, GarmentCategory.JUMPSUIT,
    GarmentCategory.ROMPER, GarmentCategory.COAT,
    GarmentCategory.BOTTOM_PANTS, GarmentCategory.BOTTOM_SHORTS,
    GarmentCategory.SKIRT,
]);

export function translateGarmentToBody(garment, body) {
    const category = garment.category;

    let hemFromFloor = 0.0;
    let hemZone = "";
    let dangerZones = [];
    let safeZone = null;
    let fabricRise = 0.0;
    if (HEM_CATEGORIES.has(category)) {
        const hem = translateHemline(garment, body);
        hemFromFloor = hem.hem_from_floor;
        hemZone = hem.hem_zone;
        dangerZones = hem.danger_zones;
        safeZone = hem.safe_zone;
        fabricRise = hem.fabric_rise;
    }

    let sleeveEndpoint = 0.0;
    let perceivedWidth = 0.0;
    let armDelta = 0.0;
    let armSeverity = 0.5;
    if (SLEEVE_CATEGORIES.has(category)) {
        const sleeve = translateSleeve(garment, body);
        sleeveEndpoint = sleeve.endpoint_position;
        perceivedWidth = sleeve.perceived_width;
        armDelta = sleeve.delta_vs_actual;
        armSeverity = sleeve.arm_prominence_severity;
    }

    let visualWaistHeight = 0.0;
    let visualLegRatio = GOLDEN_RATIO;
    let proportionImprovement = 0.0;
    if (WAIST_CATEGORIES.has(category)) {
        const waist = translateWaistline(garment, body);
        visualWaistHeight = waist.visual_waist_height;
        visualLegRatio = waist.visual_leg_ratio;
        proportionImprovement = waist.proportion_improvement;
    }

    const resolved = resolveFabricProperties(garment);

    return new BodyAdjustedGarment({
        hem_from_floor: hemFromFloor,
        hem_zone: hemZone,
        hemline_danger_zones: dangerZones,
        hemline_safe_zone: safeZone,
        fabric_rise_adjustment: fabricRise,
        sleeve_endpoint_position: sleeveEndpoint,
        perceived_arm_width: perceivedWidth,
        arm_width_delta: armDelta,
        arm_prominence_severity: armSeverity,
        visual_waist_height: visualWaistHeight,
        visual_leg_ratio: visualLegRatio,
        proportion_improvement: proportionImprovement,
        total_stretch_pct: resolved.total_stretch_pct,
        effective_gsm: resolved.effective_gsm,
        sheen_score: resolved.sheen_score,
        photo_reality_discount: resolved.photo_reality_discount,
    });
}
