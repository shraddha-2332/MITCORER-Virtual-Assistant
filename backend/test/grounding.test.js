import test from 'node:test';
import assert from 'node:assert/strict';
import {
  extractFactualTokens,
  detectUnauthorizedClaims,
  extractEvidenceTokens,
  verifyGeneratedAnswer,
  classifyAnswerOutcome,
  verifySlotGrounding,
} from '../src/grounding.js';

test('extractFactualTokens identifies fees, years, percentages, choice codes, and dates', () => {
  const text = 'First Year Engineering Open fee is INR 1,05,000 for AY 2026-27 with choice code 0690124210. Minimum PCM requirement is 45% or 40 percent for reserved candidates. Document verification ends on 30 June 2026.';
  const tokens = extractFactualTokens(text);

  assert.ok(tokens.numbers.has('105000'));
  assert.ok(tokens.academicYears.has('2026-27'));
  assert.ok(tokens.choiceCodes.has('0690124210'));
  assert.ok(tokens.percentages.has('45'));
  assert.ok(tokens.percentages.has('40'));
  assert.ok(tokens.dates.has('30 june 2026'));
});

test('detectUnauthorizedClaims flags promissory and guarantee statements', () => {
  const safeText = 'Eligibility requires 45% marks in PCM. Meeting eligibility allows CAP participation but does not guarantee admission.';
  const prohibited1 = 'You will get guaranteed admission in Computer Science once you apply.';
  const prohibited2 = 'The college provides 100% placement guaranteed for all branches.';

  assert.strictEqual(detectUnauthorizedClaims(safeText).hasViolation, false);
  assert.strictEqual(detectUnauthorizedClaims(prohibited1).hasViolation, true);
  assert.strictEqual(detectUnauthorizedClaims(prohibited2).hasViolation, true);
});

test('verifyGeneratedAnswer accepts generations strictly grounded in evidence', () => {
  const evidence = [
    {
      id: 'KB-2',
      title: 'MITCORER fees AY 2026-27',
      source: 'Approved fee records AY 2026-27',
      text: 'First Year Engineering fees for AY 2026-27 include Open total INR 1,05,000 and SC ST INR 8,000.',
      facts: {
        kind: 'academicFees',
        academicYear: '2026-27',
        firstYear: { open: 105000, scst: 8000 },
      },
    },
  ];

  const validGeneration = 'For AY 2026-27, the Open category First Year fee is INR 1,05,000, while SC and ST candidates pay INR 8,000.';
  const result = verifyGeneratedAnswer(validGeneration, evidence);

  assert.strictEqual(result.verified, true);
  assert.strictEqual(result.status, 'VERIFIED');
});

test('verifyGeneratedAnswer rejects an abstention marker even when it appears after generated prose', () => {
  const evidence = [{ id: 'KB-24', title: 'Placement', text: 'Placement cell supports training.' }];
  const result = verifyGeneratedAnswer('The placement cell supports students. INSUFFICIENT_EVIDENCE', evidence);
  assert.deepEqual(result, { verified: false, status: 'INSUFFICIENT_EVIDENCE' });
});

test('verifyGeneratedAnswer rejects generations with hallucinated numbers, dates, or fees', () => {
  const evidence = [
    {
      id: 'KB-2',
      title: 'MITCORER fees AY 2026-27',
      source: 'Approved fee records AY 2026-27',
      text: 'First Year Engineering fees for AY 2026-27 include Open total INR 1,05,000.',
    },
  ];

  // Hallucinated fee: INR 1,20,000 instead of 1,05,000
  const hallucinatedFee = 'The Open category First Year fee is INR 1,20,000 for AY 2026-27.';
  const resultFee = verifyGeneratedAnswer(hallucinatedFee, evidence);

  assert.strictEqual(resultFee.verified, false);
  assert.strictEqual(resultFee.status, 'UNSUPPORTED_FACTUAL_CLAIMS');
  assert.ok(resultFee.unsupported.some((u) => u.value === '120000'));

  // Hallucinated deadline date
  const hallucinatedDate = 'The Open category First Year fee is INR 1,05,000 and reporting deadline is 15 August 2026.';
  const resultDate = verifyGeneratedAnswer(hallucinatedDate, evidence);

  assert.strictEqual(resultDate.verified, false);
  assert.strictEqual(resultDate.status, 'UNSUPPORTED_FACTUAL_CLAIMS');
  assert.ok(resultDate.unsupported.some((u) => u.type === 'date'));
});

