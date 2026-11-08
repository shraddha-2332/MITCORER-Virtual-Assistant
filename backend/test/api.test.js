import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { beforeEach, test } from 'node:test';
import { semanticResponseCache } from '../src/semantic-cache.js';
import { createServer, resetRuntimeStateForTests } from '../src/server.js';
import { config } from '../src/config.js';
import { resetDbForTests, closeDb, getDb, saveDb } from '../src/store.js';
import { createSeedData } from '../src/seed.js';
import { DatabaseSync } from 'node:sqlite';
import { searchDocumentCorpus } from '../src/document-corpus.js';

async function withServer(fn) {
  const server = createServer();
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();
  try {
    await fn(`http://127.0.0.1:${port}`);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

async function request(base, path, options = {}) {
  const response = await fetch(`${base}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });
  const payload = await response.json();
  return { response, payload };
}

async function login(base, email, password = 'mitra') {
  const { payload } = await request(base, '/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
  return payload.data.token;
}

beforeEach(() => {
  config.databaseFile = path.resolve(process.cwd(), 'data', 'mitra.test.sqlite');
  resetRuntimeStateForTests();
  resetDbForTests(createSeedData());
});

test('assistant rejects invalid questions with structured 400 errors on both endpoints', async () => {
  await withServer(async (base) => {
    const token = await login(base, 'applicant@example.com');
    const invalidBodies = [{}, { question: '' }, { question: ' \n\t ' }, { question: null },
      { question: 123 }, { question: [] }, { question: {} }, { question: 'a'.repeat(1001) }];
    for (const route of ['/api/public-assistant/ask', '/api/assistant/ask']) {
      for (const body of invalidBodies) {
        resetRuntimeStateForTests();
        const { response, payload } = await request(base, route, {
          method: 'POST', headers: route.includes('public-assistant') ? {} : { Authorization: `Bearer ${token}` },
          body: JSON.stringify(body),
        });
        assert.equal(response.status, 400, `${route}: ${JSON.stringify(body).slice(0, 90)}`);
        assert.equal(payload.error.code, 'BAD_REQUEST');
        assert.equal(payload.error.message, 'Enter a question of up to 1000 characters.');
        assert.equal(payload.data, undefined);
      }
    }
    resetRuntimeStateForTests();
    const { response } = await request(base, '/api/public-assistant/ask', {
      method: 'POST', body: JSON.stringify({ question: `  ${'x'.repeat(1000)}  ` }),
    });
    assert.equal(response.status, 200, 'length limit applies after trimming');
  });
});

test('knowledge edits require admin privileges and reject invalid requests without changes', async () => {
  await withServer(async (base) => {
    const admin = await login(base, 'admin@mitcorer.edu.in');
    for (const email of ['applicant@example.com', 'parent@example.com', 'staff@mitcorer.edu.in', null]) {
      const token = email ? await login(base, email) : null;
      const result = await request(base, '/api/knowledge/KB-2', { method: 'PATCH',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: JSON.stringify({ expectedRevision: 0, status: 'Retired' }) });
      assert.equal(result.response.status, token ? 403 : 401);
    }
    const invalid = [{ title: 'Missing revision' }, { expectedRevision: 0, status: 'Invalid' },
      { expectedRevision: 0, id: 'OVERRIDE' }, { expectedRevision: 0, sourceUrl: 'javascript:alert(1)' }];
    for (const body of invalid) {
      assert.equal((await request(base, '/api/knowledge/KB-2', { method: 'PATCH', headers: { Authorization: `Bearer ${admin}` }, body: JSON.stringify(body) })).response.status, 400);
    }
    assert.equal((await request(base, '/api/knowledge/UNKNOWN', { method: 'PATCH', headers: { Authorization: `Bearer ${admin}` }, body: JSON.stringify({ expectedRevision: 0, status: 'Retired' }) })).response.status, 404);
    const result = await request(base, '/api/knowledge', { headers: { Authorization: `Bearer ${admin}` } });
    assert.equal(result.payload.data.items.find((item) => item.id === 'KB-2').status, 'Published');
  });
});

test('admin changes update public factual answers, persist on disk reload and reject stale revisions', async () => {
  await withServer(async (base) => {
    const admin = await login(base, 'admin@mitcorer.edu.in');
    const headers = { Authorization: `Bearer ${admin}` };
    const library = await request(base, '/api/knowledge', { headers });
    const record = library.payload.data.items.find((item) => item.id === 'KB-2');
    const facts = structuredClone(record.facts); facts.firstYear.open = 111111;
    const edit = await request(base, '/api/knowledge/KB-2', { method: 'PATCH', headers,
      body: JSON.stringify({ expectedRevision: 0, facts, source: 'New official circular', sourceUrl: 'https://example.edu/revised-fees' }) });
    assert.equal(edit.response.status, 200);
    assert.equal(edit.payload.data.revision, 1);
    assert.match(edit.payload.data.text, /1,11,111/);
    semanticResponseCache.clear();
    const answer = await request(base, '/api/public-assistant/ask', { method: 'POST', body: JSON.stringify({ question: 'What is the first year Open category fee?' }) });
    assert.match(answer.payload.data.answer, /1,11,111/);
    assert.doesNotMatch(answer.payload.data.answer, /1,05,000/);
    assert.equal(answer.payload.data.source, 'New official circular');
    assert.equal(answer.payload.data.sourceUrl, 'https://example.edu/revised-fees');
    assert.deepEqual(answer.payload.data.evidence.map((item) => item.id), ['KB-2']);
    const stale = await request(base, '/api/knowledge/KB-2', { method: 'PATCH', headers, body: JSON.stringify({ expectedRevision: 0, status: 'Retired' }) });
    assert.equal(stale.response.status, 409);
    assert.equal(stale.payload.error.code, 'REVISION_CONFLICT');
    const logs = await request(base, '/api/audit-logs', { headers });
    assert.ok(logs.payload.data.items.some((item) => item.action === 'knowledge.updated' && item.resourceId === 'KB-2'));
  });
});

test('retirement suppresses managed fees, hostel, intake and historical figures rather than using hardcoded fallbacks', async () => {
  await withServer(async (base) => {
    const admin = await login(base, 'admin@mitcorer.edu.in');
    for (const [id, question] of [['KB-2', 'First year Open fee'], ['KB-3', 'Hostel and mess fees'], ['KB-10', 'Current CSE intake and choice code'], ['KB-6', 'Historical seat matrix']]) {
      const retired = await request(base, `/api/knowledge/${id}`, { method: 'PATCH', headers: { Authorization: `Bearer ${admin}` }, body: JSON.stringify({ expectedRevision: 0, status: 'Retired' }) });
      assert.equal(retired.response.status, 200);
      const answer = await request(base, '/api/public-assistant/ask', { method: 'POST', body: JSON.stringify({ question }) });
      assert.equal(answer.response.status, 200);
      assert.deepEqual(answer.payload.data.evidence, []);
      assert.match(answer.payload.data.answer, /could not find a published official record/);
      assert.doesNotMatch(answer.payload.data.answer, /1,05,000|35,000|120|CAP seats 72/);
    }
  });
});

test('programme intake updates and annual fee year checks use the maintained canonical record', async () => {
  await withServer(async (base) => {
    const admin = await login(base, 'admin@mitcorer.edu.in');
    const headers = { Authorization: `Bearer ${admin}` };
    const list = await request(base, '/api/knowledge', { headers });
    const record = list.payload.data.items.find((item) => item.id === 'KB-10');
    const facts = structuredClone(record.facts);
    facts.programs.find((item) => item.name === 'Computer Science and Engineering').intake = 150;
    const update = await request(base, '/api/knowledge/KB-10', { method: 'PATCH', headers, body: JSON.stringify({ expectedRevision: 0, facts }) });
    assert.equal(update.response.status, 200);
    const answer = await request(base, '/api/public-assistant/ask', { method: 'POST', body: JSON.stringify({ question: 'What is the CSE B.Tech intake for 2026-27?' }) });
    assert.match(answer.payload.data.answer, /sanctioned intake 150/);
    assert.doesNotMatch(answer.payload.data.answer, /intake 120/);
    assert.equal(answer.payload.data.evidence[0].id, 'KB-10');
    const unknownYear = await request(base, '/api/public-assistant/ask', { method: 'POST', body: JSON.stringify({ question: 'What is the first year fee for 2030-31?' }) });
    assert.deepEqual(unknownYear.payload.data.evidence, []);
  });
});

test('knowledge creation defaults to review and supports revisioned plain-text edits', async () => {
  await withServer(async (base) => {
    const admin = await login(base, 'admin@mitcorer.edu.in');
    const headers = { Authorization: `Bearer ${admin}` };
    const created = await request(base, '/api/knowledge', { method: 'POST', headers, body: JSON.stringify({ title: 'New notice', category: 'Admissions', source: 'College circular', text: 'Reviewed notice text' }) });
    assert.equal(created.response.status, 200);
    assert.equal(created.payload.data.status, 'Review');
    const updated = await request(base, `/api/knowledge/${created.payload.data.id}`, { method: 'PATCH', headers,
      body: JSON.stringify({ expectedRevision: 1, text: 'Revised reviewed notice text', status: 'Published', tags: ['notice'] }) });
    assert.equal(updated.response.status, 200);
    assert.equal(updated.payload.data.revision, 2);
    closeDb();
    const list = await request(base, '/api/knowledge', { headers });
    assert.equal(list.payload.data.items.find((item) => item.id === created.payload.data.id).text, 'Revised reviewed notice text');
  });
});

test('knowledge deletion is admin-only, revision-checked, audited, and limited to archived unlinked records', async () => {
  await withServer(async (base) => {
    const admin = await login(base, 'admin@mitcorer.edu.in');
    const staff = await login(base, 'staff@mitcorer.edu.in');
    const headers = { Authorization: `Bearer ${admin}` };
    const created = await request(base, '/api/knowledge', { method: 'POST', headers,
      body: JSON.stringify({ title: 'Temporary notice', category: 'Admissions', source: 'Admin review', text: 'Temporary verified text.' }) });
    const id = created.payload.data.id;

    assert.equal((await request(base, `/api/knowledge/${id}`, { method: 'DELETE', body: JSON.stringify({ expectedRevision: 1 }) })).response.status, 401);
    assert.equal((await request(base, `/api/knowledge/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${staff}` }, body: JSON.stringify({ expectedRevision: 1 }) })).response.status, 403);
    const stale = await request(base, `/api/knowledge/${id}`, { method: 'DELETE', headers, body: JSON.stringify({ expectedRevision: 0 }) });
    assert.equal(stale.response.status, 409);

    getDb().knowledge.find((item) => item.id === id).sourceDocumentId = 'SRC-1';
    saveDb();
    const linked = await request(base, `/api/knowledge/${id}`, { method: 'DELETE', headers, body: JSON.stringify({ expectedRevision: 1 }) });
    assert.equal(linked.response.status, 409);
    assert.equal(linked.payload.error.code, 'KNOWLEDGE_SOURCE_LINKED');
    delete getDb().knowledge.find((item) => item.id === id).sourceDocumentId;

    const published = await request(base, `/api/knowledge/${id}`, { method: 'PATCH', headers,
      body: JSON.stringify({ expectedRevision: 1, status: 'Published' }) });
    assert.equal(published.response.status, 200);
    const publishedDelete = await request(base, `/api/knowledge/${id}`, { method: 'DELETE', headers,
      body: JSON.stringify({ expectedRevision: 2 }) });
    assert.equal(publishedDelete.response.status, 409);
    assert.equal(publishedDelete.payload.error.code, 'KNOWLEDGE_MUST_BE_ARCHIVED');
    const archived = await request(base, `/api/knowledge/${id}`, { method: 'PATCH', headers,
      body: JSON.stringify({ expectedRevision: 2, status: 'Archived' }) });
    assert.equal(archived.response.status, 200);
    const deleted = await request(base, `/api/knowledge/${id}`, { method: 'DELETE', headers,
      body: JSON.stringify({ expectedRevision: 3 }) });
    assert.equal(deleted.response.status, 200);
    assert.equal(deleted.payload.data.deleted, true);
    assert.equal(getDb().knowledge.some((item) => item.id === id), false);
    assert.ok(getDb().auditLogs.some((item) => item.action === 'knowledge.deleted' && item.resourceId === id));
    const missing = await request(base, `/api/knowledge/${id}`, { method: 'DELETE', headers,
      body: JSON.stringify({ expectedRevision: 3 }) });
    assert.equal(missing.response.status, 404);
  });
});

test('existing plain-text fee records can be edited and explicitly converted without restoring seed values', async () => {
  const seed = createSeedData();
  const record = seed.knowledge.find((item) => item.id === 'KB-2');
  delete record.facts;
  resetDbForTests(seed);
  await withServer(async (base) => {
    const admin = await login(base, 'admin@mitcorer.edu.in');
    const headers = { Authorization: `Bearer ${admin}` };
    const plain = await request(base, '/api/knowledge/KB-2', { method: 'PATCH', headers,
      body: JSON.stringify({ expectedRevision: 0, text: 'For AY 2026-27, reviewed first year Open fee is INR 12,345.' }) });
    assert.equal(plain.response.status, 200);
    const first = await request(base, '/api/public-assistant/ask', { method: 'POST', body: JSON.stringify({ question: 'First year Open fee' }) });
    assert.match(first.payload.data.answer, /12,345/);
    assert.doesNotMatch(first.payload.data.answer, /1,05,000/);
    const facts = createSeedData().knowledge.find((item) => item.id === 'KB-2').facts;
    facts.firstYear.open = 23456;
    const converted = await request(base, '/api/knowledge/KB-2', { method: 'PATCH', headers, body: JSON.stringify({ expectedRevision: 1, facts }) });
    assert.equal(converted.response.status, 200);
    closeDb();
    const second = await request(base, '/api/public-assistant/ask', { method: 'POST', body: JSON.stringify({ question: 'First year Open fee' }) });
    assert.match(second.payload.data.answer, /23,456/);
    assert.doesNotMatch(second.payload.data.answer, /12,345|1,05,000/);
  });
});

test('hostel totals and academic years are computed from edited fields', async () => {
  await withServer(async (base) => {
    const admin = await login(base, 'admin@mitcorer.edu.in');
    const edited = await request(base, '/api/knowledge/KB-3', { method: 'PATCH', headers: { Authorization: `Bearer ${admin}` },
      body: JSON.stringify({ expectedRevision: 0, facts: { kind: 'accommodationFees', academicYear: '2027-28', hostel: 21000, refundableDeposit: 1000, messAnnual: 12000 } }) });
    assert.equal(edited.response.status, 200);
    const answer = await request(base, '/api/public-assistant/ask', { method: 'POST', body: JSON.stringify({ question: 'What are hostel and mess fees for 2027-28?' }) });
    assert.match(answer.payload.data.answer, /hostel total of INR 22,000/);
    assert.match(answer.payload.data.answer, /Mess fees are INR 12,000/);
    assert.match(answer.payload.data.answer, /2027-28/);
    assert.doesNotMatch(answer.payload.data.answer, /35,000|42,000/);
  });
});

test('public compound answers cover each supported topic and return usable citation links', async () => {
  await withServer(async (base) => {
    for (const [question, ids] of [
      ['List the first-year B.Tech courses and the Open category academic fee for 2026-27.', ['KB-10', 'KB-2']],
      ['Explain hostel facilities and the college bus facility.', ['KB-23', 'KB-19']],
    ]) {
      const result = await request(base, '/api/public-assistant/ask', { method: 'POST', body: JSON.stringify({ question }) });
      assert.equal(result.response.status, 200);
      assert.deepEqual(result.payload.data.evidence.map((item) => item.id), ids);
      assert.deepEqual(result.payload.data.sections.map((item) => item.status), ['supported', 'supported']);
      assert.match(result.payload.data.answer, /\[1\]/);
      assert.match(result.payload.data.answer, /\[2\]/);
      for (const link of result.payload.data.officialLinks) {
        assert.ok(link.url.startsWith('https://'));
        assert.ok(result.payload.data.evidence.some((item) => item.sourceUrl === link.url));
      }
    }
  });
});

test('compound answers keep unsupported parts explicit and never revive retired records', async () => {
  await withServer(async (base) => {
    const admin = await login(base, 'admin@mitcorer.edu.in');
    await request(base, '/api/knowledge/KB-2', { method: 'PATCH', headers: { Authorization: `Bearer ${admin}` }, body: JSON.stringify({ expectedRevision: 0, status: 'Retired' }) });
    const result = await request(base, '/api/public-assistant/ask', { method: 'POST', body: JSON.stringify({ question: 'List first year B.Tech courses and the academic fee for 2026-27.' }) });
    assert.deepEqual(result.payload.data.sections.map((item) => item.status), ['supported', 'unsupported']);
    assert.deepEqual(result.payload.data.evidence.map((item) => item.id), ['KB-10']);
    assert.match(result.payload.data.sections[1].answer, /could not find/);
    assert.doesNotMatch(result.payload.data.answer, /1,05,000/);
  });
});

test('ambiguous public references ask for clarification even after an earlier explicit question', async () => {
  await withServer(async (base) => {
    await request(base, '/api/public-assistant/ask', { method: 'POST', body: JSON.stringify({ question: 'What is the CSE intake?' }) });
    const result = await request(base, '/api/public-assistant/ask', { method: 'POST', body: JSON.stringify({ question: 'What is its intake?' }) });
    assert.equal(result.response.status, 200);
    assert.equal(result.payload.data.clarification, true);
    assert.match(result.payload.data.answer, /Which course/);
    assert.deepEqual(result.payload.data.evidence, []);
    assert.deepEqual(result.payload.data.officialLinks, []);
    assert.doesNotMatch(result.payload.data.answer, /120|90/);
  });
});

test('account history preserves compound sections and supporting references', async () => {
  await withServer(async (base) => {
    const token = await login(base, 'applicant@example.com');
    const result = await request(base, '/api/conversations/ask', { method: 'POST', headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify({ question: 'Explain hostel facilities and the bus facility.' }) });
    assert.equal(result.response.status, 200);
    const chat = result.payload.data.conversation;
    const reopened = await request(base, `/api/conversations/${chat.id}`, { headers: { Authorization: `Bearer ${token}` } });
    const message = reopened.payload.data.messages[1];
    assert.equal(message.sections.length, 2);
    assert.deepEqual(message.evidence.map((item) => item.id), ['KB-23', 'KB-19']);
    assert.ok(message.officialLinks.every((item) => item.url));
  });
});

test('public language preference produces native factual answers with preserved values and evidence', async () => {
  await withServer(async (base) => {
    for (const language of ['mr', 'hi']) {
      const result = await request(base, '/api/public-assistant/ask', { method: 'POST', body: JSON.stringify({ question: 'What is the first-year Open academic fee for 2026-27?', language }) });
      assert.equal(result.response.status, 200);
      assert.equal(result.payload.data.responseLanguage, language);
      assert.equal(result.payload.data.localizationStatus, 'template');
      assert.match(result.payload.data.answer, /1,05,000/);
      assert.match(result.payload.data.answer, /2026-27/);
      assert.ok((result.payload.data.answer.match(/[\u0900-\u097F]/gu) || []).length > 50);
      assert.deepEqual(result.payload.data.evidence.map((item) => item.id), ['KB-2']);
    }
    const invalid = await request(base, '/api/public-assistant/ask', { method: 'POST', body: JSON.stringify({ question: 'Fees?', language: 'zh' }) });
    assert.equal(invalid.response.status, 400);
  });
});

test('native-script compound questions preserve references and clarify bare pronouns', async () => {
  await withServer(async (base) => {
    const compound = await request(base, '/api/public-assistant/ask', { method: 'POST', body: JSON.stringify({ question: 'मराठीत उत्तर द्या: प्रथम वर्ष B.Tech अभ्यासक्रम आणि Open फी २०२६-२७ मध्ये किती आहे?' }) });
    assert.equal(compound.response.status, 200);
    assert.equal(compound.payload.data.responseLanguage, 'mr');
    assert.deepEqual(compound.payload.data.evidence.map((item) => item.id), ['KB-10', 'KB-2']);
    assert.match(compound.payload.data.answer, /1,05,000/);
    assert.match(compound.payload.data.answer, /\[1\]/);
    assert.match(compound.payload.data.answer, /\[2\]/);
    const ambiguous = await request(base, '/api/public-assistant/ask', { method: 'POST', body: JSON.stringify({ question: 'त्याची प्रवेश क्षमता किती आहे?' }) });
    assert.equal(ambiguous.payload.data.responseLanguage, 'mr');
    assert.equal(ambiguous.payload.data.clarification, true);
    assert.deepEqual(ambiguous.payload.data.evidence, []);
    assert.match(ambiguous.payload.data.answer, /कोणत्या अभ्यासक्रम/);
  });
});

test('admin-reviewed passage translations become unavailable after their English source changes', async () => {
  await withServer(async (base) => {
    const admin = await login(base, 'admin@mitcorer.edu.in');
    const headers = { Authorization: `Bearer ${admin}` };
    const text = 'The library has digital resources. Confirm borrowing rules and timings with the library.';
    const mr = 'ग्रंथालयात डिजिटल साधने उपलब्ध आहेत. पुस्तके घेण्याचे नियम व वेळा ग्रंथालयाकडून निश्चित करा.';
    const edited = await request(base, '/api/knowledge/KB-20', { method: 'PATCH', headers, body: JSON.stringify({ expectedRevision: 0, text, translations: { mr } }) });
    assert.equal(edited.response.status, 200);
    assert.equal(edited.payload.data.translations.mr.reviewedBy, 'admin@mitcorer.edu.in');
    closeDb();
    const translated = await request(base, '/api/public-assistant/ask', { method: 'POST', body: JSON.stringify({ question: 'ग्रंथालयाची माहिती सांगा.', language: 'mr' }) });
    assert.equal(translated.payload.data.answer, mr);
    assert.equal(translated.payload.data.localizationStatus, 'maintainer-reviewed');
    assert.equal(translated.payload.data.evidence[0].id, 'KB-20');
    await request(base, '/api/knowledge/KB-20', { method: 'PATCH', headers, body: JSON.stringify({ expectedRevision: 1, text: 'New library information. Confirm all timings with the library.' }) });
    const stale = await request(base, '/api/public-assistant/ask', { method: 'POST', body: JSON.stringify({ question: 'ग्रंथालयाची माहिती सांगा.', language: 'mr' }) });
    assert.equal(stale.payload.data.localizationStatus, 'fallback');
    assert.match(stale.payload.data.answer, /मूळ इंग्रजी/);
    assert.notEqual(stale.payload.data.answer, mr);
  });
});

test('localized account history retains language metadata and explicit English overrides native input', async () => {
  await withServer(async (base) => {
    const token = await login(base, 'applicant@example.com');
    const history = await request(base, '/api/conversations/ask', { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: JSON.stringify({ question: 'CSE intake for 2026-27', language: 'hi' }) });
    assert.equal(history.response.status, 200);
    assert.equal(history.payload.data.conversation.messages[1].responseLanguage, 'hi');
    const english = await request(base, '/api/public-assistant/ask', { method: 'POST', body: JSON.stringify({ question: 'CSE प्रवेश क्षमता किती आहे?', language: 'en' }) });
    assert.equal(english.payload.data.responseLanguage, 'en');
    assert.match(english.payload.data.answer, /sanctioned intake 120/);
  });
});

test('non-English response requests do not call Gemini for uncontrolled translation', async () => {
  const previousKey = config.geminiApiKey;
  const originalFetch = globalThis.fetch;
  let externalCalls = 0;
  config.geminiApiKey = 'test-unused-key';
  globalThis.fetch = async (url, options) => {
    if (String(url).includes('generativelanguage.googleapis.com')) { externalCalls += 1; throw new Error('External translation disabled in test.'); }
    return originalFetch(url, options);
  };
  try {
    await withServer(async (base) => {
      const result = await request(base, '/api/public-assistant/ask', { method: 'POST', body: JSON.stringify({ question: 'Explain the digital resources and journals available at MITCORER.', language: 'hi' }) });
      assert.equal(result.response.status, 200);
      assert.equal(result.payload.data.requestedLanguage, 'hi');
    });
    assert.equal(externalCalls, 0);
  } finally { config.geminiApiKey = previousKey; globalThis.fetch = originalFetch; }
});

test('health endpoint works without auth', async () => {
  await withServer(async (base) => {
    const { response, payload } = await request(base, '/api/health');
    assert.equal(response.status, 200);
    assert.equal(payload.data.status, 'ok');
    assert.equal(payload.data.service, 'mitra-backend');
  });
});

test('public facts endpoint returns single source of truth for academic fees, accommodation, and programs', async () => {
  await withServer(async (base) => {
    const { response, payload } = await request(base, '/api/public-facts');
    assert.equal(response.status, 200);
    const facts = payload.data;
    assert.equal(facts.academicYear, '2026-27');
    assert.equal(facts.academicFees.fy.open, 105000);
    assert.equal(facts.academicFees.fy.boys, 61109);
    assert.equal(facts.academicFees.fy.girls, 17217);
    assert.equal(facts.academicFees.fy.vjnt, 17217);
    assert.equal(facts.academicFees.fy.scst, 8000);
    assert.equal(facts.academicFees.dse.open, 98000);
    assert.equal(facts.academicFees.dse.boys, 58181);
    assert.equal(facts.accommodationFees.hostel, 35000);
    assert.equal(facts.accommodationFees.refundableDeposit, 5000);
    assert.equal(facts.accommodationFees.hostelTotal, 40000);
    assert.equal(facts.accommodationFees.messAnnual, 42000);
    assert.ok(Array.isArray(facts.programs));
    assert.ok(facts.programs.length >= 6);
    const cse = facts.programs.find((p) => p.name === 'Computer Science and Engineering');
    assert.equal(cse?.intake, 120);
    assert.equal(cse?.choiceCode, '0690124210');
  });
});

test('public assistant answers verified admission questions without an account', async () => {
  await withServer(async (base) => {
    const { response, payload } = await request(base, '/api/public-assistant/ask', {
      method: 'POST',
      body: JSON.stringify({ question: 'Which B.Tech programs are available?' }),
    });
    assert.equal(response.status, 200);
    assert.match(payload.data.answer, /Computer Science and Engineering/);
    assert.equal(payload.data.model, 'deterministic-rag-fallback');
  });
});

test('public assistant formats scholarship, placement, fee, and contact information', async () => {
  await withServer(async (base) => {
    const ask = async (question) => {
      const { response, payload } = await request(base, '/api/public-assistant/ask', {
        method: 'POST', body: JSON.stringify({ question }),
      });
      assert.equal(response.status, 200, question);
      return payload.data;
    };
    const scholarship = await ask('What scholarships are available at MITCORER?');
    assert.match(scholarship.answer, /^- MITCORER lists/m);
    assert.match(scholarship.answer, /^- Open the official scholarship page/m);
    assert.match(scholarship.sourceUrl, /scholarship\.php$/);
    assert.deepEqual(scholarship.officialLinks.map((link) => link.label), ['MITCORER scholarship and financial-aid guidance', 'MahaDBT scholarship portal']);

    const placement = await ask('What placement highlights and companies does MITCORER have?');
    assert.match(placement.answer, /100\+ companies visiting/);
    assert.match(placement.answer, /Training and Placement Cell supports internships/);
    assert.match(placement.answerPart2, /^Published recruiter records include\n\n/);
    assert.match(placement.answerPart2, /- TCS\n- Infosys\n- Cognizant/);
    assert.ok(placement.officialLinks.some((link) => link.url === 'https://mitcorer.edu.in/placement-cell.php'));

    const fees = await ask('What are the first-year B.Tech fees?');
    assert.match(fees.answer, /1,05,000/);
    assert.ok(!fees.officialLinks.some((link) => /2025-26/.test(link.label)));

    const contact = await ask('What are the MITCORER admission contact details?');
    assert.match(contact.answer, /^MITCORER, Industrial Estate/);
    assert.match(contact.answer, /\n\nEmail: info\.mitcorer@mitpune\.edu\.in/);
    assert.match(contact.answer, /\n\nPhone: \+91 84599 67882, \+91 86696 62106/);
    assert.ok(contact.officialLinks.some((link) => link.url.startsWith('https://www.google.com/maps/search/')));
  });
});

test('public assistant serves verified About and Why MITCORER responses', async () => {
  await withServer(async (base) => {
    const fullName = await request(base, '/api/public-assistant/ask', {
      method: 'POST',
      body: JSON.stringify({ question: 'What is the full name of your college?' }),
    });
    assert.equal(fullName.response.status, 200);
    assert.match(fullName.payload.data.answer, /^The full name of MITCORER is MIT College of Railway Engineering and Research\.$/);
    assert.equal(fullName.payload.data.evidence[0]?.id, 'KB-34');
    assert.ok(fullName.payload.data.officialLinks.some((link) => link.url === 'https://www.mitcorer.edu.in/mit-corer.php'));

    const identity = await request(base, '/api/public-assistant/ask', {
      method: 'POST', body: JSON.stringify({ question: 'What is MITCORER?' }),
    });
    assert.equal(identity.payload.data.evidence[0]?.id, 'KB-34');
    assert.match(identity.payload.data.answer, /MITCORER stands for MIT College of Railway Engineering and Research/);

    const about = await request(base, '/api/public-assistant/ask', {
      method: 'POST',
      body: JSON.stringify({ question: 'Tell me about MITCORER.' }),
    });
    assert.equal(about.response.status, 200);
    assert.match(about.payload.data.answer, /MIT College of Railway Engineering and Research/);
    assert.match(about.payload.data.answer, /real railway practices/);
    assert.equal(about.payload.data.source, 'MITCORER About Us page');

    const why = await request(base, '/api/public-assistant/ask', {
      method: 'POST',
      body: JSON.stringify({ question: 'Why should I choose MITCORER?' }),
    });
    assert.equal(why.response.status, 200);
    assert.match(why.payload.data.answer, /What sets MITCORER apart/);
    assert.match(why.payload.data.answer, /60\+ faculty and 900\+ alumni/);
    assert.equal(why.payload.data.source, 'MITCORER Admissions FAQ and official website');
  });
});

test('public assistant routes common admission, eligibility and programme wording to supporting records', async () => {
  await withServer(async (base) => {
    const ask = async (question) => {
      const { response, payload } = await request(base, '/api/public-assistant/ask', {
        method: 'POST', body: JSON.stringify({ question }),
      });
      assert.equal(response.status, 200, question);
      return payload.data;
    };

    const admission = await ask('How can I get admission to your college?');
    assert.equal(admission.evidence[0]?.id, 'KB-29');
    assert.match(admission.answer, /register on the Maharashtra CET Cell portal/);
    assert.match(admission.answer, /Direct Second Year, Polytechnic, and institute-level admission have separate schedules/);

    const onlineAdmission = await ask('Can I apply for admission online?');
    assert.equal(onlineAdmission.evidence[0]?.id, 'KB-29');
    assert.match(onlineAdmission.answer, /register on the Maharashtra CET Cell portal/);
    assert.match(onlineAdmission.answer, /institute reporting steps/);

    const overview = await ask('Tell me about admission.');
    assert.deepEqual(overview.evidence.map((record) => record.id), ['KB-29', 'KB-14', 'KB-5', 'KB-1']);
    assert.match(overview.answer, /separate admission routes for First Year B.Tech CAP, Direct Second Year, Polytechnic, and institute-level\/ACAP/);

    const broadOverview = await ask('Explain everything I should know before taking admission to MITCORER.');
    assert.deepEqual(broadOverview.evidence.map((record) => record.id), ['KB-29', 'KB-14', 'KB-5', 'KB-1']);

    const minimum = await ask('What is the minimum percentage required?');
    assert.equal(minimum.evidence[0]?.id, 'KB-5');
    assert.match(minimum.answer, /45% aggregate marks/);
    assert.match(minimum.answer, /40% for eligible Maharashtra reserved, EWS, and PwD candidates/);

    const capacity = await ask('Can you distinguish approved CSE capacity from the number of seats still available today?');
    assert.equal(capacity.evidence[0]?.id, 'KB-10');
    assert.match(capacity.answer, /sanctioned intake of 120/);
    assert.match(capacity.answer, /does not show how many seats remain available today/);
    assert.match(capacity.answer, /do not contain a live vacancy count/);

    const electrical = await ask('What is the intake capacity of Electrical Engineering?');
    assert.equal(electrical.evidence[0]?.id, 'KB-10');
    assert.match(electrical.answer, /does not list a standalone Electrical Engineering degree/);
    assert.match(electrical.answer, /Electronics and Telecommunication Engineering/);

    const internalExams = await ask('Are internal examinations conducted?');
    assert.equal(internalExams.evidence[0]?.id, 'KB-45');
    assert.match(internalExams.answer, /mid-term evaluations and continuous internal evaluation/);
  });
});

test('hostel facility wording does not turn general availability into live vacancy claims', async () => {
  await withServer(async (base) => {
    const general = await request(base, '/api/public-assistant/ask', {
      method: 'POST', body: JSON.stringify({ question: 'Are hostel rooms available for outstation students?' }),
    });
    assert.equal(general.payload.data.evidence[0]?.id, 'KB-23');
    assert.match(general.payload.data.answer, /separate hostels for boys and girls/);
    assert.match(general.payload.data.answer, /Room availability and student eligibility must be confirmed/);
    assert.doesNotMatch(general.payload.data.answer, /next month|first-come|first come/i);

    const live = await request(base, '/api/public-assistant/ask', {
      method: 'POST', body: JSON.stringify({ question: 'How many hostel rooms are available right now?' }),
    });
    assert.equal(live.payload.data.outcomeStatus, 'INSUFFICIENT_EVIDENCE');
    assert.deepEqual(live.payload.data.evidence, []);
  });
});

test('bus timetable paraphrases use the bus record and do not fabricate route details', async () => {
  await withServer(async (base) => {
    const { response, payload } = await request(base, '/api/public-assistant/ask', {
      method: 'POST',
      body: JSON.stringify({ question: 'Can students commute on an institute-operated vehicle, and where is its timetable?' }),
    });
    assert.equal(response.status, 200);
    assert.ok(payload.data.evidence.some((record) => record.id === 'KB-19'));
    assert.match(payload.data.answer, /MITCORER lists a bus facility/);
    assert.match(payload.data.answer, /does not state a route list, stops, timetable/);
    assert.equal(payload.data.outcomeStatus, 'INSUFFICIENT_EVIDENCE');
  });
});

test('public assistant gives concise sourced facilities without internal branding', async () => {
  await withServer(async (base) => {
    const { response, payload } = await request(base, '/api/public-assistant/ask', {
      method: 'POST',
      body: JSON.stringify({ question: 'What campus facilities are available at MITCORER?' }),
    });
    assert.equal(response.status, 200);
    assert.equal(payload.data.evidence[0].id, 'KB-36');
    assert.match(payload.data.answer, /sports, and gym/);
    assert.match(payload.data.answer, /railway model room/);
    assert.doesNotMatch(payload.data.answer, /campusguard|Relevant verified record/i);
    assert.equal(payload.data.sourceUrl, 'https://www.mitcorer.edu.in/pdf/MITCORER-Brochure.pdf');
  });
});

test('public facility topics link to the matching MITCORER pages', async () => {
  await withServer(async (base) => {
    const cases = [
      ['What hostel and mess facilities does MITCORER provide?', /separate hostels for boys and girls/i, 'https://www.mitcorer.edu.in/hostel-amenities.php'],
      ['What MITCORER bus facility information is published?', /bus facility/i, 'https://mitcorer.edu.in/bus-facility.php'],
      ['Tell me about the MITCORER library and digital resources.', /library/i, 'https://mitcorer.edu.in/about-lib-details.php'],
      ['What laboratories and workshops does MITCORER have?', /laboratories.*workshops/i, 'https://mitcorer.edu.in/workshops.php'],
      ['Tell me about the MITCORER railway model room.', /railway model room/i, 'https://www.mitcorer.edu.in/railway-model-room.php'],
      ['What campus facilities are available at MITCORER?', /campus facilities/i, 'https://www.mitcorer.edu.in/pdf/MITCORER-Brochure.pdf'],
    ];
    for (const [question, answerPattern, sourceUrl] of cases) {
      const { response, payload } = await request(base, '/api/public-assistant/ask', { method: 'POST', body: JSON.stringify({ question }) });
      assert.equal(response.status, 200, question);
      assert.match(payload.data.answer, answerPattern, question);
      assert.equal(payload.data.sourceUrl, sourceUrl, question);
    }
  });
});

test('chat history persists exchanges, preserves sources, and supports reopening and continuing', async () => {
  await withServer(async (base) => {
    const token = await login(base, 'applicant@example.com');
    const headers = { Authorization: `Bearer ${token}` };
    const first = await request(base, '/api/conversations/ask', { method: 'POST', headers, body: JSON.stringify({ question: 'bus facility?' }) });
    assert.equal(first.response.status, 200);
    const chat = first.payload.data.conversation;
    assert.equal(chat.messages.length, 2);
    assert.ok(chat.messages[1].source);
    const continued = await request(base, '/api/conversations/ask', { method: 'POST', headers, body: JSON.stringify({ question: 'hostel fees?', conversationId: chat.id }) });
    assert.equal(continued.payload.data.conversation.messages.length, 4);
    const reopened = await request(base, `/api/conversations/${chat.id}`, { headers });
    assert.deepEqual(reopened.payload.data.messages, continued.payload.data.conversation.messages);
    const list = await request(base, '/api/conversations', { headers });
    assert.equal(list.payload.data.items.length, 1);
    assert.equal(list.payload.data.items[0].id, chat.id);
    assert.equal(list.payload.data.items[0].messages, undefined);
    const disk = new DatabaseSync(config.databaseFile);
    try {
      const saved = JSON.parse(disk.prepare("SELECT data FROM collections WHERE name = 'app'").get().data);
      assert.equal(saved.conversations.find((item) => item.id === chat.id).messages.length, 4);
    } finally { disk.close(); }
    const invalid = await request(base, '/api/conversations/ask', { method: 'POST', headers, body: JSON.stringify({ question: ' ' }) });
    assert.equal(invalid.response.status, 400);
  });
});

test('assistant returns route-specific official admission links and saves them in history', async () => {
  await withServer(async (base) => {
    const token = await login(base, 'applicant@example.com');
    const headers = { Authorization: `Bearer ${token}` };
    const cases = [
      ['What is the B.Tech CAP deadline?', 'https://fe2026.mahacet.org/StaticPages/HomePage'],
      ['What is the DSE admission schedule?', 'https://dse2026.mahacet.org.in/'],
      ['What is the Polytechnic admission deadline?', 'https://poly26.dtemaharashtra.gov.in/poly_26/home'],
      ['Show the ACAP vacancy notice.', 'https://mitcorer.edu.in/acap-institute-level-admission.php'],
    ];
    for (const [question, expectedUrl] of cases) {
      const result = await request(base, '/api/conversations/ask', { method: 'POST', headers, body: JSON.stringify({ question }) });
      assert.equal(result.response.status, 200);
      const assistant = result.payload.data.conversation.messages.at(-1);
      assert.ok(assistant.officialLinks.some((link) => link.url === expectedUrl));
    }
    const unrelated = await request(base, '/api/assistant/ask', { method: 'POST', headers, body: JSON.stringify({ question: 'What is the hostel fee?' }) });
    assert.deepEqual(unrelated.payload.data.officialLinks, []);
  });
});

test('assistant answers engineering attendance from verified university rules', async () => {
  await withServer(async (base) => {
    const token = await login(base, 'applicant@example.com');
    const headers = { Authorization: `Bearer ${token}` };
    const result = await request(base, '/api/conversations/ask', {
      method: 'POST',
      headers,
      body: JSON.stringify({ question: 'What is the minimum attendance requirement?' }),
    });
    assert.equal(result.response.status, 200);
    const assistant = result.payload.data.conversation.messages.at(-1);
    assert.match(assistant.text, /75%/);
    assert.match(assistant.text, /XX grade \(Detained\)/);
    assert.match(assistant.text, /biometric attendance/i);
    assert.ok(assistant.officialLinks.some((link) => link.url.includes('CBCS%20UG%20Rules.pdf')));
    assert.ok(assistant.officialLinks.some((link) => link.url.includes('LMS%20Circular')));
  });
});

test('history is private to each account, including staff and admin, and requires authentication', async () => {
  await withServer(async (base) => {
    const signup = await request(base, '/api/auth/signup', { method: 'POST', body: JSON.stringify({ name: 'Second applicant', email: 'second-applicant@example.com', password: 'isolated-test-passphrase', role: 'applicant' }) });
    assert.equal(signup.response.status, 200);
    const accounts = ['applicant@example.com', 'second-applicant@example.com', 'parent@example.com', 'staff@mitcorer.edu.in', 'admin@mitcorer.edu.in'];
    const tokens = [];
    const ids = [];
    for (const email of accounts) {
      const token = await login(base, email, email === 'second-applicant@example.com' ? 'isolated-test-passphrase' : 'mitra');
      tokens.push(token);
      const created = await request(base, '/api/conversations/ask', { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: JSON.stringify({ question: 'bus facility?', ownerId: 'USR-ADM' }) });
      assert.equal(created.response.status, 200);
      ids.push(created.payload.data.conversation.id);
    }
    for (let index = 0; index < tokens.length; index++) {
      const headers = { Authorization: `Bearer ${tokens[index]}` };
      const list = await request(base, '/api/conversations', { headers });
      assert.deepEqual(list.payload.data.items.map((item) => item.id), [ids[index]]);
      for (const id of ids.filter((item) => item !== ids[index])) {
        assert.equal((await request(base, `/api/conversations/${id}`, { headers })).response.status, 404);
        assert.equal((await request(base, '/api/conversations/ask', { method: 'POST', headers, body: JSON.stringify({ question: 'fees?', conversationId: id }) })).response.status, 404);
      }
    }
    assert.equal((await request(base, '/api/conversations')).response.status, 401);
    assert.equal((await request(base, `/api/conversations/${ids[0]}`)).response.status, 401);
  });
});

test('malformed access tokens receive an authentication error instead of a server error', async () => {
  await withServer(async (base) => {
    const { response, payload } = await request(base, '/api/me', {
      headers: { Authorization: 'Bearer not-a-valid-token' },
    });
    assert.equal(response.status, 401);
    assert.equal(payload.error.code, 'UNAUTHORIZED');
  });
});

test('inquiry lifecycle returns assigned staff replies only to the owning applicant', async () => {
  await withServer(async (base) => {
    const applicantToken = await login(base, 'applicant@example.com');
    const staffToken = await login(base, 'staff@mitcorer.edu.in');
    const parentToken = await login(base, 'parent@example.com');
    const created = await request(base, '/api/inquiries', {
      method: 'POST',
      headers: { Authorization: `Bearer ${applicantToken}` },
      body: JSON.stringify({ topic: 'Documents', question: 'Is allotment letter enough?', contact: 'applicant@example.com', role: 'staff' }),
    });
    assert.equal(created.response.status, 200);
    assert.equal(created.payload.data.status, 'Unassigned');
    assert.equal(created.payload.data.role, 'applicant');
    const updated = await request(base, `/api/inquiries/${created.payload.data.id}/status`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${staffToken}` },
      body: JSON.stringify({ status: 'Resolved', assignedTo: 'Admission Staff', reply: 'Bring the allotment letter with the full reporting checklist.' }),
    });
    assert.equal(updated.response.status, 200);
    assert.equal(updated.payload.data.status, 'Resolved');
    assert.equal(updated.payload.data.assignedTo, 'Admission Staff');
    assert.equal(updated.payload.data.messages.length, 1);
    const applicantList = await request(base, '/api/inquiries', { headers: { Authorization: `Bearer ${applicantToken}` } });
    const owned = applicantList.payload.data.items.find((item) => item.id === created.payload.data.id);
    assert.equal(owned.messages[0].text, 'Bring the allotment letter with the full reporting checklist.');
    const parentList = await request(base, '/api/inquiries', { headers: { Authorization: `Bearer ${parentToken}` } });
    assert.equal(parentList.payload.data.items.some((item) => item.id === created.payload.data.id), false);
  });
});

