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

function hasGoal(body, goal) {
    return body.styling_goals.includes(goal);
}

// ================================================================
// PRINCIPLE SCORERS 1-10 (ported from domain 4 v4)
// ================================================================
// Each scorer: (garment, body) -> { score, reasoning }
// Score: -1.0 to +1.0, Reasoning: pipe-delimited audit trail

function scoreHorizontalStripes(g, b) {
    const R = [];

    if (!g.has_horizontal_stripes && !g.has_vertical_stripes) {
        return { score: 0.0, reasoning: "No stripes — N/A" };
    }

    // V-stripes-only branch
    if (g.has_vertical_stripes && !g.has_horizontal_stripes) {
        let base = -0.05;
        R.push("V stripes vs solid: ~5% wider (Thompson 2011)");
        if (b.body_shape === BodyShape.RECTANGLE && g.zone === "torso") {
            base = +0.03;
            R.push("Rectangle torso: V adds desired shoulder width");
        } else if (b.body_shape === BodyShape.INVERTED_TRIANGLE && g.zone === "lower_body") {
            base = -0.08;
            R.push("INVT lower: V thins already-narrow hips");
        }
        return { score: clamp(base), reasoning: R.join(" | ") };
    }

    // H-stripes branch
    let base = +0.03;
    R.push("H stripe base vs solid: +0.03 (Koutsoumpis 2021)");

    // Body-size gate (Ashida 2013)
    let sizeMod = 0.0;
    if (b.is_plus_size) {
        sizeMod = -0.10;
        R.push("Plus-size: Helmholtz nullifies/reverses (Ashida)");
    } else if (b.is_petite) {
        sizeMod = +0.05;
        R.push("Petite: Helmholtz amplified on small frames");
    }

    // Zone-split
    let zoneMod = 0.0;
    if (b.body_shape === BodyShape.PEAR) {
        if (g.zone === "torso") {
            zoneMod = +0.08;
            R.push("Pear top: H adds shoulder width (+)");
        } else if (g.zone === "lower_body") {
            zoneMod = -0.05;
            R.push("Pear bottom: attention to hip zone (-)");
        }
    } else if (b.body_shape === BodyShape.INVERTED_TRIANGLE) {
        if (g.zone === "torso") {
            zoneMod = -0.12;
            R.push("INVT top: attention to broad shoulders (-)");
        } else if (g.zone === "lower_body") {
            zoneMod = +0.10;
            R.push("INVT bottom: adds hip volume (+)");
        }
    } else if (b.body_shape === BodyShape.APPLE) {
        if (g.covers_waist) {
            zoneMod = -0.05;
            R.push("Apple midsection: H width emphasis (-)");
        }
    } else if (b.body_shape === BodyShape.RECTANGLE) {
        zoneMod = +0.05;
        R.push("Rectangle: H adds visual interest (+)");
    } else if (b.body_shape === BodyShape.HOURGLASS) {
        zoneMod = +0.03;
        R.push("Hourglass: standard effect");
    }

    // Stripe width
    let swMod = 0.0;
    if (g.stripe_width_cm > 0) {
        if (g.stripe_width_cm < 1.0) {
            swMod = +0.03;
            R.push("Fine stripes: stronger illusion");
        } else if (g.stripe_width_cm > 2.0 && b.is_plus_size) {
            swMod = -0.05;
            R.push("Wide stripes + plus: measurement markers");
        }
    }

    // Dark-stripe luminance
    let lumMod = 0.0;
    if (g.is_dark && g.has_horizontal_stripes) {
        lumMod = +0.04;
        R.push("Dark H stripes: luminance bonus (Koutsoumpis)");
    }

    return { score: clamp(base + sizeMod + zoneMod + swMod + lumMod), reasoning: R.join(" | ") };
}

function scoreDarkSlimming(g, b) {
    const R = [];

    if (g.color_lightness > 0.65) {
        const penalty = -0.05 * ((g.color_lightness - 0.65) / 0.35);
        R.push(`Light color (L=${g.color_lightness.toFixed(2)}): slight expansion`);
        return { score: clamp(penalty), reasoning: R.join(" | ") };
    }

    if (g.color_lightness >= 0.25) {
        let benefit = 0.15 * (1 - (g.color_lightness - 0.10) / 0.55);
        benefit = Math.max(0, benefit);
        R.push(`Mid color (L=${g.color_lightness.toFixed(2)}): proportional benefit ${benefit >= 0 ? '+' : ''}${benefit.toFixed(2)}`);
        return { score: clamp(benefit), reasoning: R.join(" | ") };
    }

    // Dark color path
    let base = 0.15;
    R.push(`Dark color (L=${g.color_lightness.toFixed(2)}): base slimming +0.15`);

    let btMult = 1.0;
    if (b.is_petite && g.zone === "full_body") {
        btMult = 0.6;
        R.push("Petite all-dark: height collapse (x0.6)");
    } else if (b.is_petite && g.zone !== "full_body") {
        btMult = 0.9;
        R.push("Petite zone-dark: mild reduction (x0.9)");
    } else if (b.is_tall) {
        btMult = 1.2;
        R.push("Tall: amplified lean silhouette (x1.2)");
    } else if (b.body_shape === BodyShape.INVERTED_TRIANGLE && g.zone === "torso") {
        btMult = 1.4;
        R.push("INVT upper body: maximum shoulder reduction (x1.4)");
    } else if (b.body_shape === BodyShape.HOURGLASS) {
        btMult = 0.7;
        R.push("Hourglass: dark flattens curves (x0.7)");
    }

    let skinMult = 1.0;
    if (g.zone === "torso" || g.zone === "full_body") {
        if (b.skin_undertone === SkinUndertone.WARM) {
            const sallowStrength = Math.max(0.0, 1.0 - (g.color_lightness / 0.22));
            skinMult = 1.0 - sallowStrength;
            R.push(`Warm undertone near face: sallow x${sallowStrength.toFixed(2)}`);
            if (skinMult < 0.3) {
                R.push("RECOMMEND: dark chocolate brown or burgundy");
            }
        } else if (b.skin_darkness > 0.7) {
            skinMult = 0.5;
            R.push("Dark skin + dark: low contrast (x0.5)");
        }
    }

    let sheenPenalty = 0.0;
    const si = g.sheen_index;
    if (si > 0.5) {
        sheenPenalty = -0.15 * ((si - 0.5) / 0.5);
        if (b.body_shape === BodyShape.APPLE || b.is_plus_size) {
            sheenPenalty *= 1.5;
            R.push("Apple/Plus + high sheen: amplified specular penalty");
        }
        R.push(`High sheen (SI=${si.toFixed(2)}): specular invert`);
    }

    const score = base * btMult * Math.max(skinMult, 0.0) + sheenPenalty;
    return { score: clamp(score), reasoning: R.join(" | ") };
}

