import test from 'node:test';
import assert from 'node:assert/strict';
import { requestJson } from '../src/request-json.mjs';

test('a hung request times out once without automatic duplicate writes', async () => {
  let calls = 0;
  const fetchImpl = (url, { signal }) => new Promise((resolve, reject) => {
    calls++; signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), { once: true });
  });
  await assert.rejects(requestJson('/ask', { method: 'POST' }, 10, fetchImpl), e => e.code === 'REQUEST_TIMEOUT');
  assert.equal(calls, 1);
});

test('HTTP errors retain status for session-expiry recovery', async () => {
  await assert.rejects(requestJson('/ask', {}, 100, async () => ({ ok: false, status: 404, json: async () => ({ error: { message: 'Expired' } }) })), e => e.status === 404 && e.message === 'Expired');
});

test('deadline also covers a stalled response body', async () => {
  const fetchImpl = async (url, { signal }) => ({ ok: true, json: () => new Promise((resolve, reject) => {
    signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), { once: true });
  }) });
  await assert.rejects(requestJson('/ask', {}, 10, fetchImpl), error => error.code === 'REQUEST_TIMEOUT');
});
