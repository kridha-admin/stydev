/**
 * Kridha Production Scoring Engine - Data Structures
 * ===================================================
 * Unified schemas for body math, fabric, and perceptual scoring.
 */

// ================================================================
// ENUMS
// ================================================================

export const BodyShape = Object.freeze({
    PEAR: "pear",
    APPLE: "apple",
    HOURGLASS: "hourglass",
    RECTANGLE: "rectangle",
    INVERTED_TRIANGLE: "inverted_triangle",
});

export const StylingGoal = Object.freeze({
    LOOK_TALLER: "look_taller",
    HIGHLIGHT_WAIST: "highlight_waist",
    HIDE_MIDSECTION: "hide_midsection",
    SLIM_HIPS: "slim_hips",
    LOOK_PROPORTIONAL: "look_proportional",
    MINIMIZE_ARMS: "minimize_arms",
    SLIMMING: "slimming",
    CONCEALMENT: "concealment",
    EMPHASIS: "emphasis",
    BALANCE: "balance",
});

export const SkinUndertone = Object.freeze({
    WARM: "warm",
    COOL: "cool",
    NEUTRAL: "neutral",
});

export const FabricConstruction = Object.freeze({
    WOVEN: "woven",
    KNIT: "knit",
    KNIT_RIB: "knit_rib",
    KNIT_DOUBLE: "knit_double",
    KNIT_JERSEY: "knit_jersey",
});

export const SurfaceFinish = Object.freeze({
    DEEP_MATTE: "deep_matte",
    MATTE: "matte",
    SUBTLE_SHEEN: "subtle_sheen",
    MODERATE_SHEEN: "moderate_sheen",
    HIGH_SHINE: "high_shine",
    MAXIMUM_SHINE: "maximum_shine",
    CRUSHED: "crushed",
});

export const Silhouette = Object.freeze({
    FITTED: "fitted",
    SEMI_FITTED: "semi_fitted",
    A_LINE: "a_line",
    EMPIRE: "empire",
    WRAP: "wrap",
    SHIFT: "shift",
    PEPLUM: "peplum",
    FIT_AND_FLARE: "fit_and_flare",
    OVERSIZED: "oversized",
    ARCHITECTURAL: "architectural",
});

export const SleeveType = Object.freeze({
    SLEEVELESS: "sleeveless",
    CAP: "cap",
    SHORT: "short",
    THREE_QUARTER: "three_quarter",
    LONG: "long",
    RAGLAN: "raglan",
    DOLMAN: "dolman",
    PUFF: "puff",
    FLUTTER: "flutter",
    BELL: "bell",
    SET_IN: "set_in",
});

export const NecklineType = Object.freeze({
    V_NECK: "v_neck",
    DEEP_V: "deep_v",
    SCOOP: "scoop",
    CREW: "crew",
    BOAT: "boat",
    SQUARE: "square",
    OFF_SHOULDER: "off_shoulder",
    HALTER: "halter",
    COWL: "cowl",
    TURTLENECK: "turtleneck",
    WRAP: "wrap",
});

export const GarmentCategory = Object.freeze({
    DRESS: "dress",
    TOP: "top",
    BOTTOM_PANTS: "bottom_pants",
    BOTTOM_SHORTS: "bottom_shorts",
    SKIRT: "skirt",
    JUMPSUIT: "jumpsuit",
    ROMPER: "romper",
    JACKET: "jacket",
    COAT: "coat",
    SWEATSHIRT: "sweatshirt",
    CARDIGAN: "cardigan",
    VEST: "vest",
    BODYSUIT: "bodysuit",
    LOUNGEWEAR: "loungewear",
    ACTIVEWEAR: "activewear",
    SAREE: "saree",
    SALWAR_KAMEEZ: "salwar_kameez",
    LEHENGA: "lehenga",
});

export const GarmentLayer = Object.freeze({
    BASE: "base",
    MID: "mid",
    OUTER: "outer",
});

export const TopHemBehavior = Object.freeze({
    TUCKED: "tucked",
    HALF_TUCKED: "half_tucked",
    UNTUCKED_AT_HIP: "untucked_at_hip",
    UNTUCKED_BELOW_HIP: "untucked_below_hip",
    CROPPED: "cropped",
    BODYSUIT: "bodysuit",
});

export const BrandTier = Object.freeze({
    LUXURY: "luxury",
    PREMIUM: "premium",
    MID_MARKET: "mid_market",
    MASS_MARKET: "mass_market",
    FAST_FASHION: "fast_fashion",
});

export const WearContext = Object.freeze({
    OFFICE_SEATED: "office_seated",
    CASUAL_ACTIVE: "casual_active",
    FORMAL_STANDING: "formal_standing",
    GENERAL: "general",
});