test('applicant cannot access staff reports', async () => {
  await withServer(async (base) => {
    const token = await login(base, 'applicant@example.com');
    const { response, payload } = await request(base, '/api/reports', {
      headers: { Authorization: `Bearer ${token}` },
    });
    assert.equal(response.status, 403);
    assert.equal(payload.error.code, 'FORBIDDEN');
  });
});

test('admission workspace persists per user and is unavailable to staff', async () => {
  await withServer(async (base) => {
    const applicantToken = await login(base, 'applicant@example.com');
    const parentToken = await login(base, 'parent@example.com');
    const staffToken = await login(base, 'staff@mitcorer.edu.in');
    const saved = await request(base, '/api/admission-workspace', {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${applicantToken}` },
      body: JSON.stringify({ section: 'programs', value: { preferences: [{ choiceCode: '0690124210', name: 'Computer Science and Engineering' }] } }),
    });
    assert.equal(saved.response.status, 200);
    const applicantWorkspace = await request(base, '/api/admission-workspace', { headers: { Authorization: `Bearer ${applicantToken}` } });
    assert.equal(applicantWorkspace.payload.data.programs.preferences[0].choiceCode, '0690124210');
    const parentWorkspace = await request(base, '/api/admission-workspace', { headers: { Authorization: `Bearer ${parentToken}` } });
    assert.deepEqual(parentWorkspace.payload.data.programs.preferences, []);
    assert.equal((await request(base, '/api/admission-workspace', { headers: { Authorization: `Bearer ${staffToken}` } })).response.status, 403);
  });
});

test('content records require an authenticated user', async () => {
  await withServer(async (base) => {
    const { response, payload } = await request(base, '/api/content');
    assert.equal(response.status, 401);
    assert.equal(payload.error.code, 'UNAUTHORIZED');
  });
});

test('staff can read audit logs after workflow actions', async () => {
  await withServer(async (base) => {
    const applicantToken = await login(base, 'applicant@example.com');
    const staffToken = await login(base, 'staff@mitcorer.edu.in');
    await request(base, '/api/inquiries', {
      method: 'POST',
      headers: { Authorization: `Bearer ${applicantToken}` },
      body: JSON.stringify({ topic: 'Fees', question: 'What amount should I keep ready?', contact: 'applicant@example.com' }),
    });
    const { response, payload } = await request(base, '/api/audit-logs', {
      headers: { Authorization: `Bearer ${staffToken}` },
    });
    assert.equal(response.status, 200);
    assert.ok(payload.data.items.some((item) => item.action === 'inquiry.created'));
  });
});

test('assistant returns routed guidance', async () => {
  await withServer(async (base) => {
    const token = await login(base, 'applicant@example.com');
    const { response, payload } = await request(base, '/api/assistant/ask', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify({ question: 'What fees should I pay for hostel and mess?' }),
    });
    assert.equal(response.status, 200);
    assert.equal(payload.data.actionView, 'visit');
    assert.ok(payload.data.evidence.length > 0);
  });
});

test('assistant answers percentile and CSE questions without default staff escalation', async () => {
  await withServer(async (base) => {
    const token = await login(base, 'applicant@example.com');
    const { response, payload } = await request(base, '/api/assistant/ask', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify({ question: 'If I got 20 percentile then am I eligible for CSE department admission?' }),
    });
    assert.equal(response.status, 200);
    assert.equal(payload.data.actionView, 'programs');
    assert.equal(payload.data.actionLabel, 'Check programs');
    assert.match(payload.data.answer, /percentile alone/i);
    assert.doesNotMatch(payload.data.next, /staff request/i);
    assert.equal(payload.data.evidence[0].category, 'Eligibility');
  });
});

test('assistant routes Marathi eligibility questions to verified eligibility evidence', async () => {
  await withServer(async (base) => {
    const token = await login(base, 'applicant@example.com');
    const { response, payload } = await request(base, '/api/assistant/ask', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify({ question: 'मला 20 टक्केवारी मिळाली तर मी CSE प्रवेशासाठी पात्र आहे का?' }),
    });
    assert.equal(response.status, 200);
    assert.equal(payload.data.actionView, 'programs');
    assert.equal(payload.data.evidence[0].category, 'Eligibility');
  });
});

test('assistant answers SC category fee questions without inventing a semester split', async () => {
  await withServer(async (base) => {
    const token = await login(base, 'applicant@example.com');
    const { response, payload } = await request(base, '/api/assistant/ask', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify({ question: 'I am from SC category, I am a boy and want CSE admission. How much fee will I pay per semester?' }),
    });
    assert.equal(response.status, 200);
    assert.equal(payload.data.actionView, 'fees');
    assert.match(payload.data.answer, /INR 8,000 for First Year Engineering/i);
    assert.match(payload.data.answer, /INR 10,000 for Direct Second Year Engineering/i);
    assert.match(payload.data.answer, /not semester-wise/i);
    assert.equal(payload.data.evidence[0].category, 'Fees');
  });
});

test('assistant uses the approved fee matrix for common category and route combinations', async () => {
  await withServer(async (base) => {
    const token = await login(base, 'applicant@example.com');
    const cases = [
      ['I am OBC and a boy. What is my first year engineering fee?', /INR 61,109/i],
      ['I am EWS girl. What is the FY BTech fee?', /INR 17,217/i],
      ['What is the Direct Second Year TFWS fee?', /INR 18,362/i],
      ['What is the open category DSE engineering fee?', /INR 98,000/i],
    ];
    for (const [question, expectedAmount] of cases) {
      const { response, payload } = await request(base, '/api/assistant/ask', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: JSON.stringify({ question }),
      });
      assert.equal(response.status, 200, question);
      assert.match(payload.data.answer, expectedAmount, question);
      assert.match(payload.data.answer, /not a semester-wise schedule/i, question);
      assert.equal(payload.data.evidence[0].category, 'Fees', question);
    }
  });
});

test('assistant keeps hostel and mess costs separate from academic-fee questions', async () => {
  await withServer(async (base) => {
    const token = await login(base, 'applicant@example.com');
    const { response, payload } = await request(base, '/api/assistant/ask', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify({ question: 'What are the hostel and mess fees?' }),
    });
    assert.equal(response.status, 200);
    assert.equal(payload.data.evidence[0].id, 'KB-3');
    assert.match(payload.data.answer, /hostel total of INR 40,000/i);
    assert.match(payload.data.answer, /mess fees are INR 42,000 per year/i);
    assert.doesNotMatch(payload.data.answer, /Open or OMS total/i);
  });
});

test('assistant returns the complete historical seat matrix instead of one CSE intake record', async () => {
  await withServer(async (base) => {
    const token = await login(base, 'applicant@example.com');
    const { response, payload } = await request(base, '/api/assistant/ask', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify({ question: 'Show the MITCORER seat matrix.' }),
    });
    assert.equal(response.status, 200);
    assert.equal(payload.data.evidence[0].id, 'KB-6');
    assert.match(payload.data.answer, /Civil Engineering[^;]*sanctioned intake 30/i);
    assert.match(payload.data.answer, /Electronics and Telecommunication Engineering[^;]*intake 60/i);
    assert.match(payload.data.answer, /historical (?:AY )?2024-25/i);
    assert.doesNotMatch(payload.data.answer, /^The MITCORER FY B\.Tech admissions page/i);
  });
});

test('assistant retrieves current official program and contact records', async () => {
  await withServer(async (base) => {
    const token = await login(base, 'applicant@example.com');
    const programs = await request(base, '/api/assistant/ask', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify({ question: 'What is the current intake and choice code for CSE B.Tech?' }),
    });
    assert.equal(programs.response.status, 200);
    assert.equal(programs.payload.data.evidence[0].category, 'Programs');
    assert.equal(programs.payload.data.sourceUrl, 'https://mitcorer.edu.in/fy-btech.php');
    assert.match(programs.payload.data.answer, /sanctioned intake 120/i);

    const contact = await request(base, '/api/assistant/ask', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify({ question: 'What is the official MITCORER admission contact address and email?' }),
    });
    assert.equal(contact.response.status, 200);
    assert.equal(contact.payload.data.evidence[0].category, 'Contact');
    assert.match(contact.payload.data.answer, /Industrial Estate No\. 03/i);
    assert.match(contact.payload.data.answer, /info\.mitcorer@mitpune\.edu\.in/i);
    assert.match(contact.payload.data.answer, /Phone: \+91 84599 67882, \+91 86696 62106/);
  });
});

test('assistant answers bus questions without mixing in hostel details', async () => {
  await withServer(async (base) => {
    const token = await login(base, 'applicant@example.com');
    const { response, payload } = await request(base, '/api/assistant/ask', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify({ question: 'Does MITCORER have a bus facility and what are the routes?' }),
    });
    assert.equal(response.status, 200);
    assert.equal(payload.data.actionLabel, 'Request bus details');
    assert.match(payload.data.answer, /(?:provides|lists) a bus facility/i);
    assert.match(payload.data.answer, /does not state a route list, stops, timetable/i);
    assert.doesNotMatch(payload.data.answer, /hostel/i);
    assert.equal(payload.data.evidence[0].title, 'MITCORER bus facility');
  });
});

test('assistant answers Pragati questions from the dedicated verified record', async () => {
  await withServer(async (base) => {
    const token = await login(base, 'applicant@example.com');
    const { response, payload } = await request(base, '/api/assistant/ask', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify({ question: 'Can a girl admitted through non-CAP apply for Pragati scholarship?' }),
    });
    assert.equal(response.status, 200);
    assert.equal(payload.data.evidence[0]?.id, 'KB-33');
    assert.match(payload.data.answer, /girl students/i);
    assert.match(payload.data.answer, /do not assume eligibility/i);
    assert.ok(payload.data.officialLinks.some((item) => item.url === 'https://scholarships.gov.in/All-Scholarships'));
  });
});

test('assistant explains the non-CAP workflow and keeps scholarship eligibility separate', async () => {
  await withServer(async (base) => {
    const token = await login(base, 'applicant@example.com');
    const { response, payload } = await request(base, '/api/assistant/ask', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify({ question: 'How does non-CAP admission work and what happens to scholarship?' }),
    });
    assert.equal(response.status, 200);
    assert.equal(payload.data.evidence[0]?.id, 'KB-14');
    assert.match(payload.data.answer, /institute-level/i);
    assert.match(payload.data.answer, /does not automatically qualify|admission alone does not establish scheme eligibility/i);
    assert.ok(payload.data.officialLinks.some((item) => item.url.includes('acap-institute-level-admission')));
  });
});

test('official-fact routing keeps distinct website questions distinct', async () => {
  await withServer(async (base) => {
    const token = await login(base, 'applicant@example.com');
    const cases = [
      ['Does the campus provide Wi-Fi?', 'MITCORER campus internet and Wi-Fi', /internet facilities are available/i, /hostel/i],
      ['What does the MITCORER library provide?', 'MITCORER library and digital resources', /digital resources and journals/i, /bus facility/i],
      ['What documents are needed for SC category admission?', 'MITCORER SC and ST admission documents', /caste certificate and caste validity/i, /non-creamy/i],
      ['Does the college provide placement assistance and internships?', 'MITCORER placement assistance and internships', /Training and Placement Cell/i, /hostel/i],
      ['Which exams are accepted for engineering admission?', 'MITCORER admission entrance examinations', /MHT-CET or JEE Main/i, /bus route/i],
    ];
    for (const [question, expectedTitle, expectedText, forbiddenText] of cases) {
      const { response, payload } = await request(base, '/api/assistant/ask', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: JSON.stringify({ question }),
      });
      assert.equal(response.status, 200, question);
      assert.equal(payload.data.evidence[0].title, expectedTitle, question);
      assert.match(payload.data.answer, expectedText, question);
      assert.doesNotMatch(payload.data.answer, forbiddenText, question);
    }
  });
});

test('assistant category regression suite routes core admission questions to the intended verified record', async () => {
  await withServer(async (base) => {
    const token = await login(base, 'applicant@example.com');
    const cases = [
      ['What is the CAP round process?', 'KB-29'],
      ['What is ACAP and institute-level admission?', 'KB-14'],
      ['What are the required admission documents?', 'KB-1'],
      ['What scholarship support is available?', 'KB-18'],
      ['What facilities are available in the hostel?', 'KB-23'],
      ['Show all B.Tech programs and choice codes.', 'KB-10'],
      ['Which Polytechnic courses are available?', 'KB-12'],
      ['What is the DSE CSE choice code?', 'KB-11'],
      ['Which companies visit for placement and what is the package?', 'KB-16'],
      ['Does MITCORER provide a bus facility?', 'KB-19'],
      ['Does the campus provide Wi-Fi?', 'KB-21'],
      ['Are laboratories and workshops available?', 'KB-22'],
      ['What is the official admission phone number?', 'KB-17'],
      ['What is the current admission deadline?', 'KB-30'],
    ];
    for (const [question, expectedId] of cases) {
      const { response, payload } = await request(base, '/api/assistant/ask', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: JSON.stringify({ question }),
      });
      assert.equal(response.status, 200, question);
      assert.equal(payload.data.evidence[0]?.id, expectedId, question);
    }
  });
});

test('assistant does not attach unrelated evidence to an unsupported question', async () => {
  await withServer(async (base) => {
    const token = await login(base, 'applicant@example.com');
    const { response, payload } = await request(base, '/api/assistant/ask', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify({ question: 'What will the weather be in Barshi on my joining day?' }),
    });
    assert.equal(response.status, 200);
    assert.equal(payload.data.source, 'No verified record');
    assert.equal(payload.data.evidence.length, 0);
    assert.match(payload.data.answer, /could not find an official answer/i);
  });
});

test('assistant answers final admission-step questions with a reporting checklist', async () => {
  await withServer(async (base) => {
    const token = await login(base, 'applicant@example.com');
    const { response, payload } = await request(base, '/api/assistant/ask', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify({ question: "My category is Open. I am at the last step of admission; what else is remaining?" }),
    });
    assert.equal(response.status, 200);
    assert.equal(payload.data.evidence[0]?.id, 'KB-1');
    assert.equal(payload.data.actionView, 'documents');
    assert.match(payload.data.answer, /allotment or institute-level merit\/vacancy confirmation/i);
    assert.match(payload.data.answer, /10th marksheet/i);
    assert.match(payload.data.answer, /approved fee payment/i);
    assert.doesNotMatch(payload.data.answer, /do not have a verified official record/i);
  });
});

test('assistant identifies only the remaining admission workflow stages stated by the applicant', async () => {
  await withServer(async (base) => {
    const token = await login(base, 'applicant@example.com');
    const cases = [
      ['I received my CAP allotment. What should I do next for admission?', /seat acceptance or freeze\/betterment/i],
      ['I received allotment, accepted the seat, uploaded documents, paid the fee, and completed reporting. I need the final admission checklist.', /all main workflow stages appear complete/i],
    ];
    for (const [question, expectedText] of cases) {
      const { response, payload } = await request(base, '/api/assistant/ask', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: JSON.stringify({ question }),
      });
      assert.equal(response.status, 200, question);
      assert.equal(payload.data.evidence[0]?.id, 'KB-1', question);
      assert.equal(payload.data.actionView, 'documents', question);
      assert.match(payload.data.answer, expectedText, question);
    }
  });
});

test('assistant routes real Marathi and Hindi seat-matrix and deadline questions', async () => {
  await withServer(async (base) => {
    const token = await login(base, 'applicant@example.com');
    const cases = [
      ['CSE \u091c\u093e\u0917\u093e \u0906\u0923\u093f \u092a\u094d\u0930\u0935\u0947\u0936 \u0915\u094d\u0937\u092e\u0924\u093e \u0915\u093e\u092f \u0906\u0939\u0947?', 'KB-6'],
      ['CSE \u0938\u0940\u091f \u092e\u0948\u091f\u094d\u0930\u093f\u0915\u094d\u0938 \u0914\u0930 \u0907\u0902\u091f\u0947\u0915 \u0915\u094d\u092f\u093e \u0939\u0948?', 'KB-6'],
      ['\u092a\u094d\u0930\u0935\u0947\u0936 \u0924\u093e\u0930\u0916\u093e \u0914\u0930 \u0905\u0902\u0924\u093f\u092e \u092e\u0941\u0926\u0924 \u0915\u093e\u092f \u0906\u0939\u0947?', 'KB-30'],
    ];
    for (const [question, expectedId] of cases) {
      const { payload } = await request(base, '/api/assistant/ask', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: JSON.stringify({ question }),
      });
      assert.equal(payload.data.evidence[0]?.id, expectedId, question);
    }
  });
});

test('college admin can upload and list an official knowledge source', async () => {
  await withServer(async (base) => {
    const token = await login(base, 'admin@mitcorer.edu.in');
    const formData = new FormData();
    formData.append('title', 'CAP Round I cutoff sample');
    formData.append('documentType', 'Cutoff');
    formData.append('academicYear', '2025-26');
    formData.append('sourceAuthority', 'Maharashtra CET Cell');
    formData.append('verifiedText', 'Historical sample cutoff record for retrieval testing.');
    formData.append('file', new Blob(['%PDF-1.4\nsource sample'], { type: 'application/pdf' }), 'cutoff.pdf');
    const uploadResponse = await fetch(`${base}/api/official-sources/upload`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: formData,
    });
    const uploaded = await uploadResponse.json();
    assert.equal(uploadResponse.status, 200);
    assert.equal(uploaded.data.documentType, 'Cutoff');
    assert.equal(uploaded.data.linkedKnowledgeCount, 1);

    const listed = await request(base, '/api/official-sources', {
      headers: { Authorization: `Bearer ${token}` },
    });
    assert.ok(listed.payload.data.items.some((item) => item.id === uploaded.data.id));
  });
});

test('admin-reviewed extracted source text becomes published retrieval knowledge', async () => {
  await withServer(async (base) => {
    const adminToken = await login(base, 'admin@mitcorer.edu.in');
    const formData = new FormData();
    formData.append('title', 'MITRA source ingestion test notice');
    formData.append('documentType', 'Admissions');
    formData.append('academicYear', '2026-27');
    formData.append('sourceAuthority', 'MITCORER');
    formData.append('file', new Blob(['MITRA source ingestion verification notice: reporting token ALPHA-2026 must be checked.'], { type: 'text/plain' }), 'ingestion-notice.txt');
    const uploadResponse = await fetch(`${base}/api/official-sources/upload`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: formData,
    });
    const uploaded = (await uploadResponse.json()).data;
    assert.equal(uploaded.status, 'Review');
    assert.match(uploaded.extractionStatus, /Text extracted/i);

    const extracted = await request(base, `/api/official-sources/${uploaded.id}/extracted-text`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert.match(extracted.payload.data.extractedText, /ALPHA-2026/);

    const structured = await request(base, `/api/official-sources/${uploaded.id}/extract-structured`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({}),
    });
    assert.equal(structured.response.status, 200);
    assert.equal(structured.payload.data.id, uploaded.id);
    assert.ok(Array.isArray(structured.payload.data.keyFacts));
    assert.ok(structured.payload.data.keyFacts.length > 0);

        // Seed a verified cached response before publishing revised knowledge.
    semanticResponseCache.set(
      'cache-invalidation-regression-probe',
      { answer: 'Stale cached response', outcomeStatus: 'ANSWERED' },
      'en',
    );

    assert.equal(semanticResponseCache.size(), 1);
    const published = await request(base, `/api/official-sources/${uploaded.id}/publish`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ verifiedText: extracted.payload.data.extractedText }),
    });
    assert.equal(published.response.status, 200);
    assert.equal(published.payload.data.status, 'Published');
    assert.equal(published.payload.data.linkedKnowledgeCount, 1);
    // Publishing revised knowledge must invalidate previously cached responses.
    assert.equal(semanticResponseCache.size(), 0);
    
    const applicantToken = await login(base, 'applicant@example.com');
    const answer = await request(base, '/api/assistant/ask', {
      method: 'POST',
      headers: { Authorization: `Bearer ${applicantToken}` },
      body: JSON.stringify({ question: 'What does the ALPHA-2026 reporting token notice say?' }),
    });
    assert.equal(answer.response.status, 200);
    assert.equal(answer.payload.data.evidence[0]?.title, 'MITRA source ingestion test notice');
  });
});

test('multilingual assistant benchmark contains 360 cases', () => {
  const benchmarkPath = [path.resolve(process.cwd(), 'evaluation', 'mitra-qa-360.json'), path.resolve(process.cwd(), 'evaluation', 'campusguard-qa-360.json')].find(fs.existsSync);
  const benchmark = JSON.parse(fs.readFileSync(benchmarkPath, 'utf8'));
  assert.equal(benchmark.count, 360);
  assert.deepEqual(new Set(benchmark.records.map((item) => item.language)), new Set(['en', 'mr', 'hi', 'hinglish']));
});

test('refresh token rotates session and logout revokes it', async () => {
  await withServer(async (base) => {
    const loginResponse = await request(base, '/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: 'applicant@example.com', password: 'mitra' }),
    });
    assert.equal(loginResponse.payload.data.refreshToken, undefined);
    const refreshCookie = loginResponse.response.headers.get('set-cookie');
    assert.match(refreshCookie, /HttpOnly/);
    assert.match(refreshCookie, /SameSite=Strict/);
    const refreshed = await request(base, '/api/auth/refresh', {
      method: 'POST',
      headers: { Cookie: refreshCookie },
    });
    assert.equal(refreshed.response.status, 200);
    assert.ok(refreshed.payload.data.token);
    const rotatedCookie = refreshed.response.headers.get('set-cookie');
    assert.notEqual(rotatedCookie, refreshCookie);
    const loggedOut = await request(base, '/api/auth/logout', {
      method: 'POST',
      headers: { Cookie: rotatedCookie },
    });
    assert.equal(loggedOut.payload.data.loggedOut, true);
    assert.match(loggedOut.response.headers.get('set-cookie'), /Max-Age=0/);
  });
});

test('applicant can upload a real document file record', async () => {
  await withServer(async (base) => {
    const token = await login(base, 'applicant@example.com');
    const formData = new FormData();
    formData.append('ownerName', 'Applicant');
    formData.append('ownerEmail', 'applicant@example.com');
    formData.append('ownerRole', 'Applicant');
    formData.append('docName', '10th marksheet');
    formData.append('file', new Blob(['%PDF-1.4\ndocument sample'], { type: 'application/pdf' }), '10th-marksheet.pdf');
    const response = await fetch(`${base}/api/documents/upload`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: formData,
    });
    const payload = await response.json();
    assert.equal(response.status, 200);
    assert.equal(payload.data.docName, '10th marksheet');
    assert.equal(payload.data.mimeType, 'application/pdf');
    assert.equal(payload.data.status, 'Uploaded (not submitted)');
    assert.ok(payload.data.storedFileName.endsWith('10th-marksheet.pdf'));
  });
});

test('document submission hands drafts to staff and returns review feedback to applicant', async () => {
  await withServer(async (base) => {
    const applicantToken = await login(base, 'applicant@example.com');
    const staffToken = await login(base, 'staff@mitcorer.edu.in');
    const parentToken = await login(base, 'parent@example.com');
    const formData = new FormData();
    formData.append('ownerName', 'Applicant');
    formData.append('ownerEmail', 'applicant@example.com');
    formData.append('docName', '12th marksheet');
    formData.append('file', new Blob(['%PDF-1.4\nprivate document'], { type: 'application/pdf' }), '12th-marksheet.pdf');
    const uploaded = await fetch(`${base}/api/documents/upload`, { method: 'POST', headers: { Authorization: `Bearer ${applicantToken}` }, body: formData });
    const record = (await uploaded.json()).data;
    const staffDrafts = await request(base, '/api/documents', { headers: { Authorization: `Bearer ${staffToken}` } });
    assert.equal(staffDrafts.payload.data.items.some((item) => item.id === record.id), false);
    const hiddenDraft = await fetch(`${base}/api/documents/${record.id}/file`, { headers: { Authorization: `Bearer ${staffToken}` } });
    assert.equal(hiddenDraft.status, 403);
    const submitted = await request(base, '/api/documents/submit', { method: 'POST', headers: { Authorization: `Bearer ${applicantToken}` }, body: '{}' });
    assert.equal(submitted.response.status, 200);
    assert.ok(submitted.payload.data.items.some((item) => item.id === record.id && item.status === 'Submitted for review'));
    const staffQueue = await request(base, '/api/documents', { headers: { Authorization: `Bearer ${staffToken}` } });
    assert.ok(staffQueue.payload.data.items.some((item) => item.id === record.id));
    const staffFile = await fetch(`${base}/api/documents/${record.id}/file`, { headers: { Authorization: `Bearer ${staffToken}` } });
    assert.equal(staffFile.status, 200);
    assert.equal(await staffFile.text(), '%PDF-1.4\nprivate document');
    const parentFile = await fetch(`${base}/api/documents/${record.id}/file`, { headers: { Authorization: `Bearer ${parentToken}` } });
    assert.equal(parentFile.status, 403);
    const correction = await request(base, `/api/documents/${record.id}/status`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${staffToken}` },
      body: JSON.stringify({ status: 'Needs correction', reviewNote: 'Upload a readable full-page scan.' }),
    });
    assert.equal(correction.response.status, 200);
    const applicantDocuments = await request(base, '/api/documents', { headers: { Authorization: `Bearer ${applicantToken}` } });
    const correctedRecord = applicantDocuments.payload.data.items.find((item) => item.id === record.id);
    assert.equal(correctedRecord.status, 'Needs correction');
    assert.equal(correctedRecord.reviewNote, 'Upload a readable full-page scan.');
  });
});

