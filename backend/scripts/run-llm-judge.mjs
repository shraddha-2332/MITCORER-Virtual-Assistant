import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { config } from '../src/config.js';
import { requestGeneration, requestGroqGeneration } from '../src/generation-client.js';
import { judgeCases } from '../evaluation/llm-judge.js';

const [inputArg, outputArg] = process.argv.slice(2);
if (!inputArg || !outputArg) throw new Error('Usage: npm run evaluate:judge -- <input.json> <output.json>');
if (process.env.MITRA_ENABLE_EXTERNAL_EVAL !== 'true') throw new Error('Set MITRA_ENABLE_EXTERNAL_EVAL=true only after confirming the dataset contains no personal or confidential data.');

const here = path.dirname(fileURLToPath(import.meta.url));
const backendRoot = path.resolve(here, '..');
const inputPath = path.resolve(backendRoot, inputArg);
const outputPath = path.resolve(backendRoot, outputArg);
const cases = JSON.parse(await fs.readFile(inputPath, 'utf8'));
if (!Array.isArray(cases) || cases.length < 1 || cases.length > 12) {
  throw new Error('The currently approved external pilot is limited to 1-12 sanitized, adjudicated cases.');
}
const result = await judgeCases(cases, {
  groq: config.groqApiKey ? ({ systemInstruction, prompt }) => requestGroqGeneration({
    apiKey: config.groqApiKey, primaryModel: config.groqModel, fallbackModel: config.groqFallbackModel,
    systemInstruction, messages: [{ role: 'user', content: prompt }], timeoutMs: 20000, maxTokens: 1400,
  }) : null,
  gemini: config.geminiApiKey ? ({ systemInstruction, prompt }) => requestGeneration({
    apiKey: config.geminiApiKey, primaryModel: config.geminiModel, fallbackModel: config.geminiFallbackModel, timeoutMs: 20000,
    body: { systemInstruction: { parts: [{ text: systemInstruction }] }, contents: [{ role: 'user', parts: [{ text: prompt }] }], generationConfig: { temperature: 0, maxOutputTokens: 1200, responseMimeType: 'application/json' } },
  }) : null,
  models: { groq: config.groqModel, gemini: config.geminiModel },
});
await fs.mkdir(path.dirname(outputPath), { recursive: true });
await fs.writeFile(outputPath, `${JSON.stringify({ ...result, createdAt: new Date().toISOString() }, null, 2)}\n`, { flag: 'wx' });
console.log(JSON.stringify({ output: outputPath, caseCount: result.rows.length, agreement: result.agreement }, null, 2));
