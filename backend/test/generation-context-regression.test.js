import test, { beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { semanticResponseCache } from '../src/semantic-cache.js';
import { config } from '../src/config.js';
import { resetDbForTests, closeDb, getDb } from '../src/store.js';
import { answerAdmissionQuestion } from '../src/server.js';
import { askPublicWithHistory } from '../src/conversations.js';

const originalFetch = globalThis.fetch;
const originalKey = config.geminiApiKey;
beforeEach(() => {
  config.databaseFile = ':memory:';
  config.geminiApiKey = '';
  resetDbForTests();
});
afterEach(() => {
  globalThis.fetch = originalFetch;
  config.geminiApiKey = originalKey;
  closeDb();
  semanticResponseCache.clear();
});

test('successful advisory generation is verified without a context initialization crash', async () => {
  config.geminiApiKey = 'test-unused-key';
  let calls = 0;
  globalThis.fetch = async () => {
    calls++;
    return { ok: true, json: async () => ({ candidates: [{ content: { parts: [{ text: 'MITCORER provides practical learning facilities.' }] } }] }) };
  };
  const answer = await answerAdmissionQuestion({ question: 'Why should I choose MITCORER?', language: 'en' }, null);
  assert.equal(calls, 1);
  assert.equal(answer.model, config.geminiModel);
  assert.equal(answer.answer, 'MITCORER provides practical learning facilities.');
  assert.ok(answer.evidence.length);
});

test('unsupported and failed advisory generations retain the deterministic fallback', async () => {
  config.geminiApiKey = 'test-unused-key';
  for (const draft of ['You have guaranteed admission.', 'Tuition costs INR 9,99,999.']) {
    globalThis.fetch = async () => ({ ok: true, json: async () => ({ candidates: [{ content: { parts: [{ text: draft }] } }] }) });
    const answer = await answerAdmissionQuestion({ question: 'Why should I choose MITCORER?', language: 'en' }, null);
    assert.equal(answer.model, 'deterministic-rag-fallback');
    assert.doesNotMatch(answer.answer, /guaranteed admission|9,99,999/);
  }
  globalThis.fetch = async () => { throw new Error('Simulated upstream failure'); };
  const answer = await answerAdmissionQuestion({ question: 'Why should I choose MITCORER?', language: 'en' }, null);
  assert.equal(answer.model, 'deterministic-rag-fallback');
});

test('successful non-advisory evidence fallback also reaches generation verification', async () => {
  config.geminiApiKey = 'test-unused-key';
  getDb().knowledge.push({ id: 'KB-ZEPHYR', title: 'Zephyr mentoring protocol', category: 'mentoring', status: 'Published', source: 'Maintained mentoring record', text: 'Zephyr mentoring protocol provides supervised peer mentoring.', tags: ['zephyr', 'mentoring', 'protocol'] });
  let calls = 0;
  globalThis.fetch = async () => {
    calls++;
    return { ok: true, json: async () => ({ candidates: [{ content: { parts: [{ text: 'Zephyr mentoring protocol provides supervised peer mentoring.' }] } }] }) };
  };
  const answer = await answerAdmissionQuestion({ question: 'What is the Zephyr mentoring protocol?', language: 'en' }, null);
  assert.equal(calls, 1);
  assert.equal(answer.model, config.geminiModel);
  assert.ok(answer.evidence.some(record => record.id === 'KB-ZEPHYR'));
});

test('public DSE follow-up uses edited maintained fees and preserves route and academic year', async () => {
  const record = getDb().knowledge.find(item => item.id === 'KB-2');
  record.facts.directSecondYear.concessionGirl = 23456;
  const first = await askPublicWithHistory({ question: 'I am an OBC girl. What are DSE fees for 2026-27?' }, answerAdmissionQuestion, 'b'.repeat(64));
  const followup = await askPublicWithHistory({ question: 'what are the fees?', conversationId: first.conversationId }, answerAdmissionQuestion, 'b'.repeat(64));
  assert.match(followup.answer, /23,456/);
  assert.match(followup.answer, /Direct Second Year/);
  assert.doesNotMatch(followup.answer, /17,217|18,362|Profile Note/);
  const historical = await askPublicWithHistory({ question: 'fees for 2025-26?', conversationId: first.conversationId }, answerAdmissionQuestion, 'b'.repeat(64));
  assert.equal(historical.evidence.length, 0);
  assert.doesNotMatch(historical.answer, /23,456|17,217|18,362/);
});

test('profile context cannot reintroduce fees after canonical record retirement', async () => {
  getDb().knowledge.find(item => item.id === 'KB-2').status = 'Retired';
semanticResponseCache.clear();

const retired = await answerAdmissionQuestion({ question: 'Tell me about first year engineering fees.', language: 'en' }, null);
  assert.equal(retired.evidence.length, 0);
  assert.doesNotMatch(retired.answer, /10,582|Profile Note/);
});

test('advisory phrasing cannot bypass maintained critical facts or their retirement', async () => {
  config.geminiApiKey = 'test-unused-key';
  let calls = 0;
  globalThis.fetch = async () => { calls++; throw new Error('Generation must not be called'); };
  for (const question of ['Tell me about first year engineering fees.', 'Can you explain the CSE intake?']) {
    const answer = await answerAdmissionQuestion({ question, language: 'en' }, null);
    assert.equal(answer.model, 'deterministic-rag-fallback');
    assert.ok(answer.evidence.length);
  }
  getDb().knowledge.find(item => item.id === 'KB-2').status = 'Retired';
  semanticResponseCache.clear();
  const retired = await answerAdmissionQuestion({ question: 'Tell me about first year engineering fees.', language: 'en' }, null);
  assert.equal(retired.evidence.length, 0);
  assert.equal(calls, 0);
});
