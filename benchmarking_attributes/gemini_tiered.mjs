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

// Toggle to include attribute descriptions in prompts (may improve accuracy for nuanced attributes)
const INCLUDE_DESCRIPTIONS = true;

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

// System prompt shared by both tiers
const SYSTEM_PROMPT = `You are a fashion garment analysis system. Given a product image, extract visible garment attributes.

Rules:
- Extract ONLY what you can clearly see
- Return ALL keys listed
- Attributes marked (REQUIRED) must always have a value - never null
- Attributes marked (null if N/A) use null only if that attribute doesn't apply to this garment type
- Use the exact enum values provided
- Return ONLY key=value pairs, one per line, no other text`;

// ============================================================================
// DESCRIPTIONS: Flash-Lite attributes (optional - concatenate with prompt)
// ============================================================================
const USER_PROMPT_DESCRIPTION_FLASH_LITE = `## Attribute Definitions

color_value: Overall lightness/darkness of the garment color
- very_light: White, cream, very pale tones
- light: Pastels, light colors
- medium: Mid-tones, neither light nor dark
- dark: Navy, charcoal, black, deep colors

fabric_apparent_weight: How heavy/thick the fabric appears
- very_light: Sheer, chiffon, organza (see-through)
- light: Cotton voile, silk, thin jersey
- medium: Standard cotton, polyester blends
- heavy: Denim, wool, thick knits

fabric_sheen: How much light the fabric reflects
- matte: No shine, absorbs light (cotton, wool)
- sheen: Subtle light reflection (satin-back, polished cotton)
- shiny: Obvious shine (silk, satin, patent)

fabric_drape: How the fabric falls and moves
- structured: Holds shape, minimal movement (denim, tailored fabrics)
- fluid: Flows with body movement (jersey, rayon)
- very_drapey: Heavy drape, falls in pronounced folds (silk charmeuse, modal)

fit_category: How the garment fits on the body
- tight: Skin-tight, body-hugging
- fitted: Follows body contours with some ease
- loose: Relaxed fit, doesn't follow body shape
- oversized: Intentionally larger than body size

waist_definition: How clearly the waist is defined
- defined: Clear waist seam or cinching
- semi_defined: Slight waist shaping
- undefined: No waist definition, straight cut

waist_position: Where the waist sits on the body (for dresses/tops)
- empire: Just below bust
- natural: At natural waist (narrowest point)
- drop: Below natural waist, on hips
- low: At hip level
- undefined: No defined waist

hemline_position: Where the hem falls (for dresses/skirts)
- mid_thigh: Mini length
- above_knee: Just above knee
- at_knee: At knee level
- below_knee: Just below knee
- mid_calf: Midi length
- below_calf: Tea length
- ankle: Ankle length
- floor: Full length/maxi

leg_shape: Shape of pant legs (pants only)
- skinny: Tight from hip to ankle
- straight: Same width from knee to ankle
- flare: Widens from knee to ankle
- wide_leg: Wide from hip to ankle
- tapered: Narrows toward ankle
- jogger: Elastic/gathered at ankle

leg_opening_width: Width at pant hem (pants only)
- narrow: Skinny/tapered opening
- medium: Standard straight leg opening
- wide: Wide leg opening

sleeve_length: How long the sleeves are
- none: Sleeveless, strapless, halter
- cap: Just covers shoulder
- short: Above elbow
- elbow: At elbow
- three_quarter: Between elbow and wrist
- full_length: To wrist

`;

// ============================================================================
// DESCRIPTIONS: Flash attributes (optional - concatenate with prompt)
// ============================================================================
const USER_PROMPT_DESCRIPTION_FLASH = `## Attribute Definitions

silhouette_type: Overall shape of the garment
- a_line: Fitted at top, gradually widens toward hem (like letter A)
- fit_and_flare: Fitted bodice with flared/full skirt
- sheath: Form-fitting from top to bottom, follows body curves
- bodycon: Tight, stretchy, hugs every curve
- shift: Loose, straight cut, no waist definition
- mermaid: Fitted through hips, flares dramatically at or below knee
- cocoon: Rounded, oversized shape, wider in middle
- column: Straight and narrow throughout, minimal shaping
- tent: Widens dramatically from shoulders down
- asymmetric: Uneven hemline or neckline

sleeve_type: Construction style of the sleeve (not length)
- set_in: Standard sleeve with seam at shoulder
- raglan: Diagonal seam from collar to underarm
- dolman: Wide bat-wing style, very loose underarm
- bell: Fitted at shoulder, flares out dramatically at bottom
- puff: Gathered/puffy volume, often at shoulder
- bishop: Full sleeve gathered into fitted cuff at wrist
- flutter: Short, loose, flowing sleeve with open edge
- off_shoulder: Sits below the shoulder line
- cold_shoulder: Cutout at shoulder area

neckline_type: Shape/style of the neckline
- v_neck: V-shaped opening
- crew_neck: Round, close to neck
- scoop_neck: Wide, curved, lower than crew
- boat_neck: Wide, horizontal, shoulder to shoulder
- square_neck: Square/rectangular shape
- sweetheart: Heart-shaped, curves over bust
- turtleneck: High, folded collar covering neck
- mock_neck: High neckline without fold
- cowl_neck: Draped, loose fabric at neck
- keyhole: Small opening at neckline
- wrap_surplice: V-neck formed by overlapping fabric
- asymmetric: One-shoulder or uneven neckline
- collared: Has a collar (shirt collar, Peter Pan, etc.)
- halter: Straps tie/fasten behind neck
- henley: Round neck with partial button placket
- peter_pan: Flat, rounded collar
- mandarin: Short stand-up collar

neckline_depth: How low the neckline extends
- shallow: Near collarbone, minimal exposure
- medium: Below collarbone, moderate exposure
- deep: Significant chest exposure
- plunging: Very deep V or U, dramatic exposure

rise: Where pants waistband sits on the body (pants only)
- high: At or above natural waist (navel level)
- mid: Between hip bone and natural waist
- low: At or below hip bone

`;

