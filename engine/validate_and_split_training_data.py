#!/usr/bin/env python3
"""
Validate and Split Training Data for Amazon Nova Fine-tuning
=============================================================
Validates JSONL format matches bedrock-conversation-2024 schema,
then splits into train/validation sets.
"""

import json
import os
import random
from pathlib import Path
from typing import List, Dict, Tuple

# Configuration
INPUT_FILE = "training_data.jsonl"
TRAIN_FILE = "training_data_train.jsonl"
VALIDATION_FILE = "training_data_validation.jsonl"
SPLIT_RATIO = 0.90  # 90% train, 10% validation
RANDOM_SEED = 42


def validate_record(record: Dict, index: int) -> List[str]:
    """Validate a single record against Nova fine-tuning schema.

    Required format:
    {
        "schemaVersion": "bedrock-conversation-2024",
        "system": [{"text": "..."}],
        "messages": [
            {"role": "user", "content": [{"text": "..."}]},
            {"role": "assistant", "content": [{"text": "..."}]}
        ]
    }
    """
    errors = []

    # Check schemaVersion
    if "schemaVersion" not in record:
        errors.append(f"Record {index}: Missing 'schemaVersion'")
    elif record["schemaVersion"] != "bedrock-conversation-2024":
        errors.append(f"Record {index}: schemaVersion should be 'bedrock-conversation-2024', got '{record['schemaVersion']}'")

    # Check system prompt
    if "system" not in record:
        errors.append(f"Record {index}: Missing 'system'")
    elif not isinstance(record["system"], list):
        errors.append(f"Record {index}: 'system' should be a list")
    elif len(record["system"]) == 0:
        errors.append(f"Record {index}: 'system' list is empty")
    else:
        for i, sys_item in enumerate(record["system"]):
            if not isinstance(sys_item, dict):
                errors.append(f"Record {index}: system[{i}] should be an object")
            elif "text" not in sys_item:
                errors.append(f"Record {index}: system[{i}] missing 'text'")
            elif not isinstance(sys_item["text"], str):
                errors.append(f"Record {index}: system[{i}].text should be a string")

    # Check messages
    if "messages" not in record:
        errors.append(f"Record {index}: Missing 'messages'")
    elif not isinstance(record["messages"], list):
        errors.append(f"Record {index}: 'messages' should be a list")
    elif len(record["messages"]) == 0:
        errors.append(f"Record {index}: 'messages' list is empty")
    else:
        # Messages should alternate user/assistant
        expected_role = "user"
        for i, msg in enumerate(record["messages"]):
            if not isinstance(msg, dict):
                errors.append(f"Record {index}: messages[{i}] should be an object")
                continue

            # Check role
            if "role" not in msg:
                errors.append(f"Record {index}: messages[{i}] missing 'role'")
            elif msg["role"] not in ["user", "assistant"]:
                errors.append(f"Record {index}: messages[{i}].role should be 'user' or 'assistant', got '{msg['role']}'")
            elif msg["role"] != expected_role:
                errors.append(f"Record {index}: messages[{i}] expected role '{expected_role}', got '{msg['role']}' (should alternate)")

            # Toggle expected role
            expected_role = "assistant" if expected_role == "user" else "user"

            # Check content
            if "content" not in msg:
                errors.append(f"Record {index}: messages[{i}] missing 'content'")
            elif not isinstance(msg["content"], list):
                errors.append(f"Record {index}: messages[{i}].content should be a list")
            elif len(msg["content"]) == 0:
                errors.append(f"Record {index}: messages[{i}].content is empty")
            else:
                for j, content_item in enumerate(msg["content"]):
                    if not isinstance(content_item, dict):
                        errors.append(f"Record {index}: messages[{i}].content[{j}] should be an object")
                    elif "text" not in content_item:
                        errors.append(f"Record {index}: messages[{i}].content[{j}] missing 'text'")
                    elif not isinstance(content_item["text"], str):
                        errors.append(f"Record {index}: messages[{i}].content[{j}].text should be a string")

        # Must end with assistant message
        if len(record["messages"]) > 0 and record["messages"][-1].get("role") != "assistant":
            errors.append(f"Record {index}: Last message should be from 'assistant'")

        # Must have at least one user and one assistant message
        if len(record["messages"]) < 2:
            errors.append(f"Record {index}: Need at least 2 messages (user + assistant)")

    return errors


