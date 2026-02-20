"""
Kridha Scenario Generator — Comprehensive training data scenarios.

Strategy:
  - 18 body templates covering 5 shapes × multiple height/size combos
  - 35 garment templates spanning dresses, tops, pants, skirts, jumpsuits, jackets
  - Goal variations: same body with different goal sets → different scoring contexts
  - Total: 18 bodies × 35 garments × ~1.5 goal variations = 900+ unique scenarios

Each scenario runs through the real scoring engine for authentic ScoreResults.
"""

import random
import itertools
from typing import List, Dict, Tuple, Optional


# ================================================================
# BODY PROFILES — 18 templates
# ================================================================
# All measurements in cm. Bridge converts to inches.
# _goals is the primary goal set; _alt_goals is an alternate set for variation.

BODY_TEMPLATES = {
    # ── PEAR (narrow shoulders, wider hips) ──
    "pear_petite_std": {
        "chest_circumference": 83.82, "waist_circumference": 66.04,
        "hip_circumference": 99.06, "shoulder_breadth": 33.02,
        "neck_circumference": 30.48, "thigh_left_circumference": 60.96,
        "ankle_left_circumference": 20.32, "arm_right_length": 53.34,
        "inside_leg_height": 68.58, "height": 157.48,
        "size_category": "standard",
        "knee_from_floor": 16.0, "mid_calf_from_floor": 10.7,
        "widest_calf_from_floor": 12.0, "ankle_from_floor": 3.5,
        "natural_waist_from_shoulder": 14.0, "natural_waist_from_floor": 38.0,
        "_goals": ["slim_hips", "highlight_waist", "look_taller"],
        "_alt_goals": ["look_proportional", "look_taller"],
        "_name": "Piya",
    },
    "pear_avg_std": {
        "chest_circumference": 88.9, "waist_circumference": 71.12,
        "hip_circumference": 104.14, "shoulder_breadth": 35.56,
        "neck_circumference": 33.02, "thigh_left_circumference": 63.5,
        "ankle_left_circumference": 21.59, "arm_right_length": 58.42,
        "inside_leg_height": 76.2, "height": 165.1,
        "size_category": "standard",
        "knee_from_floor": 17.0, "mid_calf_from_floor": 11.0,
        "widest_calf_from_floor": 12.5, "ankle_from_floor": 3.5,
        "natural_waist_from_shoulder": 15.0, "natural_waist_from_floor": 39.0,
        "_goals": ["slim_hips", "look_proportional"],
        "_alt_goals": ["highlight_waist"],
        "_name": "Ananya",
    },
    "pear_tall_std": {
        "chest_circumference": 91.44, "waist_circumference": 73.66,
        "hip_circumference": 109.22, "shoulder_breadth": 36.83,
        "neck_circumference": 34.29, "thigh_left_circumference": 66.04,
        "ankle_left_circumference": 22.86, "arm_right_length": 63.5,
        "inside_leg_height": 83.82, "height": 175.26,
        "size_category": "standard",
        "knee_from_floor": 18.5, "mid_calf_from_floor": 12.0,
        "widest_calf_from_floor": 13.5, "ankle_from_floor": 3.5,
        "natural_waist_from_shoulder": 16.0, "natural_waist_from_floor": 41.5,
        "_goals": ["slim_hips", "highlight_waist"],
        "_name": "Priya",
    },
    "pear_petite_plus": {
        "chest_circumference": 101.6, "waist_circumference": 86.36,
        "hip_circumference": 119.38, "shoulder_breadth": 36.83,
        "neck_circumference": 35.56, "thigh_left_circumference": 71.12,
        "ankle_left_circumference": 24.13, "arm_right_length": 53.34,
        "inside_leg_height": 66.04, "height": 155.0,
        "size_category": "plus_size",
        "knee_from_floor": 15.5, "mid_calf_from_floor": 10.0,
        "widest_calf_from_floor": 11.5, "ankle_from_floor": 3.5,
        "natural_waist_from_shoulder": 14.0, "natural_waist_from_floor": 37.0,
        "_goals": ["slim_hips", "look_taller", "hide_midsection"],
        "_alt_goals": ["look_proportional", "slimming"],
        "_name": "Jaya",
    },

    # ── APPLE (wider middle, narrower hips/legs) ──
    "apple_petite_plus": {
        "chest_circumference": 109.22, "waist_circumference": 101.6,
        "hip_circumference": 104.14, "shoulder_breadth": 39.37,
        "neck_circumference": 40.64, "thigh_left_circumference": 63.5,
        "ankle_left_circumference": 25.4, "arm_right_length": 55.88,
        "inside_leg_height": 68.58, "height": 157.48,
        "size_category": "plus_size",
        "knee_from_floor": 15.5, "mid_calf_from_floor": 10.0,
        "widest_calf_from_floor": 11.5, "ankle_from_floor": 3.5,
        "natural_waist_from_shoulder": 14.5, "natural_waist_from_floor": 37.0,
        "_goals": ["hide_midsection", "look_taller"],
        "_alt_goals": ["slimming", "look_proportional"],
        "_name": "Meera",
    },
    "apple_avg_std": {
        "chest_circumference": 99.06, "waist_circumference": 88.9,
        "hip_circumference": 96.52, "shoulder_breadth": 38.1,
        "neck_circumference": 38.1, "thigh_left_circumference": 58.42,
        "ankle_left_circumference": 22.86, "arm_right_length": 58.42,
        "inside_leg_height": 76.2, "height": 165.1,
        "size_category": "standard",
        "knee_from_floor": 17.0, "mid_calf_from_floor": 11.0,
        "widest_calf_from_floor": 12.5, "ankle_from_floor": 3.5,
        "natural_waist_from_shoulder": 15.0, "natural_waist_from_floor": 39.0,
        "_goals": ["hide_midsection", "look_proportional"],
        "_alt_goals": ["highlight_waist"],
        "_name": "Deepa",
    },
    "apple_tall_plus": {
        "chest_circumference": 112.7, "waist_circumference": 102.76,
        "hip_circumference": 107.5, "shoulder_breadth": 42.32,
        "neck_circumference": 44.97, "thigh_left_circumference": 67.01,
        "ankle_left_circumference": 28.64, "arm_right_length": 76.0,
        "inside_leg_height": 77.66, "height": 172.72,
        "size_category": "plus_size",
        "knee_from_floor": 14.37, "mid_calf_from_floor": 9.63,
        "widest_calf_from_floor": 10.78, "ankle_from_floor": 3.5,
        "natural_waist_from_shoulder": 28.43, "natural_waist_from_floor": 39.57,
        "_goals": ["hide_midsection", "look_taller"],
        "_alt_goals": ["slimming", "minimize_arms"],
        "_name": "Kavita",
    },
    "apple_avg_plus": {
        "chest_circumference": 106.68, "waist_circumference": 96.52,
        "hip_circumference": 101.6, "shoulder_breadth": 40.64,
        "neck_circumference": 40.64, "thigh_left_circumference": 60.96,
        "ankle_left_circumference": 24.13, "arm_right_length": 58.42,
        "inside_leg_height": 73.66, "height": 162.56,
        "size_category": "plus_size",
        "knee_from_floor": 16.5, "mid_calf_from_floor": 10.5,
        "widest_calf_from_floor": 12.0, "ankle_from_floor": 3.5,
        "natural_waist_from_shoulder": 15.0, "natural_waist_from_floor": 38.5,
        "_goals": ["hide_midsection", "minimize_arms"],
        "_alt_goals": ["slimming"],
        "_name": "Sunita",
    },

    # ── HOURGLASS (balanced bust/hips, defined waist) ──
    "hourglass_petite_std": {
        "chest_circumference": 93.98, "waist_circumference": 66.04,
        "hip_circumference": 96.52, "shoulder_breadth": 35.56,
        "neck_circumference": 31.75, "thigh_left_circumference": 58.42,
        "ankle_left_circumference": 20.32, "arm_right_length": 53.34,
        "inside_leg_height": 68.58, "height": 160.02,
        "size_category": "standard",
        "knee_from_floor": 16.5, "mid_calf_from_floor": 10.5,
        "widest_calf_from_floor": 12.0, "ankle_from_floor": 3.5,
        "natural_waist_from_shoulder": 14.5, "natural_waist_from_floor": 38.5,
        "_goals": ["highlight_waist", "look_taller"],
        "_alt_goals": ["look_proportional"],
        "_name": "Neha",
    },
    "hourglass_avg_std": {
        "chest_circumference": 96.52, "waist_circumference": 68.58,
        "hip_circumference": 99.06, "shoulder_breadth": 36.83,
        "neck_circumference": 33.02, "thigh_left_circumference": 60.96,
        "ankle_left_circumference": 21.59, "arm_right_length": 58.42,
        "inside_leg_height": 76.2, "height": 167.64,
        "size_category": "standard",
        "knee_from_floor": 17.5, "mid_calf_from_floor": 11.0,
        "widest_calf_from_floor": 13.0, "ankle_from_floor": 3.5,
        "natural_waist_from_shoulder": 15.5, "natural_waist_from_floor": 40.0,
        "_goals": ["highlight_waist", "look_proportional"],
        "_alt_goals": ["slim_hips"],
        "_name": "Riya",
    },
    "hourglass_tall_std": {
        "chest_circumference": 99.06, "waist_circumference": 71.12,
        "hip_circumference": 101.6, "shoulder_breadth": 38.1,
        "neck_circumference": 34.29, "thigh_left_circumference": 63.5,
        "ankle_left_circumference": 22.86, "arm_right_length": 63.5,
        "inside_leg_height": 83.82, "height": 175.26,
        "size_category": "standard",
        "knee_from_floor": 18.5, "mid_calf_from_floor": 12.0,
        "widest_calf_from_floor": 13.5, "ankle_from_floor": 3.5,
        "natural_waist_from_shoulder": 16.0, "natural_waist_from_floor": 41.5,
        "_goals": ["highlight_waist"],
        "_name": "Isha",
    },
    "hourglass_avg_plus": {
        "chest_circumference": 111.76, "waist_circumference": 83.82,
        "hip_circumference": 114.3, "shoulder_breadth": 39.37,
        "neck_circumference": 36.83, "thigh_left_circumference": 68.58,
        "ankle_left_circumference": 25.4, "arm_right_length": 58.42,
        "inside_leg_height": 73.66, "height": 165.1,
        "size_category": "plus_size",
        "knee_from_floor": 17.0, "mid_calf_from_floor": 11.0,
        "widest_calf_from_floor": 12.5, "ankle_from_floor": 3.5,
        "natural_waist_from_shoulder": 15.0, "natural_waist_from_floor": 39.0,
        "_goals": ["highlight_waist", "slimming"],
        "_alt_goals": ["look_proportional", "minimize_arms"],
        "_name": "Lakshmi",
    },

    # ── RECTANGLE (uniform bust/waist/hips) ──
    "rectangle_avg_std": {
        "chest_circumference": 88.9, "waist_circumference": 76.2,
        "hip_circumference": 91.44, "shoulder_breadth": 34.29,
        "neck_circumference": 33.02, "thigh_left_circumference": 53.34,
        "ankle_left_circumference": 21.59, "arm_right_length": 58.42,
        "inside_leg_height": 76.2, "height": 167.64,
        "size_category": "standard",
        "knee_from_floor": 17.5, "mid_calf_from_floor": 11.0,
        "widest_calf_from_floor": 13.0, "ankle_from_floor": 3.5,
        "natural_waist_from_shoulder": 15.5, "natural_waist_from_floor": 40.0,
        "_goals": ["highlight_waist", "look_proportional"],
        "_alt_goals": ["look_taller"],
        "_name": "Sana",
    },
    "rectangle_tall_std": {
        "chest_circumference": 91.44, "waist_circumference": 78.74,
        "hip_circumference": 93.98, "shoulder_breadth": 36.83,
        "neck_circumference": 34.29, "thigh_left_circumference": 55.88,
        "ankle_left_circumference": 22.86, "arm_right_length": 63.5,
        "inside_leg_height": 83.82, "height": 175.26,
        "size_category": "standard",
        "knee_from_floor": 18.5, "mid_calf_from_floor": 12.0,
        "widest_calf_from_floor": 13.5, "ankle_from_floor": 3.5,
        "natural_waist_from_shoulder": 16.0, "natural_waist_from_floor": 41.5,
        "_goals": ["highlight_waist", "look_proportional"],
        "_name": "Tara",
    },
    "rectangle_petite_std": {
        "chest_circumference": 86.36, "waist_circumference": 73.66,
        "hip_circumference": 88.9, "shoulder_breadth": 33.02,
        "neck_circumference": 31.75, "thigh_left_circumference": 50.8,
        "ankle_left_circumference": 20.32, "arm_right_length": 53.34,
        "inside_leg_height": 68.58, "height": 157.48,
        "size_category": "standard",
        "knee_from_floor": 16.0, "mid_calf_from_floor": 10.5,
        "widest_calf_from_floor": 12.0, "ankle_from_floor": 3.5,
        "natural_waist_from_shoulder": 14.0, "natural_waist_from_floor": 38.0,
        "_goals": ["look_taller", "highlight_waist"],
        "_alt_goals": ["look_proportional"],
        "_name": "Diya",
    },

    # ── RECTANGLE (additional heights) ──
    "rectangle_very_petite_std": {
        "chest_circumference": 83.82, "waist_circumference": 71.12,
        "hip_circumference": 86.36, "shoulder_breadth": 31.75,
        "neck_circumference": 30.48, "thigh_left_circumference": 48.26,
        "ankle_left_circumference": 19.05, "arm_right_length": 50.8,
        "inside_leg_height": 63.5, "height": 149.86,  # 4'11"
        "size_category": "standard",
        "knee_from_floor": 14.5, "mid_calf_from_floor": 9.5,
        "widest_calf_from_floor": 11.0, "ankle_from_floor": 3.5,
        "natural_waist_from_shoulder": 13.0, "natural_waist_from_floor": 36.0,
        "_goals": ["look_taller", "look_proportional"],
        "_alt_goals": ["highlight_waist"],
        "_name": "Mina",
    },
    "rectangle_mid_std": {
        "chest_circumference": 91.44, "waist_circumference": 78.74,
        "hip_circumference": 93.98, "shoulder_breadth": 35.56,
        "neck_circumference": 33.02, "thigh_left_circumference": 55.88,
        "ankle_left_circumference": 22.86, "arm_right_length": 60.96,
        "inside_leg_height": 78.74, "height": 170.18,  # 5'7"
        "size_category": "standard",
        "knee_from_floor": 18.0, "mid_calf_from_floor": 11.5,
        "widest_calf_from_floor": 13.0, "ankle_from_floor": 3.5,
        "natural_waist_from_shoulder": 15.5, "natural_waist_from_floor": 40.5,
        "_goals": ["highlight_waist", "look_proportional"],
        "_alt_goals": ["look_taller"],
        "_name": "Pooja",
    },

    # ── PEAR (tall) ──
    "pear_very_tall_std": {
        "chest_circumference": 93.98, "waist_circumference": 76.2,
        "hip_circumference": 111.76, "shoulder_breadth": 38.1,
        "neck_circumference": 35.56, "thigh_left_circumference": 68.58,
        "ankle_left_circumference": 24.13, "arm_right_length": 66.04,
        "inside_leg_height": 88.9, "height": 180.34,  # 5'11"
        "size_category": "standard",
        "knee_from_floor": 19.5, "mid_calf_from_floor": 13.0,
        "widest_calf_from_floor": 14.5, "ankle_from_floor": 3.5,
        "natural_waist_from_shoulder": 16.5, "natural_waist_from_floor": 43.0,
        "_goals": ["slim_hips", "highlight_waist"],
        "_alt_goals": ["look_proportional"],
        "_name": "Rhea",
    },

    # ── HOURGLASS (very petite + tall) ──
    "hourglass_very_petite_std": {
        "chest_circumference": 91.44, "waist_circumference": 63.5,
        "hip_circumference": 93.98, "shoulder_breadth": 33.02,
        "neck_circumference": 30.48, "thigh_left_circumference": 55.88,
        "ankle_left_circumference": 19.05, "arm_right_length": 50.8,
        "inside_leg_height": 63.5, "height": 149.86,  # 4'11"
        "size_category": "standard",
        "knee_from_floor": 14.5, "mid_calf_from_floor": 9.5,
        "widest_calf_from_floor": 11.0, "ankle_from_floor": 3.5,
        "natural_waist_from_shoulder": 13.0, "natural_waist_from_floor": 36.0,
        "_goals": ["highlight_waist", "look_taller"],
        "_alt_goals": ["look_proportional"],
        "_name": "Nisha",
    },
    "hourglass_very_tall_std": {
        "chest_circumference": 101.6, "waist_circumference": 73.66,
        "hip_circumference": 104.14, "shoulder_breadth": 39.37,
        "neck_circumference": 35.56, "thigh_left_circumference": 66.04,
        "ankle_left_circumference": 24.13, "arm_right_length": 66.04,
        "inside_leg_height": 88.9, "height": 180.34,  # 5'11"
        "size_category": "standard",
        "knee_from_floor": 19.5, "mid_calf_from_floor": 13.0,
        "widest_calf_from_floor": 14.5, "ankle_from_floor": 3.5,
        "natural_waist_from_shoulder": 16.5, "natural_waist_from_floor": 43.0,
        "_goals": ["highlight_waist"],
        "_alt_goals": ["look_proportional"],
        "_name": "Shreya",
    },

    # ── APPLE (mid height) ──
    "apple_mid_std": {
        "chest_circumference": 101.6, "waist_circumference": 93.98,
        "hip_circumference": 99.06, "shoulder_breadth": 39.37,
        "neck_circumference": 38.1, "thigh_left_circumference": 60.96,
        "ankle_left_circumference": 23.5, "arm_right_length": 60.96,
        "inside_leg_height": 78.74, "height": 170.18,  # 5'7"
        "size_category": "standard",
        "knee_from_floor": 18.0, "mid_calf_from_floor": 11.5,
        "widest_calf_from_floor": 13.0, "ankle_from_floor": 3.5,
        "natural_waist_from_shoulder": 15.5, "natural_waist_from_floor": 40.5,
        "_goals": ["hide_midsection", "look_proportional"],
        "_alt_goals": ["slimming", "minimize_arms"],
        "_name": "Radha",
    },
    "apple_very_tall_plus": {
        "chest_circumference": 116.84, "waist_circumference": 106.68,
        "hip_circumference": 111.76, "shoulder_breadth": 43.18,
        "neck_circumference": 44.45, "thigh_left_circumference": 68.58,
        "ankle_left_circumference": 27.94, "arm_right_length": 66.04,
        "inside_leg_height": 86.36, "height": 177.8,  # 5'10"
        "size_category": "plus_size",
        "knee_from_floor": 19.0, "mid_calf_from_floor": 12.5,
        "widest_calf_from_floor": 14.0, "ankle_from_floor": 3.5,
        "natural_waist_from_shoulder": 16.5, "natural_waist_from_floor": 42.0,
        "_goals": ["hide_midsection", "slimming"],
        "_alt_goals": ["minimize_arms", "look_proportional"],
        "_name": "Sita",
    },

    # ── INVERTED TRIANGLE (wide shoulders, narrow hips) ──
    "invtri_avg_std": {
        "chest_circumference": 99.06, "waist_circumference": 73.66,
        "hip_circumference": 88.9, "shoulder_breadth": 40.64,
        "neck_circumference": 35.56, "thigh_left_circumference": 53.34,
        "ankle_left_circumference": 21.59, "arm_right_length": 58.42,
        "inside_leg_height": 76.2, "height": 167.64,
        "size_category": "standard",
        "knee_from_floor": 17.5, "mid_calf_from_floor": 11.0,
        "widest_calf_from_floor": 13.0, "ankle_from_floor": 3.5,
        "natural_waist_from_shoulder": 15.5, "natural_waist_from_floor": 40.0,
        "_goals": ["look_proportional"],
        "_alt_goals": ["minimize_arms", "slim_hips"],
        "_name": "Zara",
    },
    "invtri_petite_std": {
        "chest_circumference": 96.52, "waist_circumference": 71.12,
        "hip_circumference": 86.36, "shoulder_breadth": 39.37,
        "neck_circumference": 33.02, "thigh_left_circumference": 50.8,
        "ankle_left_circumference": 20.32, "arm_right_length": 53.34,
        "inside_leg_height": 68.58, "height": 157.48,
        "size_category": "standard",
        "knee_from_floor": 16.0, "mid_calf_from_floor": 10.5,
        "widest_calf_from_floor": 12.0, "ankle_from_floor": 3.5,
        "natural_waist_from_shoulder": 14.0, "natural_waist_from_floor": 38.0,
        "_goals": ["look_taller", "look_proportional", "minimize_arms"],
        "_alt_goals": ["look_proportional"],
        "_name": "Aisha",
    },
    "invtri_tall_std": {
        "chest_circumference": 101.6, "waist_circumference": 76.2,
        "hip_circumference": 91.44, "shoulder_breadth": 43.18,
        "neck_circumference": 36.83, "thigh_left_circumference": 55.88,
        "ankle_left_circumference": 22.86, "arm_right_length": 63.5,
        "inside_leg_height": 83.82, "height": 175.26,  # 5'9"
        "size_category": "standard",
        "knee_from_floor": 18.5, "mid_calf_from_floor": 12.0,
        "widest_calf_from_floor": 13.5, "ankle_from_floor": 3.5,
        "natural_waist_from_shoulder": 16.0, "natural_waist_from_floor": 41.5,
        "_goals": ["look_proportional", "minimize_arms"],
        "_alt_goals": ["highlight_waist"],
        "_name": "Kiara",
    },
}


