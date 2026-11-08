import crypto from 'node:crypto';
import { badRequest } from './errors.js';
import { extractAcademicYears, programmesForQuery, servicePatterns, fieldValues } from './query-scope.js';
import { usableKnowledge } from './provenance.js';

export const supportedLanguages = ['auto', 'en', 'mr', 'hi'];
export const normalizeDigits = (text) => String(text).replace(/[०-९]/g, (digit) => String(digit.charCodeAt(0) - 0x0966));
export function selectLanguage(question, preference = 'auto') {
  if (!supportedLanguages.includes(preference)) throw badRequest('Supported languages are auto, en, mr and hi.');
  if (preference !== 'auto') return preference;
  const text = String(question).normalize('NFKC').toLowerCase();
  const named = text.match(/\b(?:answer|reply|respond|speak|explain)\s+(?:to me\s+)?(?:in\s+)?(english|marathi|hindi)\b/)
    || text.match(/^\s*(?:please\s+)?in\s+(english|marathi|hindi)\b/);
  if (named) return { english: 'en', marathi: 'mr', hindi: 'hi' }[named[1]];
  if (/मराठीत|मराठी/.test(text)) return 'mr';
  if (/हिंदी|हिन्दी/.test(text)) return 'hi';
  const marathi = /मला|सांगा|आहे|किती|मध्ये|त्याची|कोणता|प्रवेश|शुल्क|वसतिगृह/.test(text);
  const hindi = /मुझे|बताइए|कितना|क्या|उसकी|उसका|\sहै(?:\s|[?.]|$)/.test(text);
  return marathi !== hindi ? (marathi ? 'mr' : 'hi') : 'en';
}

export function normalizeLocalTerms(question) {
  let text = normalizeDigits(String(question).normalize('NFKC'));
  text = text.replace(/^(?:please\s+)?(?:answer|reply|respond)(?:\s+to me)?\s+in\s+(?:english|marathi|hindi)\s*[:,]?\s*(?:and\s+)?/i, '');
  const replacements = [
    // Common Marathi and Hindi question forms need to normalize before intent routing.
    [/तुमच्या कॉलेजमध्ये कोणते इंजिनिअरिंग कोर्स आहेत|आपके कॉलेज में कौन-कौन से इंजीनियरिंग कोर्स उपलब्ध हैं/gu, ' list engineering programmes '],
    [/कॉलेज कुठे आहे|कॉलेज कहाँ स्थित है/gu, ' where is the college located '],
    [/मुलींसाठी हॉस्टेल आहे का|क्या लड़कियों के लिए हॉस्टल है/gu, ' are girls hostel facilities available '],
    [/और हॉस्टल की सुविधा है क्या/gu, ' are hostel facilities available '],
    [/कॉलेजमध्ये स्कॉलरशिप मिळते का|कॉलेज में स्कॉलरशिप मिलती है क्या/gu, ' what scholarship schemes are available '],
    [/कॉलेजचे प्राचार्य कोण आहेत|कॉलेज के प्राचार्य कौन हैं/gu, ' who is the principal '],
    [/कॉम्पुटर इंजिनियरिंग ची फिस किती/gu, ' computer engineering fee '],
    [/प्लेसमेन्ट कसे आहेत/gu, ' placement highlights '],
    [/सिव्हिल इंजिनिअरिंगचा कटऑफ किती आहे|सिव्हिल इंजीनियरिंग का कटऑफ कितना है/gu, ' civil engineering cutoff '],
    // Devanagari mappings
    [/जागा\s+आणि\s+प्रवेश\s+क्षमता|सीट\s*मैट्रिक्स/gu, ' seat matrix '],
    [/संगणक विज्ञान आणि अभियांत्रिकी|कंप्यूटर साइंस एंड इंजीनियरिंग/gu, ' cse '],
    [/प्रवेश क्षमता|प्रवेशक्षमता|प्रवेश की क्षमता/gu, ' intake '],
    [/इंटेक/gu, ' intake '],
    [/पहिल्या वर्ष(?:ाची|ाचे|ाच्या)?|प्रथम वर्ष(?:ाच्या|ाचे|ाची)?|पहिले वर्ष|पहले वर्ष/gu, ' first year '],
    [/थेट दुसऱ्या वर्ष(?:ाची|ाचे)?|थेट दुसरे वर्ष|सीधे द्वितीय वर्ष/gu, ' direct second year '],
    [/वसतिगृह|छात्रावास|होस्टेल/gu, ' hostel '], [/मेस/gu, ' mess '],
    [/ग्रंथालय|पुस्तकालय/gu, ' library '], [/बस सुविधा|बस/gu, ' bus '],
    [/अभ्यासक्रम|पाठ्यक्रम/gu, ' courses '], [/शुल्क|फीस|फी/gu, ' fee '],
    [/मुलांसाठी|मुलगा|लड़का|लड़के/gu, ' boy '], [/मुलींसाठी|मुलगी|लड़की/gu, ' girl '],
    [/त्याची|त्याचे|उसकी|उसका/gu, ' its '], [/आणि|और/gu, ' and '],
    [/राहण्याचा|रहने/gu, ' hostel '], [/जेवणाचा|खाने/gu, ' mess '],
    [/खर्च|भुगतान|पैसे/gu, ' cost '], [/ठेव|जमा राशि/gu, ' deposit '],
    [/त्यासाठी/gu, ' its '], [/चॉइस कोड/gu, ' choice code '],
    [/शाखांची|शाखाओं/gu, ' branches '], [/सर्व|सभी/gu, ' all '],

    // Romanized Marathi & Hindi mappings to English search equivalents
    [/\b(?:admission sathi docs konti pahijet|admission ke liye kaun se documents chahiye)\b/gi, ' admission documents required '],
    [/\b(?:placement kase aahet|placement kaise hain)\b/gi, ' placement highlights '],
    [/\b(?:shulka|fees?|fee)\b/gi, ' fee '],
    [/\b(?:fee kiti|kiti fee|kiti kharch|kiti paise)\b/gi, ' fee '],
    [/\b(?:vasatigruh|vasatigruha|chhatravas)\b/gi, ' hostel '],
    [/\b(?:pravesh|dakhila|dakhla)\b/gi, ' admission '],
    [/\b(?:granthalay|pustakalay)\b/gi, ' library '],
    [/\b(?:kramank|choice code)\b/gi, ' choice code '],
    [/\b(?:mahiti|jaankari|jankari)\b/gi, ' information '],
    [/\b(?:sangnak|sangnak vibhag)\b/gi, ' computer engineering '],
  ];
  for (const [pattern, replacement] of replacements) text = text.replace(pattern, replacement);
  return text;
}

