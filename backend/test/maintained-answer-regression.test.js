import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { config } from '../src/config.js';
import { createSeedData } from '../src/seed.js';
import { resetDbForTests, getDb, closeDb, saveDb } from '../src/store.js';
import { answerAdmissionQuestion, resetRuntimeStateForTests } from '../src/server.js';
import { createPublicSession } from '../src/public-session.js';
import { askPublicWithHistory } from '../src/conversations.js';
import { selectLanguage } from '../src/language.js';
import { documentCorpusStats, searchDocumentCorpus } from '../src/document-corpus.js';

async function fixture(run) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mitra-phase-a-'));
  config.databaseFile = path.join(dir, 'test.sqlite');
  config.geminiApiKey = ''; config.groqApiKey = '';
  resetDbForTests(createSeedData()); resetRuntimeStateForTests();
  try { await run((question, language = 'en') => answerAdmissionQuestion({ question, language }, null)); }
  finally { closeDb(); fs.rmSync(dir, { recursive: true, force: true }); }
}

test('developer review regressions preserve fee scope and personal outcome limits', () => fixture(async ask => {
  const fee = await ask('For 2026-27 DSE, what fee is listed for OBC girls?');
  assert.equal(fee.outcomeStatus, 'ANSWERED');
  assert.match(fee.answer, /18,362/);
  assert.doesNotMatch(fee.answer, /Other requested information/);
  for (const [language, question, answer] of [
    ['mr', 'यावर्षी माझी शिष्यवृत्तीची रक्कम नेमकी कोणत्या तारखेला जमा होईल?', /पडताळू शकत नाही/],
    ['hi', 'इस वर्ष मेरी छात्रवृत्ति की राशि ठीक किस तारीख को जमा होगी?', /पुष्टि नहीं कर सकता/],
    ['mr', 'अर्ज केल्यास मला वैयक्तिकरीत्या AICTE Pragati शिष्यवृत्ती मंजूर होईल का?', /मंजुरी/],
    ['hi', 'आवेदन करने पर क्या मुझे व्यक्तिगत रूप से AICTE Pragati छात्रवृत्ति मंजूर होगी?', /मंज़ूरी/],
    ['mr', 'पुढील वर्षी कोणती कंपनी मला नोकरी देईल आणि 10 LPA पॅकेजची हमी देता का?', /हमी देऊ शकत नाही/],
  ]) {
    const response = await ask(question, language);
    assert.equal(response.outcomeStatus, 'INSUFFICIENT_EVIDENCE', question);
    assert.equal(response.responseLanguage, language);
    assert.deepEqual(response.evidence, []);
    assert.match(response.answer, answer);
    assert.ok(response.officialLinks.length);
  }
}));

test('fee exclusions, placement preparation, and visit requests keep the requested scope', () => fixture(async ask => {
  for (const question of [
    "Tell me the fees for CSE, but don't include hostel and transportation charges.",
    'What are first-year Open CSE tuition fees excluding hostel and transport?',
    'What are first-year Open CSE tuition fees without accommodation charges?',
  ]) {
    const response = await ask(question);
    assert.ok(['ANSWERED', 'NEEDS_CLARIFICATION'].includes(response.outcomeStatus), question);
    assert.ok(response.evidence.every(record => record.id === 'KB-2'), question);
    assert.doesNotMatch(response.answer, /Hostel fees:|Bus and transport:|40,000/, question);
    if (question.includes('first-year')) assert.match(response.answer, /1,05,000/, question);
  }
  const inclusive = await ask('What are first year Open academic fees and hostel fees?');
  assert.match(inclusive.answer, /40,000/);
  for (const question of ['What skills should I learn for campus placements?', 'How should I prepare for campus placements?']) {
    const response = await ask(question);
    assert.equal(response.outcomeStatus, 'ANSWERED');
    assert.deepEqual(response.evidence.map(record => record.id), ['KB-43']);
    assert.ok(response.sourceLinks.some(link => /placement-ready-program\.php$/.test(link.url)));
    assert.match(response.answer, /quantitative aptitude/i);
    assert.match(response.answer, /mock interviews/i);
  }
  for (const question of ['I want to visit the college. Share the location and contact details.', 'Share the location and contact details.']) {
    const response = await ask(question);
    assert.equal(response.outcomeStatus, 'ANSWERED', question);
    assert.ok(response.evidence.some(record => record.id === 'KB-17'), question);
    assert.match(response.answer, /Barshi/i);
    assert.match(response.answer, /helpline/i);
    assert.doesNotMatch(response.answer, /Other requested information/);
  }
}));

