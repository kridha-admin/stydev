/**
 * Kridha Production Scoring Engine - Garment Type System
 * =======================================================
 * Per-garment-type zone activation, classification, and type-specific scorers.
 *
 * Each garment type only scores the zones it controls:
 * - Tops don't score legs
 * - Pants don't score necklines
 * - Jackets are scored independently AND as layer modifiers
 */

import {
    BodyShape,
    StylingGoal,
    GarmentCategory,
    TopHemBehavior,
    clamp,
} from './schemas.mjs';

// ================================================================
// SCORER ROUTING
// ================================================================

// Which existing scorers to SKIP for each garment type.
// If category not listed, all 16 scorers run (dress-like).
const SCORERS_TO_SKIP = {
    [GarmentCategory.DRESS]: new Set(),
    [GarmentCategory.TOP]: new Set(["Hemline"]),
    [GarmentCategory.SWEATSHIRT]: new Set(["Hemline"]),
    [GarmentCategory.BODYSUIT]: new Set(["Hemline"]),
    [GarmentCategory.BOTTOM_PANTS]: new Set([
        "V-Neck Elongation", "Neckline Compound", "Sleeve",
        "Rise Elongation", "Hemline",
    ]),
    [GarmentCategory.BOTTOM_SHORTS]: new Set([
        "V-Neck Elongation", "Neckline Compound", "Sleeve",
        "Rise Elongation", "Hemline",
    ]),
    [GarmentCategory.SKIRT]: new Set([
        "V-Neck Elongation", "Neckline Compound", "Sleeve",
        "Rise Elongation",
    ]),
    [GarmentCategory.JUMPSUIT]: new Set(),
    [GarmentCategory.ROMPER]: new Set(),
    [GarmentCategory.JACKET]: new Set(["Hemline"]),
    [GarmentCategory.COAT]: new Set(),
    [GarmentCategory.CARDIGAN]: new Set(["Hemline"]),
    [GarmentCategory.VEST]: new Set(["Hemline", "Sleeve"]),
};

// Which NEW type-specific scorers to ADD for each category.
const EXTRA_SCORERS = {
    [GarmentCategory.TOP]: ["Top Hemline"],
    [GarmentCategory.SWEATSHIRT]: ["Top Hemline"],
    [GarmentCategory.BODYSUIT]: ["Top Hemline"],
    [GarmentCategory.CARDIGAN]: ["Top Hemline"],
    [GarmentCategory.BOTTOM_PANTS]: ["Pant Rise", "Leg Shape"],
    [GarmentCategory.BOTTOM_SHORTS]: ["Pant Rise", "Leg Shape"],
    [GarmentCategory.JACKET]: ["Jacket Scoring"],
    [GarmentCategory.COAT]: ["Jacket Scoring"],
};

// Layer garment categories
const LAYER_CATEGORIES = new Set([
    GarmentCategory.JACKET,
    GarmentCategory.COAT,
    GarmentCategory.CARDIGAN,
    GarmentCategory.VEST,
]);

// Zone mapping for new scorers (used by _compute_zone_scores)
export const TYPE_SCORER_ZONE_MAPPING = {
    "Top Hemline": ["hip", "torso"],
    "Pant Rise": ["waist"],
    "Leg Shape": ["hip", "thigh"],
    "Jacket Scoring": ["shoulder", "waist", "hip", "torso"],
};

// Base weights for new scorers
export const TYPE_SCORER_WEIGHTS = {
    "Top Hemline": 0.15,
    "Pant Rise": 0.18,
    "Leg Shape": 0.15,
    "Jacket Scoring": 0.18,
};

export function getScorersToSkip(category) {
    return SCORERS_TO_SKIP[category] ?? new Set();
}

export function getExtraScorerNames(category) {
    return EXTRA_SCORERS[category] ?? [];
}

export function isLayerGarment(category) {
    return LAYER_CATEGORIES.has(category);
}

// ================================================================
// GARMENT CLASSIFICATION
// ================================================================

