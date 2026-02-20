"""
Kridha Gold Output Generator — Data-driven headline + pinch generation.

Uses the engine's rich scoring data (principle scores, reasoning chains,
body shape, garment category, goal verdicts) to generate personalized
headline + pinch for each scored scenario.

Each output is constructed from the specific principle scores, body-garment
interactions, and optical effects identified by the scoring engine. The
principle name and score direction drive language selection, with body-shape
and hem-zone variants ensuring specificity.

Used when API-based teacher models are not available.
"""

import hashlib
from typing import Optional


# ================================================================
# PRINCIPLE → LANGUAGE MAPPING
# Keys match the engine's principle names (case-insensitive).
# Each entry has positive/negative dicts keyed by body shape or
# hem zone, plus a fix list.
# ================================================================

PRINCIPLE_PHRASINGS = {
    "hemline": {
        "positive": {
            "_default": [
                "this length shows just enough leg to keep your line long",
                "the hem lands in the perfect spot — it opens up your leg line",
                "at this length, you get maximum leg elongation",
                "the hemline is exactly where you want it for your height",
            ],
            "pear": [
                "this length hits above the widest part of your calf, so the eye travels straight down",
                "the hem gives your legs room to breathe — long, clean line from hip to floor",
            ],
            "above_knee": [
                "the above-knee length is doing serious work — it makes your legs look miles long",
                "at this length, the eye gets an unbroken run from hem to floor",
            ],
        },
        "negative": {
            "_default": [
                "the hem lands at a length that chops your leg line",
                "at your height, this falls to a spot that cuts you off visually",
            ],
            "knee_danger": [
                "the hem hits right at the knee — the one spot that breaks your line in half",
                "this lands in the knee danger zone, where the eye stops instead of traveling down",
            ],
            "calf_danger": [
                "on your frame, this drops to mid-calf — it shortens everything below the waist",
                "the length lands in the calf zone, which visually compresses your legs",
            ],
        },
        "fix": [
            "Hem it up 2-3 inches to clear the knee.",
            "Look for a version that hits above the knee.",
            "Try the petite length if available — it'll hit the right spot.",
            "A quick hem alteration would put this in the sweet spot.",
        ],
    },

    "top_hemline": {
        "positive": {
            "_default": [
                "this top hits at the right length on your torso",
                "the length sits exactly where it should — right at the hip",
            ],
            "pear": [
                "the length lands just past the hip bone — it skims without clinging",
            ],
            "apple": [
                "the top is long enough to keep a clean line through the midsection",
            ],
        },
        "negative": {
            "_default": [
                "the top length either cuts at the widest point or rides too short",
                "where this top ends creates a visual break in the wrong spot",
            ],
            "pear": [
                "on your frame, this top ends right at the widest part of the hip — it draws the eye there",
            ],
        },
        "fix": [
            "Look for a top that lands just below the hip bone.",
            "Try a tunic length — it'll clear the hip and keep the line smooth.",
        ],
    },

    "v_neck_elongation": {
        "positive": {
            "_default": [
                "the V-neckline creates a vertical channel that lengthens your torso",
                "the V-neck draws the eye downward and elongates your upper half",
                "the neckline opens up your chest and adds vertical space",
            ],
            "apple": [
                "the V-neck pulls focus upward and creates breathing room through the chest",
            ],
        },
        "negative": {
            "_default": [
                "the crew neckline closes off your chest instead of creating vertical length",
                "the neckline sits too high — there's no vertical pull to elongate",
            ],
        },
        "fix": [
            "Look for a V-neck or scoop version — it'll add vertical length.",
        ],
    },

    "bodycon_mapping": {
        "positive": {
            "_default": [
                "the fabric has enough structure to sculpt rather than cling",
                "the stretch is in the right range — it follows your shape without mapping to it",
            ],
            "hourglass": [
                "the fabric skims your curves without clinging — it lets your shape do the work",
            ],
        },
        "negative": {
            "_default": [
                "the fabric follows every contour instead of creating a smooth line",
                "without enough structure, this maps to your body instead of skimming past",
                "the fabric is so fluid it drapes onto your body like water — there's no structure to smooth",
                "lightweight fabric like this clings and drapes at the same time — it reveals instead of sculpts",
            ],
            "pear": [
                "the fabric clings through the hip instead of skimming past it",
                "the fluid drape pools at the hip and clings — you need fabric that skims, not settles",
            ],
            "apple": [
                "the fabric doesn't have enough weight to smooth through the midsection",
                "fluid fabric like this drapes onto the midsection instead of bridging over it",
            ],
        },
        "fix": [
            "Look for ponte or sculpting fabric — thick enough to create its own shape.",
            "A version with compression lining would do the work for you.",
            "Try a fabric with more structure — you want it to hold, not follow.",
        ],
    },

    "dark_black_slimming": {
        "positive": {
            "_default": [
                "the dark color creates a continuous visual column — very slimming",
                "in this shade, the eye reads one unbroken line from top to hem",
                "the dark tone does the slimming work — clean, unbroken color",
            ],
        },
        "negative": {
            "_default": [
                "the lighter color expands the silhouette slightly",
                "the pale shade reflects more light, which makes the fabric read wider",
            ],
        },
        "fix": [
            "Try a darker version — navy, black, or deep olive will do the slimming work.",
        ],
    },

    "a_line_balance": {
        "positive": {
            "_default": [
                "the A-line shape skims past the hips and creates a balanced silhouette",
                "the flare from the waist does exactly what you want — it balances your proportions",
            ],
            "pear": [
                "the A-line flare is your best friend — it flows over the hip without clinging",
                "this shape works with your proportions instead of fighting them",
            ],
        },
        "negative": {
            "_default": [
                "the stiff fabric turns the A-line into a shelf instead of a smooth flare",
                "the flare doesn't flow — it sticks out and adds width instead of draping",
            ],
        },
        "fix": [
            "Look for a softer fabric that drapes into a natural flare.",
        ],
    },

    "tent_concealment": {
        "positive": {
            "_default": [
                "the relaxed shape gives you room without losing your frame entirely",
            ],
        },
        "negative": {
            "_default": [
                "the oversized shape adds volume everywhere instead of defining you",
                "this swamps your frame — there's no waist definition to anchor the eye",
            ],
            "hourglass": [
                "this hides the waist you're trying to highlight — the tent shape erases your curves",
            ],
            "pear": [
                "the shift shape adds volume through the hip instead of skimming over it",
            ],
        },
        "fix": [
            "Add a belt at the natural waist to create definition.",
            "Look for a version with darts or a cinched waist.",
            "Try a fit-and-flare instead — it gives room at the hip without swamping you.",
        ],
    },

    "fabric_zone": {
        "positive": {
            "_default": [
                "the fabric weight is right — thick enough to hold its shape on you",
                "this has the structure to smooth and sculpt instead of clinging",
                "the fabric does the work — it shapes without following",
            ],
        },
        "negative": {
            "_default": [
                "the fabric is too lightweight to do the work you need — it'll follow instead of shape",
                "this doesn't have enough structure to keep a smooth silhouette",
                "this fabric flows like liquid — gorgeous on the hanger but it maps to your body instead of shaping",
                "the fabric weight is too light to create its own silhouette — it just drapes onto yours",
            ],
        },
        "fix": [
            "Look for a fabric over 200 GSM — ponte, scuba, or structured cotton.",
            "Search for a version in a heavier fabric — you want it to hold a line, not fall into one.",
        ],
    },

    "matte_zone": {
        "positive": {
            "_default": [
                "the matte finish doesn't catch light — it keeps the silhouette clean and slim",
                "the flat texture means no shine drawing the eye where you don't want it",
            ],
        },
        "negative": {
            "_default": [
                "the sheen catches light and visually expands the fabric",
                "the fabric shine adds dimension where a matte finish would keep things slim",
                "the satin finish picks up every light source — each highlight adds visual width",
                "the shine on this fabric amplifies every contour instead of keeping things flat",
            ],
        },
        "fix": [
            "A matte version of this would keep the silhouette much cleaner.",
            "Look for the same style in a crepe or matte jersey — same drape, no shine.",
        ],
    },

    "waist_placement": {
        "positive": {
            "_default": [
                "the waist sits at your natural waist — it divides your frame in the right proportion",
                "the waist placement creates the ideal split between torso and legs",
            ],
        },
        "negative": {
            "_default": [
                "the waist sits too low — it shortens your legs visually",
                "the drop waist doesn't land where your natural waist is — it throws off proportions",
            ],
        },
        "fix": [
            "Try tucking into a high-waist bottom to create the right proportion.",
        ],
    },

    "neckline_compound": {
        "positive": {
            "_default": [
                "the neckline frames your face and opens up the chest beautifully",
                "the neckline shape works here — it creates the right visual frame for your upper half",
            ],
        },
        "negative": {
            "_default": [
                "the neckline closes off your frame instead of creating openness",
            ],
        },
        "fix": [
            "A different neckline shape would frame your face better.",
        ],
    },

    "color_value": {
        "positive": {
            "_default": [
                "this shade works in your favor — it keeps the line slim and clean",
                "the color tone does quiet slimming work",
            ],
        },
        "negative": {
            "_default": [
                "the light color expands the silhouette — a deeper shade would slim more",
            ],
        },
        "fix": [
            "Try a darker shade — it'll keep the line sleeker.",
        ],
    },

    "sleeve": {
        "positive": {
            "_default": [
                "the sleeve length is right — it ends at a slim point on your arm",
                "the sleeves hit at a good spot — they don't break the arm line",
            ],
        },
        "negative": {
            "_default": [
                "the sleeve cuts off at the widest part of your arm, drawing attention there",
                "the sleeve endpoint creates a visual break at the wrong spot on your arm",
            ],
        },
        "fix": [
            "Look for three-quarter or full-length sleeves instead.",
            "Push the sleeves up to just below the elbow for a better endpoint.",
        ],
    },

    "rise_elongation": {
        "positive": {
            "_default": [
                "the high waist borrows from your torso and gives it to your legs",
                "this rise does serious work — it makes your legs look longer",
            ],
        },
        "negative": {
            "_default": [
                "the low rise shortens your leg line — you lose those extra inches",
            ],
        },
        "fix": [
            "Look for a high-rise version — it'll add visual inches to your legs.",
        ],
    },

    "monochrome_column": {
        "positive": {
            "_default": [
                "the single color creates an unbroken vertical line — the eye reads tall",
            ],
        },
        "negative": {
            "_default": [
                "the color break at the waist shortens your visual frame",
            ],
        },
        "fix": [
            "Try a tonal outfit — keep the same color family top to bottom.",
        ],
    },

    "h_stripe_thinning": {
        "positive": {
            "_default": [
                "the stripe pattern actually works here — the spacing creates a slimming optical illusion",
            ],
        },
        "negative": {
            "_default": [
                "the horizontal stripes widen the silhouette — the eye reads side to side instead of up and down",
                "the stripe width works against your slimming goals — it adds visual width",
            ],
        },
        "fix": [
            "Look for vertical stripes or a solid color instead — they'll elongate.",
            "Narrow horizontal stripes can actually slim, but these are too wide.",
        ],
    },

    "color_break": {
        "positive": {
            "_default": [
                "the color contrast at the waist anchors the eye — it defines your proportions",
                "the belt creates a focal point that draws the eye to your smallest point",
            ],
            "hourglass": [
                "the color break at the waist highlights your natural shape — the contrast does the work for you",
            ],
        },
        "negative": {
            "_default": [
                "the color break at the waist chops your line in half — the eye stops instead of traveling",
                "the contrast band shortens your visual frame — it breaks the vertical flow",
            ],
            "pear": [
                "the color change at the waist draws the eye to the widest point instead of letting it travel past",
            ],
        },
        "fix": [
            "Try a tonal belt or remove the contrast — keep one color flowing through.",
            "A belt in the same color family would define without breaking the line.",
        ],
    },

    "pant_rise": {
        "positive": {
            "_default": [
                "the rise sits at the right height — it gives your legs every possible inch",
                "the high rise borrows from your torso and adds it to your legs — instant elongation",
            ],
        },
        "negative": {
            "_default": [
                "the rise sits too low — you're giving up inches of leg length you could have",
                "a low rise shortens the leg line and shifts your proportions",
            ],
        },
        "fix": [
            "Search for a high-rise version — it'll add visual inches to your legs.",
            "Try a mid-rise at minimum — the extra inch of rise makes a real difference.",
        ],
    },

    "leg_shape": {
        "positive": {
            "_default": [
                "the leg shape creates a clean line from hip to hem",
                "the cut works with your frame — it follows without clinging",
            ],
            "pear": [
                "the wider leg balances your hip — the eye reads a smooth column from waist to floor",
            ],
        },
        "negative": {
            "_default": [
                "the leg shape clings where a straighter cut would skim",
                "the cut is too narrow for the effect you want — it maps instead of flows",
            ],
            "pear": [
                "the tapered leg draws attention to the hip-to-thigh ratio instead of evening it out",
            ],
        },
        "fix": [
            "Look for wide-leg or straight-leg — they create a column that balances proportions.",
            "A bootcut or straight leg would give you the clean vertical line you need.",
        ],
    },

    "jacket_scoring": {
        "positive": {
            "_default": [
                "the jacket structure creates definition exactly where you need it",
                "the tailoring works — it nips in at the waist and creates shape",
            ],
            "apple": [
                "the structured shoulders balance your midsection — the jacket does the proportioning",
            ],
            "pear": [
                "the jacket creates shoulder structure that balances your lower half",
            ],
        },
        "negative": {
            "_default": [
                "the jacket length or fit doesn't create the structure you need here",
                "the jacket doesn't define your waist — it falls too straight",
            ],
        },
        "fix": [
            "Look for a blazer that nips at the waist — it'll create the hourglass structure.",
            "Try a cropped jacket that ends above the hip — it'll balance proportions better.",
        ],
    },
}