test('assistant attachments are visible to staff without claiming document-checklist status', async () => {
  await withServer(async (base) => {
    const applicantToken = await login(base, 'applicant@example.com');
    const staffToken = await login(base, 'staff@mitcorer.edu.in');
    const formData = new FormData();
    formData.append('note', 'Please check this notice.');
    formData.append('file', new Blob(['%PDF-1.4\nattachment'], { type: 'application/pdf' }), 'notice.pdf');
    const uploaded = await fetch(`${base}/api/assistant/attachments/upload`, { method: 'POST', headers: { Authorization: `Bearer ${applicantToken}` }, body: formData });
    const attachment = (await uploaded.json()).data;
    const listed = await request(base, '/api/assistant/attachments', { headers: { Authorization: `Bearer ${staffToken}` } });
    assert.ok(listed.payload.data.items.some((item) => item.id === attachment.id));
    const content = await fetch(`${base}/api/assistant/attachments/${attachment.id}/file`, { headers: { Authorization: `Bearer ${staffToken}` } });
    assert.equal(content.status, 200);
    assert.equal(await content.text(), '%PDF-1.4\nattachment');
  });
});

test('rejects a file whose declared MIME type does not match its contents', async () => {
  await withServer(async (base) => {
    const token = await login(base, 'applicant@example.com');
    const formData = new FormData();
    formData.append('docName', '10th marksheet');
    formData.append('file', new Blob(['not a PDF'], { type: 'application/pdf' }), '10th-marksheet.pdf');
    const response = await fetch(`${base}/api/documents/upload`, { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: formData });
    const payload = await response.json();
    assert.equal(response.status, 400);
    assert.match(payload.error.message, /valid PDF/i);
  });
});

