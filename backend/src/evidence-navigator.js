const MAX_ITERATIONS = 2;

function makeFocusedQuery(question) {
  let query = String(question || '').normalize('NFKC').trim();
  query = query.replace(/\b(?:please|show me|find me|can you find|can you show|could you show|what is in)\b/gi, ' ')
    .replace(/\s+/g, ' ').trim();
  const year = query.match(/\b20\d{2}[-/]\d{2,4}\b/)?.[0];
  const semester = query.match(/\b(?:semester|sem)\s*(?:i|ii|1|2|first|second)\b/i)?.[0];
  const branchToken = query.match(/\b(?:cse|civil|entc|e&tc|mechanical|computer science(?: and engineering)?)\b/i)?.[0] || '';
  const branch = /^cse$/i.test(branchToken) ? 'computer science and engineering'
    : /^(?:entc|e&tc)$/i.test(branchToken) ? 'electronics and telecommunication'
      : branchToken;
  const topic = /academic\s+calendar/i.test(query) ? 'academic calendar'
    : /common\s+basket/i.test(query) ? 'common basket syllabus'
      : /syllabus/i.test(query) ? 'syllabus' : '';
  return [branch, topic, year, semester].filter(Boolean).join(' ') || query;
}

export function missingDocumentQualifier(question) {
  const value = String(question || '');
  if (/\bacademic\s+calendar\b/i.test(value) && !/\b20\d{2}[-/]\d{2,4}\b/.test(value)) return 'Which academic year do you need the calendar for?';
  if (/\bsyllabus\b/i.test(value) && !/\b(?:cse|civil|entc|e&tc|mechanical|computer science|common basket)\b/i.test(value)) return 'Which programme or subject syllabus do you need?';
  return '';
}

// A bounded read-only planner. Search tools must be supplied by the caller;
// the planner cannot write records, call an LLM, or follow retrieved instructions.
export function runEvidenceGapNavigator(question, { searchDocuments, enabled = false } = {}) {
  if (!enabled || typeof searchDocuments !== 'function') return { enabled: false, status: 'disabled', hits: [], iterations: 0 };
  const clarification = missingDocumentQualifier(question);
  if (clarification) return { enabled: true, status: 'needs_clarification', clarification, hits: [], iterations: 0 };

  const queries = [String(question || '').trim(), makeFocusedQuery(question)];
  const hits = [];
  const seen = new Set();
  let iterations = 0;
  for (const query of [...new Set(queries)].slice(0, MAX_ITERATIONS)) {
    iterations += 1;
    const results = searchDocuments(query, 12) || [];
    for (const hit of results) {
      if (!hit?.id || seen.has(hit.id)) continue;
      seen.add(hit.id);
      hits.push(hit);
    }
    if (hits.length) break;
  }
  return { enabled: true, status: hits.length ? 'evidence_found' : 'insufficient_evidence', hits, iterations };
}

export const evidenceNavigatorMaxIterations = MAX_ITERATIONS;
