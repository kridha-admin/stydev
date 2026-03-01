# Scoring Engine Benchmark — Summary

**Generated:** 2026-02-24T04:03:52.903Z
**Engine version:** post-phase-2.5 (hemline fix + null handling + bust_differential)
**Combinations:** 10 garments x 10 users = 100
**Valid results:** 100 / 100

## Score Statistics

| Stat | Value |
|------|-------|
| Min | 2.6 |
| P25 | 4.4 |
| Median | 6.3 |
| Mean | 6.1 |
| P75 | 7.8 |
| Max | 8.8 |
| StdDev | 1.86 |

## Score Distribution

| Bin | Count | Bar |
|-----|-------|-----|
| 0-1 | 0 |  |
| 1-2 | 0 |  |
| 2-3 | 5 | ##### |
| 3-4 | 14 | ############## |
| 4-5 | 9 | ######### |
| 5-6 | 17 | ################# |
| 6-7 | 16 | ################ |
| 7-8 | 17 | ################# |
| 8-9 | 22 | ###################### |
| 9-10 | 0 |  |
| 10-11 | 0 |  |

## Archetype Checks (16/17 pass)

### Ponte Sheath (g_002) — crowd-pleaser, expect 7+ for most

| Body | Score | Expect | Pass |
|------|-------|--------|------|
| Petite Pear | 8.5 | >=7 | PASS |
| Avg Hourglass | 8.0 | >=7 | PASS |
| Tall Rectangle | 7.5 | >=6.5 | PASS |
| Plus Apple | 7.4 | >=6.5 | PASS |
| Tall Hourglass | 8.1 | >=7 | PASS |

### Bodycon Mini (g_008) — adversarial, expect <4 for apple/pear

| Body | Score | Expect | Pass |
|------|-------|--------|------|
| Plus Apple | 4.3 | <4 | FAIL |
| Petite Apple | 2.9 | <4.5 | PASS |
| Petite Pear | 3.3 | <5 | PASS |
| Pear Plus | 3.3 | <4 | PASS |
| Avg Hourglass (should be OK) | 7.8 | >=6 | PASS |

### Oversized Linen (g_003) — good for apple concealment, mediocre for hourglass

| Body | Score | Expect | Pass |
|------|-------|--------|------|
| Plus Apple (concealment) | 6.3 | >=5 | PASS |
| Petite Apple | 7.4 | >=4.5 | PASS |
| Avg Hourglass (hides curves) | 5.4 | <6 | PASS |
| Tall Hourglass (hides curves) | 5.5 | <6 | PASS |

### A-Line Midi (g_007) — universal crowd-pleaser, expect 7+ for most

| Body | Score | Expect | Pass |
|------|-------|--------|------|
| Petite Pear | 8.2 | >=6.5 | PASS |
| Plus Apple | 7.6 | >=6 | PASS |
| Avg Hourglass | 6.8 | >=6.5 | PASS |

## Body Sensitivity (per garment)

| Garment | Mean | StdDev | Min | Max | Spread | Flag |
|---------|------|--------|-----|-----|--------|------|
| g_001 | 5.4 | 2.04 | 2.9 | 8.0 | 5.1 |  |
| g_002 | 8.1 | 0.43 | 7.4 | 8.5 | 1.1 | LOW |
| g_003 | 6.3 | 1.37 | 3.5 | 8.5 | 5.0 |  |
| g_004 | 4.1 | 1.00 | 2.6 | 5.6 | 3.0 |  |
| g_005 | 8.2 | 0.52 | 7.2 | 8.8 | 1.6 |  |
| g_006 | 3.8 | 0.57 | 2.9 | 4.6 | 1.7 |  |
| g_007 | 7.8 | 0.53 | 6.8 | 8.4 | 1.6 |  |
| g_008 | 5.4 | 1.96 | 2.9 | 8.2 | 5.3 |  |
| g_009 | 5.4 | 0.62 | 4.2 | 6.2 | 2.0 |  |
| g_010 | 6.4 | 0.50 | 5.7 | 7.6 | 1.9 | LOW |

## Monotonicity (ponte > bodycon for apple/pear)

| User | Ponte | Bodycon | Pass |
|------|-------|--------|------|
| user_04_plus_apple | 7.4 | 4.3 | PASS |
| user_05_petite_apple | 8.5 | 2.9 | PASS |
| user_01_petite_pear | 8.5 | 3.3 | PASS |
| user_07_avg_pear_plus | 7.6 | 3.3 | PASS |

## Full Score Matrix

| User | g_001 | g_002 | g_003 | g_004 | g_005 | g_006 | g_007 | g_008 | g_009 | g_010 | 
|------|------|------|------|------|------|------|------|------|------|------|
| u01_petite_pear | 3.3 | 8.5 | 3.5 | 2.6 | 8.7 | 3.0 | 8.2 | 3.3 | 5.9 | 6.4 | 
| u02_avg_hourglass | 7.8 | 8.0 | 5.4 | 5.5 | 7.7 | 4.4 | 6.8 | 7.8 | 5.2 | 5.7 | 
| u03_tall_rectangle | 5.1 | 7.5 | 8.5 | 3.5 | 8.1 | 3.9 | 7.7 | 4.5 | 5.5 | 6.3 | 
| u04_plus_apple | 2.9 | 7.4 | 6.3 | 3.9 | 7.2 | 3.4 | 7.6 | 4.3 | 4.2 | 6.8 | 
| u05_petite_apple | 2.9 | 8.5 | 7.4 | 3.4 | 8.3 | 3.6 | 8.2 | 2.9 | 5.7 | 6.4 | 
| u06_tall_invtri | 6.4 | 8.5 | 8.1 | 5.0 | 8.6 | 4.6 | 8.4 | 6.6 | 6.2 | 7.6 | 
| u07_avg_pear_plus | 3.3 | 7.6 | 6.3 | 3.2 | 8.6 | 2.9 | 7.7 | 3.3 | 4.3 | 6.6 | 
| u08_tall_hourglass | 7.9 | 8.1 | 5.5 | 5.6 | 8.7 | 4.4 | 7.0 | 7.9 | 5.3 | 5.9 | 
| u09_petite_rectangle | 6.2 | 8.4 | 6.0 | 3.6 | 8.8 | 4.0 | 8.4 | 5.5 | 5.8 | 6.4 | 
| u10_no_goals | 8.0 | 8.5 | 6.5 | 5.0 | 7.7 | 4.3 | 7.5 | 8.2 | 5.5 | 6.1 | 

## No-Goals User (user_10)

- Variance: 1.39
- Scores: 8.0, 8.5, 6.5, 5.0, 7.7, 4.3, 7.5, 8.2, 5.5, 6.1
