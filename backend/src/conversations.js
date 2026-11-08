import { getDb, saveDb } from './store.js';
import { badRequest, notFound } from './errors.js';
import { generateId, nowIso, pick } from './utils.js';
import { understandQuery } from './query-understanding.js';
import { selectLanguage } from './language.js';
import { config } from './config.js';
import { publicSessionHash } from './public-session.js';

const summary = (chat) => pick(chat, ['id', 'title', 'createdAt', 'updatedAt']);
const withScope = (question, scope) => `${question.replace(/[?।]+$/u, '').trim()} ${scope}${/[?।]$/u.test(question) ? '?' : ''}`;

export function getConversation(id, user) {
  const chat = getDb().conversations.find((item) => item.id === id && item.ownerId === user.id);
  if (!chat) throw notFound('Conversation not found.');
  return chat;
}

export function listConversations(user, offsetValue) {
  const offset = Number(offsetValue || 0);
  if (!Number.isSafeInteger(offset) || offset < 0) throw badRequest('Invalid history offset.');
  const chats = getDb().conversations.filter((item) => item.ownerId === user.id)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  return { items: chats.slice(offset, offset + 30).map(summary), hasMore: chats.length > offset + 30 };
}

export function extractConversationContext(text, existingContext = {}) {
  const norm = String(text || '').normalize('NFKC').toLocaleLowerCase();
  const context = { ...(existingContext || {}) };
  const query = understandQuery(text);
  if (query.academicYears.length === 1 && !query.invalidYears.length) {
    context.academicYear = query.academicYears[0];
  } else if (query.academicYears.length || query.invalidYears.length) {
    delete context.academicYear;
  }

  // Category identification
  if (/\b(?:sc|scheduled caste)\b/.test(norm)) {
    context.category = 'SC';
  } else if (/\b(?:st|scheduled tribe)\b/.test(norm)) {
    context.category = 'ST';
  } else if (/\b(?:vjnt|vj\/?nt|nt-[abcd]|nt[abcd])\b/.test(norm)) {
    context.category = 'VJNT';
  } else if (/\b(?:sbc|special backward class)\b/.test(norm)) {
    context.category = 'SBC';
  } else if (/\b(?:obc|other backward class)\b/.test(norm)) {
    context.category = 'OBC';
  } else if (/\b(?:ebc|ews|economically weaker section)\b/.test(norm)) {
    context.category = 'EWS';
  } else if (/\b(?:open category|general category)\b/.test(norm)) {
    context.category = 'Open';
  }

  // Use the same parsed branch slot as retrieval so Electronics and Computer
  // is not collapsed into Electronics and Telecommunication by a broad regex.
  const branchNames = {
    cse: 'Computer Engineering',
    civil: 'Civil Engineering',
    mechanical: 'Mechanical & Rail Engineering',
    aids: 'AI & Data Science',
    electronicsComputer: 'Electronics and Computer Engineering',
    entc: 'Electronics & Telecommunication',
  };
  if (query.branch.positive.length === 1) context.branch = branchNames[query.branch.positive[0]];
  else if (query.branch.excluded.length || query.branch.positive.length > 1) delete context.branch;

  // Quota preference
  if (/\b(?:tfws|tuition fee waiver)\b/.test(norm)) {
    context.quota = 'TFWS';
  } else if (/\b(?:cap round|cap seats?)\b/.test(norm)) {
    context.quota = 'CAP';
  } else if (/\b(?:management quota|institute level|ils)\b/.test(norm)) {
    context.quota = 'Institute Level';
  }

  // Gender identification for concessions & accommodation
  if (/\b(?:girls?|female|women|ladies)\b/.test(norm)) {
    context.gender = 'girls';
  } else if (/\b(?:boys?|male|men)\b/.test(norm)) {
    context.gender = 'boys';
  }

  // Admission route
  if (/\b(?:dse|direct second|lateral entry)\b/.test(norm)) {
    context.route = 'DSE';
  } else if (/\b(?:first year|fe|freshman)\b/.test(norm)) {
    context.route = 'First Year';
  }

  // Keep the requested fact type so a short branch change ("What about Civil?")
  // can replace the entity without losing the question being asked.
  if (/\b(?:hostel|mess|accommodation|stay|room|warden)\b/.test(norm)) {
    context.lastTopic = 'hostel';
  } else if (/\b(?:fee|fees|cost|tuition|installment|scholarship|concession)\b/.test(norm)) {
    context.lastTopic = 'fees';
  } else if (/\b(?:intake|seats?|seat matrix|capacity)\b/.test(norm)) {
    context.lastTopic = 'intake';
  } else if (/\b(?:choice code|courses?|programmes?|programs?)\b/.test(norm)) {
    context.lastTopic = 'programmes';
  } else if (/\b(?:placement|recruiter|package|salary|internship|job|career)\b/.test(norm)) {
    context.lastTopic = 'placement';
  } else if (/\b(?:cutoffs?|cut[- ]?offs?|closing percentile|closing rank|closing merit)\b/i.test(norm)) {
    context.lastTopic = 'cutoff';
  } else if (/\b(?:admission|cap|eligibility|documents?|apply|seat)\b/.test(norm)) {
    context.lastTopic = 'admission';
  } else if (/\b(?:lab|laborator|workshop|infrastructure|campus|library)\b/.test(norm)) {
    context.lastTopic = 'facilities';
  }

  // Explicit exclusions and multi-value questions do not establish a personal profile.
  for (const [field, slot] of [['category', query.category], ['gender', query.gender], ['branch', query.branch], ['route', query.route]]) {
    if (slot.excluded.length || slot.positive.length > 1) delete context[field];
  }
  if (query.category.excluded.length || query.category.mentions.length > 1) delete context.category;
  if (/\b(?:not|no|except|excluding)\s+(?:tfws|cap|management|institute)/i.test(norm)) delete context.quota;
  if (/\b(?:library|transport|bus)\b/.test(norm)
    && !/\b(?:fee|fees|cost|tuition|concession)\b/.test(norm)) context.lastTopic = 'facilities';
  return context;
}

