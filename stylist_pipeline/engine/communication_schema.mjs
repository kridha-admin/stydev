/**
 * Kridha Communication Schema — Output structure for the communication layer.
 *
 * Defines what the UI consumes.
 * Also contains deterministic components that don't need LLM:
 *   - verdict selection (threshold)
 *   - goal chip mapping
 *   - search pill mapping
 *   - chat chip suggestions
 */

// ================================================================
// OUTPUT CLASSES
// ================================================================

export class PinchSegment {
    constructor(data = {}) {
        this.text = data.text ?? "";
        this.style = data.style ?? "normal";  // "normal" | "positive" | "negative" | "fix"
    }
}

export class GoalChip {
    constructor(data = {}) {
        this.goal = data.goal ?? "";       // display label: "Look taller", "Streamline hips"
        this.icon = data.icon ?? "";
        this.verdict = data.verdict ?? "";  // "helping" | "fighting" | "mixed"
    }
}

export class CommunicationOutput {
    constructor(data = {}) {
        // Core verdict
        this.verdict = data.verdict ?? "";               // "this_is_it" | "smart_pick" | "not_this_one"
        this.verdict_color = data.verdict_color ?? "";   // "teal" | "amber" | "rose"

        // LLM-generated content
        this.headline = data.headline ?? "";             // 1 sentence, decisive
        this.pinch = data.pinch ?? [];                   // 2-5 styled segments

        // Deterministic content
        this.user_line = data.user_line ?? "";           // "For Piya · 5'3" · Pear · Short torso"
        this.goal_chips = data.goal_chips ?? [];
        this.photo_note = data.photo_note ?? null;
        this.confidence_note = data.confidence_note ?? null;
        this.triple_checks = data.triple_checks ?? null; // top 3 positive principle labels (TII only)
        this.search_pills = data.search_pills ?? null;   // "ponte dress", "structured knit" (NTO/SP)
        this.search_context = data.search_context ?? null; // empowering redirect line
        this.chat_chips = data.chat_chips ?? [];         // suggested questions

        // Deferred LLM context
        this.full_take_prompt_context = data.full_take_prompt_context ?? null;
    }

    toDict() {
        const d = { ...this };
        const result = {};
        for (const [k, v] of Object.entries(d)) {
            if (v != null && !k.startsWith("_")) {
                result[k] = v;
            }
        }
        return result;
    }
}

// ================================================================
// VERDICT SELECTION — deterministic
// ================================================================

export function selectVerdict(overallScore) {
    /**
     * Returns [verdict_key, color]. Pure threshold check.
     *
     * Thresholds on the rescaled 0-10 display score:
     *   - this_is_it:   >= 7.5  (top ~20% — clearly great)
     *   - smart_pick:   5.0–7.4 (middle ~55% — decent with caveats)
     *   - not_this_one: < 5.0  (bottom ~25% — clear skip)
     */
    if (overallScore >= 7.5) {
        return ["this_is_it", "teal"];
    } else if (overallScore >= 5.0) {
        return ["smart_pick", "amber"];
    } else {
        return ["not_this_one", "rose"];
    }
}

// ================================================================
// GOAL CHIP MAPPING — deterministic
// ================================================================

const GOAL_LABELS = {
    look_taller: ["Look taller", "↑"],
    highlight_waist: ["Highlight waist", "◇"],
    hide_midsection: ["Minimize middle", "○"],
    slim_hips: ["Streamline hips", "▯"],
    look_proportional: ["Proportional", "⬡"],
    minimize_arms: ["Streamline arms", "◌"],
    slimming: ["Slimming", "↓"],
    concealment: ["Smooth silhouette", "○"],
    emphasis: ["Emphasis", "◆"],
    balance: ["Balance", "⬡"],
};

const VERDICT_TO_UI = {
    pass: "helping",
    fail: "fighting",
    caution: "mixed",
};

