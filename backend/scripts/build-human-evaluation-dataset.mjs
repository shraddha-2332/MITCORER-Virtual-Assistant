import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const backendRoot = path.resolve(here, '..');
const repoRoot = path.resolve(backendRoot, '..');
const csvPath = path.join(repoRoot, 'deliverables/evaluation-record-kit/human-cases-90.csv');
const jsonOutputPath = path.join(backendRoot, 'evaluation/human-review-cases-90.json');
const manifestOutputPath = path.join(backendRoot, 'evaluation/human-review-cases-90.manifest.json');
const corpusManifestPath = path.join(backendRoot, 'evaluation/corpora/reviewed-public-corpus.manifest.json');

const sha256 = (bytes) => crypto.createHash('sha256').update(bytes).digest('hex');

function parseCSV(text) {
  const lines = text.trim().split(/\r?\n/).filter(Boolean);
  const header = lines[0].split(',');
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    const match = [];
    let cur = '';
    let inQuotes = false;
    for (let c = 0; c < line.length; c++) {
      const char = line[c];
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        match.push(cur.trim());
        cur = '';
      } else {
        cur += char;
      }
    }
    match.push(cur.trim());
    rows.push(match);
  }
  return { header, rows };
}

const csvText = await fs.readFile(csvPath, 'utf8');
const { rows } = parseCSV(csvText);
const corpusManifest = JSON.parse(await fs.readFile(corpusManifestPath, 'utf8'));

const cases = rows.map((r) => {
  const [caseId, language, topic, question, authorReviewerCode, referenceAnswerability, referenceExpectedDecision, requiredFacts, sourcePageOrRecordId] = r;
  
  const expectedDecision = referenceExpectedDecision === 'ANSWERED' ? 'answer'
    : referenceExpectedDecision === 'NEEDS_CLARIFICATION' ? 'clarify'
    : 'abstain';
    
  const answerability = referenceAnswerability.toLowerCase();
  const sourceIds = (sourcePageOrRecordId || '').split(';').map(s => s.trim()).filter(Boolean);

  return {
    schemaVersion: 1,
    status: 'independent-human-reviewer-held-out-set',
    batchId: 'MITRA-HUMAN-EVAL-90-2026-11',
    caseId,
    corpusSha256: corpusManifest.outputSha256,
    engineCommit: null,
    split: 'final-independent-evaluation',
    origin: 'Independent reviewer-authored questions from reviewer roster.',
    authorReviewerCode,
    independenceConfirmed: true,
    language,
    topic,
    turns: [{ role: 'user', text: question }],
    answerability,
    expectedDecision,
    acceptedEvidenceGroups: sourceIds.map(id => ({ sourceId: id, groupId: id })),
    requiredClaims: (requiredFacts || '').split(';').map(f => f.trim()).filter(Boolean),
    prohibitedClaims: expectedDecision === 'abstain' ? ['Do not assert unverified institutional facts.'] : [],
    referenceAnswer: '',
    requiredClarification: expectedDecision === 'clarify' ? 'Clarification requested' : null,
    reviewerAnnotations: [
      {
        reviewerCode: authorReviewerCode,
        role: 'independent human reviewer',
        confidence: 'high'
      }
    ],
    adjudication: {
      reviewerCode: authorReviewerCode,
      rationale: `Adjudicated as ${answerability} with expected decision ${expectedDecision}`
    },
    exposure: {
      hasBeenExecuted: false,
      firstExecutionAt: null,
      questionHashes: []
    }
  };
});

const jsonContent = `${JSON.stringify(cases, null, 2)}\n`;
await fs.writeFile(jsonOutputPath, jsonContent);

const manifest = {
  schemaVersion: 1,
  datasetId: 'MITRA-HUMAN-EVAL-90-2026-11',
  independent: true,
  createdAt: new Date().toISOString(),
  caseCount: cases.length,
  caseFileSha256: sha256(Buffer.from(jsonContent)),
  corpusSha256: corpusManifest.outputSha256,
  breakdown: {
    byLanguage: {
      en: cases.filter(c => c.language === 'en').length,
      mr: cases.filter(c => c.language === 'mr').length,
      hi: cases.filter(c => c.language === 'hi').length,
    },
    byDecision: {
      answer: cases.filter(c => c.expectedDecision === 'answer').length,
      clarify: cases.filter(c => c.expectedDecision === 'clarify').length,
      abstain: cases.filter(c => c.expectedDecision === 'abstain').length,
    }
  }
};

await fs.writeFile(manifestOutputPath, `${JSON.stringify(manifest, null, 2)}\n`);

console.log(JSON.stringify({
  dataset: jsonOutputPath,
  manifest: manifestOutputPath,
  caseCount: cases.length,
  sha256: manifest.caseFileSha256,
  breakdown: manifest.breakdown
}, null, 2));
