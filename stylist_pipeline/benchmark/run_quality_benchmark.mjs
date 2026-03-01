/**
 * Quality Benchmark — Real Product Analysis
 * ==========================================
 * Scores 51 scraped garments x 10 users, runs 5 automated quality checks,
 * generates quality_report.json + quality_summary.md
 *
 * Usage: node benchmark/run_quality_benchmark.mjs
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { scoreAndCommunicate } from '../engine/index.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Suppress engine debug logs during scoring
const origLog = console.log;
let suppressLogs = false;
console.log = (...args) => {
    if (suppressLogs) return;
    origLog(...args);
};

// ================================================================
// LOAD TEST DATA
// ================================================================

const garments = JSON.parse(readFileSync(join(__dirname, 'test_cases/scraped_garments.json'), 'utf-8'));
const users = JSON.parse(readFileSync(join(__dirname, 'test_cases/users_10.json'), 'utf-8'));

origLog(`Loaded ${garments.length} garments and ${users.length} users`);
origLog(`Running ${garments.length * users.length} combinations...\n`);

// ================================================================
// SCORE ALL COMBINATIONS
// ================================================================

const results = [];
let completed = 0;
let errorCount = 0;
const total = garments.length * users.length;

suppressLogs = true;
for (const user of users) {
    for (const garment of garments) {
        try {
            const result = scoreAndCommunicate(
                user,
                garment.merged_attrs,
                user.styling_goals,
                null,
                user.user_label.split(' —')[0]
            );

            const comm = result.communication || {};
            const scoring = result.score_result || {};

            results.push({
                garment_id: garment.garment_id,
                user_id: user.user_id,
                garment_title: garment.merged_attrs?.title || garment.raw_input?.product_text?.substring(0, 80) || 'unknown',
                garment_type_merged: garment.merged_attrs?.garment_type,
                garment_type_image: garment.bedrock_image_extraction?.garment_type,
                garment_type_text: garment.bedrock_text_extraction?.garment_type,
                user_label: user.user_label,
                overall_score: scoring.overall_score,
                composite_raw: scoring.composite_raw,
                confidence: scoring.confidence,
                verdict: comm.verdict,
                headline: comm.headline,
                pinch: comm.pinch,
                goal_chips: comm.goal_chips,
                principle_scores: (scoring.principle_scores || []).map(p => ({
                    name: p.name,
                    score: p.score,
                    weight: p.weight,
                    applicable: p.applicable,
                    reasoning: p.reasoning,
                })),
                goal_verdicts: (scoring.goal_verdicts || []).map(g => ({
                    goal: g.goal,
                    verdict: g.verdict,
                    score: g.score,
                    supporting_principles: g.supporting_principles,
                })),
                reasoning_chain: scoring.reasoning_chain || [],
                waist_definition: garment.merged_attrs?.waist_definition,
                hemline_position: garment.merged_attrs?.hemline_position,
                silhouette_type: garment.merged_attrs?.silhouette_type,
                body_shape: user.body_shape,
                user_height_cm: user.height,
                user_styling_goals: user.styling_goals,
            });
        } catch (err) {
            errorCount++;
            suppressLogs = false;
            origLog(`ERROR: ${user.user_id} x ${garment.garment_id}: ${err.message}`);
            suppressLogs = true;
            results.push({
                garment_id: garment.garment_id,
                user_id: user.user_id,
                garment_title: garment.merged_attrs?.title || 'unknown',
                overall_score: null,
                verdict: 'ERROR',
                error: err.message,
            });
        }

        completed++;
        if (completed % 50 === 0) {
            suppressLogs = false;
            origLog(`  Progress: ${completed}/${total}`);
            suppressLogs = true;
        }
    }
}
suppressLogs = false;

origLog(`\n${completed} combinations scored. ${errorCount} errors.\n`);

// ================================================================
// WRITE SCORING MATRIX
// ================================================================

writeFileSync(
    join(__dirname, 'test_cases/scraped_scoring_matrix.json'),
    JSON.stringify({ generated_at: new Date().toISOString(), total: results.length, results }, null, 2)
);
origLog('Wrote test_cases/scraped_scoring_matrix.json\n');

// ================================================================
// HELPERS
// ================================================================

function stdDev(arr) {
    if (arr.length < 2) return 0;
    const mean = arr.reduce((a, b) => a + b, 0) / arr.length;
    return Math.sqrt(arr.reduce((sum, v) => sum + (v - mean) ** 2, 0) / arr.length);
}

function median(arr) {
    const s = [...arr].sort((a, b) => a - b);
    const mid = Math.floor(s.length / 2);
    return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

function percentile(arr, p) {
    const s = [...arr].sort((a, b) => a - b);
    const idx = (p / 100) * (s.length - 1);
    const low = Math.floor(idx);
    const high = Math.ceil(idx);
    return low === high ? s[low] : s[low] + (s[high] - s[low]) * (idx - low);
}

function areRelatedTypes(a, b) {
    const equivalences = [
        new Set(['jumpsuit', 'romper']),
        new Set(['top', 'blouse', 'shirt']),
        new Set(['sweater', 'cardigan', 'pullover']),
        new Set(['pants', 'trousers']),
        new Set(['jacket', 'blazer']),
    ];
    return equivalences.some(s => s.has(a) && s.has(b));
}

// ================================================================
// CHECK A: EXTRACTION QUALITY
// ================================================================

function checkExtractionQuality(garments) {
    const flags = [];

    const TYPE_KEYWORDS = {
        top: ['top', 'blouse', 'tee', 't-shirt', 'tank', 'camisole', 'tunic', 'henley', 'polo', 'shirt'],
        dress: ['dress', 'gown', 'frock'],
        pants: ['pants', 'trousers', 'jeans', 'leggings', 'joggers', 'chinos', 'slacks'],
        skirt: ['skirt'],
        jacket: ['jacket', 'blazer', 'bomber'],
        coat: ['coat', 'overcoat', 'trench', 'parka', 'peacoat'],
        jumpsuit: ['jumpsuit'],
        romper: ['romper'],
        sweater: ['sweater', 'pullover', 'cardigan', 'hoodie', 'sweatshirt'],
        shorts: ['shorts'],
    };

    for (const g of garments) {
        const rawText = (g.raw_input?.product_text || '').toLowerCase();
        const imgType = g.bedrock_image_extraction?.garment_type;
        const txtType = g.bedrock_text_extraction?.garment_type;
        const mergedType = g.merged_attrs?.garment_type;

        // A1: Type mismatch between raw text and merged extraction
        if (mergedType) {
            for (const [type, keywords] of Object.entries(TYPE_KEYWORDS)) {
                const textMentionsType = keywords.some(kw => rawText.includes(kw));
                if (textMentionsType && type !== mergedType && !areRelatedTypes(type, mergedType)) {
                    // Check title specifically — more reliable than full description
                    const titleText = (g.merged_attrs?.title || '').toLowerCase();
                    const titleMentions = keywords.some(kw => titleText.includes(kw));
                    if (titleMentions) {
                        flags.push({
                            category: 'extraction',
                            severity: 'warning',
                            garment_id: g.garment_id,
                            user_id: null,
                            title: `Type mismatch: title says "${type}" but merged says "${mergedType}"`,
                            expected: `garment_type = "${type}" based on product title`,
                            actual: `merged_attrs.garment_type = "${mergedType}"`,
                            details: { title: g.merged_attrs?.title, imgType, txtType, mergedType },
                        });
                        break;
                    }
                }
            }
        }

        // A2: Image vs text extraction type disagreement
        if (imgType && txtType && imgType !== txtType && !areRelatedTypes(imgType, txtType)) {
            flags.push({
                category: 'extraction',
                severity: 'warning',
                garment_id: g.garment_id,
                user_id: null,
                title: `Image/text disagree: image="${imgType}" vs text="${txtType}"`,
                expected: 'Image and text extraction should agree on garment_type',
                actual: `image: ${imgType}, text: ${txtType}, merged: ${mergedType}`,
                details: { imgType, txtType, mergedType },
            });
        }

        // A3: High null rate in image extraction
        const imgFields = g.bedrock_image_extraction || {};
        const imgFieldNames = Object.keys(imgFields);
        const nullCount = imgFieldNames.filter(k => imgFields[k] === null).length;
        const nullPct = imgFieldNames.length > 0 ? nullCount / imgFieldNames.length : 0;
        if (nullPct > 0.5) {
            flags.push({
                category: 'extraction',
                severity: 'info',
                garment_id: g.garment_id,
                user_id: null,
                title: `High null rate in image extraction: ${(nullPct * 100).toFixed(0)}%`,
                expected: 'Image extraction should populate most fields',
                actual: `${nullCount}/${imgFieldNames.length} fields are null`,
                details: { nullPct: +(nullPct.toFixed(2)), nullCount, totalFields: imgFieldNames.length },
            });
        }

        // A4: Missing garment_type entirely
        if (!mergedType) {
            flags.push({
                category: 'extraction',
                severity: 'error',
                garment_id: g.garment_id,
                user_id: null,
                title: 'Missing garment_type in merged_attrs',
                expected: 'garment_type should always be populated',
                actual: 'garment_type is null/undefined',
                details: { imgType, txtType },
            });
        }
    }

    return flags;
}

// ================================================================
// CHECK B: SCORE-VERDICT CONTRADICTIONS
// ================================================================

function checkScoreVerdictContradictions(results) {
    const flags = [];

    for (const r of results) {
        if (r.overall_score == null) continue;

        const goalVerdicts = r.goal_verdicts || [];
        if (goalVerdicts.length === 0) continue;

        const passCount = goalVerdicts.filter(g => g.verdict === 'pass').length;
        const failCount = goalVerdicts.filter(g => g.verdict === 'fail').length;
        const totalGoals = goalVerdicts.length;
        const verdict = r.verdict;

        // B1: All goals pass but overall is NTO
        if (passCount === totalGoals && verdict === 'not_this_one') {
            const silDominance = (r.reasoning_chain || []).find(
                rc => typeof rc === 'string' && (rc.includes('Silhouette dominance') || rc.includes('Definition dominance'))
            );
            flags.push({
                category: 'score_verdict',
                severity: 'error',
                garment_id: r.garment_id,
                user_id: r.user_id,
                title: `All ${totalGoals} goals PASS but overall is NTO (${r.overall_score.toFixed(1)})`,
                expected: 'All green goals should mean SP or TII',
                actual: `score=${r.overall_score.toFixed(1)}, verdict=${verdict}`,
                details: {
                    goals: goalVerdicts.map(g => `${g.goal}: ${g.verdict} (${g.score?.toFixed(3)})`),
                    silhouette_dominance: silDominance || null,
                },
            });
        }

        // B2: All goals fail but overall is TII
        if (failCount === totalGoals && verdict === 'this_is_it') {
            flags.push({
                category: 'score_verdict',
                severity: 'error',
                garment_id: r.garment_id,
                user_id: r.user_id,
                title: `All ${totalGoals} goals FAIL but overall is TII (${r.overall_score.toFixed(1)})`,
                expected: 'All red goals should mean NTO',
                actual: `score=${r.overall_score.toFixed(1)}, verdict=${verdict}`,
                details: { goals: goalVerdicts.map(g => `${g.goal}: ${g.verdict} (${g.score?.toFixed(3)})`) },
            });
        }

        // B3: Majority pass but overall NTO
        if (totalGoals >= 2 && passCount / totalGoals >= 0.67 && verdict === 'not_this_one') {
            // Skip if already flagged as B1
            if (passCount < totalGoals) {
                flags.push({
                    category: 'score_verdict',
                    severity: 'warning',
                    garment_id: r.garment_id,
                    user_id: r.user_id,
                    title: `Majority goals pass (${passCount}/${totalGoals}) but overall NTO (${r.overall_score.toFixed(1)})`,
                    expected: 'Majority green should correlate with SP or better',
                    actual: `score=${r.overall_score.toFixed(1)}, verdict=${verdict}`,
                    details: { goals: goalVerdicts.map(g => `${g.goal}: ${g.verdict}`) },
                });
            }
        }

        // B4: Majority fail but overall TII
        if (totalGoals >= 2 && failCount / totalGoals >= 0.67 && verdict === 'this_is_it') {
            if (failCount < totalGoals) {
                flags.push({
                    category: 'score_verdict',
                    severity: 'warning',
                    garment_id: r.garment_id,
                    user_id: r.user_id,
                    title: `Majority goals fail (${failCount}/${totalGoals}) but overall TII (${r.overall_score.toFixed(1)})`,
                    expected: 'Majority red should correlate with NTO or SP',
                    actual: `score=${r.overall_score.toFixed(1)}, verdict=${verdict}`,
                    details: { goals: goalVerdicts.map(g => `${g.goal}: ${g.verdict}`) },
                });
            }
        }
    }

    return flags;
}

// ================================================================
// CHECK C: COMMUNICATION QUALITY
// ================================================================

function checkCommunicationQuality(results) {
    const flags = [];
    const withHeadlines = results.filter(r => r.headline);

    // C1: Headline frequency
    const headlineFreq = {};
    for (const r of withHeadlines) {
        const h = r.headline.trim();
        headlineFreq[h] = (headlineFreq[h] || 0) + 1;
    }

    for (const [headline, count] of Object.entries(headlineFreq)) {
        const pct = count / withHeadlines.length;
        if (pct > 0.15) {
            flags.push({
                category: 'communication',
                severity: pct > 0.30 ? 'warning' : 'info',
                garment_id: null,
                user_id: null,
                title: `Headline repeated ${(pct * 100).toFixed(0)}% of combos (${count}x)`,
                expected: 'Headlines should be diverse — no single headline >15%',
                actual: `"${headline.substring(0, 80)}"`,
                details: { headline, count, total: withHeadlines.length, pct: +(pct.toFixed(2)) },
            });
        }
    }

    // C2: Pinch text mentions only fabric
    const fabricKeywords = ['fabric', 'material', 'cotton', 'polyester', 'rayon', 'silk', 'linen', 'wool', 'knit', 'woven', 'stretch', 'elastane', 'jersey', 'gsm', 'ponte', 'chiffon'];
    const nonFabricKeywords = ['hemline', 'waist', 'length', 'neckline', 'silhouette', 'shoulder', 'hip', 'leg', 'sleeve', 'proportion', 'height', 'bust', 'color', 'pattern', 'vertical', 'elongat'];

    let fabricOnlyCount = 0;
    const fabricOnlyExamples = [];

    for (const r of results) {
        const pinchText = (r.pinch || []).map(p => {
            if (typeof p === 'object') return p.text || '';
            return String(p);
        }).join(' ').toLowerCase();

        if (!pinchText || pinchText.length < 10) continue;

        const hasFabric = fabricKeywords.some(kw => pinchText.includes(kw));
        const hasNonFabric = nonFabricKeywords.some(kw => pinchText.includes(kw));

        if (hasFabric && !hasNonFabric) {
            fabricOnlyCount++;
            if (fabricOnlyExamples.length < 5) {
                fabricOnlyExamples.push({ garment: r.garment_id, user: r.user_id, pinch: pinchText.substring(0, 150) });
            }
        }
    }

    const withPinch = results.filter(r => r.pinch && r.pinch.length > 0).length;
    if (fabricOnlyCount > 0 && withPinch > 0) {
        const pct = fabricOnlyCount / withPinch;
        flags.push({
            category: 'communication',
            severity: pct > 0.20 ? 'warning' : 'info',
            garment_id: null,
            user_id: null,
            title: `${(pct * 100).toFixed(0)}% of pinch texts are fabric-only (${fabricOnlyCount}/${withPinch})`,
            expected: 'Pinch should mention hemline, silhouette, proportion — not just fabric',
            actual: `${fabricOnlyCount} combos have fabric-only pinch`,
            details: { fabricOnlyCount, withPinch, pct: +(pct.toFixed(2)), examples: fabricOnlyExamples },
        });
    }

    // C3: Communication doesn't reference user goals (for TII/NTO only)
    const goalTerms = {
        look_taller: ['tall', 'height', 'elongat', 'lengthens', 'vertical', 'leg line', 'petite'],
        minimize_hips: ['hip', 'lower body', 'pear', 'thigh', 'a-line'],
        highlight_waist: ['waist', 'defined', 'cinch', 'nipped', 'hourglass'],
        hide_midsection: ['midsection', 'middle', 'tummy', 'belly', 'stomach', 'torso', 'apple'],
        look_slimmer: ['slim', 'streamlin', 'slender'],
        create_curves: ['curve', 'shape', 'definition'],
        balance_shoulders: ['shoulder', 'balance', 'upper body'],
        minimize_bust: ['bust', 'chest'],
        show_legs: ['leg', 'thigh', 'mini', 'hemline'],
        streamline_silhouette: ['streamlin', 'silhouette', 'column', 'smooth'],
    };

    let noGoalRefCount = 0;
    for (const r of results) {
        if (!r.verdict || (r.verdict !== 'this_is_it' && r.verdict !== 'not_this_one')) continue;

        const allCommText = [
            r.headline || '',
            ...(r.pinch || []).map(p => typeof p === 'object' ? (p.text || '') : String(p)),
        ].join(' ').toLowerCase();

        const userGoals = r.user_styling_goals || [];
        if (userGoals.length === 0) continue;

        let anyReferenced = false;
        for (const g of userGoals) {
            const terms = goalTerms[g] || [];
            if (terms.some(t => allCommText.includes(t))) {
                anyReferenced = true;
                break;
            }
        }

        if (!anyReferenced) noGoalRefCount++;
    }

    const tiiNtoCount = results.filter(r => r.verdict === 'this_is_it' || r.verdict === 'not_this_one').length;
    if (noGoalRefCount > 0 && tiiNtoCount > 0) {
        const pct = noGoalRefCount / tiiNtoCount;
        flags.push({
            category: 'communication',
            severity: pct > 0.50 ? 'warning' : 'info',
            garment_id: null,
            user_id: null,
            title: `${(pct * 100).toFixed(0)}% of TII/NTO combos don't reference user goals (${noGoalRefCount}/${tiiNtoCount})`,
            expected: 'Strong verdicts should mention what the user cares about',
            actual: `${noGoalRefCount} combos with no goal reference in headline/pinch`,
            details: { noGoalRefCount, tiiNtoCount, pct: +(pct.toFixed(2)) },
        });
    }

    // C4: Headline diversity score
    const uniqueHeadlines = new Set(withHeadlines.map(r => r.headline.trim()));
    const diversityScore = withHeadlines.length > 0 ? uniqueHeadlines.size / withHeadlines.length : 0;
    flags.push({
        category: 'communication',
        severity: 'info',
        garment_id: null,
        user_id: null,
        title: `Headline diversity: ${uniqueHeadlines.size} unique out of ${withHeadlines.length} (${(diversityScore * 100).toFixed(0)}%)`,
        expected: 'Higher diversity = more personalized communication',
        actual: `${uniqueHeadlines.size} unique headlines`,
        details: { uniqueCount: uniqueHeadlines.size, total: withHeadlines.length, diversityScore: +(diversityScore.toFixed(2)) },
    });

    return flags;
}

// ================================================================
// CHECK D: GOAL LOGIC
// ================================================================

function checkGoalLogic(results, garments, users) {
    const flags = [];

    const garmentMap = {};
    for (const g of garments) garmentMap[g.garment_id] = g;
    const userMap = {};
    for (const u of users) userMap[u.user_id] = u;

    for (const r of results) {
        if (r.overall_score == null) continue;

        const garment = garmentMap[r.garment_id];
        const user = userMap[r.user_id];
        if (!garment || !user) continue;

        const mergedAttrs = garment.merged_attrs || {};
        const goalVerdicts = r.goal_verdicts || [];
        const principleScores = r.principle_scores || [];

        // D1: highlight_waist — defined waist garment should pass
        const highlightWaist = goalVerdicts.find(g => g.goal === 'highlight_waist');
        if (highlightWaist) {
            const waistDef = mergedAttrs.waist_definition;
            const hasDefinedWaist = ['defined', 'semi_defined'].includes(waistDef);
            const waistPlacement = principleScores.find(p => p.name === 'Waist Placement');

            if (hasDefinedWaist && highlightWaist.verdict === 'fail') {
                flags.push({
                    category: 'goal_logic',
                    severity: 'error',
                    garment_id: r.garment_id,
                    user_id: r.user_id,
                    title: `Defined waist (${waistDef}) fails highlight_waist`,
                    expected: 'Garment with defined waist should pass highlight_waist',
                    actual: `highlight_waist: ${highlightWaist.verdict} (score=${highlightWaist.score?.toFixed(3)})`,
                    details: {
                        waist_definition: waistDef,
                        highlight_waist_score: highlightWaist.score,
                        waist_placement_score: waistPlacement?.score,
                        waist_placement_applicable: waistPlacement?.applicable,
                        silhouette: mergedAttrs.silhouette_type,
                        has_darts: mergedAttrs.has_darts,
                        has_seaming: mergedAttrs.has_seaming,
                    },
                });
            }
        }

        // D2: look_taller — petite user + maxi/floor should fail
        const lookTaller = goalVerdicts.find(g => g.goal === 'look_taller');
        if (lookTaller && user.height < 160.02) { // 5'3"
            const hemPos = mergedAttrs.hemline_position;
            const hemPrinciple = principleScores.find(p => p.name === 'Hemline');

            if (['maxi', 'floor_length', 'ankle'].includes(hemPos) && lookTaller.verdict === 'pass') {
                flags.push({
                    category: 'goal_logic',
                    severity: 'warning',
                    garment_id: r.garment_id,
                    user_id: r.user_id,
                    title: `Petite (${user.height}cm) + ${hemPos} passes look_taller`,
                    expected: 'Maxi/floor hemlines should fail look_taller for petite users',
                    actual: `look_taller: ${lookTaller.verdict} (score=${lookTaller.score?.toFixed(3)})`,
                    details: {
                        user_height: user.height,
                        hemline_position: hemPos,
                        hemline_score: hemPrinciple?.score,
                    },
                });
            }
        }

        // D3: Goal score-verdict mismatch (positive score but fail, negative but pass)
        for (const gv of goalVerdicts) {
            if (gv.score != null && gv.score > 0.15 && gv.verdict === 'fail') {
                flags.push({
                    category: 'goal_logic',
                    severity: 'error',
                    garment_id: r.garment_id,
                    user_id: r.user_id,
                    title: `Goal "${gv.goal}" positive score (${gv.score.toFixed(3)}) but verdict=fail`,
                    expected: 'Positive score > 0.15 should be pass',
                    actual: `score=${gv.score.toFixed(3)}, verdict=${gv.verdict}`,
                    details: { goal: gv.goal, score: gv.score, verdict: gv.verdict },
                });
            }
            if (gv.score != null && gv.score < -0.15 && gv.verdict === 'pass') {
                flags.push({
                    category: 'goal_logic',
                    severity: 'error',
                    garment_id: r.garment_id,
                    user_id: r.user_id,
                    title: `Goal "${gv.goal}" negative score (${gv.score.toFixed(3)}) but verdict=pass`,
                    expected: 'Negative score < -0.15 should be fail',
                    actual: `score=${gv.score.toFixed(3)}, verdict=${gv.verdict}`,
                    details: { goal: gv.goal, score: gv.score, verdict: gv.verdict },
                });
            }
        }
    }

    return flags;
}

// ================================================================
// CHECK E: SCORE DISTRIBUTION
// ================================================================

function checkScoreDistribution(results, garments, users) {
    const flags = [];
    const valid = results.filter(r => r.overall_score != null);

    // E1: Per-garment stddev across users
    const perGarment = {};
    for (const r of valid) {
        if (!perGarment[r.garment_id]) perGarment[r.garment_id] = [];
        perGarment[r.garment_id].push(r);
    }

    for (const [gId, entries] of Object.entries(perGarment)) {
        const scores = entries.map(e => e.overall_score);
        const verdicts = entries.map(e => e.verdict);
        const sd = stdDev(scores);

        if (sd < 0.3) {
            flags.push({
                category: 'distribution',
                severity: 'warning',
                garment_id: gId,
                user_id: null,
                title: `Low body sensitivity (stddev=${sd.toFixed(2)})`,
                expected: 'Different body types should get different scores (stddev > 0.3)',
                actual: `scores: ${scores.map(s => s.toFixed(1)).join(', ')}`,
                details: { std_dev: +sd.toFixed(2), garment_type: entries[0].garment_type_merged, title: entries[0].garment_title },
            });
        }

        const uniqueVerdicts = new Set(verdicts);
        if (uniqueVerdicts.size === 1 && entries.length >= 5) {
            flags.push({
                category: 'distribution',
                severity: 'info',
                garment_id: gId,
                user_id: null,
                title: `Same verdict "${[...uniqueVerdicts][0]}" for all ${entries.length} users`,
                expected: 'At least some body types should get different verdicts',
                actual: `All ${entries.length} users: ${[...uniqueVerdicts][0]}`,
                details: { verdict: [...uniqueVerdicts][0], garment_type: entries[0].garment_type_merged },
            });
        }
    }

    // E2: Per-user stddev across garments
    const perUser = {};
    for (const r of valid) {
        if (!perUser[r.user_id]) perUser[r.user_id] = [];
        perUser[r.user_id].push(r);
    }

    for (const [uId, entries] of Object.entries(perUser)) {
        const scores = entries.map(e => e.overall_score);
        const verdicts = entries.map(e => e.verdict);
        const sd = stdDev(scores);

        if (sd < 0.5) {
            flags.push({
                category: 'distribution',
                severity: 'warning',
                garment_id: null,
                user_id: uId,
                title: `Low garment sensitivity for ${entries[0].user_label || uId} (stddev=${sd.toFixed(2)})`,
                expected: 'Different garments should score differently (stddev > 0.5)',
                actual: `scores: ${scores.map(s => s.toFixed(1)).join(', ')}`,
                details: { std_dev: +sd.toFixed(2), user_label: entries[0].user_label },
            });
        }

        const verdictCounts = {};
        for (const v of verdicts) verdictCounts[v] = (verdictCounts[v] || 0) + 1;
        const sorted = Object.entries(verdictCounts).sort((a, b) => b[1] - a[1]);
        const dominant = sorted[0];
        if (dominant && dominant[1] / entries.length > 0.85) {
            flags.push({
                category: 'distribution',
                severity: 'info',
                garment_id: null,
                user_id: uId,
                title: `${(dominant[1] / entries.length * 100).toFixed(0)}% of garments are "${dominant[0]}" for ${entries[0].user_label || uId}`,
                expected: 'Verdict distribution should have spread',
                actual: JSON.stringify(verdictCounts),
                details: { verdictCounts, user_label: entries[0].user_label },
            });
        }
    }

    return flags;
}

// ================================================================
// RUN ALL QUALITY CHECKS
// ================================================================

origLog('Running quality checks...\n');

const extractionFlags = checkExtractionQuality(garments);
const contradictionFlags = checkScoreVerdictContradictions(results);
const commFlags = checkCommunicationQuality(results);
const goalFlags = checkGoalLogic(results, garments, users);
const distributionFlags = checkScoreDistribution(results, garments, users);

const allFlags = [
    ...extractionFlags,
    ...contradictionFlags,
    ...commFlags,
    ...goalFlags,
    ...distributionFlags,
];

// ================================================================
// AGGREGATE STATS
// ================================================================

const valid = results.filter(r => r.overall_score != null);
const scores = valid.map(r => r.overall_score);

const verdictCounts = {};
for (const r of valid) verdictCounts[r.verdict] = (verdictCounts[r.verdict] || 0) + 1;

const withHeadlines = results.filter(r => r.headline);
const uniqueHeadlines = new Set(withHeadlines.map(r => r.headline.trim()));
const headlineDiversity = withHeadlines.length > 0 ? uniqueHeadlines.size / withHeadlines.length : 0;

const aggregate = {
    total_flags: allFlags.length,
    by_severity: {
        error: allFlags.filter(f => f.severity === 'error').length,
        warning: allFlags.filter(f => f.severity === 'warning').length,
        info: allFlags.filter(f => f.severity === 'info').length,
    },
    by_category: {
        extraction: extractionFlags.length,
        score_verdict: contradictionFlags.length,
        communication: commFlags.length,
        goal_logic: goalFlags.length,
        distribution: distributionFlags.length,
    },
    extraction_error_rate: extractionFlags.filter(f => f.severity === 'error').length / garments.length,
    contradiction_rate: contradictionFlags.length / Math.max(valid.length, 1),
    headline_diversity: headlineDiversity,
    goal_logic_error_rate: goalFlags.filter(f => f.severity === 'error').length / Math.max(valid.length, 1),
};

// ================================================================
// WRITE QUALITY REPORT JSON
// ================================================================

const qualityReport = {
    generated_at: new Date().toISOString(),
    total_combinations: results.length,
    valid_combinations: valid.length,
    error_count: errorCount,
    garment_count: garments.length,
    user_count: users.length,
    score_stats: {
        min: Math.min(...scores),
        p25: percentile(scores, 25),
        median: median(scores),
        mean: +(scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(2),
        p75: percentile(scores, 75),
        max: Math.max(...scores),
        std_dev: +stdDev(scores).toFixed(2),
    },
    verdict_distribution: verdictCounts,
    aggregate,
    flags: {
        extraction: extractionFlags,
        score_verdict: contradictionFlags,
        communication: commFlags,
        goal_logic: goalFlags,
        distribution: distributionFlags,
    },
};

if (!existsSync(join(__dirname, 'reports'))) {
    mkdirSync(join(__dirname, 'reports'), { recursive: true });
}

writeFileSync(
    join(__dirname, 'reports/quality_report.json'),
    JSON.stringify(qualityReport, null, 2)
);

// ================================================================
// GENERATE QUALITY SUMMARY (MARKDOWN)
// ================================================================

let md = `# Quality Benchmark — Real Product Analysis\n\n`;
md += `Generated: ${new Date().toISOString()}\n`;
md += `Combinations: ${garments.length} garments x ${users.length} users = ${results.length}\n`;
md += `Valid scores: ${valid.length} | Errors: ${errorCount}\n\n`;

// Executive summary
md += `## Executive Summary\n\n`;
md += `| Metric | Value |\n|--------|-------|\n`;
md += `| Total flags | ${allFlags.length} |\n`;
md += `| Errors | ${aggregate.by_severity.error} |\n`;
md += `| Warnings | ${aggregate.by_severity.warning} |\n`;
md += `| Info | ${aggregate.by_severity.info} |\n`;
md += `| Extraction error rate | ${(aggregate.extraction_error_rate * 100).toFixed(1)}% |\n`;
md += `| Score-verdict contradiction rate | ${(aggregate.contradiction_rate * 100).toFixed(1)}% |\n`;
md += `| Headline diversity | ${(headlineDiversity * 100).toFixed(0)}% unique (${uniqueHeadlines.size}/${withHeadlines.length}) |\n`;
md += `| Goal logic error rate | ${(aggregate.goal_logic_error_rate * 100).toFixed(1)}% |\n\n`;

// Score distribution
md += `## Score Distribution\n\n`;
md += `| Stat | Value |\n|------|-------|\n`;
md += `| Min | ${Math.min(...scores).toFixed(1)} |\n`;
md += `| P25 | ${percentile(scores, 25).toFixed(1)} |\n`;
md += `| Median | ${median(scores).toFixed(1)} |\n`;
md += `| Mean | ${(scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(1)} |\n`;
md += `| P75 | ${percentile(scores, 75).toFixed(1)} |\n`;
md += `| Max | ${Math.max(...scores).toFixed(1)} |\n`;
md += `| StdDev | ${stdDev(scores).toFixed(2)} |\n\n`;

const scoreBins = {};
for (let i = 0; i <= 10; i++) scoreBins[i] = 0;
for (const s of scores) scoreBins[Math.min(Math.floor(s), 10)]++;

md += `| Bin | Count | Bar |\n|-----|-------|-----|\n`;
for (let i = 0; i <= 10; i++) {
    md += `| ${i}-${i + 1} | ${scoreBins[i]} | ${'#'.repeat(scoreBins[i])} |\n`;
}

// Verdict distribution
md += `\n## Verdict Distribution\n\n`;
md += `| Verdict | Count | % |\n|---------|-------|---|\n`;
for (const [v, c] of Object.entries(verdictCounts).sort()) {
    md += `| ${v} | ${c} | ${(c / valid.length * 100).toFixed(1)}% |\n`;
}

// Flag sections
const categories = [
    { key: 'extraction', title: 'A. Extraction Quality', flags: extractionFlags },
    { key: 'score_verdict', title: 'B. Score-Verdict Contradictions', flags: contradictionFlags },
    { key: 'communication', title: 'C. Communication Quality', flags: commFlags },
    { key: 'goal_logic', title: 'D. Goal Logic', flags: goalFlags },
    { key: 'distribution', title: 'E. Score Distribution', flags: distributionFlags },
];

for (const cat of categories) {
    const errs = cat.flags.filter(f => f.severity === 'error').length;
    const warns = cat.flags.filter(f => f.severity === 'warning').length;
    const infos = cat.flags.filter(f => f.severity === 'info').length;

    md += `\n## ${cat.title}\n\n`;
    md += `Flags: ${cat.flags.length} (${errs} errors, ${warns} warnings, ${infos} info)\n\n`;

    if (cat.flags.length === 0) {
        md += `No issues found.\n`;
        continue;
    }

    // Show up to 10 examples, errors first
    const sorted = [...cat.flags].sort((a, b) => {
        const sevOrder = { error: 0, warning: 1, info: 2 };
        return (sevOrder[a.severity] || 3) - (sevOrder[b.severity] || 3);
    });

    const examples = sorted.slice(0, 10);
    for (const f of examples) {
        md += `### ${f.severity.toUpperCase()}: ${f.title}\n\n`;
        if (f.garment_id) md += `- Garment: ${f.garment_id}\n`;
        if (f.user_id) md += `- User: ${f.user_id}\n`;
        md += `- Expected: ${f.expected}\n`;
        md += `- Actual: ${f.actual}\n`;
        if (f.details && Object.keys(f.details).length > 0) {
            const detailStr = JSON.stringify(f.details, null, 0);
            md += `- Details: \`${detailStr.substring(0, 300)}\`\n`;
        }
        md += '\n';
    }

    if (cat.flags.length > 10) {
        md += `...and ${cat.flags.length - 10} more in quality_report.json\n\n`;
    }
}

// Recommendations
md += `## Recommendations\n\n`;

if (extractionFlags.filter(f => f.severity === 'error' || f.severity === 'warning').length > 0) {
    md += `1. Fix extraction: ${extractionFlags.filter(f => f.severity !== 'info').length} garments have type mismatches or missing data. Review Bedrock prompts or add post-extraction validation.\n`;
}
if (contradictionFlags.length > 0) {
    md += `2. Fix score-verdict alignment: ${contradictionFlags.length} combos have contradictions between goal chips and overall verdict. The silhouette/definition dominance rules may be too aggressive.\n`;
}
if (goalFlags.filter(f => f.severity === 'error').length > 0) {
    md += `3. Fix goal logic: ${goalFlags.filter(f => f.severity === 'error').length} errors — highlight_waist may not properly use waist_definition, or goal score thresholds are misaligned.\n`;
}
if (headlineDiversity < 0.30) {
    md += `4. Improve communication diversity: Only ${(headlineDiversity * 100).toFixed(0)}% unique headlines. The phrase bank needs more variations.\n`;
}

writeFileSync(join(__dirname, 'reports/quality_summary.md'), md);

// ================================================================
// CONSOLE SUMMARY
// ================================================================

origLog('=== QUALITY BENCHMARK COMPLETE ===\n');
origLog(`Scored: ${valid.length}/${results.length} | Errors: ${errorCount}`);
origLog(`Scores: min=${Math.min(...scores).toFixed(1)} median=${median(scores).toFixed(1)} mean=${(scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(1)} max=${Math.max(...scores).toFixed(1)}`);
origLog(`Verdicts: ${JSON.stringify(verdictCounts)}`);
origLog('');
origLog(`Total flags: ${allFlags.length}`);
origLog(`  Errors:   ${aggregate.by_severity.error}`);
origLog(`  Warnings: ${aggregate.by_severity.warning}`);
origLog(`  Info:     ${aggregate.by_severity.info}`);
origLog('');
origLog('By category:');
origLog(`  A. Extraction:     ${extractionFlags.length}`);
origLog(`  B. Contradictions: ${contradictionFlags.length}`);
origLog(`  C. Communication:  ${commFlags.length}`);
origLog(`  D. Goal Logic:     ${goalFlags.length}`);
origLog(`  E. Distribution:   ${distributionFlags.length}`);
origLog('');
origLog('Wrote:');
origLog('  test_cases/scraped_scoring_matrix.json');
origLog('  reports/quality_report.json');
origLog('  reports/quality_summary.md');
