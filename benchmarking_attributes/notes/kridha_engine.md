
# TODO

1. Early breaks if not enough information available
2. Also trying to not analyze so much in case of simple t-shirts and pants, and do so only in case of dresses.
3. Also, generating explanation: during an explanation, we put tires for each rule so that the prompt knows which rule is important and then prioritizes it, rather than assuming them to be of the same priority for everything and then generating some sort of explanation which is all over the place.



3. Also, seeing which rules are important and maybe calculate the score based on which rules only, for now, but in the description you show all rules. Maybe 1st paragraph will show top priority rules and 2nd paragraph will show less priority rules.




# Scorers

## scoreHorizontalStripes

Principle: Helmholtz illusion — horizontal stripes create a thinning effect (not widening as commonly believed). Vertical stripes slightly widen (~5%).

### Vertical Stripes Only

- Base penalty: -0.05 (V-stripes widen by ~5%, Thompson 2011)
- If body is rectangle and garment is on torso: +0.03 (widening is desirable for narrow shoulders)
- If body is inverted triangle and garment is on lower body: -0.08 (further thins already-narrow hips)

### Horizontal Stripes

Base: +0.03 (Koutsoumpis 2021)

Size modifiers:
- If plus-size: -0.10 (Helmholtz illusion nullifies or reverses, Ashida 2013)
- If petite: +0.05 (illusion amplified on smaller frames)

Zone modifiers by body shape:
- Pear + torso: +0.08 (H-stripes add shoulder width, balancing wider hips)
- Pear + lower body: -0.05 (draws unwanted attention to hip zone)
- Inverted triangle + torso: -0.12 (emphasizes already-broad shoulders)
- Inverted triangle + lower body: +0.10 (adds visual hip volume for balance)
- Apple + covers waist: -0.05 (emphasizes midsection width)
- Rectangle: +0.05 (adds visual interest to straight frame)
- Hourglass: +0.03 (standard positive effect)

Stripe width:
- Fine stripes (<1cm): +0.03 (stronger thinning illusion)
- Wide stripes (>2cm) + plus-size: -0.05 (act as measurement markers, highlighting width)

Luminance:
- Dark fabric + H-stripes: +0.04 (luminance contrast enhances thinning effect)


## scoreDarkSlimming

Principle: Dark colors absorb light and reduce perceived volume. But effect varies by body type and can backfire (flatten curves, wash out skin).

### Light colors (lightness > 0.65)
- Penalty scales with lightness (light colors visually expand)

### Mid colors (lightness 0.25-0.65)
- Proportional slimming benefit

### Dark colors (lightness < 0.25)
Base: +0.15

Body type multipliers:
- Petite + full body dark: x0.6 (all-dark collapses height)
- Petite + zone dark: x0.9 (mild reduction)
- Tall: x1.2 (amplifies lean silhouette)
- Inverted triangle + torso: x1.4 (maximum shoulder reduction)
- Hourglass: x0.7 (dark flattens desirable curves)

Skin tone (for torso/full body):
- Warm undertone + very dark: reduced benefit (can look sallow)
- Dark skin + dark garment: x0.5 (low contrast)

Sheen penalty:
- Sheen index > 0.5: penalty up to -0.15 (specular highlights add volume)
- Apple/plus + high sheen: penalty x1.5


## scoreRiseElongation

Principle: Higher rise visually lengthens legs by raising the apparent waist-to-hip transition point.

- No rise data: N/A
- Base: (rise_cm - 20) * 0.015, clamped to +/-0.20

Body type modifiers:
- Petite + short torso + high rise (>26cm): INVERTED to -0.30 (compresses already-short torso)
- Petite + long torso: x1.5 (can afford high rise)
- Petite + proportional: x1.3
- Tall: x0.5 (diminishing returns, already has leg length)

Waistband interaction (for apple/plus with belly):
- Wide elastic waistband (>=5cm, >=8% stretch): +0.10 (smooth containment)
- Narrow rigid waistband (<3cm, <5% stretch): -0.25 (muffin top risk)

Special cases:
- Hourglass + high rise (>24cm): +0.03 (smooth waist-to-hip line)
- Inverted triangle + high rise + slim leg: x0.6 (over-emphasizes narrow lower body)


## scoreAlineBalance

Principle: A-line silhouette (gradual widening from waist) balances proportions by adding volume at hem level.

- Expansion rate (ER) < 0.03: not A-line, N/A

Base score by expansion rate:
- ER 0.03-0.06: +0.10 to +0.25 (subtle flare)
- ER 0.06-0.12: +0.25 (optimal A-line)
- ER 0.12-0.18: +0.25 down to +0.10 (getting too wide)
- ER > 0.18: diminishing, can go negative (overwhelming)

