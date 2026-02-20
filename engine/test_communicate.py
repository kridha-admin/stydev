"""
End-to-end test: Score → Communicate pipeline.
Tests the full flow from raw measurements + garment attributes
through to UI-ready JSON output.
"""

import json
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from engine.kridha_engine import score_garment
from engine.bridge import build_body_profile, build_garment_profile
from engine.scoring_service import dataclass_to_dict
from engine.communicate import generate_communication


# ================================================================
# TEST SCENARIOS
# ================================================================

# Bridge expects Node.js pipeline format:
#   Body: CM measurements (height, chest_circumference, waist_circumference, hip_circumference, etc.)
#   Garment: garment_type, silhouette_type, neckline_type, fabric_sheen, fabric_primary, etc.

def _inches_to_cm(inches):
    return inches * 2.54

SCENARIOS = [
    {
        "name": "Pear + Black A-Line Dress (expect TII)",
        "user_measurements": {
            "height": _inches_to_cm(63),                    # 5'3"
            "chest_circumference": _inches_to_cm(34),
            "waist_circumference": _inches_to_cm(27),
            "hip_circumference": _inches_to_cm(40),
            "shoulder_breadth": _inches_to_cm(14.5),
        },
        "garment_attributes": {
            "garment_type": "dress",
            "silhouette_type": "a_line",
            "neckline_type": "v_neck",
            "color_lightness": 0.08,
            "fabric_name": "ponte",
            "fabric_primary": "polyester",
            "fabric_primary_pct": 65,
            "fabric_secondary": "rayon",
            "fabric_secondary_pct": 30,
            "elastane_pct": 5,
            "hem_position": "above_knee",
            "fabric_sheen": "matte",
        },
        "styling_goals": ["look_taller", "slim_hips"],
    },
    {
        "name": "Apple + Thin Cling Bodycon (expect NTO)",
        "user_measurements": {
            "height": _inches_to_cm(65),
            "chest_circumference": _inches_to_cm(40),
            "waist_circumference": _inches_to_cm(38),
            "hip_circumference": _inches_to_cm(40),
            "shoulder_breadth": _inches_to_cm(16),
        },
        "garment_attributes": {
            "garment_type": "dress",
            "silhouette_type": "bodycon",
            "neckline_type": "crew_neck",
            "color_lightness": 0.85,
            "fabric_name": "jersey",
            "fabric_primary": "viscose",
            "fabric_primary_pct": 95,
            "elastane_pct": 5,
            "hem_position": "knee",
            "fabric_weight": "lightweight",
            "fabric_sheen": "subtle_sheen",
        },
        "styling_goals": ["hide_midsection", "look_taller"],
    },
    {
        "name": "Hourglass + Wrap Dress (expect SP/TII)",
        "user_measurements": {
            "height": _inches_to_cm(66),
            "chest_circumference": _inches_to_cm(38),
            "waist_circumference": _inches_to_cm(28),
            "hip_circumference": _inches_to_cm(39),
            "shoulder_breadth": _inches_to_cm(15.5),
        },
        "garment_attributes": {
            "garment_type": "dress",
            "silhouette_type": "wrap",
            "neckline_type": "wrap_surplice",
            "color_lightness": 0.15,
            "fabric_name": "crepe",
            "fabric_primary": "polyester",
            "fabric_primary_pct": 100,
            "hem_position": "below_knee",
            "fabric_sheen": "matte",
        },
        "styling_goals": ["highlight_waist", "look_proportional"],
    },
    {
        "name": "Rectangle + High-Rise Wide-Leg Pants (expect SP/TII)",
        "user_measurements": {
            "height": _inches_to_cm(67),
            "chest_circumference": _inches_to_cm(35),
            "waist_circumference": _inches_to_cm(32),
            "hip_circumference": _inches_to_cm(36),
            "shoulder_breadth": _inches_to_cm(15),
        },
        "garment_attributes": {
            "garment_type": "bottom_pants",
            "silhouette_type": "fitted",
            "color_lightness": 0.05,
            "fabric_name": "twill",
            "fabric_primary": "cotton",
            "fabric_primary_pct": 97,
            "elastane_pct": 3,
            "rise": "high",
            "leg_shape": "wide_leg",
            "fabric_sheen": "matte",
        },
        "styling_goals": ["look_proportional"],
    },
]


