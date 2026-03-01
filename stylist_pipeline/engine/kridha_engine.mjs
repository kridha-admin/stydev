/**
 * Kridha Production Scoring Engine - Main Pipeline
 * =================================================
 * 7-layer scoring pipeline merging domain 4 (10 principle scorers),
 * domain 3 (fabric resolution), and domain 2 (hemline/sleeve/waist math)
 * into a unified production engine.
 *
 * Pipeline:
 *   Layer 1: Fabric Gate          -> resolve fabric properties
 *   Layer 2: Element Scoring      -> 16 scorers
 *   Layer 3: Perceptual Calibration -> zone-based weighting + confidence
 *   Layer 4: Goal Scoring         -> goal_scorers.score_goals()
 *   Layer 5: Body-Type Params     -> body_type_parameterization()
 *   Layer 6: Context Modifiers    -> context_modifiers.apply()
 *   Layer 7: Composite            -> weighted aggregation + silhouette dominance
 */

import {
    BodyShape,
    StylingGoal,
    SkinUndertone,
    Silhouette,
    SleeveType,
    ScoreResult,
    PrincipleResult,
    ZoneScore,
    Fix,
    clamp,
    scoreToTen,
    rescaleDisplay,
    hasGoal,
    getGoalWeight,
} from './schemas.mjs';

import {
    GOLDEN_RATIO,
    PRINCIPLE_CONFIDENCE,
    getBustDividingThreshold,
} from './rules_data.mjs';

import {
    resolveFabricProperties,
    runFabricGates,
    getStructuredPenaltyReduction,
} from './fabric_gate.mjs';

import {
    translateHemline,
    translateSleeve,
    translateWaistline,
    translateGarmentToBody,
} from './body_garment_translator.mjs';

import { scoreGoals } from './goal_scorers.mjs';
import { applyContextModifiers } from './context_modifiers.mjs';

import {
    getScorersToSkip,
    getExtraScorerNames,
    isLayerGarment,
    classifyGarment,
    scoreTopHemline,
    scorePantRise,
    scoreLegShape,
    scoreJacketScoring,
    computeLayerModifications,
    TYPE_SCORER_ZONE_MAPPING,
    TYPE_SCORER_WEIGHTS,
} from './garment_types.mjs';

// ================================================================
// UTILITY
// ================================================================

function getNecklineStr(g) {
    return g.neckline?.value || String(g.neckline || '');
}

// hasGoal / getGoalWeight imported from schemas.mjs — supports both
// legacy arrays and weighted {goal, weight} format.
// Call as hasGoal(body.styling_goals, StylingGoal.X)

// ================================================================
// PRINCIPLE SCORERS 1-10 (ported from domain 4 v4)
// ================================================================
// Each scorer: (garment, body) -> { score, reasoning }
// Score: -1.0 to +1.0, Reasoning: pipe-delimited audit trail

function scoreHorizontalStripes(g, b) {
    const R = [];
    let prompt_input_reasoning = [];
    const garmentType = g.garment_type || "garment";
    prompt_input_reasoning.push("Evaluating H-Stripe Thinning: how stripe patterns on this " + garmentType + " create optical effects for your body shape");
    let has_horizontal_stripes = g.has_horizontal_stripes === true;
    let has_vertical_stripes = g.has_vertical_stripes === true;

    R.push("has_horizontal_stripes: " + has_horizontal_stripes + "; has_vertical_stripes: " + has_vertical_stripes + " >> ");
    if ( !has_horizontal_stripes && !has_vertical_stripes) {
        prompt_input_reasoning.push("This " + garmentType + " has no stripe pattern — not applicable");
        return { score: 0.0, reasoning: "No stripes — N/A" };
    }

    // V-stripes-only branch
    if (has_vertical_stripes && !has_horizontal_stripes) {
        let base = -0.05;
        R.push("has_vertical_stripes: " + has_vertical_stripes + "; has_horizontal_stripes: " + has_horizontal_stripes + " >> ");
        R.push("V stripes vs solid: ~5% wider (Thompson 2011) base: " + base + " >> ");
        prompt_input_reasoning.push("Note: Vertical stripes can actually make you appear slightly wider than a solid color (research shows ~5% wider perception), " + base);
        if (b.body_shape === BodyShape.RECTANGLE && g.zone === "torso") {
            base = +0.03;
            R.push("body_shape: " + b.body_shape + "; zone: " + g.zone + " >> ");
            R.push("Rectangle torso: V adds desired shoulder width base+=0.03: " + base + " >> ");
            prompt_input_reasoning.push("Pro: For your rectangle body shape with this " + garmentType + " on your torso, vertical stripes add desired shoulder width to create more defined proportions, +0.03");
        } else if (b.body_shape === BodyShape.INVERTED_TRIANGLE && g.zone === "lower_body") {
            base = -0.08;
            R.push("body_shape: " + b.body_shape + "; zone: " + g.zone + " >> ");
            R.push("INVT lower: V thins already-narrow hips base-=0.08: " + base + " >> ");
            prompt_input_reasoning.push("Con: For your inverted triangle body shape with this " + garmentType + " on your lower body, vertical stripes visually narrow your hips further when you may want to balance them with your broader shoulders, -0.08");
        }
        return { score: clamp(base), reasoning: R.join(" | "), prompt_input_reasoning };
    }

    // H-stripes branch
    let base = +0.03;
    R.push("H stripe base vs solid: +0.03 (Koutsoumpis 2021) base: " + base + " >> ");

    // Body-size gate (Ashida 2013)
    let sizeMod = 0.0;
    if (b.is_plus_size === true) {
        sizeMod = -0.10;
        R.push("is_plus_size: " + b.is_plus_size + " >> ");
        R.push("Plus-size: Helmholtz nullifies/reverses (Ashida) sizeMod: -0.10" + sizeMod + " >> ");
        prompt_input_reasoning.push("Con: For plus-size frames with this " + garmentType + ", horizontal stripes can reverse the slimming illusion and draw more attention to width, -0.10");
    } else if (b.is_petite === true) {
        sizeMod = +0.05;
        R.push("is_petite: " + b.is_petite + " >> ");
        R.push("Petite: Helmholtz amplified on small frames sizeMod: +0.05" + sizeMod + " >> ");
        prompt_input_reasoning.push("Pro: For petite frames with this " + garmentType + ", horizontal stripes create a flattering widening effect that adds visual presence without overwhelming your proportions, +0.05");
    }

    // Zone-split
    let zoneMod = 0.0;
    if (b.body_shape === BodyShape.PEAR) {
        if (g.zone === "torso") {
            zoneMod = +0.08;
            R.push("body_shape: " + b.body_shape + "; zone: " + g.zone + " >> ");
            R.push("Pear top: H adds shoulder width zoneMod: +0.08" + zoneMod + " >> ");
            prompt_input_reasoning.push("Pro: For your pear body shape with this " + garmentType + " on your torso, horizontal stripes add visual width to your shoulders which helps balance your proportions with your curvier lower body, +0.08");
        } else if (g.zone === "lower_body") {
            zoneMod = -0.05;
            R.push("body_shape: " + b.body_shape + "; zone: " + g.zone + " >> ");
            R.push("Pear bottom: attention to hip zone zoneMod: -0.05" + zoneMod + " >> ");
            prompt_input_reasoning.push("Con: For your pear body shape with this " + garmentType + " on your lower body, horizontal stripes draw attention to your hip area which you may prefer to minimize, -0.05");
        }
    } else if (b.body_shape === BodyShape.INVERTED_TRIANGLE) {
        if (g.zone === "torso") {
            zoneMod = -0.12;
            R.push("body_shape: " + b.body_shape + "; zone: " + g.zone + " >> ");
            R.push("INVT top: attention to broad shoulders zoneMod: -0.12" + zoneMod + " >> ");
            prompt_input_reasoning.push("Con: For your inverted triangle body shape with this " + garmentType + " on your torso, horizontal stripes emphasize your already-broad shoulders when you may want to balance them, -0.12");
        } else if (g.zone === "lower_body") {
            zoneMod = +0.10;
            R.push("body_shape: " + b.body_shape + "; zone: " + g.zone + " >> ");
            R.push("INVT bottom: adds hip volume zoneMod: +0.10" + zoneMod + " >> ");
            prompt_input_reasoning.push("Pro: For your inverted triangle body shape with this " + garmentType + " on your lower body, horizontal stripes add visual volume to your hips which creates better balance with your broader shoulders, +0.10");
        }
    } else if (b.body_shape === BodyShape.APPLE) {
        if (g.covers_waist === true) {
            zoneMod = -0.05;
            R.push("body_shape: " + b.body_shape + "; zone: " + g.zone + " >> ");
            R.push("Apple midsection: H width emphasis zoneMod: -0.05" + zoneMod + " >> ");
            prompt_input_reasoning.push("Con: For your apple body shape with this " + garmentType + " covering your midsection, horizontal stripes add visual width to your waist area which you may prefer to minimize, -0.05");
        }
    } else if (b.body_shape === BodyShape.RECTANGLE) {
        zoneMod = +0.05;
        R.push("body_shape: " + b.body_shape + "; zone: " + g.zone + " >> ");
        R.push("Rectangle: H adds visual interest zoneMod: +0.05" + zoneMod + " >> ");
        prompt_input_reasoning.push("Pro: For your rectangle body shape with this " + garmentType + ", horizontal stripes add visual interest and dimension to your naturally straight silhouette, +0.05");
    } else if (b.body_shape === BodyShape.HOURGLASS) {
        zoneMod = +0.03;
        R.push("body_shape: " + b.body_shape + "; zone: " + g.zone + " >> ");
        R.push("Hourglass: standard effect zoneMod: +0.03" + zoneMod + " >> ");
        prompt_input_reasoning.push("Pro: For your hourglass body shape with this " + garmentType + ", horizontal stripes work well with your balanced proportions, +0.03");
    }

    // Stripe width
    let swMod = 0.0;
    if (g.stripe_width_cm != null && g.stripe_width_cm > 0) {
        if (g.stripe_width_cm < 1.0) {
            swMod = +0.03;
            R.push("stripe_width_cm: " + g.stripe_width_cm + " >> ");
            R.push("Fine stripes: stronger illusion swMod: +0.03" + swMod + " >> ");
            prompt_input_reasoning.push("Pro: This " + garmentType + " has fine, narrow stripes which create a more subtle and flattering optical effect, +0.03");
        } else if (g.stripe_width_cm > 2.0 && b.is_plus_size) {
            swMod = -0.05;
            R.push("stripe_width_cm: " + g.stripe_width_cm + " >> ");
            R.push("Wide stripes + plus: measurement markers swMod: -0.05" + swMod + " >> ");
            prompt_input_reasoning.push("Con: For plus-size frames with this " + garmentType + ", the wide stripes can act like measurement markers that emphasize width rather than flatter, -0.05");
        }
    }

    // Dark-stripe luminance
    let lumMod = 0.0;
    if (g.color_lightness != null && g.is_dark && has_horizontal_stripes) {
        lumMod = +0.04;
        R.push("is_dark: " + g.is_dark + "; has_horizontal_stripes: " + g.has_horizontal_stripes + " >> ");
        R.push("Dark H stripes: luminance bonus (Koutsoumpis) lumMod: +0.04" + lumMod + " >> ");
        prompt_input_reasoning.push("Pro: This " + garmentType + " has dark horizontal stripes which combine the slimming effect of dark colors with the pattern's optical benefits, +0.04");
    }

    const total = base + sizeMod + zoneMod + swMod + lumMod;
    R.push(`Final: base=${base.toFixed(2)} + sizeMod=${sizeMod.toFixed(2)} + zoneMod=${zoneMod.toFixed(2)} + swMod=${swMod.toFixed(2)} + lumMod=${lumMod.toFixed(2)} = ${total.toFixed(2)}`);
    return { score: clamp(total), reasoning: R.join(" | "), prompt_input_reasoning: prompt_input_reasoning };
}

function scoreDarkSlimming(g, b) {
    const R = [];
    let prompt_input_reasoning = [];
    const garmentType = g.garment_type || "garment";
    prompt_input_reasoning.push("Evaluating Dark/Black Slimming: how this " + garmentType + "'s color creates visual slimming or expansion effects for your body");

    if (g.color_lightness == null) {
        return { score: 0.0, reasoning: "No color lightness data — N/A" };
    }

    R.push("color_lightness: " + g.color_lightness + " >> ");
    // Light colors (L > 0.65): slight expansion penalty, no body interaction needed
    if (g.color_lightness > 0.65) {
        const penalty = -0.05 * ((g.color_lightness - 0.65) / 0.35);
        R.push(`Light color (L=${g.color_lightness.toFixed(2)}): slight expansion penalty = ${penalty.toFixed(2)}`);
        prompt_input_reasoning.push(`Con: This ${garmentType} has a light color which can visually expand the areas it covers, making them appear slightly larger, ${penalty.toFixed(2)}`);
        return { score: clamp(penalty), reasoning: R.join(" | "), prompt_input_reasoning };
    }

    // Compute base for medium AND dark colors — body modifiers apply to BOTH
    // (Previously medium colors returned early, skipping all body interaction)
    let base;
    if (g.color_lightness >= 0.25) {
        // Medium shades: proportional benefit (smaller than dark, but body type still matters)
        base = 0.15 * (1 - (g.color_lightness - 0.10) / 0.55);
        base = Math.max(0, base);
        R.push(`Mid color (L=${g.color_lightness.toFixed(2)}): base=${base.toFixed(3)} >> `);
        prompt_input_reasoning.push(`Pro: This ${garmentType} has a medium-dark color which provides moderate slimming benefits, +${base.toFixed(2)}`);
    } else {
        // Dark colors: full slimming base
        base = 0.15;
        R.push(`Dark color (L=${g.color_lightness.toFixed(2)}): base slimming +0.15 >> `);
        prompt_input_reasoning.push(`Pro: This ${garmentType} has a dark color which absorbs light and creates a slimming visual effect, +0.15`);
    }

    let btMult = 1.0;
    R.push("btMult Initial value: " + btMult + " >> ");
    if (b.is_petite && g.zone === "full_body") {
        btMult = 0.6;
        R.push("is_petite: " + b.is_petite + "; zone: " + g.zone + " >> ");
        R.push(`Petite all-dark: height collapse (x0.6) btMult: ${btMult} >> `);
        prompt_input_reasoning.push("Con: For petite frames with this full-body dark " + garmentType + ", an all-dark look can visually compress your height and make you appear shorter than you are, (x0.6)");
    } else if (b.is_petite && g.zone !== "full_body") {
        btMult = 0.9;
        R.push("is_petite: " + b.is_petite + "; zone: " + g.zone + " >> ");
        R.push(`Petite zone-dark: mild reduction (x0.9) btMult: ${btMult} >> `);
        prompt_input_reasoning.push("Note: For petite frames with this dark " + garmentType + " on part of your body, the slimming effect is slightly reduced to avoid overwhelming your proportions, (x0.9)");
    } else if (b.is_tall) {
        btMult = 1.2;
        R.push("is_tall: " + b.is_tall + " >> ");
        R.push(`Tall: amplified lean silhouette (x1.2) btMult: ${btMult} >> `);
        prompt_input_reasoning.push("Pro: For tall frames with this dark " + garmentType + ", the dark color amplifies your naturally elongated silhouette for an elegant, lean look, (x1.2)");
    } else if (b.body_shape === BodyShape.INVERTED_TRIANGLE && g.zone === "torso") {
        btMult = 1.4;
        R.push("body_shape: " + b.body_shape + "; zone: " + g.zone + " >> ");
        R.push(`INVT upper body: maximum shoulder reduction (x1.4) btMult: ${btMult} >> `);
        prompt_input_reasoning.push("Pro: For your inverted triangle body shape with this dark " + garmentType + " on your torso, the dark color visually minimizes your broader shoulders to create better balance, (x1.4)");
    } else if (b.body_shape === BodyShape.HOURGLASS) {
        btMult = 0.7;
        R.push("body_shape: " + b.body_shape + "; zone: " + g.zone + " >> ");
        R.push(`Hourglass: dark flattens curves (x0.7) btMult: ${btMult} >> `);
        prompt_input_reasoning.push("Con: For your hourglass body shape with this dark " + garmentType + ", very dark colors can flatten your beautiful curves rather than celebrating them, (x0.7)");
    }

    let skinMult = 1.0;
    R.push("skinMult Initial value: " + skinMult + " >> ");
    if (g.zone === "torso" || g.zone === "full_body") {
        R.push("zone: " + g.zone + "; skin_undertone: " + b.skin_undertone + "; skin_darkness: " + b.skin_darkness + " >> ");
        if (b.skin_undertone === SkinUndertone.WARM) {
            const sallowStrength = Math.max(0.0, 1.0 - (g.color_lightness / 0.22));
            skinMult = 1.0 - sallowStrength;
            R.push(`Warm undertone near face: sallow x${sallowStrength.toFixed(2)} skinMult: ${skinMult} >> `);
            if (skinMult < 0.3) {
                R.push("RECOMMEND: dark chocolate brown or burgundy");
            }
            prompt_input_reasoning.push(`Con: With your warm skin undertone, this very dark ${garmentType} near your face can create a slightly sallow or washed-out effect — consider dark brown or burgundy instead, (x${skinMult.toFixed(2)})`);
        } else if (b.skin_darkness > 0.7) {
            skinMult = 0.5;
            R.push("Dark skin + dark: low contrast (x0.5)");
            prompt_input_reasoning.push("Con: With your deeper skin tone and this dark " + garmentType + ", there's less contrast which reduces the slimming benefit — a slightly lighter shade might be more flattering, (x0.5)");
        }
    }

    let sheenPenalty = 0.0;
    R.push("sheenPenalty Initial value: " + sheenPenalty + " >> ");
    const si = g.sheen_index;
    if (si != null && si > 0.5) {
        sheenPenalty = -0.15 * ((si - 0.5) / 0.5);
        R.push("sheen_index: " + si + " >> ");
        R.push("body_shape: " + b.body_shape + "; is_plus_size: " + b.is_plus_size + " >> ");
        if (b.body_shape === BodyShape.APPLE || b.is_plus_size) {
            sheenPenalty *= 1.5;
            R.push(`Apple/Plus + high sheen: amplified specular penalty sheenPenalty: ${sheenPenalty} >> `);
            prompt_input_reasoning.push(`Con: For your body type with this shiny dark ${garmentType}, the fabric's sheen reflects light and can highlight areas you may want to minimize, ${sheenPenalty.toFixed(2)}`);
        } else {
            R.push(`High sheen (SI=${si.toFixed(2)}): specular invert sheenPenalty: ${sheenPenalty * 1.5} >> `);
            prompt_input_reasoning.push(`Con: This ${garmentType}'s shiny finish reduces the slimming effect of the dark color by reflecting light back, ${sheenPenalty.toFixed(2)}`);
        }
    }

    const score = base * btMult * Math.max(skinMult, 0.0) + sheenPenalty;
    return { score: clamp(score), reasoning: R.join(" | "), prompt_input_reasoning };
}