const TITLE_KEYWORDS = {
    [GarmentCategory.DRESS]: [
        "maxi dress", "mini dress", "midi dress", "shift dress",
        "wrap dress", "dress", "gown", "frock",
    ],
    [GarmentCategory.TOP]: [
        "crop top", "halter top", "t-shirt", "blouse", "shirt", "tee",
        "cami", "camisole", "tank", "tunic", "henley", "polo", "top",
        "bustier", "corset top", "bralette",
    ],
    [GarmentCategory.BOTTOM_PANTS]: [
        "wide-leg", "straight-leg", "slim pant", "pants", "trouser",
        "jeans", "denim", "chino", "legging", "jogger", "cargo", "palazzo",
        "culottes", "sweatpant",
    ],
    [GarmentCategory.BOTTOM_SHORTS]: ["shorts", "bermuda", "hot pants"],
    [GarmentCategory.SKIRT]: [
        "denim skirt", "mini skirt", "midi skirt", "maxi skirt", "pencil skirt",
        "a-line skirt", "pleated skirt", "skirt", "skort",
    ],
    [GarmentCategory.JUMPSUIT]: ["jumpsuit"],
    [GarmentCategory.ROMPER]: ["romper", "playsuit"],
    [GarmentCategory.JACKET]: [
        "denim jacket", "leather jacket", "cropped jacket",
        "jacket", "blazer", "bomber", "moto", "shacket",
    ],
    [GarmentCategory.COAT]: [
        "overcoat", "trench", "parka", "peacoat", "puffer",
        "down jacket", "rain jacket", "coat",
        "anorak", "cape", "poncho",
    ],
    [GarmentCategory.SWEATSHIRT]: ["sweatshirt", "hoodie", "pullover", "fleece"],
    [GarmentCategory.CARDIGAN]: ["cardigan", "kimono", "duster"],
    [GarmentCategory.VEST]: ["vest", "gilet", "waistcoat"],
    [GarmentCategory.BODYSUIT]: ["bodysuit"],
    [GarmentCategory.ACTIVEWEAR]: [
        "sports bra", "yoga pants", "workout top", "athletic",
    ],
    [GarmentCategory.LOUNGEWEAR]: [
        "pajama", "robe", "loungewear", "nightgown", "sleepwear",
    ],
    [GarmentCategory.SAREE]: ["saree", "sari"],
    [GarmentCategory.SALWAR_KAMEEZ]: [
        "salwar", "kameez", "kurta", "kurti", "anarkali", "churidar",
    ],
    [GarmentCategory.LEHENGA]: ["lehenga", "lehnga", "chaniya choli"],
};

export function classifyGarment(garment) {
    const title = (garment.title || "").toLowerCase();

    if (title) {
        // Build all (keyword, category) pairs, check longest first
        const allMatches = [];
        for (const [category, keywords] of Object.entries(TITLE_KEYWORDS)) {
            for (const keyword of keywords) {
                if (title.includes(keyword)) {
                    allMatches.push({ length: keyword.length, keyword, category });
                }
            }
        }
        if (allMatches.length > 0) {
            allMatches.sort((a, b) => b.length - a.length); // longest keyword wins
            return allMatches[0].category;
        }
    }

    // Attribute-based fallback
    if (garment.rise != null && garment.leg_shape != null) {
        return GarmentCategory.BOTTOM_PANTS;
    }
    if (garment.skirt_construction != null) {
        return GarmentCategory.SKIRT;
    }
    if (garment.jacket_closure != null) {
        return GarmentCategory.JACKET;
    }

    return garment.category; // use whatever default is set
}

// ================================================================
// TYPE-SPECIFIC SCORERS
// ================================================================