export const sourceTextHash = (text) => crypto.createHash('sha256').update(text).digest('hex');
export function numericTokens(text) {
  return new Set((normalizeDigits(text).match(/\d+(?:,\d+)*(?:\.\d+)?(?:-\d+)?/g) || []).map((token) => token.replaceAll(',', '')));
}
export function sameNumbers(left, right) {
  const a = numericTokens(left); const b = numericTokens(right);
  return a.size === b.size && [...a].every((token) => b.has(token));
}
export function validateTranslations(value, text) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).some((key) => !['mr', 'hi'].includes(key))) throw badRequest('Translations may contain mr and hi only.');
  const result = {};
  for (const [language, translation] of Object.entries(value)) {
    if (translation === null) { result[language] = null; continue; }
    if (typeof translation !== 'string' || !translation.trim() || translation.length > 100_000) throw badRequest('Provide reviewed translation text of up to 100000 characters.');
    if ((translation.match(/[\u0900-\u097F]/gu) || []).length < 12 || !sameNumbers(text, translation)) throw badRequest('Translations must use Devanagari and preserve all source numbers, years and codes.');
    result[language] = { text: translation.trim(), sourceHash: sourceTextHash(text) };
  }
  return result;
}

export function buildReviewedPassage(query, language, records) {
  if (language === 'en') return null;
  const services = fieldValues(query, servicePatterns).positive;
  const id = services.includes('library') ? 'KB-20' : services.includes('transport') ? 'KB-19'
    : services.includes('hostel') && !/fee|cost|charge|payment/.test(query) ? 'KB-23' : null;
  if (!id) return null;
  const record = records.find((item) => item.id === id && usableKnowledge(item));
  const reviewed = record?.translations?.[language];
  if (!record || !reviewed?.reviewedBy || reviewed.sourceHash !== sourceTextHash(record.text) || !sameNumbers(record.text, reviewed.text)) return null;
  const years = extractAcademicYears(query).years;
  if (years.some((year) => record.provenance?.academicYear ? record.provenance.academicYear !== year : !record.text.includes(year) && record.academicYear !== year)) return {
    managedRecordId: id, source: 'No verified record', answer: 'No verified record for the requested academic year.', evidence: [], next: '' };
  return { managedRecordId: id, source: record.source, sourceUrl: record.sourceUrl || '', answer: record.text, evidence: [record], next: '' };
}