test('assistant rate limit protects the verified-answer endpoint', async () => {
  await withServer(async (base) => {
    const signup = await request(base, '/api/auth/signup', {
      method: 'POST',
      body: JSON.stringify({ name: 'Rate Limit Test', email: 'ratelimit@example.com', password: 'isolated-test-passphrase', role: 'applicant' }),
    });
    const token = signup.payload.data.token;
    for (let index = 0; index < 30; index += 1) {
      const response = await request(base, '/api/assistant/ask', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: JSON.stringify({ question: `What are admission documents request ${index}?` }),
      });
      assert.equal(response.response.status, 200);
    }
    const limited = await request(base, '/api/assistant/ask', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify({ question: 'One more admission documents request' }),
    });
    assert.equal(limited.response.status, 429);
    assert.equal(limited.payload.error.code, 'RATE_LIMITED');
  });
});

test('api responses return production security headers and support proxy-aware rate limiting', async () => {
  await withServer(async (base) => {
    const health = await request(base, '/api/health');
    assert.equal(health.response.status, 200);
    assert.equal(health.response.headers.get('x-content-type-options'), 'nosniff');
    assert.equal(health.response.headers.get('x-frame-options'), 'DENY');
    assert.equal(health.response.headers.get('referrer-policy'), 'no-referrer');
    assert.match(health.response.headers.get('permissions-policy'), /camera=\(\)/);

    const clientA = { 'X-Forwarded-For': '198.51.100.1, 10.0.0.1' };
    const clientB = { 'X-Forwarded-For': '198.51.100.2, 10.0.0.1' };
    const reqA = await request(base, '/api/public-assistant/ask', {
      method: 'POST',
      headers: clientA,
      body: JSON.stringify({ question: 'What are B.Tech fees?' }),
    });
    const reqB = await request(base, '/api/public-assistant/ask', {
      method: 'POST',
      headers: clientB,
      body: JSON.stringify({ question: 'What are B.Tech fees?' }),
    });
    assert.equal(reqA.response.status, 200);
    assert.equal(reqB.response.status, 200);
  });
});

