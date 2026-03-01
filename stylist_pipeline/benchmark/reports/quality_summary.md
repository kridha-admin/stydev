# Quality Benchmark — Real Product Analysis

Generated: 2026-02-24T04:03:53.606Z
Combinations: 51 garments x 10 users = 510
Valid scores: 510 | Errors: 0

## Executive Summary

| Metric | Value |
|--------|-------|
| Total flags | 140 |
| Errors | 20 |
| Warnings | 54 |
| Info | 66 |
| Extraction error rate | 0.0% |
| Score-verdict contradiction rate | 9.2% |
| Headline diversity | 39% unique (200/510) |
| Goal logic error rate | 0.0% |

## Score Distribution

| Stat | Value |
|------|-------|
| Min | 2.3 |
| P25 | 4.4 |
| Median | 5.5 |
| Mean | 5.3 |
| P75 | 6.2 |
| Max | 8.9 |
| StdDev | 1.32 |

| Bin | Count | Bar |
|-----|-------|-----|
| 0-1 | 0 |  |
| 1-2 | 0 |  |
| 2-3 | 26 | ########################## |
| 3-4 | 60 | ############################################################ |
| 4-5 | 89 | ######################################################################################### |
| 5-6 | 175 | ############################################################################################################################################################################### |
| 6-7 | 108 | ############################################################################################################ |
| 7-8 | 35 | ################################### |
| 8-9 | 17 | ################# |
| 9-10 | 0 |  |
| 10-11 | 0 |  |

## Verdict Distribution

| Verdict | Count | % |
|---------|-------|---|
| not_this_one | 175 | 34.3% |
| smart_pick | 309 | 60.6% |
| this_is_it | 26 | 5.1% |

## A. Extraction Quality

Flags: 70 (0 errors, 19 warnings, 51 info)

### WARNING: Type mismatch: title says "skirt" but merged says "dress"

- Garment: s_004
- Expected: garment_type = "skirt" based on product title
- Actual: merged_attrs.garment_type = "dress"
- Details: `{"title":"ANARABESS 2 Piece Skirts Sets For Women Fall Fashion 2025 Striped Sweater Midi Dress Knit Lounge Travel Outfits Winter Clothes Beige Black Medium","imgType":"dress","txtType":null,"mergedType":"dress"}`

### WARNING: Type mismatch: title says "top" but merged says "dress"

- Garment: s_005
- Expected: garment_type = "top" based on product title
- Actual: merged_attrs.garment_type = "dress"
- Details: `{"title":"PRETTYGARDEN Cocktail Dresses for Women 2026 Summer Formal Elegant Tube Top Strapless Spring Wedding Guest Party Midi Dress(Burgundy,Medium)","imgType":"dress","txtType":null,"mergedType":"dress"}`

### WARNING: Type mismatch: title says "jacket" but merged says "top"

- Garment: s_011
- Expected: garment_type = "jacket" based on product title
- Actual: merged_attrs.garment_type = "top"
- Details: `{"title":"Puff-Sleeved Twill Jacket - Beige - Ladies | H&M US","imgType":"top","txtType":null,"mergedType":"top"}`

### WARNING: Type mismatch: title says "jacket" but merged says "top"

- Garment: s_012
- Expected: garment_type = "jacket" based on product title
- Actual: merged_attrs.garment_type = "top"
- Details: `{"title":"Chimney-Collar Jacket - Brown - Ladies | H&M US","imgType":"top","txtType":null,"mergedType":"top"}`

### WARNING: Type mismatch: title says "pants" but merged says "top"

- Garment: s_014
- Expected: garment_type = "pants" based on product title
- Actual: merged_attrs.garment_type = "top"
- Details: `{"title":"Flared High Waist Jeans - Denim blue - Ladies | H&M US","imgType":"top","txtType":null,"mergedType":"top"}`

### WARNING: Type mismatch: title says "pants" but merged says "top"

