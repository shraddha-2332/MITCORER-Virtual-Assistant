import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  rewriteQueryForRetrieval,
  filterRecordsByMetadata,
  reciprocalRankFusion,
  slotAwareRerank,
} from '../src/rag-enhancer.js';

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

