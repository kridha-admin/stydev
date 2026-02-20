/**
 * Kridha Production Scoring Engine - Rules & Data Layer
 * =====================================================
 * Constants, fabric lookup tables, and golden registry access.
 */

import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Paths
const REGISTRY_DIR = join(__dirname, '../../stydev/golden_registry');

// ================================================================
// CONSTANTS - Empirical values from domains 2, 3, 4
// ================================================================

export const GOLDEN_RATIO = 0.618;

// Fabric: elastane stretch multipliers by construction
export const ELASTANE_MULTIPLIERS = {
    woven: 1.6,
    knit: 4.0,
    knit_rib: 5.5,
    knit_double: 3.5,
    knit_jersey: 4.0,
};

// Fabric: fiber-adjusted GSM multipliers
export const FIBER_GSM_MULTIPLIERS = {
    cotton: 1.15,
    polyester: 1.00,
    silk: 0.85,
    wool: 1.10,
    rayon: 0.90,
    linen: 1.25,
    nylon: 0.95,
    tencel: 0.92,
    modal: 0.90,
    viscose: 0.90,
};

// Fabric: sheen map from surface finish
export const SHEEN_MAP = {
    deep_matte: 0.00,
    matte: 0.10,
    subtle_sheen: 0.25,
    moderate_sheen: 0.50,
    high_shine: 0.75,
    maximum_shine: 1.00,
    crushed: 0.35,
};

// Heel efficiency by height
export const HEEL_EFFICIENCY = [
    { min: 0, max: 3, efficiency: 0.70 },
    { min: 3, max: 5, efficiency: 0.60 },
    { min: 5, max: 99, efficiency: 0.50 },
];

// Hemline labels
export const HEM_LABELS = [
    "mini", "above_knee", "knee", "below_knee",
    "midi", "below_calf", "ankle", "floor",
];

// Waist position multipliers
export const WAIST_POSITION_MULTIPLIERS = {
    empire: 0.35,
    high: 0.65,
    natural: 1.0,
    drop: 1.15,
    no_waist: null,
};

// Sleeve types with typical parameters
export const SLEEVE_TYPES = {
    cap_sleeve: { range: [1.5, 3.0], ease: -0.5, hem: "clean_hem" },
    short_sleeve_above_elbow: { range: [4.0, 8.0], ease: 1.0, hem: "clean_hem" },
    three_quarter: { range: [15.0, 18.0], ease: 0.5, hem: "clean_hem" },
    full_length_fitted: { range: [22.0, 25.0], ease: 0.0, hem: "clean_hem" },
    full_length_loose: { range: [22.0, 25.0], ease: 3.0, hem: "clean_hem" },
    flutter_sleeve: { range: [2.0, 4.0], ease: 3.0, hem: "flutter" },
    bell_sleeve: { range: [12.0, 25.0], ease: 8.0, hem: "clean_hem" },
    puff_sleeve: { range: [2.0, 8.0], ease: 6.0, hem: "elastic" },
    dolman_batwing: { range: [22.0, 25.0], ease: 12.0, hem: "clean_hem" },
};

// Hem type modifiers on perceived width
export const HEM_TYPE_MODIFIERS = {
    clean_hem: 0.0,
    elastic: 0.15,
    soft_edge: -0.10,
    flutter: -0.20,
    rolled: 0.10,
};

// Shoulder width effect by sleeve type
export const SHOULDER_WIDTH_MODIFIERS = {
    set_in: 0.0,
    raglan: -0.5,
    dropped: -0.75,
    puff: 1.5,
    structured: 0.5,
    cap: 0.25,
    dolman: -0.5,
    off_shoulder: 0.0,
};

// Score scale definition
export const SCORE_SCALE = {
    "-1.0": "MAXIMUM NEGATIVE",
    "-0.7": "STRONG NEGATIVE",
    "-0.4": "MODERATE NEGATIVE",
    "-0.2": "MILD NEGATIVE",
    "0.0": "NEUTRAL",
    "0.2": "MILD POSITIVE",
    "0.4": "MODERATE POSITIVE",
    "0.7": "STRONG POSITIVE",
    "1.0": "MAXIMUM POSITIVE",
};

