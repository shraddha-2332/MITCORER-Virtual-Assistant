import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const here = path.dirname(fileURLToPath(import.meta.url));
const backendRoot = path.resolve(here, '..');
const repoRoot = path.resolve(backendRoot, '..');
const inputPath = path.join(backendRoot, 'evaluation/human-review-cases-90.json');
const manifestPath = path.join(backendRoot, 'evaluation/human-review-cases-90.manifest.json');
const outputPath = path.resolve(backendRoot, process.argv[2] || 'evaluation/reports/human-review-run.json');
const corpusPath = path.join(backendRoot, 'evaluation/corpora/reviewed-public-corpus.json.gz');
const corpusManifestPath = path.join(backendRoot, 'evaluation/corpora/reviewed-public-corpus.manifest.json');
const expectedMigrations = ['seed-entc-hod-kb52', 'seed-placement-committee-kb53',
  'refresh-placement-committee-kb53-v2', 'map-seeded-records-to-current-official-routes-v1', 'normalize-dse-choice-codes-v1'];

const sha256 = (bytes) => crypto.createHash('sha256').update(bytes).digest('hex');
const jsonBytes = async (file) => fs.readFile(file);
const actualDecision = (response, evidence) => {
  const outcome = response?.outcomeStatus || 'UNKNOWN';
  if (response?.clarification || ['CLARIFICATION', 'NEEDS_CLARIFICATION'].includes(outcome)) return 'clarify';
  if (outcome === 'ANSWERED' || (outcome === 'UNKNOWN' && response?.answer && evidence.length)) return 'answer';
  if (['INSUFFICIENT_EVIDENCE', 'UNSUPPORTED_TOPIC', 'CONFLICTING_EVIDENCE'].includes(outcome)) return 'abstain';
  return 'unresolved';
};

await fs.access(inputPath);
const [caseBytes, manifestBytes, corpusManifestBytes] = await Promise.all([
  jsonBytes(inputPath), jsonBytes(manifestPath), jsonBytes(corpusManifestPath),
]);
const cases = JSON.parse(caseBytes);
const manifest = JSON.parse(manifestBytes);
const corpusManifest = JSON.parse(corpusManifestBytes);
if (!Array.isArray(cases) || cases.length !== 90 || manifest.independent !== true) throw new Error('Expected the independent 90-case human set.');
if (sha256(caseBytes) !== manifest.caseFileSha256 || manifest.corpusSha256 !== corpusManifest.outputSha256) throw new Error('Case or corpus hash does not match its manifest.');
if (await fs.access(outputPath).then(() => true).catch(() => false)) {
  await fs.unlink(outputPath);
}

const corpus = JSON.parse((await import('node:zlib')).gunzipSync(await fs.readFile(corpusPath)));
const application = {
  users: [], inquiries: [], documents: [], content: corpus.institutionalContent, auditLogs: [],
  refreshTokens: [], assistantAttachments: [], admissionWorkspaces: [], conversations: [],
  knowledge: corpus.knowledge, officialSources: corpus.officialSources, feedback: [], migrations: expectedMigrations,
};
const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'mitra-human-eval-'));
const tempDatabase = path.join(tempDir, 'evaluation.sqlite');
const tempRoot = path.resolve(os.tmpdir());
if (!tempDatabase.startsWith(`${tempRoot}${path.sep}`)) throw new Error('Temporary evaluation database path escaped the OS temp directory.');

let closeStore = null;

try {
  const sqlite = new DatabaseSync(tempDatabase);
  sqlite.exec('CREATE TABLE collections (name TEXT PRIMARY KEY, data TEXT NOT NULL, updated_at TEXT NOT NULL); CREATE TABLE vector_embeddings (id TEXT PRIMARY KEY, content_hash TEXT NOT NULL, embedding TEXT NOT NULL, updated_at TEXT NOT NULL);');
  sqlite.prepare('INSERT INTO collections(name,data,updated_at) VALUES(?,?,?)').run('app', JSON.stringify(application), new Date().toISOString());
  sqlite.close();

  process.env.NODE_ENV = 'test';
  process.env.DATABASE_FILE = tempDatabase;
  process.env.GEMINI_API_KEY = '';
  process.env.GROQ_API_KEY = '';
  process.env.EVIDENCE_GAP_NAVIGATOR_ENABLED = 'false';

  const { loadDb, closeDb } = await import('../src/store.js');
  closeStore = closeDb;
  const { answerAdmissionQuestion, resetRuntimeStateForTests } = await import('../src/server.js');
  loadDb();

  const rows = [];
  for (const item of cases) {
    resetRuntimeStateForTests();
    const started = performance.now();
    const response = await answerAdmissionQuestion({ question: item.turns.at(-1).text }, null);
    const latencyMs = Number((performance.now() - started).toFixed(2));
    const evidence = Array.isArray(response?.evidence) ? response.evidence : [];
    const decision = actualDecision(response, evidence);
    const retrievedIds = evidence.map(entry => entry.id).filter(Boolean);
    const expectedEvidenceIds = item.acceptedEvidenceGroups.map(entry => entry.sourceId).filter(Boolean);
    const decisionCorrect = decision === item.expectedDecision;
    const evidenceHit = expectedEvidenceIds.length === 0
      || expectedEvidenceIds.some(id => retrievedIds.includes(id));
    rows.push({
      id: item.caseId,
      language: item.language,
      topic: item.topic,
      authorReviewerCode: item.authorReviewerCode,
      answerability: item.answerability,
      expectedDecision: item.expectedDecision,
      actualOutcome: response?.outcomeStatus || 'UNKNOWN',
      actualDecision: decision,
      clarificationRequested: Boolean(response?.clarification),
      decisionCorrect,
      expectedEvidenceIds,
      retrievedIds,
      expectedEvidenceRetrieved: evidenceHit,
      latencyMs,
      answer: response?.answer || '',
      sourceUrl: response?.sourceUrl || '',
      sourceUrls: response?.officialLinks?.map(entry => entry.url) || [],
      contexts: evidence.map(entry => entry.text || entry.body || '').filter(Boolean),
    });
  }

  const summaryFor = (subset) => ({
    total: subset.length,
    decisionCorrect: subset.filter(item => item.decisionCorrect).length,
    wrongDecision: subset.filter(item => !item.decisionCorrect).length,
    evidenceHit: subset.filter(item => item.expectedEvidenceRetrieved).length,
    meanLatencyMs: Number((subset.reduce((sum, item) => sum + item.latencyMs, 0) / (subset.length || 1)).toFixed(2)),
  });

  const languages = ['en', 'mr', 'hi'];
  const decisions = ['answer', 'clarify', 'abstain'];
  const report = {
    schemaVersion: 1,
    status: 'independent-human-reviewer-run-complete',
    createdAt: new Date().toISOString(),
    independent: true,
    corpusSha256: manifest.corpusSha256,
    datasetSha256: manifest.caseFileSha256,
    gitCommit: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: repoRoot, encoding: 'utf8' }).trim(),
    summary: {
      overall: summaryFor(rows),
      byLanguage: Object.fromEntries(languages.map(lang => [lang, summaryFor(rows.filter(item => item.language === lang))])),
      byExpectedDecision: Object.fromEntries(decisions.map(decision => [decision, summaryFor(rows.filter(item => item.expectedDecision === decision))])),
    },
    rows,
  };

  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify({ output: outputPath, caseCount: rows.length, summary: report.summary }, null, 2));
} finally {
  if (closeStore) closeStore();
  await fs.rm(tempDir, { recursive: true, force: true });
}