export function scoreTopHemline(g, b) {
    const R = [];

    const behavior = g.top_hem_behavior;
    const hemPos = g.top_hem_length || "at_hip";
    const bodyShape = b.body_shape;

    // TUCKED: top hemline is invisible
    if (behavior === TopHemBehavior.TUCKED) {
        let score = 0.15;
        R.push("Tucked: hem invisible, waist definition +0.15");
        if (g.gsm_estimated > 250) {
            score -= 0.20;
            R.push("Heavy fabric tucked: bulk at waist (-0.20)");
        }
        return { score: clamp(score), reasoning: R.join(" | ") };
    }

    // HALF_TUCKED: partial waist definition, asymmetric hemline
    if (behavior === TopHemBehavior.HALF_TUCKED) {
        let score = 0.20;
        R.push("Half-tucked: partial waist definition, asymmetric break +0.20");

        if (bodyShape === BodyShape.PEAR) {
            score += 0.10;
            R.push("Pear: asymmetric break disrupts hip-level line (+0.10)");
        } else if (bodyShape === BodyShape.APPLE) {
            score += 0.05;
            R.push("Apple: partial tuck draws eye to waist area (+0.05)");
        }

        if (b.styling_goals.includes(StylingGoal.HIGHLIGHT_WAIST)) {
            score += 0.10;
            R.push("highlight_waist: partial definition (+0.10)");
        }

        if (g.gsm_estimated > 250) {
            score -= 0.15;
            R.push("Heavy fabric: bunching at tuck point (-0.15)");
        }

        return { score: clamp(score), reasoning: R.join(" | ") };
    }

    if (behavior === TopHemBehavior.BODYSUIT) {
        return { score: clamp(0.10), reasoning: "Bodysuit: no visible hem, smooth line +0.10" };
    }

    // CROPPED: visual break above natural waist
    if (behavior === TopHemBehavior.CROPPED || hemPos === "cropped") {
        R.push("Cropped top: break above waist");
        let score;

        if (b.is_petite && b.torso_leg_ratio < 0.48) {
            score = -0.35;
            R.push("Petite + short torso: further shortening (-0.35)");
        } else if (b.is_petite) {
            score = 0.30;
            R.push("Petite + proportional torso: lengthens legs (+0.30)");
        } else {
            score = 0.15;
        }

        // Apple + hide midsection goal
        if (bodyShape === BodyShape.APPLE &&
            b.styling_goals.includes(StylingGoal.HIDE_MIDSECTION)) {
            score = -0.70;
            R.push("Apple + hide_midsection: crop exposes midsection (-0.70)");
        }

        return { score: clamp(score), reasoning: R.join(" | ") };
    }

    // UNTUCKED: where the hem falls matters
    if (hemPos === "at_waist") {
        let score = 0.20;
        R.push("At waist: defines waist (+0.20)");
        if (b.styling_goals.includes(StylingGoal.HIGHLIGHT_WAIST)) {
            score += 0.15;
        }
        return { score: clamp(score), reasoning: R.join(" | ") };
    }

    if (hemPos === "just_below_waist") {
        return { score: clamp(0.15), reasoning: "Just below waist: slight torso lengthening (+0.15)" };
    }

    if (hemPos === "at_hip") {
        R.push("At hip: critical zone");
        let score;
        if (bodyShape === BodyShape.PEAR) {
            const fit = g.fit_category || g.silhouette_label;
            score = ["relaxed", "loose"].includes(fit) ? -0.30 : -0.45;
            R.push(`Pear: line at widest hip point (${score >= 0 ? '+' : ''}${score.toFixed(2)})`);
            if (b.styling_goals.includes(StylingGoal.SLIM_HIPS)) {
                score -= 0.10;
                R.push("+ slim_hips goal: amplified");
            }
        } else if (bodyShape === BodyShape.INVERTED_TRIANGLE) {
            score = 0.35;
            R.push("INVT: hip-level hem adds visual weight below (+0.35)");
        } else if (bodyShape === BodyShape.APPLE) {
            const fit = g.fit_category || g.silhouette_label;
            if (["relaxed", "loose"].includes(fit)) {
                score = 0.20;
                R.push("Apple + relaxed: skims past midsection (+0.20)");
            } else {
                score = -0.15;
                R.push("Apple + fitted: pulls at midsection (-0.15)");
            }
        } else {
            score = 0.0;
            R.push("Neutral body type: hip-level is default");
        }
        return { score: clamp(score), reasoning: R.join(" | ") };
    }

    if (hemPos === "below_hip" || hemPos === "tunic_length") {
        R.push(`${hemPos}: covers hips, shortens leg line`);
        let score = 0.0;

        if (b.styling_goals.includes(StylingGoal.SLIM_HIPS) ||
            b.styling_goals.includes(StylingGoal.HIDE_MIDSECTION)) {
            score += 0.35;
            R.push("Coverage goal met: good for hip/midsection hiding (+0.35)");
        }

        if (b.styling_goals.includes(StylingGoal.LOOK_TALLER)) {
            const penalty = hemPos === "tunic_length" ? -0.35 : -0.20;
            score += penalty;
            R.push(`Shortens leg line (${penalty >= 0 ? '+' : ''}${penalty.toFixed(2)})`);
        }

        if (b.is_petite && hemPos === "tunic_length") {
            score -= 0.20;
            R.push("Petite + tunic: overwhelms frame (-0.20)");
        }

        return { score: clamp(score), reasoning: R.join(" | ") };
    }

    return { score: 0.0, reasoning: `Top hemline '${hemPos}' — N/A` };
}

