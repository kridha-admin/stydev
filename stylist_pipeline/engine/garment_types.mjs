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
    hasGoal,
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

    if (title && title.length > 0) {
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
    let prompt_input_reasoning = [];
    const garmentType = g.garment_type || "top";
    prompt_input_reasoning.push("Analyzing how this " + garmentType + "'s hem placement and tuck style flatters your body shape");

    const behavior = g.top_hem_behavior;
    const hemPos = g.top_hem_length || "at_hip";
    const bodyShape = b.body_shape;

    // TUCKED: top hemline is invisible
    if (behavior === TopHemBehavior.TUCKED) {
        let score = 0.15;
        R.push("Tucked: hem invisible, waist definition +0.15");
        prompt_input_reasoning.push("Pro: When tucked in, this " + garmentType + "'s hem becomes invisible and creates clean waist definition, +0.15");
        if (g.gsm_estimated > 250) {
            score -= 0.20;
            R.push("Heavy fabric tucked: bulk at waist (-0.20)");
            prompt_input_reasoning.push("Con: This " + garmentType + "'s heavier fabric can create bulk at the waist when tucked in, -0.20");
        }
        return { score: clamp(score), reasoning: R.join(" | "), prompt_input_reasoning };
    }

    // HALF_TUCKED: partial waist definition, asymmetric hemline
    if (behavior === TopHemBehavior.HALF_TUCKED) {
        let score = 0.20;
        R.push("Half-tucked: partial waist definition, asymmetric break +0.20");
        prompt_input_reasoning.push("Pro: A half-tuck with this " + garmentType + " creates partial waist definition with an asymmetric visual break, +0.20");

        if (bodyShape === BodyShape.PEAR) {
            score += 0.10;
            R.push("Pear: asymmetric break disrupts hip-level line (+0.10)");
            prompt_input_reasoning.push("Pro: For your pear body shape, the asymmetric break from half-tucking disrupts the hip-level line and draws the eye away from the widest point, +0.10");
        } else if (bodyShape === BodyShape.APPLE) {
            score += 0.05;
            R.push("Apple: partial tuck draws eye to waist area (+0.05)");
            prompt_input_reasoning.push("Pro: For your apple body shape, a partial tuck draws the eye to your waist area and creates subtle definition, +0.05");
        }

        if (hasGoal(b.styling_goals,StylingGoal.HIGHLIGHT_WAIST)) {
            score += 0.10;
            R.push("highlight_waist: partial definition (+0.10)");
            prompt_input_reasoning.push("Pro: This half-tuck style supports your goal to highlight your waist by creating partial waist definition, +0.10");
        }

        if (g.gsm_estimated > 250) {
            score -= 0.15;
            R.push("Heavy fabric: bunching at tuck point (-0.15)");
            prompt_input_reasoning.push("Con: This " + garmentType + "'s heavier fabric tends to bunch at the tuck point rather than draping smoothly, -0.15");
        }

        return { score: clamp(score), reasoning: R.join(" | "), prompt_input_reasoning };
    }

    if (behavior === TopHemBehavior.BODYSUIT) {
        prompt_input_reasoning.push("Pro: As a bodysuit, this " + garmentType + " has no visible hem and creates a smooth, unbroken line at the waist, +0.10");
        return { score: clamp(0.10), reasoning: "Bodysuit: no visible hem, smooth line +0.10", prompt_input_reasoning };
    }

    // CROPPED: visual break above natural waist
    if (behavior === TopHemBehavior.CROPPED || hemPos === "cropped") {
        R.push("Cropped top: break above waist");
        let score;

        if (b.is_petite && b.torso_leg_ratio < 0.48) {
            score = -0.35;
            R.push("Petite + short torso: further shortening (-0.35)");
            prompt_input_reasoning.push("Con: For petite frames with a shorter torso, this cropped " + garmentType + " can visually shorten your torso further, -0.35");
        } else if (b.is_petite) {
            score = 0.30;
            R.push("Petite + proportional torso: lengthens legs (+0.30)");
            prompt_input_reasoning.push("Pro: For petite frames with a proportional torso, this cropped " + garmentType + " creates a leg-lengthening effect by raising the visual waistline, +0.30");
        } else {
            score = 0.15;
            prompt_input_reasoning.push("Pro: This cropped " + garmentType + " creates a leg-lengthening effect by showing more of your lower body, +0.15");
        }

        // Apple + hide midsection goal
        if (bodyShape === BodyShape.APPLE &&
            hasGoal(b.styling_goals,StylingGoal.HIDE_MIDSECTION)) {
            score = -0.70;
            R.push("Apple + hide_midsection: crop exposes midsection (-0.70)");
            prompt_input_reasoning.push("Con: For your apple body shape with a goal to hide your midsection, this cropped " + garmentType + " exposes rather than conceals that area, -0.70");
        }

        return { score: clamp(score), reasoning: R.join(" | "), prompt_input_reasoning };
    }

    // UNTUCKED: where the hem falls matters
    if (hemPos === "at_waist") {
        let score = 0.20;
        R.push("At waist: defines waist (+0.20)");
        prompt_input_reasoning.push("Pro: This " + garmentType + "'s hem sits at your natural waist, which defines and highlights your waistline, +0.20");
        if (hasGoal(b.styling_goals,StylingGoal.HIGHLIGHT_WAIST)) {
            score += 0.15;
            prompt_input_reasoning.push("Pro: This waist-length hem directly supports your goal to highlight your waist, +0.15");
        }
        return { score: clamp(score), reasoning: R.join(" | "), prompt_input_reasoning };
    }

    if (hemPos === "just_below_waist") {
        prompt_input_reasoning.push("Pro: This " + garmentType + "'s hem falls just below the waist, creating a slight torso-lengthening effect while still suggesting waist definition, +0.15");
        return { score: clamp(0.15), reasoning: "Just below waist: slight torso lengthening (+0.15)", prompt_input_reasoning };
    }

    if (hemPos === "at_hip") {
        R.push("At hip: critical zone");
        let score;
        if (bodyShape === BodyShape.PEAR) {
            const fit = g.fit_category || g.silhouette_label;
            score = ["relaxed", "loose"].includes(fit) ? -0.30 : -0.45;
            R.push(`Pear: line at widest hip point (${score >= 0 ? '+' : ''}${score.toFixed(2)})`);
            prompt_input_reasoning.push("Con: For your pear body shape, this " + garmentType + "'s hem falls at your widest hip point, which draws attention there, " + score.toFixed(2));
            if (hasGoal(b.styling_goals,StylingGoal.SLIM_HIPS)) {
                score -= 0.10;
                R.push("+ slim_hips goal: amplified");
                prompt_input_reasoning.push("Con: This hip-level hem works against your goal to slim your hips by creating a horizontal line at the widest point, -0.10");
            }
        } else if (bodyShape === BodyShape.INVERTED_TRIANGLE) {
            score = 0.35;
            R.push("INVT: hip-level hem adds visual weight below (+0.35)");
            prompt_input_reasoning.push("Pro: For your inverted triangle body shape, this " + garmentType + "'s hip-level hem adds visual weight to your lower body, helping balance your broader shoulders, +0.35");
        } else if (bodyShape === BodyShape.APPLE) {
            const fit = g.fit_category || g.silhouette_label;
            if (["relaxed", "loose"].includes(fit)) {
                score = 0.20;
                R.push("Apple + relaxed: skims past midsection (+0.20)");
                prompt_input_reasoning.push("Pro: For your apple body shape, this relaxed-fit " + garmentType + " skims past your midsection to the hip without clinging, +0.20");
            } else {
                score = -0.15;
                R.push("Apple + fitted: pulls at midsection (-0.15)");
                prompt_input_reasoning.push("Con: For your apple body shape, this fitted " + garmentType + " may pull or cling at the midsection rather than skimming smoothly, -0.15");
            }
        } else {
            score = 0.0;
            R.push("Neutral body type: hip-level is default");
        }
        return { score: clamp(score), reasoning: R.join(" | "), prompt_input_reasoning };
    }

    if (hemPos === "below_hip" || hemPos === "tunic_length") {
        R.push(`${hemPos}: covers hips, shortens leg line`);
        let score = 0.0;

        if (hasGoal(b.styling_goals,StylingGoal.SLIM_HIPS) ||
            hasGoal(b.styling_goals,StylingGoal.HIDE_MIDSECTION)) {
            score += 0.35;
            R.push("Coverage goal met: good for hip/midsection hiding (+0.35)");
            prompt_input_reasoning.push("Pro: This longer " + garmentType + " provides excellent coverage for your hips and midsection, supporting your styling goals, +0.35");
        }

        if (hasGoal(b.styling_goals,StylingGoal.LOOK_TALLER)) {
            const penalty = hemPos === "tunic_length" ? -0.35 : -0.20;
            score += penalty;
            R.push(`Shortens leg line (${penalty >= 0 ? '+' : ''}${penalty.toFixed(2)})`);
            prompt_input_reasoning.push("Con: This longer " + garmentType + " shortens your visible leg line, which works against your goal to look taller, " + penalty.toFixed(2));
        }

        if (b.is_petite && hemPos === "tunic_length") {
            score -= 0.20;
            R.push("Petite + tunic: overwhelms frame (-0.20)");
            prompt_input_reasoning.push("Con: For petite frames, this tunic-length " + garmentType + " can overwhelm your frame by covering too much of your body, -0.20");
        }

        return { score: clamp(score), reasoning: R.join(" | "), prompt_input_reasoning };
    }

    return { score: 0.0, reasoning: `Top hemline '${hemPos}' — N/A`, prompt_input_reasoning };
}

