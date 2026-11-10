import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { config } from '../src/config.js';
import { createSeedData } from '../src/seed.js';
import { resetDbForTests, getDb, saveDb, closeDb } from '../src/store.js';
import { createServer, retrieveKnowledge, resetRuntimeStateForTests } from '../src/server.js';

async function fixture(run) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'mitra-provenance-test-'));
  config.databaseFile = path.join(directory, 'test.sqlite'); config.geminiApiKey = '';
  resetDbForTests(createSeedData()); resetRuntimeStateForTests();
  const server = createServer();
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  const call = async (route, body, token) => {
    const response = await fetch(base + route, { method: body === undefined ? 'GET' : route.startsWith('/api/knowledge/') || route.endsWith('/publish') ? 'PATCH' : 'POST',
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, ...(body !== undefined ? { body: JSON.stringify(body) } : {}) });
    return { status: response.status, ...(await response.json()) };
  };
  try {
    const login = await call('/api/auth/login', { email: 'admin@mitcorer.edu.in', password: 'mitra' });
    await run(call, login.data.token);
  } finally {
    await new Promise(resolve => server.close(resolve)); closeDb();
    assert.equal(path.dirname(directory), path.resolve(os.tmpdir()));
    assert.ok(path.basename(directory).startsWith('mitra-provenance-test-'));
    fs.rmSync(directory, { recursive: true, force: true });
  }
}
test('expired managed facts and future passages are suppressed in retrieval, native and compound answers', async () => fixture(async (call, token) => {
  assert.equal((await call('/api/knowledge/KB-2', { expectedRevision: 0, provenance: { validUntil: '2000-01-01' }, verifySource: true }, token)).status, 200);
  assert.ok(!retrieveKnowledge('first year fees').some(record => record.id === 'KB-2'));
  for (const language of ['en', 'mr', 'hi']) {
    const result = await call('/api/public-assistant/ask', { question: 'first year fees', language });
    assert.equal(result.status, 200); assert.deepEqual(result.data.evidence, []);
  }
  const compound = await call('/api/public-assistant/ask', { question: 'What are first year fees and hostel fees?' });
  assert.equal(compound.data.sections[0].status, 'unsupported');
  assert.ok(compound.data.evidence.every(record => record.id !== 'KB-2'));
  await call('/api/knowledge/KB-20', { expectedRevision: 0, provenance: { validFrom: '2999-01-01' }, verifySource: true }, token);
  assert.deepEqual((await call('/api/public-assistant/ask', { question: 'library' })).data.evidence, []);
  await call('/api/knowledge/KB-16', { expectedRevision: 0, provenance: { validUntil: '2000-01-01' }, verifySource: true }, token);
  const placement = await call('/api/public-assistant/ask', { question: 'placement highlights' });
  assert.deepEqual(placement.data.evidence, []); assert.doesNotMatch(placement.data.answer, /21 LPA/);
  await call('/api/knowledge/KB-32', { expectedRevision: 0, provenance: { validUntil: '2000-01-01' }, verifySource: true }, token);
  assert.deepEqual((await call('/api/public-assistant/ask', { question: 'attendance requirement' })).data.evidence, []);
}));
test('review action persists, edits invalidate its binding, and historical scope remains available', async () => fixture(async (call, token) => {
  const reviewed = await call('/api/knowledge/KB-6', { expectedRevision: 0, provenance: { academicYear: '2024-25', pageStart: 1403, pageEnd: 1407 }, verifySource: true }, token);
  assert.equal(reviewed.status, 200);
  closeDb();
  const answer = await call('/api/public-assistant/ask', { question: 'historical seat matrix 2024-25' });
  assert.equal(answer.data.evidence[0].verification.status, 'recorded');
  assert.equal(answer.data.evidence[0].provenance.pageStart, 1403);
  const text = getDb().knowledge.find(record => record.id === 'KB-6').text + ' Reviewed historical scope.';
  assert.equal((await call('/api/knowledge/KB-6', { expectedRevision: 1, text }, token)).status, 400);
  await call('/api/knowledge/KB-6', { expectedRevision: 1, text, verifySource: true }, token);
  assert.equal((await call('/api/public-assistant/ask', { question: 'historical seat matrix 2024-25' })).data.evidence[0].verification.status, 'recorded');
  assert.equal((await call('/api/knowledge/KB-6', { expectedRevision: 2, verification: { verifiedAt: '2026-10-10' } }, token)).status, 400);
}));
test('reviewed pages inherit metadata, keep stable passage IDs on republishing, and reject invalid batches atomically', async () => fixture(async (call, token) => {
  getDb().officialSources.unshift({ id: 'SRC-TEST', title: 'Riverrail notice', documentType: 'Admissions', sourceAuthority: 'Fixture authority', originalFileName: 'notice.pdf', academicYear: '2026-27' }); saveDb();
  const body = { verifiedPages: [{ page: 7, text: 'RIVER-NOTICE123 supplemental conditions.' }, { page: 4, text: 'RIVER-NOTICE123 primary conditions.' }], provenance: { documentVersion: 'Notice 2', section: 'Reporting' }, sourceUrl: 'https://example.com/notice.pdf' };
  const published = await call('/api/official-sources/SRC-TEST/publish', body, token);
  assert.equal(published.status, 200); assert.equal(published.data.linkedKnowledgeCount, 2);
  const originals = getDb().knowledge.filter(record => record.sourceDocumentId === 'SRC-TEST');
  assert.equal(originals[0].provenance.pageStart, 4);
  const answer = await call('/api/public-assistant/ask', { question: 'What does RIVER-NOTICE123 say?' });
  assert.equal(answer.data.evidence[0].academicYear, '2026-27');
  assert.equal(answer.data.evidence[0].verification.status, 'recorded');
  assert.equal(answer.data.evidence[0].sourceUrl, body.sourceUrl);
  const republished = await call('/api/official-sources/SRC-TEST/publish', { ...body, expectedRevision: 1 }, token);
  assert.equal(republished.status, 200);
  assert.deepEqual(getDb().knowledge.filter(record => record.sourceDocumentId === 'SRC-TEST').map(record => record.id), originals.map(record => record.id));
  assert.equal(getDb().knowledge.find(record => record.id === originals[0].id).revision, 2);
  const before = JSON.stringify(getDb().knowledge);
  assert.equal((await call('/api/official-sources/SRC-TEST/publish', { verifiedPages: [{ page: 4, text: 'a' }, { page: 4, text: 'b' }] }, token)).status, 400);
  assert.equal(JSON.stringify(getDb().knowledge), before);
  assert.equal((await call('/api/official-sources/SRC-TEST/publish', { ...body, expectedRevision: 1 }, token)).status, 409);
}));
test('superseded and conflicting structured facts decline rather than silently choosing figures', async () => fixture(async (call, token) => {
  const original = getDb().knowledge.find(record => record.id === 'KB-2');
  const copy = structuredClone(original); copy.id = 'KB-conflict'; copy.facts.firstYear.open += 1000;
  getDb().knowledge.push(copy); saveDb();
  const conflict = await call('/api/public-assistant/ask', { question: 'first year fees' });
  assert.equal(conflict.data.conflict, true); assert.match(conflict.data.answer, /disagree/); assert.doesNotMatch(conflict.data.answer, /1,05,000/);
  const suppressed = await call('/api/knowledge/KB-conflict', { expectedRevision: 0, provenance: { supersededBy: 'KB-2' } }, token);
  assert.equal(suppressed.status, 200);
  assert.match((await call('/api/public-assistant/ask', { question: 'first year fees' })).data.answer, /1,05,000/);
  assert.equal((await call('/api/knowledge/KB-2', { expectedRevision: 0, provenance: { supersededBy: 'KB-conflict' } }, token)).status, 400);
}));