test('student questions use the requested fact, official destination or an explicit evidence limit', () => fixture(async ask => {
  if (process.env.MITRA_EXPECT_DOCUMENT_INDEX) {
    assert.equal(documentCorpusStats().available, process.env.MITRA_EXPECT_DOCUMENT_INDEX === 'present');
  }
  const timetable = await ask('Where do I find the PAHSU exam timetable?');
  assert.equal(timetable.outcomeStatus, 'ANSWERED');
  assert.match(timetable.answer, /Examination.+Time Table/);
  assert.equal(timetable.officialLinks[0].url, 'https://www.sus.ac.in/examination/Time-Table');
  assert.deepEqual(timetable.evidence, []);
  for (const question of ['Link me to the Solapur University examination schedule', 'PAHSU B.Tech exam time-table PDF']) {
    const response = await ask(question);
    assert.equal(response.officialLinks[0].url, 'https://www.sus.ac.in/examination/Time-Table', question);
    assert.deepEqual(response.evidence, [], question);
  }
  assert.deepEqual(searchDocumentCorpus('PAHSU March 2024 exam timetable'), []);

  const seats = await ask('What are the first year Civil Engineering seats?');
  assert.equal(seats.outcomeStatus, 'ANSWERED');
  assert.equal(seats.evidence[0].id, 'KB-10');
  assert.match(seats.answer, /Civil Engineering.*sanctioned intake 60/);
  assert.match(seats.answer, /does not confirm current vacancies/);
  const openSeats = await ask('Are there current seat vacancies for Civil Engineering?');
  assert.equal(openSeats.outcomeStatus, 'INSUFFICIENT_EVIDENCE');
  assert.match(openSeats.answer, /cannot verify live seat vacancies/);
  assert.doesNotMatch(openSeats.answer, /Computer Science/);
  const remaining = await ask('Are there any Mechanical Engineering seats left?');
  assert.equal(remaining.outcomeStatus, 'INSUFFICIENT_EVIDENCE');
  assert.match(remaining.answer, /cannot verify live seat vacancies/);

  const deposit = await ask('How much is hostel including deposit?');
  assert.equal(deposit.outcomeStatus, 'ANSWERED');
  assert.equal(deposit.evidence[0].id, 'KB-3');
  assert.match(deposit.answer, /refundable hostel deposit of .*5,000.*hostel total of .*40,000/);
  const costs = await ask('How much are dormitory caution money and mess fees?');
  assert.equal(costs.evidence[0].id, 'KB-3');
  assert.match(costs.answer, /5,000/);
  assert.match(costs.answer, /42,000/);

  for (const [question, expected] of [
    ['Is there wheelchair access in the hostel?', /could not verify the hostel accessibility/],
    ['Is there a wheelchair ramp at the girls hostel?', /could not verify the hostel accessibility/],
    ['Is the dormitory step-free and does it have a lift?', /could not verify the hostel accessibility/],
    ['When will I get my hostel deposit back?', /could not verify the hostel deposit refund/],
    ['Who teaches first year mathematics?', /could not verify the teaching assignment/],
    ['Who will be teaching engineering maths next semester?', /could not verify the teaching assignment/],
    ['Give me the HOD personal mobile number.', /cannot provide a private staff contact/],
    ['Can I get the professor’s WhatsApp?', /cannot provide a private staff contact/],
    ['What is tomorrow attendance?', /cannot verify attendance for a specific day/],
    ['Check my attendance percentage', /cannot verify attendance for a specific day/],
  ]) {
    const response = await ask(question);
    assert.equal(response.outcomeStatus, 'INSUFFICIENT_EVIDENCE', question);
    assert.match(response.answer, expected, question);
    assert.deepEqual(response.evidence, [], question);
    assert.ok(response.officialLinks.some(link => link.url.includes('/contact-us')), question);
  }
}));

