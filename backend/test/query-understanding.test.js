import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { config } from '../src/config.js';
import { resetDbForTests, closeDb } from '../src/store.js';
import { createSeedData } from '../src/seed.js';
import { answerAdmissionQuestion, normalizeIntentText, resetRuntimeStateForTests } from '../src/server.js';
import { understandQuery, splitQueryClauses, matchesIntent } from '../src/query-understanding.js';
import { academicFeeSelection } from '../src/knowledge.js';

test('qualification, numbers and negation survive normalization', () => {
  const query = normalizeIntentText('I am in class 12, not first year. My score is 61.2790648, code 0690124210.');
  assert.match(query, /class 12/);
  assert.match(query, /not first year/);
  assert.match(query, /61\.2790648/);
  assert.match(query, /0690124210/);
  assert.doesNotMatch(normalizeIntentText('Do you sell coffee?'), /\bfee\b/);
  assert.match(normalizeIntentText('CSE seats and intake kya hai?'), /seat matrix/);
  assert.match(normalizeIntentText('CAP फेरी प्रक्रिया सांगा.'), /cap round/);
  assert.match(normalizeIntentText('CAP राउंड प्रक्रिया बताओ.'), /cap round/);
});

test('extracted fields preserve scope, negation, academic years and protected names', () => {
  const query = understandQuery('I passed class 12. DSE fees for OBC girls in AY 2026/27, not first year.');
  assert.equal(query.admissionRoute, 'directSecondYear');
  assert.deepEqual(query.route.excluded, ['firstYear']);
  assert.deepEqual(query.academicYears, ['2026-27']);
  assert.deepEqual(query.gender.positive, ['girl']);
  assert.deepEqual(understandQuery('Deadline 2026-12-24').invalidYears, []);
  assert.deepEqual(understandQuery('Fees AY 2026-2027').academicYears, ['2026-27']);
  assert.deepEqual(understandQuery('Fees AY 2026-29').invalidYears, ['2026-29']);
  assert.deepEqual(understandQuery('Not only CSE, all branches').branch.excluded, []);
  assert.equal(academicFeeSelection('Open EBC boys first-year fees').key, 'concessionBoy');
  assert.equal(academicFeeSelection('Not OBC, Open first-year fees').key, 'open');
  assert.equal(matchesIntent('coffee or fellowship', 'fee'), false);
  assert.equal(normalizeIntentText('Eligible coffee costs 0690124210. hostle and lbrary.'), 'eligible coffee cost 0690124210. hostel and library.');
  assert.deepEqual(splitQueryClauses(normalizeIntentText('Artificial Intelligence and Data Science courses and hostel fees')), ['artificial intelligence and data science course', 'hostel fee']);
});

