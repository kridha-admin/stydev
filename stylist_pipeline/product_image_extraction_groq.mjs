/**
 * Product Image Garment Attribute Extraction (Groq Version)
 * Uses Groq's Llama Vision models for fast garment attribute extraction
 */

import axios from 'axios';
import sharp from 'sharp';
import fs from 'fs';
import dotenv from 'dotenv';

dotenv.config();

const GROQ_API_KEY = process.env.GROQ_API_KEY;
const GROQ_ENDPOINT = 'https://api.groq.com/openai/v1/chat/completions';

// Available vision models on Groq (in order of capability)
// - meta-llama/llama-4-scout-17b-16e-instruct (newest, fast)
// - llama-3.2-90b-vision-preview (most capable)
// - llama-3.2-11b-vision-preview (faster, less accurate)
const VISION_MODEL_ID = process.env.GROQ_VISION_MODEL || 'meta-llama/llama-4-scout-17b-16e-instruct';

// Config
const VISION_TIMEOUT_MS = 30000; // 30 seconds (Groq is fast)
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 500;

// Max images to attempt before giving up
const MAX_IMAGE_ATTEMPTS = 1;

// Max image dimension for vision model
const MAX_IMAGE_SIZE = 512;

// ============================================================================
// PROMPTS
// ============================================================================

const GARMENT_EXTRACTION_PROMPT = `Analyze this product image and extract garment attributes.

Return in key=value format, ONE per line. ONLY include attributes that are applicable and visible - skip null/irrelevant attributes entirely.

Allowed keys and values:
garment_type=dress|top|blouse|shirt|skirt|pants|jumpsuit|romper|jacket|coat|cardigan|sweater|other
neckline_type=v_neck|crew_neck|scoop_neck|boat_neck|square_neck|sweetheart|off_shoulder|halter|turtleneck|mock_neck|cowl_neck|keyhole|wrap_surplice|asymmetric|one_shoulder|strapless|collared|henley|peter_pan|mandarin|plunging
neckline_depth=shallow|medium|deep|plunging
hemline_position=mini|above_knee|at_knee|below_knee|midi|tea_length|ankle|maxi|floor_length|high_low
sleeve_type=sleeveless|spaghetti_strap|cap|short|elbow|three_quarter|full_length|bell|puff|raglan|set_in|dolman|flutter|cold_shoulder|bishop|lantern|leg_of_mutton|off_shoulder
silhouette_type=a_line|fit_and_flare|sheath|bodycon|shift|wrap|mermaid|cocoon|peplum|empire|column|tent|princess_seam|dropped_waist|tiered|asymmetric
waist_position=empire|natural|drop|low|undefined|elasticized
waist_definition=defined|semi_defined|undefined
fit_category=tight|fitted|semi_fitted|relaxed|loose|oversized
color_primary=<color name>
color_value=very_dark|dark|medium_dark|medium|medium_light|light|very_light
pattern_type=solid|horizontal_stripes|vertical_stripes|diagonal|chevron|polka_dot|floral_small|floral_large|plaid|abstract|animal_print|colorblock|geometric|paisley|houndstooth|gingham
fabric_apparent_weight=very_light|light|medium|heavy
fabric_sheen=matte|subtle_sheen|moderate_sheen|shiny
fabric_drape=stiff|structured|fluid|very_drapey
rise=ultra_high|high|mid|low
leg_shape=skinny|slim|straight|bootcut|flare|wide_leg|palazzo|tapered|jogger|cargo
leg_opening_width=narrow|medium|wide|very_wide
is_adult_clothing=true|false

IMPORTANT: Return ONLY key=value lines, no other text. Skip attributes that don't apply to this garment type.`;

// ============================================================================
// UTILITIES
// ============================================================================

function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Convert image to base64 data URL from file path or URL
 */
async function imageToBase64DataUrl(imageSource) {
    let buffer;

    if (imageSource.startsWith('http://') || imageSource.startsWith('https://')) {
        // Fetch from URL
        const response = await fetch(imageSource, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/108.0.0.0 Safari/537.36',
                'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
            }
        });
        if (!response.ok) {
            throw new Error(`Image fetch failed (${response.status}): ${imageSource}`);
        }
        buffer = Buffer.from(await response.arrayBuffer());
    } else {
        // Read from file
        buffer = fs.readFileSync(imageSource);
    }

    // Resize to fit within MAX_IMAGE_SIZE box, maintaining aspect ratio
    const resized = await sharp(buffer)
        .resize({ width: MAX_IMAGE_SIZE, height: MAX_IMAGE_SIZE, fit: 'inside', withoutEnlargement: true })
        .jpeg({ quality: 70 })
        .toBuffer();

    const base64 = resized.toString('base64');
    return `data:image/jpeg;base64,${base64}`;
}

/**
 * Parse key=value response format into object
 */
function parseKeyValueResponse(text) {
    const result = {};
    const lines = text.split('\n');

    for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || !trimmed.includes('=')) continue;

        const eqIndex = trimmed.indexOf('=');
        const key = trimmed.substring(0, eqIndex).trim();
        let value = trimmed.substring(eqIndex + 1).trim();

        // Convert boolean strings
        if (value === 'true') value = true;
        else if (value === 'false') value = false;
        else if (value === 'null') value = null;

        result[key] = value;
    }

    return result;
}

// ============================================================================
// GROQ API CALL WITH RETRY
// ============================================================================