test('maintained profile edits override literals and retirement prevents reuse', () => fixture(async ask => {
  getDb().knowledge.find(r => r.id === 'KB-38').text = 'Computer Science and Engineering: Head of Department is Dr. Audit Fixture.';
  const changed = await ask('Who is the HOD of Computer Science?');
  assert.match(changed.answer, /Dr\. Audit Fixture/); assert.doesNotMatch(changed.answer, /Somnath/);
  getDb().knowledge.find(r => r.id === 'KB-38').status = 'Retired'; saveDb();
  assert.deepEqual((await ask('Who is the HOD of Computer Science?')).evidence, []);
}));

test('faculty questions use published crawled profiles across departments', () => fixture(async ask => {
  const profile = (id, title, slug, name, field) => ({
    id, title, sourceUrl: `https://mitcorer.edu.in/mitcorer/public/department/${slug}/faculty`,
    documentType: 'Faculty', sourceAuthority: 'MITCORER official site', status: 'Published',
    extractedText: `Faculty Profile\n${name}\nDesignation:\nAssistant Professor\nQualification:\nM.E.\nArea of Research Interest:\n${field}\nTeaching Experience:\n10 years`,
  });
  getDb().officialSources = getDb().officialSources.filter(item => !String(item.id || '').startsWith('SRC-FACULTY-'));
  getDb().officialSources.push(
    profile('SRC-CSE-FACULTY', 'CSE faculty', 'computer-science-engineering', 'Prof. Example CSE', 'Cloud Computing'),
    profile('SRC-CIVIL-FACULTY', 'Civil faculty', 'civil-engineering', 'Prof. Example Civil', 'Structures'),
  );
  const cse = await ask('List faculties working in Computer Science and Engineering branch?');
  assert.match(cse.answer, /Prof\. Example CSE/);
  assert.doesNotMatch(cse.answer, /Prof\. Example Civil/);
  assert.equal(cse.evidence[0]?.id, 'SRC-CSE-FACULTY');
  const all = await ask('List faculty profiles for all branches.');
  assert.match(all.answer, /Prof\. Example CSE/);
  assert.match(all.answer, /Prof\. Example Civil/);
  assert.deepEqual(new Set(all.evidence.map(item => item.id)), new Set(['SRC-CSE-FACULTY', 'SRC-CIVIL-FACULTY']));
}));

test('standard About and Why questions use stable, formatted maintained answers', () => fixture(async ask => {
  const about = await ask('Tell me about MITCORER.');
  assert.ok(about.evidence.some(item => item.id === 'KB-34'));
  assert.match(about.answer, /Official Website:/);
  assert.doesNotMatch(about.answer, /Virtual Assistant:/);

  const why = await ask('Why should I choose MITCORER?');
  assert.ok(why.evidence.some(item => item.id === 'KB-35'));
  assert.match(why.answer, /Why families may consider MITCORER:/);
  assert.match(why.answer, /\n- Railway-oriented engineering courses/);
  assert.match(why.answer, /Placement note:/);
}));

test('response cache rechecks natural source expiry within its own TTL', () => fixture(async ask => {
  const realNow = Date.now;
  const before = Date.parse('2026-11-18T23:59:00Z');
  getDb().knowledge.find(r => r.id === 'KB-20').provenance = { validUntil: '2026-11-18' };
  try {
    Date.now = () => before; await ask('Tell me about the library.');
    Date.now = () => before + 120000;
    const expired = await ask('Tell me about the library.');
    assert.deepEqual(expired.evidence, []); assert.notEqual(expired.__fromSemanticCache, true);
  } finally { Date.now = realNow; }
}));

test('saving source withholding invalidates a cached public answer', () => fixture(async ask => {
  await ask('Tell me about the library.');
  getDb().knowledge.find(r => r.id === 'KB-20').status = 'Review'; saveDb();
  assert.deepEqual((await ask('Tell me about the library.')).evidence, []);
}));

