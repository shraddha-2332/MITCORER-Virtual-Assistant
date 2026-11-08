import test from 'node:test';
import assert from 'node:assert/strict';
import { config } from '../src/config.js';
import { resetDbForTests, closeDb, getDb } from '../src/store.js';
import { beforeEach, afterEach } from 'node:test';
import { publicSessionHash } from '../src/public-session.js';
const session = 'a'.repeat(64);

beforeEach(() => { config.databaseFile = ':memory:'; resetDbForTests(); });
afterEach(() => closeDb());
import {
  extractConversationContext,
  resolveConversationalQuestion,
  askPublicWithHistory,
} from '../src/conversations.js';

test('extractConversationContext detects gender and route alongside category and branch', () => {
  const context = extractConversationContext('I am a girl looking for DSE admission in Computer Engineering');
  assert.equal(context.gender, 'girls');
  assert.equal(context.route, 'DSE');
  assert.equal(context.branch, 'Computer Engineering');
  assert.equal(context.lastTopic, 'admission');
});

test('resolveConversationalQuestion returns standalone question unchanged', () => {
  const chat = { messages: [{ type: 'user', text: 'Tell me about MITCORER Barshi' }] };
  const q = 'What is the full intake and branch list at MITCORER campus?';
  const resolved = resolveConversationalQuestion(q, chat, {});
  assert.equal(resolved, q);
});

test('resolveConversationalQuestion resolves fee follow-ups with branch context', () => {
  const chat = { messages: [{ type: 'user', text: 'Tell me about Computer Engineering' }] };
  const context = { branch: 'Computer Engineering', lastTopic: 'fees' };

  // Follow-up 1: "what are the fees?"
  const resolvedFee = resolveConversationalQuestion('what are the fees?', chat, context);
  assert.equal(resolvedFee, 'what are the fees (Computer Engineering)?');

  // Follow-up 2: "any concession for girls?"
  const resolvedGirls = resolveConversationalQuestion('any concession for girls?', chat, context);
  assert.equal(resolvedGirls, 'any concession for girls (Computer Engineering)?');

  // Follow-up 3: "What about OBC girls?" preserves both category and gender slots
  const resolvedObcGirls = resolveConversationalQuestion('What about OBC girls?', chat, { ...context, category: 'OBC' });
  assert.equal(resolvedObcGirls, 'What about OBC girls (engineering fees Computer Engineering)?');
});

test('resolveConversationalQuestion resolves intake and cutoff follow-ups', () => {
  const chat = { messages: [{ type: 'user', text: 'Tell me about AI & Data Science' }] };
  const context = { branch: 'AI & Data Science' };

  const resolvedIntake = resolveConversationalQuestion('what is the intake?', chat, context);
  assert.equal(resolvedIntake, 'what is the intake for AI & Data Science?');

  const resolvedCutoff = resolveConversationalQuestion('what was the cutoff?', chat, context);
  assert.equal(resolvedCutoff, 'what was the cutoff for AI & Data Science?');
});

test('branch-change follow-up keeps the intake intent and replaces the previous branch', () => {
  const chat = { messages: [{ type: 'user', text: 'What is the intake for CSE?' }] };
  const firstContext = extractConversationContext('What is the intake for CSE?');
  assert.equal(firstContext.lastTopic, 'intake');
  const nextContext = extractConversationContext('What about Civil?', firstContext);
  assert.equal(nextContext.branch, 'Civil Engineering');
  assert.equal(nextContext.lastTopic, 'intake');
  assert.equal(resolveConversationalQuestion('What about Civil?', chat, nextContext), 'What is the intake for Civil Engineering?');
});

test('branch extraction distinguishes Electronics and Computer from E&TC', () => {
  assert.equal(extractConversationContext('What is the intake for Electronics and Computer Engineering?').branch, 'Electronics and Computer Engineering');
  assert.equal(extractConversationContext('What is the intake for Electronics and Telecommunication Engineering?').branch, 'Electronics & Telecommunication');
});

test('generic cutoff follow-up does not inherit branch from a different topic', () => {
  const chat = { messages: [{ type: 'user', text: 'Tell me about CSE laboratories' }] };
  const context = { branch: 'Computer Science and Engineering', lastTopic: 'facilities' };
  assert.equal(resolveConversationalQuestion('what was the cutoff?', chat, context), 'what was the cutoff?');
});
test('branch changes retain cutoff and HOD intent and carry a prior year', () => {
  const chat = { messages: [{ type: 'user', text: 'What was the cutoff for CSE in 2025-26?' }] };
  const context = extractConversationContext('What about Civil?', { academicYear: '2025-26' });
  assert.equal(resolveConversationalQuestion('What about Civil?', chat, context), 'What is the cutoff for Civil Engineering for 2025-26?');
  const hodChat = { messages: [{ type: 'user', text: 'Who is the HOD of CSE?' }] };
  assert.equal(resolveConversationalQuestion('What about Civil?', hodChat, extractConversationContext('What about Civil?')), 'Who is the HOD of Civil Engineering?');
});

