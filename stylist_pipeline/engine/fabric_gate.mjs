/**
 * Kridha Production Scoring Engine - Fabric Gate
 * ===============================================
 * Resolves fabric properties and applies gate rules.
 */

import {
    ExceptionTriggered,
    Silhouette,
    NecklineType,
    clamp,
} from './schemas.mjs';

import {
    ELASTANE_MULTIPLIERS,
    FIBER_GSM_MULTIPLIERS,
    SHEEN_MAP,
    getFabricData,
} from './rules_data.mjs';

// ================================================================
// RESOLVED FABRIC PROPERTIES
// ================================================================

export class ResolvedFabric {
    constructor(data = {}) {
        this.total_stretch_pct = data.total_stretch_pct ?? 0.0;
        this.effective_gsm = data.effective_gsm ?? 150.0;
        this.sheen_score = data.sheen_score ?? 0.10;
        this.drape_coefficient = data.drape_coefficient ?? 50.0;
        this.cling_risk_base = data.cling_risk_base ?? 0.3;
        this.is_structured = data.is_structured ?? false;
        this.photo_reality_discount = data.photo_reality_discount ?? 0.0;
        this.surface_friction = data.surface_friction ?? 0.5;
    }
}

export function resolveFabricProperties(garment) {
    // Look up fabric if name is provided
    let fabricData = null;
    if (garment.fabric_name) {
        fabricData = getFabricData(garment.fabric_name);
    }

    // Construction multiplier
    const constructionKey = garment.construction;
    // const elastaneMult = ELASTANE_MULTIPLIERS[constructionKey] ?? 2.0;
    // let totalStretch = garment.elastane_pct * elastaneMult;
    const elastanePct = constructionKey ? ELASTANE_MULTIPLIERS[constructionKey] : null;
    let totalStretch = elastanePct ? garment.elastane_pct * elastanePct : null;

    // If fabric lookup provides typical_stretch and we have no elastane info, use it
    if (fabricData && garment.elastane_pct === 0 && fabricData.typical_stretch > 0) {
        totalStretch = fabricData.typical_stretch;
    }

    // Fiber GSM multiplier
    // const fiberMult = FIBER_GSM_MULTIPLIERS[garment.primary_fiber] ?? 1.0;
    // const effectiveGsm = garment.gsm_estimated * fiberMult;
    const fiberMult = garment.primary_fiber ? FIBER_GSM_MULTIPLIERS[garment.primary_fiber] : null;
    const effectiveGsm = fiberMult ? garment.gsm_estimated * fiberMult : null;

    // Sheen score
    // const sheen = SHEEN_MAP[garment.surface] ?? 0.10;
    const sheen = garment.surface ? SHEEN_MAP[garment.surface] : null;

    // Drape coefficient (convert 1-10 scale to %)
    // const drapeCoeff = garment.drape * 10.0;
    const drapeCoeff = garment.drape ? garment.drape * 10.0 : null;

    // Base cling risk
    const gsmFactor = effectiveGsm ? Math.max(0, 1.0 - effectiveGsm / 300.0) : null;
    const frictionFactor = garment.surface_friction ? Math.max(0, 1.0 - garment.surface_friction) : null;
    const clingBase = totalStretch && gsmFactor && frictionFactor ? Math.min(1.0, (totalStretch / 20.0 + gsmFactor + frictionFactor) / 3.0) : null;

    return new ResolvedFabric({
        total_stretch_pct: totalStretch,
        effective_gsm: effectiveGsm,
        sheen_score: sheen,
        drape_coefficient: drapeCoeff,
        cling_risk_base: clingBase,
        is_structured: garment.is_structured || garment.has_lining,
        photo_reality_discount: 0.0,
        surface_friction: garment.surface_friction,
    });
}

// ================================================================
// CLING RISK MODEL
// ================================================================

export class ClingResult {
    constructor(data = {}) {
        this.stretch_demand_pct = data.stretch_demand_pct ?? 0.0;
        this.base_threshold = data.base_threshold ?? 50.0;
        this.exceeds_threshold = data.exceeds_threshold ?? false;
        this.severity = data.severity ?? 0.0;
    }
}

export function computeClingRisk(resolved, zoneCirc, garmentRestCirc, curvatureRate) {
    let stretchRange = garmentRestCirc * (resolved.total_stretch_pct / 100.0);
    if (stretchRange <= 0) stretchRange = 0.01;

    let stretchDemand = ((zoneCirc - garmentRestCirc) / stretchRange) * 100.0;
    stretchDemand = Math.max(0, stretchDemand);

    const baseThreshold = Math.max(10, 62 - 26 * curvatureRate);
    const exceeds = stretchDemand > baseThreshold;

    let severity = 0.0;
    if (exceeds && baseThreshold > 0) {
        severity = Math.min(1.0, (stretchDemand - baseThreshold) / baseThreshold);
    }

    return new ClingResult({
        stretch_demand_pct: stretchDemand,
        base_threshold: baseThreshold,
        exceeds_threshold: exceeds,
        severity,
    });
}

// ================================================================
// PHOTO-TO-REALITY DISCOUNT
// ================================================================