export const Climate = Object.freeze({
    HOT_HUMID: "hot_humid",
    HOT_DRY: "hot_dry",
    TEMPERATE: "temperate",
    COLD: "cold",
});

// ================================================================
// INPUT: BODY PROFILE
// ================================================================

export class BodyProfile {
    constructor(data = {}) {
        // Core measurements
        this.height = data.height ?? 66.0;
        this.bust = data.bust ?? 36.0;
        this.underbust = data.underbust ?? 32.0;
        this.waist = data.waist ?? 30.0;
        this.hip = data.hip ?? 38.0;

        // Shoulder & neck
        this.shoulder_width = data.shoulder_width ?? 15.5;
        this.neck_length = data.neck_length ?? 3.5;
        this.neck_circumference = data.neck_circumference ?? 13.0;

        // Torso proportions
        this.torso_length = data.torso_length ?? 15.0;
        this.leg_length_visual = data.leg_length_visual ?? 41.0;
        this.inseam = data.inseam ?? 30.0;

        // Arm measurements
        this.arm_length = data.arm_length ?? 23.0;
        this.c_upper_arm_max = data.c_upper_arm_max ?? 12.0;
        this.c_upper_arm_max_position = data.c_upper_arm_max_position ?? 3.0;
        this.c_elbow = data.c_elbow ?? 10.0;
        this.c_forearm_max = data.c_forearm_max ?? 9.5;
        this.c_forearm_min = data.c_forearm_min ?? 8.5;
        this.c_forearm_min_position = data.c_forearm_min_position ?? 17.0;
        this.c_wrist = data.c_wrist ?? 6.5;

        // Leg measurements
        this.h_knee = data.h_knee ?? 18.0;
        this.h_calf_max = data.h_calf_max ?? 14.0;
        this.h_calf_min = data.h_calf_min ?? 10.0;
        this.h_ankle = data.h_ankle ?? 4.0;
        this.c_thigh_max = data.c_thigh_max ?? 22.0;
        this.c_calf_max = data.c_calf_max ?? 14.5;
        this.c_calf_min = data.c_calf_min ?? 9.0;
        this.c_ankle = data.c_ankle ?? 8.5;

        // Projection measurements
        this.bust_projection = data.bust_projection ?? 2.0;
        this.belly_projection = data.belly_projection ?? 1.0;
        this.hip_projection = data.hip_projection ?? 1.5;

        // Body composition & skin
        this.body_composition = data.body_composition ?? "average";
        this.tissue_firmness = data.tissue_firmness ?? 0.5;
        this.skin_tone_L = data.skin_tone_L ?? 50.0;
        this.contour_smoothness = data.contour_smoothness ?? 0.5;
        this.skin_undertone = data.skin_undertone ?? SkinUndertone.NEUTRAL;
        this.skin_darkness = data.skin_darkness ?? 0.5;

        // Zone concern levels
        this.belly_zone = data.belly_zone ?? 0.0;
        this.hip_zone = data.hip_zone ?? 0.0;
        this.upper_arm_zone = data.upper_arm_zone ?? 0.0;
        this.bust_zone = data.bust_zone ?? 0.0;

        // Flags
        this.is_athletic = data.is_athletic ?? false;

        // Styling preferences
        this.styling_goals = data.styling_goals ?? [];
        this.style_philosophy = data.style_philosophy ?? "balance";

        // Context
        this.climate = data.climate ?? Climate.TEMPERATE;
        this.wear_context = data.wear_context ?? WearContext.GENERAL;

        // Per-zone goals
        this.goal_bust = data.goal_bust ?? null;
        this.goal_waist = data.goal_waist ?? null;
        this.goal_belly = data.goal_belly ?? null;
        this.goal_hip = data.goal_hip ?? null;
        this.goal_arm = data.goal_arm ?? null;
        this.goal_neck = data.goal_neck ?? null;
        this.goal_legs = data.goal_legs ?? null;
        this.goal_shoulders = data.goal_shoulders ?? null;
    }

    get whr() {
        return this.hip > 0 ? this.waist / this.hip : 0.80;
    }

    get bust_differential() {
        return this.bust - this.underbust;
    }

    get shoulder_hip_diff() {
        return this.shoulder_width - (this.hip / Math.PI);
    }

    get leg_ratio() {
        return this.height > 0 ? this.leg_length_visual / this.height : 0.62;
    }

    get torso_leg_ratio() {
        return this.leg_length_visual > 0 ? this.torso_length / this.leg_length_visual : 0.37;
    }

