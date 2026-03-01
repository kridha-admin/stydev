// Gemini API caller using @google/genai SDK (recommended, supports global endpoint)
//
// Usage: node gemini_genai.mjs [image_url_or_path]
//
// Setup:
//   npm install @google/genai
//   Place gcp-vertex-ai-key.json in this directory (or set GOOGLE_APPLICATION_CREDENTIALS)

import { GoogleGenAI } from "@google/genai";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import fs from "fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const PROJECT_ID = process.env.GOOGLE_CLOUD_PROJECT || "durable-unity-464716-f0";
const LOCATION = process.env.GOOGLE_CLOUD_LOCATION || "global";
const KEY_FILE = process.env.GOOGLE_APPLICATION_CREDENTIALS || join(__dirname, "gcp-vertex-ai-key.json");

// Config
const TEXT_TIMEOUT_MS = 10000; // 10 seconds for text
const VISION_TIMEOUT_MS = 60000; // 60 seconds for vision (images take longer)
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 1000; // 1 second

// Initialize the new Gen AI SDK with Vertex AI
const ai = new GoogleGenAI({
  vertexai: true,
  project: PROJECT_ID,
  location: LOCATION,
  googleAuthOptions: {
    keyFile: KEY_FILE,
  },
});

// ============================================================================
// GARMENT EXTRACTION PROMPTS (from product_image_extraction.mjs)
// ============================================================================

const GARMENT_EXTRACTION_SYSTEM_PROMPT = `You are a fashion garment analysis system. Given a product image, extract all visible garment attributes with high precision.

You must identify EXACTLY what you see — do not infer attributes that are not visible. If an attribute cannot be determined from the image, set it to null with confidence "low".

Focus on:
1. IMAGE QUALITY — First assess if the image is usable. Check: is the garment fully visible? Is the model facing forward? Is there significant occlusion (arms crossed, bag covering, cropped)?
2. HEIGHT MEASUREMENTS — If model height is not obvious, assume 175cm (5'9"). Based on this, estimate hemline height from floor (cm) and waistline height from floor (cm) by analyzing where these fall on the model's body
3. NECKLINE — type, depth relative to bust, width relative to shoulders
4. HEMLINE — where it falls on the model's body
5. SLEEVES — type, length, width/volume
6. SILHOUETTE — overall garment shape and how it falls on the body
7. WAIST — where the waist is defined (if at all)
8. FIT — how close the garment is to the model's body
9. COLOR — dominant color, light/dark value, warm/cool temperature
10. PATTERN — type, scale, direction
11. FABRIC — visible properties (sheen, opacity, drape behavior)
12. FABRIC BEHAVIOR — how the fabric interacts with the model's body (clinging, skimming, standing away). Look for pulling at seams, visible stretch, gapping, or bunching
13. CONSTRUCTION — visible darts, seams, gathering, draping

Return ONLY a valid JSON object with all attributes. Use the exact enum values provided.
If between two values, pick the closer one and note lower confidence.`;

const GARMENT_EXTRACTION_USER_PROMPT = `Analyze this product image and extract all garment attributes.

Return JSON in this exact format:
{

  "garment_type": "<dress|top|blouse|shirt|skirt|pants|jumpsuit|romper|jacket|coat|cardigan|sweater|other>",

  "neckline_type": "<v_neck|crew_neck|scoop_neck|boat_neck|square_neck|sweetheart|off_shoulder|halter|turtleneck|mock_neck|cowl_neck|keyhole|wrap_surplice|asymmetric|one_shoulder|strapless|collared|henley|peter_pan|mandarin|plunging|null>",

  "neckline_depth": "<shallow|medium|deep|plunging|null>",

  "hemline_position": "<mini|above_knee|at_knee|below_knee|midi|tea_length|ankle|maxi|floor_length|high_low|null>",

  "sleeve_type": "<sleeveless|spaghetti_strap|cap|short|elbow|three_quarter|full_length|bell|puff|raglan|set_in|dolman|flutter|cold_shoulder|bishop|lantern|leg_of_mutton|off_shoulder|null>",

  "silhouette_type": "<a_line|fit_and_flare|sheath|bodycon|shift|wrap|mermaid|cocoon|peplum|empire|column|tent|princess_seam|dropped_waist|tiered|asymmetric|null>",

  "waist_position": "<empire|natural|drop|low|undefined|elasticized|null>",

  "waist_definition": "<defined|semi_defined|undefined|null>",

  "fit_category": "<tight|fitted|semi_fitted|relaxed|loose|oversized|null>",

  "color_primary": "<color name>",

  "color_value": "<very_dark|dark|medium_dark|medium|medium_light|light|very_light>",

  "pattern_type": "<solid|horizontal_stripes|vertical_stripes|diagonal|chevron|polka_dot|floral_small|floral_large|plaid|abstract|animal_print|colorblock|geometric|paisley|houndstooth|gingham|null>",

  "fabric_apparent_weight": "<very_light|light|medium|heavy|null>",

  "fabric_sheen": "<matte|subtle_sheen|moderate_sheen|shiny|null>",

  "fabric_drape": "<stiff|structured|fluid|very_drapey|null>",

  "has_darts": <true|false|null>,

  "has_seaming": <true|false|null>
}

IMPORTANT: Return ONLY the JSON object, no other text or markdown formatting.`;

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