const REF_MODEL = {
    bust: 34.0,
    waist: 25.0,
    hip: 35.0,
    upper_arm: 10.0,
    thigh: 20.0,
};

const ZONE_GAP_COEFFICIENTS = {
    bust: 0.08,
    waist: 0.06,
    hip: 0.10,
    upper_arm: 0.04,
    thigh: 0.07,
};

const BRAND_MULTIPLIERS = {
    luxury: 0.85,
    premium: 0.90,
    mid_market: 1.00,
    mass_market: 1.10,
    fast_fashion: 1.20,
};

export function photoToRealityDiscount(garment, body) {
    let totalGap = 0.0;
    const zones = {
        bust: [body.bust, REF_MODEL.bust],
        waist: [body.waist, REF_MODEL.waist],
        hip: [body.hip, REF_MODEL.hip],
        upper_arm: [body.c_upper_arm_max, REF_MODEL.upper_arm],
        thigh: [body.c_thigh_max, REF_MODEL.thigh],
    };

    for (const [zoneName, [userCirc, modelCirc]] of Object.entries(zones)) {
        const gap = Math.abs(userCirc - modelCirc);
        const coeff = ZONE_GAP_COEFFICIENTS[zoneName] ?? 0.05;
        totalGap += gap * coeff;
    }

    const brandMult = BRAND_MULTIPLIERS[garment.brand_tier] ?? 1.0;
    const discount = Math.min(0.55, totalGap * brandMult);

    return discount;
}

// ================================================================
// GATE RULES
// ================================================================

export function runFabricGates(garment, body, resolved) {
    const exceptions = [];

    // Gate 1: Dark + shiny inversion
    if (garment.is_dark && resolved.sheen_score > 0.50) {
        exceptions.push(new ExceptionTriggered({
            exception_id: "GATE_DARK_SHINY",
            rule_overridden: "dark_slimming",
            reason: `Dark (L=${garment.color_lightness.toFixed(2)}) + high sheen (SI=${resolved.sheen_score.toFixed(2)}): sheen amplifies body contours, partially negating dark slimming benefit`,
            confidence: 0.80,
        }));
    }

    // Gate 2: A-line drape override (shelf effect)
    if (garment.silhouette === Silhouette.A_LINE && resolved.drape_coefficient >= 65) {
        exceptions.push(new ExceptionTriggered({
            exception_id: "GATE_ALINE_SHELF",
            rule_overridden: "aline_balance",
            reason: `A-line + stiff fabric (DC=${resolved.drape_coefficient.toFixed(0)}%): fabric won't drape, creates shelf effect at hips`,
            confidence: 0.82,
        }));
    }

    // Gate 3: Wrap dress gapping risk
    if (garment.neckline === NecklineType.WRAP &&
        body.bust_differential >= 6 &&
        resolved.surface_friction < 0.3) {
        exceptions.push(new ExceptionTriggered({
            exception_id: "GATE_WRAP_GAPPING",
            rule_overridden: "wrap_neckline",
            reason: `Wrap neckline + large bust (BD=${body.bust_differential.toFixed(1)}") + slippery fabric (friction=${resolved.surface_friction.toFixed(2)}): high gaping risk`,
            confidence: 0.75,
        }));
    }

    // Gate 4: Tailoring override (structured garments)
    if (resolved.is_structured) {
        exceptions.push(new ExceptionTriggered({
            exception_id: "GATE_STRUCTURED",
            rule_overridden: "negative_penalties",
            reason: "Structured garment (boning/lining): negative penalties reduced ~70% - construction provides body sculpting",
            confidence: 0.85,
        }));
    }

    // Gate 5: Fluid fabric at apple belly
    if (resolved.drape_coefficient > 60 &&
        body.belly_zone > 0.3 &&
        ![Silhouette.FITTED, Silhouette.SEMI_FITTED].includes(garment.silhouette)) {
        exceptions.push(new ExceptionTriggered({
            exception_id: "GATE_FLUID_APPLE_BELLY",
            rule_overridden: "tent_concealment",
            reason: `Fluid/drapey fabric (DC=${resolved.drape_coefficient.toFixed(0)}%) on belly concern zone (${body.belly_zone.toFixed(2)}): fabric clings to belly contour instead of skimming`,
            confidence: 0.72,
        }));
    }

    // Gate 6: Cling trap
    if (resolved.sheen_score < 0.30 &&
        resolved.cling_risk_base > 0.6 &&
        (body.is_plus_size || body.hip_zone > 0.5 || body.belly_zone > 0.5)) {
        exceptions.push(new ExceptionTriggered({
            exception_id: "GATE_CLING_TRAP",
            rule_overridden: "matte_zone",
            reason: `Matte (SI=${resolved.sheen_score.toFixed(2)}) but clingy (cling=${resolved.cling_risk_base.toFixed(2)}): creates second-skin effect on curves, overriding matte benefit`,
            confidence: 0.78,
        }));
    }

    return exceptions;
}

export function getStructuredPenaltyReduction(exceptions) {
    for (const ex of exceptions) {
        if (ex.exception_id === "GATE_STRUCTURED") {
            return 0.30;
        }
    }
    return 1.0;
}
