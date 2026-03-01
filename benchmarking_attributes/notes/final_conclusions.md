
# Prompt

## Null Handling Strategy

**Current approach (causes null returns):**
```
"Use null if attribute doesn't apply to this garment type"
```

**Problem:** Models interpret this too liberally and return null when uncertain, even for attributes that apply to ALL garment types.

**New approach:** Categorize attributes by applicability:

| Category | Attributes | Prompt Language |
|----------|------------|-----------------|
| **REQUIRED (all garments)** | garment_type, color_primary, color_value, pattern_type, is_adult_clothing, fabric_apparent_weight, fabric_sheen, fit_category, fabric_drape | `(REQUIRED - always provide a value)` |
| **Conditional (garment-specific)** | hemline_position, waist_definition, waist_position, silhouette_type, sleeve_type, sleeve_length, neckline_type, neckline_depth, rise, leg_shape, leg_opening_width | `(use null if not applicable to this garment type)` |

**Example prompt change for fit_category:**
```
# Before
fit_category = fitted|relaxed|oversized

# After
fit_category = fitted|relaxed|oversized (REQUIRED - applies to all garments)
```

---

## Enum Value Descriptions

**Current approach (no descriptions):**
```
fit_category = tight|fitted|semi_fitted|relaxed|loose|oversized
```

**Problem:** Without descriptions, the model interprets enum values based on its own understanding, which may differ from our intended definitions. This leads to:
- Confusion between similar values (`tight` vs `fitted`, `loose` vs `relaxed`)
- Inconsistent interpretation across different images
- Model picking wrong value when boundaries are unclear

**Proposed approach (with descriptions):**
```
fit_category:
  - fitted: Garment follows body contours closely with minimal ease
  - relaxed: Garment has moderate ease, doesn't cling to body
  - oversized: Garment is intentionally much larger than body size
```

**Critical example — waist_definition (per manager clarification):**
```
waist_definition: What the GARMENT does at the waist, NOT what the body shows through it.
  - defined: Garment engineers waist shape (darts, boning, princess seams, peplum, cinched elastic).
             Lay it flat and you'd still see waist shaping.
  - semi_defined: Garment gently follows waist (wrap tie, soft gathering, light shirring)
  - undefined: Garment does nothing at waist. Any visible waist is the body underneath, not the dress.
             A tight stretchy dress with no seams → undefined (body creates shape, not garment)
```

**Critical example — waist_position:**
```
waist_position: Where the garment is DESIGNED to sit.
  - empire/natural/drop/low: Position of seam, elastic, or intentional narrowing
  - undefined: No seam, no elastic, no intentional narrowing (even if you can see the waist)
```

**Attributes that would benefit most from descriptions:**

| Attribute | Confusion Observed | Why Descriptions Help |
|-----------|-------------------|----------------------|
| fit_category | tight↔fitted, loose↔relaxed | Define "ease" levels clearly |
| silhouette_type | a_line↔fit_and_flare, wrap↔various | Clarify shape definitions |
| waist_definition | defined↔semi_defined | Explain seam vs shape interpretation |
| fabric_drape | structured↔fluid | Define fabric behavior criteria |
| neckline_depth | shallow↔medium↔deep | Provide measurement guidelines |
| color_value | medium_dark↔dark, light↔very_light | Clarify brightness thresholds |

**Trade-off:**
- Pros: More accurate selections, consistent interpretation, fewer edge-case errors
- Cons: Longer prompts, more tokens, slightly higher latency

**Recommendation:** Add brief descriptions for attributes with high confusion rates (fit_category, silhouette_type, waist_definition). Keep simple attributes (is_adult_clothing, pattern_type) without descriptions.

---

# Benchmark Final Conclusions

## Accuracy by Attribute (sorted by average accuracy, worst first)

| Attribute | Lite | Tiered | Flash | Remarks |
|-----------|------|--------|-------|---------|
| sleeve_length | N/A | N/A | 0.0 | |
| silhouette_type | 28.6 | 59.5 | 52.4 | |
| waist_position | 46.0 | 64.0 | 48.0 | |
| waist_definition | 42.0 | 68.0 | 62.0 | |
| color_primary | 56.0 | 58.0 | 66.0 | |
| neckline_depth | 28.6 | 76.2 | 78.6 | |
| hemline_position | 61.5 | 50.0 | 73.1 | |
| fit_category | 56.0 | 56.0 | 74.0 | |
| rise | 50.0 | 50.0 | 87.5 | |
| fabric_sheen | 48.0 | 68.0 | 72.0 | |
| leg_shape | 75.0 | 62.5 | 62.5 | |
| color_value | 70.0 | 60.0 | 74.0 | |
| fabric_apparent_weight | 76.0 | 58.0 | 74.0 | |
| fabric_drape | 70.0 | 68.0 | 72.0 | |
| leg_opening_width | 50.0 | 75.0 | 87.5 | |
| sleeve_type | 69.0 | 83.3 | 90.5 | |
| pattern_type | 84.0 | 90.0 | 92.0 | |
| neckline_type | 92.9 | 90.5 | 90.5 | |
| garment_type | 96.0 | 98.0 | 98.0 | |
| is_adult_clothing | 98.0 | 100.0 | 100.0 | |
| **OVERALL** | **64.2** | **71.9** | **71.5** | |

---

## Detailed Remarks by Attribute

### sleeve_length
| Model | Accuracy |
|-------|----------|
| Lite | N/A |
| Tiered | N/A |
| Flash | 0.0 |

**Remarks:**


---

### silhouette_type
| Model | Accuracy |
|-------|----------|
| Lite | 28.6 |
| Tiered | 59.5 |
| Flash | 52.4 |

**Remarks:**

#### Image-wise Comparison (mismatches only)

| Image | Garment | GT | Lite | Tiered | Flash |
|-------|---------|-----|------|--------|-------|
| image_01 | top | sheath | - | bodycon | - |
| image_02 | top | sheath | fitted | - | bodycon |
| image_03 | sweater | shift | - | - | - |
| image_04 | top | sheath | bodycon | - | - |
| image_05 | dress | fit_and_flare | a_line | a_line | ✓ |
| image_07 | top | bodycon | - | ✓ | - |
| image_08 | top | tent | - | - | - |
| image_09 | top | bodycon | - | ✓ | - |
| image_10 | top | shift | - | - | - |
| image_15 | dress | wrap | a_line | fit_and_flare | fit_and_flare |
| image_26 | dress | fit_and_flare | tiered | ✓ | tiered |
| image_30 | dress | wrap | a_line | ✓ | ✓ |
| image_31 | top | peplum | tiered | tiered | tiered |
| image_37 | dress | wrap | a_line | fit_and_flare | fit_and_flare |
| image_38 | dress | wrap | a_line | ✓ | ✓ |
| image_39 | dress | bodycon | wrap | wrap | wrap |
| image_40 | top | shift | sheath | bodycon | bodycon |
| image_41 | blouse | shift | - | - | - |
| image_42 | top | cocoon | - | - | - |
| image_44 | dress | fit_and_flare | a_line | ✓ | ✓ |
| image_45 | top | cocoon | - | ✓ | - |
| image_46 | sweater | cocoon | - | - | - |
| image_48 | dress | fit_and_flare | a_line | ✓ | ✓ |
| image_49 | top | shift | - | - | - |
| image_50 | blouse | shift | - | - | - |

#### Key Observations

