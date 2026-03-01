/**
 * Product Image Garment Attribute Extraction (Gemini Version)
 * Uses Google Gemini 2.5 Flash for visual garment attribute extraction
 *
 * v2: Enhanced with fabric behavior analysis + multi-image fallback
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

// Use Gemini 2.5 Flash for vision tasks
const VISION_MODEL_ID = process.env.MODEL_ID_IMAGE_GEMINI || 'gemini-2.5-flash';

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
// SYSTEM PROMPT FOR GARMENT EXTRACTION (v2 — enhanced)
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
14. RISE — for pants/skirts, where the waistband sits relative to the body
15. LEG SHAPE — for pants, the silhouette of the leg from hip to ankle
16. IS ADULT CLOTHING — determine if this is adult clothing (not children's/baby clothing)

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

  "has_seaming": <true|false|null>,

  "rise": "<ultra_high|high|mid|low|null>",

  "leg_shape": "<skinny|slim|straight|bootcut|flare|wide_leg|palazzo|tapered|jogger|cargo|null>",

  "leg_opening_width": "<narrow|medium|wide|very_wide|null>",

  "is_adult_clothing": <true|false|null>
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

    // Resize to max width, maintaining aspect ratio
    // This significantly reduces latency (1260px → 512px = ~2-3x faster)
    const resized = await sharp(buffer)
        .resize({ width: MAX_IMAGE_WIDTH, withoutEnlargement: true })
        .jpeg({ quality: 85 })
        .toBuffer();

    console.log(`[Image Size] Original: ${(buffer.length / 1024).toFixed(1)}KB → Resized: ${(resized.length / 1024).toFixed(1)}KB`);

    return resized.toString('base64');
}

function getImageMimeType(imageSource) {
    // After sharp resize, we always output JPEG
    return "image/jpeg";
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
// SINGLE IMAGE EXTRACTION
// ============================================================================

/**
 * Extract garment attributes from a single image
 * @param {string} imageSource - URL or file path to the product image
 * @returns {Promise<Object>} - Extracted garment attributes
 */
