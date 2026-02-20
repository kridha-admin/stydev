"""
Kridha Production Scoring Engine — Rules & Data Layer
=====================================================
Loads the Golden Registry, rule confidence scores, and fabric lookup tables.
Provides O(1) access to any rule/exception/threshold by ID.

Supports two backends:
  1. JSON files (default, from golden_registry/ directory)
  2. MongoDB (from `styling_rules` collection, loaded via `load_from_mongodb`)
"""

import json
import logging
import os
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)

# Paths
_BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
_REGISTRY_DIR = os.path.join(_BASE_DIR, "golden_registry")
_SYNTHESIS_DIR = os.path.join(_BASE_DIR, "synthesis")


# ================================================================
# CONSTANTS — Empirical values from domains 2, 3, 4
# ================================================================

GOLDEN_RATIO = 0.618

# Fabric: elastane stretch multipliers by construction (domain 3 FR_001)
ELASTANE_MULTIPLIERS = {
    "woven": 1.6,
    "knit": 4.0,
    "knit_rib": 5.5,
    "knit_double": 3.5,
    "knit_jersey": 4.0,
}

# Fabric: fiber-adjusted GSM multipliers (domain 3 FR_002)
FIBER_GSM_MULTIPLIERS = {
    "cotton": 1.15,
    "polyester": 1.00,
    "silk": 0.85,
    "wool": 1.10,
    "rayon": 0.90,
    "linen": 1.25,
    "nylon": 0.95,
    "tencel": 0.92,
    "modal": 0.90,
    "viscose": 0.90,
}

# Fabric: sheen map from surface finish (domain 3 FR_003)
SHEEN_MAP = {
    "deep_matte": 0.00,
    "matte": 0.10,
    "subtle_sheen": 0.25,
    "moderate_sheen": 0.50,
    "high_shine": 0.75,
    "maximum_shine": 1.00,
    "crushed": 0.35,
}

# Heel efficiency by height (domain 2)
HEEL_EFFICIENCY = {
    # (min_inches, max_inches): efficiency
    (0, 3): 0.70,
    (3, 5): 0.60,
    (5, 99): 0.50,
}

# Hemline label to height-from-floor conversion (domain 2 line ~10091)
# These are offsets from body landmarks, resolved at runtime.
HEM_LABELS = [
    "mini", "above_knee", "knee", "below_knee",
    "midi", "below_calf", "ankle", "floor",
]

# Waist position multipliers (domain 2 line ~10418)
WAIST_POSITION_MULTIPLIERS = {
    "empire": 0.35,     # 0.35 × torso_length from shoulder
    "high": 0.65,
    "natural": 1.0,
    "drop": 1.15,
    "no_waist": None,
}

# Sleeve types with typical parameters (domain 2 line ~3983)
SLEEVE_TYPES = {
    "cap_sleeve": {"range": (1.5, 3.0), "ease": -0.5, "hem": "clean_hem"},
    "short_sleeve_above_elbow": {"range": (4.0, 8.0), "ease": 1.0, "hem": "clean_hem"},
    "three_quarter": {"range": (15.0, 18.0), "ease": 0.5, "hem": "clean_hem"},
    "full_length_fitted": {"range": (22.0, 25.0), "ease": 0.0, "hem": "clean_hem"},
    "full_length_loose": {"range": (22.0, 25.0), "ease": 3.0, "hem": "clean_hem"},
    "flutter_sleeve": {"range": (2.0, 4.0), "ease": 3.0, "hem": "flutter"},
    "bell_sleeve": {"range": (12.0, 25.0), "ease": 8.0, "hem": "clean_hem"},
    "puff_sleeve": {"range": (2.0, 8.0), "ease": 6.0, "hem": "elastic"},
    "dolman_batwing": {"range": (22.0, 25.0), "ease": 12.0, "hem": "clean_hem"},
}

# Hem type modifiers on perceived width (domain 2 line ~3310)
HEM_TYPE_MODIFIERS = {
    "clean_hem": 0.0,
    "elastic": 0.15,
    "soft_edge": -0.10,
    "flutter": -0.20,
    "rolled": 0.10,
}