test('public queries interpret plurals, paraphrases, typos, native conjunctions and ambiguity', async () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'mitra-query-test-'));
  config.databaseFile = path.join(directory, 'test.sqlite');
  config.geminiApiKey = '';
  resetDbForTests(createSeedData());
  const ask = async question => { resetRuntimeStateForTests(); return answerAdmissionQuestion({ question, language: 'en' }, null); };
  try {
    const girl = await ask('What are the first-year fees for OBC girls?');
    assert.match(girl.answer, /17,217/);
    assert.doesNotMatch(girl.answer, /61,109|98,000/);
    const boy = await ask('What is the first-year price for OBC boys?');
    assert.match(boy.answer, /61,109/);
    assert.doesNotMatch(boy.answer, /1,05,000/);
    for (const question of ['Tell me about the lbrary.', 'Where can students borrow books?', 'What reading resources are available?']) {
      assert.equal((await ask(question)).evidence[0]?.id, 'KB-20', question);
    }
    assert.equal((await ask('What scholrships are available?')).evidence[0]?.id, 'KB-18');
    const hindi = await ask('प्रथम वर्ष की फीस तथा छात्रावास की फीस बताइए।');
    assert.deepEqual(new Set(hindi.sections?.map(section => section.topic)), new Set(['academicFees', 'accommodationFees']));
    const marathi = await ask('प्रथम वर्ष शुल्क तसेच वसतिगृह शुल्क सांगा.');
    assert.deepEqual(new Set(marathi.sections?.map(section => section.topic)), new Set(['academicFees', 'accommodationFees']));
    const qualified = await ask('I passed class 12. What are Direct Second Year fees?');
    assert.match(qualified.answer, /98,000/);
    assert.doesNotMatch(qualified.answer, /1,05,000/);
    const ambiguous = await ask('I am an OBC student. What are first-year fees?');
    assert.equal(ambiguous.clarification, true);
    assert.equal(ambiguous.evidence.length, 0);
    const excluded = await ask('What is the intake, not CSE?');
    assert.equal(excluded.clarification, true);
    const negativeCategory = await ask('I am not OBC. What are first-year fees?');
    assert.equal(negativeCategory.clarification, true);
    assert.deepEqual(negativeCategory.evidence, []);
    const coffee = await ask('Do you sell coffee?');
    assert.deepEqual(coffee.evidence, []);
    assert.doesNotMatch(coffee.answer, /1,05,000|fee planner/);
    for (const language of ['mr', 'hi']) {
      const clarified = await answerAdmissionQuestion({ question: 'First-year OBC fees?', language }, null);
      assert.equal(clarified.clarification, true);
      assert.match(clarified.answer, language === 'mr' ? /मुलगा की मुलगी/ : /लड़का या लड़की/);
      const civil = await answerAdmissionQuestion({ question: 'Civil Engineering intake?', language }, null);
      assert.equal(civil.localizationStatus, 'template');
      assert.match(civil.answer, /Civil Engineering/);
      assert.doesNotMatch(civil.answer, /Computer Science and Engineering/);
    }
    const invalidYear = await ask('First-year fees in AY 2026-29?');
    assert.equal(invalidYear.clarification, true);
    const futureYear = await ask('First-year fees in AY 2030/31?');
    assert.deepEqual(futureYear.evidence, []);
    const academicOnly = await ask('What are first-year academic fees, not hostel?');
    assert.equal(academicOnly.evidence[0]?.id, 'KB-2');
    assert.doesNotMatch(academicOnly.answer, /35,000/);
    const scopedCompound = await ask('I am not OBC. What are academic fees and hostel fees?');
    assert.equal(scopedCompound.sections[0].status, 'clarification');
    assert.equal(scopedCompound.sections[1].status, 'supported');
    assert.match(scopedCompound.answer, /35,000/);
    for (const language of ['mr', 'hi']) {
      const messOnly = await answerAdmissionQuestion({ question: 'Mess fees, not hostel?', language }, null);
      assert.equal(messOnly.localizationStatus, 'template');
      assert.match(messOnly.answer, /42,000/);
      assert.doesNotMatch(messOnly.answer, /35,000/);
    }
    const faculty = await ask('How many faculty are there at MITCORER?');
    assert.equal(faculty.evidence[0]?.id, 'KB-35');
    assert.match(faculty.answer, /60\+ experienced faculty members/);
    assert.ok(faculty.officialLinks.some(l => l.url.includes('Mandatory-Disclousure.pdf')));

    const alumni = await ask('How many alumni does MITCORER have?');
    assert.equal(alumni.evidence[0]?.id, 'KB-35');
    assert.match(alumni.answer, /900\+ graduates/);

    const affiliation = await ask('Which university is MITCORER affiliated to?');
    assert.equal(affiliation.evidence[0]?.id, 'KB-37');
    assert.match(affiliation.answer, /Punyashlok Ahilyadevi Holkar Solapur University/);
    assert.match(affiliation.answer, /06901/);

    const hod = await ask('Who is the HOD of Computer Science?');
    assert.equal(hod.evidence[0]?.id, 'KB-38');
    assert.match(hod.answer, /Prof\. Somnath Mule/);

    const nss = await ask('Tell me about NSS and Rail-MIT technical events');
    assert.equal(nss.evidence[0]?.id, 'KB-39');
    assert.match(nss.answer, /National Service Scheme/);
    assert.match(nss.answer, /Rail-MIT/);

    const station = await ask('What is the nearest railway station to MITCORER?');
    assert.equal(station.evidence[0]?.id, 'KB-40');
    assert.match(station.answer, /Barshi Town/);
    assert.match(station.answer, /4\.7 km/);
    assert.match(station.answer, /Kurduwadi/);

    const busStand = await ask('How far is the college from Barshi bus stand?');
    assert.equal(busStand.evidence[0]?.id, 'KB-40');
    assert.match(busStand.answer, /5\.7 km/);
    assert.match(busStand.answer, /MSRTC Bus Stand/);

    const mitPune = await ask('Is MITCORER Barshi the same as MIT Pune?');
    assert.equal(mitPune.evidence[0]?.id, 'KB-41');
    assert.match(mitPune.answer, /MAEER's MIT Group of Institutions, Pune/);
    assert.match(mitPune.answer, /Vishwanath D\. Karad/);

    const modelRoom = await ask('What is the Railway Model Room at MITCORER?');
    assert.equal(modelRoom.evidence[0]?.id, 'KB-42');
    assert.match(modelRoom.answer, /Railway Model Room/);
    assert.match(modelRoom.answer, /signaling/i);
    assert.match(modelRoom.answer, /scale/i);
    assert.ok(modelRoom.officialLinks.some(link => link.url.includes('railway-model-room.php')));

    const mous = await ask('What Industry MoUs and corporate readiness programs does MITCORER offer?');
    assert.equal(mous.evidence[0]?.id, 'KB-43');
    assert.match(mous.answer, /Industry MoUs/);
    assert.match(mous.answer, /Corporate Readiness Program/);
    assert.match(mous.answer, /APTRON/);
    assert.ok(mous.officialLinks.some(link => link.url.includes('mou.php') || link.url.includes('our-mou.php')));
    assert.ok(mous.officialLinks.some(link => link.url.includes('placement-cell.php') || link.url.includes('training-and-placement-cell.php')));

    const ragging = await ask('Is the campus ragging free and what anti-ragging measures are taken?');
    assert.equal(ragging.evidence[0]?.id, 'KB-44');
    assert.match(ragging.answer, /Anti-Ragging/i);
    assert.match(ragging.answer, /Zero-Tolerance/i);
    assert.match(ragging.answer, /emergency vehicle/i);
    assert.ok(ragging.officialLinks.some(link => link.url.includes('Anti-Ragging-2025-26.pdf')));

    const aids = await ask('Does MITCORER offer Artificial Intelligence and Data Science?');
    assert.equal(aids.evidence[0]?.id, 'KB-10');
    assert.match(aids.answer, /Artificial Intelligence and Data Science/);
    assert.match(aids.answer, /0690126310/);
    assert.ok(aids.officialLinks.some(link => link.url.includes('artificial-intelligence-data-science.php')));

    const entc = await ask('Does MITCORER have Electronics and Telecommunication?');
    assert.equal(entc.evidence[0]?.id, 'KB-10');
    assert.match(entc.answer, /Electronics and Telecommunication Engineering/);
    assert.match(entc.answer, /0690137210/);
    assert.ok(entc.officialLinks.some(link => link.url.includes('electronics-and-tele-communication-engineering.php')));

    const nep = await ask('Does MITCORER follow NEP 2020?');
    assert.equal(nep.evidence[0]?.id, 'KB-45');
    assert.match(nep.answer, /NEP 2020/);
    assert.match(nep.answer, /Outcome-Based Education/i);
    assert.ok(nep.officialLinks.some(link => link.url.includes('faq.php')));

    const medium = await ask('What is the medium of instruction at MITCORER?');
    assert.equal(medium.evidence[0]?.id, 'KB-45');
    assert.match(medium.answer, /English/i);

    const officeHours = await ask('What are the office hours and timings at MITCORER?');
    assert.equal(officeHours.evidence[0]?.id, 'KB-46');
    assert.match(officeHours.answer, /9:30 AM to 5:30 PM/);
    assert.match(officeHours.answer, /Monday to Saturday/);
    assert.ok(officeHours.officialLinks.some(link => link.url.includes('contact.php')));

    const admissionDesk = await ask('When is the admission enquiry desk open?');
    assert.equal(admissionDesk.evidence[0]?.id, 'KB-46');
    assert.match(admissionDesk.answer, /Admission Enquiry Desk/);

    const railwayDiplomas = await ask('What professional diplomas or specialized railway courses does MITCORER offer?');
    assert.equal(railwayDiplomas.evidence[0]?.id, 'KB-47');
    assert.match(railwayDiplomas.answer, /Railway Signaling & Telecommunication/i);
    assert.match(railwayDiplomas.answer, /Railway Track Technology/i);
    assert.match(railwayDiplomas.answer, /Rolling Stocks and Operations/i);
    assert.match(railwayDiplomas.answer, /Software Technology in Railway/i);
    assert.ok(railwayDiplomas.officialLinks.some(link => link.url.includes('about-professional-diploma-railway.php')));

    const trackTech = await ask('Tell me about the professional diploma in Railway Track Technology');
    assert.equal(trackTech.evidence[0]?.id, 'KB-47');
    assert.match(trackTech.answer, /Civil Engineering/i);

    const sports = await ask('What sports grounds and gym facilities are available at MITCORER?');
    assert.equal(sports.evidence[0]?.id, 'KB-48');
    assert.match(sports.answer, /cricket/i);
    assert.match(sports.answer, /volleyball/i);
    assert.match(sports.answer, /gymnasium/i);
    assert.ok(sports.officialLinks.some(link => link.url.includes('sports.php')));

    const cultural = await ask('What cultural events and annual gatherings take place?');
    assert.equal(cultural.evidence[0]?.id, 'KB-48');
    assert.match(cultural.answer, /Annual Cultural Gathering/i);
    assert.match(cultural.answer, /Shiv Jayanti/i);
    assert.ok(cultural.officialLinks.some(link => link.url.includes('cultural-events.php')));

    const polyCourses = await ask('What polytechnic diploma courses are offered under MSBTE?');
    assert.equal(polyCourses.evidence[0]?.id, 'KB-12');
    assert.match(polyCourses.answer, /MSBTE/i);
    assert.match(polyCourses.answer, /Computer Science & Engineering/i);
    assert.match(polyCourses.answer, /Civil Engineering/i);
    assert.match(polyCourses.answer, /Mechanical Engineering/i);
    assert.match(polyCourses.answer, /Electronic & Telecom Engineering/i);
    assert.match(polyCourses.answer, /60/);
    assert.ok(polyCourses.officialLinks.some(link => link.url.includes('fy-polytechnic.php')));
    assert.ok(polyCourses.officialLinks.some(link => link.url.includes('msbte.org.in')));

    const polyEligibility = await ask('What is the eligibility for polytechnic diploma at MITCORER?');
    assert.equal(polyEligibility.evidence[0]?.id, 'KB-12');
    assert.match(polyEligibility.answer, /10th Standard \(SSC\)/i);
    assert.match(polyEligibility.answer, /35%/);

    const workshop = await ask('What facilities are available in the central workshop at MITCORER?');
    assert.equal(workshop.evidence[0]?.id, 'KB-49');
    assert.match(workshop.answer, /Machine Shop/i);
    assert.match(workshop.answer, /Fitting Shop/i);
    assert.match(workshop.answer, /Welding Shop/i);
    assert.match(workshop.answer, /Carpentry Shop/i);
    assert.ok(workshop.officialLinks.some(link => link.url.includes('workshops.php')));

    const computingAndSeminar = await ask('Tell me about the central computing center and seminar halls');
    assert.equal(computingAndSeminar.evidence[0]?.id, 'KB-49');
    assert.match(computingAndSeminar.answer, /100\+/i);
    assert.match(computingAndSeminar.answer, /audio-visual/i);
    assert.ok(computingAndSeminar.officialLinks.some(link => link.url.includes('computer-center.php')));
    assert.ok(computingAndSeminar.officialLinks.some(link => link.url.includes('seminar-hall.php')));
  } finally {
    closeDb();
    if (path.dirname(directory) !== path.resolve(os.tmpdir()) || !path.basename(directory).startsWith('mitra-query-test-')) throw new Error('Unsafe cleanup path');
    fs.rmSync(directory, { recursive: true, force: true });
  }
});
