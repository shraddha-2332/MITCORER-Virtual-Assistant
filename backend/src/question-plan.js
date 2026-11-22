import { buildMaintainedAnswer } from './knowledge.js';
import { asksForAllPrograms } from './query-scope.js';
import { usableKnowledge } from './provenance.js';
import { splitQueryClauses, queryClarification, understandQuery } from './query-understanding.js';

// Bounded deterministic interpretation. No session history or generated decomposition.
function clauses(text) {
  return splitQueryClauses(text);
}
function facet(text) {
  if (/\b(?:scholarship|pragati|mahadbt|nsp)\b/.test(text)) return 'scholarship';
  if (/\b(?:document|certificate)\b/.test(text)) return 'documents';
  if (/\b(?:admission|cap|acap)\b/.test(text) && /\b(?:work|process|procedure|steps|apply)\b/.test(text) && !/\b(?:fee|document|certificate)\b/.test(text)) return 'admissions';
  if (/\b(?:office hours?|office timings?|working hours?|college timings?)\b/.test(text)) return 'officeHours';
  if (/\b(?:address|contact details?|phone|telephone|email|college location|campus location)\b/.test(text)
    || /^(?:(?:share|show|give)(?: me)?\s+)?(?:the\s+)?location[?. ]*$/.test(text)) return 'contact';
  if (/\b(?:route|routes|stops?|distance|how far|travel from|bus from)\b/.test(text)) return 'transport';
  if (/seat matrix/.test(text)) return 'seatMatrix';
  if (/\b(?:fee\w*|payment\w*|amount|semester|charges?|cost\w*|deposit)\b/.test(text)) return /\b(?:hostel|mess)\b/.test(text) ? 'accommodationFees' : 'academicFees';
  if (/\b(?:bus|transport)\b/.test(text)) return 'transport';
  if (/\b(?:library|libraries|journals)\b|digital resources/.test(text)) return 'library';
  if (/\b(?:hostel|mess|accommodation)\b/.test(text)) return 'hostel';
  if (/\b(?:intake|choice code|program\w*|course\w*|branch\w*)\b/.test(text) && !/corporate readiness|training program/.test(text)) return 'programmes';
  return 'unknown';
}
const titles = { seatMatrix: 'Historical seat matrix', programmes: 'Programmes and intake', academicFees: 'Academic fees', accommodationFees: 'Hostel and mess fees',
  hostel: 'Hostel facilities', documents: 'Required documents', admissions: 'Admission process', scholarship: 'Scholarships', transport: 'Bus and transport', library: 'Library', officeHours: 'Office hours', contact: 'Address and contact details', unknown: 'Other requested information' };
const entities = /\bcse\b|computer science|computer engineering|civil(?: engineering)?|mechanical(?: engineering)?|electronics|artificial intelligence|ai & ds|polytechnic|diploma/i;