export function buildGoalChips(goalVerdicts) {
    const chips = [];
    for (const gv of goalVerdicts) {
        let goalKey, v;
        if (typeof gv === 'object' && !gv.goal?.value) {
            goalKey = (gv.goal || "").toLowerCase().replace(/ /g, "_");
            v = gv.verdict || "caution";
        } else {
            goalKey = gv.goal?.value || String(gv.goal || "").toLowerCase();
            v = gv.verdict;
        }

        const [label, icon] = GOAL_LABELS[goalKey] || [goalKey.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase()), "·"];
        const verdictUi = VERDICT_TO_UI[v] || "mixed";
        chips.push(new GoalChip({ goal: label, icon, verdict: verdictUi }));
    }
    return chips;
}

// ================================================================
// SEARCH PILLS — deterministic, keyed by dominant negative principle
// ================================================================

const SEARCH_PILL_BANK = {
    fabric_structure: ["sculpting {g}", "ponte {g}", "structured knit", "double-lined"],
    bodycon_cling: ["smoothing {g}", "sculpting {g}", "compression", "ponte"],
    hemline: ["petite {g}", "mini length", "above-knee {g}"],
    hemline_long: ["midi {g}", "knee-length {g}"],
    rise_elongation: ["high-waist {g}", "high-rise {g}"],
    v_neck_elongation: ["V-neck {g}", "wrap {g}"],
    a_line_hip: ["A-line {g}", "fit-and-flare {g}"],
    wide_leg: ["wide-leg pants", "palazzo pants", "straight-leg"],
    sleeve_endpoint: ["three-quarter sleeve {g}", "long sleeve {g}"],
    monochrome_column: ["monochrome {g}", "column of color", "tonal dressing"],
    _default: ["structured {g}", "sculpting {g}"],
};

const SEARCH_CONTEXT_BANK = {
    fabric_structure: "A {g} can look incredible on you — you just need one where the fabric does the work.",
    bodycon_cling: "The right fitted {g} exists — it just needs fabric with enough weight to smooth, not cling.",
    hemline: "The right length makes all the difference. Try these:",
    a_line_hip: "The right shape for your goals exists — it just isn't this one. Try these:",
    wide_leg: "A different leg shape will work with your frame instead of against it.",
    _default: "Here's what will work better for your goals:",
};

const GARMENT_WORD_MAP = {
    dress: "dress", top: "top", bottom_pants: "pants",
    bottom_shorts: "shorts", skirt: "skirt", jumpsuit: "jumpsuit",
    romper: "romper", jacket: "jacket", coat: "coat",
    sweatshirt: "sweatshirt", cardigan: "cardigan", vest: "vest",
    bodysuit: "bodysuit", loungewear: "loungewear", activewear: "activewear",
    saree: "saree", salwar_kameez: "salwar kameez", lehenga: "lehenga",
};

function garmentWord(category) {
    const cat = category?.value || String(category || "").toLowerCase();
    return GARMENT_WORD_MAP[cat] || "garment";
}

export function buildSearchPills(verdict, topNegativeKey, garmentCategory = "dress") {
    if (verdict === "this_is_it") {
        return null;
    }
    const g = garmentWord(garmentCategory);
    const templates = SEARCH_PILL_BANK[topNegativeKey] || SEARCH_PILL_BANK._default;
    return templates.slice(0, 4).map(t => t.replace(/{g}/g, g));
}

export function buildSearchContext(verdict, topNegativeKey, garmentCategory = "dress") {
    if (verdict === "this_is_it") {
        return null;
    }
    const g = garmentWord(garmentCategory);
    const template = SEARCH_CONTEXT_BANK[topNegativeKey] || SEARCH_CONTEXT_BANK._default;
    return template.replace(/{g}/g, g);
}

// ================================================================
// CHAT CHIPS — deterministic
// ================================================================

