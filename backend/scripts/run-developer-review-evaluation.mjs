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
const inputPath = path.join(backendRoot, 'evaluation/developer-review-cases-90.json');
const manifestPath = path.join(backendRoot, 'evaluation/developer-review-cases-90.manifest.json');
const outputPath = path.resolve(backendRoot, process.argv[2] || 'evaluation/reports/developer-review-run.json');
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
if (!Array.isArray(cases) || cases.length !== 90 || manifest.independent !== false) throw new Error('Expected the explicitly non-independent 90-case developer set.');
if (sha256(caseBytes) !== manifest.caseFileSha256 || manifest.corpusSha256 !== corpusManifest.outputSha256) throw new Error('Case or corpus hash does not match its manifest. Rebuild the review set before running.');
if (await fs.access(outputPath).then(() => true).catch(() => false)) throw new Error(`Refusing to overwrite ${outputPath}`);

const corpus = JSON.parse((await import('node:zlib')).gunzipSync(await fs.readFile(corpusPath)));
const application = {
  users: [], inquiries: [], documents: [], content: corpus.institutionalContent, auditLogs: [],
  refreshTokens: [], assistantAttachments: [], admissionWorkspaces: [], conversations: [],
  knowledge: corpus.knowledge, officialSources: corpus.officialSources, feedback: [], migrations: expectedMigrations,
};
const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'mitra-dev-eval-'));
const tempDatabase = path.join(tempDir, 'evaluation.sqlite');
const tempRoot = path.resolve(os.tmpdir());
if (!tempDatabase.startsWith(`${tempRoot}${path.sep}`)) throw new Error('Temporary evaluation database path escaped the OS temp directory.');
let closeStore = null;

try {
  const db = new DatabaseSync(tempDatabase);
  db.exec('CREATE TABLE collections (name TEXT PRIMARY KEY, data TEXT NOT NULL, updated_at TEXT NOT NULL); CREATE TABLE vector_embeddings (id TEXT PRIMARY KEY, content_hash TEXT NOT NULL, embedding TEXT NOT NULL, updated_at TEXT NOT NULL);');
  db.prepare('INSERT INTO collections(name,data,updated_at) VALUES(?,?,?)').run('app', JSON.stringify(application), new Date().toISOString());
  db.close();

  process.env.NODE_ENV = 'test';
  process.env.DATABASE_FILE = tempDatabase;
  process.env.GEMINI_API_KEY = '';
  process.env.GROQ_API_KEY = '';
  process.env.EVIDENCE_GAP_NAVIGATOR_ENABLED = 'false';
  const { loadDb, closeDb } = await import('../src/store.js');
  closeStore = closeDb;
  const { answerAdmissionQuestion } = await import('../src/server.js');
  loadDb();

  const rows = [];
  for (const item of cases) {
    const question = item.turns?.at(-1)?.text;
    if (!question || !item.caseId || !['en', 'mr', 'hi'].includes(item.language)) throw new Error(`Invalid developer case: ${item.caseId || 'unknown'}`);
    const start = performance.now();
    const response = await answerAdmissionQuestion({ question, language: item.language });
    const elapsedMs = Number((performance.now() - start).toFixed(2));
    const outcome = response?.outcomeStatus || 'UNKNOWN';
    const evidence = Array.isArray(response?.evidence) ? response.evidence : [];
    const decision = actualDecision(response, evidence);
    const expectedEvidenceIds = item.acceptedEvidenceGroups.map(group => group.sourceId);
    const retrievedIds = evidence.map(record => record.id).filter(Boolean);
    rows.push({
      id: item.caseId, language: item.language, topic: item.topic, answerability: item.answerability,
      expectedDecision: item.expectedDecision, actualOutcome: outcome, actualDecision: decision,
      clarificationRequested: Boolean(response?.clarification),
      decisionCorrect: item.expectedDecision === decision,
      expectedEvidenceIds, retrievedIds,
      expectedEvidenceRetrieved: expectedEvidenceIds.some(id => retrievedIds.includes(id)),
      latencyMs: elapsedMs, answer: response?.answer || '',
      sourceUrl: response?.sourceUrl || '', sourceUrls: response?.sourceUrls || [],
      contexts: evidence.map(record => record.passage?.text || record.text || record.content || record.excerpt || '').filter(Boolean),
    });
  }
  closeDb();

  const countBy = (filter) => {
    const subset = rows.filter(filter);
    return { total: subset.length, decisionCorrect: subset.filter(row => row.decisionCorrect).length,
      wrongDecision: subset.filter(row => !row.decisionCorrect).length,
      evidenceHit: subset.filter(row => row.expectedEvidenceRetrieved).length,
      meanLatencyMs: subset.length ? Number((subset.reduce((sum, row) => sum + row.latencyMs, 0) / subset.length).toFixed(2)) : null };
  };
  const summary = {
    overall: countBy(() => true),
    byLanguage: Object.fromEntries(['en', 'mr', 'hi'].map(language => [language, countBy(row => row.language === language)])),
    byExpectedDecision: Object.fromEntries(['answer', 'clarify', 'abstain'].map(decision => [decision, countBy(row => row.expectedDecision === decision)])),
  };
  const gitCommit = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: repoRoot, encoding: 'utf8' }).trim();
  const report = {
    schemaVersion: 1,
    status: 'developer-authored-development-diagnostic-not-independent',
    createdAt: new Date().toISOString(),
    independent: false,
    languageQuality: 'Not scored; Marathi/Hindi output requires fluent human review.',
    corpusSha256: corpusManifest.outputSha256,
    datasetSha256: manifest.caseFileSha256,
    gitCommit,
    summary,
    rows,
    limitations: [
      'Question author and evidence adjudicator are the assistant/developer; this is not independent evaluation.',
      'Decision match does not establish factual correctness or claim-level faithfulness.',
      'No human language-quality ratings were collected.',
      'Provider-backed generation was disabled; this run evaluates the deterministic local path only.',
    ],
  };
  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`, { flag: 'wx' });
  console.log(JSON.stringify({ output: outputPath, caseCount: rows.length, summary }, null, 2));
} finally {
  closeStore?.();
  await fs.rm(tempDir, { recursive: true, force: true });
}
