import fs from 'node:fs/promises';
import crypto from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { compareDocumentAgent } from '../evaluation/document-agent-comparison.js';
import { documentCorpusStats, searchDocumentCorpus } from '../src/document-corpus.js';

const [inputArg, outputArg] = process.argv.slice(2);
if (!inputArg || !outputArg) throw new Error('Usage: npm run evaluate:document-agent -- <cases.json> <report.json>');
const here = path.dirname(fileURLToPath(import.meta.url));
const backendRoot = path.resolve(here, '..');
const cases = JSON.parse(await fs.readFile(path.resolve(backendRoot, inputArg), 'utf8'));
const stats = documentCorpusStats();
if (!stats.available) throw new Error('The indexed website document corpus is unavailable. Build it before this comparison.');
const result = compareDocumentAgent(cases, searchDocumentCorpus);
const indexPath = path.resolve(here, '../data/website-corpus/document-index.sqlite');
const indexBytes = await fs.readFile(indexPath);
const sha256 = value => crypto.createHash('sha256').update(value).digest('hex');
const sourceHashes = {};
for (const file of ['../src/document-corpus.js', '../src/evidence-navigator.js', '../evaluation/document-agent-comparison.js']) {
  sourceHashes[file.replace('../', '')] = sha256(await fs.readFile(path.resolve(here, file)));
}
const report = { ...result, corpus: { ...stats, indexSha256: sha256(indexBytes) }, sourceHashes,
  nodeVersion: process.version, createdAt: new Date().toISOString() };
const output = path.resolve(backendRoot, outputArg);
await fs.mkdir(path.dirname(output), { recursive: true });
await fs.writeFile(output, `${JSON.stringify(report, null, 2)}\n`, { flag: 'wx' });
console.log(JSON.stringify({ output, caseCount: result.caseCount, baselineCorrect: result.baselineCorrect,
  candidateCorrect: result.candidateCorrect, pairedGain: result.pairedGain, pairedRegression: result.pairedRegression,
  baselineWrongScope: result.baselineWrongScope, candidateWrongScope: result.candidateWrongScope,
  baselineLatencyMs: result.baselineLatencyMs, candidateLatencyMs: result.candidateLatencyMs, toolCalls: result.toolCalls }, null, 2));
