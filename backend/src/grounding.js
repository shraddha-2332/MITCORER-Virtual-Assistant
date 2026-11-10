/**
 * Evidence-Grounded Verification and Safe Abstention Engine for Mitra.
 *
 * Validates generated assistant output against retrieved evidence to ensure
 * factual grounding (preventing hallucinated dates, fees, percentages, codes)
 * and classifies answer outcome statuses (ANSWERED, INSUFFICIENT_EVIDENCE,
 * CONFLICTING_EVIDENCE, OUTDATED_EVIDENCE, ESCALATED).
 */

import { availability } from './provenance.js';
import { understandQuery } from './query-understanding.js';

// Bounded English clause attribution. Ambiguous prose is rejected rather than
// treating a correct number elsewhere in the answer as proof of this claim.
function verifyAmountBindings(text, slots, evidence) {
  const clauses = text.split(/\s+(?:and|but|while|whereas)\s+(?=(?:for\s+)?(?:open|oms|obc|ebc|ews|sebc|sc|st|vjnt|sbc|tfws|boys?|girls?|hostel|mess|deposit)\b)|[;\n]|[.!?](?:\s+|$)/i);
  for (const clause of clauses) {
    const query = understandQuery(clause);
    const tokens = extractFactualTokens(clause).numbers;
    for (const record of evidence) {
      const facts = record.facts;
      if (!facts) continue;
      if (facts.kind === 'academicFees') {
        const all = [...Object.values(facts.firstYear || {}), ...Object.values(facts.directSecondYear || {})].map(String);
        const amounts = [...tokens].filter(value => all.includes(value));
        if (!amounts.length) continue;
        if (amounts.length > 1 || query.category.positive.length > 1 || query.gender.positive.length > 1 || query.route.positive.length > 1) {
          return { verified: false, status: 'AMBIGUOUS_STRUCTURED_CLAIM' };
        }
        const localCategory = clause.match(/\b(open|oms|obc|ebc|ews|sebc|sc|st|vjnt|nt|sbc|tfws)\b/i)?.[1]?.toUpperCase();
        const cat = localCategory || String(slots.category || slots.quota || '').toUpperCase();
        const gender = query.gender.positive[0] || (/^(?:girl|girls|female)$/i.test(slots.gender || '') ? 'girl' : /^(?:boy|boys|male)$/i.test(slots.gender || '') ? 'boy' : null);
        let key;
        if (['OPEN', 'OMS'].includes(cat)) key = 'open';
        else if (['SC', 'ST'].includes(cat)) key = 'scst';
        else if (['VJNT', 'NT', 'SBC', 'TFWS'].includes(cat)) key = 'vjnt';
        else if (['OBC', 'EBC', 'EWS', 'SEBC'].includes(cat) && gender) key = gender === 'girl' ? 'concessionGirl' : 'concessionBoy';
        if (!key) return { verified: false, status: 'AMBIGUOUS_STRUCTURED_CLAIM' };
        const route = query.route.positive[0] || (/dse|direct.?second/i.test(slots.route || slots.yearLevel || '') ? 'directSecondYear' : /first.?year/i.test(slots.route || slots.yearLevel || '') ? 'firstYear' : null);
        const tables = route ? [facts[route]] : [facts.firstYear, facts.directSecondYear];
        if (!tables.some(table => table && String(table[key]) === amounts[0])) {
          return { verified: false, status: 'WRONG_SLOT_ERROR', reason: 'An amount contradicts its clause category, gender or admission route.' };
        }
      }
      if (facts.kind === 'accommodationFees') {
        const values = [facts.hostel, facts.refundableDeposit, facts.messAnnual].map(String);
        const amounts = [...tokens].filter(value => values.includes(value));
        if (!amounts.length) continue;
        if (amounts.length > 1) return { verified: false, status: 'AMBIGUOUS_STRUCTURED_CLAIM' };
        const service = /\bdeposit\b/i.test(clause) ? 'refundableDeposit' : /\bmess\b/i.test(clause) ? 'messAnnual' : /\bhostel\b/i.test(clause) ? 'hostel' : null;
        if (service && String(facts[service]) !== amounts[0]) {
          return { verified: false, status: 'WRONG_SLOT_ERROR', reason: 'An amount contradicts its clause service label.' };
        }
      }
    }
  }
  return { verified: true, status: 'SLOT_VERIFIED' };
}

// Normalize numeric string by stripping commas, currency symbols, and whitespace
export function normalizeNumber(token) {
  return String(token || '').replace(/[₹,$\s]/g, '').replace(/^inr/i, '').trim();
}