    get is_petite() {
        return this.height < 63.0;
    }

    get is_tall() {
        return this.height > 68.0;
    }

    get is_plus_size() {
        return this.bust > 42 || this.hip > 44;
    }

    get body_shape() {
        const bwd = this.bust - this.waist;
        const hwd = this.hip - this.waist;
        const shr = this.hip > 0 ? this.shoulder_width / (this.hip / Math.PI) : 1.0;

        if (bwd >= 7 && hwd >= 7 && shr >= 0.85 && shr <= 1.15) {
            return BodyShape.HOURGLASS;
        }
        if (hwd >= 7 && hwd > bwd + 2 && shr < 1.05) {
            return BodyShape.PEAR;
        }
        if (bwd < 5 && hwd < 5 && this.whr > 0.85) {
            return BodyShape.APPLE;
        }
        if (this.shoulder_hip_diff > 3) {
            return BodyShape.INVERTED_TRIANGLE;
        }
        return BodyShape.RECTANGLE;
    }

    get body_tags() {
        const tags = [];
        if (this.height < 63) tags.push("petite");
        if (this.height > 68) tags.push("tall");
        if (this.hip - this.bust >= 3 && this.whr < 0.78) tags.push("pear");
        if (this.whr > 0.85) tags.push("apple");
        if (Math.abs(this.bust - this.hip) <= 2 && this.bust_differential >= 6 && this.whr <= 0.75) {
            tags.push("hourglass");
        }
        if (Math.abs(this.bust - this.waist) <= 4 && Math.abs(this.waist - this.hip) <= 4) {
            tags.push("rectangle");
        }
        if (this.shoulder_hip_diff > 3) tags.push("inverted_triangle");
        if (this.bust > 42 || this.hip > 44) tags.push("plus_size");
        return tags;
    }

    get torso_score() {
        const ratio = this.height > 0 ? this.torso_length / this.height : 0.23;
        return (ratio - 0.23) / 0.02;
    }

    get calf_prominence() {
        return this.c_calf_min > 0 ? this.c_calf_max / this.c_calf_min : 1.0;
    }

    get arm_prominence_combined() {
        if (this.c_wrist <= 0 || this.c_forearm_min <= 0) return 1.5;
        const prominenceRatio = this.c_upper_arm_max / this.c_wrist;
        const bulgeFactor = this.c_upper_arm_max / this.c_forearm_min;
        return (prominenceRatio + bulgeFactor) / 2;
    }
}

// ================================================================
// INPUT: GARMENT PROFILE
// ================================================================

const SHEEN_MAP = {
    [SurfaceFinish.DEEP_MATTE]: 0.00,
    [SurfaceFinish.MATTE]: 0.10,
    [SurfaceFinish.SUBTLE_SHEEN]: 0.25,
    [SurfaceFinish.MODERATE_SHEEN]: 0.50,
    [SurfaceFinish.HIGH_SHINE]: 0.75,
    [SurfaceFinish.MAXIMUM_SHINE]: 1.00,
    [SurfaceFinish.CRUSHED]: 0.35,
};

const CONSTRUCTION_CLING_MULTIPLIER = {
    [FabricConstruction.WOVEN]: 1.6,
    [FabricConstruction.KNIT]: 4.0,
    [FabricConstruction.KNIT_RIB]: 5.5,
    [FabricConstruction.KNIT_DOUBLE]: 3.5,
    [FabricConstruction.KNIT_JERSEY]: 4.0,
};