# ================================================================
# HEADLINE TEMPLATES
# ================================================================

TII_HEADLINES = {
    "dress": [
        "This is your dress.",
        "Everything about this dress works for you.",
        "This dress hits every mark.",
        "Exactly the right dress for your frame.",
        "This one's a keeper — fit and fabric both work.",
        "Yes to this dress — the shape is spot on.",
    ],
    "bottom_pants": [
        "These are your pants.",
        "The fit, the rise, the length — all right.",
        "This is the cut you've been looking for.",
        "These pants do everything you need.",
        "Nailed it — this is your fit.",
    ],
    "top": [
        "This top is doing everything right.",
        "The shape and fabric are spot on for you.",
        "This is exactly the top you need.",
        "Perfect silhouette for your frame.",
        "This top checks every box.",
    ],
    "skirt": [
        "This skirt is the one.",
        "The length and shape are exactly right.",
        "This skirt checks every box for your goals.",
        "Exactly the right shape for you.",
    ],
    "jacket": [
        "This jacket works perfectly on your frame.",
        "The structure here is exactly what you need.",
        "This jacket is doing all the right things.",
    ],
    "romper": [
        "This romper is a great match for you.",
        "The proportions here are exactly right.",
        "This works — fit, length, everything.",
    ],
    "bodysuit": [
        "This bodysuit does everything right.",
        "The fit and fabric work perfectly here.",
        "This is the bodysuit you want.",
    ],
}

