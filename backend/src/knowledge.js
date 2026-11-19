import { badRequest } from './errors.js';
import { validateTranslations } from './language.js';
import { asksForAllPrograms } from './query-scope.js';
import { validateProvenance, usableKnowledge } from './provenance.js';
import { understandQuery } from './query-understanding.js';

export const knowledgeStatuses = ['Published', 'Review', 'Archived', 'Draft', 'Retired'];
const amountKeys = ['open', 'concessionBoy', 'concessionGirl', 'vjnt', 'scst'];
const plainObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
function keys(value, allowed) {
  if (!plainObject(value) || Object.keys(value).some((key) => !allowed.includes(key))) throw badRequest('Invalid structured fact fields.');
}
function string(value, name, max) {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > max) throw badRequest(`${name} must contain 1 to ${max} characters.`);
  return value.trim();
}
function integer(value, name, max = 1_000_000_000) {
  if (!Number.isSafeInteger(value) || value < 0 || value > max) throw badRequest(`${name} must be a non-negative whole number up to ${max}.`);
  return value;
}
export function validateFacts(value) {
  const kind = value?.kind;
  const year = string(value?.academicYear, 'academicYear', 7);
  const match = year.match(/^(\d{4})-(\d{2})$/);
  if (!match || Number(match[2]) !== (Number(match[1]) + 1) % 100) throw badRequest('Use an academic year such as 2026-27.');
  if (kind === 'academicFees') {
    keys(value, ['kind', 'academicYear', 'firstYear', 'directSecondYear']);
    const route = (table) => {
      keys(table, amountKeys);
      return Object.fromEntries(amountKeys.map((key) => [key, integer(table[key], key)]));
    };
    return { kind, academicYear: year, firstYear: route(value.firstYear), directSecondYear: route(value.directSecondYear) };
  }
  if (kind === 'accommodationFees') {
    keys(value, ['kind', 'academicYear', 'hostel', 'refundableDeposit', 'messAnnual']);
    return { kind, academicYear: year, hostel: integer(value.hostel, 'hostel'),
      refundableDeposit: integer(value.refundableDeposit, 'refundableDeposit'), messAnnual: integer(value.messAnnual, 'messAnnual') };
  }
  if (kind === 'programIntake') {
    keys(value, ['kind', 'academicYear', 'programs']);
    if (!Array.isArray(value.programs) || !value.programs.length || value.programs.length > 30) throw badRequest('Provide between 1 and 30 programmes.');
    const names = new Set();
    const programs = value.programs.map((item) => {
      keys(item, ['name', 'intake', 'choiceCode']);
      const name = string(item.name, 'programme name', 180);
      if (names.has(name.toLowerCase())) throw badRequest('Programme names must be unique.');
      names.add(name.toLowerCase());
      const choiceCode = string(item.choiceCode, 'choiceCode', 20);
      if (!/^\d+$/.test(choiceCode)) throw badRequest('Choice codes must contain digits only.');
      return { name, intake: integer(item.intake, 'intake', 100_000), choiceCode };
    });
    return { kind, academicYear: year, programs };
  }
  throw badRequest('Unsupported structured fact type.');
}
const money = (value) => `INR ${new Intl.NumberFormat('en-IN').format(value)}`;
export function renderFactText(facts, route = null) {
  if (facts.kind === 'academicFees') {
    const row = (label, table) => `${label} fees for AY ${facts.academicYear} include Open or OMS total ${money(table.open)}, Open EBC EWS OBC SEBC boys ${money(table.concessionBoy)}, girls ${money(table.concessionGirl)}, VJNT SBC TFWS ${money(table.vjnt)}, and SC ST ${money(table.scst)}.`;
    if (route === 'firstYear') return row('First Year Engineering', facts.firstYear);
    if (route === 'directSecondYear') return row('Direct Second Year', facts.directSecondYear);
    return `${row('First Year Engineering', facts.firstYear)} ${row('Direct Second Year', facts.directSecondYear)}`;
  }
  if (facts.kind === 'accommodationFees') return `Hostel fee structure for AY ${facts.academicYear} includes hostel fees ${money(facts.hostel)} and refundable hostel deposit ${money(facts.refundableDeposit)}, total ${money(facts.hostel + facts.refundableDeposit)}. Mess fees per year are ${money(facts.messAnnual)}. Room availability, hostel rules, mess rules, and payment process should be confirmed by admission or hostel staff.`;
  return `For AY ${facts.academicYear}, the official First Year B.Tech page lists: ${facts.programs.map((item) => `${item.name}, sanctioned intake ${item.intake}, choice code ${item.choiceCode}`).join('; ')}.`;
}