// Extract critical factual tokens (amounts, percentages, years, choice codes, dates)
export function extractFactualTokens(text) {
  const content = String(text || '');
  const tokens = {
    numbers: new Set(),
    percentages: new Set(),
    academicYears: new Set(),
    choiceCodes: new Set(),
    dates: new Set(),
    intakes: new Set(),
    helplineNumbers: new Set(),
    instituteCodes: new Set(),
    salaries: new Set(),
  };

  // 1. Academic years (e.g. 2026-27, 2024-25)
  for (const match of content.matchAll(/\b(20\d{2}-\d{2})\b/g)) {
    tokens.academicYears.add(match[1]);
  }

  // 2. Choice codes (9 to 11 digit numbers) and institute code (06901)
  for (const match of content.matchAll(/\b(06901\d{4,6}[A-Za-z]?)\b/g)) {
    tokens.choiceCodes.add(match[1]);
  }

  // 3. Percentages (e.g. 45%, 40 percent)
  for (const match of content.matchAll(/(\d+(?:\.\d+)?)\s*(?:%|percent\b)/gi)) {
    tokens.percentages.add(match[1]);
  }

  // 4. Currency amounts and significant numbers (e.g. INR 1,05,000, 35,000, 98000)
  for (const match of content.matchAll(/(?:\b(?:inr|rs\.?)|₹)\s*(\d[\d,]*(?:\.\d+)?)/gi)) {
    tokens.numbers.add(normalizeNumber(match[1]));
  }
  for (const match of content.matchAll(/(?:inr|rs\.?|₹)?\s*(\b\d{1,3}(?:,\d{2,3})+(?:\.\d+)?|\b\d{4,7}\b)/gi)) {
    const clean = normalizeNumber(match[1]);
    // Filter out calendar years (2020-2035) from pure fee numbers
    if (clean && !tokens.academicYears.has(clean)) {
      tokens.numbers.add(clean);
    }
  }

  // 5. Standard dates (e.g. 2026-06-30, 15 August 2026, 30 June)
  for (const match of content.matchAll(/\b(\d{1,2}\s+(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)(?:\s+\d{4})?)\b/gi)) {
    tokens.dates.add(match[1].toLowerCase());
  }
  for (const match of content.matchAll(/\b(\d{4}-\d{2}-\d{2})\b/g)) {
    tokens.dates.add(match[1]);
  }

  // 6. Explicit intake and seat capacities (e.g. 60 seats, intake of 120, capacity: 60)
  for (const match of content.matchAll(/(?:intake(?:\s+is|\s+of|:)?\s*(\b\d{1,4}\b))/gi)) {
    tokens.intakes.add(match[1]);
    tokens.numbers.add(match[1]);
  }
  for (const match of content.matchAll(/(\b\d{1,4}\b)\s*(?:seats?\b|intake\b)/gi)) {
    tokens.intakes.add(match[1]);
    tokens.numbers.add(match[1]);
  }

  // 7. Helpline phone numbers (10 digits starting with 6-9, with optional space/hyphen)
  for (const match of content.matchAll(/(?:\+91[\-\s]?)?\b([6-9]\d{4}[\-\s]?\d{5})\b/g)) {
    tokens.helplineNumbers.add(match[1].replace(/[\-\s]/g, ''));
  }

  // 8. DTE / Institute code references
  for (const match of content.matchAll(/\b(?:dte|institute|college)\s*(?:code)?\s*[:\-]?\s*(\b\d{4,5}\b)/gi)) {
    tokens.instituteCodes.add(match[1]);
  }

  // 9. Packages and salaries (e.g. 21 LPA, 4.4 LPA, 21 lakhs)
  for (const match of content.matchAll(/(\d+(?:\.\d+)?)\s*(?:lpa|lakhs?(?:\s+per\s+annum)?)\b/gi)) {
    tokens.salaries.add(match[1]);
  }

  return tokens;
}

