/**
 * LLM Evaluation Runner — Bedrock (Claude Sonnet)
 * =================================================
 * Sends eval prompts to Claude via Bedrock, collects structured evaluations.
 * Checkpoints after each user batch. Retry with exponential backoff.
 *
 * Usage: node benchmark/evaluation/run_evaluation.mjs
 *
 * Requires AWS credentials configured (env vars or ~/.aws/credentials)
 * with access to Bedrock in us-east-1.
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
const MODEL_ID = 'us.anthropic.claude-sonnet-4-20250514-v1:0';  // Cross-region inference profile
const MAX_TOKENS = 1500;
const TEMPERATURE = 0.0;
const DELAY_MS = 200;
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
// BEDROCK CLIENT
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
        console.log('Bedrock client initialized\n');
        return true;
    } catch (err) {
        console.error('Failed to initialize Bedrock client:', err.message);
        console.error('Make sure @aws-sdk/client-bedrock-runtime is installed and AWS credentials are configured.\n');
        console.error('Install: npm install @aws-sdk/client-bedrock-runtime');
        return false;
    }
}

async function callClaude(systemPrompt, userPrompt) {
    const { InvokeModelCommand } = await import('@aws-sdk/client-bedrock-runtime');

    const body = JSON.stringify({
        anthropic_version: 'bedrock-2023-05-31',
        system: systemPrompt,
        messages: [{ role: 'user', content: [{ type: 'text', text: userPrompt }] }],
        max_tokens: MAX_TOKENS,
        temperature: TEMPERATURE,
    });

    const response = await bedrockClient.send(new InvokeModelCommand({
        modelId: MODEL_ID,
        contentType: 'application/json',
        body,
    }));

    const decoded = JSON.parse(new TextDecoder().decode(response.body));
    const text = decoded.content?.[0]?.text || '';
    return text;
}

async function callWithRetry(systemPrompt, userPrompt, caseId) {
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        try {
            const raw = await callClaude(systemPrompt, userPrompt);
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
    return join(RESULTS_DIR, 'claude_checkpoint.json');
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
        console.log('Bedrock not available. Eval prompts are ready in eval_prompts.json');
        console.log('Manual prompt files are in manual_prompts_gpt4o/ and manual_prompts_gemini/');
        console.log('\nTo run evaluation later:');
        console.log('  1. npm install @aws-sdk/client-bedrock-runtime');
        console.log('  2. Configure AWS credentials');
        console.log('  3. Re-run: node benchmark/evaluation/run_evaluation.mjs');
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
                model: 'claude-sonnet',
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
        join(RESULTS_DIR, 'claude_results.json'),
        JSON.stringify({
            model: 'claude-sonnet',
            model_id: MODEL_ID,
            total: allResults.length,
            evaluated_at: new Date().toISOString(),
            results: allResults,
        }, null, 2)
    );
    console.log(`\nWrote ${allResults.length} results to model_responses/claude_results.json`);
}

runEvaluation().catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
});