test('developer short-tail and long-tail keywords resolve with grounded verified evidence', async () => {
  const developerQueries = [
    // Short-Tail Keywords
    'MITCORER',
    'MITCORER Barshi',
    'MIT College Barshi',
    'Railway Engineering College',
    'Engineering College Barshi',
    'Engineering Admission',
    'B.Tech Admission',
    'Diploma Admission',
    'MHT CET Admission',
    'JEE Admission',
    'Engineering Courses',
    'Railway Engineering',
    'Mechanical Engineering',
    'Computer Engineering',
    'Civil Engineering',
    'AI and Data Science',
    'College Fees',
    'Hostel Facility',
    'Placement',
    'Contact MITCORER',

    // Long-Tail Keywords: प्रवेश आणि अर्ज
    'MITCORER Barshi admission 2026',
    'MITCORER B.Tech admission process',
    'How to apply for MITCORER engineering admission',
    'MITCORER admission eligibility criteria',
    'MITCORER admission through MHT CET',
    'MITCORER admission through JEE Main',
    'MITCORER direct second year engineering admission',
    'MITCORER diploma admission process',
    'MITCORER railway engineering diploma admission',
    'MITCORER admission helpline number',
    'MITCORER admission documents required',
    'MITCORER CAP round admission details',
    'MITCORER institute level seats admission',
    'MITCORER admission form last date',
    'MITCORER admission fees structure',

    // अभ्यासक्रम आणि शाखा
    'MITCORER B.Tech courses list',
    'MITCORER Computer Science and Engineering course',
    'MITCORER Mechanical and Rail Engineering course',
    'MITCORER AI and Data Science course',
    'MITCORER Electronics and Telecommunication Engineering course',
    'MITCORER Civil Engineering course details',
    'MITCORER railway engineering diploma specialisations',
    'Best railway engineering college in Maharashtra',
    'Engineering college with railway specialization in India',
    'MITCORER B.Tech lateral entry admission',
    'MITCORER course eligibility after 12th',
    'MITCORER course eligibility after diploma',
    'MITCORER AI and Data Science admission eligibility',

    // फी, शिष्यवृत्ती आणि हॉस्टेल
    'MITCORER B.Tech fees per year',
    'MITCORER hostel fees and facilities',
    'MITCORER hostel accommodation for boys and girls',
    'MITCORER scholarship for engineering students',
    'MITCORER fee structure for diploma',
    'MITCORER education loan assistance',
    'MITCORER hostel admission process',
    'MITCORER hostel facility near Barshi',
    'MITCORER fees for AI and Data Science',
    'MITCORER fees for mechanical engineering',
    'MITCORER fees for computer science engineering',
    'MITCORER scholarship through MHT CET',
    'MITCORER fee payment process',
    'MITCORER hostel food and mess facility',
    'MITCORER hostel safety and security',

    // प्लेसमेंट आणि करिअर
    'MITCORER placement record',
    'MITCORER placement companies list',
    'MITCORER highest package details',
    'MITCORER internship opportunities',
    'MITCORER training and placement cell',
    'Railway engineering career opportunities after MITCORER',
    'Jobs after railway engineering diploma',
    'Career after AI and Data Science engineering',
    'MITCORER placement support for students',
    'MITCORER industry tie-ups and internships',
    'MITCORER campus interview process',
    'MITCORER placement preparation support',
    'Best engineering college in Barshi for placement',
    'Railway sector jobs after engineering',
    'MITCORER alumni career success stories',

    // कॉलेज माहिती आणि संपर्क
    'MITCORER college location in Barshi',
    'MITCORER college address Solapur',
    'MITCORER official website',
    'MITCORER contact number',
    'MITCORER email address',
    'MITCORER campus facilities',
    'MITCORER library and lab facilities',
    'MITCORER faculty details',
    'MITCORER college reviews',
    'MITCORER admission enquiry',
    'MITCORER chatbot support',
    'MITCORER college timings',
    'MITCORER campus visit booking',
    'MITCORER Barshi to Solapur distance.',
  ];

  await withServer(async (base) => {
    for (const question of developerQueries) {
      resetRuntimeStateForTests();
      const { response, payload } = await request(base, '/api/public-assistant/ask', {
        method: 'POST',
        body: JSON.stringify({ question }),
      });
      assert.equal(response.status, 200, `Failed status for: ${question}`);
      assert.notEqual(payload.data.source, 'No verified record', `Unverified source for: ${question}`);
      assert.ok(Array.isArray(payload.data.evidence) && payload.data.evidence.length > 0, `Missing evidence for: ${question}`);
      assert.ok(typeof payload.data.answer === 'string' && payload.data.answer.trim().length > 20, `Empty answer for: ${question}`);
    }
  });
});

