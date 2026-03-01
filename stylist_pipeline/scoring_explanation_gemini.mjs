/**
 * Scoring Explanation Generator (Gemini Version)
 * Uses Google Gemini to convert scoring reasoning into natural language explanations
 */

import { GoogleGenAI } from "@google/genai";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const PROJECT_ID = process.env.GOOGLE_CLOUD_PROJECT || "durable-unity-464716-f0";
const LOCATION = process.env.GOOGLE_CLOUD_LOCATION || "global";
const KEY_FILE = process.env.GOOGLE_APPLICATION_CREDENTIALS || join(__dirname, "gcp-vertex-ai-key.json");

// Use Gemini 2.5 Flash for explanation generation
const TEXT_MODEL_ID = process.env.EXPLANATION_GEMINI_MODEL_ID || 'gemini-2.5-flash-lite';

// Config
const TEXT_TIMEOUT_MS = 30000;
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 1000;

// Initialize the Gen AI SDK with Vertex AI
const ai = new GoogleGenAI({
    vertexai: true,
    project: PROJECT_ID,
    location: LOCATION,
    googleAuthOptions: {
        keyFile: KEY_FILE,
    },
});

// ============================================================================
// SYSTEM PROMPT FOR EXPLANATION GENERATION
// ============================================================================

const EXPLANATION_SYSTEM_PROMPT = `You are a friendly stylist explaining how a garment fits someone's style goals.

CRITICAL RULES:
1. NEVER use words: "verdict", "pass", "fail", "caution", "score" - describe naturally
2. NEVER contradict goal results - if goal works, say it works; if it doesn't, say it doesn't
3. Blame the GARMENT for negatives, never the body

OUTPUT FORMAT:
- headline: SHORT paraphrase of input Headline (5-10 words ONLY, not more)
- summary: 2 sentences about which GOALS work and which don't (mention goal names!)
- explanation: 1-3 paragraphs, each 2-3 sentences MAX. Cover all goals naturally.
- verdict: Copy EXACT verdict from input (this_is_it, smart_pick, or not_this_one)

GOAL NAMES: "looking taller", "slimming your hips", "highlighting your waist", "looking proportional"

SUMMARY EXAMPLE (mention goals + brief reason WHY):
"This dress helps you look taller with its flattering hemline and slims your hips thanks to the matte fabric. However, the loose silhouette doesn't define your waist."

NOT like this (too generic): "This dress successfully helps you achieve goals like looking taller. However, it may not effectively highlight your waist."`;

const EXPLANATION_USER_PROMPT = `{INPUT}

Return JSON (NEVER use words "verdict", "pass", "fail", "caution"):
{
  "headline": "5-10 words ONLY - short paraphrase of input Headline",
  "summary": "2 sentences: which GOALS work + brief WHY (e.g., 'helps you look taller with its high rise')",
  "explanation": ["1-3 paragraphs, each 2-3 sentences max"],
  "verdict": "copy EXACT verdict from input",
  "key_benefits": ["benefit 1", "benefit 2"],
  "considerations": ["consideration if any"]
}`;

// ============================================================================
// UTILITIES
// ============================================================================

function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

function withTimeout(promise, ms) {
    return Promise.race([
        promise,
        new Promise((_, reject) =>
            setTimeout(() => reject(new Error(`Request timed out after ${ms}ms`)), ms)
        ),
    ]);
}

// ============================================================================
// GEMINI API CALL WITH RETRY
// ============================================================================

async function callGeminiWithRetry(request, timeoutMs = TEXT_TIMEOUT_MS, retries = MAX_RETRIES) {
    for (let attempt = 1; attempt <= retries; attempt++) {
        try {
            const response = await withTimeout(
                ai.models.generateContent(request),
                timeoutMs
            );
            return response;
        } catch (error) {
            const is429 = error.message?.includes("429") || error.status === 429;
            const isTimeout = error.message?.includes("timed out");

            if ((is429 || isTimeout) && attempt < retries) {
                console.log(`  Attempt ${attempt} failed (${is429 ? "429 rate limit" : "timeout"}), retrying in ${RETRY_DELAY_MS}ms...`);
                await sleep(RETRY_DELAY_MS);
                continue;
            }

            throw error;
        }
    }
}

// ============================================================================
// MAIN GENERATION FUNCTION
// ============================================================================

