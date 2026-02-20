"""
Kridha Production Scoring Engine — Fabric Gate
===============================================
Resolves raw fabric composition into behavioral properties (stretch, weight,
sheen, cling risk) and applies gate rules that can trigger exceptions or
override scoring paths.

Source: Domain 3 (kridha_scoring_engine.py) — fabric resolution, cling model,
photo-to-reality discount, gate rules.
"""

import math
from dataclasses import dataclass, field
from typing import List, Optional, Tuple

from .schemas import (
    BodyProfile, GarmentProfile, ExceptionTriggered,
    FabricConstruction, SurfaceFinish, Silhouette, NecklineType,
    clamp,
)
from .rules_data import (
    ELASTANE_MULTIPLIERS, FIBER_GSM_MULTIPLIERS, SHEEN_MAP,
    FABRIC_LOOKUP, get_fabric_data,
)


# ================================================================
# RESOLVED FABRIC PROPERTIES
# ================================================================

@dataclass
class ResolvedFabric:
    """Computed fabric behavior from raw composition."""
    total_stretch_pct: float = 0.0
    effective_gsm: float = 150.0
    sheen_score: float = 0.10
    drape_coefficient: float = 50.0      # 0-100% (domain 4 convention)
    cling_risk_base: float = 0.3
    is_structured: bool = False
    photo_reality_discount: float = 0.0
    surface_friction: float = 0.5


def resolve_fabric_properties(garment: GarmentProfile) -> ResolvedFabric:
    """Phase 1: Convert raw fabric attributes to behavioral properties.

    Domain 3 resolve_fabric_properties():
    - total_stretch_pct = elastane_pct × construction_multiplier
    - effective_gsm = gsm × fiber_multiplier
    - sheen_score = SurfaceFinish → SHEEN_MAP
    """
    # Look up fabric if name is provided
    fabric_data = None
    if garment.fabric_name:
        fabric_data = get_fabric_data(garment.fabric_name)

    # Construction multiplier
    construction_key = garment.construction.value
    elastane_mult = ELASTANE_MULTIPLIERS.get(construction_key, 2.0)
    total_stretch = garment.elastane_pct * elastane_mult

    # If fabric lookup provides typical_stretch and we have no elastane info, use it
    if fabric_data and garment.elastane_pct == 0 and fabric_data.get("typical_stretch", 0) > 0:
        total_stretch = fabric_data["typical_stretch"]

    # Fiber GSM multiplier
    fiber_mult = FIBER_GSM_MULTIPLIERS.get(garment.primary_fiber, 1.0)
    effective_gsm = garment.gsm_estimated * fiber_mult

    # Sheen score
    sheen = SHEEN_MAP.get(garment.surface.value, 0.10)

    # Drape coefficient (convert 1-10 scale to %)
    drape_coeff = garment.drape * 10.0

    # Base cling risk
    gsm_factor = max(0, 1.0 - effective_gsm / 300.0)
    friction_factor = max(0, 1.0 - garment.surface_friction)
    cling_base = min(1.0, (total_stretch / 20.0 + gsm_factor + friction_factor) / 3.0)

    return ResolvedFabric(
        total_stretch_pct=total_stretch,
        effective_gsm=effective_gsm,
        sheen_score=sheen,
        drape_coefficient=drape_coeff,
        cling_risk_base=cling_base,
        is_structured=garment.is_structured or garment.has_lining,
        photo_reality_discount=0.0,  # computed separately if needed
        surface_friction=garment.surface_friction,
    )


# ================================================================
# CLING RISK MODEL (Domain 3 cling threshold)
# ================================================================

@dataclass
class ClingResult:
    stretch_demand_pct: float
    base_threshold: float
    exceeds_threshold: bool
    severity: float                       # 0-1, how much over threshold


def compute_cling_risk(
    resolved: ResolvedFabric,
    zone_circ: float,
    garment_rest_circ: float,
    curvature_rate: float,
) -> ClingResult:
    """Compute per-zone cling risk.

    Domain 3 cling model:
    stretch_demand_pct = ((zone_circ - garment_rest_circ) / stretch_range) × 100
    base_threshold = max(10, 62 - 26 × curvature_rate)
    """
    stretch_range = garment_rest_circ * (resolved.total_stretch_pct / 100.0)
    if stretch_range <= 0:
        stretch_range = 0.01  # avoid division by zero

    stretch_demand = ((zone_circ - garment_rest_circ) / stretch_range) * 100.0
    stretch_demand = max(0, stretch_demand)

    base_threshold = max(10, 62 - 26 * curvature_rate)
    exceeds = stretch_demand > base_threshold

    severity = 0.0
    if exceeds and base_threshold > 0:
        severity = min(1.0, (stretch_demand - base_threshold) / base_threshold)

    return ClingResult(
        stretch_demand_pct=stretch_demand,
        base_threshold=base_threshold,
        exceeds_threshold=exceeds,
        severity=severity,
    )


# ================================================================
# PHOTO-TO-REALITY DISCOUNT (Domain 3)
# ================================================================

# Reference model measurements (inches)
_REF_MODEL = {
    "bust": 34.0,
    "waist": 25.0,
    "hip": 35.0,
    "upper_arm": 10.0,
    "thigh": 20.0,
}

# Per-zone gap coefficients (how much the gap between model and user matters)
_ZONE_GAP_COEFFICIENTS = {
    "bust": 0.08,
    "waist": 0.06,
    "hip": 0.10,
    "upper_arm": 0.04,
    "thigh": 0.07,
}

