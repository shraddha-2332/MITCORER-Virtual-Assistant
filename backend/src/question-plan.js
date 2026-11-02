import { buildMaintainedAnswer } from './knowledge.js';
import { asksForAllPrograms } from './query-scope.js';
import { usableKnowledge } from './provenance.js';
import { splitQueryClauses, queryClarification, understandQuery } from './query-understanding.js';

// Bounded deterministic interpretation. No session history or generated decomposition.
function clauses(text) {
  return splitQueryClauses(text);
}
function facet(text) {
  if (/seat matrix/.test(text)) return 'seatMatrix';
  if (/\b(?:fee\w*|payment\w*|amount|semester|charges?|cost\w*|deposit)\b/.test(text)) return /\b(?:hostel|mess)\b/.test(text) ? 'accommodationFees' : 'academicFees';
  if (/\b(?:bus|transport)\b/.test(text)) return 'transport';
  if (/\b(?:library|libraries|journals)\b|digital resources/.test(text)) return 'library';
  if (/\b(?:hostel|mess|accommodation)\b/.test(text)) return 'hostel';
  if (/\b(?:intake|choice code|program\w*|course\w*|branch\w*)\b/.test(text) && !/corporate readiness|training program/.test(text)) return 'programmes';
  return 'unknown';
}
const titles = { seatMatrix: 'Historical seat matrix', programmes: 'Programmes and intake', academicFees: 'Academic fees', accommodationFees: 'Hostel and mess fees',
  hostel: 'Hostel facilities', transport: 'Bus and transport', library: 'Library', unknown: 'Other requested information' };
const entities = /\bcse\b|computer science|civil engineering|mechanical|electronics|artificial intelligence|polytechnic|diploma/;

export function buildClarificationAnswer(normalized) {
  const clarification = queryClarification(normalized);
  if (clarification) return { clarification: true, clarificationKind: clarification.kind, source: 'Clarification required', evidence: [], answer: clarification.message, next: '' };
  const ambiguousIntake = /\bintake\b/.test(normalized) && !entities.test(normalized)
    && !/\b(?:all|program\w*|course\w*|branch\w*|b\.?tech)\b/.test(normalized);
  const bareReference = /\b(?:it|its|that|this)\b/.test(normalized)
    && /\b(?:intake|fee\w*|cost\w*|eligib\w*)\b/.test(normalized) && !entities.test(normalized)
    && !/\b(?:hostel|mess|first year|direct second|fy|dse)\b/.test(normalized);
  if (!ambiguousIntake && !bareReference) return null;
  return { clarification: true, source: 'Clarification required', evidence: [],
    answer: 'Which course or programme do you mean? Please specify the programme and admission route, such as first-year B.Tech or Polytechnic. I do not have conversation context for “it” or “its”.',
    next: '', actionView: 'programs', actionLabel: 'Specify programme' };
}

function sharedContext(question) {
  const query = understandQuery(question);
  const years = query.academicYears;
  return { year: years.length === 1 ? years[0] : '', route: query.admissionRoute === 'firstYear' ? 'first year' : query.admissionRoute === 'directSecondYear' ? 'direct second year' : '',
    cse: query.branch.positive.length === 1 && query.branch.positive[0] === 'cse', query };
}

function directPassage(id, query, records) {
  const record = records.find((item) => item.id === id && usableKnowledge(item) && typeof item.text === 'string' && item.text.trim());
  if (!record) return { managedRecordId: id, source: 'No verified record', answer: 'I could not find a published official record for this part.', evidence: [] };
  const requested = understandQuery(query).academicYears;
  if (requested.length && requested.some((year) => record.provenance?.academicYear ? record.provenance.academicYear !== year : !record.text.includes(year) && record.academicYear !== year)) {
    return { managedRecordId: id, source: 'No verified record', answer: 'The published record does not verify this part for the requested academic year.', evidence: [] };
  }
  return { managedRecordId: id, source: record.source, sourceUrl: record.sourceUrl || '', answer: record.text, evidence: [record] };
}