const CHAT_CHIP_BANK = {
    this_is_it: {
        dress: ["What shoes work?", "Office appropriate?", "What jacket pairs with this?"],
        top: ["What bottom works?", "How should I style it?", "Tuck or untuck?"],
        bottom_pants: ["What top goes with this?", "Office appropriate?", "Find more like this"],
        skirt: ["What top pairs?", "What shoes work?", "For a date night?"],
        _default: ["How should I style this?", "Find more like this", "Worth the price?"],
    },
    smart_pick: {
        dress: ["What shoes work?", "Worth the alteration?", "Find similar but shorter?"],
        bottom_pants: ["Will the waist stretch?", "Worth the price?", "What belt works?"],
        _default: ["How do I fix this?", "Worth the price?", "Find something similar?"],
    },
    not_this_one: {
        dress: ["Find me a structured version", "What fabric should I look for?", "Will a jacket help?"],
        bottom_pants: ["Find a high-rise version", "What cut works for me?", "Show me better options"],
        _default: ["Find me something better", "What should I look for?", "What will work for my goals?"],
    },
};

export function buildChatChips(verdict, garmentCategory = "dress") {
    const cat = garmentCategory?.value || String(garmentCategory || "").toLowerCase();
    const verdictChips = CHAT_CHIP_BANK[verdict] || CHAT_CHIP_BANK.smart_pick;
    return (verdictChips[cat] || verdictChips._default || []).slice(0, 3);
}

// ================================================================
// USER LINE — deterministic
// ================================================================

function inchesToDisplay(inches) {
    const feet = Math.floor(inches / 12);
    const remaining = Math.floor(inches % 12);
    return `${feet}'${remaining}"`;
}

export function buildUserLine(bodyProfile) {
    const parts = [];
    const name = bodyProfile.name || "You";
    parts.push(`For ${name}`);

    const height = bodyProfile.height || 0;
    if (height) {
        parts.push(inchesToDisplay(height));
    }

    let shape = bodyProfile.body_shape || "";
    if (shape) {
        if (shape.value) shape = shape.value;
        parts.push(String(shape).replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase()));
    }

    const ratio = bodyProfile.torso_leg_ratio || 0.50;
    if (ratio < 0.48) {
        parts.push("Short torso");
    } else if (ratio > 0.52) {
        parts.push("Long torso");
    }

    return parts.join(" · ");
}

// ================================================================
// PHOTO NOTE — deterministic template
// ================================================================

export function buildPhotoNote(bodyProfile, garmentProfile, bodyAdjusted = null) {
    const userHeight = bodyProfile.height || 0;
    const modelHeight = garmentProfile.model_height || garmentProfile.model_height_inches || 0;

    if (modelHeight && userHeight && Math.abs(modelHeight - userHeight) >= 3) {
        const diff = Math.abs(modelHeight - userHeight);
        const userH = inchesToDisplay(userHeight);
        const modelH = inchesToDisplay(modelHeight);
        if (diff >= 5) {
            return `The model is ${modelH} and you're ${userH}. That ${Math.floor(diff)}" changes where everything falls on your body.`;
        } else {
            return `The model is ${modelH} — this will land differently on you at ${userH}.`;
        }
    }

    if (bodyAdjusted) {
        const discount = bodyAdjusted.photo_reality_discount || 0;
        if (typeof discount === 'number' && discount > 0.20) {
            return "The product photo is styled to hide how this fabric actually behaves.";
        }
    }

    return null;
}

// ================================================================
// CONFIDENCE NOTE — deterministic template
// ================================================================

export function buildConfidenceNote(confidence, missingFields = null) {
    if (confidence >= 0.75) {
        return null;
    }

    if (missingFields) {
        if (missingFields.includes("gsm") || missingFields.includes("fabric_weight")) {
            return "Fabric thickness not listed — our read is based on the blend and photos.";
        }
        if (missingFields.includes("stretch")) {
            return "Stretch percentage estimated from the fabric blend — actual may vary.";
        }
    }

    if (confidence < 0.60) {
        return "We're less certain on this one — some product details weren't available.";
    }

    return "Fabric weight estimated from blend and price point.";
}

// ================================================================
// TRIPLE CHECKS — deterministic (top 3 positive principles)
// ================================================================