/**
 * Generate a natural language explanation from scoring reasoning
 * @param {string} scoringReasoning - The raw scoring output with principles and goals
 * @param {string} productInfo - Product title and description (optional)
 * @returns {Promise<Object>} - Generated explanation
 */
export async function generateScoringExplanationGemini(scoringReasoning, productInfo = '') {
    console.log("===== SCORING EXPLANATION (Gemini) =====\n");
    console.log("scoringReasoning: ", scoringReasoning);
    console.log("productInfo: ", productInfo);

    if (!scoringReasoning || scoringReasoning.trim().length === 0) {
        return {
            success: false,
            error: 'Empty scoring reasoning provided',
            result: null
        };
    }

    // Combine product info and scoring reasoning
    let input = '';
    if (productInfo && productInfo.trim().length > 0) {
        input += `PRODUCT:\n${productInfo}\n\n`;
    }
    input += `SCORING ANALYSIS:\n${scoringReasoning}`;

    const userPrompt = EXPLANATION_USER_PROMPT.replace('{INPUT}', input);

    const request = {
        model: TEXT_MODEL_ID,
        systemInstruction: EXPLANATION_SYSTEM_PROMPT,
        contents: [
            {
                role: "user",
                parts: [
                    { text: userPrompt }
                ],
            },
        ],
        generationConfig: {
            maxOutputTokens: 1024,
            temperature: 0.7,
        },
    };

    try {
        const startTime = Date.now();
        const response = await callGeminiWithRetry(request, TEXT_TIMEOUT_MS);
        console.log(`Gemini explanation generation took ${Date.now() - startTime}ms`);

        const responseText = response.text;
        if (!responseText) {
            throw new Error('No response from model');
        }

        // Parse JSON response
        const jsonMatch = responseText.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
            // Fallback: treat as plain text paragraphs
            const paragraphs = responseText.split(/\n\n+/).filter(p => p.trim().length > 0);
            return {
                success: true,
                result: {
                    explanation: paragraphs.length > 0 ? paragraphs : [responseText],
                    headline: null,
                    summary: null,
                    verdict: null,
                    key_benefits: [],
                    considerations: []
                },
                usage: {
                    inputTokens: response.usageMetadata?.promptTokenCount || 0,
                    outputTokens: response.usageMetadata?.candidatesTokenCount || 0,
                }
            };
        }

        const result = JSON.parse(jsonMatch[0]);

        return {
            success: true,
            result: {
                explanation: result.explanation || [],
                headline: result.headline || null,
                summary: result.summary || null,
                verdict: result.verdict || null,
                key_benefits: result.key_benefits || [],
                considerations: result.considerations || []
            },
            usage: {
                inputTokens: response.usageMetadata?.promptTokenCount || 0,
                outputTokens: response.usageMetadata?.candidatesTokenCount || 0,
            }
        };

    } catch (error) {
        console.error('Explanation generation error:', error);
        return {
            success: false,
            error: error.message,
            result: null
        };
    }
}

/**
 * Simple version that just returns the explanation string
 * @param {string} scoringReasoning - The raw scoring output
 * @param {string} productInfo - Product title and description (optional)
 * @returns {Promise<string|null>} - The explanation text or null on error
 */
export async function getExplanationText(scoringReasoning, productInfo = '') {
    const result = await generateScoringExplanationGemini(scoringReasoning, productInfo);
    if (result.success && result.result) {
        return result.result.explanation;
    }
    return null;
}

// ============================================================================
// CLI TESTING
// ============================================================================

