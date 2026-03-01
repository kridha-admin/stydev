import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = join(__dirname, '..', '..', '..', '..', '.env');

if (existsSync(envPath)) {
    const lines = readFileSync(envPath, 'utf-8').split('\n');
    for (const line of lines) {
        if (line.startsWith(';') || line.startsWith('#') || !line.includes('=')) continue;
        const [key, ...rest] = line.split('=');
        process.env[key.trim()] = rest.join('=').trim();
    }
}

const { BedrockRuntimeClient, InvokeModelCommand } = await import('@aws-sdk/client-bedrock-runtime');
const client = new BedrockRuntimeClient({
    region: 'us-east-1',
    credentials: {
        accessKeyId: process.env.BEDROCK_ACCESS_KEY_ID,
        secretAccessKey: process.env.BEDROCK_SECRET_ACCESS_KEY,
    },
});

async function tryModel(modelId) {
    try {
        const body = JSON.stringify({
            anthropic_version: 'bedrock-2023-05-31',
            system: 'Test',
            messages: [{ role: 'user', content: [{ type: 'text', text: 'Say hi in 3 words' }] }],
            max_tokens: 20,
            temperature: 0,
        });
        const res = await client.send(new InvokeModelCommand({ modelId, contentType: 'application/json', body }));
        const text = JSON.parse(new TextDecoder().decode(res.body)).content?.[0]?.text;
        console.log(`✅ ${modelId}: "${text}"`);
    } catch (e) {
        console.log(`❌ ${modelId}: ${e.message}`);
    }
}

const models = [
    'anthropic.claude-3-sonnet-20240229-v1:0',
    'anthropic.claude-3-haiku-20240307-v1:0',
    'anthropic.claude-3-5-sonnet-20241022-v2:0',
    'anthropic.claude-sonnet-4-20250514',
    'us.anthropic.claude-sonnet-4-20250514-v1:0',
];

for (const m of models) {
    await tryModel(m);
}
