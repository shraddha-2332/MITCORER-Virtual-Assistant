/**
 * RAG Enhancement Engine for MITRA
 *
 * Implements:
 * 1. Query Rewriting & Expansion (multi-query canonical expansion)
 * 2. Hard Metadata Pre-filtering (scope and category boundary gating)
 * 3. Reciprocal Rank Fusion (RRF) Hybrid Search (Sparse BM25 + Dense Vectors)
 * 4. Slot-Aware Re-ranking (Cross-checking academic year, branch, and category)
 */

import { understandQuery } from './query-understanding.js';
import { extractAcademicYears } from './query-scope.js';
import { createFieldedBm25 } from './bm25.js';

// Keep a small index per knowledge-corpus revision. The keyword retriever
// remains the scoring authority; BM25 only adds candidates it did not return.
const lexicalIndexes = new WeakMap();

export function retrieveHybridCandidates(question, records, keywordResults = [], rewrite = rewriteQueryForRetrieval) {
  if (!Array.isArray(records) || !records.length) return keywordResults;
  // Preserve the established ranking when it already has three confident
  // candidates. Lexical expansion is a recall fallback for sparse/weak results.
  if (keywordResults.length >= 3 && (keywordResults[0].score || 0) >= 15) return keywordResults;
  const scope = understandQuery(question);
  // BM25 can match incidental words in long institutional profiles. Only
  // expand recall when the bounded parser identifies a college topic or an
  // explicit branch/route/year to constrain the candidate set.
  const hasInstitutionScope = scope.topics.length > 0 || scope.branch.positive.length > 0
    || scope.admissionRoute || scope.academicYears.length > 0;
  if (!hasInstitutionScope) return keywordResults;
  let index = lexicalIndexes.get(records);
  if (!index) {
    index = createFieldedBm25(records);
    lexicalIndexes.set(records, index);
  }

  const variants = rewrite(question);
  const lexicalResults = variants.flatMap(variant => index(variant).slice(0, 3));
  const merged = new Map();
  for (const item of [...keywordResults, ...lexicalResults]) {
    const existing = merged.get(item.id);
    if (!existing || (item.score || 0) > (existing.score || 0)) merged.set(item.id, item);
  }
  return [...merged.values()];
}

/**
 * Expands colloquial or abbreviated student queries into canonical search queries.
 * E.g., "how much to pay for cse" -> ["how much to pay for cse", "computer science engineering first year academic fees payment"]
 *
 * @param {string} rawQuery
 * @returns {string[]} List of rewritten/expanded query variants
 */
export function rewriteQueryForRetrieval(rawQuery) {
  if (typeof rawQuery !== 'string' || !rawQuery.trim()) return [];
  const normalized = rawQuery.trim().toLowerCase();
  const variants = [rawQuery];

  const parsed = understandQuery(rawQuery);
  const additions = [];

  // Branch expansion
  if (parsed.branch?.positive?.length) {
    const branchName = parsed.branch.positive[0];
    if (branchName === 'cse') additions.push('Computer Science and Engineering');
    else if (branchName === 'railway') additions.push('Mechanical and Rail Engineering');
    else if (branchName === 'aids') additions.push('Artificial Intelligence and Data Science');
  }

  // Topic expansion
  if (parsed.topics.includes('academicFees')) {
    additions.push('tuition fee structure payment breakdown');
  } else if (parsed.topics.includes('accommodationFees') || parsed.topics.includes('hostel')) {
    additions.push('hostel annual rent mess charges deposit accommodation');
  } else if (parsed.topics.includes('programmes') || parsed.topics.includes('seatMatrix')) {
    additions.push('sanctioned intake seat matrix choice code programs');
  }

  // Route expansion
  if (parsed.admissionRoute === 'firstYear') {
    additions.push('First Year B.Tech Engineering admission');
  } else if (parsed.admissionRoute === 'directSecondYear') {
    additions.push('Direct Second Year DSE Lateral Entry Engineering admission');
  }

  if (additions.length) {
    variants.push(`${normalized} ${additions.join(' ')}`.trim());
  }

  return variants;
}

/**
 * Pre-filters candidate records by metadata to reduce retrieval noise.
 *
 * @param {Array} records - All usable knowledge records
 * @param {object} scope - Parsed query scope from understandQuery
 * @returns {Array} Filtered candidate records
 */
