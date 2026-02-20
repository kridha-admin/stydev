/**
 * Product Image Garment Attribute Extraction
 * Uses Bedrock Vision AI to extract visual garment attributes
 *
 * v2: Enhanced with fabric behavior analysis + multi-image fallback
 */

import {
    BedrockRuntimeClient,
    ConverseCommand
} from "@aws-sdk/client-bedrock-runtime";
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

dotenv.config();

const REGION = process.env.BEDROCK_REGION || 'us-east-1';
const ACCESS_KEY_ID = process.env.BEDROCK_ACCESS_KEY_ID;
const SECRET_ACCESS_KEY = process.env.BEDROCK_SECRET_ACCESS_KEY;

// Use Amazon Nova Lite for vision tasks (multimodal, supports images)
const VISION_MODEL_ID = 'amazon.nova-lite-v1:0';

const client = new BedrockRuntimeClient({
    region: REGION,
    credentials: {
        accessKeyId: ACCESS_KEY_ID,
        secretAccessKey: SECRET_ACCESS_KEY,
    }
});

// Max images to attempt before giving up
const MAX_IMAGE_ATTEMPTS = 4;

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

Return ONLY a valid JSON object with all attributes. Use the exact enum values provided.
If between two values, pick the closer one and note lower confidence.`;

const GARMENT_EXTRACTION_USER_PROMPT = `Analyze this product image and extract all garment attributes.

Return JSON in this exact format:
{
  "image_quality": {
    "image_usable": <true|false>,
    "image_pose": "<front|side|back|three_quarter|flat_lay|null>",
    "garment_fully_visible": <true|false>,
    "occlusion_issues": "<none|minor|significant>",
    "confidence": "<high|medium|low>"
  },
  "height_measurements": {
    "model_height_cm": <number, assume 175 if unknown>,
    "hemline_height_cm": <number, distance from floor to hemline>,
    "waistline_height_cm": <number, distance from floor to waistline, null if no waist definition>,
    "confidence": "<high|medium|low>"
  },
  "garment_type": "<dress|top|blouse|shirt|skirt|pants|jumpsuit|romper|jacket|coat|cardigan|sweater|other>",
  "neckline": {
    "type": "<v_neck|crew_neck|scoop_neck|boat_neck|square_neck|sweetheart|off_shoulder|halter|turtleneck|mock_neck|cowl_neck|keyhole|wrap_surplice|asymmetric|one_shoulder|strapless|collared|henley|peter_pan|mandarin|plunging|null>",
    "depth": "<shallow|medium|deep|plunging|null>",
    "width": "<narrow|medium|wide|null>",
    "confidence": "<high|medium|low>"
  },
  "hemline": {
    "position": "<mini|above_knee|at_knee|below_knee|midi|tea_length|ankle|maxi|floor_length|high_low|null>",
    "confidence": "<high|medium|low>"
  },
  "sleeve": {
    "type": "<sleeveless|spaghetti_strap|cap|short|elbow|three_quarter|full_length|bell|puff|raglan|set_in|dolman|flutter|cold_shoulder|bishop|lantern|leg_of_mutton|off_shoulder|null>",
    "width": "<fitted|semi_fitted|relaxed|voluminous|null>",
    "confidence": "<high|medium|low>"
  },
  "silhouette": {
    "type": "<a_line|fit_and_flare|sheath|bodycon|shift|wrap|mermaid|cocoon|peplum|empire|column|tent|princess_seam|dropped_waist|tiered|asymmetric|null>",
    "confidence": "<high|medium|low>"
  },
  "waist": {
    "position": "<empire|natural|drop|low|undefined|elasticized|null>",
    "definition": "<defined|semi_defined|undefined|null>",
    "confidence": "<high|medium|low>"
  },
  "fit": {
    "category": "<tight|fitted|semi_fitted|relaxed|loose|oversized|null>",
    "confidence": "<high|medium|low>"
  },
  "color": {
    "primary": "<color name>",
    "value": "<very_dark|dark|medium_dark|medium|medium_light|light|very_light>",
    "temperature": "<warm|neutral|cool>",
    "saturation": "<muted|moderate|vibrant>",
    "confidence": "<high|medium|low>"
  },
  "pattern": {
    "type": "<solid|horizontal_stripes|vertical_stripes|diagonal|chevron|polka_dot|floral_small|floral_large|plaid|abstract|animal_print|colorblock|geometric|paisley|houndstooth|gingham|null>",
    "scale": "<small|medium|large|null>",
    "contrast": "<low|medium|high|null>",
    "direction": "<horizontal|vertical|diagonal|mixed|null>",
    "confidence": "<high|medium|low>"
  },
  "fabric": {
    "apparent_weight": "<very_light|light|medium|heavy|null>",
    "sheen": "<matte|subtle_sheen|moderate_sheen|shiny|null>",
    "opacity": "<opaque|semi_opaque|sheer|null>",
    "drape": "<stiff|structured|fluid|very_drapey|null>",
    "texture": "<smooth|textured|ribbed|knit|woven|null>",
    "confidence": "<high|medium|low>"
  },
  "fabric_behavior": {
    "body_interaction": "<clinging|skimming|standing_away|draping_away|null>",
    "stretch_visible": <true|false|null>,
    "pulling_at_seams": <true|false|null>,
    "gapping": <true|false|null>,
    "bunching": <true|false|null>,
    "confidence": "<high|medium|low>"
  },
  "construction": {
    "has_darts": <true|false|null>,
    "has_seaming": <true|false|null>,
    "has_ruching": <true|false|null>,
    "has_draping": <true|false|null>,
    "has_pleats": <true|false|null>,
    "has_gathering": <true|false|null>,
    "confidence": "<high|medium|low>"
  },
  "model_estimate": {
    "apparent_height_category": "<petite|average|tall|null>",
    "apparent_size_category": "<xs|s|m|l|xl|xxl|null>",
    "confidence": "<high|medium|low>"
  },
  "overall_confidence": "<high|medium|low>"
}

