/**
 * LLM Evaluation Runner — OpenAI (GPT-4o)
 * =========================================
 * Sends eval prompts to GPT-4o via OpenAI API, collects structured evaluations.
 * Checkpoints after each user batch. Retry with exponential backoff.
 *
 * Usage: node benchmark/evaluation/run_evaluation_gpt4o.mjs
 *
 * Requires: OPENAI_API_KEY env var (or .env file in project root)
 * Install:  npm install openai
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const benchDir = join(__dirname, '..');

// ================================================================
// CONFIG
// ================================================================

const MODEL_ID = 'gpt-4o';
const MAX_TOKENS = 1500;
const TEMPERATURE = 0.0;
const DELAY_MS = 300;        // slightly higher for OpenAI rate limits
const MAX_RETRIES = 3;
const RESULTS_DIR = join(__dirname, 'model_responses');

// ================================================================
// LOAD PROMPTS
// ================================================================

const promptsData = JSON.parse(readFileSync(join(__dirname, 'eval_prompts.json'), 'utf-8'));
const prompts = promptsData.prompts;
console.log(`Loaded ${prompts.length} evaluation prompts\n`);

// Group by user
const userBatches = {};
for (const p of prompts) {
    if (!userBatches[p.user_id]) userBatches[p.user_id] = [];
    userBatches[p.user_id].push(p);
}

// ================================================================
// OPENAI CLIENT
// ================================================================

let openaiClient = null;

async function initOpenAI() {
    // Check for API key
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
        // Try loading from .env
        try {
            const envPath = join(benchDir, '..', '..', '..', '.env');
            if (existsSync(envPath)) {
                const envContent = readFileSync(envPath, 'utf-8');
                const match = envContent.match(/OPENAI_API_KEY=(.+)/);
                if (match) process.env.OPENAI_API_KEY = match[1].trim();
            }
        } catch (_) { /* ignore */ }
    }

    if (!process.env.OPENAI_API_KEY) {
        console.error('OPENAI_API_KEY not found in environment or .env file.');
        console.error('Set it: export OPENAI_API_KEY=sk-...');
        return false;
    }

    try {
        const { default: OpenAI } = await import('openai');
        openaiClient = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
        console.log('OpenAI client initialized\n');
        return true;
    } catch (err) {
        console.error('Failed to initialize OpenAI client:', err.message);
        console.error('Install: npm install openai');
        return false;
    }
}

async function callGPT4o(systemPrompt, userPrompt) {
    const response = await openaiClient.chat.completions.create({
        model: MODEL_ID,
        messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
        ],
        max_tokens: MAX_TOKENS,
        temperature: TEMPERATURE,
        response_format: { type: 'json_object' },
    });

    return response.choices?.[0]?.message?.content || '';
}

async function callWithRetry(systemPrompt, userPrompt, caseId) {
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        try {
            const raw = await callGPT4o(systemPrompt, userPrompt);
            // Try to parse JSON from response
            const jsonMatch = raw.match(/\{[\s\S]*\}/);
            if (!jsonMatch) {
                console.warn(`  ${caseId}: No JSON found in response (attempt ${attempt})`);
                if (attempt === MAX_RETRIES) return { raw, parsed: null, error: 'no_json' };
                continue;
            }
            const parsed = JSON.parse(jsonMatch[0]);
            return { raw, parsed, error: null };
        } catch (err) {
            const waitMs = DELAY_MS * Math.pow(2, attempt);
            console.warn(`  ${caseId}: Error (attempt ${attempt}/${MAX_RETRIES}): ${err.message}`);
            if (attempt < MAX_RETRIES) {
                await sleep(waitMs);
            } else {
                return { raw: null, parsed: null, error: err.message };
            }
        }
    }
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// ================================================================
// CHECKPOINT MANAGEMENT
// ================================================================

if (!existsSync(RESULTS_DIR)) mkdirSync(RESULTS_DIR, { recursive: true });

function getCheckpointPath() {
    return join(RESULTS_DIR, 'gpt4o_checkpoint.json');
}

function loadCheckpoint() {
    const path = getCheckpointPath();
    if (existsSync(path)) {
        return JSON.parse(readFileSync(path, 'utf-8'));
    }
    return { completed_users: [], results: [] };
}

function saveCheckpoint(checkpoint) {
    writeFileSync(getCheckpointPath(), JSON.stringify(checkpoint, null, 2));
}

// ================================================================
// MAIN EVALUATION LOOP
// ================================================================

async function runEvaluation() {
    const ready = await initOpenAI();

    if (!ready) {
        console.log('\nOpenAI not available. Manual prompt files are in manual_prompts_gpt4o/');
        console.log('\nTo run evaluation:');
        console.log('  1. npm install openai');
        console.log('  2. export OPENAI_API_KEY=sk-...');
        console.log('  3. Re-run: node benchmark/evaluation/run_evaluation_gpt4o.mjs');
        return;
    }

    const checkpoint = loadCheckpoint();
    console.log(`Checkpoint: ${checkpoint.completed_users.length} users already evaluated\n`);

    const userIds = Object.keys(userBatches);
    let allResults = [...checkpoint.results];

    for (const userId of userIds) {
        if (checkpoint.completed_users.includes(userId)) {
            console.log(`Skipping ${userId} (already evaluated)`);
            continue;
        }

        const batch = userBatches[userId];
        console.log(`\nEvaluating ${userId} (${batch.length} garments)...`);

        for (let i = 0; i < batch.length; i++) {
            const prompt = batch[i];
            process.stdout.write(`  [${i + 1}/${batch.length}] ${prompt.garment_id}...`);

            const result = await callWithRetry(prompt.system_prompt, prompt.user_prompt, prompt.case_id);

            allResults.push({
                case_id: prompt.case_id,
                garment_id: prompt.garment_id,
                user_id: prompt.user_id,
                engine_score: prompt.engine_score,
                engine_verdict: prompt.engine_verdict,
                model: 'gpt-4o',
                evaluation: result.parsed,
                raw_response: result.raw,
                error: result.error,
            });

            console.log(result.parsed ? ' OK' : ` FAIL (${result.error})`);

            await sleep(DELAY_MS);
        }

        // Checkpoint after each user
        checkpoint.completed_users.push(userId);
        checkpoint.results = allResults;
        saveCheckpoint(checkpoint);
        console.log(`  Checkpointed ${userId}`);
    }

    // Write final results
    writeFileSync(
        join(RESULTS_DIR, 'gpt4o_results.json'),
        JSON.stringify({
            model: 'gpt-4o',
            model_id: MODEL_ID,
            total: allResults.length,
            evaluated_at: new Date().toISOString(),
            results: allResults,
        }, null, 2)
    );
    console.log(`\nWrote ${allResults.length} results to model_responses/gpt4o_results.json`);
}

runEvaluation().catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
});