export function resolveConversationalQuestion(question, chat, context = {}) {
  const norm = String(question || '').normalize('NFKC').toLowerCase().trim();
  if (!chat || !Array.isArray(chat.messages) || chat.messages.length === 0) {
    return question;
  }
  // A generic seat-count question is ambiguous: it may mean sanctioned
  // intake or live vacancies. Do not inherit an unrelated prior branch/topic.
  if (/\b(?:how many|number of)\b.{0,35}\bseats?\b/i.test(norm)
    && !/\b(?:intake|sanctioned|seat matrix|cutoffs?|vacanc(?:y|ies))\b/i.test(norm)) return question;
  // Do not attach a branch from a prior subject when the current message explicitly changes topic.
  const previousQuestionText = [...chat.messages].reverse().find(message => message.type === 'user')?.text || '';
  if (/\b(?:cutoffs?|cut[- ]?offs?|closing percentile|closing rank|closing merit)\b/i.test(norm)
    && !/\b(?:cutoffs?|cut[- ]?offs?|closing percentile|closing rank|closing merit)\b/i.test(previousQuestionText)
    && (!/\b(?:labs?|laborator|library|campus|facilit|infrastructure)\b/i.test(previousQuestionText) || context.lastTopic === 'facilities')
    && !(context.branch && !context.lastTopic)) return question;

  if (/\b(?:mitcorer|barshi|campus|college)\b/.test(norm) && norm.split(/\s+/).length > 8) {
    return question;
  }

  const isBareOrPronoun = /\b(?:it|this|that|there|they|them|its|same|tell me more|is it)\b/.test(norm)
    || /^(?:and|what about|how about|any|for)\b/.test(norm)
    || norm.split(/\s+/).length <= 4;
  const currentQuery = understandQuery(question);
  const previousQuestion = previousQuestionText;
  const previousNorm = previousQuestion.normalize('NFKC').toLowerCase();
  const previousTopic = /\b(?:intake|seats?|seat matrix|capacity)\b/.test(previousNorm) ? 'intake'
    : /\b(?:cutoff|cut-off|closing rank|closing percentile)\b/.test(previousNorm) ? 'cutoff'
      : /\b(?:hod|head of department|department head)\b/.test(previousNorm) ? 'hod'
        : /\b(?:labs?|laborator\w*)\b/.test(previousNorm) ? 'labs'
          : /\b(?:syllabus|curriculum)\b/.test(previousNorm) ? 'syllabus'
            : /\b(?:placement|recruiter|package|salary|internship)\b/.test(previousNorm) ? 'placement'
              : /\b(?:fee|fees|cost|tuition|installment|scholarship|concession)\b/.test(previousNorm) ? 'fees'
                : /\b(?:courses?|programmes?|programs?|choice code)\b/.test(previousNorm) ? 'programmes' : null;
  const followUpTopic = previousTopic || context.lastTopic;
  const explicitOtherTopic = currentQuery.topics.some(topic => ['library', 'transport', 'programmes', 'seatMatrix'].includes(topic))
    && !currentQuery.topics.includes('academicFees');

  // Explicit exclusions must reach the scope parser unchanged; do not reuse a negated profile.
  if (/\b(?:not|no|except|excluding|instead)\b/.test(norm)) return question;

  // Preserve a cost-comparison intent when the user swaps only the service.
  const feeFollowupCue = /^(?:and\s+)?(?:what|how) about\b/.test(norm);
  const requestedServices = currentQuery.service.positive;
  if (followUpTopic === 'fees' && feeFollowupCue && requestedServices.length === 1
    && ['hostel', 'mess'].includes(requestedServices[0])
    && !/\b(?:fee|fees|cost|charge|payment|availability|available|room|rules?)\b/.test(norm)) {
    const year = currentQuery.academicYears[0] || context.academicYear;
    return `What are the ${requestedServices[0]} fees${year ? ` for ${year}` : ''}?`;
  }

  // A named branch in a short "what about X?" turn updates the branch while
  // carrying forward the prior intake request. Do not carry the old branch.
  if (followUpTopic && currentQuery.branch.positive.length === 1
    && /^(?:and\s+)?(?:what|how) about\b/.test(norm)) {
    const branch = context.branch;
    const year = currentQuery.academicYears[0] || context.academicYear;
    const suffix = year ? ` for ${year}` : '';
    const branchFollowups = {
      intake: `What is the intake for ${branch}${suffix}?`,
      cutoff: `What is the cutoff for ${branch}${suffix}?`,
      hod: `Who is the HOD of ${branch}?`,
      labs: `What laboratories are available in ${branch}?`,
      syllabus: `What is the syllabus for ${branch}?`,
      placement: `What are the placement details for ${branch}?`,
      programmes: `What programmes are offered in ${branch}?`,
    };
    if (branchFollowups[followUpTopic]) return branchFollowups[followUpTopic];
  }

  // 1. Hostel & mess follow-ups
  if (followUpTopic === 'hostel' && isBareOrPronoun && !explicitOtherTopic && !/\b(?:hostel|room)\b/.test(norm)) {
    return `Hostel inquiry: ${question}`;
  }

  // 2. Fee follow-ups
  if (!explicitOtherTopic && !/\b(?:hostel|room|mess)\b/.test(norm) && (isBareOrPronoun && followUpTopic === 'fees' || /\b(?:fee|fees|cost|tuition|charges|shulka|concession)\b/.test(norm))) {
    // Enrich the original question instead of replacing qualifiers such as DSE,
    // academic year, semester, comparison, or installment requests.
    const query = understandQuery(question);
    const additions = [];
    if (!/\b(?:fee|fees|cost|tuition|charges|shulka|concession)\b/.test(norm)) additions.push('engineering fees');
    if (!query.category.positive.length && !query.category.excluded.length && context.category) additions.push(context.category);
    if (!query.gender.positive.length && !query.gender.excluded.length && context.gender) additions.push(context.gender);
    if (!query.branch.positive.length && !query.branch.excluded.length && context.branch) additions.push(context.branch);
    if (!query.route.positive.length && !query.route.excluded.length && !/\bsecond year\b/.test(norm) && context.route) additions.push(context.route);
    if (!query.academicYears.length && !query.invalidYears.length && context.academicYear) additions.push(context.academicYear);
    return additions.length ? withScope(question, `(${additions.join(' ')})`) : question;
  }

  // 3. Intake / seats follow-ups (e.g. "what is the intake?", "how many seats?")
  if (/\b(?:intake|seats?|seat matrix|capacity)\b/.test(norm) && context.branch && !/\b(?:computer|mechanical|civil|railway|ai|data science|entc|electronics)\b/.test(norm)) {
    return withScope(question, `for ${context.branch}`);
  }

  // 4. Cutoff follow-ups (e.g. "what was the cutoff?", "last year cutoff?")
  if (/\b(?:cutoff|cut off|merit|percentile|rank)\b/.test(norm) && followUpTopic === 'cutoff' && context.branch && !/\b(?:computer|mechanical|civil|railway|ai|data science|entc|electronics)\b/.test(norm)) {
    return withScope(question, `for ${context.branch}`);
  }

  // 5. Placement follow-ups (e.g. "highest package?", "top recruiters?", "average salary?")
  if (!explicitOtherTopic && followUpTopic === 'placement' && !/\b(?:placement|package|recruiter)\b/.test(norm)) {
    if (context.branch && !/\b(?:computer|mechanical|civil|railway|ai|data science|entc|electronics)\b/.test(norm)) {
      return `Placement inquiry for ${context.branch}: ${question}`;
    }
    return `Placement inquiry: ${question}`;
  }

  // 6. Department / HOD / Lab / Syllabus follow-ups
  if (/\b(?:hod|head of department|department head|labs?|laborator\w*|faculty|syllabus)\b/.test(norm)
    && !/\b(?:principal|director|campus director)\b/.test(norm)
    && context.branch && !/\b(?:computer|mechanical|civil|railway|ai|data science|entc|electronics)\b/.test(norm)) {
    return withScope(question, `for ${context.branch}`);
  }

  // 7. Branch context fallback for short follow-ups
  if (!explicitOtherTopic && !(followUpTopic === 'facilities' && /\b(?:cutoff|cut off|merit|percentile|rank)\b/.test(norm)) && context.branch && isBareOrPronoun && !/\b(?:computer|mechanical|civil|railway|ai|data science|entc|electronics)\b/.test(norm)) {
    return withScope(question, `for ${context.branch}`);
  }

  return question;
}