// ============================================================================
// FLASH-LITE PROMPT: Easy/obvious attributes (fast, cheap)
// ============================================================================
const USER_PROMPT_FLASH_LITE = `Analyze this product image and extract garment attributes.

Return ALL keys below as key=value pairs, one per line.

Keys and allowed values:
garment_type = dress|top|shirt|skirt|pants|jumpsuit|romper|jacket|coat|sweater|other (REQUIRED)
color_primary = <color name> (REQUIRED)
color_value = very_light|light|medium|dark (REQUIRED)
pattern_type = solid|horizontal_stripes|vertical_stripes|diagonal|chevron|polka_dot|floral_small|floral_large|plaid|abstract|animal_print|colorblock|geometric|paisley|houndstooth|gingham (REQUIRED)
is_adult_clothing = true|false (REQUIRED)
fabric_apparent_weight = very_light|light|medium|heavy (REQUIRED)
fabric_sheen = matte|sheen|shiny (REQUIRED)
fit_category = tight|fitted|loose|oversized (REQUIRED, tight=body-hugging)
fabric_drape = structured|fluid|very_drapey (REQUIRED)
hemline_position = mid_thigh|above_knee|at_knee|below_knee|mid_calf|below_calf|ankle|floor|null (null if N/A)
waist_definition = defined|semi_defined|undefined|null (null if N/A)
leg_opening_width = narrow|medium|wide|very_wide|null (null if N/A - pants only)
leg_shape = skinny|straight|flare|wide_leg|tapered|jogger|bootcut|null (null if N/A - pants only)
sleeve_length = none|cap|short|elbow|three_quarter|full_length|null (null if N/A)

IMPORTANT: Return ALL keys. REQUIRED attributes must never be null.`;

// ============================================================================
// FLASH PROMPT: Nuanced attributes (requires fashion understanding)
// ============================================================================
const USER_PROMPT_FLASH = `Analyze this product image and extract garment attributes.

Return ALL keys below as key=value pairs, one per line.

Keys and allowed values:
silhouette_type = a_line|fit_and_flare|sheath|bodycon|shift|mermaid|cocoon|column|tent|asymmetric|null (null if N/A - dresses/tops only)
sleeve_type = set_in|raglan|dolman|bell|puff|bishop|flutter|off_shoulder|cold_shoulder|null (null if N/A - sleeveless garments)
neckline_type = v_neck|crew_neck|scoop_neck|boat_neck|square_neck|sweetheart|turtleneck|mock_neck|cowl_neck|keyhole|wrap_surplice|asymmetric|collared|henley|peter_pan|mandarin|null (null if N/A)
neckline_depth = shallow|medium|deep|plunging|null (null if N/A)
rise = high|mid|low|null (null if N/A - pants only)
waist_position = empire|natural|drop|low|undefined|null (null if N/A)

IMPORTANT: Return ALL keys. Use null ONLY for attributes that don't apply to this garment type.`;


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

    // Get dimensions for logging
    const originalMeta = await sharp(buffer).metadata();
    const resizedMeta = await sharp(resized).metadata();

    console.log(`[Image Size] Original: ${(buffer.length / 1024).toFixed(1)}KB (${originalMeta.width}x${originalMeta.height}) → Resized: ${(resized.length / 1024).toFixed(1)}KB (${resizedMeta.width}x${resizedMeta.height})`);

    // Debug: Save before/after images to compare
    const debugDir = join(__dirname, 'debug_images');
    if (!fs.existsSync(debugDir)) {
        fs.mkdirSync(debugDir, { recursive: true });
    }
    const timestamp = Date.now();
    fs.writeFileSync(join(debugDir, `${timestamp}_original.jpg`), buffer);
    fs.writeFileSync(join(debugDir, `${timestamp}_resized.jpg`), resized);
    console.log(`[Debug] Saved images to: ${debugDir}/${timestamp}_*.jpg`);

    return resized.toString('base64');
}