function scoreRiseElongation(g, b) {
    const R = [];

    if (g.rise_cm == null) {
        return { score: 0.0, reasoning: "No rise data — N/A" };
    }

    const MID_RISE = 20.0;
    const riseDelta = g.rise_cm - MID_RISE;
    let base = clamp(riseDelta * 0.015, -0.20, +0.20);
    R.push(`Rise ${g.rise_cm.toFixed(0)}cm: base ${base >= 0 ? '+' : ''}${base.toFixed(3)}`);

    if (b.is_petite) {
        if (b.torso_score <= -1.0 && g.rise_cm > 26) {
            R.push("Petite + short torso + high rise: INVERTED");
            return { score: clamp(-0.30), reasoning: R.join(" | ") };
        } else if (b.torso_score >= 1.0) {
            base *= 1.5;
            R.push("Petite + long torso: amplified (x1.5)");
        } else {
            base *= 1.3;
            R.push("Petite + proportional: amplified (x1.3)");
        }
    }

    if (b.is_tall) {
        base *= 0.5;
        R.push("Tall: diminishing returns (x0.5)");
    }

    if ((b.body_shape === BodyShape.APPLE || b.is_plus_size) && b.belly_zone > 0.3) {
        if (g.waistband_width_cm >= 5.0 && g.waistband_stretch_pct >= 8.0) {
            base += 0.10;
            R.push("Wide elastic waistband: smooth containment (+0.10)");
        } else if (g.waistband_width_cm < 3.0 && g.waistband_stretch_pct < 5.0) {
            R.push("Narrow rigid waistband: muffin top -> -0.25");
            return { score: clamp(-0.25), reasoning: R.join(" | ") };
        }
    }

    if (b.body_shape === BodyShape.HOURGLASS && g.rise_cm && g.rise_cm > 24) {
        base += 0.03;
        R.push("Hourglass + high rise: smooth waist-to-hip (+0.03)");
    }

    if (b.body_shape === BodyShape.INVERTED_TRIANGLE) {
        if (g.rise_cm && g.rise_cm > 26 && g.expansion_rate < 0.03) {
            base *= 0.6;
            R.push("INVT + high rise + slim leg (x0.6)");
        }
    }

    return { score: clamp(base), reasoning: R.join(" | ") };
}

function scoreAlineBalance(g, b) {
    const R = [];

    if (g.expansion_rate < 0.03) {
        return { score: 0.0, reasoning: "ER < 0.03: not A-line — N/A" };
    }

    const er = g.expansion_rate;
    let base;
    if (er <= 0.06) {
        base = 0.10 + (er - 0.03) * (0.15 / 0.03);
    } else if (er <= 0.12) {
        base = 0.25;
    } else if (er <= 0.18) {
        base = 0.25 - (er - 0.12) * (0.15 / 0.06);
    } else {
        base = Math.max(-0.10, 0.10 - (er - 0.18) * (0.10 / 0.12));
    }
    R.push(`ER=${er.toFixed(2)}: base A-line = ${base >= 0 ? '+' : ''}${base.toFixed(2)}`);

    const dc = g.drape_coefficient;
    let drapeMult = 1.0;
    if (dc < 40) {
        R.push(`DC=${dc.toFixed(0)}% (drapey): full benefit`);
    } else if (dc < 65) {
        drapeMult = 0.7;
        R.push(`DC=${dc.toFixed(0)}% (medium): x0.7`);
    } else {
        drapeMult = -0.5;
        R.push(`DC=${dc.toFixed(0)}% (stiff): shelf effect INVERSION`);
    }

    let btMod = 0.0;
    if (b.body_shape === BodyShape.INVERTED_TRIANGLE) {
        btMod = +0.15;
        R.push("INVT: max A-line benefit (+0.15)");
    } else if (b.is_tall) {
        btMod = +0.10;
        R.push("Tall: carries volume (+0.10)");
    } else if (b.is_petite) {
        btMod = er > 0.12 ? -0.15 : +0.05;
        R.push(`Petite: ${er > 0.12 ? 'overwhelms frame' : 'scale-appropriate'}`);
    } else if (b.body_shape === BodyShape.HOURGLASS) {
        btMod = +0.05;
    } else if (b.body_shape === BodyShape.PEAR) {
        btMod = +0.05;
    } else if (b.body_shape === BodyShape.APPLE) {
        btMod = +0.03;
    }

    if (b.is_plus_size && drapeMult < 0) {
        drapeMult *= 1.5;
        R.push("Plus + stiff A-line: shelf amplified");
    }

    let hemMod = 0.0;
    if (b.body_shape === BodyShape.PEAR) {
        if (g.hem_position === "mid_thigh") {
            hemMod = -0.10;
        } else if (g.hem_position === "knee") {
            hemMod = +0.05;
        }
    }

    const score = base * Math.max(drapeMult, -1.0) + btMod + hemMod;
    return { score: clamp(score), reasoning: R.join(" | ") };
}