function scoreRiseElongation(g, b) {
    const R = [];
    let prompt_input_reasoning = [];
    const garmentType = g.garment_type || "garment";
    prompt_input_reasoning.push("Evaluating Rise Elongation: how this " + garmentType + "'s rise placement affects your leg-to-torso proportions");

    R.push("rise_cm: " + g.rise_cm + " >> ");
    if (g.rise_cm == null) {
        prompt_input_reasoning.push("This " + garmentType + " has no rise data — not applicable for this analysis");
        return { score: 0.0, reasoning: "No rise data — N/A", prompt_input_reasoning };
    }

    const MID_RISE = 20.0;
    const riseDelta = g.rise_cm - MID_RISE;
    let base = clamp(riseDelta * 0.015, -0.20, +0.20);
    R.push(`Rise ${g.rise_cm.toFixed(0)}cm: base ${base >= 0 ? '+' : ''}${base.toFixed(3)} base: ${base} >> `);

    R.push("is_petite: " + b.is_petite + "; torso_score: " + b.torso_score + " >> ");
    if (b.is_petite) {
        if (b.torso_score <= -1.0 && g.rise_cm > 26) {
            R.push("Petite + short torso + high rise: INVERTED torso_score: " + b.torso_score + " >> ");
            prompt_input_reasoning.push("Con: For petite frames with a shorter torso like yours, this high-rise " + garmentType + " visually shortens your torso even more, making you appear less balanced, -0.30");
            return { score: clamp(-0.30), reasoning: R.join(" | "), prompt_input_reasoning };
        } else if (b.torso_score >= 1.0) {
            base *= 1.5;
            R.push(`Petite + long torso: amplified (x1.5) base: ${base} >> `);
            prompt_input_reasoning.push("Pro: For petite frames with a longer torso like yours, this " + garmentType + "'s rise helps balance your proportions by visually elongating your legs, (x1.5)");
        } else {
            base *= 1.3;
            R.push(`Petite + proportional: amplified (x1.3) base: ${base} >> `);
            prompt_input_reasoning.push("Pro: For petite frames with this " + garmentType + ", the rise placement can significantly help elongate your silhouette, (x1.3)");
        }
    }

    R.push("is_tall: " + b.is_tall + " >> ");
    if (b.is_tall) {
        base *= 0.5;
        R.push(`Tall: diminishing returns (x0.5) base: ${base} >> `);
        prompt_input_reasoning.push("Note: For tall frames with this " + garmentType + ", rise placement matters less since you already have natural vertical length, (x0.5)");
    }

    R.push("body_shape: " + b.body_shape + "; is_plus_size: " + b.is_plus_size + "; belly_zone: " + b.belly_zone + " >> ");
    if ((b.body_shape === BodyShape.APPLE || b.is_plus_size) && b.belly_zone > 0.3) {
        if (g.waistband_width_cm >= 5.0 && g.waistband_stretch_pct >= 8.0) {
            base += 0.10;
            R.push(`Wide elastic waistband: smooth containment (+0.10) base: ${base} >> `);
            prompt_input_reasoning.push("Pro: For your body type with this " + garmentType + ", the wide elastic waistband provides comfortable smoothing without digging in, +0.10");
        } else if (g.waistband_width_cm < 3.0 && g.waistband_stretch_pct < 5.0) {
            R.push(`Narrow rigid waistband: muffin top -> -0.25 base: ${base} >> `);
            prompt_input_reasoning.push("Con: For your body type with this " + garmentType + ", the narrow rigid waistband can create an uncomfortable fit that may cause visible bulging at the waist, -0.25");
            return { score: clamp(-0.25), reasoning: R.join(" | "), prompt_input_reasoning };
        }
    }

    if (b.body_shape === BodyShape.HOURGLASS && g.rise_cm && g.rise_cm > 24) {
        base += 0.03;
        R.push(`Hourglass + high rise: smooth waist-to-hip (+0.03) base: ${base} >> `);
        prompt_input_reasoning.push("Pro: For your hourglass body shape with this high-rise " + garmentType + ", the waistband sits at your natural waist and creates a smooth line from waist to hip, +0.03");
    }

    if (b.body_shape === BodyShape.INVERTED_TRIANGLE) {
        if (g.rise_cm && g.rise_cm > 26 && g.expansion_rate < 0.03) {
            base *= 0.6;
            R.push(`INVT + high rise + slim leg (x0.6) base: ${base} >> `);
            prompt_input_reasoning.push("Con: For your inverted triangle body shape with this high-rise slim " + garmentType + ", the combination can emphasize the contrast between your broader upper body and narrower lower body, (x0.6)");
        }
    }

    return { score: clamp(base), reasoning: R.join(" | "), prompt_input_reasoning };
}

function scoreAlineBalance(g, b) {
    const R = [];
    let prompt_input_reasoning = [];
    const garmentType = g.garment_type || "garment";
    prompt_input_reasoning.push("Evaluating A-Line Balance: how this " + garmentType + "'s A-line silhouette creates balance and flatters your figure");

    R.push("expansion_rate: " + g.expansion_rate + " >> ");
    if (g.expansion_rate == null) {
        return { score: 0.0, reasoning: "No expansion rate data — N/A" };
    }

    if (g.expansion_rate < 0.03) {
        prompt_input_reasoning.push("This " + garmentType + " doesn't have enough flare to be considered an A-line silhouette — not applicable");
        return { score: 0.0, reasoning: "ER < 0.03: not A-line — N/A", prompt_input_reasoning };
    }

    const er = g.expansion_rate;
    let base;
    if (er <= 0.06) {
        base = 0.10 + (er - 0.03) * (0.15 / 0.03);
        prompt_input_reasoning.push("Pro: This " + garmentType + " has a subtle A-line flare that creates gentle shape without overwhelming, +" + base.toFixed(2));
    } else if (er <= 0.12) {
        base = 0.25;
        prompt_input_reasoning.push("Pro: This " + garmentType + " has an ideal A-line flare that skims over hips and creates a universally flattering shape, +0.25");
    } else if (er <= 0.18) {
        base = 0.25 - (er - 0.12) * (0.15 / 0.06);
        prompt_input_reasoning.push("Note: This " + garmentType + " has a dramatic A-line flare which works better on some body types than others, +" + base.toFixed(2));
    } else {
        base = Math.max(-0.10, 0.10 - (er - 0.18) * (0.10 / 0.12));
        prompt_input_reasoning.push("Con: This " + garmentType + " has an extreme A-line flare that can add too much volume and overwhelm proportions, " + base.toFixed(2));
    }
    R.push(`ER=${er.toFixed(2)}: base A-line = ${base >= 0 ? '+' : ''}${base.toFixed(2)} base: ${base} >> `);

    const dc = g.drape != null ? g.drape_coefficient : null;  // drape_coefficient = drape*10, NaN when drape is null
    R.push("drape_coefficient: " + dc + " >> ");
    let drapeMult = 1.0;
    if (dc != null && !isNaN(dc)) {
        if (dc < 40) {
            R.push(`DC=${dc.toFixed(0)}% (drapey): full benefit`);
            prompt_input_reasoning.push("Pro: This " + garmentType + " has a drapey fabric that flows beautifully in an A-line shape, maximizing the flattering effect");
        } else if (dc < 65) {
            drapeMult = 0.7;
            R.push(`DC=${dc.toFixed(0)}% (medium): x0.7`);
            prompt_input_reasoning.push("Note: This " + garmentType + " has a medium-weight fabric which somewhat limits the A-line's ability to flow and skim, (x0.7)");
        } else {
            drapeMult = -0.5;
            R.push(`DC=${dc.toFixed(0)}% (stiff): shelf effect INVERSION`);
            prompt_input_reasoning.push("Con: This " + garmentType + " has a stiff fabric that creates a 'shelf effect' at the hips rather than flowing smoothly over them");
        }
    } else {
        R.push("DC=unknown: assuming neutral drape");
    }

    let btMod = 0.0;
    R.push("body_shape: " + b.body_shape + "; is_tall: " + b.is_tall + "; is_petite: " + b.is_petite + "; body_shape: " + b.body_shape + " >> ");
    if (b.body_shape === BodyShape.INVERTED_TRIANGLE) {
        btMod = +0.15;
        R.push("INVT: max A-line benefit (+0.15)");
        prompt_input_reasoning.push("Pro: For your inverted triangle body shape with this " + garmentType + ", the A-line silhouette is ideal — it adds visual volume to your lower body to balance your broader shoulders, +0.15");
    } else if (b.is_tall) {
        btMod = +0.10;
        R.push("Tall: carries volume (+0.10)");
        prompt_input_reasoning.push("Pro: For tall frames with this " + garmentType + ", your height allows you to carry the A-line volume beautifully without being overwhelmed, +0.10");
    } else if (b.is_petite) {
        btMod = er > 0.12 ? -0.15 : +0.05;
        R.push(`Petite: ${er > 0.12 ? 'overwhelms frame' : 'scale-appropriate'}`);
        prompt_input_reasoning.push(er > 0.12
            ? "Con: For petite frames with this " + garmentType + ", the dramatic A-line flare can overwhelm your smaller proportions, -0.15"
            : "Pro: For petite frames with this " + garmentType + ", the subtle A-line flare is well-proportioned for your frame, +0.05");
    } else if (b.body_shape === BodyShape.HOURGLASS) {
        btMod = +0.05;
        R.push("HOURGLASS: (+0.05)");
        prompt_input_reasoning.push("Pro: For your hourglass body shape with this " + garmentType + ", the A-line silhouette complements your natural curves, +0.05");
    } else if (b.body_shape === BodyShape.PEAR) {
        btMod = +0.05;
        R.push("PEAR: (+0.05)");
        prompt_input_reasoning.push("Pro: For your pear body shape with this " + garmentType + ", the A-line silhouette skims over your hips rather than clinging to them, +0.05");
    } else if (b.body_shape === BodyShape.APPLE) {
        btMod = +0.03;
        R.push("APPLE: (+0.03)");
        prompt_input_reasoning.push("Pro: For your apple body shape with this " + garmentType + ", the A-line silhouette flows away from your midsection to create a smooth line, +0.03");
    }

    R.push("is_plus_size: " + b.is_plus_size + "; drapeMult: " + drapeMult + " >> ");
    if (b.is_plus_size && drapeMult < 0) {
        drapeMult *= 1.5;
        R.push("Plus + stiff A-line: shelf amplified");
        prompt_input_reasoning.push("Con: For plus-size frames with this stiff A-line " + garmentType + ", the fabric creates a more pronounced shelf effect at the hips rather than flowing smoothly");
    }

    let hemMod = 0.0;
    R.push("body_shape: " + b.body_shape + "; hem_position: " + g.hem_position + " >> ");
    if (b.body_shape === BodyShape.PEAR) {
        if (g.hem_position === "mid_thigh") {
            hemMod = -0.10;
            R.push("PEAR: mid_thigh: -0.10");
            prompt_input_reasoning.push("Con: For your pear body shape with this " + garmentType + " ending at mid-thigh, the hemline falls at the widest part of your hips which can emphasize rather than flatter, -0.10");
        } else if (g.hem_position === "knee") {
            hemMod = +0.05;
            R.push("PEAR: knee: +0.05");
            prompt_input_reasoning.push("Pro: For your pear body shape with this " + garmentType + " ending at the knee, the hemline falls past your widest point for a more balanced look, +0.05");
        }
    }

    const score = base * Math.max(drapeMult, -1.0) + btMod + hemMod;
    return { score: clamp(score), reasoning: R.join(" | "), prompt_input_reasoning };
}