test('syllabus searches only cite an indexed syllabus for the requested branch', async () => {
  const question = 'MITCORER mechanical engineering syllabus';
  const indexed = searchDocumentCorpus(question, 3);
  await withServer(async (base) => {
    const { response, payload } = await request(base, '/api/public-assistant/ask', {
      method: 'POST',
      body: JSON.stringify({ question }),
    });
    assert.equal(response.status, 200);
    const evidence = payload.data.evidence || [];
    if (indexed.length) {
      assert.ok(indexed.every((record) => /syllabus/i.test(record.title) && /mechanical|\bmech\b/i.test(record.title)));
      assert.equal(evidence[0]?.id, indexed[0].id);
    } else {
      assert.equal(evidence.length, 0);
      assert.equal(payload.data.outcomeStatus, 'INSUFFICIENT_EVIDENCE');
    }
  });
});

test('strategic improvement options: multi-turn session context, suggestions chips, fuzzy retrieval, and promissory guardrails', async () => {
  await withServer(async (base) => {
    const token = await login(base, 'applicant@example.com');
    const headers = { Authorization: `Bearer ${token}` };

    // Option E: Multi-turn session context memory
    const turn1 = await request(base, '/api/conversations/ask', {
      method: 'POST',
      headers,
      body: JSON.stringify({ question: 'I belong to OBC category and scored well in CET' }),
    });
    assert.equal(turn1.response.status, 200);
    const chat = turn1.payload.data.conversation;
    assert.equal(chat.context?.category, 'OBC');

    const turn2 = await request(base, '/api/conversations/ask', {
      method: 'POST',
      headers,
      body: JSON.stringify({ question: 'What are the engineering fees?', conversationId: chat.id }),
    });
    assert.equal(turn2.response.status, 200);
    const chat2 = turn2.payload.data.conversation;
    assert.equal(chat2.context?.category, 'OBC');
    const assistantReply = chat2.messages[chat2.messages.length - 1];
    assert.match(assistantReply.text, /specify boys or girls/i);
    assert.doesNotMatch(assistantReply.text, /Profile Note|61,109/);

    // Option B: Bare short-tail queries provide quick-action suggestion chips
    resetRuntimeStateForTests();
    const placementAsk = await request(base, '/api/public-assistant/ask', {
      method: 'POST',
      body: JSON.stringify({ question: 'Placement' }),
    });
    assert.equal(placementAsk.response.status, 200);
    assert.ok(Array.isArray(placementAsk.payload.data.suggestions));
    assert.ok(placementAsk.payload.data.suggestions.some((s) => s.label.includes('21 LPA')));

    // Option A: Fuzzy retrieval resolves student typos
    const typoAsk = await request(base, '/api/public-assistant/ask', {
      method: 'POST',
      body: JSON.stringify({ question: 'mitcorer hosstl fees' }),
    });
    assert.equal(typoAsk.response.status, 200);
    assert.match(typoAsk.payload.data.answer, /39,000|hostel/i);
  });
});

