

export const sample_garment1_attributes = {

    // ---------------------------- IMAGE HEIGHT ATTRIBUTES ----------------------------
    // <number|null>
    "garment_height" : 172,
    // <number|null>
    "garment_hemline_height": 90,
    // <number|null>
    "garment_waistline_height": 100,
    // <number|null>


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

export const sample_user1_profile = {

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

// this is outdated now
export const sample_output = {

    // ========================================================================================
    // PIECE 2: BODY-GARMENT TRANSLATIONS (calculated from garment + user measurements)
    // ========================================================================================

    // ---------------------------- HEMLINE TRANSLATION ----------------------------

    // CALC: user_hemline_height_cm = (garment.garment_hemline_height / garment.garment_height) * user.height
    //       Then classify based on user landmarks:
    //       if height > user.knee_from_floor * 2.54 → "above_knee"
    //       if height ≈ user.knee_from_floor * 2.54 (±2cm) → "on_knee"
    //       if height < user.knee_from_floor * 2.54 && > user.mid_calf_from_floor * 2.54 → "below_knee"
    //       if height ≈ user.mid_calf_from_floor * 2.54 → "mid_calf"
    //       if height ≈ user.widest_calf_from_floor * 2.54 → "widest_calf"
    //       if height > user.ankle_from_floor * 2.54 && < user.mid_calf_from_floor * 2.54 → "above_ankle"
    //       if height ≈ user.ankle_from_floor * 2.54 → "on_ankle"
    // <above_knee|on_knee|below_knee|mid_calf|widest_calf|above_ankle|on_ankle>
    "user_hemline_position": null,

    // CALC: (garment.garment_hemline_height / garment.garment_height) * user.height
    //       Example: (90 / 172) * 172.72 = 90.38 cm from floor
    // <number|null> - cm from floor on USER's body
    "user_hemline_height_cm": null,

    // CALC: Check if user_hemline_height_cm falls within ±3cm of danger zones:
    //       - user.widest_calf_from_floor * 2.54 (widest part of calf)
    //       - user.mid_thigh_from_floor * 2.54 (widest part of thigh)
    //       hemline_hits_danger_zone = |user_hemline_height_cm - danger_zone| < 3
    "hemline_hits_danger_zone": false,

    // CALC: Which danger zone is closest (if hemline_hits_danger_zone is true)
    // <widest_calf|mid_thigh|null>
    "hemline_danger_zone_type": null,

    // ---------------------------- SLEEVE TRANSLATION ----------------------------

    // CALC: First map sleeve_type to ratio of arm length:
    //       SLEEVE_RATIOS = {
    //           sleeveless: 0, spaghetti_strap: 0, cap: 0.1, short: 0.25,
    //           elbow: 0.5, three_quarter: 0.75, full_length: 1.0,
    //           bell/puff/bishop/etc: use base length ratio
    //       }
    //       sleeve_endpoint_cm = SLEEVE_RATIOS[garment.sleeve_type] * user.arm_right_length
    //       Then classify:
    //       if endpoint < user.widest_upper_arm_from_shoulder → "mid_bicep"
    //       if endpoint ≈ user.elbow_from_shoulder → "at_elbow"
    //       etc.
    // <above_shoulder|mid_bicep|above_elbow|at_elbow|below_elbow|mid_forearm|above_wrist|at_wrist|below_wrist|on_hand>
    "sleeve_hits_at": null,

    // CALC: sleeve_endpoint_cm = SLEEVE_RATIOS[sleeve_type] * user.arm_right_length
    //       sleeve_hits_widest_arm = |sleeve_endpoint_cm - user.widest_upper_arm_from_shoulder| < 2
    //       (bad if true - sleeve ends at widest part of upper arm)
    "sleeve_hits_widest_arm": false,

    // CALC: SLEEVE_RATIOS[garment.sleeve_type] * user.arm_right_length
    //       Example: short sleeve (0.25) * 75.99 = 19.0 cm from shoulder
    // <number|null> - cm from shoulder where sleeve ends on USER
    "sleeve_endpoint_from_shoulder_cm": null,

    // ---------------------------- WAIST ALIGNMENT ----------------------------

    // CALC: garment_waist_on_user = (garment.garment_waistline_height / garment.garment_height) * user.height
    //       user_natural_waist_from_floor = user.natural_waist_from_floor * 2.54 (convert inches to cm)
    //       offset = garment_waist_on_user - user_natural_waist_from_floor
    //       if garment.waistline == "undefined" → "undefined"
    //       else if offset < -3 → "above_natural" (empire effect)
    //       else if |offset| <= 3 → "at_natural"
    //       else if offset > 3 → "below_natural" (drop waist)
    // <above_natural|at_natural|below_natural|undefined>
    "waist_alignment": null,

    // CALC: garment_waist_on_user - user_natural_waist_from_floor_cm
    //       Positive = garment waist sits BELOW user's natural waist
    //       Negative = garment waist sits ABOVE user's natural waist
    //       Example: (100/172)*172.72 - (39.57*2.54) = 100.42 - 100.51 = -0.09 cm (well aligned)
    // <number|null>
    "waist_offset_cm": null,

    // CALC: |waist_offset_cm| <= 3 && garment.waistline != "undefined"
    "waist_aligned": false,

    // ========================================================================================
    // FABRIC BEHAVIOR PREDICTIONS
    // ========================================================================================

    // CALC: Based on fabric properties + body measurements
    //       CLINGY_FABRICS = ["jersey", "knit", "silk", "satin"] → base_cling = 0.6
    //       FLUID_FABRICS = ["viscose", "rayon", "chiffon"] → base_cling = 0.3
    //       STRUCTURED_FABRICS = ["cotton", "linen", "denim", "wool"] → base_cling = 0.1
    //
    //       Modifiers:
    //       if garment.fabric_drape == "very_drapey" → cling += 0.2
    //       if garment.fabric_drape == "fluid" → cling += 0.1
    //       if garment.stretch_percentage > 3 → cling += 0.15
    //       if garment.fit_category == "tight" or "fitted" → cling += 0.2
    //       if garment.fit_category == "relaxed" or "loose" → cling -= 0.2
    //
    //       Zone-specific:
    //       cling_risk_bust: if user.chest_circumference > 100 → cling += 0.1
    //       cling_risk_hips: if user.hip_circumference > 100 → cling += 0.1
    //
    //       Final: none (<0.2), low (0.2-0.4), medium (0.4-0.6), high (>0.6)
    // <none|low|medium|high>
    "cling_risk_bust": "low",
    "cling_risk_waist": "low",
    "cling_risk_hips": "low",
    "cling_risk_thighs": "low",

    // NOTE: fabric_drape from image extraction is used directly in goal scoring:
    //       stiff, structured → holds away from body (good for slimming)
    //       fluid → skims body (neutral to good)
    //       very_drapey → clings and reveals (negative for slimming)

    // ========================================================================================
    // PIECE 3: GOAL ASSESSMENTS (one per user goal)
    // ========================================================================================

    "goal_assessments": {

        // ==================== GOAL 1: LOOK TALLER ====================
        //
        // THEORY: Height perception is an optical illusion created by vertical lines
        // and unbroken visual flow. The eye travels up and down along continuous lines,
        // making the body appear longer. Conversely, horizontal elements "cut" the body
        // into segments, making each segment (and thus the whole) appear shorter.
        //
        // KEY PRINCIPLES:
        // 1. VERTICAL LINES ELONGATE - V-necks, vertical stripes, column silhouettes
        //    all draw the eye up/down, adding perceived inches
        // 2. HORIZONTAL BREAKS SHORTEN - Each horizontal line (hemline, waistband,
        //    colorblock) divides the body into stacked rectangles, shortening perception
        // 3. STRATEGIC HEMLINES - Where a hemline falls matters: at the narrowest
        //    point of the leg (above knee or midi) elongates; at the widest (knee,
        //    widest calf) shortens by drawing attention to width
        // 4. WAIST PLACEMENT - Higher perceived waist = longer legs = taller appearance
        //    Empire waists raise the waist; drop waists shorten leg proportion
        // 5. MONOCHROMATIC DRESSING - Same color top-to-bottom creates one tall column
        //    vs. contrasting top/bottom which creates two shorter blocks
        //
        "look_taller": {
            // CALC: Sum of factor impacts, then:
            //       score > 0.3 → "yes"
            //       score > -0.3 → "almost"
            //       score <= -0.3 → "no"
            // <yes|almost|no>
            "verdict": null,
            // CALC: Sum of all factor impacts (range -1.0 to +1.0)
            "score": 0,
            // CALC: Evaluate each attribute's impact on this goal:
            //
            // HEMLINE IMPACT (look_taller):
            //   above_knee: +0.3 (shows leg, elongates)
            //   on_knee: -0.2 (cuts leg at widest point)
            //   below_knee: -0.1 (breaks leg line slightly)
            //   midi: +0.1 (acceptable break point)
            //   maxi/floor: -0.2 (hides legs, can shorten)
            //
            // WAIST IMPACT (look_taller):
            //   waist_definition == "defined" && waistline == "natural": +0.2
            //   waist_definition == "undefined": -0.1
            //   waistline == "empire": +0.2 (raises perceived waist)
            //   waistline == "drop" or "low": -0.2
            //
            // PATTERN IMPACT (look_taller):
            //   pattern_direction == "vertical": +0.2
            //   pattern_direction == "horizontal": -0.2
            //   pattern_direction == "mixed" or "diagonal": 0
            //   pattern_scale == "large" && user.height_category == "petite": -0.1
            //
            // SILHOUETTE IMPACT (look_taller):
            //   column, sheath: +0.2 (vertical line)
            //   a_line, fit_and_flare: +0.1
            //   cocoon, tent: -0.2 (adds width)
            //
            // NECKLINE IMPACT (look_taller):
            //   v_neck, plunging: +0.2 (creates vertical line)
            //   boat_neck: -0.1 (horizontal emphasis)
            //   crew_neck: 0
            //
            // COLOR IMPACT (look_taller):
            //   monochromatic/solid: +0.1 (unbroken vertical)
            //   colorblock horizontal: -0.2 (breaks line)
            //
            // FIX: if hemline_impact < 0 → "hem_shorter"/"hem_longer"
            //      if waist_impact < 0 → "add_belt"
            //      external: "add_heels"
            "factors": [],
            "fix": null
        },

        // ==================== GOAL 2: LOOK SLIMMER ====================
        //
        // THEORY: Slimming is about visual weight reduction through optical illusions.
        // Dark colors recede while light colors advance; structured fabrics hold away
        // from the body while clingy fabrics reveal every contour; vertical lines
        // elongate while horizontal lines widen.
        //
        // KEY PRINCIPLES:
        // 1. DARK COLORS RECEDE - Black and dark colors absorb light, making areas
        //    appear smaller. Light colors reflect light, making areas appear larger.
        //    This is physics, not opinion.
        // 2. VERTICAL > HORIZONTAL - Same elongation principle as "look taller"
        //    but applied specifically to width perception
        // 3. STRUCTURED FABRICS SKIM - Fabrics that hold their shape (cotton, denim,
        //    structured polyester) create a "shell" that doesn't cling to body contours.
        //    Clingy fabrics (jersey, silk) reveal every bump and curve.
        // 4. STRATEGIC FIT - Paradoxically, slightly fitted clothes can look slimmer
        //    than oversized clothes, because oversized adds bulk. The key is "skimming"
        //    not "clinging" or "drowning"
        // 5. MONOCHROMATIC COLUMNAR DRESSING - One color head-to-toe creates a single
        //    vertical shape rather than segmented blocks
        // 6. DIAGONAL LINES - Wrap dresses work because diagonal lines are longer than
        //    vertical lines across the same distance, elongating the torso
        //
        "look_slimmer": {
            // CALC: Sum of factor impacts for overall slimming effect
            //
            // SILHOUETTE IMPACT (look_slimmer):
            //   sheath, column: +0.3 (straight vertical line)
            //   a_line: +0.2 (skims body)
            //   fit_and_flare: +0.2 (fitted top, full skirt balances)
            //   wrap: +0.3 (diagonal line, defined waist)
            //   bodycon: -0.3 (shows every curve - only positive if user wants that)
            //   cocoon, tent: -0.2 (adds bulk)
            //   empire: +0.1 (draws eye up)
            //
            // COLOR IMPACT (look_slimmer):
            //   color_value == "dark" or "very_dark": +0.2
            //   color_value == "light" or "very_light": -0.1
            //   solid/monochromatic: +0.1
            //
            // PATTERN IMPACT (look_slimmer):
            //   pattern_direction == "vertical": +0.2
            //   pattern_direction == "horizontal": -0.2
            //   pattern_scale == "small": +0.1
            //   pattern_scale == "large": -0.1
            //   pattern_contrast == "high": -0.1 (draws eye)
            //
            // FABRIC IMPACT (look_slimmer):
            //   fabric_drape == "stiff" or "structured": +0.2 (holds shape)
            //   fabric_drape == "very_drapey": -0.3 (clings)
            //   fabric_drape == "fluid": +0.1 (skims)
            //   fabric_drape == "fluid": +0.1
            //   fabric_weight == "heavy" (in wrong fabric): -0.1
            //
            // CONSTRUCTION IMPACT (look_slimmer):
            //   has_seaming (vertical): +0.2
            //   has_darts: +0.1 (creates shape)
            //
            // NECKLINE IMPACT (look_slimmer):
            //   v_neck, plunging: +0.2 (vertical emphasis)
            //   scoop_neck: +0.1
            //   boat_neck, wide necklines: -0.1
            //
            // FIX: "add_structured_layer", "choose_darker_color"
            "verdict": null,
            "score": 0,
            "factors": [],
            "fix": null
        },

        // ==================== GOAL 3: HIGHLIGHT WAIST ====================
        //
        // THEORY: The waist is the narrowest part of the torso and defining it
        // creates the classic "hourglass" proportion that many find flattering.
        // This is about creating visual contrast between the waist and bust/hips.
        //
        // KEY PRINCIPLES:
        // 1. FIT AT THE WAIST - The garment must actually follow the body's curve
        //    at the natural waist. A shift dress cannot highlight waist; a belted
        //    shift dress can.
        // 2. WAIST ALIGNMENT MATTERS - If the garment's waist seam hits at your
        //    natural waist, it emphasizes it. If it hits above (empire) or below
        //    (drop waist), it creates a different waist illusion that may not
        //    be where you want attention.
        // 3. CONSTRUCTION HELPS - Darts, princess seams, and strategic seaming
        //    literally shape the fabric to follow body curves. Ruching at the
        //    waist gathers fabric in a way that emphasizes narrowness.
        // 4. SILHOUETTE AMPLIFIES - Fit-and-flare and wrap silhouettes inherently
        //    emphasize the waist because they're designed with waist as the
        //    focal point. Shift and cocoon silhouettes deliberately hide it.
        // 5. BELTS ARE THE EASIEST FIX - Even a shapeless dress can highlight
        //    waist with a belt, making this one of the most "fixable" goals.
        //
        "highlight_waist": {
            // CALC: Sum of factor impacts for waist highlighting:
            //
            // WAIST DEFINITION IMPACT:
            //   waist_definition == "defined": +0.4
            //   waist_definition == "semi_defined": +0.1
            //   waist_definition == "undefined": -0.4
            //
            // WAIST ALIGNMENT IMPACT:
            //   waist_aligned == true: +0.2
            //   waist_alignment == "above_natural" (empire): -0.1
            //   waist_alignment == "below_natural" (drop): -0.2
            //
            // SILHOUETTE IMPACT (highlight_waist):
            //   fit_and_flare, wrap: +0.3 (natural waist emphasis)
            //   bodycon: +0.2 (shows waist curve)
            //   sheath with defined waist: +0.2
            //   shift, cocoon, tent: -0.3 (hides waist)
            //   a_line with undefined waist: -0.1
            //
            // CONSTRUCTION IMPACT (highlight_waist):
            //   has_darts == true: +0.1
            //   has_seaming (princess seams): +0.1
            //   has_ruching at waist: +0.2
            //
            // FIT IMPACT (highlight_waist):
            //   fit_category == "fitted" or "semi_fitted": +0.2
            //   fit_category == "loose" or "oversized": -0.3
            //
            // FIX: "add_belt" (easy fix for most silhouettes)
            "verdict": null,
            "score": 0,
            "factors": [],
            "fix": null
        },

        // ==================== GOAL 4: HIDE MIDSECTION ====================
        //
        // THEORY: The midsection (stomach/tummy area) is a common concern area.
        // The goal is to prevent fabric from clinging to or outlining this area,
        // while not adding bulk or drawing attention to it.
        //
        // KEY PRINCIPLES:
        // 1. FABRIC MUST NOT TOUCH - The key is creating "air space" between
        //    fabric and body. Structured fabrics that hold away from the body,
        //    or flowy fabrics that skim over curves, achieve this. Clingy fabrics
        //    (jersey, thin knits) are the enemy.
        // 2. EMPIRE WAIST IS IDEAL - By fitting under the bust and falling free
        //    from there, empire silhouettes completely bypass the midsection.
        //    The fabric flows from the narrowest point (under bust) over everything
        //    below.
        // 3. RUCHING IS CAMOUFLAGE - Strategic gathering/ruching creates visual
        //    noise that disguises the body's actual contours. The eye can't tell
        //    what's fabric gathering vs. body shape.
        // 4. DARK COLORS RECEDE - Same principle as "look slimmer" - dark colors
        //    at the midsection minimize visual attention to that area.
        // 5. PATTERN DISTRACTS - Busy patterns at the midsection give the eye
        //    something to look at other than body shape. But avoid horizontal
        //    stripes which widen.
        // 6. PEPLUMS WORK - The flare of a peplum covers the stomach area while
        //    defining the waist above it.
        //
        "hide_midsection": {
            // CALC: Sum of factor impacts for concealing midsection
            //
            // SILHOUETTE IMPACT (hide_midsection):
            //   empire: +0.4 (fabric falls from under bust, skims stomach)
            //   a_line: +0.3 (flows over midsection)
            //   shift: +0.2 (straight, no waist emphasis)
            //   wrap: +0.1 (strategic draping can conceal)
            //   bodycon: -0.5 (shows everything)
            //   peplum: +0.2 (flare covers stomach)
            //   fit_and_flare: +0.2 (if fitted above waist only)
            //
            // FIT IMPACT (hide_midsection):
            //   fit_category == "relaxed" or "loose": +0.3
            //   fit_category == "semi_fitted": +0.1
            //   fit_category == "fitted" or "tight": -0.3
            //
            // FABRIC IMPACT (hide_midsection):
            //   fabric_drape == "stiff" or "structured": +0.2 (holds away from body)
            //   fabric_drape == "very_drapey": -0.4 (clings, shows midsection)
            //   fabric_drape == "fluid": +0.1 (skims)
            //   fabric_drape == "fluid": +0.1
            //   fabric_weight == "medium" or "heavy": +0.1 (doesn't cling)
            //
            // CONSTRUCTION IMPACT (hide_midsection):
            //   has_ruching: +0.3 (strategic gathering conceals)
            //   has_draping: +0.2 (folds disguise)
            //   has_gathering at waist: +0.2
            //
            // PATTERN IMPACT (hide_midsection):
            //   pattern_type != "solid" at midsection: +0.1 (distracts eye)
            //   horizontal stripes at midsection: -0.2
            //
            // COLOR IMPACT (hide_midsection):
            //   dark color at midsection: +0.1
            //   light color at midsection: -0.1
            //
            // FIX: "add_ruched_overlay", "choose_empire_waist"
            "verdict": null,
            "score": 0,
            "factors": [],
            "fix": null
        },

        // ==================== GOAL 5: MINIMIZE HIPS ====================
        //
        // THEORY: Hip minimization uses two strategies: (1) avoid drawing attention
        // to the hip area, and (2) balance hips by adding visual weight to shoulders.
        // This creates a more proportionally balanced silhouette.
        //
        // KEY PRINCIPLES:
        // 1. SKIM, DON'T CLING - Like midsection, the key is fabric that flows
        //    over the hips without adhering to them. A-line silhouettes are ideal
        //    because they flare from the waist, creating a smooth line over hips.
        // 2. BALANCE WITH SHOULDERS - The eye compares proportions. If you add
        //    visual weight to the shoulders (boat neck, off-shoulder, puff sleeves),
        //    the hips appear smaller by comparison. This is "balancing" rather
        //    than minimizing.
        // 3. DARK COLORS ON BOTTOM - Dark colors recede, so dark pants/skirt
        //    minimizes hip area while a lighter or brighter top draws the eye up.
        // 4. AVOID HIP DETAILS - Pockets at hips, embellishments, horizontal
        //    seams at hip level, or patterns that hit at the widest point all
        //    draw the eye to exactly where you don't want it.
        // 5. HEMLINE PLACEMENT - A hemline that falls at the widest part of the
        //    hip/thigh area emphasizes it. Better to go above or below.
        // 6. PEPLUMS ARE BAD HERE - Unlike midsection (where peplums help), peplums
        //    add volume exactly at the hip, making them look larger.
        //
        "minimize_hips": {
            // CALC: Sum of factor impacts for hip minimization:
            //
            // SILHOUETTE IMPACT (minimize_hips):
            //   a_line: +0.4 (skims over hips)
            //   fit_and_flare: +0.3
            //   shift, column: +0.2 (straight line)
            //   bodycon: -0.4 (highlights everything)
            //   peplum: -0.3 (adds volume at hips)
            //   mermaid: -0.2 (fitted through hips)
            //
            // FABRIC BEHAVIOR IMPACT (minimize_hips):
            //   fabric_drape == "stiff", "structured", or "fluid": +0.2 (skims hips)
            //   fabric_drape == "very_drapey": -0.3 (clings, emphasizes hips)
            //
            // FIT IMPACT (minimize_hips):
            //   fit_category == "relaxed" or "loose": +0.2
            //   fit_category == "fitted" or "tight": -0.2
            //
            // HEMLINE IMPACT (minimize_hips):
            //   hemline below widest hip: +0.1 (covers)
            //   hemline at widest hip: -0.2 (draws eye)
            //
            // PATTERN IMPACT (minimize_hips):
            //   pattern at hips + high_contrast: -0.2
            //   solid or pattern_scale == "small": +0.1
            //   dark color_value at hips: +0.1
            //
            // NECKLINE IMPACT (minimize_hips):
            //   wide neckline (boat_neck, off_shoulder): +0.2 (balances hips)
            //   narrow neckline: -0.1 (emphasizes bottom-heavy)
            //
            // FIX: "add_shoulder_detail", "choose_dark_bottom"
            "verdict": null,
            "score": 0,
            "factors": [],
            "fix": null
        },

        // ==================== GOAL 6: BALANCE SHOULDERS ====================
        //
        // THEORY: Shoulder balance is about proportion relative to hips. The ideal
        // "balanced" look has shoulders roughly equal to hip width. If shoulders
        // are naturally wider (inverted triangle), we minimize them; if narrower
        // (pear), we widen them visually.
        //
        // KEY PRINCIPLES:
        // 1. THIS IS CONTEXTUAL - Unlike other goals, this one requires knowing
        //    whether the user has broad or narrow shoulders (shoulder_hip_ratio).
        //    The SAME neckline that helps one person hurts another.
        //
        // 2. FOR BROAD SHOULDERS (ratio > 1.05):
        //    - V-necks and halters draw the eye INWARD, away from shoulder edges
        //    - Raglan sleeves eliminate the horizontal shoulder seam, softening
        //    - Avoid boat necks, off-shoulder, puff sleeves - all add width
        //    - A-line/fit-and-flare adds hip volume to balance out shoulders
        //
        // 3. FOR NARROW SHOULDERS (ratio < 0.95):
        //    - Boat necks and off-shoulder extend the visual shoulder line
        //    - Puff sleeves, cap sleeves add volume at the shoulder
        //    - Structured shoulder pads literally add width
        //    - Avoid raglan/dolman which minimize the shoulder
        //
        // 4. HORIZONTAL AT SHOULDERS WIDENS - Any horizontal line at shoulder
        //    level (boat neck, wide neckline, horizontal stripes at top) extends
        //    perceived shoulder width.
        //
        // 5. SLEEVE SEAM PLACEMENT - Set-in sleeves with a defined shoulder seam
        //    emphasize shoulder width; raglan and dolman sleeves blur the shoulder
        //    line into the sleeve.
        //
        "balance_shoulders": {
            // CALC: Depends on whether user has BROAD or NARROW shoulders
            //       Check user.shoulder_hip_ratio:
            //       > 1.05 = broad shoulders (need to minimize)
            //       < 0.95 = narrow shoulders (need to widen)
            //       0.95-1.05 = balanced (maintain)
            //
            // FOR BROAD SHOULDERS (minimize):
            //   NECKLINE IMPACT:
            //     v_neck, scoop: +0.3 (draws eye down/in)
            //     halter: +0.2 (narrows shoulder line)
            //     boat_neck, off_shoulder: -0.4 (widens)
            //     one_shoulder: -0.2
            //   SLEEVE IMPACT:
            //     raglan: +0.3 (softens shoulder line)
            //     dolman: +0.2 (no defined shoulder seam)
            //     puff, leg_of_mutton: -0.4 (adds volume)
            //     set_in at shoulder: -0.1
            //   SILHOUETTE IMPACT:
            //     a_line, fit_and_flare: +0.2 (adds hip volume to balance)
            //     peplum: +0.2 (adds hip volume)
            //
            // FOR NARROW SHOULDERS (widen):
            //   NECKLINE IMPACT:
            //     boat_neck, off_shoulder: +0.3 (widens)
            //     square_neck: +0.2
            //     v_neck deep: -0.1 (narrows further)
            //   SLEEVE IMPACT:
            //     puff, cap: +0.3 (adds volume)
            //     structured shoulder: +0.2
            //     raglan, dolman: -0.2 (minimizes)
            //
            // FIX: "add_shoulder_pads" (for narrow), "choose_raglan_sleeve" (for broad)
            "verdict": null,
            "score": 0,
            "factors": [],
            "fix": null
        },

        // ==================== GOAL 7: HIDE UPPER ARMS ====================
        //
        // THEORY: The upper arm (bicep/tricep area) is a common concern, especially
        // as skin loses elasticity with age. The goal is coverage without looking
        // like you're hiding, and avoiding the "worst" sleeve endpoints.
        //
        // KEY PRINCIPLES:
        // 1. THE SLEEVE ENDPOINT DANGER ZONE - The WORST place for a sleeve to
        //    end is at the widest part of the upper arm. This draws the eye to
        //    exactly the area you want to minimize. Cap sleeves often do this.
        //    Better to go shorter (showing forearm confidence) or longer (covering).
        //
        // 2. THREE-QUARTER SLEEVES ARE IDEAL - They cover the entire upper arm
        //    while revealing the (usually slimmer) forearm. This is why 3/4 sleeves
        //    are universally flattering.
        //
        // 3. LOOSE > FITTED - A fitted sleeve clings to arm contours, showing
        //    every bump. Relaxed or voluminous sleeves create air space.
        //    Bell sleeves, bishop sleeves flow away from the arm.
        //
        // 4. FLUTTER SLEEVES - These provide soft, partial coverage that flutters
        //    with movement. The drape prevents static exposure of the arm.
        //
        // 5. LAYERING IS AN EASY FIX - A cardigan, shrug, or jacket over a
        //    sleeveless dress instantly solves the coverage problem.
        //
        // 6. FABRIC MATTERS - Even with long sleeves, clingy fabric (jersey,
        //    thin knits) will show arm shape. Structured or flowing fabrics
        //    are better.
        //
        "hide_upper_arms": {
            // CALC: Sum of factor impacts for concealing upper arms
            //
            // SLEEVE TYPE IMPACT (hide_upper_arms):
            //   three_quarter: +0.4 (covers bicep, shows forearm)
            //   full_length: +0.4 (full coverage)
            //   elbow: +0.3
            //   bell, bishop: +0.3 (loose, flowing)
            //   flutter: +0.2 (soft coverage)
            //   cap: -0.3 (hits at widest point)
            //   short: depends on where it hits
            //   sleeveless: -0.5 (no coverage)
            //   spaghetti_strap: -0.5
            //
            // SLEEVE WIDTH IMPACT (hide_upper_arms):
            //   voluminous: +0.2 (loose, doesn't cling)
            //   relaxed: +0.1
            //   fitted: -0.2 (shows arm shape)
            //
            // SLEEVE DANGER ZONE:
            //   sleeve_hits_widest_arm == true: -0.4 (worst position)
            //   sleeve_hits_widest_arm == false: +0.1
            //
            // FABRIC IMPACT (hide_upper_arms):
            //   fabric_drape == "stiff", "structured", or "fluid": +0.1 (doesn't cling)
            //   fabric_drape == "very_drapey": -0.2 (clings, shows arm contours)
            //
            // FIX: "add_cardigan", "add_shrug", "choose_longer_sleeve"
            "verdict": null,
            "score": 0,
            "factors": [],
            "fix": null
        },

        // ==================== GOAL 8: ELONGATE LEGS ====================
        //
        // THEORY: Leg length perception is primarily about where the "waist"
        // appears to be. The higher the perceived waist, the longer the legs
        // appear (since legs are everything below the waist). Also, showing
        // more leg = legs look longer.
        //
        // KEY PRINCIPLES:
        // 1. WAIST HEIGHT IS KEY - Empire waists raise the perceived waist to
        //    just below the bust, making everything below look like "leg."
        //    Drop waists or low-rise pants do the opposite - they shorten legs.
        //
        // 2. HIGH-WAISTED BOTTOMS - High-rise pants/skirts elongate legs by
        //    raising where the leg visually starts. This is why high-waisted
        //    jeans are universally elongating.
        //
        // 3. HEMLINE STRATEGY - Showing leg makes legs look longer. A mini skirt
        //    shows maximum leg. But AVOID cutting the leg at its widest point
        //    (usually the knee) - this shortens perceived length. Above knee or
        //    midi are better break points.
        //
        // 4. COLUMN OF COLOR - Same color from waist down (or even head to toe)
        //    creates one unbroken vertical line. Contrasting top/bottom visually
        //    divides the body and can shorten if the division is at the wrong spot.
        //
        // 5. VERTICAL LINES ON LEGS - Vertical stripes, seams, or pleats on
        //    pants/skirts elongate. Horizontal details shorten.
        //
        // 6. HEELS ARE THE CHEAT CODE - Heels literally add inches AND change
        //    leg line. This is the easiest external fix for this goal.
        //
        "elongate_legs": {
            // CALC: Sum of factor impacts for making legs appear longer
            //
            // HEMLINE IMPACT (elongate_legs):
            //   mini/above_knee: +0.3 (maximum leg exposure)
            //   at_knee: -0.2 (cuts at widest point)
            //   below_knee: -0.1
            //   midi: +0.1 (good break point)
            //   maxi: -0.1 (hides legs)
            //   high_low: +0.1 (shows some leg)
            //
            // WAISTLINE IMPACT (elongate_legs):
            //   waistline == "empire": +0.3 (raises waist, legs look longer)
            //   waistline == "natural" with defined: +0.2
            //   waistline == "drop" or "low": -0.3 (shortens leg proportion)
            //
            // SILHOUETTE IMPACT (elongate_legs):
            //   fit_and_flare: +0.2 (fitted waist, flare shows leg)
            //   column below waist: +0.1
            //   cocoon, tent: -0.2 (no leg definition)
            //
            // PATTERN IMPACT (elongate_legs):
            //   vertical stripes on bottom: +0.2
            //   horizontal at hemline: -0.2
            //
            // COLOR IMPACT (elongate_legs):
            //   same color top/bottom (column of color): +0.2
            //   contrasting top/bottom at wrong point: -0.2
            //
            // FOR PANTS/SKIRTS:
            //   high_rise: +0.2
            //   low_rise: -0.2
            //
            // FIX: "add_heels", "hem_shorter", "choose_high_waist"
            "verdict": null,
            "score": 0,
            "factors": [],
            "fix": null
        },

        // ==================== GOAL 9: CREATE CURVES ====================
        //
        // THEORY: This goal is about creating the illusion of an hourglass
        // silhouette when the body naturally has a straighter shape (rectangle
        // body type). It's the opposite of "streamline silhouette."
        //
        // KEY PRINCIPLES:
        // 1. DEFINE THE WAIST - The key to curves is waist definition. A belt,
        //    fitted waist, or waist seam creates the "in" of the hourglass.
        //    Without waist definition, there are no curves.
        //
        // 2. FIT-AND-FLARE IS IDEAL - Fitted through the waist, flaring at the
        //    skirt, this silhouette creates curves even on a straight body.
        //    The flare adds hip volume, the fit shows waist.
        //
        // 3. PEPLUMS ADD HIP CURVE - A peplum is literally a "fake" hip curve.
        //    The flare at the waist creates the illusion of a curvier hip.
        //
        // 4. WRAP DRESSES WORK - The diagonal wrap and tie creates curves through
        //    the crossing lines. The wrap inherently defines the waist.
        //
        // 5. CONSTRUCTION CREATES SHAPE - Princess seams, darts, and strategic
        //    seaming shape flat fabric into curves. Ruching creates visual
        //    undulation that reads as curves.
        //
        // 6. COLORBLOCK TRICK - Dark color at waist, lighter at bust and hips
        //    creates the visual impression of an hourglass even when the body
        //    is straight.
        //
        // 7. AVOID STRAIGHT SILHOUETTES - Shift dresses, column dresses, and
        //    cocoon shapes deliberately hide curves; they won't create them.
        //
        "create_curves": {
            // CALC: Sum of factor impacts for adding curves to straight figure
            //       Typically for rectangle/straight body shape
            //
            // SILHOUETTE IMPACT (create_curves):
            //   fit_and_flare: +0.4 (cinched waist, full skirt)
            //   peplum: +0.4 (adds hip curve)
            //   wrap: +0.3 (diagonal creates curves)
            //   bodycon: +0.2 (shows natural curves - if user has some)
            //   mermaid: +0.3 (dramatic curve at hips)
            //   a_line: +0.2
            //   shift, column: -0.3 (maintains straight line)
            //   cocoon, tent: -0.3 (hides body shape)
            //
            // WAIST IMPACT (create_curves):
            //   waist_definition == "defined": +0.4 (creates waist illusion)
            //   waist_definition == "undefined": -0.3
            //   waistline == "natural": +0.2
            //
            // CONSTRUCTION IMPACT (create_curves):
            //   has_ruching: +0.3 (creates visual curves)
            //   has_darts: +0.2 (shapes fabric to body)
            //   has_seaming (princess): +0.2 (creates hourglass)
            //
            // PATTERN IMPACT (create_curves):
            //   colorblock that creates hourglass: +0.3
            //   horizontal stripes at bust/hips, dark at waist: +0.2
            //
            // FIX: "add_belt", "add_peplum_layer"
            "verdict": null,
            "score": 0,
            "factors": [],
            "fix": null
        },

        // ==================== GOAL 10: STREAMLINE SILHOUETTE ====================
        //
        // THEORY: This is about creating a clean, unbroken visual line from
        // shoulder to hem. It's often preferred by those who want to minimize
        // overall volume, plus-size individuals who want to avoid visual "choppiness,"
        // or those with minimalist aesthetic preferences.
        //
        // KEY PRINCIPLES:
        // 1. ONE UNBROKEN LINE - The goal is for the eye to travel smoothly from
        //    top to bottom without interruption. Every horizontal element (seam,
        //    colorblock, peplum, tier) breaks this line.
        //
        // 2. COLUMN/SHEATH SILHOUETTES - These are literally designed to create
        //    a clean vertical rectangle. The fabric falls straight with minimal
        //    interruption.
        //
        // 3. SOLID COLORS ARE ESSENTIAL - Any pattern, especially colorblock or
        //    horizontal patterns, creates visual breaks. Monochromatic head-to-toe
        //    is the ultimate streamline.
        //
        // 4. SMOOTH FABRICS HELP - Textured fabrics add visual noise. Smooth,
        //    fluid fabrics create that clean "waterfall" effect down the body.
        //
        // 5. MINIMAL CONSTRUCTION - Ruching, gathering, tiering, peplums all
        //    add visual complexity. Simple construction = cleaner line.
        //
        // 6. THIS CAN CONFLICT WITH "CREATE CURVES" - These goals are somewhat
        //    opposite. Streamline wants simplicity; curves want definition.
        //    A user rarely wants both simultaneously.
        //
        // 7. FOR PLUS SIZE - Streamline often works better than emphasizing
        //    body zones. One clean line rather than calling out bust/waist/hips.
        //
        "streamline_silhouette": {
            // CALC: Sum of factor impacts for clean, unbroken line
            //       Often wanted by plus_size or for minimalist look
            //
            // SILHOUETTE IMPACT (streamline_silhouette):
            //   column, sheath: +0.4 (clean vertical line)
            //   shift: +0.3 (simple, unstructured)
            //   a_line (subtle): +0.2
            //   bodycon: +0.1 (clean line but may not be desired)
            //   fit_and_flare: -0.1 (break at waist)
            //   tiered: -0.3 (horizontal breaks)
            //   peplum: -0.2 (adds element)
            //   cocoon: -0.2 (adds bulk)
            //
            // PATTERN IMPACT (streamline_silhouette):
            //   solid: +0.3 (unbroken visual)
            //   vertical_stripes: +0.2
            //   horizontal_stripes: -0.2 (breaks line)
            //   colorblock: -0.2 (visual breaks)
            //   busy patterns: -0.1
            //
            // CONSTRUCTION IMPACT (streamline_silhouette):
            //   minimal seaming: +0.1
            //   has_ruching: -0.1 (adds visual complexity)
            //   has_gathering: -0.1
            //
            // COLOR IMPACT (streamline_silhouette):
            //   monochromatic: +0.2
            //   high contrast elements: -0.2
            //
            // FABRIC IMPACT (streamline_silhouette):
            //   fabric_drape == "fluid": +0.2 (smooth line)
            //   fabric_texture == "smooth": +0.1
            //   bulky fabrics: -0.1
            //
            // FIX: "choose_solid_color", "remove_accessories"
            "verdict": null,
            "score": 0,
            "factors": [],
            "fix": null
        },

        // ==================== GOAL 11: MINIMIZE BUST ====================
        //
        // THEORY: For those with a larger bust who want to de-emphasize it,
        // the goal is to avoid drawing attention to the chest area while still
        // looking polished and proportional.
        //
        // KEY PRINCIPLES:
        // 1. V-NECKS ARE COUNTERINTUITIVE - You'd think V-necks show more and
        //    therefore emphasize bust. But the vertical line of a V-neck actually
        //    draws the eye DOWN and INWARD, away from bust width. A moderate
        //    V-neck (not plunging) is one of the best options.
        //
        // 2. AVOID HORIZONTAL AT BUST - Boat necks, square necks, and strapless
        //    all create a horizontal line at bust level, emphasizing width.
        //
        // 3. SWEETHEART = MAXIMUM EMPHASIS - The sweetheart neckline literally
        //    traces the bust curve. It's designed to emphasize. Avoid.
        //
        // 4. FIT MATTERS GREATLY - Tight tops cling and emphasize every curve.
        //    Relaxed or semi-fitted tops give room without drowning. But too
        //    loose can add bulk.
        //
        // 5. STRUCTURED FABRICS - Fabrics that hold their shape create a "shell"
        //    effect, while clingy fabrics reveal exact bust size and shape.
        //
        // 6. DARK COLORS ON TOP - Same receding principle: dark colors at bust
        //    minimize; light colors or bright patterns draw the eye.
        //
        // 7. AVOID BUST EMBELLISHMENT - Ruching, ruffles, embroidery, or patterns
        //    concentrated at the bust all draw the eye there.
        //
        "minimize_bust": {
            // CALC: Sum of factor impacts for reducing bust emphasis
            //
            // NECKLINE IMPACT (minimize_bust):
            //   v_neck (moderate depth): +0.3 (vertical line draws eye down)
            //   scoop_neck: +0.2
            //   crew_neck: +0.1 (high, no emphasis)
            //   sweetheart: -0.4 (emphasizes bust curve)
            //   strapless: -0.3
            //   plunging: -0.2 (can work if structured)
            //   square_neck: -0.2 (horizontal at bust)
            //   boat_neck: -0.1 (draws eye across)
            //
            // NECKLINE DEPTH IMPACT:
            //   shallow/medium: +0.1 (less exposure)
            //   deep/plunging: -0.2 (more exposure)
            //
            // FIT IMPACT (minimize_bust):
            //   fit_category == "relaxed": +0.2 (more room)
            //   fit_category == "semi_fitted": +0.1
            //   fit_category == "fitted" or "tight": -0.3 (emphasizes)
            //
            // FABRIC IMPACT (minimize_bust):
            //   fabric_drape == "stiff" or "structured": +0.2 (holds shape)
            //   fabric_drape == "very_drapey": -0.3 (clings)
            //   fabric_drape == "fluid": +0.1 (skims)
            //   fabric_weight == "medium": +0.1 (supportive)
            //
            // CONSTRUCTION IMPACT (minimize_bust):
            //   has_ruching at bust: -0.2 (adds visual volume)
            //   has_gathering at bust: -0.2
            //   has_darts (well placed): +0.1
            //
            // PATTERN IMPACT (minimize_bust):
            //   busy pattern at bust: -0.1 (draws eye)
            //   dark color at bust: +0.1
            //   light color at bust: -0.1
            //
            // FIX: "choose_structured_fabric", "avoid_embellished_neckline"
            "verdict": null,
            "score": 0,
            "factors": [],
            "fix": null
        },

        // ==================== GOAL 12: SHOW LEGS ====================
        //
        // THEORY: Unlike "elongate legs" which is about PERCEPTION of length,
        // this goal is simply about LEG EXPOSURE. The user wants to show off
        // their legs, so we maximize visible leg while avoiding unflattering
        // positions.
        //
        // KEY PRINCIPLES:
        // 1. SHORTER = MORE LEG - This is straightforward. Mini skirts, shorts,
        //    and above-knee dresses show maximum leg. Maxi and floor-length
        //    hide legs entirely.
        //
        // 2. SLITS ARE A CLEVER SOLUTION - A maxi dress with a high slit gives
        //    leg flash without committing to short hemline. Good for formal
        //    occasions where mini is inappropriate but leg exposure is desired.
        //
        // 3. AVOID DANGER ZONES - Even when showing leg, WHERE the hemline falls
        //    matters. Cutting at the widest part of the calf or thigh draws
        //    attention to that width. Better to go above or below.
        //
        // 4. HIGH-LOW HEMLINES - These show leg in front while being longer in
        //    back. Good for those who want leg exposure but aren't confident
        //    about full-around short hemline.
        //
        // 5. FOR PANTS - Shorts and cropped pants show leg. Full-length pants
        //    obviously don't show leg. Wide-leg pants in particular can hide
        //    leg shape entirely.
        //
        // 6. MOVEMENT HELPS - Fit-and-flare and full skirts show leg with
        //    movement even if the static hemline is longer.
        //
        "show_legs": {
            // CALC: Sum of factor impacts for leg exposure/emphasis
            //
            // HEMLINE IMPACT (show_legs):
            //   mini: +0.5 (maximum exposure)
            //   above_knee: +0.4
            //   at_knee: +0.2
            //   below_knee: +0.1
            //   midi: -0.1 (partial coverage)
            //   maxi/floor_length: -0.4 (full coverage)
            //   high_low: +0.2 (shows leg in front)
            //
            // SLIT IMPACT (show_legs):
            //   has high slit (from description): +0.3
            //
            // HEMLINE DANGER ZONE (show_legs):
            //   hemline_hits_danger_zone (widest_calf): -0.3 (unflattering)
            //   hemline at good position: +0.1
            //
            // SILHOUETTE IMPACT (show_legs):
            //   fit_and_flare: +0.1 (shows leg with movement)
            //   column/sheath with slit: +0.2
            //   cocoon: -0.2 (wider shape detracts)
            //
            // FOR PANTS (if garment_type == pants):
            //   shorts: +0.4
            //   cropped pants: +0.2
            //   full length: -0.2
            //   wide_leg: -0.1
            //
            // FIX: "hem_shorter", "add_slit"
            "verdict": null,
            "score": 0,
            "factors": [],
            "fix": null
        }
    },

    // ========================================================================================
    // POTENTIAL FIXES
    // ========================================================================================

    // CALC: Aggregate fixes from goal_assessments where verdict != "yes"
    //       Prioritize by: (1) how many goals it helps, (2) difficulty
    //       Common fixes:
    //       - "add_belt": helps highlight_waist, sometimes look_taller
    //       - "hem_shorter": helps look_taller, show_legs
    //       - "hem_longer": helps minimize_hips (if hemline at bad position)
    //       - "layer_with_jacket": helps hide_upper_arms, balance_shoulders
    //       - "add_heels": helps look_taller (external fix)
    "fixes": [
        // { "action": "add_belt", "targets_goal": "highlight_waist", "difficulty": "easy", "description": "Add a belt to define the waist" },
        // { "action": "hem_shorter", "targets_goal": "look_taller", "difficulty": "medium", "description": "Hem 5cm shorter to hit above knee" }
    ],

    // ========================================================================================
    // OVERALL SCORES
    // ========================================================================================

    // CALC: Weighted average of goal scores
    //       overall_score = (sum of goal.score for each goal) / num_goals
    //       Normalize to 0-10 scale: ((overall_raw + 1) / 2) * 10
    //       Example: average score of 0.2 → ((0.2 + 1) / 2) * 10 = 6.0
    // 0-10 overall score
    "overall_score": null,

    // CALC: Based on goal verdicts:
    //       if all goals == "yes" → "yes"
    //       if any goal == "no" → "no"
    //       else → "almost"
    // <yes|almost|no>
    "overall_verdict": null,

    // CALC: Based on input confidence levels:
    //       min(garment.overall_confidence, text extraction confidence)
    //       Also reduce if key measurements are missing (model_height_inches == null)
    // <high|medium|low>
    "confidence": null,

    // ========================================================================================
    // REASONING (for Bedrock to expand into natural language)
    // ========================================================================================

    // CALC: Generate one reasoning point per:
    //       1. Each goal with verdict != "yes" (explain why + suggest fix)
    //       2. Each goal with verdict == "yes" (explain what's working)
    //       3. Any danger zone hits (hemline, sleeve)
    //       4. Any fabric cling warnings
    //
    //       Template: "[Attribute] [positive/negative verb] [goal] - [fix if applicable]"
    "reasoning_points": [
        // "A-line silhouette skims over hips without clinging",
        // "Undefined waist doesn't highlight your waist - consider adding a belt",
        // "Below-knee hemline breaks the leg line - for your height, midi or above-knee works better"
    ]
}

/**
 * Estimate how the garment affects the goal of "look_taller" for a user,
 * combining garment analysis and user profile.
 * Returns an object with { verdict, score, factors, fix }
 */
export function estimate_goal_look_taller({ garment, user }) {


    // ==================== GOAL 1: LOOK TALLER ====================
    //
    // THEORY: Height perception is an optical illusion created by vertical lines
    // and unbroken visual flow. The eye travels up and down along continuous lines,
    // making the body appear longer. Conversely, horizontal elements "cut" the body
    // into segments, making each segment (and thus the whole) appear shorter.
    //
    // KEY PRINCIPLES:
    // 1. VERTICAL LINES ELONGATE - V-necks, vertical stripes, column silhouettes
    //    all draw the eye up/down, adding perceived inches
    // 2. HORIZONTAL BREAKS SHORTEN - Each horizontal line (hemline, waistband,
    //    colorblock) divides the body into stacked rectangles, shortening perception
    // 3. STRATEGIC HEMLINES - Where a hemline falls matters: at the narrowest
    //    point of the leg (above knee or midi) elongates; at the widest (knee,
    //    widest calf) shortens by drawing attention to width
    // 4. WAIST PLACEMENT - Higher perceived waist = longer legs = taller appearance
    //    Empire waists raise the waist; drop waists shorten leg proportion
    // 5. MONOCHROMATIC DRESSING - Same color top-to-bottom creates one tall column
    //    vs. contrasting top/bottom which creates two shorter blocks
    //
    // "look_taller": {
    //     // CALC: Sum of factor impacts, then:
    //     //       score > 0.3 → "yes"
    //     //       score > -0.3 → "almost"
    //     //       score <= -0.3 → "no"
    //     // <yes|almost|no>
    //     "verdict": null,
    //     // CALC: Sum of all factor impacts (range -1.0 to +1.0)
    //     "score": 0,
    //     // CALC: Evaluate each attribute's impact on this goal:
    //     //
    //     // HEMLINE IMPACT (look_taller):
    //     //   above_knee: +0.3 (shows leg, elongates)
    //     //   on_knee: -0.2 (cuts leg at widest point)
    //     //   below_knee: -0.1 (breaks leg line slightly)
    //     //   midi: +0.1 (acceptable break point)
    //     //   maxi/floor: -0.2 (hides legs, can shorten)
    //     //
    //     // WAIST IMPACT (look_taller):
    //     //   waist_definition == "defined" && waistline == "natural": +0.2
    //     //   waist_definition == "undefined": -0.1
    //     //   waistline == "empire": +0.2 (raises perceived waist)
    //     //   waistline == "drop" or "low": -0.2
    //     //
    //     // PATTERN/COLOR CONTINUITY IMPACT (look_taller):
    //     //   pattern_type == "vertical_stripes": +0.2 (elongates)
    //     //   pattern_type == "colorblock" && pattern_direction == "vertical": +0.2
    //     //   pattern_type == "horizontal_stripes": -0.2 (breaks vertical line)
    //     //   pattern_type == "colorblock" && pattern_direction == "horizontal": -0.2
    //     //   pattern_type == "solid": +0.1 (maintains continuity)
    //     //   pattern_scale == "large" && user.height_category == "petite": -0.1
    //     //
    //     // SILHOUETTE IMPACT (look_taller):
    //     //   column, sheath: +0.2 (vertical line)
    //     //   a_line, fit_and_flare: +0.1
    //     //   cocoon, tent: -0.2 (adds width)
    //     //
    //     // NECKLINE IMPACT (look_taller):
    //     //   v_neck, plunging: +0.2 (creates vertical line)
    //     //   boat_neck: -0.1 (horizontal emphasis)
    //     //   crew_neck: 0
    //     //
    //     // FIX: if hemline_impact < 0 → "hem_shorter"/"hem_longer"
    //     //      if waist_impact < 0 → "add_belt"
    //     //      external: "add_heels"
    //     "factors": [],
    //     "fix": null
    // }


    // REQUIREMENTS:

    // garment_hemline_height: product image
    // user knees, ankle height from shoulder/waist : derived measurements

    // waistline : product image
    // waist_definition : product image

    // pattern_direction : product image
    // pattern_scale : product image
    // pattern_type : product image

    const factors = [];
    let score = 0;
    let fix = null;

    // --- HEMLINE IMPACT ---
    let hemlineImpact = 0;
    switch (garment.user_hemline_position) {
        case 'above_knee':
            hemlineImpact = 0.3; 
            factors.push({ type: 'hemline', effect: 'positive', note: 'above_knee elongates leg', value: hemlineImpact });
            break;
        case 'on_knee':
            hemlineImpact = -0.2;
            factors.push({ type: 'hemline', effect: 'negative', note: 'on_knee visually cuts at widest part', value: hemlineImpact });
            break;
        case 'below_knee':
            hemlineImpact = -0.1;
            factors.push({ type: 'hemline', effect: 'negative', note: 'below_knee breaks leg line slightly', value: hemlineImpact });
            break;
        case 'mid_calf':
            hemlineImpact = 0.1;
            factors.push({ type: 'hemline', effect: 'neutral', note: 'mid_calf is an acceptable break', value: hemlineImpact });
            break;
        case 'widest_calf':
            hemlineImpact = -0.2;
            factors.push({ type: 'hemline', effect: 'negative', note: 'widest_calf draws attention to width', value: hemlineImpact });
            break;
        case 'above_ankle':
        case 'on_ankle':
            hemlineImpact = -0.2;
            factors.push({ type: 'hemline', effect: 'negative', note: 'maxi/floor length hides legs', value: hemlineImpact });
            break;
        default:
            // do nothing for null/unknown
            break;
    }
    score += hemlineImpact;

    // --- WAIST IMPACT ---
    let waistImpact = 0;
    if (garment.waist_definition === "defined" && garment.waistline === "natural") {
        waistImpact = 0.2;
        factors.push({ type: "waist", effect: "positive", note: "defined waist at natural position", value: waistImpact });
    } else if (garment.waist_definition === "undefined") {
        waistImpact = -0.1;
        factors.push({ type: "waist", effect: "negative", note: "undefined waist", value: waistImpact });
    } else if (garment.waistline === "empire") {
        waistImpact = 0.2;
        factors.push({ type: "waist", effect: "positive", note: "empire waist raises perceived waist", value: waistImpact });
    } else if (garment.waistline === "drop" || garment.waistline === "low") {
        waistImpact = -0.2;
        factors.push({ type: "waist", effect: "negative", note: "drop/low waist shortens legs", value: waistImpact });
    }
    score += waistImpact;

    // --- PATTERN/COLOR CONTINUITY IMPACT ---
    let patternImpact = 0;

    // Vertical patterns elongate
    if (garment.pattern_type === "vertical_stripes" ||
        (garment.pattern_type === "colorblock" && garment.pattern_direction === "vertical")) {
        patternImpact = 0.2;
        factors.push({ type: "pattern", effect: "positive", note: "vertical pattern elongates", value: patternImpact });
    }
    // Horizontal patterns break the line
    else if (garment.pattern_type === "horizontal_stripes" ||
             (garment.pattern_type === "colorblock" && garment.pattern_direction === "horizontal")) {
        patternImpact = -0.2;
        factors.push({ type: "pattern", effect: "negative", note: "horizontal pattern breaks vertical line", value: patternImpact });
    }
    // Solid maintains continuity
    else if (garment.pattern_type === "solid") {
        patternImpact = 0.1;
        factors.push({ type: "pattern", effect: "positive", note: "solid color maintains continuity", value: patternImpact });
    }

    // petite large pattern penalty
    if (garment.pattern_scale === "large" && user.height_category === "petite") {
        patternImpact -= 0.1;
        factors.push({ type: "pattern", effect: "negative", note: "large scale pattern on petite user", value: -0.1 });
    }
    score += patternImpact;

    // --- SILHOUETTE IMPACT ---
    let silImpact = 0;
    if (["column", "sheath"].includes(garment.silhouette_type)) {
        silImpact = 0.2;
        factors.push({ type: "silhouette", effect: "positive", note: "column/sheath vertical line", value: silImpact });
    } else if (["a_line", "fit_and_flare"].includes(garment.silhouette_type)) {
        silImpact = 0.1;
        factors.push({ type: "silhouette", effect: "positive", note: "a_line or fit_and_flare slightly lengthens", value: silImpact });
    } else if (["cocoon", "tent"].includes(garment.silhouette_type)) {
        silImpact = -0.2;
        factors.push({ type: "silhouette", effect: "negative", note: "cocoon/tent adds width", value: silImpact });
    }
    score += silImpact;

    // --- NECKLINE IMPACT ---
    let necklineImpact = 0;
    if (["v_neck", "plunging"].includes(garment.neckline_type)) {
        necklineImpact = 0.2;
        factors.push({ type: "neckline", effect: "positive", note: "v/plunging neck elongates", value: necklineImpact });
    } else if (garment.neckline_type === "boat_neck") {
        necklineImpact = -0.1;
        factors.push({ type: "neckline", effect: "negative", note: "boat neck is horizontal", value: necklineImpact });
    }
    // crew_neck, others = 0
    score += necklineImpact;

    // --- Normalize score, limit to [-1, 1]
    if (score > 1) score = 1;
    if (score < -1) score = -1;

    // --- VERDICT ---
    let verdict = null;
    if (score > 0.3) verdict = "yes";
    else if (score > -0.3) verdict = "almost";
    else verdict = "no";

    // --- FIX SUGGESTION ---
    if (hemlineImpact < 0) {
        fix = 'hem_shorter';
    } else if (waistImpact < 0) {
        fix = 'add_belt';
    }

    // --- Return structure matching sample_output.goal_assessments.look_taller
    return {
        verdict,
        score,
        factors,
        fix
    };
}


/**
 * Estimate how the garment affects the goal of "look_slimmer" for a user.
 * Returns an object with { verdict, score, factors, fix }
 */
export function estimate_goal_look_slimmer({ garment, user }) {

    // ==================== GOAL 2: LOOK SLIMMER ====================
    //
    // THEORY: Slimming is about visual weight reduction through optical illusions.
    // Dark colors recede while light colors advance; structured fabrics hold away
    // from the body while clingy fabrics reveal every contour; vertical lines
    // elongate while horizontal lines widen.
    //
    // KEY PRINCIPLES:
    // 1. DARK COLORS RECEDE - Black and dark colors absorb light, making areas
    //    appear smaller. Light colors reflect light, making areas appear larger.
    // 2. VERTICAL > HORIZONTAL - Same elongation principle as "look taller"
    //    but applied specifically to width perception
    // 3. STRUCTURED FABRICS SKIM - Fabrics that hold their shape create a "shell"
    //    that doesn't cling to body contours. Clingy fabrics reveal every curve.
    // 4. STRATEGIC FIT - Slightly fitted clothes can look slimmer than oversized
    //    because oversized adds bulk. The key is "skimming" not "clinging"
    // 5. MONOCHROMATIC COLUMNAR DRESSING - One color head-to-toe creates a single
    //    vertical shape rather than segmented blocks
    // 6. DIAGONAL LINES - Wrap dresses work because diagonal lines elongate
    // 
    // "look_slimmer": {
    //     // CALC: Sum of factor impacts for overall slimming effect
    //     //
    //     // SILHOUETTE IMPACT (look_slimmer):
    //     //   sheath, column: +0.3 (straight vertical line)
    //     //   a_line: +0.2 (skims body)
    //     //   fit_and_flare: +0.2 (fitted top, full skirt balances)
    //     //   wrap: +0.3 (diagonal line, defined waist)
    //     //   bodycon: -0.3 (shows every curve - only positive if user wants that)
    //     //   cocoon, tent: -0.2 (adds bulk)
    //     //   empire: +0.1 (draws eye up)
    //     //
    //     // COLOR IMPACT (look_slimmer):
    //     //   color_value == "dark" or "very_dark": +0.2
    //     //   color_value == "light" or "very_light": -0.1
    //     //   solid/monochromatic: +0.1
    //     //
    //     // PATTERN IMPACT (look_slimmer):
    //     //   pattern_direction == "vertical": +0.2
    //     //   pattern_direction == "horizontal": -0.2
    //     //   pattern_scale == "small": +0.1
    //     //   pattern_scale == "large": -0.1
    //     //   pattern_contrast == "high": -0.1 (draws eye)
    //     //
    //     // FABRIC IMPACT (look_slimmer):
    //     //   fabric_drape == "stiff" or "structured": +0.2 (holds shape)
    //     //   fabric_drape == "very_drapey": -0.3 (clings)
    //     //   fabric_drape == "fluid": +0.1 (skims)
    //     //   fabric_weight == "heavy" (in wrong fabric): -0.1
    //     //
    //     // CONSTRUCTION IMPACT (look_slimmer):
    //     //   has_seaming (vertical): +0.2
    //     //   has_darts: +0.1 (creates shape)
    //     //
    //     // NECKLINE IMPACT (look_slimmer):
    //     //   v_neck, plunging: +0.2 (vertical emphasis)
    //     //   scoop_neck: +0.1
    //     //   boat_neck, wide necklines: -0.1
    //     //
    //     // FIX: "add_structured_layer", "choose_darker_color"
    //     "verdict": null,
    //     "score": 0,
    //     "factors": [],
    //     "fix": null
    // }

    const factors = [];
    let score = 0;
    let fix = null;

    // --- SILHOUETTE IMPACT ---
    let silImpact = 0;
    if (["sheath", "column"].includes(garment.silhouette_type)) {
        silImpact = 0.3;
        factors.push({ type: "silhouette", effect: "positive", note: "sheath/column creates vertical line", value: silImpact });
    } else if (["wrap"].includes(garment.silhouette_type)) {
        silImpact = 0.3;
        factors.push({ type: "silhouette", effect: "positive", note: "wrap creates diagonal slimming line", value: silImpact });
    } else if (["a_line", "fit_and_flare"].includes(garment.silhouette_type)) {
        silImpact = 0.2;
        factors.push({ type: "silhouette", effect: "positive", note: "a_line/fit_and_flare skims body", value: silImpact });
    } else if (["empire"].includes(garment.silhouette_type)) {
        silImpact = 0.1;
        factors.push({ type: "silhouette", effect: "positive", note: "empire draws eye up", value: silImpact });
    } else if (["bodycon"].includes(garment.silhouette_type)) {
        silImpact = -0.3;
        factors.push({ type: "silhouette", effect: "negative", note: "bodycon shows every curve", value: silImpact });
    } else if (["cocoon", "tent"].includes(garment.silhouette_type)) {
        silImpact = -0.2;
        factors.push({ type: "silhouette", effect: "negative", note: "cocoon/tent adds bulk", value: silImpact });
    }
    score += silImpact;

    // --- COLOR IMPACT ---
    let colorImpact = 0;
    if (["dark", "very_dark"].includes(garment.color_value)) {
        colorImpact = 0.2;
        factors.push({ type: "color", effect: "positive", note: "dark color recedes visually", value: colorImpact });
    } else if (["light", "very_light"].includes(garment.color_value)) {
        colorImpact = -0.1;
        factors.push({ type: "color", effect: "negative", note: "light color advances visually", value: colorImpact });
    }
    // solid pattern bonus
    if (garment.pattern_type === "solid") {
        colorImpact += 0.1;
        factors.push({ type: "color", effect: "positive", note: "solid color creates unbroken line", value: 0.1 });
    }
    score += colorImpact;

    // --- PATTERN IMPACT ---
    let patternImpact = 0;
    if (garment.pattern_direction === "vertical") {
        patternImpact = 0.2;
        factors.push({ type: "pattern", effect: "positive", note: "vertical pattern elongates", value: patternImpact });
    } else if (garment.pattern_direction === "horizontal") {
        patternImpact = -0.2;
        factors.push({ type: "pattern", effect: "negative", note: "horizontal pattern widens", value: patternImpact });
    }
    if (garment.pattern_scale === "small") {
        patternImpact += 0.1;
        factors.push({ type: "pattern", effect: "positive", note: "small scale pattern is slimming", value: 0.1 });
    } else if (garment.pattern_scale === "large") {
        patternImpact -= 0.1;
        factors.push({ type: "pattern", effect: "negative", note: "large scale pattern adds visual weight", value: -0.1 });
    }
    if (garment.pattern_contrast === "high") {
        patternImpact -= 0.1;
        factors.push({ type: "pattern", effect: "negative", note: "high contrast draws eye", value: -0.1 });
    }
    score += patternImpact;

    // --- FABRIC IMPACT ---
    let fabricImpact = 0;
    if (garment.fabric_drape === "stiff" || garment.fabric_drape === "structured") {
        fabricImpact = 0.2;
        factors.push({ type: "fabric", effect: "positive", note: "structured fabric holds away from body", value: fabricImpact });
    } else if (garment.fabric_drape === "very_drapey") {
        fabricImpact = -0.3;
        factors.push({ type: "fabric", effect: "negative", note: "very drapey fabric clings and shows curves", value: fabricImpact });
    } else if (garment.fabric_drape === "fluid") {
        fabricImpact = 0.1;
        factors.push({ type: "fabric", effect: "positive", note: "fluid drape skims body", value: fabricImpact });
    }
    score += fabricImpact;

    // --- CONSTRUCTION IMPACT ---
    let constructionImpact = 0;
    if (garment.has_seaming === true) {
        constructionImpact += 0.2;
        factors.push({ type: "construction", effect: "positive", note: "vertical seaming elongates", value: 0.2 });
    }
    if (garment.has_darts === true) {
        constructionImpact += 0.1;
        factors.push({ type: "construction", effect: "positive", note: "darts create shape", value: 0.1 });
    }
    score += constructionImpact;

    // --- NECKLINE IMPACT ---
    let necklineImpact = 0;
    if (["v_neck", "plunging"].includes(garment.neckline_type)) {
        necklineImpact = 0.2;
        factors.push({ type: "neckline", effect: "positive", note: "v-neck creates vertical emphasis", value: necklineImpact });
    } else if (garment.neckline_type === "scoop_neck") {
        necklineImpact = 0.1;
        factors.push({ type: "neckline", effect: "positive", note: "scoop neck is flattering", value: necklineImpact });
    } else if (["boat_neck", "off_shoulder"].includes(garment.neckline_type)) {
        necklineImpact = -0.1;
        factors.push({ type: "neckline", effect: "negative", note: "wide neckline adds horizontal", value: necklineImpact });
    }
    score += necklineImpact;

    // --- Normalize score ---
    if (score > 1) score = 1;
    if (score < -1) score = -1;

    // --- VERDICT ---
    let verdict = null;
    if (score > 0.3) verdict = "yes";
    else if (score > -0.3) verdict = "almost";
    else verdict = "no";

    // --- FIX SUGGESTION ---
    if (fabricImpact < 0) {
        fix = "add_structured_layer";
    } else if (colorImpact < 0) {
        fix = "choose_darker_color";
    }

    return { verdict, score, factors, fix };
}


/**
 * Estimate how the garment affects the goal of "highlight_waist" for a user.
 * Returns an object with { verdict, score, factors, fix }
 */
export function estimate_goal_highlight_waist({ garment, user }) {

    // ==================== GOAL 3: HIGHLIGHT WAIST ====================
    //
    // THEORY: The waist is the narrowest part of the torso and defining it
    // creates the classic "hourglass" proportion. This is about creating
    // visual contrast between the waist and bust/hips.
    //
    // KEY PRINCIPLES:
    // 1. FIT AT THE WAIST - The garment must follow the body's curve at natural waist
    // 2. WAIST ALIGNMENT MATTERS - Garment's waist seam should hit at natural waist
    // 3. CONSTRUCTION HELPS - Darts, princess seams, ruching shape fabric to body
    // 4. SILHOUETTE AMPLIFIES - Fit-and-flare and wrap emphasize waist by design
    // 5. BELTS ARE THE EASIEST FIX - Even shapeless dress can highlight waist with belt
    // "highlight_waist": {
    //         // CALC: Sum of factor impacts for waist highlighting:
    //         //
    //         // WAIST DEFINITION IMPACT:
    //         //   waist_definition == "defined": +0.4
    //         //   waist_definition == "semi_defined": +0.1
    //         //   waist_definition == "undefined": -0.4
    //         //
    //         // WAIST ALIGNMENT IMPACT:
    //         //   waist_aligned == true: +0.2
    //         //   waist_alignment == "above_natural" (empire): -0.1
    //         //   waist_alignment == "below_natural" (drop): -0.2
    //         //
    //         // SILHOUETTE IMPACT (highlight_waist):
    //         //   fit_and_flare, wrap: +0.3 (natural waist emphasis)
    //         //   bodycon: +0.2 (shows waist curve)
    //         //   sheath with defined waist: +0.2
    //         //   shift, cocoon, tent: -0.3 (hides waist)
    //         //   a_line with undefined waist: -0.1
    //         //
    //         // CONSTRUCTION IMPACT (highlight_waist):
    //         //   has_darts == true: +0.1
    //         //   has_seaming (princess seams): +0.1
    //         //   has_ruching at waist: +0.2
    //         //
    //         // FIT IMPACT (highlight_waist):
    //         //   fit_category == "fitted" or "semi_fitted": +0.2
    //         //   fit_category == "loose" or "oversized": -0.3
    //         //
    //         // FIX: "add_belt" (easy fix for most silhouettes)
    //         "verdict": null,
    //         "score": 0,
    //         "factors": [],
    //         "fix": null
    //     },

    const factors = [];
    let score = 0;
    let fix = null;

    // --- WAIST DEFINITION IMPACT ---
    let waistDefImpact = 0;
    if (garment.waist_definition === "defined") {
        waistDefImpact = 0.4;
        factors.push({ type: "waist_definition", effect: "positive", note: "defined waist highlights narrowest point", value: waistDefImpact });
    } else if (garment.waist_definition === "semi_defined") {
        waistDefImpact = 0.1;
        factors.push({ type: "waist_definition", effect: "neutral", note: "semi-defined waist provides some emphasis", value: waistDefImpact });
    } else if (garment.waist_definition === "undefined") {
        waistDefImpact = -0.4;
        factors.push({ type: "waist_definition", effect: "negative", note: "undefined waist hides waistline", value: waistDefImpact });
    }
    score += waistDefImpact;

    // --- WAIST ALIGNMENT IMPACT ---
    let waistAlignImpact = 0;
    if (garment.waist_aligned === true) {
        waistAlignImpact = 0.2;
        factors.push({ type: "waist_alignment", effect: "positive", note: "waist hits at natural position", value: waistAlignImpact });
    } else if (garment.waist_alignment === "above_natural") {
        waistAlignImpact = -0.1;
        factors.push({ type: "waist_alignment", effect: "negative", note: "empire waist above natural waist", value: waistAlignImpact });
    } else if (garment.waist_alignment === "below_natural") {
        waistAlignImpact = -0.2;
        factors.push({ type: "waist_alignment", effect: "negative", note: "drop waist below natural waist", value: waistAlignImpact });
    }
    score += waistAlignImpact;

    // --- SILHOUETTE IMPACT ---
    let silImpact = 0;
    if (["fit_and_flare", "wrap"].includes(garment.silhouette_type)) {
        silImpact = 0.3;
        factors.push({ type: "silhouette", effect: "positive", note: "fit_and_flare/wrap naturally emphasizes waist", value: silImpact });
    } else if (garment.silhouette_type === "bodycon") {
        silImpact = 0.2;
        factors.push({ type: "silhouette", effect: "positive", note: "bodycon shows waist curve", value: silImpact });
    } else if (garment.silhouette_type === "sheath" && garment.waist_definition === "defined") {
        silImpact = 0.2;
        factors.push({ type: "silhouette", effect: "positive", note: "sheath with defined waist", value: silImpact });
    } else if (["shift", "cocoon", "tent"].includes(garment.silhouette_type)) {
        silImpact = -0.3;
        factors.push({ type: "silhouette", effect: "negative", note: "shift/cocoon/tent hides waist", value: silImpact });
    } else if (garment.silhouette_type === "a_line" && garment.waist_definition === "undefined") {
        silImpact = -0.1;
        factors.push({ type: "silhouette", effect: "negative", note: "a_line with undefined waist doesn't emphasize", value: silImpact });
    }
    score += silImpact;

    // --- CONSTRUCTION IMPACT ---
    let constructionImpact = 0;
    if (garment.has_darts === true) {
        constructionImpact += 0.1;
        factors.push({ type: "construction", effect: "positive", note: "darts shape to body", value: 0.1 });
    }
    if (garment.has_seaming === true) {
        constructionImpact += 0.1;
        factors.push({ type: "construction", effect: "positive", note: "princess seams create hourglass", value: 0.1 });
    }
    if (garment.has_ruching === true) {
        constructionImpact += 0.2;
        factors.push({ type: "construction", effect: "positive", note: "ruching at waist emphasizes narrowness", value: 0.2 });
    }
    score += constructionImpact;

    // --- FIT IMPACT ---
    let fitImpact = 0;
    if (["fitted", "semi_fitted"].includes(garment.fit_category)) {
        fitImpact = 0.2;
        factors.push({ type: "fit", effect: "positive", note: "fitted/semi_fitted shows waist", value: fitImpact });
    } else if (["loose", "oversized"].includes(garment.fit_category)) {
        fitImpact = -0.3;
        factors.push({ type: "fit", effect: "negative", note: "loose/oversized hides waist", value: fitImpact });
    }
    score += fitImpact;

    // --- Normalize score ---
    if (score > 1) score = 1;
    if (score < -1) score = -1;

    // --- VERDICT ---
    let verdict = null;
    if (score > 0.3) verdict = "yes";
    else if (score > -0.3) verdict = "almost";
    else verdict = "no";

    // --- FIX SUGGESTION ---
    if (waistDefImpact < 0 || silImpact < 0) {
        fix = "add_belt";
    }

    return { verdict, score, factors, fix };
}


/**
 * Estimate how the garment affects the goal of "hide_midsection" for a user.
 * Returns an object with { verdict, score, factors, fix }
 */
export function estimate_goal_hide_midsection({ garment, user }) {

    // ==================== GOAL 4: HIDE MIDSECTION ====================
    //
    // THEORY: The midsection (stomach/tummy area) is a common concern. The goal
    // is to prevent fabric from clinging to or outlining this area, while not
    // adding bulk or drawing attention to it.
    //
    // KEY PRINCIPLES:
    // 1. FABRIC MUST NOT TOUCH - Create "air space" between fabric and body
    // 2. EMPIRE WAIST IS IDEAL - Fits under bust, falls free over midsection
    // 3. RUCHING IS CAMOUFLAGE - Strategic gathering disguises body contours
    // 4. DARK COLORS RECEDE - Dark at midsection minimizes visual attention
    // 5. PATTERN DISTRACTS - Busy patterns give eye something else to look at
    // 6. PEPLUMS WORK - Flare covers stomach while defining waist above
    // "hide_midsection": {
    //         // CALC: Sum of factor impacts for concealing midsection
    //         //
    //         // SILHOUETTE IMPACT (hide_midsection):
    //         //   empire: +0.4 (fabric falls from under bust, skims stomach)
    //         //   a_line: +0.3 (flows over midsection)
    //         //   shift: +0.2 (straight, no waist emphasis)
    //         //   wrap: +0.1 (strategic draping can conceal)
    //         //   bodycon: -0.5 (shows everything)
    //         //   peplum: +0.2 (flare covers stomach)
    //         //   fit_and_flare: +0.2 (if fitted above waist only)
    //         //
    //         // FIT IMPACT (hide_midsection):
    //         //   fit_category == "relaxed" or "loose": +0.3
    //         //   fit_category == "semi_fitted": +0.1
    //         //   fit_category == "fitted" or "tight": -0.3
    //         //
    //         // FABRIC IMPACT (hide_midsection):
    //         //   fabric_drape == "stiff" or "structured": +0.2 (holds away from body)
    //         //   fabric_drape == "very_drapey": -0.4 (clings, shows midsection)
    //         //   fabric_drape == "fluid": +0.1 (skims)
    //         //   fabric_weight == "medium" or "heavy": +0.1 (doesn't cling)
    //         //
    //         // CONSTRUCTION IMPACT (hide_midsection):
    //         //   has_ruching: +0.3 (strategic gathering conceals)
    //         //   has_draping: +0.2 (folds disguise)
    //         //   has_gathering at waist: +0.2
    //         //
    //         // PATTERN IMPACT (hide_midsection):
    //         //   pattern_type != "solid" at midsection: +0.1 (distracts eye)
    //         //   horizontal stripes at midsection: -0.2
    //         //
    //         // COLOR IMPACT (hide_midsection):
    //         //   dark color at midsection: +0.1
    //         //   light color at midsection: -0.1
    //         //
    //         // FIX: "add_ruched_overlay", "choose_empire_waist"
    //         "verdict": null,
    //         "score": 0,
    //         "factors": [],
    //         "fix": null
    //     },

    const factors = [];
    let score = 0;
    let fix = null;

    // --- SILHOUETTE IMPACT ---
    let silImpact = 0;
    if (garment.silhouette_type === "empire") {
        silImpact = 0.4;
        factors.push({ type: "silhouette", effect: "positive", note: "empire falls from under bust, skims stomach", value: silImpact });
    } else if (garment.silhouette_type === "a_line") {
        silImpact = 0.3;
        factors.push({ type: "silhouette", effect: "positive", note: "a_line flows over midsection", value: silImpact });
    } else if (garment.silhouette_type === "shift") {
        silImpact = 0.2;
        factors.push({ type: "silhouette", effect: "positive", note: "shift straight line doesn't cling", value: silImpact });
    } else if (garment.silhouette_type === "peplum") {
        silImpact = 0.2;
        factors.push({ type: "silhouette", effect: "positive", note: "peplum flare covers stomach", value: silImpact });
    } else if (["fit_and_flare", "wrap"].includes(garment.silhouette_type)) {
        silImpact = 0.2;
        factors.push({ type: "silhouette", effect: "positive", note: "fitted above waist, flows below", value: silImpact });
    } else if (garment.silhouette_type === "bodycon") {
        silImpact = -0.5;
        factors.push({ type: "silhouette", effect: "negative", note: "bodycon shows every contour", value: silImpact });
    }
    score += silImpact;

    // --- FIT IMPACT ---
    let fitImpact = 0;
    if (["relaxed", "loose"].includes(garment.fit_category)) {
        fitImpact = 0.3;
        factors.push({ type: "fit", effect: "positive", note: "relaxed/loose doesn't cling to midsection", value: fitImpact });
    } else if (garment.fit_category === "semi_fitted") {
        fitImpact = 0.1;
        factors.push({ type: "fit", effect: "neutral", note: "semi_fitted provides some room", value: fitImpact });
    } else if (["fitted", "tight"].includes(garment.fit_category)) {
        fitImpact = -0.3;
        factors.push({ type: "fit", effect: "negative", note: "fitted/tight clings to midsection", value: fitImpact });
    }
    score += fitImpact;

    // --- FABRIC IMPACT ---
    let fabricImpact = 0;
    if (garment.fabric_drape === "stiff" || garment.fabric_drape === "structured") {
        fabricImpact = 0.2;
        factors.push({ type: "fabric", effect: "positive", note: "structured fabric holds away from body", value: fabricImpact });
    } else if (garment.fabric_drape === "very_drapey") {
        fabricImpact = -0.4;
        factors.push({ type: "fabric", effect: "negative", note: "very drapey fabric clings and shows midsection", value: fabricImpact });
    } else if (garment.fabric_drape === "fluid") {
        fabricImpact = 0.1;
        factors.push({ type: "fabric", effect: "positive", note: "fluid fabric skims over curves", value: fabricImpact });
    }
    if (["medium", "heavy"].includes(garment.fabric_weight)) {
        fabricImpact += 0.1;
        factors.push({ type: "fabric", effect: "positive", note: "medium/heavy weight doesn't cling", value: 0.1 });
    }
    score += fabricImpact;

    // --- CONSTRUCTION IMPACT ---
    let constructionImpact = 0;
    if (garment.has_ruching === true) {
        constructionImpact += 0.3;
        factors.push({ type: "construction", effect: "positive", note: "ruching conceals with strategic gathering", value: 0.3 });
    }
    if (garment.has_draping === true) {
        constructionImpact += 0.2;
        factors.push({ type: "construction", effect: "positive", note: "draping folds disguise contours", value: 0.2 });
    }
    if (garment.has_gathering === true) {
        constructionImpact += 0.2;
        factors.push({ type: "construction", effect: "positive", note: "gathering at waist conceals", value: 0.2 });
    }
    score += constructionImpact;

    // --- PATTERN IMPACT ---
    let patternImpact = 0;
    if (garment.pattern_type !== "solid" && garment.pattern_type !== "horizontal_stripes") {
        patternImpact = 0.1;
        factors.push({ type: "pattern", effect: "positive", note: "pattern distracts eye from body shape", value: patternImpact });
    } else if (garment.pattern_type === "horizontal_stripes") {
        patternImpact = -0.2;
        factors.push({ type: "pattern", effect: "negative", note: "horizontal stripes widen midsection", value: patternImpact });
    }
    score += patternImpact;

    // --- COLOR IMPACT ---
    let colorImpact = 0;
    if (["dark", "very_dark"].includes(garment.color_value)) {
        colorImpact = 0.1;
        factors.push({ type: "color", effect: "positive", note: "dark color minimizes midsection", value: colorImpact });
    } else if (["light", "very_light"].includes(garment.color_value)) {
        colorImpact = -0.1;
        factors.push({ type: "color", effect: "negative", note: "light color draws attention", value: colorImpact });
    }
    score += colorImpact;

    // --- Normalize score ---
    if (score > 1) score = 1;
    if (score < -1) score = -1;

    // --- VERDICT ---
    let verdict = null;
    if (score > 0.3) verdict = "yes";
    else if (score > -0.3) verdict = "almost";
    else verdict = "no";

    // --- FIX SUGGESTION ---
    if (silImpact < 0) {
        fix = "choose_empire_waist";
    } else if (constructionImpact === 0) {
        fix = "add_ruched_overlay";
    }

    return { verdict, score, factors, fix };
}


/**
 * Estimate how the garment affects the goal of "minimize_hips" for a user.
 * Returns an object with { verdict, score, factors, fix }
 */
export function estimate_goal_minimize_hips({ garment, user }) {

    // ==================== GOAL 5: MINIMIZE HIPS ====================
    //
    // THEORY: Hip minimization uses two strategies: (1) avoid drawing attention
    // to hip area, and (2) balance hips by adding visual weight to shoulders.
    //
    // KEY PRINCIPLES:
    // 1. SKIM, DON'T CLING - Fabric that flows over hips without adhering
    // 2. BALANCE WITH SHOULDERS - Add visual weight to shoulders to balance
    // 3. DARK COLORS ON BOTTOM - Dark colors recede, lighter top draws eye up
    // 4. AVOID HIP DETAILS - No pockets, embellishments, or patterns at hips
    // 5. HEMLINE PLACEMENT - Avoid hemline at widest part of hip/thigh
    // 6. PEPLUMS ARE BAD - Unlike midsection, peplums ADD volume at hips
    // "minimize_hips": {
    //         // CALC: Sum of factor impacts for hip minimization:
    //         //
    //         // SILHOUETTE IMPACT (minimize_hips):
    //         //   a_line: +0.4 (skims over hips)
    //         //   fit_and_flare: +0.3
    //         //   shift, column: +0.2 (straight line)
    //         //   bodycon: -0.4 (highlights everything)
    //         //   peplum: -0.3 (adds volume at hips)
    //         //   mermaid: -0.2 (fitted through hips)
    //         //
    //         // FABRIC DRAPE IMPACT (minimize_hips):
    //         //   fabric_drape == "stiff", "structured", or "fluid": +0.2 (skims hips)
    //         //   fabric_drape == "very_drapey": -0.3 (clings, emphasizes hips)
    //         //
    //         // FIT IMPACT (minimize_hips):
    //         //   fit_category == "relaxed" or "loose": +0.2
    //         //   fit_category == "fitted" or "tight": -0.2
    //         //
    //         // HEMLINE IMPACT (minimize_hips):
    //         //   hemline below widest hip: +0.1 (covers)
    //         //   hemline at widest hip: -0.2 (draws eye)
    //         //
    //         // PATTERN IMPACT (minimize_hips):
    //         //   pattern at hips + high_contrast: -0.2
    //         //   solid or pattern_scale == "small": +0.1
    //         //   dark color_value at hips: +0.1
    //         //
    //         // NECKLINE IMPACT (minimize_hips):
    //         //   wide neckline (boat_neck, off_shoulder): +0.2 (balances hips)
    //         //   narrow neckline: -0.1 (emphasizes bottom-heavy)
    //         //
    //         // FIX: "add_shoulder_detail", "choose_dark_bottom"
    //         "verdict": null,
    //         "score": 0,
    //         "factors": [],
    //         "fix": null
    //     },

    const factors = [];
    let score = 0;
    let fix = null;

    // --- SILHOUETTE IMPACT ---
    let silImpact = 0;
    if (garment.silhouette_type === "a_line") {
        silImpact = 0.4;
        factors.push({ type: "silhouette", effect: "positive", note: "a_line skims over hips smoothly", value: silImpact });
    } else if (garment.silhouette_type === "fit_and_flare") {
        silImpact = 0.3;
        factors.push({ type: "silhouette", effect: "positive", note: "fit_and_flare flows over hips", value: silImpact });
    } else if (["shift", "column"].includes(garment.silhouette_type)) {
        silImpact = 0.2;
        factors.push({ type: "silhouette", effect: "positive", note: "shift/column straight line", value: silImpact });
    } else if (garment.silhouette_type === "bodycon") {
        silImpact = -0.4;
        factors.push({ type: "silhouette", effect: "negative", note: "bodycon highlights everything", value: silImpact });
    } else if (garment.silhouette_type === "peplum") {
        silImpact = -0.3;
        factors.push({ type: "silhouette", effect: "negative", note: "peplum adds volume at hips", value: silImpact });
    } else if (garment.silhouette_type === "mermaid") {
        silImpact = -0.2;
        factors.push({ type: "silhouette", effect: "negative", note: "mermaid fitted through hips", value: silImpact });
    }
    score += silImpact;

    // --- FABRIC DRAPE IMPACT ---
    let fabricImpact = 0;
    if (["stiff", "structured", "fluid"].includes(garment.fabric_drape)) {
        fabricImpact = 0.2;
        factors.push({ type: "fabric", effect: "positive", note: "structured/fluid fabric skims hips", value: fabricImpact });
    } else if (garment.fabric_drape === "very_drapey") {
        fabricImpact = -0.3;
        factors.push({ type: "fabric", effect: "negative", note: "very drapey fabric clings and emphasizes hips", value: fabricImpact });
    }
    score += fabricImpact;

    // --- FIT IMPACT ---
    let fitImpact = 0;
    if (["relaxed", "loose"].includes(garment.fit_category)) {
        fitImpact = 0.2;
        factors.push({ type: "fit", effect: "positive", note: "relaxed/loose doesn't cling to hips", value: fitImpact });
    } else if (["fitted", "tight"].includes(garment.fit_category)) {
        fitImpact = -0.2;
        factors.push({ type: "fit", effect: "negative", note: "fitted/tight emphasizes hips", value: fitImpact });
    }
    score += fitImpact;

    // --- HEMLINE IMPACT ---
    let hemlineImpact = 0;
    if (garment.hemline_hits_danger_zone && garment.hemline_danger_zone_type === "mid_thigh") {
        hemlineImpact = -0.2;
        factors.push({ type: "hemline", effect: "negative", note: "hemline at widest hip/thigh draws eye", value: hemlineImpact });
    } else if (!garment.hemline_hits_danger_zone) {
        hemlineImpact = 0.1;
        factors.push({ type: "hemline", effect: "positive", note: "hemline avoids widest point", value: hemlineImpact });
    }
    score += hemlineImpact;

    // --- PATTERN IMPACT ---
    let patternImpact = 0;
    if (garment.pattern_contrast === "high" && garment.pattern_type !== "solid") {
        patternImpact = -0.2;
        factors.push({ type: "pattern", effect: "negative", note: "high contrast pattern at hips draws eye", value: patternImpact });
    } else if (garment.pattern_type === "solid" || garment.pattern_scale === "small") {
        patternImpact = 0.1;
        factors.push({ type: "pattern", effect: "positive", note: "solid/small pattern minimizes attention", value: patternImpact });
    }
    if (["dark", "very_dark"].includes(garment.color_value)) {
        patternImpact += 0.1;
        factors.push({ type: "color", effect: "positive", note: "dark color at hips recedes", value: 0.1 });
    }
    score += patternImpact;

    // --- NECKLINE IMPACT (for balancing) ---
    let necklineImpact = 0;
    if (["boat_neck", "off_shoulder"].includes(garment.neckline_type)) {
        necklineImpact = 0.2;
        factors.push({ type: "neckline", effect: "positive", note: "wide neckline balances hips", value: necklineImpact });
    } else if (["v_neck", "halter"].includes(garment.neckline_type) && garment.neckline_width === "narrow") {
        necklineImpact = -0.1;
        factors.push({ type: "neckline", effect: "negative", note: "narrow neckline emphasizes bottom-heavy", value: necklineImpact });
    }
    score += necklineImpact;

    // --- Normalize score ---
    if (score > 1) score = 1;
    if (score < -1) score = -1;

    // --- VERDICT ---
    let verdict = null;
    if (score > 0.3) verdict = "yes";
    else if (score > -0.3) verdict = "almost";
    else verdict = "no";

    // --- FIX SUGGESTION ---
    if (necklineImpact <= 0) {
        fix = "add_shoulder_detail";
    } else if (patternImpact < 0) {
        fix = "choose_dark_bottom";
    }

    return { verdict, score, factors, fix };
}


/**
 * Estimate how the garment affects the goal of "balance_shoulders" for a user.
 * Returns an object with { verdict, score, factors, fix }
 */
export function estimate_goal_balance_shoulders({ garment, user }) {

    // ==================== GOAL 6: BALANCE SHOULDERS ====================
    //
    // THEORY: Shoulder balance is about proportion relative to hips. The ideal
    // "balanced" look has shoulders roughly equal to hip width.
    //
    // KEY PRINCIPLES:
    // 1. THIS IS CONTEXTUAL - Requires knowing if user has broad or narrow shoulders
    // 2. FOR BROAD SHOULDERS (ratio > 1.05):
    //    - V-necks/halters draw eye inward, raglan softens shoulder line
    //    - Avoid boat necks, off-shoulder, puff sleeves - all add width
    // 3. FOR NARROW SHOULDERS (ratio < 0.95):
    //    - Boat necks/off-shoulder extend visual shoulder line
    //    - Puff sleeves, cap sleeves add volume at shoulder
    // 4. HORIZONTAL AT SHOULDERS WIDENS
    // 5. SLEEVE SEAM PLACEMENT - Set-in emphasizes, raglan/dolman minimizes
    // "balance_shoulders": {
    //         // CALC: Depends on whether user has BROAD or NARROW shoulders
    //         //       Check user.shoulder_hip_ratio:
    //         //       > 1.05 = broad shoulders (need to minimize)
    //         //       < 0.95 = narrow shoulders (need to widen)
    //         //       0.95-1.05 = balanced (maintain)
    //         //
    //         // FOR BROAD SHOULDERS (minimize):
    //         //   NECKLINE IMPACT:
    //         //     v_neck, scoop: +0.3 (draws eye down/in)
    //         //     halter: +0.2 (narrows shoulder line)
    //         //     boat_neck, off_shoulder: -0.4 (widens)
    //         //     one_shoulder: -0.2
    //         //   SLEEVE IMPACT:
    //         //     raglan: +0.3 (softens shoulder line)
    //         //     dolman: +0.2 (no defined shoulder seam)
    //         //     puff, leg_of_mutton: -0.4 (adds volume)
    //         //     set_in at shoulder: -0.1
    //         //   SILHOUETTE IMPACT:
    //         //     a_line, fit_and_flare: +0.2 (adds hip volume to balance)
    //         //     peplum: +0.2 (adds hip volume)
    //         //
    //         // FOR NARROW SHOULDERS (widen):
    //         //   NECKLINE IMPACT:
    //         //     boat_neck, off_shoulder: +0.3 (widens)
    //         //     square_neck: +0.2
    //         //     v_neck deep: -0.1 (narrows further)
    //         //   SLEEVE IMPACT:
    //         //     puff, cap: +0.3 (adds volume)
    //         //     structured shoulder: +0.2
    //         //     raglan, dolman: -0.2 (minimizes)
    //         //
    //         // FIX: "add_shoulder_pads" (for narrow), "choose_raglan_sleeve" (for broad)
    //         "verdict": null,
    //         "score": 0,
    //         "factors": [],
    //         "fix": null
    //     },

    const factors = [];
    let score = 0;
    let fix = null;

    // Determine shoulder type
    const shoulderRatio = user.shoulder_hip_ratio || 1.0;
    const hasBroadShoulders = shoulderRatio > 1.05;
    const hasNarrowShoulders = shoulderRatio < 0.95;
    const isBalanced = !hasBroadShoulders && !hasNarrowShoulders;

    if (isBalanced) {
        // Already balanced, most things are fine
        factors.push({ type: "body", effect: "positive", note: "shoulders already balanced with hips", value: 0.2 });
        score += 0.2;
    }

    // --- NECKLINE IMPACT ---
    let necklineImpact = 0;
    if (hasBroadShoulders) {
        // Need to minimize shoulders
        if (["v_neck", "scoop_neck"].includes(garment.neckline_type)) {
            necklineImpact = 0.3;
            factors.push({ type: "neckline", effect: "positive", note: "v/scoop neck draws eye down and in", value: necklineImpact });
        } else if (garment.neckline_type === "halter") {
            necklineImpact = 0.2;
            factors.push({ type: "neckline", effect: "positive", note: "halter narrows shoulder line", value: necklineImpact });
        } else if (["boat_neck", "off_shoulder"].includes(garment.neckline_type)) {
            necklineImpact = -0.4;
            factors.push({ type: "neckline", effect: "negative", note: "wide neckline widens broad shoulders", value: necklineImpact });
        } else if (garment.neckline_type === "one_shoulder") {
            necklineImpact = -0.2;
            factors.push({ type: "neckline", effect: "negative", note: "one shoulder draws attention to shoulder area", value: necklineImpact });
        }
    } else if (hasNarrowShoulders) {
        // Need to widen shoulders
        if (["boat_neck", "off_shoulder"].includes(garment.neckline_type)) {
            necklineImpact = 0.3;
            factors.push({ type: "neckline", effect: "positive", note: "wide neckline widens narrow shoulders", value: necklineImpact });
        } else if (garment.neckline_type === "square_neck") {
            necklineImpact = 0.2;
            factors.push({ type: "neckline", effect: "positive", note: "square neck adds width", value: necklineImpact });
        } else if (garment.neckline_type === "v_neck" && garment.neckline_depth === "deep") {
            necklineImpact = -0.1;
            factors.push({ type: "neckline", effect: "negative", note: "deep v narrows further", value: necklineImpact });
        }
    }
    score += necklineImpact;

    // --- SLEEVE IMPACT ---
    let sleeveImpact = 0;
    if (hasBroadShoulders) {
        if (garment.sleeve_type === "raglan") {
            sleeveImpact = 0.3;
            factors.push({ type: "sleeve", effect: "positive", note: "raglan softens shoulder line", value: sleeveImpact });
        } else if (garment.sleeve_type === "dolman") {
            sleeveImpact = 0.2;
            factors.push({ type: "sleeve", effect: "positive", note: "dolman blurs shoulder seam", value: sleeveImpact });
        } else if (["puff", "leg_of_mutton"].includes(garment.sleeve_type)) {
            sleeveImpact = -0.4;
            factors.push({ type: "sleeve", effect: "negative", note: "puff sleeves add volume to shoulders", value: sleeveImpact });
        } else if (garment.sleeve_type === "set_in") {
            sleeveImpact = -0.1;
            factors.push({ type: "sleeve", effect: "negative", note: "set-in emphasizes shoulder seam", value: sleeveImpact });
        }
    } else if (hasNarrowShoulders) {
        if (["puff", "cap"].includes(garment.sleeve_type)) {
            sleeveImpact = 0.3;
            factors.push({ type: "sleeve", effect: "positive", note: "puff/cap adds volume to shoulders", value: sleeveImpact });
        } else if (["raglan", "dolman"].includes(garment.sleeve_type)) {
            sleeveImpact = -0.2;
            factors.push({ type: "sleeve", effect: "negative", note: "raglan/dolman minimizes narrow shoulders", value: sleeveImpact });
        }
    }
    score += sleeveImpact;

    // --- SILHOUETTE IMPACT ---
    let silImpact = 0;
    if (hasBroadShoulders) {
        if (["a_line", "fit_and_flare"].includes(garment.silhouette_type)) {
            silImpact = 0.2;
            factors.push({ type: "silhouette", effect: "positive", note: "a_line/fit_and_flare adds hip volume to balance", value: silImpact });
        } else if (garment.silhouette_type === "peplum") {
            silImpact = 0.2;
            factors.push({ type: "silhouette", effect: "positive", note: "peplum adds hip volume to balance", value: silImpact });
        }
    }
    score += silImpact;

    // --- Normalize score ---
    if (score > 1) score = 1;
    if (score < -1) score = -1;

    // --- VERDICT ---
    let verdict = null;
    if (score > 0.3) verdict = "yes";
    else if (score > -0.3) verdict = "almost";
    else verdict = "no";

    // --- FIX SUGGESTION ---
    if (hasNarrowShoulders && sleeveImpact <= 0) {
        fix = "add_shoulder_pads";
    } else if (hasBroadShoulders && sleeveImpact < 0) {
        fix = "choose_raglan_sleeve";
    }

    return { verdict, score, factors, fix };
}


/**
 * Estimate how the garment affects the goal of "hide_upper_arms" for a user.
 * Returns an object with { verdict, score, factors, fix }
 */
export function estimate_goal_hide_upper_arms({ garment, user }) {

    // ==================== GOAL 7: HIDE UPPER ARMS ====================
    //
    // THEORY: The upper arm (bicep/tricep area) is a common concern. The goal
    // is coverage without looking like you're hiding, avoiding worst sleeve endpoints.
    //
    // KEY PRINCIPLES:
    // 1. SLEEVE ENDPOINT DANGER ZONE - Worst place is widest part of upper arm
    // 2. THREE-QUARTER SLEEVES ARE IDEAL - Cover bicep, show slimmer forearm
    // 3. LOOSE > FITTED - Relaxed/voluminous sleeves create air space
    // 4. FLUTTER SLEEVES - Soft partial coverage with movement
    // 5. LAYERING IS EASY FIX - Cardigan, shrug, or jacket solves coverage
    // 6. FABRIC MATTERS - Clingy fabric shows arm shape even with long sleeves
    // "hide_upper_arms": {
    //         // CALC: Sum of factor impacts for concealing upper arms
    //         //
    //         // SLEEVE TYPE IMPACT (hide_upper_arms):
    //         //   three_quarter: +0.4 (covers bicep, shows forearm)
    //         //   full_length: +0.4 (full coverage)
    //         //   elbow: +0.3
    //         //   bell, bishop: +0.3 (loose, flowing)
    //         //   flutter: +0.2 (soft coverage)
    //         //   cap: -0.3 (hits at widest point)
    //         //   short: depends on where it hits
    //         //   sleeveless: -0.5 (no coverage)
    //         //   spaghetti_strap: -0.5
    //         //
    //         // SLEEVE WIDTH IMPACT (hide_upper_arms):
    //         //   voluminous: +0.2 (loose, doesn't cling)
    //         //   relaxed: +0.1
    //         //   fitted: -0.2 (shows arm shape)
    //         //
    //         // SLEEVE DANGER ZONE:
    //         //   sleeve_hits_widest_arm == true: -0.4 (worst position)
    //         //   sleeve_hits_widest_arm == false: +0.1
    //         //
    //         // FABRIC IMPACT (hide_upper_arms):
    //         //   fabric_drape == "stiff", "structured", or "fluid": +0.1 (doesn't cling)
    //         //   fabric_drape == "very_drapey": -0.2 (clings, shows arm contours)
    //         //
    //         // FIX: "add_cardigan", "add_shrug", "choose_longer_sleeve"
    //         "verdict": null,
    //         "score": 0,
    //         "factors": [],
    //         "fix": null
    //     },

    const factors = [];
    let score = 0;
    let fix = null;

    // --- SLEEVE TYPE IMPACT ---
    let sleeveImpact = 0;
    if (["three_quarter", "full_length"].includes(garment.sleeve_type)) {
        sleeveImpact = 0.4;
        factors.push({ type: "sleeve_type", effect: "positive", note: "three_quarter/full covers bicep area", value: sleeveImpact });
    } else if (garment.sleeve_type === "elbow") {
        sleeveImpact = 0.3;
        factors.push({ type: "sleeve_type", effect: "positive", note: "elbow sleeve covers upper arm", value: sleeveImpact });
    } else if (["bell", "bishop"].includes(garment.sleeve_type)) {
        sleeveImpact = 0.3;
        factors.push({ type: "sleeve_type", effect: "positive", note: "bell/bishop sleeve loose and flowing", value: sleeveImpact });
    } else if (garment.sleeve_type === "flutter") {
        sleeveImpact = 0.2;
        factors.push({ type: "sleeve_type", effect: "positive", note: "flutter provides soft coverage", value: sleeveImpact });
    } else if (garment.sleeve_type === "cap") {
        sleeveImpact = -0.3;
        factors.push({ type: "sleeve_type", effect: "negative", note: "cap sleeve hits at widest point", value: sleeveImpact });
    } else if (["sleeveless", "spaghetti_strap"].includes(garment.sleeve_type)) {
        sleeveImpact = -0.5;
        factors.push({ type: "sleeve_type", effect: "negative", note: "no sleeve coverage", value: sleeveImpact });
    } else if (garment.sleeve_type === "short") {
        // Short depends on where it hits
        if (garment.sleeve_hits_widest_arm) {
            sleeveImpact = -0.4;
            factors.push({ type: "sleeve_type", effect: "negative", note: "short sleeve hits widest arm point", value: sleeveImpact });
        } else {
            sleeveImpact = 0.1;
            factors.push({ type: "sleeve_type", effect: "neutral", note: "short sleeve avoids widest point", value: sleeveImpact });
        }
    }
    score += sleeveImpact;

    // --- SLEEVE WIDTH IMPACT ---
    let widthImpact = 0;
    if (garment.sleeve_width === "voluminous") {
        widthImpact = 0.2;
        factors.push({ type: "sleeve_width", effect: "positive", note: "voluminous sleeve doesn't cling", value: widthImpact });
    } else if (garment.sleeve_width === "relaxed") {
        widthImpact = 0.1;
        factors.push({ type: "sleeve_width", effect: "positive", note: "relaxed fit provides room", value: widthImpact });
    } else if (garment.sleeve_width === "fitted") {
        widthImpact = -0.2;
        factors.push({ type: "sleeve_width", effect: "negative", note: "fitted sleeve shows arm shape", value: widthImpact });
    }
    score += widthImpact;

    // --- SLEEVE DANGER ZONE ---
    // let dangerImpact = 0;
    // if (garment.sleeve_hits_widest_arm === true) {
    //     dangerImpact = -0.4;
    //     factors.push({ type: "danger_zone", effect: "negative", note: "sleeve ends at widest part of arm", value: dangerImpact });
    // } else if (garment.sleeve_hits_widest_arm === false && sleeveImpact >= 0) {
    //     dangerImpact = 0.1;
    //     factors.push({ type: "danger_zone", effect: "positive", note: "sleeve avoids widest arm point", value: dangerImpact });
    // }
    // score += dangerImpact;

    // --- FABRIC IMPACT ---
    let fabricImpact = 0;
    if (["stiff", "structured", "fluid"].includes(garment.fabric_drape)) {
        fabricImpact = 0.1;
        factors.push({ type: "fabric", effect: "positive", note: "structured/fluid fabric doesn't cling to arms", value: fabricImpact });
    } else if (garment.fabric_drape === "very_drapey") {
        fabricImpact = -0.2;
        factors.push({ type: "fabric", effect: "negative", note: "very drapey fabric clings and shows arm contours", value: fabricImpact });
    }
    score += fabricImpact;

    // --- Normalize score ---
    if (score > 1) score = 1;
    if (score < -1) score = -1;

    // --- VERDICT ---
    let verdict = null;
    if (score > 0.3) verdict = "yes";
    else if (score > -0.3) verdict = "almost";
    else verdict = "no";

    // --- FIX SUGGESTION ---
    if (sleeveImpact < 0) {
        if (["sleeveless", "spaghetti_strap", "cap"].includes(garment.sleeve_type)) {
            fix = "add_cardigan";
        } else {
            fix = "choose_longer_sleeve";
        }
    }

    return { verdict, score, factors, fix };
}


/**
 * Estimate how the garment affects the goal of "elongate_legs" for a user.
 * Returns an object with { verdict, score, factors, fix }
 */
export function estimate_goal_elongate_legs({ garment, user }) {

    // ==================== GOAL 8: ELONGATE LEGS ====================
    //
    // THEORY: Leg length perception is primarily about where the "waist" appears.
    // Higher perceived waist = longer legs. Also showing more leg = longer legs.
    //
    // KEY PRINCIPLES:
    // 1. WAIST HEIGHT IS KEY - Empire raises perceived waist, drop shortens
    // 2. HIGH-WAISTED BOTTOMS - Raises where leg visually starts
    // 3. HEMLINE STRATEGY - Avoid cutting at widest point (knee)
    // 4. COLUMN OF COLOR - Same color waist down creates unbroken line
    // 5. VERTICAL LINES ON LEGS - Stripes, seams, pleats elongate
    // 6. HEELS ARE THE CHEAT CODE - Literally add inches
    // "show_legs": {
    //         // CALC: Sum of factor impacts for leg exposure/emphasis
    //         //
    //         // HEMLINE IMPACT (show_legs):
    //         //   mini: +0.5 (maximum exposure)
    //         //   above_knee: +0.4
    //         //   at_knee: +0.2
    //         //   below_knee: +0.1
    //         //   midi: -0.1 (partial coverage)
    //         //   maxi/floor_length: -0.4 (full coverage)
    //         //   high_low: +0.2 (shows leg in front)
    //         //
    //         // SLIT IMPACT (show_legs):
    //         //   has high slit (from description): +0.3
    //         //
    //         // HEMLINE DANGER ZONE (show_legs):
    //         //   hemline_hits_danger_zone (widest_calf): -0.3 (unflattering)
    //         //   hemline at good position: +0.1
    //         //
    //         // SILHOUETTE IMPACT (show_legs):
    //         //   fit_and_flare: +0.1 (shows leg with movement)
    //         //   column/sheath with slit: +0.2
    //         //   cocoon: -0.2 (wider shape detracts)
    //         //
    //         // FOR PANTS (if garment_type == pants):
    //         //   shorts: +0.4
    //         //   cropped pants: +0.2
    //         //   full length: -0.2
    //         //   wide_leg: -0.1
    //         //
    //         // FIX: "hem_shorter", "add_slit"
    //         "verdict": null,
    //         "score": 0,
    //         "factors": [],
    //         "fix": null
    //     }

    const factors = [];
    let score = 0;
    let fix = null;

    // --- HEMLINE IMPACT ---
    let hemlineImpact = 0;
    const hemPos = garment.hemline_position;
    if (["mini", "above_knee"].includes(hemPos)) {
        hemlineImpact = 0.3;
        factors.push({ type: "hemline", effect: "positive", note: "mini/above_knee shows maximum leg", value: hemlineImpact });
    } else if (hemPos === "at_knee" || hemPos === "on_knee") {
        hemlineImpact = -0.2;
        factors.push({ type: "hemline", effect: "negative", note: "at_knee cuts leg at widest point", value: hemlineImpact });
    } else if (hemPos === "below_knee") {
        hemlineImpact = -0.1;
        factors.push({ type: "hemline", effect: "negative", note: "below_knee shortens leg slightly", value: hemlineImpact });
    } else if (["midi", "mid_calf"].includes(hemPos)) {
        hemlineImpact = 0.1;
        factors.push({ type: "hemline", effect: "positive", note: "midi is a good break point", value: hemlineImpact });
    } else if (hemPos === "high_low") {
        hemlineImpact = 0.1;
        factors.push({ type: "hemline", effect: "positive", note: "high_low shows some leg", value: hemlineImpact });
    } else if (["maxi", "floor_length", "on_ankle", "above_ankle"].includes(hemPos)) {
        hemlineImpact = -0.1;
        factors.push({ type: "hemline", effect: "negative", note: "maxi/floor hides legs", value: hemlineImpact });
    }
    score += hemlineImpact;

    // --- WAISTLINE IMPACT ---
    let waistImpact = 0;
    if (garment.waistline === "empire") {
        waistImpact = 0.3;
        factors.push({ type: "waist", effect: "positive", note: "empire raises perceived waist", value: waistImpact });
    } else if (garment.waist_definition === "defined" && garment.waistline === "natural") {
        waistImpact = 0.2;
        factors.push({ type: "waist", effect: "positive", note: "defined natural waist elongates", value: waistImpact });
    } else if (["drop", "low"].includes(garment.waistline)) {
        waistImpact = -0.3;
        factors.push({ type: "waist", effect: "negative", note: "drop/low waist shortens leg proportion", value: waistImpact });
    }
    score += waistImpact;

    // --- SILHOUETTE IMPACT ---
    let silImpact = 0;
    if (garment.silhouette_type === "fit_and_flare") {
        silImpact = 0.2;
        factors.push({ type: "silhouette", effect: "positive", note: "fit_and_flare fitted waist, shows leg", value: silImpact });
    } else if (["column", "sheath"].includes(garment.silhouette_type)) {
        silImpact = 0.1;
        factors.push({ type: "silhouette", effect: "positive", note: "column creates vertical line", value: silImpact });
    } else if (["cocoon", "tent"].includes(garment.silhouette_type)) {
        silImpact = -0.2;
        factors.push({ type: "silhouette", effect: "negative", note: "cocoon/tent no leg definition", value: silImpact });
    }
    score += silImpact;

    // --- PATTERN IMPACT ---
    let patternImpact = 0;
    if (garment.pattern_direction === "vertical") {
        patternImpact = 0.2;
        factors.push({ type: "pattern", effect: "positive", note: "vertical pattern elongates legs", value: patternImpact });
    } else if (garment.pattern_direction === "horizontal") {
        patternImpact = -0.2;
        factors.push({ type: "pattern", effect: "negative", note: "horizontal shortens legs", value: patternImpact });
    }
    score += patternImpact;

    // --- COLOR IMPACT ---
    let colorImpact = 0;
    if (garment.pattern_type === "solid") {
        colorImpact = 0.2;
        factors.push({ type: "color", effect: "positive", note: "solid color column effect", value: colorImpact });
    } else if (garment.pattern_type === "colorblock") {
        colorImpact = -0.2;
        factors.push({ type: "color", effect: "negative", note: "colorblock breaks leg line", value: colorImpact });
    }
    score += colorImpact;

    // --- Normalize score ---
    if (score > 1) score = 1;
    if (score < -1) score = -1;

    // --- VERDICT ---
    let verdict = null;
    if (score > 0.3) verdict = "yes";
    else if (score > -0.3) verdict = "almost";
    else verdict = "no";

    // --- FIX SUGGESTION ---
    if (waistImpact < 0) {
        fix = "choose_high_waist";
    } else if (hemlineImpact < 0) {
        fix = "hem_shorter";
    } else {
        fix = "add_heels";
    }

    return { verdict, score, factors, fix };
}


/**
 * Estimate how the garment affects the goal of "create_curves" for a user.
 * Returns an object with { verdict, score, factors, fix }
 */
export function estimate_goal_create_curves({ garment, user }) {

    // ==================== GOAL 9: CREATE CURVES ====================
    //
    // THEORY: This goal creates the illusion of an hourglass silhouette when
    // the body naturally has a straighter shape. Opposite of "streamline."
    //
    // KEY PRINCIPLES:
    // 1. DEFINE THE WAIST - Belt, fitted waist, or waist seam creates the "in"
    // 2. FIT-AND-FLARE IS IDEAL - Fitted waist + full skirt creates curves
    // 3. PEPLUMS ADD HIP CURVE - Literally a "fake" hip curve
    // 4. WRAP DRESSES WORK - Diagonal creates curves, wrap defines waist
    // 5. CONSTRUCTION CREATES SHAPE - Princess seams, darts, ruching
    // 6. COLORBLOCK TRICK - Dark at waist, light at bust/hips
    // 7. AVOID STRAIGHT SILHOUETTES - Shift, column, cocoon hide curves
    // "create_curves": {
    //         // CALC: Sum of factor impacts for adding curves to straight figure
    //         //       Typically for rectangle/straight body shape
    //         //
    //         // SILHOUETTE IMPACT (create_curves):
    //         //   fit_and_flare: +0.4 (cinched waist, full skirt)
    //         //   peplum: +0.4 (adds hip curve)
    //         //   wrap: +0.3 (diagonal creates curves)
    //         //   bodycon: +0.2 (shows natural curves - if user has some)
    //         //   mermaid: +0.3 (dramatic curve at hips)
    //         //   a_line: +0.2
    //         //   shift, column: -0.3 (maintains straight line)
    //         //   cocoon, tent: -0.3 (hides body shape)
    //         //
    //         // WAIST IMPACT (create_curves):
    //         //   waist_definition == "defined": +0.4 (creates waist illusion)
    //         //   waist_definition == "undefined": -0.3
    //         //   waistline == "natural": +0.2
    //         //
    //         // CONSTRUCTION IMPACT (create_curves):
    //         //   has_ruching: +0.3 (creates visual curves)
    //         //   has_darts: +0.2 (shapes fabric to body)
    //         //   has_seaming (princess): +0.2 (creates hourglass)
    //         //
    //         // PATTERN IMPACT (create_curves):
    //         //   colorblock that creates hourglass: +0.3
    //         //   horizontal stripes at bust/hips, dark at waist: +0.2
    //         //
    //         // FIX: "add_belt", "add_peplum_layer"
    //         "verdict": null,
    //         "score": 0,
    //         "factors": [],
    //         "fix": null
    //     },

    const factors = [];
    let score = 0;
    let fix = null;

    // --- SILHOUETTE IMPACT ---
    let silImpact = 0;
    if (["fit_and_flare", "peplum"].includes(garment.silhouette_type)) {
        silImpact = 0.4;
        factors.push({ type: "silhouette", effect: "positive", note: "fit_and_flare/peplum creates curves", value: silImpact });
    } else if (["wrap", "mermaid"].includes(garment.silhouette_type)) {
        silImpact = 0.3;
        factors.push({ type: "silhouette", effect: "positive", note: "wrap/mermaid creates curve illusion", value: silImpact });
    } else if (garment.silhouette_type === "bodycon") {
        silImpact = 0.2;
        factors.push({ type: "silhouette", effect: "positive", note: "bodycon shows natural curves", value: silImpact });
    } else if (garment.silhouette_type === "a_line") {
        silImpact = 0.2;
        factors.push({ type: "silhouette", effect: "positive", note: "a_line adds hip volume", value: silImpact });
    } else if (["shift", "column"].includes(garment.silhouette_type)) {
        silImpact = -0.3;
        factors.push({ type: "silhouette", effect: "negative", note: "shift/column maintains straight line", value: silImpact });
    } else if (["cocoon", "tent"].includes(garment.silhouette_type)) {
        silImpact = -0.3;
        factors.push({ type: "silhouette", effect: "negative", note: "cocoon/tent hides body shape", value: silImpact });
    }
    score += silImpact;

    // --- WAIST IMPACT ---
    let waistImpact = 0;
    if (garment.waist_definition === "defined") {
        waistImpact = 0.4;
        factors.push({ type: "waist", effect: "positive", note: "defined waist creates curve illusion", value: waistImpact });
    } else if (garment.waist_definition === "undefined") {
        waistImpact = -0.3;
        factors.push({ type: "waist", effect: "negative", note: "undefined waist no curve definition", value: waistImpact });
    }
    if (garment.waistline === "natural") {
        waistImpact += 0.2;
        factors.push({ type: "waist", effect: "positive", note: "natural waist position", value: 0.2 });
    }
    score += waistImpact;

    // --- CONSTRUCTION IMPACT ---
    let constructionImpact = 0;
    if (garment.has_ruching === true) {
        constructionImpact += 0.3;
        factors.push({ type: "construction", effect: "positive", note: "ruching creates visual curves", value: 0.3 });
    }
    if (garment.has_darts === true) {
        constructionImpact += 0.2;
        factors.push({ type: "construction", effect: "positive", note: "darts shape fabric to body", value: 0.2 });
    }
    if (garment.has_seaming === true) {
        constructionImpact += 0.2;
        factors.push({ type: "construction", effect: "positive", note: "princess seams create hourglass", value: 0.2 });
    }
    score += constructionImpact;

    // --- PATTERN IMPACT ---
    let patternImpact = 0;
    if (garment.pattern_type === "colorblock") {
        // Could be positive if creates hourglass effect
        patternImpact = 0.2;
        factors.push({ type: "pattern", effect: "positive", note: "colorblock can create hourglass illusion", value: patternImpact });
    }
    score += patternImpact;

    // --- Normalize score ---
    if (score > 1) score = 1;
    if (score < -1) score = -1;

    // --- VERDICT ---
    let verdict = null;
    if (score > 0.3) verdict = "yes";
    else if (score > -0.3) verdict = "almost";
    else verdict = "no";

    // --- FIX SUGGESTION ---
    if (waistImpact < 0) {
        fix = "add_belt";
    } else if (silImpact < 0) {
        fix = "add_peplum_layer";
    }

    return { verdict, score, factors, fix };
}


/**
 * Estimate how the garment affects the goal of "streamline_silhouette" for a user.
 * Returns an object with { verdict, score, factors, fix }
 */
export function estimate_goal_streamline_silhouette({ garment, user }) {

    // ==================== GOAL 10: STREAMLINE SILHOUETTE ====================
    //
    // THEORY: Creating a clean, unbroken visual line from shoulder to hem.
    // Often preferred by plus-size or minimalist aesthetic.
    //
    // KEY PRINCIPLES:
    // 1. ONE UNBROKEN LINE - Eye travels smoothly top to bottom
    // 2. COLUMN/SHEATH SILHOUETTES - Designed for clean vertical rectangle
    // 3. SOLID COLORS ARE ESSENTIAL - No patterns breaking the line
    // 4. SMOOTH FABRICS HELP - No texture adding visual noise
    // 5. MINIMAL CONSTRUCTION - No ruching, gathering, tiering, peplums
    // 6. CONFLICTS WITH "CREATE CURVES" - These goals are opposites

    // "streamline_silhouette": {
    //         // CALC: Sum of factor impacts for clean, unbroken line
    //         //       Often wanted by plus_size or for minimalist look
    //         //
    //         // SILHOUETTE IMPACT (streamline_silhouette):
    //         //   column, sheath: +0.4 (clean vertical line)
    //         //   shift: +0.3 (simple, unstructured)
    //         //   a_line (subtle): +0.2
    //         //   bodycon: +0.1 (clean line but may not be desired)
    //         //   fit_and_flare: -0.1 (break at waist)
    //         //   tiered: -0.3 (horizontal breaks)
    //         //   peplum: -0.2 (adds element)
    //         //   cocoon: -0.2 (adds bulk)
    //         //
    //         // PATTERN IMPACT (streamline_silhouette):
    //         //   solid: +0.3 (unbroken visual)
    //         //   vertical_stripes: +0.2
    //         //   horizontal_stripes: -0.2 (breaks line)
    //         //   colorblock: -0.2 (visual breaks)
    //         //   busy patterns: -0.1
    //         //
    //         // CONSTRUCTION IMPACT (streamline_silhouette):
    //         //   minimal seaming: +0.1
    //         //   has_ruching: -0.1 (adds visual complexity)
    //         //   has_gathering: -0.1
    //         //
    //         // COLOR IMPACT (streamline_silhouette):
    //         //   monochromatic: +0.2
    //         //   high contrast elements: -0.2
    //         //
    //         // FABRIC IMPACT (streamline_silhouette):
    //         //   fabric_drape == "fluid": +0.2 (smooth line)
    //         //   fabric_texture == "smooth": +0.1
    //         //   bulky fabrics: -0.1
    //         //
    //         // FIX: "choose_solid_color", "remove_accessories"
    //         "verdict": null,
    //         "score": 0,
    //         "factors": [],
    //         "fix": null
    //     },

    const factors = [];
    let score = 0;
    let fix = null;

    // --- SILHOUETTE IMPACT ---
    let silImpact = 0;
    if (["column", "sheath"].includes(garment.silhouette_type)) {
        silImpact = 0.4;
        factors.push({ type: "silhouette", effect: "positive", note: "column/sheath clean vertical line", value: silImpact });
    } else if (garment.silhouette_type === "shift") {
        silImpact = 0.3;
        factors.push({ type: "silhouette", effect: "positive", note: "shift simple unstructured", value: silImpact });
    } else if (garment.silhouette_type === "a_line") {
        silImpact = 0.2;
        factors.push({ type: "silhouette", effect: "positive", note: "subtle a_line streamlines", value: silImpact });
    } else if (garment.silhouette_type === "bodycon") {
        silImpact = 0.1;
        factors.push({ type: "silhouette", effect: "neutral", note: "bodycon clean line but shows body", value: silImpact });
    } else if (garment.silhouette_type === "fit_and_flare") {
        silImpact = -0.1;
        factors.push({ type: "silhouette", effect: "negative", note: "fit_and_flare break at waist", value: silImpact });
    } else if (garment.silhouette_type === "tiered") {
        silImpact = -0.3;
        factors.push({ type: "silhouette", effect: "negative", note: "tiered horizontal breaks", value: silImpact });
    } else if (garment.silhouette_type === "peplum") {
        silImpact = -0.2;
        factors.push({ type: "silhouette", effect: "negative", note: "peplum adds visual element", value: silImpact });
    } else if (garment.silhouette_type === "cocoon") {
        silImpact = -0.2;
        factors.push({ type: "silhouette", effect: "negative", note: "cocoon adds bulk", value: silImpact });
    }
    score += silImpact;

    // --- PATTERN IMPACT ---
    let patternImpact = 0;
    if (garment.pattern_type === "solid") {
        patternImpact = 0.3;
        factors.push({ type: "pattern", effect: "positive", note: "solid unbroken visual", value: patternImpact });
    } else if (garment.pattern_direction === "vertical" || garment.pattern_type === "vertical_stripes") {
        patternImpact = 0.2;
        factors.push({ type: "pattern", effect: "positive", note: "vertical stripes elongate", value: patternImpact });
    } else if (garment.pattern_direction === "horizontal" || garment.pattern_type === "horizontal_stripes") {
        patternImpact = -0.2;
        factors.push({ type: "pattern", effect: "negative", note: "horizontal breaks line", value: patternImpact });
    } else if (garment.pattern_type === "colorblock") {
        patternImpact = -0.2;
        factors.push({ type: "pattern", effect: "negative", note: "colorblock visual breaks", value: patternImpact });
    } else {
        // Other busy patterns
        patternImpact = -0.1;
        factors.push({ type: "pattern", effect: "negative", note: "busy pattern adds visual noise", value: patternImpact });
    }
    score += patternImpact;

    // --- CONSTRUCTION IMPACT ---
    let constructionImpact = 0;
    if (garment.has_ruching === true) {
        constructionImpact -= 0.1;
        factors.push({ type: "construction", effect: "negative", note: "ruching adds visual complexity", value: -0.1 });
    }
    if (garment.has_gathering === true) {
        constructionImpact -= 0.1;
        factors.push({ type: "construction", effect: "negative", note: "gathering adds texture", value: -0.1 });
    }
    if (!garment.has_ruching && !garment.has_gathering && !garment.has_pleats) {
        constructionImpact += 0.1;
        factors.push({ type: "construction", effect: "positive", note: "minimal construction clean line", value: 0.1 });
    }
    score += constructionImpact;

    // --- COLOR IMPACT ---
    let colorImpact = 0;
    if (garment.pattern_type === "solid" && garment.pattern_contrast !== "high") {
        colorImpact = 0.2;
        factors.push({ type: "color", effect: "positive", note: "monochromatic streamlines", value: colorImpact });
    } else if (garment.pattern_contrast === "high") {
        colorImpact = -0.2;
        factors.push({ type: "color", effect: "negative", note: "high contrast breaks line", value: colorImpact });
    }
    score += colorImpact;

    // --- FABRIC IMPACT ---
    let fabricImpact = 0;
    if (garment.fabric_drape === "fluid") {
        fabricImpact = 0.2;
        factors.push({ type: "fabric", effect: "positive", note: "fluid drape smooth line", value: fabricImpact });
    }
    if (garment.fabric_texture === "smooth") {
        fabricImpact += 0.1;
        factors.push({ type: "fabric", effect: "positive", note: "smooth texture clean look", value: 0.1 });
    } else if (garment.fabric_texture === "textured" || garment.fabric_weight === "heavy") {
        fabricImpact -= 0.1;
        factors.push({ type: "fabric", effect: "negative", note: "bulky/textured fabric adds noise", value: -0.1 });
    }
    score += fabricImpact;

    // --- Normalize score ---
    if (score > 1) score = 1;
    if (score < -1) score = -1;

    // --- VERDICT ---
    let verdict = null;
    if (score > 0.3) verdict = "yes";
    else if (score > -0.3) verdict = "almost";
    else verdict = "no";

    // --- FIX SUGGESTION ---
    if (patternImpact < 0) {
        fix = "choose_solid_color";
    } else if (constructionImpact < 0) {
        fix = "remove_accessories";
    }

    return { verdict, score, factors, fix };
}


/**
 * Estimate how the garment affects the goal of "minimize_bust" for a user.
 * Returns an object with { verdict, score, factors, fix }
 */
export function estimate_goal_minimize_bust({ garment, user }) {

    // ==================== GOAL 11: MINIMIZE BUST ====================
    //
    // THEORY: For those with larger bust who want to de-emphasize it. Avoid
    // drawing attention to chest area while looking polished and proportional.
    //
    // KEY PRINCIPLES:
    // 1. V-NECKS ARE COUNTERINTUITIVE - Vertical line draws eye down and inward
    // 2. AVOID HORIZONTAL AT BUST - Boat necks, square necks, strapless
    // 3. SWEETHEART = MAXIMUM EMPHASIS - Traces bust curve, avoid
    // 4. FIT MATTERS - Tight clings, relaxed gives room, too loose adds bulk
    // 5. STRUCTURED FABRICS - Create "shell" effect vs clingy showing shape
    // 6. DARK COLORS ON TOP - Dark recedes, light advances
    // 7. AVOID BUST EMBELLISHMENT - No ruching, ruffles, embroidery at bust

    // "minimize_bust": {
    //         // CALC: Sum of factor impacts for reducing bust emphasis
    //         //
    //         // NECKLINE IMPACT (minimize_bust):
    //         //   v_neck (moderate depth): +0.3 (vertical line draws eye down)
    //         //   scoop_neck: +0.2
    //         //   crew_neck: +0.1 (high, no emphasis)
    //         //   sweetheart: -0.4 (emphasizes bust curve)
    //         //   strapless: -0.3
    //         //   plunging: -0.2 (can work if structured)
    //         //   square_neck: -0.2 (horizontal at bust)
    //         //   boat_neck: -0.1 (draws eye across)
    //         //
    //         // NECKLINE DEPTH IMPACT:
    //         //   shallow/medium: +0.1 (less exposure)
    //         //   deep/plunging: -0.2 (more exposure)
    //         //
    //         // FIT IMPACT (minimize_bust):
    //         //   fit_category == "relaxed": +0.2 (more room)
    //         //   fit_category == "semi_fitted": +0.1
    //         //   fit_category == "fitted" or "tight": -0.3 (emphasizes)
    //         //
    //         // FABRIC IMPACT (minimize_bust):
    //         //   fabric_drape == "stiff" or "structured": +0.2 (holds shape)
    //         //   fabric_drape == "very_drapey": -0.3 (clings, shows bust shape)
    //         //   fabric_weight == "medium": +0.1 (supportive)
    //         //
    //         // CONSTRUCTION IMPACT (minimize_bust):
    //         //   has_ruching at bust: -0.2 (adds visual volume)
    //         //   has_gathering at bust: -0.2
    //         //   has_darts (well placed): +0.1
    //         //
    //         // PATTERN IMPACT (minimize_bust):
    //         //   busy pattern at bust: -0.1 (draws eye)
    //         //   dark color at bust: +0.1
    //         //   light color at bust: -0.1
    //         //
    //         // FIX: "choose_structured_fabric", "avoid_embellished_neckline"
    //         "verdict": null,
    //         "score": 0,
    //         "factors": [],
    //         "fix": null
    //     },

    const factors = [];
    let score = 0;
    let fix = null;

    // --- NECKLINE IMPACT ---
    let necklineImpact = 0;
    if (garment.neckline_type === "v_neck" && garment.neckline_depth !== "plunging") {
        necklineImpact = 0.3;
        factors.push({ type: "neckline", effect: "positive", note: "moderate v-neck draws eye down", value: necklineImpact });
    } else if (garment.neckline_type === "scoop_neck") {
        necklineImpact = 0.2;
        factors.push({ type: "neckline", effect: "positive", note: "scoop neck flattering", value: necklineImpact });
    } else if (garment.neckline_type === "crew_neck") {
        necklineImpact = 0.1;
        factors.push({ type: "neckline", effect: "positive", note: "high crew neck no emphasis", value: necklineImpact });
    } else if (garment.neckline_type === "sweetheart") {
        necklineImpact = -0.4;
        factors.push({ type: "neckline", effect: "negative", note: "sweetheart emphasizes bust curve", value: necklineImpact });
    } else if (garment.neckline_type === "strapless") {
        necklineImpact = -0.3;
        factors.push({ type: "neckline", effect: "negative", note: "strapless draws attention to bust", value: necklineImpact });
    } else if (garment.neckline_type === "plunging") {
        necklineImpact = -0.2;
        factors.push({ type: "neckline", effect: "negative", note: "plunging shows bust", value: necklineImpact });
    } else if (["square_neck", "boat_neck"].includes(garment.neckline_type)) {
        necklineImpact = -0.1;
        factors.push({ type: "neckline", effect: "negative", note: "horizontal neckline at bust level", value: necklineImpact });
    }
    score += necklineImpact;

    // --- NECKLINE DEPTH IMPACT ---
    let depthImpact = 0;
    if (["shallow", "medium"].includes(garment.neckline_depth)) {
        depthImpact = 0.1;
        factors.push({ type: "neckline_depth", effect: "positive", note: "shallow/medium depth less exposure", value: depthImpact });
    } else if (["deep", "plunging"].includes(garment.neckline_depth)) {
        depthImpact = -0.2;
        factors.push({ type: "neckline_depth", effect: "negative", note: "deep/plunging more exposure", value: depthImpact });
    }
    score += depthImpact;

    // --- FIT IMPACT ---
    let fitImpact = 0;
    if (garment.fit_category === "relaxed") {
        fitImpact = 0.2;
        factors.push({ type: "fit", effect: "positive", note: "relaxed fit gives room", value: fitImpact });
    } else if (garment.fit_category === "semi_fitted") {
        fitImpact = 0.1;
        factors.push({ type: "fit", effect: "positive", note: "semi_fitted flattering", value: fitImpact });
    } else if (["fitted", "tight"].includes(garment.fit_category)) {
        fitImpact = -0.3;
        factors.push({ type: "fit", effect: "negative", note: "fitted/tight emphasizes bust", value: fitImpact });
    }
    score += fitImpact;

    // --- FABRIC IMPACT ---
    let fabricImpact = 0;
    if (garment.fabric_drape === "stiff" || garment.fabric_drape === "structured") {
        fabricImpact = 0.2;
        factors.push({ type: "fabric", effect: "positive", note: "structured fabric holds shape", value: fabricImpact });
    } else if (garment.fabric_drape === "very_drapey") {
        fabricImpact = -0.3;
        factors.push({ type: "fabric", effect: "negative", note: "very drapey fabric clings and shows bust shape", value: fabricImpact });
    }
    if (garment.fabric_weight === "medium") {
        fabricImpact += 0.1;
        factors.push({ type: "fabric", effect: "positive", note: "medium weight supportive", value: 0.1 });
    }
    score += fabricImpact;

    // --- CONSTRUCTION IMPACT ---
    let constructionImpact = 0;
    if (garment.has_ruching === true) {
        constructionImpact -= 0.2;
        factors.push({ type: "construction", effect: "negative", note: "ruching at bust adds visual volume", value: -0.2 });
    }
    if (garment.has_gathering === true) {
        constructionImpact -= 0.2;
        factors.push({ type: "construction", effect: "negative", note: "gathering adds volume", value: -0.2 });
    }
    if (garment.has_darts === true) {
        constructionImpact += 0.1;
        factors.push({ type: "construction", effect: "positive", note: "well-placed darts shape nicely", value: 0.1 });
    }
    score += constructionImpact;

    // --- PATTERN IMPACT ---
    let patternImpact = 0;
    if (garment.pattern_type !== "solid" && garment.pattern_contrast === "high") {
        patternImpact = -0.1;
        factors.push({ type: "pattern", effect: "negative", note: "busy pattern at bust draws eye", value: patternImpact });
    }
    if (["dark", "very_dark"].includes(garment.color_value)) {
        patternImpact += 0.1;
        factors.push({ type: "color", effect: "positive", note: "dark color minimizes bust", value: 0.1 });
    } else if (["light", "very_light"].includes(garment.color_value)) {
        patternImpact -= 0.1;
        factors.push({ type: "color", effect: "negative", note: "light color advances bust", value: -0.1 });
    }
    score += patternImpact;

    // --- Normalize score ---
    if (score > 1) score = 1;
    if (score < -1) score = -1;

    // --- VERDICT ---
    let verdict = null;
    if (score > 0.3) verdict = "yes";
    else if (score > -0.3) verdict = "almost";
    else verdict = "no";

    // --- FIX SUGGESTION ---
    if (fabricImpact < 0) {
        fix = "choose_structured_fabric";
    } else if (necklineImpact < 0) {
        fix = "avoid_embellished_neckline";
    }

    return { verdict, score, factors, fix };
}


/**
 * Estimate how the garment affects the goal of "show_legs" for a user.
 * Returns an object with { verdict, score, factors, fix }
 */
export function estimate_goal_show_legs({ garment, user }) {

    // ==================== GOAL 12: SHOW LEGS ====================
    //
    // THEORY: Unlike "elongate legs" which is about PERCEPTION of length,
    // this is simply about LEG EXPOSURE. Maximize visible leg while avoiding
    // unflattering positions.
    //
    // KEY PRINCIPLES:
    // 1. SHORTER = MORE LEG - Mini, shorts, above-knee show maximum leg
    // 2. SLITS ARE A CLEVER SOLUTION - Maxi with high slit = leg flash
    // 3. AVOID DANGER ZONES - Don't cut at widest part of calf/thigh
    // 4. HIGH-LOW HEMLINES - Show leg in front, longer in back
    // 5. FOR PANTS - Shorts and cropped show leg, full length hides
    // 6. MOVEMENT HELPS - Fit-and-flare shows leg with movement

    // "show_legs": {
    //         // CALC: Sum of factor impacts for leg exposure/emphasis
    //         //
    //         // HEMLINE IMPACT (show_legs):
    //         //   mini: +0.5 (maximum exposure)
    //         //   above_knee: +0.4
    //         //   at_knee: +0.2
    //         //   below_knee: +0.1
    //         //   midi: -0.1 (partial coverage)
    //         //   maxi/floor_length: -0.4 (full coverage)
    //         //   high_low: +0.2 (shows leg in front)
    //         //
    //         // SLIT IMPACT (show_legs):
    //         //   has high slit (from description): +0.3
    //         //
    //         // HEMLINE DANGER ZONE (show_legs):
    //         //   hemline_hits_danger_zone (widest_calf): -0.3 (unflattering)
    //         //   hemline at good position: +0.1
    //         //
    //         // SILHOUETTE IMPACT (show_legs):
    //         //   fit_and_flare: +0.1 (shows leg with movement)
    //         //   column/sheath with slit: +0.2
    //         //   cocoon: -0.2 (wider shape detracts)
    //         //
    //         // FOR PANTS (if garment_type == pants):
    //         //   shorts: +0.4
    //         //   cropped pants: +0.2
    //         //   full length: -0.2
    //         //   wide_leg: -0.1
    //         //
    //         // FIX: "hem_shorter", "add_slit"
    //         "verdict": null,
    //         "score": 0,
    //         "factors": [],
    //         "fix": null
    //     }

    const factors = [];
    let score = 0;
    let fix = null;

    // --- HEMLINE IMPACT ---
    let hemlineImpact = 0;
    const hemPos = garment.hemline_position;
    if (hemPos === "mini") {
        hemlineImpact = 0.5;
        factors.push({ type: "hemline", effect: "positive", note: "mini maximum leg exposure", value: hemlineImpact });
    } else if (hemPos === "above_knee") {
        hemlineImpact = 0.4;
        factors.push({ type: "hemline", effect: "positive", note: "above_knee shows leg", value: hemlineImpact });
    } else if (["at_knee", "on_knee"].includes(hemPos)) {
        hemlineImpact = 0.2;
        factors.push({ type: "hemline", effect: "positive", note: "at_knee shows some leg", value: hemlineImpact });
    } else if (hemPos === "below_knee") {
        hemlineImpact = 0.1;
        factors.push({ type: "hemline", effect: "neutral", note: "below_knee partial coverage", value: hemlineImpact });
    } else if (["midi", "mid_calf"].includes(hemPos)) {
        hemlineImpact = -0.1;
        factors.push({ type: "hemline", effect: "negative", note: "midi covers most of leg", value: hemlineImpact });
    } else if (hemPos === "high_low") {
        hemlineImpact = 0.2;
        factors.push({ type: "hemline", effect: "positive", note: "high_low shows leg in front", value: hemlineImpact });
    } else if (["maxi", "floor_length", "on_ankle", "above_ankle"].includes(hemPos)) {
        hemlineImpact = -0.4;
        factors.push({ type: "hemline", effect: "negative", note: "maxi/floor full coverage", value: hemlineImpact });
    }
    score += hemlineImpact;

    // --- SLIT IMPACT ---
    // Check if garment description mentions slit (would come from text extraction)
    let slitImpact = 0;
    if (garment.has_slit === true || (garment.title && garment.title.toLowerCase().includes("slit"))) {
        slitImpact = 0.3;
        factors.push({ type: "slit", effect: "positive", note: "high slit shows leg", value: slitImpact });
    }
    score += slitImpact;

    // --- HEMLINE DANGER ZONE ---
    let dangerImpact = 0;
    if (garment.hemline_hits_danger_zone && garment.hemline_danger_zone_type === "widest_calf") {
        dangerImpact = -0.3;
        factors.push({ type: "danger_zone", effect: "negative", note: "hemline at widest calf unflattering", value: dangerImpact });
    } else if (!garment.hemline_hits_danger_zone && hemlineImpact >= 0) {
        dangerImpact = 0.1;
        factors.push({ type: "danger_zone", effect: "positive", note: "hemline at flattering position", value: dangerImpact });
    }
    score += dangerImpact;

    // --- SILHOUETTE IMPACT ---
    let silImpact = 0;
    if (garment.silhouette_type === "fit_and_flare") {
        silImpact = 0.1;
        factors.push({ type: "silhouette", effect: "positive", note: "fit_and_flare shows leg with movement", value: silImpact });
    } else if (["column", "sheath"].includes(garment.silhouette_type) && slitImpact > 0) {
        silImpact = 0.2;
        factors.push({ type: "silhouette", effect: "positive", note: "column/sheath with slit", value: silImpact });
    } else if (garment.silhouette_type === "cocoon") {
        silImpact = -0.2;
        factors.push({ type: "silhouette", effect: "negative", note: "cocoon wider shape detracts", value: silImpact });
    }
    score += silImpact;

    // --- FOR SHORTS (separate garment type) ---
    if (garment.garment_type === "shorts") {
        let shortsImpact = 0.4;
        factors.push({ type: "garment", effect: "positive", note: "shorts show maximum leg", value: shortsImpact });
        score += shortsImpact;
    }
    // --- FOR PANTS ---
    else if (garment.garment_type === "pants") {
        let pantsImpact = 0;
        if (garment.hemline_position === "above_knee" || garment.hemline_position === "at_knee") {
            pantsImpact = 0.2;
            factors.push({ type: "pants", effect: "positive", note: "shorter pants show some leg", value: pantsImpact });
        } else if (garment.hemline_position === "below_knee" || garment.hemline_position === "midi") {
            pantsImpact = 0.1;
            factors.push({ type: "pants", effect: "positive", note: "cropped pants show ankle", value: pantsImpact });
        } else if (garment.hemline_position === "ankle") {
            pantsImpact = 0;
            factors.push({ type: "pants", effect: "neutral", note: "ankle pants show minimal leg", value: pantsImpact });
        } else {
            // maxi, floor_length, or null
            pantsImpact = -0.2;
            factors.push({ type: "pants", effect: "negative", note: "full length pants hide legs", value: pantsImpact });
        }
        score += pantsImpact;
    }

    // --- Normalize score ---
    if (score > 1) score = 1;
    if (score < -1) score = -1;

    // --- VERDICT ---
    let verdict = null;
    if (score > 0.3) verdict = "yes";
    else if (score > -0.3) verdict = "almost";
    else verdict = "no";

    // --- FIX SUGGESTION ---
    if (hemlineImpact < 0 && slitImpact === 0) {
        fix = "add_slit";
    } else if (hemlineImpact < 0) {
        fix = "hem_shorter";
    }

    return { verdict, score, factors, fix };
}


// console.log('=== GARMENT ATTRIBUTES ===\n');
// console.log(JSON.stringify(garment1_attributes, null, 2));

// console.log('\n=== USER PROFILE ===\n');
// console.log(JSON.stringify(user1_profile, null, 2));