test('verifyGeneratedAnswer rejects promissory promises even if numbers match', () => {
  const evidence = [
    {
      id: 'KB-5',
      title: 'Eligibility criteria',
      source: 'Official circular',
      text: 'Minimum marks required are 45% in PCM for Open candidates in AY 2026-27.',
    },
  ];

  const promissoryAnswer = 'With 45% in PCM in AY 2026-27, you have guaranteed admission in CSE.';
  const result = verifyGeneratedAnswer(promissoryAnswer, evidence);

  assert.strictEqual(result.verified, false);
  assert.strictEqual(result.status, 'PROMISSORY_CLAIM_REJECTED');
});

test('classifyAnswerOutcome assigns correct categories for trustworthiness reporting', () => {
  // 1. Normal answered query
  const answered = classifyAnswerOutcome(
    { source: 'Approved fee records', answer: 'Open fee is INR 1,05,000.' },
    [{ id: 'KB-2', status: 'Published', text: 'Open fee is INR 1,05,000.' }]
  );
  assert.strictEqual(answered, 'ANSWERED');

  // 2. Insufficient evidence
  const insufficient = classifyAnswerOutcome(
    { source: 'No verified record', answer: 'I could not find an official answer.' },
    []
  );
  assert.strictEqual(insufficient, 'INSUFFICIENT_EVIDENCE');

  // 3. Conflicting evidence
  const conflicting = classifyAnswerOutcome(
    { conflict: true, source: 'Conflicting published records', answer: 'Records disagree.' },
    [{ id: 'KB-2', status: 'Published' }]
  );
  assert.strictEqual(conflicting, 'CONFLICTING_EVIDENCE');

  // 4. Outdated / expired evidence
  const outdated = classifyAnswerOutcome(
    { source: 'Old notice', answer: 'Old fee' },
    [{ id: 'KB-OLD', status: 'Published', provenance: { validUntil: '2020-01-01' } }],
    Date.parse('2026-10-12T00:00:00.000Z')
  );
  assert.strictEqual(outdated, 'OUTDATED_EVIDENCE');

  // 5. Clarification required
  const clarifying = classifyAnswerOutcome(
    { clarification: true, source: 'Clarification required', answer: 'Which branch?' },
    []
  );
  assert.strictEqual(clarifying, 'INSUFFICIENT_EVIDENCE');
});

test('verifyGeneratedAnswer validates intake capacities, helplines, and institute codes', () => {
  const evidence = [
    {
      id: 'KB-10',
      title: 'B.Tech Engineering Programmes and Intake',
      source: 'Approved intake list AY 2026-27',
      text: 'Civil Engineering has an intake of 60 seats. For inquiries contact +91 84599 67882. DTE Code is 06901.',
      facts: {
        kind: 'programList',
        programs: [{ name: 'Civil Engineering', intake: 60, choiceCode: '0690119110' }],
      },
    },
  ];

  // Valid grounded answer
  const valid = 'Civil Engineering offers an intake of 60 seats under DTE Code 06901. For help call 8459967882.';
  const validRes = verifyGeneratedAnswer(valid, evidence);
  assert.strictEqual(validRes.verified, true);
  assert.strictEqual(validRes.status, 'VERIFIED');

  // Hallucinated intake (300 seats)
  const fakeIntake = 'Civil Engineering has an intake of 300 seats for AY 2026-27.';
  const fakeIntakeRes = verifyGeneratedAnswer(fakeIntake, evidence);
  assert.strictEqual(fakeIntakeRes.verified, false);
  assert.strictEqual(fakeIntakeRes.status, 'UNSUPPORTED_FACTUAL_CLAIMS');
  assert.ok(fakeIntakeRes.unsupported.some((u) => u.type === 'intake'));

  // Hallucinated helpline number
  const fakePhone = 'Civil Engineering intake is 60 seats. Contact 9999999999.';
  const fakePhoneRes = verifyGeneratedAnswer(fakePhone, evidence);
  assert.strictEqual(fakePhoneRes.verified, false);
  assert.strictEqual(fakePhoneRes.status, 'UNSUPPORTED_FACTUAL_CLAIMS');
  assert.ok(fakePhoneRes.unsupported.some((u) => u.type === 'helpline'));

  // Hallucinated institute code
  const fakeDte = 'Civil Engineering intake is 60 seats with DTE Code 1234.';
  const fakeDteRes = verifyGeneratedAnswer(fakeDte, evidence);
  assert.strictEqual(fakeDteRes.verified, false);
  assert.strictEqual(fakeDteRes.status, 'UNSUPPORTED_FACTUAL_CLAIMS');
  assert.ok(fakeDteRes.unsupported.some((u) => u.type === 'instituteCode'));
});