def run_test(scenario: dict, index: int):
    name = scenario["name"]
    print(f"\n{'='*60}")
    print(f"TEST {index+1}: {name}")
    print(f"{'='*60}")

    # Step 1: Build profiles
    body = build_body_profile(
        scenario["user_measurements"],
        scenario.get("styling_goals"),
    )
    garment = build_garment_profile(scenario["garment_attributes"])

    print(f"  Body: {body.body_shape.value}, {body.height}\" tall, "
          f"B{body.bust}/W{body.waist}/H{body.hip}")
    print(f"  Garment: {garment.category.value}, {garment.silhouette.value}, "
          f"lightness={garment.color_lightness}")

    # Step 2: Score
    result = score_garment(garment, body)
    score_dict = dataclass_to_dict(result)

    print(f"  Score: {result.overall_score}/10 (raw composite: {result.composite_raw:+.3f})")

    # Step 3: Generate communication
    # Enrich profiles with resolved body shape and garment category for communicate
    body_dict = dict(scenario["user_measurements"])
    body_dict["body_shape"] = body.body_shape.value
    body_dict["height"] = body.height  # pass in inches for user_line
    garment_dict = dict(scenario["garment_attributes"])
    garment_dict["category"] = garment.category.value
    comm = generate_communication(
        score_result=score_dict,
        body_profile=body_dict,
        garment_profile=garment_dict,
        styling_goals=scenario.get("styling_goals"),
    )

    # Display results
    print(f"\n  VERDICT: {comm['verdict']} ({comm['verdict_color']})")
    print(f"  HEADLINE: {comm['headline']}")
    print(f"  USER LINE: {comm.get('user_line', '')}")

    print(f"  PINCH:")
    for seg in comm.get("pinch", []):
        style = seg.get("style", "normal") if isinstance(seg, dict) else seg.style
        text = seg.get("text", "") if isinstance(seg, dict) else seg.text
        marker = {"positive": "+", "negative": "-", "fix": "~", "normal": " "}.get(style, " ")
        print(f"    [{marker}] {text}")

    if comm.get("goal_chips"):
        print(f"  GOAL CHIPS:")
        for chip in comm["goal_chips"]:
            print(f"    {chip.get('icon', '·')} {chip.get('goal', '')} → {chip.get('verdict', '')}")

    if comm.get("triple_checks"):
        print(f"  TRIPLE CHECKS: {', '.join(comm['triple_checks'])}")

    if comm.get("search_pills"):
        print(f"  SEARCH PILLS: {comm['search_pills']}")

    if comm.get("search_context"):
        print(f"  SEARCH CONTEXT: {comm['search_context']}")

    if comm.get("chat_chips"):
        print(f"  CHAT CHIPS: {comm['chat_chips']}")

    if comm.get("photo_note"):
        print(f"  PHOTO NOTE: {comm['photo_note']}")

    if comm.get("confidence_note"):
        print(f"  CONFIDENCE NOTE: {comm['confidence_note']}")

    # Guardrail result
    gr = comm.get("guardrail_result", {})
    if gr.get("passed"):
        print(f"  GUARDRAILS: PASS")
    else:
        print(f"  GUARDRAILS: BLOCKED")
        for v in gr.get("violations", []):
            print(f"    BLOCK: {v['rule']} — {v['text']}")

    if gr.get("warnings"):
        for w in gr["warnings"]:
            print(f"    WARN: {w['rule']} — {w['text']}")

    return comm


def main():
    print("Kridha End-to-End Pipeline Test")
    print("Score → Communicate → Guardrails → UI JSON\n")

    results = []
    for i, scenario in enumerate(SCENARIOS):
        comm = run_test(scenario, i)
        results.append(comm)

    # Summary
    print(f"\n{'='*60}")
    print("SUMMARY")
    print(f"{'='*60}")
    verdicts = [r["verdict"] for r in results]
    print(f"  TII: {verdicts.count('this_is_it')}")
    print(f"  SP:  {verdicts.count('smart_pick')}")
    print(f"  NTO: {verdicts.count('not_this_one')}")
    all_passed = all(r.get("guardrail_result", {}).get("passed", False) for r in results)
    print(f"  All guardrails passed: {all_passed}")
    print(f"\n  Full JSON output sample (scenario 1):")
    print(json.dumps(results[0], indent=2, default=str)[:2000])


if __name__ == "__main__":
    main()