export function validateKnowledgeFields(body, existing = null) {
  keys(body, ['title', 'category', 'source', 'sourceUrl', 'text', 'status', 'tags', 'facts', 'translations', 'expectedRevision', 'provenance', 'verifySource']);
  if (existing && Object.keys(body).every((key) => key === 'expectedRevision')) throw badRequest('Provide at least one field to update.');
  const next = { ...(existing || {}) };
  if (Object.hasOwn(body, 'verifySource') && typeof body.verifySource !== 'boolean') throw badRequest('Source review confirmation must be a boolean.');
  if (Object.hasOwn(body, 'provenance')) next.provenance = validateProvenance(body.provenance);
  for (const [field, max] of [['title', 180], ['category', 80], ['source', 180]]) {
    if (Object.hasOwn(body, field) || !existing) next[field] = string(body[field], field, max);
  }
  if (Object.hasOwn(body, 'status') || !existing) {
    next.status = Object.hasOwn(body, 'status') ? body.status : 'Review';
    if (!knowledgeStatuses.includes(next.status)) throw badRequest('Invalid knowledge publication status.');
  }
  if (Object.hasOwn(body, 'sourceUrl')) {
    if (typeof body.sourceUrl !== 'string' || body.sourceUrl.length > 2000) throw badRequest('Invalid source URL.');
    next.sourceUrl = body.sourceUrl.trim();
    if (next.sourceUrl) {
      let url;
      try { url = new URL(next.sourceUrl); } catch { throw badRequest('Invalid source URL.'); }
      if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) throw badRequest('Source URLs must use HTTP or HTTPS without embedded credentials.');
    }
  }
  if (Object.hasOwn(body, 'tags')) {
    if (!Array.isArray(body.tags) || body.tags.length > 30) throw badRequest('Provide at most 30 tags.');
    next.tags = [...new Set(body.tags.map((tag) => string(tag, 'tag', 80)))];
  }
  if (Object.hasOwn(body, 'facts')) {
    if (body.facts === null) {
      if (!Object.hasOwn(body, 'text')) throw badRequest('Provide reviewed text when removing structured facts.');
      delete next.facts;
    } else next.facts = validateFacts(body.facts);
  }
  if (next.facts) {
    const reservedKinds = { 'KB-2': 'academicFees', 'KB-3': 'accommodationFees', 'KB-10': 'programIntake' };
    if (reservedKinds[existing?.id] && next.facts.kind !== reservedKinds[existing.id]) throw badRequest('This record requires its designated fact type.');
    const canonical = renderFactText(validateFacts(next.facts));
    if (Object.hasOwn(body, 'text') && body.text !== canonical) throw badRequest('Structured record text is generated from its facts. Update the factual fields instead.');
    next.text = canonical;
  } else if (Object.hasOwn(body, 'text') || !existing) next.text = string(body.text, 'text', 100_000);
  if (Object.hasOwn(body, 'translations')) {
    const changes = validateTranslations(body.translations, next.text);
    next.translations = { ...(existing?.translations || {}) };
    for (const [language, translation] of Object.entries(changes)) {
      if (translation === null) delete next.translations[language];
      else next.translations[language] = translation;
    }
  }
  if (next.facts?.academicYear && next.provenance?.academicYear && next.facts.academicYear !== next.provenance.academicYear) throw badRequest('Source academic year must match the structured facts.');
  if (next.sourceDocumentId && next.provenance?.documentId && next.sourceDocumentId !== next.provenance.documentId) throw badRequest('Published passage document ID must match its source document.');
  return next;
}

