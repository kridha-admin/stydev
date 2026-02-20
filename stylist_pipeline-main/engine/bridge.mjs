/**
 * Kridha Bridge - Schema Converter
 * =================================
 * Converts pipeline output to typed BodyProfile and GarmentProfile.
 */

import {
    BodyProfile,
    BrandTier,
    FabricConstruction,
    GarmentCategory,
    GarmentLayer,
    GarmentProfile,
    NecklineType,
    Silhouette,
    SleeveType,
    StylingGoal,
    SurfaceFinish,
} from './schemas.mjs';

const CM_TO_IN = 1 / 2.54;

// ================================================================
// ENUM MAPPING TABLES
// ================================================================

const NECKLINE_MAP = {
    v_neck: NecklineType.V_NECK,
    crew_neck: NecklineType.CREW,
    scoop_neck: NecklineType.SCOOP,
    boat_neck: NecklineType.BOAT,
    square_neck: NecklineType.SQUARE,
    sweetheart: NecklineType.SCOOP,
    off_shoulder: NecklineType.OFF_SHOULDER,
    halter: NecklineType.HALTER,
    turtleneck: NecklineType.TURTLENECK,
    mock_neck: NecklineType.TURTLENECK,
    cowl_neck: NecklineType.COWL,
    wrap_surplice: NecklineType.WRAP,
    one_shoulder: NecklineType.OFF_SHOULDER,
    strapless: NecklineType.OFF_SHOULDER,
    collared: NecklineType.CREW,
    plunging: NecklineType.DEEP_V,
    keyhole: NecklineType.CREW,
    peter_pan: NecklineType.CREW,
    mandarin: NecklineType.TURTLENECK,
    henley: NecklineType.CREW,
    asymmetric: NecklineType.SCOOP,
};

const SILHOUETTE_MAP = {
    a_line: Silhouette.A_LINE,
    fit_and_flare: Silhouette.FIT_AND_FLARE,
    sheath: Silhouette.FITTED,
    bodycon: Silhouette.FITTED,
    shift: Silhouette.SHIFT,
    wrap: Silhouette.WRAP,
    mermaid: Silhouette.FITTED,
    cocoon: Silhouette.OVERSIZED,
    peplum: Silhouette.PEPLUM,
    empire: Silhouette.EMPIRE,
    column: Silhouette.SEMI_FITTED,
    tent: Silhouette.OVERSIZED,
    princess_seam: Silhouette.SEMI_FITTED,
    dropped_waist: Silhouette.SHIFT,
    tiered: Silhouette.A_LINE,
    asymmetric: Silhouette.SEMI_FITTED,
};

const SLEEVE_MAP = {
    sleeveless: SleeveType.SLEEVELESS,
    spaghetti_strap: SleeveType.SLEEVELESS,
    cap: SleeveType.CAP,
    short: SleeveType.SHORT,
    elbow: SleeveType.THREE_QUARTER,
    three_quarter: SleeveType.THREE_QUARTER,
    full_length: SleeveType.LONG,
    bell: SleeveType.BELL,
    puff: SleeveType.PUFF,
    raglan: SleeveType.RAGLAN,
    set_in: SleeveType.SET_IN,
    dolman: SleeveType.DOLMAN,
    flutter: SleeveType.FLUTTER,
    cold_shoulder: SleeveType.SHORT,
    bishop: SleeveType.BELL,
    lantern: SleeveType.PUFF,
    leg_of_mutton: SleeveType.PUFF,
    off_shoulder: SleeveType.SLEEVELESS,
};

const SHEEN_MAP = {
    matte: SurfaceFinish.MATTE,
    subtle_sheen: SurfaceFinish.SUBTLE_SHEEN,
    moderate_sheen: SurfaceFinish.MODERATE_SHEEN,
    shiny: SurfaceFinish.HIGH_SHINE,
};

const CATEGORY_MAP = {
    dress: GarmentCategory.DRESS,
    top: GarmentCategory.TOP,
    blouse: GarmentCategory.TOP,
    shirt: GarmentCategory.TOP,
    skirt: GarmentCategory.SKIRT,
    pants: GarmentCategory.BOTTOM_PANTS,
    jumpsuit: GarmentCategory.JUMPSUIT,
    romper: GarmentCategory.ROMPER,
    jacket: GarmentCategory.JACKET,
    coat: GarmentCategory.COAT,
    cardigan: GarmentCategory.CARDIGAN,
    sweater: GarmentCategory.SWEATSHIRT,
    shorts: GarmentCategory.BOTTOM_SHORTS,
};

const COLOR_LIGHTNESS_MAP = {
    very_dark: 0.10,
    dark: 0.20,
    medium_dark: 0.35,
    medium: 0.50,
    medium_light: 0.65,
    light: 0.80,
    very_light: 0.90,
};

