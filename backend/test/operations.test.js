import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { assistantOperations, clearAssistantEvents, recordAssistantEvent, reviewAssistantEvent } from '../src/assistant-observability.js';
import { sourceFingerprint } from '../src/provenance.js';
import { createServer, resetRuntimeStateForTests, answerAdmissionQuestion } from '../src/server.js';
import { config } from '../src/config.js';
import { createSeedData } from '../src/seed.js';
import { resetDbForTests, closeDb } from '../src/store.js';

test('health distinguishes published availability, changed reviews and unknown source health', () => {
  const current = { id: 'KB-1', status: 'Published', text: 'Approved passage' };
  current.verification = { verifiedAt: '2026-11-18T00:00:00Z', contentHash: sourceFingerprint(current) };
  const changed = structuredClone(current); changed.text = 'Changed passage';
  const result = assistantOperations({ knowledge: [current, changed, { status: 'Review' }, { status: 'Published', provenance: { validUntil: '2020-01-01' } }], officialSources: [{}] });
  assert.equal(result.knowledge.availability.available, 2);
  assert.equal(result.knowledge.availability.expired, 1);
  assert.equal(result.knowledge.sourceReview.recorded, 1);
  assert.equal(result.knowledge.sourceReview['source-changed'], 1);
  assert.equal(result.sourceHealth.unknown, 1);
});

test('diagnostics enforce allowlisted fields, bounded retention and triage without collecting private text', () => {
  clearAssistantEvents();
  const now = Date.now();
  for (let index = 0; index < 510; index++) recordAssistantEvent({ outcomeStatus: 'INSUFFICIENT_EVIDENCE', question: 'secret@example.com', answer: 'private', token: 'secret', responseLanguage: 'hi', evidence: [{ id: 'KB-18' }, { id: 'secret@example.com' }] }, 20, now);
  const staff = assistantOperations({}, false, now);
  assert.equal(staff.diagnostics.total, 500); assert.equal(staff.diagnostics.events, undefined);
  const admin = assistantOperations({}, true, now);
  assert.equal(admin.diagnostics.events.length, 100);
  assert.doesNotMatch(JSON.stringify(admin), /secret@example|private|token/);
  const event = admin.diagnostics.events[0];
  assert.equal(reviewAssistantEvent(event.id, 'Resolved').status, 'Resolved');
  assert.throws(() => reviewAssistantEvent(event.id, 'Publish'));
  assert.equal(assistantOperations({}, true, now + 86400001).diagnostics.total, 0);
});

test('aggregate trends use four six-hour buckets from the redacted 24-hour event window', () => {
  clearAssistantEvents();
  const now = Date.now();
  recordAssistantEvent({ outcomeStatus: 'ANSWERED', responseLanguage: 'en' }, 20, now - 17 * 60 * 60 * 1000);
  recordAssistantEvent({ outcomeStatus: 'INSUFFICIENT_EVIDENCE', responseLanguage: 'mr', question: 'private' }, 30, now - 2 * 60 * 60 * 1000);
  const trends = assistantOperations({}, false, now).diagnostics.trends;
  assert.equal(trends.windowHours, 24);
  assert.equal(trends.intervalHours, 6);
  assert.deepEqual(trends.points.map(point => [point.total, point.answered, point.triageCandidates]), [[0, 0, 0], [1, 1, 0], [0, 0, 0], [1, 0, 1]]);
  assert.equal(trends.points[0].to, trends.points[1].from);
});

test('operations API enforces anonymous/applicant/staff/admin permissions and redacted traces', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mitra-operations-'));
  const previous = config.databaseFile;
  config.databaseFile = path.join(dir, 'test.sqlite');
  config.groqApiKey = ''; config.geminiApiKey = '';
  resetDbForTests(createSeedData()); resetRuntimeStateForTests();
  const server = createServer(); await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  const request = async (url, token, body) => {
    const response = await fetch(base + url, { method: body ? 'PATCH' : 'GET', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
    return { status: response.status, payload: await response.json() };
  };
  const login = async email => {
    const result = await fetch(base + '/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password: 'mitra' }) });
    return (await result.json()).data.token;
  };
  try {
    assert.equal((await request('/api/assistant/operations')).status, 401);
    const applicant = await login('applicant@example.com'), staff = await login('staff@mitcorer.edu.in'), admin = await login('admin@mitcorer.edu.in');
    assert.equal((await request('/api/assistant/operations', applicant)).status, 403);
    await answerAdmissionQuestion({ question: 'What is the weather in Barshi?' }, null);
    assert.equal((await request('/api/assistant/operations', staff)).payload.data.diagnostics.events, undefined);
    const result = await request('/api/assistant/operations', admin);
    const event = result.payload.data.diagnostics.events[0]; assert.ok(event);
    assert.doesNotMatch(JSON.stringify(result), /weather|Barshi|applicant@example|questionHash/);
    assert.equal((await request(`/api/assistant/operations/${event.id}`, staff, { status: 'Resolved' })).status, 403);
    assert.equal((await request(`/api/assistant/operations/${event.id}`, admin, { status: 'Resolved' })).status, 200);
    const reviewed = await request('/api/assistant/operations', admin);
    const reviewedEvent = reviewed.payload.data.diagnostics.events.find(item => item.id === event.id);
    assert.equal(reviewedEvent.status, 'Resolved');
  } finally {
    await new Promise(resolve => server.close(resolve)); closeDb(); config.databaseFile = previous;
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