export function academicFeeSelection(normalized) {
  const query = understandQuery(normalized);
  let key;
  let category;
  if (query.category.positive.length === 1) {
    const selected = query.category.positive[0];
    if (selected === 'scst') [key, category] = ['scst', 'SC/ST'];
    else if (selected === 'vjnt') [key, category] = ['vjnt', 'VJNT/SBC/TFWS'];
    else if (selected === 'concession' && query.gender.positive.length === 1) [key, category] = query.gender.positive[0] === 'girl' ? ['concessionGirl', 'Open EBC/EWS/OBC/SEBC girls'] : ['concessionBoy', 'Open EBC/EWS/OBC/SEBC boys'];
    else if (selected === 'open') [key, category] = ['open', 'OMS/Open without EBC income concession'];
  }
  return { key, category, route: query.admissionRoute };
}

// Read-only compatibility for the exact original corpus formats. Never guess from arbitrary prose.
export function parseLegacyFactText(record) {
  if (record.facts || typeof record.text !== 'string') return null;
  const text = record.text;
  let facts;
  if (record.id === 'KB-2') {
    const match = text.match(/^First Year Engineering fees for AY (\d{4}-\d{2}) include Open or OMS total INR ([\d,]+), Open EBC EWS OBC SEBC boys INR ([\d,]+), girls INR ([\d,]+), VJNT SBC TFWS INR ([\d,]+), and SC ST INR ([\d,]+)\. Direct Second Year fees(?: for AY (\d{4}-\d{2}))? include Open or OMS(?: total)? INR ([\d,]+), Open EBC EWS OBC SEBC boys INR ([\d,]+), girls INR ([\d,]+), VJNT SBC TFWS INR ([\d,]+), and SC ST INR ([\d,]+)\.$/);
    if (!match || (match[7] && match[7] !== match[1])) return null;
    const table = (values) => Object.fromEntries(amountKeys.map((key, index) => [key, Number(values[index].replaceAll(',', ''))]));
    facts = { kind: 'academicFees', academicYear: match[1], firstYear: table(match.slice(2, 7)), directSecondYear: table(match.slice(8, 13)) };
  } else if (record.id === 'KB-3') {
    const match = text.match(/^Hostel fee structure for AY (\d{4}-\d{2}) includes hostel fees INR ([\d,]+) and refundable hostel deposit INR ([\d,]+), total INR ([\d,]+)\. Mess fees per year are INR ([\d,]+)\. Room availability, hostel rules, mess rules, and payment process should be confirmed by admission or hostel staff\.$/);
    if (!match) return null;
    const values = match.slice(2).map((amount) => Number(amount.replaceAll(',', '')));
    if (values[0] + values[1] !== values[2]) return null;
    facts = { kind: 'accommodationFees', academicYear: match[1], hostel: values[0], refundableDeposit: values[1], messAnnual: values[3] };
  } else if (record.id === 'KB-10') {
    const match = text.match(/^For AY (\d{4}-\d{2}), the official First Year B\.Tech page lists: (.+)\.$/);
    if (!match || !match[2].includes('intake ')) return null;
    const pieces = match[2].split('; ');
    if (!/^.+, (?:sanctioned )?intake \d+, choice code \d+$/.test(pieces[0])) return null;
    const rows = pieces.map((row, index) => (index === pieces.length - 1 ? row.replace(/^and /, '') : row)
      .match(/^(.+), (?:(?:sanctioned )?intake )?(\d+), (?:choice code )?(\d+)$/));
    if (rows.some((row) => !row)) return null;
    facts = { kind: 'programIntake', academicYear: match[1], programs: rows.map((row) => ({ name: row[1], intake: Number(row[2]), choiceCode: row[3] })) };
  } else return null;
  try { return validateFacts(facts); } catch { return null; }
}