const COLOR_SATURATION_MAP = {
    muted: 0.25,
    moderate: 0.50,
    vibrant: 0.80,
};

const PATTERN_CONTRAST_MAP = {
    low: 0.20,
    medium: 0.50,
    high: 0.80,
};

// GSM_MAP removed - now using 5-priority resolution chain in resolveFabricGsm()

const DRAPE_MAP = {
    stiff: 2.0,
    structured: 4.0,
    fluid: 7.0,
    very_drapey: 9.0,
};

const FIT_EXPANSION_MAP = {
    tight: 0.00,
    fitted: 0.02,
    semi_fitted: 0.05,
    relaxed: 0.10,
    loose: 0.18,
    oversized: 0.25,
};

const FIT_EASE_MAP = {
    tight: 0.0,
    fitted: 1.0,
    semi_fitted: 2.5,
    relaxed: 4.0,
    loose: 6.0,
    oversized: 8.0,
};

const HEM_POSITION_MAP = {
    mini: "mini",
    above_knee: "above_knee",
    at_knee: "knee",
    below_knee: "below_knee",
    midi: "midi",
    tea_length: "below_calf",
    ankle: "ankle",
    maxi: "ankle",
    floor_length: "floor",
    high_low: "knee",
};

const WAIST_POSITION_MAP = {
    empire: "empire",
    natural: "natural",
    drop: "drop",
    low: "drop",
    undefined: "no_waist",
    elasticized: "natural",
};

const FIBER_CONSTRUCTION_MAP = {
    cotton: FabricConstruction.WOVEN,
    linen: FabricConstruction.WOVEN,
    silk: FabricConstruction.WOVEN,
    rayon: FabricConstruction.WOVEN,
    viscose: FabricConstruction.WOVEN,
    polyester: FabricConstruction.WOVEN,
    nylon: FabricConstruction.WOVEN,
    wool: FabricConstruction.WOVEN,
    jersey: FabricConstruction.KNIT_JERSEY,
    knit: FabricConstruction.KNIT,
    ponte: FabricConstruction.KNIT_DOUBLE,
    rib: FabricConstruction.KNIT_RIB,
    denim: FabricConstruction.WOVEN,
    chiffon: FabricConstruction.WOVEN,
    satin: FabricConstruction.WOVEN,
    crepe: FabricConstruction.WOVEN,
    tweed: FabricConstruction.WOVEN,
    velvet: FabricConstruction.WOVEN,
};

const BODY_INTERACTION_MAP = {
    clinging: -0.03,
    skimming: 0.0,
    standing_away: 0.05,
    draping_away: 0.03,
};

const MODEL_APPARENT_SIZE_MAP = {
    xs: 0,
    s: 4,
    m: 8,
    l: 12,
    xl: 16,
    xxl: 18,
};

const GOAL_MAP = {
    look_taller: StylingGoal.LOOK_TALLER,
    highlight_waist: StylingGoal.HIGHLIGHT_WAIST,
    hide_midsection: StylingGoal.HIDE_MIDSECTION,
    slim_hips: StylingGoal.SLIM_HIPS,
    minimize_hips: StylingGoal.SLIM_HIPS,
    look_proportional: StylingGoal.LOOK_PROPORTIONAL,
    minimize_arms: StylingGoal.MINIMIZE_ARMS,
    hide_upper_arms: StylingGoal.MINIMIZE_ARMS,
    slimming: StylingGoal.SLIMMING,
    look_slimmer: StylingGoal.SLIMMING,
    elongate_legs: StylingGoal.LOOK_TALLER,
    streamline_silhouette: StylingGoal.SLIMMING,
    balance_shoulders: StylingGoal.BALANCE,
    create_curves: StylingGoal.EMPHASIS,
    minimize_bust: StylingGoal.CONCEALMENT,
    show_legs: StylingGoal.EMPHASIS,
};

// Fiber normalization
const FIBER_NORMALIZE = {
    rayon: "rayon", viscose: "viscose", livaeco: "viscose",
    "livaeco viscose": "viscose", polyester: "polyester", poly: "polyester",
    cotton: "cotton", silk: "silk", wool: "wool", merino: "wool",
    cashmere: "wool", linen: "linen", flax: "linen", nylon: "nylon",
    spandex: "nylon", elastane: "nylon", lycra: "nylon",
    tencel: "tencel", lyocell: "tencel", modal: "modal",
    micromodal: "modal", bamboo: "viscose", hemp: "linen",
    acetate: "viscose", triacetate: "viscose", cupro: "viscose",
    acrylic: "polyester",
};

// ================================================================
// HELPER FUNCTIONS
// ================================================================

function safeGet(d, key, defaultVal = null) {
    const val = d[key];
    return val !== undefined && val !== null ? val : defaultVal;
}

