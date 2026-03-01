/**
 * Consensus Analyzer
 * ==================
 * Parses model responses (Claude, GPT-4o, Gemini), computes consensus matrix,
 * flags disagreements, and generates consensus_report.json + summary analysis.
 *
 * Usage: node benchmark/evaluation/analyze_consensus.mjs
 *
 * Expects model response files in evaluation/model_responses/:
 *   - claude_results.json
 *   - gpt4o_results.json   (optional)
 *   - gemini_results.json  (optional)
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const benchDir = join(__dirname, '..');
const RESPONSES_DIR = join(__dirname, 'model_responses');
const REPORTS_DIR = join(benchDir, 'reports');

if (!existsSync(REPORTS_DIR)) mkdirSync(REPORTS_DIR, { recursive: true });

// ================================================================
// LOAD DATA
// ================================================================

const garments = JSON.parse(readFileSync(join(benchDir, 'test_cases/garments_10.json'), 'utf-8'));
const users = JSON.parse(readFileSync(join(benchDir, 'test_cases/users_10.json'), 'utf-8'));
const matrix = JSON.parse(readFileSync(join(benchDir, 'test_cases/scoring_matrix.json'), 'utf-8'));

const garmentMap = Object.fromEntries(garments.map(g => [g.garment_id, g]));
const userMap = Object.fromEntries(users.map(u => [u.user_id, u]));

// Build engine results lookup
const engineResults = {};
for (const r of matrix.results) {
    engineResults[`${r.user_id}__${r.garment_id}`] = r;
}

// ================================================================
// LOAD MODEL RESPONSES
// ================================================================

const MODEL_FILES = {
    claude: 'claude_results.json',
    gpt4o: 'gpt4o_results.json',
    deepseek: 'deepseek_results.json',
    gemini: 'gemini_results.json',
};

const modelResponses = {};
let modelsLoaded = 0;

for (const [modelName, fileName] of Object.entries(MODEL_FILES)) {
    const filePath = join(RESPONSES_DIR, fileName);
    if (existsSync(filePath)) {
        try {
            const data = JSON.parse(readFileSync(filePath, 'utf-8'));
            const results = data.results || data;
            modelResponses[modelName] = {};
            let parsed = 0;
            let failed = 0;

            for (const r of (Array.isArray(results) ? results : [])) {
                const caseId = r.case_id;
                if (!caseId) { failed++; continue; }
                if (r.evaluation) {
                    modelResponses[modelName][caseId] = r.evaluation;
                    parsed++;
                } else if (r.parsed) {
                    modelResponses[modelName][caseId] = r.parsed;
                    parsed++;
                } else {
                    failed++;
                }
            }
            console.log(`Loaded ${modelName}: ${parsed} parsed, ${failed} failed`);
            modelsLoaded++;
        } catch (err) {
            console.warn(`Failed to load ${modelName}: ${err.message}`);
        }
    } else {
        console.log(`${modelName}: No results file found (${fileName})`);
    }
}

if (modelsLoaded === 0) {
    console.log('\nNo model responses found. Generating template consensus report from engine data only.');
    console.log('Run evaluation first, then re-run this analyzer.\n');
}

// ================================================================
// NORMALIZE VERDICT
// ================================================================

function normalizeVerdict(v) {
    if (!v) return null;
    const lower = String(v).toLowerCase().replace(/[\s_-]+/g, '_');
    if (lower.includes('this_is_it') || lower === 'tii') return 'this_is_it';
    if (lower.includes('smart_pick') || lower === 'sp') return 'smart_pick';
    if (lower.includes('not_this_one') || lower === 'nto') return 'not_this_one';
    return null;
}

// ================================================================
// CONSENSUS COMPUTATION
// ================================================================

const consensusMatrix = [];
const modelNames = Object.keys(modelResponses);

for (const result of matrix.results) {
    if (result.verdict === 'ERROR') continue;

    const caseId = `${result.user_id}__${result.garment_id}`;
    const engineVerdict = normalizeVerdict(result.verdict);

    const entry = {
        case_id: caseId,
        garment_id: result.garment_id,
        user_id: result.user_id,
        engine_verdict: engineVerdict,
        engine_score: result.overall_score,
        model_verdicts: {},
        model_agrees: {},
        model_scores: {},
        model_details: {},
        consensus: null,
        flag: false,
        flag_priority: null,
        flag_reasons: [],
    };

    let agreeCount = 0;
    let totalModels = 0;

    for (const modelName of modelNames) {
        const eval_ = modelResponses[modelName]?.[caseId];
        if (!eval_) {
            entry.model_verdicts[modelName] = null;
            entry.model_agrees[modelName] = null;
            continue;
        }

        totalModels++;

        // Extract model's preferred verdict
        const modelVerdict = normalizeVerdict(eval_.verdict_should_be);
        const agrees = modelVerdict === engineVerdict;

        entry.model_verdicts[modelName] = modelVerdict;
        entry.model_agrees[modelName] = agrees;
        entry.model_scores[modelName] = {
            verdict_correct: eval_.verdict_correct ?? null,
            score_reasonable: eval_.score_reasonable ?? null,
            score_expected_range: eval_.score_expected_range ?? null,
            communication_quality: eval_.communication_quality ?? null,
            confidence: eval_.confidence ?? null,
        };
        entry.model_details[modelName] = {
            what_is_actually_best: eval_.what_is_actually_best ?? null,
            what_is_actually_worst: eval_.what_is_actually_worst ?? null,
            missed_issues: eval_.missed_issues ?? [],
            communication_body_safe: eval_.communication_body_safe ?? true,
            body_safety_issue: eval_.body_safety_issue ?? null,
            reasoning: eval_.reasoning ?? null,
        };

        if (agrees) agreeCount++;
    }

    // Consensus label
    if (totalModels === 0) {
        entry.consensus = 'no_evaluations';
    } else if (agreeCount === totalModels) {
        entry.consensus = `${totalModels}-of-${totalModels} agree with engine`;
    } else if (agreeCount === 0) {
        entry.consensus = `0-of-${totalModels} agree with engine`;
    } else {
        entry.consensus = `${agreeCount}-of-${totalModels} agree with engine`;
    }

    // ================================================================
    // FLAGGING RULES
    // ================================================================

    const disagreeCount = totalModels - agreeCount;

    // Rule 1: All models disagree → HIGH
    if (totalModels >= 2 && disagreeCount === totalModels) {
        entry.flag = true;
        entry.flag_priority = 'HIGH';
        entry.flag_reasons.push('All models disagree with engine verdict');
    }

    // Rule 2: 2+ of 3 disagree → MEDIUM
    if (totalModels >= 2 && disagreeCount >= 2 && disagreeCount < totalModels) {
        entry.flag = true;
        if (!entry.flag_priority || entry.flag_priority === 'MEDIUM') {
            entry.flag_priority = 'MEDIUM';
        }
        entry.flag_reasons.push(`${disagreeCount} of ${totalModels} models disagree with engine`);
    }

    // Rule 3: Body safety flag → CRITICAL
    for (const modelName of modelNames) {
        const detail = entry.model_details[modelName];
        if (detail && detail.communication_body_safe === false) {
            entry.flag = true;
            entry.flag_priority = 'CRITICAL';
            entry.flag_reasons.push(`${modelName}: body safety concern — ${detail.body_safety_issue || 'unspecified'}`);
        }
    }

    // Rule 4: High engine score but model says NTO → HIGH
    if (result.overall_score >= 8.0) {
        for (const modelName of modelNames) {
            if (entry.model_verdicts[modelName] === 'not_this_one') {
                entry.flag = true;
                if (entry.flag_priority !== 'CRITICAL') entry.flag_priority = 'HIGH';
                entry.flag_reasons.push(`${modelName} says NTO but engine scored ${result.overall_score}`);
            }
        }
    }

    // Rule 5: Low engine score but model says TII → MEDIUM
    if (result.overall_score < 4.0) {
        for (const modelName of modelNames) {
            if (entry.model_verdicts[modelName] === 'this_is_it') {
                entry.flag = true;
                if (!entry.flag_priority) entry.flag_priority = 'MEDIUM';
                entry.flag_reasons.push(`${modelName} says TII but engine scored ${result.overall_score}`);
            }
        }
    }

    // Rule 6: All models identify same missed issue → HIGH
    if (totalModels >= 2) {
        const allMissedIssues = modelNames
            .map(m => entry.model_details[m]?.missed_issues || [])
            .filter(arr => arr.length > 0);
        if (allMissedIssues.length === totalModels) {
            entry.flag = true;
            if (entry.flag_priority !== 'CRITICAL') entry.flag_priority = entry.flag_priority || 'HIGH';
            entry.flag_reasons.push('All models identified missed issues the engine didn\'t catch');
        }
    }

    consensusMatrix.push(entry);
}

console.log(`\nComputed consensus for ${consensusMatrix.length} cases\n`);

// ================================================================
// SUMMARY STATISTICS
// ================================================================

const stats = {};

// 1. Overall agreement rate
const casesWith3Models = consensusMatrix.filter(c =>
    Object.values(c.model_agrees).filter(v => v !== null).length >= modelNames.length && modelNames.length > 0
);
const fullyAgree = casesWith3Models.filter(c =>
    Object.values(c.model_agrees).every(v => v === true || v === null)
);
stats.overall_agreement_rate = casesWith3Models.length > 0
    ? ((fullyAgree.length / casesWith3Models.length) * 100).toFixed(1) + '%'
    : 'N/A (no model evaluations)';
stats.total_cases = consensusMatrix.length;
stats.cases_with_evaluations = casesWith3Models.length;
stats.models_loaded = modelNames;

// 2. Verdict confusion matrix (engine vs consensus)
const confusionMatrix = {
    engine_tii: { eval_tii: 0, eval_sp: 0, eval_nto: 0 },
    engine_sp: { eval_tii: 0, eval_sp: 0, eval_nto: 0 },
    engine_nto: { eval_tii: 0, eval_sp: 0, eval_nto: 0 },
};

for (const c of consensusMatrix) {
    // Use majority verdict from models as consensus verdict
    const modelVerdicts = Object.values(c.model_verdicts).filter(v => v !== null);
    if (modelVerdicts.length === 0) continue;

    const verdictCounts = {};
    for (const v of modelVerdicts) {
        verdictCounts[v] = (verdictCounts[v] || 0) + 1;
    }
    const consensusVerdict = Object.entries(verdictCounts)
        .sort((a, b) => b[1] - a[1])[0][0];

    const engineKey = `engine_${c.engine_verdict === 'this_is_it' ? 'tii' : c.engine_verdict === 'smart_pick' ? 'sp' : 'nto'}`;
    const evalKey = `eval_${consensusVerdict === 'this_is_it' ? 'tii' : consensusVerdict === 'smart_pick' ? 'sp' : 'nto'}`;

    if (confusionMatrix[engineKey] && confusionMatrix[engineKey][evalKey] !== undefined) {
        confusionMatrix[engineKey][evalKey]++;
    }
}
stats.verdict_confusion_matrix = confusionMatrix;

// 3. Per-user accuracy
const perUser = {};
for (const c of consensusMatrix) {
    if (!perUser[c.user_id]) perUser[c.user_id] = { total: 0, agree: 0, disagree: 0 };
    perUser[c.user_id].total++;
    const modelAgrees = Object.values(c.model_agrees).filter(v => v !== null);
    if (modelAgrees.length === 0) continue;
    if (modelAgrees.every(v => v === true)) {
        perUser[c.user_id].agree++;
    } else {
        perUser[c.user_id].disagree++;
    }
}
stats.per_user_accuracy = Object.entries(perUser).map(([userId, data]) => ({
    user_id: userId,
    total: data.total,
    agreements: data.agree,
    disagreements: data.disagree,
    agreement_rate: data.total > 0 ? ((data.agree / data.total) * 100).toFixed(1) + '%' : 'N/A',
})).sort((a, b) => parseFloat(a.agreement_rate) - parseFloat(b.agreement_rate));

// 4. Per-garment accuracy
const perGarment = {};
for (const c of consensusMatrix) {
    if (!perGarment[c.garment_id]) perGarment[c.garment_id] = { total: 0, agree: 0, disagree: 0 };
    perGarment[c.garment_id].total++;
    const modelAgrees = Object.values(c.model_agrees).filter(v => v !== null);
    if (modelAgrees.length === 0) continue;
    if (modelAgrees.every(v => v === true)) {
        perGarment[c.garment_id].agree++;
    } else {
        perGarment[c.garment_id].disagree++;
    }
}
stats.per_garment_accuracy = Object.entries(perGarment).map(([gId, data]) => ({
    garment_id: gId,
    garment_type: garmentMap[gId]?.merged_attrs?.garment_type || 'unknown',
    total: data.total,
    agreements: data.agree,
    disagreements: data.disagree,
    agreement_rate: data.total > 0 ? ((data.agree / data.total) * 100).toFixed(1) + '%' : 'N/A',
})).sort((a, b) => parseFloat(a.agreement_rate) - parseFloat(b.agreement_rate));

// 5. Most common missed issues
const missedIssuesCounts = {};
for (const c of consensusMatrix) {
    for (const modelName of modelNames) {
        const issues = c.model_details[modelName]?.missed_issues || [];
        for (const issue of issues) {
            const normalized = String(issue).toLowerCase().trim();
            if (normalized) {
                missedIssuesCounts[normalized] = (missedIssuesCounts[normalized] || 0) + 1;
            }
        }
    }
}
stats.most_common_missed_issues = Object.entries(missedIssuesCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20)
    .map(([issue, count]) => ({ issue, count }));

// 6. Communication quality by verdict
const commQualityByVerdict = { this_is_it: [], smart_pick: [], not_this_one: [] };
for (const c of consensusMatrix) {
    for (const modelName of modelNames) {
        const qual = c.model_scores[modelName]?.communication_quality;
        if (qual != null && c.engine_verdict in commQualityByVerdict) {
            commQualityByVerdict[c.engine_verdict].push(qual);
        }
    }
}
stats.communication_quality = {};
for (const [verdict, scores] of Object.entries(commQualityByVerdict)) {
    const avg = scores.length > 0 ? (scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(2) : 'N/A';
    stats.communication_quality[verdict] = { avg, count: scores.length };
}

// 7. Body safety
const bodySafetyFlags = [];
for (const c of consensusMatrix) {
    for (const modelName of modelNames) {
        const detail = c.model_details[modelName];
        if (detail && detail.communication_body_safe === false) {
            bodySafetyFlags.push({
                case_id: c.case_id,
                model: modelName,
                issue: detail.body_safety_issue,
            });
        }
    }
}
stats.body_safety_flags = bodySafetyFlags;
stats.body_safety_count = bodySafetyFlags.length;

// 8. Top 20 flagged cases
const priorityOrder = { CRITICAL: 0, HIGH: 1, MEDIUM: 2 };
const flagged = consensusMatrix
    .filter(c => c.flag)
    .sort((a, b) => (priorityOrder[a.flag_priority] ?? 3) - (priorityOrder[b.flag_priority] ?? 3));
stats.flagged_cases_count = flagged.length;
stats.top_20_flagged = flagged.slice(0, 20).map(c => ({
    case_id: c.case_id,
    priority: c.flag_priority,
    reasons: c.flag_reasons,
    engine_verdict: c.engine_verdict,
    engine_score: c.engine_score,
    model_verdicts: c.model_verdicts,
    consensus: c.consensus,
}));

// ================================================================
// WRITE CONSENSUS REPORT
// ================================================================

const consensusReport = {
    generated_at: new Date().toISOString(),
    models_evaluated: modelNames,
    total_cases: consensusMatrix.length,
    statistics: stats,
    consensus_matrix: consensusMatrix,
};

writeFileSync(
    join(REPORTS_DIR, 'consensus_report.json'),
    JSON.stringify(consensusReport, null, 2)
);
console.log('Wrote reports/consensus_report.json');

// ================================================================
// GENERATE ANALYSIS SECTION FOR SUMMARY.MD
// ================================================================

let analysis = `\n\n---\n\n# LLM Evaluation Analysis\n\n`;
analysis += `**Generated:** ${new Date().toISOString()}\n`;
analysis += `**Models evaluated:** ${modelNames.length > 0 ? modelNames.join(', ') : 'None yet'}\n\n`;

if (modelNames.length === 0) {
    analysis += `> No model evaluations loaded. Run \`node benchmark/evaluation/run_evaluation.mjs\` first,\n`;
    analysis += `> then re-run this analyzer.\n\n`;
    analysis += `## Evaluation Pipeline Status\n\n`;
    analysis += `| Step | Status |\n|------|--------|\n`;
    analysis += `| Scoring engine (100 combos) | ✅ Complete |\n`;
    analysis += `| Eval prompts generated | ✅ Complete (${consensusMatrix.length} prompts) |\n`;
    analysis += `| Claude (Bedrock) evaluation | ⏳ Pending |\n`;
    analysis += `| GPT-4o evaluation | ⏳ Pending |\n`;
    analysis += `| Gemini evaluation | ⏳ Pending |\n`;
    analysis += `| Consensus analysis | ⏳ Waiting for evaluations |\n`;
} else {
    // 1. Overall agreement
    analysis += `## 1. Overall Agreement Rate\n\n`;
    analysis += `**${stats.overall_agreement_rate}** of cases have all models agreeing with engine verdict\n`;
    analysis += `(${stats.cases_with_evaluations} cases evaluated by ${modelNames.length} model(s))\n\n`;

    // 2. Verdict confusion matrix
    analysis += `## 2. Verdict Confusion Matrix\n\n`;
    analysis += `Engine \\ Evaluators | TII | SP | NTO |\n`;
    analysis += `|---|---|---|---|\n`;
    analysis += `| **This Is It** | ${confusionMatrix.engine_tii.eval_tii} | ${confusionMatrix.engine_tii.eval_sp} | ${confusionMatrix.engine_tii.eval_nto} |\n`;
    analysis += `| **Smart Pick** | ${confusionMatrix.engine_sp.eval_tii} | ${confusionMatrix.engine_sp.eval_sp} | ${confusionMatrix.engine_sp.eval_nto} |\n`;
    analysis += `| **Not This One** | ${confusionMatrix.engine_nto.eval_tii} | ${confusionMatrix.engine_nto.eval_sp} | ${confusionMatrix.engine_nto.eval_nto} |\n\n`;

    // 3. Per-user accuracy
    analysis += `## 3. Per-User Accuracy (lowest first)\n\n`;
    analysis += `| User | Agreement | Disagree | Rate |\n|------|-----------|----------|------|\n`;
    for (const u of stats.per_user_accuracy) {
        analysis += `| ${u.user_id} | ${u.agreements} | ${u.disagreements} | ${u.agreement_rate} |\n`;
    }
    analysis += `\n`;

    // 4. Per-garment accuracy
    analysis += `## 4. Per-Garment Accuracy (lowest first)\n\n`;
    analysis += `| Garment | Type | Agreement | Disagree | Rate |\n|---------|------|-----------|----------|------|\n`;
    for (const g of stats.per_garment_accuracy) {
        analysis += `| ${g.garment_id} | ${g.garment_type} | ${g.agreements} | ${g.disagreements} | ${g.agreement_rate} |\n`;
    }
    analysis += `\n`;

    // 5. Missed issues
    if (stats.most_common_missed_issues.length > 0) {
        analysis += `## 5. Most Common Missed Issues\n\n`;
        analysis += `| Issue | Count |\n|-------|-------|\n`;
        for (const mi of stats.most_common_missed_issues.slice(0, 10)) {
            analysis += `| ${mi.issue} | ${mi.count} |\n`;
        }
        analysis += `\n`;
    }

    // 6. Communication quality
    analysis += `## 6. Communication Quality (1-5 scale)\n\n`;
    analysis += `| Verdict | Avg Quality | Evaluations |\n|---------|------------|-------------|\n`;
    for (const [v, data] of Object.entries(stats.communication_quality)) {
        analysis += `| ${v} | ${data.avg} | ${data.count} |\n`;
    }
    analysis += `\n`;

    // 7. Body safety
    analysis += `## 7. Body Safety\n\n`;
    if (stats.body_safety_count === 0) {
        analysis += `**✅ ZERO body safety flags** — target met\n\n`;
    } else {
        analysis += `**❌ ${stats.body_safety_count} body safety flag(s)**\n\n`;
        for (const f of stats.body_safety_flags) {
            analysis += `- ${f.case_id} (${f.model}): ${f.issue}\n`;
        }
        analysis += `\n`;
    }

    // 8. Top flagged cases
    analysis += `## 8. Top ${Math.min(20, stats.flagged_cases_count)} Flagged Cases\n\n`;
    if (stats.flagged_cases_count === 0) {
        analysis += `No cases flagged for review.\n\n`;
    } else {
        analysis += `**Total flagged:** ${stats.flagged_cases_count}\n\n`;
        analysis += `| # | Case | Priority | Engine | Score | Model Verdicts | Reasons |\n`;
        analysis += `|---|------|----------|--------|-------|----------------|--------|\n`;
        for (let i = 0; i < stats.top_20_flagged.length; i++) {
            const f = stats.top_20_flagged[i];
            const mvStr = Object.entries(f.model_verdicts)
                .filter(([, v]) => v !== null)
                .map(([m, v]) => `${m}:${v === 'this_is_it' ? 'TII' : v === 'smart_pick' ? 'SP' : 'NTO'}`)
                .join(', ');
            const evStr = f.engine_verdict === 'this_is_it' ? 'TII' : f.engine_verdict === 'smart_pick' ? 'SP' : 'NTO';
            analysis += `| ${i + 1} | ${f.case_id} | ${f.priority} | ${evStr} | ${f.engine_score} | ${mvStr} | ${f.reasons.join('; ')} |\n`;
        }
        analysis += `\n`;
    }
}

// Append to existing summary.md
const summaryPath = join(REPORTS_DIR, 'summary.md');
let existingSummary = '';
if (existsSync(summaryPath)) {
    existingSummary = readFileSync(summaryPath, 'utf-8');
    // Strip any previous LLM Evaluation Analysis section
    const dividerIdx = existingSummary.indexOf('\n---\n\n# LLM Evaluation Analysis');
    if (dividerIdx !== -1) {
        existingSummary = existingSummary.substring(0, dividerIdx);
    }
}
writeFileSync(summaryPath, existingSummary + analysis);
console.log('Updated reports/summary.md with evaluation analysis\n');

// ================================================================
// PRINT QUICK STATS
// ================================================================

console.log('=== CONSENSUS QUICK STATS ===');
console.log(`Models loaded: ${modelNames.length > 0 ? modelNames.join(', ') : 'none'}`);
console.log(`Total cases: ${consensusMatrix.length}`);
console.log(`Overall agreement: ${stats.overall_agreement_rate}`);
console.log(`Flagged cases: ${stats.flagged_cases_count}`);
console.log(`Body safety flags: ${stats.body_safety_count}`);

if (stats.most_common_missed_issues.length > 0) {
    console.log(`Top missed issue: "${stats.most_common_missed_issues[0].issue}" (${stats.most_common_missed_issues[0].count}x)`);
}

console.log('\nDone.');
