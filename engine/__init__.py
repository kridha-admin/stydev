"""
Kridha Production Scoring Engine
=================================
Perceptual fashion intelligence engine that scores garments
against user body profiles.

Usage:
    from engine import score_garment, BodyProfile, GarmentProfile

    body = BodyProfile(height=64, bust=36, waist=28, hip=38)
    garment = GarmentProfile(color_lightness=0.10, silhouette=Silhouette.FITTED)
    result = score_garment(garment, body)
    print(f"Score: {result.overall_score}/10")
"""

from .schemas import (
    BodyProfile, GarmentProfile, ScoreResult,
    PrincipleResult, GoalVerdict, ZoneScore,
    ExceptionTriggered, Fix, BodyAdjustedGarment,
    BodyShape, StylingGoal, SkinUndertone,
    FabricConstruction, SurfaceFinish, Silhouette,
    SleeveType, NecklineType, GarmentCategory,
    GarmentLayer, TopHemBehavior,
    BrandTier, WearContext, Climate,
    clamp, score_to_ten, rescale_display,
)
from .kridha_engine import score_garment
from .garment_types import classify_garment

__all__ = [
    "score_garment", "classify_garment",
    "BodyProfile", "GarmentProfile", "ScoreResult",
    "PrincipleResult", "GoalVerdict", "ZoneScore",
    "ExceptionTriggered", "Fix", "BodyAdjustedGarment",
    "BodyShape", "StylingGoal", "SkinUndertone",
    "FabricConstruction", "SurfaceFinish", "Silhouette",
    "SleeveType", "NecklineType", "GarmentCategory",
    "GarmentLayer", "TopHemBehavior",
    "BrandTier", "WearContext", "Climate",
]