export function scorePantRise(g, b) {
    const R = [];

    let rise = g.rise;
    if (rise == null) {
        // Infer from rise_cm if available
        if (g.rise_cm != null) {
            if (g.rise_cm > 26) {
                rise = "high";
            } else if (g.rise_cm > 22) {
                rise = "mid";
            } else {
                rise = "low";
            }
        } else {
            return { score: 0.0, reasoning: "No rise data — N/A" };
        }
    }

    const bodyShape = b.body_shape;

    if (rise === "high" || rise === "ultra_high") {
        let score = 0.25;
        R.push("High rise: leg elongation base +0.25");

        if (b.styling_goals.includes(StylingGoal.LOOK_TALLER)) {
            score += 0.25;
            R.push("look_taller goal: amplified (+0.25)");
        }

        if (b.styling_goals.includes(StylingGoal.HIGHLIGHT_WAIST)) {
            score += 0.15;
            R.push("highlight_waist: waistband cinches (+0.15)");
        }

        // Apple muffin-top risk
        if (bodyShape === BodyShape.APPLE && b.whr > 0.85) {
            if (g.waistband_stretch_pct && g.waistband_stretch_pct >= 8.0) {
                score -= 0.10;
                R.push("Apple: stretch waistband mitigates muffin risk (-0.10)");
            } else {
                score -= 0.25;
                R.push("Apple: muffin-top risk at midsection (-0.25)");
            }
        }

        if (b.is_petite) {
            score += 0.10;
            R.push("Petite: high rise strongly benefits (+0.10)");
        }

        return { score: clamp(score), reasoning: R.join(" | ") };
    }

    if (rise === "mid") {
        return { score: clamp(0.05), reasoning: "Mid rise: neutral-positive +0.05" };
    }

    if (rise === "low") {
        let score = -0.15;
        R.push("Low rise: shortens leg line -0.15");

        if (b.styling_goals.includes(StylingGoal.LOOK_TALLER)) {
            score -= 0.25;
            R.push("look_taller goal: strongly fights (-0.25)");
        }

        if (b.is_petite) {
            score -= 0.15;
            R.push("Petite: low rise significantly shortens leg (-0.15)");
        }

        if (b.styling_goals.includes(StylingGoal.HIDE_MIDSECTION)) {
            score -= 0.15;
            R.push("hide_midsection: low rise exposes gap (-0.15)");
        }

        return { score: clamp(score), reasoning: R.join(" | ") };
    }

    return { score: 0.0, reasoning: `Rise '${rise}' — N/A` };
}