test('service follow-up after a fee question keeps the fee intent but respects availability questions', () => {
  const chat = { messages: [{ type: 'user', text: 'What are academic fees for AY 2026-27?' }] };
  const context = { academicYear: '2026-27', lastTopic: 'fees' };
  assert.equal(resolveConversationalQuestion('What about hostel?', chat, context), 'What are the hostel fees for 2026-27?');
  assert.equal(resolveConversationalQuestion('What about hostel availability?', chat, context), 'What about hostel availability?');
});

test('resolveConversationalQuestion resolves hostel follow-ups without confusing with academic fees', () => {
  const chat = { messages: [{ type: 'user', text: 'Tell me about the hostel facility' }] };
  const context = { lastTopic: 'hostel' };

  const resolvedMess = resolveConversationalQuestion('is mess included?', chat, context);
  assert.equal(resolvedMess, 'Hostel inquiry: is mess included?');

  const resolvedHostelFees = resolveConversationalQuestion('hostel fees?', chat, context);
  assert.equal(resolvedHostelFees, 'hostel fees?');
});

test('askPublicWithHistory maintains multi-turn context across turns', async () => {
  let recordedQuestions = [];
  const mockAnswer = async ({ question, context }) => {
    recordedQuestions.push(question);
    return {
      answer: `Answer for: ${question}`,
      source: 'Mock Source',
    };
  };

  // Turn 1: Ask about Computer Engineering
  const res1 = await askPublicWithHistory({ question: 'Tell me about Computer Engineering' }, mockAnswer, session);
  assert.ok(res1.conversationId);
  assert.equal(res1.context.branch, 'Computer Engineering');

  // Turn 2: Follow-up asking about fees
  const res2 = await askPublicWithHistory({
    question: 'what are the fees?',
    conversationId: res1.conversationId,
  }, mockAnswer, session);

  assert.equal(res2.conversationId, res1.conversationId);
  assert.ok(recordedQuestions.some((q) => q.includes('Computer Engineering')));
});

test('public contextual rewrites preserve the language selected from the original follow-up', async () => {
  const seen = [];
  const mockAnswer = async ({ question, language }) => {
    seen.push({ question, language });
    return { answer: 'test answer', source: 'Mock Source' };
  };
  const first = await askPublicWithHistory({ question: 'What is the intake for CSE?' }, mockAnswer, session);
  await askPublicWithHistory({ question: 'What about Civil? Answer in Marathi.', conversationId: first.conversationId }, mockAnswer, session);
  assert.equal(seen[1].question, 'What is the intake for Civil Engineering?');
  assert.equal(seen[1].language, 'mr');
});

test('fee enrichment preserves original qualifiers and explicit exclusions', () => {
  const chat = { messages: [{ type: 'user', text: 'fees' }] };
  const context = { category: 'OBC', gender: 'girls', route: 'DSE', academicYear: '2026-27', lastTopic: 'fees' };
  for (const question of ['DSE semester fees?', 'fees for 2025-26?', 'fees for 2026-29?', 'first year fees?']) {
    const result = resolveConversationalQuestion(question, chat, context);
    assert.ok(result.startsWith(question.replace(/\?$/, '')));
    if (/2025|2026-29/.test(question)) assert.doesNotMatch(result, /2026-27/);
    if (/first year/.test(question)) assert.doesNotMatch(result, /DSE/);
  }
  assert.equal(resolveConversationalQuestion('not OBC fees', chat, context), 'not OBC fees');
});

test('public conversations reject further turns at the message bound without invoking the answer engine', async () => {
  getDb().conversations.push({ id: 'FULL', ownerId: 'public', publicSessionHash: publicSessionHash(session), expiresAt: new Date(Date.now()+60000).toISOString(), messages: Array(200).fill({ type: 'user', text: 'fees' }) });
  let called = false;
  await assert.rejects(askPublicWithHistory({ question: 'fees?', conversationId: 'FULL' }, async () => { called = true; }, session), /conversation is full/);
  assert.equal(called, false);
});

test('excluded profile values are cleared and explicit topic changes preserve their question', () => {
  const previous = { category: 'OBC', gender: 'girls', branch: 'Computer Engineering', route: 'DSE', lastTopic: 'fees' };
  const next = extractConversationContext('not OBC, not girls', previous);
  assert.equal(next.category, undefined);
  assert.equal(next.gender, undefined);
  const chat = { messages: [{ type: 'user', text: 'fees' }] };
  assert.equal(resolveConversationalQuestion('Tell me about the library.', chat, previous), 'Tell me about the library.');
  assert.equal(resolveConversationalQuestion('What is the 2025-26 intake?', chat, previous), 'What is the 2025-26 intake for Computer Engineering?');
});