// Check for unauthorized promissory claims or commitments
export function detectUnauthorizedClaims(text) {
  const content = String(text || '').toLowerCase();
  const prohibitedPatterns = [
    /(?<!\b(?:not|cannot|does\s+not|do\s+not|did\s+not|will\s+not|no|never)\s+)guaranteed?\s+admission\b/,
    /\b100%\s+admission\b/,
    /(?<!\b(?:not|cannot|does\s+not|do\s+not|did\s+not|will\s+not|no|never)\s+)admission\s+is\s+confirmed\b/,
    /(?<!\b(?:not|cannot|does\s+not|do\s+not|did\s+not|will\s+not|no|never)\s+)seat\s+is\s+guaranteed\b/,
    /\b100%\s+placement\s+guaranteed\b/,
    /(?<!\b(?:not|cannot|does\s+not|do\s+not|did\s+not|will\s+not|no|never)\s+)job\s+is\s+guaranteed\b/,
    /\bfree\s+education\s+for\s+everyone\b/,
    /\b100%\s+fee\s+waiver\s+guaranteed\b/,
    /\bdeadline\s+extended\s+indefinitely\b/,
    /\bdirect\s+admission\s+without\s+merit\b/,
    /(?<!\b(?:not|cannot|does\s+not|do\s+not|did\s+not|will\s+not|no|never)\s+)guaranteed?\s+(?:placement|job|internship|scholarship|seat|admission)\b/,
    /\b100%\s+(?:placement|scholarship|pass)\b/,
    /\blowest\s+fee\s+guaranteed\b/,
  ];

  for (const pattern of prohibitedPatterns) {
    if (pattern.test(content)) {
      return { hasViolation: true, pattern: pattern.toString() };
    }
  }
  return { hasViolation: false };
}

// Extract all verified factual tokens from evidence records (text, structured facts, provenance)
export function extractEvidenceTokens(evidenceList) {
  const allTokens = {
    numbers: new Set(),
    percentages: new Set(),
    academicYears: new Set(),
    choiceCodes: new Set(),
    dates: new Set(),
    intakes: new Set(),
    helplineNumbers: new Set(),
    instituteCodes: new Set(['06901', '6901']),
    salaries: new Set(),
  };

  const addTokens = (tokens) => {
    for (const item of tokens.numbers) allTokens.numbers.add(item);
    for (const item of tokens.percentages) allTokens.percentages.add(item);
    for (const item of tokens.academicYears) allTokens.academicYears.add(item);
    for (const item of tokens.choiceCodes) allTokens.choiceCodes.add(item);
    for (const item of tokens.dates) allTokens.dates.add(item);
    for (const item of tokens.intakes) allTokens.intakes.add(item);
    for (const item of tokens.helplineNumbers) allTokens.helplineNumbers.add(item);
    for (const item of tokens.instituteCodes) allTokens.instituteCodes.add(item);
    for (const item of tokens.salaries || []) allTokens.salaries.add(item);
  };

  for (const record of evidenceList || []) {
    if (typeof record.text === 'string') {
      addTokens(extractFactualTokens(record.text));
    }
    if (typeof record.title === 'string') {
      addTokens(extractFactualTokens(record.title));
    }
    // Also extract from structured facts if present
    if (record.facts && typeof record.facts === 'object') {
      if (record.facts.academicYear) allTokens.academicYears.add(record.facts.academicYear);
      const flattenNumbers = (obj) => {
        for (const val of Object.values(obj)) {
          if (typeof val === 'number') allTokens.numbers.add(String(val));
          else if (val && typeof val === 'object') flattenNumbers(val);
        }
      };
      flattenNumbers(record.facts);
      if (Array.isArray(record.facts.programs)) {
        for (const prog of record.facts.programs) {
          if (prog.choiceCode) allTokens.choiceCodes.add(prog.choiceCode);
          if (prog.intake) {
            allTokens.numbers.add(String(prog.intake));
            allTokens.intakes.add(String(prog.intake));
          }
        }
      }
    }
    // Extract provenance metadata
    if (record.provenance && typeof record.provenance === 'object') {
      if (record.provenance.academicYear) allTokens.academicYears.add(record.provenance.academicYear);
      if (record.provenance.validFrom) allTokens.dates.add(record.provenance.validFrom);
      if (record.provenance.validUntil) allTokens.dates.add(record.provenance.validUntil);
    }
  }

  return allTokens;
}

/**
 * Validate generated answer text against supporting evidence records.
 * Ensures all factual numbers, percentages, years, dates, and codes in the output
 * are strictly grounded in official evidence, rejecting any hallucinated values.
 */