export async function askWithHistory(body, user, answerQuestion) {
  if (typeof body.question !== 'string' || !body.question.trim() || body.question.trim().length > 1000) {
    throw badRequest('Enter a question of up to 1000 characters.');
  }
  const question = body.question.trim();
  const chat = body.conversationId ? getConversation(body.conversationId, user) : null;
  if (chat && chat.messages.length >= 200) throw badRequest('This conversation is full. Start a new chat to continue.');
  const updatedContext = extractConversationContext(question, chat?.context || {});
  const contextualQuestion = resolveConversationalQuestion(question, chat, updatedContext);
  const language = body.language && body.language !== 'auto' ? body.language : selectLanguage(question, 'auto');
  const answer = await answerQuestion({ question: contextualQuestion, language, context: updatedContext }, user);
  const now = nowIso();
  const conversation = chat || {
    id: generateId('CHAT'), ownerId: user.id, title: question.replace(/\s+/g, ' ').slice(0, 80),
    createdAt: now, updatedAt: now, messages: [], context: updatedContext,
  };
  conversation.context = updatedContext;
  conversation.messages.push(
    { id: generateId('MSG'), type: 'user', text: question, createdAt: now },
    { id: generateId('MSG'), type: 'assistant', text: answer.answer, ...pick(answer, ['source', 'sourceUrl', 'officialLinks', 'next', 'actionView', 'actionLabel', 'sections', 'evidence', 'requestedLanguage', 'responseLanguage', 'localizationStatus', 'languageReviewStatus', 'suggestions', 'escalation']), createdAt: now },
  );
  conversation.updatedAt = now;
  if (!chat) {
    const all = getDb().conversations;
    all.push(conversation);
    const userChats = all.filter((c) => c.ownerId === user.id);
    if (userChats.length > 50) {
      const oldestId = userChats[0].id;
      getDb().conversations = all.filter((c) => c.id !== oldestId);
    }
  }
  saveDb();
  return { conversation: { ...summary(conversation), messages: conversation.messages, context: conversation.context } };
}