function scoreTentConcealment(g, b) {
    const R = [];

    // Semi-fitted optimal zone
    if (g.expansion_rate >= 0.03 && g.expansion_rate <= 0.08) {
        let score = +0.15;
        R.push(`ER=${g.expansion_rate.toFixed(2)}: semi-fitted optimal`);
        if (b.body_shape === BodyShape.HOURGLASS) {
            score = +0.05;
            R.push("Hourglass: semi-fitted slightly masks curves");
        }
        if (b.is_plus_size && g.is_structured) {
            score = +0.20;
            R.push("Plus + structured semi-fitted: smooth containment");
        }
        return { score: clamp(score), reasoning: R.join(" | ") };
    }

    if (g.expansion_rate < 0.12) {
        return { score: 0.0, reasoning: `ER=${g.expansion_rate.toFixed(2)}: not tent — N/A` };
    }

    const er = g.expansion_rate;

    // Dual-goal split
    const hasConcealment = hasGoal(b, StylingGoal.CONCEALMENT) || hasGoal(b, StylingGoal.HIDE_MIDSECTION);
    const hasSlimming = hasGoal(b, StylingGoal.SLIMMING) || hasGoal(b, StylingGoal.SLIM_HIPS);

    let base;
    if (hasConcealment && !hasSlimming) {
        base = er > 0.20 ? +0.35 : +0.25;
        R.push(`Goal=concealment: excellent hiding (${base >= 0 ? '+' : ''}${base.toFixed(2)})`);
    } else if (hasSlimming && !hasConcealment) {
        base = er > 0.20 ? -0.40 : -0.20;
        R.push(`Goal=slimming: perceived bigger (${base >= 0 ? '+' : ''}${base.toFixed(2)})`);
        R.push("CONCEALMENT PARADOX: hides contours but amplifies size");
    } else {
        const concealment = er > 0.20 ? 0.35 : 0.25;
        const slimming = er > 0.20 ? -0.40 : -0.20;
        base = concealment * 0.3 + slimming * 0.7;
        R.push(`Goal=balance: weighted toward slimming (${base >= 0 ? '+' : ''}${base.toFixed(2)})`);
    }

    // Body-type reversals
    let btMod = 0.0;
    if (b.body_shape === BodyShape.HOURGLASS) {
        btMod = -0.20;
        R.push("HOURGLASS REVERSAL: tent destroys WHR (-0.20)");
    } else if (b.is_petite) {
        btMod = -0.15;
        R.push("PETITE REVERSAL: fabric overwhelms frame (-0.15)");
    } else if (b.is_plus_size) {
        btMod = -0.10;
        R.push("PLUS REVERSAL: max size overestimate (-0.10)");
    } else if (b.body_shape === BodyShape.INVERTED_TRIANGLE) {
        btMod = -0.10;
        R.push("INVT: lampshade from shoulders (-0.10)");
    } else if (b.is_tall) {
        btMod = +0.10;
        R.push("Tall: carries volume (+0.10)");
    } else if (b.body_shape === BodyShape.RECTANGLE) {
        btMod = +0.05;
        R.push("Rectangle: less curve to hide (+0.05)");
    }

    return { score: clamp(base + btMod), reasoning: R.join(" | ") };
}

function scoreColorBreak(g, b) {
    const R = [];

    if (!g.has_contrasting_belt && !g.has_tonal_belt) {
        return { score: 0.0, reasoning: "No belt/break — N/A" };
    }

    if (g.has_tonal_belt && !g.has_contrasting_belt) {
        return { score: -0.03, reasoning: "Tonal belt: mild break (-0.03)" };
    }

    let base = -0.10;
    R.push("Contrasting belt: base leg shortening -0.10");

    if (b.body_shape === BodyShape.HOURGLASS) {
        const score = g.belt_width_cm >= 5 ? +0.25 : +0.20;
        R.push(`HOURGLASS REVERSAL: belt highlights waist (${score >= 0 ? '+' : ''}${score.toFixed(2)})`);
        return { score: clamp(score), reasoning: R.join(" | ") };
    }

    if (b.is_petite) {
        base *= 1.5;
        R.push("Petite: can't afford shortening (x1.5)");
    } else if (b.body_shape === BodyShape.APPLE) {
        base = -0.25;
        R.push("Apple: belt spotlights widest zone (-0.25)");
    } else if (b.is_tall) {
        base *= 0.3;
        R.push("Tall: can afford shortening (x0.3)");
    } else if (b.body_shape === BodyShape.INVERTED_TRIANGLE) {
        base = +0.08;
        R.push("INVT: draws eye to waist (+0.08)");
    } else if (b.body_shape === BodyShape.RECTANGLE) {
        base = +0.05;
        R.push("Rectangle: creates waist definition (+0.05)");
    } else if (b.body_shape === BodyShape.PEAR) {
        if (b.whr < 0.75) {
            base = +0.05;
            R.push(`Pear + narrow waist (WHR=${b.whr.toFixed(2)}): +0.05`);
        } else {
            base = -0.10;
            R.push("Pear + moderate waist: -0.10");
        }
    }

    if (b.is_plus_size) {
        if (b.belly_zone > 0.5) {
            base = Math.min(base, -0.20);
            R.push("Plus + belly: belt at widest (-0.20)");
        } else if (b.belly_zone < 0.2) {
            base = Math.max(base, +0.05);
            R.push("Plus + no belly: belt creates waist (+0.05)");
        }
    }

    return { score: clamp(base), reasoning: R.join(" | ") };
}