export function verifyGeneratedAnswer(generatedText, evidenceList) {
  if (typeof generatedText !== 'string' || !generatedText.trim()) {
    return { verified: false, status: 'EMPTY_GENERATION' };
  }
  if (/\bINSUFFICIENT_EVIDENCE\b/i.test(generatedText)) {
    return { verified: false, status: 'INSUFFICIENT_EVIDENCE' };
  }
  if (!Array.isArray(evidenceList) || evidenceList.length === 0) {
    return { verified: false, status: 'NO_EVIDENCE' };
  }
  if (evidenceList.some(record => record.status && availability(record) !== 'available')) {
    return { verified: false, status: 'UNAVAILABLE_EVIDENCE' };
  }
  for (const match of generatedText.matchAll(/\[(\d+)\]/g)) {
    const index = Number(match[1]);
    if (!Number.isSafeInteger(index) || index < 1 || index > evidenceList.length) {
      return { verified: false, status: 'INVALID_CITATION' };
    }
  }
  for (const match of generatedText.matchAll(/\[((?:KB|SRC)-[^\]]+)\]/g)) {
    if (!evidenceList.some(record => record.id === match[1] || record.citationId === match[1])) return { verified: false, status: 'INVALID_CITATION' };
  }

  // 1. Prohibited promissory claim detection
  const claimCheck = detectUnauthorizedClaims(generatedText);
  if (claimCheck.hasViolation) {
    return {
      verified: false,
      status: 'PROMISSORY_CLAIM_REJECTED',
      reason: `Generated answer violates promissory policy: ${claimCheck.pattern}`,
    };
  }

  // 2. Factual claim extraction
  const generatedTokens = extractFactualTokens(generatedText);
  const evidenceTokens = extractEvidenceTokens(evidenceList);

  const unsupported = [];

  // Check numbers
  for (const num of generatedTokens.numbers) {
    if (!evidenceTokens.numbers.has(num)) {
      unsupported.push({ type: 'number', value: num });
    }
  }

  // Check percentages
  for (const pct of generatedTokens.percentages) {
    if (!evidenceTokens.percentages.has(pct)) {
      unsupported.push({ type: 'percentage', value: `${pct}%` });
    }
  }

  // Check academic years
  for (const yr of generatedTokens.academicYears) {
    if (!evidenceTokens.academicYears.has(yr)) {
      unsupported.push({ type: 'academicYear', value: yr });
    }
  }

  // Check choice codes
  for (const code of generatedTokens.choiceCodes) {
    if (!evidenceTokens.choiceCodes.has(code)) {
      unsupported.push({ type: 'choiceCode', value: code });
    }
  }

  // Check dates
  for (const dt of generatedTokens.dates) {
    if (!evidenceTokens.dates.has(dt)) {
      unsupported.push({ type: 'date', value: dt });
    }
  }

  // Check intake capacities
  for (const intake of generatedTokens.intakes) {
    if (!evidenceTokens.intakes.has(intake) && !evidenceTokens.numbers.has(intake)) {
      unsupported.push({ type: 'intake', value: `${intake} seats` });
    }
  }

  // Check helpline phone numbers
  for (const phone of generatedTokens.helplineNumbers) {
    if (!evidenceTokens.helplineNumbers.has(phone)) {
      unsupported.push({ type: 'helpline', value: phone });
    }
  }

  // Check DTE / institute codes
  for (const code of generatedTokens.instituteCodes) {
    if (!evidenceTokens.instituteCodes.has(code) && code !== '06901' && code !== '6901') {
      unsupported.push({ type: 'instituteCode', value: code });
    }
  }

  // Check packages and salaries
  for (const sal of generatedTokens.salaries) {
    if (!evidenceTokens.salaries.has(sal) && !evidenceTokens.numbers.has(sal)) {
      unsupported.push({ type: 'salary', value: `${sal} LPA` });
    }
  }

  if (unsupported.length > 0) {
    return {
      verified: false,
      status: 'UNSUPPORTED_FACTUAL_CLAIMS',
      reason: 'Generated answer contains factual claims not present in retrieved official evidence',
      unsupported,
    };
  }

  return { verified: true, status: 'VERIFIED' };
}

/**
 * Classify the overall answer outcome according to defined trustworthiness categories:
 * - ANSWERED: Grounded, valid answer backed by available evidence
 * - INSUFFICIENT_EVIDENCE: Missing or weak evidence; question declined safely
 * - CONFLICTING_EVIDENCE: Authoritative sources disagree
 * - OUTDATED_EVIDENCE: Source expired, superseded, or not effective
 * - ESCALATED: Question requires direct human/department escalation
 */
