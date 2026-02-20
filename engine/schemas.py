"""
Kridha Production Scoring Engine — Data Structures
===================================================
Unified schemas merging domain 2 (body math), domain 3 (fabric),
and domain 4 (perceptual scoring) into a single type system.
"""

import math
from dataclasses import dataclass, field
from enum import Enum
from typing import Dict, List, Optional, Tuple


# ================================================================
# ENUMS
# ================================================================

class BodyShape(Enum):
    PEAR = "pear"
    APPLE = "apple"
    HOURGLASS = "hourglass"
    RECTANGLE = "rectangle"
    INVERTED_TRIANGLE = "inverted_triangle"


class StylingGoal(Enum):
    LOOK_TALLER = "look_taller"
    HIGHLIGHT_WAIST = "highlight_waist"
    HIDE_MIDSECTION = "hide_midsection"
    SLIM_HIPS = "slim_hips"
    LOOK_PROPORTIONAL = "look_proportional"
    MINIMIZE_ARMS = "minimize_arms"
    # Legacy goals from domain 4 (used in internal scoring)
    SLIMMING = "slimming"
    CONCEALMENT = "concealment"
    EMPHASIS = "emphasis"
    BALANCE = "balance"


class SkinUndertone(Enum):
    WARM = "warm"
    COOL = "cool"
    NEUTRAL = "neutral"


class FabricConstruction(Enum):
    WOVEN = "woven"
    KNIT = "knit"
    KNIT_RIB = "knit_rib"
    KNIT_DOUBLE = "knit_double"      # ponte-type
    KNIT_JERSEY = "knit_jersey"


class SurfaceFinish(Enum):
    DEEP_MATTE = "deep_matte"         # wool flannel, brushed cotton
    MATTE = "matte"                    # cotton poplin, standard
    SUBTLE_SHEEN = "subtle_sheen"      # poly blend, sateen, modal
    MODERATE_SHEEN = "moderate_sheen"  # satin, charmeuse
    HIGH_SHINE = "high_shine"          # patent, wet-look
    MAXIMUM_SHINE = "maximum_shine"    # sequins, mirror metallic
    CRUSHED = "crushed"                # crushed velvet/satin


class Silhouette(Enum):
    FITTED = "fitted"              # bodycon, sheath
    SEMI_FITTED = "semi_fitted"
    A_LINE = "a_line"
    EMPIRE = "empire"
    WRAP = "wrap"
    SHIFT = "shift"                # straight, no waist
    PEPLUM = "peplum"
    FIT_AND_FLARE = "fit_and_flare"
    OVERSIZED = "oversized"
    ARCHITECTURAL = "architectural"


class SleeveType(Enum):
    SLEEVELESS = "sleeveless"
    CAP = "cap"
    SHORT = "short"
    THREE_QUARTER = "three_quarter"
    LONG = "long"
    RAGLAN = "raglan"
    DOLMAN = "dolman"
    PUFF = "puff"
    FLUTTER = "flutter"
    BELL = "bell"
    SET_IN = "set_in"


class NecklineType(Enum):
    V_NECK = "v_neck"
    DEEP_V = "deep_v"
    SCOOP = "scoop"
    CREW = "crew"
    BOAT = "boat"
    SQUARE = "square"
    OFF_SHOULDER = "off_shoulder"
    HALTER = "halter"
    COWL = "cowl"
    TURTLENECK = "turtleneck"
    WRAP = "wrap"


class GarmentCategory(str, Enum):
    """Primary garment classification — determines which zones to score."""
    DRESS = "dress"
    TOP = "top"
    BOTTOM_PANTS = "bottom_pants"
    BOTTOM_SHORTS = "bottom_shorts"
    SKIRT = "skirt"
    JUMPSUIT = "jumpsuit"
    ROMPER = "romper"
    JACKET = "jacket"
    COAT = "coat"
    SWEATSHIRT = "sweatshirt"
    CARDIGAN = "cardigan"
    VEST = "vest"
    BODYSUIT = "bodysuit"
    LOUNGEWEAR = "loungewear"
    ACTIVEWEAR = "activewear"
    SAREE = "saree"
    SALWAR_KAMEEZ = "salwar_kameez"
    LEHENGA = "lehenga"


class GarmentLayer(str, Enum):
    """Which layer of dressing this garment occupies."""
    BASE = "base"
    MID = "mid"
    OUTER = "outer"


