import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';
import { createServer as createViteServer } from 'vite';
import { config } from '../../backend/src/config.js';
import { createSeedData } from '../../backend/src/seed.js';
import { resetDbForTests, getDb, closeDb } from '../../backend/src/store.js';
import { createServer, resetRuntimeStateForTests } from '../../backend/src/server.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'mitra-phase-a-browser-'));
config.databaseFile = path.join(temporary, 'test.sqlite'); config.geminiApiKey = ''; config.groqApiKey = '';
resetDbForTests(createSeedData());
const server = createServer(); let browser, vite;
const results = [], errors = [];
try {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  vite = await createViteServer({ root, server: { host: '127.0.0.1', port: 0, proxy: { '/api': `http://127.0.0.1:${server.address().port}` } } });
  await vite.listen(); browser = await chromium.launch({ channel: process.env.MITRA_BROWSER_CHANNEL || 'chrome', headless: true });
  for (const width of [360, 768, 1440]) {
    const context = await browser.newContext({ viewport: { width, height: 900 } }); const page = await context.newPage();
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(`http://127.0.0.1:${vite.httpServer.address().port}`);
    await page.getByRole('button', { name: 'Open MIT Barshi admission assistant' }).click();
    if (width === 360) {
      const campusBytes = await page.evaluate(async () => (await (await fetch('/src/assets/mitcorer-campus.webp')).arrayBuffer()).byteLength);
      assert.ok(campusBytes <= 120000, `optimized campus background is ${campusBytes} bytes`);
      results.push({ width, test: 'optimized campus background transfer size', bytes: campusBytes, passed: true });
    }
    const ask = async question => {
      resetRuntimeStateForTests();
      if (await page.locator('.publicBubble.user').count()) {
        const pending = page.waitForResponse(r => r.request().method() === 'DELETE' && r.url().endsWith('/api/public-assistant/conversation'));
        await page.locator('.publicResetButton').click(); assert.equal((await pending).status(), 200);
        await page.waitForFunction(() => !document.querySelector('.publicComposer textarea').disabled);
      }
      await page.locator('.publicComposer textarea').fill(question);
      const pending = page.waitForResponse(r => r.url().endsWith('/api/public-assistant/ask'));
      await page.locator('.publicComposer textarea').press('Enter');
      const response = await pending; assert.equal(response.status(), 200);
      const data = (await response.json()).data;
      await page.waitForFunction(() => !document.querySelector('.publicComposer textarea').disabled);
      return data;
    };
    if (width === 360) {
      const voiceButton = page.getByRole('button', { name: 'Voice input planned for a future release' });
      assert.equal(await voiceButton.isDisabled(), true);
      assert.equal(await page.locator('.publicVoiceConsent').count(), 0);
      results.push({ width, test: 'planned voice icon remains disabled', passed: true });
    }
    for (const language of ['en', 'mr', 'hi']) {
      await page.getByRole('combobox', { name: 'Response language', exact: true }).selectOption(language);
      for (const question of ['What are first-year engineering fees?', 'What are hostel and mess fees?', 'Explain the admission process.', 'Tell me about the library.', 'What is the weather in Barshi?']) {
        const data = await ask(question); const bubble = page.locator('.publicBubble.assistant').last();
        const visible = await bubble.innerText(); assert.ok(visible.trim());
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
        assert.equal(await bubble.evaluate(element => element.scrollWidth > element.clientWidth), false);
        assert.equal(await page.getByRole('log').count(), 1);
        if (question === 'Explain the admission process.' && language === 'en') assert.ok(await bubble.locator('ol li').count() >= 5);
        if (question === 'What are hostel and mess fees?') for (const amount of ['35,000', '5,000', '40,000', '42,000']) assert.ok(visible.includes(amount));
        if (question === 'What is the weather in Barshi?') {
          const links = await bubble.locator('a').evaluateAll(elements => elements.map(element => element.href));
          assert.equal(new Set(links).size, links.length);
        }
        results.push({ width, language, question, outcome: data.outcomeStatus, orderedItems: await bubble.locator('ol li').count(), passed: true });
      }
    }
    if (width === 360) {
      await page.getByRole('combobox', { name: 'Response language', exact: true }).selectOption('en');
      getDb().knowledge.find(r => r.id === 'KB-20').text = '## Fixture library\n\n**Reviewed fixture**\n\n| Item | Value |\n| --- | --- |\n| Books | 123 |\n\n<img src=x onerror=alert(1)>';
      await ask('Tell me about the library.'); const bubble = page.locator('.publicBubble.assistant').last();
      assert.equal(await bubble.locator('table tbody tr').count(), 1); assert.ok((await bubble.innerText()).includes('123'));
      assert.equal(await bubble.locator('td').last().evaluate(element => element.getBoundingClientRect().right <= element.closest('.publicTableScroll').getBoundingClientRect().right + 1), true);
      assert.equal(await bubble.locator('img:not(.publicBubbleAvatar img)').count(), 0);
      assert.ok(await bubble.locator('strong').filter({ hasText: 'Reviewed fixture' }).count());
      await page.locator('.publicAssistantPanel').screenshot({ path: path.join(temporary, 'mobile-formatting.png') });
      results.push({ width, test: 'structured formatting and escaped HTML', passed: true });
      await page.route('**/api/public-assistant/ask', () => {}); // Deliberately never respond.
      await page.locator('.publicComposer textarea').fill('CSE intake?');
      const started = Date.now(); await page.locator('.publicComposer textarea').press('Enter');
      await page.locator('.publicRetry').last().waitFor({ timeout: 32000 });
      assert.equal(await page.locator('.publicComposer textarea').isDisabled(), false);
      assert.ok(Date.now() - started >= 24000);
      await page.unroute('**/api/public-assistant/ask');
      resetRuntimeStateForTests(); await page.locator('.publicRetry').last().click();
      await page.waitForFunction(() => !document.querySelector('.publicComposer textarea').disabled);
      assert.match(await page.locator('.publicBubble.assistant').last().innerText(), /120/);
      results.push({ width, test: 'hung request deadline and explicit retry', passed: true });
      resetDbForTests(createSeedData());
    }
    await context.close();
  }
  assert.deepEqual(errors, []);
  fs.writeFileSync(path.join(temporary, 'results.json'), JSON.stringify({ results, errors }, null, 2));
  console.log(`PASS: ${results.length} browser checks. Evidence: ${temporary}`);
} finally {
  await browser?.close(); await vite?.close(); await new Promise(resolve => server.close(resolve)); closeDb();
}
