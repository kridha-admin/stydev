/**
 * Kridha Guardrails — Body-Safe Language Checker
 *
 * Catches body-shaming language, missing redirects, and voice violations
 * before any text ships to the UI. Every output passes through this.
 *
 * 7 Rules:
 *   1. Body as negative subject  → BLOCK
 *   2. Body comparison           → BLOCK
 *   3. Negative body descriptions → BLOCK
 *   4. Forbidden body-type labels → BLOCK
 *   5. Missing redirects (NTO)   → BLOCK
 *   6. NTO must lead positive    → WARN
 *   7. Hedge / AI reference      → WARN
 */

// ================================================================
// VIOLATION CLASSES
// ================================================================

export class GuardrailViolation {
    constructor(data = {}) {
        this.rule = data.rule ?? "";
        this.severity = data.severity ?? "warn";  // "block" | "warn"
        this.text = data.text ?? "";
        this.suggestion = data.suggestion ?? "";
    }
}

export class GuardrailResult {
    constructor(data = {}) {
        this.passed = data.passed ?? true;
        this.violations = data.violations ?? [];
        this.warnings = data.warnings ?? [];
    }
}

// ================================================================
// RULE 1: Body as negative subject
// ================================================================

const BODY_AS_NEGATIVE_SUBJECT = [
    [/your\s+(hips?|arms?|legs?|thighs?|bell(?:y|ies)|stomach|midsection|bust|chest|shoulders?|waist|torso|calves|ankles?|figure|body)\s+(?:is|are|look|looks|seem|seems)\s+(?:too|very|quite|rather|extremely)\s+\w+/i,
     "body_negative_subject", "block",
     "Flip the subject: 'the fabric clings at the hip' not 'your hips are too wide'"],

    [/(?:too|very|quite)\s+(?:wide|big|large|thick|heavy|short|long|prominent|broad|narrow|flat|full)\s+(?:hips?|arms?|legs?|thighs?|bust|chest|shoulders?|waist|calves|stomach|midsection)/i,
     "body_negative_adjective", "block",
     "Remove body-negative adjective. Describe the garment's behavior instead."],

    [/your\s+(?:body|body\s*type|figure|frame|shape|build)\s+(?:doesn't|does\s+not|can't|cannot|won't|will\s+not|isn't|is\s+not)\s+(?:suit|work|fit|allow|support|handle)/i,
     "body_as_problem", "block",
     "The garment fails the body, not the other way around."],
];

// ================================================================
// RULE 2: Body comparison
// ================================================================

const BODY_COMPARISON = [
    [/(?:the\s+)?model\s+(?:weighs|is\s+a\s+size|wears?\s+(?:a\s+)?size|is\s+(?:about\s+)?\d+\s*(?:lbs?|pounds?|kg))/i,
     "model_weight_comparison", "block",
     "Only compare model HEIGHT. Never weight or size."],

    [/(?:thin|slim|skinny|petite|smaller|larger|bigger|heavier|thinner)\s+(?:people|bodies|women|men|frames|persons|figures)/i,
     "body_type_comparison", "block",
     "Don't compare body types. Describe what the fabric does."],

    [/(?:on|for)\s+(?:a|an)\s+(?:thin|slim|skinny|larger|bigger|heavier|plus[\s-]?size|overweight)\s+(?:body|frame|person|figure|woman|man)/i,
     "body_type_reference", "block",
     "Remove body-type references. Describe the garment's behavior instead."],
];

// ================================================================
// RULE 3: Negative body descriptions
// ================================================================