export function buildContextualPassage(normalized, records) {
  const services = understandQuery(normalized).service.positive;
  if (/\bpragati\b/.test(normalized)) return null;
  let id;
  if (/\b(?:document\w*|certificate\w*)\b/.test(normalized) && /\bst\b|scheduled tribe|\bsc\b|scheduled caste/.test(normalized)) id = 'KB-26';
  else if (/\b(?:document\w*|certificate\w*)\b/.test(normalized) && /\bobc\b|\bews\b|\bvjnt\b|\bsbc\b/.test(normalized)) id = 'KB-27';
  else if (/non-cap|acap|institute.level|applying after\s+cap/.test(normalized) && /scholarship|concession/.test(normalized)) id = 'KB-14';
  else if (services.includes('transport') && !services.some(service => ['hostel', 'mess'].includes(service)) && !/\b(?:nearest|distance|how far|bus stand|railway station|barshi town|kurduwadi)\b/.test(normalized)) id = 'KB-19';
  else if (services.includes('library') || /digital resources/.test(normalized)) id = 'KB-20';
  if (!id) return null;
  const response = directPassage(id, normalized, records);
  return { ...response, ...(id === 'KB-19' ? { actionView: 'inquiry', actionLabel: 'Request bus details' } : {}) };
}

export function buildCompoundAnswer(question, normalized, records) {
  // Existing admission progress/checklist logic must retain its personal workflow semantics.
  if (/admission|allotment|reporting|\bcap\b/.test(normalized) && /remaining|pending|checklist|last step|final step|what.*next/.test(normalized)) return null;
  if (/mou|corporate readiness|railway signaling|railway track|railway technology|railway diploma|railway modules/.test(normalized)) return null;
  let parts = clauses(normalized);
  if (parts.length < 2) return null;
  // Hostel + mess is one cost topic, not two unrelated queries.
  if (parts.every((part) => /\b(?:hostel|mess)\b/.test(part)) && /fee|charges|cost|amount/.test(normalized)) return null;
  const planned = parts.filter((part) => !/^(?:i am|i'm|my category is|my diploma is complete|i will join|i (?:passed|completed|finished) class 12)\b/.test(part)
    && !/^apart from (?:academic|tuition) fee$/i.test(part)
    && !(/^(?:i am|i'm|my category is)\b/.test(normalized) && /^want\b/.test(part))
    && !/^(?:i don't want|do not (?:give|show|tell|include)|only\b|exclude\b)/i.test(part)).map((part) => {
    let topic = facet(part);
    if (topic === 'academicFees' && /\b(?:bus|transport)\b/.test(normalized)
      && !/b\.?tech|engineering|academic|tuition|first.year|direct.second|\bdse\b|hostel|mess/.test(normalized)) topic = 'transport';
    if (/\b(?:hostel|mess)\b/.test(normalized) && /\b(?:fee\w*|payment\w*|cost\w*|charges?|deposit)\b/.test(normalized)
      && !/facilit|amenit/.test(part) && (topic === 'hostel' || topic === 'academicFees' && /\bdeposit\b/.test(part))) topic = 'accommodationFees';
    if (topic === 'unknown' && /\b(?:bus|transport)\b/.test(normalized) && /^(?:what are (?:the )?)?(?:routes|stops|timings)[?. ]*$/.test(part)) topic = 'transport';
    return { question: part, topic };
  });
  parts = planned.map((part) => part.question);
  if (parts.length < 2) return null;
  if (/seat matrix/.test(normalized) && !/current|historical/.test(normalized)
    && planned.every((part) => ['seatMatrix', 'programmes'].includes(part.topic))) return null;
  const known = new Set(planned.filter((part) => part.topic !== 'unknown').map((part) => part.topic));
  const scoped = new Set(planned.map((part) => `${part.topic}:${part.question.match(/\b20\d{2}-\d{2}\b/)?.[0] || ''}:${/direct second|\bdse\b|lateral|second year/.test(part.question) ? 'dse' : /first[- ]year|\bfy\b/.test(part.question) ? 'fy' : ''}`));
  if (asksForAllPrograms(normalized) && known.size === 1 && known.has('programmes')) return null;
  if (!known.size || (known.size === 1 && planned.every((part) => part.topic !== 'unknown') && scoped.size === 1)) return null;
  // A one-word tail is often a qualifier/name, not an independently requested question.
  if (known.size === 1 && planned.some((part) => part.topic === 'unknown' && part.question.split(/\s+/).length < 2)) return null;
  if (parts.length > 4) return { clarification: true, source: 'Clarification required', evidence: [],
    answer: 'Please ask about up to four topics at a time so I can answer each part with its supporting record.', next: '' };
  const context = sharedContext(normalized);
  const sections = [];
  const evidence = [];
  for (const part of planned) {
    let query = part.question;
    if (part.topic === 'accommodationFees') {
      if (!/fee|payment|amount|semester|charge|cost|deposit/.test(query)) query += ' fee';
      if (!/\b(?:hostel|mess)\b/.test(query) && /\bdeposit\b/.test(query)) query += ' hostel';
    }
    if (part.topic === 'academicFees') {
      const categories = context.query.category.mentions;
      if (!/\b(?:open|oms|sc|st|vjnt|sbc|tfws|ebc|ews|obc|sebc)\b/.test(query) && categories.length === 1) query += ` ${categories[0]}`;
      const genders = context.query.gender.positive;
      if (genders.length === 1 && !/\b(?:boy|male|girl|female|woman)\b/.test(query)) query += ` ${genders[0]}`;
      if (!categories.length) query += context.query.category.excludedMentions.map(category => ` not ${category}`).join('');
    }
    if (context.year && !/\b20\d{2}-\d{2}\b/.test(query)) query += ` ${context.year}`;
    if (context.route && !/first[- ]year|\bfy\b|direct second|\bdse\b|second year/.test(query)) query += ` ${context.route}`;
    if (context.cse && /intake/.test(query) && !entities.test(query)) query += ' cse';
    let result = ['programmes', 'academicFees'].includes(part.topic) ? buildClarificationAnswer(query) : null;
    if (!result && ['seatMatrix', 'programmes', 'academicFees', 'accommodationFees'].includes(part.topic)) {
      result = buildMaintainedAnswer(query, query, records);
    } else if (!result && ['hostel', 'transport', 'library'].includes(part.topic)) {
      result = directPassage({ hostel: 'KB-23', transport: 'KB-19', library: 'KB-20' }[part.topic], query, records);
    }
    result ||= { source: 'No verified record', evidence: [], answer: 'I could not find a verified answer for this part. Please ask a more specific institutional question or check with the college.' };
    const refs = result.evidence || [];
    for (const record of refs) if (!evidence.some((item) => item.id === record.id)) evidence.push(record);
    sections.push({ topic: part.topic, title: titles[part.topic], question: part.question, normalizedQuery: query, managedRecordId: result.managedRecordId, answer: result.answer,
      status: result.conflict ? 'conflict' : result.clarification ? 'clarification' : refs.length ? 'supported' : 'unsupported', clarificationKind: result.clarificationKind, evidenceIds: refs.map((item) => item.id) });
  }
  const answer = sections.map((section) => {
    const citations = section.evidenceIds.map((id) => `[${evidence.findIndex((item) => item.id === id) + 1}]`).join(' ');
    return `${section.title}: ${section.answer}${citations ? ` ${citations}` : ''}`;
  }).join('\n\n');
  return { composed: true, source: evidence.length ? evidence.map((item, index) => `[${index + 1}] ${item.title} (${item.source})`).join(' · ') : 'No verified record',
    sourceUrl: '', answer, sections, evidence,
    officialLinks: evidence.filter((item) => item.sourceUrl).map((item) => ({ label: `[${evidence.findIndex((record) => record.id === item.id) + 1}] ${item.title}`, url: item.sourceUrl })), next: '' };
}
