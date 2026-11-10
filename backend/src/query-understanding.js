import { normalizeLocalTerms } from './language.js';
import { extractAcademicYears, branchPatterns, servicePatterns, fieldValues } from './query-scope.js';

// A bounded domain parser, not general language understanding or an LLM classifier.
const typoVocabulary = ['admission', 'scholarship', 'library', 'hostel', 'document', 'placement', 'transport', 'programme', 'program', 'eligible', 'eligibility', 'intake', 'attendance', 'engineering', 'polytechnic', 'mechanical'];
const plural = { fees: 'fee', prices: 'price', charges: 'charge', costs: 'cost', payments: 'payment', installments: 'installment', instalments: 'installment', semesters: 'semester', girls: 'girl', females: 'girl', women: 'girl', boys: 'boy', males: 'boy', men: 'boy', documents: 'document', certificates: 'certificate', scholarships: 'scholarship', placements: 'placement', libraries: 'library', programmes: 'programme', programs: 'program', courses: 'course', branches: 'branch', hostels: 'hostel', journals: 'journal' };
function oneEdit(left, right) {
  if (Math.abs(left.length - right.length) > 1) return false;
  if (left.length === right.length) {
    const differences = [...left].flatMap((letter, index) => letter === right[index] ? [] : [index]);
    return differences.length === 1 || differences.length === 2 && differences[1] === differences[0] + 1
      && left[differences[0]] === right[differences[1]] && left[differences[1]] === right[differences[0]];
  }
  const shorter = left.length < right.length ? left : right;
  const longer = left.length < right.length ? right : left;
  let index = 0;
  while (shorter[index] === longer[index] && index < shorter.length) index++;
  return shorter.slice(index) === longer.slice(index + 1);
}
export function isEmploymentQuery(text) {
  const norm = String(text || '').normalize('NFKC').toLowerCase();
  const hasDevanagariJob = /(?:भरती|भर्ती|नोकरीसाठी|नोकरी\s*के\s*लिए|रिक्त\s*जागा|रिक्त\s*पदों|अध्यापक|कर्मचारी\s*भरती|शिक्षक\s*भरती|शिक्षक\s*भर्ती|प्राध्यापक\s*भरती|पदासाठी\s*अर्ज|पद\s*के\s*लिए\s*आवेदन|क्लार्क|लॅब\s*असिस्टंट|असिस्टेंट\s*प्रोफेसर\s*पद)/u.test(norm);
  if (hasDevanagariJob) return true;

  const hasJobTerms = /\b(?:hiring|recruitment|recruiting|vacancy|vacancies|job openings?|work with us|careers? at (?:mitcorer|mit|the college)|faculty recruitment|staff recruitment|teacher recruitment|wanted)\b/i.test(norm);
  const hasStaffRole = /\b(?:faculty|teacher|teachers|professor|professors|staff|teaching|non[- ]teaching|lecturer|lecturers|assistant professor|instructor|clerk|peon|employee|employees|lab assistant)\b/i.test(norm);
  const hasEmploymentAction = /\b(?:apply for (?:a )?(?:teaching )?(?:job|post)|apply for teaching|apply for faculty|apply for staff|how to apply for.*(?:job|post|vacancy)|job application|staff hiring|faculty hiring|teacher hiring|recruitment process of (?:faculty|staff|teachers?)|staff recruitment)\b/i.test(norm);

  if (hasEmploymentAction) return true;
  if (hasJobTerms && hasStaffRole) return true;
  if (/\b(?:staff|faculty|teacher|professor)\s+(?:hiring|recruitment|vacancy|vacancies|jobs?|openings?)\b/i.test(norm)) return true;
  if (/\b(?:hiring|recruitment|vacancy|vacancies|jobs?|openings?)\s+(?:for|of|in)\s+(?:staff|faculty|teacher|professor|assistant professor)\b/i.test(norm)) return true;
  if (/^(?:staff hiring|faculty recruitment|teacher recruitment|job openings for teachers|careers at mitcorer|careers at mit)$/i.test(norm.trim())) return true;
  return false;
}