export function buildClarificationAnswer(normalized) {
  if (/^(?:(?:and|what about|how about)\s+)?(?:is it available|is that available|how much|tell me more)[?.! ]*$/i.test(normalized)) {
    return { clarification: true, clarificationKind: 'reference', source: 'Clarification required', evidence: [], answer: 'Which programme, facility or fee do you mean?', next: '' };
  }
  const clarification = queryClarification(normalized);
  if (clarification) return { clarification: true, clarificationKind: clarification.kind, source: 'Clarification required', evidence: [], answer: clarification.message, next: '' };
  const hasEntity = entities.test(normalized) || understandQuery(normalized).branch.positive.length > 0;
  const ambiguousIntake = /\bintake\b/.test(normalized) && !hasEntity
    && !/\b(?:all|program\w*|course\w*|branch\w*|b\.?tech)\b/.test(normalized);
  const bareReference = /\b(?:it|its|that|this)\b/.test(normalized)
    && /\b(?:intake|fee\w*|cost\w*|eligib\w*)\b/.test(normalized) && !hasEntity
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
  const query = understandQuery(normalized);
  if (query.topics.includes('admissionQuota')) return null;
  const services = query.service.positive;
  if (/\bpragati\b/.test(normalized)) return null;
  let id;
  if (/\b(?:document\w*|certificate\w*)\b/.test(normalized) && /\bst\b|scheduled tribe|\bsc\b|scheduled caste/.test(normalized)) id = 'KB-26';
  else if (/\b(?:document\w*|certificate\w*)\b/.test(normalized) && /\bobc\b|\bews\b|\bvjnt\b|\bsbc\b/.test(normalized)) id = 'KB-27';
  else if (query.admissionPathway === 'instituteLevel') id = 'KB-14';
  else if (/applying after\s+cap/.test(normalized) && /scholarship|concession/.test(normalized)) id = 'KB-14';
  else if (services.includes('transport') && !services.some(service => ['hostel', 'mess'].includes(service)) && !/\b(?:nearest|distance|how far|bus stand|railway station|barshi town|kurduwadi)\b/.test(normalized)) id = 'KB-19';
  else if (services.includes('library') || /digital resources/.test(normalized)) id = 'KB-20';
  if (!id) return null;
  const response = directPassage(id, normalized, records);
  return { ...response, ...(id === 'KB-19' ? { actionView: 'inquiry', actionLabel: 'Request bus details' } : {}) };
}