1. **Tops/sweaters often return null** - All 3 models struggle with silhouette for non-dresses (shift, cocoon, tent → null)
2. **GT has values not in current enum**: `wrap`, `peplum` - but models return `tiered` which is also not in enum
3. **Consistent failures across all models**:
   - image_03, 08, 10, 41, 42, 46, 49, 50: All return null (mostly shift/cocoon/tent)
   - image_31: All say `tiered`, GT says `peplum`
   - image_39: All say `wrap`, GT says `bodycon`
4. **Lite-specific issues**:
   - Returns null for 12 valid silhouettes
   - Confuses `fit_and_flare` → `a_line` consistently
   - Returns invalid value `fitted` (image_02)
5. **Tiered wins**: Gets bodycon correct (07, 09) where Flash fails
6. **wrap → fit_and_flare confusion**: Tiered/Flash both misclassify wrap as fit_and_flare

#### Recommendations
- Add `wrap`, `peplum`, `tiered` to silhouette_type enum OR map them to existing values
- Consider making silhouette_type null for tops/sweaters (only applicable to dresses)
- Merge `a_line` and `fit_and_flare` if distinction is not critical


silhouette_type = a_line|fit_and_flare|sheath|bodycon|shift|wrap|mermaid|cocoon|peplum|empire|column|tent|princess_seam|dropped_waist|tiered|asymmetric

TO

silhouette_type = a_line|fit_and_flare|bodycon|shift|mermaid|cocoon|column|tent|asymmetric|null

#### Why These Values Were Removed

| Removed | Category | Reason |
|---------|----------|--------|
| `empire` | Waist position | Already covered by `waist_position = empire\|natural\|drop\|low\|undefined` |
| `dropped_waist` | Waist position | Already covered by `waist_position` (maps to `drop` or `low`) |
| `wrap` | Closure/construction | Describes how garment closes, not its shape. A wrap dress can be a_line, fit_and_flare, or sheath underneath |
| `peplum` | Design detail | A flared ruffle at waist - not an overall silhouette. The underlying shape could be sheath, bodycon, etc. |
| `princess_seam` | Construction technique | A seaming method for shaping, not a silhouette shape |
| `tiered` | Construction detail | Horizontal fabric layers - not an overall shape. A tiered dress could be a_line or column underneath |
| `sheath` | Duplicate | Too similar to `bodycon` - both describe fitted, body-following silhouettes. Models frequently confuse them. Merged into `bodycon` |

**Principle:** Silhouette should describe the **overall shape outline** only, not waist position, closure type, or construction details.

#### DISCUSS
1. Fit n Flare and A-line are coming the same. Please check downline if the scoring is too different.

---

### waist_position
| Model | Accuracy |
|-------|----------|
| Lite | 46.0 |
| Tiered | 64.0 |
| Flash | 48.0 |

**Remarks:**
#### Image-wise Comparison (all images)

| Image | Garment | GT | Lite | Tiered | Flash |
|-------|---------|-----|------|--------|-------|
| image_01 | top | undefined | - | natural | - |
| image_02 | top | undefined | ✓ | ✓ | - |
| image_03 | sweater | undefined | - | ✓ | - |
| image_04 | top | natural | ✓ | ✓ | - |
| image_05 | dress | natural | - | undefined | ✓ |
| image_06 | dress | undefined | ✓ | ✓ | empire |
| image_07 | top | natural | - | undefined | - |
| image_08 | top | undefined | - | ✓ | ✓ |
| image_09 | top | natural | - | ✓ | undefined |
| image_10 | top | undefined | - | ✓ | - |
| image_11 | dress | natural | ✓ | undefined | undefined |
| image_12 | dress | natural | ✓ | elasticized | ✓ |
| image_15 | dress | natural | elasticized | elasticized | elasticized |
| image_17 | pants | natural | low | ✓ | - |
| image_19 | pants | natural | elasticized | elasticized | elasticized |
| image_20 | pants | natural | - | elasticized | elasticized |
| image_22 | pants | natural | high | ✓ | ✓ |
| image_23 | pants | natural | elasticized | elasticized | elasticized |
| image_24 | pants | natural | elasticized | elasticized | elasticized |
| image_25 | dress | natural | elasticized | elasticized | elasticized |
| image_26 | dress | natural | ✓ | undefined | ✓ |
| image_28 | dress | natural | undefined | ✓ | undefined |
| image_31 | top | natural | - | undefined | empire |
| image_36 | dress | natural | ✓ | undefined | undefined |
| image_40 | dress | natural | undefined | undefined | undefined |
| image_41 | blouse | natural | - | ✓ | - |
| image_44 | dress | natural | undefined | ✓ | ✓ |
| image_46 | sweater | drop | elasticized | elasticized | - |
| image_48 | dress | natural | ✓ | undefined | ✓ |
| image_49 | top | undefined | - | - | - |
| image_50 | blouse | natural | ✓ | ✓ | - |

waist_position = empire|natural|drop|low|undefined|elasticized

TO

waist_position = empire|natural|drop|low|undefined

#### Why `elasticized` Was Removed

| Removed | Category | Reason |
|---------|----------|--------|
| `elasticized` | Construction detail | Describes how the waistband is made (elastic vs sewn), not where it sits on the body. An elasticized waistband can be at empire, natural, or low position. |

**Principle:** waist_position should describe **where on the torso** the waist sits, not how it's constructed.

#### Key Observations

1. **`elasticized` not in enum** - Models return `elasticized` (especially for pants) but this value isn't in the current enum `empire|natural|drop|low|undefined`
2. **Pants get `elasticized`** - For images 15, 19, 20, 23, 24, 25, all models say `elasticized` when GT says `natural`
3. **Lite returns many nulls** - 17 images have no waist_position from Lite
4. **Flash returns many nulls** - 13 images have no waist_position from Flash
5. **`natural` vs `undefined` confusion** - Models struggle to distinguish when waist is defined vs not
6. **image_46 GT is `drop`** - Only image with `drop`, all models say `elasticized`

#### Recommendations
- Do NOT add `elasticized` - models returning it are conflating construction with position
- Final enum: `empire|natural|drop|low|null`

#### DISCUSS — RESOLVED

**Manager clarification:** waist_position = where the garment is **DESIGNED** to sit

| Has... | Then waist_position = |
|--------|----------------------|
| Seam or elastic at waist | Position of that seam (empire, natural, drop) |
| Intentional narrowing by cut (like a sheath) | The narrowing point |
| Neither | `undefined` |

**Resolution:**
- A bodycon dress with no seam and no intentional narrowing → `undefined`
- The visual waist you see is the body underneath, not the garment's design
- **Models were CORRECT** when they said `undefined` for stretchy dresses without construction
- **GT needs to be re-evaluated** — many `natural` values should be `undefined`

**Key insight:** "I can see the waist" ≠ "the garment positions the waist"

#### Applicability by Garment Type

| Garment Type | waist_position | rise | Reason |
|--------------|----------------|------|--------|
| Dresses | ✓ `empire\|natural\|drop\|low` | ✗ null | Dresses have waist seams at different positions |
| Pants | ✗ null | ✓ `high\|mid\|low` | `rise` already covers waist position for pants |
| Tops | ✗ null | ✗ null | Tops don't have a waist - they have a hemline |

---

### waist_definition
| Model | Accuracy |
|-------|----------|
| Lite | 42.0 |
| Tiered | 68.0 |
| Flash | 62.0 |

**Remarks:**

#### Image-wise Comparison (all images)