# Brand tier multipliers for photo accuracy
_BRAND_MULTIPLIERS = {
    "luxury": 0.85,        # photos closer to reality
    "premium": 0.90,
    "mid_market": 1.00,
    "mass_market": 1.10,
    "fast_fashion": 1.20,  # photos most misleading
}


def photo_to_reality_discount(
    garment: GarmentProfile, body: BodyProfile
) -> float:
    """Compute how much the garment will look different on the user vs.
    the product photo model. Domain 3.

    Returns discount 0.0 (identical to photo) to 0.55 (very different).
    """
    total_gap = 0.0
    zones = {
        "bust": (body.bust, _REF_MODEL["bust"]),
        "waist": (body.waist, _REF_MODEL["waist"]),
        "hip": (body.hip, _REF_MODEL["hip"]),
        "upper_arm": (body.c_upper_arm_max, _REF_MODEL["upper_arm"]),
        "thigh": (body.c_thigh_max, _REF_MODEL["thigh"]),
    }

    for zone_name, (user_circ, model_circ) in zones.items():
        gap = abs(user_circ - model_circ)
        coeff = _ZONE_GAP_COEFFICIENTS.get(zone_name, 0.05)
        total_gap += gap * coeff

    brand_mult = _BRAND_MULTIPLIERS.get(garment.brand_tier.value, 1.0)
    discount = min(0.55, total_gap * brand_mult)

    return discount


# ================================================================
# GATE RULES — Boolean checks that trigger exceptions
# ================================================================

def run_fabric_gates(
    garment: GarmentProfile,
    body: BodyProfile,
    resolved: ResolvedFabric,
) -> List[ExceptionTriggered]:
    """Run all fabric gate rules and return triggered exceptions."""
    exceptions = []

    # Gate 1: Dark + shiny inversion
    if garment.is_dark and resolved.sheen_score > 0.50:
        exceptions.append(ExceptionTriggered(
            exception_id="GATE_DARK_SHINY",
            rule_overridden="dark_slimming",
            reason=(
                f"Dark (L={garment.color_lightness:.2f}) + high sheen "
                f"(SI={resolved.sheen_score:.2f}): sheen amplifies body "
                f"contours, partially negating dark slimming benefit"
            ),
            confidence=0.80,
        ))

    # Gate 2: A-line drape override (shelf effect)
    if (garment.silhouette == Silhouette.A_LINE and
            resolved.drape_coefficient >= 65):
        exceptions.append(ExceptionTriggered(
            exception_id="GATE_ALINE_SHELF",
            rule_overridden="aline_balance",
            reason=(
                f"A-line + stiff fabric (DC={resolved.drape_coefficient:.0f}%): "
                f"fabric won't drape, creates shelf effect at hips"
            ),
            confidence=0.82,
        ))

    # Gate 3: Wrap dress gapping risk
    if (garment.neckline == NecklineType.WRAP and
            body.bust_differential >= 6 and
            resolved.surface_friction < 0.3):
        exceptions.append(ExceptionTriggered(
            exception_id="GATE_WRAP_GAPPING",
            rule_overridden="wrap_neckline",
            reason=(
                f"Wrap neckline + large bust (BD={body.bust_differential:.1f}\") "
                f"+ slippery fabric (friction={resolved.surface_friction:.2f}): "
                f"high gaping risk"
            ),
            confidence=0.75,
        ))

    # Gate 4: Tailoring override (structured garments)
    if resolved.is_structured:
        exceptions.append(ExceptionTriggered(
            exception_id="GATE_STRUCTURED",
            rule_overridden="negative_penalties",
            reason=(
                "Structured garment (boning/lining): negative penalties "
                "reduced ~70% — construction provides body sculpting"
            ),
            confidence=0.85,
        ))

    # Gate 5: Fluid fabric at apple belly
    if (resolved.drape_coefficient > 60 and body.belly_zone > 0.3 and
            garment.silhouette not in (
                Silhouette.FITTED, Silhouette.SEMI_FITTED)):
        exceptions.append(ExceptionTriggered(
            exception_id="GATE_FLUID_APPLE_BELLY",
            rule_overridden="tent_concealment",
            reason=(
                f"Fluid/drapey fabric (DC={resolved.drape_coefficient:.0f}%) "
                f"on belly concern zone ({body.belly_zone:.2f}): "
                f"fabric clings to belly contour instead of skimming"
            ),
            confidence=0.72,
        ))

    # Gate 6: Cling trap — matte but clingy on curves
    if (resolved.sheen_score < 0.30 and resolved.cling_risk_base > 0.6 and
            (body.is_plus_size or body.hip_zone > 0.5 or
             body.belly_zone > 0.5)):
        exceptions.append(ExceptionTriggered(
            exception_id="GATE_CLING_TRAP",
            rule_overridden="matte_zone",
            reason=(
                f"Matte (SI={resolved.sheen_score:.2f}) but clingy "
                f"(cling={resolved.cling_risk_base:.2f}): creates "
                f"second-skin effect on curves, overriding matte benefit"
            ),
            confidence=0.78,
        ))

    return exceptions


def get_structured_penalty_reduction(
    exceptions: List[ExceptionTriggered],
) -> float:
    """If GATE_STRUCTURED was triggered, return the penalty reduction factor.
    Structured garments reduce negative penalties by ~70%."""
    for ex in exceptions:
        if ex.exception_id == "GATE_STRUCTURED":
            return 0.30  # only 30% of penalty remains
    return 1.0  # no reduction