class TopHemBehavior(str, Enum):
    """How the top's hemline interacts with the body."""
    TUCKED = "tucked"
    HALF_TUCKED = "half_tucked"
    UNTUCKED_AT_HIP = "untucked_at_hip"
    UNTUCKED_BELOW_HIP = "untucked_below_hip"
    CROPPED = "cropped"
    BODYSUIT = "bodysuit"


class BrandTier(Enum):
    LUXURY = "luxury"
    PREMIUM = "premium"
    MID_MARKET = "mid_market"
    MASS_MARKET = "mass_market"
    FAST_FASHION = "fast_fashion"


class WearContext(Enum):
    OFFICE_SEATED = "office_seated"
    CASUAL_ACTIVE = "casual_active"
    FORMAL_STANDING = "formal_standing"
    GENERAL = "general"


class Climate(Enum):
    HOT_HUMID = "hot_humid"
    HOT_DRY = "hot_dry"
    TEMPERATE = "temperate"
    COLD = "cold"


# ================================================================
# INPUT: BODY PROFILE
# ================================================================

@dataclass
class BodyProfile:
    """User's body measurements and characteristics.

    Merges domain 4's flag-based profile with domain 2's full measurement set
    and domain 3's zone-level measurements. All measurements in inches unless
    noted otherwise.
    """
    # --- Core measurements ---
    height: float = 66.0                     # total height (inches)
    bust: float = 36.0                       # bust circumference
    underbust: float = 32.0                  # underbust circumference
    waist: float = 30.0                      # natural waist circumference
    hip: float = 38.0                        # hip circumference at widest

    # --- Shoulder & neck ---
    shoulder_width: float = 15.5
    neck_length: float = 3.5                 # inches
    neck_circumference: float = 13.0

    # --- Torso proportions ---
    torso_length: float = 15.0               # shoulder to natural waist
    leg_length_visual: float = 41.0          # natural waist to floor
    inseam: float = 30.0

    # --- Arm measurements ---
    arm_length: float = 23.0                 # shoulder to wrist
    c_upper_arm_max: float = 12.0            # circumference at widest
    c_upper_arm_max_position: float = 3.0    # inches below shoulder
    c_elbow: float = 10.0
    c_forearm_max: float = 9.5
    c_forearm_min: float = 8.5               # 3/4 sweet spot
    c_forearm_min_position: float = 17.0     # inches below shoulder
    c_wrist: float = 6.5

    # --- Leg measurements ---
    h_knee: float = 18.0                     # height from floor to knee center
    h_calf_max: float = 14.0                 # height from floor to widest calf
    h_calf_min: float = 10.0                 # height from floor to narrowest calf
    h_ankle: float = 4.0                     # height from floor to ankle bone
    c_thigh_max: float = 22.0               # circumference at widest thigh
    c_calf_max: float = 14.5
    c_calf_min: float = 9.0
    c_ankle: float = 8.5

    # --- Projection measurements (inches from vertical plane) ---
    bust_projection: float = 2.0
    belly_projection: float = 1.0
    hip_projection: float = 1.5              # lateral

    # --- Body composition & skin ---
    body_composition: str = "average"        # lean | average | muscular | soft
    tissue_firmness: float = 0.5             # 0=very soft, 1=very firm
    skin_tone_L: float = 50.0               # 0-100 lightness
    contour_smoothness: float = 0.5          # 0.0-1.0
    skin_undertone: SkinUndertone = SkinUndertone.NEUTRAL
    skin_darkness: float = 0.5               # 0=Fitzpatrick I, 1=VI

    # --- Zone concern levels (0=no concern, 1=primary concern) ---
    belly_zone: float = 0.0
    hip_zone: float = 0.0
    upper_arm_zone: float = 0.0
    bust_zone: float = 0.0

    # --- Flags ---
    is_athletic: bool = False

    # --- Styling preferences ---
    styling_goals: List[StylingGoal] = field(default_factory=list)
    style_philosophy: str = "balance"        # balance | emphasis | hybrid

    # --- Context ---
    climate: Climate = Climate.TEMPERATE
    wear_context: WearContext = WearContext.GENERAL

    # --- Per-zone goals (optional) ---
    goal_bust: Optional[str] = None          # minimize | enhance | neutral
    goal_waist: Optional[str] = None         # define | neutral
    goal_belly: Optional[str] = None         # minimize | neutral
    goal_hip: Optional[str] = None           # narrower | neutral
    goal_arm: Optional[str] = None           # slimmer | neutral
    goal_neck: Optional[str] = None          # longer | shorter | neutral
    goal_legs: Optional[str] = None          # longer | showcase | neutral
    goal_shoulders: Optional[str] = None     # wider | narrower | neutral

    # --- Derived properties (computed on access) ---
    @property
    def whr(self) -> float:
        return self.waist / self.hip if self.hip > 0 else 0.80

    @property
    def bust_differential(self) -> float:
        """Proxy for cup size: bust - underbust."""
        return self.bust - self.underbust

    @property
    def shoulder_hip_diff(self) -> float:
        return self.shoulder_width - (self.hip / math.pi)

    @property
    def leg_ratio(self) -> float:
        """Visual leg length / height. Golden target: 0.618."""
        return self.leg_length_visual / self.height if self.height > 0 else 0.62

    @property
    def torso_leg_ratio(self) -> float:
        return (self.torso_length / self.leg_length_visual
                if self.leg_length_visual > 0 else 0.37)

    @property
    def is_petite(self) -> bool:
        return self.height < 63.0  # 5'3"

    @property
    def is_tall(self) -> bool:
        return self.height > 68.0  # 5'8"

    @property
    def is_plus_size(self) -> bool:
        return self.bust > 42 or self.hip > 44

    @property
    def body_shape(self) -> BodyShape:
        """Classify body shape from measurements (domain 2 line ~5754)."""
        bwd = self.bust - self.waist
        hwd = self.hip - self.waist
        shr = (self.shoulder_width / (self.hip / math.pi)
               if self.hip > 0 else 1.0)

        # Hourglass: big bust-waist diff AND hip-waist diff, balanced shoulders
        if (bwd >= 7 and hwd >= 7 and 0.85 <= shr <= 1.15):  # shr uses hip/π as width proxy
            return BodyShape.HOURGLASS
        # Pear: hip-waist diff dominant, narrow shoulders
        if hwd >= 7 and hwd > bwd + 2 and shr < 1.05:
            return BodyShape.PEAR
        # Apple: minimal diffs, WHR high
        if bwd < 5 and hwd < 5 and self.whr > 0.85:
            return BodyShape.APPLE
        # Inverted triangle: shoulders much wider than hips
        if self.shoulder_hip_diff > 3:
            return BodyShape.INVERTED_TRIANGLE
        # Rectangle: everything close
        return BodyShape.RECTANGLE

    @property
    def body_tags(self) -> List[str]:
        """Generate body classification tags (domain 2 line ~8799)."""
        tags = []
        if self.height < 63:
            tags.append("petite")
        if self.height > 68:
            tags.append("tall")
        if self.hip - self.bust >= 3 and self.whr < 0.78:
            tags.append("pear")
        if self.whr > 0.85:
            tags.append("apple")
        if (abs(self.bust - self.hip) <= 2 and
                self.bust_differential >= 6 and self.whr <= 0.75):
            tags.append("hourglass")
        if (abs(self.bust - self.waist) <= 4 and
                abs(self.waist - self.hip) <= 4):
            tags.append("rectangle")
        if self.shoulder_hip_diff > 3:
            tags.append("inverted_triangle")
        if self.bust > 42 or self.hip > 44:
            tags.append("plus_size")
        return tags

    @property
    def torso_score(self) -> float:
        """Torso proportion score: -2 (very short) to +2 (very long).
        Based on torso_length / height ratio vs. average (~0.23)."""
        ratio = self.torso_length / self.height if self.height > 0 else 0.23
        return (ratio - 0.23) / 0.02  # each 0.02 = 1 score point

    @property
    def calf_prominence(self) -> float:
        return self.c_calf_max / self.c_calf_min if self.c_calf_min > 0 else 1.0

    @property
    def arm_prominence_combined(self) -> float:
        """Combined arm prominence (domain 2 line ~3854)."""
        if self.c_wrist <= 0 or self.c_forearm_min <= 0:
            return 1.5
        prominence_ratio = self.c_upper_arm_max / self.c_wrist
        bulge_factor = self.c_upper_arm_max / self.c_forearm_min
        return (prominence_ratio + bulge_factor) / 2