export function scorePantRise(g, b) {
    const R = [];
    let prompt_input_reasoning = [];
    const garmentType = g.garment_type || "pants";
    prompt_input_reasoning.push("Analyzing how this " + garmentType + "'s rise height affects leg elongation and works with your body shape");

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
        } else if (g.waist_position === "high" || g.waist_position === "empire") {
            rise = "high";
            R.push("Inferred high rise from waist_position");
        } else if (g.title) {
            // Infer from title keywords
            const t = (g.title || '').toLowerCase();
            if (t.includes('high-waist') || t.includes('high waist') || t.includes('high rise') || t.includes('high-rise') || t.includes('ultra high')) {
                rise = "high";
                R.push("Inferred high rise from title");
            } else if (t.includes('mid-rise') || t.includes('mid rise')) {
                rise = "mid";
                R.push("Inferred mid rise from title");
            } else if (t.includes('low-rise') || t.includes('low rise')) {
                rise = "low";
                R.push("Inferred low rise from title");
            } else {
                rise = "mid"; // Default assumption for modern pants
                R.push("Default mid rise (no explicit data)");
            }
        } else {
            rise = "mid";
            R.push("Default mid rise (no data)");
        }
    }

    const bodyShape = b.body_shape;

    if (rise === "high" || rise === "ultra_high") {
        let score = 0.25;
        R.push("High rise: leg elongation base +0.25");
        prompt_input_reasoning.push("Pro: This " + garmentType + "'s high rise sits at your natural waist, creating a leg-elongating effect by visually raising where your legs begin, +0.25");

        if (hasGoal(b.styling_goals,StylingGoal.LOOK_TALLER)) {
            score += 0.25;
            R.push("look_taller goal: amplified (+0.25)");
            prompt_input_reasoning.push("Pro: The high rise strongly supports your goal to look taller by maximizing your visible leg length, +0.25");
        }

        if (hasGoal(b.styling_goals,StylingGoal.HIGHLIGHT_WAIST)) {
            score += 0.15;
            R.push("highlight_waist: waistband cinches (+0.15)");
            prompt_input_reasoning.push("Pro: This " + garmentType + "'s high-rise waistband cinches at your natural waist, supporting your goal to highlight your waist, +0.15");
        }

        // Apple muffin-top risk
        if (bodyShape === BodyShape.APPLE && b.whr > 0.85) {
            if (g.waistband_stretch_pct && g.waistband_stretch_pct >= 8.0) {
                score -= 0.10;
                R.push("Apple: stretch waistband mitigates muffin risk (-0.10)");
                prompt_input_reasoning.push("Con: For your apple body shape, high rise can create muffin-top, but this " + garmentType + "'s stretch waistband helps mitigate that risk, -0.10");
            } else {
                score -= 0.25;
                R.push("Apple: muffin-top risk at midsection (-0.25)");
                prompt_input_reasoning.push("Con: For your apple body shape, this " + garmentType + "'s high rise without significant stretch can create muffin-top at the waistband, -0.25");
            }
        }

        if (b.is_petite) {
            score += 0.10;
            R.push("Petite: high rise strongly benefits (+0.10)");
            prompt_input_reasoning.push("Pro: For petite frames, this " + garmentType + "'s high rise is particularly beneficial as it maximizes leg length and creates balanced proportions, +0.10");
        }

        return { score: clamp(score), reasoning: R.join(" | "), prompt_input_reasoning };
    }

    if (rise === "mid") {
        prompt_input_reasoning.push("Pro: This " + garmentType + "'s mid rise is a versatile, neutral-positive choice that works well with most body types, +0.05");
        return { score: clamp(0.05), reasoning: "Mid rise: neutral-positive +0.05", prompt_input_reasoning };
    }

    if (rise === "low") {
        let score = -0.15;
        R.push("Low rise: shortens leg line -0.15");
        prompt_input_reasoning.push("Con: This " + garmentType + "'s low rise visually shortens your leg line by lowering where your legs appear to begin, -0.15");

        if (hasGoal(b.styling_goals,StylingGoal.LOOK_TALLER)) {
            score -= 0.25;
            R.push("look_taller goal: strongly fights (-0.25)");
            prompt_input_reasoning.push("Con: The low rise strongly works against your goal to look taller by minimizing your visible leg length, -0.25");
        }

        if (b.is_petite) {
            score -= 0.15;
            R.push("Petite: low rise significantly shortens leg (-0.15)");
            prompt_input_reasoning.push("Con: For petite frames, this " + garmentType + "'s low rise significantly shortens the leg line, which can make you appear shorter, -0.15");
        }

        if (hasGoal(b.styling_goals,StylingGoal.HIDE_MIDSECTION)) {
            score -= 0.15;
            R.push("hide_midsection: low rise exposes gap (-0.15)");
            prompt_input_reasoning.push("Con: This " + garmentType + "'s low rise can create a gap that exposes your midsection, working against your goal to hide that area, -0.15");
        }

        return { score: clamp(score), reasoning: R.join(" | "), prompt_input_reasoning };
    }

    return { score: 0.0, reasoning: `Rise '${rise}' — N/A`, prompt_input_reasoning };
}