/**
 * Parse key=value response from model
 * @param {string} text - Response text containing key=value pairs
 * @returns {Object} - Parsed attributes
 */
function parseKeyValueResponse(text) {
    const result = {};
    const lines = text.trim().split('\n');

    for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || !trimmed.includes('=')) continue;

        const eqIndex = trimmed.indexOf('=');
        const key = trimmed.slice(0, eqIndex).trim();
        let value = trimmed.slice(eqIndex + 1).trim();

        // Skip empty keys
        if (!key) continue;

        // Parse special values
        if (value === 'true') {
            result[key] = true;
        } else if (value === 'false') {
            result[key] = false;
        } else if (value === 'null' || value === 'NULL' || value === 'None') {
            result[key] = null;
        } else {
            // Map hemline_position values to original enum values
            if (key === 'hemline_position' && HEMLINE_MAPPING[value]) {
                result[key] = HEMLINE_MAPPING[value];
            } else {
                result[key] = value;
            }
        }
    }

    return result;
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
// MODEL-SPECIFIC EXTRACTION
// ============================================================================

/**
 * Extract attributes using a specific model and prompt
 * @param {string} imageBase64 - Base64 encoded image data
 * @param {string} modelId - Model ID to use
 * @param {string} systemPrompt - System prompt
 * @param {string} userPrompt - User prompt
 * @param {string} modelLabel - Label for logging
 * @returns {Promise<Object>} - Extracted attributes and usage
 */
async function extractWithModel(imageBase64, modelId, systemPrompt, userPrompt, modelLabel) {
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
        },
    };

    const response = await callGeminiWithRetry(request, VISION_TIMEOUT_MS);
    const responseText = response.text || '';

    console.log(`[${modelLabel}] Response time: ${Date.now() - startTime}ms`);
    if (responseText) {
        console.log(`[${modelLabel}] Response: ${responseText}`);
    } else {
        console.log(`[${modelLabel}] Empty response (no applicable attributes)`);
    }

    const attributes = parseKeyValueResponse(responseText);
    return {
        attributes,
        usage: {
            inputTokens: response.usageMetadata?.promptTokenCount || 0,
            outputTokens: response.usageMetadata?.candidatesTokenCount || 0,
        },
    };
}

/**
 * Extract attributes from image using tiered parallel approach
 * Flash-Lite handles easy attributes, Flash handles nuanced ones
 * Both run in parallel, results are merged
 * @param {string} imageSource - URL or file path to the product image
 * @returns {Promise<Object>} - Merged extracted attributes
 */
async function extractTieredParallelGemini(imageSource) {
    const startTime = Date.now();
    const imageBase64 = await imageToBase64(imageSource);
    console.log(`[Image] Convert/resize time: ${Date.now() - startTime}ms`);

    // Build prompts (optionally include descriptions)
    const flashLitePrompt = INCLUDE_DESCRIPTIONS
        ? USER_PROMPT_DESCRIPTION_FLASH_LITE + USER_PROMPT_FLASH_LITE
        : USER_PROMPT_FLASH_LITE;
    const flashPrompt = INCLUDE_DESCRIPTIONS
        ? USER_PROMPT_DESCRIPTION_FLASH + USER_PROMPT_FLASH
        : USER_PROMPT_FLASH;

    // Run both models in parallel
    const [flashLiteResult, flashResult] = await Promise.all([
        extractWithModel(imageBase64, MODEL_FLASH_LITE, SYSTEM_PROMPT, flashLitePrompt, 'Flash-Lite'),
        extractWithModel(imageBase64, MODEL_FLASH, SYSTEM_PROMPT, flashPrompt, 'Flash')
    ]);

    // Merge attributes: Flash-Lite (easy) + Flash (nuanced)
    const mergedAttributes = {
        ...flashLiteResult.attributes,
        ...flashResult.attributes
    };

    // Combine usage stats
    const totalUsage = {
        inputTokens: flashLiteResult.usage.inputTokens + flashResult.usage.inputTokens,
        outputTokens: flashLiteResult.usage.outputTokens + flashResult.usage.outputTokens,
    };

    console.log(`[Tiered] Total parallel time: ${Date.now() - startTime}ms`);

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
 * Extract garment attributes from product image(s)
 * Supports both single image (string) and multiple images (string[]).
 * With multiple images, tries each sequentially until one passes quality gates.
 *
 * @param {string|string[]} imageSource - URL/path or array of URLs/paths
 * @returns {Promise<Object>} - Extracted garment attributes
 */
export async function extractGarmentAttributesGeminiTieredKV(imageSource) {
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
            console.log(`  [Tiered Extraction] Processing: ${imgUrl}`);
            const result = await extractTieredParallelGemini(imgUrl);

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
        const result = await extractGarmentAttributesGeminiTieredKV(testImage);
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
    console.log("Using models: ", MODEL_FLASH_LITE, "(easy) +", MODEL_FLASH, "(nuanced)");
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
