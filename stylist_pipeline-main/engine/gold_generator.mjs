/**
 * Kridha Gold Output Generator — Data-driven headline + pinch generation.
 *
 * Uses the engine's rich scoring data (principle scores, reasoning chains,
 * body shape, garment category, goal verdicts) to generate personalized
 * headline + pinch for each scored scenario.
 *
 * Each output is constructed from the specific principle scores, body-garment
 * interactions, and optical effects identified by the scoring engine. The
 * principle name and score direction drive language selection, with body-shape
 * and hem-zone variants ensuring specificity.
 *
 * Used when API-based teacher models are not available.
 */

import crypto from 'crypto';

// ================================================================
// PRINCIPLE → LANGUAGE MAPPING
// Keys match the engine's principle names (case-insensitive).
// Each entry has positive/negative dicts keyed by body shape or
// hem zone, plus a fix list.
// ================================================================

const PRINCIPLE_PHRASINGS = {
    hemline: {
        positive: {
            _default: [
                "this length shows just enough leg to keep your line long",
                "the hem lands in the perfect spot — it opens up your leg line",
                "at this length, you get maximum leg elongation",
                "the hemline is exactly where you want it for your height",
            ],
            pear: [
                "this length hits above the widest part of your calf, so the eye travels straight down",
                "the hem gives your legs room to breathe — long, clean line from hip to floor",
            ],
            above_knee: [
                "the above-knee length is doing serious work — it makes your legs look miles long",
                "at this length, the eye gets an unbroken run from hem to floor",
            ],
        },
        negative: {
            _default: [
                "the hem lands at a length that chops your leg line",
                "at your height, this falls to a spot that cuts you off visually",
            ],
            knee_danger: [
                "the hem hits right at the knee — the one spot that breaks your line in half",
                "this lands in the knee danger zone, where the eye stops instead of traveling down",
            ],
            calf_danger: [
                "on your frame, this drops to mid-calf — it shortens everything below the waist",
                "the length lands in the calf zone, which visually compresses your legs",
            ],
        },
        fix: [
            "Hem it up 2-3 inches to clear the knee.",
            "Look for a version that hits above the knee.",
            "Try the petite length if available — it'll hit the right spot.",
            "A quick hem alteration would put this in the sweet spot.",
        ],
    },

    top_hemline: {
        positive: {
            _default: [
                "this top hits at the right length on your torso",
                "the length sits exactly where it should — right at the hip",
            ],
            pear: [
                "the length lands just past the hip bone — it skims without clinging",
            ],
            apple: [
                "the top is long enough to keep a clean line through the midsection",
            ],
        },
        negative: {
            _default: [
                "the top length either cuts at the widest point or rides too short",
                "where this top ends creates a visual break in the wrong spot",
            ],
            pear: [
                "on your frame, this top ends right at the widest part of the hip — it draws the eye there",
            ],
        },
        fix: [
            "Look for a top that lands just below the hip bone.",
            "Try a tunic length — it'll clear the hip and keep the line smooth.",
        ],
    },

    v_neck_elongation: {
        positive: {
            _default: [
                "the V-neckline creates a vertical channel that lengthens your torso",
                "the V-neck draws the eye downward and elongates your upper half",
                "the neckline opens up your chest and adds vertical space",
            ],
            apple: [
                "the V-neck pulls focus upward and creates breathing room through the chest",
            ],
        },
        negative: {
            _default: [
                "the crew neckline closes off your chest instead of creating vertical length",
                "the neckline sits too high — there's no vertical pull to elongate",
            ],
        },
        fix: [
            "Look for a V-neck or scoop version — it'll add vertical length.",
        ],
    },

    bodycon_mapping: {
        positive: {
            _default: [
                "the fabric has enough structure to sculpt rather than cling",
                "the stretch is in the right range — it follows your shape without mapping to it",
            ],
            hourglass: [
                "the fabric skims your curves without clinging — it lets your shape do the work",
            ],
        },
        negative: {
            _default: [
                "the fabric follows every contour instead of creating a smooth line",
                "without enough structure, this maps to your body instead of skimming past",
                "the fabric is so fluid it drapes onto your body like water — there's no structure to smooth",
                "lightweight fabric like this clings and drapes at the same time — it reveals instead of sculpts",
            ],
            pear: [
                "the fabric clings through the hip instead of skimming past it",
                "the fluid drape pools at the hip and clings — you need fabric that skims, not settles",
            ],
            apple: [
                "the fabric doesn't have enough weight to smooth through the midsection",
                "fluid fabric like this drapes onto the midsection instead of bridging over it",
            ],
        },
        fix: [
            "Look for ponte or sculpting fabric — thick enough to create its own shape.",
            "A version with compression lining would do the work for you.",
            "Try a fabric with more structure — you want it to hold, not follow.",
        ],
    },

    dark_black_slimming: {
        positive: {
            _default: [
                "the dark color creates a continuous visual column — very slimming",
                "in this shade, the eye reads one unbroken line from top to hem",
                "the dark tone does the slimming work — clean, unbroken color",
            ],
        },
        negative: {
            _default: [
                "the lighter color expands the silhouette slightly",
                "the pale shade reflects more light, which makes the fabric read wider",
            ],
        },
        fix: [
            "Try a darker version — navy, black, or deep olive will do the slimming work.",
        ],
    },

    a_line_balance: {
        positive: {
            _default: [
                "the A-line shape skims past the hips and creates a balanced silhouette",
                "the flare from the waist does exactly what you want — it balances your proportions",
            ],
            pear: [
                "the A-line flare is your best friend — it flows over the hip without clinging",
                "this shape works with your proportions instead of fighting them",
            ],
        },
        negative: {
            _default: [
                "the stiff fabric turns the A-line into a shelf instead of a smooth flare",
                "the flare doesn't flow — it sticks out and adds width instead of draping",
            ],
        },
        fix: [
            "Look for a softer fabric that drapes into a natural flare.",
        ],
    },

    tent_concealment: {
        positive: {
            _default: [
                "the relaxed shape gives you room without losing your frame entirely",
            ],
        },
        negative: {
            _default: [
                "the oversized shape adds volume everywhere instead of defining you",
                "this swamps your frame — there's no waist definition to anchor the eye",
            ],
            hourglass: [
                "this hides the waist you're trying to highlight — the tent shape erases your curves",
            ],
            pear: [
                "the shift shape adds volume through the hip instead of skimming over it",
            ],
        },
        fix: [
            "Add a belt at the natural waist to create definition.",
            "Look for a version with darts or a cinched waist.",
            "Try a fit-and-flare instead — it gives room at the hip without swamping you.",
        ],
    },

    fabric_zone: {
        positive: {
            _default: [
                "the fabric weight is right — thick enough to hold its shape on you",
                "this has the structure to smooth and sculpt instead of clinging",
                "the fabric does the work — it shapes without following",
            ],
        },
        negative: {
            _default: [
                "the fabric is too lightweight to do the work you need — it'll follow instead of shape",
                "this doesn't have enough structure to keep a smooth silhouette",
                "this fabric flows like liquid — gorgeous on the hanger but it maps to your body instead of shaping",
                "the fabric weight is too light to create its own silhouette — it just drapes onto yours",
            ],
        },
        fix: [
            "Look for a fabric over 200 GSM — ponte, scuba, or structured cotton.",
            "Search for a version in a heavier fabric — you want it to hold a line, not fall into one.",
        ],
    },

    matte_zone: {
        positive: {
            _default: [
                "the matte finish doesn't catch light — it keeps the silhouette clean and slim",
                "the flat texture means no shine drawing the eye where you don't want it",
            ],
        },
        negative: {
            _default: [
                "the sheen catches light and visually expands the fabric",
                "the fabric shine adds dimension where a matte finish would keep things slim",
                "the satin finish picks up every light source — each highlight adds visual width",
                "the shine on this fabric amplifies every contour instead of keeping things flat",
            ],
        },
        fix: [
            "A matte version of this would keep the silhouette much cleaner.",
            "Look for the same style in a crepe or matte jersey — same drape, no shine.",
        ],
    },

    waist_placement: {
        positive: {
            _default: [
                "the waist sits at your natural waist — it divides your frame in the right proportion",
                "the waist placement creates the ideal split between torso and legs",
            ],
        },
        negative: {
            _default: [
                "the waist sits too low — it shortens your legs visually",
                "the drop waist doesn't land where your natural waist is — it throws off proportions",
            ],
        },
        fix: [
            "Try tucking into a high-waist bottom to create the right proportion.",
        ],
    },

    neckline_compound: {
        positive: {
            _default: [
                "the neckline frames your face and opens up the chest beautifully",
                "the neckline shape works here — it creates the right visual frame for your upper half",
            ],
        },
        negative: {
            _default: [
                "the neckline closes off your frame instead of creating openness",
            ],
        },
        fix: [
            "A different neckline shape would frame your face better.",
        ],
    },

    color_value: {
        positive: {
            _default: [
                "this shade works in your favor — it keeps the line slim and clean",
                "the color tone does quiet slimming work",
            ],
        },
        negative: {
            _default: [
                "the light color expands the silhouette — a deeper shade would slim more",
            ],
        },
        fix: [
            "Try a darker shade — it'll keep the line sleeker.",
        ],
    },

    sleeve: {
        positive: {
            _default: [
                "the sleeve length is right — it ends at a slim point on your arm",
                "the sleeves hit at a good spot — they don't break the arm line",
            ],
        },
        negative: {
            _default: [
                "the sleeve cuts off at the widest part of your arm, drawing attention there",
                "the sleeve endpoint creates a visual break at the wrong spot on your arm",
            ],
        },
        fix: [
            "Look for three-quarter or full-length sleeves instead.",
            "Push the sleeves up to just below the elbow for a better endpoint.",
        ],
    },

    rise_elongation: {
        positive: {
            _default: [
                "the high waist borrows from your torso and gives it to your legs",
                "this rise does serious work — it makes your legs look longer",
            ],
        },
        negative: {
            _default: [
                "the low rise shortens your leg line — you lose those extra inches",
            ],
        },
        fix: [
            "Look for a high-rise version — it'll add visual inches to your legs.",
        ],
    },

    monochrome_column: {
        positive: {
            _default: [
                "the single color creates an unbroken vertical line — the eye reads tall",
            ],
        },
        negative: {
            _default: [
                "the color break at the waist shortens your visual frame",
            ],
        },
        fix: [
            "Try a tonal outfit — keep the same color family top to bottom.",
        ],
    },

    h_stripe_thinning: {
        positive: {
            _default: [
                "the stripe pattern actually works here — the spacing creates a slimming optical illusion",
            ],
        },
        negative: {
            _default: [
                "the horizontal stripes widen the silhouette — the eye reads side to side instead of up and down",
                "the stripe width works against your slimming goals — it adds visual width",
            ],
        },
        fix: [
            "Look for vertical stripes or a solid color instead — they'll elongate.",
            "Narrow horizontal stripes can actually slim, but these are too wide.",
        ],
    },

    color_break: {
        positive: {
            _default: [
                "the color contrast at the waist anchors the eye — it defines your proportions",
                "the belt creates a focal point that draws the eye to your smallest point",
            ],
            hourglass: [
                "the color break at the waist highlights your natural shape — the contrast does the work for you",
            ],
        },
        negative: {
            _default: [
                "the color break at the waist chops your line in half — the eye stops instead of traveling",
                "the contrast band shortens your visual frame — it breaks the vertical flow",
            ],
            pear: [
                "the color change at the waist draws the eye to the widest point instead of letting it travel past",
            ],
        },
        fix: [
            "Try a tonal belt or remove the contrast — keep one color flowing through.",
            "A belt in the same color family would define without breaking the line.",
        ],
    },

    pant_rise: {
        positive: {
            _default: [
                "the rise sits at the right height — it gives your legs every possible inch",
                "the high rise borrows from your torso and adds it to your legs — instant elongation",
            ],
        },
        negative: {
            _default: [
                "the rise sits too low — you're giving up inches of leg length you could have",
                "a low rise shortens the leg line and shifts your proportions",
            ],
        },
        fix: [
            "Search for a high-rise version — it'll add visual inches to your legs.",
            "Try a mid-rise at minimum — the extra inch of rise makes a real difference.",
        ],
    },

    leg_shape: {
        positive: {
            _default: [
                "the leg shape creates a clean line from hip to hem",
                "the cut works with your frame — it follows without clinging",
            ],
            pear: [
                "the wider leg balances your hip — the eye reads a smooth column from waist to floor",
            ],
        },
        negative: {
            _default: [
                "the leg shape clings where a straighter cut would skim",
                "the cut is too narrow for the effect you want — it maps instead of flows",
            ],
            pear: [
                "the tapered leg draws attention to the hip-to-thigh ratio instead of evening it out",
            ],
        },
        fix: [
            "Look for wide-leg or straight-leg — they create a column that balances proportions.",
            "A bootcut or straight leg would give you the clean vertical line you need.",
        ],
    },

    jacket_scoring: {
        positive: {
            _default: [
                "the jacket structure creates definition exactly where you need it",
                "the tailoring works — it nips in at the waist and creates shape",
            ],
            apple: [
                "the structured shoulders balance your midsection — the jacket does the proportioning",
            ],
            pear: [
                "the jacket creates shoulder structure that balances your lower half",
            ],
        },
        negative: {
            _default: [
                "the jacket length or fit doesn't create the structure you need here",
                "the jacket doesn't define your waist — it falls too straight",
            ],
        },
        fix: [
            "Look for a blazer that nips at the waist — it'll create the hourglass structure.",
            "Try a cropped jacket that ends above the hip — it'll balance proportions better.",
        ],
    },
};

