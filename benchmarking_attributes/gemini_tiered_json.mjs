/**
 * Product Image Garment Attribute Extraction (Gemini Version - JSON Schema)
 * Uses Google Gemini 2.5 Flash with responseSchema for guaranteed structured output
 *
 * Key difference from gemini_tiered.mjs:
 * - Uses responseSchema with JSON output instead of key=value prompting
 * - Required fields are enforced at the schema level (nullable: false)
 * - Conditional fields allow null (nullable: true)
 */

import { GoogleGenAI } from "@google/genai";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import dotenv from 'dotenv';
import fs from 'fs';
import sharp from 'sharp';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const PROJECT_ID = process.env.GOOGLE_CLOUD_PROJECT || "durable-unity-464716-f0";
const LOCATION = process.env.GOOGLE_CLOUD_LOCATION || "global";
const KEY_FILE = process.env.GOOGLE_APPLICATION_CREDENTIALS || join(__dirname, "gcp-vertex-ai-key.json");

// Tiered models - Flash-Lite for easy attributes, Flash for nuanced ones
const MODEL_FLASH_LITE = 'gemini-2.5-flash-lite';
const MODEL_FLASH = 'gemini-2.5-flash';

// Config
const VISION_TIMEOUT_MS = 60000; // 60 seconds for vision
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 1000;

// Max images to attempt before giving up
const MAX_IMAGE_ATTEMPTS = 1;

// Max image width for vision model (reduces latency significantly)
const MAX_IMAGE_WIDTH = 512;

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
// JSON SCHEMAS FOR STRUCTURED OUTPUT
// ============================================================================

// System prompt shared by both tiers
const SYSTEM_PROMPT = `You are a fashion garment analysis system. Given a product image, extract visible garment attributes.

Rules:
- Extract ONLY what you can clearly see
- Use the exact enum values provided in the schema
- For REQUIRED fields, always provide your best assessment
- For OPTIONAL fields, use null only if the attribute truly doesn't apply to this garment type`;

// Flash-Lite Schema: Easy/obvious attributes (fast, cheap)
// REQUIRED fields (nullable: false) - applies to ALL garments
// OPTIONAL fields (nullable: true) - garment-specific
const SCHEMA_FLASH_LITE = {
    type: "OBJECT",
    properties: {
        // REQUIRED - applies to all garments
        garment_type: {
            type: "STRING",
            enum: ["dress", "top", "shirt", "skirt", "pants", "jumpsuit", "romper", "jacket", "coat", "sweater", "other"],
            nullable: false,
            description: "REQUIRED - Type of garment (applies to all)"
        },
        color_primary: {
            type: "STRING",
            nullable: false,
            description: "REQUIRED - Primary color name (applies to all)"
        },
        color_value: {
            type: "STRING",
            enum: ["very_dark", "dark", "medium_dark", "medium", "medium_light", "light", "very_light"],
            nullable: false,
            description: "REQUIRED - Color lightness/darkness (applies to all)"
        },
        pattern_type: {
            type: "STRING",
            enum: ["solid", "horizontal_stripes", "vertical_stripes", "diagonal", "colorblock", "floral", "plaid", "animal_print", "geometric", "abstract"],
            nullable: false,
            description: "REQUIRED - Pattern type (applies to all, use 'solid' if no pattern)"
        },
        is_adult_clothing: {
            type: "BOOLEAN",
            nullable: false,
            description: "REQUIRED - Whether this is adult clothing (applies to all)"
        },
        fabric_apparent_weight: {
            type: "STRING",
            enum: ["very_light", "light", "medium", "heavy"],
            nullable: false,
            description: "REQUIRED - Apparent fabric weight (applies to all)"
        },
        fabric_sheen: {
            type: "STRING",
            enum: ["matte", "sheen", "shiny"],
            nullable: false,
            description: "REQUIRED - Fabric sheen level (applies to all)"
        },
        fit_category: {
            type: "STRING",
            enum: ["tight", "fitted", "loose", "oversized"],
            nullable: false,
            description: "REQUIRED - Overall fit category (applies to all)"
        },
        fabric_drape: {
            type: "STRING",
            enum: ["structured", "fluid", "very_drapey"],
            nullable: false,
            description: "REQUIRED - How the fabric drapes (applies to all)"
        },

        // OPTIONAL - garment-specific
        hemline_position: {
            type: "STRING",
            enum: ["mid_thigh", "above_knee", "at_knee", "below_knee", "mid_calf", "below_calf", "ankle", "floor"],
            nullable: true,
            description: "OPTIONAL - Hemline position (null for pants/tops without visible hem)"
        },
        waist_definition: {
            type: "STRING",
            enum: ["defined", "semi_defined", "undefined"],
            nullable: true,
            description: "OPTIONAL - How defined the waist is (null if not applicable)"
        },
        waist_position: {
            type: "STRING",
            enum: ["empire", "natural", "drop", "low", "undefined"],
            nullable: true,
            description: "OPTIONAL - Where the waist sits (null if not applicable)"
        },
        leg_shape: {
            type: "STRING",
            enum: ["skinny", "slim", "straight", "bootcut", "flare", "wide_leg", "palazzo", "tapered"],
            nullable: true,
            description: "OPTIONAL - Leg shape (null for non-pants)"
        },
        leg_opening_width: {
            type: "STRING",
            enum: ["narrow", "medium", "wide", "very_wide"],
            nullable: true,
            description: "OPTIONAL - Leg opening width (null for non-pants)"
        },
    },
    required: [
        "garment_type", "color_primary", "color_value", "pattern_type",
        "is_adult_clothing", "fabric_apparent_weight", "fabric_sheen",
        "fit_category", "fabric_drape"
    ],
    propertyOrdering: [
        "garment_type", "color_primary", "color_value", "pattern_type",
        "is_adult_clothing", "fabric_apparent_weight", "fabric_sheen",
        "fit_category", "fabric_drape", "hemline_position", "waist_definition",
        "waist_position", "leg_shape", "leg_opening_width"
    ]
};