def validate_file(filepath: str) -> Tuple[List[Dict], List[str]]:
    """Validate entire JSONL file. Returns (valid_records, all_errors)."""
    records = []
    all_errors = []

    with open(filepath, 'r', encoding='utf-8') as f:
        for line_num, line in enumerate(f, 1):
            line = line.strip()
            if not line:
                continue

            # Parse JSON
            try:
                record = json.loads(line)
            except json.JSONDecodeError as e:
                all_errors.append(f"Line {line_num}: Invalid JSON - {e}")
                continue

            # Validate structure
            errors = validate_record(record, line_num)
            if errors:
                all_errors.extend(errors)
            else:
                records.append(record)

    return records, all_errors


def split_data(records: List[Dict], train_ratio: float, seed: int) -> Tuple[List[Dict], List[Dict]]:
    """Split records into train and validation sets."""
    random.seed(seed)
    shuffled = records.copy()
    random.shuffle(shuffled)

    split_idx = int(len(shuffled) * train_ratio)
    train = shuffled[:split_idx]
    validation = shuffled[split_idx:]

    return train, validation


def write_jsonl(records: List[Dict], filepath: str):
    """Write records to JSONL file."""
    with open(filepath, 'w', encoding='utf-8') as f:
        for record in records:
            f.write(json.dumps(record, ensure_ascii=False) + '\n')


def analyze_data(records: List[Dict]) -> Dict:
    """Analyze the dataset for statistics."""
    stats = {
        "total_records": len(records),
        "verdicts": {"this_is_it": 0, "smart_pick": 0, "not_this_one": 0, "unknown": 0},
        "body_shapes": {},
        "categories": {},
        "avg_system_prompt_length": 0,
        "avg_user_message_length": 0,
        "avg_assistant_response_length": 0,
    }

    total_system_len = 0
    total_user_len = 0
    total_assistant_len = 0

    for record in records:
        # System prompt length
        if record.get("system"):
            total_system_len += len(record["system"][0].get("text", ""))

        # Analyze messages
        for msg in record.get("messages", []):
            text = msg.get("content", [{}])[0].get("text", "")

            if msg.get("role") == "user":
                total_user_len += len(text)

                # Extract verdict
                if "VERDICT:" in text:
                    verdict_line = [l for l in text.split('\n') if "VERDICT:" in l]
                    if verdict_line:
                        verdict = verdict_line[0].split("VERDICT:")[1].strip().lower()
                        if "this_is_it" in verdict:
                            stats["verdicts"]["this_is_it"] += 1
                        elif "smart_pick" in verdict:
                            stats["verdicts"]["smart_pick"] += 1
                        elif "not_this_one" in verdict:
                            stats["verdicts"]["not_this_one"] += 1
                        else:
                            stats["verdicts"]["unknown"] += 1

                # Extract body shape
                if "Body shape:" in text:
                    shape_line = [l for l in text.split('\n') if "Body shape:" in l]
                    if shape_line:
                        shape = shape_line[0].split("Body shape:")[1].strip().lower()
                        stats["body_shapes"][shape] = stats["body_shapes"].get(shape, 0) + 1

                # Extract category
                if "Category:" in text:
                    cat_line = [l for l in text.split('\n') if "Category:" in l]
                    if cat_line:
                        cat = cat_line[0].split("Category:")[1].strip().lower()
                        stats["categories"][cat] = stats["categories"].get(cat, 0) + 1

            elif msg.get("role") == "assistant":
                total_assistant_len += len(text)

    if len(records) > 0:
        stats["avg_system_prompt_length"] = total_system_len // len(records)
        stats["avg_user_message_length"] = total_user_len // len(records)
        stats["avg_assistant_response_length"] = total_assistant_len // len(records)

    return stats