# Shoulder width effect by sleeve type in inches per side (domain 2 line ~3367)
SHOULDER_WIDTH_MODIFIERS = {
    "set_in": 0.0,
    "raglan": -0.5,
    "dropped": -0.75,
    "puff": 1.5,
    "structured": 0.5,
    "cap": 0.25,
    "dolman": -0.5,
    "off_shoulder": 0.0,
}

# Score scale definition (domain 2 line ~4426)
SCORE_SCALE = {
    -1.0: "MAXIMUM NEGATIVE",
    -0.7: "STRONG NEGATIVE",
    -0.4: "MODERATE NEGATIVE",
    -0.2: "MILD NEGATIVE",
    0.0: "NEUTRAL",
    0.2: "MILD POSITIVE",
    0.4: "MODERATE POSITIVE",
    0.7: "STRONG POSITIVE",
    1.0: "MAXIMUM POSITIVE",
}

# V-neck optimal depth thresholds by body type (domain 2 line ~5793)
OPTIMAL_V_DEPTH = {
    "petite": {"min": 2.5, "optimal": 3.5, "max": 4.5},
    "tall": {"min": 3.0, "optimal": 4.5, "max": 6.0},
    "pear": {"min": 3.0, "optimal": 4.0, "max": 5.5},
    "apple": {"min": 3.0, "optimal": 4.0, "max": 5.0},
    "hourglass": {"min": 2.5, "optimal": 3.5, "max": 4.5},
    "hourglass_DD_plus": {"min": 2.0, "optimal": 3.0, "max": 3.5},
    "rectangle": {"min": 3.0, "optimal": 4.5, "max": 6.0},
    "inverted_triangle": {"min": 3.0, "optimal": 4.0, "max": 5.0},
    "plus_size_large_bust": {"min": 2.0, "optimal": 3.0, "max": 3.5},
}

# Bust dividing thresholds by bust_differential (domain 2 line ~9006)
BUST_DIVIDING_THRESHOLDS = {
    # bust_differential (bust - underbust) : depth_threshold_inches
    4: 7.0,   # A-B cup
    5: 6.0,   # C cup
    6: 5.0,   # D cup
    7: 4.5,   # DD cup
    8: 4.0,   # E cup
    9: 3.5,   # F+ cup
}

# Confidence levels by principle (domain 2 line ~11171)
PRINCIPLE_CONFIDENCE = {
    "v_neck_dividing_threshold": 0.85,
    "boat_neck_inverted_triangle": 0.92,
    "puff_inverted_triangle": 0.92,
    "three_quarter_arm_slimming": 0.85,
    "cap_sleeve_danger_zone": 0.80,
    "hemline_zone_collision_petite": 0.82,
    "hemline_sleeve_anatomical": 0.90,
    "dark_color_slimming": 0.70,
    "wrap_waist_apple": 0.72,
    "turtleneck_column": 0.68,
    "waist_placement_golden_ratio": 0.75,
    "empire_tent_thresholds": 0.65,
    "skin_tone_contrast": 0.60,
    "stripe_effect_ashida": 0.55,
    "pattern_scale_effect": 0.40,
    "fit_flare_pear_origin": 0.50,
    "cowl_bust_volume": 0.50,
    "contour_smoothness": 0.45,
}

# Proportion cut ratio ideal ranges (domain 2 line ~2740)
PROPORTION_CUT_RATIOS = {
    "mini": (0.40, 0.50),
    "above_knee": (0.28, 0.35),
    "below_knee": (0.22, 0.27),
    "midi": (0.14, 0.18),
    "ankle": (0.06, 0.10),
}


# ================================================================
# FABRIC LOOKUP TABLE
# ================================================================