SP_HEADLINES = [
    "Love the {g} — one thing to sort out.",
    "Close — the {pos} is right, but the {neg} needs work.",
    "Good bones, but the {neg} is holding it back.",
    "Almost there — fix the {neg} and this works.",
    "The {g} {is_g} strong — the {neg} is the weak link.",
    "Right idea, one fix away.",
    "The {pos} works, the {neg} doesn't — but it's fixable.",
    "Really close — just the {neg} to sort out.",
    "Like the {pos} — sort out the {neg} and you're set.",
    "The {g} almost nail{s} it — {neg} is the holdup.",
    "So close — the {neg} is the only thing off.",
    "The {pos} is strong, but the {neg} needs a tweak.",
    "Great {pos}, but check the {neg} first.",
    "One fix and {this_g} work{s} for you.",
]

NTO_HEADLINES = [
    "Skip this one — the {neg} is a dealbreaker.",
    "{This_g} {isnt_g} built for what you need.",
    "Not {this_g} — the {neg} works against you.",
    "The {neg} is a dealbreaker — search for something different.",
    "Pass on this one — the {neg} can't be fixed.",
    "The {neg} on {this_g} fights your goals — skip it.",
    "Walk away — the {neg} undoes everything else.",
    "{This_g} {isnt_g} for you — the {neg} won't work.",
    "Hard pass — the {neg} is too far off for your goals.",
    "The {neg} makes this a no — here's what to search for.",
]