// V-neck optimal depth thresholds by body type
export const OPTIMAL_V_DEPTH = {
    petite: { min: 2.5, optimal: 3.5, max: 4.5 },
    tall: { min: 3.0, optimal: 4.5, max: 6.0 },
    pear: { min: 3.0, optimal: 4.0, max: 5.5 },
    apple: { min: 3.0, optimal: 4.0, max: 5.0 },
    hourglass: { min: 2.5, optimal: 3.5, max: 4.5 },
    hourglass_DD_plus: { min: 2.0, optimal: 3.0, max: 3.5 },
    rectangle: { min: 3.0, optimal: 4.5, max: 6.0 },
    inverted_triangle: { min: 3.0, optimal: 4.0, max: 5.0 },
    plus_size_large_bust: { min: 2.0, optimal: 3.0, max: 3.5 },
};

// Bust dividing thresholds by bust_differential
export const BUST_DIVIDING_THRESHOLDS = {
    4: 7.0,   // A-B cup
    5: 6.0,   // C cup
    6: 5.0,   // D cup
    7: 4.5,   // DD cup
    8: 4.0,   // E cup
    9: 3.5,   // F+ cup
};

// Confidence levels by principle
export const PRINCIPLE_CONFIDENCE = {
    v_neck_dividing_threshold: 0.85,
    boat_neck_inverted_triangle: 0.92,
    puff_inverted_triangle: 0.92,
    three_quarter_arm_slimming: 0.85,
    cap_sleeve_danger_zone: 0.80,
    hemline_zone_collision_petite: 0.82,
    hemline_sleeve_anatomical: 0.90,
    dark_color_slimming: 0.70,
    wrap_waist_apple: 0.72,
    turtleneck_column: 0.68,
    waist_placement_golden_ratio: 0.75,
    empire_tent_thresholds: 0.65,
    skin_tone_contrast: 0.60,
    stripe_effect_ashida: 0.55,
    pattern_scale_effect: 0.40,
    fit_flare_pear_origin: 0.50,
    cowl_bust_volume: 0.50,
    contour_smoothness: 0.45,
};

// Proportion cut ratio ideal ranges
export const PROPORTION_CUT_RATIOS = {
    mini: [0.40, 0.50],
    above_knee: [0.28, 0.35],
    below_knee: [0.22, 0.27],
    midi: [0.14, 0.18],
    ankle: [0.06, 0.10],
};

// ================================================================
// FABRIC LOOKUP TABLE (50 fabrics)
// ================================================================