async function callGroqWithRetry(base64DataUrl, prompt, retries = MAX_RETRIES) {
    for (let attempt = 1; attempt <= retries; attempt++) {
        try {
            const response = await axios.post(
                GROQ_ENDPOINT,
                {
                    model: VISION_MODEL_ID,
                    messages: [
                        {
                            role: 'user',
                            content: [
                                {
                                    type: 'image_url',
                                    image_url: {
                                        url: base64DataUrl
                                    }
                                },
                                {
                                    type: 'text',
                                    text: prompt
                                }
                            ]
                        }
                    ],
                    max_tokens: 512,
                    temperature: 0
                },
                {
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${GROQ_API_KEY}`
                    },
                    timeout: VISION_TIMEOUT_MS
                }
            );

            return response.data;
        } catch (error) {
            const is429 = error.response?.status === 429;
            const isTimeout = error.code === 'ECONNABORTED' || error.message?.includes('timeout');

            if ((is429 || isTimeout) && attempt < retries) {
                const delay = is429 ? RETRY_DELAY_MS * attempt : RETRY_DELAY_MS;
                console.log(`  Attempt ${attempt} failed (${is429 ? "429 rate limit" : "timeout"}), retrying in ${delay}ms...`);
                await sleep(delay);
                continue;
            }

            throw error;
        }
    }
}

// ============================================================================
// SINGLE IMAGE EXTRACTION
// ============================================================================

async function extractFromSingleImage(imageSource) {
    let startTime = Date.now();
    const base64DataUrl = await imageToBase64DataUrl(imageSource);
    console.log("Time taken to convert/resize image to base64: ", Date.now() - startTime);

    const response = await callGroqWithRetry(base64DataUrl, GARMENT_EXTRACTION_PROMPT);
    console.log("Time taken to get response from Groq: ", Date.now() - startTime);

    const responseText = response.choices?.[0]?.message?.content;
    console.log("Response text: ", responseText);

    if (!responseText) {
        throw new Error('No response from Groq vision model');
    }

    // Parse key=value format
    const garmentAttributes = parseKeyValueResponse(responseText);

    return {
        attributes: garmentAttributes,
        raw_response: responseText,
        usage: {
            inputTokens: response.usage?.prompt_tokens || 0,
            outputTokens: response.usage?.completion_tokens || 0,
            totalTokens: response.usage?.total_tokens || 0,
        },
        model: response.model,
    };
}

// ============================================================================
// MAIN EXTRACTION FUNCTION
// ============================================================================

export async function extractGarmentAttributesGroq(imageSource) {
    const images = Array.isArray(imageSource) ? imageSource : [imageSource];
    const imagesToTry = images.slice(0, MAX_IMAGE_ATTEMPTS);

    let lastResult = null;
    let lastError = null;
    let totalUsage = { inputTokens: 0, outputTokens: 0, totalTokens: 0 };

    for (let i = 0; i < imagesToTry.length; i++) {
        const imgUrl = imagesToTry[i];
        const imageLabel = `image ${i + 1}/${imagesToTry.length}`;

        try {
            console.log(`  [Groq] Extracting from: ${imgUrl}`);
            const result = await extractFromSingleImage(imgUrl);

            if (result.usage) {
                totalUsage.inputTokens += result.usage.inputTokens || 0;
                totalUsage.outputTokens += result.usage.outputTokens || 0;
                totalUsage.totalTokens += result.usage.totalTokens || 0;
            }

            return {
                success: true,
                attributes: result.attributes,
                raw_response: result.raw_response,
                usage: totalUsage,
                image_used: imgUrl,
                image_index: i,
                attempts: i + 1,
                model: result.model,
            };

        } catch (error) {
            console.warn(`  [Groq] ${imageLabel} extraction error: ${error.message}`);
            lastError = error;
        }
    }

    return {
        success: false,
        error: lastError?.message || 'All image extraction attempts failed',
        attributes: null,
    };
}

/**
 * Flatten attributes for scoring engine (same as Gemini version)
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
        rise: attributes.rise ?? null,
        leg_shape: attributes.leg_shape ?? null,
        leg_opening_width: attributes.leg_opening_width ?? null,
        is_adult_clothing: attributes.is_adult_clothing ?? null,
    };

    return out;
}

// ============================================================================
// CLI TESTING
// ============================================================================

const DEFAULT_IMAGE = './images/red-green.jpeg';

async function main() {
    const testImage = process.argv[2] || DEFAULT_IMAGE;

    console.log(`\n[Groq] Extracting garment attributes from: ${testImage}`);
    console.log(`[Groq] Using model: ${VISION_MODEL_ID}\n`);

    let startTime = Date.now();
    const result = await extractGarmentAttributesGroq(testImage);

    if (result.success) {
        console.log('\n=== EXTRACTED ATTRIBUTES ===\n');
        console.log(JSON.stringify(result.attributes, null, 2));

        console.log('\n=== TOKEN USAGE ===\n');
        console.log(result.usage);

        console.log('\n=== TIMING ===\n');
        console.log(`Total time: ${Date.now() - startTime}ms`);
        console.log(`Model used: ${result.model}`);
    } else {
        console.error('Extraction failed:', result.error);
    }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
    try {
        await main();
        process.exit(0);
    } catch (error) {
        console.error("Error:", error.message);
        process.exit(1);
    }
}
