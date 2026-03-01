/**
 * Product Image Garment Height Extraction
 * Uses Bedrock Vision AI to extract garment height in inches
 * Assumes model height is 5'9" (69 inches) if model is present
 */

import {
    BedrockRuntimeClient,
    ConverseCommand
} from "@aws-sdk/client-bedrock-runtime";
import dotenv from 'dotenv';
import fs from 'fs';
import sharp from 'sharp';

dotenv.config();

const REGION = process.env.BEDROCK_REGION || 'us-east-1';
const ACCESS_KEY_ID = process.env.BEDROCK_ACCESS_KEY_ID;
const SECRET_ACCESS_KEY = process.env.BEDROCK_SECRET_ACCESS_KEY;

// Use Amazon Nova Pro for vision tasks
const VISION_MODEL_ID = process.env.MODEL_ID_HEIGHT_BEDROCK || 'amazon.nova-pro-v1:0';

const client = new BedrockRuntimeClient({
    region: REGION,
    credentials: {
        accessKeyId: ACCESS_KEY_ID,
        secretAccessKey: SECRET_ACCESS_KEY,
    }
});

// Max image width for vision model (reduces latency significantly)
const MAX_IMAGE_WIDTH = 512;

// Assumed model height in inches (5'9" = 69 inches)
const ASSUMED_MODEL_HEIGHT_INCHES = 69;

// ============================================================================
// SYSTEM PROMPT FOR HEIGHT EXTRACTION
// ============================================================================

const HEIGHT_EXTRACTION_SYSTEM_PROMPT = `You are a fashion garment measurement system. Your task is to estimate the LENGTH of a garment and SLEEVE LENGTH in inches based on a product image.

CRITICAL ASSUMPTION: If a human model is wearing the garment, assume the model's height is exactly 69 inches (5'9" or 175cm).

Your task:
1. Identify if there is a human model in the image or if it's a flat lay/mannequin
2. Identify the garment type (dress, top, skirt, pants, etc.)
3. Estimate the garment length in inches based on where it falls on the model's body
4. Estimate the sleeve length in inches (from shoulder seam to sleeve hem)

GARMENT LENGTH MEASUREMENT RULES:
- For DRESSES/TOPS/BLOUSES: Measure from shoulder seam to hemline
- For SKIRTS: Measure from waistband to hemline
- For PANTS: Measure from waistband to ankle/hem (inseam or outseam based on visibility)
- For JUMPSUITS/ROMPERS: Measure from shoulder to hemline

SLEEVE LENGTH MEASUREMENT RULES:
- Measure from shoulder seam to sleeve hem
- Sleeveless/strapless: return null
- Cap sleeve: ~3-4 inches
- Short sleeve: ~6-8 inches
- Elbow sleeve: ~12-14 inches
- 3/4 sleeve: ~16-18 inches
- Full/long sleeve: ~23-25 inches

REFERENCE POINTS (assuming 69" model height):
- Shoulder to natural waist: ~15-16 inches
- Shoulder to hip: ~22-24 inches
- Shoulder to mid-thigh (mini): ~28-30 inches
- Shoulder to knee: ~38-40 inches
- Shoulder to mid-calf (midi): ~45-48 inches
- Shoulder to ankle (maxi): ~55-58 inches
- Shoulder to floor: ~60-62 inches

Return ONLY a valid JSON object with the measurements.`;

const HEIGHT_EXTRACTION_USER_PROMPT = `Analyze this product image and estimate the garment length and sleeve length in inches.

Assume the model height is 69 inches (5'9") if a model is present.

Return JSON in this exact format:
{
  "garment_length_inches": <number>,
  "sleeve_length_inches": <number or null if sleeveless>
}

IMPORTANT: Return ONLY the JSON object, no other text or markdown formatting.`;

// ============================================================================
// TOOL-BASED EXTRACTION CONFIG
// ============================================================================