function scoreTentConcealment(g, b) {
    const R = [];
    let prompt_input_reasoning = [];
    const garmentType = g.garment_type || "garment";
    prompt_input_reasoning.push("Evaluating Tent Concealment: how this " + garmentType + "'s loose silhouette balances coverage with how it affects perceived size");

    R.push("expansion_rate: " + g.expansion_rate + " >> ");
    if (g.expansion_rate == null) {
        return { score: 0.0, reasoning: "No expansion rate data — N/A" };
    }

    // Semi-fitted optimal zone
    R.push("body_shape: " + b.body_shape + "; is_plus_size: " + b.is_plus_size + "; is_structured: " + g.is_structured + " >> ");
    if (g.expansion_rate >= 0.03 && g.expansion_rate <= 0.08) {
        let score = +0.15;
        R.push(`ER=${g.expansion_rate.toFixed(2)}: semi-fitted optimal`);
        prompt_input_reasoning.push("Pro: This " + garmentType + " has a semi-fitted silhouette that skims your body without being too tight or too loose — an ideal balance, +0.15");
        if (b.body_shape === BodyShape.HOURGLASS) {
            score = +0.05;
            R.push("Hourglass: semi-fitted slightly masks curves");
            prompt_input_reasoning.push("Note: For your hourglass body shape with this semi-fitted " + garmentType + ", the relaxed fit doesn't fully showcase your curves but still looks flattering, +0.05");
        }
        if (b.is_plus_size && g.is_structured) {
            score = +0.20;
            R.push("Plus + structured semi-fitted: smooth containment");
            prompt_input_reasoning.push("Pro: For plus-size frames with this structured semi-fitted " + garmentType + ", the combination smooths your silhouette while providing comfortable coverage, +0.20");
        }
        return { score: clamp(score), reasoning: R.join(" | "), prompt_input_reasoning };
    }

    if (g.expansion_rate < 0.12) {
        R.push("ER < 0.12: not tent — N/A");
        return { score: 0.0, reasoning: `ER=${g.expansion_rate.toFixed(2)}: not tent — N/A` };
    }

    const er = g.expansion_rate;

    // Goal analysis
    const hasConcealment = hasGoal(b.styling_goals, StylingGoal.CONCEALMENT) || hasGoal(b.styling_goals, StylingGoal.HIDE_MIDSECTION);
    const hasSlimming = hasGoal(b.styling_goals, StylingGoal.SLIMMING) || hasGoal(b.styling_goals, StylingGoal.SLIM_HIPS);
    const wantsDefinition = hasGoal(b.styling_goals, StylingGoal.HIGHLIGHT_WAIST) || hasGoal(b.styling_goals, StylingGoal.EMPHASIS);
    R.push("hasConcealment: " + hasConcealment + "; hasSlimming: " + hasSlimming + "; wantsDefinition: " + wantsDefinition + " >> ");

    let base;
    if (wantsDefinition && !hasConcealment) {
        // Tent actively works AGAINST definition goals (highlight_waist, create_curves, show_legs)
        base = er > 0.20 ? -0.55 : -0.35;
        R.push(`ANTI-GOAL: wants body definition, tent hides it (${base >= 0 ? '+' : ''}${base.toFixed(2)})`);
        prompt_input_reasoning.push(`Con: This loose ${garmentType} works against your goal to highlight your shape — the tent-like silhouette hides the body definition you want to show, ${base.toFixed(2)}`);
    } else if (hasConcealment && !hasSlimming) {
        base = er > 0.20 ? +0.35 : +0.25;
        R.push(`Goal=concealment: excellent hiding (${base >= 0 ? '+' : ''}${base.toFixed(2)})`);
        prompt_input_reasoning.push(`Pro: This loose ${garmentType} aligns perfectly with your goal for coverage — it provides excellent concealment of areas you want to minimize attention to, +${base.toFixed(2)}`);
    } else if (hasSlimming && !hasConcealment) {
        base = er > 0.20 ? -0.40 : -0.20;
        R.push(`Goal=slimming: perceived bigger (${base >= 0 ? '+' : ''}${base.toFixed(2)})`);
        R.push("CONCEALMENT PARADOX: hides contours but amplifies size");
        prompt_input_reasoning.push(`Con: This loose ${garmentType} creates a paradox for your slimming goal — while it hides your contours, the extra volume can make you appear larger than you are, ${base.toFixed(2)}`);
    } else {
        const concealment = er > 0.20 ? 0.35 : 0.25;
        const slimming = er > 0.20 ? -0.40 : -0.20;
        base = concealment * 0.3 + slimming * 0.7;
        R.push(`Goal=balance: weighted toward slimming (${base >= 0 ? '+' : ''}${base.toFixed(2)})`);
    }

    // Body-type reversals
    let btMod = 0.0;
    R.push("body_shape: " + b.body_shape + "; is_petite: " + b.is_petite + "; is_plus_size: " + b.is_plus_size + "; is_tall: " + b.is_tall);
    if (b.body_shape === BodyShape.HOURGLASS) {
        btMod = -0.20;
        R.push("HOURGLASS REVERSAL: tent destroys WHR (-0.20)");
        prompt_input_reasoning.push("Con: For your hourglass body shape with this loose " + garmentType + ", the tent-like silhouette completely hides your beautiful waist-to-hip ratio — one of your most flattering features, -0.20");
    } else if (b.is_petite) {
        btMod = -0.15;
        R.push("PETITE REVERSAL: fabric overwhelms frame (-0.15)");
        prompt_input_reasoning.push("Con: For petite frames with this voluminous " + garmentType + ", the excess fabric can overwhelm your smaller proportions and make you appear lost in the garment, -0.15");
    } else if (b.is_plus_size) {
        btMod = -0.10;
        R.push("PLUS REVERSAL: max size overestimate (-0.10)");
        prompt_input_reasoning.push("Con: For plus-size frames with this loose " + garmentType + ", the shapeless silhouette can make you appear larger than you are by adding perceived volume, -0.10");
    } else if (b.body_shape === BodyShape.INVERTED_TRIANGLE) {
        btMod = -0.10;
        R.push("INVT: lampshade from shoulders (-0.10)");
        prompt_input_reasoning.push("Con: For your inverted triangle body shape with this loose " + garmentType + ", the fabric can drape from your broader shoulders creating a lampshade-like effect, -0.10");
    } else if (b.is_tall) {
        btMod = +0.10;
        R.push("Tall: carries volume (+0.10)");
        prompt_input_reasoning.push("Pro: For tall frames with this loose " + garmentType + ", your height allows you to carry the extra volume gracefully without being overwhelmed, +0.10");
    } else if (b.body_shape === BodyShape.RECTANGLE) {
        btMod = +0.05;
        R.push("Rectangle: less curve to hide (+0.05)");
        prompt_input_reasoning.push("Pro: For your rectangle body shape with this loose " + garmentType + ", you have fewer curves that would benefit from definition, so the relaxed fit works naturally, +0.05");
    }

    // Petite + height goal conflict: tent volume overwhelms short frame
    if (b.is_petite && hasGoal(b.styling_goals, StylingGoal.LOOK_TALLER)) {
        btMod -= 0.15;
        R.push("PETITE+TALLER: tent volume works against height goal (-0.15 additional)");
        prompt_input_reasoning.push("Con: For petite frames trying to look taller with this voluminous " + garmentType + ", the extra fabric adds horizontal visual weight that works directly against your height goal, -0.15");
    }

    return { score: clamp(base + btMod), reasoning: R.join(" | "), prompt_input_reasoning };
}

function scoreColorBreak(g, b) {
    const R = [];
    let prompt_input_reasoning = [];
    const garmentType = g.garment_type || "garment";
    prompt_input_reasoning.push("Evaluating Color Break: how belts or color breaks on this " + garmentType + " affect your visual proportions");

    R.push("has_contrasting_belt: " + g.has_contrasting_belt + "; has_tonal_belt: " + g.has_tonal_belt + " >> ");
    if (!g.has_contrasting_belt && !g.has_tonal_belt) {
        R.push("No belt/break — N/A");
        prompt_input_reasoning.push("This " + garmentType + " has no belt or color break — not applicable for this analysis");
        return { score: 0.0, reasoning: "No belt/break — N/A", prompt_input_reasoning };
    }

    if (g.has_tonal_belt && !g.has_contrasting_belt) {
        R.push("Tonal belt: mild break (-0.03)");
        prompt_input_reasoning.push("Note: This " + garmentType + " has a tonal (same-color) belt which creates only a subtle visual break — minimal impact on proportions, -0.03");
        return { score: -0.03, reasoning: "Tonal belt: mild break (-0.03)", prompt_input_reasoning };
    }

    let base = -0.10;
    R.push("Contrasting belt: base leg shortening -0.10");

    if (b.body_shape === BodyShape.HOURGLASS) {
        const score = g.belt_width_cm >= 5 ? +0.25 : +0.20;
        R.push(`HOURGLASS REVERSAL: belt highlights waist (${score >= 0 ? '+' : ''}${score.toFixed(2)})`);
        prompt_input_reasoning.push(`Pro: For your hourglass body shape with this belted ${garmentType}, the contrasting belt beautifully highlights your defined waist — one of your most flattering features, +${score.toFixed(2)}`);
        return { score: clamp(score), reasoning: R.join(" | "), prompt_input_reasoning };
    }

    R.push("body_shape: " + b.body_shape + "; is_petite: " + b.is_petite + "; is_tall: " + b.is_tall + " >> ");
    if (b.is_petite) {
        base *= 1.5;
        R.push("Petite: can't afford shortening (x1.5)");
        prompt_input_reasoning.push("Con: For petite frames with this belted " + garmentType + ", the contrasting belt visually cuts your body in half and makes your legs appear shorter — an effect you want to avoid, (x1.5)");
    } else if (b.body_shape === BodyShape.APPLE) {
        base = -0.25;
        R.push("Apple: belt spotlights widest zone (-0.25)");
        prompt_input_reasoning.push("Con: For your apple body shape with this belted " + garmentType + ", the belt draws attention to your midsection — typically the area you'd prefer to minimize, -0.25");
    } else if (b.is_tall) {
        base *= 0.3;
        R.push("Tall: can afford shortening (x0.3)");
        prompt_input_reasoning.push("Pro: For tall frames with this belted " + garmentType + ", you can easily wear a contrasting belt since you have plenty of vertical length to spare, (x0.3)");
    } else if (b.body_shape === BodyShape.INVERTED_TRIANGLE) {
        base = +0.08;
        R.push("INVT: draws eye to waist (+0.08)");
        prompt_input_reasoning.push("Pro: For your inverted triangle body shape with this belted " + garmentType + ", the belt draws the eye to your waist and away from your broader shoulders, +0.08");
    } else if (b.body_shape === BodyShape.RECTANGLE) {
        base = +0.05;
        R.push("Rectangle: creates waist definition (+0.05)");
        prompt_input_reasoning.push("Pro: For your rectangle body shape with this belted " + garmentType + ", the belt creates the appearance of a more defined waist on your naturally straight silhouette, +0.05");
    } else if (b.body_shape === BodyShape.PEAR) {
        if (b.whr < 0.75) {
            base = +0.05;
            R.push(`Pear + narrow waist (WHR=${b.whr.toFixed(2)}): +0.05`);
            prompt_input_reasoning.push("Pro: For your pear body shape with this belted " + garmentType + ", since you have a nicely defined waist, the belt highlights this flattering feature, +0.05");
        } else {
            base = -0.10;
            R.push("Pear + moderate waist: -0.10");
            prompt_input_reasoning.push("Con: For your pear body shape with this belted " + garmentType + ", the belt may draw attention to your midsection rather than your narrowest point, -0.10");
        }
    }

    if (b.is_plus_size) {
        if (b.belly_zone > 0.5) {
            base = Math.min(base, -0.20);
            R.push("Plus + belly: belt at widest (-0.20)");
            prompt_input_reasoning.push("Con: For plus-size frames with this belted " + garmentType + ", the belt sits at a wider part of your midsection which can draw unwanted attention there, -0.20");
        } else if (b.belly_zone < 0.2) {
            base = Math.max(base, +0.05);
            R.push("Plus + no belly: belt creates waist (+0.05)");
            prompt_input_reasoning.push("Pro: For plus-size frames with this belted " + garmentType + ", since your midsection is relatively flat, the belt helps define your waist nicely, +0.05");
        }
    }

    return { score: clamp(base), reasoning: R.join(" | "), prompt_input_reasoning };
}

function scoreBodyconMapping(g, b) {
    const R = [];
    let prompt_input_reasoning = [];
    const garmentType = g.garment_type || "garment";
    prompt_input_reasoning.push("Evaluating Bodycon Mapping: how this body-hugging " + garmentType + " works with your body shape and whether the fabric provides support");

    R.push("expansion_rate: " + g.expansion_rate + " >> ");
    if(g.expansion_rate == null) {
        R.push("No expansion rate data — N/A");
        return { score: 0.0, reasoning: "No expansion rate data — N/A" };
    }

    if (g.expansion_rate > 0.03) {
        R.push("ER > 0.03: not bodycon — N/A");
        prompt_input_reasoning.push("This " + garmentType + " isn't body-hugging (bodycon) — not applicable for this analysis");
        return { score: 0.0, reasoning: `ER=${g.expansion_rate.toFixed(2)}: not bodycon — N/A`, prompt_input_reasoning };
    }

    R.push("gsm_estimated: " + g.gsm_estimated + "; is_structured: " + g.is_structured + " >> ");
    const isThin = g.gsm_estimated < 200 && !g.is_structured;
    const isStructured = g.gsm_estimated >= 250 || g.is_structured;
    R.push("isThin: " + isThin + "; isStructured: " + isStructured + " >> ");

    R.push("body_shape: " + b.body_shape + "; is_athletic: " + b.is_athletic + "; belly_zone: " + b.belly_zone + " >> ");
    if (b.body_shape === BodyShape.HOURGLASS) {
        let score = isStructured ? +0.35 : +0.30;
        R.push(`HOURGLASS REVERSAL: bodycon maps best feature (${score >= 0 ? '+' : ''}${score.toFixed(2)})`);
        prompt_input_reasoning.push(`Pro: For your hourglass body shape with this fitted ${garmentType}, a body-hugging silhouette beautifully showcases your balanced curves — this is your style sweet spot, +${score.toFixed(2)}`);
        if (b.belly_zone > 0.5) {
            score -= 0.15;
            R.push("Belly concern offset (-0.15)");
            prompt_input_reasoning.push("Con: However, the tight fit may highlight your midsection which you may prefer to minimize, -0.15");
        }
        return { score: clamp(score), reasoning: R.join(" | "), prompt_input_reasoning };
    }

    if (b.body_shape === BodyShape.APPLE) {
        if (b.is_athletic) {
            prompt_input_reasoning.push("Pro: For your athletic apple body shape with this fitted " + garmentType + ", your toned physique is beautifully showcased by the body-hugging silhouette, +0.20");
            return { score: clamp(+0.20), reasoning: "Athletic apple: showcases tone (+0.20)", prompt_input_reasoning };
        }
        const score = isThin ? -0.40 : -0.12;
        R.push(`Apple + ${isThin ? 'thin' : 'structured'} bodycon: ${score >= 0 ? '+' : ''}${score.toFixed(2)}`);
        prompt_input_reasoning.push(isThin
            ? `Con: For your apple body shape with this thin fitted ${garmentType}, the clingy fabric highlights your midsection without providing smoothing support, ${score.toFixed(2)}`
            : `Con: For your apple body shape with this structured fitted ${garmentType}, while the fabric provides some support, the tight fit still draws attention to your midsection, ${score.toFixed(2)}`);
        return { score: clamp(score), reasoning: R.join(" | "), prompt_input_reasoning };
    }

    if (b.body_shape === BodyShape.PEAR) {
        const score = isThin ? -0.30 : -0.09;
        R.push(`Pear + ${isThin ? 'thin' : 'structured'}: ${score >= 0 ? '+' : ''}${score.toFixed(2)}`);
        prompt_input_reasoning.push(isThin
            ? `Con: For your pear body shape with this thin fitted ${garmentType}, the clingy fabric clings to your hips and thighs which you may want to draw less attention to, ${score.toFixed(2)}`
            : `Con: For your pear body shape with this fitted ${garmentType}, while the structured fabric helps, the tight silhouette still emphasizes your curvier lower body, ${score.toFixed(2)}`);
        return { score: clamp(score), reasoning: R.join(" | "), prompt_input_reasoning };
    }

    R.push("is_plus_size: " + b.is_plus_size + " >> ");
    if (b.is_plus_size) {
        const score = isThin ? -0.40 : -0.05;
        R.push(`Plus + ${isThin ? 'thin' : 'structured (sculpts)'}: ${score >= 0 ? '+' : ''}${score.toFixed(2)}`);
        prompt_input_reasoning.push(isThin
            ? `Con: For plus-size frames with this thin fitted ${garmentType}, the clingy fabric can highlight every curve and contour without providing any smoothing effect, ${score.toFixed(2)}`
            : `Note: For plus-size frames with this structured fitted ${garmentType}, the supportive fabric helps sculpt and smooth your silhouette, ${score.toFixed(2)}`);
        return { score: clamp(score), reasoning: R.join(" | "), prompt_input_reasoning };
    }

    R.push("zone: " + g.zone + " >> ");
    if (b.body_shape === BodyShape.INVERTED_TRIANGLE) {
        let score;
        if (g.zone === "full_body") {
            score = -0.15;
            prompt_input_reasoning.push("Con: For your inverted triangle body shape with this full-body fitted " + garmentType + ", the tight fit emphasizes the contrast between your broader upper body and narrower lower body, -0.15");
        } else if (g.zone === "lower_body") {
            score = -0.05;
            prompt_input_reasoning.push("Note: For your inverted triangle body shape with this fitted " + garmentType + " on your lower body, the tight fit on your narrower hips is mostly neutral, -0.05");
        } else {
            score = -0.10;
            prompt_input_reasoning.push("Con: For your inverted triangle body shape with this fitted " + garmentType + " on your torso, the tight fit can emphasize your broader shoulders, -0.10");
        }
        R.push(`INVT bodycon ${g.zone}: ${score >= 0 ? '+' : ''}${score.toFixed(2)}`);
        return { score: clamp(score), reasoning: R.join(" | "), prompt_input_reasoning };
    }

    if (b.body_shape === BodyShape.RECTANGLE) {
        // Bodycon on rectangle: tube effect when low bust-waist differential
        const bd = b.bust_differential ?? 10;
        if (bd < 10) {
            // Low differential = minimal curves = tube silhouette
            const score = isThin ? -0.35 : -0.12;
            R.push(`Rectangle + bodycon: tube effect (BD=${bd.toFixed(1)}cm, ${isThin ? 'thin fabric' : 'structured'}): ${score >= 0 ? '+' : ''}${score.toFixed(2)}`);
            prompt_input_reasoning.push(`Con: For your rectangle body shape with this fitted ${garmentType}, the body-hugging silhouette can create a straight 'tube' effect without showcasing any curves, ${score.toFixed(2)}`);
            return { score: clamp(score), reasoning: R.join(" | "), prompt_input_reasoning };
        }
        R.push("Rectangle + bodycon: adequate bust definition, neutral");
        prompt_input_reasoning.push("Note: For your rectangle body shape with this fitted " + garmentType + ", you have enough natural definition that the bodycon fit works reasonably well");
        return { score: 0.0, reasoning: R.join(" | "), prompt_input_reasoning };
    }

    prompt_input_reasoning.push("Note: This fitted " + garmentType + " has a body-hugging silhouette which works for some body types better than others, -0.10");
    return { score: clamp(-0.10), reasoning: "Default bodycon: mild penalty", prompt_input_reasoning };
}

