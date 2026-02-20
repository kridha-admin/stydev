/**
 * Calculate Derived Body Measurements
 * Transforms raw body measurements (cm) into derived ratios, body shape classification,
 * and body landmarks needed for garment scoring.
 */

const CM_TO_INCHES = 2.54;

const roundToTwoDecimals = (num) => Math.round(num * 100) / 100;

/**
 * Calculate derived measurements and ratios from raw body measurements
 * @param {Object} body_measurements - Raw body measurements in cm
 * @param {Object} qna - Optional Q&A responses for additional context
 * @returns {Object} - Derived measurements, ratios, and classifications
 */
export function calc_derived_measurements_and_ratios(body_measurements, qna) {
    try {
        if (!body_measurements) return null;

        const derived = {};

        // ========================================================================
        // CONVERT TO INCHES (body_measurements are in cm)
        // ========================================================================
        const height_in = body_measurements.height ? body_measurements.height / CM_TO_INCHES : null;
        const bust_in = body_measurements.chest_circumference ? body_measurements.chest_circumference / CM_TO_INCHES : null;
        const waist_in = body_measurements.waist_circumference ? body_measurements.waist_circumference / CM_TO_INCHES : null;
        const hips_in = body_measurements.hip_circumference ? body_measurements.hip_circumference / CM_TO_INCHES : null;
        const shoulder_width_in = body_measurements.shoulder_breadth ? body_measurements.shoulder_breadth / CM_TO_INCHES : null;
        const arm_length_in = body_measurements.arm_right_length ? body_measurements.arm_right_length / CM_TO_INCHES : null;
        const inseam_in = body_measurements.inside_leg_height ? body_measurements.inside_leg_height / CM_TO_INCHES : null;

        // Estimate torso_length if not available
        // Approximation: height - inseam - head_height(~9in)
        let torso_length_in = null;
        if (height_in && inseam_in) {
            torso_length_in = height_in - inseam_in - 9;
        }

        // ========================================================================
        // BODY SHAPE CLASSIFICATION RATIOS
        // ========================================================================
        if (waist_in && hips_in) {
            derived.waist_hip_ratio = roundToTwoDecimals(waist_in / hips_in);
        }
        if (bust_in && hips_in) {
            derived.bust_hip_ratio = roundToTwoDecimals(bust_in / hips_in);
        }
        if (shoulder_width_in && hips_in) {
            // shoulder_hip_ratio: shoulder width vs hip width (hip circumference / pi)
            derived.shoulder_hip_ratio = roundToTwoDecimals(shoulder_width_in / (hips_in / 3.14));
        }
        if (torso_length_in && inseam_in) {
            derived.torso_leg_ratio = roundToTwoDecimals(torso_length_in / inseam_in);
        }

        // ========================================================================
        // BODY SHAPE CLASSIFICATION
        // ========================================================================
        // <hourglass|pear|apple|inverted_triangle|rectangle>
        if (derived.waist_hip_ratio && derived.bust_hip_ratio) {
            const whr = derived.waist_hip_ratio;
            const bust = bust_in;
            const hips = hips_in;
            const shr = derived.shoulder_hip_ratio || 1.0;

            if (whr < 0.78 && Math.abs(bust - hips) <= 2) {
                // Defined waist, bust and hips similar
                derived.body_shape = "hourglass";
            } else if (whr < 0.78 && hips > bust + 3) {
                // Defined waist, hips larger than bust
                derived.body_shape = "pear";
            } else if (whr > 0.88) {
                // Waist similar to hips (midsection fullness)
                derived.body_shape = "apple";
            } else if (shr > 1.08 && bust > hips) {
                // Shoulders wider than hips
                derived.body_shape = "inverted_triangle";
            } else {
                // Balanced proportions, less defined waist
                derived.body_shape = "rectangle";
            }
        }

        // ========================================================================
        // HEIGHT CATEGORY
        // ========================================================================
        // <petite|average|tall>
        if (height_in) {
            if (height_in < 63) {        // Under 5'3"
                derived.height_category = "petite";
            } else if (height_in <= 67) { // 5'3" to 5'7"
                derived.height_category = "average";
            } else {                      // Over 5'7"
                derived.height_category = "tall";
            }
        }

        // ========================================================================
        // SIZE CATEGORY
        // ========================================================================
        // <plus_size|standard>
        if (bust_in && hips_in && waist_in) {
            if (bust_in > 41 || hips_in > 47 || waist_in > 37) {
                derived.size_category = "plus_size";
            } else {
                derived.size_category = "standard";
            }
        }

        // ========================================================================
        // COMPOUND TYPES (for styling rules)
        // ========================================================================
        if (derived.body_shape) {
            derived.compound_types = [derived.body_shape];
            if (derived.height_category === "petite") {
                derived.compound_types.push("petite");
            } else if (derived.height_category === "tall") {
                derived.compound_types.push("tall");
            }
            if (derived.size_category === "plus_size") {
                derived.compound_types.push("plus_size");
            }
        }

        // ========================================================================
        // BODY LANDMARKS - LEG (for hemline scoring)
        // ========================================================================
        // All measurements in inches from floor
        if (inseam_in) {
            derived.knee_from_floor = roundToTwoDecimals(inseam_in * 0.47);
            derived.mid_calf_from_floor = roundToTwoDecimals(derived.knee_from_floor * 0.67);
            derived.widest_calf_from_floor = roundToTwoDecimals(derived.knee_from_floor * 0.75);
            derived.ankle_from_floor = 3.5; // Standard ankle height
            derived.mid_thigh_from_floor = roundToTwoDecimals(inseam_in * 0.72);
        }

        // ========================================================================
        // BODY LANDMARKS - ARM (for sleeve scoring)
        // ========================================================================
        // All measurements in inches from shoulder
        if (arm_length_in) {
            derived.elbow_from_shoulder = roundToTwoDecimals(arm_length_in * 0.57);
            derived.widest_upper_arm_from_shoulder = roundToTwoDecimals(arm_length_in * 0.33);
        }

        // ========================================================================
        // BODY LANDMARKS - TORSO (for waist scoring)
        // ========================================================================
        if (torso_length_in) {
            derived.natural_waist_from_shoulder = roundToTwoDecimals(torso_length_in);
        }
        if (height_in && torso_length_in) {
            derived.natural_waist_from_floor = roundToTwoDecimals(height_in - torso_length_in);
        }

        return derived;
    } catch (error) {
        console.log("error in calc_derived_measurements_and_ratios : ", error);
        return null;
    }
}

export default calc_derived_measurements_and_ratios;