test('verifySlotGrounding detects wrong-row tabular errors missed by token-level verification', () => {
  const evidence = [
    {
      id: 'KB-2',
      title: 'Engineering fees AY 2026-27',
      source: 'Approved fee records AY 2026-27',
      text: 'First Year Engineering fees for AY 2026-27: Open INR 1,05,000, OBC boys INR 61,109, OBC girls INR 17,217, SC ST INR 8,000.',
      facts: {
        kind: 'academicFees',
        academicYear: '2026-27',
        firstYear: {
          open: 105000,
          concessionBoy: 61109,
          concessionGirl: 17217,
          vjnt: 17217,
          scst: 8000,
        },
      },
    },
    {
      id: 'KB-3',
      title: 'Accommodation fees AY 2026-27',
      text: 'Hostel fee is INR 35,000 with refundable deposit INR 5,000 and mess charges INR 42,000.',
      facts: {
        kind: 'accommodationFees',
        academicYear: '2026-27',
        hostel: 35000,
        refundableDeposit: 5000,
        messAnnual: 42000,
      },
    },
    {
      id: 'KB-10',
      title: 'Approved program intake AY 2026-27',
      text: 'Computer Science and Engineering intake is 120 seats. Mechanical and Rail Engineering intake is 60 seats.',
      facts: {
        kind: 'programIntake',
        academicYear: '2026-27',
        programs: [
          { name: 'Computer Science and Engineering', intake: 120 },
          { name: 'Mechanical and Rail Engineering', intake: 60 },
        ],
      },
    },
  ];

  // 1. Correct slot matching: OBC girl query with 17,217 passes slot verification
  const correctSlotAnswer = 'For OBC category girl students, the First Year Engineering fee is INR 17,217 for AY 2026-27.';
  const correctRes = verifySlotGrounding(correctSlotAnswer, { category: 'OBC', gender: 'female' }, evidence);
  assert.strictEqual(correctRes.verified, true);
  assert.strictEqual(correctRes.status, 'SLOT_VERIFIED');

  // 2. Wrong-row error: Token-level verifier sees 61,109 in evidence and falsely passes,
  // but verifySlotGrounding catches the slot mismatch
  const wrongRowAnswer = 'For OBC girl students, the First Year Engineering fee is INR 61,109 for AY 2026-27.';
  const tokenLevelRes = verifyGeneratedAnswer(wrongRowAnswer, evidence);
  assert.strictEqual(tokenLevelRes.verified, true); // Token-level passes! (False positive)

  const slotLevelRes = verifySlotGrounding(wrongRowAnswer, { category: 'OBC', gender: 'female' }, evidence);
  assert.strictEqual(slotLevelRes.verified, false);
  assert.strictEqual(slotLevelRes.status, 'WRONG_SLOT_ERROR');
  assert.strictEqual(slotLevelRes.expected, 17217);
  assert.deepStrictEqual(slotLevelRes.found, ['61109']);

  // 3. Accommodation wrong-slot error: Student asks for mess fees, but response quotes hostel fee
  const wrongMessAnswer = 'The annual mess fee for hostel students is INR 35,000 for AY 2026-27.';
  const messSlotRes = verifySlotGrounding(wrongMessAnswer, { service: 'mess' }, evidence);
  assert.strictEqual(messSlotRes.verified, false);
  assert.strictEqual(messSlotRes.status, 'WRONG_SLOT_ERROR');
  assert.strictEqual(messSlotRes.expected, 42000);
  assert.deepStrictEqual(messSlotRes.found, ['35000']);

  // 4. Program intake wrong-slot error: CSE query quotes 60 seats (which belongs to Mechanical)
  const wrongCseIntake = 'The approved intake for Computer Science and Engineering is 60 seats.';
  const intakeSlotRes = verifySlotGrounding(wrongCseIntake, { branch: 'Computer Science and Engineering' }, evidence);
  assert.strictEqual(intakeSlotRes.verified, false);
  assert.strictEqual(intakeSlotRes.status, 'WRONG_SLOT_ERROR');
  assert.strictEqual(intakeSlotRes.expected, 120);
  assert.deepStrictEqual(intakeSlotRes.found, ['60']);

  // 5. TFWS Quota check: Boy student under TFWS quota expects 17,217 (100% tuition waiver)
  const tfwsAnswer = 'For TFWS quota, First Year total fees are INR 17,217.';
  const tfwsRes = verifySlotGrounding(tfwsAnswer, { quota: 'TFWS', gender: 'male' }, evidence);
  assert.strictEqual(tfwsRes.verified, true);
  assert.strictEqual(tfwsRes.status, 'SLOT_VERIFIED');

  // 6. Direct Second Year (DSE) route check: DSE facts in evidence
  const dseEvidence = [
    {
      id: 'KB-2',
      facts: {
        kind: 'academicFees',
        academicYear: '2026-27',
        firstYear: { open: 105000, concessionBoy: 61109, concessionGirl: 17217, scst: 8000 },
        directSecondYear: { open: 98000, concessionBoy: 58181, concessionGirl: 18362, scst: 10000 },
      },
      text: 'For AY 2026-27: First Year Open INR 1,05,000, OBC Boy INR 61,109. DSE Open INR 98,000, OBC Boy INR 58,181.',
    },
  ];
  const dseWrongAnswer = 'For DSE admission, OBC boy fee is INR 61,109 for AY 2026-27.';
  const dseWrongRes = verifySlotGrounding(dseWrongAnswer, { category: 'OBC', gender: 'male', route: 'dse' }, dseEvidence);
  assert.strictEqual(dseWrongRes.verified, false);
  assert.strictEqual(dseWrongRes.status, 'WRONG_SLOT_ERROR');
  assert.strictEqual(dseWrongRes.expected, 58181);

  // 7. Legitimate multi-row answer: Citing both Open (1,05,000) and target OBC girl (17,217) does NOT trip error
  const multiRowAnswer = 'Open category fee is INR 1,05,000, but for OBC girls the fee is INR 17,217 with tuition concession.';
  const multiRowRes = verifySlotGrounding(multiRowAnswer, { category: 'OBC', gender: 'female' }, evidence);
  assert.strictEqual(multiRowRes.verified, true);
  assert.strictEqual(multiRowRes.status, 'SLOT_VERIFIED');
});