- Garment: s_015
- Expected: garment_type = "pants" based on product title
- Actual: merged_attrs.garment_type = "top"
- Details: `{"title":"Mom Slim-Fit High-Waist Ankle Jeans - Light beige - Ladies | H&M US","imgType":"top","txtType":null,"mergedType":"top"}`

### WARNING: Type mismatch: title says "pants" but merged says "top"

- Garment: s_017
- Expected: garment_type = "pants" based on product title
- Actual: merged_attrs.garment_type = "top"
- Details: `{"title":"Flared High Waist Jeans - Denim blue - Ladies | H&M US","imgType":"top","txtType":null,"mergedType":"top"}`

### WARNING: Type mismatch: title says "jacket" but merged says "skirt"

- Garment: s_018
- Expected: garment_type = "jacket" based on product title
- Actual: merged_attrs.garment_type = "skirt"
- Details: `{"title":"Buy Antheaa Embellished Shawl Neck Jacket With Skirt - Co Ords for Women 305323878","imgType":"skirt","txtType":null,"mergedType":"skirt"}`

### WARNING: Type mismatch: title says "pants" but merged says "top"

- Garment: s_019
- Expected: garment_type = "pants" based on product title
- Actual: merged_attrs.garment_type = "top"
- Details: `{"title":"Buy Glitchez Striped Sweatshirt With Trousers - Co Ords for Women 40045423 | Myntra","imgType":"top","txtType":null,"mergedType":"top"}`

### WARNING: Type mismatch: title says "top" but merged says "jumpsuit"

- Garment: s_021
- Expected: garment_type = "top" based on product title
- Actual: merged_attrs.garment_type = "jumpsuit"
- Details: `{"title":"Buy DressBerry Floral Printed Off Shoulder Top With Trousers Co Ords - Co Ords for Women 33427748 | Myntra","imgType":"jumpsuit","txtType":null,"mergedType":"jumpsuit"}`

...and 60 more in quality_report.json


## B. Score-Verdict Contradictions

Flags: 47 (20 errors, 27 warnings, 0 info)

### WARNING: Majority goals pass (3/4) but overall NTO (3.3)

- Garment: s_003
- User: user_01_petite_pear
- Expected: Majority green should correlate with SP or better
- Actual: score=3.3, verdict=not_this_one
- Details: `{"goals":["look_taller: pass","slim_hips: pass","highlight_waist: fail","look_proportional: pass"]}`

### WARNING: Majority goals pass (3/4) but overall NTO (3.3)

- Garment: s_010
- User: user_01_petite_pear
- Expected: Majority green should correlate with SP or better
- Actual: score=3.3, verdict=not_this_one
- Details: `{"goals":["look_taller: pass","slim_hips: pass","highlight_waist: fail","look_proportional: pass"]}`

### WARNING: Majority goals pass (3/4) but overall NTO (3.3)

- Garment: s_020
- User: user_01_petite_pear
- Expected: Majority green should correlate with SP or better
- Actual: score=3.3, verdict=not_this_one
- Details: `{"goals":["look_taller: pass","slim_hips: pass","highlight_waist: fail","look_proportional: pass"]}`

### WARNING: Majority goals pass (3/4) but overall NTO (3.3)

- Garment: s_031
- User: user_01_petite_pear
- Expected: Majority green should correlate with SP or better
- Actual: score=3.3, verdict=not_this_one
- Details: `{"goals":["look_taller: pass","slim_hips: pass","highlight_waist: fail","look_proportional: pass"]}`

### WARNING: Majority goals pass (3/4) but overall NTO (2.9)

- Garment: s_003
- User: user_04_plus_apple
- Expected: Majority green should correlate with SP or better
- Actual: score=2.9, verdict=not_this_one
- Details: `{"goals":["hide_midsection: pass","slimming: pass","highlight_waist: fail","look_proportional: pass"]}`