// Flash Schema: Nuanced attributes (requires fashion understanding)
const SCHEMA_FLASH = {
    type: "OBJECT",
    properties: {
        // OPTIONAL - all nuanced attributes are garment-specific
        silhouette_type: {
            type: "STRING",
            enum: ["a_line", "fit_and_flare", "sheath", "bodycon", "shift", "mermaid", "cocoon", "column", "tent", "asymmetric"],
            nullable: true,
            description: "OPTIONAL - Silhouette type (null for pants/simple tops)"
        },
        sleeve_type: {
            type: "STRING",
            enum: ["fitted", "bell", "puff", "dolman", "flutter", "bishop", "lantern", "leg_of_mutton", "raglan"],
            nullable: true,
            description: "OPTIONAL - Sleeve construction type (null if sleeveless or not visible)"
        },
        sleeve_length: {
            type: "STRING",
            enum: ["none", "cap", "short", "elbow", "three_quarter", "full_length"],
            nullable: true,
            description: "OPTIONAL - Sleeve length (null if no sleeves)"
        },
        neckline_type: {
            type: "STRING",
            enum: ["v_neck", "crew_neck", "scoop_neck", "boat_neck", "square_neck", "sweetheart", "turtleneck", "mock_neck", "cowl_neck", "keyhole", "wrap_surplice", "asymmetric", "collared", "henley", "peter_pan", "mandarin"],
            nullable: true,
            description: "OPTIONAL - Neckline type (null if not visible)"
        },
        neckline_depth: {
            type: "STRING",
            enum: ["shallow", "medium", "deep", "plunging"],
            nullable: true,
            description: "OPTIONAL - Neckline depth (null if not applicable)"
        },
        rise: {
            type: "STRING",
            enum: ["ultra_high", "high", "mid", "low"],
            nullable: true,
            description: "OPTIONAL - Rise height for pants/skirts (null for dresses/tops)"
        },
    },
    required: [],
    propertyOrdering: [
        "silhouette_type", "sleeve_type", "sleeve_length",
        "neckline_type", "neckline_depth", "rise"
    ]
};

// User prompts (simplified since schema handles structure)
const USER_PROMPT_FLASH_LITE = `Analyze this product image and extract the garment attributes according to the schema.

For REQUIRED fields (garment_type, color_primary, color_value, pattern_type, is_adult_clothing, fabric_apparent_weight, fabric_sheen, fit_category, fabric_drape): Always provide your best assessment.

For OPTIONAL fields: Use null only if the attribute truly doesn't apply to this garment type.`;

const USER_PROMPT_FLASH = `Analyze this product image and extract the nuanced garment attributes according to the schema.

These are all OPTIONAL fields - use null only if the attribute truly doesn't apply to this garment type.`;


// ============================================================================
// UTILITIES
// ============================================================================

function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

// Mapping from new clearer enum values to original values (for backward compatibility)
const HEMLINE_MAPPING = {
    'mid_thigh': 'mini',
    'mid_calf': 'midi',
    'below_calf': 'tea_length',
    'floor': 'maxi',
    // These stay the same
    'above_knee': 'above_knee',
    'at_knee': 'at_knee',
    'below_knee': 'below_knee',
    'ankle': 'ankle',
    'high_low': 'high_low',
};

