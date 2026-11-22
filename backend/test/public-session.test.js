import test, { beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { createServer, getClientIp, resetRuntimeStateForTests } from '../src/server.js';
import { config } from '../src/config.js';
import { resetDbForTests, closeDb, getDb } from '../src/store.js';
import { publicSessionCookie, publicSessionHash } from '../src/public-session.js';
import { askPublicWithHistory, resetPublicConversation } from '../src/conversations.js';
import { hashPassword, verifyPassword, createToken, verifyToken } from '../src/auth.js';

const token = 'a'.repeat(64);
test('retired CampusGuard demo password alias is rejected', () => {
  const seedHash = hashPassword('local-fixture-password', 'mitra-seed-salt');
  assert.equal(verifyPassword('local-fixture-password', seedHash), true);
  assert.equal(verifyPassword('campusguard', seedHash), false);
});
beforeEach(() => { config.databaseFile = ':memory:'; config.geminiApiKey = ''; config.trustProxy = false; resetDbForTests(); resetRuntimeStateForTests(); });
afterEach(() => closeDb());
async function withServer(run) {
  const server = createServer();
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  try { await run(`http://127.0.0.1:${server.address().port}`); }
  finally { await new Promise(resolve => server.close(resolve)); }
}
async function ask(base, cookie, body, method = 'POST') {
  const response = await fetch(`${base}/api/public-assistant/${method === 'DELETE' ? 'conversation' : 'ask'}`, { method, headers: { 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}) }, body: JSON.stringify(body) });
  return { response, payload: await response.json() };
}

test('public history requires its HttpOnly browser session and reset deletes stored exchanges', async () => {
  await withServer(async base => {
    const first = await ask(base, null, { question: 'What are DSE fees for OBC girls?' });
    assert.equal(first.response.status, 200);
    const cookieHeader = first.response.headers.get('set-cookie');
    assert.match(cookieHeader, /HttpOnly; SameSite=Strict; Path=\/api\/public-assistant; Max-Age=1800/);
    assert.equal(first.response.headers.get('cache-control'), 'private, no-store');
    assert.equal(first.payload.data.__publicSessionCookie, undefined);
    const cookie = cookieHeader.split(';')[0];
    const id = first.payload.data.conversationId;
    const stored = getDb().conversations.find(chat => chat.id === id);
    assert.equal(stored.publicSessionHash.length, 64);
    assert.notEqual(stored.publicSessionHash, cookie.split('=')[1]);
    for (const other of [null, `mitra_public_session=${'b'.repeat(64)}`]) {
      assert.equal((await ask(base, other, { question: 'what are the fees?', conversationId: id })).response.status, 404);
      assert.equal((await ask(base, other, { conversationId: id }, 'DELETE')).response.status, 404);
    }
    const followup = await ask(base, cookie, { question: 'what are the fees?', conversationId: id });
    assert.equal(followup.response.status, 200);
    assert.match(followup.payload.data.answer, /18,362/);
    assert.equal((await ask(base, cookie, { conversationId: id }, 'DELETE')).response.status, 200);
    assert.equal(getDb().conversations.some(chat => chat.id === id), false);
    assert.equal((await ask(base, cookie, { question: 'fees?', conversationId: id })).response.status, 404);
  });
});

test('expired public exchanges are pruned and cannot be continued', async () => {
  const first = await askPublicWithHistory({ question: 'fees?' }, async () => ({ answer: 'Test answer' }), token);
  getDb().conversations.find(chat => chat.id === first.conversationId).expiresAt = '2000-01-01T00:00:00.000Z';
  await assert.rejects(askPublicWithHistory({ question: 'fees?', conversationId: first.conversationId }, async () => { assert.fail('Expired chat must not call answer engine'); }, token), /expired/);
  assert.equal(getDb().conversations.length, 0);
});

test('a reset during generation cannot resurrect deleted public history', async () => {
  const first = await askPublicWithHistory({ question: 'fees?' }, async () => ({ answer: 'Test answer' }), token);
  let release;
  const response = askPublicWithHistory({ question: 'more?', conversationId: first.conversationId }, () => new Promise(resolve => { release = resolve; }), token);
  resetPublicConversation(first.conversationId, token);
  release({ answer: 'Late answer' });
  await assert.rejects(response, /expired/);
  assert.equal(getDb().conversations.length, 0);
});

test('public cookies are secure in production and forwarded IPs require explicit trust', () => {
  const request = { headers: { 'x-forwarded-for': '198.51.100.1', 'x-real-ip': '198.51.100.2' }, socket: { remoteAddress: '127.0.0.1' } };
  assert.equal(getClientIp(request), '127.0.0.1');
  config.trustProxy = true;
  assert.equal(getClientIp(request), '198.51.100.1');
  config.trustProxy = false;
  const env = config.nodeEnv;
  try { config.nodeEnv = 'production'; assert.match(publicSessionCookie(token), /; Secure$/); }
  finally { config.nodeEnv = env; }
  assert.throws(() => publicSessionHash('bad'), /valid public session/);
});

test('anonymous or malformed refresh requests return controlled 401 responses rather than server errors', async () => {
  await withServer(async base => {
    for (const body of [{}, { refreshToken: 123 }, { refreshToken: '' }]) {
      const response = await fetch(`${base}/api/auth/refresh`, { method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: 'mitra_refresh=%INVALID' }, body: JSON.stringify(body) });
      assert.equal(response.status, 401);
      assert.equal((await response.json()).error.code, 'UNAUTHORIZED');
    }
  });
});

test('new accounts require a valid email and long passphrase, with signup throttled by client', async () => {
  await withServer(async base => {
    for (const body of [{ name: 'Test', email: 'invalid', password: 'long-valid-passphrase' }, { name: 'Test', email: 'valid@example.com', password: 'short' }]) {
      const response = await fetch(`${base}/api/auth/signup`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      assert.equal(response.status, 400);
    }
    for (let index = 0; index < 3; index++) {
      const response = await fetch(`${base}/api/auth/signup`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: 'Test', email: `valid${index}@example.com`, password: 'long-valid-passphrase' }) });
      assert.equal(response.status, 200);
    }
    assert.equal((await fetch(`${base}/api/auth/signup`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })).status, 429);
    assert.equal((await fetch(`${base}/api/ready`)).status, 200);
  });
});

test('production rejects known demo password hashes and malformed signed token suffixes', () => {
  const demo = hashPassword('local-fixture-password', 'mitra-seed-salt');
  const env = config.nodeEnv;
  try {
    config.nodeEnv = 'production';
    assert.equal(verifyPassword('local-fixture-password', demo), false);
    const unique = hashPassword('a-unique-admin-passphrase');
    assert.equal(verifyPassword('a-unique-admin-passphrase', unique), true);
  } finally { config.nodeEnv = env; }
  const signed = createToken({ id: 'TEST', email: 'test@example.com', role: 'applicant' });
  assert.throws(() => verifyToken(`${signed}.unexpected`), /Invalid authentication/);
});