function mapEnum(value, mapping, defaultVal, label = "") {
    if (value === null || value === undefined) return defaultVal;
    const result = mapping[value];
    if (result === undefined) {
        console.warn(`Unknown ${label} value: ${value}, using default`);
        return defaultVal;
    }
    return result;
}

function normalizeFiber(fiberName) {
    if (!fiberName) return "polyester";
    const lower = fiberName.toLowerCase().trim();
    const normalized = FIBER_NORMALIZE[lower];
    if (normalized) return normalized;
    for (const [key, val] of Object.entries(FIBER_NORMALIZE)) {
        if (lower.includes(key)) return val;
    }
    return lower;
}

function parsePrice(priceStr) {
    if (!priceStr) return null;
    const match = priceStr.match(/[\d,.]+/);
    if (match) {
        try {
            return parseFloat(match[0].replace(',', ''));
        } catch {
            return null;
        }
    }
    return null;
}

// Known brand tiers
const FAST_FASHION_BRANDS = new Set([
    "h&m", "zara", "shein", "forever 21", "primark", "boohoo",
    "fashion nova", "romwe", "asos",
]);
const LUXURY_BRANDS = new Set([
    "gucci", "prada", "chanel", "louis vuitton", "dior", "versace",
    "balenciaga", "valentino", "saint laurent", "burberry",
]);
const PREMIUM_BRANDS = new Set([
    "coach", "michael kors", "kate spade", "tory burch", "ted baker",
    "reiss", "sandro", "maje", "allsaints",
]);

export function estimateBrandTier(priceStr, brand) {
    if (brand) {
        const brandLower = brand.toLowerCase().trim();
        if (FAST_FASHION_BRANDS.has(brandLower)) return BrandTier.FAST_FASHION;
        if (LUXURY_BRANDS.has(brandLower)) return BrandTier.LUXURY;
        if (PREMIUM_BRANDS.has(brandLower)) return BrandTier.PREMIUM;
    }

    if (priceStr) {
        const price = parsePrice(priceStr);
        if (price !== null) {
            if (price < 30) return BrandTier.FAST_FASHION;
            if (price < 80) return BrandTier.MASS_MARKET;
            if (price < 200) return BrandTier.MID_MARKET;
            if (price < 500) return BrandTier.PREMIUM;
            return BrandTier.LUXURY;
        }
    }

    return BrandTier.MID_MARKET;
}

function estimateModelSize(sizeStr) {
    if (!sizeStr) return 2;
    const s = sizeStr.trim().toUpperCase();
    const sizeMap = {
        XXS: 0, XS: 0, S: 4, M: 8, L: 12,
        XL: 16, XXL: 18, XXXL: 20,
    };
    if (sizeMap[s] !== undefined) return sizeMap[s];
    const parsed = parseInt(s);
    return isNaN(parsed) ? 2 : parsed;
}

function detectZone(category) {
    const fullBody = new Set([
        GarmentCategory.DRESS, GarmentCategory.JUMPSUIT, GarmentCategory.ROMPER,
    ]);
    const lowerBody = new Set([
        GarmentCategory.BOTTOM_PANTS, GarmentCategory.BOTTOM_SHORTS,
        GarmentCategory.SKIRT,
    ]);
    if (fullBody.has(category)) return "full_body";
    if (lowerBody.has(category)) return "lower_body";
    return "torso";
}

function detectCovers(category, hemPosition) {
    let coversWaist = true;
    let coversHips = true;
    if (category === GarmentCategory.TOP) coversHips = false;
    if (hemPosition === "mini") coversHips = false;
    return [coversWaist, coversHips];
}

// ================================================================
// FABRIC GSM RESOLUTION (5-priority chain matching Python)
// ================================================================