export function filterRecordsByMetadata(records = [], scope = {}) {
  if (!Array.isArray(records) || !records.length) return [];
  const topics = scope.topics || [];

  if (topics.includes('accommodationFees') && !topics.includes('academicFees')) {
    const facilities = records.filter(r => r.category === 'facilities' || r.facts?.kind === 'accommodationFees' || /hostel|mess|stay/i.test(r.title));
    if (facilities.length > 0) return facilities;
  }

  if (topics.includes('seatMatrix')) {
    const seatRecords = records.filter(r => r.category === 'seat matrix' || r.category === 'programs' || r.facts?.kind === 'programIntake');
    if (seatRecords.length > 0) return seatRecords;
  }

  return records;
}

/**
 * Fuses ranked retrieval lists using Reciprocal Rank Fusion (RRF).
 * Formula: RRF_Score(doc) = SUM( 1 / (k + rank_i(doc)) ) where k = 60
 *
 * @param {Array<Array<{ id: string }>>} rankLists - Multiple sorted result lists
 * @param {number} k - Constant smoothing parameter (default 60)
 * @returns {Map<string, number>} Document ID -> RRF score
 */
export function reciprocalRankFusion(rankLists = [], k = 60) {
  const scores = new Map();

  for (const list of rankLists) {
    if (!Array.isArray(list)) continue;
    list.forEach((item, index) => {
      const rank = index + 1;
      const current = scores.get(item.id) || 0;
      scores.set(item.id, current + (1 / (k + rank)));
    });
  }

  return scores;
}

/**
 * Re-ranks candidate documents by rewarding exact matches on year, branch, and category slots.
 *
 * @param {Array} candidates - Candidate documents sorted by initial retrieval score
 * @param {object} scope - Parsed query scope from understandQuery
 * @returns {Array} Re-ranked candidates
 */
export function slotAwareRerank(candidates = [], scope = {}) {
  if (!Array.isArray(candidates) || !candidates.length) return [];

  const years = scope.academicYears || [];
  const branches = scope.branch?.positive || [];
  const categories = scope.category?.positive || [];

  // An explicit year is a scope constraint. Remove records known to belong to
  // another year, while retaining records with no year metadata (unknown is
  // not the same as a mismatch).
  const scopedCandidates = years.length ? candidates.filter(record => {
    const knownYears = new Set([
      record.facts?.academicYear,
      record.provenance?.academicYear,
      record.academicYear,
      ...extractAcademicYears(`${record.title || ''} ${record.text || ''}`).years,
    ].filter(Boolean));
    return knownYears.size === 0 || years.some(year => knownYears.has(year));
  }) : candidates;

  return [...scopedCandidates].sort((a, b) => {
    let scoreA = a.score || 0;
    let scoreB = b.score || 0;

    // Academic year match bonus (+50)
    if (years.length) {
      if (years.some(y => a.text?.includes(y) || a.title?.includes(y) || a.facts?.academicYear === y)) scoreA += 50;
      if (years.some(y => b.text?.includes(y) || b.title?.includes(y) || b.facts?.academicYear === y)) scoreB += 50;
    }

    // Route match bonus (+40)
    const route = scope.admissionRoute;
    if (route) {
      const isDse = route === 'directSecondYear';
      if (isDse && (/direct second|dse/i.test(a.title) || /direct second|dse/i.test(a.text))) scoreA += 40;
      if (isDse && (/direct second|dse/i.test(b.title) || /direct second|dse/i.test(b.text))) scoreB += 40;
    }

    // Category topic match bonus (+30)
    if (scope.topics?.length) {
      if (scope.topics.includes('programmes') && (a.category === 'programs' || a.category === 'Programs')) scoreA += 30;
      if (scope.topics.includes('programmes') && (b.category === 'programs' || b.category === 'Programs')) scoreB += 30;
    }

    // Branch match bonus (+20)
    if (branches.length) {
      if (branches.some(br => a.text?.toLowerCase().includes(br) || a.title?.toLowerCase().includes(br))) scoreA += 20;
      if (branches.some(br => b.text?.toLowerCase().includes(br) || b.title?.toLowerCase().includes(br))) scoreB += 20;
    }

    // Category match bonus (+20)
    if (categories.length) {
      if (categories.some(cat => a.text?.toLowerCase().includes(cat) || a.title?.toLowerCase().includes(cat))) scoreA += 20;
      if (categories.some(cat => b.text?.toLowerCase().includes(cat) || b.title?.toLowerCase().includes(cat))) scoreB += 20;
    }

    return scoreB - scoreA || String(a.id || '').localeCompare(String(b.id || ''));
  });
}