export function classifyAnswerOutcome(answer, evidence, evaluationTime = Date.now()) {
  if (answer.conflict) {
    return 'CONFLICTING_EVIDENCE';
  }

  if (evidence && evidence.some((rec) => availability(rec, evaluationTime) !== 'available')) {
    return 'OUTDATED_EVIDENCE';
  }

  if (answer.actionView === 'inquiry' && (!evidence || evidence.length === 0)) {
    return answer.source === 'No verified record' ? 'INSUFFICIENT_EVIDENCE' : 'ESCALATED';
  }

  if (answer.source === 'No verified record' || (!evidence || evidence.length === 0 && !answer.clarification && !answer.anchored)) {
    return 'INSUFFICIENT_EVIDENCE';
  }

  if (answer.clarification) {
    return 'INSUFFICIENT_EVIDENCE';
  }

  return 'ANSWERED';
}


/**
 * Slot-Bound Verifier for tabular and multi-attribute admission queries.
 *
 * Unlike token-level verifiers that only check if a number exists ANYWHERE
 * in retrieved evidence, verifySlotGrounding verifies that numbers in the
 * generated answer match the exact target cell for the queried slot tuple
 * (e.g. Category x Gender x Route x YearLevel), catching "wrong-row" errors
 * where an amount from a competing row in the same table is cited.
 */
