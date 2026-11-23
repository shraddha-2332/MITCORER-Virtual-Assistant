import { getAssistantUsageCounts, incrementAssistantUsage } from './store.js';

const questionLabels = {
  academicFees: 'What are the college fees?',
  accommodationFees: 'What are the hostel and mess fees?',
  lateralEntry: 'Can I apply for direct second-year admission?',
  deadlines: 'What are the admission or reporting deadlines?',
  examinations: 'Where can I find exam and timetable information?',
  scholarships: 'What scholarships are available?',
  placements: 'What placement support does MITCORER offer?',
  admissions: 'General admission questions',
  programmes: 'What programmes are available?',
  admissionQuota: 'What admission quotas are available?',
  seatMatrix: 'Where can I find the seat matrix?',
  institutionStatus: 'What type of institution is MITCORER?',
  hostel: 'Is hostel accommodation available?',
  transport: 'What transport options are available?',
  library: 'What library facilities are available?',
};

export function questionType({ normalized, topics, admissionRoute }) {
  const specificTopic = topics.find(topic => ['academicFees', 'accommodationFees', 'seatMatrix', 'admissionQuota', 'institutionStatus'].includes(topic));
  if (specificTopic) return specificTopic;
  if (/^how much (?:is|does) (?:a |the )?hostel room\b/.test(normalized)) return 'accommodationFees';
  if (/\b(?:exam(?:s|ination|inations)?|timetable)\b/.test(normalized)) return 'examinations';
  if (/\b(?:scholarships?|mahadbt|pragati|financial aid)\b/.test(normalized)) return 'scholarships';
  if (/\b(?:placements?|recruiters?|salary package|help with jobs?)\b/.test(normalized)) return 'placements';
  if (/\b(?:deadlines?|last date|reporting dates?|admission schedule)\b/.test(normalized)) return 'deadlines';
  const service = topics.find(topic => ['hostel', 'transport', 'library'].includes(topic));
  if (service) return service;
  if (admissionRoute === 'directSecondYear' || /\b(?:lateral entry|direct second year|dse)\b/.test(normalized)) return 'lateralEntry';
  if (topics.includes('programmes')) return 'programmes';
  if (/\b(?:admissions?|apply|eligibility|cap|acap)\b/.test(normalized)) return 'admissions';
  return 'other';
}

const dayKey = time => new Date(time).toISOString().slice(0, 10);
const evidenceGapReasons = {
  INSUFFICIENT_EVIDENCE: 'Insufficient verified evidence',
  CONFLICTING_EVIDENCE: 'Conflicting evidence',
  OUTDATED_EVIDENCE: 'Evidence expired or unavailable for this answer',
};

export const questionTypeLabel = id => Object.hasOwn(questionLabels, id) ? questionLabels[id] : 'Other questions';
export const evidenceGapReason = outcome => Object.hasOwn(evidenceGapReasons, outcome) ? evidenceGapReasons[outcome] : null;

export function recordAssistantUsage(query, outcome, now = Date.now(), category = questionType(query)) {
  const bucket = outcome === 'ANSWERED' ? 'answered' : evidenceGapReason(outcome) ? 'evidenceGap' : 'other';
  incrementAssistantUsage(dayKey(now), category, bucket);
}

export function assistantUsageReport(now = Date.now()) {
  const firstDay = dayKey(now - 29 * 86_400_000);
  const lastDay = dayKey(now);
  const totals = { total: 0, answered: 0, evidenceGap: 0, other: 0 };
  const byQuestion = new Map();
  for (const { questionType, outcome, count } of getAssistantUsageCounts(firstDay, lastDay)) {
    const label = questionTypeLabel(questionType);
    const group = byQuestion.get(questionType) || { id: questionType, label, total: 0, answered: 0, evidenceGap: 0, other: 0 };
    group[outcome] += count;
    group.total += count;
    totals[outcome] += count;
    totals.total += count;
    byQuestion.set(questionType, group);
  }
  const questions = [...byQuestion.values()].sort((a, b) => b.total - a.total || a.label.localeCompare(b.label));
  return { firstDay, lastDay, totals, questions };
}