// Explicit managed routes bind answers to one maintained record, independent of top keyword matches.
export function buildMaintainedAnswer(question, normalized, records) {
  const query = understandQuery(normalized);
  let id;
  let actionView;
  if (normalized.includes('seat matrix')) [id, actionView] = ['KB-6', 'cap'];
  else if (query.topics.some(topic => ['academicFees', 'accommodationFees'].includes(topic))) {
    if (query.level !== 'engineering' && !/hostel|mess/.test(normalized)) return {
      managedRecordId: 'unsupported-fee-route', source: 'No verified record', evidence: [], next: '',
      answer: 'I could not find a verified fee amount for that admission route or transport service. B.Tech academic fees must not be used for Polytechnic or bus fees. Please check the applicable notice with the college.' };
    [id, actionView] = query.topics.includes('accommodationFees') ? ['KB-3', 'visit'] : ['KB-2', 'fees'];
  } else if ((/intake|choice code|programs?|courses?|branches?/.test(normalized) || (/\b(?:offer|have|available)\b/.test(normalized) && (query.branch.positive.length > 0 || /engineering|b\.?tech/.test(normalized)))) && !/polytechnic|diploma|direct second|\bdse\b|lateral/.test(normalized)) {
    [id, actionView] = ['KB-10', 'programs'];
  } else return null;
  const record = records.find((item) => item.id === id && usableKnowledge(item));
  const unavailable = () => ({ managedRecordId: id, source: 'No verified record', evidence: [],
    answer: 'I could not find a published official record for that information. Please check with the college for verified details.',
    next: '', actionView, actionLabel: 'Request verified information' });
  if (!record || typeof record.text !== 'string' || !record.text.trim()) return unavailable();
  let facts = null;
  if (record.facts) {
    try { facts = validateFacts(record.facts); } catch { return unavailable(); }
    const requiredKind = { 'KB-2': 'academicFees', 'KB-3': 'accommodationFees', 'KB-10': 'programIntake' }[id];
    if (requiredKind && facts.kind !== requiredKind) return unavailable();
  }
  const year = facts?.academicYear || record.provenance?.academicYear || record.text.match(/\b(?:AY |for )?(20\d{2}-\d{2})\b/)?.[1];
  const requestedYears = query.academicYears;
  if (requestedYears.length && (!year || requestedYears.some((value) => value !== year))) return unavailable();
  let answer = facts ? renderFactText(facts) : record.text;
  if (facts) {
    const signature = value => JSON.stringify(value.kind === 'programIntake' ? { ...value, programs: [...value.programs].sort((a, b) => a.name.localeCompare(b.name)) } : value);
    const conflicts = records.filter(item => item.id !== id && usableKnowledge(item) && item.facts?.kind === facts.kind && item.facts?.academicYear === facts.academicYear)
      .filter(item => { try { return signature(validateFacts(item.facts)) !== signature(facts); } catch { return false; } });
    if (conflicts.length) return { managedRecordId: id, conflict: true, source: 'Conflicting published records',
      answer: 'Published records disagree about these facts for the same academic year. I cannot provide verified figures until the college resolves the conflict.',
      next: '', evidence: [record, ...conflicts].map(item => ({ ...item, score: 200 })) };
  }
  if (facts?.kind === 'academicFees') {
    const { key, category, route } = academicFeeSelection(normalized);
    const dse = route === 'directSecondYear';
    const fy = route === 'firstYear';
    if (key) answer = fy || dse
      ? `For ${dse ? 'Direct Second Year' : 'First Year'} Engineering in AY ${year}, the approved ${category} academic-year total is ${money((dse ? facts.directSecondYear : facts.firstYear)[key])}.`
      : `For AY ${year}, the approved ${category} totals are ${money(facts.firstYear[key])} for First Year Engineering and ${money(facts.directSecondYear[key])} for Direct Second Year Engineering.`;
    else if (route) answer = renderFactText(facts, route);
    answer += ' These are annual amounts, not semester-wise amounts and not a semester-wise schedule. The record does not establish an installment split. Category concessions require valid admission and category documents.';
    if (/\btuition\b/i.test(question)) answer += ' These figures are annual totals; the maintained passage does not establish a tuition-only breakdown.';
  }
  if (facts?.kind === 'accommodationFees') {
    const hostel = query.service.positive.includes('hostel');
    const mess = query.service.positive.includes('mess');
    answer = `For AY ${year}, ${hostel ? `the hostel fee is ${money(facts.hostel)} plus a refundable hostel deposit of ${money(facts.refundableDeposit)}, for a hostel total of ${money(facts.hostel + facts.refundableDeposit)}. ` : ''}${mess ? `Mess fees are ${money(facts.messAnnual)} per year. ` : ''}Room availability, hostel and mess rules, and payment process must be confirmed with the college.`;
  }
  if (facts?.kind === 'programIntake' && query.branch.positive.length === 1 && !asksForAllPrograms(normalized)) {
    const selectedBranch = query.branch.positive[0];
    const program = facts.programs.find(item => understandQuery(item.name).branch.positive.includes(selectedBranch));
    if (!program) return unavailable();
    answer = `For AY ${year}, ${program.name} has sanctioned intake ${program.intake} and choice code ${program.choiceCode}. Intake does not confirm current vacancies or guarantee admission.`;
  }
  if (facts?.kind === 'programIntake' && query.branch.positive.length > 1 && !asksForAllPrograms(normalized)) {
    const selected = query.branch.positive.map(branch => facts.programs.find(item => understandQuery(item.name).branch.positive.includes(branch)));
    if (selected.some(item => !item)) return unavailable();
    answer = `For AY ${year}:\n` + selected.map(item => `- ${item.name}: sanctioned intake ${item.intake}; choice code ${item.choiceCode}`).join('\n') + '\n\nIntake does not confirm current vacancies or guarantee admission.';
  }
  return { managedRecordId: id, source: record.source, sourceUrl: record.sourceUrl || '', answer,
    next: '', actionView, actionLabel: 'View official record',
    evidence: [{ ...record, score: 200 }] };
}