export function prunePublicConversations(now = Date.now()) {
  const db = getDb();
  const before = (db.conversations || []).length;
  db.conversations = (db.conversations || []).filter(chat => chat.ownerId !== 'public'
    || chat.publicSessionHash && Number.isFinite(Date.parse(chat.expiresAt)) && Date.parse(chat.expiresAt) > now);
  return before - db.conversations.length;
}

export function resetPublicConversation(id, sessionToken) {
  const db = getDb();
  const removed = prunePublicConversations();
  const sessionHash = publicSessionHash(sessionToken);
  const index = db.conversations.findIndex(chat => chat.id === id && chat.ownerId === 'public' && chat.publicSessionHash === sessionHash);
  if (index < 0) {
    if (removed) saveDb();
    throw notFound('Conversation not found or expired.');
  }
  db.conversations.splice(index, 1);
  saveDb();
  return { deleted: true };
}

export async function askPublicWithHistory(body, answerQuestion, sessionToken) {
  if (typeof body?.question !== 'string' || !body.question.trim() || body.question.trim().length > 1000) {
    throw badRequest('Enter a question of up to 1000 characters.');
  }
  const question = body.question.trim();
  const db = getDb();
  db.conversations = db.conversations || [];
  const removed = prunePublicConversations();
  if (removed) saveDb();
  const sessionHash = publicSessionHash(sessionToken);

  const conversationId = typeof body.conversationId === 'string' && body.conversationId.trim()
    ? body.conversationId.trim()
    : null;

  const chat = conversationId
    ? db.conversations.find((item) => item.id === conversationId && item.ownerId === 'public' && item.publicSessionHash === sessionHash)
    : null;

  if (conversationId && !chat) throw notFound('Conversation not found or expired.');

  if (chat && chat.messages.length >= 200) throw badRequest('This conversation is full. Start a new chat to continue.');

  const updatedContext = extractConversationContext(question, chat?.context || {});
  const contextualQuestion = resolveConversationalQuestion(question, chat, updatedContext);

  const language = body.language && body.language !== 'auto' ? body.language : selectLanguage(question, 'auto');
  const answer = await answerQuestion({
    question: contextualQuestion,
    language,
    context: updatedContext,
  }, null);

  // Recheck after awaiting an external model: concurrent requests or a reset
  // must not resurrect a deleted/expired conversation or exceed its bound.
  if (chat && (!db.conversations.includes(chat) || Date.parse(chat.expiresAt) <= Date.now())) throw notFound('Conversation not found or expired.');
  if (chat && chat.messages.length >= 200) throw badRequest('This conversation is full. Start a new chat to continue.');

  const now = nowIso();
  const conversation = chat || {
    id: generateId('CHAT'),
    ownerId: 'public',
    publicSessionHash: sessionHash,
    title: question.replace(/\s+/g, ' ').slice(0, 80),
    createdAt: now,
    updatedAt: now,
    messages: [],
    context: updatedContext,
  };

  conversation.context = updatedContext;
  conversation.messages.push(
    { id: generateId('MSG'), type: 'user', text: question, createdAt: now },
    {
      id: generateId('MSG'),
      type: 'assistant',
      text: answer.answer,
      ...pick(answer, ['source', 'sourceUrl', 'officialLinks', 'next', 'actionView', 'actionLabel', 'sections', 'evidence', 'requestedLanguage', 'responseLanguage', 'localizationStatus', 'languageReviewStatus', 'suggestions', 'escalation', 'model']),
      createdAt: now,
    },
  );
  conversation.updatedAt = now;
  conversation.expiresAt = new Date(Date.now() + config.publicConversationTtlMs).toISOString();

  if (!chat) {
    db.conversations.push(conversation);
    // Keep max 200 public conversations to bound storage
    const publicChats = db.conversations.filter(c => c.ownerId === 'public');
    if (publicChats.length > 200) {
      const oldestId = publicChats[0].id;
      db.conversations = db.conversations.filter(c => c.id !== oldestId);
    }
  }
  saveDb();

  return {
    ...answer,
    conversationId: conversation.id,
    context: conversation.context,
  };
}