let product1 = {
    "scoring_reasoning" : `Evaluating how this garment's color creates visual slimming or expansion effects for your body
 Pro: This garment has a medium-dark color which provides moderate slimming benefits, +0.04
 Con: For petite frames with this full-body dark garment, an all-dark look can visually compress your height and make you appear shorter than you are, (x0.6)
 ########################
Evaluating how this garment's A-line silhouette creates balance and flatters your figure
 Pro: This garment has a subtle A-line flare that creates gentle shape without overwhelming, +0.20
 Con: This garment has a stiff fabric that creates a 'shelf effect' at the hips rather than flowing smoothly over them
 Pro: For petite frames with this garment, the subtle A-line flare is well-proportioned for your frame, +0.05
 ########################
Evaluating how this garment's loose silhouette balances coverage with how it affects perceived size
 Pro: This garment has a semi-fitted silhouette that skims your body without being too tight or too loose — an ideal balance, +0.15
 ########################
Evaluating how this body-hugging garment works with your body shape and whether the fabric provides support
 This garment isn't body-hugging (bodycon) — not applicable for this analysis
 ########################
Evaluating how this garment's fabric sheen (matte vs shiny) affects perceived body volume
 Pro: This garment has a deeply matte fabric that absorbs light rather than reflecting it, creating a slimming effect, +0.08
 Pro: For your pear body shape with this garment on your lower body, a matte fabric helps minimize attention to your curvier hip area, (x1.3)
 ########################
Analyzing how this garment's neckline affects your vertical proportions
 Pro: This garment's scoop neckline creates mild vertical elongation by drawing the eye downward from the face, +0.05
 ########################
Evaluating how this garment's hemline placement flatters your leg line and proportions
 Pro: For petite frames with this garment ending above the knee, showing more leg creates a significant elongating effect that makes you appear taller, +0.63
 Note: This garment's hemline falls at your upper thigh, which works but isn't the most flattering spot for your leg shape, -0.10
 ########################
Evaluating how this garment's sleeve length flatters your arms
 This garment is sleeveless — no sleeve coverage to evaluate
 ########################
Evaluating how this garment's waistline placement affects your proportions
 ########################
Evaluating how this garment's color lightness affects slimming and visual expansion
 Note: This garment has a medium color which is neutral in terms of slimming/expanding
 ########################
Assessing how this garment's fabric properties (cling, structure, drape) work with your body type
 Note: This garment has a moderately clingy fabric that may cling in some areas, -0.05
 Pro: This garment has a structured fabric that provides support and creates a polished silhouette, +0.15
 Con: This garment has a stiff fabric that holds its own shape rather than following your body's contours, -0.10
 ########################
Evaluating how this garment's V-neckline depth flatters your bust and creates torso slimming
 Pro: This garment has a conservative V-neck depth that flatters without being too revealing, +0.30
 Pro: For your pear body shape with this garment, the V-neckline draws attention upward to your face and torso, creating better upper-lower body balance, +0.30
 ########################
Goal goal: look_taller
Goal verdict: pass
Goal Principles: +V-Neck Elongation (+0.05), +Hemline (+0.53)

 ########################
Goal goal: slim_hips
Goal verdict: pass
Goal Principles: +Dark/Black Slimming (+0.02), +A-Line Balance (-0.01), +Matte Zone (+0.10), +Hemline (+0.53)

 ########################
Goal goal: highlight_waist
Goal verdict: fail
Goal Principles: -Tent Concealment avoided (0.15)

 ########################
Goal goal: look_proportional
Goal verdict: pass
Goal Principles: +Hemline (+0.53), -Tent Concealment avoided (0.15)

 ########################
Headline: Yes to this dress — the shape is spot on.
Verdict: this_is_it
Overall Score: 7.8`,
    "product_info" : `Title: Casual Summer Dress for Women 2026`
}


async function main() {
    const scoringReasoning = product1.scoring_reasoning;
    const productInfo = product1.product_info;

    const result = await generateScoringExplanationGemini(scoringReasoning, productInfo);

    if (result.success) {
        console.log('=== GENERATED EXPLANATION ===\n');
        console.log('HEADLINE:', result.result.headline);
        console.log('VERDICT:', result.result.verdict);
        console.log('\nSUMMARY:', result.result.summary);
        console.log('\nEXPLANATION:');
        console.log(result.result.explanation);
        console.log('\nKEY BENEFITS:', result.result.key_benefits);
        console.log('CONSIDERATIONS:', result.result.considerations);

        console.log('\n=== TOKEN USAGE ===\n');
        const usage = result.usage || {};
        console.log({
            inputTokens: usage.inputTokens || 0,
            outputTokens: usage.outputTokens || 0,
            totalTokens: (usage.inputTokens || 0) + (usage.outputTokens || 0),
        });
    } else {
        console.error('Generation failed:', result.error);
    }
}

// Run if called directly (not imported)
if (import.meta.url === `file://${process.argv[1]}`) {
    try {
        await main();
        process.exit(0);
    } catch (error) {
        console.error("Error:", error.message);
        process.exit(1);
    }
}
