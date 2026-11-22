// Scope decisions shared by English facts and native templates.
export function asksForAllPrograms(query) {
  return /\b(?:all|every)\b/.test(query) && /\b(?:branch\w*|program\w*|course\w*)\b/.test(query)
    || /not (?:only|just) (?:cse|computer science)/.test(query);
}

// Recognise academic-year ranges without treating an ISO calendar date as a range.
export function extractAcademicYears(text) {
  const years = [], invalid = [];
  for (const match of String(text).matchAll(/\b(20\d{2})[-/–](20\d{2}|\d{2})(?!\d|[-/]\d)/g)) {
    const start = Number(match[1]);
    const end = match[2].length === 4 ? Number(match[2]) : Math.floor(start / 100) * 100 + Number(match[2]);
    (end === start + 1 ? years : invalid).push(end === start + 1 ? `${start}-${String(end).slice(-2)}` : match[0]);
  }
  return { years: [...new Set(years)], invalid: [...new Set(invalid)] };
}

export const branchPatterns = {
  cse: /\bcse\b|(?<!electronics\s+(?:and|&)\s+)\bcomputer\s+(?:science|engineering|branch|dept|department)(?:\s+and\s+engineering)?\b/gi,
  civil: /\bcivil(?:\s+(?:engineering|branch|dept|department))?\b/gi,
  aids: /\bartificial intelligence(?: and data science)?\b|\baids\b|\bai\s*(?:&|and)\s*ds\b|\bdata science\b/gi,
  electronicsComputer: /\belectronics and computer(?: engineering)?\b/gi,
  entc: /\bentc\b|\be\s*&\s*tc\b|\belectronics and telecommunication(?: engineering)?\b/gi,
  mechanical: /\bmech\b|\bmechanical(?: and rail)?(?:\s+(?:engineering|branch|dept|department))?\b|\brail(?:way)? engineering\b/gi
};
export const servicePatterns = { hostel: /\bhostel\b/g, mess: /\bmess\b/g, transport: /\bbus\b|\btransport\b/g, library: /\blibrary\b|\bjournal\b/g };

const feeService = '(?:hostel|accommodation|mess|bus|transport(?:ation)?)(?:\\s+(?:fees?|charges?|costs?|deposit))?';
const excludedFeeServices = new RegExp(
  `[, ]+(?:but\\s+)?(?:do not include|don['’]t include|without|excluding|exclude|except)\\s+(?:the\\s+)?${feeService}\\b(?:\\s*(?:,\\s*(?:and\\s+)?|\\band\\s+|\\bor\\s+)${feeService}\\b)*`,
  'gi',
);

export function omitExcludedFeeServices(question) {
  return question.replace(excludedFeeServices, (clause, offset) =>
    /\b(?:fees?|tuition|charges?|costs?)\b/i.test(question.slice(0, offset)) ? '' : clause);
}

export function fieldValues(text, patterns) {
  const positive = new Set(), excluded = new Set(), mentions = [], excludedMentions = [];
  for (const [value, pattern] of Object.entries(patterns)) for (const match of text.matchAll(pattern)) {
    const before = text.slice(0, match.index);
    const after = text.slice(match.index + match[0].length);
    const negative = /\b(?:not|no|except|excluding)(?:\s+(?:an?|the|in|from))?\s*$/.test(before)
      || /^\s*(?:नाही|नहीं|नको|नव्हे)(?=\s|[.,?;]|$)/u.test(after);
    (negative ? excluded : positive).add(value);
    (negative ? excludedMentions : mentions).push(match[0]);
  }
  return { positive: [...positive], excluded: [...excluded], mentions: [...new Set(mentions)], excludedMentions: [...new Set(excludedMentions)] };
}

export function programmesForQuery(programmes, query) {
  const normalized = query.toLowerCase();
  const branches = fieldValues(normalized, branchPatterns).positive;
  if (branches.length !== 1 || asksForAllPrograms(normalized)) return programmes;
  return programmes.filter(programme => fieldValues(programme.name.toLowerCase(), branchPatterns).positive.includes(branches[0]));
}
