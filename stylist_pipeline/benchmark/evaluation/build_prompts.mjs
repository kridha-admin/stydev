/**
 * Eval Prompt Assembler
 * =====================
 * Reads scoring_matrix.json + test data, builds structured LLM evaluation prompts.
 * Outputs eval_prompts.json + manual prompt files for GPT-4o / Gemini.
 *
 * Usage: node benchmark/evaluation/build_prompts.mjs
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const benchDir = join(__dirname, '..');

// ================================================================
// LOAD DATA
// ================================================================

const garments = JSON.parse(readFileSync(join(benchDir, 'test_cases/garments_10.json'), 'utf-8'));
const users = JSON.parse(readFileSync(join(benchDir, 'test_cases/users_10.json'), 'utf-8'));
const matrix = JSON.parse(readFileSync(join(benchDir, 'test_cases/scoring_matrix.json'), 'utf-8'));

const garmentMap = Object.fromEntries(garments.map(g => [g.garment_id, g]));
const userMap = Object.fromEntries(users.map(u => [u.user_id, u]));

// ================================================================
// SYSTEM PROMPT
// ================================================================

const SYSTEM_PROMPT = `You are a professional fashion stylist with 20 years of experience working with women of all body types, sizes, and styling goals. You understand how fabric weight, silhouette, neckline shape, hemline length, color value, and pattern interact with different body proportions to create visual effects.

You are evaluating an AI styling recommendation engine. For each test case, you will see:
1. A garment description (and optionally an image)
2. A woman's body profile (measurements, shape, height, goals)
3. The AI engine's recommendation (score, verdict, reasoning)

Your job is to evaluate whether the AI's recommendation would serve this woman well. Be critical. Look for:
- Verdicts that would lead to bad purchases (TII for a garment that will look terrible)
- Verdicts that would cause missed opportunities (NTO for a garment that would actually work)
- Reasoning that identifies the wrong strengths or weaknesses
- Missing issues the engine didn't catch (e.g., fabric cling risk, hemline in danger zone)
- Body-unsafe language or assumptions

Respond ONLY with the JSON evaluation object. No preamble, no explanation outside the JSON.`;

// ================================================================
// HELPERS
// ================================================================

function cmToInches(cm) {
    return (cm / 2.54).toFixed(1);
}

function cmToFeetInches(cm) {
    const totalInches = cm / 2.54;
    const feet = Math.floor(totalInches / 12);
    const inches = Math.round(totalInches % 12);
    return `${feet}'${inches}"`;
}

function goalToEnglish(goal) {
    const map = {
        look_taller: 'wants to appear taller',
        look_slimmer: 'wants to look slimmer overall',
        highlight_waist: 'wants to highlight and define her waist',
        hide_midsection: 'wants to conceal her midsection',
        minimize_hips: 'wants to minimize the appearance of her hips',
        balance_shoulders: 'wants to balance broad shoulders',
        hide_upper_arms: 'wants to conceal her upper arms',
        elongate_legs: 'wants her legs to look longer',
        create_curves: 'wants to create the appearance of curves',
        streamline_silhouette: 'wants a streamlined, smooth silhouette',
        minimize_bust: 'wants to minimize her bust',
        show_legs: 'wants to show off her legs',
    };
    return map[goal] || goal;
}

function bodyShapeExplanation(user) {
    const bust = cmToInches(user.chest_circumference);
    const waist = cmToInches(user.waist_circumference);
    const hip = cmToInches(user.hip_circumference);

    const explanations = {
        pear: `hips (${hip}") wider than bust (${bust}") — weight carries in lower body`,
        hourglass: `balanced bust (${bust}") and hips (${hip}") with defined waist (${waist}")`,
        rectangle: `bust (${bust}"), waist (${waist}"), and hips (${hip}") are similar — straight frame`,
        apple: `weight centered in midsection — waist (${waist}") close to hips (${hip}")`,
        inverted_triangle: `shoulders and bust (${bust}") wider than hips (${hip}") — top-heavy`,
    };
    return explanations[user.body_shape] || `${user.body_shape} shape`;
}

function summarizeGarmentAttrs(attrs) {
    const parts = [];
    if (attrs.garment_type) parts.push(`Type: ${attrs.garment_type}`);
    if (attrs.silhouette_type) parts.push(`Silhouette: ${attrs.silhouette_type}`);
    if (attrs.fabric_primary) parts.push(`Fabric: ${attrs.fabric_primary}${attrs.fabric_secondary ? ' + ' + attrs.fabric_secondary : ''}`);
    if (attrs.fabric_weight) parts.push(`Weight: ${attrs.fabric_weight}`);
    if (attrs.neckline_type) parts.push(`Neckline: ${attrs.neckline_type}`);
    if (attrs.hemline_position) parts.push(`Hemline: ${attrs.hemline_position}`);
    if (attrs.color_primary) parts.push(`Color: ${attrs.color_primary} (${attrs.color_value || ''})`);
    if (attrs.pattern_type) parts.push(`Pattern: ${attrs.pattern_type}`);
    if (attrs.fit_category) parts.push(`Fit: ${attrs.fit_category}`);
    if (attrs.waist_definition) parts.push(`Waist: ${attrs.waist_definition}`);
    return parts.join(', ');
}

// ================================================================
// BUILD PROMPTS
// ================================================================

const evalPrompts = [];

for (const result of matrix.results) {
    if (result.verdict === 'ERROR') continue;

    const garment = garmentMap[result.garment_id];
    const user = userMap[result.user_id];
    if (!garment || !user) continue;

    const goalsEnglish = (user.styling_goals || []).length > 0
        ? user.styling_goals.map(goalToEnglish).join('; ')
        : 'No specific goals selected (engine derives goals from body measurements)';

    // Top 3 positive and negative principles
    const principles = result.principle_scores || [];
    const applicable = principles.filter(p => p.applicable);
    const sorted = [...applicable].sort((a, b) => b.score - a.score);
    const top3Pos = sorted.slice(0, 3);
    const top3Neg = sorted.slice(-3).reverse();

    const topPosStr = top3Pos.map(p => `${p.name}: ${p.score >= 0 ? '+' : ''}${p.score.toFixed(3)}`).join(', ');
    const topNegStr = top3Neg.map(p => `${p.name}: ${p.score >= 0 ? '+' : ''}${p.score.toFixed(3)}`).join(', ');

    const userPrompt = `GARMENT:
${garment.garment_text_description}

Attributes: ${summarizeGarmentAttrs(garment.merged_attrs)}

WOMAN'S BODY PROFILE:
- Height: ${cmToFeetInches(user.height)}
- Body shape: ${user.body_shape} (${bodyShapeExplanation(user)})
- Key measurements: Bust ${cmToInches(user.chest_circumference)}", Waist ${cmToInches(user.waist_circumference)}", Hip ${cmToInches(user.hip_circumference)}"
- Size category: ${user.size_category}
- Her styling goals: ${goalsEnglish}

AI ENGINE RECOMMENDATION:
- Score: ${result.overall_score}/10
- Verdict: ${result.verdict === 'this_is_it' ? 'This Is It' : result.verdict === 'smart_pick' ? 'Smart Pick' : 'Not This One'}
- Headline: "${result.headline || ''}"
- Reasoning: "${result.pinch_text || ''}"
- Top positive principles: ${topPosStr || 'none'}
- Top negative principles: ${topNegStr || 'none'}
- Goal verdicts: ${(result.goal_verdicts || []).map(g => `${g.goal}=${g.verdict}`).join(', ') || 'none'}

EVALUATE THIS RECOMMENDATION:

{
  "verdict_correct": true or false,
  "verdict_should_be": "this_is_it" or "smart_pick" or "not_this_one",
  "score_reasonable": true or false,
  "score_expected_range": [low, high],
  "top_positive_correct": true or false,
  "what_is_actually_best": "free text — what the real top positive should be",
  "top_negative_correct": true or false,
  "what_is_actually_worst": "free text — what the real top concern should be",
  "missed_issues": ["list of problems the engine didn't catch"],
  "communication_body_safe": true or false,
  "body_safety_issue": null or "description of the problem",
  "communication_quality": 1 to 5,
  "confidence": "high" or "medium" or "low",
  "reasoning": "1-3 sentence explanation of your evaluation, especially any disagreements"
}`;

    evalPrompts.push({
        case_id: `${result.user_id}__${result.garment_id}`,
        garment_id: result.garment_id,
        user_id: result.user_id,
        system_prompt: SYSTEM_PROMPT,
        user_prompt: userPrompt,
        image_url: garment.merged_attrs.product_image_url || null,
        engine_score: result.overall_score,
        engine_verdict: result.verdict,
    });
}

// ================================================================
// WRITE EVAL PROMPTS JSON
// ================================================================

writeFileSync(
    join(__dirname, 'eval_prompts.json'),
    JSON.stringify({ total: evalPrompts.length, prompts: evalPrompts }, null, 2)
);
console.log(`Wrote ${evalPrompts.length} eval prompts to eval_prompts.json`);

// ================================================================
// WRITE MANUAL PROMPT FILES (for GPT-4o / Gemini)
// ================================================================

for (const modelDir of ['manual_prompts_gpt4o', 'manual_prompts_gemini']) {
    const dir = join(__dirname, modelDir);
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });

    // Batch by user
    for (const user of users) {
        const userPrompts = evalPrompts.filter(p => p.user_id === user.user_id);
        let batchContent = `SYSTEM PROMPT:\n${SYSTEM_PROMPT}\n\n`;
        batchContent += `${'='.repeat(80)}\n`;
        batchContent += `USER: ${user.user_label}\n`;
        batchContent += `${'='.repeat(80)}\n\n`;

        for (const prompt of userPrompts) {
            batchContent += `---CASE_BOUNDARY--- ${prompt.case_id}\n\n`;
            batchContent += prompt.user_prompt;
            batchContent += `\n\n`;
        }

        writeFileSync(
            join(dir, `${user.user_id}_batch.txt`),
            batchContent
        );
    }
    console.log(`Wrote manual prompt batches to ${modelDir}/`);
}

// ================================================================
// WRITE RUBRIC
// ================================================================

const rubric = `# Evaluation Rubric

## Verdict Correctness
- **This Is It (TII):** The garment genuinely flatters this body type, addresses her goals, and she'd look great in it. Score 8.0+.
- **Smart Pick (SP):** The garment mostly works but has one notable trade-off. She could make it work with styling. Score 5.0-7.9.
- **Not This One (NTO):** The garment actively works against her body type or goals. Not recommended. Score < 5.0.

## Score Reasonableness
The evaluator should estimate where the score SHOULD fall, then check if the engine's score is within ±1.5 points.

## Communication Quality (1-5)
1. Misleading or harmful
2. Technically accurate but confusing
3. Correct and clear
4. Helpful and well-phrased
5. Excellent — could be a professional stylist speaking

## Body Safety
Any language that:
- Implies the body is the problem (not the garment)
- Uses shame-adjacent words ("unflattering," "problem area")
- Makes assumptions about what the woman SHOULD want to look like
→ Fails body safety
`;

writeFileSync(join(__dirname, 'eval_rubric.md'), rubric);
console.log('Wrote eval_rubric.md');
console.log('\nDone.');