function scoreMatteZone(g, b) {
    const R = [];
    let prompt_input_reasoning = [];
    const garmentType = g.garment_type || "garment";
    prompt_input_reasoning.push("Evaluating Matte Zone: how this " + garmentType + "'s fabric sheen (matte vs shiny) affects perceived body volume");

    const si = g.sheen_index;
    R.push("sheen_index: " + si + " >> ");

    let base;
    if (si < 0.15) {
        base = +0.08;
        R.push(`Deeply matte (SI=${si.toFixed(2)}): +0.08`);
        prompt_input_reasoning.push("Pro: This " + garmentType + " has a deeply matte fabric that absorbs light rather than reflecting it, creating a slimming effect, +0.08");
    } else if (si < 0.35) {
        base = +0.08 * (1 - (si - 0.15) / 0.20);
        R.push(`Low sheen (SI=${si.toFixed(2)}): ${base >= 0 ? '+' : ''}${base.toFixed(3)}`);
        prompt_input_reasoning.push(`Pro: This ${garmentType} has a low-sheen fabric that minimizes light reflection for a flattering effect, +${base.toFixed(3)}`);
    } else if (si <= 0.50) {
        base = 0.0;
        R.push(`Neutral sheen (SI=${si.toFixed(2)})`);
        prompt_input_reasoning.push("Note: This " + garmentType + " has a neutral sheen level — neither particularly matte nor shiny");
    } else {
        base = -0.10 * ((si - 0.50) / 0.50);
        R.push(`High sheen (SI=${si.toFixed(2)}): ${base >= 0 ? '+' : ''}${base.toFixed(3)}`);
        prompt_input_reasoning.push(`Con: This ${garmentType} has a shiny fabric that reflects light and can make covered areas appear larger, ${base.toFixed(3)}`);
    }

    let btMult = 1.0;
    R.push("body_shape: " + b.body_shape + "; is_plus_size: " + b.is_plus_size + "; zone: " + g.zone + " >> ");
    if (b.body_shape === BodyShape.APPLE) {
        btMult = 1.5;
        prompt_input_reasoning.push("Pro: For your apple body shape with this " + garmentType + ", the matte fabric's slimming effect is especially beneficial for your midsection, (x1.5)");
    } else if (b.is_plus_size) {
        btMult = 1.5;
        prompt_input_reasoning.push("Pro: For plus-size frames with this " + garmentType + ", a matte fabric helps minimize perceived volume across your silhouette, (x1.5)");
    } else if (b.body_shape === BodyShape.PEAR && (g.zone === "lower_body" || g.zone === "full_body")) {
        btMult = 1.3;
        prompt_input_reasoning.push("Pro: For your pear body shape with this " + garmentType + " on your lower body, a matte fabric helps minimize attention to your curvier hip area, (x1.3)");
    } else if (b.body_shape === BodyShape.HOURGLASS) {
        btMult = 0.5;
        if (si > 0.35 && si < 0.55) {
            base = +0.05;
            R.push("Hourglass + moderate sheen: curves enhanced");
            prompt_input_reasoning.push("Pro: For your hourglass body shape with this " + garmentType + ", a moderate sheen actually enhances your curves beautifully by catching light in flattering ways, +0.05");
        }
    } else if (b.body_shape === BodyShape.INVERTED_TRIANGLE && g.zone === "torso") {
        btMult = 1.2;
        prompt_input_reasoning.push("Pro: For your inverted triangle body shape with this " + garmentType + " on your torso, a matte fabric helps visually minimize your broader shoulders, (x1.2)");
    }
    R.push("btMult: " + btMult + " >> ");

    // Cling trap
    const cling = g.cling_risk;
    R.push("cling_risk: " + cling + " >> ");
    if (cling > 0.6 && si < 0.30) {
        if (b.is_plus_size) {
            R.push("CLING TRAP: matte+clingy on plus (-0.15)")
            prompt_input_reasoning.push("Con: For plus-size frames with this " + garmentType + ", while the matte finish is good, the clingy fabric clings to every curve and negates the benefits, -0.15");
            return { score: clamp(-0.15), reasoning: R.join(" | "), prompt_input_reasoning };
        } else if (b.body_shape === BodyShape.PEAR) {
            R.push("CLING TRAP: matte+clingy on pear (-0.10)")
            prompt_input_reasoning.push("Con: For your pear body shape with this " + garmentType + ", while the matte finish is good, the clingy fabric clings to your hips and thighs, -0.10");
            return { score: clamp(-0.10), reasoning: R.join(" | "), prompt_input_reasoning };
        } else if (b.body_shape === BodyShape.APPLE) {
            R.push("CLING TRAP: matte+clingy on apple (-0.12)")
            prompt_input_reasoning.push("Con: For your apple body shape with this " + garmentType + ", while the matte finish is good, the clingy fabric clings to your midsection, -0.12");
            return { score: clamp(-0.12), reasoning: R.join(" | "), prompt_input_reasoning };
        } else if (b.body_shape === BodyShape.HOURGLASS) {
            R.push("CLING TRAP: matte+clingy on hourglass (-0.08)")
            prompt_input_reasoning.push("Con: For your hourglass body shape with this " + garmentType + ", the clingy matte fabric may cling in unflattering ways rather than skimming your curves, -0.08");
            return { score: clamp(-0.08), reasoning: R.join(" | "), prompt_input_reasoning };
        } else if (b.body_shape === BodyShape.INVERTED_TRIANGLE) {
            R.push("CLING TRAP: matte+clingy on inverted triangle (-0.08)")
            prompt_input_reasoning.push("Con: For your inverted triangle body shape with this " + garmentType + ", the clingy fabric can emphasize your broader upper body despite the matte finish, -0.08");
            return { score: clamp(-0.08), reasoning: R.join(" | "), prompt_input_reasoning };
        } else if (b.body_shape === BodyShape.RECTANGLE) {
            R.push("CLING TRAP: matte+clingy on rectangle (-0.05)")
            prompt_input_reasoning.push("Note: For your rectangle body shape with this " + garmentType + ", the clingy fabric has less impact since you have a straighter silhouette, -0.05");
            return { score: clamp(-0.05), reasoning: R.join(" | "), prompt_input_reasoning };
        }
    }

    return { score: clamp(base * btMult), reasoning: R.join(" | "), prompt_input_reasoning };
}

function scoreVneckElongation(g, b) {
    const R = [];
    let prompt_input_reasoning = [];
    const garmentType = g.garment_type || "garment";
    prompt_input_reasoning.push("Analyzing how this " + garmentType + "'s neckline affects your vertical proportions");
    const neck = getNecklineStr(g);
    R.push("neck: " + neck + " >> ");

    // Non-V paths
    if (neck !== "v_neck" && neck !== "deep_v") {
        if (neck === "crew") {
            R.push("Crew neck: neutral")
            prompt_input_reasoning.push("Note: This " + garmentType + " has a crew neckline which has a neutral effect on proportions");
            return { score: 0.0, reasoning: R.join(" | "), prompt_input_reasoning };
        }
        if (neck === "boat" || neck === "off_shoulder") {
            R.push("body_shape: " + b.body_shape + " >> ");
            if (b.body_shape === BodyShape.INVERTED_TRIANGLE) {
                R.push("Boat/off-shoulder on INVT: widens shoulders (-0.15)")
                prompt_input_reasoning.push("Con: For your inverted triangle body shape with this " + garmentType + ", the boat/off-shoulder neckline visually widens your already-broad shoulders, -0.15");
                return { score: clamp(-0.15), reasoning: R.join(" | "), prompt_input_reasoning };
            } else if (b.body_shape === BodyShape.RECTANGLE) {
                R.push("Boat on rectangle: adds width (+0.08)")
                prompt_input_reasoning.push("Pro: For your rectangle body shape with this " + garmentType + ", the boat neckline adds flattering width to your shoulders to create more defined proportions, +0.08");
                return { score: clamp(+0.08), reasoning: R.join(" | "), prompt_input_reasoning };
            } else if (b.body_shape === BodyShape.PEAR) {
                R.push("Boat on pear: shoulder balance (+0.05)")
                prompt_input_reasoning.push("Pro: For your pear body shape with this " + garmentType + ", the boat neckline adds visual width to your shoulders which helps balance your curvier lower body, +0.05");
                return { score: clamp(+0.05), reasoning: R.join(" | "), prompt_input_reasoning };
            }
            return { score: 0.0, reasoning: `Neckline '${neck}': neutral`, prompt_input_reasoning };
        }
        if (neck === "scoop") {
            const base = b.body_shape === BodyShape.INVERTED_TRIANGLE ? +0.08 : +0.05;
            R.push(`Scoop: mild elongation (${base >= 0 ? '+' : ''}${base.toFixed(2)})`);
            prompt_input_reasoning.push(`Pro: This ${garmentType}'s scoop neckline creates mild vertical elongation by drawing the eye downward from the face, +${base.toFixed(2)}`);
            return { score: clamp(base), reasoning: R.join(" | "), prompt_input_reasoning };
        }
        if (neck === "turtleneck") {
            if (b.body_shape === BodyShape.INVERTED_TRIANGLE) {
                R.push("Turtleneck on INVT: upper mass (-0.05)")
                prompt_input_reasoning.push("Con: For your inverted triangle body shape with this " + garmentType + ", the turtleneck adds visual mass to your already-broader upper body, -0.05");
                return { score: clamp(-0.05), reasoning: R.join(" | "), prompt_input_reasoning };
            }
            if (b.is_petite && b.torso_score <= -1.0) {
                R.push("Turtleneck petite short-torso: keeps eye UP (+0.10)")
                prompt_input_reasoning.push("Pro: For petite frames with a shorter torso like yours with this " + garmentType + ", the turtleneck draws attention upward to your face which creates a flattering elongating effect, +0.10");
                return { score: clamp(+0.10), reasoning: R.join(" | "), prompt_input_reasoning };
            }
            R.push("Turtleneck: neutral")
            prompt_input_reasoning.push("Note: This " + garmentType + "'s turtleneck has a neutral effect on your proportions");
            return { score: 0.0, reasoning: R.join(" | "), prompt_input_reasoning };
        }
        if (neck === "wrap") {
            const base = +0.08;
            R.push("Wrap neckline: mild V-effect (+0.08)");
            prompt_input_reasoning.push("Pro: This " + garmentType + "'s wrap neckline creates a subtle V-shape that elongates your torso and draws the eye downward, +0.08");
            return { score: clamp(base), reasoning: R.join(" | "), prompt_input_reasoning };
        }
        return { score: 0.0, reasoning: `Neckline '${neck}': not scored`, prompt_input_reasoning };
    }

    // V-neck path
    let base = +0.10;
    R.push("V-neck: base elongation +0.10");
    prompt_input_reasoning.push("Pro: This " + garmentType + " has a V-neckline which creates vertical elongation by drawing the eye downward from your face, +0.10");

    if (b.body_shape === BodyShape.INVERTED_TRIANGLE) {
        base = +0.18;
        R.push("INVT: narrows shoulder line (+0.18)");
        prompt_input_reasoning.push("Pro: For your inverted triangle body shape with this " + garmentType + ", the V-neckline is ideal — it visually narrows your shoulder line and draws attention to your center, +0.18");
    } else if (b.body_shape === BodyShape.HOURGLASS) {
        base = +0.12;
        R.push("Hourglass: frames bust to waist (+0.12)");
        prompt_input_reasoning.push("Pro: For your hourglass body shape with this " + garmentType + ", the V-neckline beautifully frames your bust-to-waist proportions, +0.12");
    } else if (b.is_petite) {
        if (b.torso_score <= -1.0) {
            if (g.rise_cm && g.rise_cm > 26) {
                base = -0.05;
                R.push("Petite short-torso + V + high rise: CONFLICT (-0.05)");
                prompt_input_reasoning.push("Con: For petite frames with a shorter torso like yours with this " + garmentType + ", the combination of V-neckline and high-rise bottom creates competing vertical lines that can look unbalanced, -0.05");
            } else {
                base = +0.15;
                R.push("Petite short-torso + V + mid rise: harmonious (+0.15)");
                prompt_input_reasoning.push("Pro: For petite frames with a shorter torso like yours with this " + garmentType + ", the V-neckline works harmoniously to elongate your torso visually, +0.15");
            }
        } else {
            base = +0.12;
            R.push("Petite: vertical channel (+0.12)");
            prompt_input_reasoning.push("Pro: For petite frames with this " + garmentType + ", the V-neckline creates a vertical channel that elongates your silhouette and adds perceived height, +0.12");
        }
    } else if (b.body_shape === BodyShape.APPLE) {
        base = +0.10;
        R.push("Apple: eye to face, away from belly (+0.10)");
        prompt_input_reasoning.push("Pro: For your apple body shape with this " + garmentType + ", the V-neckline draws attention upward to your face and away from your midsection, +0.10");
    } else if (b.is_tall) {
        base = +0.05;
        R.push("Tall: diminishing returns (+0.05)");
        prompt_input_reasoning.push("Note: For tall frames with this " + garmentType + ", you already have natural vertical length so the V-neck's elongating effect matters less, +0.05");
    } else if (b.body_shape === BodyShape.PEAR) {
        base = +0.10;
        R.push("Pear: attention upward (+0.10)");
        prompt_input_reasoning.push("Pro: For your pear body shape with this " + garmentType + ", the V-neckline draws attention upward to your face and torso, balancing your proportions, +0.10");
    }

    return { score: clamp(base), reasoning: R.join(" | "), prompt_input_reasoning };
}