# ================================================================
# GARMENT TEMPLATES — 35 templates
# ================================================================
# All values use bridge.py-valid enum keys.

GARMENT_TEMPLATES = {
    # ══════════════════════════════════════════
    # DRESSES (12)
    # ══════════════════════════════════════════
    "bodycon_black_vneck": {
        "garment_type": "dress", "neckline_type": "v_neck", "neckline_depth": "medium",
        "sleeve_type": "sleeveless", "silhouette_type": "bodycon",
        "waistline": "natural", "waist_definition": "defined", "fit_category": "tight",
        "color_primary": "black", "color_value": "very_dark", "color_temperature": "neutral",
        "pattern_type": "solid", "fabric_sheen": "matte", "fabric_drape": "structured",
        "fabric_weight": "medium", "fabric_primary": "Polyester",
        "stretch_percentage": 5, "hemline_position": "at_knee",
        "fabric_composition": "95% Polyester, 5% Elastane",
        "brand": "Zara", "price": "$49.99",
        "title": "Black V-Neck Bodycon Dress",
    },
    "aline_floral_mini": {
        "garment_type": "dress", "neckline_type": "sweetheart", "neckline_depth": "medium",
        "sleeve_type": "short", "sleeve_width": "relaxed", "silhouette_type": "a_line",
        "waistline": "natural", "waist_definition": "undefined", "fit_category": "relaxed",
        "color_primary": "light green", "color_value": "medium_light", "color_temperature": "cool",
        "pattern_type": "floral_small", "pattern_scale": "small", "pattern_contrast": "medium",
        "fabric_sheen": "subtle_sheen", "fabric_drape": "fluid", "fabric_weight": "light",
        "fabric_primary": "Rayon", "fabric_secondary": "Linen",
        "fabric_composition": "Shell:Rayon 70%, Linen 30%\nLining:Polyester 100%",
        "stretch_percentage": 0, "hemline_position": "mini",
        "brand": "H&M", "price": "$29.99",
        "title": "Floral Puff-Sleeved A-Line Dress",
    },
    "wrap_burgundy_midi": {
        "garment_type": "dress", "neckline_type": "v_neck", "neckline_depth": "deep",
        "sleeve_type": "full_length", "silhouette_type": "fit_and_flare",
        "waistline": "natural", "waist_definition": "defined", "fit_category": "fitted",
        "color_primary": "burgundy", "color_value": "dark", "color_temperature": "warm",
        "pattern_type": "solid", "fabric_sheen": "matte", "fabric_drape": "fluid",
        "fabric_weight": "medium", "fabric_primary": "Viscose",
        "stretch_percentage": 0, "hemline_position": "below_knee",
        "fabric_composition": "100% Viscose",
        "brand": "Reformation", "price": "$248",
        "title": "Burgundy Wrap Midi Dress",
    },
    "shein_thin_bodycon": {
        "garment_type": "dress", "neckline_type": "crew_neck", "neckline_depth": "shallow",
        "sleeve_type": "short", "silhouette_type": "bodycon",
        "waistline": "natural", "waist_definition": "undefined", "fit_category": "tight",
        "color_primary": "pink", "color_value": "medium_light", "color_temperature": "warm",
        "pattern_type": "solid", "fabric_sheen": "subtle_sheen", "fabric_drape": "fluid",
        "fabric_weight": "light", "fabric_primary": "Polyester",
        "stretch_percentage": 8, "hemline_position": "above_knee",
        "fabric_composition": "92% Polyester, 8% Elastane",
        "brand": "SHEIN", "price": "$17.99",
        "title": "SHEIN Fitted Bodycon Mini Dress",
    },
    "navy_chiffon_maxi": {
        "garment_type": "dress", "neckline_type": "v_neck", "neckline_depth": "medium",
        "sleeve_type": "sleeveless", "silhouette_type": "empire",
        "waistline": "empire", "waist_definition": "defined", "fit_category": "relaxed",
        "color_primary": "navy", "color_value": "dark", "color_temperature": "cool",
        "pattern_type": "solid", "fabric_sheen": "subtle_sheen", "fabric_drape": "fluid",
        "fabric_weight": "light", "fabric_primary": "Polyester",
        "stretch_percentage": 0, "hemline_position": "floor",
        "fabric_composition": "100% Polyester Chiffon",
        "brand": "ASOS", "price": "$65",
        "title": "Navy Chiffon Empire Maxi Dress",
    },
    "ponte_sheath_black": {
        "garment_type": "dress", "neckline_type": "boat_neck", "neckline_depth": "shallow",
        "sleeve_type": "three_quarter", "silhouette_type": "sheath",
        "waistline": "natural", "waist_definition": "defined", "fit_category": "fitted",
        "color_primary": "black", "color_value": "very_dark", "color_temperature": "neutral",
        "pattern_type": "solid", "fabric_sheen": "matte", "fabric_drape": "structured",
        "fabric_weight": "heavy", "fabric_primary": "Polyester",
        "stretch_percentage": 5, "hemline_position": "at_knee",
        "fabric_composition": "63% Polyester, 33% Rayon, 4% Spandex",
        "brand": "M.M.LaFleur", "price": "$195",
        "title": "Ponte Sheath Dress in Black",
    },
    "structured_aline_vneck": {
        "garment_type": "dress", "neckline_type": "v_neck", "neckline_depth": "deep",
        "sleeve_type": "three_quarter", "silhouette_type": "a_line",
        "waistline": "natural", "waist_definition": "defined", "fit_category": "relaxed",
        "color_primary": "black", "color_value": "very_dark", "color_temperature": "neutral",
        "pattern_type": "solid", "fabric_sheen": "matte", "fabric_drape": "structured",
        "fabric_weight": "heavy", "fabric_primary": "Polyester",
        "stretch_percentage": 3, "hemline_position": "above_knee",
        "fabric_composition": "63% Polyester, 33% Rayon, 4% Spandex",
        "brand": "M.M.LaFleur", "price": "$225",
        "title": "Structured A-Line V-Neck Dress",
    },
    "ponte_fit_flare_navy": {
        "garment_type": "dress", "neckline_type": "v_neck", "neckline_depth": "medium",
        "sleeve_type": "three_quarter", "silhouette_type": "fit_and_flare",
        "waistline": "natural", "waist_definition": "defined", "fit_category": "fitted",
        "color_primary": "navy", "color_value": "dark", "color_temperature": "cool",
        "pattern_type": "solid", "fabric_sheen": "matte", "fabric_drape": "structured",
        "fabric_weight": "heavy", "fabric_primary": "Polyester",
        "stretch_percentage": 5, "hemline_position": "above_knee",
        "fabric_composition": "63% Polyester, 33% Rayon, 4% Spandex",
        "brand": "Banana Republic", "price": "$159",
        "title": "Ponte Fit-and-Flare Dress in Navy",
    },
    "wrap_charcoal_structured": {
        "garment_type": "dress", "neckline_type": "wrap_surplice", "neckline_depth": "deep",
        "sleeve_type": "three_quarter", "silhouette_type": "wrap",
        "waistline": "natural", "waist_definition": "defined", "fit_category": "fitted",
        "color_primary": "charcoal", "color_value": "dark", "color_temperature": "neutral",
        "pattern_type": "solid", "fabric_sheen": "matte", "fabric_drape": "structured",
        "fabric_weight": "medium", "fabric_primary": "Polyester",
        "stretch_percentage": 5, "hemline_position": "above_knee",
        "fabric_composition": "68% Polyester, 28% Rayon, 4% Spandex",
        "brand": "DVF", "price": "$398",
        "title": "DVF Structured Wrap Dress",
    },
    "white_bodycon_mini": {
        "garment_type": "dress", "neckline_type": "scoop_neck", "neckline_depth": "shallow",
        "sleeve_type": "sleeveless", "silhouette_type": "bodycon",
        "waistline": "natural", "waist_definition": "undefined", "fit_category": "tight",
        "color_primary": "white", "color_value": "very_light", "color_temperature": "neutral",
        "pattern_type": "solid", "fabric_sheen": "subtle_sheen", "fabric_drape": "fluid",
        "fabric_weight": "light", "fabric_primary": "Polyester",
        "stretch_percentage": 10, "hemline_position": "mini",
        "fabric_composition": "90% Polyester, 10% Elastane",
        "brand": "SHEIN", "price": "$12.99",
        "title": "White Bodycon Mini Dress",
    },
    "tent_linen_beige": {
        "garment_type": "dress", "neckline_type": "crew_neck", "neckline_depth": "shallow",
        "sleeve_type": "short", "silhouette_type": "tent",
        "waistline": "dropped", "waist_definition": "undefined", "fit_category": "oversized",
        "color_primary": "beige", "color_value": "light", "color_temperature": "warm",
        "pattern_type": "solid", "fabric_sheen": "matte", "fabric_drape": "fluid",
        "fabric_weight": "light", "fabric_primary": "Linen",
        "stretch_percentage": 0, "hemline_position": "below_knee",
        "fabric_composition": "100% Linen",
        "brand": "Eileen Fisher", "price": "$258",
        "title": "Oversized Linen Shift Dress",
    },
    "empire_navy_aboveknee": {
        "garment_type": "dress", "neckline_type": "scoop_neck", "neckline_depth": "medium",
        "sleeve_type": "cap", "silhouette_type": "empire",
        "waistline": "empire", "waist_definition": "defined", "fit_category": "relaxed",
        "color_primary": "navy", "color_value": "dark", "color_temperature": "cool",
        "pattern_type": "solid", "fabric_sheen": "matte", "fabric_drape": "structured",
        "fabric_weight": "medium", "fabric_primary": "Polyester",
        "stretch_percentage": 3, "hemline_position": "above_knee",
        "fabric_composition": "95% Polyester, 5% Elastane",
        "brand": "Boden", "price": "$130",
        "title": "Navy Empire Waist Dress",
    },

    # ══════════════════════════════════════════
    # PANTS (7)
    # ══════════════════════════════════════════
    "wide_leg_wool_navy": {
        "garment_type": "pants", "silhouette_type": "shift",
        "waistline": "natural", "waist_definition": "defined", "fit_category": "relaxed",
        "color_primary": "navy", "color_value": "dark", "color_temperature": "cool",
        "pattern_type": "solid", "fabric_sheen": "matte", "fabric_drape": "structured",
        "fabric_weight": "medium", "fabric_primary": "Wool",
        "stretch_percentage": 2, "hemline_position": "ankle",
        "fabric_composition": "98% Wool, 2% Elastane",
        "brand": "J.Crew", "price": "$128",
        "title": "High-Rise Wide-Leg Wool Pants",
    },
    "skinny_jeans_dark": {
        "garment_type": "pants", "silhouette_type": "bodycon",
        "waistline": "natural", "waist_definition": "defined", "fit_category": "tight",
        "color_primary": "indigo", "color_value": "dark", "color_temperature": "cool",
        "pattern_type": "solid", "fabric_sheen": "matte", "fabric_drape": "structured",
        "fabric_weight": "heavy", "fabric_primary": "Cotton",
        "stretch_percentage": 2, "hemline_position": "ankle",
        "fabric_composition": "98% Cotton, 2% Elastane",
        "brand": "Levi's", "price": "$89",
        "title": "Levi's 721 High-Rise Skinny Jeans",
    },
    "palazzo_cream_light": {
        "garment_type": "pants", "silhouette_type": "shift",
        "waistline": "natural", "waist_definition": "undefined", "fit_category": "relaxed",
        "color_primary": "cream", "color_value": "light", "color_temperature": "warm",
        "pattern_type": "solid", "fabric_sheen": "subtle_sheen", "fabric_drape": "fluid",
        "fabric_weight": "light", "fabric_primary": "Rayon",
        "stretch_percentage": 0, "hemline_position": "floor",
        "fabric_composition": "100% Rayon",
        "brand": "Anthropologie", "price": "$88",
        "title": "Cream Wide Palazzo Pants",
    },
    "straight_black_structured": {
        "garment_type": "pants", "silhouette_type": "column",
        "waistline": "natural", "waist_definition": "defined", "fit_category": "fitted",
        "color_primary": "black", "color_value": "very_dark", "color_temperature": "neutral",
        "pattern_type": "solid", "fabric_sheen": "matte", "fabric_drape": "structured",
        "fabric_weight": "heavy", "fabric_primary": "Wool",
        "stretch_percentage": 3, "hemline_position": "ankle",
        "fabric_composition": "96% Wool, 4% Elastane",
        "brand": "Theory", "price": "$295",
        "title": "Structured High-Rise Straight Pants",
    },
    "chinos_khaki_cotton": {
        "garment_type": "pants", "silhouette_type": "column",
        "waistline": "natural", "waist_definition": "defined", "fit_category": "relaxed",
        "color_primary": "khaki", "color_value": "medium_light", "color_temperature": "warm",
        "pattern_type": "solid", "fabric_sheen": "matte", "fabric_drape": "structured",
        "fabric_weight": "medium", "fabric_primary": "Cotton",
        "stretch_percentage": 2, "hemline_position": "ankle",
        "fabric_composition": "98% Cotton, 2% Elastane",
        "brand": "Gap", "price": "$59.95",
        "title": "High-Rise Khaki Chinos",
    },
    "joggers_grey_knit": {
        "garment_type": "pants", "silhouette_type": "column",
        "waistline": "natural", "waist_definition": "undefined", "fit_category": "relaxed",
        "color_primary": "heather grey", "color_value": "medium", "color_temperature": "neutral",
        "pattern_type": "solid", "fabric_sheen": "matte", "fabric_drape": "fluid",
        "fabric_weight": "medium", "fabric_primary": "Cotton",
        "stretch_percentage": 5, "hemline_position": "ankle",
        "fabric_composition": "80% Cotton, 20% Polyester",
        "brand": "Nike", "price": "$65",
        "title": "French Terry Joggers",
    },
    "cropped_white_linen": {
        "garment_type": "pants", "silhouette_type": "shift",
        "waistline": "natural", "waist_definition": "defined", "fit_category": "relaxed",
        "color_primary": "white", "color_value": "very_light", "color_temperature": "neutral",
        "pattern_type": "solid", "fabric_sheen": "matte", "fabric_drape": "fluid",
        "fabric_weight": "light", "fabric_primary": "Linen",
        "stretch_percentage": 0, "hemline_position": "above_knee",
        "fabric_composition": "100% Linen",
        "brand": "Everlane", "price": "$78",
        "title": "Cropped Wide-Leg Linen Pants",
    },

    # ══════════════════════════════════════════
    # TOPS (7)
    # ══════════════════════════════════════════
    "vneck_tee_white": {
        "garment_type": "top", "neckline_type": "v_neck", "neckline_depth": "medium",
        "sleeve_type": "short", "silhouette_type": "sheath",
        "waistline": "natural", "waist_definition": "undefined", "fit_category": "fitted",
        "color_primary": "white", "color_value": "very_light", "color_temperature": "neutral",
        "pattern_type": "solid", "fabric_sheen": "matte", "fabric_drape": "fluid",
        "fabric_weight": "light", "fabric_primary": "Cotton",
        "stretch_percentage": 5, "hemline_position": "at_hip",
        "fabric_composition": "95% Cotton, 5% Elastane",
        "brand": "Uniqlo", "price": "$19.90",
        "title": "Fitted V-Neck T-Shirt",
    },
    "peplum_red_crew": {
        "garment_type": "top", "neckline_type": "crew_neck", "neckline_depth": "shallow",
        "sleeve_type": "short", "silhouette_type": "peplum",
        "waistline": "natural", "waist_definition": "defined", "fit_category": "fitted",
        "color_primary": "red", "color_value": "medium", "color_temperature": "warm",
        "pattern_type": "solid", "fabric_sheen": "matte", "fabric_drape": "structured",
        "fabric_weight": "medium", "fabric_primary": "Polyester",
        "stretch_percentage": 3, "hemline_position": "at_hip",
        "fabric_composition": "97% Polyester, 3% Spandex",
        "brand": "Ann Taylor", "price": "$79.50",
        "title": "Red Peplum Blouse",
    },
    "peplum_black_vneck": {
        "garment_type": "top", "neckline_type": "v_neck", "neckline_depth": "medium",
        "sleeve_type": "three_quarter", "silhouette_type": "peplum",
        "waistline": "natural", "waist_definition": "defined", "fit_category": "fitted",
        "color_primary": "black", "color_value": "very_dark", "color_temperature": "neutral",
        "pattern_type": "solid", "fabric_sheen": "matte", "fabric_drape": "structured",
        "fabric_weight": "medium", "fabric_primary": "Polyester",
        "stretch_percentage": 5, "hemline_position": "at_hip",
        "fabric_composition": "95% Polyester, 5% Elastane",
        "brand": "Ann Taylor", "price": "$89",
        "title": "Black V-Neck Peplum Top",
    },
    "stripe_tee_breton": {
        "garment_type": "top", "neckline_type": "crew_neck", "neckline_depth": "shallow",
        "sleeve_type": "short", "silhouette_type": "sheath",
        "waistline": "natural", "waist_definition": "undefined", "fit_category": "relaxed",
        "color_primary": "navy/white", "color_value": "medium", "color_temperature": "cool",
        "pattern_type": "horizontal_stripes", "pattern_scale": "medium", "pattern_contrast": "high",
        "fabric_sheen": "matte", "fabric_drape": "fluid",
        "fabric_weight": "light", "fabric_primary": "Cotton",
        "stretch_percentage": 5, "hemline_position": "at_hip",
        "fabric_composition": "95% Cotton, 5% Elastane",
        "brand": "J.Crew", "price": "$39.50",
        "title": "Breton Striped Tee",
    },
    "silk_blouse_ivory": {
        "garment_type": "top", "neckline_type": "v_neck", "neckline_depth": "medium",
        "sleeve_type": "full_length", "silhouette_type": "sheath",
        "waistline": "natural", "waist_definition": "undefined", "fit_category": "relaxed",
        "color_primary": "ivory", "color_value": "very_light", "color_temperature": "warm",
        "pattern_type": "solid", "fabric_sheen": "subtle_sheen", "fabric_drape": "fluid",
        "fabric_weight": "light", "fabric_primary": "Silk",
        "stretch_percentage": 0, "hemline_position": "at_hip",
        "fabric_composition": "100% Silk",
        "brand": "Equipment", "price": "$230",
        "title": "Ivory Silk Button-Down Blouse",
    },
    "bodysuit_black_scoop": {
        "garment_type": "top", "neckline_type": "scoop_neck", "neckline_depth": "medium",
        "sleeve_type": "sleeveless", "silhouette_type": "bodycon",
        "waistline": "natural", "waist_definition": "defined", "fit_category": "tight",
        "color_primary": "black", "color_value": "very_dark", "color_temperature": "neutral",
        "pattern_type": "solid", "fabric_sheen": "matte", "fabric_drape": "structured",
        "fabric_weight": "medium", "fabric_primary": "Nylon",
        "stretch_percentage": 15, "hemline_position": "at_hip",
        "fabric_composition": "85% Nylon, 15% Spandex",
        "brand": "Skims", "price": "$62",
        "title": "Skims Sculpting Bodysuit",
    },
    "tunic_olive_oversized": {
        "garment_type": "top", "neckline_type": "crew_neck", "neckline_depth": "shallow",
        "sleeve_type": "full_length", "silhouette_type": "shift",
        "waistline": "dropped", "waist_definition": "undefined", "fit_category": "oversized",
        "color_primary": "olive", "color_value": "medium_dark", "color_temperature": "warm",
        "pattern_type": "solid", "fabric_sheen": "matte", "fabric_drape": "fluid",
        "fabric_weight": "medium", "fabric_primary": "Cotton",
        "stretch_percentage": 0, "hemline_position": "below_hip",
        "fabric_composition": "100% Cotton",
        "brand": "Free People", "price": "$68",
        "title": "Oversized Cotton Tunic",
    },

    # ══════════════════════════════════════════
    # SKIRTS (4)
    # ══════════════════════════════════════════
    "pencil_skirt_black": {
        "garment_type": "skirt", "silhouette_type": "bodycon",
        "waistline": "natural", "waist_definition": "defined", "fit_category": "fitted",
        "color_primary": "black", "color_value": "very_dark", "color_temperature": "neutral",
        "pattern_type": "solid", "fabric_sheen": "matte", "fabric_drape": "structured",
        "fabric_weight": "medium", "fabric_primary": "Polyester",
        "stretch_percentage": 5, "hemline_position": "at_knee",
        "fabric_composition": "63% Polyester, 33% Rayon, 4% Spandex",
        "brand": "Express", "price": "$69.90",
        "title": "High-Waist Pencil Skirt",
    },
    "pleated_midi_emerald": {
        "garment_type": "skirt", "silhouette_type": "a_line",
        "waistline": "natural", "waist_definition": "defined", "fit_category": "relaxed",
        "color_primary": "emerald", "color_value": "medium", "color_temperature": "cool",
        "pattern_type": "solid", "fabric_sheen": "moderate_sheen", "fabric_drape": "fluid",
        "fabric_weight": "light", "fabric_primary": "Polyester",
        "stretch_percentage": 0, "hemline_position": "below_knee",
        "has_pleats": True,
        "fabric_composition": "100% Polyester",
        "brand": "H&M", "price": "$34.99",
        "title": "Pleated Satin Midi Skirt",
    },
    "aline_denim_mini": {
        "garment_type": "skirt", "silhouette_type": "a_line",
        "waistline": "natural", "waist_definition": "defined", "fit_category": "relaxed",
        "color_primary": "medium blue", "color_value": "medium", "color_temperature": "cool",
        "pattern_type": "solid", "fabric_sheen": "matte", "fabric_drape": "structured",
        "fabric_weight": "heavy", "fabric_primary": "Cotton",
        "stretch_percentage": 2, "hemline_position": "above_knee",
        "fabric_composition": "98% Cotton, 2% Elastane",
        "brand": "Madewell", "price": "$78",
        "title": "Denim A-Line Mini Skirt",
    },
    "wrap_skirt_floral": {
        "garment_type": "skirt", "silhouette_type": "wrap",
        "waistline": "natural", "waist_definition": "defined", "fit_category": "fitted",
        "color_primary": "navy/floral", "color_value": "dark", "color_temperature": "cool",
        "pattern_type": "floral_small", "pattern_scale": "small", "pattern_contrast": "medium",
        "fabric_sheen": "matte", "fabric_drape": "fluid",
        "fabric_weight": "medium", "fabric_primary": "Viscose",
        "stretch_percentage": 0, "hemline_position": "at_knee",
        "fabric_composition": "100% Viscose",
        "brand": "& Other Stories", "price": "$79",
        "title": "Floral Wrap Midi Skirt",
    },

    # ══════════════════════════════════════════
    # JUMPSUITS & ROMPERS (2)
    # ══════════════════════════════════════════
    "jumpsuit_black_vneck": {
        "garment_type": "jumpsuit", "neckline_type": "v_neck", "neckline_depth": "deep",
        "sleeve_type": "sleeveless", "silhouette_type": "fit_and_flare",
        "waistline": "natural", "waist_definition": "defined", "fit_category": "fitted",
        "color_primary": "black", "color_value": "very_dark", "color_temperature": "neutral",
        "pattern_type": "solid", "fabric_sheen": "matte", "fabric_drape": "structured",
        "fabric_weight": "medium", "fabric_primary": "Polyester",
        "stretch_percentage": 3, "hemline_position": "ankle",
        "fabric_composition": "95% Polyester, 5% Elastane",
        "brand": "Banana Republic", "price": "$120",
        "title": "Black V-Neck Wide-Leg Jumpsuit",
    },
    "romper_floral_short": {
        "garment_type": "romper", "neckline_type": "v_neck", "neckline_depth": "medium",
        "sleeve_type": "flutter", "silhouette_type": "a_line",
        "waistline": "natural", "waist_definition": "defined", "fit_category": "relaxed",
        "color_primary": "yellow/floral", "color_value": "medium_light", "color_temperature": "warm",
        "pattern_type": "floral_small", "pattern_scale": "small", "pattern_contrast": "medium",
        "fabric_sheen": "matte", "fabric_drape": "fluid",
        "fabric_weight": "light", "fabric_primary": "Rayon",
        "stretch_percentage": 0, "hemline_position": "above_knee",
        "fabric_composition": "100% Rayon",
        "brand": "Free People", "price": "$88",
        "title": "Floral Flutter-Sleeve Romper",
    },

    # ══════════════════════════════════════════
    # JACKETS & OUTERWEAR (3)
    # ══════════════════════════════════════════
    "blazer_oversized_camel": {
        "garment_type": "jacket", "neckline_type": "v_neck", "neckline_depth": "medium",
        "sleeve_type": "full_length", "silhouette_type": "shift",
        "waistline": "dropped", "waist_definition": "undefined", "fit_category": "oversized",
        "color_primary": "camel", "color_value": "medium", "color_temperature": "warm",
        "pattern_type": "solid", "fabric_sheen": "matte", "fabric_drape": "structured",
        "fabric_weight": "heavy", "fabric_primary": "Wool",
        "stretch_percentage": 0, "hemline_position": "below_hip",
        "fabric_composition": "80% Wool, 20% Polyester",
        "brand": "Mango", "price": "$149",
        "title": "Oversized Wool Blazer",
    },
    "blazer_fitted_black": {
        "garment_type": "jacket", "neckline_type": "v_neck", "neckline_depth": "medium",
        "sleeve_type": "full_length", "silhouette_type": "sheath",
        "waistline": "natural", "waist_definition": "defined", "fit_category": "fitted",
        "color_primary": "black", "color_value": "very_dark", "color_temperature": "neutral",
        "pattern_type": "solid", "fabric_sheen": "matte", "fabric_drape": "structured",
        "fabric_weight": "heavy", "fabric_primary": "Wool",
        "stretch_percentage": 2, "hemline_position": "at_hip",
        "fabric_composition": "70% Wool, 25% Polyester, 5% Elastane",
        "brand": "Theory", "price": "$495",
        "title": "Fitted Single-Button Blazer",
    },
    "denim_jacket_classic": {
        "garment_type": "jacket", "neckline_type": "collared", "neckline_depth": "shallow",
        "sleeve_type": "full_length", "silhouette_type": "sheath",
        "waistline": "natural", "waist_definition": "defined", "fit_category": "fitted",
        "color_primary": "medium blue", "color_value": "medium", "color_temperature": "cool",
        "pattern_type": "solid", "fabric_sheen": "matte", "fabric_drape": "structured",
        "fabric_weight": "heavy", "fabric_primary": "Cotton",
        "stretch_percentage": 2, "hemline_position": "at_hip",
        "fabric_composition": "98% Cotton, 2% Elastane",
        "brand": "Levi's", "price": "$98",
        "title": "Classic Trucker Denim Jacket",
    },

    # ══════════════════════════════════════════
    # NTO-LEANING GARMENTS (10)
    # These are designed to score poorly for most body types —
    # thin clingy fabrics, bad hemlines, wrong proportions.
    # ══════════════════════════════════════════
    "thin_bodycon_white_midi": {
        "garment_type": "dress", "neckline_type": "crew_neck", "neckline_depth": "shallow",
        "sleeve_type": "sleeveless", "silhouette_type": "bodycon",
        "waistline": "natural", "waist_definition": "undefined", "fit_category": "tight",
        "color_primary": "white", "color_value": "very_light", "color_temperature": "neutral",
        "pattern_type": "solid", "fabric_sheen": "moderate_sheen", "fabric_drape": "fluid",
        "fabric_weight": "light", "fabric_primary": "Polyester",
        "stretch_percentage": 15, "hemline_position": "below_knee",
        "fabric_composition": "85% Polyester, 15% Elastane",
        "brand": "SHEIN", "price": "$14.99",
        "title": "White Bodycon Midi Dress",
    },
    "satin_slip_champagne": {
        "garment_type": "dress", "neckline_type": "v_neck", "neckline_depth": "deep",
        "sleeve_type": "sleeveless", "silhouette_type": "bodycon",
        "waistline": "natural", "waist_definition": "undefined", "fit_category": "tight",
        "color_primary": "champagne", "color_value": "light", "color_temperature": "warm",
        "pattern_type": "solid", "fabric_sheen": "moderate_sheen", "fabric_drape": "fluid",
        "fabric_weight": "light", "fabric_primary": "Polyester",
        "stretch_percentage": 0, "hemline_position": "below_knee",
        "fabric_composition": "100% Polyester Satin",
        "brand": "Zara", "price": "$59.90",
        "title": "Champagne Satin Slip Dress",
    },
    "oversized_tent_white": {
        "garment_type": "dress", "neckline_type": "crew_neck", "neckline_depth": "shallow",
        "sleeve_type": "short", "silhouette_type": "tent",
        "waistline": "dropped", "waist_definition": "undefined", "fit_category": "oversized",
        "color_primary": "white", "color_value": "very_light", "color_temperature": "neutral",
        "pattern_type": "solid", "fabric_sheen": "matte", "fabric_drape": "fluid",
        "fabric_weight": "light", "fabric_primary": "Cotton",
        "stretch_percentage": 0, "hemline_position": "below_knee",
        "fabric_composition": "100% Cotton Voile",
        "brand": "H&M", "price": "$24.99",
        "title": "Oversized White Cotton Shift Dress",
    },
    "drop_waist_stripe_dress": {
        "garment_type": "dress", "neckline_type": "crew_neck", "neckline_depth": "shallow",
        "sleeve_type": "short", "silhouette_type": "shift",
        "waistline": "dropped", "waist_definition": "undefined", "fit_category": "relaxed",
        "color_primary": "navy/white", "color_value": "medium", "color_temperature": "cool",
        "pattern_type": "horizontal_stripes", "pattern_scale": "wide", "pattern_contrast": "high",
        "fabric_sheen": "matte", "fabric_drape": "fluid",
        "fabric_weight": "light", "fabric_primary": "Rayon",
        "stretch_percentage": 0, "hemline_position": "at_knee",
        "fabric_composition": "100% Rayon",
        "brand": "Old Navy", "price": "$34.99",
        "title": "Striped Drop-Waist Shift Dress",
    },
    "thin_clingy_leggings": {
        "garment_type": "pants", "silhouette_type": "bodycon",
        "waistline": "natural", "waist_definition": "undefined", "fit_category": "tight",
        "color_primary": "grey", "color_value": "medium", "color_temperature": "neutral",
        "pattern_type": "solid", "fabric_sheen": "subtle_sheen", "fabric_drape": "fluid",
        "fabric_weight": "light", "fabric_primary": "Polyester",
        "stretch_percentage": 20, "hemline_position": "ankle",
        "fabric_composition": "80% Polyester, 20% Elastane",
        "brand": "SHEIN", "price": "$11.99",
        "title": "Grey Thin Stretch Leggings",
    },
    "low_rise_flare_light": {
        "garment_type": "pants", "silhouette_type": "shift",
        "waistline": "low", "waist_definition": "undefined", "fit_category": "relaxed",
        "color_primary": "light blue", "color_value": "light", "color_temperature": "cool",
        "pattern_type": "solid", "fabric_sheen": "matte", "fabric_drape": "fluid",
        "fabric_weight": "light", "fabric_primary": "Cotton",
        "stretch_percentage": 2, "hemline_position": "floor",
        "fabric_composition": "98% Cotton, 2% Elastane",
        "brand": "Free People", "price": "$78",
        "title": "Low-Rise Light Wash Flare Jeans",
    },
    "sheer_blouse_white": {
        "garment_type": "top", "neckline_type": "crew_neck", "neckline_depth": "shallow",
        "sleeve_type": "full_length", "silhouette_type": "sheath",
        "waistline": "natural", "waist_definition": "undefined", "fit_category": "relaxed",
        "color_primary": "white", "color_value": "very_light", "color_temperature": "neutral",
        "pattern_type": "solid", "fabric_sheen": "subtle_sheen", "fabric_drape": "fluid",
        "fabric_weight": "light", "fabric_primary": "Polyester",
        "stretch_percentage": 0, "hemline_position": "at_hip",
        "fabric_composition": "100% Polyester Chiffon",
        "brand": "Zara", "price": "$35.90",
        "title": "White Sheer Chiffon Blouse",
    },
    "crop_top_bright_bodycon": {
        "garment_type": "top", "neckline_type": "scoop_neck", "neckline_depth": "medium",
        "sleeve_type": "sleeveless", "silhouette_type": "bodycon",
        "waistline": "natural", "waist_definition": "undefined", "fit_category": "tight",
        "color_primary": "bright orange", "color_value": "medium_light", "color_temperature": "warm",
        "pattern_type": "solid", "fabric_sheen": "subtle_sheen", "fabric_drape": "fluid",
        "fabric_weight": "light", "fabric_primary": "Polyester",
        "stretch_percentage": 12, "hemline_position": "above_hip",
        "fabric_composition": "88% Polyester, 12% Elastane",
        "brand": "SHEIN", "price": "$8.99",
        "title": "Bright Orange Crop Top",
    },
    "satin_pencil_skirt_pink": {
        "garment_type": "skirt", "silhouette_type": "bodycon",
        "waistline": "natural", "waist_definition": "undefined", "fit_category": "tight",
        "color_primary": "hot pink", "color_value": "medium_light", "color_temperature": "warm",
        "pattern_type": "solid", "fabric_sheen": "moderate_sheen", "fabric_drape": "fluid",
        "fabric_weight": "light", "fabric_primary": "Polyester",
        "stretch_percentage": 0, "hemline_position": "at_knee",
        "fabric_composition": "100% Polyester Satin",
        "brand": "Fashion Nova", "price": "$24.99",
        "title": "Hot Pink Satin Pencil Skirt",
    },
    "wide_stripe_boxy_tee": {
        "garment_type": "top", "neckline_type": "crew_neck", "neckline_depth": "shallow",
        "sleeve_type": "short", "silhouette_type": "shift",
        "waistline": "dropped", "waist_definition": "undefined", "fit_category": "oversized",
        "color_primary": "red/white", "color_value": "medium_light", "color_temperature": "warm",
        "pattern_type": "horizontal_stripes", "pattern_scale": "wide", "pattern_contrast": "high",
        "fabric_sheen": "matte", "fabric_drape": "fluid",
        "fabric_weight": "light", "fabric_primary": "Cotton",
        "stretch_percentage": 5, "hemline_position": "below_hip",
        "fabric_composition": "100% Cotton",
        "brand": "Gap", "price": "$29.95",
        "title": "Wide-Stripe Boxy T-Shirt",
    },
}


