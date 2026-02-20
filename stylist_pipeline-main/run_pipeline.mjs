import { calc_derived_measurements_and_ratios } from './calculate_derived_measurements.mjs';
import { extractTextAttributes, flattenTextAttributes, mergeAttributes } from './product_text_extraction.mjs';
import { extractGarmentAttributes, flattenAttributes } from './product_image_extraction.mjs';
import {
    connectMongoDB,
    disconnectMongoDB,
    getUserStylingProfile,
    saveScoringResult,
} from './mongodb_helper.mjs';

// ARCHIVED: JS goal scorers replaced by Python scoring engine (2025-02)
// import {
//     estimate_goal_look_taller,
//     estimate_goal_look_slimmer,
//     estimate_goal_highlight_waist,
//     estimate_goal_hide_midsection,
//     estimate_goal_minimize_hips,
//     estimate_goal_balance_shoulders,
//     estimate_goal_hide_upper_arms,
//     estimate_goal_elongate_legs,
//     estimate_goal_create_curves,
//     estimate_goal_streamline_silhouette,
//     estimate_goal_minimize_bust,
//     estimate_goal_show_legs
// } from './user_garment_judgements.mjs';


let sample_user_body_derived_merged_attributes_result = {
    "chest_circumference": 112.7,
    "waist_circumference": 102.76,
    "hip_circumference": 107.5,
    "shoulder_breadth": 42.3164,
    "neck_circumference": 44.97,
    "thigh_left_circumference": 67.01,
    "ankle_left_circumference": 28.64,
    "arm_right_length": 75.9968,
    "inside_leg_height": 77.66,
    "height": 172.72,
    "waist_hip_ratio": 0.96,
    "bust_hip_ratio": 1.05,
    "shoulder_hip_ratio": 1.24,
    "torso_leg_ratio": 0.93,
    "body_shape": "apple",
    "height_category": "tall",
    "size_category": "plus_size",
    "compound_types": [
      "apple",
      "tall",
      "plus_size"
    ],
    "knee_from_floor": 14.37,
    "mid_calf_from_floor": 9.63,
    "widest_calf_from_floor": 10.78,
    "ankle_from_floor": 3.5,
    "mid_thigh_from_floor": 22.01,
    "elbow_from_shoulder": 17.05,
    "widest_upper_arm_from_shoulder": 9.87,
    "natural_waist_from_shoulder": 28.43,
    "natural_waist_from_floor": 39.57
}

let sample_product_text_extraction_attributes_result = {
    "model_height_inches": 68.9,
    "model_height_original": "175cm/5'9\"",
    "model_size_worn": "S",
    "model_bust": 0,
    "model_waist": 0,
    "model_hips": 0,
    "model_confidence": "high",
    "fabric_primary": "Rayon",
    "fabric_primary_percentage": 70,
    "fabric_secondary": "Linen",
    "fabric_secondary_percentage": 30,
    "fabric_composition": "Shell:Rayon 70%, Linen 30%\nLining:Polyester 100%",
    "stretch_fiber": "none",
    "stretch_percentage": 0,
    "fabric_weight": "medium",
    "fabric_confidence": "high",
    "garment_type": "dress",
    "garment_length_inches": 0,
    "hemline_description": "mini",
    "garment_confidence": "high",
    "title": "H&M Puff-Sleeved Dress",
    "brand": "H&M",
    "price": "$29.99",
    "care_instructions": "Use a laundry bag\nOnly non-chlorine bleach when needed\nLine dry\nMedium iron\nMachine wash cold",
    "overall_confidence": "high"
}