function scoreMonochromeColumn(g, b) {
    const R = [];
    let prompt_input_reasoning = [];
    const garmentType = g.garment_type || "garment";
    prompt_input_reasoning.push("Evaluating Monochrome Column: how this " + garmentType + "'s single-color design creates an unbroken vertical line");

    R.push("is_monochrome_outfit: " + g.is_monochrome_outfit + " >> ");
    if (!g.is_monochrome_outfit) {
        R.push("Not monochrome — N/A")
        prompt_input_reasoning.push("This " + garmentType + " is not part of a monochrome outfit — not applicable for this analysis");
        return { score: 0.0, reasoning: R.join(" | "), prompt_input_reasoning };
    }

    let base = +0.08;
    R.push("g.is_dark: " + g.is_dark + " >> ");
    let darkBonus = g.is_dark ? +0.07 : 0.0;

    if (b.is_petite) {
        base = +0.15;
        R.push("Petite: AMPLIFIED monochrome (+0.15)");
        prompt_input_reasoning.push("Pro: For petite frames with this " + garmentType + ", a monochrome outfit creates an unbroken vertical line that significantly elongates your silhouette and adds perceived height, +0.15");
    } else if (b.is_tall) {
        base = +0.03;
        R.push("Tall: doesn't need height (+0.03)");
        prompt_input_reasoning.push("Note: For tall frames with this " + garmentType + ", you already have natural height so the monochrome elongating effect matters less, +0.03");
    } else if (b.body_shape === BodyShape.HOURGLASS) {
        base = +0.03;
        if (g.has_contrasting_belt || g.has_tonal_belt) {
            base = +0.12;
            R.push("Hourglass + mono + belt: best of both (+0.12)");
            prompt_input_reasoning.push("Pro: For your hourglass body shape with this belted monochrome " + garmentType + ", you get the best of both worlds — the continuous color elongates while the belt highlights your waist, +0.12");
        } else {
            prompt_input_reasoning.push("Note: For your hourglass body shape with this monochrome " + garmentType + ", the single color is nice but a belt would better highlight your defined waist, +0.03");
        }
    } else if (b.body_shape === BodyShape.INVERTED_TRIANGLE) {
        base = +0.05;
        R.push("INVT: +0.05");
        prompt_input_reasoning.push("Pro: For your inverted triangle body shape with this monochrome " + garmentType + ", the continuous color creates a streamlined look that minimizes the contrast between your upper and lower body, +0.05");
    } else if (b.body_shape === BodyShape.APPLE) {
        base = +0.08;
        R.push("Apple: +0.08");
        prompt_input_reasoning.push("Pro: For your apple body shape with this monochrome " + garmentType + ", the unbroken vertical line draws the eye up and down rather than focusing on your midsection, +0.08");
    } else if (b.body_shape === BodyShape.PEAR) {
        base = g.color_lightness < 0.30 ? +0.12 : +0.05;
        R.push("Pear: Color lightness: " + g.color_lightness + " : base: " + base + " >> ");
        prompt_input_reasoning.push(g.color_lightness < 0.30
            ? `Pro: For your pear body shape with this dark monochrome ${garmentType}, the continuous dark color minimizes attention to your lower body while elongating, +${base.toFixed(2)}`
            : `Pro: For your pear body shape with this monochrome ${garmentType}, the continuous color creates a streamlined silhouette, +${base.toFixed(2)}`);
    } else if (b.is_plus_size) {
        R.push("Plus: +0.10");
        base = +0.10;
        prompt_input_reasoning.push("Pro: For plus-size frames with this monochrome " + garmentType + ", the single-color outfit creates an unbroken line that elongates and streamlines your silhouette, +0.10");
    }

    R.push("b.is_plus_size: " + b.is_plus_size + "; g.is_dark: " + g.is_dark + " >> ");
    if (b.is_plus_size && g.is_dark) {
        darkBonus = Math.max(darkBonus, +0.08);
        R.push("Plus + dark mono: most reliable combo");
        prompt_input_reasoning.push("Pro: For plus-size frames with this dark monochrome " + garmentType + ", this is one of the most reliably flattering combinations — the dark color slims while the monochrome elongates, +0.08");
    }

    return { score: clamp(base + darkBonus), reasoning: R.join(" | "), prompt_input_reasoning };
}

// ================================================================
// PRINCIPLE SCORERS 11-16 (new, from domain 2/3)
// ================================================================

function scoreHemline(g, b) {
    const R = [];
    let prompt_input_reasoning = [];
    const garmentType = g.garment_type || "garment";
    prompt_input_reasoning.push("Evaluating Hemline: how this " + garmentType + "'s hemline placement flatters your leg line and proportions");

    // If we have no hemline data at all, skip this scorer
    if (g.hem_position == null && g.garment_length_inches == null) {
        return { score: 0.0, reasoning: "No hemline data — N/A" };
    }

    const hem = translateHemline(g, b);
    const zone = hem.hem_zone;
    R.push(`Hem ${hem.hem_from_floor.toFixed(1)}" from floor -> ${zone}`);

    if (zone === "above_knee" || zone === "above_knee_near") {
        const inchesAbove = hem.hem_from_floor - b.h_knee;
        R.push(`inchesAbove=${inchesAbove.toFixed(1)}, h_knee=${b.h_knee}, height=${b.height}`);
        let elongation = Math.min(inchesAbove * 0.20, 0.60);
        R.push(`Base elongation: min(${inchesAbove.toFixed(1)} * 0.20, 0.60) = ${elongation.toFixed(2)}`);
        if (b.is_petite) {
            elongation = Math.min(elongation + (63 - b.height) / 50, 0.80);
            R.push(`Petite above-knee: elongation ${elongation >= 0 ? '+' : ''}${elongation.toFixed(2)}`);
            prompt_input_reasoning.push(`Pro: For petite frames with this ${garmentType} ending above the knee, showing more leg creates a significant elongating effect that makes you appear taller, +${elongation.toFixed(2)}`);
        }
        if (b.is_tall && b.leg_ratio > 0.62) {
            elongation *= 0.65;
            R.push(`Tall + long legs (leg_ratio=${b.leg_ratio.toFixed(2)}): x0.65 = ${elongation.toFixed(2)}`);
            prompt_input_reasoning.push("Note: For tall frames with already-long legs with this " + garmentType + ", the above-knee length adds less benefit since you have natural leg length, (x0.65)");
        }

        // Thigh penalty
        let thighPenalty = 0.0;
        R.push(`c_thigh_max=${b.c_thigh_max}`);
        if (b.c_thigh_max > 27) {
            thighPenalty = -0.35;
            R.push("Thigh penalty (>27): -0.35");
            prompt_input_reasoning.push("Con: This " + garmentType + "'s hemline falls at the widest part of your fuller thighs, which can draw attention there rather than flattering your leg line, -0.35");
        } else if (b.c_thigh_max > 24) {
            thighPenalty = -0.20;
            R.push("Thigh penalty (>24): -0.20");
            prompt_input_reasoning.push("Con: This " + garmentType + "'s hemline falls at a wider part of your thighs, which may not be the most flattering placement, -0.20");
        } else if (b.c_thigh_max > 22) {
            thighPenalty = -0.10;
            R.push("Thigh penalty (>22): -0.10");
            prompt_input_reasoning.push("Note: This " + garmentType + "'s hemline falls at your upper thigh, which works but isn't the most flattering spot for your leg shape, -0.10");
        } else {
            R.push("Thigh penalty: none (<=22)");
            prompt_input_reasoning.push("Pro: This " + garmentType + "'s above-knee hemline works well with your slim thighs, showing off your legs nicely");
        }

        if (b.goal_legs === "showcase") {
            thighPenalty *= 0.5;
            R.push(`Goal legs=showcase: thighPenalty x0.5 = ${thighPenalty.toFixed(2)}`);
            prompt_input_reasoning.push("Note: Since your goal is to showcase your legs, the thigh consideration is less of a concern with this " + garmentType + ", (x0.5)");
        } else if (b.goal_hip === "narrower") {
            thighPenalty *= 1.2;
            R.push(`Goal hip=narrower: thighPenalty x1.2 = ${thighPenalty.toFixed(2)}`);
            prompt_input_reasoning.push("Con: Since your goal is to minimize your hip area, this " + garmentType + "'s hemline drawing attention to your thighs works against that goal, (x1.2)");
        }

        // Apple slim-legs bonus
        let appleBonus = 0.0;
        if (b.body_shape === BodyShape.APPLE) {
            if (b.c_thigh_max < 22) {
                appleBonus = +0.15;
                R.push("Apple slim-legs bonus (c_thigh_max < 22): +0.15");
                prompt_input_reasoning.push("Pro: For your apple body shape with slim legs and this " + garmentType + ", showing off your legs is a great strategy that draws attention to one of your best features, +0.15");
            } else if (b.c_thigh_max < 24) {
                appleBonus = +0.08;
                R.push("Apple slim-legs bonus (c_thigh_max < 24): +0.08");
                prompt_input_reasoning.push("Pro: For your apple body shape with nice legs and this " + garmentType + ", showing your legs helps draw attention away from your midsection, +0.08");
            }
        }

        const score = elongation + thighPenalty + appleBonus;
        R.push(`Final: elongation=${elongation.toFixed(2)} + thighPenalty=${thighPenalty.toFixed(2)} + appleBonus=${appleBonus.toFixed(2)} = ${score.toFixed(2)}`);
        return { score: clamp(score), reasoning: R.join(" | "), prompt_input_reasoning };
    }

    if (zone === "knee_danger") {
        const score = b.is_petite ? -0.40 : -0.30;
        R.push(`Knee danger zone: b.is_petite: ${b.is_petite} -> ${score >= 0 ? '+' : ''}${score.toFixed(2)}`);
        prompt_input_reasoning.push(`Con: This ${garmentType}'s hemline falls exactly at your knee — this is generally an unflattering spot that cuts your leg line at its widest point, ${score.toFixed(2)}`);
        return { score: clamp(score), reasoning: R.join(" | "), prompt_input_reasoning };
    }

    if (zone === "safe_zone") {
        const sz = hem.safe_zone;
        let score;
        if (sz) {
            const zonePosition = (sz[1] - hem.hem_from_floor) / hem.safe_zone_size;
            score = (zonePosition >= 0.25 && zonePosition <= 0.75) ? 0.30 : 0.15;
            R.push(`zonePosition=${zonePosition.toFixed(2)} (${zonePosition >= 0.25 && zonePosition <= 0.75 ? 'center' : 'edge'}): ${score.toFixed(2)}`);
            prompt_input_reasoning.push(zonePosition >= 0.25 && zonePosition <= 0.75
                ? `Pro: This ${garmentType}'s hemline falls at an ideal spot below your knee where your leg tapers — a very flattering placement, +${score.toFixed(2)}`
                : `Pro: This ${garmentType}'s hemline falls in a good zone below your knee, +${score.toFixed(2)}`);
        } else {
            score = 0.15;
            R.push("No safe_zone data: default +0.15");
            prompt_input_reasoning.push("Pro: This " + garmentType + "'s below-knee hemline is in a generally flattering zone, +0.15");
        }
        if (b.is_tall) {
            score += 0.10;
            R.push("Tall bonus: +0.10");
            prompt_input_reasoning.push("Pro: For tall frames with this midi-length " + garmentType + ", the below-knee hemline is especially flattering on your frame, +0.10");
        }
        R.push(`Safe zone final: ${score >= 0 ? '+' : ''}${score.toFixed(2)}`);
        return { score: clamp(score), reasoning: R.join(" | "), prompt_input_reasoning };
    }

    if (zone === "collapsed_zone") {
        R.push("Collapsed safe zone: -0.20");
        prompt_input_reasoning.push("Con: This " + garmentType + "'s hemline falls in a tricky zone where the flattering below-knee area is very narrow for your proportions, -0.20");
        return { score: clamp(-0.20), reasoning: R.join(" | "), prompt_input_reasoning };
    }

    if (zone === "calf_danger") {
        const calfProm = b.calf_prominence;
        R.push(`calf_prominence=${calfProm}`);
        let base;
        if (calfProm > 1.3) {
            base = -0.50;
            R.push("Calf prominence >1.3: -0.50");
            prompt_input_reasoning.push("Con: This " + garmentType + "'s hemline falls at the widest part of your pronounced calves, which can make your legs appear thicker, -0.50");
        } else if (calfProm > 1.2) {
            base = -0.42;
            R.push("Calf prominence >1.2: -0.42");
            prompt_input_reasoning.push("Con: This " + garmentType + "'s hemline falls at your defined calves, which isn't the most flattering placement for your leg shape, -0.42");
        } else {
            base = -0.35;
            R.push("Calf prominence <=1.2: -0.35");
            prompt_input_reasoning.push("Con: This " + garmentType + "'s mid-calf hemline can cut your leg line at an unflattering point, -0.35");
        }
        if (b.is_petite) {
            base *= 1.15;
            R.push(`Petite amplification x1.15: ${base.toFixed(2)}`);
            prompt_input_reasoning.push(`Con: For petite frames with this ${garmentType}, the mid-calf length is especially unflattering as it shortens your visible leg line, ${base.toFixed(2)}`);
        }
        R.push(`Calf danger zone final: ${base >= 0 ? '+' : ''}${base.toFixed(2)}`);
        return { score: clamp(base), reasoning: R.join(" | "), prompt_input_reasoning };
    }

    if (zone === "below_calf") {
        R.push("Below calf: safe (+0.15)");
        prompt_input_reasoning.push("Pro: This " + garmentType + "'s hemline falls below your calf at a flattering point that avoids cutting your leg at its widest, +0.15");
        return { score: clamp(+0.15), reasoning: R.join(" | "), prompt_input_reasoning };
    }

    if (zone === "ankle") {
        R.push(`is_petite=${b.is_petite}, is_tall=${b.is_tall}, silhouette=${g.silhouette}, has_waist_definition=${g.has_waist_definition}`);
        let score;
        if (b.is_petite) {
            if (g.silhouette === Silhouette.OVERSIZED || g.silhouette === Silhouette.SHIFT) {
                score = -0.15;
                R.push("Petite + oversized/shift: -0.15");
                prompt_input_reasoning.push("Con: For petite frames with this oversized ankle-length " + garmentType + ", the volume combined with length can overwhelm your proportions, -0.15");
            } else if (g.silhouette === Silhouette.FITTED && g.has_waist_definition) {
                score = +0.40;
                R.push("Petite + fitted + waist definition: +0.40");
                prompt_input_reasoning.push("Pro: For petite frames with this fitted ankle-length " + garmentType + " with waist definition, the combination creates a sleek column that elongates beautifully, +0.40");
            } else if (g.silhouette === Silhouette.FITTED) {
                score = +0.15;
                R.push("Petite + fitted (no waist def): +0.15");
                prompt_input_reasoning.push("Pro: For petite frames with this fitted ankle-length " + garmentType + ", the slim silhouette helps maintain your proportions, +0.15");
            } else {
                score = +0.10;
                R.push("Petite + other silhouette: +0.10");
                prompt_input_reasoning.push("Note: For petite frames with this ankle-length " + garmentType + ", the maxi length can work but isn't the most elongating choice, +0.10");
            }
        } else if (b.is_tall) {
            score = +0.45;
            R.push("Tall: +0.45");
            prompt_input_reasoning.push("Pro: For tall frames with this ankle-length " + garmentType + ", your height carries the maxi length beautifully for an elegant, elongated silhouette, +0.45");
        } else {
            score = +0.25;
            R.push("Default: +0.25");
            prompt_input_reasoning.push("Pro: This " + garmentType + "'s ankle-length hemline is a flattering, elegant length that works well with your proportions, +0.25");
        }

        if (b.body_shape === BodyShape.HOURGLASS && !g.has_waist_definition) {
            score -= 0.15;
            R.push("Hourglass + no waist definition: -0.15");
            prompt_input_reasoning.push("Con: For your hourglass body shape with this " + garmentType + " lacking waist definition, the length may hide your beautiful waist-to-hip ratio, -0.15");
        }
        R.push(`Ankle final: ${score >= 0 ? '+' : ''}${score.toFixed(2)}`);
        return { score: clamp(score), reasoning: R.join(" | "), prompt_input_reasoning };
    }

    if (zone === "floor") {
        R.push(`is_tall=${b.is_tall}, is_petite=${b.is_petite}`);
        let score;
        if (b.is_tall) {
            score = +0.15;
            R.push("Tall: floor-length works (+0.15)");
            prompt_input_reasoning.push("Pro: For tall frames with this floor-length " + garmentType + ", you have the height to carry this dramatic length elegantly, +0.15");
        } else if (b.is_petite) {
            score = -0.35;
            R.push("Petite: floor-length overwhelms frame (-0.35)");
            prompt_input_reasoning.push("Con: For petite frames with this floor-length " + garmentType + ", the dramatic length can overwhelm your smaller proportions and make you appear shorter, -0.35");
        } else {
            score = -0.05;
            R.push("Average: floor-length slightly heavy (-0.05)");
            prompt_input_reasoning.push("Note: This floor-length " + garmentType + " can feel slightly heavy on average frames — a slightly shorter length may be more flattering, -0.05");
        }
        R.push(`Floor final: ${score >= 0 ? '+' : ''}${score.toFixed(2)}`);
        return { score: clamp(score), reasoning: R.join(" | "), prompt_input_reasoning };
    }

    return { score: 0.0, reasoning: `Unknown zone: ${zone} — N/A`, prompt_input_reasoning };
}