export function scoreLegShape(g, b) {
    const R = [];

    const leg = g.leg_shape;
    if (leg == null) {
        return { score: 0.0, reasoning: "No leg shape data — N/A" };
    }

    const bodyShape = b.body_shape;

    // Compute thigh cling penalty for skinny/slim legs
    let thighClingPenalty = 0.0;
    if (leg === "skinny" || leg === "slim") {
        const ease = leg === "skinny" ? 1.0 : 2.0;
        const CONSTRUCTION_MULT = {
            "woven": 1.6, "knit": 4.0, "knit_rib": 5.5,
            "knit_double": 3.5, "knit_jersey": 4.0,
        };
        const constrVal = g.construction?.value || String(g.construction);
        const totalStretch = g.elastane_pct * (CONSTRUCTION_MULT[constrVal] ?? 2.0);
        if (totalStretch < 8 && b.c_thigh_max > 24) {
            thighClingPenalty = -0.10;
            R.push(`Low-stretch skinny + large thigh (${b.c_thigh_max.toFixed(0)}"): cling risk (-0.10)`);
        } else if (totalStretch < 8 && b.c_thigh_max > 22) {
            thighClingPenalty = -0.05;
            R.push(`Low-stretch ${leg} + moderate thigh: mild cling risk (-0.05)`);
        }
    }

    if (leg === "skinny" || leg === "slim") {
        R.push(`${leg}: follows body contour`);
        let score;
        if (bodyShape === BodyShape.PEAR) {
            if (b.styling_goals.includes(StylingGoal.SLIM_HIPS)) {
                score = -0.35;
                R.push("Pear + slim_hips: emphasizes hip-to-ankle taper (-0.35)");
            } else {
                score = -0.10;
                R.push("Pear: shows hip curve (-0.10)");
            }
            if (g.rise === "high" || g.rise === "ultra_high") {
                score += 0.10;
                R.push("+ high rise: elongation partially offsets (+0.10)");
            }
        } else if (bodyShape === BodyShape.INVERTED_TRIANGLE) {
            score = -0.25;
            R.push("INVT: narrow bottom emphasizes shoulder width (-0.25)");
        } else if (bodyShape === BodyShape.RECTANGLE) {
            score = 0.15;
            R.push("Rectangle: clean line (+0.15)");
        } else if (bodyShape === BodyShape.HOURGLASS) {
            score = 0.15;
            R.push("Hourglass: follows natural curve (+0.15)");
        } else {
            score = 0.0;
        }
        score += thighClingPenalty;
        return { score: clamp(score), reasoning: R.join(" | ") };
    }

    if (leg === "wide_leg" || leg === "palazzo") {
        R.push(`${leg}: adds volume at leg`);
        let score;
        if (b.is_petite) {
            if (g.rise === "high" || g.rise === "ultra_high") {
                score = 0.15;
                R.push("Petite + high rise: volume manageable (+0.15)");
            } else {
                score = -0.30;
                R.push("Petite without high rise: overwhelms frame (-0.30)");
            }
        } else if (bodyShape === BodyShape.PEAR) {
            score = 0.40;
            R.push("Pear: skims over hips and thighs (+0.40)");
            if (g.rise === "high" || g.rise === "ultra_high") {
                score += 0.10;
                R.push("+ high rise: defines waist before volume starts (+0.10)");
            } else if (g.rise === "low") {
                score -= 0.20;
                R.push("+ low rise: volume starts too early, no waist anchor (-0.20)");
            }
        } else if (bodyShape === BodyShape.INVERTED_TRIANGLE) {
            score = 0.40;
            R.push("INVT: leg volume balances shoulders (+0.40)");
            if (g.rise === "high" || g.rise === "ultra_high") {
                score += 0.05;
                R.push("+ high rise: clean proportion line (+0.05)");
            }
        } else if (bodyShape === BodyShape.APPLE) {
            score = 0.25;
            R.push("Apple: volume below balances midsection (+0.25)");
            if ((g.rise === "high" || g.rise === "ultra_high") && g.waistband_stretch_pct >= 8.0) {
                score += 0.10;
                R.push("+ stretch high rise: smooth waist transition (+0.10)");
            } else if (g.rise === "low") {
                score -= 0.15;
                R.push("+ low rise: gap at midsection (-0.15)");
            }
        } else {
            score = 0.15;
        }
        return { score: clamp(score), reasoning: R.join(" | ") };
    }

    if (leg === "straight") {
        return { score: clamp(0.15), reasoning: "Straight: clean, balanced line (+0.15)" };
    }

    if (leg === "bootcut" || leg === "flare") {
        R.push(`${leg}: volume at hem`);
        let score = 0.15;
        if (bodyShape === BodyShape.PEAR) {
            score = 0.30;
            R.push("Pear: flare balances hip width (+0.30)");
        }
        if (b.styling_goals.includes(StylingGoal.LOOK_TALLER)) {
            score += 0.15;
            R.push("look_taller: flare + heel creates long line (+0.15)");
        }
        return { score: clamp(score), reasoning: R.join(" | ") };
    }

    if (leg === "tapered") {
        R.push("Tapered: relaxed through thigh, narrow at ankle");
        let score;
        if (bodyShape === BodyShape.PEAR) {
            score = -0.15;
            R.push("Pear: taper emphasizes hip-ankle contrast (-0.15)");
        } else {
            score = 0.10;
        }
        return { score: clamp(score), reasoning: R.join(" | ") };
    }

    if (leg === "jogger") {
        R.push("Jogger: elastic cuff at ankle");
        let score = 0.0;
        if (b.is_petite) {
            score = -0.15;
            R.push("Petite: elastic cuff shortens leg line (-0.15)");
        }
        return { score: clamp(score), reasoning: R.join(" | ") };
    }

    return { score: 0.0, reasoning: `Leg shape '${leg}' — N/A` };
}

