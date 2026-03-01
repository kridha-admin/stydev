/**
 * Product Text Attribute Extraction (Gemini Version)
 * Uses Google Gemini to extract text-based garment attributes from product descriptions
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

// Use Gemini 2.5 Flash Lite for text extraction (fast + cheap, no vision needed)
const TEXT_MODEL_ID = process.env.MODEL_ID_TEXT_GEMINI || 'gemini-2.5-flash-lite';

// Config
const TEXT_TIMEOUT_MS = 30000; // 30 seconds for text
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
// SYSTEM PROMPT FOR TEXT EXTRACTION
// ============================================================================

const TEXT_EXTRACTION_SYSTEM_PROMPT = `You are a product description analysis system specialized in extracting structured garment information from e-commerce product pages.

Your task is to extract specific attributes from product description text. Focus on:

1. MODEL INFORMATION (CRITICAL)
   - Model height (convert to inches if in cm or feet/inches format)
   - Size the model is wearing
   - Model measurements (bust, waist, hips)

2. FABRIC COMPOSITION (CRITICAL)
   - Primary fabric material and percentage
   - Secondary fabric material and percentage
   - Stretch fiber percentage (elastane, spandex, lycra)

3. GARMENT MEASUREMENTS (HIGH)
   - Stated garment length in inches
   - Hemline description (mini, midi, maxi, etc.)

4. FABRIC PROPERTIES (MEDIUM)
   - Weight description (lightweight, mid-weight, heavy)
   - Care instructions

5. PRODUCT INFO (LOW)
   - Title
   - Brand
   - Price
   - Garment type (dress, blouse, skirt, pants, etc.)

6. CONTENT CLASSIFICATION (CRITICAL)
   - Is this adult clothing? (not children's, baby, or kids' clothing)

EXTRACTION RULES:
- Extract ONLY information explicitly stated in the text
- Convert all heights to inches (5'10" = 70 inches, 178cm = 70.1 inches)
- For fabric percentages, identify stretch fibers separately
- If information is not present, set to null
- Be precise with numbers - don't estimate or round

Return ONLY a valid JSON object with the extracted attributes.`;

const TEXT_EXTRACTION_USER_PROMPT = `Extract all garment attributes from this product description:

---
{DESCRIPTION}
---

Return JSON in this exact format:
{
  "title": "<product title or null>",
  "fabric_composition": "<original text like '95% Viscose, 5% Elastane' or null>",
  "care_instructions": "<care text or null>",
  "fabric_primary": "<viscose|cotton|polyester|silk|linen|wool|rayon|nylon|etc or null>",
  "fabric_secondary": "<material name or null>",
  "stretch_percentage": <number or 0>,
  "garment_type": "<dress|top|blouse|shirt|skirt|pants|jumpsuit|romper|jacket|coat|cardigan|sweater|other>",
  "is_adult_clothing": <true|false|null>
}

IMPORTANT:
- Set fields to null if not found in the description.
- Convert all measurements to inches.
- Return ONLY the JSON object, no other text or markdown formatting.`;

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
// MAIN EXTRACTION FUNCTION
// ============================================================================

/**
 * Extract text-based garment attributes from product description
 * @param {string} description - Product description text
 * @returns {Promise<Object>} - Extracted attributes
 */
export async function extractTextAttributesGemini(description) {
    if (!description || description.trim().length === 0) {
        return {
            success: false,
            error: 'Empty description provided',
            attributes: null
        };
    }

    const userPrompt = TEXT_EXTRACTION_USER_PROMPT.replace('{DESCRIPTION}', description);

    const request = {
        model: TEXT_MODEL_ID,
        systemInstruction: TEXT_EXTRACTION_SYSTEM_PROMPT,
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
            temperature: 0.1,
        },
    };

    try {
        const startTime = Date.now();
        const response = await callGeminiWithRetry(request, TEXT_TIMEOUT_MS);
        console.log(`Gemini text extraction took ${Date.now() - startTime}ms`);

        const responseText = response.text;
        if (!responseText) {
            throw new Error('No response from model');
        }

        // Parse JSON response
        const jsonMatch = responseText.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
            throw new Error('Could not parse JSON from response');
        }

        const attributes = JSON.parse(jsonMatch[0]);

        return {
            success: true,
            attributes,
            raw_response: responseText,
            usage: {
                inputTokens: response.usageMetadata?.promptTokenCount || 0,
                outputTokens: response.usageMetadata?.candidatesTokenCount || 0,
            }
        };

    } catch (error) {
        console.error('Extraction error:', error);
        return {
            success: false,
            error: error.message,
            attributes: null
        };
    }
}

function reAssignNullAttributes(flat) {
    try {
        let flat2 = {};
        // put non-null attributes into flat2
        for (let key in flat) {
            if (flat[key] !== null) {
                flat2[key] = flat[key];
            }
        }
        for (let key in flat) {
            if (!(key in flat2)) {
                flat2[key] = null;
            }
        }
        return flat2;
    } catch (error) {
        console.error('Error reassigning null attributes:', error);
        return flat;
    }
}


/**
 * Flatten nested text attributes into flat structure for scoring engine
 */
