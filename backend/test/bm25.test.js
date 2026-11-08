import test from 'node:test';
import assert from 'node:assert/strict';
import { createBm25, createFieldedBm25, lexicalTokens } from '../src/bm25.js';
import { retrievalMetrics } from '../evaluation/retrieval-metrics.js';
const record = (id, text, status = 'Published') => ({ id, text, title: '', category: '', tags: [], status });
test('BM25 score matches hand-calculated single-document formula and ignores repeated query terms', () => {
  const retrieve = createBm25([record('a', 'library library books')]);
  const expected = Math.log(1 + 0.5 / 1.5) * 2 * 2.2 / (2 + 1.2);
  assert.ok(Math.abs(retrieve('library')[0].score - expected) < 1e-12);
  assert.equal(retrieve('library library')[0].score, retrieve('library')[0].score);
});
test('BM25 excludes retired records, handles empty/no overlap, and resolves ties deterministically', () => {
  const retrieve = createBm25([record('z', 'books'), record('a', 'books'), record('retired', 'secret', 'Retired')]);
  assert.deepEqual(retrieve('books').map(r => r.id), ['a', 'z']);
  assert.deepEqual(retrieve('secret'), []);
  assert.deepEqual(createBm25([])('books'), []);
  assert.deepEqual(retrieve(''), []);
  assert.throws(() => createBm25([], { b: 2 }));
  assert.deepEqual(lexicalTokens('ग्रंथालयात २०२६'), ['ग्रंथालयात', '२०२६']);
});
test('fielded BM25 applies configured title weighting and rejects invalid weights', () => {
  const records = [
    { ...record('body', 'library'), title: 'General', category: 'general' },
    { ...record('title', ''), title: 'Library', category: 'general' },
  ];
  const retrieve = createFieldedBm25(records, { weights: { title: 3, category: 0, tags: 0, text: 1 } });
  assert.equal(retrieve('library')[0].id, 'title');
  assert.throws(() => createFieldedBm25(records, { weights: { title: -1, category: 1, tags: 1, text: 1 } }));
});
test('group metrics account for missing facets and alternative supporting records', () => {
  assert.deepEqual(retrievalMetrics(['a', 'b', 'c'], [['a', 'other'], ['c'], ['missing']]),
    { groupRecallAt1: 1 / 3, groupRecallAt3: 2 / 3, groupMRRAt3: (1 + 1 / 3) / 3 });
  assert.equal(retrievalMetrics([], []), null);
  assert.deepEqual(retrievalMetrics(['a', 'b', 'c', 'outside'], [['outside']]),
    { groupRecallAt1: 0, groupRecallAt3: 0, groupMRRAt3: 0 });
});