### WARNING: Majority goals pass (3/4) but overall NTO (2.9)

- Garment: s_010
- User: user_04_plus_apple
- Expected: Majority green should correlate with SP or better
- Actual: score=2.9, verdict=not_this_one
- Details: `{"goals":["hide_midsection: pass","slimming: pass","highlight_waist: fail","look_proportional: pass"]}`

### WARNING: Majority goals pass (3/4) but overall NTO (4.2)

- Garment: s_025
- User: user_04_plus_apple
- Expected: Majority green should correlate with SP or better
- Actual: score=4.2, verdict=not_this_one
- Details: `{"goals":["hide_midsection: caution","slimming: pass","highlight_waist: pass","look_proportional: pass"]}`

### WARNING: Majority goals pass (3/4) but overall NTO (4.2)

- Garment: s_026
- User: user_04_plus_apple
- Expected: Majority green should correlate with SP or better
- Actual: score=4.2, verdict=not_this_one
- Details: `{"goals":["hide_midsection: caution","slimming: pass","highlight_waist: pass","look_proportional: pass"]}`

### WARNING: Majority goals pass (3/4) but overall NTO (4.0)

- Garment: s_048
- User: user_04_plus_apple
- Expected: Majority green should correlate with SP or better
- Actual: score=4.0, verdict=not_this_one
- Details: `{"goals":["hide_midsection: fail","slimming: pass","highlight_waist: pass","look_proportional: pass"]}`

### WARNING: Majority goals pass (3/4) but overall NTO (4.0)

- Garment: s_050
- User: user_04_plus_apple
- Expected: Majority green should correlate with SP or better
- Actual: score=4.0, verdict=not_this_one
- Details: `{"goals":["hide_midsection: fail","slimming: pass","highlight_waist: pass","look_proportional: pass"]}`

...and 37 more in quality_report.json


## C. Communication Quality

Flags: 3 (0 errors, 0 warnings, 3 info)

### INFO: 18% of pinch texts are fabric-only (94/510)

- Expected: Pinch should mention hemline, silhouette, proportion — not just fabric
- Actual: 94 combos have fabric-only pinch
- Details: `{"fabricOnlyCount":94,"withPinch":510,"pct":0.18,"examples":[{"garment":"s_039","user":"user_01_petite_pear","pinch":"the cut works with your frame — it follows without clinging.  the key is the fabric in person — make sure it holds its shape on your frame."},{"garment":"s_041","user":"user_01_petit`

### INFO: 37% of TII/NTO combos don't reference user goals (75/201)

- Expected: Strong verdicts should mention what the user cares about
- Actual: 75 combos with no goal reference in headline/pinch
- Details: `{"noGoalRefCount":75,"tiiNtoCount":201,"pct":0.37}`

### INFO: Headline diversity: 200 unique out of 510 (39%)

- Expected: Higher diversity = more personalized communication
- Actual: 200 unique headlines
- Details: `{"uniqueCount":200,"total":510,"diversityScore":0.39}`


## D. Goal Logic

Flags: 2 (0 errors, 2 warnings, 0 info)

### WARNING: Petite (152.4cm) + floor_length passes look_taller

- Garment: s_005
- User: user_09_petite_rectangle
- Expected: Maxi/floor hemlines should fail look_taller for petite users
- Actual: look_taller: pass (score=0.074)
- Details: `{"user_height":152.4,"hemline_position":"floor_length","hemline_score":-0.105}`

### WARNING: Petite (152.4cm) + floor_length passes look_taller

- Garment: s_038
- User: user_09_petite_rectangle
- Expected: Maxi/floor hemlines should fail look_taller for petite users
- Actual: look_taller: pass (score=0.074)
- Details: `{"user_height":152.4,"hemline_position":"floor_length","hemline_score":-0.105}`


## E. Score Distribution

Flags: 18 (0 errors, 6 warnings, 12 info)