// ================================================================
// HEADLINE TEMPLATES
// ================================================================

const TII_HEADLINES = {
    dress: [
        "This is your dress.",
        "Everything about this dress works for you.",
        "This dress hits every mark.",
        "Exactly the right dress for your frame.",
        "This one's a keeper — fit and fabric both work.",
        "Yes to this dress — the shape is spot on.",
    ],
    bottom_pants: [
        "These are your pants.",
        "The fit, the rise, the length — all right.",
        "This is the cut you've been looking for.",
        "These pants do everything you need.",
        "Nailed it — this is your fit.",
    ],
    top: [
        "This top is doing everything right.",
        "The shape and fabric are spot on for you.",
        "This is exactly the top you need.",
        "Perfect silhouette for your frame.",
        "This top checks every box.",
    ],
    skirt: [
        "This skirt is the one.",
        "The length and shape are exactly right.",
        "This skirt checks every box for your goals.",
        "Exactly the right shape for you.",
    ],
    jacket: [
        "This jacket works perfectly on your frame.",
        "The structure here is exactly what you need.",
        "This jacket is doing all the right things.",
    ],
    romper: [
        "This romper is a great match for you.",
        "The proportions here are exactly right.",
        "This works — fit, length, everything.",
    ],
    bodysuit: [
        "This bodysuit does everything right.",
        "The fit and fabric work perfectly here.",
        "This is the bodysuit you want.",
    ],
};

