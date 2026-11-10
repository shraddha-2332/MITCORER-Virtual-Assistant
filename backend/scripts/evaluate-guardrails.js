import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { evaluateBehaviorCases, evaluateGuardrailCases, evaluateRetrievedContextCases } from '../evaluation/guardrail-evaluation.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const cases = JSON.parse(fs.readFileSync(path.join(root, 'evaluation/guardrail-cases.json'), 'utf8'));
const retrievedCases = JSON.parse(fs.readFileSync(path.join(root, 'evaluation/retrieved-context-guardrail-cases.json'), 'utf8'));
const behaviorCases = JSON.parse(fs.readFileSync(path.join(root, 'evaluation/behavioral-guardrail-cases.json'), 'utf8'));

const oldEnv = { nodeEnv: process.env.NODE_ENV, databaseFile: process.env.DATABASE_FILE, geminiKey: process.env.GEMINI_API_KEY, groqKey: process.env.GROQ_API_KEY };
process.env.NODE_ENV = 'test';
process.env.DATABASE_FILE = './data/guardrail-evaluation.sqlite';
process.env.GEMINI_API_KEY = '';
process.env.GROQ_API_KEY = '';
const [{ config }, { resetDbForTests }, { createSeedData }, { answerAdmissionQuestion }] = await Promise.all([
  import('../src/config.js'), import('../src/store.js'), import('../src/seed.js'), import('../src/server.js'),
]);
config.databaseFile = path.join(root, 'data', 'guardrail-evaluation.sqlite');
config.geminiApiKey = '';
config.groqApiKey = '';
config.evidenceNavigatorEnabled = true;

const originalLog = console.log;
let behavior;
try {
  console.log = () => {};
  behavior = await evaluateBehaviorCases(behaviorCases, async item => {
    resetDbForTests(createSeedData());
    if (item.withholdRecordId) {
      const record = (await import('../src/store.js')).getDb().knowledge.find(candidate => candidate.id === item.withholdRecordId);
      if (!record) throw new Error(`Missing fixture record ${item.withholdRecordId}`);
      record.status = 'Review';
    }
    if (item.conflictRecordId) {
      const db = (await import('../src/store.js')).getDb();
      const record = db.knowledge.find(candidate => candidate.id === item.conflictRecordId);
      if (!record?.facts?.firstYear?.open) throw new Error(`Missing structured fact fixture ${item.conflictRecordId}`);
      const conflicting = structuredClone(record);
      conflicting.id = 'KB-EVAL-CONFLICT';
      conflicting.facts.firstYear.open += 1000;
      db.knowledge.push(conflicting);
    }
    return answerAdmissionQuestion({ question: item.question }, undefined);
  });
} finally {
  console.log = originalLog;
  if (oldEnv.nodeEnv === undefined) delete process.env.NODE_ENV; else process.env.NODE_ENV = oldEnv.nodeEnv;
  if (oldEnv.databaseFile === undefined) delete process.env.DATABASE_FILE; else process.env.DATABASE_FILE = oldEnv.databaseFile;
  if (oldEnv.geminiKey === undefined) delete process.env.GEMINI_API_KEY; else process.env.GEMINI_API_KEY = oldEnv.geminiKey;
  if (oldEnv.groqKey === undefined) delete process.env.GROQ_API_KEY; else process.env.GROQ_API_KEY = oldEnv.groqKey;
}

const report = {
  schemaVersion: 2,
  promptIngress: evaluateGuardrailCases(cases),
  retrievedContextBoundary: evaluateRetrievedContextCases(retrievedCases),
  pipelineBehavior: behavior,
  interpretation: 'Synthetic development probes only; not a complete security assessment or independent evaluation.',
};
console.log(JSON.stringify(report, null, 2));
if (report.promptIngress.metrics.fn || report.promptIngress.metrics.fp || report.retrievedContextBoundary.failed || report.pipelineBehavior.failed) process.exitCode = 1;