def main():
    script_dir = Path(__file__).parent
    input_path = script_dir / INPUT_FILE
    train_path = script_dir / TRAIN_FILE
    validation_path = script_dir / VALIDATION_FILE

    print("=" * 70)
    print("  Amazon Nova Fine-tuning Data Validator & Splitter")
    print("=" * 70)
    print(f"\nInput file: {input_path}")

    if not input_path.exists():
        print(f"\nERROR: File not found: {input_path}")
        return

    # Validate
    print("\n--- Validating Format ---\n")
    records, errors = validate_file(str(input_path))

    if errors:
        print(f"VALIDATION ERRORS ({len(errors)}):\n")
        for err in errors[:20]:  # Show first 20 errors
            print(f"  {err}")
        if len(errors) > 20:
            print(f"  ... and {len(errors) - 20} more errors")
        print()

    print(f"Valid records: {len(records)}")
    print(f"Invalid records: {len(errors)}")

    if len(records) == 0:
        print("\nNo valid records to process. Exiting.")
        return

    # Analyze
    print("\n--- Dataset Analysis ---\n")
    stats = analyze_data(records)

    print(f"Total records: {stats['total_records']}")
    print(f"\nVerdict distribution:")
    for verdict, count in stats["verdicts"].items():
        pct = (count / stats["total_records"]) * 100 if stats["total_records"] > 0 else 0
        print(f"  {verdict}: {count} ({pct:.1f}%)")

    print(f"\nBody shape distribution:")
    for shape, count in sorted(stats["body_shapes"].items(), key=lambda x: -x[1]):
        pct = (count / stats["total_records"]) * 100 if stats["total_records"] > 0 else 0
        print(f"  {shape}: {count} ({pct:.1f}%)")

    print(f"\nCategory distribution:")
    for cat, count in sorted(stats["categories"].items(), key=lambda x: -x[1]):
        pct = (count / stats["total_records"]) * 100 if stats["total_records"] > 0 else 0
        print(f"  {cat}: {count} ({pct:.1f}%)")

    print(f"\nAverage lengths:")
    print(f"  System prompt: {stats['avg_system_prompt_length']:,} chars")
    print(f"  User message: {stats['avg_user_message_length']:,} chars")
    print(f"  Assistant response: {stats['avg_assistant_response_length']:,} chars")

    # Split
    print(f"\n--- Splitting Data ({int(SPLIT_RATIO*100)}:{int((1-SPLIT_RATIO)*100)}) ---\n")
    train_records, val_records = split_data(records, SPLIT_RATIO, RANDOM_SEED)

    print(f"Training set: {len(train_records)} records")
    print(f"Validation set: {len(val_records)} records")

    # Write output files
    write_jsonl(train_records, str(train_path))
    write_jsonl(val_records, str(validation_path))

    print(f"\nFiles written:")
    print(f"  {train_path}")
    print(f"  {validation_path}")

    # Format verification
    print("\n--- Format Verification ---\n")
    print("Required Nova format:")
    print('  {')
    print('    "schemaVersion": "bedrock-conversation-2024",')
    print('    "system": [{"text": "..."}],')
    print('    "messages": [')
    print('      {"role": "user", "content": [{"text": "..."}]},')
    print('      {"role": "assistant", "content": [{"text": "..."}]}')
    print('    ]')
    print('  }')
    print()

    if len(records) > 0:
        sample = records[0]
        checks = [
            ("schemaVersion", sample.get("schemaVersion") == "bedrock-conversation-2024"),
            ("system array", isinstance(sample.get("system"), list) and len(sample.get("system", [])) > 0),
            ("system[0].text", isinstance(sample.get("system", [{}])[0].get("text"), str)),
            ("messages array", isinstance(sample.get("messages"), list) and len(sample.get("messages", [])) >= 2),
            ("user message", sample.get("messages", [{}])[0].get("role") == "user"),
            ("assistant message", sample.get("messages", [{}, {}])[1].get("role") == "assistant"),
            ("content structure", isinstance(sample.get("messages", [{}])[0].get("content"), list)),
        ]

        all_pass = True
        for check_name, passed in checks:
            status = "PASS" if passed else "FAIL"
            if not passed:
                all_pass = False
            print(f"  [{status}] {check_name}")

        print()
        if all_pass:
            print("FORMAT VERIFIED: Your data matches the Amazon Nova fine-tuning schema.")
        else:
            print("FORMAT ISSUES: Please review the failed checks above.")

    print("\n" + "=" * 70)
    print("  RECOMMENDATION")
    print("=" * 70)
    print("""
For your dataset size (1085 records):
- 90:10 split is recommended (more training data)
- This gives ~976 training + ~109 validation records

Alternative splits:
- 80:20: ~868 train + ~217 validation (more robust validation)
- 85:15: ~922 train + ~163 validation (balanced)

To change the split ratio, edit SPLIT_RATIO at the top of this script.
""")


if __name__ == "__main__":
    main()