# ================================================================
# GOAL VARIATIONS — same body, different goal sets
# ================================================================

def _generate_goal_variations(body_key: str, body_template: dict) -> List[Tuple[str, List[str]]]:
    """Return list of (variation_suffix, goals) pairs for a body template."""
    primary = body_template.get("_goals", [])
    alt = body_template.get("_alt_goals", None)

    variations = [("", primary)]
    if alt:
        variations.append(("_altgoal", alt))
    return variations


# ================================================================
# SCENARIO GENERATION
# ================================================================

def generate_all_scenarios() -> List[Dict]:
    """
    Generate all body × garment × goal-variation combinations.
    Returns list of scenario dicts.
    """
    scenarios = []

    for body_key, body_template in BODY_TEMPLATES.items():
        goal_variations = _generate_goal_variations(body_key, body_template)
        measurements = {k: v for k, v in body_template.items() if not k.startswith("_")}
        name = body_template.get("_name", "User")

        for goal_suffix, goals in goal_variations:
            for garment_key, garment_template in GARMENT_TEMPLATES.items():
                scenario_id = f"{body_key}{goal_suffix}__{garment_key}"
                scenarios.append({
                    "scenario_id": scenario_id,
                    "body_key": body_key,
                    "garment_key": garment_key,
                    "user_measurements": measurements,
                    "garment_attributes": dict(garment_template),
                    "styling_goals": goals,
                    "user_name": name,
                })

    return scenarios


