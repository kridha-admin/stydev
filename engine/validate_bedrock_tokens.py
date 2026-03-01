#!/usr/bin/env python3
"""
Validate Bedrock Nova Fine-tuning Data for Reserved Tokens
===========================================================
Checks JSONL files for:
1. Valid JSON parsing
2. Required schema structure (bedrock-conversation-2024)
3. Reserved/invalid tokens that Bedrock rejects

Usage:
    python validate_bedrock_tokens.py <path_to_jsonl_file>
"""

import json
import re
import sys
from pathlib import Path
from typing import List, Dict, Tuple

# Known reserved tokens that Bedrock fine-tuning rejects
# These are used internally for conversation turn delimiting
RESERVED_TOKENS = [
    "USER:",
    "ASSISTANT:",
    "SYSTEM:",
    "Human:",
    "Assistant:",
    "<|endoftext|>",
    "<|im_start|>",
    "<|im_end|>",
    "<|user|>",
    "<|assistant|>",
    "<|system|>",
]

# Regex pattern for tokens that look like role markers (WORD: at start of line)
ROLE_MARKER_PATTERN = re.compile(r'(?:^|\n)([A-Z][A-Z_]+):\s', re.MULTILINE)


def check_reserved_tokens(text: str, record_idx: int, field_path: str) -> List[str]:
    """Check text for reserved tokens."""
    issues = []

    for token in RESERVED_TOKENS:
        if token in text:
            issues.append(f"Record {record_idx} - {field_path}: Found reserved token `{token}`")

    # Also check for potential role markers we might have missed
    matches = ROLE_MARKER_PATTERN.findall(text)
    for match in matches:
        if match not in ["VERDICT", "SCORE", "GARMENT", "PROFILE", "SCORING", "GOAL", "EXCEPTIONS"]:
            # Potential problematic token
            if f"{match}:" not in [t for t in RESERVED_TOKENS]:
                issues.append(f"Record {record_idx} - {field_path}: Potential role marker `{match}:` (verify if allowed)")

    return issues


def validate_schema_structure(record: Dict, record_idx: int) -> List[str]:
    """Validate the bedrock-conversation-2024 schema structure."""
    errors = []

    # Check schemaVersion
    if "schemaVersion" not in record:
        errors.append(f"Record {record_idx}: Missing 'schemaVersion'")
    elif record["schemaVersion"] != "bedrock-conversation-2024":
        errors.append(f"Record {record_idx}: schemaVersion should be 'bedrock-conversation-2024'")

    # Check system
    if "system" not in record:
        errors.append(f"Record {record_idx}: Missing 'system'")
    elif not isinstance(record["system"], list):
        errors.append(f"Record {record_idx}: 'system' should be a list")
    elif len(record["system"]) == 0:
        errors.append(f"Record {record_idx}: 'system' list is empty")
    elif "text" not in record["system"][0]:
        errors.append(f"Record {record_idx}: system[0] missing 'text'")

    # Check messages
    if "messages" not in record:
        errors.append(f"Record {record_idx}: Missing 'messages'")
    elif not isinstance(record["messages"], list):
        errors.append(f"Record {record_idx}: 'messages' should be a list")
    elif len(record["messages"]) < 2:
        errors.append(f"Record {record_idx}: Need at least 2 messages (user + assistant)")
    else:
        # Check message structure
        for i, msg in enumerate(record["messages"]):
            if "role" not in msg:
                errors.append(f"Record {record_idx}: messages[{i}] missing 'role'")
            elif msg["role"] not in ["user", "assistant"]:
                errors.append(f"Record {record_idx}: messages[{i}].role must be 'user' or 'assistant'")

            if "content" not in msg:
                errors.append(f"Record {record_idx}: messages[{i}] missing 'content'")
            elif not isinstance(msg["content"], list):
                errors.append(f"Record {record_idx}: messages[{i}].content should be a list")
            elif len(msg["content"]) == 0:
                errors.append(f"Record {record_idx}: messages[{i}].content is empty")
            elif "text" not in msg["content"][0]:
                errors.append(f"Record {record_idx}: messages[{i}].content[0] missing 'text'")

        # Check alternation
        expected_role = "user"
        for i, msg in enumerate(record["messages"]):
            if msg.get("role") != expected_role:
                errors.append(f"Record {record_idx}: messages[{i}] expected '{expected_role}', got '{msg.get('role')}'")
            expected_role = "assistant" if expected_role == "user" else "user"

        # Must end with assistant
        if record["messages"][-1].get("role") != "assistant":
            errors.append(f"Record {record_idx}: Last message must be from 'assistant'")

    return errors