| Image | Garment | GT | Lite | Tiered | Flash |
|-------|---------|-----|------|--------|-------|
| image_01 | top | undefined | - | defined | - |
| image_02 | top | undefined | ✓ | defined | - |
| image_03 | sweater | undefined | - | ✓ | - |
| image_04 | top | defined | ✓ | ✓ | - |
| image_05 | dress | defined | undefined | undefined | ✓ |
| image_06 | dress | undefined | ✓ | ✓ | defined |
| image_07 | top | defined | - | ✓ | ✓ |
| image_08 | top | undefined | - | ✓ | ✓ |
| image_09 | top | defined | - | ✓ | undefined |
| image_10 | top | undefined | - | ✓ | - |
| image_11 | dress | defined | ✓ | semi_defined | undefined |
| image_12 | dress | defined | semi_defined | ✓ | ✓ |
| image_13 | dress | defined | semi_defined | ✓ | ✓ |
| image_14 | dress | defined | ✓ | ✓ | ✓ |
| image_15 | dress | defined | semi_defined | ✓ | ✓ |
| image_16 | dress | undefined | ✓ | ✓ | ✓ |
| image_17 | pants | defined | - | ✓ | ✓ |
| image_18 | pants | defined | - | ✓ | ✓ |
| image_19 | pants | defined | undefined | undefined | ✓ |
| image_20 | pants | defined | - | ✓ | ✓ |
| image_21 | pants | defined | - | ✓ | - |
| image_22 | pants | defined | ✓ | ✓ | ✓ |
| image_23 | pants | defined | undefined | undefined | ✓ |
| image_24 | pants | defined | - | undefined | ✓ |
| image_25 | dress | defined | semi_defined | ✓ | ✓ |
| image_26 | dress | defined | ✓ | ✓ | ✓ |
| image_27 | dress | defined | ✓ | ✓ | ✓ |
| image_28 | dress | defined | undefined | ✓ | undefined |
| image_29 | dress | defined | ✓ | ✓ | ✓ |
| image_30 | dress | defined | ✓ | ✓ | ✓ |
| image_31 | top | semi_defined | - | defined | defined |
| image_32 | blouse | defined | semi_defined | semi_defined | ✓ |
| image_33 | dress | defined | ✓ | semi_defined | ✓ |
| image_34 | dress | defined | ✓ | ✓ | ✓ |
| image_35 | dress | undefined | ✓ | ✓ | ✓ |
| image_36 | dress | semi_defined | undefined | ✓ | undefined |
| image_37 | dress | defined | ✓ | semi_defined | ✓ |
| image_38 | dress | defined | ✓ | ✓ | ✓ |
| image_39 | dress | defined | ✓ | ✓ | ✓ |
| image_40 | dress | semi_defined | undefined | undefined | undefined |
| image_41 | blouse | semi_defined | - | defined | - |
| image_42 | top | undefined | - | ✓ | - |
| image_43 | dress | defined | ✓ | ✓ | ✓ |
| image_44 | dress | defined | ✓ | ✓ | ✓ |
| image_45 | top | semi_defined | defined | ✓ | defined |
| image_46 | sweater | semi_defined | ✓ | ✓ | - |
| image_47 | dress | defined | ✓ | ✓ | ✓ |
| image_48 | dress | defined | semi_defined | undefined | ✓ |
| image_49 | top | undefined | - | - | - |
| image_50 | blouse | semi_defined | undefined | defined | - |

#### Key Observations

1. **Lite returns many nulls** - 21 images have no waist_definition from Lite
2. **Flash returns many nulls** - 14 images have no waist_definition from Flash
3. **`semi_defined` confusion** - Models struggle with semi_defined:
   - GT=semi_defined: Models often return `defined` or `undefined` instead
   - GT=defined: Lite often returns `semi_defined`
4. **Tops/sweaters mostly null from Lite** - Most tops have no waist_definition from Lite
5. **Tiered overrides to `defined`** - For undefined GT, Tiered sometimes says `defined` (image_01, 02, 06)
6. **image_40 (dress, semi_defined)** - All 3 models say `undefined`

#### Applicability by Garment Type

| Garment Type | waist_definition | Reason |
|--------------|------------------|--------|
| Dresses | ✓ `defined\|semi_defined\|undefined` | Dresses can have varying degrees of waist shaping |
| Pants | ✗ null | Pants have waistbands (construction), not waist definition |
| Tops | ✗ null | Tops have hemlines, not waist definition |

#### DISCUSS — RESOLVED

**Manager clarification:** waist_definition = what the **GARMENT** does, not what the body shows through it

| Value | Meaning | Examples |
|-------|---------|----------|
| `defined` | Garment **engineers** waist shape | Darts, corset boning, princess seams, peplum, cinched elastic |
| `semi_defined` | Garment **gently follows** waist | Wrap tie, soft gathering, light shirring |
| `undefined` | Garment does **nothing** at waist | Body creates the shape, not the dress |

**The test:** Take the garment off the body and lay it flat. Would you still see waist shaping?
- Yes → `defined` or `semi_defined`
- No → `undefined`

**Resolution:**
- A tight stretchy bodycon dress with no seams/darts → `undefined`
- You see the waist because the fabric is clingy — that's the body doing the work
- **Models were often CORRECT** when they said `undefined` for bodycon/stretchy dresses
- **GT needs to be re-evaluated** — many `defined` values should be `undefined`

**Key insight:** "I can see the waist" ≠ "the garment defines the waist"
- Visual waist effect → captured by `fit_category` (fitted/tight)
- Construction/engineering → captured by `waist_definition`

**Potential redundancy:** waist_definition can likely be inferred from `silhouette_type` + `fit_category`:

| silhouette_type | fit_category | → waist_definition |
|-----------------|--------------|-------------------|
| fit_and_flare | fitted/semi_fitted | → `defined` |
| bodycon | tight/fitted | → `defined` |
| shift | relaxed | → `undefined` |
| column | relaxed/loose | → `undefined` |
| a_line | varies | → varies |

**Consider removing** waist_definition as an extracted attribute and deriving it downstream from silhouette + fit.

---

### color_primary
| Model | Accuracy |
|-------|----------|
| Lite | 56.0 |
| Tiered | 58.0 |
| Flash | 66.0 |

**Remarks:**

#### Image-wise Comparison (mismatches only)

| Image | GT | Lite | Tiered | Flash | Issue |
|-------|-----|------|--------|-------|-------|
| image_03 | burgundy | red | red | red | shade → base |
| image_04 | cream | beige | beige | beige | shade → base |
| image_06 | light blue | blue | blue | blue | shade → base |
| image_10 | navy | blue | blue | ✓ | Flash gets shade |
| image_11 | navy | blue | blue | ✓ | Flash gets shade |
| image_14 | mint green | green | green | green | shade → base |
| image_16 | navy | blue | blue | ✓ | Flash gets shade |
| image_17 | light blue | blue | blue | blue | shade → base |
| image_18 | dark blue | blue | blue | blue | shade → base |
| image_21 | dark blue | blue | blue | blue | shade → base |
| image_22 | medium blue | blue | blue | blue | shade → base |
| image_24 | teal | blue | blue | blue | different hue → base |
| image_26 | olive | green | green | ✓ | Flash gets shade |
| image_30 | navy | white | white | blue | floral pattern confusion |
| image_31 | burgundy | red | red | ✓ | Flash gets shade |
| image_34 | charcoal | black | black | black | shade → base |
| image_35 | cream | white | white | beige | shade variations |
| image_37 | burgundy | red | ✓ | red | Tiered gets shade |
| image_43 | plum | maroon | maroon | burgundy | all wrong shades |
| image_45 | oatmeal | beige | beige | beige | shade → base |
| image_46 | forest green | green | green | green | shade → base |
| image_47 | mustard yellow | yellow | yellow | yellow | shade → base |

