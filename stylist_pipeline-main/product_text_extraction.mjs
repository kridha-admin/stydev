/**
 * Product Text Attribute Extraction
 * Uses Bedrock LLM to extract text-based garment attributes from product descriptions
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

// Use Nova Micro for text extraction (no vision needed, fast + cheap)
const TEXT_MODEL_ID = 'amazon.nova-micro-v1:0';

const client = new BedrockRuntimeClient({
    region: REGION,
    credentials: {
        accessKeyId: ACCESS_KEY_ID,
        secretAccessKey: SECRET_ACCESS_KEY,
    }
});

// ============================================================================
// SYSTEM PROMPT FOR TEXT EXTRACTION
// ============================================================================

// {
//     inputTokens: 716,
//     outputTokens: 262,
//     totalTokens: 978,
//     cacheReadInputTokens: 0,
//     cacheWriteInputTokens: 304
// }

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
  "model_info": {
    "height_inches": <number or null>,
    "height_original": "<original text like '5\\'10\"' or '178cm' or null>",
    "size_worn": "<S|M|L|XL|XXS|XS|0|2|4|6|8|10|12|14|16|etc or null>",
    "bust_inches": <number or null>,
    "waist_inches": <number or null>,
    "hips_inches": <number or null>,
    "confidence": "<high|medium|low>"
  },
  "fabric": {
    "composition_raw": "<original text like '95% Viscose, 5% Elastane' or null>",
    "primary_material": "<viscose|cotton|polyester|silk|linen|wool|rayon|nylon|etc or null>",
    "primary_percentage": <number or null>,
    "secondary_material": "<material name or null>",
    "secondary_percentage": <number or null>,
    "stretch_fiber": "<elastane|spandex|lycra or null>",
    "stretch_percentage": <number or 0>,
    "weight_description": "<very_light|light|medium|heavy|null>",
    "confidence": "<high|medium|low>"
  },
  "garment": {
    "type": "<dress|top|blouse|shirt|skirt|pants|jumpsuit|romper|jacket|coat|cardigan|sweater|shorts|other or null>",
    "length_inches": <number or null>,
    "length_description": "<mini|above_knee|at_knee|below_knee|midi|tea_length|ankle|maxi|floor_length or null>",
    "confidence": "<high|medium|low>"
  },
  "product": {
    "title": "<product title or null>",
    "brand": "<brand name or null>",
    "price": "<price string like '$129.00' or null>",
    "care_instructions": "<care text or null>"
  },
  "overall_confidence": "<high|medium|low>"
}

IMPORTANT:
- Set fields to null if not found in the description.
- Convert all measurements to inches.
- Call the extract_garment_attributes tool with your findings.`;

// ============================================================================
// TOOL DEFINITION FOR FORCED JSON OUTPUT
// ============================================================================

const EXTRACTION_TOOL = {
    toolSpec: {
        name: "extract_garment_attributes",
        description: "Extract and return structured garment attributes from product description",
        inputSchema: {
            json: {
                type: "object",
                properties: {
                    model_info: {
                        type: "object",
                        properties: {
                            height_inches: { type: ["number", "null"], description: "Model height in inches" },
                            height_original: { type: ["string", "null"], description: "Original height text" },
                            size_worn: { type: ["string", "null"], description: "Size the model is wearing" },
                            bust_inches: { type: ["number", "null"] },
                            waist_inches: { type: ["number", "null"] },
                            hips_inches: { type: ["number", "null"] },
                            confidence: { type: "string", enum: ["high", "medium", "low"] }
                        },
                        required: ["height_inches", "size_worn", "confidence"]
                    },
                    fabric: {
                        type: "object",
                        properties: {
                            composition_raw: { type: ["string", "null"], description: "Original composition text" },
                            primary_material: { type: ["string", "null"] },
                            primary_percentage: { type: ["number", "null"] },
                            secondary_material: { type: ["string", "null"] },
                            secondary_percentage: { type: ["number", "null"] },
                            stretch_fiber: { type: ["string", "null"] },
                            stretch_percentage: { type: "number", default: 0 },
                            weight_description: { type: ["string", "null"], enum: ["very_light", "light", "medium", "heavy", null] },
                            confidence: { type: "string", enum: ["high", "medium", "low"] }
                        },
                        required: ["composition_raw", "primary_material", "confidence"]
                    },
                    garment: {
                        type: "object",
                        properties: {
                            type: { type: ["string", "null"], enum: ["dress", "top", "blouse", "shirt", "skirt", "pants", "jumpsuit", "romper", "jacket", "coat", "cardigan", "sweater", "shorts", "other", null] },
                            length_inches: { type: ["number", "null"] },
                            length_description: { type: ["string", "null"], enum: ["mini", "above_knee", "at_knee", "below_knee", "midi", "tea_length", "ankle", "maxi", "floor_length", null] },
                            confidence: { type: "string", enum: ["high", "medium", "low"] }
                        },
                        required: ["type", "confidence"]
                    },
                    product: {
                        type: "object",
                        properties: {
                            title: { type: ["string", "null"] },
                            brand: { type: ["string", "null"] },
                            price: { type: ["string", "null"] },
                            care_instructions: { type: ["string", "null"] }
                        }
                    },
                    overall_confidence: { type: "string", enum: ["high", "medium", "low"] }
                },
                required: ["model_info", "fabric", "garment", "product", "overall_confidence"]
            }
        }
    }
};

// ============================================================================
// MAIN EXTRACTION FUNCTION
// ============================================================================

/**
 * Extract text-based garment attributes from product description
 * Uses tool use to force structured JSON output
 * @param {string} description - Product description text
 * @returns {Promise<Object>} - Extracted attributes
 */