FABRIC_LOOKUP = {
    # 10 primary fabrics from domain 3 inline reference
    "cotton_poplin": {
        "base_gsm": 120, "fiber": "cotton", "construction": "woven",
        "surface": "matte", "drape": 4, "typical_stretch": 0,
    },
    "cotton_jersey": {
        "base_gsm": 180, "fiber": "cotton", "construction": "knit_jersey",
        "surface": "matte", "drape": 6, "typical_stretch": 15,
    },
    "silk_charmeuse": {
        "base_gsm": 90, "fiber": "silk", "construction": "woven",
        "surface": "moderate_sheen", "drape": 9, "typical_stretch": 0,
    },
    "silk_chiffon": {
        "base_gsm": 40, "fiber": "silk", "construction": "woven",
        "surface": "subtle_sheen", "drape": 10, "typical_stretch": 0,
    },
    "wool_flannel": {
        "base_gsm": 280, "fiber": "wool", "construction": "woven",
        "surface": "deep_matte", "drape": 3, "typical_stretch": 0,
    },
    "wool_crepe": {
        "base_gsm": 200, "fiber": "wool", "construction": "woven",
        "surface": "matte", "drape": 6, "typical_stretch": 2,
    },
    "ponte": {
        "base_gsm": 300, "fiber": "polyester", "construction": "knit_double",
        "surface": "subtle_sheen", "drape": 4, "typical_stretch": 20,
    },
    "denim": {
        "base_gsm": 350, "fiber": "cotton", "construction": "woven",
        "surface": "matte", "drape": 2, "typical_stretch": 0,
    },
    "stretch_denim": {
        "base_gsm": 320, "fiber": "cotton", "construction": "woven",
        "surface": "matte", "drape": 3, "typical_stretch": 8,
    },
    "satin": {
        "base_gsm": 130, "fiber": "polyester", "construction": "woven",
        "surface": "moderate_sheen", "drape": 8, "typical_stretch": 0,
    },
    # Extended fabrics
    "linen": {
        "base_gsm": 180, "fiber": "linen", "construction": "woven",
        "surface": "matte", "drape": 3, "typical_stretch": 0,
    },
    "rayon_challis": {
        "base_gsm": 110, "fiber": "rayon", "construction": "woven",
        "surface": "subtle_sheen", "drape": 8, "typical_stretch": 0,
    },
    "polyester_crepe": {
        "base_gsm": 150, "fiber": "polyester", "construction": "woven",
        "surface": "subtle_sheen", "drape": 7, "typical_stretch": 0,
    },
    "modal_jersey": {
        "base_gsm": 170, "fiber": "modal", "construction": "knit_jersey",
        "surface": "subtle_sheen", "drape": 7, "typical_stretch": 20,
    },
    "tencel_twill": {
        "base_gsm": 200, "fiber": "tencel", "construction": "woven",
        "surface": "subtle_sheen", "drape": 6, "typical_stretch": 0,
    },
    "velvet": {
        "base_gsm": 280, "fiber": "polyester", "construction": "woven",
        "surface": "deep_matte", "drape": 5, "typical_stretch": 0,
    },
    "crushed_velvet": {
        "base_gsm": 250, "fiber": "polyester", "construction": "woven",
        "surface": "crushed", "drape": 6, "typical_stretch": 5,
    },
    "neoprene": {
        "base_gsm": 350, "fiber": "polyester", "construction": "knit_double",
        "surface": "matte", "drape": 2, "typical_stretch": 15,
    },
    "organza": {
        "base_gsm": 50, "fiber": "polyester", "construction": "woven",
        "surface": "subtle_sheen", "drape": 2, "typical_stretch": 0,
    },
    "tulle": {
        "base_gsm": 30, "fiber": "nylon", "construction": "knit",
        "surface": "subtle_sheen", "drape": 3, "typical_stretch": 5,
    },
    "rib_knit": {
        "base_gsm": 220, "fiber": "cotton", "construction": "knit_rib",
        "surface": "matte", "drape": 5, "typical_stretch": 30,
    },
    "french_terry": {
        "base_gsm": 280, "fiber": "cotton", "construction": "knit",
        "surface": "matte", "drape": 4, "typical_stretch": 10,
    },
    "scuba": {
        "base_gsm": 320, "fiber": "polyester", "construction": "knit_double",
        "surface": "matte", "drape": 3, "typical_stretch": 12,
    },
    "leather": {
        "base_gsm": 500, "fiber": "leather", "construction": "woven",
        "surface": "moderate_sheen", "drape": 2, "typical_stretch": 0,
    },
    "faux_leather": {
        "base_gsm": 350, "fiber": "polyester", "construction": "woven",
        "surface": "high_shine", "drape": 3, "typical_stretch": 5,
    },
    "viscose_twill": {
        "base_gsm": 160, "fiber": "viscose", "construction": "woven",
        "surface": "subtle_sheen", "drape": 7, "typical_stretch": 0,
    },
    "cotton_sateen": {
        "base_gsm": 150, "fiber": "cotton", "construction": "woven",
        "surface": "subtle_sheen", "drape": 5, "typical_stretch": 0,
    },
    "silk_crepe_de_chine": {
        "base_gsm": 80, "fiber": "silk", "construction": "woven",
        "surface": "subtle_sheen", "drape": 8, "typical_stretch": 0,
    },
    "wool_gabardine": {
        "base_gsm": 260, "fiber": "wool", "construction": "woven",
        "surface": "matte", "drape": 3, "typical_stretch": 0,
    },
    "chambray": {
        "base_gsm": 140, "fiber": "cotton", "construction": "woven",
        "surface": "matte", "drape": 5, "typical_stretch": 0,
    },
    "tweed": {
        "base_gsm": 320, "fiber": "wool", "construction": "woven",
        "surface": "deep_matte", "drape": 2, "typical_stretch": 0,
    },
    "sequin_mesh": {
        "base_gsm": 200, "fiber": "polyester", "construction": "knit",
        "surface": "maximum_shine", "drape": 5, "typical_stretch": 10,
    },
    "spandex_blend": {
        "base_gsm": 200, "fiber": "nylon", "construction": "knit",
        "surface": "subtle_sheen", "drape": 6, "typical_stretch": 40,
    },
    "poplin_stretch": {
        "base_gsm": 130, "fiber": "cotton", "construction": "woven",
        "surface": "matte", "drape": 4, "typical_stretch": 5,
    },
    "chiffon_poly": {
        "base_gsm": 50, "fiber": "polyester", "construction": "woven",
        "surface": "subtle_sheen", "drape": 9, "typical_stretch": 0,
    },
    "double_crepe": {
        "base_gsm": 220, "fiber": "polyester", "construction": "woven",
        "surface": "matte", "drape": 5, "typical_stretch": 2,
    },
    "power_mesh": {
        "base_gsm": 100, "fiber": "nylon", "construction": "knit",
        "surface": "subtle_sheen", "drape": 7, "typical_stretch": 50,
    },
    "bengaline": {
        "base_gsm": 250, "fiber": "polyester", "construction": "woven",
        "surface": "subtle_sheen", "drape": 3, "typical_stretch": 8,
    },
    "jacquard": {
        "base_gsm": 250, "fiber": "polyester", "construction": "woven",
        "surface": "moderate_sheen", "drape": 4, "typical_stretch": 0,
    },
    "brocade": {
        "base_gsm": 300, "fiber": "polyester", "construction": "woven",
        "surface": "moderate_sheen", "drape": 3, "typical_stretch": 0,
    },
    "interlock_knit": {
        "base_gsm": 200, "fiber": "cotton", "construction": "knit_double",
        "surface": "matte", "drape": 5, "typical_stretch": 18,
    },
    "bamboo_jersey": {
        "base_gsm": 160, "fiber": "viscose", "construction": "knit_jersey",
        "surface": "subtle_sheen", "drape": 7, "typical_stretch": 15,
    },
    "wool_jersey": {
        "base_gsm": 220, "fiber": "wool", "construction": "knit_jersey",
        "surface": "matte", "drape": 5, "typical_stretch": 12,
    },
    "terry_cloth": {
        "base_gsm": 400, "fiber": "cotton", "construction": "woven",
        "surface": "deep_matte", "drape": 3, "typical_stretch": 0,
    },
    "crepe_back_satin": {
        "base_gsm": 150, "fiber": "polyester", "construction": "woven",
        "surface": "moderate_sheen", "drape": 7, "typical_stretch": 0,
    },
    "lyocell_twill": {
        "base_gsm": 190, "fiber": "tencel", "construction": "woven",
        "surface": "subtle_sheen", "drape": 6, "typical_stretch": 0,
    },
    "cupro": {
        "base_gsm": 100, "fiber": "viscose", "construction": "woven",
        "surface": "subtle_sheen", "drape": 9, "typical_stretch": 0,
    },
    "taffeta": {
        "base_gsm": 100, "fiber": "polyester", "construction": "woven",
        "surface": "moderate_sheen", "drape": 2, "typical_stretch": 0,
    },
    "mesh": {
        "base_gsm": 80, "fiber": "polyester", "construction": "knit",
        "surface": "subtle_sheen", "drape": 6, "typical_stretch": 20,
    },
    "corduroy": {
        "base_gsm": 300, "fiber": "cotton", "construction": "woven",
        "surface": "deep_matte", "drape": 3, "typical_stretch": 0,
    },
    "stretch_crepe": {
        "base_gsm": 200, "fiber": "polyester", "construction": "woven",
        "surface": "matte", "drape": 6, "typical_stretch": 5,
    },
    "scuba_knit": {
        "base_gsm": 300, "fiber": "polyester", "construction": "knit_double",
        "surface": "subtle_sheen", "drape": 3, "typical_stretch": 15,
    },
    "performance_knit": {
        "base_gsm": 160, "fiber": "polyester", "construction": "knit",
        "surface": "subtle_sheen", "drape": 5, "typical_stretch": 25,
    },
    "double_georgette": {
        "base_gsm": 100, "fiber": "polyester", "construction": "woven",
        "surface": "subtle_sheen", "drape": 8, "typical_stretch": 0,
    },
    "stretch_poplin": {
        "base_gsm": 130, "fiber": "cotton", "construction": "woven",
        "surface": "matte", "drape": 4, "typical_stretch": 5,
    },
}