# Principle key → plain English for headlines
HEADLINE_LABELS = {
    "hemline": "length",
    "top_hemline": "length",
    "bodycon_cling": "fabric",
    "bodycon_mapping": "fabric",
    "fabric_structure": "fabric",
    "fabric_zone": "fabric",
    "v_neck_elongation": "neckline",
    "a_line_balance": "shape",
    "tent_concealment": "silhouette",
    "dark_slimming": "color",
    "dark/black_slimming": "color",
    "matte_zone": "finish",
    "sleeve_endpoint": "sleeve length",
    "sleeve": "sleeve length",
    "waist_definition": "waist placement",
    "waist_placement": "waist placement",
    "neckline": "neckline",
    "neckline_compound": "neckline",
    "color_value": "color",
    "color_break": "color",
    "rise_elongation": "rise",
    "pant_rise": "rise",
    "monochrome_column": "color story",
    "horizontal_stripes": "stripes",
    "h-stripe_thinning": "stripes",
    "jacket_scoring": "structure",
    "leg_shape": "leg cut",
}

GARMENT_WORDS = {
    "dress": "dress", "top": "top", "bottom_pants": "pants",
    "skirt": "skirt", "jacket": "jacket", "romper": "romper",
    "bodysuit": "bodysuit", "coat": "coat",
}