test('facility answering uses maintained text rather than an authorized but stale literal', () => fixture(async ask => {
  await ask('Tell me about the library.');
  getDb().knowledge.find(r => r.id === 'KB-20').text = 'The reviewed library fixture has 123 books.';
  const r = await ask('Tell me about the library.');
  assert.equal(r.answer, 'The reviewed library fixture has 123 books.');
  assert.equal(r.evidence[0].passage.text, r.answer);
  assert.notEqual(r.__fromSemanticCache, true);
}));

test('factual scholarship requests retain specific evidence and application links', () => fixture(async ask => {
  const r = await ask('Tell me about the AICTE Pragati scholarship for girl students at MITCORER.');
  assert.ok(r.evidence.some(e => e.id === 'KB-33')); assert.match(r.answer, /NSP|National Scholarship Portal/);
  const broad = await ask('What scholarships are available at MITCORER and where can I apply?');
  assert.ok(broad.evidence.some(e => e.id === 'KB-18'));
  assert.ok(broad.officialLinks.some(link => link.url === 'https://mahadbt2.maharashtra.gov.in/'));
}));

test('compound requests account for all four independently supported facets', () => fixture(async ask => {
  const r = await ask('Tell me CSE fees, intake, scholarship details and hostel charges.');
  assert.deepEqual(new Set(r.evidence.map(e => e.id)), new Set(['KB-2', 'KB-10', 'KB-18', 'KB-3']));
  assert.equal(r.sections.length, 4); assert.match(r.answer, /120/);
  const native = await ask('Tell me CSE fees, intake, scholarship details and hostel charges.', 'mr');
  assert.equal(native.sections.find(s => s.topic === 'scholarship').title, 'शिष्यवृत्ती');
  const both = await ask('List CSE fees and hostel fees.');
  assert.deepEqual(new Set(both.evidence.map(e => e.id)), new Set(['KB-2', 'KB-3']));
  const mixed = await ask('What are admission steps and required documents?');
  assert.equal(mixed.outcomeStatus, 'PARTIALLY_ANSWERED');
  assert.ok(mixed.sections.some(s => s.status === 'clarification' && s.topic === 'documents'));
}));

test('seat paraphrases and branch comparisons select maintained intake', () => fixture(async ask => {
  for (const q of ['Computer branch capacity?', 'Civil Engineering sanctioned seats?', 'Mechanical branch madhe kiti seats aahet?']) {
    const r = await ask(q); assert.equal(r.evidence[0]?.id, 'KB-10', q);
  }
  const r = await ask('Compare Civil and Computer Engineering intake.');
  assert.match(r.answer, /Civil Engineering.*60/s); assert.match(r.answer, /Computer Science.*120/s);
}));

test('conversation preserves intake and accommodation cost across short switches', () => fixture(async () => {
  const token = createPublicSession(); let id;
  const ask = async question => { const r = await askPublicWithHistory({ question, language: 'en', conversationId: id }, answerAdmissionQuestion, token); id = r.conversationId; return r; };
  await ask('CSE intake?'); await ask('What about Civil?');
  assert.match((await ask('And Mechanical Engineering?')).answer, /intake 60/);
  await ask('What are hostel fees?');
  assert.match((await ask('How much is the deposit?')).answer, /5,000/);
  assert.match((await ask('What about the mess?')).answer, /42,000/);
}));

test('native and Romanized language markers do not confuse shared admission nouns', () => {
  for (const q of ['ग्रंथालयाची माहिती द्या', 'CSE chi fees kiti aahe?']) assert.equal(selectLanguage(q), 'mr');
  for (const q of ['पुस्तकालय की जानकारी दें', 'प्रवेश के लिए दस्तावेज क्या चाहिए?', 'CSE ki fees kitni hai?']) assert.equal(selectLanguage(q), 'hi');
  assert.equal(selectLanguage('प्रवेश के लिए दस्तावेज क्या चाहिए?', 'en'), 'en');
});

test('unresolved references clarify and escalation never invents operating hours', () => fixture(async ask => {
  const r = await ask('Is it available?'); assert.equal(r.clarification, true); assert.deepEqual(r.evidence, []);
  assert.equal(r.outcomeStatus, 'NEEDS_CLARIFICATION');
  const unknown = await ask('What is the weather in Barshi?');
  assert.equal(unknown.escalation.officeHours, undefined);
  assert.doesNotMatch(JSON.stringify(unknown.escalation), /222222|9:30/);
}));