function withTimeout(promise, ms) {
    return Promise.race([
        promise,
        new Promise((_, reject) =>
            setTimeout(() => reject(new Error(`Request timed out after ${ms}ms`)), ms)
        ),
    ]);
}

/**
 * Convert image to base64 from file path or URL, with optional resizing
 * Resizing to smaller dimensions significantly reduces vision model latency
 */
async function imageToBase64(imageSource) {
    let buffer;

    if (imageSource.startsWith('http://') || imageSource.startsWith('https://')) {
        // Fetch from URL
        const response = await fetch(imageSource);
        if (!response.ok) {
            throw new Error(`Image fetch failed (${response.status}): ${imageSource}`);
        }
        buffer = Buffer.from(await response.arrayBuffer());
    } else {
        // Read from file
        buffer = fs.readFileSync(imageSource);
    }

    // Resize to fit within MAX_IMAGE_WIDTH x MAX_IMAGE_WIDTH box, maintaining aspect ratio
    // For tall e-commerce images, this constrains by height, reducing pixels/tokens significantly
    const resized = await sharp(buffer)
        .resize({ width: MAX_IMAGE_WIDTH, height: MAX_IMAGE_WIDTH, fit: 'inside', withoutEnlargement: true })
        .jpeg({ quality: 80 })
        .toBuffer();

    console.log(`[Image Size] Original: ${(buffer.length / 1024).toFixed(1)}KB → Resized: ${(resized.length / 1024).toFixed(1)}KB`);

    return resized.toString('base64');
}

/**
 * Apply hemline mapping for backward compatibility
 */
function applyHemlineMapping(attributes) {
    if (attributes.hemline_position && HEMLINE_MAPPING[attributes.hemline_position]) {
        attributes.hemline_position = HEMLINE_MAPPING[attributes.hemline_position];
    }
    return attributes;
}

// ============================================================================
// GEMINI API CALL WITH RETRY
// ============================================================================