test('attribution rejects mixed swapped labels while preserving explicitly correct comparisons', () => {
  const evidence = [{ id: 'KB-2', text: 'OBC girls INR 17,217, boys INR 61,109.', facts: { kind: 'academicFees', academicYear: '2026-27', firstYear: { concessionGirl: 17217, concessionBoy: 61109 } } }];
  const slots = { category: 'OBC', gender: 'girls', route: 'First Year' };
  assert.equal(verifySlotGrounding('OBC girls pay INR 61,109 and OBC boys pay INR 17,217.', slots, evidence).verified, false);
  assert.equal(verifySlotGrounding('OBC girls pay INR 17,217 and OBC boys pay INR 61,109.', slots, evidence).verified, true);
  assert.equal(verifyGeneratedAnswer('An additional fee is INR 500.', evidence).verified, false);
  assert.equal(verifyGeneratedAnswer('The fee is INR 17,217 [99].', evidence).status, 'INVALID_CITATION');
  assert.equal(verifyGeneratedAnswer('The fee is INR 17,217 [KB-UNKNOWN].', evidence).status, 'INVALID_CITATION');
  assert.equal(verifyGeneratedAnswer('The fee is INR 17,217.', [{ ...evidence[0], status: 'Retired' }]).status, 'UNAVAILABLE_EVIDENCE');
});