test('cutoff lookup never substitutes Round I or JEE for an explicit unsupported scope', () => fixture(async ask => {
  for (const q of ['2025 CSE All India JEE Main cutoff CAP Round II?', '2025 CSE MHT-CET cutoff CAP Round I?']) {
    const r = await ask(q); assert.deepEqual(r.evidence, []); assert.equal(r.outcomeStatus, 'INSUFFICIENT_EVIDENCE');
    assert.doesNotMatch(r.answer, /53\.9228024|56892/);
  }
  getDb().knowledge.find(r => r.id === 'KB-8').provenance = { academicYear: '2027-28' };
  assert.deepEqual((await ask('2025 CSE All India JEE Main cutoff CAP Round I?')).evidence, []);
}));

test('explicit external institutions and leaked papers cannot fall through to MITCORER retrieval', () => fixture(async ask => {
  for (const question of ['Give me a leaked exam paper.', 'Send a stolen question paper', 'Tell me VIT Pune fees.', 'COEP admission rules?']) {
    const r = await ask(question);
    assert.equal(r.outcomeStatus, 'UNSUPPORTED_TOPIC');
    assert.deepEqual(r.evidence, []);
    assert.doesNotMatch(r.answer, /1,05,000|61,109|student Achivments/);
  }
  const native = await ask('Give me a leaked exam paper.', 'hi');
  assert.equal(native.responseLanguage, 'hi');
  assert.equal(native.languageReviewStatus, 'speaker-review-pending');
  assert.match(native.answer, /गोपनीय/);
  assert.ok((await ask('Show official past exam papers at MITCORER')).outcomeStatus !== 'UNSUPPORTED_TOPIC');
  assert.ok((await ask('What are MITCORER first-year fees?')).evidence.some(e => e.id === 'KB-2'));
}));

test('review follow-ups answer the requested attribute without inventing missing facts', () => fixture(async ask => {
  const documents = await ask('What are scholarship documents?', 'hi');
  assert.equal(documents.clarification, true); assert.match(documents.answer, /योजना/);
  assert.ok(documents.officialLinks.some(link => link.url === 'https://mahadbt2.maharashtra.gov.in/'));
  assert.ok(documents.officialLinks.some(link => link.url === 'https://scholarships.gov.in/All-Scholarships'));
  assert.match((await ask('Tell me scholarship amount even if not published.')).answer, /No verified scholarship amount/);
  assert.match((await ask('What are first-year tuition fees?')).answer, /tuition-only breakdown/);
  assert.doesNotMatch((await ask('Tell me about MITCORER.')).answer, /24\/7 verified guidance/);
  assert.match((await ask('Give me Civil cutoff AY 2030-31.')).answer, /no maintained cutoff record/);
  for (const question of ['Admission document checklist?', 'List admission documents.', 'What documents are required for admission?']) assert.equal((await ask(question)).clarification, true);
  const admission = await ask('CSE la admission kasa milel?', 'en');
  assert.ok(admission.evidence.some(e => e.id === 'KB-29'));
  assert.match(admission.answer, /registration/);
  const romanizedDocuments = await ask('admission sathi docs konti pahijet?', 'mr');
  assert.ok(romanizedDocuments.evidence.some(e => e.id === 'KB-1'));
  assert.equal(romanizedDocuments.clarificationKind, 'documents');
  assert.match(romanizedDocuments.answer, /General reporting checklist/);
  assert.equal(romanizedDocuments.responseLanguage, 'mixed');
  assert.ok(romanizedDocuments.officialLinks.some(link => link.url === 'https://mitcorer.edu.in/fy-btech-documents.php'));
  assert.ok(romanizedDocuments.officialLinks.some(link => link.url === 'https://fe2026.mahacet.org/StaticPages/HomePage'));
  const compound = await ask('List CSE fees and hostel fees.');
  assert.equal(compound.sections.find(section => section.topic === 'accommodationFees').title, 'Hostel fees');
}));