export function verifySlotGrounding(generatedText, slots = {}, evidenceList = []) {
  if (typeof generatedText !== 'string' || !generatedText.trim()) {
    return { verified: false, status: 'EMPTY_GENERATION' };
  }

  // 1. First run baseline token-level check
  const baseCheck = verifyGeneratedAnswer(generatedText, evidenceList);
  if (!baseCheck.verified) {
    return baseCheck;
  }

  const generatedTokens = extractFactualTokens(generatedText);
  const isDse = (slots.yearLevel && ['directsecondyear', 'dse'].includes(String(slots.yearLevel).toLowerCase()))
    || (slots.route && ['dse', 'directsecondyear'].includes(String(slots.route).toLowerCase()));
  const normalizedSlots = {
    category: slots.category ? String(slots.category).toUpperCase().trim() : null,
    gender: slots.gender ? String(slots.gender).toLowerCase().trim() : null,
    route: slots.route ? String(slots.route).toUpperCase().trim() : null,
    quota: slots.quota ? String(slots.quota).toUpperCase().trim() : null,
    yearLevel: isDse ? 'directsecondyear' : 'firstyear',
    service: slots.service ? String(slots.service).toLowerCase().trim() : null,
    branch: slots.branch ? String(slots.branch).trim() : null,
  };

  if (slots.academicYear && !evidenceList.some(record => (record.facts?.academicYear || record.provenance?.academicYear) === slots.academicYear)) {
    return { verified: false, status: 'REQUESTED_YEAR_UNSUPPORTED' };
  }
  if (evidenceList.some(record => record.facts?.kind === 'academicFees')
    && ['OBC', 'EBC', 'EWS', 'SEBC'].includes(normalizedSlots.category)
    && !['female', 'girls', 'girl', 'male', 'boys', 'boy'].includes(normalizedSlots.gender)) {
    return { verified: false, status: 'REQUIRED_SLOT_MISSING', reason: 'Gender is required to resolve this concession fee.' };
  }

  // Find structured records in evidence
  for (const record of evidenceList) {
    if (!record.facts || typeof record.facts !== 'object') continue;

    // Check A: Academic fees matrix (KB-2)
    if (record.facts.kind === 'academicFees' && (normalizedSlots.category || normalizedSlots.gender || normalizedSlots.quota === 'TFWS')) {
      const yearTier = (normalizedSlots.yearLevel === 'directsecondyear' || normalizedSlots.yearLevel === 'dse')
        ? record.facts.directSecondYear
        : record.facts.firstYear;

      if (yearTier) {
        let expectedAmount = null;
        const cat = normalizedSlots.category;
        const isFemale = normalizedSlots.gender === 'female' || normalizedSlots.gender === 'girls' || normalizedSlots.gender === 'girl';

        if (normalizedSlots.quota === 'TFWS' || cat === 'TFWS') {
          expectedAmount = yearTier.concessionGirl || yearTier.vjnt;
        } else if (cat === 'OPEN' || (!cat && !isFemale)) {
          expectedAmount = yearTier.open;
        } else if (cat === 'SC' || cat === 'ST') {
          expectedAmount = yearTier.scst;
        } else if (cat === 'VJNT' || cat === 'NT' || cat === 'SBC') {
          expectedAmount = yearTier.vjnt || yearTier.concessionGirl;
        } else if (['OBC', 'EBC', 'EWS'].includes(cat)) {
          expectedAmount = isFemale ? yearTier.concessionGirl : yearTier.concessionBoy;
        } else if (isFemale) {
          expectedAmount = yearTier.concessionGirl;
        }

        if (expectedAmount !== null) {
          const expectedStr = String(expectedAmount);
          const allFeeAmounts = [
            ...Object.values(record.facts.firstYear || {}),
            ...Object.values(record.facts.directSecondYear || {}),
          ];
          const competingAmounts = [...new Set(allFeeAmounts.map(String))].filter((amt) => amt !== expectedStr);

          // Did the generated text state a competing fee instead of the expected one?
          const presentCompeting = competingAmounts.filter((amt) => generatedTokens.numbers.has(amt));
          const hasExpected = generatedTokens.numbers.has(expectedStr);

          if (presentCompeting.length > 0 && !hasExpected) {
            return {
              verified: false,
              status: 'WRONG_SLOT_ERROR',
              reason: `Generated answer cites alternative slot fee (${presentCompeting.join(', ')}) instead of target slot fee (${expectedStr})`,
              expected: expectedAmount,
              found: presentCompeting,
              slot: { category: cat, gender: normalizedSlots.gender, yearLevel: normalizedSlots.yearLevel },
            };
          }
        }
      }
    }

    // Check B: Accommodation fees matrix (KB-3)
    if (record.facts.kind === 'accommodationFees' && normalizedSlots.service) {
      let expectedServiceAmount = null;
      if (normalizedSlots.service.includes('mess')) {
        expectedServiceAmount = record.facts.messAnnual;
      } else if (normalizedSlots.service.includes('deposit')) {
        expectedServiceAmount = record.facts.refundableDeposit;
      } else if (normalizedSlots.service.includes('hostel')) {
        expectedServiceAmount = record.facts.hostel;
      }

      if (expectedServiceAmount !== null) {
        const expectedStr = String(expectedServiceAmount);
        const competingAmounts = [
          String(record.facts.hostel),
          String(record.facts.refundableDeposit),
          String(record.facts.messAnnual),
        ].filter((amt) => amt !== expectedStr);

        const presentCompeting = competingAmounts.filter((amt) => generatedTokens.numbers.has(amt));
        const hasExpected = generatedTokens.numbers.has(expectedStr);

        if (presentCompeting.length > 0 && !hasExpected) {
          return {
            verified: false,
            status: 'WRONG_SLOT_ERROR',
            reason: `Generated answer cites alternative accommodation fee (${presentCompeting.join(', ')}) instead of requested ${normalizedSlots.service} fee (${expectedStr})`,
            expected: expectedServiceAmount,
            found: presentCompeting,
            slot: { service: normalizedSlots.service },
          };
        }
      }
    }

    // Check C: Program intake & choice code matrix (KB-10)
    if (record.facts.kind === 'programIntake' && normalizedSlots.branch && Array.isArray(record.facts.programs)) {
      const branchLower = normalizedSlots.branch.toLowerCase();
      const targetProgram = record.facts.programs.find((p) =>
        p.name.toLowerCase().includes(branchLower) || branchLower.includes(p.name.toLowerCase())
      );

      if (targetProgram) {
        const otherCodes = record.facts.programs.filter(program => program !== targetProgram).map(program => program.choiceCode).filter(Boolean);
        if (targetProgram.choiceCode && !generatedTokens.choiceCodes.has(targetProgram.choiceCode)
          && otherCodes.some(code => generatedTokens.choiceCodes.has(code))) {
          return { verified: false, status: 'WRONG_SLOT_ERROR', reason: 'A competing programme choice code was assigned without the target code.' };
        }
        const expectedIntake = String(targetProgram.intake);
        const competingIntakes = record.facts.programs
          .map((p) => String(p.intake))
          .filter((intk) => intk !== expectedIntake);

        const presentCompeting = competingIntakes.filter((intk) => generatedTokens.intakes.has(intk));
        const hasExpected = generatedTokens.intakes.has(expectedIntake) || generatedTokens.numbers.has(expectedIntake);

        if (presentCompeting.length > 0 && !hasExpected) {
          return {
            verified: false,
            status: 'WRONG_SLOT_ERROR',
            reason: `Generated answer cites competing program intake (${presentCompeting.join(', ')}) instead of ${targetProgram.name} intake (${expectedIntake})`,
            expected: targetProgram.intake,
            found: presentCompeting,
            slot: { branch: normalizedSlots.branch },
          };
        }
      }
    }
  }

  return verifyAmountBindings(generatedText, slots, evidenceList);
}