const TRIPLE_CHECK_LABELS = {
    hemline: "Right length",
    rise_elongation: "High waist",
    v_neck_elongation: "V-neckline",
    monochrome_column: "Dark column",
    waist_definition: "Defined waist",
    waist_placement: "Waist placed right",
    a_line_hip: "A-line shape",
    a_line_balance: "A-line balance",
    wide_leg: "Wide leg",
    fabric_structure: "Good fabric",
    fabric_zone: "Fabric works",
    sleeve_endpoint: "Right sleeve",
    color_value: "Color works",
    color_harmony: "Color harmony",
    neckline_compound: "Neckline works",
    dark_black_slimming: "Dark slimming",
    matte_zone: "Matte finish",
    bodycon_mapping: "Fit works",
};

export function buildTripleChecks(verdict, principleScores) {
    if (verdict !== "this_is_it") {
        return null;
    }

    const positives = [];
    for (const p of principleScores) {
        const applicable = typeof p === 'object' ? (p.applicable ?? true) : (p.applicable ?? true);
        if (!applicable) continue;

        const score = typeof p === 'object' ? (p.score || 0) : p.score;
        const name = typeof p === 'object' ? (p.name || "") : p.name;

        if (score > 0.05) {
            const key = name.toLowerCase().trim().replace(/ /g, "_").replace(/-/g, "_");
            positives.push([score, key]);
        }
    }

    positives.sort((a, b) => b[0] - a[0]);
    const top3 = positives.slice(0, 3).map(([, k]) =>
        TRIPLE_CHECK_LABELS[k] || k.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase())
    );
    return top3.length >= 2 ? top3 : null;
}

// ================================================================
// PRINCIPLE ANALYSIS HELPER
// ================================================================

const PRINCIPLE_KEY_MAP = {
    "h-stripe_thinning": "horizontal_stripes",
    "h_stripe_thinning": "horizontal_stripes",
    "dark/black_slimming": "dark_slimming",
    "dark_black_slimming": "dark_slimming",
    "rise_elongation": "rise_elongation",
    "a-line_balance": "a_line_balance",
    "a_line_balance": "a_line_balance",
    "tent_concealment": "tent_concealment",
    "color_break": "color_break",
    "bodycon_mapping": "bodycon_cling",
    "matte_zone": "matte_zone",
    "v-neck_elongation": "v_neck_elongation",
    "v_neck_elongation": "v_neck_elongation",
    "monochrome_column": "monochrome_column",
    "hemline": "hemline",
    "sleeve": "sleeve_endpoint",
    "waist_placement": "waist_definition",
    "color_value": "color_value",
    "fabric_zone": "fabric_structure",
    "neckline_compound": "neckline",
};

export function normalizePrincipleKey(name) {
    const key = name.toLowerCase().trim().replace(/ /g, "_").replace(/-/g, "_");
    return PRINCIPLE_KEY_MAP[key] || key;
}

export function analyzePrinciples(principleScores) {
    const applicable = [];
    for (const p of principleScores) {
        if (typeof p === 'object') {
            if (!(p.applicable ?? true)) continue;
            applicable.push(p);
        } else {
            if (!(p.applicable ?? true)) continue;
            applicable.push({
                name: p.name,
                score: p.score,
                weight: p.weight ?? 1.0,
                reasoning: p.reasoning ?? "",
            });
        }
    }

    const positives = applicable
        .filter(p => (p.score || 0) > 0.05)
        .sort((a, b) => (b.score * (b.weight || 1)) - (a.score * (a.weight || 1)));

    const negatives = applicable
        .filter(p => (p.score || 0) < -0.05)
        .sort((a, b) => (a.score * (a.weight || 1)) - (b.score * (b.weight || 1)));

    const topPosKey = positives.length > 0 ? normalizePrincipleKey(positives[0].name) : null;
    const topNegKey = negatives.length > 0 ? normalizePrincipleKey(negatives[0].name) : null;

    return {
        positives,
        negatives,
        top_positive_key: topPosKey,
        top_negative_key: topNegKey,
        top_3_positive_keys: positives.slice(0, 3).map(p => normalizePrincipleKey(p.name)),
        top_3_negative_keys: negatives.slice(0, 3).map(p => normalizePrincipleKey(p.name)),
    };
}
