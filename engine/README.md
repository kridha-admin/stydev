# Kridha Production Scoring Engine

Perceptual fashion intelligence engine that scores garment-body fit using a 7-layer pipeline.

## Architecture

```
Input: GarmentProfile + BodyProfile
          │
          ▼
┌─────────────────────────────────────┐
│  Layer 1: Fabric Gate               │  fabric_gate.py
│  Resolve stretch, GSM, sheen, cling │
│  Run 6 gate rules → exceptions      │
└──────────────┬──────────────────────┘
               ▼
┌─────────────────────────────────────┐
│  Layer 2: Element Scoring           │  kridha_engine.py
│  16 principle scorers (-1 to +1)    │
│  10 domain-4 + 6 domain-2/3        │
└──────────────┬──────────────────────┘
               ▼
┌─────────────────────────────────────┐
│  Layer 3: Perceptual Calibration    │  kridha_engine.py
│  Goal-based weight boosts           │
│  Negative amplification (×1.2)      │
│  Single-dimension weight cap (35%)  │
└──────────────┬──────────────────────┘
               ▼
┌─────────────────────────────────────┐
│  Layer 4: Goal Scoring              │  goal_scorers.py
│  6 user goals + 4 internal goals    │
│  Pass/Fail/Caution verdicts         │
└──────────────┬──────────────────────┘
               ▼
┌─────────────────────────────────────┐
│  Layer 5: Body-Type Parameterization│  body_garment_translator.py
│  Hemline danger zones, sleeve width │
│  Golden ratio waist, proportion shift│
└──────────────┬──────────────────────┘
               ▼
┌─────────────────────────────────────┐
│  Layer 6: Context Modifiers         │  context_modifiers.py
│  Occasion, culture, climate, age    │
└──────────────┬──────────────────────┘
               ▼
┌─────────────────────────────────────┐
│  Layer 7: Composite                 │  kridha_engine.py
│  Weighted average → silhouette      │
│  dominance → clamp → 0-10 scale    │
└──────────────┬──────────────────────┘
               ▼
Output: ScoreResult (0-10 overall, principle breakdown,
        goal verdicts, zone scores, exceptions, fixes)
```

## Files

| File | Purpose | Lines |
|------|---------|-------|
| `schemas.py` | All data structures (BodyProfile, GarmentProfile, ScoreResult, enums) | ~400 |
| `rules_data.py` | Constants, fabric lookup (50 fabrics), golden registry loader (734 items) | ~500 |
| `body_garment_translator.py` | Piece 2 math: hemline/sleeve/waist translation | ~350 |
| `fabric_gate.py` | Fabric property resolution, cling model, 6 gate rules | ~250 |
| `kridha_engine.py` | 16 scorers + 7-layer composite pipeline | ~900 |
| `goal_scorers.py` | Goal-to-principle mapping, verdict computation | ~200 |
| `context_modifiers.py` | Cultural/occasion/climate/age modifiers | ~175 |
| `test_engine.py` | 85 tests across 9 sections | ~500 |

## 16 Principle Scorers

| # | Scorer | Source | Key logic |
|---|--------|--------|-----------|
| 1 | H-Stripe Thinning | Domain 4 | Helmholtz/Ashida, zone-split by body shape |
| 2 | Dark/Black Slimming | Domain 4 | Irradiation illusion, skin-tone gate, sheen override |
| 3 | Rise Elongation | Domain 4 | Waistband construction gate, petite inversion |
| 4 | A-Line Balance | Domain 4 | Drape gate (shelf inversion), ER trapezoidal curve |
| 5 | Tent Concealment | Domain 4 | Dual-goal split, 5 body-type reversals |
| 6 | Color Break | Domain 4 | Belt effect, hourglass reversal, apple penalty |
| 7 | Bodycon Mapping | Domain 4 | Fabric construction gate, hourglass exception |
| 8 | Matte Zone | Domain 4 | Specular highlights, cling trap override |
| 9 | V-Neck Elongation | Domain 4 | Cross-garment (neckline × rise), bust dividing |
| 10 | Monochrome Column | Domain 4 | Dark bonus, petite amplification |
| 11 | Hemline | Domain 2 | Danger zones (knee/calf/thigh), safe zone, body-type mods |
| 12 | Sleeve | Domain 2 | Perceived width model (60/40), arm prominence severity |
| 13 | Waist Placement | Domain 2 | Golden ratio (0.618), empire tent, drop waist penalties |
| 14 | Color Value | Domain 2 | Lightness → slim_pct × 6.25, shape-loss |
| 15 | Fabric Zone | Domain 3 | Weighted sub-scores: cling/structure/sheen/drape |
| 16 | Neckline Compound | Domain 2 | Bust dividing + torso slimming + upper body balance |

## Usage

```python
from engine import score_garment, BodyProfile, GarmentProfile, StylingGoal

body = BodyProfile(
    height=66, bust=38, underbust=32, waist=27, hip=39,
    shoulder_width=14.0,
)
body.styling_goals = [StylingGoal.HIGHLIGHT_WAIST]

garment = GarmentProfile(
    color_lightness=0.10,
    surface=SurfaceFinish.MATTE,
    neckline=NecklineType.V_NECK,
    expansion_rate=0.02,
    is_structured=True,
    has_contrasting_belt=True,
    belt_width_cm=5.0,
)

result = score_garment(garment, body)
print(f"Score: {result.overall_score}/10")
print(f"Composite: {result.composite_raw:+.3f}")
for p in result.principle_scores:
    if p.applicable:
        print(f"  {p.name}: {p.score:+.3f} (w={p.weight:.2f})")
```

## Running Tests

```bash
python engine/test_engine.py
```

85 tests across 9 sections:
- Section 1: 8 reversals (R1-R8)
- Section 2: 27 priority-1 detections
- Section 3: 4 composite scenarios (end-to-end)
- Section 4: 6 edge cases
- Section 5: 9 Piece 2 math tests
- Section 6: 8 fabric gate tests
- Section 7: 4 goal scoring tests
- Section 8: 7 registry & data tests
- Section 9: 10 new scorer tests (P11-P16)

## Score Convention

- Internal: -1.0 (maximum negative) to +1.0 (maximum positive)
- Display: 0 (worst) to 10 (best), via `score_to_ten(raw) = raw × 5 + 5`
- Each principle scorer returns (score, reasoning_string)
- Composite: confidence-weighted average of applicable principles