Drape coefficient multiplier:
- DC < 40% (drapey): full benefit
- DC 40-65% (medium): x0.7
- DC > 65% (stiff): x-0.5 INVERTED (creates shelf effect instead of flow)

Body type modifiers:
- Inverted triangle: +0.15 (max benefit, balances broad shoulders)
- Tall: +0.10 (carries volume well)
- Petite + ER > 0.12: -0.15 (overwhelms small frame)
- Petite + ER <= 0.12: +0.05 (scale-appropriate)
- Hourglass: +0.05
- Pear: +0.05
- Apple: +0.03

Hem position (for pear):
- Mid-thigh: -0.10 (cuts at widest point)
- Knee: +0.05 (safe)


## scoreTentConcealment

Principle: Oversized/tent silhouettes hide body contours but paradoxically make overall size appear larger.

### Semi-fitted (ER 0.03-0.08)
- Base: +0.15 (optimal concealment without size inflation)
- Hourglass: +0.05 (slightly masks curves)
- Plus + structured: +0.20 (smooth containment)

### Not tent (ER < 0.12)
- N/A

### Tent silhouette (ER >= 0.12)

Goal-dependent base:
- Concealment goal only: +0.25 to +0.35 (excellent hiding)
- Slimming goal only: -0.20 to -0.40 (CONCEALMENT PARADOX: hides shape but looks bigger)
- Both goals: weighted 30% concealment, 70% slimming (net negative)

Body type reversals:
- Hourglass: -0.20 (destroys waist-hip ratio)
- Petite: -0.15 (fabric overwhelms frame)
- Plus-size: -0.10 (maximizes size overestimate)
- Inverted triangle: -0.10 (lampshade effect from shoulders)
- Tall: +0.10 (can carry volume)
- Rectangle: +0.05 (less curve to hide anyway)


## scoreColorBreak

Principle: Contrasting belts/color breaks visually shorten the leg line by interrupting the vertical flow.

- No belt: N/A
- Tonal belt only: -0.03 (mild break)
- Contrasting belt base: -0.10 (shortens legs)

