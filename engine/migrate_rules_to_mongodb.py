"""
Kridha — Migrate Golden Registry & Config to MongoDB
=====================================================
One-time migration script that reads:
  1. All golden_registry/*.json files → `styling_rules` collection
  2. synthesis/rule_confidence.json → `rule_confidence` collection
  3. Python config dicts (FABRIC_LOOKUP, constants) → `scoring_config` collection

Usage:
    cd /home/ubuntu/stydev
    MONGO_CONNECTION_STRING=mongodb+srv://... python -m engine.migrate_rules_to_mongodb

Collections created:
    - styling_rules       : One document per rule type (principles, rules, exceptions, etc.)
    - rule_confidence     : One document per rule ID with confidence data
    - scoring_config      : Fabric lookup, constants, thresholds
"""

import json
import os
import sys
import logging
from datetime import datetime, timezone

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger(__name__)

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from pymongo import MongoClient

from engine.rules_data import (
    _REGISTRY_DIR,
    _SYNTHESIS_DIR,
    _load_registry_file,
    FABRIC_LOOKUP,
    ELASTANE_MULTIPLIERS,
    FIBER_GSM_MULTIPLIERS,
    SHEEN_MAP,
    HEEL_EFFICIENCY,
    HEM_LABELS,
    WAIST_POSITION_MULTIPLIERS,
    SLEEVE_TYPES,
    HEM_TYPE_MODIFIERS,
    SHOULDER_WIDTH_MODIFIERS,
    SCORE_SCALE,
    OPTIMAL_V_DEPTH,
    BUST_DIVIDING_THRESHOLDS,
    PRINCIPLE_CONFIDENCE,
    PROPORTION_CUT_RATIOS,
)