// Text keyword matches (Priority 1)
const TEXT_KEYWORD_MATCHES = {
    "ponte": { gsm: 300, confidence: "high" },
    "ponti": { gsm: 300, confidence: "high" },
    "scuba": { gsm: 320, confidence: "high" },
    "chiffon": { gsm: 50, confidence: "high" },
    "charmeuse": { gsm: 90, confidence: "high" },
    "denim": { gsm: 350, confidence: "high" },
    "jeans": { gsm: 320, confidence: "high" },
    "flannel": { gsm: 280, confidence: "high" },
    "organza": { gsm: 50, confidence: "high" },
    "tulle": { gsm: 30, confidence: "high" },
    "velvet": { gsm: 280, confidence: "high" },
    "crushed velvet": { gsm: 250, confidence: "high" },
    "satin": { gsm: 130, confidence: "moderate" },
    "crepe de chine": { gsm: 80, confidence: "high" },
    "neoprene": { gsm: 350, confidence: "high" },
    "corduroy": { gsm: 300, confidence: "high" },
    "tweed": { gsm: 320, confidence: "high" },
    "chambray": { gsm: 140, confidence: "high" },
    "french terry": { gsm: 280, confidence: "high" },
    "terry": { gsm: 280, confidence: "moderate" },
    "modal": { gsm: 170, confidence: "high" },
    "micromodal": { gsm: 170, confidence: "high" },
    "tencel": { gsm: 200, confidence: "high" },
    "lyocell": { gsm: 200, confidence: "high" },
    "bamboo": { gsm: 160, confidence: "high" },
    "cupro": { gsm: 100, confidence: "high" },
    "bemberg": { gsm: 100, confidence: "high" },
    "bengaline": { gsm: 250, confidence: "moderate" },
    "millennium": { gsm: 250, confidence: "moderate" },
    "leather": { gsm: 500, confidence: "high" },
    "faux leather": { gsm: 350, confidence: "high" },
    "vegan leather": { gsm: 350, confidence: "high" },
    "pleather": { gsm: 350, confidence: "high" },
    "poplin": { gsm: 120, confidence: "high" },
    "broadcloth": { gsm: 120, confidence: "high" },
    "sateen": { gsm: 150, confidence: "high" },
    "gabardine": { gsm: 260, confidence: "high" },
    "georgette": { gsm: 100, confidence: "moderate" },
    "taffeta": { gsm: 100, confidence: "high" },
    "interlock": { gsm: 240, confidence: "moderate" },
    "pique": { gsm: 240, confidence: "moderate" },
    "rib knit": { gsm: 220, confidence: "high" },
    "ribbed": { gsm: 220, confidence: "moderate" },
    "jacquard": { gsm: 250, confidence: "moderate" },
    "brocade": { gsm: 300, confidence: "moderate" },
    "sequin": { gsm: 200, confidence: "moderate" },
    "mesh": { gsm: 100, confidence: "moderate" },
};

// Fiber + construction clue disambiguation (Priority 2)
const FIBER_DISAMBIGUATION = {
    "crepe": {
        silk: { gsm: 80, confidence: "high" },
        wool: { gsm: 200, confidence: "high" },
        polyester: { gsm: 150, confidence: "moderate" },
        default: { gsm: 150, confidence: "low" },
    },
    "jersey": {
        cotton: { gsm: 180, confidence: "high" },
        modal: { gsm: 170, confidence: "high" },
        wool: { gsm: 220, confidence: "high" },
        bamboo: { gsm: 160, confidence: "high" },
        polyester: { gsm: 160, confidence: "low" },
        default: { gsm: 180, confidence: "low" },
    },
    "satin": {
        silk: { gsm: 90, confidence: "high" },
        cotton: { gsm: 150, confidence: "high" },
        polyester: { gsm: 130, confidence: "moderate" },
        default: { gsm: 130, confidence: "low" },
    },
};

// Fiber + weight + drape resolution (Priority 3)
const FIBER_WEIGHT_DRAPE = {
    rayon: {
        "very_light|fluid": { gsm: 100, confidence: "moderate" },
        "light|fluid": { gsm: 110, confidence: "high" },
        "light|structured": { gsm: 145, confidence: "moderate" },
        "medium|fluid": { gsm: 160, confidence: "moderate" },
        "medium|structured": { gsm: 170, confidence: "moderate" },
        default: { gsm: 120, confidence: "low" },
    },
    viscose: {
        "very_light|fluid": { gsm: 100, confidence: "moderate" },
        "light|fluid": { gsm: 110, confidence: "moderate" },
        "medium|fluid": { gsm: 160, confidence: "moderate" },
        "medium|structured": { gsm: 170, confidence: "moderate" },
        default: { gsm: 120, confidence: "low" },
    },
    polyester: {
        "very_light|fluid": { gsm: 50, confidence: "high" },
        "very_light|stiff": { gsm: 50, confidence: "high" },
        "light|fluid": { gsm: 130, confidence: "moderate" },
        "light|structured": { gsm: 100, confidence: "low" },
        "medium|fluid": { gsm: 160, confidence: "moderate" },
        "medium|structured": { gsm: 300, confidence: "low" },
        "heavy|stiff": { gsm: 350, confidence: "low" },
        "heavy|structured": { gsm: 320, confidence: "low" },
        default: { gsm: 150, confidence: "low" },
    },
    cotton: {
        "very_light|stiff": { gsm: 100, confidence: "moderate" },
        "light|stiff": { gsm: 120, confidence: "high" },
        "light|structured": { gsm: 120, confidence: "high" },
        "light|fluid": { gsm: 155, confidence: "moderate" },
        "medium|fluid": { gsm: 180, confidence: "high" },
        "medium|structured": { gsm: 240, confidence: "moderate" },
        "heavy|stiff": { gsm: 350, confidence: "high" },
        "heavy|structured": { gsm: 320, confidence: "moderate" },
        default: { gsm: 180, confidence: "low" },
    },
    silk: {
        "very_light|very_drapey": { gsm: 40, confidence: "high" },
        "very_light|fluid": { gsm: 40, confidence: "high" },
        "light|very_drapey": { gsm: 90, confidence: "high" },
        "light|fluid": { gsm: 80, confidence: "moderate" },
        default: { gsm: 80, confidence: "low" },
    },
    wool: {
        "medium|fluid": { gsm: 200, confidence: "moderate" },
        "medium|structured": { gsm: 260, confidence: "moderate" },
        "heavy|stiff": { gsm: 280, confidence: "moderate" },
        "heavy|structured": { gsm: 280, confidence: "moderate" },
        default: { gsm: 220, confidence: "low" },
    },
    linen: {
        "light|stiff": { gsm: 150, confidence: "moderate" },
        "medium|stiff": { gsm: 180, confidence: "high" },
        "medium|fluid": { gsm: 150, confidence: "moderate" },
        "heavy|stiff": { gsm: 230, confidence: "moderate" },
        default: { gsm: 180, confidence: "low" },
    },
    nylon: {
        "light|fluid": { gsm: 100, confidence: "moderate" },
        "medium|fluid": { gsm: 200, confidence: "moderate" },
        default: { gsm: 200, confidence: "low" },
    },
};