export function scoreLegShape(g, b) {
    const R = [];
    let prompt_input_reasoning = [];
    const garmentType = g.garment_type || "pants";
    prompt_input_reasoning.push("Analyzing how this " + garmentType + "'s leg shape works with your body proportions and styling goals");

    let leg = g.leg_shape;
    if (leg == null) {
        // Infer from silhouette or title
        const sil = g.silhouette?.value || g.silhouette;
        if (sil === 'a_line' || sil === 'flare') {
            leg = "flare";
            R.push("Inferred flare from silhouette");
        } else if (sil === 'straight' || sil === 'column') {
            leg = "straight";
            R.push("Inferred straight from silhouette");
        } else if (g.title) {
            const t = (g.title || '').toLowerCase();
            if (t.includes('wide leg') || t.includes('wide-leg') || t.includes('palazzo')) {
                leg = "wide_leg";
                R.push("Inferred wide_leg from title");
            } else if (t.includes('flare') || t.includes('bootcut') || t.includes('boot-cut')) {
                leg = "flare";
                R.push("Inferred flare from title");
            } else if (t.includes('skinny') || t.includes('slim fit') || t.includes('slim-fit')) {
                leg = "skinny";
                R.push("Inferred skinny from title");
            } else if (t.includes('straight') || t.includes('mom')) {
                leg = "straight";
                R.push("Inferred straight from title");
            } else if (t.includes('tapered') || t.includes('jogger')) {
                leg = "tapered";
                R.push("Inferred tapered from title");
            } else if (t.includes('barrel')) {
                leg = "wide_leg";
                R.push("Inferred wide_leg from barrel title");
            } else {
                leg = "straight";
                R.push("Default straight leg (no data)");
            }
        } else {
            leg = "straight";
            R.push("Default straight leg (no data)");
        }
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
            prompt_input_reasoning.push("Con: With this " + garmentType + "'s low-stretch fabric and skinny fit, fuller thighs may experience uncomfortable cling rather than smooth drape, -0.10");
        } else if (totalStretch < 8 && b.c_thigh_max > 22) {
            thighClingPenalty = -0.05;
            R.push(`Low-stretch ${leg} + moderate thigh: mild cling risk (-0.05)`);
            prompt_input_reasoning.push("Con: This " + garmentType + "'s low-stretch " + leg + " fit may create mild cling at the thigh area, -0.05");
        }
    }

    if (leg === "skinny" || leg === "slim") {
        R.push(`${leg}: follows body contour`);
        let score;
        if (bodyShape === BodyShape.PEAR) {
            if (hasGoal(b.styling_goals,StylingGoal.SLIM_HIPS)) {
                score = -0.35;
                R.push("Pear + slim_hips: emphasizes hip-to-ankle taper (-0.35)");
                prompt_input_reasoning.push("Con: For your pear body shape with a goal to slim hips, this " + garmentType + "'s skinny leg emphasizes the hip-to-ankle taper, drawing attention to the width difference, -0.35");
            } else {
                score = -0.10;
                R.push("Pear: shows hip curve (-0.10)");
                prompt_input_reasoning.push("Con: For your pear body shape, this " + garmentType + "'s skinny leg follows your hip curve closely, highlighting that area, -0.10");
            }
            if (g.rise === "high" || g.rise === "ultra_high") {
                score += 0.10;
                R.push("+ high rise: elongation partially offsets (+0.10)");
                prompt_input_reasoning.push("Pro: The high rise helps offset the skinny leg by elongating the leg line and defining the waist, +0.10");
            }
        } else if (bodyShape === BodyShape.INVERTED_TRIANGLE) {
            score = -0.25;
            R.push("INVT: narrow bottom emphasizes shoulder width (-0.25)");
            prompt_input_reasoning.push("Con: For your inverted triangle body shape, this " + garmentType + "'s narrow skinny leg emphasizes your broader shoulders by creating a top-heavy silhouette, -0.25");
        } else if (bodyShape === BodyShape.RECTANGLE) {
            score = 0.15;
            R.push("Rectangle: clean line (+0.15)");
            prompt_input_reasoning.push("Pro: For your rectangle body shape, this " + garmentType + "'s skinny leg creates a clean, streamlined silhouette that complements your balanced proportions, +0.15");
        } else if (bodyShape === BodyShape.HOURGLASS) {
            score = 0.15;
            R.push("Hourglass: follows natural curve (+0.15)");
            prompt_input_reasoning.push("Pro: For your hourglass body shape, this " + garmentType + "'s skinny leg follows your natural curves and showcases your balanced proportions, +0.15");
        } else {
            score = 0.0;
        }
        score += thighClingPenalty;
        return { score: clamp(score), reasoning: R.join(" | "), prompt_input_reasoning };
    }

    if (leg === "wide_leg" || leg === "palazzo") {
        R.push(`${leg}: adds volume at leg`);
        let score;
        if (b.is_petite) {
            if (g.rise === "high" || g.rise === "ultra_high") {
                score = 0.15;
                R.push("Petite + high rise: volume manageable (+0.15)");
                prompt_input_reasoning.push("Pro: For petite frames, this " + garmentType + "'s wide leg with high rise keeps the volume manageable by anchoring at your natural waist, +0.15");
            } else {
                score = -0.30;
                R.push("Petite without high rise: overwhelms frame (-0.30)");
                prompt_input_reasoning.push("Con: For petite frames, this " + garmentType + "'s wide leg without a high rise can overwhelm your frame with too much fabric volume, -0.30");
            }
        } else if (bodyShape === BodyShape.PEAR) {
            score = 0.40;
            R.push("Pear: skims over hips and thighs (+0.40)");
            prompt_input_reasoning.push("Pro: For your pear body shape, this " + garmentType + "'s wide leg beautifully skims over your hips and thighs rather than clinging, creating a fluid silhouette, +0.40");
            if (g.rise === "high" || g.rise === "ultra_high") {
                score += 0.10;
                R.push("+ high rise: defines waist before volume starts (+0.10)");
                prompt_input_reasoning.push("Pro: The high rise defines your waist before the wide leg volume begins, creating an elegant hourglass effect, +0.10");
            } else if (g.rise === "low") {
                score -= 0.20;
                R.push("+ low rise: volume starts too early, no waist anchor (-0.20)");
                prompt_input_reasoning.push("Con: The low rise means the wide leg volume starts too early without waist definition, losing the balancing benefit, -0.20");
            }
        } else if (bodyShape === BodyShape.INVERTED_TRIANGLE) {
            score = 0.40;
            R.push("INVT: leg volume balances shoulders (+0.40)");
            prompt_input_reasoning.push("Pro: For your inverted triangle body shape, this " + garmentType + "'s wide leg adds visual weight to your lower body, creating balance with your broader shoulders, +0.40");
            if (g.rise === "high" || g.rise === "ultra_high") {
                score += 0.05;
                R.push("+ high rise: clean proportion line (+0.05)");
                prompt_input_reasoning.push("Pro: The high rise creates a clean proportion line from waist to wide leg, enhancing the balanced silhouette, +0.05");
            }
        } else if (bodyShape === BodyShape.APPLE) {
            score = 0.25;
            R.push("Apple: volume below balances midsection (+0.25)");
            prompt_input_reasoning.push("Pro: For your apple body shape, this " + garmentType + "'s wide leg creates volume below your midsection, drawing the eye down and creating balance, +0.25");
            if ((g.rise === "high" || g.rise === "ultra_high") && g.waistband_stretch_pct >= 8.0) {
                score += 0.10;
                R.push("+ stretch high rise: smooth waist transition (+0.10)");
                prompt_input_reasoning.push("Pro: The stretch high-rise waistband creates a smooth transition at your waist without digging in, +0.10");
            } else if (g.rise === "low") {
                score -= 0.15;
                R.push("+ low rise: gap at midsection (-0.15)");
                prompt_input_reasoning.push("Con: The low rise can create a gap at your midsection, which works against the benefits of the wide leg, -0.15");
            }
        } else {
            score = 0.15;
            prompt_input_reasoning.push("Pro: This " + garmentType + "'s wide leg is generally flattering, creating an elegant, flowing silhouette, +0.15");
        }
        return { score: clamp(score), reasoning: R.join(" | "), prompt_input_reasoning };
    }

    if (leg === "straight") {
        prompt_input_reasoning.push("Pro: This " + garmentType + "'s straight leg creates a clean, balanced line that works well with most body types and is universally flattering, +0.15");
        return { score: clamp(0.15), reasoning: "Straight: clean, balanced line (+0.15)", prompt_input_reasoning };
    }

    if (leg === "bootcut" || leg === "flare") {
        R.push(`${leg}: volume at hem`);
        let score = 0.15;
        prompt_input_reasoning.push("Pro: This " + garmentType + "'s " + leg + " style adds volume at the hem, creating an elongating effect, +0.15");
        if (bodyShape === BodyShape.PEAR) {
            score = 0.30;
            R.push("Pear: flare balances hip width (+0.30)");
            prompt_input_reasoning.push("Pro: For your pear body shape, this " + garmentType + "'s " + leg + " leg balances your hip width by adding visual weight at the ankle, creating symmetry, +0.30");
        }
        if (hasGoal(b.styling_goals,StylingGoal.LOOK_TALLER)) {
            score += 0.15;
            R.push("look_taller: flare + heel creates long line (+0.15)");
            prompt_input_reasoning.push("Pro: This " + leg + " style paired with heels creates a long, unbroken line that supports your goal to look taller, +0.15");
        }
        return { score: clamp(score), reasoning: R.join(" | "), prompt_input_reasoning };
    }

    if (leg === "tapered") {
        R.push("Tapered: relaxed through thigh, narrow at ankle");
        let score;
        if (bodyShape === BodyShape.PEAR) {
            score = -0.15;
            R.push("Pear: taper emphasizes hip-ankle contrast (-0.15)");
            prompt_input_reasoning.push("Con: For your pear body shape, this " + garmentType + "'s tapered leg can emphasize the contrast between your hips and narrow ankles, -0.15");
        } else {
            score = 0.10;
            prompt_input_reasoning.push("Pro: This " + garmentType + "'s tapered leg is relaxed through the thigh and narrows at the ankle, creating a modern, comfortable silhouette, +0.10");
        }
        return { score: clamp(score), reasoning: R.join(" | "), prompt_input_reasoning };
    }

    if (leg === "jogger") {
        R.push("Jogger: elastic cuff at ankle");
        let score = 0.0;
        if (b.is_petite) {
            score = -0.15;
            R.push("Petite: elastic cuff shortens leg line (-0.15)");
            prompt_input_reasoning.push("Con: For petite frames, this " + garmentType + "'s elastic jogger cuff at the ankle visually shortens your leg line, -0.15");
        } else {
            prompt_input_reasoning.push("Pro: This " + garmentType + "'s jogger style with elastic cuff is comfortable and works well for non-petite frames");
        }
        return { score: clamp(score), reasoning: R.join(" | "), prompt_input_reasoning };
    }

    return { score: 0.0, reasoning: `Leg shape '${leg}' — N/A`, prompt_input_reasoning };
}

