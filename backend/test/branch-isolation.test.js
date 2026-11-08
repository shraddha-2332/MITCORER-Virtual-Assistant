import assert from 'node:assert/strict';
import { beforeEach, test } from 'node:test';
import { createServer, resetRuntimeStateForTests, answerAdmissionQuestion } from '../src/server.js';
import { askPublicWithHistory, resetPublicConversation } from '../src/conversations.js';
import { resetDbForTests } from '../src/store.js';
import { createSeedData } from '../src/seed.js';

beforeEach(() => {
  resetRuntimeStateForTests();
  resetDbForTests(createSeedData());
});

test('civil branch HOD query returns only Prof. Amit Shinde and never other departments', async () => {
  const result = await answerAdmissionQuestion({ question: 'who is the HOD of civil department' });
  const ans = result.answer;

  assert.match(ans, /Prof\. Amit Raosaheb Shinde/i);
  assert.match(ans, /Civil Engineering/i);
  assert.doesNotMatch(ans, /Mechanical/i);
  assert.doesNotMatch(ans, /Computer Science|CSE/i);
  assert.doesNotMatch(ans, /Sanjay Mane/i);
  assert.doesNotMatch(ans, /Somnath Mule/i);
});

test('mechanical branch HOD query returns only Dr. Sanjay Mane and never other departments', async () => {
  const result = await answerAdmissionQuestion({ question: 'who is the HOD of Mechanical department' });
  const ans = result.answer;

  assert.match(ans, /Dr\. Sanjay Pandurang Mane/i);
  assert.match(ans, /Mechanical/i);
  assert.doesNotMatch(ans, /Civil/i);
  assert.doesNotMatch(ans, /Computer Science|CSE/i);
  assert.doesNotMatch(ans, /Amit Shinde/i);
  assert.doesNotMatch(ans, /Somnath Mule/i);
});

test('E&TC HOD query returns Prof. Deepali Mali without unrelated departments', async () => {
  const result = await answerAdmissionQuestion({ question: 'Who is the HOD of Electronics and Telecommunication Engineering?' });
  assert.match(result.answer, /Prof\. Mrs\. Deepali Gajanan Mali/i);
  assert.match(result.answer, /Electronics and Telecommunication|E&TC/i);
  assert.doesNotMatch(result.answer, /Somnath Mule|Amit Raosaheb Shinde|Sanjay Pandurang Mane/i);
});

test('civil engineering labs query returns civil laboratories and never other branches', async () => {
  const result = await answerAdmissionQuestion({ question: 'civil engineering labs' });
  const ans = result.answer;

  assert.match(ans, /Civil Engineering Laboratories/i);
  assert.match(ans, /Strength of Materials Lab/i);
  assert.match(ans, /Surveying Lab/i);
  assert.match(ans, /Concrete Technology Lab/i);
  assert.doesNotMatch(ans, /Mechanical/i);
  assert.doesNotMatch(ans, /Robotics Lab/i);
  assert.doesNotMatch(ans, /High-Performance Computing/i);
});

test('cutoff answers require a matching published scope and never substitute branch or year', async () => {
  const ambiguous = await answerAdmissionQuestion({ question: 'what is the cutoff for civil branch' });
  assert.equal(ambiguous.evidence.length, 0);
  assert.match(ambiguous.answer, /academic year|CAP Round I|All India seat type|JEE Main/i);
  assert.doesNotMatch(ambiguous.answer, /0690119110|42429|56892/);

  const unsupportedBranch = await answerAdmissionQuestion({ question: 'What was the 2025 All India JEE Main cutoff for Civil Engineering CAP Round I?' });
  assert.equal(unsupportedBranch.evidence.length, 0);
  assert.equal(unsupportedBranch.outcomeStatus, 'INSUFFICIENT_EVIDENCE');
  assert.match(unsupportedBranch.answer, /could not find a verified 2025 civil/i);
  assert.doesNotMatch(unsupportedBranch.answer, /CSE|42429|56892|0690119110/);
  assert.ok(unsupportedBranch.officialLinks.some(link => link.url.includes('fe2024.mahacet.org')));

  const unspecified = await answerAdmissionQuestion({ question: 'What are the historical cutoffs?' });
  assert.equal(unspecified.evidence.length, 0);
  assert.match(unspecified.answer, /branch|academic year/i);
  assert.doesNotMatch(unspecified.answer, /42429|56892/);
  const intake = await answerAdmissionQuestion({ question: 'civil engineering intake' });
  assert.match(intake.answer, /Civil Engineering/i);
  assert.match(intake.answer, /intake 60/i);
  assert.doesNotMatch(intake.answer, /Mechanical/i);
  assert.doesNotMatch(intake.answer, /120/);
});

