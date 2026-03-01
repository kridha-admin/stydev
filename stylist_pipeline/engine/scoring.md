# Scorer Functions - Garment & Body Attributes Reference

This document lists each scorer function and the attributes it accesses via `g.` (garment) and `b.` (body).

---

## scoreHorizontalStripes
**g:** has_horizontal_stripes, has_vertical_stripes, zone, covers_waist, stripe_width_cm, is_dark
**b:** body_shape, is_plus_size, is_petite

(has_horizontal_stripes : pattern_type==horizontal_stripes), 
(has_vertical_stripes : pattern_type==vertical_stripes), 
(zone : detectZone(category) ; full_body|lower_body|torso) | category via garment_type, 
(covers_waist : detectCovers(category, hemPosition) ) | hemPosition is via hemline_position, 
(stripe_width_cm : 0), 
(is_dark : color_lightness<0.25) | color_lightness via color_value

Notes:
stripe_width_cm is not being handled and is always 0
covers_waist : we are not doing garments for which it is false

---

## scoreDarkSlimming
**g:** color_lightness, zone, sheen_index
**b:** is_petite, is_tall, body_shape, skin_undertone, skin_darkness

(color_lightness) | color_lightness via color_value,
(zone : detectZone(category) ; full_body|lower_body|torso) | category via garment_type, 
(sheen_index : SHEEN_MAP[this.surface] ?? 0.10)

Notes:
surface is always 0.10, we are not calculating, and so is sheen_index
skin_undertone, skin_darkness is not being handled and we are using default values

---

## scoreRiseElongation
**g:** rise_cm, waistband_width_cm, waistband_stretch_pct, expansion_rate
**b:** is_petite, torso_score, is_tall, body_shape, is_plus_size, belly_zone

(rise_cm : null)
(waistband_width_cm : 3.0)
(waistband_stretch_pct : 5.0)
(expansion_rate : fit_category via FIT_EXPANSION_MAP)

Notes:
1. rise_cm not being handled, always is null
2. waistband_width_cm not being handled, always is 3.0
3. waistband_stretch_pct not being handled, always is 3.0

---

## scoreAlineBalance
**g:** expansion_rate, drape_coefficient, hem_position
**b:** body_shape, is_tall, is_petite, is_plus_size

(expansion_rate : fit_category via FIT_EXPANSION_MAP)
(drape_coefficient : drape*10.0) | drape via fabric_drape
(hem_position : via hemline_position)

---

## scoreTentConcealment
**g:** expansion_rate, is_structured
**b:** body_shape, is_plus_size, styling_goals, is_petite, is_tall

(expansion_rate : fit_category via FIT_EXPANSION_MAP)
(is_structured : via has_darts, has_seaming, or fabric_drape has ["structured", "stiff"])

---

## scoreColorBreak
**g:** has_contrasting_belt, has_tonal_belt, belt_width_cm
**b:** body_shape, is_petite, is_tall, whr, is_plus_size, belly_zone

Notes:
1. has_contrasting_belt is not being handled, always is false
2. has_tonal_belt is not being handled, always is false
3. belt_width_cm is not being handled, always is 0
4. belly_zone is not being handled, always is 0

---

## scoreBodyconMapping
**g:** expansion_rate, gsm_estimated, is_structured, zone
**b:** body_shape, is_athletic, belly_zone, is_plus_size

(expansion_rate : fit_category via FIT_EXPANSION_MAP)
(gsm_estimated : via resolveFabricGsm) | uses title, fabric_composition, care_instructions, fabric_primary, fabric_secondary, fabric_weight(both), fabric_drape(both)
(is_structured : via has_darts, has_seaming, or fabric_drape has ["structured", "stiff"])
(zone : detectZone(category) ; full_body|lower_body|torso) | category via garment_type, 

Notes:
1. is_athletic is not being handled, always is false

---

## scoreMatteZone
**g:** sheen_index, zone, cling_risk
**b:** body_shape, is_plus_size

(sheen_index : SHEEN_MAP[this.surface] ?? 0.10)
(zone : detectZone(category) ; full_body|lower_body|torso) | category via garment_type, 
(cling_risk : ) | via stretch_percentage, fabric_primary

Notes:
1. surface_friction in cling_risk is not being handled, is always 0.5
2. cling_risk doesnt handle some of it dependant vars being null


---

## scoreVneckElongation
**g:** neckline, rise_cm
**b:** body_shape, is_petite, torso_score, is_tall

neckline via neckline_type
(rise_cm : null)

Notes:
1. rise_cm not being handled, always is null

---

## scoreMonochromeColumn
**g:** is_monochrome_outfit, is_dark, has_contrasting_belt, has_tonal_belt, color_lightness
**b:** is_petite, is_tall, body_shape, is_plus_size

(is_dark : color_lightness<0.25), | via color_value

Notes:
1. is_monochrome_outfit is not being handled, is false always
2. has_contrasting_belt is not being handled, always is false
3. has_tonal_belt is not being handled, always is false

---

## scoreHemline
**g:** silhouette, has_waist_definition
**b:** is_petite, is_tall, leg_ratio, c_thigh_max, goal_legs, goal_hip, body_shape, calf_prominence, h_knee, height

sihouette via silhouette_type
(has_waist_definition : via waist_definition)
(leg_ratio : via BodyProfile)
(h_knee : via BodyProfile)

Notes:
1. goal_legs is not being handled, always null
2. goal_hip is not being handled, always null
3. calf_prominence is not being handled, always null

---

## scoreSleeve
**g:** sleeve_type, sleeve_length_inches, sleeve_ease_inches, 
**b:** (passed to translateSleeve)

sleeve_type : via sleeve_type

Notes:
1. sleeve_ease_inches is not being handled, is always 1
2. sleeve_length_inches is not being handled, is always null
3. some of the things in BodyProfile are not being handled at all which are used in translateSleeve


---

## scoreWaistPlacement
**g:** waist_position, elastane_pct, drape, has_contrasting_belt
**b:** body_shape, bust_differential, leg_ratio, whr

(waist_position : via waistline)
(elastane_pct : via stretch_percentage)
(drape : via fabric_drape)

Notes:
1. has_contrasting_belt is not being handled, is always false
2. bust_differential is always 4

---

## scoreColorValue
**g:** color_lightness, zone
**b:** body_shape, bust, waist, skin_tone_L

(color_lightness : via color_value)
(zone : detectZone(category) ; full_body|lower_body|torso) | category via garment_type, 

Notes:
1. skin_tone_L is not being handled, is always 50.0

---

## scoreFabricZone
**g:** gsm_confidence
**b:** is_plus_size, belly_zone

Notes:
1. belly_zone is not being handled, always is 0

---

## scoreNecklineCompound
**g:** neckline, neckline_depth, v_depth_cm, elastane_pct
**b:** body_shape, bust_differential, is_plus_size, goal_bust

(v_depth_cm : via neckline_depth)
(elastane_pct : via stretch_percentage)

Notes:
1. goal_bust is null
2. bust_differential is always 4

---