export async function extractTextAttributes(description) {
    if (!description || description.trim().length === 0) {
        return {
            success: false,
            error: 'Empty description provided',
            attributes: null
        };
    }

    const userPrompt = TEXT_EXTRACTION_USER_PROMPT.replace('{DESCRIPTION}', description);

    const input = {
        modelId: TEXT_MODEL_ID,
        system: [
            { text: TEXT_EXTRACTION_SYSTEM_PROMPT },
            {
                cachePoint: {
                    type: "default"
                }
            }
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
            temperature: 0.1,
        },
        // Force tool use for guaranteed JSON output
        toolConfig: {
            tools: [EXTRACTION_TOOL],
            toolChoice: {
                tool: {
                    name: "extract_garment_attributes"
                }
            }
        }
    };

    try {
        const command = new ConverseCommand(input);
        const response = await client.send(command);

        // With tool use, the response is in toolUse block
        const toolUseBlock = response.output?.message?.content?.find(
            block => block.toolUse
        );

        if (toolUseBlock?.toolUse?.input) {
            // Tool use returns structured JSON directly
            return {
                success: true,
                attributes: toolUseBlock.toolUse.input,
                raw_response: JSON.stringify(toolUseBlock.toolUse.input),
                usage: response.usage
            };
        }

        // Fallback: try to parse text response (shouldn't happen with forced tool use)
        const responseText = response.output?.message?.content?.[0]?.text;
        if (responseText) {
            const jsonMatch = responseText.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                return {
                    success: true,
                    attributes: JSON.parse(jsonMatch[0]),
                    raw_response: responseText,
                    usage: response.usage
                };
            }
        }

        throw new Error('No valid response from model');

    } catch (error) {
        console.error('Extraction error:', error);
        return {
            success: false,
            error: error.message,
            attributes: null
        };
    }
}

/**
 * Flatten nested text attributes into flat structure for scoring engine
 */
export function flattenTextAttributes(attributes) {
    if (!attributes) return null;

    return {
        // Model info
        model_height_inches: attributes.model_info?.height_inches ?? null,
        model_height_original: attributes.model_info?.height_original ?? null,
        model_size_worn: attributes.model_info?.size_worn ?? null,
        model_bust: attributes.model_info?.bust_inches ?? null,
        model_waist: attributes.model_info?.waist_inches ?? null,
        model_hips: attributes.model_info?.hips_inches ?? null,
        model_confidence: attributes.model_info?.confidence ?? null,

        // Fabric
        fabric_primary: attributes.fabric?.primary_material ?? null,
        fabric_primary_percentage: attributes.fabric?.primary_percentage ?? null,
        fabric_secondary: attributes.fabric?.secondary_material ?? null,
        fabric_secondary_percentage: attributes.fabric?.secondary_percentage ?? null,
        fabric_composition: attributes.fabric?.composition_raw ?? null,
        stretch_fiber: attributes.fabric?.stretch_fiber ?? null,
        stretch_percentage: attributes.fabric?.stretch_percentage ?? 0,
        fabric_weight: attributes.fabric?.weight_description ?? null,
        fabric_confidence: attributes.fabric?.confidence ?? null,

        // Garment
        garment_type: attributes.garment?.type ?? null,
        garment_length_inches: attributes.garment?.length_inches ?? null,
        hemline_description: attributes.garment?.length_description ?? null,
        garment_confidence: attributes.garment?.confidence ?? null,

        // Product
        title: attributes.product?.title ?? null,
        brand: attributes.product?.brand ?? null,
        price: attributes.product?.price ?? null,
        care_instructions: attributes.product?.care_instructions ?? null,

        // Overall Confidence
        overall_confidence: attributes.overall_confidence ?? null
    };
}