export function flattenTextAttributes(attributes) {
    if (!attributes) return null;

    let out = {

        title: attributes.title ?? null,
        fabric_composition: attributes.fabric_composition ?? null,
        care_instructions: attributes.care_instructions ?? null,
        fabric_primary: attributes.fabric_primary ?? null,
        fabric_secondary: attributes.fabric_secondary ?? null,
        stretch_percentage: attributes.stretch_percentage ?? null,
        garment_type: attributes.garment_type ?? null,
        is_adult_clothing: attributes.is_adult_clothing ?? null,

        // Model info
        model_height_inches: attributes.model_info?.height_inches ?? null,
        model_height_original: attributes.model_info?.height_original ?? null,
        model_size_worn: attributes.model_info?.size_worn ?? null,
        model_bust: attributes.model_info?.bust_inches ?? null,
        model_waist: attributes.model_info?.waist_inches ?? null,
        model_hips: attributes.model_info?.hips_inches ?? null,
        model_confidence: attributes.model_info?.confidence ?? null,

        // Fabric
        fabric_primary_percentage: attributes.fabric?.primary_percentage ?? null,
        fabric_secondary_percentage: attributes.fabric?.secondary_percentage ?? null,
        stretch_fiber: attributes.fabric?.stretch_fiber ?? null,
        fabric_weight: attributes.fabric?.weight_description ?? null,
        fabric_confidence: attributes.fabric?.confidence ?? null,

        // Garment
        garment_length_inches: attributes.garment?.length_inches ?? null,
        hemline_description: attributes.garment?.length_description ?? null,
        garment_confidence: attributes.garment?.confidence ?? null,

        // Product
        brand: attributes.product?.brand ?? null,
        price: attributes.product?.price ?? null,

        // Overall Confidence
        overall_confidence: attributes.overall_confidence ?? null
    };
    out = reAssignNullAttributes(out);
    return out;
}

/**
 * Cross-check garment_type against product title keywords.
 * Title is the most reliable signal — if title clearly says "jeans" but
 * model extracted "top", override with the title-based type.
 */
function validateGarmentTypeFromTitle(extractedType, title) {
    if (!title) return extractedType;
    const t = title.toLowerCase();

    // Ordered by specificity — check most specific first
    const TITLE_RULES = [
        { keywords: ['jumpsuit'], type: 'jumpsuit' },
        { keywords: ['romper'], type: 'romper' },
        { keywords: ['jeans', 'joggers', 'trousers', 'leggings', 'chinos'], type: 'pants' },
        { keywords: ['blazer'], type: 'jacket' },
        { keywords: ['coat', 'overcoat', 'trench', 'parka'], type: 'coat' },
        { keywords: ['hoodie', 'sweatshirt'], type: 'sweater' },
        { keywords: ['shorts'], type: 'shorts' },
        { keywords: ['skirt'], type: 'skirt' },
    ];

    for (const rule of TITLE_RULES) {
        const titleHasKeyword = rule.keywords.some(kw => t.includes(kw));
        if (titleHasKeyword && extractedType !== rule.type) {
            // Don't override if types are closely related
            const related = [
                new Set(['jumpsuit', 'romper']),
                new Set(['jacket', 'blazer', 'coat']),
                new Set(['sweater', 'cardigan', 'sweatshirt']),
            ];
            const isRelated = related.some(s => s.has(extractedType) && s.has(rule.type));
            if (!isRelated) {
                console.log(`[EXTRACT] Title override: "${extractedType}" → "${rule.type}" (title: ${title.substring(0, 60)})`);
                return rule.type;
            }
        }
    }
    return extractedType;
}


// ============================================================================
// CLI TESTING
// ============================================================================

// Default test description
const DEFAULT_DESCRIPTION = `
Satin Prom Dress Corset Prom Long A Line Pleated Bridesmaid Backless Formal Spaghetti Strap for Gowns

Material:High-quality satin material with a luxurious sheen perfect for formal events like proms weddings or evening galas
Style:Flattering Corset & A-Line DesignSlimming corset bodice and A-line pleated skirt enhance curves while providing comfort and effortless movement Delicate spaghetti straps and a thigh-high slit add modern elegance balancing sophistication with subtle allure
Occasion:Back to school dance party graduation ceremony cocktail party Quinceanera Evening parties bridesmaids beauty pageants engagements clubs banquets evening parties dances birthdays holidays and other special formal and semi formal occasions
Size:Please purchase a suitable skirt according to the size chart
After Sales:If you have any questions please feel free to contact us we will do our best to solve for you

`;

async function main() {
    // Use command line argument if provided, otherwise use default
    const description = process.argv[2] || DEFAULT_DESCRIPTION;

    console.log(`\nExtracting text attributes from product description...\n`);
    console.log('--- INPUT DESCRIPTION ---');
    console.log(description.substring(0, 200) + (description.length > 200 ? '...' : ''));
    console.log('-------------------------\n');

    const result = await extractTextAttributesGemini(description);

    if (result.success) {
        console.log('=== EXTRACTED ATTRIBUTES ===\n');
        console.log(JSON.stringify(result.attributes, null, 2));

        console.log('\n=== FLATTENED FOR SCORING ENGINE ===\n');
        const flat = flattenTextAttributes(result.attributes);
        console.log(JSON.stringify(flat, null, 2));

        console.log('\n=== TOKEN USAGE ===\n');
        const usage = result.usage || {};
        console.log({
            inputTokens: usage.inputTokens || 0,
            outputTokens: usage.outputTokens || 0,
            totalTokens: (usage.inputTokens || 0) + (usage.outputTokens || 0),
        });
    } else {
        console.error('Extraction failed:', result.error);
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