IMPORTANT: Return ONLY the JSON object, no other text or markdown formatting.`;

// ============================================================================
// IMAGE UTILITIES
// ============================================================================

/**
 * Convert image to base64 from file path or URL
 */
async function imageToBase64(imageSource) {
    if (imageSource.startsWith('http://') || imageSource.startsWith('https://')) {
        // Fetch from URL
        const response = await fetch(imageSource);
        if (!response.ok) {
            throw new Error(`Image fetch failed (${response.status}): ${imageSource}`);
        }
        const arrayBuffer = await response.arrayBuffer();
        return Buffer.from(arrayBuffer).toString('base64');
    } else {
        // Read from file
        const imageBuffer = fs.readFileSync(imageSource);
        return imageBuffer.toString('base64');
    }
}

/**
 * Detect image media type from URL or file path
 */
function getMediaType(imageSource) {
    // Strip query params for URL-based sources
    const cleanSource = imageSource.split('?')[0];
    const ext = path.extname(cleanSource).toLowerCase();
    const mimeTypes = {
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.png': 'image/png',
        '.gif': 'image/gif',
        '.webp': 'image/webp'
    };
    return mimeTypes[ext] || 'image/jpeg';
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
    const imageBase64 = await imageToBase64(imageSource);
    const mediaType = getMediaType(imageSource);

    const input = {
        modelId: VISION_MODEL_ID,
        system: [
            { text: GARMENT_EXTRACTION_SYSTEM_PROMPT },
        ],
        messages: [
            {
                role: "user",
                content: [
                    {
                        image: {
                            format: mediaType.split('/')[1],
                            source: {
                                bytes: Buffer.from(imageBase64, 'base64')
                            }
                        }
                    },
                    { text: GARMENT_EXTRACTION_USER_PROMPT }
                ]
            }
        ],
        inferenceConfig: {
            maxTokens: 2048,
            temperature: 0.1,
        }
    };

    const command = new ConverseCommand(input);
    const response = await client.send(command);
    const responseText = response.output?.message?.content?.[0]?.text;

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
        usage: response.usage,
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
export async function extractGarmentAttributes(imageSource) {
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

    return {
        // Height measurements
        model_height_cm: attributes.height_measurements?.model_height_cm ?? null,
        hemline_height_cm: attributes.height_measurements?.hemline_height_cm ?? null,
        waistline_height_cm: attributes.height_measurements?.waistline_height_cm ?? null,

        garment_type: attributes.garment_type,

        // Neckline
        neckline_type: attributes.neckline?.type,
        neckline_depth: attributes.neckline?.depth,
        neckline_width: attributes.neckline?.width,

        // Hemline
        hemline_position: attributes.hemline?.position,

        // Sleeve
        sleeve_type: attributes.sleeve?.type,
        sleeve_width: attributes.sleeve?.width,

        // Silhouette
        silhouette_type: attributes.silhouette?.type,

        // Waist
        waistline: attributes.waist?.position,
        waist_definition: attributes.waist?.definition,

        // Fit
        fit_category: attributes.fit?.category,

        // Color
        color_primary: attributes.color?.primary,
        color_value: attributes.color?.value,
        color_temperature: attributes.color?.temperature,
        color_saturation: attributes.color?.saturation,

        // Pattern
        pattern_type: attributes.pattern?.type,
        pattern_scale: attributes.pattern?.scale,
        pattern_contrast: attributes.pattern?.contrast,
        pattern_direction: attributes.pattern?.direction,

        // Fabric
        fabric_weight: attributes.fabric?.apparent_weight,
        fabric_sheen: attributes.fabric?.sheen,
        fabric_opacity: attributes.fabric?.opacity,
        fabric_drape: attributes.fabric?.drape,
        fabric_texture: attributes.fabric?.texture,

        // Fabric behavior (v2)
        fabric_body_interaction: attributes.fabric_behavior?.body_interaction ?? null,
        fabric_stretch_visible: attributes.fabric_behavior?.stretch_visible ?? null,
        fabric_pulling_at_seams: attributes.fabric_behavior?.pulling_at_seams ?? null,
        fabric_gapping: attributes.fabric_behavior?.gapping ?? null,
        fabric_bunching: attributes.fabric_behavior?.bunching ?? null,

        // Construction
        has_darts: attributes.construction?.has_darts,
        has_seaming: attributes.construction?.has_seaming,
        has_ruching: attributes.construction?.has_ruching,
        has_draping: attributes.construction?.has_draping,
        has_pleats: attributes.construction?.has_pleats,
        has_gathering: attributes.construction?.has_gathering,

        // Image quality (v2)
        image_usable: attributes.image_quality?.image_usable ?? null,
        image_pose: attributes.image_quality?.image_pose ?? null,

        // Model estimate
        model_apparent_height_category: attributes.model_estimate?.apparent_height_category,
        model_apparent_size_category: attributes.model_estimate?.apparent_size_category ?? null,

        // Confidence
        overall_confidence: attributes.overall_confidence
    };
}

// ============================================================================
// CLI TESTING
// ============================================================================

// Default test image - override with command line argument
const DEFAULT_IMAGE = './images/red-green.jpeg';

async function main() {
    // Use command line argument if provided, otherwise use default
    const testImage = process.argv[2] || DEFAULT_IMAGE;

    console.log(`\nExtracting garment attributes from: ${testImage}\n`);

    const result = await extractGarmentAttributes(testImage);

    if (result.success) {
        console.log('=== EXTRACTED ATTRIBUTES ===\n');
        console.log(JSON.stringify(result.attributes, null, 2));

        console.log('\n=== FLATTENED FOR SCORING ENGINE ===\n');
        const flat = flattenAttributes(result.attributes);
        console.log(JSON.stringify(flat, null, 2));

        console.log('\n=== TOKEN USAGE ===\n');
        const usage = result.usage || {};
        console.log({
            inputTokens: usage.inputTokens || 0,
            outputTokens: usage.outputTokens || 0,
            totalTokens: (usage.inputTokens || 0) + (usage.outputTokens || 0),
        });

        if (result.attempts > 1) {
            console.log(`\nUsed image ${result.image_index + 1} after ${result.attempts} attempts`);
        }
        if (result.quality_warning) {
            console.log('\n⚠ Warning: Image failed quality gates but was used as fallback');
        }
    } else {
        console.error('Extraction failed:', result.error);
    }
}

// Run if called directly (not imported)
const isMainModule = import.meta.url === `file://${process.argv[1]}`;
if (isMainModule) {
    main();
}