async function callGeminiWithRetry(request, timeoutMs = VISION_TIMEOUT_MS, retries = MAX_RETRIES) {
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
// MODEL-SPECIFIC EXTRACTION WITH JSON SCHEMA
// ============================================================================

/**
 * Extract attributes using a specific model with JSON schema
 * @param {string} imageBase64 - Base64 encoded image data
 * @param {string} modelId - Model ID to use
 * @param {string} systemPrompt - System prompt
 * @param {string} userPrompt - User prompt
 * @param {Object} schema - JSON schema for responseSchema
 * @param {string} modelLabel - Label for logging
 * @returns {Promise<Object>} - Extracted attributes and usage
 */
async function extractWithModelJSON(imageBase64, modelId, systemPrompt, userPrompt, schema, modelLabel) {
    const startTime = Date.now();

    const request = {
        model: modelId,
        systemInstruction: systemPrompt,
        contents: [
            {
                role: "user",
                parts: [
                    {
                        inlineData: {
                            mimeType: "image/jpeg",
                            data: imageBase64,
                        },
                    },
                    { text: userPrompt },
                ],
            },
        ],
        generationConfig: {
            maxOutputTokens: 512,
            temperature: 0,
            responseMimeType: "application/json",
            responseSchema: schema,
        },
    };

    const response = await callGeminiWithRetry(request, VISION_TIMEOUT_MS);
    const responseText = response.text || '{}';

    console.log(`[${modelLabel}] Response time: ${Date.now() - startTime}ms`);
    console.log(`[${modelLabel}] Response: ${responseText}`);

    // Parse JSON response (strip markdown code blocks if present)
    let attributes = {};
    try {
        let jsonText = responseText;
        // Strip markdown code blocks if present
        if (jsonText.startsWith('```')) {
            jsonText = jsonText.replace(/^```(?:json)?\s*\n?/, '').replace(/\n?```\s*$/, '');
        }
        attributes = JSON.parse(jsonText);
    } catch (e) {
        console.error(`[${modelLabel}] JSON parse error:`, e.message);
        console.error(`[${modelLabel}] Raw response:`, responseText);
    }

    return {
        attributes,
        usage: {
            inputTokens: response.usageMetadata?.promptTokenCount || 0,
            outputTokens: response.usageMetadata?.candidatesTokenCount || 0,
        },
    };
}

/**
 * Extract attributes from image using tiered parallel approach with JSON schema
 * Flash-Lite handles easy attributes, Flash handles nuanced ones
 * Both run in parallel, results are merged
 * @param {string} imageSource - URL or file path to the product image
 * @returns {Promise<Object>} - Merged extracted attributes
 */
async function extractTieredParallelGeminiJSON(imageSource) {
    const startTime = Date.now();
    const imageBase64 = await imageToBase64(imageSource);
    console.log(`[Image] Convert/resize time: ${Date.now() - startTime}ms`);

    // Run both models in parallel
    const [flashLiteResult, flashResult] = await Promise.all([
        extractWithModelJSON(imageBase64, MODEL_FLASH_LITE, SYSTEM_PROMPT, USER_PROMPT_FLASH_LITE, SCHEMA_FLASH_LITE, 'Flash-Lite'),
        extractWithModelJSON(imageBase64, MODEL_FLASH, SYSTEM_PROMPT, USER_PROMPT_FLASH, SCHEMA_FLASH, 'Flash')
    ]);

    // Merge attributes: Flash-Lite (easy) + Flash (nuanced)
    let mergedAttributes = {
        ...flashLiteResult.attributes,
        ...flashResult.attributes
    };

    // Apply hemline mapping for backward compatibility
    mergedAttributes = applyHemlineMapping(mergedAttributes);

    // Combine usage stats
    const totalUsage = {
        inputTokens: flashLiteResult.usage.inputTokens + flashResult.usage.inputTokens,
        outputTokens: flashLiteResult.usage.outputTokens + flashResult.usage.outputTokens,
    };

    console.log(`[Tiered JSON] Total parallel time: ${Date.now() - startTime}ms`);

    return {
        attributes: mergedAttributes,
        usage: totalUsage,
    };
}

// ============================================================================
// IMAGE QUALITY GATING
// ============================================================================

/**
 * Check if an extraction result passes quality gates
 * @param {Object} attributes - Parsed garment attributes
 * @returns {{ usable: boolean, reason: string }}
 */
function checkImageQuality(attributes) {
    const quality = attributes.image_quality;

    // If no image_quality block, assume usable (backward compat)
    if (!quality) {
        return { usable: true, reason: 'no_quality_block' };
    }

    // Gate 1: image_usable flag
    if (quality.image_usable === false) {
        return { usable: false, reason: 'image_not_usable' };
    }

    // Gate 2: significant occlusion
    if (quality.occlusion_issues === 'significant') {
        return { usable: false, reason: 'significant_occlusion' };
    }

    // Gate 3: garment not fully visible
    if (quality.garment_fully_visible === false && quality.confidence !== 'low') {
        return { usable: false, reason: 'garment_not_fully_visible' };
    }

    // Gate 4: overall confidence too low
    if (attributes.overall_confidence === 'low') {
        return { usable: false, reason: 'overall_confidence_low' };
    }

    return { usable: true, reason: 'passed_all_gates' };
}

// ============================================================================
// MAIN EXTRACTION FUNCTION (with multi-image fallback)
// ============================================================================

/**
 * Extract garment attributes from product image(s) using JSON schema
 * Supports both single image (string) and multiple images (string[]).
 * With multiple images, tries each sequentially until one passes quality gates.
 *
 * @param {string|string[]} imageSource - URL/path or array of URLs/paths
 * @returns {Promise<Object>} - Extracted garment attributes
 */
export async function extractGarmentAttributesGeminiTieredJSON(imageSource) {
    // Normalize to array (backward compatible: string → [string])
    const images = Array.isArray(imageSource) ? imageSource : [imageSource];
    const imagesToTry = images.slice(0, MAX_IMAGE_ATTEMPTS);

    let lastResult = null;
    let lastError = null;
    let totalUsage = { inputTokens: 0, outputTokens: 0 };

    for (let i = 0; i < imagesToTry.length; i++) {
        const imgUrl = imagesToTry[i];
        const imageLabel = `image ${i + 1}/${imagesToTry.length}`;

        try {
            console.log(`  [Tiered JSON Extraction] Processing: ${imgUrl}`);
            const result = await extractTieredParallelGeminiJSON(imgUrl);

            // Accumulate token usage across attempts
            if (result.usage) {
                totalUsage.inputTokens += result.usage.inputTokens || 0;
                totalUsage.outputTokens += result.usage.outputTokens || 0;
            }

            // Check quality gates
            const qualityCheck = checkImageQuality(result.attributes);

            if (qualityCheck.usable) {
                if (i > 0) {
                    console.log(`  [Image Fallback] ${imageLabel} passed quality gates (${qualityCheck.reason})`);
                }
                return {
                    success: true,
                    attributes: result.attributes,
                    raw_response: result.raw_response,
                    usage: totalUsage,
                    image_used: imgUrl,
                    image_index: i,
                    attempts: i + 1,
                };
            }

            // Quality gate failed — try next image
            console.log(`  [Image Fallback] ${imageLabel} failed quality gate: ${qualityCheck.reason}`);
            lastResult = result;

        } catch (error) {
            console.warn(`  [Image Fallback] ${imageLabel} extraction error: ${error.message}`);
            lastError = error;
        }
    }

    // All images failed quality gates — return best available result
    if (lastResult) {
        console.warn('  [Image Fallback] All images failed quality gates, using last result');
        return {
            success: true,
            attributes: lastResult.attributes,
            raw_response: lastResult.raw_response,
            usage: totalUsage,
            image_used: imagesToTry[imagesToTry.length - 1],
            image_index: imagesToTry.length - 1,
            attempts: imagesToTry.length,
            quality_warning: true,
        };
    }

    // Complete failure
    return {
        success: false,
        error: lastError?.message || 'All image extraction attempts failed',
        attributes: null,
    };
}

/**
 * Flatten nested garment attributes into flat structure for scoring engine
 */
export function flattenAttributes(attributes) {
    if (!attributes) return null;

    let out = {
        garment_type: attributes.garment_type ?? null,
        neckline_type: attributes.neckline_type ?? null,
        neckline_depth: attributes.neckline_depth ?? null,
        hemline_position: attributes.hemline_position ?? null,
        sleeve_type: attributes.sleeve_type ?? null,
        sleeve_length: attributes.sleeve_length ?? null,
        silhouette_type: attributes.silhouette_type ?? null,
        waistline: attributes.waist_position ?? null,
        waist_definition: attributes.waist_definition ?? null,
        fit_category: attributes.fit_category ?? null,
        color_primary: attributes.color_primary ?? null,
        color_value: attributes.color_value ?? null,
        pattern_type: attributes.pattern_type ?? null,
        fabric_weight: attributes.fabric_apparent_weight ?? null,
        fabric_sheen: attributes.fabric_sheen ?? null,
        fabric_drape: attributes.fabric_drape ?? null,
        rise: attributes.rise ?? null,
        leg_shape: attributes.leg_shape ?? null,
        leg_opening_width: attributes.leg_opening_width ?? null,
        is_adult_clothing: attributes.is_adult_clothing ?? null,
    };

    out = reAssignNullAttributes(out);
    return out;
}

// ============================================================================
// CLI TESTING
// ============================================================================

// Default test image - override with command line argument
const DEFAULT_IMAGE = './images/red-green.jpeg';

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

async function main() {
    // Use command line argument if provided, otherwise use default
    const testImage = process.argv[2] || DEFAULT_IMAGE;

    console.log(`\nExtracting garment attributes (JSON Schema mode) from: ${testImage}\n`);

    let times = [];
    let samplecount = 1;
    for (let i = 0; i < samplecount; i++) {
        let startTime = Date.now();
        const result = await extractGarmentAttributesGeminiTieredJSON(testImage);
        if (result.success) {
            console.log('\n=== EXTRACTED ATTRIBUTES (JSON Schema) ===\n');
            console.log(JSON.stringify(result.attributes, null, 2));

            console.log('\n=== FLATTENED FOR SCORING ENGINE ===\n');
            let flat = flattenAttributes(result.attributes);
            console.log(JSON.stringify(flat, null, 2));

            console.log('\n=== TOKEN USAGE ===\n');
            const usage = result.usage || {};
            console.log({
                inputTokens: usage.inputTokens || 0,
                outputTokens: usage.outputTokens || 0,
                totalTokens: (usage.inputTokens || 0) + (usage.outputTokens || 0),
            });

            console.log("Time taken to extract garment attributes: ", Date.now() - startTime);
            times.push(Date.now() - startTime);

            if (result.attempts > 1) {
                console.log(`\nUsed image ${result.image_index + 1} after ${result.attempts} attempts`);
            }
            if (result.quality_warning) {
                console.log('\n Warning: Image failed quality gates but was used as fallback');
            }
        } else {
            console.error('Extraction failed:', result.error);
        }
        if (i < samplecount - 1) {
            // delay for 3 seconds
            console.log("Sleeping for 3 seconds");
            await sleep(3000);
        }
    }
    console.log("Using models: ", MODEL_FLASH_LITE, "(easy) +", MODEL_FLASH, "(nuanced)");
    console.log("Mode: JSON Schema (responseSchema)");
    console.log("Image used: ", testImage);
    console.log("Times taken to extract garment attributes: ", times);
    console.log("Average time taken to extract garment attributes: ", times.reduce((a, b) => a + b, 0) / times.length);
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
