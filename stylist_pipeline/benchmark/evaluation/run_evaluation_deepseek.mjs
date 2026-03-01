/**
 * LLM Evaluation Runner — Bedrock (DeepSeek R1)
 * ===============================================
 * Sends eval prompts to DeepSeek R1 via Bedrock, collects structured evaluations.
 * Checkpoints after each user batch. Retry with exponential backoff.
 *
 * Usage: node benchmark/evaluation/run_evaluation_deepseek.mjs
 *
 * Requires AWS credentials configured with Bedrock access.
 * DeepSeek R1 uses cross-region inference profile: us.deepseek.r1-v1:0
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const benchDir = join(__dirname, '..');

// ================================================================
// CONFIG
// ================================================================

const BEDROCK_REGION = 'us-east-1';
const MODEL_ID = 'us.deepseek.r1-v1:0';   // Cross-region inference profile
const MAX_TOKENS = 2000;                    // R1 can be verbose with reasoning
const TEMPERATURE = 0.0;
const DELAY_MS = 500;                       // DeepSeek R1 is slower, give it room
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
// BEDROCK CLIENT (DeepSeek via Converse API)
// ================================================================

let bedrockClient = null;

async function loadEnv() {
    try {
        const envPath = join(benchDir, '..', '..', '..', '.env');
        if (existsSync(envPath)) {
            const lines = readFileSync(envPath, 'utf-8').split('\n');
            for (const line of lines) {
                if (line.startsWith(';') || line.startsWith('#') || !line.includes('=')) continue;
                const [key, ...rest] = line.split('=');
                process.env[key.trim()] = rest.join('=').trim();
            }
        }
    } catch (_) { /* ignore */ }
}

async function initBedrock() {
    await loadEnv();
    try {
        const { BedrockRuntimeClient } = await import('@aws-sdk/client-bedrock-runtime');
        const credentials = process.env.BEDROCK_ACCESS_KEY_ID ? {
            accessKeyId: process.env.BEDROCK_ACCESS_KEY_ID,
            secretAccessKey: process.env.BEDROCK_SECRET_ACCESS_KEY,
        } : undefined;
        bedrockClient = new BedrockRuntimeClient({ region: BEDROCK_REGION, credentials });
        console.log(`Bedrock client initialized (model: ${MODEL_ID})\n`);
        return true;
    } catch (err) {
        console.error('Failed to initialize Bedrock client:', err.message);
        console.error('Install: npm install @aws-sdk/client-bedrock-runtime');
        return false;
    }
}

async function callDeepSeek(systemPrompt, userPrompt) {
    const { ConverseCommand } = await import('@aws-sdk/client-bedrock-runtime');

    // DeepSeek on Bedrock uses the Converse API
    const response = await bedrockClient.send(new ConverseCommand({
        modelId: MODEL_ID,
        system: [{ text: systemPrompt }],
        messages: [
            {
                role: 'user',
                content: [{ text: userPrompt }],
            },
        ],
        inferenceConfig: {
            maxTokens: MAX_TOKENS,
            temperature: TEMPERATURE,
        },
    }));

    const text = response.output?.message?.content?.[0]?.text || '';
    return text;
}

async function callWithRetry(systemPrompt, userPrompt, caseId) {
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        try {
            const raw = await callDeepSeek(systemPrompt, userPrompt);

            // DeepSeek R1 often wraps output in <think>...</think> tags
            // Strip thinking and get the JSON
            let cleaned = raw;
            const thinkEnd = raw.lastIndexOf('</think>');
            if (thinkEnd !== -1) {
                cleaned = raw.substring(thinkEnd + 8).trim();
            }

            const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
            if (!jsonMatch) {
                // Try the full raw too in case JSON is inside think tags
                const fallbackMatch = raw.match(/\{[\s\S]*\}/);
                if (!fallbackMatch) {
                    console.warn(`  ${caseId}: No JSON found in response (attempt ${attempt})`);
                    if (attempt === MAX_RETRIES) return { raw, parsed: null, error: 'no_json' };
                    continue;
                }
                const parsed = JSON.parse(fallbackMatch[0]);
                return { raw, parsed, error: null };
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
    return join(RESULTS_DIR, 'deepseek_checkpoint.json');
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
    const bedrockReady = await initBedrock();

    if (!bedrockReady) {
        console.log('\nBedrock not available.');
        console.log('\nTo run DeepSeek evaluation:');
        console.log('  1. npm install @aws-sdk/client-bedrock-runtime');
        console.log('  2. Configure AWS credentials');
        console.log('  3. Enable DeepSeek R1 model access in Bedrock console');
        console.log('  4. Re-run: node benchmark/evaluation/run_evaluation_deepseek.mjs');
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
                model: 'deepseek-r1',
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
        join(RESULTS_DIR, 'deepseek_results.json'),
        JSON.stringify({
            model: 'deepseek-r1',
            model_id: MODEL_ID,
            total: allResults.length,
            evaluated_at: new Date().toISOString(),
            results: allResults,
        }, null, 2)
    );
    console.log(`\nWrote ${allResults.length} results to model_responses/deepseek_results.json`);
}

runEvaluation().catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
});