export class GarmentProfile {
    constructor(data = {}) {
        // Fabric composition
        this.primary_fiber = data.primary_fiber ?? "polyester";
        this.primary_fiber_pct = data.primary_fiber_pct ?? 100.0;
        this.secondary_fiber = data.secondary_fiber ?? null;
        this.secondary_fiber_pct = data.secondary_fiber_pct ?? 0.0;
        this.elastane_pct = data.elastane_pct ?? 0.0;
        this.fabric_name = data.fabric_name ?? null;
        this.construction = data.construction ?? FabricConstruction.WOVEN;
        this.gsm_estimated = data.gsm_estimated ?? 150.0;
        this.surface = data.surface ?? SurfaceFinish.MATTE;
        this.surface_friction = data.surface_friction ?? 0.5;
        this.drape = data.drape ?? 5.0;

        // Silhouette
        this.category = data.category ?? GarmentCategory.DRESS;
        this.silhouette = data.silhouette ?? Silhouette.SEMI_FITTED;
        this.expansion_rate = data.expansion_rate ?? 0.05;
        this.silhouette_label = data.silhouette_label ?? "fitted";

        // Neckline
        this.neckline = data.neckline ?? NecklineType.CREW;
        this.v_depth_cm = data.v_depth_cm ?? 0.0;
        this.neckline_depth = data.neckline_depth ?? null;

        // Sleeves
        this.sleeve_type = data.sleeve_type ?? SleeveType.SET_IN;
        this.sleeve_length_inches = data.sleeve_length_inches ?? null;
        this.sleeve_ease_inches = data.sleeve_ease_inches ?? 1.0;

        // Rise & waist
        this.rise_cm = data.rise_cm ?? null;
        this.waistband_width_cm = data.waistband_width_cm ?? 3.0;
        this.waistband_stretch_pct = data.waistband_stretch_pct ?? 5.0;
        this.waist_position = data.waist_position ?? "natural";
        this.has_waist_definition = data.has_waist_definition ?? false;

        // Hemline
        this.hem_position = data.hem_position ?? "knee";
        this.garment_length_inches = data.garment_length_inches ?? null;

        // Coverage
        this.covers_waist = data.covers_waist ?? true;
        this.covers_hips = data.covers_hips ?? true;
        this.zone = data.zone ?? "torso";

        // Color
        this.color_lightness = data.color_lightness ?? 0.5;
        this.color_saturation = data.color_saturation ?? 0.5;
        this.color_temperature = data.color_temperature ?? "neutral";
        this.is_monochrome_outfit = data.is_monochrome_outfit ?? false;

        // Pattern
        this.has_pattern = data.has_pattern ?? false;
        this.pattern_type = data.pattern_type ?? null;
        this.has_horizontal_stripes = data.has_horizontal_stripes ?? false;
        this.has_vertical_stripes = data.has_vertical_stripes ?? false;
        this.stripe_width_cm = data.stripe_width_cm ?? 0.0;
        this.stripe_spacing_cm = data.stripe_spacing_cm ?? 0.0;
        this.pattern_scale = data.pattern_scale ?? "none";
        this.pattern_scale_inches = data.pattern_scale_inches ?? 0.0;
        this.pattern_contrast = data.pattern_contrast ?? 0.5;

        // Belt
        this.has_contrasting_belt = data.has_contrasting_belt ?? false;
        this.has_tonal_belt = data.has_tonal_belt ?? false;
        this.belt_width_cm = data.belt_width_cm ?? 0.0;

        // Construction details
        this.is_structured = data.is_structured ?? false;
        this.has_darts = data.has_darts ?? false;
        this.has_lining = data.has_lining ?? false;
        this.is_faux_wrap = data.is_faux_wrap ?? false;
        this.garment_ease_inches = data.garment_ease_inches ?? 3.0;

        // Brand & model
        this.brand_tier = data.brand_tier ?? BrandTier.MID_MARKET;
        this.uses_diverse_model = data.uses_diverse_model ?? false;
        this.model_estimated_size = data.model_estimated_size ?? 2;

        // Garment-type identification
        this.garment_layer = data.garment_layer ?? GarmentLayer.BASE;
        this.title = data.title ?? null;
        this.fit_category = data.fit_category ?? null;

        // Top-specific
        this.top_hem_length = data.top_hem_length ?? null;
        this.top_hem_behavior = data.top_hem_behavior ?? null;

        // Bottom-specific
        this.rise = data.rise ?? null;
        this.leg_shape = data.leg_shape ?? null;
        this.leg_opening_width = data.leg_opening_width ?? null;
        this.bottom_length = data.bottom_length ?? null;

        // Jacket/outerwear-specific
        this.jacket_closure = data.jacket_closure ?? null;
        this.jacket_length = data.jacket_length ?? null;
        this.shoulder_structure = data.shoulder_structure ?? null;

        // Skirt-specific
        this.skirt_construction = data.skirt_construction ?? null;
    }

    get is_dark() {
        return this.color_lightness < 0.25;
    }

    get sheen_index() {
        return SHEEN_MAP[this.surface] ?? 0.10;
    }

    get drape_coefficient() {
        return this.drape * 10.0;
    }

    get cling_risk() {
        const stretch = this.elastane_pct * (CONSTRUCTION_CLING_MULTIPLIER[this.construction] ?? 2.0);
        const gsmFactor = Math.max(0, 1.0 - this.gsm_estimated / 300.0);
        const frictionFactor = Math.max(0, 1.0 - this.surface_friction);
        return Math.min(1.0, (stretch / 20.0 + gsmFactor + frictionFactor) / 3.0);
    }
}

// ================================================================
// OUTPUT: SCORING RESULTS
// ================================================================