const SP_HEADLINES = [
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
];

const NTO_HEADLINES = [
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
];

// Principle key → plain English for headlines
const HEADLINE_LABELS = {
    hemline: "length",
    top_hemline: "length",
    bodycon_cling: "fabric",
    bodycon_mapping: "fabric",
    fabric_structure: "fabric",
    fabric_zone: "fabric",
    v_neck_elongation: "neckline",
    a_line_balance: "shape",
    tent_concealment: "silhouette",
    dark_slimming: "color",
    "dark/black_slimming": "color",
    matte_zone: "finish",
    sleeve_endpoint: "sleeve length",
    sleeve: "sleeve length",
    waist_definition: "waist placement",
    waist_placement: "waist placement",
    neckline: "neckline",
    neckline_compound: "neckline",
    color_value: "color",
    color_break: "color",
    rise_elongation: "rise",
    pant_rise: "rise",
    monochrome_column: "color story",
    horizontal_stripes: "stripes",
    "h-stripe_thinning": "stripes",
    jacket_scoring: "structure",
    leg_shape: "leg cut",
};

const GARMENT_WORDS = {
    dress: "dress", top: "top", bottom_pants: "pants",
    skirt: "skirt", jacket: "jacket", romper: "romper",
    bodysuit: "bodysuit", coat: "coat",
};

