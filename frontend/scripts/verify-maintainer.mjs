import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fork } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';
import { createServer as createViteServer } from 'vite';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'mitra-maintainer-browser-'));
let child;
let browser;
let vite;
let backendPort = 0;
function removeTemporaryData() {
  if (path.dirname(directory) !== path.resolve(os.tmpdir()) || !path.basename(directory).startsWith('mitra-maintainer-browser-')) throw new Error('Unsafe cleanup path');
  fs.rmSync(directory, { recursive: true, force: true });
}
async function startBackend() {
  child = fork(path.join(root, 'scripts/maintainer-test-server.mjs'), [], {
    cwd: root, execArgv: ['--no-warnings=ExperimentalWarning'], stdio: ['ignore', 'pipe', 'pipe', 'ipc'],
    env: { ...process.env, NODE_ENV: 'test', DATABASE_FILE: path.join(directory, 'test.sqlite'), DATA_FILE: path.join(directory, 'no-legacy.json'),
      TOKEN_SECRET: 'isolated-browser-fixture-secret', GEMINI_API_KEY: '', PORT: String(backendPort), MITRA_MAINTAINER_TEST: '1' },
  });
  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Test backend did not start')), 10_000);
    child.once('error', error => { clearTimeout(timeout); reject(error); });
    child.once('exit', code => { clearTimeout(timeout); reject(new Error(`Test backend exited before readiness: ${code}`)); });
    child.once('message', message => { clearTimeout(timeout); backendPort = message.port; resolve(); });
  });
}
async function stopBackend() {
  if (!child || child.exitCode !== null) return;
  const active = child;
  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => { active.kill(); reject(new Error('Test backend shutdown timed out')); }, 10_000);
    active.once('exit', () => { clearTimeout(timeout); resolve(); });
    active.send('shutdown');
  });
  child = null;
}
try {
  await startBackend();
  vite = await createViteServer({ root, server: { port: 0, host: '127.0.0.1', proxy: { '/api': `http://127.0.0.1:${backendPort}` } } });
  await vite.listen();
  const origin = `http://127.0.0.1:${vite.httpServer.address().port}`;
  browser = await chromium.launch({ channel: process.env.MITRA_BROWSER_CHANNEL || 'chrome', headless: true });
  const admin = await browser.newContext();
  const visitor = await browser.newContext();
  const page = await admin.newPage();
  const publicPage = await visitor.newPage();
  const browserErrors = [];
  page.on('pageerror', error => browserErrors.push(error.message));
  publicPage.on('pageerror', error => browserErrors.push(error.message));
  await page.goto(origin);
  assert.equal(await page.getByRole('button', { name: 'Maintainer sign in' }).count(), 0);
  // Public login UI is intentionally deferred. Authenticate the existing API fixture;
  // browser cookies then restore the protected workspace through the normal refresh flow.
  const rejected = await page.request.post(`${origin}/api/auth/login`, { data: { email: 'admin@mitcorer.edu.in', password: 'wrong-fixture-password' } });
  assert.equal(rejected.status(), 401);
  const login = await page.request.post(`${origin}/api/auth/login`, { data: { email: 'admin@mitcorer.edu.in', password: 'mitra' } });
  assert.equal(login.status(), 200);
  const token = (await login.json()).data.token;
  await page.reload();
  await page.getByRole('button', { name: 'Knowledge Base', exact: true }).waitFor();
  await page.getByRole('button', { name: 'Knowledge Base', exact: true }).click();
  await page.locator('.knowledgeRecordList').waitFor();
  const editor = page.getByRole('region', { name: 'Edit knowledge record' });
  const card = title => page.locator('.knowledgeRecordList article').filter({ has: page.getByRole('heading', { name: title, exact: true }) });
  const openRecord = async title => { await card(title).getByRole('button', { name: 'Edit', exact: true }).click(); await editor.waitFor(); };
  const save = async (id, expected = 200) => {
    const received = page.waitForResponse(response => response.url().endsWith(`/api/knowledge/${id}`) && response.request().method() === 'PATCH');
    await editor.getByRole('button', { name: 'Save record', exact: true }).click();
    const response = await received;
    assert.equal(response.status(), expected);
    if (expected === 200) await editor.waitFor({ state: 'hidden' });
    return response.json();
  };
  await openRecord('MITCORER fees AY 2026-27');
  const amount = editor.getByLabel('Open / OMS', { exact: true }).first();
  await amount.fill('112345');
  await editor.locator('details > summary').click();
  await editor.getByLabel('Source academic year', { exact: true }).fill('2026-27');
  await editor.getByLabel('Document version', { exact: true }).fill('Fixture notice 1');
  await editor.getByLabel('Start page', { exact: true }).fill('4');
  await editor.getByLabel('End page', { exact: true }).fill('4');
  await editor.getByRole('checkbox', { name: 'I verified this content and its document references against the source.' }).check();
  await page.route('**/api/knowledge/KB-2', route => route.abort());
  await editor.getByRole('button', { name: 'Save record', exact: true }).click();
  await editor.getByRole('alert').waitFor();
  assert.equal(await amount.inputValue(), '112345');
  await page.unroute('**/api/knowledge/KB-2');
  const fee = (await save('KB-2')).data;
  await openRecord(fee.title);
  await amount.fill('114567');
  const concurrent = await page.request.patch(`${origin}/api/knowledge/KB-2`, { headers: { Authorization: `Bearer ${token}` }, data: { expectedRevision: fee.revision, title: `${fee.title} (concurrent)` } });
  assert.equal(concurrent.status(), 200);
  const conflict = await save('KB-2', 409);
  assert.equal(conflict.error.code, 'REVISION_CONFLICT');
  assert.equal(await amount.inputValue(), '114567');
  await editor.getByRole('button', { name: 'Cancel', exact: true }).click();
  await page.reload();
  await page.getByRole('button', { name: 'Knowledge Base', exact: true }).waitFor();
  await page.getByRole('button', { name: 'Knowledge Base', exact: true }).click();
  await page.locator('.knowledgeRecordList').waitFor();
  await openRecord('MITCORER library and digital resources');
  await editor.getByLabel('Verified text').fill('Library test record: digital resources are available. Timings are not published.');
  await editor.getByLabel('Reviewed Hindi translation').fill('इस परीक्षण रिकॉर्ड में पुस्तकालय की डिजिटल सामग्री उपलब्ध है। समय प्रकाशित नहीं है।');
  await editor.getByRole('button', { name: 'Save record', exact: true }).click();
  await editor.getByRole('alert').waitFor();
  assert.match(await editor.getByRole('alert').innerText(), /confirm the review/);
  // Synthetic fixture approval exercises the UI; it is not production speaker approval.
  await editor.getByRole('checkbox', { name: 'I reviewed these translations against the current source text.' }).check();
  await save('KB-20');
  await publicPage.goto(origin);
  if (!await publicPage.locator('.publicComposer').isVisible()) await publicPage.getByRole('button', { name: 'Open MIT Barshi admission assistant' }).click();
  const ask = async (question, language = 'en') => {
    await publicPage.getByRole('combobox', { name: 'Response language', exact: true }).selectOption(language);
    await publicPage.locator('.publicComposer textarea').fill(question);
    const received = publicPage.waitForResponse(response => response.url().endsWith('/api/public-assistant/ask'));
    await publicPage.locator('.publicComposer textarea').press('Enter');
    const response = await received; assert.equal(response.status(), 200);
    await publicPage.waitForFunction(() => !document.querySelector('.publicComposer textarea').disabled);
    return (await response.json()).data;
  };
  const translated = await ask('Tell me about the library.', 'hi');
  assert.equal(translated.localizationStatus, 'maintainer-reviewed');
  await openRecord('MITCORER library and digital resources');
  assert.equal(await editor.getByRole('checkbox', { name: 'I reviewed these translations against the current source text.' }).isChecked(), false);
  await editor.getByLabel('Verified text').fill('Library test record: digital resources are available. Timings and borrowing rules are not published.');
  await save('KB-20');
  const stale = await ask('Tell me about the library.', 'hi');
  assert.equal(stale.localizationStatus, 'fallback');
  assert.match(stale.answer, /borrowing rules are not published/);
  const before = await ask('What are the first-year Open category fees?');
  assert.match(before.answer, /1,12,345/);
  assert.equal(before.evidence[0].provenance.pageStart, 4);
  assert.equal(before.evidence[0].verification.status, 'recorded');
  assert.match(await publicPage.locator('.publicBubble.assistant').last().innerText(), /1,12,345/);
  assert.equal(await publicPage.locator('.publicEvidence').count(), 0);
  await stopBackend();
  await startBackend();
  const after = await ask('What are the first-year Open category fees?');
  assert.match(after.answer, /1,12,345/);
  assert.equal(after.evidence[0].passage.sha256, before.evidence[0].passage.sha256);
  assert.equal((await ask('Tell me about the library.', 'hi')).localizationStatus, 'fallback');
  await page.reload();
  await page.getByRole('button', { name: 'Knowledge Base', exact: true }).waitFor();
  await page.getByRole('button', { name: 'Knowledge Base', exact: true }).click();
  await page.locator('.knowledgeRecordList').waitFor();
  await openRecord(`${fee.title} (concurrent)`);
  await editor.getByLabel('Publication status').selectOption('Retired');
  await save('KB-2');
  assert.deepEqual((await ask('What are the first-year Open category fees?')).evidence, []);
  const unauthorized = await publicPage.request.patch(`${origin}/api/knowledge/KB-2`, { data: { expectedRevision: 0, title: 'Unauthorized' } });
  assert.equal(unauthorized.status(), 401);
  const staffLogin = await publicPage.request.post(`${origin}/api/auth/login`, { data: { email: 'staff@mitcorer.edu.in', password: 'mitra' } });
  const staffToken = (await staffLogin.json()).data.token;
  const forbidden = await publicPage.request.patch(`${origin}/api/knowledge/KB-2`, { headers: { Authorization: `Bearer ${staffToken}` }, data: { expectedRevision: 0, title: 'Unauthorized' } });
  assert.equal(forbidden.status(), 403);
  assert.deepEqual(browserErrors, []);
  console.log('PASS: API fixture login and browser restoration, failed save preservation, structured edit, real revision conflict, translation review/staleness, separate-process persistence, retirement and server authorization. Public login UI deferred.');
} finally {
  await browser?.close();
  await vite?.close();
  await stopBackend();
  removeTemporaryData();
}