export class PrincipleResult {
    constructor(data = {}) {
        this.name = data.name ?? "";
        this.score = data.score ?? 0.0;
        this.reasoning = data.reasoning ?? "";
        this.weight = data.weight ?? 1.0;
        this.applicable = data.applicable ?? true;
        this.confidence = data.confidence ?? 0.70;
    }
}

export class GoalVerdict {
    constructor(data = {}) {
        this.goal = data.goal ?? "";
        this.verdict = data.verdict ?? "pass";
        this.score = data.score ?? 0.0;
        this.supporting_principles = data.supporting_principles ?? [];
        this.reasoning = data.reasoning ?? "";
    }
}

export class ZoneScore {
    constructor(data = {}) {
        this.zone = data.zone ?? "";
        this.score = data.score ?? 0.0;
        this.flags = data.flags ?? [];
    }
}

export class ExceptionTriggered {
    constructor(data = {}) {
        this.exception_id = data.exception_id ?? "";
        this.rule_overridden = data.rule_overridden ?? "";
        this.reason = data.reason ?? "";
        this.confidence = data.confidence ?? 0.70;
    }
}

export class Fix {
    constructor(data = {}) {
        this.what_to_change = data.what_to_change ?? "";
        this.expected_improvement = data.expected_improvement ?? 0.0;
        this.priority = data.priority ?? 1;
    }
}

export class BodyAdjustedGarment {
    constructor(data = {}) {
        // Hemline
        this.hem_from_floor = data.hem_from_floor ?? 0.0;
        this.hem_zone = data.hem_zone ?? "";
        this.hemline_danger_zones = data.hemline_danger_zones ?? [];
        this.hemline_safe_zone = data.hemline_safe_zone ?? null;
        this.fabric_rise_adjustment = data.fabric_rise_adjustment ?? 0.0;

        // Sleeve
        this.sleeve_endpoint_position = data.sleeve_endpoint_position ?? 0.0;
        this.perceived_arm_width = data.perceived_arm_width ?? 0.0;
        this.arm_width_delta = data.arm_width_delta ?? 0.0;
        this.arm_prominence_severity = data.arm_prominence_severity ?? 0.5;

        // Waist
        this.visual_waist_height = data.visual_waist_height ?? 0.0;
        this.visual_leg_ratio = data.visual_leg_ratio ?? 0.618;
        this.proportion_improvement = data.proportion_improvement ?? 0.0;

        // Fabric behavior
        this.total_stretch_pct = data.total_stretch_pct ?? 0.0;
        this.effective_gsm = data.effective_gsm ?? 150.0;
        this.sheen_score = data.sheen_score ?? 0.10;
        this.photo_reality_discount = data.photo_reality_discount ?? 0.0;
    }
}

export class ScoreResult {
    constructor(data = {}) {
        this.overall_score = data.overall_score ?? 5.0;
        this.composite_raw = data.composite_raw ?? 0.0;
        this.confidence = data.confidence ?? 0.70;

        this.principle_scores = data.principle_scores ?? [];
        this.goal_verdicts = data.goal_verdicts ?? [];
        this.zone_scores = data.zone_scores ?? {};

        this.exceptions = data.exceptions ?? [];
        this.fixes = data.fixes ?? [];

        this.body_adjusted = data.body_adjusted ?? null;

        this.reasoning_chain = data.reasoning_chain ?? [];

        this.layer_modifications = data.layer_modifications ?? null;
        this.styling_notes = data.styling_notes ?? [];
    }
}

// ================================================================
// UTILITY
// ================================================================

export function clamp(v, lo = -1.0, hi = 1.0) {
    return Math.max(lo, Math.min(hi, v));
}

export function scoreToTen(raw) {
    return clamp(raw, -1.0, 1.0) * 5.0 + 5.0;
}

// ================================================================
// DISPLAY SCORE RESCALING
// ================================================================

const RESCALE_BREAKPOINTS = [
    [0.0, 3.5, 0.0, 0.5],
    [3.5, 4.0, 0.5, 1.0],
    [4.0, 4.4, 1.0, 4.0],
    [4.4, 5.0, 4.0, 5.5],
    [5.0, 5.5, 5.5, 7.0],
    [5.5, 5.8, 7.0, 8.0],
    [5.8, 6.3, 8.0, 9.5],
    [6.3, 10.0, 9.5, 10.0],
];

export function rescaleDisplay(rawTen) {
    for (const [rawLo, rawHi, dispLo, dispHi] of RESCALE_BREAKPOINTS) {
        if (rawTen <= rawHi) {
            if (rawHi === rawLo) return dispLo;
            const t = (rawTen - rawLo) / (rawHi - rawLo);
            return dispLo + t * (dispHi - dispLo);
        }
    }
    return 10.0;
}