export function buildCompoundAnswer(question, normalized, records) {
  // Existing admission progress/checklist logic must retain its personal workflow semantics.
  if (/admission|allotment|reporting|\bcap\b/.test(normalized) && /remaining|pending|checklist|last step|final step|what.*next/.test(normalized)) return null;
  if (/\b(?:faculty|faculties|teacher|teachers|professor|professors|teaching staff)\b/i.test(normalized) && !/\b(?:fee|fees|cost|hostel|mess|cutoff|cut-off|scholarship)\b/i.test(normalized)) return null;
  if (/mou|corporate readiness|railway signaling|railway track|railway technology|railway diploma|railway modules/.test(normalized)) return null;
  const request = normalized.replace(/^i (?:want|plan|would like) to visit (?:the college|the campus|mitcorer)[.!]\s+(?=(?:share|show|give)(?: me)?\s+(?:the\s+)?(?:location|address|contact details?)\b)/i, '');
  let parts = clauses(request).filter(part => !/^(?:(?:for|in|ay|academic year)\s+)*(?:20\d{2}[-–/]\d{2,4})[?. ]*$/i.test(part));
  if (parts.length > 1 && /^for (?:ay )?20\d{2}[-–/]\d{2,4} (?:dse|direct second year|first year)(?: engineering)?$/i.test(parts[0])) parts = parts.slice(1);
  if (/\bscholarship\b/.test(normalized) && parts.length === 2 && /^(?:where|how)(?: (?:can|do|should) i)?(?: to)? apply[?. ]*$/.test(parts[1])) return null;
  // A branch comparison is one attribute applied independently to each entity.
  const compared = understandQuery(normalized).branch.positive;
  if (compared.length > 1 && /\b(?:intake|choice code)\b/.test(normalized) && !/\b(?:fee|cost|scholarship|hostel)\b/.test(normalized)) {
    return buildMaintainedAnswer(question, normalized, records);
  }
  // Hostel + mess is one cost topic, not two unrelated queries.
  if (parts.every((part) => /\b(?:hostel|mess)\b/.test(part)) && /fee|charges|cost|amount/.test(normalized) && !/facilit|amenit/.test(normalized)) return null;
  const planned = parts.filter((part) => !(facet(part) === 'unknown' && understandQuery(part).branch.positive.length && !/\b(?:not|except|excluding|other|unknown)\b/.test(part)) && !/^(?:i am|i'm|my category is|my diploma is complete|i will join|i (?:passed|completed|finished) class 12)\b/.test(part)
    && !/^apart from (?:academic|tuition) fee$/i.test(part)
    && !(/^(?:i am|i'm|my category is)\b/.test(normalized) && /^want\b/.test(part))
    && !/^(?:i don't want|do not (?:give|show|tell|include)|only\b|exclude\b)/i.test(part)).map((part) => {
    let topic = facet(part);
    if (topic === 'academicFees' && /\b(?:bus|transport)\b/.test(normalized)
      && !/b\.?tech|engineering|academic|tuition|first.year|direct.second|\bdse\b|hostel|mess/.test(normalized)) topic = 'transport';
    if (/\b(?:hostel|mess)\b/.test(normalized) && /\b(?:fee\w*|payment\w*|cost\w*|charges?|deposit)\b/.test(normalized)
      && !/facilit|amenit/.test(part) && (topic === 'hostel' || topic === 'academicFees' && /\bdeposit\b/.test(part))) topic = 'accommodationFees';
    if (topic === 'unknown' && /\b(?:bus|transport)\b/.test(normalized)
      && /\b(?:routes?|stops?|timings?|timetable|schedule|fare|passes through)\b|गावातून|थांबे|वेळापत्रक|भाडे|ठहराव|समय[- ]सारणी|किराया/u.test(part)) topic = 'transport';
    if (topic === 'unknown' && /\b(?:library|libraries|journals)\b/.test(normalized)
      && /\b(?:borrow\w*|loan|books?|hours?|timings?|close[sd]?)\b|पुस्तक|उधार|बंद होत|बंद होता/u.test(part)) topic = 'library';
    return { question: part, topic };
  });
  // This common parent-style question contains several comma-separated facts;
  // clause splitting can leave contact and opening hours bundled together.
  if (/\b(?:address|location)\b/.test(normalized)
    && /\b(?:office hours?|office timings?|working hours?)\b/.test(normalized)
    && /\b(?:route|routes|travel|bus)\b/.test(normalized)) {
    planned.splice(0, planned.length,
      { question: 'MITCORER address and contact details', topic: 'contact' },
      { question: 'MITCORER office hours', topic: 'officeHours' },
      { question: 'MITCORER bus routes and stops from Solapur', topic: 'transport' },
    );
  }
  parts = planned.map((part) => part.question);
  if (parts.length < 2) return null;
  if (/seat matrix/.test(normalized) && !/current|historical/.test(normalized)
    && planned.every((part) => ['seatMatrix', 'programmes'].includes(part.topic))) return null;
  const known = new Set(planned.filter((part) => part.topic !== 'unknown').map((part) => part.topic));
  if (known.size === 1 && known.has('programmes') && planned.every(part => part.topic === 'programmes')
    && compared.length <= 1 && understandQuery(normalized).route.positive.length <= 1
    && understandQuery(normalized).academicYears.length <= 1) return null;
  const scoped = new Set(planned.map((part) => `${part.topic}:${part.question.match(/\b20\d{2}-\d{2}\b/)?.[0] || ''}:${/direct second|\bdse\b|lateral|second year/.test(part.question) ? 'dse' : /first[- ]year|\bfy\b/.test(part.question) ? 'fy' : ''}`));
  if (asksForAllPrograms(normalized) && known.size === 1 && known.has('programmes')) return null;
  if (!known.size || (known.size === 1 && planned.every((part) => part.topic !== 'unknown') && scoped.size === 1)) return null;
  // A one-word tail is often a qualifier/name, not an independently requested question.
  if (known.size === 1 && planned.some((part) => part.topic === 'unknown' && part.question.split(/\s+/).length < 2 && !understandQuery(part.question).branch.positive.length)) return null;
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
      if (!understandQuery(query).academicYears.length && context.query.academicYears.length === 1) query += ` AY ${context.query.academicYears[0]}`;
    }
    if (part.topic === 'academicFees') {
      if (known.has('accommodationFees') && !/\b(?:academic|tuition|engineering)\b/.test(query)) query += ' academic';
      const categories = context.query.category.mentions;
      if (!/\b(?:open|oms|sc|st|vjnt|sbc|tfws|ebc|ews|obc|sebc)\b/.test(query) && categories.length === 1) query += ` ${categories[0]}`;
      const genders = context.query.gender.positive;
      if (genders.length === 1 && !/\b(?:boy|male|girl|female|woman)\b/.test(query)) query += ` ${genders[0]}`;
      if (!categories.length) query += context.query.category.excludedMentions.map(category => ` not ${category}`).join('');
    }
    if (context.year && !/\b20\d{2}-\d{2}\b/.test(query)) query += ` ${context.year}`;
    if (context.route && !/first[- ]year|\bfy\b|direct second|\bdse\b|second year/.test(query)) query += ` ${context.route}`;
    if (part.topic === 'programmes' && !entities.test(query)) {
      const names = { cse: 'computer engineering', civil: 'civil engineering', mechanical: 'mechanical engineering', aids: 'artificial intelligence and data science', entc: 'electronics and telecommunication engineering', electronicsComputer: 'electronics and computer engineering' };
      query += ` ${context.query.branch.positive.map(branch => names[branch]).filter(Boolean).join(' and ')}`;
    }
    let result = ['programmes', 'academicFees', 'documents'].includes(part.topic) && !(part.topic === 'programmes' && context.query.branch.positive.length > 1) ? buildClarificationAnswer(query) : null;
    if (!result && ['seatMatrix', 'programmes', 'academicFees', 'accommodationFees'].includes(part.topic)) {
      result = buildMaintainedAnswer(query, query, records);
    } else if (!result && ['hostel', 'transport', 'library', 'officeHours', 'contact', 'scholarship', 'admissions', 'documents'].includes(part.topic)) {
      result = directPassage({ hostel: 'KB-23', transport: 'KB-19', library: 'KB-20', officeHours: 'KB-46', contact: 'KB-17', documents: 'KB-1', admissions: context.query.admissionPathway === 'instituteLevel' ? 'KB-14' : 'KB-29', scholarship: /pragati/.test(query) && records.some(r => r.id === 'KB-33' && usableKnowledge(r)) ? 'KB-33' : 'KB-18' }[part.topic], query, records);
    }
    if (part.topic === 'transport' && /\b(?:route|routes|distance|how far|travel from|from solapur)\b/i.test(query)) {
      const transitRecord = records.find((item) => item.id === 'KB-40' && usableKnowledge(item));
      if (transitRecord) result = {
        managedRecordId: 'KB-40', source: transitRecord.source, sourceUrl: transitRecord.sourceUrl,
        evidence: [transitRecord],
        answer: transitRecord.text,
      };
    }
    result ||= { source: 'No verified record', evidence: [], answer: 'I could not find a verified answer for this part. Please ask a more specific institutional question or check with the college.' };
    const refs = result.evidence || [];
    for (const record of refs) if (!evidence.some((item) => item.id === record.id)) evidence.push(record);
    const scopedTitle = part.topic === 'accommodationFees' && !/\bmess\b/.test(query) ? 'Hostel fees' : titles[part.topic];
    sections.push({ topic: part.topic, title: scopedTitle, question: part.question, normalizedQuery: query, managedRecordId: result.managedRecordId, answer: result.answer, officialLinks: result.officialLinks || [],
      status: result.conflict ? 'conflict' : result.clarification ? 'clarification' : refs.length ? 'supported' : 'unsupported', clarificationKind: result.clarificationKind, evidenceIds: refs.map((item) => item.id) });
  }
  const answer = sections.map((section) => {
    const citations = section.evidenceIds.map((id) => `[${evidence.findIndex((item) => item.id === id) + 1}]`).join(' ');
    return `${section.title}: ${section.answer}${citations ? ` ${citations}` : ''}`;
  }).join('\n\n');
  return { composed: true, clarification: sections.some(section => section.status === 'clarification'), source: evidence.length ? evidence.map((item, index) => `[${index + 1}] ${item.title} (${item.source})`).join(' · ') : 'No verified record',
    sourceUrl: '', answer, sections, evidence,
    officialLinks: [...evidence.filter((item) => item.sourceUrl).map((item) => ({ label: `[${evidence.findIndex((record) => record.id === item.id) + 1}] ${item.title}`, url: item.sourceUrl })), ...sections.flatMap((section) => section.officialLinks)], next: '' };
}