# Plural garments need different grammar ("these pants" not "this pants")
PLURAL_GARMENTS = {"pants", "shorts"}


# ================================================================
# HELPERS
# ================================================================

def _pick(items: list, seed: str) -> str:
    """Deterministic choice from list using hash seed."""
    if not items:
        return ""
    # Use only first 13 hex chars to match JS (stays within JS safe integer range)
    idx = int(hashlib.md5(seed.encode()).hexdigest()[:13], 16) % len(items)
    return items[idx]


def _cap(s: str) -> str:
    """Capitalize first letter."""
    return s[0].upper() + s[1:] if s else s


def _norm(name: str) -> str:
    """Normalize principle name for dict lookup."""
    return name.lower().strip().replace(" ", "_").replace("-", "_").replace("/", "_")


def _phrase(principle_name: str, direction: str, body_shape: str,
            seed: str, hem_zone: str = "") -> str:
    """Look up a principle phrasing. Returns empty string if not found."""
    key = principle_name.lower().strip()
    # Try exact match first, then underscore-normalized
    entry = PRINCIPLE_PHRASINGS.get(key) or PRINCIPLE_PHRASINGS.get(_norm(key), {})
    bank = entry.get(direction, {})

    if isinstance(bank, list):
        return _pick(bank, seed + key)

    if not isinstance(bank, dict):
        return ""

    # Build candidate list: body-shape variants + hem-zone variants + defaults
    candidates = []
    if body_shape in bank:
        candidates.extend(bank[body_shape])
        print(f"[PY _phrase] Added {len(bank[body_shape])} phrases for body_shape={body_shape}")
    if hem_zone and hem_zone in bank:
        candidates.extend(bank[hem_zone])
        print(f"[PY _phrase] Added {len(bank[hem_zone])} phrases for hem_zone={hem_zone}")
    if "_default" in bank:
        candidates.extend(bank["_default"])
        print(f"[PY _phrase] Added {len(bank['_default'])} default phrases")

    pick_seed = seed + key + direction + body_shape
    result = _pick(candidates, pick_seed) if candidates else ""
    print(f"[PY _phrase] key={key}, direction={direction}, body_shape={body_shape}, hem_zone={hem_zone}")
    print(f"[PY _phrase] candidates={len(candidates)}, seed={pick_seed[:30]}..., picked={result[:50]}...")
    return result


def _fix(principle_name: str, seed: str) -> str:
    """Get a fix phrasing."""
    key = principle_name.lower().strip()
    entry = PRINCIPLE_PHRASINGS.get(key) or PRINCIPLE_PHRASINGS.get(_norm(key), {})
    fixes = entry.get("fix", [])
    return _pick(fixes, seed + "fix") if fixes else ""


# ================================================================
# MAIN GENERATOR
# ================================================================