export function scoreJacketScoring(g, b) {
    const R = [];
    let score = 0.0;
    const bodyShape = b.body_shape;

    // SHOULDER STRUCTURE
    const structure = g.shoulder_structure || "natural";

    if (structure === "padded" || structure === "structured") {
        if (bodyShape === BodyShape.PEAR) {
            score += 0.50;
            R.push("Structured shoulders balance pear hips (+0.50)");
        } else if (bodyShape === BodyShape.INVERTED_TRIANGLE) {
            score -= 0.40;
            R.push("Padded shoulders widen already-broad shoulders (-0.40)");
        } else if (bodyShape === BodyShape.RECTANGLE) {
            score += 0.25;
            R.push("Structure creates shape on straight frame (+0.25)");
        } else {
            score += 0.10;
            R.push("Structured shoulders: mild positive");
        }
    } else if (structure === "dropped" || structure === "oversized") {
        if (bodyShape === BodyShape.INVERTED_TRIANGLE) {
            score += 0.20;
            R.push("Dropped shoulders soften broad shoulder line (+0.20)");
        } else if (b.is_petite) {
            score -= 0.30;
            R.push("Oversized shoulders overwhelm petite frame (-0.30)");
        } else {
            score += 0.05;
        }
    }

    // JACKET LENGTH
    const length = g.jacket_length || "hip";

    if (length === "cropped") {
        score += 0.30;
        R.push("Cropped jacket defines waist (+0.30)");
        if (b.styling_goals.includes(StylingGoal.LOOK_TALLER)) {
            score += 0.15;
            R.push("look_taller: short jacket = longer leg line (+0.15)");
        }
    } else if (length === "hip") {
        if (bodyShape === BodyShape.PEAR) {
            score -= 0.30;
            R.push("Hip-length ends at pear's widest point (-0.30)");
        } else if (bodyShape === BodyShape.INVERTED_TRIANGLE) {
            score += 0.20;
            R.push("Hip-length adds visual weight below (+0.20)");
        }
    } else if (["mid_thigh", "knee", "below_knee", "full_length"].includes(length)) {
        if (b.styling_goals.includes(StylingGoal.LOOK_TALLER)) {
            score -= 0.20;
            R.push("Long jacket shortens visible leg line (-0.20)");
        }
        if (b.styling_goals.includes(StylingGoal.HIDE_MIDSECTION) ||
            b.styling_goals.includes(StylingGoal.SLIM_HIPS)) {
            score += 0.30;
            R.push("Long jacket provides midsection/hip coverage (+0.30)");
        }
    }

    // CLOSURE
    const closure = g.jacket_closure;
    if (closure === "open_front") {
        score += 0.20;
        R.push("Open front: vertical line elongates torso (+0.20)");
    } else if (closure === "double_breasted") {
        if (bodyShape === BodyShape.APPLE) {
            score -= 0.15;
            R.push("Double-breasted adds midsection bulk (-0.15)");
        } else if (bodyShape === BodyShape.RECTANGLE) {
            score += 0.10;
            R.push("Double-breasted adds dimension (+0.10)");
        }
    }

    return { score: clamp(score), reasoning: R.join(" | ") };
}