let sample_product_image_extraction_attributes_result = {
    "garment_type": "dress",
    "neckline_type": "boat_neck",
    "neckline_depth": "shallow",
    "neckline_width": "medium",
    "hemline_position": "below_knee",
    "sleeve_type": "short",
    "sleeve_width": "relaxed",
    "silhouette_type": "a_line",
    "waistline": "natural",
    "waist_definition": "undefined",
    "fit_category": "relaxed",
    "color_primary": "light green",
    "color_value": "light",
    "color_temperature": "cool",
    "color_saturation": "moderate",
    "pattern_type": "floral_small",
    "pattern_scale": "small",
    "pattern_contrast": "medium",
    "pattern_direction": "mixed",
    "fabric_weight": "light",
    "fabric_sheen": "subtle_sheen",
    "fabric_opacity": "opaque",
    "fabric_drape": "fluid",
    "fabric_texture": "smooth",
    "has_darts": null,
    "has_seaming": null,
    "has_ruching": null,
    "has_draping": null,
    "has_pleats": null,
    "has_gathering": null,
    "model_apparent_height_category": "average",
    "overall_confidence": "high"
}

let sample_product_image_text_merged_attributes_result = {
    "neckline_type": "boat_neck",
    "neckline_depth": "shallow",
    "neckline_width": "medium",
    "sleeve_type": "short",
    "sleeve_width": "relaxed",
    "silhouette_type": "a_line",
    "waistline": "natural",
    "waist_definition": "undefined",
    "fit_category": "relaxed",
    "color_primary": "light green",
    "color_value": "light",
    "color_temperature": "cool",
    "color_saturation": "moderate",
    "pattern_type": "floral_small",
    "pattern_scale": "small",
    "pattern_contrast": "medium",
    "pattern_direction": "mixed",
    "fabric_sheen": "subtle_sheen",
    "fabric_opacity": "opaque",
    "fabric_drape": "fluid",
    "fabric_texture": "smooth",
    "has_darts": null,
    "has_seaming": null,
    "has_ruching": null,
    "has_draping": null,
    "has_pleats": null,
    "has_gathering": null,
    "fabric_primary": "Rayon",
    "fabric_secondary": "Linen",
    "fabric_composition": "Shell:Rayon 70%, Linen 30%\nLining:Polyester 100%",
    "stretch_percentage": 0,
    "model_height_inches": 68.9,
    "model_size_worn": "S",
    "model_bust": 0,
    "model_waist": 0,
    "model_hips": 0,
    "hemline_position": "mini",
    "garment_length_inches": 0,
    "fabric_weight": "medium",
    "garment_type": "dress",
    "title": "H&M Puff-Sleeved Dress",
    "brand": "H&M",
    "price": "$29.99",
    "care_instructions": "Use a laundry bag\nOnly non-chlorine bleach when needed\nLine dry\nMedium iron\nMachine wash cold",
    "image_confidence": "high",
    "text_confidence": "high"
}

// ============================================================================
// SCORING SERVICE CLIENT
// ============================================================================

async function callScoringService(userMeasurements, garmentAttrs, userGoals = []) {
    const response = await fetch('http://localhost:8000/score', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            user_measurements: userMeasurements,
            garment_attributes: garmentAttrs,
            styling_goals: userGoals,
        }),
    });

    if (!response.ok) {
        const error = await response.text();
        throw new Error(`Scoring service error (${response.status}): ${error}`);
    }

    return response.json();
}

// ============================================================================
// MAIN PIPELINE
// ============================================================================

