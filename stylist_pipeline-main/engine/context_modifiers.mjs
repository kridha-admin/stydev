/**
 * Kridha Production Scoring Engine - Context Modifiers
 * =====================================================
 * Cultural, occasion, age, and climate modifiers loaded from the
 * golden registry context_rules.json (47 rules).
 *
 * These modifiers adjust scores in Layer 6 of the pipeline.
 */

// ================================================================
// CONTEXT MODIFIER CATEGORIES
// ================================================================

// Color symbolism by culture (from context_rules.json CTX_001-CTX_010)
const COLOR_SYMBOLISM = {
    india: {
        red: { wedding_bride: +0.95, wedding_guest: -0.30, general: 0.0 },
        white: { celebration: -0.90, funeral: +0.50, general: 0.0 },
        black: { wedding_ceremony: -0.70, sangeet: -0.20, general: 0.0 },
        gold: { wedding: +0.80, general: +0.20 },
    },
    us: {
        red: { general: 0.0 },
        white: { wedding_bride: +0.90, wedding_guest: -0.50, general: 0.0 },
        black: { evening: +0.90, funeral: +0.50, general: 0.0 },
    },
};

// Occasion coverage requirements
const OCCASION_COVERAGE = {
    formal: {
        min_sleeve: "short",
        min_hem: "knee",
        max_neckline_depth: 4.0,
        structured_preferred: true,
    },
    business: {
        min_sleeve: "short",
        min_hem: "above_knee",
        max_neckline_depth: 5.0,
        structured_preferred: true,
    },
    business_casual: {
        min_sleeve: "sleeveless",
        min_hem: "above_knee",
        max_neckline_depth: 6.0,
        structured_preferred: false,
    },
    casual: {
        min_sleeve: "sleeveless",
        min_hem: "mini",
        max_neckline_depth: 8.0,
        structured_preferred: false,
    },
    date_night: {
        min_sleeve: "sleeveless",
        min_hem: "above_knee",
        max_neckline_depth: 7.0,
        structured_preferred: false,
    },
    wedding_guest: {
        min_sleeve: "sleeveless",
        min_hem: "knee",
        max_neckline_depth: 5.0,
        structured_preferred: false,
    },
    interview: {
        min_sleeve: "short",
        min_hem: "knee",
        max_neckline_depth: 5.0,
        structured_preferred: true,
    },
    athletic: {
        min_sleeve: "sleeveless",
        min_hem: "mini",
        max_neckline_depth: 6.0,
        structured_preferred: false,
    },
    brunch: {
        min_sleeve: "sleeveless",
        min_hem: "above_knee",
        max_neckline_depth: 7.0,
        structured_preferred: false,
    },
    evening: {
        min_sleeve: "sleeveless",
        min_hem: "above_knee",
        max_neckline_depth: 8.0,
        structured_preferred: false,
    },
};

// Hem position ordering for comparison
const HEM_ORDER = [
    "floor", "ankle", "below_calf", "midi", "below_knee",
    "knee", "above_knee", "mini",
];

function hemIsAbove(actual, minimum) {
    try {
        const actualIdx = HEM_ORDER.indexOf(actual);
        const minIdx = HEM_ORDER.indexOf(minimum);
        if (actualIdx === -1 || minIdx === -1) return false;
        return actualIdx > minIdx; // higher index = shorter
    } catch {
        return false;
    }
}

// ================================================================
// MAIN MODIFIER FUNCTION
// ================================================================

/**
 * Apply context modifiers and return adjustments.
 *
 * @param {Object} context - Dict with optional keys:
 *   - occasion: str (formal, business, casual, athletic)
 *   - culture: str (india, us, etc.)
 *   - event_type: str (wedding_bride, wedding_guest, funeral, etc.)
 *   - garment_color: str (red, white, black, gold, etc.)
 *   - age_range: str (18-25, 25-35, 35-50, 50+)
 *   - climate: str (hot_humid, hot_dry, temperate, cold)
 * @param {Array} principles - List of PrincipleResult objects
 * @param {Object} body - BodyProfile
 * @param {Object} garment - GarmentProfile
 * @returns {Object} Dict of adjustment names -> score deltas
 */
export function applyContextModifiers(context, principles, body, garment) {
    const adjustments = {};

    // ── Cultural color modifiers ──
    const culture = (context.culture || "").toLowerCase();
    const eventType = context.event_type || "general";
    const garmentColor = (context.garment_color || "").toLowerCase();

    if (culture in COLOR_SYMBOLISM && garmentColor) {
        const colorRules = COLOR_SYMBOLISM[culture][garmentColor] || {};
        const culturalScore = colorRules[eventType] ?? colorRules.general ?? 0.0;
        if (culturalScore !== 0.0) {
            adjustments["cultural_color"] = culturalScore;
        }
    }

    // ── Occasion coverage check ──
    const occasion = (context.occasion || "").toLowerCase();
    if (occasion in OCCASION_COVERAGE) {
        const reqs = OCCASION_COVERAGE[occasion];

        // Hemline check
        if (hemIsAbove(garment.hem_position, reqs.min_hem)) {
            adjustments["occasion_hem_violation"] = -0.20;
        }

        // Neckline depth check
        const necklineDepth = garment.neckline_depth || (garment.v_depth_cm / 2.54);
        if (necklineDepth > (reqs.max_neckline_depth ?? 99)) {
            adjustments["occasion_neckline_violation"] = -0.15;
        }
    }

    // ── Climate modifiers ──
    const climate = (context.climate || "").toLowerCase();
    if (climate === "hot_humid") {
        // Prefer lighter fabrics
        if (garment.gsm_estimated > 250) {
            adjustments["climate_heavy_fabric"] = -0.10;
        }
        // Prefer breathable fibers
        if (["polyester", "nylon"].includes(garment.primary_fiber) && !garment.fabric_name) {
            adjustments["climate_non_breathable"] = -0.05;
        }
    } else if (climate === "cold") {
        if (garment.gsm_estimated < 120) {
            adjustments["climate_light_fabric"] = -0.10;
        }
    }

    // ── Age range modifiers (subtle) ──
    const ageRange = context.age_range || "";
    if (ageRange === "50+") {
        // Slightly prefer structured over bodycon for comfort
        for (const p of principles) {
            if (p.name === "Bodycon Mapping" && p.score > 0.20) {
                adjustments["age_bodycon_comfort"] = -0.05;
                break;
            }
        }
    } else if (ageRange === "18-25") {
        // Trend-forward tolerance slightly higher
        for (const p of principles) {
            if (p.name === "Tent Concealment" && p.score < -0.20) {
                adjustments["age_oversized_trend"] = +0.05;
                break;
            }
        }
    }

    return adjustments;
}