// Fallback by weight only (Priority 5)
const WEIGHT_FALLBACK = {
    very_light: { gsm: 60, confidence: "very_low" },
    light: { gsm: 120, confidence: "very_low" },
    medium: { gsm: 180, confidence: "very_low" },
    heavy: { gsm: 320, confidence: "very_low" },
};

// Note: normalizeFiber and parsePrice functions are defined above (around line 273)

export function resolveFabricGsm(garmentAttrs) {
    // Gather all text signals
    const title = (safeGet(garmentAttrs, "title") || "").toLowerCase();
    const composition = (safeGet(garmentAttrs, "fabric_composition") || "").toLowerCase();
    const care = (safeGet(garmentAttrs, "care_instructions") || "").toLowerCase();
    const searchableText = `${title} ${composition} ${care}`;

    const primaryFiber = normalizeFiber(safeGet(garmentAttrs, "fabric_primary"));
    const secondaryFiber = normalizeFiber(safeGet(garmentAttrs, "fabric_secondary"));
    const weight = safeGet(garmentAttrs, "fabric_weight");
    const drape = safeGet(garmentAttrs, "fabric_drape");
    const stretchPct = safeGet(garmentAttrs, "stretch_percentage", 0) || 0;
    const price = parsePrice(safeGet(garmentAttrs, "price"));

    // -------------------------------------------------------------------
    // Priority 1: Text keyword matches (longest match first)
    // -------------------------------------------------------------------
    const sortedKeywords = Object.keys(TEXT_KEYWORD_MATCHES).sort((a, b) => b.length - a.length);

    for (const keyword of sortedKeywords) {
        if (searchableText.includes(keyword)) {
            let matchData = TEXT_KEYWORD_MATCHES[keyword];
            let gsm = matchData.gsm;

            // Apply conditional overrides
            if (keyword === "chiffon" && primaryFiber === "silk" && price && price > 80) {
                gsm = 40;
            } else if (keyword === "charmeuse" && price && price < 50) {
                gsm = 130;
            } else if (keyword === "denim" && stretchPct > 0) {
                gsm = 320;
            } else if (keyword === "velvet" && searchableText.includes("crushed")) {
                gsm = 250;
            } else if (keyword === "satin" && primaryFiber === "silk" && price && price > 80) {
                gsm = 90;
            } else if (keyword === "leather" && (searchableText.includes("faux") || searchableText.includes("vegan"))) {
                continue; // Skip — will match "faux leather" instead
            } else if (keyword === "mesh" && searchableText.includes("power")) {
                gsm = 200;
            }

            return {
                gsm,
                confidence: matchData.confidence,
                resolutionPath: `keyword:${keyword}`,
            };
        }
    }

    // -------------------------------------------------------------------
    // Priority 2: Fiber + construction clue disambiguation
    // -------------------------------------------------------------------
    for (const [clueWord, fiberMap] of Object.entries(FIBER_DISAMBIGUATION)) {
        if (searchableText.includes(clueWord)) {
            // Check primary fiber, then secondary, then default
            for (const fiber of [primaryFiber, secondaryFiber]) {
                if (fiber && fiberMap[fiber]) {
                    const matchData = fiberMap[fiber];
                    return {
                        gsm: matchData.gsm,
                        confidence: matchData.confidence,
                        resolutionPath: `disambig:${clueWord}+${fiber}`,
                    };
                }
            }
            // Use default if no fiber match
            if (fiberMap.default) {
                return {
                    gsm: fiberMap.default.gsm,
                    confidence: fiberMap.default.confidence,
                    resolutionPath: `disambig:${clueWord}+default`,
                };
            }
        }
    }

    // -------------------------------------------------------------------
    // Priority 3: Fiber + weight + drape
    // -------------------------------------------------------------------
    for (const fiber of [primaryFiber, secondaryFiber]) {
        if (!fiber || !FIBER_WEIGHT_DRAPE[fiber]) continue;
        const fiberEntries = FIBER_WEIGHT_DRAPE[fiber];

        // Try exact weight|drape key
        if (weight && drape) {
            const lookupKey = `${weight}|${drape}`;
            if (fiberEntries[lookupKey]) {
                const matchData = fiberEntries[lookupKey];
                return {
                    gsm: matchData.gsm,
                    confidence: matchData.confidence,
                    resolutionPath: `fwd:${fiber}|${lookupKey}`,
                };
            }
        }

        // Try weight|stiff and weight|structured as equivalent
        if (weight && (drape === "stiff" || drape === "structured")) {
            for (const altDrape of ["stiff", "structured"]) {
                const altKey = `${weight}|${altDrape}`;
                if (fiberEntries[altKey]) {
                    return {
                        gsm: fiberEntries[altKey].gsm,
                        confidence: "low",
                        resolutionPath: `fwd:${fiber}|${altKey}(alt)`,
                    };
                }
            }
        }

        // Try weight only (any drape)
        if (weight) {
            for (const [key, matchData] of Object.entries(fiberEntries)) {
                if (key.startsWith(`${weight}|`)) {
                    return {
                        gsm: matchData.gsm,
                        confidence: "low",
                        resolutionPath: `fwd:${fiber}|${key}(partial)`,
                    };
                }
            }
        }

        // Fiber default
        if (fiberEntries.default) {
            return {
                gsm: fiberEntries.default.gsm,
                confidence: fiberEntries.default.confidence,
                resolutionPath: `fwd:${fiber}|default`,
            };
        }
    }

    // -------------------------------------------------------------------
    // Priority 5: Nuclear fallback — weight category alone
    // -------------------------------------------------------------------
    if (weight && WEIGHT_FALLBACK[weight]) {
        return {
            gsm: WEIGHT_FALLBACK[weight].gsm,
            confidence: "very_low",
            resolutionPath: `weight_only:${weight}`,
        };
    }

    // Absolute last resort
    return {
        gsm: 180,
        confidence: "very_low",
        resolutionPath: "absolute_fallback",
    };
}