# ================================================================
# GOLDEN REGISTRY LOADER
# ================================================================

# Keys that indicate a wrapper block with nested items
_NESTED_KEY_MAP = {
    "principles": "principle_id",
    "rules": "rule_id",
    "exceptions": "exception_id",
    "thresholds": "threshold_id",
    "body_type_modifiers": "modifier_id",
    "contradictions": "contradiction_id",
    "fabric_rules": "fabric_rule_id",
    "context_rules": "context_rule_id",
    "scoring_functions": "function_id",
}

# All ID field names to check when indexing items
_ID_FIELDS = [
    "principle_id", "rule_id", "exception_id", "threshold_id",
    "modifier_id", "contradiction_id", "fabric_rule_id",
    "context_rule_id", "function_id", "scoring_function_id",
]


def _extract_id(item: dict) -> Optional[str]:
    """Extract the ID from a registry item, checking all known ID fields."""
    for field in _ID_FIELDS:
        if field in item:
            return item[field]
    return None


def _load_registry_file(filepath: str) -> List[dict]:
    """Load a single registry JSON file, handling mixed wrapper/flat structure."""
    if not os.path.exists(filepath):
        return []

    with open(filepath, "r") as f:
        data = json.load(f)

    if not isinstance(data, list):
        return [data] if isinstance(data, dict) else []

    items = []
    for entry in data:
        if not isinstance(entry, dict):
            continue
        # Check if this is a wrapper block with nested items
        found_nested = False
        for nested_key in _NESTED_KEY_MAP:
            if nested_key in entry and isinstance(entry[nested_key], list):
                items.extend(entry[nested_key])
                found_nested = True
                break
        if not found_nested:
            items.append(entry)

    return items