function scoreSleeve(g, b) {
    const R = [];
    let prompt_input_reasoning = [];
    const garmentType = g.garment_type || "garment";
    prompt_input_reasoning.push("Evaluating Sleeve: how this " + garmentType + "'s sleeve length flatters your arms");

    if (g.sleeve_type === SleeveType.SLEEVELESS) {
        prompt_input_reasoning.push("This " + garmentType + " is sleeveless — no sleeve coverage to evaluate");
        return { score: 0.0, reasoning: "Sleeveless: baseline — N/A", prompt_input_reasoning };
    }

    const sleeve = translateSleeve(g, b);
    const delta = sleeve.delta_vs_actual;
    const severity = sleeve.arm_prominence_severity ?? 1.0;

    R.push(`Sleeve endpoint ${sleeve.endpoint_position.toFixed(1)}", delta=${delta >= 0 ? '+' : ''}${delta.toFixed(2)}", severity=${severity.toFixed(1)}`);

    // Score from delta (domain 2 line ~4076)
    let score;
    if (delta > 0.30) {
        score = -4.0;
        prompt_input_reasoning.push("Con: This " + garmentType + "'s sleeves end at an unflattering point on your arm, exposing an area that could benefit from more coverage");
    } else if (delta > 0.15) {
        score = -2.0;
        prompt_input_reasoning.push("Con: This " + garmentType + "'s sleeve length provides insufficient coverage for the most flattering arm appearance");
    } else if (delta > 0) {
        score = -1.0;
        prompt_input_reasoning.push("Note: This " + garmentType + "'s sleeves are slightly shorter than ideal for your arm shape");
    } else if (delta > -0.30) {
        score = 1.0;
        prompt_input_reasoning.push("Pro: This " + garmentType + "'s sleeve length provides good coverage that flatters your arms");
    } else if (delta > -0.60) {
        score = 3.0;
        prompt_input_reasoning.push("Pro: This " + garmentType + "'s sleeve length provides excellent coverage, ending at a very flattering point on your arm");
    } else {
        score = 5.0;
        prompt_input_reasoning.push("Pro: This " + garmentType + "'s sleeve length is ideal for your arms, providing optimal coverage and a polished look");
    }

    // Apply severity
    if (score < 0) {
        score *= severity;
    } else {
        score *= (1 + (severity - 1) * 0.5);
    }

    // Flutter vs cap bonus (domain 2 line ~4260)
    if (g.sleeve_type === SleeveType.FLUTTER) {
        score += 2.0;
        R.push("Flutter: +2 qualitative bonus (visual ambiguity)");
        prompt_input_reasoning.push("Pro: This " + garmentType + " has flutter sleeves which create visual ambiguity that softens your arm line beautifully");
    }

    // Normalize from [-4..+5] to [-1..+1] range
    const normalized = clamp(score / 5.0, -1.0, 1.0);
    R.push(`Raw score ${score >= 0 ? '+' : ''}${score.toFixed(1)} -> normalized ${normalized >= 0 ? '+' : ''}${normalized.toFixed(2)}`);

    return { score: normalized, reasoning: R.join(" | "), prompt_input_reasoning };
}

function scoreWaistPlacement(g, b) {
    const R = [];
    let prompt_input_reasoning = [];
    const garmentType = g.garment_type || "garment";
    prompt_input_reasoning.push("Evaluating Waist Placement: how this " + garmentType + "'s waistline placement affects your proportions");

    if (g.waist_position === "no_waist") {
        prompt_input_reasoning.push("This " + garmentType + " has no defined waistline — not applicable for this analysis");
        return { score: 0.0, reasoning: "No waist definition — N/A", prompt_input_reasoning };
    }

    const waist = translateWaistline(g, b);
    let propScore = waist.proportion_score;
    R.push(`Waist=${g.waist_position}: visual leg ratio ${waist.visual_leg_ratio.toFixed(3)} (golden=${GOLDEN_RATIO}), improvement=${waist.proportion_improvement >= 0 ? '+' : ''}${waist.proportion_improvement.toFixed(3)}`);

    // Empire + hourglass shape loss
    if (g.waist_position === "empire" && b.body_shape === BodyShape.HOURGLASS) {
        const stretch = (g.elastane_pct ?? 0) * 1.6;  // approximate
        if (stretch > 10) {
            propScore -= 0.10;
            R.push("Empire + hourglass + stretch: mild shape loss (-0.10)");
            prompt_input_reasoning.push("Con: For your hourglass body shape with this empire-waist " + garmentType + ", the stretchy fabric helps but the high waistline still partially hides your defined waist, -0.10");
        } else if (g.drape != null && g.drape > 7) {
            propScore -= 0.15;
            R.push("Empire + hourglass + drapey: shape loss (-0.15)");
            prompt_input_reasoning.push("Con: For your hourglass body shape with this drapey empire-waist " + garmentType + ", the fabric flows past your natural waist without defining it, -0.15");
        } else {
            propScore -= 0.30;
            R.push("Empire + hourglass + stiff/unknown: significant shape loss (-0.30)");
            prompt_input_reasoning.push("Con: For your hourglass body shape with this empire-waist " + garmentType + ", the high waistline completely bypasses your natural waist — your most flattering feature — creating an unflattering silhouette, -0.30");
        }
    }

    // Empire + large bust tent effect
    if (g.waist_position === "empire" && b.bust_differential >= 6) {
        const bustProj = b.bust_differential * 0.4;
        if (g.drape != null && g.drape < 4) {
            const tentSeverity = bustProj * (1.0 - g.drape / 10.0);
            if (tentSeverity > 2.0) {
                propScore -= 0.45;
                R.push("Empire + large bust + stiff: tent effect (-0.45)");
                prompt_input_reasoning.push("Con: With your fuller bust and this stiff empire-waist " + garmentType + ", the fabric tends to project outward from your bust creating a tent-like effect that adds perceived volume, -0.45");
            } else if (tentSeverity > 1.0) {
                propScore -= 0.25;
                prompt_input_reasoning.push("Con: With your fuller bust and this empire-waist " + garmentType + ", there's some tent effect from the bust that adds perceived volume, -0.25");
            } else {
                propScore -= 0.10;
                prompt_input_reasoning.push("Con: With your fuller bust and this empire-waist " + garmentType + ", there's a slight tent effect, -0.10");
            }
        }
    }

    // Drop waist + short legs
    if (g.waist_position === "drop") {
        if (b.leg_ratio != null && b.leg_ratio < 0.55) {
            propScore -= 0.30;
            R.push("Drop waist + short legs: proportion penalty (-0.30)");
            prompt_input_reasoning.push("Con: With your proportionally shorter legs and this drop-waist " + garmentType + ", the low waistline makes your legs appear even shorter by visually lengthening your torso, -0.30");
        } else if (b.leg_ratio != null && b.leg_ratio < 0.58) {
            propScore -= 0.15;
            prompt_input_reasoning.push("Con: With your proportions and this drop-waist " + garmentType + ", the low waistline can make your legs appear shorter, -0.15");
        }
    }

    // Apple + belt at natural waist
    if (b.body_shape === BodyShape.APPLE && g.waist_position === "natural" &&
        g.has_contrasting_belt && b.whr > 0.85) {
        const penalty = b.whr > 0.88 ? 0.30 : 0.15;
        propScore -= penalty;
        R.push("Apple + belt at natural waist: spotlights widest");
        prompt_input_reasoning.push(`Con: For your apple body shape with this belted ${garmentType}, the contrasting belt at your natural waist draws attention to your midsection — typically your widest area, -${penalty.toFixed(2)}`);
    }

    propScore = clamp(propScore, -0.80, 0.80);
    return { score: propScore, reasoning: R.join(" | "), prompt_input_reasoning };
}

function scoreColorValue(g, b) {
    const R = [];
    let prompt_input_reasoning = [];
    const garmentType = g.garment_type || "garment";
    prompt_input_reasoning.push("Evaluating Color Value: how this " + garmentType + "'s color lightness affects slimming and visual expansion");

    if (g.color_lightness == null) {
        return { score: 0.0, reasoning: "No color lightness data — N/A" };
    }

    const L = g.color_lightness * 100;  // convert 0-1 to 0-100

    let slimPct;
    if (L <= 10) {
        slimPct = 0.04;
        prompt_input_reasoning.push("Pro: This " + garmentType + " has a very dark color which absorbs light and creates a significant slimming effect (+4%)");
    } else if (L <= 25) {
        slimPct = 0.03;
        prompt_input_reasoning.push("Pro: This " + garmentType + " has a dark color which provides a noticeable slimming effect (+3%)");
    } else if (L <= 40) {
        slimPct = 0.02;
        prompt_input_reasoning.push("Pro: This " + garmentType + " has a medium-dark color which provides some slimming benefit (+2%)");
    } else if (L <= 60) {
        slimPct = 0.005;
        prompt_input_reasoning.push("Note: This " + garmentType + " has a medium color which is neutral in terms of slimming/expanding");
    } else if (L <= 80) {
        slimPct = -0.005;
    } else {
        slimPct = -0.01;
        prompt_input_reasoning.push("Con: This " + garmentType + " has a light color which can visually expand the areas it covers (-1%)");
    }

    const slimScore = slimPct * 6.25;  // maps 4% -> +0.25
    R.push(`Color L=${L.toFixed(0)}: slim_pct=${slimPct >= 0 ? '+' : ''}${slimPct.toFixed(3)}, score=${slimScore >= 0 ? '+' : ''}${slimScore.toFixed(3)}`);

    // Hourglass shape-loss penalty (dark monochrome)
    let shapeLoss = 0.0;
    if (L <= 25 && b.body_shape === BodyShape.HOURGLASS) {
        const whd = (b.bust != null && b.waist != null) ? b.bust - b.waist : 0;  // bust-waist differential (curve definition)
        if (whd >= 8) {
            shapeLoss = -0.30 * (1.0 - L / 25);
        } else if (whd >= 6) {
            shapeLoss = -0.20 * (1.0 - L / 25);
        } else {
            shapeLoss = -0.10 * (1.0 - L / 25);
        }
        R.push(`Hourglass dark shape loss: ${shapeLoss >= 0 ? '+' : ''}${shapeLoss.toFixed(2)}`);
        prompt_input_reasoning.push(`Con: For your hourglass body shape with this dark ${garmentType}, the very dark color can flatten your beautiful curves rather than accentuating them, ${shapeLoss.toFixed(2)}`);
    } else if (L <= 25 && b.body_shape === BodyShape.RECTANGLE) {
        shapeLoss = +0.05;
        R.push("Rectangle dark: clean column bonus (+0.05)");
        prompt_input_reasoning.push("Pro: For your rectangle body shape with this dark " + garmentType + ", the dark color creates a sleek, clean column effect that works beautifully with your straight silhouette, +0.05");
    }

    // Skin tone contrast (very dark garment)
    let contrastMod = 0.0;
    if (L <= 15 && (g.zone === "torso" || g.zone === "full_body")) {
        const skinGarmentContrast = Math.abs(b.skin_tone_L / 100 - L / 100);
        if (skinGarmentContrast > 0.70) {
            contrastMod = -0.05;
            prompt_input_reasoning.push("Con: With your skin tone and this very dark " + garmentType + " near your face, the high contrast can be stark — consider a slightly lighter shade, -0.05");
        } else if (skinGarmentContrast < 0.30) {
            contrastMod = +0.05;
            prompt_input_reasoning.push("Pro: With your skin tone and this very dark " + garmentType + ", the moderate contrast creates a harmonious look, +0.05");
        }
    }

    const score = slimScore + shapeLoss + contrastMod;
    return { score: clamp(score), reasoning: R.join(" | "), prompt_input_reasoning };
}