export function scoreJacketScoring(g, b) {
    const R = [];
    let prompt_input_reasoning = [];
    const garmentType = g.garment_type || "jacket";
    prompt_input_reasoning.push("Analyzing how this " + garmentType + "'s shoulder structure, length, and closure work with your body shape");
    let score = 0.0;
    const bodyShape = b.body_shape;

    // SHOULDER STRUCTURE
    const structure = g.shoulder_structure || "natural";

    if (structure === "padded" || structure === "structured") {
        if (bodyShape === BodyShape.PEAR) {
            score += 0.50;
            R.push("Structured shoulders balance pear hips (+0.50)");
            prompt_input_reasoning.push("Pro: For your pear body shape, this " + garmentType + "'s structured shoulders add width at the top, beautifully balancing your fuller hips and creating an hourglass effect, +0.50");
        } else if (bodyShape === BodyShape.INVERTED_TRIANGLE) {
            score -= 0.40;
            R.push("Padded shoulders widen already-broad shoulders (-0.40)");
            prompt_input_reasoning.push("Con: For your inverted triangle body shape, this " + garmentType + "'s padded shoulders further widen your already-broad shoulder line, emphasizing the imbalance, -0.40");
        } else if (bodyShape === BodyShape.RECTANGLE) {
            score += 0.25;
            R.push("Structure creates shape on straight frame (+0.25)");
            prompt_input_reasoning.push("Pro: For your rectangle body shape, this " + garmentType + "'s structured shoulders create definition and shape on your naturally straight frame, +0.25");
        } else {
            score += 0.10;
            R.push("Structured shoulders: mild positive");
            prompt_input_reasoning.push("Pro: This " + garmentType + "'s structured shoulders provide clean lines and a polished silhouette, +0.10");
        }
    } else if (structure === "dropped" || structure === "oversized") {
        if (bodyShape === BodyShape.INVERTED_TRIANGLE) {
            score += 0.20;
            R.push("Dropped shoulders soften broad shoulder line (+0.20)");
            prompt_input_reasoning.push("Pro: For your inverted triangle body shape, this " + garmentType + "'s dropped shoulders soften your broad shoulder line and create a more relaxed, balanced silhouette, +0.20");
        } else if (b.is_petite) {
            score -= 0.30;
            R.push("Oversized shoulders overwhelm petite frame (-0.30)");
            prompt_input_reasoning.push("Con: For petite frames, this " + garmentType + "'s oversized shoulders can overwhelm your proportions and make you appear smaller, -0.30");
        } else {
            score += 0.05;
            prompt_input_reasoning.push("Pro: This " + garmentType + "'s relaxed, dropped shoulders create a modern, effortless silhouette, +0.05");
        }
    }

    // JACKET LENGTH
    const length = g.jacket_length || "hip";

    if (length === "cropped") {
        score += 0.30;
        R.push("Cropped jacket defines waist (+0.30)");
        prompt_input_reasoning.push("Pro: This cropped " + garmentType + " ends above your waist, defining your waistline and creating a flattering silhouette, +0.30");
        if (hasGoal(b.styling_goals,StylingGoal.LOOK_TALLER)) {
            score += 0.15;
            R.push("look_taller: short jacket = longer leg line (+0.15)");
            prompt_input_reasoning.push("Pro: This cropped length supports your goal to look taller by visually lengthening your leg line, +0.15");
        }
    } else if (length === "hip") {
        if (bodyShape === BodyShape.PEAR) {
            score -= 0.30;
            R.push("Hip-length ends at pear's widest point (-0.30)");
            prompt_input_reasoning.push("Con: For your pear body shape, this hip-length " + garmentType + " ends at your widest point, drawing attention there rather than skimming past it, -0.30");
        } else if (bodyShape === BodyShape.INVERTED_TRIANGLE) {
            score += 0.20;
            R.push("Hip-length adds visual weight below (+0.20)");
            prompt_input_reasoning.push("Pro: For your inverted triangle body shape, this hip-length " + garmentType + " adds visual weight to your lower body, helping balance your broader shoulders, +0.20");
        }
    } else if (["mid_thigh", "knee", "below_knee", "full_length"].includes(length)) {
        if (hasGoal(b.styling_goals,StylingGoal.LOOK_TALLER)) {
            score -= 0.20;
            R.push("Long jacket shortens visible leg line (-0.20)");
            prompt_input_reasoning.push("Con: This longer " + garmentType + " shortens your visible leg line, which works against your goal to look taller, -0.20");
        }
        if (hasGoal(b.styling_goals,StylingGoal.HIDE_MIDSECTION) ||
            hasGoal(b.styling_goals,StylingGoal.SLIM_HIPS)) {
            score += 0.30;
            R.push("Long jacket provides midsection/hip coverage (+0.30)");
            prompt_input_reasoning.push("Pro: This longer " + garmentType + " provides excellent coverage for your midsection and hips, supporting your styling goals, +0.30");
        }
    }

    // CLOSURE
    const closure = g.jacket_closure;
    if (closure === "open_front") {
        score += 0.20;
        R.push("Open front: vertical line elongates torso (+0.20)");
        prompt_input_reasoning.push("Pro: This " + garmentType + "'s open front creates a vertical line down your center, which elongates your torso and creates a slimming effect, +0.20");
    } else if (closure === "double_breasted") {
        if (bodyShape === BodyShape.APPLE) {
            score -= 0.15;
            R.push("Double-breasted adds midsection bulk (-0.15)");
            prompt_input_reasoning.push("Con: For your apple body shape, this " + garmentType + "'s double-breasted closure adds bulk at your midsection rather than streamlining it, -0.15");
        } else if (bodyShape === BodyShape.RECTANGLE) {
            score += 0.10;
            R.push("Double-breasted adds dimension (+0.10)");
            prompt_input_reasoning.push("Pro: For your rectangle body shape, this " + garmentType + "'s double-breasted closure adds visual interest and dimension to your silhouette, +0.10");
        }
    }

    return { score: clamp(score), reasoning: R.join(" | "), prompt_input_reasoning };
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
        if (hasGoal(body.styling_goals,StylingGoal.LOOK_TALLER)) {
            notes.push("Wear open with same-color base for an unbroken vertical line");
        }
        if (hasGoal(body.styling_goals,StylingGoal.HIDE_MIDSECTION)) {
            notes.push("Longer cardigan provides coverage without structure");
        }
    }

    return notes;
}
