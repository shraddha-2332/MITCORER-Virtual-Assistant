import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';
import { chromium } from 'playwright-core';
import { createServer as createViteServer } from 'vite';
import { config } from '../../backend/src/config.js';
import { createSeedData } from '../../backend/src/seed.js';
import { resetDbForTests, closeDb } from '../../backend/src/store.js';
import { createServer, resetRuntimeStateForTests } from '../../backend/src/server.js';
import { numericTokens } from '../../backend/src/language.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const catalogue = fs.readFileSync(path.join(root, '../docs/answer-audit/CATALOGUE.md'), 'utf8');
const questions = [...catalogue.matchAll(/^\| (.+?) \| \d+ \/ \d+ \/ \d+ \|/gm)].map(([, question]) => question);
assert.ok(questions.length > 0, 'The answer catalogue has no runnable questions');
const corpus = { seeded: createSeedData() };
if (fs.existsSync(config.databaseFile)) {
  const connection = new DatabaseSync(config.databaseFile, { readOnly: true });
  try { corpus.maintained = JSON.parse(connection.prepare("SELECT data FROM collections WHERE name='app'").get().data); }
  finally { connection.close(); }
}
const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'mitra-all-answers-'));
function cleanupTemporaryDatabase() {
  if (path.dirname(temporary) !== path.resolve(os.tmpdir()) || !path.basename(temporary).startsWith('mitra-all-answers-')) throw new Error('Unsafe cleanup path');
  fs.rmSync(temporary, { recursive: true, force: true });
}
config.databaseFile = path.join(temporary, 'test.sqlite');
config.geminiApiKey = '';
const api = createServer();
let vite, browser;
const results = [];
const screenshots = new Set(['Which B.Tech programmes are available at MITCORER?', 'Which Polytechnic courses are available?', 'Which Direct Second Year programmes are available?', 'What is the fee structure?', 'What are hostel and mess fees?', 'What documents are required for admission?', 'Tell me about MITCORER.', 'Why choose MITCORER?', 'What are the placement highlights?', 'What scholarships are available?', 'What campus facilities are available?', 'What are fees and hostel fees?', 'List B.Tech programmes and fees.', 'How do I contact the college?']);
const directory = process.env.MITRA_BROWSER_REPORT_DIR || path.join(root, 'tmp/answer-audit');
fs.mkdirSync(directory, { recursive: true });
try {
  resetDbForTests(corpus.seeded);
  await new Promise(resolve => api.listen(0, '127.0.0.1', resolve));
  vite = await createViteServer({ root, server: { port: 0, host: '127.0.0.1', proxy: { '/api': `http://127.0.0.1:${api.address().port}` } } });
  await vite.listen();
  browser = await chromium.launch({ channel: process.env.MITRA_BROWSER_CHANNEL || 'chrome', headless: true });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  for (const [name, data] of Object.entries(corpus)) {
    resetDbForTests(data);
    await page.goto(`http://127.0.0.1:${vite.httpServer.address().port}`);
    if (!await page.locator('.publicComposer').isVisible()) await page.getByRole('button', { name: 'Open MIT Barshi admission assistant' }).click();
    for (const language of ['en', 'mr', 'hi']) {
      await page.getByRole('combobox', { name: 'Response language', exact: true }).selectOption(language);
      for (const [index, question] of questions.entries()) {
        resetRuntimeStateForTests();
        // Catalogue questions are independent cases, not a 200+ turn dialogue.
        if (await page.locator('.publicBubble.user').count()) {
          const deleted = page.waitForResponse(response => response.request().method() === 'DELETE' && response.url().endsWith('/api/public-assistant/conversation'));
          await page.locator('.publicResetButton').click();
          assert.equal((await deleted).status(), 200);
          await page.waitForFunction(() => !document.querySelector('.publicComposer textarea').disabled);
        }
        await page.locator('.publicComposer textarea').fill(question);
        const pending = page.waitForResponse(response => response.url().endsWith('/api/public-assistant/ask'));
        await page.locator('.publicComposer textarea').press('Enter');
        const response = await pending;
        assert.equal(response.status(), 200, `${name}/${language}/${question}`);
        const { data: answer } = await response.json();
        await page.waitForFunction(() => !document.querySelector('.publicComposer textarea').disabled);
        const bubbles = page.locator('.publicBubble.assistant');
        const bubble = answer.answerPart2 ? bubbles.nth(await bubbles.count() - 2) : bubbles.last();
        const visible = await bubble.innerText();
        const factualText = answer.sections?.map(section => section.answer).join('\n') || answer.answer;
        // Ordered-list positions become bullets in the UI; they are not facts.
        const content = factualText.replace(/^\s*\d+[.)]\s+/gm, '');
        for (const number of numericTokens(content)) assert.ok(numericTokens(visible).has(number), `${name}/${language}/${question}: missing ${number}`);
        assert.ok(visible.trim(), question);
        assert.equal(await page.locator('.publicEvidence').count(), 0);
        const links = await bubble.locator('a').evaluateAll(elements => elements.map(element => element.getAttribute('href')));
        assert.equal(new Set(links).size, links.length, question);
        for (const url of new Set([answer.sourceUrl, ...answer.officialLinks.map(link => link.url)].filter(Boolean))) assert.ok(links.includes(url), `${question}: missing ${url}`);
        for (const url of links.filter(url => !/^(https?:|tel:|mailto:)/.test(url))) assert.equal((await page.request.get(new URL(url, page.url()).href)).status(), 200, `${question}: missing local notice`);
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, question);
        if (screenshots.has(question)) {
          await page.locator('.publicChatMessages').evaluate(element => { element.scrollTop = element.scrollHeight; });
          await page.locator('.publicAssistantPanel').screenshot({ path: path.join(directory, `${name}-${language}-${index}.png`) });
        }
        results.push({ corpus: name, language, question, links, rows: await bubble.locator('.publicAnswerList li').count() });
      }
    }
    console.log(`PASS: ${name}: ${questions.length * 3} answer journeys`);
  }
  assert.deepEqual(errors, []);
  fs.writeFileSync(path.join(directory, 'browser-results.json'), `${JSON.stringify({ checkedAt: new Date().toISOString(), cases: results, browserErrors: errors }, null, 2)}\n`);
  console.log(`PASS: ${results.length} real API browser journeys; factual numbers, complete source links, local notices, mobile overflow and no evidence panel.`);
} finally {
  await browser?.close();
  await vite?.close();
  await new Promise(resolve => api.close(resolve));
  closeDb();
  cleanupTemporaryDatabase();
}