test('human escalation is triggered when information is unverified and creates high-priority inquiry', async () => {
  await withServer(async (base) => {
    // 1. Ask a question with no verified record (unsupported medical course)
    const askResult = await request(base, '/api/public-assistant/ask', {
      method: 'POST',
      body: JSON.stringify({ question: 'Does MITCORER offer MBBS or BDS medical degrees?' }),
    });
    assert.equal(askResult.response.status, 200);
    assert.equal(askResult.payload.data.source, 'No verified record');
    assert.ok(askResult.payload.data.escalation, 'Escalation object must be attached');
    assert.equal(askResult.payload.data.escalation.available, true);
    assert.equal(askResult.payload.data.escalation.reason, 'UNVERIFIED_INFORMATION');
    assert.ok(Array.isArray(askResult.payload.data.escalation.helplines));
    assert.ok(askResult.payload.data.escalation.helplines.some((h) => h.number.includes('84599 67882')));

    // 2. Submit escalation inquiry via public escalation endpoint
    const escalateResult = await request(base, '/api/public/escalate', {
      method: 'POST',
      body: JSON.stringify({
        name: 'Aarav Deshmukh',
        contact: '+919876543210',
        question: 'Does MITCORER offer MBBS course and hospital training?',
        topic: 'Human Escalation',
      }),
    });
    assert.equal(escalateResult.response.status, 200);
    assert.equal(escalateResult.payload.data.success, true);
    assert.ok(escalateResult.payload.data.inquiryId);
    assert.equal(escalateResult.payload.data.routing.queue, 'MITCORER Staff Triage');
    assert.equal(escalateResult.payload.data.routing.assignedTo, null);
    assert.equal(escalateResult.payload.data.routing.notificationSent, false);

    // 3. Verify inquiry is saved in store with High priority and Needs reply status
    const admin = await login(base, 'admin@mitcorer.edu.in');
    const inquiriesList = await request(base, '/api/inquiries', {
      headers: { Authorization: `Bearer ${admin}` },
    });
    const escalatedInquiry = inquiriesList.payload.data.items.find(
      (item) => item.id === escalateResult.payload.data.inquiryId
    );
    assert.ok(escalatedInquiry, 'Inquiry must exist in staff inquiries dashboard');
    assert.equal(escalatedInquiry.name, 'Aarav Deshmukh');
    assert.equal(escalatedInquiry.priority, 'High');
    assert.equal(escalatedInquiry.status, 'Needs reply');
    assert.equal(escalatedInquiry.topic, 'Human Escalation');
    assert.equal(escalatedInquiry.routingQueue, 'MITCORER Staff Triage');
    assert.equal(escalatedInquiry.assignedTo, '');
    assert.match(escalatedInquiry.messages[0].text, /Human Escalation from Mitra Assistant/);

    const feedbackResult = await request(base, '/api/public/feedback', {
      method: 'POST',
      body: JSON.stringify({ question: 'Which courses are offered?', answer: 'Six B.Tech programmes.', helpful: false, model: 'deterministic-rag-fallback' }),
    });
    assert.equal(feedbackResult.response.status, 200);
    assert.equal(feedbackResult.payload.data.success, true);
    const staffFeedback = await request(base, '/api/feedback', {
      headers: { Authorization: `Bearer ${admin}` },
    });
    const savedFeedback = staffFeedback.payload.data.items.find(item => item.id === feedbackResult.payload.data.feedbackId);
    assert.ok(savedFeedback, 'Answer feedback must be reviewable by staff');
    assert.equal(savedFeedback.helpful, false);
    assert.equal(savedFeedback.question, 'Which courses are offered?');
  });
});