function scoreBodyconMapping(g, b) {
    const R = [];

    if (g.expansion_rate > 0.03) {
        return { score: 0.0, reasoning: `ER=${g.expansion_rate.toFixed(2)}: not bodycon — N/A` };
    }

    const isThin = g.gsm_estimated < 200 && !g.is_structured;
    const isStructured = g.gsm_estimated >= 250 || g.is_structured;

    if (b.body_shape === BodyShape.HOURGLASS) {
        let score = isStructured ? +0.35 : +0.30;
        R.push(`HOURGLASS REVERSAL: bodycon maps best feature (${score >= 0 ? '+' : ''}${score.toFixed(2)})`);
        if (b.belly_zone > 0.5) {
            score -= 0.15;
            R.push("Belly concern offset (-0.15)");
        }
        return { score: clamp(score), reasoning: R.join(" | ") };
    }

    if (b.body_shape === BodyShape.APPLE) {
        if (b.is_athletic) {
            return { score: clamp(+0.20), reasoning: "Athletic apple: showcases tone (+0.20)" };
        }
        const score = isThin ? -0.40 : -0.12;
        R.push(`Apple + ${isThin ? 'thin' : 'structured'} bodycon: ${score >= 0 ? '+' : ''}${score.toFixed(2)}`);
        return { score: clamp(score), reasoning: R.join(" | ") };
    }

    if (b.body_shape === BodyShape.PEAR) {
        const score = isThin ? -0.30 : -0.09;
        R.push(`Pear + ${isThin ? 'thin' : 'structured'}: ${score >= 0 ? '+' : ''}${score.toFixed(2)}`);
        return { score: clamp(score), reasoning: R.join(" | ") };
    }

    if (b.is_plus_size) {
        const score = isThin ? -0.40 : -0.05;
        R.push(`Plus + ${isThin ? 'thin' : 'structured (sculpts)'}: ${score >= 0 ? '+' : ''}${score.toFixed(2)}`);
        return { score: clamp(score), reasoning: R.join(" | ") };
    }

    if (b.body_shape === BodyShape.INVERTED_TRIANGLE) {
        let score;
        if (g.zone === "full_body") {
            score = -0.15;
        } else if (g.zone === "lower_body") {
            score = -0.05;
        } else {
            score = -0.10;
        }
        R.push(`INVT bodycon ${g.zone}: ${score >= 0 ? '+' : ''}${score.toFixed(2)}`);
        return { score: clamp(score), reasoning: R.join(" | ") };
    }

    if (b.body_shape === BodyShape.RECTANGLE) {
        return { score: 0.0, reasoning: "Rectangle + bodycon: neutral" };
    }

    return { score: clamp(-0.10), reasoning: "Default bodycon: mild penalty" };
}

function scoreMatteZone(g, b) {
    const R = [];

    const si = g.sheen_index;

    let base;
    if (si < 0.15) {
        base = +0.08;
        R.push(`Deeply matte (SI=${si.toFixed(2)}): +0.08`);
    } else if (si < 0.35) {
        base = +0.08 * (1 - (si - 0.15) / 0.20);
        R.push(`Low sheen (SI=${si.toFixed(2)}): ${base >= 0 ? '+' : ''}${base.toFixed(3)}`);
    } else if (si <= 0.50) {
        base = 0.0;
        R.push(`Neutral sheen (SI=${si.toFixed(2)})`);
    } else {
        base = -0.10 * ((si - 0.50) / 0.50);
        R.push(`High sheen (SI=${si.toFixed(2)}): ${base >= 0 ? '+' : ''}${base.toFixed(3)}`);
    }

    let btMult = 1.0;
    if (b.body_shape === BodyShape.APPLE) {
        btMult = 1.5;
    } else if (b.is_plus_size) {
        btMult = 1.5;
    } else if (b.body_shape === BodyShape.PEAR && (g.zone === "lower_body" || g.zone === "full_body")) {
        btMult = 1.3;
    } else if (b.body_shape === BodyShape.HOURGLASS) {
        btMult = 0.5;
        if (si > 0.35 && si < 0.55) {
            base = +0.05;
            R.push("Hourglass + moderate sheen: curves enhanced");
        }
    } else if (b.body_shape === BodyShape.INVERTED_TRIANGLE && g.zone === "torso") {
        btMult = 1.2;
    }

    // Cling trap
    const cling = g.cling_risk;
    if (cling > 0.6 && si < 0.30) {
        if (b.is_plus_size) {
            return { score: clamp(-0.15), reasoning: "CLING TRAP: matte+clingy on plus (-0.15)" };
        } else if (b.body_shape === BodyShape.PEAR) {
            return { score: clamp(-0.10), reasoning: "CLING TRAP: matte+clingy on pear (-0.10)" };
        } else if (b.body_shape === BodyShape.APPLE) {
            return { score: clamp(-0.12), reasoning: "CLING TRAP: matte+clingy on apple (-0.12)" };
        }
    }

    return { score: clamp(base * btMult), reasoning: R.join(" | ") };
}

function scoreVneckElongation(g, b) {
    const R = [];
    const neck = getNecklineStr(g);

    // Non-V paths
    if (neck !== "v_neck" && neck !== "deep_v") {
        if (neck === "crew") {
            return { score: 0.0, reasoning: "Crew neck: neutral" };
        }
        if (neck === "boat" || neck === "off_shoulder") {
            if (b.body_shape === BodyShape.INVERTED_TRIANGLE) {
                return { score: clamp(-0.15), reasoning: "Boat/off-shoulder on INVT: widens shoulders (-0.15)" };
            } else if (b.body_shape === BodyShape.RECTANGLE) {
                return { score: clamp(+0.08), reasoning: "Boat on rectangle: adds width (+0.08)" };
            } else if (b.body_shape === BodyShape.PEAR) {
                return { score: clamp(+0.05), reasoning: "Boat on pear: shoulder balance (+0.05)" };
            }
            return { score: 0.0, reasoning: `Neckline '${neck}': neutral` };
        }
        if (neck === "scoop") {
            const base = b.body_shape === BodyShape.INVERTED_TRIANGLE ? +0.08 : +0.05;
            return { score: clamp(base), reasoning: `Scoop: mild elongation (${base >= 0 ? '+' : ''}${base.toFixed(2)})` };
        }
        if (neck === "turtleneck") {
            if (b.body_shape === BodyShape.INVERTED_TRIANGLE) {
                return { score: clamp(-0.05), reasoning: "Turtleneck on INVT: upper mass (-0.05)" };
            }
            if (b.is_petite && b.torso_score <= -1.0) {
                return { score: clamp(+0.10), reasoning: "Turtleneck petite short-torso: keeps eye UP (+0.10)" };
            }
            return { score: 0.0, reasoning: "Turtleneck: neutral" };
        }
        if (neck === "wrap") {
            const base = +0.08;
            R.push("Wrap neckline: mild V-effect (+0.08)");
            return { score: clamp(base), reasoning: R.join(" | ") };
        }
        return { score: 0.0, reasoning: `Neckline '${neck}': not scored` };
    }

    // V-neck path
    let base = +0.10;
    R.push("V-neck: base elongation +0.10");

    if (b.body_shape === BodyShape.INVERTED_TRIANGLE) {
        base = +0.18;
        R.push("INVT: narrows shoulder line (+0.18)");
    } else if (b.body_shape === BodyShape.HOURGLASS) {
        base = +0.12;
        R.push("Hourglass: frames bust to waist (+0.12)");
    } else if (b.is_petite) {
        if (b.torso_score <= -1.0) {
            if (g.rise_cm && g.rise_cm > 26) {
                base = -0.05;
                R.push("Petite short-torso + V + high rise: CONFLICT (-0.05)");
            } else {
                base = +0.15;
                R.push("Petite short-torso + V + mid rise: harmonious (+0.15)");
            }
        } else {
            base = +0.12;
            R.push("Petite: vertical channel (+0.12)");
        }
    } else if (b.body_shape === BodyShape.APPLE) {
        base = +0.10;
        R.push("Apple: eye to face, away from belly (+0.10)");
    } else if (b.is_tall) {
        base = +0.05;
        R.push("Tall: diminishing returns (+0.05)");
    } else if (b.body_shape === BodyShape.PEAR) {
        base = +0.10;
        R.push("Pear: attention upward (+0.10)");
    }

    return { score: clamp(base), reasoning: R.join(" | ") };
}