def validate_record(record: Dict, record_idx: int) -> Tuple[List[str], List[str]]:
    """Validate a single record. Returns (errors, warnings)."""
    errors = []
    warnings = []

    # Validate schema structure
    schema_errors = validate_schema_structure(record, record_idx)
    errors.extend(schema_errors)

    # If structure is valid, check for reserved tokens
    if not schema_errors:
        # Check system prompt
        if record.get("system") and len(record["system"]) > 0:
            system_text = record["system"][0].get("text", "")
            token_issues = check_reserved_tokens(system_text, record_idx, "system[0].text")
            errors.extend([i for i in token_issues if "reserved token" in i])
            warnings.extend([i for i in token_issues if "Potential" in i])

        # Check messages
        for i, msg in enumerate(record.get("messages", [])):
            if msg.get("content") and len(msg["content"]) > 0:
                msg_text = msg["content"][0].get("text", "")
                field_path = f"messages[{i}].content[0].text"
                token_issues = check_reserved_tokens(msg_text, record_idx, field_path)
                errors.extend([i for i in token_issues if "reserved token" in i])
                warnings.extend([i for i in token_issues if "Potential" in i])

    return errors, warnings


def validate_file(filepath: str) -> Tuple[int, List[str], List[str]]:
    """Validate entire JSONL file. Returns (total_records, errors, warnings)."""
    all_errors = []
    all_warnings = []
    total_records = 0

    with open(filepath, 'r', encoding='utf-8') as f:
        for line_num, line in enumerate(f, 1):
            line = line.strip()
            if not line:
                continue

            total_records += 1

            # Parse JSON
            try:
                record = json.loads(line)
            except json.JSONDecodeError as e:
                all_errors.append(f"Line {line_num}: Invalid JSON - {e}")
                continue

            # Validate record
            errors, warnings = validate_record(record, line_num)
            all_errors.extend(errors)
            all_warnings.extend(warnings)

    return total_records, all_errors, all_warnings


def main():
    if len(sys.argv) < 2:
        print("Usage: python validate_bedrock_tokens.py <path_to_jsonl_file>")
        print("\nThis script validates JSONL files for Amazon Bedrock Nova fine-tuning.")
        print("It checks for:")
        print("  - Valid JSON parsing")
        print("  - Required schema structure (bedrock-conversation-2024)")
        print("  - Reserved tokens that Bedrock rejects (USER:, ASSISTANT:, etc.)")
        sys.exit(1)

    filepath = sys.argv[1]

    if not Path(filepath).exists():
        print(f"ERROR: File not found: {filepath}")
        sys.exit(1)

    print("=" * 70)
    print("  Bedrock Nova Fine-tuning Token Validator")
    print("=" * 70)
    print(f"\nFile: {filepath}")
    print(f"\nChecking for reserved tokens: {', '.join(RESERVED_TOKENS[:5])}...")

    # Validate
    total, errors, warnings = validate_file(filepath)

    print(f"\n--- Results ---\n")
    print(f"Total records: {total}")
    print(f"Errors: {len(errors)}")
    print(f"Warnings: {len(warnings)}")

    if errors:
        print(f"\n--- ERRORS ({len(errors)}) ---\n")
        # Group errors by type
        reserved_token_errors = [e for e in errors if "reserved token" in e]
        schema_errors = [e for e in errors if "reserved token" not in e]

        if reserved_token_errors:
            print("Reserved Token Errors:")
            for err in reserved_token_errors[:20]:
                print(f"  {err}")
            if len(reserved_token_errors) > 20:
                print(f"  ... and {len(reserved_token_errors) - 20} more")

        if schema_errors:
            print("\nSchema Errors:")
            for err in schema_errors[:20]:
                print(f"  {err}")
            if len(schema_errors) > 20:
                print(f"  ... and {len(schema_errors) - 20} more")

    if warnings:
        print(f"\n--- WARNINGS ({len(warnings)}) ---\n")
        for warn in warnings[:10]:
            print(f"  {warn}")
        if len(warnings) > 10:
            print(f"  ... and {len(warnings) - 10} more")

    # Summary
    print("\n" + "=" * 70)
    if errors:
        print("  VALIDATION FAILED")
        print("=" * 70)
        print("\nFix the errors above before uploading to Bedrock.")
        print("\nCommon fixes:")
        print("  - Replace 'USER:' with 'PROFILE:' or 'SHOPPER:'")
        print("  - Replace 'ASSISTANT:' with 'RESPONSE:' or 'OUTPUT:'")
        print("  - Remove any special tokens like <|endoftext|>")
        sys.exit(1)
    else:
        print("  VALIDATION PASSED")
        print("=" * 70)
        print("\nYour data is ready for Bedrock Nova fine-tuning.")
        if warnings:
            print(f"\nNote: {len(warnings)} warnings found - review if needed.")
        sys.exit(0)


if __name__ == "__main__":
    main()
