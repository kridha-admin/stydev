/**
 * Scoring Explanation Generator
 * Uses Bedrock LLM to convert scoring reasoning into natural language explanations
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

// Text model for explanation generation
const TEXT_MODEL_ID = process.env.EXPLANATION_BEDROCK_TEXT_MODEL_ID || 'amazon.nova-pro-v1:0';

const client = new BedrockRuntimeClient({
    region: REGION,
    credentials: {
        accessKeyId: ACCESS_KEY_ID,
        secretAccessKey: SECRET_ACCESS_KEY,
    }
});

// ============================================================================
// SYSTEM PROMPT FOR EXPLANATION GENERATION
// ============================================================================

const EXPLANATION_SYSTEM_PROMPT = `You are a personal stylist AI that explains clothing recommendations in a warm, helpful, and conversational tone.

Your task is to take technical scoring data about how a garment fits someone's style goals and convert it into a friendly, easy-to-understand explanation.

CRITICAL: VERDICT IS ALREADY DETERMINED
The input includes a pre-calculated Verdict ("this_is_it", "smart_pick", or "not_this_one") and Overall Score.
YOU MUST OUTPUT THE EXACT VERDICT FROM THE INPUT. Do NOT change, map, or translate it.
- If Verdict is "smart_pick" → output "smart_pick" and balance strengths AND weaknesses
- If Verdict is "this_is_it" → output "this_is_it" and focus on positives with any noted concerns
- If Verdict is "not_this_one" → output "not_this_one" and explain why honestly but kindly

WRITING STYLE:
- Write like a knowledgeable friend giving fashion advice
- Be HONEST - if there are cons, mention them clearly
- Use simple language, avoid technical jargon
- Be specific about WHY something works or doesn't work
- Keep it concise but informative (5-10 sentences)

STRUCTURE YOUR RESPONSE AS 2-4 SHORT PARAGRAPHS:
1. Paragraph 1: Goals that PASSED - name each goal explicitly (e.g., "For looking taller, this dress works because...")
2. Paragraph 2: Goals that FAILED or have CAUTION - name each goal explicitly and explain why (e.g., "For highlighting your waist, this dress falls short because...")
3. Paragraph 3 (optional): Brief summary matching the verdict tone

CRITICAL FORMATTING:
- Each paragraph MUST be exactly 2-3 sentences. NO MORE than 3 sentences per paragraph.
- You MUST name each goal explicitly in natural language (e.g., "looking taller", "slimming your hips", "highlighting your waist", "looking proportional")
- Do NOT start paragraphs with "(Pro)" or "(Con)" - write naturally
Return as an array of paragraph strings.

FOCUS ON STYLING ANALYSIS ONLY:
- Use the scoring analysis (pros, cons, goal verdicts) as your source
- Ignore product marketing text (pockets, adjustable straps, materials, care instructions)
- The explanation is about how the garment flatters or doesn't flatter the user's body

PRIORITIZATION - FOCUS ON GOALS:
- MOST IMPORTANT: You MUST mention EVERY goal by name and explain its verdict
- Convert goal names to natural language: "look_taller" → "looking taller", "slim_hips" → "slimming your hips", "highlight_waist" → "highlighting your waist", "look_proportional" → "looking proportional"

HOW GOALS ARE BUILT:
- Each Goal has a "Goal Principles" line showing which evaluations contributed to it (e.g., "+Hemline (+0.15), +Matte Zone (+0.10)")
- To explain a goal, look at the EARLIER evaluation sections that match these principles
- Example: If "Goal Principles: +Hemline (+0.15)" → refer back to "Evaluating Hemline:" section to find the Pro/Con details
- Use these specific Pro/Con details to explain WHY the goal passed, failed, or has caution

CRITICAL - NEVER CONTRADICT GOAL VERDICTS:
- If a goal says "verdict: pass" → your explanation MUST say it WORKS (never say "doesn't help" or "falls short")
- If a goal says "verdict: fail" → your explanation MUST say it DOESN'T WORK (never say "works well" or "helps")
- If a goal says "verdict: caution" → your explanation MUST acknowledge TRADE-OFFS (mixed results)
DO NOT use your own judgment to override the provided goal verdicts. Trust the scoring system.

- For PASSING goals: "This dress works well for [goal] because [reason]" or "This dress helps you [goal] by [reason]"
- For FAILING goals: "This dress doesn't help with [goal] because [reason]" or "This dress falls short on [goal] since [reason]"
- For CAUTION goals: "This dress partially helps with [goal] — [pros], but [cons]" or "This dress has mixed results for [goal]: [trade-offs]"

IMPORTANT: Vary the sentence structure naturally. Do NOT start every sentence with "For [goal]..." - that looks too formulaic.
- Focus on STYLING analysis only - ignore product marketing features

DO'S:
- Output the EXACT verdict from input (this_is_it, smart_pick, or not_this_one)
- Explain each goal's outcome (pass/fail/caution) with brief reasoning
- Keep paragraphs SHORT - exactly 2-3 sentences each
- Be honest about trade-offs

DON'TS:
- Don't change or map the verdict to different terms
- Don't ignore failed or caution goals
- Don't be overly enthusiastic for "smart_pick" verdicts
- Don't list raw scores or numbers - explain in plain language
- Don't use technical terms like "x0.6 multiplier" or "amplified"
- Don't use bullet points - write in flowing paragraphs
- Don't write paragraphs longer than 3 sentences
- NEVER wrap paragraphs in parentheses like "(This dress...)" - write plain text without surrounding parentheses
- NEVER mention "verdict", "pass", "fail", or "caution" explicitly in the text - just describe what works/doesn't work naturally
- NEVER include the Overall Score number or repeat the Headline in your explanation paragraphs

BODY-POSITIVE LANGUAGE (CRITICAL):
The user's body is perfect as it is. When something doesn't work, ALWAYS blame the garment, NEVER the body.

Reframe negatives as GARMENT limitations:
- SAY: "This dress's hemline falls at an awkward spot" NOT "your thighs are too wide for this"
- SAY: "This neckline doesn't complement your proportions" NOT "your shoulders are too broad"
- SAY: "This fabric clings rather than skims" NOT "your midsection is too prominent"
- SAY: "This cut wasn't designed to highlight your best features" NOT "your body doesn't suit this style"

NEVER use these phrases:
- "hide your flaws" / "problem areas" / "too wide" / "too short" / "too long"
- Any language implying the body needs fixing, hiding, or correcting
- Any phrasing that makes the user feel bad about their body

ALWAYS use empowering alternatives:
- "This garment doesn't do you justice" instead of "you don't look good in this"
- "There are better options that would flatter you more" instead of "your shape doesn't work for this"
- "This style isn't the best match for your frame" instead of "your frame is wrong for this"

Position styling goals as PREFERENCES, not fixes:
- Goals like "elongate" or "slim" are about achieving a desired aesthetic, not correcting defects
- The user chose these goals - they're styling preferences, not body problems to solve`;

const EXPLANATION_USER_PROMPT = `Here is the product and scoring analysis:

---
{INPUT}
---

Write 2-4 SHORT paragraphs (2-3 sentences each). Mention each goal naturally:
- "This dress works well for looking taller because..."
- "This dress partially helps with slimming your hips — [pros] but [cons]..."
- "This dress doesn't help with highlighting your waist since..."

Vary your sentence structure naturally. Cover EVERY goal's verdict (pass/fail/caution) with brief reasoning. Use the EXACT verdict from the input.`;

// ============================================================================
// TOOL DEFINITION FOR FORCED JSON OUTPUT
// ============================================================================

const EXPLANATION_TOOL = {
    toolSpec: {
        name: "generate_styling_explanation",
        description: "Generate a natural language explanation of the styling analysis",
        inputSchema: {
            json: {
                type: "object",
                properties: {
                    explanation: {
                        type: "array",
                        items: { type: "string" },
                        description: "2-4 SHORT paragraphs (EXACTLY 2-3 sentences each). Plain text only - NO parentheses wrapping. Name each goal explicitly. First paragraph: passing goals. Second: failing/caution goals."
                    },
                    headline: {
                        type: "string",
                        description: "A short 5-10 word headline summarizing the recommendation (e.g., 'Great for elongating your silhouette')"
                    },
                    verdict: {
                        type: "string",
                        enum: ["this_is_it", "smart_pick", "not_this_one"],
                        description: "Use the EXACT verdict from the input - do not change or map it"
                    },
                    key_benefits: {
                        type: "array",
                        items: { type: "string" },
                        description: "2-3 key benefits in short phrases"
                    },
                    considerations: {
                        type: "array",
                        items: { type: "string" },
                        description: "0-2 considerations or trade-offs in short phrases"
                    }
                },
                required: ["explanation", "headline", "verdict", "key_benefits", "considerations"]
            }
        }
    }
};

// ============================================================================
// MAIN GENERATION FUNCTION
// ============================================================================

/**
 * Generate a natural language explanation from scoring reasoning
 * @param {string} scoringReasoning - The raw scoring output with principles and goals
 * @param {string} productInfo - Product title and description (optional)
 * @returns {Promise<Object>} - Generated explanation
 */