function scoreMonochromeColumn(g, b) {
    const R = [];

    if (!g.is_monochrome_outfit) {
        return { score: 0.0, reasoning: "Not monochrome — N/A" };
    }

    let base = +0.08;
    let darkBonus = g.is_dark ? +0.07 : 0.0;

    if (b.is_petite) {
        base = +0.15;
        R.push("Petite: AMPLIFIED monochrome (+0.15)");
    } else if (b.is_tall) {
        base = +0.03;
        R.push("Tall: doesn't need height (+0.03)");
    } else if (b.body_shape === BodyShape.HOURGLASS) {
        base = +0.03;
        if (g.has_contrasting_belt || g.has_tonal_belt) {
            base = +0.12;
            R.push("Hourglass + mono + belt: best of both (+0.12)");
        }
    } else if (b.body_shape === BodyShape.INVERTED_TRIANGLE) {
        base = +0.05;
    } else if (b.body_shape === BodyShape.APPLE) {
        base = +0.08;
    } else if (b.body_shape === BodyShape.PEAR) {
        base = g.color_lightness < 0.30 ? +0.12 : +0.05;
    } else if (b.is_plus_size) {
        base = +0.10;
    }

    if (b.is_plus_size && g.is_dark) {
        darkBonus = Math.max(darkBonus, +0.08);
        R.push("Plus + dark mono: most reliable combo");
    }

    return { score: clamp(base + darkBonus), reasoning: R.join(" | ") };
}

// ================================================================
// PRINCIPLE SCORERS 11-16 (new, from domain 2/3)
// ================================================================

function scoreHemline(g, b) {
    const R = [];

    const hem = translateHemline(g, b);
    const zone = hem.hem_zone;
    R.push(`Hem ${hem.hem_from_floor.toFixed(1)}" from floor -> ${zone}`);

    if (zone === "above_knee" || zone === "above_knee_near") {
        const inchesAbove = hem.hem_from_floor - b.h_knee;
        let elongation = Math.min(inchesAbove * 0.20, 0.60);
        if (b.is_petite) {
            elongation = Math.min(elongation + (63 - b.height) / 50, 0.80);
            R.push(`Petite above-knee: elongation ${elongation >= 0 ? '+' : ''}${elongation.toFixed(2)}`);
        }
        if (b.is_tall && b.leg_ratio > 0.62) {
            elongation *= 0.65;
            R.push("Tall + long legs: diminished above-knee benefit");
        }

        // Thigh penalty
        let thighPenalty = 0.0;
        if (b.c_thigh_max > 27) {
            thighPenalty = -0.35;
        } else if (b.c_thigh_max > 24) {
            thighPenalty = -0.20;
        } else if (b.c_thigh_max > 22) {
            thighPenalty = -0.10;
        }

        if (b.goal_legs === "showcase") {
            thighPenalty *= 0.5;
        } else if (b.goal_hip === "narrower") {
            thighPenalty *= 1.2;
        }

        // Apple slim-legs bonus
        let appleBonus = 0.0;
        if (b.body_shape === BodyShape.APPLE) {
            if (b.c_thigh_max < 22) {
                appleBonus = +0.15;
            } else if (b.c_thigh_max < 24) {
                appleBonus = +0.08;
            }
        }

        const score = elongation + thighPenalty + appleBonus;
        return { score: clamp(score), reasoning: R.join(" | ") };
    }

    if (zone === "knee_danger") {
        const score = b.is_petite ? -0.40 : -0.30;
        R.push(`Knee danger zone: ${score >= 0 ? '+' : ''}${score.toFixed(2)}`);
        return { score: clamp(score), reasoning: R.join(" | ") };
    }

    if (zone === "safe_zone") {
        const sz = hem.safe_zone;
        let score;
        if (sz) {
            const zonePosition = (sz[1] - hem.hem_from_floor) / hem.safe_zone_size;
            score = (zonePosition >= 0.25 && zonePosition <= 0.75) ? 0.30 : 0.15;
        } else {
            score = 0.15;
        }
        if (b.is_tall) {
            score += 0.10;
        }
        R.push(`Safe zone: ${score >= 0 ? '+' : ''}${score.toFixed(2)}`);
        return { score: clamp(score), reasoning: R.join(" | ") };
    }

    if (zone === "collapsed_zone") {
        R.push("Collapsed safe zone: -0.20");
        return { score: clamp(-0.20), reasoning: R.join(" | ") };
    }

    if (zone === "calf_danger") {
        const calfProm = b.calf_prominence;
        let base;
        if (calfProm > 1.3) {
            base = -0.50;
        } else if (calfProm > 1.2) {
            base = -0.42;
        } else {
            base = -0.35;
        }
        if (b.is_petite) {
            base *= 1.15;
        }
        R.push(`Calf danger zone: ${base >= 0 ? '+' : ''}${base.toFixed(2)}`);
        return { score: clamp(base), reasoning: R.join(" | ") };
    }

    if (zone === "below_calf") {
        return { score: clamp(+0.15), reasoning: "Below calf: safe (+0.15)" };
    }

    if (zone === "ankle") {
        let score;
        if (b.is_petite) {
            if (g.silhouette === Silhouette.OVERSIZED || g.silhouette === Silhouette.SHIFT) {
                score = -0.15;
            } else if (g.silhouette === Silhouette.FITTED && g.has_waist_definition) {
                score = +0.40;
            } else if (g.silhouette === Silhouette.FITTED) {
                score = +0.15;
            } else {
                score = +0.10;
            }
        } else if (b.is_tall) {
            score = +0.45;
        } else {
            score = +0.25;
        }

        if (b.body_shape === BodyShape.HOURGLASS && !g.has_waist_definition) {
            score -= 0.15;
        }
        R.push(`Ankle: ${score >= 0 ? '+' : ''}${score.toFixed(2)}`);
        return { score: clamp(score), reasoning: R.join(" | ") };
    }

    if (zone === "floor") {
        let score;
        if (b.is_tall) {
            score = +0.15;
        } else if (b.is_petite) {
            score = -0.10;
        } else {
            score = +0.05;
        }
        R.push(`Floor: ${score >= 0 ? '+' : ''}${score.toFixed(2)}`);
        return { score: clamp(score), reasoning: R.join(" | ") };
    }

    return { score: 0.0, reasoning: `Unknown zone: ${zone} — N/A` };
}