export function matchesIntent(text, phrase) {
  const escaped = phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(?<![\\p{L}\\p{M}\\p{N}_])${escaped}(?![\\p{L}\\p{M}\\p{N}_])`, 'iu').test(text);
}
export function normalizeQuery(input) {
  let text = normalizeLocalTerms(input || '').normalize('NFKC').toLowerCase();
  const native = [
    [/फेरी|राउंड/gu, ' round '],
    [/तसेच|तसंच|तथा|साथ ही|इसके अलावा/gu, ' and '],
    [/मुली|लड़कियों|लड़कियां|महिलाओं/gu, ' girl '], [/मुलगे|लड़कों/gu, ' boy '],
    [/पात्रता|पात्र|योग्य/gu, ' eligible '], [/कट\s?ऑफ|कटऑफ|कटऑफ/gu, ' cutoff '],
    [/टक्केवारी|प्रतिशत/gu, ' percent '], [/प्रवेश|दाखला/gu, ' admission '],
    [/कागदपत्रे?|दस्तावेज/gu, ' document '], [/शिष्यवृत्ती|छात्रवृत्ति/gu, ' scholarship '],
    [/प्लेसमेंट|नोकरी/gu, ' placement '], [/संगणक\s?अभियांत्रिकी|कंप्यूटर\s?साइंस/gu, ' cse '],
    [/तारखा|मुदत|तिथियां|अंतिम\s*समय|तारीख|अंतिम\s*तारीख/gu, ' deadline '],
    [/परिवहन/gu, ' transport '], [/संपर्क|फोन|पत्ता/gu, ' contact '],
    [/रिक्त\s*(?:जागा|सीटें|सीट)|खाली\s*सीटें|रिक्तियों/gu, ' vacancy '],
    [/सध्या|अभी|वर्तमान(?: में)?/gu, ' current '],
    [/कंपन्यांच्या\s*भेटी|कंपनियों\s*(?:के\s*)?दौरे|कंपनी\s*विज़िट/gu, ' placement companies visiting '],
    [/नियुक्त\s*विद्यार्थी|नियुक्त\s*छात्र|प्लेस्ड\s*स्टूडेंट्स/gu, ' students placed '],
    [/सर्वोच्च\s*पॅकेज|उच्चतम\s*पैकेज/gu, ' highest package '],
    [/सरासरी\s*पॅकेज|औसत\s*पैकेज/gu, ' average package '],
    [/जागा\s*रिक्त|सीटें\s*खाली|खाली\s*हैं/gu, ' vacancy '],
    [/हमी|गारंटी|हमखास|पक्का\s*प्रवेश/gu, ' guarantee '],
    [/पूर्ण\s*नाव|पूरा\s*नाम/gu, ' full name '],
    [/जमा\s*(?:होईल|होगी|होगा)|रक्कम\s*जमा|राशि\s*जमा/gu, ' scholarship deposited '],
    [/तारखेला|तारीख\s*को|किस\s*तारीख|कौन\s*सी\s*तारीख/gu, ' exact date '],

    // Devanagari facility, sports, transit, and affiliation terms
    [/(?<![\p{L}\p{M}])(?:खेळांसाठी|खेळ|क्रीडा|मैदाने|मैदान|खेल)(?![\p{L}\p{M}])/gu, ' sports grounds '],
    [/जिम|व्यायामशाळा/gu, ' campus gym '],
    [/क्रिकेट/gu, ' cricket '],
    [/व्हॉलीबॉल|वॉलीबॉल/gu, ' volleyball '],
    [/बॅडमिंटन|बैडमिंटन/gu, ' badminton '],
    [/प्रायोगिक\s*प्रशिक्षणासाठी|प्रायोगिक\s*प्रशिक्षण|प्रायोगिक|प्रशिक्षण|प्रैक्टिकल\s*ट्रेनिंग/gu, ' practical training '],
    [/सेंट्रल\s*वर्कशॉपमध्ये|सेंट्रल\s*वर्कशॉप|केंद्रीय\s*कार्यशाळा/gu, ' central workshop '],
    [/कार्यशाळा|वर्कशॉप/gu, ' workshop '],
    [/वेल्डिंग/gu, ' welding '],
    [/विद्यापीठाशी|विद्यापीठ|विश्वविद्यालय/gu, ' university '],
    [/संलग्न|संबद्ध/gu, ' affiliation affiliated '],
    [/डीटीई|डी\.टी\.ई\.|dte/gu, ' dte '],
    [/इन्स्टिट्यूट|संस्था/gu, ' institute '],
    [/रेल्वे\s*स्टेशनपासून|रेल्वे\s*स्टेशन|रेलवे\s*स्टेशन|स्थानक/gu, ' nearest railway station '],
    [/अंतरावर|अंतर|दूरी/gu, ' distance '],
    [/कॅम्पस|परिसर/gu, ' campus '],
    [/रॅगिंग\s*प्रतिबंधक|रॅगिंग|रैगिंग\s*की\s*रोकथाम|रैगिंग/gu, ' anti-ragging ragging '],
    [/सुरक्षा\s*व्यवस्था|सुरक्षा\s*नियम|सुरक्षा/gu, ' campus safety '],
    [/समिती|समिति/gu, ' committee '],
    [/ग्रंथालय|वाचनालय|पुस्तकालय|लाइब्रेरी/gu, ' library '],
    [/डिजिटल\s*संसाधने|डिजिटल\s*संसाधनों|डिजिटल\s*संसाधन/gu, ' digital resources '],
    [/सिव्हिल|सिविल/gu, ' civil engineering '],
    [/मेकॅनिकल|मैकेनिकल/gu, ' mechanical engineering '],
    [/शाखेसाठी|शाखांची|शाखाओं|शाखा|ब्रांच/gu, ' branch '],
    [/जागा|सीटें|सीट|प्रवेशक्षमता|प्रवेश\s*क्षमता/gu, ' intake seat '],
    [/मंजूर|स्वीकृत/gu, ' sanctioned approved '],
    [/कार्यालयीन\s*वेळ|कार्यालय\s*का\s*समय|कार्यालय\s*वेळ/gu, ' office hours timings '],
    [/हेल्पलाइन\s*नंबर|हेल्पलाइन|सहायता\s*नंबर/gu, ' admission helpline number '],
    [/प्रवेश\s*कार्यालय|दाखला\s*कार्यालय/gu, ' admission office '],
    [/रेल्वे\s*(?:ट्रॅक\s*)?टेक्नॉलॉजी|रेलवे\s*(?:ट्रैक\s*)?टेक्नोलॉजी/gu, ' railway track technology '],
    [/सिग्नलिंगचे|सिग्नलिंग|सिग्नल/gu, ' railway signaling '],
    [/विशेष\s*अभ्यासक्रम|विशेष\s*डिप्लोमा|डिप्लोमा\s*अभ्यासक्रम|डिप्लोमा\s*पाठ्यक्रम|डिप्लोमा/gu, ' professional diploma railway diploma '],
  ];
  for (const [pattern, replacement] of native) text = text.replace(pattern, replacement);
  // Correct only unique one-edit long domain words. Never fuzzy-match caste codes or numbers.
  text = text.replace(/\b[a-z]+\b/g, word => {
    if (word === 'seats') return 'seat';
    if (plural[word]) return plural[word];
    if (word.length < 6 || typoVocabulary.includes(word)) return word;
    const candidates = typoVocabulary.filter(candidate => oneEdit(word, candidate) || word.endsWith('s') && oneEdit(word.slice(0, -1), candidate));
    return candidates.length === 1 ? candidates[0] : word;
  });
  const phrases = [
    [/\b(?:tuition bill|teaching fee|tuition|price|pricing|payable)\b/g, 'academic fee'],
    [/\b(?:hosstl|hostal|hustel)\b/g, 'hostel'],
    [/\b(?:admision|addmission)\b/g, 'admission'],
    [/\b(?:placment|plcmnt)\b/g, 'placement'],
    [/\b(?:sylabus|sylbus)\b/g, 'syllabus'],
    [/\bjoining year two\b/g, 'direct second year'], [/\bjoining year one\b/g, 'first year'],
    [/\bfirst[- ]year\b/g, 'first year'], [/\baccommodation\b/g, 'hostel'], [/\bdining\b/g, 'mess'],
    [/\btransportation\b|\binstitute-operated vehicle\b/g, 'bus transport'],
    [/\b(?:proofs|papers)\b/g, 'document'],
    [/\b(?:electronic reading resources|reading resources|borrowed book|borrow books|book borrowing)\b/g, 'library'],
    [/\beligibility\b|\byogya\b|\bpatra\b/g, 'eligible'],
    [/\bcut[- ]?off\b/g, 'cutoff'],
    ...(!isEmploymentQuery(input) ? [[/\bjob\b/g, 'placement']] : []),
    [/\b(cse|computer science|civil engineering|mechanical engineering) capacity\b/g, '$1 intake'],
    [/\bseat\s+(?:and\s+intake|intake\s+matrix|matrix)\b/g, 'seat matrix'],
    [/\b(?:also|plus|as well as)\b/g, 'and'],
  ];
  for (const [pattern, replacement] of phrases) text = text.replace(pattern, replacement);
  return text.replace(/\s+/g, ' ').trim();
}

const fields = {
  route: { firstYear: /\bfirst year\b|\bfy\b|\b1st year\b/g, directSecondYear: /\bdirect second year\b|\bdse\b|\blateral entry\b/g },
  category: { scst: /\bsc\b|\bst\b|\bscheduled caste\b|\bscheduled tribe\b/g, vjnt: /\bvjnt\b|\bvj\b|\bnt\b|\bsbc\b|\btfws\b/g, concession: /\bebc\b|\bews\b|\bobc\b|\bsebc\b/g, open: /\bopen\b|\boms\b|\bgeneral category\b|(?:ओपन|खुला)\s*(?:प्रवर्ग|श्रेणी|कॅटेगरी|वर्ग)/gu },
  gender: { boy: /\bboy\b|\bmale\b|\bson\b/g, girl: /\bgirl\b|\bfemale\b|\bwoman\b|\bdaughter\b/g },
  branch: branchPatterns,
  service: servicePatterns,
};
export function understandQuery(input) {
  const normalized = normalizeQuery(input);
  const values = Object.fromEntries(Object.entries(fields).map(([name, patterns]) => [name, fieldValues(normalized, patterns)]));
  // A school qualification alone is not an admission route. An explicit transition is.
  if (!values.route.positive.length && !values.route.excluded.length
    && /\b(?:join|enter|start)\b[^.?!;]*\bengineering\b[^.?!;]*\bafter (?:class 12|12th)\b/.test(normalized)) values.route.positive.push('firstYear');
  if (values.category.positive.includes('open') && values.category.positive.includes('concession')
    && /\bopen\s*\(?\s*(?:ebc|ews|obc|sebc)\b/.test(normalized)) values.category.positive = values.category.positive.filter(value => value !== 'open');
  const { years: academicYears, invalid: invalidYears } = extractAcademicYears(normalized);
  const topics = [];
  if (/\bseat matrix\b/.test(normalized)) topics.push('seatMatrix');
  const fee = /\b(?:fee|payment|amount|charge|cost|deposit|installments?|pay)\b/.test(normalized)
    && (!/\b(?:scholarship|pragati|mahadbt|nsp|financial aid)\b/.test(normalized)
      || /\b(?:fee|fees|tuition|charge|cost|deposit|pay)\b/.test(normalized));
  const services = values.service.positive;
  if (fee) topics.push(services.some(service => ['hostel', 'mess'].includes(service)) ? 'accommodationFees' : services.includes('transport') ? 'transport' : 'academicFees');
  if (/\b(?:intake|choice code|programme|program|course|branch)\b/.test(normalized)) topics.push('programmes');
  if (services.includes('library')) topics.push('library');
  if (services.includes('transport')) topics.push('transport');
  if (services.some(service => ['hostel', 'mess'].includes(service)) && !fee) topics.push('hostel');
  const route = values.route.positive.length === 1 ? values.route.positive[0] : null;
  const level = /\bpolytechnic\b|\bdiploma (?:fee|course|program)/.test(normalized) ? 'polytechnic'
    : /\b(?:class 12|12th|school|junior college) (?:fee|cost|charge)\b/.test(normalized) ? 'school' : 'engineering';
  return { normalized, topics: [...new Set(topics)], admissionRoute: route, level, academicYears: [...new Set(academicYears)], invalidYears, ...values };
}

export function queryClarification(query) {
  const q = understandQuery(query);
  const asksUniformity = /\b(?:same for every|same for all|identical for all)\b/.test(q.normalized)
    || /(?:सारखीच|एक जैसी|समान)/u.test(String(query));
  const table = !asksUniformity && /\b(?:all|every|table|structure|category-wise|compare|comparison|versus|vs|both)\b/.test(q.normalized);
  if (q.invalidYears.length) return { kind: 'year', message: 'Please specify a valid consecutive academic year and admission route.' };
  if (q.topics.includes('academicFees') && !table) {
    if (!q.category.positive.length && !q.category.excluded.length && !/\b(?:structure|schedule|breakdown|category-wise)\b/.test(q.normalized)
      && (/\b(?:same for every|same for all|fee for engineering|fee for first year|how much.*pay for admission)\b/.test(q.normalized)
        || asksUniformity
        || /(?:पहिल्या वर्षाची|प्रथम वर्ष की).*(?:fee|फी|शुल्क)/u.test(String(query))
        || /(?:पहिल्या वर्षाची|प्रथम वर्ष की).*(?:fee|फी|शुल्क)/u.test(q.normalized))) {
      return { kind: 'feeCategory', message: 'Which category or concession applies to you (Open, EBC, OBC, SC, ST, VJNT)? Fees vary significantly by category and gender.' };
    }
    const feeScopeAllowed = (!/^(?:what (?:is|are) )?b\.?tech fees?\??$/i.test(String(query).trim())
      && !/^what is the fee for b\.?tech\??$/i.test(String(query).trim()))
      && (/\b(?:academic|engineering|b\.tech|tuition|first year|direct second|dse|polytechnic|college fees?|payment process)\b/.test(q.normalized)
        || /non-cap|acap|institute.level|applying after\s+cap/.test(q.normalized)
        || q.branch.positive.length > 0);
    if (!q.admissionRoute && !q.route.positive.length && !q.category.positive.length && !q.category.excluded.length
      && !q.service.positive.length && !feeScopeAllowed) {
      return { kind: 'feeScope', message: 'Which fee do you mean—academic, hostel, mess, or transport? Please also specify First Year or Direct Second Year and the applicable category.' };
    }
    if (q.service.excluded.length && !q.service.positive.length && !q.admissionRoute && !/\bacademic\b|\bengineering\b|\btuition\b/.test(q.normalized)) return { kind: 'feeScope', message: 'Which fee do you mean: academic, hostel, mess or transport? Please specify the fee and admission route.' };
    if (q.category.excluded.length && !q.category.positive.length) return { kind: 'category', message: 'Please specify the applicable category or concession; an excluded category does not identify your fee amount.' };
    if (q.category.positive.length === 1 && q.category.positive[0] === 'concession' && q.gender.positive.length !== 1) return { kind: 'feeGender', message: 'For EBC/EWS/OBC/SEBC fees, please specify boys or girls and the admission route so I can select the applicable amount.' };
    if (q.category.positive.length > 1 && /\bi am\b|\bmy category\b/.test(q.normalized)) return { kind: 'category', message: 'Please confirm the single category or concession applicable to your fee question.' };
  }
  if (/\b(?:document|certificate)\w*\b/.test(q.normalized)
    && !q.category.positive.length
    && !q.route.positive.length && !/\b(?:general checklist|all routes|all categories|document checklist|admission reporting|open category|required admission documents?|admission documents? required)\b/.test(q.normalized)) {
    return { kind: 'documents', message: 'Are you applying for First Year or Direct Second Year, and which category or concession should I check? Document requirements can differ by route and claim.' };
  }
  if ((/\b(?:am i|can i|will i|my)\b[^?]{0,50}\b(?:eligible|eligibility|qualify)\b/.test(q.normalized)
      || /(?:मी|मैं).{0,35}(?:पात्र|योग्य)|(?:am i|मी).{0,30}eligible/u.test(String(query)))
    && !/\b(?:scholarship|ebc|tfws|concession)\b/.test(q.normalized)
    && !/\b(?:subjects?|marks?|score|percentile|percent|category|route|first year|direct second|dse|polytechnic)\b/.test(q.normalized)
    && !/\b\d+\s*(?:percent|%|marks?)\b/.test(q.normalized)) {
    return { kind: 'personalEligibility', message: 'Which programme and admission route are you asking about? Eligibility depends on your qualifying subjects and marks, entrance exam, and candidature. Please do not share personal identifiers.' };
  }
  if ((/\b(?:can i|will i|am i|my)\b[^?]{0,65}\b(?:get|receive|eligible for|qualify for)\b[^?]{0,35}\bscholarship\b/.test(q.normalized)
      || /(?:मला|मुझे|क्या मैं).{0,45}(?:शिष्यवृत्ती|छात्रवृत्ति).{0,35}(?:मिळ|मिल|पात्र|योग्य)|(?:शिष्यवृत्ती|छात्रवृत्ति).{0,45}(?:मिळेल|मिलेगी|मिल सकती)/u.test(String(query)))
    && !/\b(?:pragati|mahadbt|nsp|specific scheme|scheme name)\b/.test(q.normalized)) {
    return { kind: 'scholarshipScope', message: 'Which scholarship scheme do you mean, and what broad category or eligibility condition should I check? Eligibility is scheme-specific; please do not share personal documents or identifiers.' };
  }
  if (q.topics.includes('programmes') && q.branch.excluded.length && !q.branch.positive.length && !table) return { kind: 'programme', message: 'Which programme do you mean? Please specify the branch and admission route.' };
  if (/\bsecond year\b/.test(q.normalized) && !q.route.positive.length && /\bfee\b/.test(q.normalized)) return { kind: 'route', message: 'Do you mean Direct Second Year admission or fees for a continuing second-year student? Please specify the admission route.' };
  return null;
}

export function splitQueryClauses(query) {
  const names = [
    'computer science and engineering',
    'artificial intelligence and data science',
    'ai and data science',
    'electronics and computer engineering',
    'electronics and telecommunication engineering',
    'mechanical and rail engineering',
  ];
  let protectedText = query;
  names.forEach((name, index) => { protectedText = protectedText.replaceAll(name, `__branch_${index}__`); });
  return protectedText.split(/\s+(?:and|also|plus|as well as)\s+|[?;।]+\s*|[.!]\s+(?=(?:what|which|how|tell|show|list|does|is|can)\b)|,\s*(?=(?:what|which|how|tell|show|list|does|is|can)\b)/i)
    .map(part => { names.forEach((name, index) => { part = part.replaceAll(`__branch_${index}__`, name); }); return part.trim(); }).filter(Boolean);
}