def migrate(mongo_uri: str, db_name: str = "kridha-proto-dev"):
    """Run the full migration."""
    client = MongoClient(mongo_uri)
    db = client[db_name]

    now = datetime.now(timezone.utc)

    # ----------------------------------------------------------------
    # 1. Golden Registry → styling_rules
    # ----------------------------------------------------------------
    logger.info("Migrating golden registry to styling_rules...")
    coll = db["styling_rules"]
    coll.drop()

    file_map = {
        "principles": "principles.json",
        "rules": "rules.json",
        "exceptions": "exceptions.json",
        "thresholds": "thresholds.json",
        "body_type_modifiers": "body_type_modifiers.json",
        "contradictions": "contradictions.json",
        "fabric_rules": "fabric_rules.json",
        "context_rules": "context_rules.json",
        "scoring_functions": "scoring_functions.json",
    }

    total_items = 0
    for rule_type, filename in file_map.items():
        filepath = os.path.join(_REGISTRY_DIR, filename)
        items = _load_registry_file(filepath)
        if items:
            coll.insert_one({
                "rule_type": rule_type,
                "items": items,
                "source_file": filename,
                "item_count": len(items),
                "migrated_at": now,
            })
            total_items += len(items)
            logger.info("  %s: %d items from %s", rule_type, len(items), filename)

    # Also migrate domain-specific files
    domain_files = [f for f in os.listdir(_REGISTRY_DIR)
                    if f.startswith("domain") and f.endswith(".json")]
    for filename in sorted(domain_files):
        filepath = os.path.join(_REGISTRY_DIR, filename)
        items = _load_registry_file(filepath)
        # Derive rule_type from filename: domain2_principles.json → domain2_principles
        rule_type = filename.replace(".json", "")
        if items:
            coll.insert_one({
                "rule_type": rule_type,
                "items": items,
                "source_file": filename,
                "item_count": len(items),
                "migrated_at": now,
            })
            total_items += len(items)
            logger.info("  %s: %d items from %s", rule_type, len(items), filename)

    logger.info("Total styling_rules items: %d", total_items)

    # ----------------------------------------------------------------
    # 2. Rule Confidence → rule_confidence
    # ----------------------------------------------------------------
    logger.info("Migrating rule confidence...")
    conf_coll = db["rule_confidence"]
    conf_coll.drop()

    conf_path = os.path.join(_SYNTHESIS_DIR, "rule_confidence.json")
    if os.path.exists(conf_path):
        with open(conf_path, "r") as f:
            confidence_data = json.load(f)

        docs = []
        for item_id, conf in confidence_data.items():
            doc = {"item_id": item_id, "migrated_at": now}
            if isinstance(conf, dict):
                doc.update(conf)
            else:
                doc["avg_confidence"] = conf
            docs.append(doc)

        if docs:
            conf_coll.insert_many(docs)
            logger.info("  %d confidence entries migrated", len(docs))
    else:
        logger.warning("  No rule_confidence.json found at %s", conf_path)

    # Also migrate Python-defined PRINCIPLE_CONFIDENCE
    principle_docs = []
    for principle_id, conf_score in PRINCIPLE_CONFIDENCE.items():
        principle_docs.append({
            "item_id": principle_id,
            "avg_confidence": conf_score,
            "source": "python_constant",
            "migrated_at": now,
        })
    if principle_docs:
        conf_coll.insert_many(principle_docs)
        logger.info("  %d PRINCIPLE_CONFIDENCE entries migrated", len(principle_docs))

    # ----------------------------------------------------------------
    # 3. Python Config → scoring_config
    # ----------------------------------------------------------------
    logger.info("Migrating Python config to scoring_config...")
    config_coll = db["scoring_config"]
    config_coll.drop()

    configs = [
        {
            "config_key": "fabric_lookup",
            "data": FABRIC_LOOKUP,
            "description": "50+ fabric database with GSM, fiber, construction, drape",
        },
        {
            "config_key": "elastane_multipliers",
            "data": ELASTANE_MULTIPLIERS,
            "description": "Stretch multipliers by construction type",
        },
        {
            "config_key": "fiber_gsm_multipliers",
            "data": FIBER_GSM_MULTIPLIERS,
            "description": "Fiber-adjusted GSM multipliers",
        },
        {
            "config_key": "sheen_map",
            "data": SHEEN_MAP,
            "description": "Surface finish to sheen score mapping",
        },
        {
            "config_key": "heel_efficiency",
            "data": {f"{k[0]}-{k[1]}": v for k, v in HEEL_EFFICIENCY.items()},
            "description": "Heel height efficiency factors",
        },
        {
            "config_key": "hem_labels",
            "data": HEM_LABELS,
            "description": "Hemline label ordering",
        },
        {
            "config_key": "waist_position_multipliers",
            "data": WAIST_POSITION_MULTIPLIERS,
            "description": "Waist position to torso fraction mapping",
        },
        {
            "config_key": "sleeve_types",
            "data": SLEEVE_TYPES,
            "description": "Sleeve type parameters",
        },
        {
            "config_key": "hem_type_modifiers",
            "data": HEM_TYPE_MODIFIERS,
            "description": "Hem type perceived width modifiers",
        },
        {
            "config_key": "shoulder_width_modifiers",
            "data": SHOULDER_WIDTH_MODIFIERS,
            "description": "Shoulder width effect by sleeve type",
        },
        {
            "config_key": "score_scale",
            "data": {str(k): v for k, v in SCORE_SCALE.items()},
            "description": "Score scale definition labels",
        },
        {
            "config_key": "optimal_v_depth",
            "data": OPTIMAL_V_DEPTH,
            "description": "V-neck optimal depth by body type",
        },
        {
            "config_key": "bust_dividing_thresholds",
            "data": {str(k): v for k, v in BUST_DIVIDING_THRESHOLDS.items()},
            "description": "Bust dividing thresholds by differential",
        },
        {
            "config_key": "proportion_cut_ratios",
            "data": {k: list(v) for k, v in PROPORTION_CUT_RATIOS.items()},
            "description": "Proportion cut ratio ideal ranges",
        },
    ]

    for config in configs:
        config["migrated_at"] = now
        config_coll.insert_one(config)

    logger.info("  %d config entries migrated", len(configs))

    # ----------------------------------------------------------------
    # Summary
    # ----------------------------------------------------------------
    logger.info("=" * 50)
    logger.info("Migration complete!")
    logger.info("  styling_rules: %d documents", db["styling_rules"].count_documents({}))
    logger.info("  rule_confidence: %d documents", db["rule_confidence"].count_documents({}))
    logger.info("  scoring_config: %d documents", db["scoring_config"].count_documents({}))
    logger.info("=" * 50)

    client.close()


if __name__ == "__main__":
    mongo_uri = os.environ.get("MONGO_CONNECTION_STRING")
    if not mongo_uri:
        print("ERROR: Set MONGO_CONNECTION_STRING environment variable")
        print("Usage: MONGO_CONNECTION_STRING=mongodb+srv://... python -m engine.migrate_rules_to_mongodb")
        sys.exit(1)

    db_name = os.environ.get("MONGO_DB_NAME", "kridha-proto-dev")
    migrate(mongo_uri, db_name)