#### Key Observations

1. **GT uses descriptive shades** - navy, burgundy, olive, cream, charcoal, teal, etc.
2. **Models return base colors** - blue, red, green, beige, black
3. **Flash sometimes gets shades right** - navy (10,11,16), olive (26), burgundy (31)
4. **Pattern confusion** - image_30 (navy with white flowers) → models say "white"
5. **Inconsistent GT naming** - some dark blues are "navy", others are "dark blue"

#### Current Enum Values (from image_wise_comparison)
GT uses: black, burgundy, cream, red, light blue, navy, mint green, white, beige, teal, olive, charcoal, pink, plum, oatmeal, forest green, mustard yellow, yellow, dark blue, medium blue

#### DISCUSS

**The fundamental question:** Should models return base colors or descriptive shades?

| Approach | Pros | Cons |
|----------|------|------|
| **Base colors only** | Simpler enum, higher accuracy, more consistent | Loses style information (burgundy vs red matters for styling) |
| **Descriptive shades** | Better for styling recommendations | Harder for models, inconsistent labeling, lower accuracy |

**Recommendation options:**

1. **Keep base colors** - Update GT to use base colors only (black, white, red, blue, green, yellow, beige, pink, etc.)
2. **Keep shades** - Accept lower accuracy but maintain style value
3. **Hybrid approach** - Use separate attributes:
   - `color_primary` = base color (red, blue, green, etc.)
   - `color_modifier` = shade modifier (dark, light, muted, bright, etc.)

---

### neckline_depth
| Model | Accuracy |
|-------|----------|
| Lite | 28.6 |
| Tiered | 76.2 |
| Flash | 78.6 |

**Remarks:**

#### Image-wise Comparison (garments with necklines)

| Image | Garment | GT | Lite | Tiered | Flash |
|-------|---------|-----|------|--------|-------|
| image_01 | top | shallow | - | ✓ | ✓ |
| image_02 | top | shallow | - | ✓ | ✓ |
| image_03 | sweater | medium | - | shallow | ✓ |
| image_04 | top | medium | ✓ | shallow | ✓ |
| image_05 | dress | shallow | - | ✓ | ✓ |
| image_06 | dress | medium | ✓ | ✓ | deep |
| image_07 | top | shallow | - | - | - |
| image_08 | top | medium | - | ✓ | deep |
| image_09 | top | deep | shallow | medium | ✓ |
| image_10 | top | medium | shallow | ✓ | ✓ |
| image_11 | dress | medium | ✓ | ✓ | ✓ |
| image_12 | dress | medium | - | deep | deep |
| image_13 | dress | medium | shallow | deep | deep |
| image_14 | dress | medium | - | ✓ | ✓ |
| image_15 | dress | deep | ✓ | medium | ✓ |
| image_16 | dress | medium | ✓ | ✓ | ✓ |
| image_29 | dress | medium | - | ✓ | shallow |
| image_30 | dress | deep | ✓ | ✓ | ✓ |
| image_33 | dress | medium | deep | ✓ | ✓ |
| image_34 | dress | shallow | - | ✓ | ✓ |
| image_37 | dress | deep | ✓ | ✓ | ✓ |
| image_38 | dress | deep | ✓ | ✓ | ✓ |
| image_43 | dress | deep | ✓ | medium | medium |
| image_44 | dress | plunging | deep | ✓ | ✓ |

#### Key Observations

1. **Lite returns many nulls** - 12 images have no neckline_depth from Lite (28.6% accuracy)
2. **Tiered/Flash perform similarly** - Both around 76-78%
3. **Common confusions**:
   - `shallow` ↔ `medium` (image_03, 04, 09, 10)
   - `medium` ↔ `deep` (image_08, 12, 13, 43)
   - `deep` ↔ `plunging` (image_44)
4. **Adjacent category confusion** - Similar to hemline_position, models confuse neighboring depth levels

#### Enum Consideration

neckline_depth = shallow|medium|deep|plunging

Consider merging to: `shallow|medium|deep` (where deep includes plunging)

---

### hemline_position
| Model | Accuracy |
|-------|----------|
| Lite | 61.5 |
| Tiered | 50.0 |
| Flash | 73.1 |

**Remarks:**

#### Image-wise Comparison (dresses only - hemline_position applies to dresses)

| Image | GT | Lite | Tiered | Flash |
|-------|-----|------|--------|-------|
| image_05 | above_knee | ✓ | mini | ✓ |
| image_06 | maxi | ✓ | ✓ | ankle |
| image_11 | mini | ✓ | ✓ | ✓ |
| image_12 | mini | ✓ | above_knee | ✓ |
| image_13 | above_knee | ✓ | - | mini |
| image_14 | below_knee | midi | midi | at_knee |
| image_15 | at_knee | ✓ | midi | ✓ |
| image_16 | maxi | ✓ | ✓ | ✓ |
| image_25 | above_knee | high_low | mini | high_low |
| image_26 | above_knee | mini | mini | ✓ |
| image_27 | mini | ✓ | ✓ | ✓ |
| image_28 | mini | ✓ | ✓ | ✓ |
| image_29 | at_knee | ✓ | ✓ | below_knee |
| image_30 | above_knee | mini | at_knee | ✓ |
| image_33 | above_knee | at_knee | at_knee | ✓ |
| image_34 | at_knee | below_knee | ✓ | below_knee |
| image_35 | above_knee | at_knee | ✓ | ✓ |
| image_36 | mini | ✓ | ✓ | ✓ |
| image_37 | above_knee | ✓ | - | ✓ |
| image_38 | above_knee | mini | mini | mini |
| image_39 | mini | ✓ | above_knee | ✓ |
| image_40 | mini | ✓ | ✓ | ✓ |
| image_43 | at_knee | midi | ✓ | ✓ |
| image_44 | mini | ✓ | ✓ | ✓ |
| image_47 | high_low | ✓ | ✓ | ✓ |
| image_48 | midi | at_knee | - | ✓ |

#### Key Observations

1. **Tiered returns some nulls** - 3 images have no hemline_position from Tiered (13, 37, 48)
2. **Common confusions**:
   - `mini` ↔ `above_knee` (image_05, 12, 25, 26, 30, 38, 39)
   - `above_knee` ↔ `at_knee` (image_33, 35)
   - `at_knee` ↔ `below_knee` (image_29, 34)
   - `at_knee` ↔ `midi` (image_14, 15, 43, 48)
   - `maxi` ↔ `ankle` (image_06)
3. **image_14 (below_knee)** - All models wrong: Lite/Tiered say midi, Flash says at_knee
4. **image_25 (above_knee)** - Lite/Flash say high_low (different attribute entirely)
5. **image_38 (above_knee)** - All models say mini

#### Enum Confusion

Models confuse adjacent hemline positions. The current enum has too many similar categories:

| Position | Confusion With |
|----------|---------------|
| mini | above_knee |
| above_knee | at_knee, mini |
| at_knee | below_knee, midi |
| below_knee | at_knee, midi |
| midi | at_knee, below_knee |
| maxi | ankle |

#### Proposed Simplified Enum

hemline_position = mini|above_knee|at_knee|below_knee|midi|tea_length|ankle|maxi|floor_length|high_low

TO

hemline_position = mini|above_knee|at_knee|below_knee|midi|maxi|null

