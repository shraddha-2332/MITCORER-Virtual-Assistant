import test from 'node:test';
import assert from 'node:assert/strict';
import { requestGeneration, requestGroqGeneration } from '../src/generation-client.js';
const options = { apiKey: 'test-key', primaryModel: 'primary', fallbackModel: 'fallback', body: {}, sleep: async () => {}, random: () => 0 };

test('generation retries transient failures once then identifies the actual fallback model', async () => {
  const calls = [];
  const result = await requestGeneration({ ...options, fetchImpl: async url => {
    calls.push(url);
    return calls.length < 3 ? { ok: false, status: 503 } : { ok: true, json: async () => ({ candidates: [{ content: { parts: [{ text: 'Evidence-grounded draft' }] } }] }) };
  } });
  assert.equal(calls.length, 3);
  assert.ok(calls[0].includes('/primary:'));
  assert.ok(calls[1].includes('/primary:'));
  assert.ok(calls[2].includes('/fallback:'));
  assert.deepEqual(result, { text: 'Evidence-grounded draft', model: 'fallback', attempts: 3 });
});

test('Gemini usage metadata is exposed only when provider returns valid token counts', async () => {
  const diagnostics = [];
  const result = await requestGeneration({ ...options, onDiagnostic: event => diagnostics.push(event), fetchImpl: async () => ({
    ok: true, json: async () => ({ candidates: [{ content: { parts: [{ text: 'Grounded answer' }] } }],
      usageMetadata: { promptTokenCount: 21, candidatesTokenCount: 8, totalTokenCount: 29 } }),
  }) });
  assert.deepEqual(result.usage, { inputTokens: 21, outputTokens: 8, totalTokens: 29 });
  assert.deepEqual(diagnostics[0].usageTokens, result.usage);
});

test('bad credentials, billing, safety and insufficient evidence do not cascade', async () => {
  for (const status of [400, 401, 402, 403, 404]) {
    let calls = 0;
    assert.equal(await requestGeneration({ ...options, fetchImpl: async () => { calls++; return { ok: false, status }; } }), null);
    assert.equal(calls, 1);
  }
  for (const payload of [{ promptFeedback: { blockReason: 'SAFETY' } }, { candidates: [{ content: { parts: [{ text: 'INSUFFICIENT_EVIDENCE' }] } }] }]) {
    let calls = 0;
    assert.equal(await requestGeneration({ ...options, fetchImpl: async () => { calls++; return { ok: true, json: async () => payload }; } }), null);
    assert.equal(calls, 1);
  }
});

test('total deadline and abort signals bound repeated timeouts', async () => {
  const start = Date.now();
  const result = await requestGeneration({ ...options, timeoutMs: 30, fetchImpl: async (_url, { signal }) => new Promise((_resolve, reject) => signal.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')), { once: true })) });
  assert.equal(result, null);
  assert.ok(Date.now() - start < 1000);
});

test('Groq retries transient failures and identifies the fallback model', async () => {
  const calls = [];
  const result = await requestGroqGeneration({
    apiKey: 'test-key', primaryModel: 'primary', fallbackModel: 'fallback',
    sleep: async () => {}, random: () => 0,
    fetchImpl: async (url, options) => {
      calls.push({ url, body: JSON.parse(options.body) });
      return calls.length === 1
        ? { ok: false, status: 503 }
        : { ok: true, json: async () => ({ choices: [{ message: { content: 'Grounded draft.' } }] }) };
    },
  });
  assert.equal(calls.length, 2);
  assert.ok(calls.every(call => call.url.includes('api.groq.com')));
  assert.deepEqual(calls.map(call => call.body.model), ['primary', 'fallback']);
  assert.deepEqual(result, { text: 'Grounded draft.', model: 'groq:fallback', attempts: 2 });
});

test('Groq usage metadata is exposed when returned and omitted when unavailable', async () => {
  const result = await requestGroqGeneration({ apiKey: 'test-key', primaryModel: 'primary', fallbackModel: '',
    fetchImpl: async () => ({ ok: true, json: async () => ({ choices: [{ message: { content: 'Grounded draft.' } }], usage: { prompt_tokens: 13, completion_tokens: 5, total_tokens: 18 } }) }) });
  assert.deepEqual(result.usage, { inputTokens: 13, outputTokens: 5, totalTokens: 18 });
  const withoutUsage = await requestGroqGeneration({ apiKey: 'test-key', primaryModel: 'primary', fallbackModel: '',
    fetchImpl: async () => ({ ok: true, json: async () => ({ choices: [{ message: { content: 'Grounded draft.' } }] }) }) });
  assert.equal(Object.hasOwn(withoutUsage, 'usage'), false);
});

test('Groq does not retry non-transient provider errors', async () => {
  let calls = 0;
  const result = await requestGroqGeneration({
    apiKey: 'test-key', primaryModel: 'primary', fallbackModel: 'fallback',
    fetchImpl: async () => { calls++; return { ok: false, status: 401 }; },
  });
  assert.equal(result, null);
  assert.equal(calls, 1);
});