def generate_gold_output(scored: dict) -> dict:
    """Generate headline + pinch from a scored scenario dict."""
    sid = scored["scenario_id"]
    verdict = scored["verdict"]
    body_shape = scored["body_shape"]
    garment_cat = scored["garment_category"]
    top_pos = scored.get("top_positive_key")
    top_neg = scored.get("top_negative_key")

    # DEBUG LOGGING
    print(f"[PY gold_generator] scenario_id={sid}")
    print(f"[PY gold_generator] verdict={verdict}, body_shape={body_shape}, garment_cat={garment_cat}")
    print(f"[PY gold_generator] top_pos={top_pos}, top_neg={top_neg}")

    g_word = GARMENT_WORDS.get(garment_cat, "piece")

    # Extract applicable principles sorted by |impact|
    # Use a tighter negative threshold for SP to catch subtle issues
    principles = scored["score_result"].get("principle_scores", [])
    neg_threshold = -0.01 if verdict == "smart_pick" else -0.03
    applicable = [p for p in principles if p.get("applicable", True)]
    positives = sorted(
        [p for p in applicable if p.get("score", 0) > 0.03],
        key=lambda x: x["score"] * x.get("weight", 1.0), reverse=True,
    )
    negatives = sorted(
        [p for p in applicable if p.get("score", 0) < neg_threshold],
        key=lambda x: x["score"] * x.get("weight", 1.0),
    )

    # Hem zone from body_adjusted
    ba = scored["score_result"].get("body_adjusted", {}) or {}
    hem_zone = ba.get("hem_zone", "")
    print(f"[PY gold_generator] hem_zone={hem_zone}")
    print(f"[PY gold_generator] positives={[p.get('name') for p in positives[:3]]}")
    print(f"[PY gold_generator] negatives={[p.get('name') for p in negatives[:3]]}")

    headline = _make_headline(verdict, garment_cat, g_word, top_pos, top_neg, sid)
    pinch = _make_pinch(verdict, body_shape, g_word, positives, negatives, hem_zone, sid)

    return {"headline": headline, "pinch": pinch}


# ================================================================
# HEADLINE
# ================================================================

def _make_headline(verdict, garment_cat, g_word, top_pos, top_neg, sid):
    if verdict == "this_is_it":
        pool = TII_HEADLINES.get(garment_cat, TII_HEADLINES["dress"])
        return _pick(pool, sid + "h")

    is_plural = g_word in PLURAL_GARMENTS
    fmt = {
        "g": g_word,
        "this_g": f"these {g_word}" if is_plural else f"this {g_word}",
        "This_g": f"These {g_word}" if is_plural else f"This {g_word}",
        "is_g": "are" if is_plural else "is",
        "isnt_g": "aren't" if is_plural else "isn't",
        "s": "" if is_plural else "s",
        "pos": HEADLINE_LABELS.get(top_pos or "", top_pos or "fit"),
        "neg": HEADLINE_LABELS.get(top_neg or "", top_neg or "fit"),
    }

    if verdict == "smart_pick":
        seed = sid + "h"
        hash13 = hashlib.md5(seed.encode()).hexdigest()[:13]
        idx = int(hash13, 16) % len(SP_HEADLINES)
        tpl = SP_HEADLINES[idx]
        print(f"[PY headline] seed={seed}, hash13={hash13}, pool_len={len(SP_HEADLINES)}, idx={idx}, tpl={tpl[:50]}...")
    else:
        tpl = _pick(NTO_HEADLINES, sid + "h")

    return tpl.format(**fmt)


# ================================================================
# PINCH
# ================================================================

def _make_pinch(verdict, body_shape, g_word, positives, negatives, hem_zone, sid):
    if verdict == "this_is_it":
        return _pinch_tii(body_shape, g_word, positives, hem_zone, sid)
    elif verdict == "smart_pick":
        return _pinch_sp(body_shape, g_word, positives, negatives, hem_zone, sid)
    else:
        return _pinch_nto(body_shape, g_word, positives, negatives, hem_zone, sid)