(Remove tea_length, floor_length, ankle - merge into adjacent categories)

#### Why `high_low` Was Removed

| Removed | Category | Reason |
|---------|----------|--------|
| `high_low` | Hemline style/shape | Describes the hemline's **shape** (asymmetric front-to-back), not its **position** on the body. A high-low dress can be mini in front and maxi in back - these are the actual positions. |

**Principle:** hemline_position should describe **where on the body** the hemline falls, not its shape or style.

**Alternative:** Create a separate attribute `hemline_style = straight|asymmetric|high_low|handkerchief|tiered` if style distinctions matter for recommendations.

#### GT Accuracy Review

| Image | Current GT | Model Consensus | Recommended GT | Reasoning |
|-------|-----------|-----------------|----------------|-----------|
| image_05 | above_knee | Tiered=mini, others=above_knee | **mini** | Hem falls at mid-thigh, clearly mini territory. GT appears incorrect. |
| image_38 | above_knee | All=mini | **mini** | All 3 models agree on mini. GT needs review. |

**Action:** Re-evaluate GT for images where model consensus differs from ground truth.




---

### fit_category
| Model | Accuracy |
|-------|----------|
| Lite | 56.0 |
| Tiered | 56.0 |
| Flash | 74.0 |

**Remarks:**

#### Image-wise Comparison (all images)

| Image | Garment | GT | Lite | Tiered | Flash |
|-------|---------|-----|------|--------|-------|
| image_01 | top | tight | fitted | fitted | fitted |
| image_02 | top | fitted | ✓ | ✓ | tight |
| image_03 | sweater | relaxed | loose | ✓ | ✓ |
| image_04 | top | fitted | tight | ✓ | ✓ |
| image_05 | dress | semi_fitted | fit_and_flare | undefined | fitted |
| image_06 | dress | loose | ✓ | relaxed | relaxed |
| image_07 | top | tight | - | fitted | fitted |
| image_08 | top | oversized | ✓ | ✓ | ✓ |
| image_09 | top | tight | ✓ | ✓ | fitted |
| image_10 | top | semi_fitted | relaxed | loose | ✓ |
| image_11 | dress | tight | ✓ | ✓ | ✓ |
| image_12 | dress | fitted | ✓ | ✓ | ✓ |
| image_13 | dress | semi_fitted | fitted | - | ✓ |
| image_14 | dress | fitted | ✓ | semi_fitted | ✓ |
| image_15 | dress | semi_fitted | ✓ | ✓ | ✓ |
| image_16 | dress | relaxed | ✓ | - | ✓ |
| image_17 | pants | fitted | tight | semi_fitted | ✓ |
| image_18 | pants | fitted | - | semi_fitted | semi_fitted |
| image_19 | pants | loose | ✓ | ✓ | ✓ |
| image_20 | pants | loose | - | ✓ | ✓ |
| image_21 | pants | fitted | tight | ✓ | ✓ |
| image_22 | pants | tight | ✓ | ✓ | ✓ |
| image_23 | pants | loose | ✓ | relaxed | ✓ |
| image_24 | pants | loose | ✓ | ✓ | relaxed |
| image_25 | dress | semi_fitted | relaxed | ✓ | ✓ |
| image_26 | dress | fitted | ✓ | semi_fitted | ✓ |
| image_27 | dress | tight | ✓ | ✓ | ✓ |
| image_28 | dress | tight | ✓ | ✓ | ✓ |
| image_29 | dress | fitted | semi_fitted | ✓ | ✓ |
| image_30 | dress | semi_fitted | fitted | ✓ | ✓ |
| image_31 | top | semi_fitted | fitted | ✓ | ✓ |
| image_32 | blouse | semi_fitted | ✓ | ✓ | fitted |
| image_33 | dress | fitted | ✓ | ✓ | ✓ |
| image_34 | dress | fitted | ✓ | ✓ | ✓ |
| image_35 | dress | relaxed | ✓ | semi_fitted | ✓ |
| image_36 | dress | semi_fitted | ✓ | fitted | ✓ |
| image_37 | dress | semi_fitted | ✓ | - | ✓ |
| image_38 | dress | semi_fitted | fitted | - | ✓ |
| image_39 | dress | fitted | ✓ | ✓ | ✓ |
| image_40 | dress | semi_fitted | fitted | fitted | fitted |
| image_41 | blouse | semi_fitted | - | fitted | fitted |
| image_42 | top | loose | ✓ | relaxed | ✓ |
| image_43 | dress | fitted | semi_fitted | ✓ | ✓ |
| image_44 | dress | fitted | ✓ | ✓ | ✓ |
| image_45 | top | relaxed | semi_fitted | ✓ | ✓ |
| image_46 | sweater | loose | relaxed | relaxed | relaxed |
| image_47 | dress | semi_fitted | ✓ | ✓ | ✓ |
| image_48 | dress | semi_fitted | ✓ | - | ✓ |
| image_49 | top | semi_fitted | relaxed | - | relaxed |
| image_50 | blouse | semi_fitted | ✓ | ✓ | ✓ |

fit_category = tight|fitted|semi_fitted|relaxed|loose|oversized
TO
fit_category = fitted|relaxed|oversized


#### Key Observations

1. **Tiered returns many nulls** - 8 images have no fit_category from Tiered (05, 13, 16, 37, 38, 48, 49)
2. **Lite returns some nulls** - 5 images have no fit_category from Lite (07, 18, 20, 41)
3. **Flash has highest accuracy (74%)** - Most consistent across garment types
4. **Common confusions**:
   - `tight` ↔ `fitted` (image_01, 02, 04, 07, 09, 17, 21)
   - `semi_fitted` ↔ `fitted` (image_13, 14, 26, 29-32, 36, 38, 40, 41, 43)
   - `loose` ↔ `relaxed` (image_03, 06, 23, 24, 42, 46)
5. **image_05 (dress)** - Lite returns `fit_and_flare` (silhouette value, not fit!)
6. **image_46 (sweater)** - GT=loose, all models say relaxed

#### DISCUSS

1. `tight` vs `fitted` - Are these distinct enough to keep both? Models struggle to differentiate.
2. `loose` vs `relaxed` - Similar issue. Consider merging.
3. Lite returning `fit_and_flare` suggests prompt confusion with silhouette_type.

#### Accuracy if Categories Merged

**Proposed grouping:**
- `fitted` = tight + fitted
- `relaxed` = semi_fitted + loose + relaxed
- `oversized` = oversized (unchanged)

| Model | Original | With Merged Categories | Improvement |
|-------|----------|------------------------|-------------|
| Lite | 56% | 80% | +24% |
| Tiered | 56% | 74% | +18% |
| Flash | 74% | 90% | +16% |

**What gets fixed:**
- tight ↔ fitted confusions → all correct now
- loose ↔ relaxed confusions → all correct now
- semi_fitted ↔ loose/relaxed → all correct now

**What stays wrong:**
- Null returns (Lite: 5, Tiered: 8)
- semi_fitted ↔ fitted boundary cases (13, 14, 17, 18, 26, 29-32, 36, 38, 40, 41)
- Invalid values (image_05 Lite returns `fit_and_flare`)

**Recommendation:** Merge to 3-category enum: `fitted | relaxed | oversized`

---

### rise
| Model | Accuracy |
|-------|----------|
| Lite | 50.0 |
| Tiered | 50.0 |
| Flash | 87.5 |

**Remarks:**

#### Image-wise Comparison (pants only - rise applies to pants)