// ================================================================
// LAYER INTERACTION
// ================================================================

export function computeLayerModifications(garment, body) {
    const modifications = [];

    const isStructured = ["padded", "structured"].includes(garment.shoulder_structure);
    const isOpen = garment.jacket_closure === "open_front";

    if (isStructured) {
        modifications.push({
            type: "cling_neutralization",
            description: "Structured layer reduces cling of underneath garment",
            zones_affected: ["bust", "midsection", "upper_arm"],
            score_modification: "reduce_negative_by_70%",
        });
    }

    if (isOpen) {
        modifications.push({
            type: "vertical_line_creation",
            description: "Open front creates elongating vertical line",
            zones_affected: ["torso"],
            score_modification: "+0.3 to torso elongation",
        });
    }

    const fit = garment.fit_category || garment.silhouette_label;
    if (["relaxed", "loose", "oversized"].includes(fit)) {
        modifications.push({
            type: "volume_addition",
            description: "Loose layer adds visual volume",
            zones_affected: ["shoulder", "bust", "torso"],
            score_modification: "body_type_dependent",
        });
    }

    if (garment.jacket_length) {
        modifications.push({
            type: "proportion_break_override",
            description: `Jacket hem at ${garment.jacket_length} becomes the visual break point`,
            zones_affected: ["proportion"],
            score_modification: "replaces_base_proportion_break",
        });
    }

    const stylingNotes = generateLayerStylingNotes(garment, body);

    return {
        layer_modifications: modifications,
        styling_notes: stylingNotes,
    };
}

function generateLayerStylingNotes(garment, body) {
    const notes = [];
    const bodyShape = body.body_shape;

    if (garment.category === GarmentCategory.JACKET || garment.category === GarmentCategory.COAT) {
        if (bodyShape === BodyShape.PEAR) {
            notes.push("Pair with wide-leg or straight pants to balance your silhouette");
            if (garment.jacket_length === "hip") {
                notes.push("Consider wearing open to create a vertical line past your hips");
            }
        } else if (bodyShape === BodyShape.APPLE) {
            notes.push("Pair with a V-neck underneath for maximum elongation");
            if (garment.jacket_closure !== "open_front") {
                notes.push("Wear unbuttoned to create a slimming vertical line");
            }
        } else if (bodyShape === BodyShape.INVERTED_TRIANGLE) {
            notes.push("Balance with wide-leg or flare pants");
        }
    } else if (garment.category === GarmentCategory.CARDIGAN) {
        if (body.styling_goals.includes(StylingGoal.LOOK_TALLER)) {
            notes.push("Wear open with same-color base for an unbroken vertical line");
        }
        if (body.styling_goals.includes(StylingGoal.HIDE_MIDSECTION)) {
            notes.push("Longer cardigan provides coverage without structure");
        }
    }

    return notes;
}