# ================================================================
# INPUT: GARMENT PROFILE
# ================================================================

@dataclass
class GarmentProfile:
    """Complete garment description merging domain 3 fabric attributes
    with domain 4 visual/perceptual properties.
    """
    # --- Fabric composition ---
    primary_fiber: str = "polyester"         # cotton, polyester, silk, wool, etc.
    primary_fiber_pct: float = 100.0
    secondary_fiber: Optional[str] = None
    secondary_fiber_pct: float = 0.0
    elastane_pct: float = 0.0
    fabric_name: Optional[str] = None        # ponte, chiffon, satin, etc.
    construction: FabricConstruction = FabricConstruction.WOVEN
    gsm_estimated: float = 150.0             # grams per square meter
    surface: SurfaceFinish = SurfaceFinish.MATTE
    surface_friction: float = 0.5            # 0=slippery, 1=grippy
    drape: float = 5.0                       # 1-10 scale (domain 3)

    # --- Silhouette ---
    category: GarmentCategory = GarmentCategory.DRESS
    silhouette: Silhouette = Silhouette.SEMI_FITTED
    expansion_rate: float = 0.05             # ER: body-fabric gap rate
    silhouette_label: str = "fitted"

    # --- Neckline ---
    neckline: NecklineType = NecklineType.CREW
    v_depth_cm: float = 0.0
    neckline_depth: Optional[float] = None   # inches

    # --- Sleeves ---
    sleeve_type: SleeveType = SleeveType.SET_IN
    sleeve_length_inches: Optional[float] = None  # from shoulder
    sleeve_ease_inches: float = 1.0

    # --- Rise & waist ---
    rise_cm: Optional[float] = None
    waistband_width_cm: float = 3.0
    waistband_stretch_pct: float = 5.0
    waist_position: str = "natural"          # empire | high | natural | drop | no_waist
    has_waist_definition: bool = False

    # --- Hemline ---
    hem_position: str = "knee"               # mini | above_knee | knee | below_knee | midi | below_calf | ankle | floor
    garment_length_inches: Optional[float] = None

    # --- Coverage ---
    covers_waist: bool = True
    covers_hips: bool = True
    zone: str = "torso"                      # torso | lower_body | full_body

    # --- Color ---
    color_lightness: float = 0.5             # 0=black, 1=white (domain 4 scale)
    color_saturation: float = 0.5            # 0=gray, 1=vivid
    color_temperature: str = "neutral"
    is_monochrome_outfit: bool = False

    # --- Pattern ---
    has_pattern: bool = False
    pattern_type: Optional[str] = None
    has_horizontal_stripes: bool = False
    has_vertical_stripes: bool = False
    stripe_width_cm: float = 0.0
    stripe_spacing_cm: float = 0.0
    pattern_scale: str = "none"              # none | small | medium | large
    pattern_scale_inches: float = 0.0
    pattern_contrast: float = 0.5

    # --- Belt ---
    has_contrasting_belt: bool = False
    has_tonal_belt: bool = False
    belt_width_cm: float = 0.0

    # --- Construction details ---
    is_structured: bool = False              # boning, lining, sculpting
    has_darts: bool = False
    has_lining: bool = False
    is_faux_wrap: bool = False
    garment_ease_inches: float = 3.0

    # --- Brand & model ---
    brand_tier: BrandTier = BrandTier.MID_MARKET
    uses_diverse_model: bool = False
    model_estimated_size: int = 2            # US size of product photo model

    # --- Garment-type identification ---
    garment_layer: GarmentLayer = GarmentLayer.BASE
    title: Optional[str] = None              # product title for classification
    fit_category: Optional[str] = None       # fitted | semi_fitted | relaxed | loose | oversized

    # --- Top-specific ---
    top_hem_length: Optional[str] = None     # at_waist | just_below_waist | at_hip | below_hip | tunic_length | cropped
    top_hem_behavior: Optional[TopHemBehavior] = None

    # --- Bottom-specific ---
    rise: Optional[str] = None               # low | mid | high | ultra_high
    leg_shape: Optional[str] = None          # skinny | slim | straight | bootcut | flare | wide_leg | palazzo | tapered | jogger
    leg_opening_width: Optional[str] = None
    bottom_length: Optional[str] = None      # ankle | full_length | cropped | capri | bermuda | short | micro

    # --- Jacket/outerwear-specific ---
    jacket_closure: Optional[str] = None     # single_breasted | double_breasted | zip | open_front | belted | toggle
    jacket_length: Optional[str] = None      # cropped | waist | hip | mid_thigh | knee | below_knee | full_length
    shoulder_structure: Optional[str] = None  # natural | padded | structured | dropped | oversized

    # --- Skirt-specific ---
    skirt_construction: Optional[str] = None  # a_line | pencil | pleated | wrap | tiered | circle | straight | tulip | asymmetric | slit

    # --- Derived convenience properties ---
    @property
    def is_dark(self) -> bool:
        return self.color_lightness < 0.25

    @property
    def sheen_index(self) -> float:
        """Map SurfaceFinish to sheen score (domain 3 FR_003)."""
        _map = {
            SurfaceFinish.DEEP_MATTE: 0.00,
            SurfaceFinish.MATTE: 0.10,
            SurfaceFinish.SUBTLE_SHEEN: 0.25,
            SurfaceFinish.MODERATE_SHEEN: 0.50,
            SurfaceFinish.HIGH_SHINE: 0.75,
            SurfaceFinish.MAXIMUM_SHINE: 1.00,
            SurfaceFinish.CRUSHED: 0.35,
        }
        return _map.get(self.surface, 0.10)

    @property
    def drape_coefficient(self) -> float:
        """Convert 1-10 drape scale to percentage (domain 4 convention)."""
        return self.drape * 10.0  # 5 → 50%

    @property
    def cling_risk(self) -> float:
        """Estimate cling risk from fabric properties."""
        stretch = self.elastane_pct * {
            FabricConstruction.WOVEN: 1.6,
            FabricConstruction.KNIT: 4.0,
            FabricConstruction.KNIT_RIB: 5.5,
            FabricConstruction.KNIT_DOUBLE: 3.5,
            FabricConstruction.KNIT_JERSEY: 4.0,
        }.get(self.construction, 2.0)
        # High stretch + low GSM + low friction = high cling
        gsm_factor = max(0, 1.0 - self.gsm_estimated / 300.0)
        friction_factor = max(0, 1.0 - self.surface_friction)
        return min(1.0, (stretch / 20.0 + gsm_factor + friction_factor) / 3.0)