function scoreSleeve(g, b) {
    const R = [];

    if (g.sleeve_type === SleeveType.SLEEVELESS) {
        return { score: 0.0, reasoning: "Sleeveless: baseline — N/A" };
    }

    const sleeve = translateSleeve(g, b);
    const delta = sleeve.delta_vs_actual;
    const severity = sleeve.arm_prominence_severity;

    R.push(`Sleeve endpoint ${sleeve.endpoint_position.toFixed(1)}", delta=${delta >= 0 ? '+' : ''}${delta.toFixed(2)}", severity=${severity.toFixed(1)}`);

    // Score from delta (domain 2 line ~4076)
    let score;
    if (delta > 0.30) {
        score = -4.0;
    } else if (delta > 0.15) {
        score = -2.0;
    } else if (delta > 0) {
        score = -1.0;
    } else if (delta > -0.30) {
        score = 1.0;
    } else if (delta > -0.60) {
        score = 3.0;
    } else {
        score = 5.0;
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
    }

    // Normalize from [-4..+5] to [-1..+1] range
    const normalized = clamp(score / 5.0, -1.0, 1.0);
    R.push(`Raw score ${score >= 0 ? '+' : ''}${score.toFixed(1)} -> normalized ${normalized >= 0 ? '+' : ''}${normalized.toFixed(2)}`);

    return { score: normalized, reasoning: R.join(" | ") };
}

function scoreWaistPlacement(g, b) {
    const R = [];

    if (g.waist_position === "no_waist") {
        return { score: 0.0, reasoning: "No waist definition — N/A" };
    }

    const waist = translateWaistline(g, b);
    let propScore = waist.proportion_score;
    R.push(`Waist=${g.waist_position}: visual leg ratio ${waist.visual_leg_ratio.toFixed(3)} (golden=${GOLDEN_RATIO}), improvement=${waist.proportion_improvement >= 0 ? '+' : ''}${waist.proportion_improvement.toFixed(3)}`);

    // Empire + hourglass shape loss
    if (g.waist_position === "empire" && b.body_shape === BodyShape.HOURGLASS) {
        const stretch = g.elastane_pct * 1.6;  // approximate
        if (stretch > 10) {
            propScore -= 0.10;
            R.push("Empire + hourglass + stretch: mild shape loss (-0.10)");
        } else if (g.drape > 7) {
            propScore -= 0.15;
            R.push("Empire + hourglass + drapey: shape loss (-0.15)");
        } else {
            propScore -= 0.30;
            R.push("Empire + hourglass + stiff: significant shape loss (-0.30)");
        }
    }

    // Empire + large bust tent effect
    if (g.waist_position === "empire" && b.bust_differential >= 6) {
        const bustProj = b.bust_differential * 0.4;
        if (g.drape < 4) {
            const tentSeverity = bustProj * (1.0 - g.drape / 10.0);
            if (tentSeverity > 2.0) {
                propScore -= 0.45;
                R.push("Empire + large bust + stiff: tent effect (-0.45)");
            } else if (tentSeverity > 1.0) {
                propScore -= 0.25;
            } else {
                propScore -= 0.10;
            }
        }
    }

    // Drop waist + short legs
    if (g.waist_position === "drop") {
        if (b.leg_ratio < 0.55) {
            propScore -= 0.30;
            R.push("Drop waist + short legs: proportion penalty (-0.30)");
        } else if (b.leg_ratio < 0.58) {
            propScore -= 0.15;
        }
    }

    // Apple + belt at natural waist
    if (b.body_shape === BodyShape.APPLE && g.waist_position === "natural" &&
        g.has_contrasting_belt && b.whr > 0.85) {
        propScore -= b.whr > 0.88 ? 0.30 : 0.15;
        R.push("Apple + belt at natural waist: spotlights widest");
    }

    propScore = clamp(propScore, -0.80, 0.80);
    return { score: propScore, reasoning: R.join(" | ") };
}