export async function generateScoringExplanation(scoringReasoning, productInfo = '') {
    console.log("===== SCORING EXPLANATION =====\n");
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

    const requestInput = {
        modelId: TEXT_MODEL_ID,
        system: [
            { text: EXPLANATION_SYSTEM_PROMPT }
        ],
        messages: [
            {
                role: "user",
                content: [
                    { text: userPrompt }
                ]
            }
        ],
        inferenceConfig: {
            maxTokens: 1024,
            temperature: 0.7, // Slightly higher for more natural writing
        },
        // Force tool use for guaranteed JSON output
        toolConfig: {
            tools: [EXPLANATION_TOOL],
            toolChoice: {
                tool: {
                    name: "generate_styling_explanation"
                }
            }
        }
    };

    try {
        const command = new ConverseCommand(requestInput);
        const response = await client.send(command);

        // With tool use, the response is in toolUse block
        const toolUseBlock = response.output?.message?.content?.find(
            block => block.toolUse
        );

        if (toolUseBlock?.toolUse?.input) {
            return {
                success: true,
                result: toolUseBlock.toolUse.input,
                usage: response.usage
            };
        }

        // Fallback: try to parse text response
        const responseText = response.output?.message?.content?.[0]?.text;
        if (responseText) {
            // Split into paragraphs if it's a single string
            const paragraphs = responseText.split(/\n\n+/).filter(p => p.trim().length > 0);
            return {
                success: true,
                result: {
                    explanation: paragraphs.length > 0 ? paragraphs : [responseText],
                    headline: null,
                    verdict: null,
                    key_benefits: [],
                    considerations: []
                },
                usage: response.usage
            };
        }

        throw new Error('No valid response from model');

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
    const result = await generateScoringExplanation(scoringReasoning, productInfo);
    if (result.success && result.result) {
        return result.result.explanation;
    }
    return null;
}

// ============================================================================
// CLI TESTING
// ============================================================================

const DEFAULT_SCORING_REASONING = `scoreDarkSlimming: Evaluates how dark colors create visual slimming through light absorption
 Con: Petite all-dark: height collapse (x0.6)
 ########################
scoreBodyconMapping: Evaluates body-hugging fit suitability based on body shape and fabric
 Con: Pear + thin: -0.30
 ########################
scoreMatteZone: Evaluates matte vs shiny fabric effects on perceived body volume
 Pro: Deeply matte +0.08
 Pro: Pear lower/full: matte benefit amplified (x1.3)
 ########################
scoreVneckElongation: Evaluates how V-necklines and other neckline styles affect vertical elongation
 ########################
scoreHemline: Evaluates hem placement relative to leg anatomy and danger zones
 Pro: Petite above-knee: elongation +0.64
 Con: Thigh penalty (>22): -0.10
 ########################
scoreColorValue: Evaluates color lightness impact on slimming vs expanding effects
 Pro: Very dark color: slimming +4%
 ########################
scoreFabricZone: Evaluates fabric properties like cling, structure, and drape for body flattery
 Pro: Low cling risk +0.10
 Con: Stiff fabric -0.10
 ########################
Goal goal: look_taller
Goal verdict: pass
Goal Principles: +Hemline (+0.54)

 ########################
Goal goal: slim_hips
Goal verdict: pass
Goal Principles: +Dark/Black Slimming (+0.09), +Matte Zone (+0.10), +Hemline (+0.54), -Bodycon Mapping avoided (-0.30)

 ########################
Goal goal: highlight_waist
Goal verdict: fail
Goal Principles: +Bodycon Mapping (-0.30)

 ########################
Goal goal: look_proportional
Goal verdict: pass
Goal Principles: +Hemline (+0.54)

 ########################`;

const DEFAULT_PRODUCT_INFO = `Satin Prom Dress Corset Prom Long A Line Pleated Bridesmaid Backless Formal Spaghetti Strap for Gowns

Material: High-quality satin material with a luxurious sheen perfect for formal events like proms weddings or evening galas`;

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
    "product_info" : `Title: Casual Summer Dress for Women 2026 Color Block Floral Spaghetti Strap Maxi Dress Orange Floral L at Amazon Women's Clothing store descriptions:  Product details;  Fabric type;  Main Fabric:80%Viscose+20%Polyamide;  Contrast Fabric:60%Polyester+35%Cotton+5%Elastane;  Lining:98%Polyester+2%Viscose;  Origin;  Imported;  Closure type;  Spaghetti Strap;  Neck style;  V-Neck;  About this item;  Adjustable Fit For All-Day Comfort:Customize strap length for perfect support without slipping. Stretchy bodice hugs curves comfortably. Flowy A-line skirt moves freely with you;  Hidden Pockets & Flattering Silhouette:Practical side pockets hold phones or keys discreetly. A-line shape skims over hips and thighs. Designed to highlight your natural waist beautifully;  Stylish Two-Tone & Floral Design:Contrast color trim accents the neckline for a chic pop. Solid stretch top pairs with vibrant floral skirt. Modern blend of minimalist and playful patterns;  Effortless Versatility Day To Night:Dress up with heels or keep casual with sneakers easily. Lightweight fabric ideal for brunch, work, or dates. Wrinkle-resistant material stays fresh all day long;  Premium Quality With Thoughtful Details:Soft, breathable fabric maintains shape wash after wash. Secure stitching and adjustable hardware ensure durability. Designed for real life—combines style, comfort, and function seamlessly;  See more About this item;  Product details;  Fabric type;  Main Fabric:80%Viscose+20%Polyamide;  Contrast Fabric:60%Polyester+35%Cotton+5%Elastane;  Lining:98%Polyester+2%Viscose;  Origin;  Imported;  Closure type;  Spaghetti Strap;  Neck style;  V-Neck;  About this item;  Adjustable Fit For All-Day Comfort:Customize strap length for perfect support without slipping. Stretchy bodice hugs curves comfortably. Flowy A-line skirt moves freely with you;  Hidden Pockets & Flattering Silhouette:Practical side pockets hold phones or keys discreetly. A-line shape skims over hips and thighs. Designed to highlight your natural waist beautifully;  Stylish Two-Tone & Floral Design:Contrast color trim accents the neckline for a chic pop. Solid stretch top pairs with vibrant floral skirt. Modern blend of minimalist and playful patterns;  Effortless Versatility Day To Night:Dress up with heels or keep casual with sneakers easily. Lightweight fabric ideal for brunch, work, or dates. Wrinkle-resistant material stays fresh all day long;  Premium Quality With Thoughtful Details:Soft, breathable fabric maintains shape wash after wash. Secure stitching and adjustable hardware ensure durability. Designed for real life—combines style, comfort, and function seamlessly;  See more About this item;  Product details;  Fabric type;  Main Fabric:80%Viscose+20%Polyamide;  Contrast Fabric:60%Polyester+35%Cotton+5%Elastane;  Lining:98%Polyester+2%Viscose;  Origin;  Imported;  Closure type;  Spaghetti Strap;  Neck style;  V-Neck;  About this item;  Adjustable Fit For All-Day Comfort:Customize strap length for perfect support without slipping. Stretchy bodice hugs curves comfortably. Flowy A-line skirt moves freely with you;  Hidden Pockets & Flattering Silhouette:Practical side pockets hold phones or keys discreetly. A-line shape skims over hips and thighs. Designed to highlight your natural waist beautifully;  Stylish Two-Tone & Floral Design:Contrast color trim accents the neckline for a chic pop. Solid stretch top pairs with vibrant floral skirt. Modern blend of minimalist and playful patterns;  Effortless Versatility Day To Night:Dress up with heels or keep casual with sneakers easily. Lightweight fabric ideal for brunch, work, or dates. Wrinkle-resistant material stays fresh all day long;  Premium Quality With Thoughtful Details:Soft, breathable fabric maintains shape wash after wash. Secure stitching and adjustable hardware ensure durability. Designed for real life—combines style, comfort, and function seamlessly;  See more About this item`
}


async function main() {
    const scoringReasoning = product1.scoring_reasoning;
    const productInfo = product1.product_info;

    // console.log(`\nGenerating styling explanation...\n`);
    // console.log('--- INPUT SCORING REASONING ---');
    // console.log(scoringReasoning);
    // console.log('-------------------------------\n');
    // console.log('--- INPUT PRODUCT INFO ---');
    // console.log(productInfo);
    // console.log('-------------------------------\n');

    const result = await generateScoringExplanation(scoringReasoning, productInfo);

    if (result.success) {
        console.log('=== GENERATED EXPLANATION ===\n');
        console.log('HEADLINE:', result.result.headline);
        console.log('VERDICT:', result.result.verdict);
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
const isMainModule = import.meta.url === `file://${process.argv[1]}`;
if (isMainModule) {
    main();
}