async function extractFromSingleImage(imageSource) {
    let startTime = Date.now();
    const imageBase64 = await imageToBase64(imageSource);
    console.log("Time taken to convert/resize image to base64: ", Date.now() - startTime);

    const mimeType = getImageMimeType(imageSource);

    const request = {
        model: VISION_MODEL_ID,
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
                    { text: GARMENT_EXTRACTION_USER_PROMPT },
                ],
            },
        ],
        generationConfig: {
            maxOutputTokens: 2048,
            temperature: 0.1,
        },
    };

    const response = await callGeminiWithRetry(request, VISION_TIMEOUT_MS);
    console.log("Time taken to get response from vision model: ", Date.now() - startTime);

    const responseText = response.text;
    if (!responseText) {
        throw new Error('No response from vision model');
    }

    // Parse JSON response
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
        throw new Error('Could not parse JSON from response');
    }

    const garmentAttributes = JSON.parse(jsonMatch[0]);

    return {
        attributes: garmentAttributes,
        raw_response: responseText,
        usage: {
            inputTokens: response.usageMetadata?.promptTokenCount || 0,
            outputTokens: response.usageMetadata?.candidatesTokenCount || 0,
        },
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
 * Extract garment attributes from product image(s)
 * Supports both single image (string) and multiple images (string[]).
 * With multiple images, tries each sequentially until one passes quality gates.
 *
 * @param {string|string[]} imageSource - URL/path or array of URLs/paths
 * @returns {Promise<Object>} - Extracted garment attributes
 */
export async function extractGarmentAttributesGemini(imageSource) {
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
            console.log(`  [Image Fallback] Extracting from: ${imgUrl}`);
            const result = await extractFromSingleImage(imgUrl);

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
 * v2: includes image_quality and fabric_behavior fields
 */
export function flattenAttributes(attributes) {
    if (!attributes) return null;

    let out = {

        garment_type: attributes.garment_type ?? null,
        neckline_type: attributes.neckline_type ?? null,
        neckline_depth: attributes.neckline_depth ?? null,
        hemline_position: attributes.hemline_position ?? null,
        sleeve_type: attributes.sleeve_type ?? null,
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
        has_darts: attributes.has_darts ?? null,
        has_seaming: attributes.has_seaming ?? null,
        rise: attributes.rise ?? null,
        leg_shape: attributes.leg_shape ?? null,
        leg_opening_width: attributes.leg_opening_width ?? null,
        is_adult_clothing: attributes.is_adult_clothing ?? null,



        // Height measurements
        model_height_cm: attributes.height_measurements?.model_height_cm ?? null,
        hemline_height_cm: attributes.height_measurements?.hemline_height_cm ?? null,
        waistline_height_cm: attributes.height_measurements?.waistline_height_cm ?? null,

        // garment_type: attributes.garment_type ?? null,

        // Neckline
        // neckline_type: attributes.neckline?.type ?? null,
        // neckline_depth: attributes.neckline?.depth ?? null,
        neckline_width: attributes.neckline?.width ?? null,

        // Hemline
        // hemline_position: attributes.hemline?.position ?? null,

        // Sleeve
        // sleeve_type: attributes.sleeve?.type ?? null,
        sleeve_width: attributes.sleeve?.width ?? null,

        // Silhouette
        // silhouette_type: attributes.silhouette?.type ?? null,

        // Waist
        // waistline: attributes.waist?.position ?? null,
        // waist_definition: attributes.waist?.definition ?? null,

        // Fit
        // fit_category: attributes.fit?.category ?? null,

        // Color
        // color_primary: attributes.color?.primary ?? null,
        // color_value: attributes.color?.value ?? null,
        color_temperature: attributes.color?.temperature ?? null,
        color_saturation: attributes.color?.saturation ?? null,

        // Pattern
        // pattern_type: attributes.pattern?.type ?? null,
        pattern_scale: attributes.pattern?.scale ?? null,
        pattern_contrast: attributes.pattern?.contrast ?? null,
        pattern_direction: attributes.pattern?.direction ?? null,

        // Fabric
        // fabric_weight: attributes.fabric?.apparent_weight ?? null,
        // fabric_sheen: attributes.fabric?.sheen ?? null,
        fabric_opacity: attributes.fabric?.opacity ?? null,
        // fabric_drape: attributes.fabric?.drape ?? null,
        fabric_texture: attributes.fabric?.texture ?? null,

        // Fabric behavior (v2)
        fabric_body_interaction: attributes.fabric_behavior?.body_interaction ?? null,
        fabric_stretch_visible: attributes.fabric_behavior?.stretch_visible ?? null,
        fabric_pulling_at_seams: attributes.fabric_behavior?.pulling_at_seams ?? null,
        fabric_gapping: attributes.fabric_behavior?.gapping ?? null,
        fabric_bunching: attributes.fabric_behavior?.bunching ?? null,

        // Construction
        // has_darts: attributes.construction?.has_darts ?? null,
        // has_seaming: attributes.construction?.has_seaming ?? null,
        has_ruching: attributes.construction?.has_ruching ?? null,
        has_draping: attributes.construction?.has_draping ?? null,
        has_pleats: attributes.construction?.has_pleats ?? null,
        has_gathering: attributes.construction?.has_gathering ?? null,

        // Image quality (v2)
        image_usable: attributes.image_quality?.image_usable ?? null,
        image_pose: attributes.image_quality?.image_pose ?? null,

        // Model estimate
        model_apparent_height_category: attributes.model_estimate?.apparent_height_category ?? null,
        model_apparent_size_category: attributes.model_estimate?.apparent_size_category ?? null,

        // Confidence
        overall_confidence: attributes.overall_confidence ?? null,
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

    console.log(`\nExtracting garment attributes from: ${testImage}\n`);

    let times = [];
    let samplecount = 1;

    for (let i = 0; i < samplecount; i++) {
        let startTime = Date.now();
        const result = await extractGarmentAttributesGemini(testImage);
        console.log("Time taken to extract garment attributes: ", Date.now() - startTime);
        if (result.success) {
            // console.log('=== EXTRACTED ATTRIBUTES ===\n');
            // console.log(JSON.stringify(result.attributes, null, 2));

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
    console.log("Using model : ", VISION_MODEL_ID);
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