def _pinch_tii(body_shape, g_word, positives, hem_zone, sid):
    """TII: 2-3 positive segments showing what works."""
    segs = []

    if len(positives) >= 2:
        t1 = _phrase(positives[0]["name"], "positive", body_shape, sid + "p1", hem_zone)
        t2 = _phrase(positives[1]["name"], "positive", body_shape, sid + "p2", hem_zone)
        if t1 and t2:
            segs.append({"text": _cap(t1) + ". ", "style": "positive"})
            segs.append({"text": "Plus, ", "style": "normal"})
            segs.append({"text": t2 + ".", "style": "positive"})
        elif t1:
            segs.append({"text": _cap(t1) + ".", "style": "positive"})

        # Optional third positive
        if len(positives) >= 3:
            t3 = _phrase(positives[2]["name"], "positive", body_shape, sid + "p3", hem_zone)
            if t3:
                segs.append({"text": " And ", "style": "normal"})
                segs.append({"text": t3 + ".", "style": "positive"})
    elif len(positives) == 1:
        t1 = _phrase(positives[0]["name"], "positive", body_shape, sid + "p1", hem_zone)
        if t1:
            segs.append({"text": _cap(t1) + ".", "style": "positive"})

    # Fallback: use reasoning text from top positive
    is_plural = g_word in PLURAL_GARMENTS
    this_g = f"these {g_word}" if is_plural else f"this {g_word}"

    if not segs and positives:
        segs.append({"text": f"Everything about {this_g} lines up with your proportions.", "style": "positive"})

    if not segs:
        segs.append({"text": _cap(f"{this_g} aligns with your styling goals."), "style": "positive"})

    # Ensure minimum 2 segments
    if len(segs) < 2:
        segs.append({"text": " Everything lines up for your frame.", "style": "positive"})

    return segs


def _pinch_sp(body_shape, g_word, positives, negatives, hem_zone, sid):
    """SP: positive → negative → fix."""
    segs = []
    is_plural = g_word in PLURAL_GARMENTS
    this_g = f"these {g_word}" if is_plural else f"this {g_word}"

    # Positive lead
    if positives:
        t = _phrase(positives[0]["name"], "positive", body_shape, sid + "p1", hem_zone)
        if t:
            segs.append({"text": _cap(t) + ". ", "style": "positive"})

    if not segs:
        verb = "have" if is_plural else "has"
        segs.append({"text": f"The shape {verb} potential. ", "style": "positive"})

    # Negative
    if negatives:
        n = _phrase(negatives[0]["name"], "negative", body_shape, sid + "n1", hem_zone)
        if n:
            segs.append({"text": "But ", "style": "normal"})
            segs.append({"text": n + ". ", "style": "negative"})

            # Fix
            f = _fix(negatives[0]["name"], sid + "f1")
            if f:
                segs.append({"text": f, "style": "fix"})
            return segs

    # Fallback when negatives have no phrasing
    if negatives:
        name = negatives[0].get("name", "")
        label = HEADLINE_LABELS.get(_norm(name), name.lower())
        segs.append({"text": "But ", "style": "normal"})
        segs.append({"text": f"the {label} is working against your goals here. ", "style": "negative"})
        f = _fix(negatives[0]["name"], sid + "f1")
        if f:
            segs.append({"text": f, "style": "fix"})
    else:
        # Borderline SP with no detectable negatives — give practical advice
        is_plural = g_word in PLURAL_GARMENTS
        this_g = f"these {g_word}" if is_plural else f"this {g_word}"
        borderline_advice = [
            f"Check {this_g} in person — the fabric weight will determine if it sculpts or clings.",
            f"Try {this_g} on — the stretch and weight will feel different on your body than on screen.",
            f"The key is the fabric in person — make sure it holds its shape on your frame.",
            f"Everything looks right on paper — confirm the fabric weight works when you try it on.",
        ]
        segs.append({"text": _pick(borderline_advice, sid + "borderline"), "style": "normal"})

    return segs


def _pinch_nto(body_shape, g_word, positives, negatives, hem_zone, sid):
    """NTO: positive lead → dealbreaker negative → redirect to search for something different.
    This is a SKIP — no fixes for this garment. Tell them what to look for instead."""
    segs = []

    # Must lead positive (guardrail Rule 6)
    if positives:
        t = _phrase(positives[0]["name"], "positive", body_shape, sid + "p1", hem_zone)
        if t:
            segs.append({"text": _cap(t) + ". ", "style": "positive"})
    if not segs:
        segs.append({"text": "The design idea is right. ", "style": "positive"})

    # Primary negative — the dealbreaker
    if negatives:
        n1 = _phrase(negatives[0]["name"], "negative", body_shape, sid + "n1", hem_zone)
        if n1:
            segs.append({"text": "But ", "style": "normal"})
            segs.append({"text": n1 + ". ", "style": "negative"})
        else:
            name = negatives[0].get("name", "")
            label = HEADLINE_LABELS.get(_norm(name), name.lower())
            segs.append({"text": "But ", "style": "normal"})
            segs.append({"text": f"the {label} is a dealbreaker here. ", "style": "negative"})

        # Optional second negative if strong
        if len(negatives) >= 2 and negatives[1]["score"] < -0.10:
            n2 = _phrase(negatives[1]["name"], "negative", body_shape, sid + "n2", hem_zone)
            if n2:
                segs.append({"text": "And ", "style": "normal"})
                segs.append({"text": n2 + ". ", "style": "negative"})

    is_plural = g_word in PLURAL_GARMENTS
    this_g = f"these {g_word}" if is_plural else f"this {g_word}"
    if not any(s["style"] == "negative" for s in segs):
        segs.append({"text": _cap(f"{this_g} doesn't align with your styling goals. "), "style": "negative"})

    # Redirect — tell them what to search for instead (NOT a fix for this garment)
    redirect = _nto_redirect(negatives, g_word, sid)
    segs.append({"text": redirect, "style": "fix"})

    return segs