test('principal inquiry returns only the Principal and nothing extra', async () => {
  const result = await answerAdmissionQuestion({ question: 'who is the principal' });
  assert.match(result.answer, /Dr\. Madhukar J\. Lengare/i);
  assert.doesNotMatch(result.answer, /DTE Institute Code/i);
  assert.doesNotMatch(result.answer, /Affiliation/i);
});

test('multi-turn conversation preserves civil branch context and never leaks other departments', async () => {
  const sessionToken = 'c'.repeat(64);
  const turn1 = await askPublicWithHistory(
    { question: 'tell me about civil branch' },
    answerAdmissionQuestion,
    sessionToken
  );
  assert.match(turn1.answer, /Prof\. Amit Raosaheb Shinde/i);
  assert.doesNotMatch(turn1.answer, /Mechanical/i);
  assert.doesNotMatch(turn1.answer, /Somnath Mule/i);

  const convId = turn1.conversationId;

  const turn2 = await askPublicWithHistory(
    { question: 'who is the HOD?', conversationId: convId },
    answerAdmissionQuestion,
    sessionToken
  );
  assert.match(turn2.answer, /Prof\. Amit Raosaheb Shinde/i);
  assert.doesNotMatch(turn2.answer, /Mechanical/i);
  assert.doesNotMatch(turn2.answer, /Sanjay Mane/i);
  assert.doesNotMatch(turn2.answer, /Somnath Mule/i);

  const turn3 = await askPublicWithHistory(
    { question: 'what are the labs?', conversationId: convId },
    answerAdmissionQuestion,
    sessionToken
  );
  assert.match(turn3.answer, /Civil Engineering Laboratories/i);
  assert.match(turn3.answer, /Strength of Materials/i);
  assert.doesNotMatch(turn3.answer, /Mechanical/i);
  assert.doesNotMatch(turn3.answer, /Robotics Lab/i);
});

test('public branch follow-up answers the original intake question for the new branch', async () => {
  const sessionToken = 'd'.repeat(64);
  const first = await askPublicWithHistory({ question: 'What is the intake for CSE?' }, answerAdmissionQuestion, sessionToken);
  assert.match(first.answer, /intake 120/i);
  const followup = await askPublicWithHistory({ question: 'What about Civil?', conversationId: first.conversationId }, answerAdmissionQuestion, sessionToken);
  assert.match(followup.answer, /Civil Engineering has sanctioned intake 60/i);
  assert.doesNotMatch(followup.answer, /Computer Science|CSE|intake 120/i);
});

test('public E&TC intake follow-up resolves HOD to Prof. Deepali Mali only', async () => {
  const sessionToken = 'e'.repeat(64);
  const first = await askPublicWithHistory({
    question: 'what is the intake of Electronics and Telecommunication Engineering',
  }, answerAdmissionQuestion, sessionToken);
  assert.match(first.answer, /Electronics and Telecommunication Engineering has sanctioned intake 60/i);

  const followup = await askPublicWithHistory({
    question: 'who is the HOD there?',
    conversationId: first.conversationId,
  }, answerAdmissionQuestion, sessionToken);
  assert.match(followup.answer, /Prof\. Mrs\. Deepali Gajanan Mali/i);
  assert.match(followup.answer, /Electronics and Telecommunication|E&TC/i);
  assert.doesNotMatch(followup.answer, /Somnath Mule|Amit Raosaheb Shinde|Sanjay Pandurang Mane/i);
  assert.equal(followup.source, 'MITCORER Electronics & Telecommunication Engineering department portal');
  assert.deepEqual(followup.officialLinks.map(link => link.url), [
    'https://mitcorer.edu.in/mitcorer/public/department/electronic-telecommunication-engineering/faculty',
  ]);
  assert.equal(followup.evidence[0].id, 'KB-52');
  resetPublicConversation(first.conversationId, sessionToken);
});