class GoldenRegistry:
    """Indexed access to the Golden Rule Registry."""

    def __init__(self, registry_dir: str = _REGISTRY_DIR):
        self._registry_dir = registry_dir
        self._by_type: Dict[str, List[dict]] = {}
        self._by_id: Dict[str, dict] = {}
        self._confidence: Dict[str, dict] = {}
        self._loaded = False

    def load(self) -> "GoldenRegistry":
        """Load all registry files from JSON and build indices."""
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

        for reg_type, filename in file_map.items():
            filepath = os.path.join(self._registry_dir, filename)
            items = _load_registry_file(filepath)
            self._by_type[reg_type] = items
            for item in items:
                item_id = _extract_id(item)
                if item_id:
                    self._by_id[item_id] = item

        # Load confidence overlay
        conf_path = os.path.join(_SYNTHESIS_DIR, "rule_confidence.json")
        if os.path.exists(conf_path):
            with open(conf_path, "r") as f:
                self._confidence = json.load(f)

        self._loaded = True
        return self

    def load_from_mongodb(self, mongo_uri: str, db_name: str = "kridha-proto-dev") -> "GoldenRegistry":
        """Load registry from MongoDB `styling_rules` collection.

        Each document in styling_rules has:
          { rule_type: "principles"|"rules"|..., items: [...], _id: ... }

        Falls back to JSON loading if MongoDB is unavailable.
        """
        try:
            from pymongo import MongoClient

            client = MongoClient(mongo_uri, serverSelectionTimeoutMS=5000)
            db = client[db_name]
            collection = db["styling_rules"]

            # Check if collection has data
            doc_count = collection.count_documents({})
            if doc_count == 0:
                logger.warning("MongoDB styling_rules collection is empty, falling back to JSON")
                return self.load()

            # Load each rule type
            for doc in collection.find({}):
                rule_type = doc.get("rule_type")
                items = doc.get("items", [])
                if rule_type and items:
                    self._by_type[rule_type] = items
                    for item in items:
                        item_id = _extract_id(item)
                        if item_id:
                            self._by_id[item_id] = item

            # Load confidence from dedicated collection
            conf_collection = db["rule_confidence"]
            for doc in conf_collection.find({}):
                item_id = doc.get("item_id") or doc.get("_id")
                if item_id and isinstance(item_id, str):
                    self._confidence[str(item_id)] = doc

            self._loaded = True
            logger.info(
                "Loaded registry from MongoDB: %d items, %d confidence entries",
                len(self._by_id), len(self._confidence),
            )
            client.close()
            return self

        except Exception as e:
            logger.warning("MongoDB load failed (%s), falling back to JSON files", e)
            return self.load()

    def get_by_id(self, item_id: str) -> Optional[dict]:
        """Get a registry item by its ID."""
        return self._by_id.get(item_id)

    def get_by_type(self, reg_type: str) -> List[dict]:
        """Get all items of a given registry type."""
        return self._by_type.get(reg_type, [])

    def get_confidence(self, item_id: str) -> Optional[dict]:
        """Get confidence data for a registry item."""
        return self._confidence.get(item_id)

    def get_item_confidence_score(self, item_id: str) -> float:
        """Get the average confidence score for an item, defaulting to 0.70."""
        conf = self._confidence.get(item_id)
        if conf and "avg_confidence" in conf:
            return conf["avg_confidence"]
        # Fall back to inline confidence if present
        item = self._by_id.get(item_id)
        if item and "confidence" in item:
            c = item["confidence"]
            if isinstance(c, (int, float)):
                return float(c)
        return 0.70

    @property
    def total_items(self) -> int:
        return len(self._by_id)

    @property
    def type_counts(self) -> Dict[str, int]:
        return {k: len(v) for k, v in self._by_type.items()}

    def summary(self) -> str:
        """Human-readable summary of loaded registry."""
        lines = [f"Golden Registry: {self.total_items} indexed items"]
        for t, count in sorted(self.type_counts.items()):
            lines.append(f"  {t}: {count}")
        lines.append(f"  confidence entries: {len(self._confidence)}")
        return "\n".join(lines)