// ================================================================
// BODY PROFILE BUILDER
// ================================================================

export function buildBodyProfile(userMeasurements, stylingGoals = null) {
    const u = userMeasurements;

    // Core measurements (cm -> inches)
    const height = safeGet(u, "height", 167.64) * CM_TO_IN;
    const bust = safeGet(u, "chest_circumference", 91.44) * CM_TO_IN;
    const waist = safeGet(u, "waist_circumference", 76.2) * CM_TO_IN;
    const hip = safeGet(u, "hip_circumference", 96.52) * CM_TO_IN;
    const shoulderWidth = safeGet(u, "shoulder_breadth", 39.37) * CM_TO_IN;
    const neckCircumference = safeGet(u, "neck_circumference", 33.02) * CM_TO_IN;
    const armLength = safeGet(u, "arm_right_length", 58.42) * CM_TO_IN;
    const inseam = safeGet(u, "inside_leg_height", 76.2) * CM_TO_IN;
    const cThighMax = safeGet(u, "thigh_left_circumference", 55.88) * CM_TO_IN;
    const cAnkle = safeGet(u, "ankle_left_circumference", 21.59) * CM_TO_IN;

    // Derived landmarks (already in inches)
    const hKnee = safeGet(u, "knee_from_floor", 18.0);
    const hCalfMax = safeGet(u, "widest_calf_from_floor", 14.0);
    const hCalfMin = safeGet(u, "mid_calf_from_floor", 10.0);
    const hAnkle = safeGet(u, "ankle_from_floor", 4.0);
    const torsoLength = safeGet(u, "natural_waist_from_shoulder", 15.0);
    const legLengthVisual = safeGet(u, "natural_waist_from_floor", 41.0);

    // Estimated fields
    const underbust = bust - 4.0;
    const sizeCategory = safeGet(u, "size_category", "standard");
    const cUpperArmMax = sizeCategory === "plus_size" ? 14.0 : 11.0;
    const cCalfMax = cAnkle * 1.6;

    // Styling goals - use parameter if provided, otherwise check userMeasurements
    const goals = [];
    const goalsSource = stylingGoals || u.styling_goals || [];
    for (const g of goalsSource) {
        const mapped = GOAL_MAP[g];
        if (mapped) goals.push(mapped);
    }

    // Body shape and torso/leg ratio (pass through from input)
    // Only use body_shape from input if explicitly provided, otherwise let it be computed
    const bodyShape = u.body_shape || null;
    const torsoLegRatio = safeGet(u, "torso_leg_ratio", 0.50);
    const skinUndertone = safeGet(u, "skin_undertone", null);

    return new BodyProfile({
        height,
        bust,
        underbust,
        waist,
        hip,
        shoulder_width: shoulderWidth,
        neck_circumference: neckCircumference,
        torso_length: torsoLength,
        leg_length_visual: legLengthVisual,
        inseam,
        arm_length: armLength,
        c_upper_arm_max: cUpperArmMax,
        h_knee: hKnee,
        h_calf_max: hCalfMax,
        h_calf_min: hCalfMin,
        h_ankle: hAnkle,
        c_thigh_max: cThighMax,
        c_calf_max: cCalfMax,
        c_ankle: cAnkle,
        styling_goals: goals,
        body_shape: bodyShape,
        torso_leg_ratio: torsoLegRatio,
        skin_undertone: skinUndertone,
    });
}