export const FABRIC_LOOKUP = {
    cotton_poplin: {
        base_gsm: 120, fiber: "cotton", construction: "woven",
        surface: "matte", drape: 4, typical_stretch: 0,
    },
    cotton_jersey: {
        base_gsm: 180, fiber: "cotton", construction: "knit_jersey",
        surface: "matte", drape: 6, typical_stretch: 15,
    },
    silk_charmeuse: {
        base_gsm: 90, fiber: "silk", construction: "woven",
        surface: "moderate_sheen", drape: 9, typical_stretch: 0,
    },
    silk_chiffon: {
        base_gsm: 40, fiber: "silk", construction: "woven",
        surface: "subtle_sheen", drape: 10, typical_stretch: 0,
    },
    wool_flannel: {
        base_gsm: 280, fiber: "wool", construction: "woven",
        surface: "deep_matte", drape: 3, typical_stretch: 0,
    },
    wool_crepe: {
        base_gsm: 200, fiber: "wool", construction: "woven",
        surface: "matte", drape: 6, typical_stretch: 2,
    },
    ponte: {
        base_gsm: 300, fiber: "polyester", construction: "knit_double",
        surface: "subtle_sheen", drape: 4, typical_stretch: 20,
    },
    denim: {
        base_gsm: 350, fiber: "cotton", construction: "woven",
        surface: "matte", drape: 2, typical_stretch: 0,
    },
    stretch_denim: {
        base_gsm: 320, fiber: "cotton", construction: "woven",
        surface: "matte", drape: 3, typical_stretch: 8,
    },
    satin: {
        base_gsm: 130, fiber: "polyester", construction: "woven",
        surface: "moderate_sheen", drape: 8, typical_stretch: 0,
    },
    linen: {
        base_gsm: 180, fiber: "linen", construction: "woven",
        surface: "matte", drape: 3, typical_stretch: 0,
    },
    rayon_challis: {
        base_gsm: 110, fiber: "rayon", construction: "woven",
        surface: "subtle_sheen", drape: 8, typical_stretch: 0,
    },
    polyester_crepe: {
        base_gsm: 150, fiber: "polyester", construction: "woven",
        surface: "subtle_sheen", drape: 7, typical_stretch: 0,
    },
    modal_jersey: {
        base_gsm: 170, fiber: "modal", construction: "knit_jersey",
        surface: "subtle_sheen", drape: 7, typical_stretch: 20,
    },
    tencel_twill: {
        base_gsm: 200, fiber: "tencel", construction: "woven",
        surface: "subtle_sheen", drape: 6, typical_stretch: 0,
    },
    velvet: {
        base_gsm: 280, fiber: "polyester", construction: "woven",
        surface: "deep_matte", drape: 5, typical_stretch: 0,
    },
    crushed_velvet: {
        base_gsm: 250, fiber: "polyester", construction: "woven",
        surface: "crushed", drape: 6, typical_stretch: 5,
    },
    neoprene: {
        base_gsm: 350, fiber: "polyester", construction: "knit_double",
        surface: "matte", drape: 2, typical_stretch: 15,
    },
    organza: {
        base_gsm: 50, fiber: "polyester", construction: "woven",
        surface: "subtle_sheen", drape: 2, typical_stretch: 0,
    },
    tulle: {
        base_gsm: 30, fiber: "nylon", construction: "knit",
        surface: "subtle_sheen", drape: 3, typical_stretch: 5,
    },
    rib_knit: {
        base_gsm: 220, fiber: "cotton", construction: "knit_rib",
        surface: "matte", drape: 5, typical_stretch: 30,
    },
    french_terry: {
        base_gsm: 280, fiber: "cotton", construction: "knit",
        surface: "matte", drape: 4, typical_stretch: 10,
    },
    scuba: {
        base_gsm: 320, fiber: "polyester", construction: "knit_double",
        surface: "matte", drape: 3, typical_stretch: 12,
    },
    leather: {
        base_gsm: 500, fiber: "leather", construction: "woven",
        surface: "moderate_sheen", drape: 2, typical_stretch: 0,
    },
    faux_leather: {
        base_gsm: 350, fiber: "polyester", construction: "woven",
        surface: "high_shine", drape: 3, typical_stretch: 5,
    },
    viscose_twill: {
        base_gsm: 160, fiber: "viscose", construction: "woven",
        surface: "subtle_sheen", drape: 7, typical_stretch: 0,
    },
    cotton_sateen: {
        base_gsm: 150, fiber: "cotton", construction: "woven",
        surface: "subtle_sheen", drape: 5, typical_stretch: 0,
    },
    silk_crepe_de_chine: {
        base_gsm: 80, fiber: "silk", construction: "woven",
        surface: "subtle_sheen", drape: 8, typical_stretch: 0,
    },
    wool_gabardine: {
        base_gsm: 260, fiber: "wool", construction: "woven",
        surface: "matte", drape: 3, typical_stretch: 0,
    },
    chambray: {
        base_gsm: 140, fiber: "cotton", construction: "woven",
        surface: "matte", drape: 5, typical_stretch: 0,
    },
    tweed: {
        base_gsm: 320, fiber: "wool", construction: "woven",
        surface: "deep_matte", drape: 2, typical_stretch: 0,
    },
    sequin_mesh: {
        base_gsm: 200, fiber: "polyester", construction: "knit",
        surface: "maximum_shine", drape: 5, typical_stretch: 10,
    },
    spandex_blend: {
        base_gsm: 200, fiber: "nylon", construction: "knit",
        surface: "subtle_sheen", drape: 6, typical_stretch: 40,
    },
    poplin_stretch: {
        base_gsm: 130, fiber: "cotton", construction: "woven",
        surface: "matte", drape: 4, typical_stretch: 5,
    },
    chiffon_poly: {
        base_gsm: 50, fiber: "polyester", construction: "woven",
        surface: "subtle_sheen", drape: 9, typical_stretch: 0,
    },
    double_crepe: {
        base_gsm: 220, fiber: "polyester", construction: "woven",
        surface: "matte", drape: 5, typical_stretch: 2,
    },
    power_mesh: {
        base_gsm: 100, fiber: "nylon", construction: "knit",
        surface: "subtle_sheen", drape: 7, typical_stretch: 50,
    },
    bengaline: {
        base_gsm: 250, fiber: "polyester", construction: "woven",
        surface: "subtle_sheen", drape: 3, typical_stretch: 8,
    },
    jacquard: {
        base_gsm: 250, fiber: "polyester", construction: "woven",
        surface: "moderate_sheen", drape: 4, typical_stretch: 0,
    },
    brocade: {
        base_gsm: 300, fiber: "polyester", construction: "woven",
        surface: "moderate_sheen", drape: 3, typical_stretch: 0,
    },
    interlock_knit: {
        base_gsm: 200, fiber: "cotton", construction: "knit_double",
        surface: "matte", drape: 5, typical_stretch: 18,
    },
    bamboo_jersey: {
        base_gsm: 160, fiber: "viscose", construction: "knit_jersey",
        surface: "subtle_sheen", drape: 7, typical_stretch: 15,
    },
    wool_jersey: {
        base_gsm: 220, fiber: "wool", construction: "knit_jersey",
        surface: "matte", drape: 5, typical_stretch: 12,
    },
    terry_cloth: {
        base_gsm: 400, fiber: "cotton", construction: "woven",
        surface: "deep_matte", drape: 3, typical_stretch: 0,
    },
    crepe_back_satin: {
        base_gsm: 150, fiber: "polyester", construction: "woven",
        surface: "moderate_sheen", drape: 7, typical_stretch: 0,
    },
    lyocell_twill: {
        base_gsm: 190, fiber: "tencel", construction: "woven",
        surface: "subtle_sheen", drape: 6, typical_stretch: 0,
    },
    cupro: {
        base_gsm: 100, fiber: "viscose", construction: "woven",
        surface: "subtle_sheen", drape: 9, typical_stretch: 0,
    },
    taffeta: {
        base_gsm: 100, fiber: "polyester", construction: "woven",
        surface: "moderate_sheen", drape: 2, typical_stretch: 0,
    },
    mesh: {
        base_gsm: 80, fiber: "polyester", construction: "knit",
        surface: "subtle_sheen", drape: 6, typical_stretch: 20,
    },
    corduroy: {
        base_gsm: 300, fiber: "cotton", construction: "woven",
        surface: "deep_matte", drape: 3, typical_stretch: 0,
    },
    stretch_crepe: {
        base_gsm: 200, fiber: "polyester", construction: "woven",
        surface: "matte", drape: 6, typical_stretch: 5,
    },
    scuba_knit: {
        base_gsm: 300, fiber: "polyester", construction: "knit_double",
        surface: "subtle_sheen", drape: 3, typical_stretch: 15,
    },
    performance_knit: {
        base_gsm: 160, fiber: "polyester", construction: "knit",
        surface: "subtle_sheen", drape: 5, typical_stretch: 25,
    },
    double_georgette: {
        base_gsm: 100, fiber: "polyester", construction: "woven",
        surface: "subtle_sheen", drape: 8, typical_stretch: 0,
    },
    stretch_poplin: {
        base_gsm: 130, fiber: "cotton", construction: "woven",
        surface: "matte", drape: 4, typical_stretch: 5,
    },
};