# ================================================================
# OUTPUT: SCORING RESULTS
# ================================================================

@dataclass
class PrincipleResult:
    """Result from a single principle scorer."""
    name: str
    score: float                             # -1.0 to +1.0
    reasoning: str
    weight: float = 1.0
    applicable: bool = True
    confidence: float = 0.70


@dataclass
class GoalVerdict:
    """Whether a garment helps or hurts a specific styling goal."""
    goal: StylingGoal
    verdict: str                             # pass | fail | caution
    score: float                             # weighted sum of mapped principles
    supporting_principles: List[str] = field(default_factory=list)
    reasoning: str = ""


@dataclass
class ZoneScore:
    """Score for a specific body zone."""
    zone: str                                # bust | waist | hip | thigh | knee | calf | ankle | shoulder | upper_arm
    score: float
    flags: List[str] = field(default_factory=list)


@dataclass
class ExceptionTriggered:
    """A rule exception that was triggered during scoring."""
    exception_id: str
    rule_overridden: str
    reason: str
    confidence: float = 0.70


@dataclass
class Fix:
    """A suggested fix to improve the garment's score."""
    what_to_change: str
    expected_improvement: float               # score delta
    priority: int = 1                         # 1=high, 3=low


@dataclass
class BodyAdjustedGarment:
    """Result of Piece 2 body-garment translation."""
    # Hemline
    hem_from_floor: float = 0.0              # inches
    hem_zone: str = ""                       # above_knee | knee_danger | safe_zone | calf_danger | etc.
    hemline_danger_zones: List[Tuple[float, float]] = field(default_factory=list)
    hemline_safe_zone: Optional[Tuple[float, float]] = None
    fabric_rise_adjustment: float = 0.0      # inches hemline rises from stated

    # Sleeve
    sleeve_endpoint_position: float = 0.0    # inches from shoulder
    perceived_arm_width: float = 0.0
    arm_width_delta: float = 0.0             # vs actual
    arm_prominence_severity: float = 0.5

    # Waist
    visual_waist_height: float = 0.0
    visual_leg_ratio: float = 0.618
    proportion_improvement: float = 0.0

    # Fabric behavior
    total_stretch_pct: float = 0.0
    effective_gsm: float = 150.0
    sheen_score: float = 0.10
    photo_reality_discount: float = 0.0