async function runPipeline(user_body_measurements, product_profile, options = {}) {
    const { username = null, styling_goals = null } = options;

    console.log("=== KRIDHA STYLING PIPELINE ===\n");

    // -------------------------------------------------------------------------
    // STEP 0: Fetch user styling profile from MongoDB (if username provided)
    // -------------------------------------------------------------------------
    let userGoals = styling_goals || [];

    if (username) {
        console.log("--- STEP 0: FETCHING USER PROFILE ---\n");
        try {
            await connectMongoDB();
            const profile = await getUserStylingProfile(username);
            if (profile && profile.styling_goals) {
                userGoals = profile.styling_goals;
                console.log(`User goals from profile: ${JSON.stringify(userGoals)}`);
            } else {
                console.log(`No styling profile found for ${username}, using provided goals`);
            }
        } catch (err) {
            console.warn("Could not fetch user profile:", err.message);
        }
    }

    // -------------------------------------------------------------------------
    // STEP 1: User Measurements (raw + derived)
    // -------------------------------------------------------------------------
    console.log("--- STEP 1: USER MEASUREMENTS ---\n");

    const derived = calc_derived_measurements_and_ratios(user_body_measurements, null);
    const user_measurements = {
        ...user_body_measurements,
        ...derived,
    };

    console.log(JSON.stringify(user_measurements, null, 2));

    // -------------------------------------------------------------------------
    // STEP 2 + 3: Extract Text & Image Attributes (in parallel)
    // -------------------------------------------------------------------------
    console.log("\n--- STEP 2+3: EXTRACTING TEXT & IMAGE ATTRIBUTES (PARALLEL) ---\n");

    const [textResult, imageResult] = await Promise.all([
        extractTextAttributes(product_profile.product_text),
        extractGarmentAttributes(product_profile.product_image_url),
    ]);

    if (!textResult.success) {
        console.error("Text extraction failed:", textResult.error);
        return;
    }

    console.log("Text Attributes (raw):");
    console.log(JSON.stringify(textResult.attributes, null, 2));

    const flatTextAttrs = flattenTextAttributes(textResult.attributes);
    console.log("\nText Attributes (flattened):");
    console.log(JSON.stringify(flatTextAttrs, null, 2));

    if (!imageResult.success) {
        console.error("Image extraction failed:", imageResult.error);
        return;
    }

    console.log("\nImage Attributes (raw):");
    console.log(JSON.stringify(imageResult.attributes, null, 2));

    const flatImageAttrs = flattenAttributes(imageResult.attributes);
    console.log("\nImage Attributes (flattened):");
    console.log(JSON.stringify(flatImageAttrs, null, 2));

    // -------------------------------------------------------------------------
    // STEP 4: Merge Attributes (text overrides where authoritative)
    // -------------------------------------------------------------------------
    console.log("\n--- STEP 4: MERGED ATTRIBUTES ---\n");
    const mergedAttrs = mergeAttributes(flatImageAttrs, flatTextAttrs);
    console.log(JSON.stringify(mergedAttrs, null, 2));

    // -------------------------------------------------------------------------
    // STEP 5: Score via Python Scoring Engine
    // -------------------------------------------------------------------------
    console.log("\n--- STEP 5: SCORING VIA PYTHON ENGINE ---\n");

    let scoringResult;
    try {
        scoringResult = await callScoringService(user_measurements, mergedAttrs, userGoals);
        console.log("Scoring Result:");
        console.log(JSON.stringify(scoringResult, null, 2));
    } catch (err) {
        console.error("Scoring service error:", err.message);
        console.error("Make sure the scoring service is running: bash start_scoring_service.sh");
        return;
    }

    // -------------------------------------------------------------------------
    // STEP 6: Save scoring result to MongoDB (if username provided)
    // -------------------------------------------------------------------------
    if (username) {
        console.log("\n--- STEP 6: SAVING RESULT TO MONGODB ---\n");
        try {
            const resultDoc = {
                username,
                product_url: product_profile.product_url || null,
                product_title: mergedAttrs.title || null,
                garment_type: mergedAttrs.garment_type || null,
                overall_score: scoringResult.overall_score,
                composite_raw: scoringResult.composite_raw,
                confidence: scoringResult.confidence,
                styling_goals: userGoals,
                scoring_result: scoringResult,
                garment_attributes: mergedAttrs,
                user_measurements_summary: {
                    height: user_measurements.height,
                    body_shape: user_measurements.body_shape,
                    size_category: user_measurements.size_category,
                },
            };
            const docId = await saveScoringResult(resultDoc);
            console.log(`Scoring result saved: ${docId}`);
        } catch (err) {
            console.warn("Could not save scoring result:", err.message);
        }
    }

    // -------------------------------------------------------------------------
    // STEP 7: Token Usage Summary
    // -------------------------------------------------------------------------
    console.log("\n--- TOKEN USAGE SUMMARY ---\n");
    console.log("Text Extraction:", {
        inputTokens: textResult.usage?.inputTokens || 0,
        outputTokens: textResult.usage?.outputTokens || 0,
    });
    console.log("Image Extraction:", {
        inputTokens: imageResult.usage?.inputTokens || 0,
        outputTokens: imageResult.usage?.outputTokens || 0,
    });

    return {
        user: user_measurements,
        garment: mergedAttrs,
        scoring_result: scoringResult,
        textAttrs: flatTextAttrs,
        imageAttrs: flatImageAttrs,
    };
}



