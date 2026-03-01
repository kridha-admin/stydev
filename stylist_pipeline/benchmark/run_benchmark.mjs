/**
 * Kridha Scoring Engine — Benchmark Runner
 * ==========================================
 * Loads 10 garments × 10 users, scores all 100 combinations,
 * runs sanity checks, and outputs scoring_matrix.json + summary.md.
 *
 * Usage: node benchmark/run_benchmark.mjs
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { scoreAndCommunicate } from '../engine/index.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Suppress engine debug logs
const origLog = console.log;
let suppressLogs = false;
console.log = (...args) => {
    if (suppressLogs) return;
    origLog(...args);
};

// ================================================================
// LOAD TEST DATA
// ================================================================

const garments = JSON.parse(readFileSync(join(__dirname, 'test_cases/garments_10.json'), 'utf-8'));
const users = JSON.parse(readFileSync(join(__dirname, 'test_cases/users_10.json'), 'utf-8'));

origLog(`Loaded ${garments.length} garments and ${users.length} users`);
origLog(`Running ${garments.length * users.length} combinations...\n`);

// ================================================================
// SCORE ALL COMBINATIONS
// ================================================================

const results = [];
let completed = 0;
let errors = 0;
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

            const activePrinciples = (scoring.principle_scores || [])
                .filter(p => p.applicable);
            const sorted = [...activePrinciples].sort((a, b) => b.score - a.score);
            const topPos = sorted[0] || null;
            const topNeg = sorted[sorted.length - 1] || null;

            results.push({
                garment_id: garment.garment_id,
                user_id: user.user_id,
                overall_score: scoring.overall_score,
                composite_raw: scoring.composite_raw,
                confidence: scoring.confidence,
                active_scorers: activePrinciples.length,
                total_scorers: (scoring.principle_scores || []).length,
                verdict: comm.verdict,
                headline: comm.headline,
                principle_scores: (scoring.principle_scores || []).map(p => ({
                    name: p.name,
                    score: p.score,
                    weight: p.weight,
                    applicable: p.applicable,
                })),
                goal_verdicts: scoring.goal_verdicts || [],
                reasoning_chain: scoring.reasoning_chain || [],
                top_positive: topPos ? { name: topPos.name, score: topPos.score } : null,
                top_negative: topNeg ? { name: topNeg.name, score: topNeg.score } : null,
            });
        } catch (err) {
            errors++;
            console.error(`ERROR: ${user.user_id} × ${garment.garment_id}: ${err.message}`);
            results.push({
                garment_id: garment.garment_id,
                user_id: user.user_id,
                overall_score: null,
                verdict: 'ERROR',
                error: err.message,
            });
        }

        completed++;
    }
}
suppressLogs = false;

origLog(`${completed} combinations scored. ${errors} errors.\n`);

// ================================================================
// WRITE SCORING MATRIX
// ================================================================

const matrix = {
    generated_at: new Date().toISOString(),
    engine_version: 'post-phase-2.5',
    total_combinations: results.length,
    garment_count: garments.length,
    user_count: users.length,
    results,
};

writeFileSync(
    join(__dirname, 'test_cases/scoring_matrix.json'),
    JSON.stringify(matrix, null, 2)
);
origLog('Wrote scoring_matrix.json\n');

// ================================================================
// HELPER
// ================================================================

const valid = results.filter(r => r.overall_score != null);
const scores = valid.map(r => r.overall_score);

const stdDev = (arr) => {
    const mean = arr.reduce((a, b) => a + b, 0) / arr.length;
    return Math.sqrt(arr.reduce((sum, v) => sum + (v - mean) ** 2, 0) / arr.length);
};

const median = (arr) => {
    const s = [...arr].sort((a, b) => a - b);
    const mid = Math.floor(s.length / 2);
    return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
};

const percentile = (arr, p) => {
    const s = [...arr].sort((a, b) => a - b);
    const idx = (p / 100) * (s.length - 1);
    const low = Math.floor(idx);
    const high = Math.ceil(idx);
    return low === high ? s[low] : s[low] + (s[high] - s[low]) * (idx - low);
};

const getScore = (gId, uId) => {
    const r = valid.find(x => x.garment_id === gId && x.user_id === uId);
    return r ? r.overall_score : null;
};

// ================================================================
// ARCHETYPE EXPECTATION CHECKS
// ================================================================

origLog('=== ARCHETYPE CHECKS ===');

const archetypes = [
    {
        name: 'Ponte Sheath (g_002) — crowd-pleaser, expect 7+ for most',
        checks: [
            { garment: 'g_002', user: 'user_01_petite_pear', expect: '>=7', label: 'Petite Pear' },
            { garment: 'g_002', user: 'user_02_avg_hourglass', expect: '>=7', label: 'Avg Hourglass' },
            { garment: 'g_002', user: 'user_03_tall_rectangle', expect: '>=6.5', label: 'Tall Rectangle' },
            { garment: 'g_002', user: 'user_04_plus_apple', expect: '>=6.5', label: 'Plus Apple' },
            { garment: 'g_002', user: 'user_08_tall_hourglass', expect: '>=7', label: 'Tall Hourglass' },
        ],
    },
    {
        name: 'Bodycon Mini (g_008) — adversarial, expect <4 for apple/pear',
        checks: [
            { garment: 'g_008', user: 'user_04_plus_apple', expect: '<4', label: 'Plus Apple' },
            { garment: 'g_008', user: 'user_05_petite_apple', expect: '<4.5', label: 'Petite Apple' },
            { garment: 'g_008', user: 'user_01_petite_pear', expect: '<5', label: 'Petite Pear' },
            { garment: 'g_008', user: 'user_07_avg_pear_plus', expect: '<4', label: 'Pear Plus' },
            { garment: 'g_008', user: 'user_02_avg_hourglass', expect: '>=6', label: 'Avg Hourglass (should be OK)' },
        ],
    },
    {
        name: 'Oversized Linen (g_003) — good for apple concealment, mediocre for hourglass',
        checks: [
            { garment: 'g_003', user: 'user_04_plus_apple', expect: '>=5', label: 'Plus Apple (concealment)' },
            { garment: 'g_003', user: 'user_05_petite_apple', expect: '>=4.5', label: 'Petite Apple' },
            { garment: 'g_003', user: 'user_02_avg_hourglass', expect: '<6', label: 'Avg Hourglass (hides curves)' },
            { garment: 'g_003', user: 'user_08_tall_hourglass', expect: '<6', label: 'Tall Hourglass (hides curves)' },
        ],
    },
    {
        name: 'A-Line Midi (g_007) — universal crowd-pleaser, expect 7+ for most',
        checks: [
            { garment: 'g_007', user: 'user_01_petite_pear', expect: '>=6.5', label: 'Petite Pear' },
            { garment: 'g_007', user: 'user_04_plus_apple', expect: '>=6', label: 'Plus Apple' },
            { garment: 'g_007', user: 'user_02_avg_hourglass', expect: '>=6.5', label: 'Avg Hourglass' },
        ],
    },
];

let archetypePass = 0;
let archetypeFail = 0;
const archetypeResults = [];

for (const arch of archetypes) {
    origLog(`\n${arch.name}`);
    for (const check of arch.checks) {
        const score = getScore(check.garment, check.user);
        if (score == null) {
            origLog(`  ${check.label}: ERROR (no score)`);
            archetypeFail++;
            archetypeResults.push({ ...check, score: null, pass: false });
            continue;
        }

        let pass = false;
        if (check.expect.startsWith('>=')) pass = score >= parseFloat(check.expect.slice(2));
        else if (check.expect.startsWith('<=')) pass = score <= parseFloat(check.expect.slice(2));
        else if (check.expect.startsWith('<')) pass = score < parseFloat(check.expect.slice(1));
        else if (check.expect.startsWith('>')) pass = score > parseFloat(check.expect.slice(1));

        const icon = pass ? 'PASS' : 'FAIL';
        origLog(`  ${icon} ${check.label}: ${score.toFixed(1)} (expect ${check.expect})`);
        if (pass) archetypePass++; else archetypeFail++;
        archetypeResults.push({ ...check, score, pass });
    }
}

origLog(`\nArchetypes: ${archetypePass}/${archetypePass + archetypeFail} pass\n`);

// ================================================================
// SCORE DISTRIBUTION
// ================================================================

const scoreBins = {};
for (let i = 0; i <= 10; i++) scoreBins[i] = 0;
for (const s of scores) {
    const bin = Math.min(Math.floor(s), 10);
    scoreBins[bin]++;
}

origLog('=== SCORE DISTRIBUTION ===');
origLog(`Min: ${Math.min(...scores).toFixed(1)} | Max: ${Math.max(...scores).toFixed(1)} | Mean: ${(scores.reduce((a,b)=>a+b,0)/scores.length).toFixed(1)} | Median: ${median(scores).toFixed(1)}`);
origLog(`P25: ${percentile(scores, 25).toFixed(1)} | P75: ${percentile(scores, 75).toFixed(1)}`);
origLog('');
for (let i = 0; i <= 10; i++) {
    const bar = '#'.repeat(scoreBins[i]);
    origLog(`  ${String(i).padStart(2)}-${String(i+1).padStart(2)}: ${String(scoreBins[i]).padStart(3)} ${bar}`);
}

// ================================================================
// BODY SENSITIVITY
// ================================================================

const garmentScores = {};
for (const r of valid) {
    if (!garmentScores[r.garment_id]) garmentScores[r.garment_id] = [];
    garmentScores[r.garment_id].push(r.overall_score);
}
const garmentSensitivity = Object.entries(garmentScores).map(([id, sc]) => ({
    garment_id: id,
    mean: (sc.reduce((a, b) => a + b, 0) / sc.length),
    std_dev: stdDev(sc),
    min: Math.min(...sc),
    max: Math.max(...sc),
    spread: Math.max(...sc) - Math.min(...sc),
}));

origLog('\n=== BODY SENSITIVITY (per garment) ===');
origLog('Garment    Mean  StdDev  Min   Max   Spread  Flag');
origLog('-'.repeat(65));
for (const gs of garmentSensitivity) {
    const flag = gs.std_dev < 0.5 ? 'LOW-VAR' : gs.std_dev > 3.0 ? 'HIGH-VAR' : '';
    origLog(`${gs.garment_id.padEnd(10)} ${gs.mean.toFixed(1).padStart(5)}  ${gs.std_dev.toFixed(2).padStart(6)}  ${gs.min.toFixed(1).padStart(5)} ${gs.max.toFixed(1).padStart(5)}  ${gs.spread.toFixed(1).padStart(6)}  ${flag}`);
}

// ================================================================
// MONOTONICITY
// ================================================================

const monoChecks = [];
const appleUsers = ['user_04_plus_apple', 'user_05_petite_apple'];
const pearUsers = ['user_01_petite_pear', 'user_07_avg_pear_plus'];
for (const uid of [...appleUsers, ...pearUsers]) {
    const ponte = getScore('g_002', uid);
    const bodycon = getScore('g_008', uid);
    if (ponte != null && bodycon != null) {
        monoChecks.push({ user: uid, ponte, bodycon, pass: ponte > bodycon });
    }
}

origLog('\n=== MONOTONICITY (ponte > bodycon for apple/pear) ===');
for (const mc of monoChecks) {
    origLog(`  ${mc.pass ? 'PASS' : 'FAIL'} ${mc.user}: ponte=${mc.ponte.toFixed(1)} > bodycon=${mc.bodycon.toFixed(1)}`);
}

// ================================================================
// FULL MATRIX (console)
// ================================================================

origLog('\n=== FULL SCORE MATRIX ===');
// Header
const gIds = garments.map(g => g.garment_id.replace('g_0', 'g'));
let header = 'User'.padEnd(16);
for (const gid of gIds) header += gid.padStart(6);
origLog(header);
origLog('-'.repeat(16 + gIds.length * 6));

for (const user of users) {
    const uid = user.user_id.replace('user_', '').substring(0, 14);
    let row = uid.padEnd(16);
    for (const garment of garments) {
        const s = getScore(garment.garment_id, user.user_id);
        row += (s != null ? s.toFixed(1) : 'ERR').padStart(6);
    }
    origLog(row);
}

// ================================================================
// NO-GOALS USER
// ================================================================

const noGoalsResults = valid.filter(r => r.user_id === 'user_10_no_goals');
const noGoalsScores = noGoalsResults.map(r => r.overall_score);
const noGoalsVariance = noGoalsScores.length > 1 ? stdDev(noGoalsScores) : 0;

origLog(`\n=== NO-GOALS USER (user_10) ===`);
origLog(`Variance: ${noGoalsVariance.toFixed(2)} ${noGoalsVariance < 0.3 ? '(LOW)' : '(OK)'}`);
origLog(`Scores: ${noGoalsScores.map(s => s.toFixed(1)).join(', ')}`);

// ================================================================
// GENERATE SUMMARY.MD
// ================================================================

let summary = `# Scoring Engine Benchmark — Summary\n\n`;
summary += `**Generated:** ${new Date().toISOString()}\n`;
summary += `**Engine version:** post-phase-2.5 (hemline fix + null handling + bust_differential)\n`;
summary += `**Combinations:** ${garments.length} garments x ${users.length} users = ${total}\n`;
summary += `**Valid results:** ${valid.length} / ${total}\n\n`;

// Stats
const mean = scores.reduce((a,b)=>a+b,0)/scores.length;
summary += `## Score Statistics\n\n`;
summary += `| Stat | Value |\n|------|-------|\n`;
summary += `| Min | ${Math.min(...scores).toFixed(1)} |\n`;
summary += `| P25 | ${percentile(scores, 25).toFixed(1)} |\n`;
summary += `| Median | ${median(scores).toFixed(1)} |\n`;
summary += `| Mean | ${mean.toFixed(1)} |\n`;
summary += `| P75 | ${percentile(scores, 75).toFixed(1)} |\n`;
summary += `| Max | ${Math.max(...scores).toFixed(1)} |\n`;
summary += `| StdDev | ${stdDev(scores).toFixed(2)} |\n\n`;

// Distribution
summary += `## Score Distribution\n\n`;
summary += `| Bin | Count | Bar |\n|-----|-------|-----|\n`;
for (let i = 0; i <= 10; i++) {
    const bar = '#'.repeat(scoreBins[i]);
    summary += `| ${i}-${i + 1} | ${scoreBins[i]} | ${bar} |\n`;
}

// Archetype checks
summary += `\n## Archetype Checks (${archetypePass}/${archetypePass + archetypeFail} pass)\n\n`;
for (const arch of archetypes) {
    summary += `### ${arch.name}\n\n`;
    summary += `| Body | Score | Expect | Pass |\n|------|-------|--------|------|\n`;
    for (const check of arch.checks) {
        const ar = archetypeResults.find(x => x.garment === check.garment && x.user === check.user);
        if (ar) {
            summary += `| ${check.label} | ${ar.score?.toFixed(1) ?? 'ERR'} | ${check.expect} | ${ar.pass ? 'PASS' : 'FAIL'} |\n`;
        }
    }
    summary += '\n';
}

// Body sensitivity
summary += `## Body Sensitivity (per garment)\n\n`;
summary += `| Garment | Mean | StdDev | Min | Max | Spread | Flag |\n|---------|------|--------|-----|-----|--------|------|\n`;
for (const gs of garmentSensitivity) {
    const flag = gs.std_dev < 0.5 ? 'LOW' : gs.std_dev > 3.0 ? 'HIGH' : '';
    summary += `| ${gs.garment_id} | ${gs.mean.toFixed(1)} | ${gs.std_dev.toFixed(2)} | ${gs.min.toFixed(1)} | ${gs.max.toFixed(1)} | ${gs.spread.toFixed(1)} | ${flag} |\n`;
}

// Monotonicity
summary += `\n## Monotonicity (ponte > bodycon for apple/pear)\n\n`;
summary += `| User | Ponte | Bodycon | Pass |\n|------|-------|--------|------|\n`;
for (const mc of monoChecks) {
    summary += `| ${mc.user} | ${mc.ponte.toFixed(1)} | ${mc.bodycon.toFixed(1)} | ${mc.pass ? 'PASS' : 'FAIL'} |\n`;
}

// Full matrix
summary += `\n## Full Score Matrix\n\n`;
summary += `| User | `;
for (const g of garments) summary += `${g.garment_id} | `;
summary += `\n|------|`;
for (const g of garments) summary += `------|`;
summary += `\n`;
for (const user of users) {
    summary += `| ${user.user_id.replace('user_', 'u')} | `;
    for (const garment of garments) {
        const s = getScore(garment.garment_id, user.user_id);
        summary += `${s != null ? s.toFixed(1) : 'ERR'} | `;
    }
    summary += `\n`;
}

// No-goals
summary += `\n## No-Goals User (user_10)\n\n`;
summary += `- Variance: ${noGoalsVariance.toFixed(2)}\n`;
summary += `- Scores: ${noGoalsScores.map(s => s.toFixed(1)).join(', ')}\n`;

if (!existsSync(join(__dirname, 'reports'))) {
    mkdirSync(join(__dirname, 'reports'), { recursive: true });
}
writeFileSync(join(__dirname, 'reports/summary.md'), summary);
origLog('\nWrote reports/summary.md');
origLog('Done.');