@dataclass
class ScoreResult:
    """Complete output of the scoring engine."""
    # Overall score
    overall_score: float = 5.0               # 0-10 scale
    composite_raw: float = 0.0               # -1 to +1 internal scale
    confidence: float = 0.70

    # Detailed breakdown
    principle_scores: List[PrincipleResult] = field(default_factory=list)
    goal_verdicts: List[GoalVerdict] = field(default_factory=list)
    zone_scores: Dict[str, ZoneScore] = field(default_factory=dict)

    # Exceptions and fixes
    exceptions: List[ExceptionTriggered] = field(default_factory=list)
    fixes: List[Fix] = field(default_factory=list)

    # Piece 2 translation
    body_adjusted: Optional[BodyAdjustedGarment] = None

    # Reasoning chain
    reasoning_chain: List[str] = field(default_factory=list)

    # Layer interaction (for jackets, coats, cardigans, vests)
    layer_modifications: Optional[dict] = None
    styling_notes: List[str] = field(default_factory=list)


# ================================================================
# UTILITY
# ================================================================

def clamp(v: float, lo: float = -1.0, hi: float = 1.0) -> float:
    """Clamp value to [lo, hi]."""
    return max(lo, min(hi, v))


def score_to_ten(raw: float) -> float:
    """Convert -1..+1 raw score to 0..10 display scale.
    -1 → 0, 0 → 5, +1 → 10."""
    return clamp(raw, -1.0, 1.0) * 5.0 + 5.0


