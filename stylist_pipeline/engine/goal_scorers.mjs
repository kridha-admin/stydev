/**
 * Kridha Production Scoring Engine - Goal Scorers
 * ================================================
 * Maps user styling goals to principle scores and produces GoalVerdict.
 */

import { GoalVerdict, StylingGoal } from './schemas.mjs';

// ================================================================
// GOAL -> PRINCIPLE MAPPING
// ================================================================

export const GOAL_PRINCIPLE_MAP = {
    [StylingGoal.LOOK_TALLER]: {
        positive: [
            "Monochrome Column", "Rise Elongation", "V-Neck Elongation",
            "Hemline", "Waist Placement", "Pant Rise",
        ],
        negative: ["Color Break", "H-Stripe Thinning", "Top Hemline"],
        weights: {
            "Monochrome Column": 1.5,
            "Rise Elongation": 1.3,
            "V-Neck Elongation": 1.2,
            "Hemline": 1.3,
            "Waist Placement": 1.2,
            "Color Break": 1.3,
            "Pant Rise": 1.5,
            "Top Hemline": 1.2,
        },
    },
    [StylingGoal.HIGHLIGHT_WAIST]: {
        positive: [
            "Color Break", "Bodycon Mapping", "Waist Placement",
            "Pant Rise", "Jacket Scoring",
        ],
        negative: ["Tent Concealment"],
        weights: {
            "Color Break": 1.5,
            "Bodycon Mapping": 1.2,
            "Waist Placement": 1.5,
            "Tent Concealment": 1.3,
            "Pant Rise": 1.3,
            "Jacket Scoring": 1.2,
        },
    },
    [StylingGoal.HIDE_MIDSECTION]: {
        positive: [
            "Tent Concealment", "Dark/Black Slimming", "Matte Zone",
            "Fabric Zone", "Top Hemline", "Jacket Scoring",
        ],
        negative: ["Bodycon Mapping", "Color Break", "Pant Rise"],
        weights: {
            "Tent Concealment": 1.5,
            "Dark/Black Slimming": 1.3,
            "Matte Zone": 1.2,
            "Bodycon Mapping": 1.5,
            "Color Break": 1.2,
            "Top Hemline": 1.3,
            "Jacket Scoring": 1.2,
            "Pant Rise": 1.2,
        },
    },
    [StylingGoal.SLIM_HIPS]: {
        positive: [
            "Dark/Black Slimming", "A-Line Balance", "Matte Zone",
            "Hemline", "Leg Shape",
        ],
        negative: ["H-Stripe Thinning", "Bodycon Mapping", "Top Hemline"],
        weights: {
            "Dark/Black Slimming": 1.5,
            "A-Line Balance": 1.3,
            "Matte Zone": 1.2,
            "Hemline": 1.2,
            "H-Stripe Thinning": 1.3,
            "Bodycon Mapping": 1.3,
            "Leg Shape": 1.5,
            "Top Hemline": 1.3,
        },
    },
    [StylingGoal.LOOK_PROPORTIONAL]: {
        positive: [
            "Waist Placement", "Hemline", "Rise Elongation",
            "Monochrome Column", "Pant Rise", "Jacket Scoring",
        ],
        negative: ["Tent Concealment"],
        weights: {
            "Waist Placement": 1.5,
            "Hemline": 1.3,
            "Rise Elongation": 1.2,
            "Tent Concealment": 1.2,
            "Pant Rise": 1.3,
            "Jacket Scoring": 1.1,
        },
    },
    [StylingGoal.MINIMIZE_ARMS]: {
        positive: ["Sleeve", "Matte Zone", "Jacket Scoring"],
        negative: [],
        weights: {
            "Sleeve": 1.5,
            "Matte Zone": 1.2,
            "Jacket Scoring": 1.2,
        },
    },
    [StylingGoal.SLIMMING]: {
        positive: [
            "Dark/Black Slimming", "Matte Zone", "H-Stripe Thinning",
            "Color Value",
        ],
        negative: ["Tent Concealment", "Bodycon Mapping"],
        weights: {
            "Dark/Black Slimming": 1.5,
            "Matte Zone": 1.3,
            "Tent Concealment": 1.5,
        },
    },
    [StylingGoal.CONCEALMENT]: {
        positive: ["Tent Concealment", "Matte Zone", "Dark/Black Slimming"],
        negative: ["Bodycon Mapping"],
        weights: {
            "Tent Concealment": 1.5,
            "Matte Zone": 1.3,
        },
    },
    [StylingGoal.EMPHASIS]: {
        positive: ["Bodycon Mapping", "Color Break", "V-Neck Elongation"],
        negative: ["Tent Concealment"],
        weights: {
            "Bodycon Mapping": 1.5,
            "Color Break": 1.3,
            "V-Neck Elongation": 1.3,
        },
    },
    [StylingGoal.BALANCE]: {
        positive: ["Waist Placement", "A-Line Balance", "Hemline"],
        negative: [],
        weights: {},
    },
};