const NEGATIVE_BODY_DESCRIPTIONS = [
    [/(?:cling|stick|stretch|pull|grab)\w*\s+to\s+every\s+(?:curve|bump|roll|line|contour|inch|part|bit)/i,
     "every_curve_cling", "block",
     "Say 'follows every contour instead of creating a smooth line'"],

    [/show(?:s|ing)?\s+(?:every|all|your|the)\s+(?:curve|bump|roll|line|contour|imperfection|flaw)/i,
     "shows_every", "block",
     "Say 'the fabric doesn't smooth through the midsection'"],

    [/(?:highlight|emphasize|accentuate|expose|reveal|draw\s+attention\s+to)\s+(?:your|the)\s+(?:belly|stomach|midsection|tummy|gut|love\s+handles|bulge|problem\s+area|trouble\s+spot|flaw)/i,
     "highlight_body_negative", "block",
     "Say 'draws attention where you want to minimize' or describe the garment action"],

    [/make(?:s)?\s+your\s+(?:legs?|arms?|hips?|bust|chest|torso|body|figure)\s+look\s+(?:stumpy|stubby|short|fat|wide|big|thick|heavy|bulky|dumpy|frumpy|shapeless)/i,
     "make_body_look_negative", "block",
     "Say 'cuts your leg line short' not 'makes your legs look stumpy'"],

    [/(?:problem|trouble)\s+(?:area|spot|zone)s?/i,
     "problem_area_term", "block",
     "There are no 'problem areas.' Describe the garment interaction."],

    [/\b(?:strengths?\s+and\s+weaknesses?|weaknesses?\s+and\s+strengths?)\b/i,
     "strengths_weaknesses", "block",
     "Bodies don't have 'weaknesses.' Say 'what you want to draw attention to.'"],

    [/\b(?:hide|camouflage|conceal|cover\s+up)\s+(?:your|the)\s+(?:belly|stomach|midsection|tummy|hips?|arms?|thighs?|flaws?)/i,
     "hide_body_parts", "block",
     "Don't 'hide' body parts. Say 'the fabric skims smoothly' or 'keeps the silhouette clean.'"],
];

// ================================================================
// RULE 4: Forbidden body-type labels
// ================================================================

const FORBIDDEN_LABELS = [
    [/\bplus[\s-]?size\b/i, "plus_size_label", "block",
     "Never use 'plus size.' Describe the garment behavior instead."],

    [/\b(?:overweight|heavy[\s-]?set|full[\s-]?figured|obese|fat|chubby|curvy\s+girl)\b/i,
     "body_label", "block",
     "Never use body-size labels. Describe the garment behavior."],

    // "skinny" is allowed in garment names like "skinny jeans/pants/fit"
    [/\bskinny\b(?!\s+(?:jeans?|pants?|fit|leg|cut|jean))/i,
     "thin_label", "warn",
     "Avoid body-size labels even for thin bodies."],

    [/\b(?:bony|scrawny|stick[\s-]?thin|rail[\s-]?thin)\b/i,
     "thin_label_strict", "warn",
     "Avoid body-size labels even for thin bodies."],
];

// ================================================================
// RULE 5: Missing redirects for "Not This One"
// ================================================================

function checkRedirectPresent(outputJson) {
    const violations = [];
    if (outputJson.verdict === "not_this_one") {
        const hasPills = Boolean(outputJson.search_pills?.length);
        const hasContext = Boolean(outputJson.search_context);
        if (!hasPills && !hasContext) {
            violations.push(new GuardrailViolation({
                rule: "missing_redirect",
                severity: "block",
                text: "Not This One verdict has no search pills or redirect context",
                suggestion: "Add search_pills and search_context to give the user a next step.",
            }));
        }
    }
    return violations;
}

// ================================================================
// RULE 6: "Not This One" must lead with something positive
// ================================================================

function checkNotThisOnePositiveLead(outputJson) {
    const violations = [];
    if (outputJson.verdict !== "not_this_one") {
        return violations;
    }

    let pinch = outputJson.pinch || [];
    if (pinch && typeof pinch === 'object' && !Array.isArray(pinch)) {
        pinch = pinch.segments || [];
    }
    if (!pinch.length) {
        return violations;
    }

    const firstStyles = pinch.slice(0, 3)
        .filter(s => typeof s === 'object')
        .map(s => s.style);

    if (firstStyles.length > 0 && firstStyles.every(s => s === "negative" || s === "normal")) {
        const hasNonNormal = firstStyles.some(s => s !== "normal");
        if (hasNonNormal && !firstStyles.includes("positive")) {
            violations.push(new GuardrailViolation({
                rule: "not_this_one_no_positive_lead",
                severity: "warn",
                text: "Not This One pinch leads with only negatives",
                suggestion: "Lead with what's good: 'The design is great. The fabric isn't.'",
            }));
        }
    }
    return violations;
}

