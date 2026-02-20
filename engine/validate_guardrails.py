"""
Guardrails Validation — Run all scored scenarios through phrase bank + guardrails.

Validates that every generated headline + pinch passes body-safe language checks
before spending API credits on fine-tuning.

Usage:
    python -m engine.validate_guardrails
"""

import json
import sys
import os
from collections import Counter

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from engine.gold_generator import generate_gold_output
from engine.guardrails import check_output
from engine.communication_schema import (
    select_verdict, build_search_pills, build_search_context,
)


def validate_all():
    scored_path = os.path.join(os.path.dirname(__file__), "scored_scenarios.json")
    if not os.path.exists(scored_path):
        print(f"ERROR: {scored_path} not found")
        return

    with open(scored_path) as f:
        scenarios = json.load(f)

    print(f"Validating {len(scenarios)} scored scenarios through phrase bank + guardrails...\n")

    stats = Counter()
    blocks_by_rule = Counter()
    warns_by_rule = Counter()
    block_examples = {}  # rule → first example

    for i, item in enumerate(scenarios):
        sid = item["scenario_id"]
        verdict = item["verdict"]

        # Generate headline + pinch via phrase bank
        try:
            gold = generate_gold_output(item)
        except Exception as e:
            stats["generation_error"] += 1
            print(f"  [{i+1}] GEN ERROR {sid}: {e}")
            continue

        headline = gold.get("headline", "")
        pinch = gold.get("pinch", [])

        # Build search pills/context for NTO/SP
        garment_cat = item.get("garment_category", "dress")
        top_neg = item.get("top_negative_key", "_default") or "_default"
        search_pills = build_search_pills(verdict, top_neg, garment_cat)
        search_context = build_search_context(verdict, top_neg, garment_cat)

        # Assemble output for guardrail check
        output = {
            "verdict": verdict,
            "headline": headline,
            "pinch": pinch,
            "search_pills": search_pills,
            "search_context": search_context,
        }

        # Run guardrails
        gr = check_output(output)

        if gr.passed and not gr.warnings:
            stats["clean_pass"] += 1
        elif gr.passed:
            stats["pass_with_warnings"] += 1
            for w in gr.warnings:
                warns_by_rule[w.rule] += 1
        else:
            stats["blocked"] += 1
            for v in gr.violations:
                blocks_by_rule[v.rule] += 1
                if v.rule not in block_examples:
                    block_examples[v.rule] = {
                        "scenario_id": sid,
                        "verdict": verdict,
                        "headline": headline,
                        "violation_text": v.text,
                        "suggestion": v.suggestion,
                    }

        stats["total"] += 1

    # Report
    print("=" * 60)
    print("GUARDRAILS VALIDATION REPORT")
    print("=" * 60)
    print(f"Total scenarios:     {stats['total']}")
    print(f"Clean pass:          {stats['clean_pass']}")
    print(f"Pass with warnings:  {stats['pass_with_warnings']}")
    print(f"BLOCKED:             {stats['blocked']}")
    print(f"Generation errors:   {stats['generation_error']}")
    print()

    if blocks_by_rule:
        print("BLOCKS by rule:")
        for rule, count in blocks_by_rule.most_common():
            print(f"  {rule}: {count}")
            ex = block_examples.get(rule)
            if ex:
                print(f"    Example: scenario={ex['scenario_id']} verdict={ex['verdict']}")
                print(f"    Headline: {ex['headline']}")
                print(f"    Violation: \"{ex['violation_text']}\"")
                print(f"    Fix: {ex['suggestion']}")
        print()

    if warns_by_rule:
        print("WARNINGS by rule:")
        for rule, count in warns_by_rule.most_common():
            print(f"  {rule}: {count}")
        print()

    pass_rate = (stats["clean_pass"] + stats["pass_with_warnings"]) / max(stats["total"], 1) * 100
    print(f"Pass rate: {pass_rate:.1f}%")

    if stats["blocked"] > 0:
        print(f"\n⚠ {stats['blocked']} scenarios BLOCKED — fix phrase bank before fine-tuning")
    else:
        print("\nAll scenarios pass guardrails — safe to fine-tune.")


if __name__ == "__main__":
    validate_all()