def generate_scenarios_by_verdict() -> Dict[str, List[Dict]]:
    """
    Generate scenarios and organize by verdict tier.
    Runs each through the real scoring engine.
    """
    from engine.bridge import build_body_profile, build_garment_profile
    from engine.kridha_engine import score_garment
    from engine.scoring_service import dataclass_to_dict

    all_scenarios = generate_all_scenarios()
    by_verdict = {"this_is_it": [], "smart_pick": [], "not_this_one": []}

    for scenario in all_scenarios:
        try:
            body = build_body_profile(
                scenario["user_measurements"],
                styling_goals=scenario["styling_goals"],
            )
            garment = build_garment_profile(scenario["garment_attributes"])
            result = score_garment(garment, body)
            result_dict = dataclass_to_dict(result)

            overall = result_dict["overall_score"]
            if overall >= 8.0:
                verdict = "this_is_it"
            elif overall >= 5.0:
                verdict = "smart_pick"
            else:
                verdict = "not_this_one"

            scenario["score_result"] = result_dict
            scenario["verdict"] = verdict
            scenario["body_profile_summary"] = {
                "height": body.height,
                "body_shape": body.body_shape.value,
                "is_petite": body.is_petite,
                "is_plus_size": body.is_plus_size,
                "styling_goals": [g.value for g in body.styling_goals],
                "name": scenario["user_name"],
                "torso_leg_ratio": getattr(body, "torso_leg_ratio", 0.50),
            }

            by_verdict[verdict].append(scenario)
        except Exception as e:
            print(f"  [SKIP] {scenario['scenario_id']}: {e}")

    return by_verdict


