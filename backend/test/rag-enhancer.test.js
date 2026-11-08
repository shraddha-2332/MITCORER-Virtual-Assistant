import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  rewriteQueryForRetrieval,
  filterRecordsByMetadata,
  reciprocalRankFusion,
  retrieveHybridCandidates,
  slotAwareRerank,
} from '../src/rag-enhancer.js';

test('hybrid candidate retrieval preserves keyword authority and adds BM25 discoveries', () => {
  const records = [
    { id: 'keyword', status: 'Published', title: 'General admission', category: 'admissions', tags: [], text: 'Admission office information.' },
    { id: 'library', status: 'Published', title: 'Library resources', category: 'facilities', tags: ['library'], text: 'Digital resources and journals.' },
  ];
  const keyword = [{ ...records[0], score: 200 }];
  const candidates = retrieveHybridCandidates('Where can I read electronic journals?', records, keyword);
  assert.equal(candidates.find(record => record.id === 'keyword').score, 200);
  assert.ok(candidates.some(record => record.id === 'library'));
});

test('rewriteQueryForRetrieval expands branch and route abbreviations', () => {
  const variants = rewriteQueryForRetrieval('What are the fees for CSE first year?');
  assert.ok(variants.length >= 2);
  const combined = variants.join(' ');
  assert.ok(combined.includes('Computer Science and Engineering'));
  assert.ok(combined.includes('First Year B.Tech Engineering'));
  assert.ok(combined.includes('tuition fee structure'));
});

test('filterRecordsByMetadata isolates hostel records when query is solely accommodation', () => {
  const records = [
    { id: 'KB-2', category: 'fees', title: 'Academic Fees' },
    { id: 'KB-23', category: 'facilities', title: 'Hostel and Mess' },
    { id: 'KB-10', category: 'programs', title: 'B.Tech Programs' },
  ];
  const filtered = filterRecordsByMetadata(records, { topics: ['accommodationFees'] });
  assert.equal(filtered.length, 1);
  assert.equal(filtered[0].id, 'KB-23');
});

test('reciprocalRankFusion correctly aggregates multiple rank lists', () => {
  const listBM25 = [{ id: 'docA' }, { id: 'docB' }, { id: 'docC' }];
  const listDense = [{ id: 'docB' }, { id: 'docA' }, { id: 'docD' }];

  const scores = reciprocalRankFusion([listBM25, listDense], 60);

  // docA: 1/61 + 1/62 = 0.01639 + 0.01612 = 0.03251
  // docB: 1/62 + 1/61 = 0.03251
  // docC: 1/63 = 0.01587
  // docD: 1/63 = 0.01587
  assert.ok(scores.get('docA') > scores.get('docC'));
  assert.ok(scores.get('docB') > scores.get('docD'));
});

test('slotAwareRerank elevates documents matching academic year and branch', () => {
  const candidates = [
    { id: 'doc1', score: 20, title: 'B.Tech Cutoffs 2024-25', text: 'Old cutoffs' },
    { id: 'doc2', score: 15, title: 'B.Tech Cutoffs 2026-27', text: 'Current 2026-27 cutoffs for cse' },
  ];

  const reranked = slotAwareRerank(candidates, {
    academicYears: ['2026-27'],
    branch: { positive: ['cse'] },
  });

  assert.equal(reranked[0].id, 'doc2');
});

test('slotAwareRerank excludes records known to be from a different requested academic year', () => {
  const reranked = slotAwareRerank([
    { id: 'stale', score: 200, title: 'Fees 2024-25', text: 'Old fee table' },
    { id: 'current', score: 10, title: 'Fees 2026-27', text: 'Current fee table' },
    { id: 'unknown', score: 5, title: 'General fee guidance', text: 'Contact the college about fees.' },
  ], { academicYears: ['2026-27'] });

  assert.deepEqual(reranked.map(record => record.id), ['current', 'unknown']);
});