// ================================================================
// GOLDEN REGISTRY LOADER
// ================================================================

const NESTED_KEY_MAP = {
    principles: "principle_id",
    rules: "rule_id",
    exceptions: "exception_id",
    thresholds: "threshold_id",
    body_type_modifiers: "modifier_id",
    contradictions: "contradiction_id",
    fabric_rules: "fabric_rule_id",
    context_rules: "context_rule_id",
    scoring_functions: "function_id",
};

const ID_FIELDS = [
    "principle_id", "rule_id", "exception_id", "threshold_id",
    "modifier_id", "contradiction_id", "fabric_rule_id",
    "context_rule_id", "function_id", "scoring_function_id",
];

function extractId(item) {
    for (const field of ID_FIELDS) {
        if (item[field]) return item[field];
    }
    return null;
}

function loadRegistryFile(filepath) {
    if (!existsSync(filepath)) return [];

    try {
        const data = JSON.parse(readFileSync(filepath, 'utf8'));
        if (!Array.isArray(data)) {
            return typeof data === 'object' ? [data] : [];
        }

        const items = [];
        for (const entry of data) {
            if (typeof entry !== 'object') continue;

            let foundNested = false;
            for (const nestedKey of Object.keys(NESTED_KEY_MAP)) {
                if (entry[nestedKey] && Array.isArray(entry[nestedKey])) {
                    items.push(...entry[nestedKey]);
                    foundNested = true;
                    break;
                }
            }
            if (!foundNested) items.push(entry);
        }
        return items;
    } catch (e) {
        console.warn(`Failed to load registry file ${filepath}:`, e.message);
        return [];
    }
}

