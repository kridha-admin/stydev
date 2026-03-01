/**
 * Nova Micro Bedrock API - Fine-tuned Stylist Model
 */

import {
    BedrockRuntimeClient,
    ConverseCommand
} from "@aws-sdk/client-bedrock-runtime";
import dotenv from 'dotenv';
dotenv.config();

const REGION = process.env.BEDROCK_REGION || 'us-east-1';
const ACCESS_KEY_ID = process.env.BEDROCK_ACCESS_KEY_ID;
const SECRET_ACCESS_KEY = process.env.BEDROCK_SECRET_ACCESS_KEY;
// const MODEL_ID = 'arn:aws:bedrock:us-east-1:955891180575:custom-model-deployment/q8qu91b8yfse';
const MODEL_ID = process.env.BEDROCK_FINETUNED_STYLIST_MODEL_ID;

const client = new BedrockRuntimeClient({
    region: REGION,
    credentials: {
        accessKeyId: ACCESS_KEY_ID,
        secretAccessKey: SECRET_ACCESS_KEY,
    }
});

const SYSTEM_PROMPT = `You are Kridha — a smart best friend who knows fashion construction inside out, with the directness of a protective big sister when it matters.

## YOUR VOICE

Energy calibration by verdict:
- THIS IS IT (score >= 5.5): Genuinely excited, not performative. "These are your pants." not "OMG BUY THIS!!!"
- SMART PICK (4.5-5.4): Honest optimism + clear fix. "Love the dress — one thing to sort out."
- NOT THIS ONE (< 4.5): Protective, never cruel. "The fabric won't do what you need." not "This will look terrible."

You sound like:
- Warm, clear, decisive. Use contractions. Sound like a knowledgeable friend.
- Describe the MIRROR — what the user will SEE — not fashion theory.
- Use plain language. If you must use a term like "ponte," explain it: "a thick structured knit that smooths and shapes."
- Be direct. "This won't work" not "this might not be ideal."
- 2-4 sentences for The Pinch. Never more.

## BODY-SAFE LANGUAGE RULES (NON-NEGOTIABLE)

Rule 1 — THE GARMENT IS ALWAYS THE SUBJECT OF NEGATIVES:
  NEVER: "Your hips are too wide for this"
  ALWAYS: "This fabric clings at the hip instead of skimming past"

Rule 2 — NEVER COMPARE TO OTHER BODIES:
  ONLY compare model HEIGHT: "The model is 5'9" — this lands differently on you at 5'3"."

Rule 3 — NEVER DESCRIBE BODY PARTS NEGATIVELY:
  ALWAYS: "follows every contour instead of creating a smooth line"

Rule 4 — FORBIDDEN TERMS:
  NEVER use: "plus size", "overweight", "heavy-set", "full-figured", "fat", "chubby"

Rule 5 — EVERY NEGATIVE MUST HAVE A REDIRECT:
  After every problem, give a fix or search suggestion.

Rule 6 — NO HEDGING, NO AI REFERENCES:
  State findings directly. A good stylist is decisive.

## OUTPUT FORMAT

Return valid JSON:
{
  "headline": "One decisive sentence. Big sister energy.",
  "pinch": [
    {"text": "...", "style": "normal|positive|negative|fix"}
  ]
}

Rules:
- headline: 1 sentence, under 80 characters
- pinch: 3-8 segments, total 2-4 sentences
- THIS IS IT: mostly positive segments, no fix needed
- SMART PICK: positive + negative + fix
- NOT THIS ONE: positive about design, negative about fabric/fit, then fix`;

export async function callStylistModel(testInput) {
    const input = {
        modelId: MODEL_ID,
        system: [{ text: SYSTEM_PROMPT }],
        messages: [
            {
                role: "user",
                content: [{ text: testInput }]
            }
        ],
        inferenceConfig: {
            maxTokens: 512,
            temperature: 0.1,
        }
    };

    const command = new ConverseCommand(input);
    const response = await client.send(command);
    const rawText = response.output?.message?.content?.[0]?.text;

    // Parse and validate JSON
    let parsed;
    try {
        parsed = JSON.parse(rawText);
    } catch (e) {
        return { error: 'Invalid JSON', raw: rawText };
    }

    // Validate structure
    if (!parsed.headline || typeof parsed.headline !== 'string') {
        return { error: 'Missing or invalid headline', raw: rawText };
    }
    if (!Array.isArray(parsed.pinch) || parsed.pinch.length < 1) {
        return { error: 'Missing or invalid pinch array', raw: rawText };
    }

    const validStyles = ['normal', 'positive', 'negative', 'fix'];
    for (const segment of parsed.pinch) {
        if (!segment.text || !validStyles.includes(segment.style)) {
            return { error: 'Invalid pinch segment', raw: rawText };
        }
    }

    return { success: true, data: parsed };
}

// Sample test input
const TEST_INPUT = `VERDICT: this_is_it
SCORE: 5.5/10 (confidence: 0.70)

GARMENT: Floral Flutter-Sleeve Romper
  Category: romper

PROFILE:
  Height: 5'3"
  Body shape: rectangle
  Goals: look_proportional

SCORING BREAKDOWN:
  A-Line Balance: -0.12 (slight negative) — ER=0.10: base A-line = +0.25 | DC=70% (stiff): shelf effect INVERSION
  Matte Zone: +0.08 (slight positive) — Deeply matte (SI=0.10): +0.08
  V-Neck Elongation: +0.10 (slight positive) — V-neck: base elongation +0.10
  hemline position: +0.50 (strong positive) — Hem 19.5" from floor -> above_knee
  Color Value: -0.03 (neutral) — Color L=65: slim_pct=-0.005, score=-0.031
  Fabric Zone: -0.03 (neutral) — Fabric zone: stretch=0.0%, GSM=99, sheen=0.10
  Neckline Compound: +0.20 (slight positive) — Bust: depth=3.1", threshold=7.0", ratio=0.45, score=+0.30

GOAL VERDICTS:
  look_proportional: pass (+0.232)

EXCEPTIONS:
  A-line + stiff fabric (DC=70%): fabric won't drape, creates shelf effect at hips

Generate the headline and pinch for this garment. Return valid JSON only.`;

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
    const result = await callStylistModel(TEST_INPUT);
    console.log(JSON.stringify(result, null, 2));
}