const labels = {
  mr: { firstYear: 'प्रथम वर्ष', dse: 'थेट द्वितीय वर्ष', year: 'शैक्षणिक वर्ष', total: 'वार्षिक एकूण शुल्क',
    open: 'Open / OMS', concessionBoy: 'EBC / EWS / OBC / SEBC मुलांसाठी', concessionGirl: 'EBC / EWS / OBC / SEBC मुलींसाठी', vjnt: 'VJNT / SBC / TFWS', scst: 'SC / ST',
    feeCaution: 'ही वार्षिक रक्कम आहे. या नोंदीत सत्रनिहाय शुल्क किंवा हप्त्यांचे वेळापत्रक दिलेले नाही. सवलतीसाठी प्रवेश व प्रवर्गाची वैध कागदपत्रे आवश्यक आहेत.',
    hostel: 'वार्षिक वसतिगृह शुल्क', deposit: 'परत मिळणारी वसतिगृह ठेव', hostelTotal: 'वसतिगृह एकूण', mess: 'वार्षिक मेस शुल्क',
    stayCaution: 'खोलीची उपलब्धता, वसतिगृह व मेसचे नियम आणि भरणा पद्धत महाविद्यालयाकडून निश्चित करा. शुल्काची नोंद म्हणजे खोली मिळण्याची हमी नाही.',
    intake: 'मंजूर प्रवेश क्षमता', code: 'चॉइस कोड', intakeCaution: 'प्रवेशक्षमता म्हणजे सध्याच्या रिक्त जागा किंवा प्रवेशाची हमी नाही.',
    clarification: 'तुम्ही कोणत्या अभ्यासक्रमाबद्दल विचारत आहात? कृपया अभ्यासक्रम आणि प्रवेशमार्ग स्पष्ट करा, उदाहरणार्थ प्रथम वर्ष B.Tech किंवा Polytechnic. मागील संदेशांचा संदर्भ या उत्तरासाठी वापरला जात नाही.',
    unsupported: 'या भागासाठी पुरेशी प्रकाशित अधिकृत माहिती उपलब्ध नाही. कृपया महाविद्यालयाकडून तपशील निश्चित करा.',
    fallback: 'या माहितीचे पुनरावलोकन केलेले मराठी भाषांतर उपलब्ध नाही. तथ्ये न बदलता मूळ इंग्रजी माहिती खाली दिली आहे.',
    bounded: 'कृपया एका वेळी जास्तीत जास्त चार विषय विचारा, म्हणजे प्रत्येक भागाला त्याच्या स्रोतासह उत्तर देता येईल.',
    titles: { programmes: 'अभ्यासक्रम व प्रवेशक्षमता', academicFees: 'शैक्षणिक शुल्क', accommodationFees: 'वसतिगृह व मेस शुल्क', hostel: 'वसतिगृह सुविधा', transport: 'बस व वाहतूक', library: 'ग्रंथालय', seatMatrix: 'ऐतिहासिक जागांची माहिती', unknown: 'इतर विचारलेली माहिती' } },
  hi: { firstYear: 'प्रथम वर्ष', dse: 'सीधे द्वितीय वर्ष', year: 'शैक्षणिक वर्ष', total: 'वार्षिक कुल शुल्क',
    open: 'Open / OMS', concessionBoy: 'EBC / EWS / OBC / SEBC लड़कों के लिए', concessionGirl: 'EBC / EWS / OBC / SEBC लड़कियों के लिए', vjnt: 'VJNT / SBC / TFWS', scst: 'SC / ST',
    feeCaution: 'यह वार्षिक राशि है। इस रिकॉर्ड में सेमेस्टर के अनुसार शुल्क या किस्तों का समय निर्धारित नहीं है। रियायत के लिए प्रवेश और श्रेणी के वैध दस्तावेज आवश्यक हैं।',
    hostel: 'वार्षिक छात्रावास शुल्क', deposit: 'वापस मिलने वाली छात्रावास जमा राशि', hostelTotal: 'छात्रावास कुल', mess: 'वार्षिक मेस शुल्क',
    stayCaution: 'कमरे की उपलब्धता, छात्रावास और मेस के नियम तथा भुगतान की प्रक्रिया कॉलेज से सुनिश्चित करें। शुल्क रिकॉर्ड कमरे की गारंटी नहीं है।',
    intake: 'स्वीकृत प्रवेश क्षमता', code: 'चॉइस कोड', intakeCaution: 'प्रवेश क्षमता वर्तमान रिक्त सीटों या प्रवेश की गारंटी नहीं है।',
    clarification: 'आप किस पाठ्यक्रम के बारे में पूछ रहे हैं? कृपया पाठ्यक्रम और प्रवेश मार्ग बताएं, जैसे प्रथम वर्ष B.Tech या Polytechnic। इस उत्तर में पिछले संदेशों का संदर्भ उपयोग नहीं किया जाता।',
    unsupported: 'इस भाग के लिए पर्याप्त प्रकाशित आधिकारिक जानकारी उपलब्ध नहीं है। कृपया कॉलेज से विवरण की पुष्टि करें।',
    fallback: 'इस जानकारी का समीक्षा किया हुआ हिंदी अनुवाद उपलब्ध नहीं है। तथ्यों को बदले बिना मूल अंग्रेजी जानकारी नीचे दी गई है।',
    bounded: 'कृपया एक बार में अधिकतम चार विषय पूछें, ताकि हर भाग का उत्तर उसके स्रोत के साथ दिया जा सके।',
    titles: { programmes: 'पाठ्यक्रम और प्रवेश क्षमता', academicFees: 'शैक्षणिक शुल्क', accommodationFees: 'छात्रावास और मेस शुल्क', hostel: 'छात्रावास सुविधाएं', transport: 'बस और परिवहन', library: 'पुस्तकालय', seatMatrix: 'ऐतिहासिक सीट जानकारी', unknown: 'अन्य पूछी गई जानकारी' } },
};
const money = (number) => `INR ${new Intl.NumberFormat('en-IN').format(number)}`;