test('staff hiring and employment queries are treated as unverified and trigger human escalation', async () => {
  await withServer(async (base) => {
    const hiringQueries = [
      'staff hiring process of mit',
      'faculty recruitment process',
      'job openings for teachers',
      'careers at mitcorer',
      'is there any vacancy for assistant professor?',
      'how to apply for teaching job at mit',
    ];

    for (const question of hiringQueries) {
      resetRuntimeStateForTests();
      const { response, payload } = await request(base, '/api/public-assistant/ask', {
        method: 'POST',
        body: JSON.stringify({ question }),
      });
      assert.equal(response.status, 200);
      assert.equal(payload.data.source, 'No verified record', `Source should be No verified record for: ${question}`);
      assert.match(payload.data.answer, /could not find an official answer/i);
      assert.doesNotMatch(payload.data.answer, /MITCORER offers railway-oriented engineering courses/i);
      assert.doesNotMatch(payload.data.answer, /100\+ companies visiting/i);
      assert.equal(payload.data.outcomeStatus, 'INSUFFICIENT_EVIDENCE');
      assert.ok(payload.data.escalation, `Escalation should be attached for: ${question}`);
      assert.equal(payload.data.escalation.available, true);
      assert.equal(payload.data.escalation.reason, 'UNVERIFIED_INFORMATION');
      assert.equal(payload.data.escalation.email, 'office@mitcorer.edu.in');
      assert.equal(payload.data.escalation.actionLabel, 'Escalate to Administrative Office');
      assert.ok(payload.data.escalation.helplines?.length > 0);
    }
  });
});



