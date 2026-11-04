import assert from 'node:assert/strict';
import { test } from 'node:test';
import { SemanticResponseCache } from '../src/semantic-cache.js';

test('SemanticResponseCache stores and retrieves verified responses', () => {
  const cache = new SemanticResponseCache(10, 60000);
  const sampleResponse = {
    source: 'MITCORER Admission Office',
    answer: 'First year engineering fee is INR 1,05,000.',
    outcomeStatus: 'VERIFIED',
  };

  cache.set('first year fee', sampleResponse, 'en');
  const hit = cache.get('first year fee', 'en');

  assert.ok(hit);
  assert.equal(hit.answer, sampleResponse.answer);
  assert.equal(hit.__fromSemanticCache, true);
});

test('SemanticResponseCache does not cache unverified responses or clarifications', () => {
  const cache = new SemanticResponseCache(10, 60000);

  cache.set('random query', {
    source: 'No verified record',
    answer: 'I could not find an official answer.',
    outcomeStatus: 'INSUFFICIENT_EVIDENCE',
  });
  assert.equal(cache.get('random query'), null);

  cache.set('clarification query', {
    source: 'Clarification required',
    clarification: true,
    answer: 'Please clarify your branch.',
  });
  assert.equal(cache.get('clarification query'), null);
});

test('SemanticResponseCache evicts oldest entries when maxSize is reached', () => {
  const cache = new SemanticResponseCache(2, 60000);
  cache.set('q1', { outcomeStatus: 'VERIFIED', answer: 'a1' });
  cache.set('q2', { outcomeStatus: 'VERIFIED', answer: 'a2' });
  cache.set('q3', { outcomeStatus: 'VERIFIED', answer: 'a3' });

  assert.equal(cache.get('q1'), null, 'q1 should be evicted');
  assert.ok(cache.get('q2'), 'q2 should still exist');
  assert.ok(cache.get('q3'), 'q3 should still exist');
});

test('SemanticResponseCache respects TTL expiration', async () => {
  const cache = new SemanticResponseCache(10, 50); // 50ms TTL
  cache.set('quick', { outcomeStatus: 'VERIFIED', answer: 'quick' });

  assert.ok(cache.get('quick'));
  await new Promise(r => setTimeout(r, 60));
  assert.equal(cache.get('quick'), null);
});

