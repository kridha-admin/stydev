/**
 * Kridha Communication Engine — End-to-End Pipeline
 * ===================================================
 * Takes ScoreResult + profiles → returns UI-ready CommunicationOutput JSON.
 *
 * Zero LLM calls. Zero latency. Zero hallucination risk.
 * Uses the phrase bank (gold_generator) for headlines + pinch,
 * deterministic functions for everything else.
 *
 * Usage:
 *     import { generateCommunication } from './communicate.mjs';
 *
 *     const comm = generateCommunication(
 *         scoreResult,
 *         bodyProfile,
 *         garmentProfile,
 *     );
 *     // comm is a dict ready for JSON serialization to the UI
 */

import crypto from 'crypto';

import {
    CommunicationOutput,
    PinchSegment,
    selectVerdict,
    buildGoalChips,
    buildSearchPills,
    buildSearchContext,
    buildChatChips,
    buildUserLine,
    buildPhotoNote,
    buildConfidenceNote,
    buildTripleChecks,
    analyzePrinciples,
} from './communication_schema.mjs';

import { generateGoldOutput } from './gold_generator.mjs';
import { checkOutput } from './guardrails.mjs';

function bodyShapeStr(bodyProfile) {
    let shape = bodyProfile.body_shape || "rectangle";
    if (shape?.value) shape = shape.value;
    return String(shape).toLowerCase();
}

function garmentCategoryStr(garmentProfile) {
    let cat = garmentProfile.category || "dress";
    if (cat?.value) cat = cat.value;
    return String(cat).toLowerCase();
}

function makeScenarioId(bodyProfile, garmentProfile) {
    const seed = (
        `${bodyProfile.height || 0}` +
        `${bodyProfile.bust || 0}` +
        `${bodyProfile.waist || 0}` +
        `${bodyProfile.hip || 0}` +
        `${bodyShapeStr(bodyProfile)}` +
        `${garmentCategoryStr(garmentProfile)}` +
        `${garmentProfile.color_lightness || 0.5}` +
        `${garmentProfile.silhouette || 'fitted'}`
    );
    return crypto.createHash('md5').update(seed).digest('hex').slice(0, 12);
}

/**
 * Generate complete UI-ready communication from scoring output.
 *
 * @param {Object} scoreResult - Serialized ScoreResult dict from /score endpoint
 * @param {Object} bodyProfile - Body profile dict (user_measurements from request)
 * @param {Object} garmentProfile - Garment profile dict (garment_attributes from request)
 * @param {Array} stylingGoals - Optional list of goal strings
 * @param {string} userName - User display name
 * @param {boolean} runGuardrails - Whether to validate output through guardrails
 * @returns {Object} Dict with all CommunicationOutput fields + guardrail_result
 */