function scoreColorValue(g, b) {
    const R = [];

    const L = g.color_lightness * 100;  // convert 0-1 to 0-100

    let slimPct;
    if (L <= 10) {
        slimPct = 0.04;
    } else if (L <= 25) {
        slimPct = 0.03;
    } else if (L <= 40) {
        slimPct = 0.02;
    } else if (L <= 60) {
        slimPct = 0.005;
    } else if (L <= 80) {
        slimPct = -0.005;
    } else {
        slimPct = -0.01;
    }

    const slimScore = slimPct * 6.25;  // maps 4% -> +0.25
    R.push(`Color L=${L.toFixed(0)}: slim_pct=${slimPct >= 0 ? '+' : ''}${slimPct.toFixed(3)}, score=${slimScore >= 0 ? '+' : ''}${slimScore.toFixed(3)}`);

    // Hourglass shape-loss penalty (dark monochrome)
    let shapeLoss = 0.0;
    if (L <= 25 && b.body_shape === BodyShape.HOURGLASS) {
        const whd = b.bust - b.waist;  // approximate waist-hip diff
        if (whd >= 8) {
            shapeLoss = -0.30 * (1.0 - L / 25);
        } else if (whd >= 6) {
            shapeLoss = -0.20 * (1.0 - L / 25);
        } else {
            shapeLoss = -0.10 * (1.0 - L / 25);
        }
        R.push(`Hourglass dark shape loss: ${shapeLoss >= 0 ? '+' : ''}${shapeLoss.toFixed(2)}`);
    } else if (L <= 25 && b.body_shape === BodyShape.RECTANGLE) {
        shapeLoss = +0.05;
        R.push("Rectangle dark: clean column bonus (+0.05)");
    }

    // Skin tone contrast (very dark garment)
    let contrastMod = 0.0;
    if (L <= 15 && (g.zone === "torso" || g.zone === "full_body")) {
        const skinGarmentContrast = Math.abs(b.skin_tone_L / 100 - L / 100);
        if (skinGarmentContrast > 0.70) {
            contrastMod = -0.05;
        } else if (skinGarmentContrast < 0.30) {
            contrastMod = +0.05;
        }
    }

    const score = slimScore + shapeLoss + contrastMod;
    return { score: clamp(score), reasoning: R.join(" | ") };
}

function scoreFabricZone(g, b) {
    const R = [];

    const resolved = resolveFabricProperties(g);

    // Weighted sub-scores (domain 3: cling 30%, structure 20%, sheen 15%,
    // drape 10%, color 8%, texture 5%, pattern 5%, silhouette 4%, construction 3%)
    const scores = {};

    // Cling sub-score (30%)
    let clingScore;
    if (resolved.cling_risk_base > 0.6) {
        clingScore = -0.20;
        if (b.is_plus_size || b.belly_zone > 0.5) {
            clingScore = -0.40;
        }
    } else if (resolved.cling_risk_base > 0.3) {
        clingScore = -0.05;
    } else {
        clingScore = +0.10;
    }
    scores.cling = [clingScore, 0.30];

    // Structure sub-score (20%)
    let structScore;
    if (resolved.is_structured) {
        structScore = +0.15;
    } else if (resolved.effective_gsm > 250) {
        structScore = +0.08;
    } else if (resolved.effective_gsm < 100) {
        structScore = -0.10;
    } else {
        structScore = 0.0;
    }
    scores.structure = [structScore, 0.20];

    // Sheen sub-score (15%) — from P8
    const { score: sheenScore } = scoreMatteZone(g, b);
    scores.sheen = [sheenScore, 0.15];

    // Drape sub-score (10%)
    const dc = resolved.drape_coefficient;
    let drapeScore;
    if (dc < 30) {
        drapeScore = +0.10;  // very drapey: good body skimming
    } else if (dc < 50) {
        drapeScore = +0.05;
    } else if (dc < 70) {
        drapeScore = 0.0;
    } else {
        drapeScore = -0.10;  // stiff: holds its own shape
    }
    scores.drape = [drapeScore, 0.10];

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

    R.push(`Fabric zone: stretch=${resolved.total_stretch_pct.toFixed(1)}%, GSM=${resolved.effective_gsm.toFixed(0)}, sheen=${resolved.sheen_score.toFixed(2)}`);
    return { score: clamp(composite), reasoning: R.join(" | ") };
}

function scoreNecklineCompound(g, b) {
    const R = [];
    const neck = getNecklineStr(g);

    if (!["v_neck", "deep_v", "wrap", "scoop"].includes(neck)) {
        return { score: 0.0, reasoning: `Neckline '${neck}': no compound scoring — N/A` };
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
    } else if (depthRatio < 0.85) {
        bustScore = +0.50;
    } else if (depthRatio < 1.0) {
        if (b.goal_bust === "enhance") {
            bustScore = +0.70;
        } else if (b.goal_bust === "minimize") {
            bustScore = -0.20;
        } else {
            bustScore = +0.30;
        }
    } else if (depthRatio < 1.15) {
        if (b.goal_bust === "enhance") {
            bustScore = +0.30;
        } else if (b.goal_bust === "minimize") {
            bustScore = -0.60;
        } else {
            bustScore = -0.15;
        }
    } else {
        if (b.goal_bust === "enhance") {
            bustScore = +0.10;
        } else if (b.goal_bust === "minimize") {
            bustScore = -0.85;
        } else {
            bustScore = -0.35;
        }
    }

    R.push(`Bust: depth=${depth.toFixed(1)}", threshold=${threshold.toFixed(1)}", ratio=${depthRatio.toFixed(2)}, score=${bustScore >= 0 ? '+' : ''}${bustScore.toFixed(2)}`);

    // Torso slimming by V angle
    const vWidth = g.v_depth_cm * 0.8;  // approximate V width
    const vAngle = depth > 0 ? vWidth / depth : 1.0;
    let torsoBase;
    if (vAngle < 0.5) {
        torsoBase = 0.25;
    } else if (vAngle < 1.0) {
        torsoBase = 0.18;
    } else if (vAngle < 1.5) {
        torsoBase = 0.10;
    } else {
        torsoBase = 0.05;
    }

    if (b.body_shape === BodyShape.APPLE) {
        torsoBase *= 1.30;
    } else if (b.body_shape === BodyShape.RECTANGLE) {
        torsoBase *= 1.15;
    }

    // Upper body balance
    let balance = 0.15;
    if (b.body_shape === BodyShape.INVERTED_TRIANGLE) {
        balance = 0.45;
    } else if (b.body_shape === BodyShape.PEAR) {
        balance = 0.30;
    } else if (b.body_shape === BodyShape.RECTANGLE) {
        balance = 0.20;
    } else if (b.body_shape === BodyShape.HOURGLASS) {
        balance = 0.10;
    }

    // Weighted compound: bust 40%, torso 30%, balance 30%
    const compound = bustScore * 0.40 + torsoBase * 0.30 + balance * 0.30;
    R.push(`Compound: bust=${bustScore >= 0 ? '+' : ''}${bustScore.toFixed(2)}*0.4 + torso=${torsoBase >= 0 ? '+' : ''}${torsoBase.toFixed(2)}*0.3 + balance=${balance >= 0 ? '+' : ''}${balance.toFixed(2)}*0.3 = ${compound >= 0 ? '+' : ''}${compound.toFixed(2)}`);

    return { score: clamp(compound), reasoning: R.join(" | ") };
}