async function imageToBase64(imageSource) {
  let buffer;

  if (imageSource.startsWith("http://") || imageSource.startsWith("https://")) {
    const response = await fetch(imageSource);
    if (!response.ok) {
      throw new Error(`Image fetch failed (${response.status}): ${imageSource}`);
    }
    buffer = Buffer.from(await response.arrayBuffer());
  } else {
    buffer = fs.readFileSync(imageSource);
  }

  return buffer.toString("base64");
}

function getImageMimeType(imageSource) {
  const lower = imageSource.toLowerCase();
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".gif")) return "image/gif";
  if (lower.endsWith(".webp")) return "image/webp";
  return "image/jpeg"; // default
}

// ============================================================================
// MAIN API CALL WITH RETRY
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
// TEXT PROMPT CALL
// ============================================================================

export async function callGemini(prompt, modelId = "gemini-2.5-flash-lite") {
  const startTime = Date.now();
  console.log(`Getting model: ${modelId}`);

  const response = await callGeminiWithRetry({
    model: modelId,
    contents: prompt,
  });

  const duration = Date.now() - startTime;
  console.log(`Gemini call took ${duration}ms`);

  return {
    text: response.text,
    usage: {
      inputTokens: response.usageMetadata?.promptTokenCount || 0,
      outputTokens: response.usageMetadata?.candidatesTokenCount || 0,
    },
  };
}

// ============================================================================
// VISION / GARMENT EXTRACTION
// ============================================================================

export async function extractGarmentAttributes(imageSource, user_prompt, modelId = "gemini-2.5-flash-lite") {
  const startTime = Date.now();
  console.log(`Extracting garment attributes using: ${modelId}`);

  const imageBase64 = await imageToBase64(imageSource);
  const mimeType = getImageMimeType(imageSource);

  const request = {
    model: modelId,
    systemInstruction: GARMENT_EXTRACTION_SYSTEM_PROMPT,
    contents: [
      {
        role: "user",
        parts: [
          {
            inlineData: {
              mimeType,
              data: imageBase64,
            },
          },
          { text: user_prompt },
        ],
      },
    ],
    generationConfig: {
      maxOutputTokens: 2048,
      temperature: 0.1,
    },
  };

  const response = await callGeminiWithRetry(request, VISION_TIMEOUT_MS);

  const duration = Date.now() - startTime;
  console.log(`Gemini vision call took ${duration}ms`);

  const responseText = response.text;
  if (!responseText) {
    throw new Error("No response from vision model");
  }

  // Parse JSON response
  const jsonMatch = responseText.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error("Could not parse JSON from response");
  }

  const attributes = JSON.parse(jsonMatch[0]);

  return {
    success: true,
    attributes,
    raw_response: responseText,
    usage: {
      inputTokens: response.usageMetadata?.promptTokenCount || 0,
      outputTokens: response.usageMetadata?.candidatesTokenCount || 0,
    },
  };
}

// ============================================================================
// CLI
// ============================================================================

async function testGemini(prompt, modelId = "gemini-2.5-flash-lite") {

  // // Otherwise, simple text prompt test
  // const prompt = arg || "What is the capital of France?";
  // const modelId = "gemini-2.5-flash-lite";

  // console.log(`Prompt: ${prompt}`);
  // console.log(`Model: ${modelId}`);
  // console.log(`Location: ${LOCATION}`);

  // const result = await callGemini(prompt, modelId);
  // console.log(`\nResponse: ${result.text}`);
  // console.log(`[Tokens: in=${result.usage.inputTokens}, out=${result.usage.outputTokens}]`);

  // return result;
}

async function main() {

  // If argument looks like an image, run garment extraction
  let imageSource = "https://image.hm.com/assets/hm/3f/9d/3f9d33623815e9442d3af8801b1bdcc619a18f8c.jpg?imwidth=1536";
  let userPrompt = GARMENT_EXTRACTION_USER_PROMPT;
  // let modelId = "gemini-2.5-flash-lite"; // 4 secs
  let modelId = "gemini-2.5-flash"; // 12 secs
  // let modelId = "gemini-2.5-pro"; // 15 secs
  // let modelId = "gemini-3-pro-preview"; // 40 secs
  // let modelId = "gemini-3-flash-preview"; // 22 secs
  // let modelId = "claude-opus-4-6";
  
  console.log(`\nExtracting garment attributes from: ${imageSource}\n`);
  let startTime = Date.now();
  const result = await extractGarmentAttributes(imageSource, userPrompt, modelId);
  console.log("Time taken to extract garment attributes: ", Date.now() - startTime);
  if (result.success) {
    console.log("\n=== EXTRACTED ATTRIBUTES ===\n");
    console.log(JSON.stringify(result.attributes, null, 2));
    console.log(`\n[Tokens: in=${result.usage.inputTokens}, out=${result.usage.outputTokens}]`);
  } else {
    console.error("Extraction failed:", result.error);
  }
  return;

}

if (import.meta.url === `file://${process.argv[1]}`) {
  try {
    await main();
    process.exit(0);
  } catch (error) {
    console.error("Error:", error.message);
    process.exit(1);
  }
}

// GOOGLE_CLOUD_LOCATION=global node gemini_genai.mjs