const clarificationLabels = {
  mr: {
    feeScope: 'तुम्हाला शैक्षणिक, वसतिगृह, मेस की वाहतूक शुल्क विचारायचे आहे? शुल्काचा प्रकार आणि प्रवेशमार्ग स्पष्ट करा.',
    feeGender: 'EBC/EWS/OBC/SEBC शुल्कासाठी मुलगा की मुलगी आणि प्रवेशमार्ग स्पष्ट करा, म्हणजे लागू रक्कम निवडता येईल.',
    category: 'शुल्कासाठी लागू असलेला प्रवर्ग किंवा सवलत स्पष्ट करा. वगळलेला प्रवर्ग तुमची लागू रक्कम ठरवत नाही.',
    route: 'तुम्ही थेट द्वितीय वर्ष प्रवेशाचे शुल्क विचारत आहात की आधीपासून द्वितीय वर्षात शिकणाऱ्या विद्यार्थ्याचे? प्रवेशमार्ग स्पष्ट करा.',
    year: 'कृपया सलग दोन वर्षांचे वैध शैक्षणिक वर्ष आणि प्रवेशमार्ग स्पष्ट करा.',
  },
  hi: {
    feeScope: 'आप शैक्षणिक, छात्रावास, मेस या परिवहन शुल्क पूछ रहे हैं? शुल्क का प्रकार और प्रवेश मार्ग स्पष्ट करें।',
    feeGender: 'EBC/EWS/OBC/SEBC शुल्क के लिए लड़का या लड़की और प्रवेश मार्ग स्पष्ट करें, ताकि लागू राशि चुनी जा सके।',
    category: 'शुल्क के लिए लागू श्रेणी या रियायत स्पष्ट करें। किसी श्रेणी को बाहर रखने से आपकी लागू राशि तय नहीं होती।',
    route: 'क्या आप सीधे द्वितीय वर्ष में प्रवेश का शुल्क पूछ रहे हैं या पहले से द्वितीय वर्ष में पढ़ रहे विद्यार्थी का? प्रवेश मार्ग स्पष्ट करें।',
    year: 'कृपया लगातार दो वर्षों वाला मान्य शैक्षणिक वर्ष और प्रवेश मार्ग स्पष्ट करें।',
  },
};
function renderStructured(facts, query, language, feeSelection) {
  const t = labels[language];
  if (facts.kind === 'academicFees') {
    const selected = feeSelection(query);
    const routes = selected.route ? [selected.route] : ['firstYear', 'directSecondYear'];
    return routes.map((route) => {
      const entries = selected.key ? [[selected.key, facts[route][selected.key]]] : Object.entries(facts[route]);
      return `${t.year} ${facts.academicYear}, ${route === 'firstYear' ? t.firstYear : t.dse} Engineering:\n${entries.map(([key, amount]) => `${t[key]} — ${t.total}: ${money(amount)}`).join('\n')}`;
    }).join('\n\n') + `\n\n${t.feeCaution}`;
  }
  if (facts.kind === 'accommodationFees') {
    const entries = [];
    const services = fieldValues(query, servicePatterns).positive;
    if (services.includes('hostel')) entries.push(`${t.hostel}: ${money(facts.hostel)}`, `${t.deposit}: ${money(facts.refundableDeposit)}`, `${t.hostelTotal}: ${money(facts.hostel + facts.refundableDeposit)}`);
    if (services.includes('mess')) entries.push(`${t.mess}: ${money(facts.messAnnual)}`);
    return `${t.year} ${facts.academicYear}:\n${entries.join('\n')}\n\n${t.stayCaution}`;
  }
  const programs = programmesForQuery(facts.programs, query);
  return `${t.year} ${facts.academicYear}:\n${programs.map((item) => `${item.name} — ${t.intake}: ${item.intake}; ${t.code}: ${item.choiceCode}`).join('\n')}\n\n${t.intakeCaution}`;
}