# ================================================================
# SINGLETON REGISTRY INSTANCE
# ================================================================

_registry: Optional[GoldenRegistry] = None
_mongo_uri: Optional[str] = None
_mongo_db: Optional[str] = None


def configure_mongodb(mongo_uri: str, db_name: str = "kridha-proto-dev"):
    """Configure MongoDB as the registry backend. Call before get_registry()."""
    global _mongo_uri, _mongo_db, _registry
    _mongo_uri = mongo_uri
    _mongo_db = db_name
    _registry = None  # Force reload on next get_registry()


def get_registry() -> GoldenRegistry:
    """Get or create the singleton registry instance."""
    global _registry
    if _registry is None:
        if _mongo_uri:
            _registry = GoldenRegistry().load_from_mongodb(_mongo_uri, _mongo_db or "kridha-proto-dev")
        else:
            _registry = GoldenRegistry().load()
    return _registry


def reload_registry() -> GoldenRegistry:
    """Force-reload the registry (e.g. after rule updates)."""
    global _registry
    _registry = None
    return get_registry()


def get_fabric_data(fabric_name: str) -> Optional[dict]:
    """Look up a fabric by name in the 50-fabric table."""
    return FABRIC_LOOKUP.get(fabric_name)


def get_bust_dividing_threshold(bust_differential: float) -> float:
    """Get V-neck bust dividing threshold for a given bust differential."""
    for bd_max, threshold in sorted(BUST_DIVIDING_THRESHOLDS.items()):
        if bust_differential <= bd_max:
            return threshold
    return 3.5  # F+ cup