function scoreFabricZone(g, b) {
    const R = [];
    let prompt_input_reasoning = [];
    const garmentType = g.garment_type || "garment";
    prompt_input_reasoning.push("Assessing how this " + garmentType + "'s fabric properties (cling, structure, drape) work with your body type");

    const resolved = resolveFabricProperties(g);

    // Confidence-based weight multiplier for fabric sub-scores
    // When we're guessing GSM, fabric scores should carry less weight
    const CONFIDENCE_MULT = { high: 1.0, moderate: 0.8, low: 0.5, very_low: 0.3 };
    const confMult = CONFIDENCE_MULT[g.gsm_confidence] || 0.8;

    // Weighted sub-scores (domain 3: cling 30%, structure 20%, sheen 15%,
    // drape 10%, color 8%, texture 5%, pattern 5%, silhouette 4%, construction 3%)
    const scores = {};

    // Cling sub-score (30%)
    let clingScore;
    if (resolved.cling_risk_base > 0.6) {
        clingScore = -0.20;
        if (b.is_plus_size || b.belly_zone > 0.5) {
            clingScore = -0.40;
            prompt_input_reasoning.push("Con: This " + garmentType + " has a clingy fabric that tends to highlight every curve and may emphasize areas you'd prefer to minimize on your body type, -0.40");
        } else {
            prompt_input_reasoning.push("Con: This " + garmentType + " has a clingy fabric that can stick to the body rather than skimming over it, -0.20");
        }
    } else if (resolved.cling_risk_base > 0.3) {
        clingScore = -0.05;
        prompt_input_reasoning.push("Note: This " + garmentType + " has a moderately clingy fabric that may cling in some areas, -0.05");
    } else {
        clingScore = +0.10;
        prompt_input_reasoning.push("Pro: This " + garmentType + " has a fabric that skims rather than clings, creating a flattering silhouette, +0.10");
    }
    scores.cling = [clingScore, 0.30 * confMult];

    // Structure sub-score (20%)
    let structScore;
    if (resolved.is_structured) {
        structScore = +0.15;
        prompt_input_reasoning.push("Pro: This " + garmentType + " has a structured fabric that provides support and creates a polished silhouette, +0.15");
    } else if (resolved.effective_gsm > 250) {
        structScore = +0.08;
        prompt_input_reasoning.push("Pro: This " + garmentType + " has a substantial fabric weight that provides good coverage and structure, +0.08");
    } else if (resolved.effective_gsm < 100) {
        structScore = -0.10;
        prompt_input_reasoning.push("Con: This " + garmentType + " has a lightweight, thin fabric that may require layering for adequate coverage, -0.10");
    } else {
        structScore = 0.0;
    }
    scores.structure = [structScore, 0.20 * confMult];

    // Sheen sub-score REMOVED — scoreMatteZone already runs as standalone scorer
    // (weight 0.06). Having it here too caused sheen to be double-counted.
    // Redistribute the 15% weight to cling (now 37.5%) and structure (now 27.5%).
    scores.cling[1] = 0.375 * confMult;
    scores.structure[1] = 0.275 * confMult;

    // Drape sub-score (10%)
    const dc = resolved.drape_coefficient;
    let drapeScore;
    if (dc < 30) {
        drapeScore = +0.10;  // very drapey: good body skimming
        prompt_input_reasoning.push("Pro: This " + garmentType + " has a beautiful drape that flows over your body rather than sticking to it, +0.10");
    } else if (dc < 50) {
        drapeScore = +0.05;
        prompt_input_reasoning.push("Pro: This " + garmentType + " has good drape that allows it to skim your curves nicely, +0.05");
    } else if (dc < 70) {
        drapeScore = 0.0;
    } else {
        drapeScore = -0.10;  // stiff: holds its own shape
        prompt_input_reasoning.push("Con: This " + garmentType + " has a stiff fabric that holds its own shape rather than following your body's contours, -0.10");
    }
    scores.drape = [drapeScore, 0.10 * confMult];

    // Remaining sub-scores (simplified)
    scores.color = [0.0, 0.08];
    scores.texture = [0.0, 0.05];
    scores.pattern = [0.0, 0.05];
    scores.silhouette = [0.0, 0.04];
    scores.construction = [0.0, 0.03];

    // Weighted sum
    let total = 0;
    let totalW = 0;
    for (const [s, w] of Object.values(scores)) {
        total += s * w;
        totalW += w;
    }
    const composite = totalW > 0 ? total / totalW : 0.0;

    R.push(`Fabric zone: stretch=${resolved.total_stretch_pct.toFixed(1)}%, GSM=${resolved.effective_gsm.toFixed(0)}, sheen=${resolved.sheen_score.toFixed(2)}, gsm_conf=${g.gsm_confidence}(×${confMult})`);
    return { score: clamp(composite), reasoning: R.join(" | "), prompt_input_reasoning };
}

function scoreNecklineCompound(g, b) {
    const R = [];
    let prompt_input_reasoning = [];
    const garmentType = g.garment_type || "garment";
    prompt_input_reasoning.push("Evaluating Neckline Compound: how this " + garmentType + "'s V-neckline depth flatters your bust and creates torso slimming");
    const neck = getNecklineStr(g);

    if (!["v_neck", "deep_v", "wrap", "scoop"].includes(neck)) {
        prompt_input_reasoning.push("This " + garmentType + " doesn't have a V-style neckline — not applicable for this analysis");
        return { score: 0.0, reasoning: `Neckline '${neck}': no compound scoring — N/A`, prompt_input_reasoning };
    }

    // V-neck bust dividing (domain 2 line ~9006)
    const depth = g.neckline_depth || (g.v_depth_cm > 0 ? g.v_depth_cm / 2.54 : 4.0);
    const bd = b.bust_differential;
    const threshold = getBustDividingThreshold(bd);

    const fabricStretch = g.elastane_pct * 0.01;  // rough approximation
    let effectiveDepth = depth + (fabricStretch * 1.0);

    if (b.body_shape === BodyShape.HOURGLASS && bd >= 6) {
        effectiveDepth += 0.75;
    }
    if (b.is_plus_size && bd >= 8) {
        effectiveDepth += 1.0;
    }

    const depthRatio = threshold > 0 ? effectiveDepth / threshold : 1.0;

    let bustScore;
    if (depthRatio < 0.60) {
        bustScore = +0.30;
        prompt_input_reasoning.push("Pro: This " + garmentType + " has a conservative V-neck depth that flatters without being too revealing, +0.30");
    } else if (depthRatio < 0.85) {
        bustScore = +0.50;
        prompt_input_reasoning.push("Pro: This " + garmentType + " has an ideal V-neck depth that creates optimal elongation while remaining flattering for your proportions, +0.50");
    } else if (depthRatio < 1.0) {
        if (b.goal_bust === "enhance") {
            bustScore = +0.70;
            prompt_input_reasoning.push("Pro: This " + garmentType + "'s V-neck depth is slightly daring which works beautifully with your goal to enhance your bust, +0.70");
        } else if (b.goal_bust === "minimize") {
            bustScore = -0.20;
            prompt_input_reasoning.push("Con: This " + garmentType + "'s V-neck depth draws attention to your bust area which may work against your goal to minimize, -0.20");
        } else {
            bustScore = +0.30;
            prompt_input_reasoning.push("Pro: This " + garmentType + " has a flattering V-neck depth that elongates nicely, +0.30");
        }
    } else if (depthRatio < 1.15) {
        if (b.goal_bust === "enhance") {
            bustScore = +0.30;
            prompt_input_reasoning.push("Pro: This " + garmentType + " has a deeper V-neck which showcases your bust as you desire, +0.30");
        } else if (b.goal_bust === "minimize") {
            bustScore = -0.60;
            prompt_input_reasoning.push("Con: This " + garmentType + "'s deep V-neck significantly emphasizes your bust area which works against your minimizing goal, -0.60");
        } else {
            bustScore = -0.15;
            prompt_input_reasoning.push("Con: This " + garmentType + " has a V-neck that may be deeper than ideal for your proportions, -0.15");
        }
    } else {
        if (b.goal_bust === "enhance") {
            bustScore = +0.10;
            prompt_input_reasoning.push("Note: This " + garmentType + " has a very deep V-neck — while it showcases your bust, it may be more revealing than necessary, +0.10");
        } else if (b.goal_bust === "minimize") {
            bustScore = -0.85;
            prompt_input_reasoning.push("Con: This " + garmentType + "'s very deep V-neck strongly emphasizes your bust area which directly conflicts with your minimizing goal, -0.85");
        } else {
            bustScore = -0.35;
            prompt_input_reasoning.push("Con: This " + garmentType + " has a very deep V-neck that may be more revealing than flattering for everyday wear, -0.35");
        }
    }

    R.push(`Bust: depth=${depth.toFixed(1)}", threshold=${threshold.toFixed(1)}", ratio=${depthRatio.toFixed(2)}, score=${bustScore >= 0 ? '+' : ''}${bustScore.toFixed(2)}`);

    // Torso slimming by V angle
    const vWidth = (g.v_depth_cm ?? 0) * 0.8;  // approximate V width
    const vAngle = depth > 0 ? vWidth / depth : 1.0;
    let torsoBase;
    if (vAngle < 0.5) {
        torsoBase = 0.25;
        prompt_input_reasoning.push("Pro: This " + garmentType + " has a narrow V-angle that creates a strong torso-slimming effect, +0.25");
    } else if (vAngle < 1.0) {
        torsoBase = 0.18;
        prompt_input_reasoning.push("Pro: This " + garmentType + " has a good V-angle that visually slims your torso, +0.18");
    } else if (vAngle < 1.5) {
        torsoBase = 0.10;
        prompt_input_reasoning.push("Pro: This " + garmentType + " has a moderate V-angle that provides some torso slimming, +0.10");
    } else {
        torsoBase = 0.05;
    }

    if (b.body_shape === BodyShape.APPLE) {
        torsoBase *= 1.30;
        prompt_input_reasoning.push("Pro: For your apple body shape with this " + garmentType + ", the V-neckline's torso-slimming effect is especially beneficial for minimizing your midsection, (x1.30)");
    } else if (b.body_shape === BodyShape.RECTANGLE) {
        torsoBase *= 1.15;
        prompt_input_reasoning.push("Pro: For your rectangle body shape with this " + garmentType + ", the V-neckline adds visual interest and helps create the appearance of more defined proportions, (x1.15)");
    }

    // Upper body balance
    let balance = 0.15;
    if (b.body_shape === BodyShape.INVERTED_TRIANGLE) {
        balance = 0.45;
        prompt_input_reasoning.push("Pro: For your inverted triangle body shape with this " + garmentType + ", the V-neckline draws the eye inward and downward, beautifully balancing your broader shoulders, +0.45");
    } else if (b.body_shape === BodyShape.PEAR) {
        balance = 0.30;
        prompt_input_reasoning.push("Pro: For your pear body shape with this " + garmentType + ", the V-neckline draws attention upward to your face and torso, creating better upper-lower body balance, +0.30");
    } else if (b.body_shape === BodyShape.RECTANGLE) {
        balance = 0.20;
        prompt_input_reasoning.push("Pro: For your rectangle body shape with this " + garmentType + ", the V-neckline adds visual interest and helps break up your straight silhouette, +0.20");
    } else if (b.body_shape === BodyShape.HOURGLASS) {
        balance = 0.10;
    }

    // Weighted compound: bust 40%, torso 30%, balance 30%
    const compound = bustScore * 0.40 + torsoBase * 0.30 + balance * 0.30;
    R.push(`Compound: bust=${bustScore >= 0 ? '+' : ''}${bustScore.toFixed(2)}*0.4 + torso=${torsoBase >= 0 ? '+' : ''}${torsoBase.toFixed(2)}*0.3 + balance=${balance >= 0 ? '+' : ''}${balance.toFixed(2)}*0.3 = ${compound >= 0 ? '+' : ''}${compound.toFixed(2)}`);

    return { score: clamp(compound), reasoning: R.join(" | "), prompt_input_reasoning };
}

// ================================================================
// COMPOSITE SCORER — 7-LAYER PIPELINE
// ================================================================

// 13 active scorers (3 removed: Rise Elongation, Color Break, Monochrome Column)
const SCORERS = [
    ["H-Stripe Thinning", scoreHorizontalStripes],
    ["Dark/Black Slimming", scoreDarkSlimming],
    // Rise Elongation REMOVED — rise_cm never populated, always returned 0.0
    ["A-Line Balance", scoreAlineBalance],
    ["Tent Concealment", scoreTentConcealment],
    // Color Break REMOVED — belt detection not implemented, always returned 0.0
    ["Bodycon Mapping", scoreBodyconMapping],
    ["Matte Zone", scoreMatteZone],
    ["V-Neck Elongation", scoreVneckElongation],
    // Monochrome Column REMOVED — requires outfit context, always returned 0.0
    ["Hemline", scoreHemline],
    ["Sleeve", scoreSleeve],
    ["Waist Placement", scoreWaistPlacement],
    ["Color Value", scoreColorValue],
    ["Fabric Zone", scoreFabricZone],
    ["Neckline Compound", scoreNecklineCompound],
];

// Dimension weights — 13 active scorers
// Removed: Rise Elongation (0.08), Color Break (0.08), Monochrome Column (0.06)
// Their weight is automatically redistributed via normalization in Layer 7
const BASE_WEIGHTS = {
    "H-Stripe Thinning": 0.10,
    "Dark/Black Slimming": 0.08,
    "A-Line Balance": 0.10,
    "Tent Concealment": 0.12,
    "Bodycon Mapping": 0.12,
    "Matte Zone": 0.06,
    "V-Neck Elongation": 0.10,
    "Hemline": 0.18,
    "Sleeve": 0.15,
    "Waist Placement": 0.15,
    "Color Value": 0.08,
    "Fabric Zone": 0.10,
    "Neckline Compound": 0.12,
};

// Goal -> which scorers get boosted
// CLEANED: Removed references to dead scorers (Monochrome Column, Rise Elongation, Color Break)
const GOAL_WEIGHT_BOOSTS = {
    [StylingGoal.LOOK_TALLER]: {
        "V-Neck Elongation": 1.3, "Hemline": 1.3,
        "Pant Rise": 1.5, "Top Hemline": 1.2,
    },
    [StylingGoal.HIGHLIGHT_WAIST]: {
        "Bodycon Mapping": 1.3, "Waist Placement": 1.5,
        "Tent Concealment": 1.3, "Pant Rise": 1.3, "Jacket Scoring": 1.2,
    },
    [StylingGoal.HIDE_MIDSECTION]: {
        "Tent Concealment": 1.5, "Dark/Black Slimming": 1.3,
        "Matte Zone": 1.3, "Fabric Zone": 1.2,
        "Top Hemline": 1.3, "Jacket Scoring": 1.2,
    },
    [StylingGoal.SLIM_HIPS]: {
        "Dark/Black Slimming": 1.5, "A-Line Balance": 1.3,
        "Matte Zone": 1.3, "Hemline": 1.2,
        "Leg Shape": 1.5, "Top Hemline": 1.3,
    },
    [StylingGoal.LOOK_PROPORTIONAL]: {
        "Waist Placement": 1.5, "Hemline": 1.3,
        "Pant Rise": 1.3,
    },
    [StylingGoal.MINIMIZE_ARMS]: {
        "Sleeve": 1.5, "Matte Zone": 1.3,
        "Jacket Scoring": 1.2,
    },
    [StylingGoal.SLIMMING]: {
        "Dark/Black Slimming": 1.5, "Matte Zone": 1.5,
        "H-Stripe Thinning": 1.3, "Tent Concealment": 1.5,
    },
    [StylingGoal.CONCEALMENT]: {
        "Tent Concealment": 1.5, "Matte Zone": 1.3,
    },
    [StylingGoal.EMPHASIS]: {
        "Bodycon Mapping": 1.5, "V-Neck Elongation": 1.5,
    },
    [StylingGoal.BALANCE]: {},
};

/**
 * Main scoring function — the 7-layer pipeline.
 *
 * @param {Object} garment - Complete garment description
 * @param {Object} body - User's body profile with measurements
 * @param {Object} context - Optional context dict (occasion, culture, etc.)
 * @returns {ScoreResult} with overall 0-10 score, breakdowns, and reasoning
 */
