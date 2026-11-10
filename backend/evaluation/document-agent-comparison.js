import crypto from 'node:crypto';
import { performance } from 'node:perf_hooks';
import { runEvidenceGapNavigator } from '../src/evidence-navigator.js';

function scopeMatch(hit, item) {
  const title = String(hit?.title || '').normalize('NFKC').toLocaleLowerCase();
  if (item.expectedTitleIncludes && !title.includes(item.expectedTitleIncludes.toLocaleLowerCase())) return false;
  if (item.expectedYear) {
    const [start, end] = item.expectedYear.split(/[-/]/);
    if (!title.includes(start) || !title.includes(end.slice(-2))) return false;
  }
  if (item.expectedBranch) {
    const patterns = { cse: /\bcse\b|computer science|computer engineering/, civil: /civil/, entc: /entc|telecommunication/, mechanical: /mechanical|\bmech\b/ };
    if (!patterns[item.expectedBranch] || !patterns[item.expectedBranch].test(title)) return false;
  }
  if (item.expectedSemester) {
    const semesterPattern = item.expectedSemester === 'I' ? /(?:semester|sem)[\s._-]*(?:i|1|first)\b/i
      : item.expectedSemester === 'II' ? /(?:semester|sem)[\s._-]*(?:ii|2|second)\b/i : null;
    if (!semesterPattern || !semesterPattern.test(title)) return false;
  }
  return true;
}

function actualAction(hits, item) {
  return hits.length > 0 && scopeMatch(hits[0], item) ? 'evidence' : 'abstain';
}

function percentile(values, p) {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted.length ? sorted[Math.min(sorted.length - 1, Math.ceil(p * sorted.length) - 1)] : null;
}

export function compareDocumentAgent(cases, searchDocuments) {
  if (!Array.isArray(cases) || !cases.length || cases.length > 250 || typeof searchDocuments !== 'function') throw new Error('Provide 1-250 cases and a document search function');
  const ids = new Set();
  const baselineTimes = [];
  const candidateTimes = [];
  let baselinePass = 0;
  let candidatePass = 0;
  let candidateWrongScope = 0;
  let pairedGain = 0;
  let pairedRegression = 0;
  const rows = cases.map(item => {
    if (!item || typeof item.id !== 'string' || ids.has(item.id) || typeof item.question !== 'string'
      || !['evidence', 'clarify', 'abstain'].includes(item.expectedAction)) throw new Error('Invalid document-agent case');
    if (item.expectedAction === 'evidence' && !item.expectedTitleIncludes) throw new Error(`Evidence case ${item.id} requires expectedTitleIncludes`);
    ids.add(item.id);
    const startBaseline = performance.now();
    const baselineHits = searchDocuments(item.question, 12) || [];
    const baselineMs = performance.now() - startBaseline;
    baselineTimes.push(baselineMs);

    const startCandidate = performance.now();
    const candidate = runEvidenceGapNavigator(item.question, { enabled: true, searchDocuments });
    const candidateMs = performance.now() - startCandidate;
    candidateTimes.push(candidateMs);

    const baselineAction = actualAction(baselineHits, item);
    const candidateAction = candidate.status === 'needs_clarification' ? 'clarify' : actualAction(candidate.hits, item);
    const baselineWrongScope = baselineHits.length > 0 && !scopeMatch(baselineHits[0], item) && baselineAction !== 'clarify';
    const wrongScope = candidate.hits.length > 0 && !scopeMatch(candidate.hits[0], item) && candidateAction !== 'clarify';
    const clarificationMatches = item.expectedAction !== 'clarify' || !item.clarificationIncludes
      || String(candidate.clarification || '').toLocaleLowerCase().includes(item.clarificationIncludes.toLocaleLowerCase());
    const baselineCorrect = baselineAction === item.expectedAction && !baselineWrongScope;
    const candidateCorrect = candidateAction === item.expectedAction && clarificationMatches && !wrongScope;
    baselinePass += Number(baselineCorrect);
    candidatePass += Number(candidateCorrect);
    candidateWrongScope += Number(wrongScope);
    pairedGain += Number(candidateCorrect && !baselineCorrect);
    pairedRegression += Number(!candidateCorrect && baselineCorrect);
    return {
      id: item.id,
      expectedAction: item.expectedAction,
      baseline: { action: baselineAction, topHitIds: baselineHits.slice(0, 3).map(hit => hit.id), latencyMs: Number(baselineMs.toFixed(3)), correct: baselineCorrect, wrongScope: baselineWrongScope },
      candidate: { action: candidateAction, clarification: candidate.clarification || '', iterations: candidate.iterations,
        topHitIds: candidate.hits.slice(0, 3).map(hit => hit.id), latencyMs: Number(candidateMs.toFixed(3)), correct: candidateCorrect, wrongScope },
    };
  });
  return {
    schemaVersion: 1,
    inputSha256: crypto.createHash('sha256').update(JSON.stringify(cases)).digest('hex'),
    caseCount: rows.length,
    baselineCorrect: baselinePass,
    candidateCorrect: candidatePass,
    pairedGain,
    pairedRegression,
    candidateWrongScope,
    baselineWrongScope: rows.filter(row => row.baseline.wrongScope).length,
    baselineLatencyMs: { p50: percentile(baselineTimes, 0.5), p95: percentile(baselineTimes, 0.95) },
    candidateLatencyMs: { p50: percentile(candidateTimes, 0.5), p95: percentile(candidateTimes, 0.95) },
    toolCalls: { baseline: rows.length, candidate: rows.reduce((sum, row) => sum + row.candidate.iterations, 0), modelCalls: 0 },
    rows,
    limitation: 'Development comparison only; expected titles/scope require human adjudication and complete relevant-document judgments.',
  };
}