Body type modifiers:
- Hourglass: REVERSAL +0.20 to +0.25 (belt highlights defined waist)
- Petite: x1.5 penalty (can't afford leg shortening)
- Apple: -0.25 (spotlights widest zone)
- Tall: x0.3 penalty (can afford some shortening)
- Inverted triangle: +0.08 (draws eye to narrower waist)
- Rectangle: +0.05 (creates waist definition)
- Pear + narrow waist (WHR < 0.75): +0.05
- Pear + moderate waist: -0.10

Plus-size interaction:
- Plus + belly zone > 0.5: -0.20 (belt at widest point)
- Plus + no belly: +0.05 (belt creates waist)


## scoreBodyconMapping

Principle: Bodycon (body-conscious) fitted garments map every contour. Great for defined shapes, problematic for areas to minimize.

- Expansion rate > 0.03: not bodycon, N/A

Fabric weight matters:
- Thin fabric (GSM < 200, unstructured): amplifies negatives
- Structured fabric (GSM >= 250 or structured): sculpts, reduces penalties

Body type scores:
- Hourglass: REVERSAL +0.30 to +0.35 (maps best feature)
  - Belly concern: -0.15 offset
- Athletic apple: +0.20 (showcases muscle tone)
- Apple + thin: -0.40
- Apple + structured: -0.12
- Pear + thin: -0.30
- Pear + structured: -0.09
- Plus + thin: -0.40
- Plus + structured: -0.05 (sculpting effect)
- Inverted triangle full body: -0.15
- Inverted triangle lower body: -0.05
- Inverted triangle torso: -0.10
- Rectangle: 0.0 (neutral)


## scoreMatteZone

Principle: Matte fabrics absorb light, reducing perceived volume. Shiny fabrics reflect light, adding visual bulk via specular highlights.

Base by sheen index (SI):
- SI < 0.15 (deeply matte): +0.08
- SI 0.15-0.35 (low sheen): scales down from +0.08
- SI 0.35-0.50 (neutral): 0.0
- SI > 0.50 (high sheen): penalty up to -0.10

Body type multipliers:
- Apple: x1.5
- Plus-size: x1.5
- Pear + lower body or full body: x1.3
- Inverted triangle + torso: x1.2
- Hourglass: x0.5 (moderate sheen can enhance curves)
  - SI 0.35-0.55: +0.05 bonus

Cling trap (high cling + low sheen):
- Plus + clingy matte: -0.15 (worst combo, clings and shows every contour)
- Pear + clingy matte: -0.10
- Apple + clingy matte: -0.12


## scoreVneckElongation

Principle: V-necklines create a vertical visual channel that elongates the torso and draws the eye upward.

### Non-V necklines
- Crew: 0.0 (neutral baseline)
- Boat/off-shoulder + inverted triangle: -0.15 (widens already-broad shoulders)
- Boat + rectangle: +0.08 (adds desired width)
- Boat + pear: +0.05 (shoulder balance)
- Scoop: +0.05 to +0.08 (mild elongation)
- Turtleneck + inverted triangle: -0.05 (upper mass)
- Turtleneck + petite short-torso: +0.10 (keeps eye up)
- Wrap: +0.08 (mild V-effect)

### V-neck / Deep V
Base: +0.10

Body type modifiers:
- Inverted triangle: +0.18 (narrows shoulder line)
- Hourglass: +0.12 (frames bust-to-waist)
- Petite + short torso + high rise: -0.05 (CONFLICT: V pulls down, rise pulls up)
- Petite + short torso + mid rise: +0.15 (harmonious elongation)
- Petite: +0.12 (vertical channel helps)
- Apple: +0.10 (draws eye to face, away from belly)
- Tall: +0.05 (diminishing returns)
- Pear: +0.10 (attention upward)


## scoreMonochromeColumn

Principle: Single-color outfits create unbroken vertical line, elongating the silhouette.

- Not monochrome: N/A

Base: +0.08
Dark bonus: +0.07 if dark color

Body type modifiers:
- Petite: +0.15 (AMPLIFIED benefit, most needs height)
- Tall: +0.03 (doesn't need more height)
- Hourglass: +0.03
  - With belt: +0.12 (best of both worlds)
- Inverted triangle: +0.05
- Apple: +0.08
- Pear + dark (L < 0.30): +0.12
- Pear + light: +0.05
- Plus-size: +0.10
- Plus + dark mono: +0.08 dark bonus (most reliable slimming combo)


## scoreHemline

Principle: Hemline placement relative to body landmarks (knee, calf) dramatically affects leg proportion perception.

### Above knee
- Base elongation: inches above knee * 0.20, max +0.60
- Petite: additional bonus (up to +0.80)
- Tall + long legs: x0.65 (diminished benefit)

Thigh penalty (if thighs exposed):
- Thigh > 27": -0.35
- Thigh > 24": -0.20
- Thigh > 22": -0.10
- Goal = showcase legs: penalty x0.5
- Goal = narrower hips: penalty x1.2

Apple slim-legs bonus:
- Apple + thigh < 22": +0.15
- Apple + thigh < 24": +0.08

### Knee danger zone
- Petite: -0.40
- Others: -0.30
(Cuts leg at widest point of knee)

### Safe zone (below knee, above calf)
- Centered in zone: +0.30
- Edge of zone: +0.15
- Tall: +0.10 bonus

### Collapsed safe zone
- -0.20 (no good options in this range)

### Calf danger zone
- Calf prominence > 1.3: -0.50
- Calf prominence > 1.2: -0.42
- Others: -0.35
- Petite: x1.15 penalty

### Below calf
- +0.15 (safe)

### Ankle
- Petite + oversized/shift: -0.15
- Petite + fitted + waist definition: +0.40
- Petite + fitted: +0.15
- Petite: +0.10
- Tall: +0.45
- Others: +0.25
- Hourglass without waist definition: -0.15

### Floor
- Tall: +0.15
- Petite: -0.10
- Others: +0.05


## scoreSleeve

Principle: Sleeve endpoint relative to arm width affects perceived arm size. Ending at widest point emphasizes; ending elsewhere minimizes.

- Sleeveless: N/A (baseline)

Score based on delta (sleeve endpoint vs actual arm width):
- Delta > 0.30 (ends at widest): -4.0
- Delta > 0.15: -2.0
- Delta > 0: -1.0
- Delta > -0.30: +1.0
- Delta > -0.60: +3.0
- Delta <= -0.60 (ends well past widest): +5.0

Severity multiplier applied based on arm prominence.

Flutter sleeve bonus: +2.0 (visual ambiguity hides arm width)

Final score normalized to -1.0 to +1.0 range.


## scoreWaistPlacement

Principle: Waist position affects visual leg-to-torso ratio. Empire raises it, drop lowers it. Golden ratio (0.618) is ideal.

- No waist definition: N/A

Base: proportion score from visual leg ratio vs golden ratio

Empire waist + hourglass:
- With stretch (>10%): -0.10 (mild shape loss)
- With drape (>7): -0.15 (shape loss)
- Stiff fabric: -0.30 (significant shape loss)

Empire + large bust (differential >= 6"):
- Stiff fabric + high projection: up to -0.45 (tent effect from bust)

Drop waist + short legs:
- Leg ratio < 0.55: -0.30
- Leg ratio < 0.58: -0.15

Apple + natural waist + contrasting belt + high WHR:
- WHR > 0.88: -0.30
- WHR > 0.85: -0.15
(Spotlights widest area)


## scoreColorValue

Principle: Color lightness (L value) affects slimming. Darker = more slimming, but very dark on hourglass flattens curves.

Slimming percentage by lightness:
- L <= 10: 4% slimming
- L <= 25: 3% slimming
- L <= 40: 2% slimming
- L <= 60: 0.5% slimming
- L <= 80: -0.5% (slight expansion)
- L > 80: -1% (expansion)

Score = slim_pct * 6.25 (maps 4% to +0.25)

Hourglass shape loss (L <= 25):
- Large waist-hip diff (>=8"): up to -0.30 (dark hides curves)
- Medium diff (>=6"): up to -0.20
- Small diff: up to -0.10

Rectangle + dark: +0.05 (clean column bonus)

Skin contrast (for very dark, L <= 15):
- High contrast (>0.70): -0.05
- Low contrast (<0.30): +0.05


## scoreFabricZone

Principle: Fabric properties collectively affect how garment drapes on body. Weighted combination of cling, structure, sheen, drape.

Weighted sub-scores:

Cling (30% weight):
- High cling (>0.6): -0.20, or -0.40 if plus/belly
- Medium cling (0.3-0.6): -0.05
- Low cling (<0.3): +0.10

Structure (20% weight):
- Structured: +0.15
- Heavy (GSM > 250): +0.08
- Light (GSM < 100): -0.10
- Medium: 0.0

Sheen (15% weight):
- Uses scoreMatteZone result

Drape (10% weight):
- Very drapey (DC < 30): +0.10 (skims body)
- Drapey (DC < 50): +0.05
- Medium (DC < 70): 0.0
- Stiff (DC >= 70): -0.10

Remaining 25%: color, texture, pattern, silhouette, construction (simplified to 0.0)


## scoreNecklineCompound

Principle: V-necklines have compound effects: bust framing, torso slimming, upper body balance. This scores the combined impact.

- Non-V/wrap/scoop necklines: N/A

### Bust dividing score (40% of compound)
Based on V-depth vs bust-dividing threshold:
- Depth ratio < 0.60: +0.30 (safe, modest)
- Depth ratio 0.60-0.85: +0.50 (optimal framing)
- Depth ratio 0.85-1.0:
  - Goal = enhance bust: +0.70
  - Goal = minimize bust: -0.20
  - Neutral: +0.30
- Depth ratio 1.0-1.15:
  - Goal = enhance: +0.30
  - Goal = minimize: -0.60
  - Neutral: -0.15
- Depth ratio > 1.15:
  - Goal = enhance: +0.10
  - Goal = minimize: -0.85
  - Neutral: -0.35

### Torso slimming score (30% of compound)
Based on V angle (width/depth):
- Narrow V (angle < 0.5): +0.25
- Medium V (angle < 1.0): +0.18
- Wide V (angle < 1.5): +0.10
- Very wide: +0.05

Body type multipliers:
- Apple: x1.30
- Rectangle: x1.15

### Upper body balance score (30% of compound)
- Inverted triangle: +0.45 (max benefit)
- Pear: +0.30
- Rectangle: +0.20
- Hourglass: +0.10
- Others: +0.15


# Type-Specific Scorers

## scoreTopHemline

Principle: Where a top ends relative to the waist/hip dramatically affects visual proportions. Tucking behavior changes the equation entirely.

### Tucked
- Base: +0.15 (hem invisible, creates waist definition)
- Heavy fabric (GSM > 250): -0.20 (bulk at waist when tucked)

### Half-tucked
- Base: +0.20 (partial waist definition, asymmetric visual break)
- Pear: +0.10 (asymmetric break disrupts hip-level line)
- Apple: +0.05 (partial tuck draws eye to waist area)
- Goal = highlight_waist: +0.10
- Heavy fabric (GSM > 250): -0.15 (bunching at tuck point)

### Bodysuit
- +0.10 (no visible hem, smooth unbroken line at waist)

### Cropped
- Petite + short torso (ratio < 0.48): -0.35 (further shortens torso)
- Petite + proportional torso: +0.30 (lengthens legs)
- Others: +0.15
- Apple + hide_midsection goal: -0.70 (crop exposes midsection)

### Untucked hem positions

At waist:
- Base: +0.20 (defines waist)
- Goal = highlight_waist: +0.15

Just below waist:
- +0.15 (slight torso lengthening, still suggests waist)

At hip:
- Pear + relaxed fit: -0.30 (line at widest hip point)
- Pear + fitted: -0.45 (emphasizes widest point more)
- Pear + slim_hips goal: additional -0.10
- Inverted triangle: +0.35 (hip-level adds visual weight below)
- Apple + relaxed: +0.20 (skims past midsection)
- Apple + fitted: -0.15 (pulls at midsection)

Below hip / Tunic length:
- Goal = slim_hips or hide_midsection: +0.35 (good coverage)
- Goal = look_taller: -0.20 (below_hip) or -0.35 (tunic) — shortens leg line
- Petite + tunic: -0.20 (overwhelms frame)


## scorePantRise

Principle: Rise height determines where the leg visually begins. Higher rise = longer apparent legs.

### High / Ultra-high rise
- Base: +0.25 (leg elongation)
- Goal = look_taller: +0.25
- Goal = highlight_waist: +0.15 (waistband cinches)
- Apple + WHR > 0.85 + stretch waistband: -0.10 (mitigates muffin risk)
- Apple + WHR > 0.85 + no stretch: -0.25 (muffin-top risk)
- Petite: +0.10 (high rise strongly benefits)

### Mid rise
- +0.05 (neutral-positive, versatile)

### Low rise
- Base: -0.15 (shortens leg line)
- Goal = look_taller: -0.25 (strongly fights goal)
- Petite: -0.15 (significantly shortens leg)
- Goal = hide_midsection: -0.15 (low rise exposes gap)


## scoreLegShape

Principle: Leg shape affects hip-to-ankle proportion perception. Volume placement either balances or emphasizes body shape.

### Skinny / Slim
- Pear + slim_hips goal: -0.35 (emphasizes hip-to-ankle taper)
- Pear: -0.10 (shows hip curve)
  - With high rise: +0.10 offset (elongation helps)
- Inverted triangle: -0.25 (narrow bottom emphasizes shoulder width)
- Rectangle: +0.15 (clean line)
- Hourglass: +0.15 (follows natural curve)

Thigh cling penalty (skinny + low stretch + large thigh):
- Thigh > 24": -0.10
- Thigh > 22": -0.05

### Wide leg / Palazzo
- Petite + high rise: +0.15 (volume manageable)
- Petite without high rise: -0.30 (overwhelms frame)
- Pear: +0.40 (skims over hips and thighs)
  - With high rise: +0.10 (defines waist before volume)
  - With low rise: -0.20 (volume starts too early)
- Inverted triangle: +0.40 (leg volume balances shoulders)
  - With high rise: +0.05
- Apple: +0.25 (volume below balances midsection)
  - With stretch high rise: +0.10
  - With low rise: -0.15
- Others: +0.15

### Straight
- +0.15 (clean, balanced line, universally flattering)

### Bootcut / Flare
- Base: +0.15 (volume at hem elongates)
- Pear: +0.30 (flare balances hip width)
- Goal = look_taller: +0.15 (flare + heel creates long line)

### Tapered
- Pear: -0.15 (taper emphasizes hip-ankle contrast)
- Others: +0.10

### Jogger
- Petite: -0.15 (elastic cuff shortens leg line)
- Others: 0.0


## scoreJacketScoring

Principle: Jacket structure, length, and closure interact with body shape to balance or emphasize proportions.

### Shoulder structure

Padded / Structured:
- Pear: +0.50 (structured shoulders balance hips, creates hourglass effect)
- Inverted triangle: -0.40 (widens already-broad shoulders)
- Rectangle: +0.25 (creates shape on straight frame)
- Others: +0.10

Dropped / Oversized:
- Inverted triangle: +0.20 (softens broad shoulder line)
- Petite: -0.30 (oversized overwhelms frame)
- Others: +0.05

### Jacket length

Cropped:
- Base: +0.30 (defines waist)
- Goal = look_taller: +0.15 (short jacket = longer leg line)

Hip length:
- Pear: -0.30 (ends at widest point)
- Inverted triangle: +0.20 (adds visual weight below)

Long (mid-thigh, knee, below-knee, full):
- Goal = look_taller: -0.20 (shortens visible leg line)
- Goal = hide_midsection or slim_hips: +0.30 (provides coverage)

### Closure

Open front:
- +0.20 (vertical line elongates torso)

Double-breasted:
- Apple: -0.15 (adds midsection bulk)
- Rectangle: +0.10 (adds dimension)