export function scoreGarment(garment, body, context = null) {
    const reasoningChain = [];
    const exceptions = [];
    const fixes = [];

    // ── Layer 1: Fabric Gate ──
    const resolved = resolveFabricProperties(garment);
    const gateExceptions = runFabricGates(garment, body, resolved);
    exceptions.push(...gateExceptions);
    const penaltyReduction = getStructuredPenaltyReduction(gateExceptions);
    reasoningChain.push(
        `L1 Fabric: stretch=${resolved.total_stretch_pct.toFixed(1)}%, ` +
        `GSM=${resolved.effective_gsm.toFixed(0)}, sheen=${resolved.sheen_score.toFixed(2)}, ` +
        `gates=${gateExceptions.length}: ${gateExceptions.map(e => e.exception_id + '(' + e.reason + ')').join(' | ')}`
    );

    // ── Layer 2: Element Scoring ──
    // Auto-classify if category is still default DRESS but garment has type signals
    const category = classifyGarment(garment);
    garment.category = category;
    reasoningChain.push(`Classification: ${category}`);
    const scorersToSkip = getScorersToSkip(category);

    const principleResults = [];
    for (const [name, scorer] of SCORERS) {
        // Skip scorers irrelevant to this garment type
        if (scorersToSkip.has(name)) {
            principleResults.push(new PrincipleResult({
                name,
                score: 0.0,
                reasoning: `N/A for ${category}`,
                weight: 0.0,
                applicable: false,
                confidence: 0.0,
            }));
            continue;
        }

        let score, reasoning, prompt_input_reasoning = [];
        try {
            const result = scorer(garment, body);
            score = result.score;
            reasoning = result.reasoning;
            prompt_input_reasoning = result.prompt_input_reasoning;
        } catch (e) {
            score = 0.0;
            reasoning = `ERROR: ${e.message}`;
        }

        // Apply structured penalty reduction for negative scores
        if (score < 0 && penaltyReduction < 1.0) {
            score *= penaltyReduction;
        }

        const confidence = PRINCIPLE_CONFIDENCE[
            name.toLowerCase().replace(/ /g, "_").replace(/\//g, "_")
        ] ?? 0.70;

        let weight = BASE_WEIGHTS[name] ?? 0.10;
        let applicable = true;

        if (Math.abs(score) < 0.001 && reasoning.toLowerCase().includes("n/a")) {
            weight = 0.0;
            applicable = false;
        }

        principleResults.push(new PrincipleResult({
            name,
            score,
            reasoning,
            weight,
            applicable,
            confidence,
            prompt_input_reasoning,
        }));
    }

    // console.log("prompt_input_reasonoing string: ", principleResults.map(r => r.prompt_input_reasoning.join(" \n ")).join(" \n "));

    // Add garment-type-specific scorers
    const TYPE_SCORER_FUNCS = {
        "Top Hemline": scoreTopHemline,
        "Pant Rise": scorePantRise,
        "Leg Shape": scoreLegShape,
        "Jacket Scoring": scoreJacketScoring,
    };
    for (const extraName of getExtraScorerNames(category)) {
        const scorerFn = TYPE_SCORER_FUNCS[extraName];
        if (!scorerFn) continue;

        let score, reasoning;
        try {
            const result = scorerFn(garment, body);
            score = result.score;
            reasoning = result.reasoning;
        } catch (e) {
            score = 0.0;
            reasoning = `ERROR: ${e.message}`;
        }

        if (score < 0 && penaltyReduction < 1.0) {
            score *= penaltyReduction;
        }

        let weight = TYPE_SCORER_WEIGHTS[extraName] ?? 0.10;
        let applicable = true;
        if (Math.abs(score) < 0.001 && reasoning.toLowerCase().includes("n/a")) {
            weight = 0.0;
            applicable = false;
        }

        principleResults.push(new PrincipleResult({
            name: extraName,
            score,
            reasoning,
            weight,
            applicable,
            confidence: 0.70,
        }));
    }

    // reasoningChain.push(
    //     `L2 Element: ${principleResults.filter(r => r.applicable).length}/${principleResults.length} active`
    // );
    // for (const r of principleResults) {
    //     reasoningChain.push(
    //         `L2 Element: ${r.name} (${r.score.toFixed(2)}) (${r.reasoning})`
    //     );
    // }    

    // ── Layer 3: Perceptual Calibration (goal-based weighting) ──
    // Weighted boost formula: multiply by 1.0 + (boost_factor - 1.0) * goal_weight
    // Tier 1 (weight 1.0) → full boost; Tier 2 (0.5) → half boost; Tier 3 (0.25) → quarter boost

    // Pass 1: Apply goal boosts and negative amplification
    for (const result of principleResults) {
        if (!result.applicable) continue;
        let boostString = ` >> Initial Weight: ${result.weight.toFixed(2)} >> `;
        for (const entry of body.styling_goals) {
            const goal = entry.goal || entry; // support both {goal, weight} and plain enum
            const goalWeight = entry.weight ?? 1.0;
            const boosts = GOAL_WEIGHT_BOOSTS[goal] || {};
            if (result.name in boosts) {
                const boostFactor = boosts[result.name];
                let finalFactor = 1.0 + (boostFactor - 1.0) * goalWeight;
                result.weight *= finalFactor;
                boostString += `${entry.goal} boost : ${finalFactor.toFixed(2)} ; `;
            }
        }

        // Conservative negative amplification
        if (result.score < -0.15) {
            result.weight *= 1.1;
        }
        result.boostString = boostString;
    }

    // Pass 2: Cap weights — calculated ONCE after all boosts applied (fixes order-dependency bug)
    const totalActiveWeightForCap = principleResults
        .filter(r => r.applicable)
        .reduce((sum, r) => sum + r.weight, 0);
    for (const result of principleResults) {
        if (!result.applicable) continue;
        result.weight = Math.min(result.weight, 0.35 * (totalActiveWeightForCap || 0.35));
    }

    reasoningChain.push("L3 Calibration: goal weights + negative amplification applied");
    // for (const result of principleResults) {
    //     reasoningChain.push(
    //         `L3 Calibration Weight: ${result.name} (${result.weight.toFixed(2)}) ${result.boostString || ''}`
    //     );
    // }

    // ── Layer 4: Goal Scoring ──
    const goalVerdicts = scoreGoals(principleResults, body);
    reasoningChain.push(
        `L4 Goals: ${goalVerdicts.filter(v => v.verdict === 'pass').length} pass, ` +
        `${goalVerdicts.filter(v => v.verdict === 'fail').length} fail`
    );
    for (const goalVerdict of goalVerdicts) {
        reasoningChain.push(
            `L4 Goals: ${goalVerdict.goal} : ${goalVerdict.verdict} : (${goalVerdict.reasoning}) ${(goalVerdict.supportingReasoning || []).join(' | ')}`
        );
    }
    // ── Layer 5: Body-Type Parameterization ──
    const bodyAdjusted = translateGarmentToBody(garment, body);
    reasoningChain.push(
        `L5 BodyAdj: hem=${bodyAdjusted.hem_from_floor.toFixed(1)}", ` +
        `sleeve_delta=${bodyAdjusted.arm_width_delta >= 0 ? '+' : ''}${bodyAdjusted.arm_width_delta.toFixed(2)}", ` +
        `leg_ratio=${bodyAdjusted.visual_leg_ratio.toFixed(3)}`
    );

    // ── Layer 6: Context Modifiers ──
    let contextAdjustments = {};
    if (context) {
        contextAdjustments = applyContextModifiers(
            context, principleResults, body, garment
        );
        reasoningChain.push(`L6 Context: ${Object.keys(contextAdjustments).length} adjustments`);
    } else {
        reasoningChain.push("L6 Context: none");
    }

    // ── Layer 7: Composite ──
    const active = principleResults.filter(r => r.applicable);
    if (active.length === 0) {
        return new ScoreResult({
            overall_score: 5.0,
            composite_raw: 0.0,
            confidence: 0.50,
            principle_scores: principleResults,
            goal_verdicts: goalVerdicts,
            body_adjusted: bodyAdjusted,
            exceptions,
            reasoning_chain: reasoningChain,
        });
    }

    const tw = active.reduce((sum, r) => sum + r.weight, 0);
    let composite;
    if (tw === 0) {
        composite = 0.0;
    } else {
        const weightedConfidenceSum = active.reduce((sum, r) => sum + r.weight * r.confidence, 0);
        composite = active.reduce((sum, r) => sum + r.score * r.weight * r.confidence, 0) / weightedConfidenceSum;
    }

    // Silhouette dominance rule — tiered by goal weight
    // Tier 1 (weight ≥ 0.75): override (composite = worstSil * 0.5)
    // Tier 2 (weight ≥ 0.3):  partial reduction (composite reduced by 25%)
    // Tier 3 (weight < 0.3):  don't fire — universal goals shouldn't dominate
    const silNames = new Set(["Tent Concealment", "Bodycon Mapping"]);
    const silScores = active.filter(r => silNames.has(r.name)).map(r => r.score);
    const worstSil = silScores.length > 0 ? Math.min(...silScores) : 0.0;

    const slimmingWeight = Math.max(
        getGoalWeight(body.styling_goals, StylingGoal.SLIMMING),
        getGoalWeight(body.styling_goals, StylingGoal.SLIM_HIPS),
        getGoalWeight(body.styling_goals, StylingGoal.HIDE_MIDSECTION)
    );
    if (worstSil < -0.25 && slimmingWeight >= 0.75 && composite > 0) {
        // Tier 1: User explicitly selected slimming + bad silhouette
        composite = worstSil * 0.4;
        reasoningChain.push(
            `L7 Silhouette dominance (Tier 1): worst_sil=${worstSil >= 0 ? '+' : ''}${worstSil.toFixed(2)} ` +
            `overrides positive composite (goal_weight=${slimmingWeight.toFixed(2)})`
        );
    } else if (worstSil < -0.25 && slimmingWeight >= 0.3 && composite > 0) {
        // Tier 2: Body-derived slimming — partial reduction
        composite *= 0.75;
        reasoningChain.push(
            `L7 Silhouette dominance (Tier 2): worst_sil=${worstSil >= 0 ? '+' : ''}${worstSil.toFixed(2)} ` +
            `reduces composite by 25% (goal_weight=${slimmingWeight.toFixed(2)})`
        );
    }

    // Definition dominance — when user wants body definition (highlight_waist, create_curves,
    // show_legs) but garment's silhouette works against it (tent hides curves, bodycon creates tube)
    if (composite > 0 && worstSil < -0.15) {
        const definitionWeight = Math.max(
            getGoalWeight(body.styling_goals, StylingGoal.EMPHASIS),
            getGoalWeight(body.styling_goals, StylingGoal.HIGHLIGHT_WAIST),
        );
        if (definitionWeight >= 0.75) {
            composite *= 0.65;
            reasoningChain.push(
                `L7 Definition dominance: worst_sil=${worstSil >= 0 ? '+' : ''}${worstSil.toFixed(2)} ` +
                `reduces composite by 35% (def_weight=${definitionWeight.toFixed(2)})`
            );
        } else if (definitionWeight >= 0.3) {
            composite *= 0.80;
            reasoningChain.push(
                `L7 Definition dominance (T2): worst_sil=${worstSil >= 0 ? '+' : ''}${worstSil.toFixed(2)} ` +
                `reduces composite by 20% (def_weight=${definitionWeight.toFixed(2)})`
            );
        }
    }

    composite = clamp(composite);
    const overall = rescaleDisplay(scoreToTen(composite));
    const avgConfidence = active.length > 0
        ? active.reduce((sum, r) => sum + r.confidence, 0) / active.length
        : 0.50;

    // Generate zone scores
    const zoneScores = computeZoneScores(principleResults, bodyAdjusted);

    // Generate fix suggestions
    const generatedFixes = suggestFixes(principleResults, exceptions, body);

    reasoningChain.push(
        `L7 Composite: raw=${composite >= 0 ? '+' : ''}${composite.toFixed(3)}, overall=${overall.toFixed(1)}/10, ` +
        `confidence=${avgConfidence.toFixed(2)}`
    );

    // ── Layer interaction (for jackets, coats, cardigans, vests) ──
    let layerModifications = null;
    let stylingNotes = [];
    if (isLayerGarment(category)) {
        const layerInfo = computeLayerModifications(garment, body);
        layerModifications = layerInfo;
        stylingNotes = layerInfo.styling_notes || [];
        reasoningChain.push(
            `Layer: ${(layerInfo.layer_modifications || []).length} modifications`
        );
    }

    // console.log("prompt_input_reasonoing string: ", principleResults.map(r => r.prompt_input_reasoning.join(" \n ")).join(" \n "));
    return new ScoreResult({
        overall_score: Math.round(overall * 10) / 10,
        composite_raw: Math.round(composite * 10000) / 10000,
        confidence: Math.round(avgConfidence * 100) / 100,
        principle_scores: principleResults,
        goal_verdicts: goalVerdicts,
        zone_scores: zoneScores,
        exceptions,
        fixes: generatedFixes,
        body_adjusted: bodyAdjusted,
        reasoning_chain: reasoningChain,
        layer_modifications: layerModifications,
        styling_notes: stylingNotes,
    });
}

// ================================================================
// HELPERS
// ================================================================

function computeZoneScores(principles, bodyAdj) {
    const zones = {};

    // Map principles to zones
    const zoneMapping = {
        "H-Stripe Thinning": ["torso"],
        "Dark/Black Slimming": ["torso"],
        "Rise Elongation": ["waist"],
        "A-Line Balance": ["hip"],
        "Tent Concealment": ["torso", "hip"],
        "Color Break": ["waist"],
        "Bodycon Mapping": ["torso", "hip", "thigh"],
        "Matte Zone": ["torso", "hip"],
        "V-Neck Elongation": ["bust", "shoulder"],
        "Monochrome Column": ["torso"],
        "Hemline": ["knee", "calf", "ankle"],
        "Sleeve": ["upper_arm", "shoulder"],
        "Waist Placement": ["waist"],
        "Color Value": ["torso"],
        "Fabric Zone": ["torso", "hip"],
        "Neckline Compound": ["bust"],
        ...TYPE_SCORER_ZONE_MAPPING,
    };

    for (const p of principles) {
        if (!p.applicable) continue;
        for (const zone of (zoneMapping[p.name] || [])) {
            if (!zones[zone]) {
                zones[zone] = { scores: [], flags: [] };
            }
            zones[zone].scores.push(p.score);
            if (p.score < -0.20) {
                zones[zone].flags.push(`${p.name}: ${p.score >= 0 ? '+' : ''}${p.score.toFixed(2)}`);
            }
        }
    }

    const results = {};
    for (const [zoneName, data] of Object.entries(zones).sort()) {
        const scores = data.scores;
        const avg = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0.0;
        results[zoneName] = new ZoneScore({
            zone: zoneName,
            score: Math.round(avg * 1000) / 1000,
            flags: data.flags,
        });
    }

    return results;
}

function suggestFixes(principles, exceptions, body) {
    const fixes = [];

    // Find worst scorers
    const worst = principles
        .filter(p => p.applicable && p.score < -0.15)
        .sort((a, b) => a.score - b.score);

    const fixSuggestions = {
        "Tent Concealment": ["Try semi-fitted silhouette (ER 0.03-0.08)", 0.20],
        "Bodycon Mapping": ["Add structured layer or choose heavier fabric (GSM 250+)", 0.25],
        "Color Break": ["Remove contrasting belt or switch to tonal belt", 0.10],
        "A-Line Balance": ["Choose fabric with lower drape coefficient (<40%)", 0.15],
        "Rise Elongation": ["Choose wider elastic waistband (5cm+, 8%+ stretch)", 0.15],
        "V-Neck Elongation": ["Choose V-neck instead of boat/turtleneck", 0.12],
        "Hemline": ["Adjust hem to avoid knee/calf danger zones", 0.20],
        "Sleeve": ["Choose 3/4 sleeve for optimal arm slimming", 0.25],
        "H-Stripe Thinning": ["Replace horizontal stripes with solid or vertical lines", 0.10],
        "Dark/Black Slimming": ["Choose dark chocolate/burgundy for warm skin tones", 0.08],
        "Top Hemline": ["Try tucking in or choosing a cropped/waist-length top", 0.20],
        "Pant Rise": ["Choose high-rise pants to elongate your leg line", 0.25],
        "Leg Shape": ["Try wide-leg or straight-leg pants for your body type", 0.20],
        "Jacket Scoring": ["Try a cropped or waist-length jacket with natural shoulders", 0.15],
    };

    for (const p of worst.slice(0, 3)) {
        if (p.name in fixSuggestions) {
            const [what, improvement] = fixSuggestions[p.name];
            fixes.push(new Fix({
                what_to_change: what,
                expected_improvement: improvement,
                priority: p.score < -0.30 ? 1 : 2,
            }));
        }
    }

    return fixes;
}

// ================================================================
// EXPORTS (for testing)
// ================================================================

export {
    scoreHorizontalStripes,
    scoreDarkSlimming,
    scoreRiseElongation,
    scoreAlineBalance,
    scoreTentConcealment,
    scoreColorBreak,
    scoreBodyconMapping,
    scoreMatteZone,
    scoreVneckElongation,
    scoreMonochromeColumn,
    scoreHemline,
    scoreSleeve,
    scoreWaistPlacement,
    scoreColorValue,
    scoreFabricZone,
    scoreNecklineCompound,
};
