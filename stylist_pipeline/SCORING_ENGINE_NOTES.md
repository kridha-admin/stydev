# Scoring Engine Notes



## files

engine/kridha_engine.mjs — all 13 scorers + pipeline
engine/bridge.mjs — raw data → GarmentProfile + BodyProfile
engine/schemas.mjs — classes, enums, rescaling
engine/index.mjs — entry point, scoreAndCommunicate()
engine/fabric_gate.mjs — fabric gates
engine/body_garment_translator.mjs — hemline/sleeve/waist mapping
engine/goal_scorers.mjs — per-goal pass/fail
engine/garment_types.mjs — type-specific scorers (tops, pants, jackets)
product_image_extraction.mjs — nova lite vision (17 fields)
product_text_extraction.mjs — nova micro text (6 fields)
run_pipeline.mjs — orchestration

## 13 scorers

each returns -1 to +1. zero = not applicable.

H-Stripe (0.10) — horizontal stripes widen
Dark Slimming (0.08) — dark colors slim
A-Line Balance (0.10) — flare balances hips
Tent Concealment (0.12) — loose hides vs shapeless
Bodycon Mapping (0.12) — tight fit reveals contours
Matte Zone (0.06) — matte deflects, sheen attracts
V-Neck Elongation (0.10) — V elongates torso
Hemline (0.18) — where it ends vs body landmarks
Sleeve (0.15) — sleeve vs upper arm
Waist Placement (0.15) — waist position vs golden ratio
Color Value (0.08) — lightness on zones
Fabric Zone (0.10) — cling + structure + drape
Neckline Compound (0.12) — V-neck bust proportion

removed 3 (Rise Elongation, Color Break, Monochrome Column) — no data source, always returned 0

## goals

tier 1: user picks (weight 1.0) — look_taller, minimize_hips etc
tier 2: derived from body shape (weight 0.5) — apple auto-gets hide_midsection
tier 3: universal (weight 0.25) — everyone gets look_proportional

goals boost relevant scorer weights. highlight_waist boosts Bodycon 1.3x, Waist Placement 1.5x.

## verdicts

TII (this is it): >= 7.0
SP (smart pick): 4.5 - 7.0
NTO (not this one): < 4.5

## key rules

fabric gate — structured fabric reduces negatives by 70%
silhouette dominance — bad silhouette can override everything
definition dominance — user wants definition but garment hides it → score cut
weight cap — no scorer > 35% of total

## null handling

bedrock doesn't extract → stays null. scorers return N/A instead of scoring fake data. changed 4 fields from fake defaults to null: expansion_rate, hem_position, color_lightness, drape.

## benchmark

10 garments x 10 users = 100 combos
run: node benchmark/run_benchmark.mjs
range: 2.5 - 8.5, mean 5.9, 16/17 archetype checks pass, 0 errors

---

phase 1 — removed dead scorers, fixed structural gate, fixed weight ordering, derived zone goals
phase 1.5 — height-scaled body landmarks, hemline calibration
phase 2 — null handling, stopped fake defaults
phase 2.5 — bust_differential now varies by body (was fixed 4.0 for everyone)
phase 3 — tent + bodycon fixes, definition dominance
phase 3.5 — 6 null guard bug fixes for production

## known limitations

context_modifiers.mjs coded but not connected (occasion/climate)
golden registry ~40% implemented
skin_tone/undertone not used yet
simplified extraction prompts drop some fields scorers could use
