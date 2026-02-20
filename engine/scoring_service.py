"""
Kridha Scoring Service — FastAPI Wrapper
==========================================
Exposes the Python scoring engine as an HTTP service on port 8000.
The Node.js pipeline calls POST /score after garment attribute extraction.

Supports optional MongoDB backend for rules (set MONGO_CONNECTION_STRING env var).
"""

import sys
import os
import time
import logging
from contextlib import asynccontextmanager
from dataclasses import fields
from enum import Enum
from typing import Any, List, Optional

# Add parent directory to path so we can import engine package
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel

from engine.kridha_engine import score_garment
from engine.bridge import build_body_profile, build_garment_profile
from engine.rules_data import configure_mongodb, reload_registry, get_registry
from engine.communicate import generate_communication

logger = logging.getLogger(__name__)
logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")

# MongoDB connection string (optional — if not set, uses JSON files)
MONGO_URI = os.environ.get("MONGO_CONNECTION_STRING")
MONGO_DB = os.environ.get("MONGO_DB_NAME", "kridha-proto-dev")


# ================================================================
# LIFESPAN — MongoDB setup on startup
# ================================================================

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Configure MongoDB-backed registry on startup if MONGO_CONNECTION_STRING is set."""
    if MONGO_URI:
        logger.info("Configuring MongoDB backend: db=%s", MONGO_DB)
        configure_mongodb(MONGO_URI, MONGO_DB)
        registry = get_registry()
        logger.info("Registry loaded: %s", registry.summary())
    else:
        logger.info("No MONGO_CONNECTION_STRING set, using JSON files")
        registry = get_registry()
        logger.info("Registry loaded from JSON: %s", registry.summary())
    yield


app = FastAPI(title="Kridha Scoring Service", version="2.0.0", lifespan=lifespan)


# ================================================================
# REQUEST / RESPONSE MODELS
# ================================================================

class ScoreRequest(BaseModel):
    user_measurements: dict
    garment_attributes: dict
    styling_goals: Optional[List[str]] = None
    context: Optional[dict] = None


class CommunicateRequest(BaseModel):
    score_result: dict
    user_measurements: dict
    garment_attributes: dict
    styling_goals: Optional[List[str]] = None
    user_name: str = "You"


# ================================================================
# SERIALIZATION
# ================================================================

def dataclass_to_dict(obj: Any) -> Any:
    """Recursively serialize a dataclass to a JSON-safe dict.

    Handles: dataclasses, Enums, lists, tuples, dicts, None, primitives.
    """
    if obj is None:
        return None
    if isinstance(obj, Enum):
        return obj.value
    if isinstance(obj, (int, float, str, bool)):
        return obj
    if isinstance(obj, tuple):
        return list(dataclass_to_dict(item) for item in obj)
    if isinstance(obj, list):
        return [dataclass_to_dict(item) for item in obj]
    if isinstance(obj, dict):
        return {str(k): dataclass_to_dict(v) for k, v in obj.items()}
    # Dataclass check
    if hasattr(obj, '__dataclass_fields__'):
        result = {}
        for f in fields(obj):
            val = getattr(obj, f.name)
            result[f.name] = dataclass_to_dict(val)
        return result
    # Fallback
    return str(obj)


# ================================================================
# ENDPOINTS
# ================================================================

@app.get("/health")
def health():
    registry = get_registry()
    return {
        "status": "ok",
        "registry_items": registry.total_items,
        "backend": "mongodb" if MONGO_URI else "json",
    }


@app.post("/score")
def score(request: ScoreRequest):
    start = time.time()

    # Build profiles via bridge
    try:
        body = build_body_profile(request.user_measurements, request.styling_goals)
    except Exception as e:
        logger.error("Body profile conversion failed: %s", e, exc_info=True)
        raise HTTPException(status_code=400, detail=f"Body profile conversion failed: {e}")

    try:
        garment = build_garment_profile(request.garment_attributes)
    except Exception as e:
        logger.error("Garment profile conversion failed: %s", e, exc_info=True)
        raise HTTPException(status_code=400, detail=f"Garment profile conversion failed: {e}")

    # Score
    try:
        result = score_garment(garment, body, request.context)
    except Exception as e:
        logger.error("Scoring engine failed: %s", e, exc_info=True)
        raise HTTPException(status_code=500, detail=f"Scoring engine error: {e}")

    # Serialize
    response = dataclass_to_dict(result)

    elapsed_ms = (time.time() - start) * 1000
    logger.info(
        "Scored: garment_type=%s body_shape=%s overall_score=%.2f latency=%.0fms",
        garment.category.value,
        body.body_shape.value,
        result.overall_score,
        elapsed_ms,
    )

    return response


@app.post("/communicate")
def communicate(request: CommunicateRequest):
    """Generate UI-ready communication from a score result.

    Takes the output of /score plus the original profiles and returns
    headline, pinch, goal chips, search pills, chat chips, etc.
    Zero LLM calls — instant response from the phrase bank.
    """
    start = time.time()

    try:
        result = generate_communication(
            score_result=request.score_result,
            body_profile=request.user_measurements,
            garment_profile=request.garment_attributes,
            styling_goals=request.styling_goals,
            user_name=request.user_name,
        )
    except Exception as e:
        logger.error("Communication generation failed: %s", e, exc_info=True)
        raise HTTPException(status_code=500, detail=f"Communication error: {e}")

    elapsed_ms = (time.time() - start) * 1000
    logger.info(
        "Communicated: verdict=%s score=%.1f latency=%.0fms",
        result.get("verdict", "?"),
        result.get("overall_score", 0),
        elapsed_ms,
    )

    return result


@app.post("/score-and-communicate")
def score_and_communicate(request: ScoreRequest):
    """End-to-end: score a garment AND generate UI communication in one call.

    This is the primary production endpoint. Returns both the raw score
    breakdown and the complete UI-ready communication output.
    """
    start = time.time()

    # Build profiles via bridge
    try:
        body = build_body_profile(request.user_measurements, request.styling_goals)
    except Exception as e:
        logger.error("Body profile conversion failed: %s", e, exc_info=True)
        raise HTTPException(status_code=400, detail=f"Body profile conversion failed: {e}")

    try:
        garment = build_garment_profile(request.garment_attributes)
    except Exception as e:
        logger.error("Garment profile conversion failed: %s", e, exc_info=True)
        raise HTTPException(status_code=400, detail=f"Garment profile conversion failed: {e}")

    # Score
    try:
        result = score_garment(garment, body, request.context)
    except Exception as e:
        logger.error("Scoring engine failed: %s", e, exc_info=True)
        raise HTTPException(status_code=500, detail=f"Scoring engine error: {e}")

    # Serialize score result
    score_dict = dataclass_to_dict(result)

    # Generate communication — enrich with resolved profile data
    # Must include all fields that communicate.py's makeScenarioId expects
    body_dict = dict(request.user_measurements)
    body_dict["body_shape"] = body.body_shape.value
    body_dict["height"] = body.height  # inches, for user_line display
    body_dict["name"] = request.user_measurements.get("name", "You")
    # Add measurement fields that communicate.py expects (in inches)
    body_dict["bust"] = body.bust
    body_dict["waist"] = body.waist
    body_dict["hip"] = body.hip
    body_dict["torso_leg_ratio"] = body.torso_leg_ratio

    garment_dict = dict(request.garment_attributes)
    garment_dict["category"] = garment.category.value
    # Use model_height_inches from input, not model_estimated_size (which is a dress size, not height)
    garment_dict["model_height_inches"] = request.garment_attributes.get("model_height_inches", 0)
    # Add garment fields that communicate.py expects
    garment_dict["color_lightness"] = garment.color_lightness
    garment_dict["silhouette"] = garment.silhouette.value if hasattr(garment.silhouette, 'value') else garment.silhouette

    try:
        comm = generate_communication(
            score_result=score_dict,
            body_profile=body_dict,
            garment_profile=garment_dict,
            styling_goals=request.styling_goals,
        )
    except Exception as e:
        logger.error("Communication generation failed: %s", e, exc_info=True)
        raise HTTPException(status_code=500, detail=f"Communication error: {e}")

    elapsed_ms = (time.time() - start) * 1000
    logger.info(
        "Score+Communicate: garment_type=%s body_shape=%s score=%.1f verdict=%s latency=%.0fms",
        garment.category.value,
        body.body_shape.value,
        result.overall_score,
        comm.get("verdict", "?"),
        elapsed_ms,
    )

    return {
        "score": score_dict,
        "communication": comm,
    }


@app.post("/reload-rules")
def reload_rules():
    """Force-reload the rule registry (from MongoDB or JSON, depending on config)."""
    try:
        registry = reload_registry()
        return {
            "status": "reloaded",
            "total_items": registry.total_items,
            "type_counts": registry.type_counts,
        }
    except Exception as e:
        logger.error("Reload failed: %s", e, exc_info=True)
        raise HTTPException(status_code=500, detail=f"Reload failed: {e}")


# ================================================================
# MAIN
# ================================================================

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