/**
 * Merge image and text attributes, with text overriding where specified
 * Per spec: fabric from text is authoritative, model info from text only
 */
export function mergeAttributes(imageAttrs, textAttrs) {
    if (!imageAttrs && !textAttrs) return null;
    if (!imageAttrs) return textAttrs;
    if (!textAttrs) return imageAttrs;

    return {
        // From IMAGE (authoritative)
        neckline_type: imageAttrs.neckline_type,
        neckline_depth: imageAttrs.neckline_depth,
        neckline_width: imageAttrs.neckline_width,
        sleeve_type: imageAttrs.sleeve_type,
        sleeve_width: imageAttrs.sleeve_width,
        silhouette_type: imageAttrs.silhouette_type,
        waistline: imageAttrs.waistline,
        waist_definition: imageAttrs.waist_definition,
        fit_category: imageAttrs.fit_category,
        color_primary: imageAttrs.color_primary,
        color_value: imageAttrs.color_value,
        color_temperature: imageAttrs.color_temperature,
        color_saturation: imageAttrs.color_saturation,
        pattern_type: imageAttrs.pattern_type,
        pattern_scale: imageAttrs.pattern_scale,
        pattern_contrast: imageAttrs.pattern_contrast,
        pattern_direction: imageAttrs.pattern_direction,
        fabric_sheen: imageAttrs.fabric_sheen,
        fabric_opacity: imageAttrs.fabric_opacity,
        fabric_drape: imageAttrs.fabric_drape,
        fabric_texture: imageAttrs.fabric_texture,
        has_darts: imageAttrs.has_darts,
        has_seaming: imageAttrs.has_seaming,
        has_ruching: imageAttrs.has_ruching,
        has_draping: imageAttrs.has_draping,
        has_pleats: imageAttrs.has_pleats,
        has_gathering: imageAttrs.has_gathering,

        // From TEXT (authoritative for these)
        fabric_primary: textAttrs.fabric_primary || imageAttrs.fabric_primary,
        fabric_secondary: textAttrs.fabric_secondary,
        fabric_composition: textAttrs.fabric_composition,
        stretch_percentage: textAttrs.stretch_percentage || 0,
        model_height_inches: textAttrs.model_height_inches, // TEXT ONLY
        model_size_worn: textAttrs.model_size_worn,         // TEXT ONLY
        model_bust: textAttrs.model_bust,
        model_waist: textAttrs.model_waist,
        model_hips: textAttrs.model_hips,

        // TEXT overrides IMAGE if stated
        hemline_position: textAttrs.hemline_description || imageAttrs.hemline_position,
        garment_length_inches: textAttrs.garment_length_inches,
        fabric_weight: textAttrs.fabric_weight || imageAttrs.fabric_weight,
        garment_type: textAttrs.garment_type || imageAttrs.garment_type,

        // Product info (TEXT only)
        title: textAttrs.title,
        brand: textAttrs.brand,
        price: textAttrs.price,
        care_instructions: textAttrs.care_instructions,

        // Combined confidence
        image_confidence: imageAttrs.overall_confidence,
        text_confidence: textAttrs.overall_confidence
    };
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

    const result = await extractTextAttributes(description);

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
            cacheReadInputTokens: usage.cacheReadInputTokens || 0,
            cacheWriteInputTokens: usage.cacheWriteInputTokens || 0,
        });

        // Check if cache was hit
        if (usage.cacheReadInputTokens > 0) {
            console.log(`\n✓ Cache HIT: ${usage.cacheReadInputTokens} tokens read from cache`);
        } else if (usage.cacheWriteInputTokens > 0) {
            console.log(`\n○ Cache WRITE: ${usage.cacheWriteInputTokens} tokens written to cache`);
        } else {
            console.log(`\n✗ No caching (prompt may be below 1K token minimum)`);
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
