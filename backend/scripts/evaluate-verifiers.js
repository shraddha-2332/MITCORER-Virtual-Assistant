import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { seedKnowledge } from '../src/seed.js';
import { verifierCases, evaluateVerifiers } from '../evaluation/verifier-diagnostics.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const json = value => `${JSON.stringify(value, null, 2)}\n`;
const corpus = structuredClone(seedKnowledge.filter(record => record.status === 'Published'));
const cases = verifierCases(corpus);
const { rows, summary } = evaluateVerifiers(cases, corpus);
const inputs = [
  ...fs.readdirSync(path.join(root, 'src')).filter(name => name.endsWith('.js')).map(name => `src/${name}`),
  'evaluation/verifier-diagnostics.js', 'scripts/evaluate-verifiers.js',
];
const sourceHashes = Object.fromEntries(inputs.sort().map(file => [file, hash(fs.readFileSync(path.join(root, file)))]));
let commit = null;
try { commit = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8', windowsHide: true }).trim(); } catch { /* Source hashes remain authoritative outside Git. */ }
const corpusBytes = json(corpus), casesBytes = json(cases);
const inputFingerprint = hash(json({ corpusSha256: hash(corpusBytes), casesSha256: hash(casesBytes), sourceHashes }));
const folder = path.join(root, 'evaluation/reports', `verifier-${inputFingerprint}`);
const report = {
  version: 1, generatedAt: new Date().toISOString(), split: 'development', reviewStatus: 'unreviewed',
  authorship: 'Developer-authored synthetic mutation probes; exposed when created.',
  evaluationMode: 'Verifier functions only; no HTTP, model calls, retrieval or maintained database access.',
  commit, commitMeaning: 'Repository HEAD at run; working files may differ. sourceHashes identify the evaluated contents.',
  sourceHashes, node: process.version, platform: process.platform,
  corpusOrigin: 'Published seed knowledge, not maintained local database or independently verified institutional truth.',
  corpusSha256: hash(corpusBytes), casesSha256: hash(casesBytes), inputFingerprint,
  corpusSize: corpus.length, caseCount: cases.length,
  labelPolicy: 'Reject incorrect attribute bindings, unresolved personal fee slots, requested-year mismatches, invented numbers and promises. Accept explicitly correct single facts and labeled comparisons.',
  positiveClass: 'must-reject answer', summary, rows,
  limitations: ['Synthetic English development probes, not natural error prevalence or held-out model accuracy.', 'Slots are supplied directly; parser and production routing are not evaluated.', 'No independent reviewer judgments or live Gemini/embedding behavior measured.', 'Do not tune on these cases and relabel them as final evaluation.'],
};
fs.mkdirSync(folder, { recursive: true });
// Input artifacts are immutable for a fingerprint; repeat runs only refresh runtime metadata.
for (const [name, bytes] of [['corpus.json', corpusBytes], ['cases.json', casesBytes]]) {
  const target = path.join(folder, name);
  if (fs.existsSync(target)) {
    if (fs.readFileSync(target, 'utf8') !== bytes) throw new Error(`Snapshot collision: ${name}`);
  } else fs.writeFileSync(target, bytes, { flag: 'wx' });
}
fs.writeFileSync(path.join(folder, 'report.json'), json(report));
console.log(json({ caseCount: cases.length, corpusSize: corpus.length, inputFingerprint, summary, report: path.relative(root, path.join(folder, 'report.json')) }));
// Production applies the slot verifier, which includes the token check.
// The token-only comparison stays visible as a diagnostic baseline.
if (process.argv.includes('--strict') && (summary.slot.fp || summary.slot.fn)) process.exitCode = 1;