// ================================================================
// RULE 7: Hedge language / AI references
// ================================================================

const HEDGE_PATTERNS = [
    [/\b(?:this\s+)?might\s+not\s+(?:be|look|work|fit)\b/i,
     "hedge_might_not", "warn",
     "Be decisive. 'This won't work' not 'this might not work.'"],

    [/\byou\s+might\s+want\s+to\s+consider\b/i,
     "hedge_consider", "warn",
     "Be direct. 'Here's what works better' not 'you might want to consider.'"],

    [/\bbased\s+on\s+(?:our|the)\s+(?:analysis|algorithm|data|model|scoring)\b/i,
     "hedge_based_on", "warn",
     "State the finding directly. Don't reference the algorithm."],

    [/\bour\s+(?:ai|algorithm|model|engine|system)\s+(?:suggests|recommends|thinks|predicts)\b/i,
     "ai_reference", "warn",
     "Never reference the AI/algorithm. Just state the recommendation."],
];

// ================================================================
// MAIN CHECKER
// ================================================================

const ALL_PATTERN_RULES = [
    ...BODY_AS_NEGATIVE_SUBJECT,
    ...BODY_COMPARISON,
    ...NEGATIVE_BODY_DESCRIPTIONS,
    ...FORBIDDEN_LABELS,
    ...HEDGE_PATTERNS,
];

function extractAllText(outputJson) {
    const parts = [];
    if (outputJson.headline) {
        parts.push(outputJson.headline);
    }

    let pinch = outputJson.pinch || [];
    if (Array.isArray(pinch)) {
        for (const seg of pinch) {
            if (typeof seg === 'object') {
                parts.push(seg.text || "");
            } else if (typeof seg === 'string') {
                parts.push(seg);
            }
        }
    } else if (typeof pinch === 'object') {
        for (const seg of (pinch.segments || [])) {
            parts.push(seg.text || "");
        }
    }

    if (typeof outputJson.photo_note === 'string') {
        parts.push(outputJson.photo_note);
    } else if (typeof outputJson.photo_note === 'object' && outputJson.photo_note) {
        parts.push(outputJson.photo_note.text || "");
    }

    if (outputJson.search_context) {
        parts.push(outputJson.search_context);
    }
    if (outputJson.confidence_note) {
        parts.push(outputJson.confidence_note);
    }
    if (outputJson.full_take) {
        parts.push(outputJson.full_take);
    }

    return parts.join(" ");
}

function checkPatterns(text) {
    const blocks = [];
    const warnings = [];

    for (const [pattern, ruleName, severity, suggestion] of ALL_PATTERN_RULES) {
        const matches = text.match(pattern);
        if (matches) {
            const matchText = Array.isArray(matches) ? (matches[0] || "") : matches;
            const v = new GuardrailViolation({
                rule: ruleName,
                severity,
                text: matchText,
                suggestion,
            });
            if (severity === "block") {
                blocks.push(v);
            } else {
                warnings.push(v);
            }
        }
    }

    return [blocks, warnings];
}

export function checkOutput(outputJson) {
    const allText = extractAllText(outputJson);
    const [blocks, warnings] = checkPatterns(allText);
    blocks.push(...checkRedirectPresent(outputJson));
    warnings.push(...checkNotThisOnePositiveLead(outputJson));

    return new GuardrailResult({
        passed: blocks.length === 0,
        violations: blocks,
        warnings,
    });
}

export function checkText(text) {
    const [blocks, warnings] = checkPatterns(text);
    return new GuardrailResult({
        passed: blocks.length === 0,
        violations: blocks,
        warnings,
    });
}