export function extractPublicFacts(records = []) {
  const published = records.filter(usableKnowledge);
  const select = (id, kind) => {
    const record = published.find(item => item.id === id);
    if (!record) return null;
    try {
      const facts = record.facts ? validateFacts(record.facts) : parseLegacyFactText(record);
      if (!facts || facts.kind !== kind) return null;
      const signature = value => JSON.stringify(value.kind === 'programIntake' ? { ...value, programs: [...value.programs].sort((a, b) => a.name.localeCompare(b.name)) } : value);
      if (published.some(item => item.id !== id && item.facts?.kind === kind && item.facts.academicYear === facts.academicYear
        && signature(validateFacts(item.facts)) !== signature(facts))) return null;
      return { ...record, facts };
    } catch { return null; }
  };
  const feeRecord = select('KB-2', 'academicFees');
  const hostelRecord = select('KB-3', 'accommodationFees');
  const intakeRecord = select('KB-10', 'programIntake');

  const academicFees = feeRecord?.facts ? {
    academicYear: feeRecord.facts.academicYear,
    source: feeRecord.source || 'Approved fee records shared for AY 2026-27',
    fy: {
      open: feeRecord.facts.firstYear.open,
      boys: feeRecord.facts.firstYear.concessionBoy,
      girls: feeRecord.facts.firstYear.concessionGirl,
      vjnt: feeRecord.facts.firstYear.vjnt,
      scst: feeRecord.facts.firstYear.scst,
    },
    dse: {
      open: feeRecord.facts.directSecondYear.open,
      boys: feeRecord.facts.directSecondYear.concessionBoy,
      girls: feeRecord.facts.directSecondYear.concessionGirl,
      vjnt: feeRecord.facts.directSecondYear.vjnt,
      scst: feeRecord.facts.directSecondYear.scst,
    },
    raw: {
      firstYear: feeRecord.facts.firstYear,
      directSecondYear: feeRecord.facts.directSecondYear,
    },
  } : null;

  const accommodationFees = hostelRecord?.facts ? {
    academicYear: hostelRecord.facts.academicYear,
    source: hostelRecord.source || 'Hostel and mess fee structure shared for AY 2026-27',
    hostel: hostelRecord.facts.hostel,
    refundableDeposit: hostelRecord.facts.refundableDeposit,
    hostelTotal: hostelRecord.facts.hostel + hostelRecord.facts.refundableDeposit,
    messAnnual: hostelRecord.facts.messAnnual,
  } : null;

  const programs = intakeRecord?.facts?.programs ? intakeRecord.facts.programs.map((prog) => ({
    name: prog.name,
    intake: prog.intake,
    choiceCode: prog.choiceCode,
  })) : [];

  return {
    academicYear: academicFees?.academicYear || null,
    academicFees,
    accommodationFees,
    programs,
  };
}