### WARNING: Low body sensitivity (stddev=0.30)

- Garment: s_023
- Expected: Different body types should get different scores (stddev > 0.3)
- Actual: scores: 4.3, 4.9, 5.0, 4.8, 5.0, 5.1, 4.2, 5.0, 5.0, 4.9
- Details: `{"std_dev":0.3,"garment_type":"jacket","title":"Nike Sportswear Tech Fleece Women's Mid-Rise Joggers"}`

### WARNING: Low body sensitivity (stddev=0.11)

- Garment: s_039
- Expected: Different body types should get different scores (stddev > 0.3)
- Actual: scores: 5.7, 5.4, 5.6, 5.5, 5.6, 5.8, 5.6, 5.6, 5.5, 5.5
- Details: `{"std_dev":0.11,"garment_type":"pants","title":"Glitchez Women Brown Jeans"}`

### WARNING: Low body sensitivity (stddev=0.09)

- Garment: s_040
- Expected: Different body types should get different scores (stddev > 0.3)
- Actual: scores: 5.4, 5.2, 5.4, 5.2, 5.3, 5.5, 5.3, 5.3, 5.3, 5.3
- Details: `{"std_dev":0.09,"garment_type":"pants","title":"M Moddy Straight Fit Women Dark Blue Jeans"}`

### WARNING: Low body sensitivity (stddev=0.23)

- Garment: s_041
- Expected: Different body types should get different scores (stddev > 0.3)
- Actual: scores: 5.9, 5.4, 6.0, 5.8, 5.9, 6.0, 6.0, 5.6, 5.9, 5.4
- Details: `{"std_dev":0.23,"garment_type":"pants","title":"Houseofcommon Regular Women Black Jeans"}`

### WARNING: Low body sensitivity (stddev=0.11)

- Garment: s_042
- Expected: Different body types should get different scores (stddev > 0.3)
- Actual: scores: 5.7, 5.4, 5.6, 5.5, 5.6, 5.8, 5.6, 5.6, 5.5, 5.5
- Details: `{"std_dev":0.11,"garment_type":"pants","title":"Glitchez Women Brown Jeans"}`

### WARNING: Low body sensitivity (stddev=0.22)

- Garment: s_043
- Expected: Different body types should get different scores (stddev > 0.3)
- Actual: scores: 5.9, 5.4, 6.0, 5.9, 5.9, 6.1, 6.0, 5.6, 5.9, 5.5
- Details: `{"std_dev":0.22,"garment_type":"pants","title":"Globenaut Boot Leg Women Black Jeans"}`

### INFO: Same verdict "smart_pick" for all 10 users

- Garment: s_001
- Expected: At least some body types should get different verdicts
- Actual: All 10 users: smart_pick
- Details: `{"verdict":"smart_pick","garment_type":"jumpsuit"}`

### INFO: Same verdict "smart_pick" for all 10 users

- Garment: s_002
- Expected: At least some body types should get different verdicts
- Actual: All 10 users: smart_pick
- Details: `{"verdict":"smart_pick","garment_type":"jumpsuit"}`

### INFO: Same verdict "smart_pick" for all 10 users

- Garment: s_006
- Expected: At least some body types should get different verdicts
- Actual: All 10 users: smart_pick
- Details: `{"verdict":"smart_pick","garment_type":"dress"}`

### INFO: Same verdict "not_this_one" for all 10 users

- Garment: s_011
- Expected: At least some body types should get different verdicts
- Actual: All 10 users: not_this_one
- Details: `{"verdict":"not_this_one","garment_type":"top"}`

...and 8 more in quality_report.json

## Recommendations

1. Fix extraction: 19 garments have type mismatches or missing data. Review Bedrock prompts or add post-extraction validation.
2. Fix score-verdict alignment: 47 combos have contradictions between goal chips and overall verdict. The silhouette/definition dominance rules may be too aggressive.