# ================================================================
# DISPLAY SCORE RESCALING
# ================================================================
# The engine's weighted-confidence averaging compresses outputs to the
# 4.0–6.3 range on the 0-10 scale.  This makes scores unintuitive:
# 5.6 = "great" and 4.4 = "skip" are only 1.2 points apart.
#
# rescale_display() applies a piecewise linear stretch calibrated to
# the engine's actual output distribution so that:
#   - 8.0+ reads as "This Is It" (clearly great)
#   - 5.0–7.9 reads as "Smart Pick" (decent with caveats)
#   - < 5.0 reads as "Not This One" (clear skip)
#
# Mapping (from observed percentiles across scenario bank):
#   Raw 3.5–4.0  →  Display 0.5–1.0   (far below threshold)
#   Raw 4.0–4.4  →  Display 1.0–4.0   (Not This One)
#   Raw 4.5–5.0  →  Display 4.0–5.5   (weak Smart Pick / borderline NTO)
#   Raw 5.0–5.5  →  Display 5.5–7.0   (solid Smart Pick)
#   Raw 5.5–5.8  →  Display 7.0–8.0   (strong Smart Pick)
#   Raw 5.8–6.3  →  Display 8.0–9.5   (This Is It)
#   Raw 6.3–10.0 →  Display 9.5–10.0  (ceiling)
# ================================================================

_RESCALE_BREAKPOINTS = [
    # (raw_lo, raw_hi, display_lo, display_hi)
    (0.0, 3.5,  0.0, 0.5),
    (3.5, 4.0,  0.5, 1.0),
    (4.0, 4.4,  1.0, 4.0),
    (4.4, 5.0,  4.0, 5.5),
    (5.0, 5.5,  5.5, 7.0),
    (5.5, 5.8,  7.0, 8.0),
    (5.8, 6.3,  8.0, 9.5),
    (6.3, 10.0, 9.5, 10.0),
]


def rescale_display(raw_ten: float) -> float:
    """Piecewise linear rescale of a 0-10 engine score to a perceptually
    spread 0-10 display score.  Preserves ordering, stretches the
    compressed 4.0-6.3 engine band across the full intuitive range.

    Args:
        raw_ten: The output of score_to_ten() (0-10 scale, compressed).

    Returns:
        Display score on 0-10 scale with intuitive spread.
    """
    for raw_lo, raw_hi, disp_lo, disp_hi in _RESCALE_BREAKPOINTS:
        if raw_ten <= raw_hi:
            # Linear interpolation within this segment
            if raw_hi == raw_lo:
                return disp_lo
            t = (raw_ten - raw_lo) / (raw_hi - raw_lo)
            return disp_lo + t * (disp_hi - disp_lo)
    return 10.0