export function generateCommunication(
    scoreResult,
    bodyProfile,
    garmentProfile,
    stylingGoals = null,
    userName = "You",
    runGuardrails = true
) {
    const overallScore = scoreResult.overall_score ?? 5.0;
    const bodyShape = bodyShapeStr(bodyProfile);
    const garmentCat = garmentCategoryStr(garmentProfile);
    const scenarioId = makeScenarioId(bodyProfile, garmentProfile);

    // ── Step 1: Verdict ──
    const [verdict, color] = selectVerdict(overallScore);

    // ── Step 2: Principle analysis ──
    const principleScores = scoreResult.principle_scores || [];
    const analysis = analyzePrinciples(principleScores);

    // ── Step 3: Headline + Pinch via phrase bank ──
    const scoredDict = {
        scenario_id: scenarioId,
        verdict,
        body_shape: bodyShape,
        garment_category: garmentCat,
        top_positive_key: analysis.top_positive_key,
        top_negative_key: analysis.top_negative_key,
        score_result: scoreResult,
    };
    const gold = generateGoldOutput(scoredDict);
    const headline = gold.headline || "";
    const pinch = gold.pinch || [];

    // ── Step 4: Goal chips ──
    const goalVerdicts = scoreResult.goal_verdicts || [];
    const goalChips = buildGoalChips(goalVerdicts);

    // ── Step 5: Search pills + context (NTO and SP only) ──
    const topNeg = analysis.top_negative_key || "_default";
    const searchPills = buildSearchPills(verdict, topNeg, garmentCat);
    const searchContext = buildSearchContext(verdict, topNeg, garmentCat);

    // ── Step 6: Chat chips ──
    const chatChips = buildChatChips(verdict, garmentCat);

    // ── Step 7: User line ──
    const bodyForLine = { ...bodyProfile };
    if (!bodyForLine.name) bodyForLine.name = userName;
    const userLine = buildUserLine(bodyForLine);

    // ── Step 8: Photo note ──
    const bodyAdjusted = scoreResult.body_adjusted || {};
    const photoNote = buildPhotoNote(bodyProfile, garmentProfile, bodyAdjusted);

    // ── Step 9: Confidence note ──
    const confidence = scoreResult.confidence ?? 0.70;
    const missingFields = garmentProfile.missing_fields || [];
    const confidenceNote = buildConfidenceNote(confidence, missingFields);

    // ── Step 10: Triple checks (TII only) ──
    const tripleChecks = buildTripleChecks(verdict, principleScores);

    // ── Step 11: Full take prompt context (deferred LLM layer) ──
    const fullTakeContext = buildFullTakeContext(
        verdict, overallScore, bodyShape, garmentCat,
        analysis, scoreResult
    );

    // ── Assemble output ──
    const output = new CommunicationOutput({
        verdict,
        verdict_color: color,
        headline,
        pinch: pinch.map(s => segToPinch(s)),
        user_line: userLine,
        goal_chips: goalChips,
        photo_note: photoNote,
        confidence_note: confidenceNote,
        triple_checks: tripleChecks,
        search_pills: searchPills,
        search_context: searchContext,
        chat_chips: chatChips,
        full_take_prompt_context: fullTakeContext,
    });

    const result = output.toDict();
    result.overall_score = Math.round(overallScore * 10) / 10;

    // ── Step 12: Guardrails ──
    if (runGuardrails) {
        const gr = checkOutput(result);
        result.guardrail_result = {
            passed: gr.passed,
            violations: gr.violations.map(v => ({
                rule: v.rule,
                severity: v.severity,
                text: v.text,
                suggestion: v.suggestion,
            })),
            warnings: gr.warnings.map(w => ({
                rule: w.rule,
                severity: w.severity,
                text: w.text,
                suggestion: w.suggestion,
            })),
        };
    }

    return result;
}

function segToPinch(seg) {
    if (typeof seg === 'object' && seg !== null) {
        return new PinchSegment({ text: seg.text || "", style: seg.style || "normal" });
    }
    return seg;
}

function buildFullTakeContext(verdict, overallScore, bodyShape, garmentCat, analysis, scoreResult) {
    /**
     * Build context string for the deferred LLM Full Stylist Take.
     *
     * This gets passed to the fine-tuned model when the user taps
     * "Tell me more" — it's NOT shown in the instant response.
     */
    const parts = [
        `verdict=${verdict} score=${overallScore.toFixed(1)}`,
        `body=${bodyShape} garment=${garmentCat}`,
    ];

    // Top 3 positives with reasoning
    for (const p of (analysis.positives || []).slice(0, 3)) {
        const name = p.name || "";
        const score = p.score || 0;
        const reasoning = p.reasoning || "";
        parts.push(`+${name}(${score >= 0 ? '+' : ''}${score.toFixed(2)}): ${reasoning}`);
    }

    // Top 3 negatives with reasoning
    for (const n of (analysis.negatives || []).slice(0, 3)) {
        const name = n.name || "";
        const score = n.score || 0;
        const reasoning = n.reasoning || "";
        parts.push(`-${name}(${score >= 0 ? '+' : ''}${score.toFixed(2)}): ${reasoning}`);
    }

    // Fixes
    const fixes = scoreResult.fixes || [];
    if (fixes.length > 0) {
        const fixStrs = [];
        for (const f of fixes.slice(0, 3)) {
            if (typeof f === 'object') {
                fixStrs.push(f.what_to_change || "");
            } else {
                fixStrs.push(String(f));
            }
        }
        parts.push(`fixes=[${fixStrs.join('; ')}]`);
    }

    return parts.join(" | ");
}
