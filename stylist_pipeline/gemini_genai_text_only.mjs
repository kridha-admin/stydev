// Gemini API caller using @google/genai SDK (recommended, supports global endpoint)
//
// Usage: node gemini_genai.mjs
//
// Setup:
//   npm install @google/genai
//   Place gcp-vertex-ai-key.json in this directory (or set GOOGLE_APPLICATION_CREDENTIALS)

import { GoogleGenAI } from "@google/genai";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const PROJECT_ID = process.env.GOOGLE_CLOUD_PROJECT || "durable-unity-464716-f0";
const LOCATION = process.env.GOOGLE_CLOUD_LOCATION || "global";
const KEY_FILE = process.env.GOOGLE_APPLICATION_CREDENTIALS || join(__dirname, "gcp-vertex-ai-key.json");

// Initialize the new Gen AI SDK with Vertex AI
const ai = new GoogleGenAI({
  vertexai: true,
  project: PROJECT_ID,
  location: LOCATION,
  googleAuthOptions: {
    keyFile: KEY_FILE,
  },
});

async function callGemini(prompt, modelId = "gemini-2.5-flash-lite") {
  const startTime = Date.now();
  console.log(`Getting model: ${modelId}`);

  const response = await ai.models.generateContent({
    model: modelId,
    contents: prompt,
  });

  const duration = Date.now() - startTime;
  console.log(`Gemini call took ${duration}ms`);

  return {
    text: response.text,
    usage: {
      inputTokens: response.usageMetadata?.promptTokenCount || 0,
      outputTokens: response.usageMetadata?.candidatesTokenCount || 0,
    },
  };
}

async function main() {
  const prompt = "What is the capital of France?";

  // Test different models
  // const modelId = "gemini-2.5-flash-lite";
  const modelId = "gemini-2.5-flash";
  // const modelId = "gemini-2.5-pro";
  // const modelId = "gemini-3-pro-preview";
  // const modelId = "gemini-3-flash-preview";

  console.log(`Prompt: ${prompt}`);
  console.log(`Model: ${modelId}`);
  console.log(`Location: ${LOCATION}`);

  const result = await callGemini(prompt, modelId);
  console.log(`\nResponse: ${result.text}`);
  console.log(`[Tokens: in=${result.usage.inputTokens}, out=${result.usage.outputTokens}]`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  try {
    await main();
    process.exit(0);
  } catch (error) {
    console.error("Error:", error.message);
    process.exit(1);
  }
}

// GOOGLE_CLOUD_LOCATION=global node gemini_genai.mjs
// GOOGLE_CLOUD_LOCATION=us-central1 node gemini_genai.mjs
