import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { chromium } from 'playwright-core';
import { createServer as createViteServer } from 'vite';
import { config } from '../../backend/src/config.js';
import { createServer, resetRuntimeStateForTests } from '../../backend/src/server.js';
import { resetDbForTests, getDb, closeDb } from '../../backend/src/store.js';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
config.databaseFile = ':memory:';
config.geminiApiKey = '';
resetDbForTests();
const backend = createServer();
let browser, vite;
try {
  await new Promise(resolve => backend.listen(0, '127.0.0.1', resolve));
  vite = await createViteServer({ root, server: { host: '127.0.0.1', port: 0, proxy: { '/api': `http://127.0.0.1:${backend.address().port}` } } });
  await vite.listen();
  const origin = `http://127.0.0.1:${vite.httpServer.address().port}`;
  browser = await chromium.launch({ channel: process.env.MITRA_BROWSER_CHANNEL || 'chrome', headless: true });
  const owner = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const stranger = await browser.newContext();
  const page = await owner.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(origin);
  await page.getByRole('button', { name: 'Open MIT Barshi admission assistant' }).click();
  const sendInChat = async question => {
    await page.locator('.publicComposer textarea').fill(question);
    const response = page.waitForResponse(item => item.url().endsWith('/api/public-assistant/ask') && item.status() === 200);
    await page.locator('.publicComposer textarea').press('Enter');
    const payload = (await (await response).json()).data;
    await page.waitForFunction(() => !document.querySelector('.publicComposer textarea').disabled);
    return payload;
  };
  const documentsClarification = await sendInChat('What documents should an applicant prepare?');
  assert.equal(documentsClarification.clarification, true);
  assert.match(documentsClarification.answer, /Are you applying for First Year B\.Tech, Direct Second Year B\.Tech, or Polytechnic\?/);
  const firstYearDocuments = await sendInChat('for First Year B.Tech');
  assert.match(firstYearDocuments.answer, /For First Year B\.Tech/);
  assert.match(firstYearDocuments.answer, /10th and 12th marksheets/);
  assert.match(firstYearDocuments.answer, /CET or JEE scorecard/);
  assert.ok(firstYearDocuments.officialLinks.some(link => link.url === 'https://mitcorer.edu.in/fy-btech-documents.php'));
  const firstYearAnswer = page.locator('.publicBubble.assistant').last();
  assert.match(await firstYearAnswer.innerText(), /For First Year B\.Tech[\s\S]*10th and 12th marksheets[\s\S]*CET or JEE scorecard/);
  assert.doesNotMatch(await firstYearAnswer.innerText(), /choice code|sanctioned intake/i);
  const documentsLink = firstYearAnswer.locator('a[href="https://mitcorer.edu.in/fy-btech-documents.php"]');
  await documentsLink.waitFor();
  assert.equal(await documentsLink.getAttribute('target'), '_blank');
  await page.getByRole('button', { name: 'New conversation', exact: true }).click();
  const ask = async question => {
    resetRuntimeStateForTests();
    await page.locator('.publicComposer textarea').fill(question);
    const response = page.waitForResponse(response => (response.url().endsWith('/api/public-assistant/ask') || response.url().endsWith('/api/public-assistant/stream')) && response.status() === 200);
    await page.locator('.publicComposer textarea').press('Enter');
    const payload = (await (await response).json()).data;
    await page.waitForFunction(() => !document.querySelector('.publicComposer textarea').disabled);
    return payload;
  };
  const first = await ask('What are DSE fees for OBC girls?');
  assert.match((await ask('what are the fees?')).answer, /18,362/);
  const cookie = (await owner.cookies()).find(cookie => cookie.name === 'mitra_public_session');
  assert.equal(cookie.httpOnly, true);
  const stolen = await stranger.request.post(`${origin}/api/public-assistant/ask`, { data: { question: 'fees?', conversationId: first.conversationId } });
  assert.equal(stolen.status(), 404);
  const removed = page.waitForResponse(response => response.request().method() === 'DELETE' && response.url().endsWith('/api/public-assistant/conversation'));
  await page.getByRole('button', { name: 'New conversation', exact: true }).click();
  assert.equal((await removed).status(), 200);
  assert.equal(getDb().conversations.some(chat => chat.id === first.conversationId), false);
  await page.waitForFunction(() => !document.querySelector('.publicComposer textarea').disabled);
  const current = await ask('What is the CSE intake?');
  getDb().conversations.find(chat => chat.id === current.conversationId).expiresAt = '2000-01-01T00:00:00.000Z';
  const recovered = await ask('What are first year Open fees?');
  assert.notEqual(recovered.conversationId, current.conversationId);
  await page.getByText('The previous chat expired or was reset. This answer starts a new conversation.', { exact: true }).waitFor();

  await page.getByRole('button', { name: 'New conversation', exact: true }).click();
  const quickReplies = page.getByRole('region', { name: 'Quick questions' }).last();
  await quickReplies.getByRole('button', { name: 'CAP admission', exact: true }).waitFor();
  assert.deepEqual(await quickReplies.getByRole('button').allTextContents(), [
    'CAP admission', 'Programmes', 'Fees & Concessions', 'Required Documents', 'Facilities', 'Contact us', 'More topics',
  ]);
  assert.ok(await quickReplies.evaluate(element => element.scrollWidth <= element.clientWidth));
  await quickReplies.getByRole('button', { name: 'More topics', exact: true }).click();
  await quickReplies.getByRole('button', { name: 'Scholarships', exact: true }).click();
  await page.getByText('Which category should I use to narrow the scholarship list?', { exact: true }).waitFor();
  await quickReplies.getByRole('button', { name: 'OBC', exact: true }).click();
  await page.getByText('Would you like to include schemes for girls?', { exact: true }).waitFor();
  const scholarshipReply = page.waitForResponse(response => response.url().endsWith('/api/public-assistant/ask') && response.ok());
  await quickReplies.getByRole('button', { name: 'Include schemes for girls', exact: true }).click();
  const scholarship = (await (await scholarshipReply).json()).data;
  assert.match(scholarship.answer, /Post Matric Scholarship to OBC Students/);
  assert.match(scholarship.answer, /OBC girl student/);
  assert.match(scholarship.answer, /AICTE Pragati/);
  await page.locator('.publicBubble.assistant').last().locator('a[href*="mahadbt"]').waitFor();
  await page.locator('.publicBubble.assistant').last().locator('a[href*="scholarships.gov.in"]').waitFor();
  await page.getByRole('button', { name: 'New conversation', exact: true }).click();
  await quickReplies.getByRole('button', { name: 'CAP admission', exact: true }).click();
  await page.getByText('Where are you in the CAP process?', { exact: true }).waitFor();
  await quickReplies.getByRole('button', { name: 'I have an allotment', exact: true }).click();
  await page.getByText('Which programme route were you allotted through CAP?', { exact: true }).waitFor();
  const allotment = page.waitForResponse(response => response.url().endsWith('/api/public-assistant/ask') && response.ok());
  await quickReplies.getByRole('button', { name: 'Direct Second Year B.Tech', exact: true }).click();
  assert.match((await (await allotment).json()).data.answer, /seat-acceptance/i);
  const answer = page.locator('.publicBubble.assistant').last();
  await answer.locator('a[href*="dse2026.mahacet.org.in"]').waitFor();
  const progress = await ask('I accepted my CAP seat and paid the fee. What is remaining?');
  assert.match(progress.answer, /institute reporting/i);
  assert.equal(Boolean(progress.escalation), false);
  await page.getByRole('button', { name: 'No, not helpful' }).last().click();
  await page.locator('.feedbackThanks').filter({ hasText: 'Thanks for your feedback!' }).waitFor();
  const feedbackId = getDb().feedback.find(item => item.question === 'I accepted my CAP seat and paid the fee. What is remaining?')?.id;
  assert.ok(feedbackId);

  const inquiryQuestion = 'Does MITCORER offer MBBS or BDS medical degrees?';
  assert.ok((await ask(inquiryQuestion)).escalation?.available);
  const inquiry = page.getByRole('region', { name: 'MITCORER staff inquiry' }).last();
  await inquiry.getByRole('button', { name: 'Submit for Staff Review' }).click();
  await inquiry.getByPlaceholder('Phone number or Email*').fill('visitor@example.test');
  const pendingInquiry = page.waitForResponse(response => response.url().endsWith('/api/public/escalate') && response.ok());
  await inquiry.getByRole('button', { name: 'Submit', exact: true }).click();
  const { inquiryId } = (await (await pendingInquiry).json()).data;
  await inquiry.getByText(inquiryId, { exact: false }).waitFor();
  assert.ok(getDb().inquiries.some(item => item.id === inquiryId && item.contact === 'visitor@example.test'));

  const openChecklistFromMainMenu = async () => {
    await quickReplies.getByRole('button', { name: 'More topics', exact: true }).click();
    for (const label of ['Scholarships', 'Placements', 'About MITCORER', 'Why MITCORER?']) {
      assert.equal(await quickReplies.getByRole('button', { name: label, exact: true }).count(), 1);
    }
    await quickReplies.getByRole('button', { name: 'Admission checklist', exact: true }).click();
  };
  await page.getByRole('button', { name: 'New conversation', exact: true }).click();
  await openChecklistFromMainMenu();
  const checklist = page.getByRole('dialog', { name: 'Admission checklist', exact: true });
  await checklist.getByLabel('Programme route').selectOption('btech-fy');
  await checklist.getByLabel('Admission process').selectOption('cap');
  await checklist.getByLabel('Latest step completed').selectOption('Allotment checked');
  await checklist.getByRole('checkbox', { name: '10th marksheet' }).check();
  await checklist.getByRole('button', { name: 'Save my checklist' }).click();
  const signIn = page.getByRole('dialog', { name: 'Sign in to save your checklist' });
  await signIn.getByLabel('Email').fill('applicant@example.com');
  await signIn.getByLabel('Password').fill('mitra');
  await signIn.getByRole('button', { name: 'Sign in', exact: true }).click();
  await checklist.waitFor();
  assert.equal(await checklist.getByRole('checkbox', { name: '10th marksheet' }).isChecked(), true);
  await checklist.getByRole('button', { name: 'Save my checklist' }).click();
  await checklist.getByText('Checklist saved.', { exact: true }).waitFor();
  await page.reload();
  await page.getByRole('button', { name: 'Open MIT Barshi admission assistant' }).click();
  await openChecklistFromMainMenu();
  await checklist.locator('input[type="checkbox"]:checked').waitFor();
  assert.equal(await checklist.getByLabel('Latest step completed').inputValue(), 'Allotment checked');

  const staff = await browser.newContext();
  const staffLogin = await staff.request.post(`${origin}/api/auth/login`, {
    data: { email: 'staff@mitcorer.edu.in', password: 'mitra' },
  });
  assert.equal(staffLogin.status(), 200);
  const staffPage = await staff.newPage();
  staffPage.on('pageerror', error => errors.push(error.message));
  await staffPage.goto(origin);
  const staffNav = staffPage.getByRole('navigation', { name: 'Admin workspace' });
  await staffNav.getByRole('button', { name: 'Review inbox', exact: true }).click();
  await staffPage.locator('.inquiryList').getByRole('button').filter({ hasText: inquiryQuestion }).click();
  await staffPage.locator('.inquiryDetail').getByText(inquiryId, { exact: true }).waitFor();
  await staffPage.getByLabel('Queue status').selectOption('In progress');
  const savedRequest = staffPage.waitForResponse(response => response.request().method() === 'PATCH'
    && response.url().endsWith(`/api/inquiries/${inquiryId}/status`));
  await staffPage.getByRole('button', { name: 'Save request', exact: true }).click();
  assert.equal((await savedRequest).status(), 200);
  assert.equal(getDb().inquiries.find(item => item.id === inquiryId).status, 'In progress');
  await staffNav.getByRole('button', { name: 'Review inbox', exact: true }).click();
  await staffPage.getByRole('button', { name: /Answer feedback/ }).click();
  await staffPage.getByRole('button', { name: 'Refresh' }).click();
  await staffPage.locator('.inquiryList').getByRole('button').filter({ hasText: 'I accepted my CAP seat and paid the fee.' }).click();
  await staffPage.locator('.inquiryDetail').getByText('I accepted my CAP seat and paid the fee. What is remaining?', { exact: true }).waitFor();
  await staffPage.getByLabel('Resolution status').selectOption('Resolved');
  const feedbackSaved = staffPage.waitForResponse(response => response.request().method() === 'PATCH'
    && response.url().endsWith(`/api/feedback/${feedbackId}/status`));
  await staffPage.getByRole('button', { name: 'Save feedback status', exact: true }).click();
  assert.equal((await feedbackSaved).status(), 200);
  assert.equal(getDb().feedback.find(item => item.id === feedbackId).status, 'Resolved');

  await staffNav.getByRole('button', { name: 'Saved admission checklists', exact: true }).click();
  const savedChecklist = staffPage.locator('.applicantAdminCard').filter({ hasText: 'applicant@example.com' });
  await savedChecklist.getByText('Allotment checked', { exact: true }).waitFor();
  await savedChecklist.getByText('10th marksheet', { exact: true }).waitFor();
  assert.equal(await staffNav.getByRole('button', { name: 'Document review', exact: true }).count(), 0);

  assert.deepEqual(errors, []);
  console.log('PASS: browser session isolation and reset, CAP and reporting guidance, checklist save and reload, and staff inbox and checklist workflows.');
} finally {
  await browser?.close();
  await vite?.close();
  if (backend.listening) await new Promise(resolve => backend.close(resolve));
  closeDb();
}