# NTO redirect phrasings keyed by top negative principle
_NTO_REDIRECTS = {
    "hemline": [
        "Search for a petite-length {g} — it'll hit the right spot on your frame.",
        "Look for a {g} with an above-knee or midi hem that clears the danger zone.",
    ],
    "bodycon_cling": [
        "Search for a sculpting {g} in ponte or structured knit — thick enough to shape, not cling.",
        "Look for a {g} with compression fabric that smooths instead of maps.",
    ],
    "bodycon_mapping": [
        "Search for a sculpting {g} in ponte or structured knit — thick enough to shape, not cling.",
        "Look for a {g} with compression fabric that smooths instead of maps.",
    ],
    "fabric_structure": [
        "Search for a {g} in ponte, scuba, or structured cotton — 250+ GSM does the work.",
        "Look for a {g} where the fabric creates its own shape instead of conforming to yours.",
    ],
    "fabric_zone": [
        "Search for a {g} in ponte, scuba, or structured cotton — 250+ GSM does the work.",
        "Look for a {g} where the fabric creates its own shape instead of conforming to yours.",
    ],
    "tent_concealment": [
        "Search for a fit-and-flare {g} — it gives room at the hip without swamping your frame.",
        "Look for a {g} with waist definition — darts, a belt, or a cinched seam.",
    ],
    "waist_definition": [
        "Search for a high-waist {g} that nips in at your natural waist.",
        "Look for a {g} with a defined waistline — it'll anchor your proportions.",
    ],
    "waist_placement": [
        "Search for a high-waist {g} that nips in at your natural waist.",
        "Look for a {g} with a defined waistline — it'll anchor your proportions.",
    ],
    "v_neck_elongation": [
        "Search for a V-neck version — it'll create the vertical pull you need.",
        "Look for a {g} with a deeper neckline to open up your chest and elongate.",
    ],
    "a_line_balance": [
        "Search for a fit-and-flare or A-line in a softer drape — the shape is right, the fabric isn't.",
        "Look for a {g} where the flare flows naturally instead of sticking out.",
    ],
    "color_break": [
        "Search for a tonal {g} — one color top to bottom creates a longer line.",
        "Look for a {g} without a contrasting waistband — keep the vertical flow unbroken.",
    ],
    "matte_zone": [
        "Search for a matte or crepe version — same silhouette, no shine amplifying contours.",
        "Look for a {g} in matte jersey or ponte — the fabric does the same work without the sheen.",
    ],
    "pant_rise": [
        "Search for a high-rise {g} — the extra inches of rise add visual leg length.",
        "Look for high-waist {g} — the rise is where your leg line starts.",
    ],
    "leg_shape": [
        "Search for wide-leg or straight-leg {g} — they create a column that balances proportions.",
        "Look for a {g} with a wider leg opening — it'll even out the silhouette.",
    ],
    "_default": [
        "Search for a structured {g} that works with your frame instead of against it.",
        "Look for a {g} built for your goals — the right fabric and fit exist.",
    ],
}


def _nto_redirect(negatives: list, g_word: str, sid: str) -> str:
    """Build a redirect phrase for NTO — tells user what to search for instead."""
    top_neg_key = ""
    if negatives:
        top_neg_key = _norm(negatives[0].get("name", ""))
    pool = _NTO_REDIRECTS.get(top_neg_key, _NTO_REDIRECTS["_default"])
    template = _pick(pool, sid + "redirect")
    return template.replace("{g}", g_word)