// ================================================================
// COMPOSITE SCORER — 7-LAYER PIPELINE
// ================================================================

// All 16 scorers with names
const SCORERS = [
    ["H-Stripe Thinning", scoreHorizontalStripes],
    ["Dark/Black Slimming", scoreDarkSlimming],
    ["Rise Elongation", scoreRiseElongation],
    ["A-Line Balance", scoreAlineBalance],
    ["Tent Concealment", scoreTentConcealment],
    ["Color Break", scoreColorBreak],
    ["Bodycon Mapping", scoreBodyconMapping],
    ["Matte Zone", scoreMatteZone],
    ["V-Neck Elongation", scoreVneckElongation],
    ["Monochrome Column", scoreMonochromeColumn],
    ["Hemline", scoreHemline],
    ["Sleeve", scoreSleeve],
    ["Waist Placement", scoreWaistPlacement],
    ["Color Value", scoreColorValue],
    ["Fabric Zone", scoreFabricZone],
    ["Neckline Compound", scoreNecklineCompound],
];

// Dimension weights (domain 2 line ~10947)
const BASE_WEIGHTS = {
    "H-Stripe Thinning": 0.10,
    "Dark/Black Slimming": 0.08,
    "Rise Elongation": 0.08,
    "A-Line Balance": 0.10,
    "Tent Concealment": 0.12,
    "Color Break": 0.08,
    "Bodycon Mapping": 0.12,
    "Matte Zone": 0.06,
    "V-Neck Elongation": 0.10,
    "Monochrome Column": 0.06,
    "Hemline": 0.18,
    "Sleeve": 0.15,
    "Waist Placement": 0.15,
    "Color Value": 0.08,
    "Fabric Zone": 0.10,
    "Neckline Compound": 0.12,
};

// Goal -> which scorers get boosted
const GOAL_WEIGHT_BOOSTS = {
    [StylingGoal.LOOK_TALLER]: {
        "Monochrome Column": 1.5, "Rise Elongation": 1.3,
        "V-Neck Elongation": 1.3, "Hemline": 1.3,
        "Pant Rise": 1.5, "Top Hemline": 1.2,
    },
    [StylingGoal.HIGHLIGHT_WAIST]: {
        "Color Break": 1.5, "Bodycon Mapping": 1.3,
        "Waist Placement": 1.5,
        "Pant Rise": 1.3, "Jacket Scoring": 1.2,
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
        "Rise Elongation": 1.3,
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
        "Bodycon Mapping": 1.5, "Color Break": 1.5,
        "V-Neck Elongation": 1.5,
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
        `gates=${gateExceptions.length}`
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

        let score, reasoning;
        try {
            const result = scorer(garment, body);
            score = result.score;
            reasoning = result.reasoning;
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
        }));
    }

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

    reasoningChain.push(
        `L2 Element: ${principleResults.filter(r => r.applicable).length}/${principleResults.length} active`
    );

    // ── Layer 3: Perceptual Calibration (goal-based weighting) ──
    for (const result of principleResults) {
        if (!result.applicable) continue;
        for (const goal of body.styling_goals) {
            const boosts = GOAL_WEIGHT_BOOSTS[goal] || {};
            if (result.name in boosts) {
                result.weight *= boosts[result.name];
            }
        }

        // Conservative negative amplification
        if (result.score < -0.15) {
            result.weight *= 1.2;
        }

        // Cap single dimension weight
        const activeResults = principleResults.filter(r => r.applicable);
        const totalActiveWeight = activeResults.reduce((sum, r) => sum + r.weight, 0);
        result.weight = Math.min(result.weight, 0.35 * (totalActiveWeight || 0.35));
    }

    reasoningChain.push("L3 Calibration: goal weights + negative amplification applied");

    // ── Layer 4: Goal Scoring ──
    const goalVerdicts = scoreGoals(principleResults, body);
    reasoningChain.push(
        `L4 Goals: ${goalVerdicts.filter(v => v.verdict === 'pass').length} pass, ` +
        `${goalVerdicts.filter(v => v.verdict === 'fail').length} fail`
    );

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

    // Silhouette dominance rule
    const silNames = new Set(["Tent Concealment", "Bodycon Mapping"]);
    const silScores = active.filter(r => silNames.has(r.name)).map(r => r.score);
    const worstSil = silScores.length > 0 ? Math.min(...silScores) : 0.0;

    const hasSlimmingGoal = (
        hasGoal(body, StylingGoal.SLIMMING) ||
        hasGoal(body, StylingGoal.SLIM_HIPS) ||
        hasGoal(body, StylingGoal.HIDE_MIDSECTION)
    );
    if (worstSil < -0.20 && hasSlimmingGoal && composite > 0) {
        composite = worstSil * 0.3;
        reasoningChain.push(
            `L7 Silhouette dominance: worst_sil=${worstSil >= 0 ? '+' : ''}${worstSil.toFixed(2)} ` +
            `overrides positive composite`
        );
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