| Image | GT | Lite | Tiered | Flash |
|-------|-----|------|--------|-------|
| image_17 | mid | low | ✓ | ✓ |
| image_18 | mid | high | - | ✓ |
| image_19 | high | ✓ | - | ✓ |
| image_20 | high | ✓ | ✓ | ✓ |
| image_21 | mid | high | high | high |
| image_22 | high | ✓ | ✓ | ✓ |
| image_23 | high | ✓ | ✓ | ✓ |
| image_24 | high | mid | mid | ✓ |

#### Key Observations

1. **Flash dominates (87.5%)** - Only 1 error (image_21: GT=mid, Flash=high)
2. **Tiered returns nulls** - 2 images have no rise from Tiered (18, 19)
3. **Lite struggles with mid↔high** - Confuses mid and high rise frequently
4. **image_21 problematic** - All 3 models say `high`, GT says `mid`. GT may need review.
5. **image_24** - Lite/Tiered say `mid`, Flash gets `high` correct

#### Common Confusions

| Confusion | Images | Notes |
|-----------|--------|-------|
| mid → high | 18, 21 | Lite/Tiered overestimate rise |
| mid → low | 17 | Lite underestimates rise |
| high → mid | 24 | Lite/Tiered underestimate rise |

#### GT Accuracy Review

| Image | Current GT | Model Consensus | Recommended GT | Reasoning |
|-------|-----------|-----------------|----------------|-----------|
| image_21 | mid | All=high | **high** | All 3 models agree on high. GT needs review. |

#### Applicability

| Garment Type | rise | Reason |
|--------------|------|--------|
| Pants | ✓ `high\|mid\|low` | Rise describes where pants sit on hips/waist |
| Dresses | ✗ null | Dresses have `waist_position` instead |
| Tops | ✗ null | Not applicable |

#### Visual Difficulty Assessment

| Image | Waistband Visible? | Rise Detectable? | Issue Type |
|-------|-------------------|------------------|------------|
| image_17 | ✓ Clear | Easy | Lite model error (said `low` for `mid`) |
| image_21 | ✓ Clear | Easy | GT likely wrong (all models say `high`) |

**Conclusion:** Rise detection is **NOT visually difficult**. The waistband position is clearly visible in all pants images. Errors are due to:
1. **Model capability gaps** (Lite struggles with mid↔high↔low distinctions)
2. **GT labeling errors** (image_21 appears to be mislabeled)

#### ACTION: Move to Flash Only

**Current:** rise is extracted via Flash-Lite tiered approach
**Recommendation:** Move `rise` to **Flash only**

| Reason | Evidence |
|--------|----------|
| Flash accuracy (87.5%) far exceeds Lite (50%) | 37.5 percentage point gap |
| Lite makes systematic errors | Confuses mid↔high↔low frequently |
| Tiered returns nulls | 2 of 8 images have no value |
| Task is not visually ambiguous | Waistband position clearly visible |
| Flash-only would achieve ~100% | Only "error" (image_21) is likely GT mistake |

**Implementation:** Remove `rise` from Flash-Lite prompt, add to Flash-only extraction.

---

### fabric_sheen
| Model | Accuracy |
|-------|----------|
| Lite | 48.0 |
| Tiered | 68.0 |
| Flash | 72.0 |

**Remarks:**

#### Image-wise Comparison (all images)

| Image | Garment | GT | Lite | Tiered | Flash |
|-------|---------|-----|------|--------|-------|
| image_01 | top | matte | ✓ | ✓ | ✓ |
| image_02 | top | subtle_sheen | matte | matte | matte |
| image_03 | sweater | matte | ✓ | ✓ | ✓ |
| image_04 | top | matte | ✓ | ✓ | ✓ |
| image_05 | dress | matte | - | ✓ | ✓ |
| image_06 | dress | matte | ✓ | ✓ | ✓ |
| image_07 | top | subtle_sheen | matte | matte | matte |
| image_08 | top | matte | ✓ | ✓ | ✓ |
| image_09 | top | subtle_sheen | matte | matte | matte |
| image_10 | top | subtle_sheen | - | matte | matte |
| image_11 | dress | subtle_sheen | matte | - | matte |
| image_12 | dress | subtle_sheen | matte | matte | matte |
| image_13 | dress | subtle_sheen | matte | matte | matte |
| image_14 | dress | subtle_sheen | matte | matte | matte |
| image_15 | dress | matte | ✓ | ✓ | ✓ |
| image_16 | dress | matte | ✓ | ✓ | ✓ |
| image_17 | pants | matte | - | ✓ | ✓ |
| image_18 | pants | matte | - | ✓ | ✓ |
| image_19 | pants | matte | ✓ | ✓ | ✓ |
| image_20 | pants | subtle_sheen | matte | ✓ | matte |
| image_21 | pants | matte | ✓ | ✓ | ✓ |
| image_22 | pants | matte | ✓ | ✓ | ✓ |
| image_23 | pants | matte | ✓ | ✓ | ✓ |
| image_24 | pants | matte | - | ✓ | ✓ |
| image_25 | dress | matte | ✓ | ✓ | ✓ |
| image_26 | dress | matte | ✓ | ✓ | ✓ |
| image_27 | dress | matte | ✓ | ✓ | ✓ |
| image_28 | dress | subtle_sheen | matte | matte | matte |
| image_29 | dress | matte | ✓ | ✓ | ✓ |
| image_30 | dress | matte | - | ✓ | ✓ |
| image_31 | top | matte | - | ✓ | ✓ |
| image_32 | blouse | subtle_sheen | matte | matte | matte |
| image_33 | dress | subtle_sheen | matte | matte | matte |
| image_34 | dress | matte | ✓ | ✓ | ✓ |
| image_35 | dress | matte | ✓ | ✓ | ✓ |
| image_36 | dress | matte | ✓ | ✓ | ✓ |
| image_37 | dress | matte | ✓ | ✓ | ✓ |
| image_38 | dress | matte | - | ✓ | ✓ |
| image_39 | dress | matte | ✓ | ✓ | ✓ |
| image_40 | dress | subtle_sheen | matte | matte | ✓ |
| image_41 | blouse | subtle_sheen | matte | matte | ✓ |
| image_42 | top | matte | ✓ | ✓ | ✓ |
| image_43 | dress | subtle_sheen | matte | matte | ✓ |
| image_44 | dress | matte | ✓ | ✓ | ✓ |
| image_45 | top | matte | ✓ | ✓ | ✓ |
| image_46 | sweater | matte | - | ✓ | ✓ |
| image_47 | dress | matte | - | ✓ | ✓ |
| image_48 | dress | subtle_sheen | - | matte | matte |
| image_49 | top | matte | ✓ | ✓ | ✓ |
| image_50 | blouse | subtle_sheen | matte | matte | matte |

#### Key Observations

1. **Models default to `matte`** - All 3 models frequently return `matte` even when GT says `subtle_sheen`
2. **subtle_sheen never detected by Lite/Tiered** - These models almost always say `matte` for subtle_sheen items
3. **Flash catches some subtle_sheen** - Flash correctly identifies subtle_sheen in images 40, 41, 43
4. **Lite returns many nulls** - 12 images have no fabric_sheen from Lite
5. **GT has 14 subtle_sheen items** - All are misclassified as matte by most models

#### DISCUSS

**The fundamental issue:** Models cannot reliably distinguish `subtle_sheen` from `matte` in images.

