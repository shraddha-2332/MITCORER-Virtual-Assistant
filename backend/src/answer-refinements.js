import { usableKnowledge } from './provenance.js';

// Fill answer intent gaps without manufacturing absent institutional facts.
export function refinedAnswer(question, normalized, records) {
  const record = id => records.find(r => r.id === id && usableKnowledge(r));
  const withRecord = (item, answer, extra = {}) => ({ source: item?.source || 'Clarification required',
    sourceUrl: item?.sourceUrl || '', evidence: item ? [item] : [], answer, ...extra });
  if (/[,;]|\band\b/.test(normalized)
      && !(/admission/.test(normalized) && /document|certificate|papers|checklist/.test(normalized)
        && /\b(?:required admission documents?|admission documents? required|list admission documents|admission document checklist)\b/.test(normalized)
        && !/\b(?:first year|1st year|direct second|lateral entry|dse|fy|polytechnic|post ssc|diploma admission|sc|st|obc|ews|open|sbc|vjnt|tfws|scheduled tribe|scheduled caste)\b/.test(normalized)
        && !/remaining|pending|next|my |i have|i submitted|steps|process|procedure/.test(normalized))) return null;
  if (/scholarship|pragati|mahadbt|nsp/.test(normalized) && /docs?|document|certificate/.test(normalized)) {
    return withRecord(record(/pragati/.test(normalized) ? 'KB-33' : 'KB-18'),
      'Which scholarship scheme and academic year do you mean? The cited scheme overview does not establish a complete document checklist. Check the current scheme-specific official checklist before applying; do not send personal documents in this chat.',
      { clarification: true, clarificationKind: 'scholarshipDocuments' });
  }
  if (/scholarship/.test(normalized) && /amount|how much/.test(normalized) && /not published|unpublished|even if|invent/.test(normalized)) {
    return withRecord(record('KB-18'), 'No verified scholarship amount is established by this scheme overview. I cannot invent an unpublished amount. Check the current scheme notice on MahaDBT or the National Scholarship Portal for the amount, conditions and academic year.', { outcomeStatus: 'INSUFFICIENT_EVIDENCE' });
  }
  if (/admission/.test(normalized) && /docs?|document|certificate|papers|checklist/.test(normalized)
      && !/\b(?:first year|1st year|direct second|lateral entry|dse|fy|polytechnic|post ssc|diploma admission|sc|st|obc|ews|open|sbc|vjnt|tfws|scheduled tribe|scheduled caste)\b/.test(normalized)
      && !/remaining|pending|next|my |i have|i submitted/.test(normalized)) {
    const item = record('KB-1');
    return withRecord(item, `${item ? `General reporting checklist (conditional, not a personalized list):\n\n${item.text}\n\n` : ''}Are you applying for First Year B.Tech, Direct Second Year B.Tech, or Polytechnic? Which category or concession should I check?`,
      { clarification: true, clarificationKind: 'documents' });
  }
  if (/\badmission\b/.test(normalized) && /kasa milel|kaise mile|how (?:can|do) i (?:get|secure)|how to get/i.test(`${question} ${normalized}`)) {
    const item = record('KB-29');
    if (item) {
      const eligibility = record('KB-5');
      return withRecord(item, `${item.text}${eligibility ? `\n\n${eligibility.text}` : ''}\n\nWhich admission route are you considering? This process is not an admission guarantee.`, { evidence: [item, ...(eligibility ? [eligibility] : [])] });
    }
  }
  return null;
}