// Plural garments need different grammar ("these pants" not "this pants")
const PLURAL_GARMENTS = new Set(["pants", "shorts"]);

// ================================================================
// HELPERS
// ================================================================

function pick(items, seed) {
    if (!items || items.length === 0) return "";
    const hash = crypto.createHash('md5').update(seed).digest('hex');
    const idx = parseInt(hash, 16) % items.length;
    return items[idx];
}

function cap(s) {
    return s ? s[0].toUpperCase() + s.slice(1) : s;
}

function norm(name) {
    return name.toLowerCase().trim().replace(/ /g, "_").replace(/-/g, "_").replace(/\//g, "_");
}

function phrase(principleName, direction, bodyShape, seed, hemZone = "") {
    const key = principleName.toLowerCase().trim();
    const entry = PRINCIPLE_PHRASINGS[key] || PRINCIPLE_PHRASINGS[norm(key)] || {};
    const bank = entry[direction] || {};

    if (Array.isArray(bank)) {
        return pick(bank, seed + key);
    }

    if (typeof bank !== 'object') return "";

    // Build candidate list: body-shape variants + hem-zone variants + defaults
    const candidates = [];
    if (bank[bodyShape]) candidates.push(...bank[bodyShape]);
    if (hemZone && bank[hemZone]) candidates.push(...bank[hemZone]);
    if (bank._default) candidates.push(...bank._default);

    return candidates.length > 0 ? pick(candidates, seed + key + direction + bodyShape) : "";
}

function fix(principleName, seed) {
    const key = principleName.toLowerCase().trim();
    const entry = PRINCIPLE_PHRASINGS[key] || PRINCIPLE_PHRASINGS[norm(key)] || {};
    const fixes = entry.fix || [];
    return fixes.length > 0 ? pick(fixes, seed + "fix") : "";
}

// ================================================================
// MAIN GENERATOR
// ================================================================

export function generateGoldOutput(scored) {
    const sid = scored.scenario_id;
    const verdict = scored.verdict;
    const bodyShape = scored.body_shape;
    const garmentCat = scored.garment_category;
    const topPos = scored.top_positive_key;
    const topNeg = scored.top_negative_key;

    const gWord = GARMENT_WORDS[garmentCat] || "piece";

    // Extract applicable principles sorted by |impact|
    // Use a tighter negative threshold for SP to catch subtle issues
    const principles = scored.score_result?.principle_scores || [];
    const negThreshold = verdict === "smart_pick" ? -0.01 : -0.03;
    const applicable = principles.filter(p => p.applicable !== false);
    const positives = applicable
        .filter(p => (p.score || 0) > 0.03)
        .sort((a, b) => (b.score * (b.weight || 1)) - (a.score * (a.weight || 1)));
    const negatives = applicable
        .filter(p => (p.score || 0) < negThreshold)
        .sort((a, b) => (a.score * (a.weight || 1)) - (b.score * (b.weight || 1)));

    // Hem zone from body_adjusted
    const ba = scored.score_result?.body_adjusted || {};
    const hemZone = ba.hem_zone || "";

    const headline = makeHeadline(verdict, garmentCat, gWord, topPos, topNeg, sid);
    const pinch = makePinch(verdict, bodyShape, gWord, positives, negatives, hemZone, sid);

    return { headline, pinch };
}

// ================================================================
// HEADLINE
// ================================================================

function makeHeadline(verdict, garmentCat, gWord, topPos, topNeg, sid) {
    if (verdict === "this_is_it") {
        const pool = TII_HEADLINES[garmentCat] || TII_HEADLINES.dress;
        return pick(pool, sid + "h");
    }

    const isPlural = PLURAL_GARMENTS.has(gWord);
    const fmt = {
        g: gWord,
        this_g: isPlural ? `these ${gWord}` : `this ${gWord}`,
        This_g: isPlural ? `These ${gWord}` : `This ${gWord}`,
        is_g: isPlural ? "are" : "is",
        isnt_g: isPlural ? "aren't" : "isn't",
        s: isPlural ? "" : "s",
        pos: HEADLINE_LABELS[topPos || ""] || topPos || "fit",
        neg: HEADLINE_LABELS[topNeg || ""] || topNeg || "fit",
    };

    let tpl;
    if (verdict === "smart_pick") {
        tpl = pick(SP_HEADLINES, sid + "h");
    } else {
        tpl = pick(NTO_HEADLINES, sid + "h");
    }

    return tpl.replace(/{(\w+)}/g, (_, key) => fmt[key] || key);
}

// ================================================================
// PINCH
// ================================================================

function makePinch(verdict, bodyShape, gWord, positives, negatives, hemZone, sid) {
    if (verdict === "this_is_it") {
        return pinchTII(bodyShape, gWord, positives, hemZone, sid);
    } else if (verdict === "smart_pick") {
        return pinchSP(bodyShape, gWord, positives, negatives, hemZone, sid);
    } else {
        return pinchNTO(bodyShape, gWord, positives, negatives, hemZone, sid);
    }
}

function pinchTII(bodyShape, gWord, positives, hemZone, sid) {
    const segs = [];

    if (positives.length >= 2) {
        const t1 = phrase(positives[0].name, "positive", bodyShape, sid + "p1", hemZone);
        const t2 = phrase(positives[1].name, "positive", bodyShape, sid + "p2", hemZone);
        if (t1 && t2) {
            segs.push({ text: cap(t1) + ". ", style: "positive" });
            segs.push({ text: "Plus, ", style: "normal" });
            segs.push({ text: t2 + ".", style: "positive" });
        } else if (t1) {
            segs.push({ text: cap(t1) + ".", style: "positive" });
        }

        // Optional third positive
        if (positives.length >= 3) {
            const t3 = phrase(positives[2].name, "positive", bodyShape, sid + "p3", hemZone);
            if (t3) {
                segs.push({ text: " And ", style: "normal" });
                segs.push({ text: t3 + ".", style: "positive" });
            }
        }
    } else if (positives.length === 1) {
        const t1 = phrase(positives[0].name, "positive", bodyShape, sid + "p1", hemZone);
        if (t1) {
            segs.push({ text: cap(t1) + ".", style: "positive" });
        }
    }

    // Fallback: use reasoning text from top positive
    const isPlural = PLURAL_GARMENTS.has(gWord);
    const thisG = isPlural ? `these ${gWord}` : `this ${gWord}`;

    if (segs.length === 0 && positives.length > 0) {
        segs.push({ text: `Everything about ${thisG} lines up with your proportions.`, style: "positive" });
    }

    if (segs.length === 0) {
        segs.push({ text: cap(`${thisG} aligns with your styling goals.`), style: "positive" });
    }

    // Ensure minimum 2 segments
    if (segs.length < 2) {
        segs.push({ text: " Everything lines up for your frame.", style: "positive" });
    }

    return segs;
}

function pinchSP(bodyShape, gWord, positives, negatives, hemZone, sid) {
    const segs = [];
    const isPlural = PLURAL_GARMENTS.has(gWord);
    const thisG = isPlural ? `these ${gWord}` : `this ${gWord}`;

    // Positive lead
    if (positives.length > 0) {
        const t = phrase(positives[0].name, "positive", bodyShape, sid + "p1", hemZone);
        if (t) {
            segs.push({ text: cap(t) + ". ", style: "positive" });
        }
    }

    if (segs.length === 0) {
        const verb = isPlural ? "have" : "has";
        segs.push({ text: `The shape ${verb} potential. `, style: "positive" });
    }

    // Negative
    if (negatives.length > 0) {
        const n = phrase(negatives[0].name, "negative", bodyShape, sid + "n1", hemZone);
        if (n) {
            segs.push({ text: "But ", style: "normal" });
            segs.push({ text: n + ". ", style: "negative" });

            // Fix
            const f = fix(negatives[0].name, sid + "f1");
            if (f) {
                segs.push({ text: f, style: "fix" });
            }
            return segs;
        }
    }

    // Fallback when negatives have no phrasing
    if (negatives.length > 0) {
        const name = negatives[0].name || "";
        const label = HEADLINE_LABELS[norm(name)] || name.toLowerCase();
        segs.push({ text: "But ", style: "normal" });
        segs.push({ text: `the ${label} is working against your goals here. `, style: "negative" });
        const f = fix(negatives[0].name, sid + "f1");
        if (f) {
            segs.push({ text: f, style: "fix" });
        }
    } else {
        // Borderline SP with no detectable negatives — give practical advice
        const borderlineAdvice = [
            `Check ${thisG} in person — the fabric weight will determine if it sculpts or clings.`,
            `Try ${thisG} on — the stretch and weight will feel different on your body than on screen.`,
            `The key is the fabric in person — make sure it holds its shape on your frame.`,
            `Everything looks right on paper — confirm the fabric weight works when you try it on.`,
        ];
        segs.push({ text: pick(borderlineAdvice, sid + "borderline"), style: "normal" });
    }

    return segs;
}

function pinchNTO(bodyShape, gWord, positives, negatives, hemZone, sid) {
    const segs = [];

    // Must lead positive (guardrail Rule 6)
    if (positives.length > 0) {
        const t = phrase(positives[0].name, "positive", bodyShape, sid + "p1", hemZone);
        if (t) {
            segs.push({ text: cap(t) + ". ", style: "positive" });
        }
    }
    if (segs.length === 0) {
        segs.push({ text: "The design idea is right. ", style: "positive" });
    }

    // Primary negative — the dealbreaker
    if (negatives.length > 0) {
        const n1 = phrase(negatives[0].name, "negative", bodyShape, sid + "n1", hemZone);
        if (n1) {
            segs.push({ text: "But ", style: "normal" });
            segs.push({ text: n1 + ". ", style: "negative" });
        } else {
            const name = negatives[0].name || "";
            const label = HEADLINE_LABELS[norm(name)] || name.toLowerCase();
            segs.push({ text: "But ", style: "normal" });
            segs.push({ text: `the ${label} is a dealbreaker here. `, style: "negative" });
        }

        // Optional second negative if strong
        if (negatives.length >= 2 && negatives[1].score < -0.10) {
            const n2 = phrase(negatives[1].name, "negative", bodyShape, sid + "n2", hemZone);
            if (n2) {
                segs.push({ text: "And ", style: "normal" });
                segs.push({ text: n2 + ". ", style: "negative" });
            }
        }
    }

    const isPlural = PLURAL_GARMENTS.has(gWord);
    const thisG = isPlural ? `these ${gWord}` : `this ${gWord}`;
    if (!segs.some(s => s.style === "negative")) {
        segs.push({ text: cap(`${thisG} doesn't align with your styling goals. `), style: "negative" });
    }

    // Redirect — tell them what to search for instead (NOT a fix for this garment)
    const redirect = ntoRedirect(negatives, gWord, sid);
    segs.push({ text: redirect, style: "fix" });

    return segs;
}

// NTO redirect phrasings keyed by top negative principle
const NTO_REDIRECTS = {
    hemline: [
        "Search for a petite-length {g} — it'll hit the right spot on your frame.",
        "Look for a {g} with an above-knee or midi hem that clears the danger zone.",
    ],
    bodycon_cling: [
        "Search for a sculpting {g} in ponte or structured knit — thick enough to shape, not cling.",
        "Look for a {g} with compression fabric that smooths instead of maps.",
    ],
    bodycon_mapping: [
        "Search for a sculpting {g} in ponte or structured knit — thick enough to shape, not cling.",
        "Look for a {g} with compression fabric that smooths instead of maps.",
    ],
    fabric_structure: [
        "Search for a {g} in ponte, scuba, or structured cotton — 250+ GSM does the work.",
        "Look for a {g} where the fabric creates its own shape instead of conforming to yours.",
    ],
    fabric_zone: [
        "Search for a {g} in ponte, scuba, or structured cotton — 250+ GSM does the work.",
        "Look for a {g} where the fabric creates its own shape instead of conforming to yours.",
    ],
    tent_concealment: [
        "Search for a fit-and-flare {g} — it gives room at the hip without swamping your frame.",
        "Look for a {g} with waist definition — darts, a belt, or a cinched seam.",
    ],
    waist_definition: [
        "Search for a high-waist {g} that nips in at your natural waist.",
        "Look for a {g} with a defined waistline — it'll anchor your proportions.",
    ],
    waist_placement: [
        "Search for a high-waist {g} that nips in at your natural waist.",
        "Look for a {g} with a defined waistline — it'll anchor your proportions.",
    ],
    v_neck_elongation: [
        "Search for a V-neck version — it'll create the vertical pull you need.",
        "Look for a {g} with a deeper neckline to open up your chest and elongate.",
    ],
    a_line_balance: [
        "Search for a fit-and-flare or A-line in a softer drape — the shape is right, the fabric isn't.",
        "Look for a {g} where the flare flows naturally instead of sticking out.",
    ],
    color_break: [
        "Search for a tonal {g} — one color top to bottom creates a longer line.",
        "Look for a {g} without a contrasting waistband — keep the vertical flow unbroken.",
    ],
    matte_zone: [
        "Search for a matte or crepe version — same silhouette, no shine amplifying contours.",
        "Look for a {g} in matte jersey or ponte — the fabric does the same work without the sheen.",
    ],
    pant_rise: [
        "Search for a high-rise {g} — the extra inches of rise add visual leg length.",
        "Look for high-waist {g} — the rise is where your leg line starts.",
    ],
    leg_shape: [
        "Search for wide-leg or straight-leg {g} — they create a column that balances proportions.",
        "Look for a {g} with a wider leg opening — it'll even out the silhouette.",
    ],
    _default: [
        "Search for a structured {g} that works with your frame instead of against it.",
        "Look for a {g} built for your goals — the right fabric and fit exist.",
    ],
};

function ntoRedirect(negatives, gWord, sid) {
    let topNegKey = "";
    if (negatives.length > 0) {
        topNegKey = norm(negatives[0].name || "");
    }
    const pool = NTO_REDIRECTS[topNegKey] || NTO_REDIRECTS._default;
    const template = pick(pool, sid + "redirect");
    return template.replace(/{g}/g, gWord);
}