**Options:**
1. **Merge subtle_sheen → matte** - Accept that subtle sheen is too difficult to detect visually
2. **Keep subtle_sheen** - Accept lower accuracy, useful for styling if correct
3. **Rename enum** - Use `matte|shiny|very_shiny` with clearer visual distinction

**Current enum:** `matte|subtle_sheen|shiny|very_shiny` (but only matte and subtle_sheen appear in GT)

---

### leg_shape
| Model | Accuracy |
|-------|----------|
| Lite | 75.0 |
| Tiered | 62.5 |
| Flash | 62.5 |

**Remarks:**

#### Image-wise Comparison (pants only - leg_shape applies to pants)

| Image | GT | Lite | Tiered | Flash |
|-------|-----|------|--------|-------|
| image_17 | bootcut | flare | flare | flare |
| image_18 | straight | ✓ | bootcut | ✓ |
| image_19 | palazzo | wide_leg | wide_leg | ✓ |
| image_20 | wide_leg | ✓ | ✓ | palazzo |
| image_21 | skinny | ✓ | ✓ | ✓ |
| image_22 | skinny | ✓ | ✓ | ✓ |
| image_23 | palazzo | ✓ | ✓ | wide_leg |
| image_24 | wide_leg | ✓ | ✓ | ✓ |

#### Key Observations

1. **Lite has highest accuracy (75%)** - Best performer for leg_shape
2. **image_17 (bootcut)** - All 3 models say `flare`. Bootcut and flare are very similar.
3. **palazzo ↔ wide_leg confusion** - Models struggle to distinguish these (images 19, 20, 23)
4. **skinny is well-detected** - All models correctly identify skinny (images 21, 22)

#### Common Confusions

| Confusion | Images | Notes |
|-----------|--------|-------|
| bootcut → flare | 17 | All models. Very similar shapes - bootcut is subtle flare |
| palazzo ↔ wide_leg | 19, 20, 23 | Models confuse these wide-leg variants |
| straight → bootcut | 18 | Tiered only |

#### Enum Consideration

Current: `skinny|straight|bootcut|flare|wide_leg|palazzo|tapered|jogger`

Proposed simplification:
- Merge `bootcut` → `flare` (subtle distinction)
- Merge `palazzo` → `wide_leg` (both very wide)

Simplified: `skinny|straight|flare|wide_leg|tapered|jogger`



---

### color_value
| Model | Accuracy |
|-------|----------|
| Lite | 70.0 |
| Tiered | 60.0 |
| Flash | 74.0 |

**Remarks:**

#### Image-wise Comparison (mismatches only)

| Image | Garment | GT | Lite | Tiered | Flash |
|-------|---------|-----|------|--------|-------|
| image_04 | top | light | medium_light | medium_light | very_light |
| image_05 | dress | medium | medium_dark | medium_dark | medium_dark |
| image_10 | top | dark | ✓ | ✓ | ✓ |
| image_11 | dress | very_dark | ✓ | dark | ✓ |
| image_14 | dress | light | medium_light | medium_light | very_light |
| image_17 | pants | medium_light | ✓ | ✓ | light |
| image_22 | pants | medium | ✓ | medium_dark | medium_dark |
| image_23 | pants | light | - | medium_light | ✓ |
| image_24 | pants | medium_dark | very_dark | dark | dark |
| image_38 | dress | medium_light | ✓ | medium | light |
| image_40 | dress | medium_light | - | ✓ | ✓ |
| image_46 | sweater | dark | ✓ | very_dark | ✓ |
| image_47 | dress | medium | medium_light | medium_light | light |
| image_48 | dress | very_light | ✓ | ✓ | light |

#### Key Observations

1. **Flash has highest accuracy (74%)** - Best at color value assessment
2. **Tiered struggles (60%)** - Often one step off from GT
3. **Common confusions**:
   - `light` ↔ `medium_light` ↔ `very_light` (images 04, 14, 17, 48)
   - `medium` ↔ `medium_dark` (images 05, 22)
   - `dark` ↔ `very_dark` (images 11, 24, 46)
4. **Adjacent category confusion** - Models are usually only 1 step away from GT

#### Enum Analysis

Current: `very_light|light|medium_light|medium|medium_dark|dark|very_dark`

**Issue:** 7 levels is too granular. Models typically get within ±1 level.

**Proposed simplification:**
- `light` = very_light + light + medium_light
- `medium` = medium + medium_dark
- `dark` = dark + very_dark

Simplified: `light|medium|dark`

---

### fabric_apparent_weight
| Model | Accuracy |
|-------|----------|
| Lite | 76.0 |
| Tiered | 58.0 |
| Flash | 74.0 |

**Remarks:**

#### Image-wise Comparison (mismatches only)

| Image | Garment | GT | Lite | Tiered | Flash |
|-------|---------|-----|------|--------|-------|
| image_01 | top | medium | ✓ | light | ✓ |
| image_02 | top | light | medium | very_light | ✓ |
| image_07 | top | medium | ✓ | light | ✓ |
| image_08 | top | medium | ✓ | - | ✓ |
| image_11 | dress | medium | ✓ | - | ✓ |
| image_13 | dress | light | very_light | very_light | ✓ |
| image_14 | dress | medium | light | very_light | ✓ |
| image_16 | dress | light | medium | - | ✓ |
| image_26 | dress | medium | ✓ | light | light |
| image_27 | dress | medium | ✓ | light | light |
| image_28 | dress | light | medium | ✓ | ✓ |
| image_33 | dress | medium | ✓ | - | ✓ |
| image_35 | dress | medium | ✓ | - | ✓ |
| image_43 | dress | medium | ✓ | ✓ | light |
| image_44 | dress | heavy | medium | medium | medium |
| image_45 | top | light | medium | ✓ | medium |
| image_48 | dress | very_light | ✓ | ✓ | light |

#### Key Observations

1. **Lite has highest accuracy (76%)** - Best at fabric weight assessment
2. **Tiered struggles (58%)** - Returns many nulls and often says `light` or `very_light`
3. **Common confusions**:
   - `light` ↔ `medium` (images 02, 14, 16, 26, 27, 28, 45)
   - `light` ↔ `very_light` (images 02, 13, 14)
   - `heavy` → `medium` (image 44 - all models wrong)
4. **Tiered returns nulls** - 5 images have no fabric_apparent_weight from Tiered
5. **image_44 (heavy)** - All 3 models say `medium`. Heavy fabric detection is difficult.

#### Enum Analysis

Current: `very_light|light|medium|heavy|very_heavy`

**Issue:** `heavy` and `very_heavy` are rarely in GT and rarely detected.

**Proposed simplification:**
- `light` = very_light + light
- `medium` = medium
- `heavy` = heavy + very_heavy

Simplified: `light|medium|heavy`

---

### fabric_drape
| Model | Accuracy |
|-------|----------|
| Lite | 70.0 |
| Tiered | 68.0 |
| Flash | 72.0 |

**Remarks:**

#### Image-wise Comparison (mismatches only)

| Image | Garment | GT | Lite | Tiered | Flash |
|-------|---------|-----|------|--------|-------|
| image_01 | top | structured | fluid | fluid | fluid |
| image_04 | top | structured | fluid | - | fluid |
| image_09 | top | structured | fluid | fluid | fluid |
| image_11 | dress | structured | ✓ | - | fluid |
| image_17 | pants | structured | - | ✓ | ✓ |
| image_18 | pants | structured | - | ✓ | ✓ |
| image_20 | pants | fluid | ✓ | ✓ | very_drapey |
| image_22 | pants | structured | ✓ | - | ✓ |
| image_23 | pants | fluid | very_drapey | ✓ | ✓ |
| image_29 | dress | structured | ✓ | ✓ | fluid |
| image_35 | dress | structured | ✓ | - | ✓ |
| image_44 | dress | stiff | structured | structured | structured |
| image_49 | top | fluid | ✓ | - | ✓ |
| image_50 | blouse | structured | fluid | fluid | ✓ |