let user_body_measurements1 = {
    "chest_circumference": 112.7,      // cm
    "waist_circumference": 102.76,     // cm
    "hip_circumference": 107.5,        // cm
    "shoulder_breadth": 42.3164,       // cm
    "neck_circumference": 44.97,       // cm
    "thigh_left_circumference": 67.01, // cm
    "ankle_left_circumference": 28.64, // cm
    "arm_right_length": 75.9968,       // cm
    "inside_leg_height": 77.66,        // cm
    "height": 172.72,                  // cm
};

let product_profile1 = {

    product_text: `

        Title:
        H&M Puff-Sleeved Dress
        $29.99

        Color:
        Cream/floral

        Product features
        The model is 175cm/5'9" and wears a size S
        Slim fit

        Description & fit
        Short dress in airy, woven fabric with smocking at back. Sweetheart neckline, slim fit over bust, and a gathered seam below bust. Narrow elastic over shoulders, short puff sleeves, and narrow elastic at cuffs. Gently flared skirt with a gathered seam above hem.

        Art. No.: 1275471004

        Concept:            DIVIDED
        Description:        Cream/blue/green, Floral
        Model size:         The model is 175cm/5'9" and wears a size S
        Length:             Short
        Sleeve Length:      Short sleeve
        Fit:                Slim fit
        Style:              Babydoll , Flared, Smocked, Romantic Dress
        Neckline:           Sweetheart Neckline
        Sleeve type:        Puff Sleeve
        Imported:           Yes
        Quantity:           Single

        Materials

        Composition
        Shell:Rayon 70%, Linen 30%
        Lining:Polyester 100%

        Additional material information
        The total weight of this product contains at least:
        67% Livaeco™ Viscose

        We exclude the weight of minor components such as, but not exclusively: threads, buttons, zippers, embellishments and prints.
        The total weight of the product is calculated by adding the weight of all layers and main components together. Based on that, we calculate how much of that weight is made out by each material. For sets and multipacks, all pieces are counted together as one product in calculations.

        Materials in this product explained

        Rayon
        Viscose is a regenerated cellulose fibre commonly made from wood, but the raw material could also consist of other cellulosic materials.

        Livaeco™ Viscose
        Livaeco™ is a branded viscose fiber. Its wood pulp raw material is sourced from certified forests according to standards regulating deforestation, wages and work environment, the protection of plant and animal species and community rights.

        Polyester
        Polyester is a synthetic fibre made from crude oil (a fossil resource).

        Linen
        Linen is a natural bast fibre derived from flax plants.

        Care guide
        Bring your clean, previously loved clothing or textiles to one of our stores — they can be from any brand.
        Read about how you can make your clothes last longer
        Care instructions
        Use a laundry bag
        Only non-chlorine bleach when needed
        Line dry
        Medium iron
        Machine wash cold
    `,

    product_image_url: 'https://image.hm.com/assets/hm/3f/9d/3f9d33623815e9442d3af8801b1bdcc619a18f8c.jpg?imwidth=1536',

    product_url: "https://www2.hm.com/en_us/productpage.1275471004.html"
};



// Run the pipeline
runPipeline(user_body_measurements1, product_profile1, {
    // username: 'vineeth@kridha.io',        // Uncomment to enable MongoDB profile fetch + result save
    // styling_goals: ['hide_midsection', 'look_taller'],  // Override goals (used if no MongoDB profile)
}).then(async (result) => {
    if (result) {
        console.log("\n=== PIPELINE COMPLETE ===\n");
    }
    await disconnectMongoDB();
}).catch(async (err) => {
    console.error("Pipeline error:", err);
    await disconnectMongoDB();
});