// ================================================================
// GARMENT PROFILE BUILDER
// ================================================================

export function buildGarmentProfile(garmentAttrs) {
    const g = garmentAttrs;

    // Category
    const category = mapEnum(
        safeGet(g, "garment_type"),
        CATEGORY_MAP,
        GarmentCategory.DRESS,
        "garment_type"
    );

    // Silhouette
    const silhouette = mapEnum(
        safeGet(g, "silhouette_type"),
        SILHOUETTE_MAP,
        Silhouette.SEMI_FITTED,
        "silhouette_type"
    );

    // Neckline
    const neckline = mapEnum(
        safeGet(g, "neckline_type"),
        NECKLINE_MAP,
        NecklineType.CREW,
        "neckline_type"
    );

    // V-depth
    let vDepthCm = 0.0;
    const necklineDepthStr = safeGet(g, "neckline_depth");
    if (necklineDepthStr) {
        const depthMap = { shallow: 3.0, medium: 8.0, deep: 14.0, plunging: 20.0 };
        vDepthCm = depthMap[necklineDepthStr] || 0.0;
    }

    // Sleeve
    const sleeveType = mapEnum(
        safeGet(g, "sleeve_type"),
        SLEEVE_MAP,
        SleeveType.SET_IN,
        "sleeve_type"
    );

    const sleeveWidth = safeGet(g, "sleeve_width");
    const sleeveEaseMap = { fitted: 0.5, semi_fitted: 1.0, relaxed: 2.0, voluminous: 4.0 };
    const sleeveEaseInches = sleeveWidth ? (sleeveEaseMap[sleeveWidth] || 1.0) : 1.0;

    // Surface
    const surface = mapEnum(
        safeGet(g, "fabric_sheen"),
        SHEEN_MAP,
        SurfaceFinish.MATTE,
        "fabric_sheen"
    );

    // Fabric properties
    let primaryFiber = (safeGet(g, "fabric_primary") || "polyester").toLowerCase();
    primaryFiber = normalizeFiber(primaryFiber);
    let secondaryFiber = safeGet(g, "fabric_secondary");
    if (secondaryFiber) secondaryFiber = normalizeFiber(secondaryFiber.toLowerCase());

    // GSM resolution
    const fabricResolution = resolveFabricGsm(g);
    const gsmEstimated = fabricResolution.gsm;

    const drape = DRAPE_MAP[safeGet(g, "fabric_drape")] || 5.0;

    // Construction
    let construction = FIBER_CONSTRUCTION_MAP[primaryFiber] || FabricConstruction.WOVEN;
    const fabricTexture = safeGet(g, "fabric_texture");
    if (fabricTexture === "knit") construction = FabricConstruction.KNIT;
    if (fabricTexture === "ribbed") construction = FabricConstruction.KNIT_RIB;

    // Stretch
    let elastanePct = safeGet(g, "stretch_percentage", 0) || 0;

    // Fit
    const fitCategory = safeGet(g, "fit_category");
    let expansionRate = fitCategory ? (FIT_EXPANSION_MAP[fitCategory] || 0.05) : 0.05;
    const garmentEaseInches = fitCategory ? (FIT_EASE_MAP[fitCategory] || 3.0) : 3.0;

    // Body interaction adjustment
    const bodyInteraction = safeGet(g, "fabric_body_interaction");
    if (bodyInteraction) {
        const interactionAdj = BODY_INTERACTION_MAP[bodyInteraction] || 0.0;
        expansionRate = Math.max(0.0, expansionRate + interactionAdj);
    }

    // Stretch visible
    const stretchVisible = safeGet(g, "fabric_stretch_visible");
    if (stretchVisible === true && elastanePct < 3) {
        elastanePct = Math.max(elastanePct, 3.0);
    }

    // Hemline
    const hemPosition = HEM_POSITION_MAP[safeGet(g, "hemline_position")] || "knee";

    // Waist
    const waistPosition = WAIST_POSITION_MAP[safeGet(g, "waistline")] || "natural";
    const waistDef = safeGet(g, "waist_definition");
    const hasWaistDefinition = waistDef ? ["defined", "semi_defined"].includes(waistDef) : false;

    // Color
    const colorLightness = COLOR_LIGHTNESS_MAP[safeGet(g, "color_value")] || 0.50;
    const colorSaturation = COLOR_SATURATION_MAP[safeGet(g, "color_saturation")] || 0.50;
    const colorTemperature = safeGet(g, "color_temperature", "neutral");

    // Pattern
    const patternTypeStr = safeGet(g, "pattern_type");
    const hasPattern = patternTypeStr !== null && patternTypeStr !== "solid";
    const hasHorizontalStripes = patternTypeStr === "horizontal_stripes";
    const hasVerticalStripes = patternTypeStr === "vertical_stripes";
    let patternScale = safeGet(g, "pattern_scale", "none") || "none";
    if (!hasPattern) patternScale = "none";
    const patternContrast = PATTERN_CONTRAST_MAP[safeGet(g, "pattern_contrast")] || 0.50;

    // Construction details
    const fabricDrapeStr = safeGet(g, "fabric_drape");
    const isStructured = (
        safeGet(g, "has_darts") === true ||
        safeGet(g, "has_seaming") === true ||
        ["structured", "stiff"].includes(fabricDrapeStr)
    );
    const hasDarts = safeGet(g, "has_darts") === true;

    // Lining
    const fabricComposition = safeGet(g, "fabric_composition", "");
    const hasLining = fabricComposition ? fabricComposition.toLowerCase().includes("lining") : false;

    // Brand tier
    const brandTier = estimateBrandTier(safeGet(g, "price"), safeGet(g, "brand"));

    // Model size
    let modelEstimatedSize;
    const modelSizeWorn = safeGet(g, "model_size_worn");
    if (modelSizeWorn) {
        modelEstimatedSize = estimateModelSize(modelSizeWorn);
    } else {
        const apparentSize = safeGet(g, "model_apparent_size_category");
        if (apparentSize && MODEL_APPARENT_SIZE_MAP[apparentSize.toLowerCase()] !== undefined) {
            modelEstimatedSize = MODEL_APPARENT_SIZE_MAP[apparentSize.toLowerCase()];
        } else {
            modelEstimatedSize = estimateModelSize(null);
        }
    }

    // Zone and coverage
    const zone = detectZone(category);
    const [coversWaist, coversHips] = detectCovers(category, hemPosition);

    // Garment length
    let garmentLengthInches = safeGet(g, "garment_length_inches");
    if (garmentLengthInches === 0) garmentLengthInches = null;

    // Surface friction from opacity
    const opacity = safeGet(g, "fabric_opacity");
    let surfaceFriction = 0.5;
    if (opacity === "sheer") surfaceFriction = 0.3;
    else if (opacity === "opaque") surfaceFriction = 0.6;

    // Model height (for photo_note)
    const modelHeightInches = safeGet(g, "model_height_inches", 0);

    return new GarmentProfile({
        primary_fiber: primaryFiber,
        primary_fiber_pct: 100.0,
        secondary_fiber: secondaryFiber,
        secondary_fiber_pct: 0.0,
        elastane_pct: elastanePct,
        construction,
        gsm_estimated: gsmEstimated,
        surface,
        surface_friction: surfaceFriction,
        drape,
        category,
        silhouette,
        expansion_rate: expansionRate,
        neckline,
        v_depth_cm: vDepthCm,
        sleeve_type: sleeveType,
        sleeve_ease_inches: sleeveEaseInches,
        waist_position: waistPosition,
        has_waist_definition: hasWaistDefinition,
        hem_position: hemPosition,
        garment_length_inches: garmentLengthInches,
        covers_waist: coversWaist,
        covers_hips: coversHips,
        zone,
        color_lightness: colorLightness,
        color_saturation: colorSaturation,
        color_temperature: colorTemperature,
        has_pattern: hasPattern,
        pattern_type: patternTypeStr,
        has_horizontal_stripes: hasHorizontalStripes,
        has_vertical_stripes: hasVerticalStripes,
        pattern_scale: patternScale,
        pattern_contrast: patternContrast,
        is_structured: isStructured,
        has_darts: hasDarts,
        has_lining: hasLining,
        garment_ease_inches: garmentEaseInches,
        brand_tier: brandTier,
        model_estimated_size: modelEstimatedSize,
        model_height_inches: modelHeightInches,
        garment_layer: GarmentLayer.BASE,
        title: safeGet(g, "title"),
        fit_category: fitCategory,
    });
}