#### Key Observations

1. **All models similar accuracy (~70%)** - No clear winner
2. **Models default to `fluid`** - When uncertain, models tend to say `fluid`
3. **`structured` often misclassified** - Models frequently say `fluid` for structured items (images 01, 04, 09, 50)
4. **`stiff` never detected** - image_44 GT=stiff, all models say `structured`
5. **Tiered returns nulls** - 6 images have no fabric_drape from Tiered

#### Common Confusions

| Confusion | Images | Notes |
|-----------|--------|-------|
| structured → fluid | 01, 04, 09, 11, 29, 50 | Most common error |
| fluid → very_drapey | 20, 23 | Overestimate drape |
| stiff → structured | 44 | All models |

#### Enum Analysis

Current: `stiff|structured|fluid|very_drapey`

**Issue:** `stiff` is hard to detect; `structured` ↔ `fluid` boundary unclear.

**Proposed simplification:**
- `structured` = stiff + structured (holds shape)
- `fluid` = fluid + very_drapey (flows)

Simplified: `structured|fluid`

---

### leg_opening_width
| Model | Accuracy |
|-------|----------|
| Lite | 50.0 |
| Tiered | 75.0 |
| Flash | 87.5 |

**Remarks:**

#### Image-wise Comparison (pants only - leg_opening_width applies to pants)

| Image | GT | Lite | Tiered | Flash |
|-------|-----|------|--------|-------|
| image_17 | medium | wide | wide | wide |
| image_18 | medium | - | ✓ | ✓ |
| image_19 | very_wide | wide | ✓ | ✓ |
| image_20 | very_wide | ✓ | wide | ✓ |
| image_21 | narrow | - | ✓ | ✓ |
| image_22 | narrow | ✓ | ✓ | ✓ |
| image_23 | very_wide | ✓ | ✓ | ✓ |
| image_24 | wide | ✓ | ✓ | ✓ |

#### Key Observations

1. **Flash dominates (87.5%)** - Best performer for leg_opening_width
2. **Tiered also strong (75%)** - Second best
3. **Lite struggles (50%)** - Returns nulls and confuses `medium` with `wide`
4. **image_17 (medium)** - All models say `wide`. GT may need review.
5. **Common confusions**:
   - `medium` → `wide` (image_17)
   - `very_wide` ↔ `wide` (images 19, 20)

#### Enum Analysis

Current: `narrow|medium|wide|very_wide`

**Issue:** `very_wide` ↔ `wide` confusion frequent.

**Proposed simplification:**
- `narrow` = narrow (skinny jeans)
- `medium` = medium (straight leg)
- `wide` = wide + very_wide

Simplified: `narrow|medium|wide`

---

### sleeve_type
| Model | Accuracy |
|-------|----------|
| Lite | 69.0 |
| Tiered | 83.3 |
| Flash | 90.5 |

**Remarks:**

#### Image-wise Comparison (garments with sleeves)

| Image | Garment | GT | Lite | Tiered | Flash |
|-------|---------|-----|------|--------|-------|
| image_01 | top | full_length | ✓ | ✓ | ✓ |
| image_02 | top | sleeveless | ✓ | ✓ | ✓ |
| image_03 | sweater | full_length | ✓ | ✓ | ✓ |
| image_04 | top | full_length | ✓ | ✓ | ✓ |
| image_05 | dress | halter | sleeveless | sleeveless | sleeveless |
| image_06 | dress | halter | sleeveless | sleeveless | sleeveless |
| image_07 | top | off_shoulder | short | ✓ | ✓ |
| image_08 | top | short | ✓ | ✓ | ✓ |
| image_09 | top | short | ✓ | ✓ | ✓ |
| image_10 | top | short | ✓ | ✓ | ✓ |
| image_12 | dress | full_length | ✓ | ✓ | ✓ |
| image_13 | dress | flutter | ✓ | ✓ | ✓ |
| image_14 | dress | sleeveless | spaghetti_strap | spaghetti_strap | sleeveless |
| image_15 | dress | short | ✓ | ✓ | ✓ |
| image_16 | dress | sleeveless | ✓ | ✓ | ✓ |
| image_27 | dress | full_length | ✓ | ✓ | ✓ |
| image_28 | dress | sleeveless | ✓ | - | ✓ |
| image_29 | dress | puff | ✓ | ✓ | ✓ |
| image_30 | dress | short | flutter | flutter | ✓ |
| image_31 | top | halter | sleeveless | sleeveless | spaghetti_strap |
| image_32 | blouse | bishop | full_length | ✓ | ✓ |
| image_36 | dress | spaghetti_strap | sleeveless | ✓ | ✓ |
| image_39 | dress | bell | full_length | ✓ | ✓ |
| image_40 | dress | bell | full_length | ✓ | ✓ |
| image_41 | blouse | bishop | full_length | ✓ | ✓ |
| image_42 | top | dolman | full_length | bishop | bishop |
| image_45 | top | dolman | ✓ | ✓ | ✓ |
| image_46 | sweater | dolman | ✓ | ✓ | ✓ |
| image_49 | top | puff | ✓ | ✓ | ✓ |
| image_50 | blouse | puff | short | ✓ | ✓ |

#### Key Observations

1. **Flash dominates (90.5%)** - Best performer
2. **Tiered also strong (83.3%)** - Second best
3. **Lite struggles with specialty sleeves** - Often defaults to `full_length` or `sleeveless`
4. **halter → sleeveless confusion** - All models classify halter as sleeveless (images 05, 06, 31)
5. **bishop ↔ full_length confusion** - Lite returns `full_length` for bishop sleeves
6. **bell ↔ full_length confusion** - Lite returns `full_length` for bell sleeves

#### Common Confusions

| Confusion | Images | Notes |
|-----------|--------|-------|
| halter → sleeveless | 05, 06, 31 | All models. Halter is a neckline, not sleeve type |
| bishop → full_length | 32, 41 | Lite only |
| bell → full_length | 39, 40 | Lite only |
| dolman → bishop | 42 | Tiered/Flash |
| short → flutter | 30 | Lite/Tiered |

#### DISCUSS

**halter confusion:** `halter` is a neckline style, not a sleeve type. Halter tops/dresses are technically sleeveless. Consider:
1. Remove `halter` from sleeve_type enum
2. Ensure `halter` is in neckline_type enum instead
3. GT should be `sleeveless` for halter garments

---

### pattern_type
| Model | Accuracy |
|-------|----------|
| Lite | 84.0 |
| Tiered | 90.0 |
| Flash | 92.0 |

**Remarks:**


---

### neckline_type
| Model | Accuracy |
|-------|----------|
| Lite | 92.9 |
| Tiered | 90.5 |
| Flash | 90.5 |

**Remarks:**


---

### garment_type
| Model | Accuracy |
|-------|----------|
| Lite | 96.0 |
| Tiered | 98.0 |
| Flash | 98.0 |

**Remarks:**


---

### is_adult_clothing
| Model | Accuracy |
|-------|----------|
| Lite | 98.0 |
| Tiered | 100.0 |
| Flash | 100.0 |

**Remarks:**