export class GoldenRegistry {
    constructor(registryDir = REGISTRY_DIR) {
        this._registryDir = registryDir;
        this._byType = {};
        this._byId = {};
        this._confidence = {};
        this._loaded = false;
    }

    load() {
        const fileMap = {
            principles: "principles.json",
            rules: "rules.json",
            exceptions: "exceptions.json",
            thresholds: "thresholds.json",
            body_type_modifiers: "body_type_modifiers.json",
            contradictions: "contradictions.json",
            fabric_rules: "fabric_rules.json",
            context_rules: "context_rules.json",
            scoring_functions: "scoring_functions.json",
        };

        for (const [regType, filename] of Object.entries(fileMap)) {
            const filepath = join(this._registryDir, filename);
            const items = loadRegistryFile(filepath);
            this._byType[regType] = items;
            for (const item of items) {
                const itemId = extractId(item);
                if (itemId) this._byId[itemId] = item;
            }
        }

        this._loaded = true;
        return this;
    }

    getById(itemId) {
        return this._byId[itemId] || null;
    }

    getByType(regType) {
        return this._byType[regType] || [];
    }

    getConfidence(itemId) {
        return this._confidence[itemId] || null;
    }

    getItemConfidenceScore(itemId) {
        const conf = this._confidence[itemId];
        if (conf && conf.avg_confidence !== undefined) {
            return conf.avg_confidence;
        }
        const item = this._byId[itemId];
        if (item && item.confidence !== undefined) {
            return typeof item.confidence === 'number' ? item.confidence : 0.70;
        }
        return 0.70;
    }

    get totalItems() {
        return Object.keys(this._byId).length;
    }

    get typeCounts() {
        const counts = {};
        for (const [k, v] of Object.entries(this._byType)) {
            counts[k] = v.length;
        }
        return counts;
    }

    summary() {
        const lines = [`Golden Registry: ${this.totalItems} indexed items`];
        for (const [t, count] of Object.entries(this.typeCounts).sort()) {
            lines.push(`  ${t}: ${count}`);
        }
        lines.push(`  confidence entries: ${Object.keys(this._confidence).length}`);
        return lines.join('\n');
    }
}

// ================================================================
// SINGLETON REGISTRY INSTANCE
// ================================================================

let _registry = null;

export function getRegistry() {
    if (!_registry) {
        _registry = new GoldenRegistry().load();
    }
    return _registry;
}

export function reloadRegistry() {
    _registry = null;
    return getRegistry();
}

export function getFabricData(fabricName) {
    return FABRIC_LOOKUP[fabricName] || null;
}

export function getBustDividingThreshold(bustDifferential) {
    for (const [bdMax, threshold] of Object.entries(BUST_DIVIDING_THRESHOLDS).sort((a, b) => a[0] - b[0])) {
        if (bustDifferential <= parseInt(bdMax)) {
            return threshold;
        }
    }
    return 3.5;
}
