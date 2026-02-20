

let garment1_attributes = {
    // ---------------------------- IMAGE ATTRIBUTES ----------------------------

    // <dress|top|blouse|shirt|skirt|pants|jumpsuit|romper|jacket|coat|cardigan|sweater|shorts|other or null>
    "garment_type": "dress",
    // <v_neck|crew_neck|scoop_neck|boat_neck|square_neck|sweetheart|off_shoulder|halter|turtleneck|mock_neck|cowl_neck|keyhole|wrap_surplice|asymmetric|one_shoulder|strapless|collared|henley|peter_pan|mandarin|plunging|null>
    "neckline_type": "crew_neck",
    // <shallow|medium|deep|plunging|null>
    "neckline_depth": "shallow",
    // <narrow|medium|wide|null>
    "neckline_width": "medium",
    // <mini|above_knee|at_knee|below_knee|midi|tea_length|ankle|maxi|floor_length|high_low|null>
    "hemline_position": "below_knee",
    // <sleeveless|spaghetti_strap|cap|short|elbow|three_quarter|full_length|bell|puff|raglan|set_in|dolman|flutter|cold_shoulder|bishop|lantern|leg_of_mutton|off_shoulder|null>
    "sleeve_type": "short",
    // <fitted|semi_fitted|relaxed|voluminous|null>
    "sleeve_width": "relaxed",
    // <a_line|fit_and_flare|sheath|bodycon|shift|wrap|mermaid|cocoon|peplum|empire|column|tent|princess_seam|dropped_waist|tiered|asymmetric|null>
    "silhouette_type": "a_line",
    // <empire|natural|drop|low|undefined|elasticized|null>
    "waistline": "undefined",
    // <defined|semi_defined|undefined|null>
    "waist_definition": "undefined",
    // <tight|fitted|semi_fitted|relaxed|loose|oversized|null>
    "fit_category": "relaxed",
    // < color_name >
    "color_primary": "multicolor",
    // <very_dark|dark|medium_dark|medium|medium_light|light|very_light>
    "color_value": "medium",
    // <warm|neutral|cool>
    "color_temperature": "warm",
    // <muted|moderate|vibrant>
    "color_saturation": "vibrant",
    // <solid|horizontal_stripes|vertical_stripes|diagonal|chevron|polka_dot|floral_small|floral_large|plaid|abstract|animal_print|colorblock|geometric|paisley|houndstooth|gingham|null>
    "pattern_type": "geometric",
    // <small|medium|large|null>
    "pattern_scale": "large",
    // <low|medium|high|null>
    "pattern_contrast": "high",
    // <horizontal|vertical|diagonal|mixed|null>
    "pattern_direction": "mixed",
    // <very_light|light|medium|heavy|null>
    "fabric_weight": "medium",
    // <matte|subtle_sheen|moderate_sheen|shiny|null>
    "fabric_sheen": "subtle_sheen",
    // <opaque|semi_opaque|sheer|null>
    "fabric_opacity": "opaque",
    // <stiff|structured|fluid|very_drapey|null>
    "fabric_drape": "fluid",
    // <smooth|textured|ribbed|knit|woven|null>
    "fabric_texture": "textured",
    // <true|false|null>
    "has_darts": null,
    // <true|false|null>
    "has_seaming": null,
    // <true|false|null>
    "has_ruching": null,
    // <true|false|null>
    "has_draping": null,
    // <true|false|null>
    "has_pleats": null,
    // <true|false|null>
    "has_gathering": null,
    // <petite|average|tall|null>
    "model_apparent_height_category": "average",
    // <high|medium|low>
    "overall_confidence": "high",

    // ---------------------------- TEXT ATTRIBUTES ----------------------------
    
    // <number or null>
    "model_height_inches": null,
    // <original text like '5\\'10\"' or '178cm' or null>
    "model_height_original": null,
    // <S|M|L|XL|XXS|XS|0|2|4|6|8|10|12|14|16|etc or null>
    "model_size_worn": null,
    // <number or null>
    "model_bust": null,
    // <number or null>
    "model_waist": null,
    // <number or null>
    "model_hips": null,
    // <original text like '95% Viscose, 5% Elastane' or null>
    "fabric_composition_raw": null,
    // <viscose|cotton|polyester|silk|linen|wool|rayon|nylon|etc or null>
    "fabric_primary_material": "satin",
    // <number or null>
    "fabric_primary_percentage": null,
    // <material name or null>
    "fabric_secondary_material": null,
    // <number or null>
    "fabric_secondary_percentage": null,
    // <elastane|spandex|lycra or null>
    "fabric_stretch_fiber": null,
    // <number or 0>
    "fabric_stretch_percentage": 0,
    // <very_light|light|medium|heavy|null>
    "fabric_weight_description": "heavy",
    // <dress|top|blouse|shirt|skirt|pants|jumpsuit|romper|jacket|coat|cardigan|sweater|shorts|other or null>
    "garment_type": "dress",
    // <number or null>
    "garment_length_inches": null,
    // <mini|above_knee|at_knee|below_knee|midi|tea_length|ankle|maxi|floor_length|high_low|null>
    "hemline_description": "maxi",
    // <product title or null>
    "title": "Satin Prom Dress Corset Prom Long A Line Pleated Bridesmaid Backless Formal Spaghetti Strap for Gowns",
    // <brand name or null>
    "brand": null,
    // <price string like '$129.00' or null>
    "price": null,
    // <care text or null>
    "care_instructions": null,
    // <high|medium|low>
    "overall_confidence": "medium"
};

let user1_profile =   {

    // ---------------------------- USER BODY MEASUREMENTS ----------------------------
    "chest_circumference": 112.7,
    "waist_circumference": 102.76,
    "hip_circumference": 107.5,
    "shoulder_breadth": 42.3164,
    "neck_circumference": 44.97,
    "thigh_left_circumference": 67.01,
    "ankle_left_circumference": 28.64,
    "arm_right_length"  : 75.9968,
    "inside_leg_height" : 77.66,
    "height" : 172.72,

    // ---------------------------- USER DERIVED MEASUREMENTS ----------------------------
    "waist_hip_ratio": 0.96,
    "bust_hip_ratio": 1.05,
    "shoulder_hip_ratio": 1.24,
    "torso_leg_ratio": 0.93,
    // <hourglass|pear|apple|inverted_triangle|rectangle>
    "body_shape": "apple",
    // <petite|average|tall>
    "height_category": "tall",
    // <plus_size|standard>
    "size_category": "plus_size",
    "compound_types": [ "apple", "tall", "plus_size" ],
    "knee_from_floor": 14.37,
    "mid_calf_from_floor": 9.63,
    "widest_calf_from_floor": 10.78,
    "ankle_from_floor": 3.5,
    "mid_thigh_from_floor": 22.01,
    "elbow_from_shoulder": 17.05,
    "widest_upper_arm_from_shoulder": 9.87,
    "natural_waist_from_shoulder": 28.43,
    "natural_waist_from_floor": 39.57,

    // ---------------------------- USER PREFERENCES ----------------------------

    // <look_taller|look_slimmer|highlight_waist|hide_midsection|minimize_hips|balance_shoulders|hide_upper_arms|elongate_legs|create_curves|streamline_silhouette|minimize_bust|show_legs>
    "goals" : ["look_taller", "minimize_hips", "highlight_waist"],
    // <fitted|just_right|relaxed|oversized>
    "fit_preference_top" : "just_right",
    // <skinny_fitted|straight_regular|relaxed|wide_flowy>
    "fit_preference_bottom": "straight_regular",
    // <18-25|26-35|36-45|46-55|55+>
    "age_range": "26-35",
}