export function localizeResponse(response, language, query, records, feeSelection, parseLegacyFacts = () => null) {
  if (language === 'en') return { ...response, requestedLanguage: 'en', responseLanguage: 'en', localizationStatus: 'original' };
  const t = labels[language];
  const translate = (text, ids, normalizedQuery, status, managedRecordId, clarificationKind) => {
    if (status === 'clarification') return { text: clarificationLabels[language]?.[clarificationKind] || (response.sections ? t.clarification : /four topics/.test(text) ? t.bounded : t.clarification), method: 'template' };
    if (status === 'unsupported') return { text: t.unsupported, method: 'template' };
    const record = records.find((item) => item.id === ids[0] && usableKnowledge(item));
    if (record?.facts && managedRecordId === record.id) {
      const rendered = renderStructured(record.facts, normalizedQuery, language, feeSelection);
      if (sameNumbers(text, rendered)) return { text: rendered, method: 'template' };
    }
    if (record && managedRecordId === record.id && text === record.text) {
      const legacy = parseLegacyFacts(record);
      if (legacy) {
        const rendered = renderStructured(legacy, legacy.kind === 'accommodationFees' ? 'hostel mess' : '', language, feeSelection);
        if (sameNumbers(text, rendered)) return { text: rendered, method: 'template' };
      }
    }
    const reviewed = record?.translations?.[language];
    if (record && reviewed && reviewed.sourceHash === sourceTextHash(record.text) && reviewed.reviewedBy && text === record.text && sameNumbers(text, reviewed.text)) return { text: reviewed.text, method: 'maintainer-reviewed' };
    return { text: `${t.fallback}\n\n${text}`, method: 'fallback' };
  };
  let answer;
  let methods;
  let sections = response.sections;
  if (sections) {
    methods = [];
    sections = sections.map((section) => {
      const localized = translate(section.answer, section.evidenceIds, section.normalizedQuery || section.question, section.status, section.managedRecordId, section.clarificationKind);
      methods.push(localized.method);
      return { ...section, title: t.titles[section.topic] || t.titles.unknown, answer: localized.text, localizationStatus: localized.method };
    });
    answer = sections.map((section) => `${section.title}: ${section.answer}${section.evidenceIds.map((id) => ` [${response.evidence.findIndex((item) => item.id === id) + 1}]`).join('')}`).join('\n\n');
  } else {
    const localized = translate(response.answer, response.evidence.map((item) => item.id), query,
      response.clarification ? 'clarification' : !response.evidence.length && response.source === 'No verified record' ? 'unsupported' : 'supported', response.managedRecordId, response.clarificationKind);
    answer = localized.text; methods = [localized.method];
  }
  const fallback = methods.includes('fallback');
  return { ...response, ...(sections ? { sections } : {}), answer, next: '', requestedLanguage: language,
    responseLanguage: fallback ? 'mixed' : language,
    localizationStatus: fallback ? methods.every((method) => method === 'fallback') ? 'fallback' : 'partial' : methods.every((method) => method === 'maintainer-reviewed') ? 'maintainer-reviewed' : 'template',
    languageReviewStatus: methods.includes('template') ? 'speaker-review-pending' : fallback ? 'translation-unavailable' : 'maintainer-reviewed' };
}
