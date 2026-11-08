import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { performance } from 'node:perf_hooks';
import { config } from '../src/config.js';
import { createSeedData, seedKnowledge } from '../src/seed.js';
import { resetDbForTests } from '../src/store.js';
import { retrieveKnowledge, normalizeIntentText } from '../src/server.js';
import { createBm25, createFieldedBm25 } from '../src/bm25.js';
import { retrieveHybridCandidates, rewriteQueryForRetrieval, slotAwareRerank } from '../src/rag-enhancer.js';
import { understandQuery } from '../src/query-understanding.js';
import { retrievalMetrics } from '../evaluation/retrieval-metrics.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const hash = value => crypto.createHash('sha256').update(value).digest('hex');
const original = JSON.parse(fs.readFileSync(path.join(root, 'evaluation/public-development.json')));
const additional = JSON.parse(fs.readFileSync(path.join(root, 'evaluation/retrieval-development.json')));
const cases = [...original.records.filter(r => r.answerability === 'supported').map(r => ({ id: r.id, question: r.question, language: r.language, evidenceGroups: r.evidenceGroups })), ...additional.records];
const seed = createSeedData();
seed.knowledge = structuredClone(seedKnowledge);
const corpus = seed.knowledge.filter(record => record.status === 'Published');
const known = new Set(corpus.map(record => record.id));
const ids = new Set();
for (const item of cases) {
  if (ids.has(item.id) || !item.question || !item.evidenceGroups.length || item.evidenceGroups.some(group => !group.length || group.some(id => !known.has(id)))) throw new Error(`Invalid judgment: ${item.id}`);
  ids.add(item.id);
}
const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'mitra-retrieval-'));
function cleanup() {
  if (path.dirname(temporary) !== path.resolve(os.tmpdir()) || !path.basename(temporary).startsWith('mitra-retrieval-')) throw new Error('Unsafe cleanup');
  fs.rmSync(temporary, { recursive: true, force: true });
}
config.databaseFile = path.join(temporary, 'evaluation.sqlite');
config.geminiApiKey = '';
resetDbForTests(seed);
try {
  const started = performance.now();
  const bm25 = createBm25(corpus);
  const fieldedBm25 = createFieldedBm25(corpus);
  const buildMs = performance.now() - started;
  const methods = {
    keyword: retrieveKnowledge,
    keywordSlotAware: question => slotAwareRerank(retrieveKnowledge(question), understandQuery(question)).slice(0, 3),
    keywordExpandedSlotAware: question => slotAwareRerank(retrieveKnowledge(question, null, 20), understandQuery(question)).slice(0, 3),
    keywordBm25Union: question => slotAwareRerank(
      retrieveHybridCandidates(question, corpus, retrieveKnowledge(question), rewriteQueryForRetrieval),
      understandQuery(question),
    ).slice(0, 3),
    bm25Raw: bm25,
    bm25Normalized: question => bm25(normalizeIntentText(question)),
    bm25FieldedNormalized: question => fieldedBm25(normalizeIntentText(question)),
    hybridRrf: question => {
      const kw = retrieveKnowledge(question);
      const bm = bm25(normalizeIntentText(question));
      const map = new Map();
      const k = 60;
      kw.forEach((item, r) => map.set(item.id, (map.get(item.id) || 0) + (1 / (k + r + 1))));
      bm.forEach((item, r) => map.set(item.id, (map.get(item.id) || 0) + (1 / (k + r + 1))));
      return [...map.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, 3).map(([id, score]) => ({ id, score }));
    },
    hybridFieldedRrf: question => {
      const keyword = retrieveKnowledge(question);
      const lexical = fieldedBm25(normalizeIntentText(question));
      const map = new Map();
      const k = 60;
      for (const list of [keyword, lexical]) list.forEach((item, rank) => map.set(item.id, (map.get(item.id) || 0) + (1 / (k + rank + 1))));
      return [...map.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, 3).map(([id, score]) => ({ id, score }));
    },
  };
  const rows = cases.map(item => ({ ...item, methods: {} }));
  const timings = Object.fromEntries(Object.keys(methods).map(name => [name, []]));
  for (const row of rows) for (const [name, retrieve] of Object.entries(methods)) {
    const results = retrieve(row.question);
    row.methods[name] = { ids: results.map(r => r.id), scores: results.map(r => r.score), ...retrievalMetrics(results.map(r => r.id), row.evidenceGroups) };
    for (let i = 0; i < 10; i++) retrieve(row.question);
  }
  for (let repeat = 0; repeat < 5; repeat++) for (const row of rows) {
    const entries = Object.entries(methods);
    if (repeat % 2) entries.reverse();
    for (const [name, retrieve] of entries) {
      const start = performance.now(); retrieve(row.question); timings[name].push(performance.now() - start);
    }
  }
  const mean = values => values.reduce((a, b) => a + b, 0) / values.length;
  const summary = Object.fromEntries(Object.keys(methods).map(name => {
    const times = timings[name].sort((a, b) => a - b);
    return [name, { ...Object.fromEntries(['groupRecallAt1', 'groupRecallAt3', 'groupMRRAt3'].map(metric => [metric, mean(rows.map(row => row.methods[name][metric]))])), p50Ms: times[Math.ceil(times.length * 0.5) - 1], p95Ms: times[Math.ceil(times.length * 0.95) - 1] }];
  }));
  const sourceHashes = Object.fromEntries([...fs.readdirSync(path.join(root, 'src')).filter(name => name.endsWith('.js')).map(name => `src/${name}`), 'evaluation/retrieval-metrics.js', 'scripts/compare-retrieval.js'].map(file => [file, hash(fs.readFileSync(path.join(root, file)))]));
  const report = { version: 2, generatedAt: new Date().toISOString(), node: process.version, platform: process.platform, reviewStatus: 'unreviewed', split: 'development', corpusSha256: hash(JSON.stringify(corpus)), casesSha256: hash(JSON.stringify(cases)), sourceHashes, corpusSize: corpus.length, caseCount: cases.length, bm25: { k1: 1.2, b: 0.75, buildMs, plainFields: 'title category tags text concatenated without weighting', fieldedWeights: { title: 2, category: 1.5, tags: 1.8, text: 1 }, queryTermFrequency: 'binary', tieBreak: 'id lexical' }, methodology: 'Same seeded corpus and questions; current unchanged keyword top-3; plain/fielded BM25 top-3; normalized and raw query ablations; RRF hybrid candidates; 10 warmups per case/method; 5 timed repeats with alternating method order; ranking only, no HTTP, generation or audit writes.', limitations: ['Developer-authored incomplete relevance groups; not independently reviewed or held-out.', 'Group recall and group MRR are facet proxies, not standard exhaustive-document Recall or MRR.', 'Precision is omitted because relevance labels are incomplete.', 'Retrieval overlap does not establish answerability, correct year or safe abstention.', 'Local warm latency is not production latency; keyword scans each query and BM25 prebuilds an index.', 'No external embeddings or generation in this offline comparison. The keyword/rule baseline includes current conceptual synonym boosts. No candidate is promoted to production based on these development-only results.'], summary, rows, corpus };
  const folder = path.join(root, 'evaluation/reports'); fs.mkdirSync(folder, { recursive: true });
  fs.writeFileSync(path.join(folder, 'retrieval-latest.json'), `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify({ caseCount: cases.length, corpusSize: corpus.length, summary, report: 'evaluation/reports/retrieval-latest.json' }, null, 2));
} finally { resetDbForTests({}); cleanup(); }