const HEIGHT_EXTRACTION_TOOL = {
    toolSpec: {
        name: "extract_garment_height",
        description: "Extract garment length/height and sleeve length in inches from product image",
        inputSchema: {
            json: {
                type: "object",
                properties: {
                    garment_length_inches: {
                        type: ["number", "null"],
                        description: "Estimated garment length in inches"
                    },
                    sleeve_length_inches: {
                        type: ["number", "null"],
                        description: "Estimated sleeve length in inches (null if sleeveless)"
                    }
                },
                required: ["garment_length_inches", "sleeve_length_inches"]
            }
        }
    }
};

// ============================================================================
// IMAGE UTILITIES
// ============================================================================

/**
 * Convert image to base64 from file path or URL, with optional resizing
 */
async function imageToBase64(imageSource) {
    let buffer;

    if (imageSource.startsWith('http://') || imageSource.startsWith('https://')) {
        const response = await fetch(imageSource);
        if (!response.ok) {
            throw new Error(`Image fetch failed (${response.status}): ${imageSource}`);
        }
        buffer = Buffer.from(await response.arrayBuffer());
    } else {
        buffer = fs.readFileSync(imageSource);
    }

    // Resize to max width, maintaining aspect ratio
    const resized = await sharp(buffer)
        .resize({ width: MAX_IMAGE_WIDTH, withoutEnlargement: true })
        .jpeg({ quality: 85 })
        .toBuffer();

    return resized.toString('base64');
}

// ============================================================================
// MAIN EXTRACTION FUNCTION
// ============================================================================

/**
 * Extract garment height in inches from a product image
 * @param {string} imageSource - URL or file path to the product image
 * @returns {Promise<Object>} - Extracted height measurement
 */
export async function extractGarmentHeight(imageSource) {
    let startTime = Date.now();

    try {
        const imageBase64 = await imageToBase64(imageSource);
        console.log("Time taken to convert/resize image to base64: ", Date.now() - startTime);

        const input = {
            modelId: VISION_MODEL_ID,
            system: [
                { text: HEIGHT_EXTRACTION_SYSTEM_PROMPT },
            ],
            messages: [
                {
                    role: "user",
                    content: [
                        {
                            image: {
                                format: 'jpeg',
                                source: {
                                    bytes: Buffer.from(imageBase64, 'base64')
                                }
                            }
                        },
                        { text: "Analyze this product image and extract the garment length in inches using the extract_garment_height tool. Assume model height is 69 inches (5'9\") if a model is present." }
                    ]
                }
            ],
            inferenceConfig: {
                maxTokens: 512,
                temperature: 0.1,
            },
            toolConfig: {
                tools: [HEIGHT_EXTRACTION_TOOL],
                toolChoice: {
                    tool: {
                        name: "extract_garment_height"
                    }
                }
            }
        };

        const command = new ConverseCommand(input);
        const response = await client.send(command);
        console.log("Time taken to get response from vision model: ", Date.now() - startTime);

        // Extract from tool use response
        const toolUse = response.output?.message?.content?.find(c => c.toolUse);
        if (!toolUse?.toolUse?.input) {
            throw new Error('No tool use response from vision model');
        }

        const heightData = toolUse.toolUse.input;

        return {
            success: true,
            garment_length_inches: heightData.garment_length_inches,
            sleeve_length_inches: heightData.sleeve_length_inches,
            usage: response.usage,
        };

    } catch (error) {
        console.error('Height extraction error:', error);
        return {
            success: false,
            error: error.message,
            garment_length_inches: null,
            sleeve_length_inches: null,
        };
    }
}

// ============================================================================
// CLI TESTING
// ============================================================================

const DEFAULT_IMAGE = './images/red-green.jpeg';

async function main() {
    const testImage = process.argv[2] || DEFAULT_IMAGE;

    console.log(`\nExtracting garment height from: ${testImage}\n`);

    let startTime = Date.now();
    const result = await extractGarmentHeight(testImage);
    console.log("Total time taken: ", Date.now() - startTime, "ms\n");

    if (result.success) {
        console.log('=== EXTRACTED MEASUREMENTS ===\n');
        console.log(`garment_length_inches: ${result.garment_length_inches}`);
        console.log(`sleeve_length_inches: ${result.sleeve_length_inches}`);

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