def get_scenario_stats(by_verdict: dict) -> dict:
    stats = {}
    for v, scenarios in by_verdict.items():
        stats[v] = {
            "count": len(scenarios),
            "body_shapes": list(set(s["body_key"].split("_")[0] for s in scenarios)),
            "garment_types": list(set(s["garment_attributes"]["garment_type"] for s in scenarios)),
            "score_range": (
                min(s["score_result"]["overall_score"] for s in scenarios) if scenarios else 0,
                max(s["score_result"]["overall_score"] for s in scenarios) if scenarios else 0,
            ),
        }
    stats["total"] = sum(s["count"] for s in stats.values())
    return stats


# ================================================================
# MAIN
# ================================================================

if __name__ == "__main__":
    print("Generating scenarios...")
    by_verdict = generate_scenarios_by_verdict()
    stats = get_scenario_stats(by_verdict)

    print(f"\nTotal scenarios: {stats['total']}")
    for v in ["this_is_it", "smart_pick", "not_this_one"]:
        s = stats[v]
        print(f"  {v}: {s['count']} scenarios")
        print(f"    Body shapes: {s['body_shapes']}")
        print(f"    Garment types: {s['garment_types']}")
        print(f"    Score range: {s['score_range'][0]:.1f} - {s['score_range'][1]:.1f}")
