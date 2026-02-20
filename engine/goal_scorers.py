"""
Kridha Production Scoring Engine — Goal Scorers
================================================
Maps user styling goals to principle scores and produces GoalVerdict
for each active goal.
"""

from typing import Dict, List

from .schemas import (
    BodyProfile, PrincipleResult, GoalVerdict, StylingGoal,
)


# ================================================================
# GOAL → PRINCIPLE MAPPING
# ================================================================

GOAL_PRINCIPLE_MAP: Dict[StylingGoal, Dict[str, object]] = {
    StylingGoal.LOOK_TALLER: {
        "positive": [
            "Monochrome Column", "Rise Elongation", "V-Neck Elongation",
            "Hemline", "Waist Placement",
            "Pant Rise",
        ],
        "negative": [
            "Color Break", "H-Stripe Thinning",
            "Top Hemline",
        ],
        "weights": {
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
    StylingGoal.HIGHLIGHT_WAIST: {
        "positive": [
            "Color Break", "Bodycon Mapping", "Waist Placement",
            "Pant Rise",
            "Jacket Scoring",
        ],
        "negative": [
            "Tent Concealment",
        ],
        "weights": {
            "Color Break": 1.5,
            "Bodycon Mapping": 1.2,
            "Waist Placement": 1.5,
            "Tent Concealment": 1.3,
            "Pant Rise": 1.3,
            "Jacket Scoring": 1.2,
        },
    },
    StylingGoal.HIDE_MIDSECTION: {
        "positive": [
            "Tent Concealment", "Dark/Black Slimming", "Matte Zone",
            "Fabric Zone",
            "Top Hemline",
            "Jacket Scoring",
        ],
        "negative": [
            "Bodycon Mapping", "Color Break",
            "Pant Rise",
        ],
        "weights": {
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
    StylingGoal.SLIM_HIPS: {
        "positive": [
            "Dark/Black Slimming", "A-Line Balance", "Matte Zone",
            "Hemline",
            "Leg Shape",
        ],
        "negative": [
            "H-Stripe Thinning", "Bodycon Mapping",
            "Top Hemline",
        ],
        "weights": {
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
    StylingGoal.LOOK_PROPORTIONAL: {
        "positive": [
            "Waist Placement", "Hemline", "Rise Elongation",
            "Monochrome Column",
            "Pant Rise",
            "Jacket Scoring",
        ],
        "negative": [
            "Tent Concealment",
        ],
        "weights": {
            "Waist Placement": 1.5,
            "Hemline": 1.3,
            "Rise Elongation": 1.2,
            "Tent Concealment": 1.2,
            "Pant Rise": 1.3,
            "Jacket Scoring": 1.1,
        },
    },
    StylingGoal.MINIMIZE_ARMS: {
        "positive": [
            "Sleeve", "Matte Zone",
            "Jacket Scoring",
        ],
        "negative": [],
        "weights": {
            "Sleeve": 1.5,
            "Matte Zone": 1.2,
            "Jacket Scoring": 1.2,
        },
    },
    # Legacy goals used by domain 4 scorers internally
    StylingGoal.SLIMMING: {
        "positive": [
            "Dark/Black Slimming", "Matte Zone", "H-Stripe Thinning",
            "Color Value",
        ],
        "negative": [
            "Tent Concealment", "Bodycon Mapping",
        ],
        "weights": {
            "Dark/Black Slimming": 1.5,
            "Matte Zone": 1.3,
            "Tent Concealment": 1.5,
        },
    },
    StylingGoal.CONCEALMENT: {
        "positive": [
            "Tent Concealment", "Matte Zone", "Dark/Black Slimming",
        ],
        "negative": [
            "Bodycon Mapping",
        ],
        "weights": {
            "Tent Concealment": 1.5,
            "Matte Zone": 1.3,
        },
    },
    StylingGoal.EMPHASIS: {
        "positive": [
            "Bodycon Mapping", "Color Break", "V-Neck Elongation",
        ],
        "negative": [
            "Tent Concealment",
        ],
        "weights": {
            "Bodycon Mapping": 1.5,
            "Color Break": 1.3,
            "V-Neck Elongation": 1.3,
        },
    },
    StylingGoal.BALANCE: {
        "positive": [
            "Waist Placement", "A-Line Balance", "Hemline",
        ],
        "negative": [],
        "weights": {},
    },
}


# ================================================================
# GOAL SCORING
# ================================================================

def _score_single_goal(
    goal: StylingGoal,
    principles: List[PrincipleResult],
) -> GoalVerdict:
    """Score a single styling goal against principle results."""
    mapping = GOAL_PRINCIPLE_MAP.get(goal, {"positive": [], "negative": [], "weights": {}})

    positive_names = set(mapping["positive"])
    negative_names = set(mapping["negative"])
    weights = mapping.get("weights", {})

    weighted_sum = 0.0
    total_weight = 0.0
    supporting = []

    # Build name -> result lookup
    by_name = {p.name: p for p in principles if p.applicable}

    # Positive principles: higher score = better for this goal
    for name in positive_names:
        p = by_name.get(name)
        if p is None:
            continue
        w = weights.get(name, 1.0)
        weighted_sum += p.score * w
        total_weight += w
        if p.score > 0.05:
            supporting.append(f"+{name} ({p.score:+.2f})")

    # Negative principles: negative score = BETTER for this goal
    # (i.e., color break negative = good for look_taller)
    for name in negative_names:
        p = by_name.get(name)
        if p is None:
            continue
        w = weights.get(name, 1.0)
        # Invert: if the principle hurts the goal, a negative score there helps
        weighted_sum -= p.score * w
        total_weight += w
        if p.score < -0.05:
            supporting.append(f"-{name} avoided ({p.score:+.2f})")

    if total_weight == 0:
        return GoalVerdict(
            goal=goal, verdict="caution", score=0.0,
            supporting_principles=[],
            reasoning="No applicable principles for this goal",
        )

    final_score = weighted_sum / total_weight

    # Verdict thresholds
    if final_score > 0.15:
        verdict = "pass"
    elif final_score < -0.15:
        verdict = "fail"
    else:
        verdict = "caution"

    return GoalVerdict(
        goal=goal,
        verdict=verdict,
        score=round(final_score, 3),
        supporting_principles=supporting,
        reasoning=f"Weighted score: {final_score:+.3f} ({verdict})",
    )


def score_goals(
    principles: List[PrincipleResult],
    body: BodyProfile,
) -> List[GoalVerdict]:
    """Score all active styling goals for this body."""
    verdicts = []
    for goal in body.styling_goals:
        verdict = _score_single_goal(goal, principles)
        verdicts.append(verdict)
    return verdicts