// ================================================================
// GOAL SCORING
// ================================================================

function scoreSingleGoal(goal, principles) {
    // console.log("scoreSingleGoal", goal);
    const mapping = GOAL_PRINCIPLE_MAP[goal] ?? { positive: [], negative: [], weights: {} };

    const positiveNames = new Set(mapping.positive);
    const negativeNames = new Set(mapping.negative);
    const weights = mapping.weights || {};

    let weightedSum = 0.0;
    let totalWeight = 0.0;
    const supporting = [];
    const supportingReasoning = [];
    const supportingPrincipleReasoning = [];

    // Build name -> result lookup
    const byName = {};
    for (const p of principles) {
        if (p.applicable) byName[p.name] = p;
    }

    // Positive principles: higher score = better for this goal
    for (const name of positiveNames) {
        const p = byName[name];
        if (!p) continue;
        const w = weights[name] ?? 1.0;
        let weighteSumPrev = weightedSum;
        weightedSum += p.score * w;
        totalWeight += w;
        if (Math.abs(p.score) > 0.0) {
            supporting.push(`+${name} (${p.score >= 0 ? '+' : ''}${p.score.toFixed(2)})`);
            supportingReasoning.push(`+${name} (${weighteSumPrev.toFixed(2)} + ${p.score.toFixed(2)} * ${w.toFixed(2)} = ${weightedSum.toFixed(2)})`);
            supportingPrincipleReasoning.push(`\n\n L2 Element: +${name} {${p.score.toFixed(2)}} :  (${p.reasoning})`);
        }
    }

    // Negative principles: negative score = BETTER for this goal
    for (const name of negativeNames) {
        const p = byName[name];
        if (!p) continue;
        const w = weights[name] ?? 1.0;
        let weighteSumPrev = weightedSum;
        weightedSum -= p.score * w;
        totalWeight += w;
        if (Math.abs(p.score) > 0.0) {
            supporting.push(`-${name} avoided (${p.score.toFixed(2)})`);
            supportingReasoning.push(`-${name} avoided (${weighteSumPrev.toFixed(2)} - ${p.score.toFixed(2)} * ${w.toFixed(2)} = ${weightedSum.toFixed(2)})`);
            supportingPrincipleReasoning.push(`\n\n L2 Element: -${name} {${p.score.toFixed(2)}} :  (${p.reasoning})`);
        }
    }

    if (totalWeight === 0) {
        return new GoalVerdict({
            goal,
            verdict: "caution",
            score: 0.0,
            supporting_principles: [],
            supportingReasoning: [],
            reasoning: "No applicable principles for this goal",
        });
    }

    const finalScore = weightedSum / totalWeight;
    supportingReasoning.push(` final score ${finalScore.toFixed(2)} = weighted sum ${weightedSum.toFixed(2)} / total weight ${totalWeight.toFixed(2)}`);

    let verdict;
    if (finalScore > 0.06) verdict = "pass";
    else if (finalScore < -0.06) verdict = "fail";
    else verdict = "caution";

    return new GoalVerdict({
        goal,
        verdict,
        score: Math.round(finalScore * 1000) / 1000,
        supporting_principles: supporting,
        supportingReasoning: supportingReasoning.concat(supportingPrincipleReasoning),
        reasoning: `Weighted score: ${finalScore >= 0 ? '+' : ''}${finalScore.toFixed(3)} (${verdict})`,
    });
}

export function scoreGoals(principles, body) {
    const verdicts = [];
    for (const entry of body.styling_goals) {
        // Support both {goal, weight} objects and plain enum values
        const goal = entry.goal || entry;
        const verdict = scoreSingleGoal(goal, principles);
        verdicts.push(verdict);
    }
    return verdicts;
}
