import assert from 'node:assert/strict';
import fs from 'node:fs';
import { test } from 'node:test';
import { selectLanguage, normalizeLocalTerms, numericTokens, sameNumbers, validateTranslations, localizeResponse, sourceTextHash } from '../src/language.js';
import { buildMaintainedAnswer, academicFeeSelection, parseLegacyFactText } from '../src/knowledge.js';
import { createSeedData } from '../src/seed.js';

test('language selection honors explicit preference and does not infer language from arbitrary mentions', () => {
  assert.equal(selectLanguage('मराठीत CSE माहिती द्या', 'en'), 'en');
  assert.equal(selectLanguage('Please answer in Marathi: courses'), 'mr');
  assert.equal(selectLanguage('हिंदी में बताइए: CSE intake'), 'hi');
  assert.equal(selectLanguage('त्याची प्रवेश क्षमता किती आहे?'), 'mr');
  assert.equal(selectLanguage('Does the library have Hindi books?'), 'en');
  assert.equal(selectLanguage('Mala hostel fee sanga'), 'en');
  assert.throws(() => selectLanguage('Fees?', 'zh'), (error) => error.status === 400);
});

test('localized normalization preserves numeric years and distinguishes intake from historical seat matrix', () => {
  const query = normalizeLocalTerms('प्रथम वर्ष Open फी २०२६-२७ मध्ये किती आहे?');
  assert.match(query, /first year/); assert.match(query, /fee/); assert.match(query, /2026-27/);
  assert.match(normalizeLocalTerms('CSE प्रवेश क्षमता किती आहे?'), /intake/);
  assert.match(normalizeLocalTerms('CSE जागा आणि प्रवेश क्षमता काय आहे?'), /seat matrix/);
  assert.equal(sameNumbers('INR 1,05,000 in 2026-27, code 0690124210', 'INR १,०५,००० — २०२६-२७ — ०६९०१२४२१०'), true);
  assert.equal(sameNumbers('45 percent', '40 टक्के'), false);
  assert.deepEqual([...numericTokens('4.4 LPA and 0690124210')], ['4.4', '0690124210']);
});

test('common Marathi, Hindi and Romanized questions normalize to existing answer intents', () => {
  assert.match(normalizeLocalTerms('तुमच्या कॉलेजमध्ये कोणते इंजिनिअरिंग कोर्स आहेत?'), /list engineering programmes/);
  assert.match(normalizeLocalTerms('कॉलेज कहाँ स्थित है?'), /where is the college located/);
  assert.match(normalizeLocalTerms('मुलींसाठी हॉस्टेल आहे का?'), /girls hostel facilities available/);
  assert.match(normalizeLocalTerms('कॉलेजमध्ये स्कॉलरशिप मिळते का?'), /scholarship schemes/);
  assert.match(normalizeLocalTerms('कॉलेजचे प्राचार्य कोण आहेत?'), /who is the principal/);
  assert.match(normalizeLocalTerms('कॉम्पुटर इंजिनियरिंग ची फिस किती?'), /computer engineering\s+fee/);
  assert.match(normalizeLocalTerms('admission sathi docs konti pahijet?'), /admission documents required/);
  assert.match(normalizeLocalTerms('placement kase aahet?'), /placement highlights/);
});

test('structured localized fees preserve category, route, amount, year and annual-payment caveat', () => {
  const records = createSeedData().knowledge;
  for (const language of ['mr', 'hi']) {
    const query = 'first year obc boy fee 2026-27';
    const english = buildMaintainedAnswer(query, query, records);
    const translated = localizeResponse(english, language, query, english.evidence, academicFeeSelection);
    assert.equal(translated.responseLanguage, language);
    assert.equal(translated.localizationStatus, 'template');
    assert.equal(translated.languageReviewStatus, 'speaker-review-pending');
    assert.match(translated.answer, /61,109/);
    assert.match(translated.answer, /OBC/);
    assert.match(translated.answer, /2026-27/);
    assert.equal(sameNumbers(english.answer, translated.answer), true);
    assert.match(translated.answer, language === 'mr' ? /सत्रनिहाय.*हप्त्यांचे/ : /सेमेस्टर.*किस्तों/s);
    const generic = buildMaintainedAnswer('First year fees', 'first year fee', records);
    assert.equal(localizeResponse(generic, language, 'first year fee', generic.evidence, academicFeeSelection).localizationStatus, 'template');
  }
});

test('localized programme answers retain official names, intake and leading-zero choice codes', () => {
  const records = createSeedData().knowledge;
  const query = 'cse intake 2026-27';
  const english = buildMaintainedAnswer(query, query, records);
  const translated = localizeResponse(english, 'hi', query, english.evidence, academicFeeSelection);
  assert.match(translated.answer, /Computer Science and Engineering/);
  assert.match(translated.answer, /120/);
  assert.match(translated.answer, /0690124210/);
  assert.match(translated.answer, /गारंटी नहीं/);
  assert.equal(sameNumbers(english.answer, translated.answer), true);
});

test('translation validation binds text to the source and rejects number changes and spoofed metadata', () => {
  const result = validateTranslations({ mr: 'वार्षिक शुल्क INR 8,000 आहे. कृपया महाविद्यालयाकडून निश्चित करा.' }, 'Annual fee INR 8,000.');
  assert.equal(result.mr.sourceHash, sourceTextHash('Annual fee INR 8,000.'));
  assert.throws(() => validateTranslations({ mr: 'वार्षिक शुल्क INR 10,000 आहे. कृपया महाविद्यालयाकडून निश्चित करा.' }, 'Annual fee INR 8,000.'), /preserve/);
  assert.throws(() => validateTranslations({ mr: { text: 'अनुवाद', reviewedBy: 'fake' } }, 'Original text'), /translation text/);
  assert.throws(() => validateTranslations({ fr: 'Texte' }, 'Original text'), /mr and hi/);
});

test('stale reviewed translations fall back transparently instead of reusing changed facts', () => {
  const record = { id: 'KB-20', status: 'Published', text: 'Updated library hours are 10.',
    translations: { mr: { text: 'ग्रंथालयाची वेळ 9 आहे. कृपया कार्यालयाकडून निश्चित करा.', sourceHash: sourceTextHash('Library hours are 9.'), reviewedBy: 'admin' } } };
  const response = { answer: record.text, evidence: [record], source: 'Library', managedRecordId: record.id };
  const translated = localizeResponse(response, 'mr', 'library hours', [record], academicFeeSelection);
  assert.equal(translated.localizationStatus, 'fallback');
  assert.equal(translated.responseLanguage, 'mixed');
  assert.match(translated.answer, /मूळ इंग्रजी/);
  assert.match(translated.answer, /hours are 10/);
  assert.doesNotMatch(translated.answer, /वेळ 9/);
});

test('legacy-format adapters read current text, preserve values and refuse extra conditions or invalid totals', () => {
  const records = createSeedData().knowledge;
  for (const id of ['KB-2', 'KB-3', 'KB-10']) {
    const record = records.find((item) => item.id === id); delete record.facts;
    assert.ok(parseLegacyFactText(record), id);
    const english = { answer: record.text, evidence: [record], managedRecordId: id, source: record.source };
    const translated = localizeResponse(english, 'mr', 'first year fee', [record], academicFeeSelection, parseLegacyFactText);
    assert.equal(translated.localizationStatus, 'template', id);
    assert.equal(sameNumbers(record.text, translated.answer), true, id);
    assert.equal(parseLegacyFactText({ ...record, text: `${record.text} Only applicable after extra approval.` }), null);
  }
  const hostel = records.find((item) => item.id === 'KB-3');
  assert.equal(parseLegacyFactText({ ...hostel, text: hostel.text.replace('total INR 40,000', 'total INR 39,000') }), null);
});

test('the original cloned corpus localizes without a database migration or synthesized values', () => {
  const original = JSON.parse(fs.readFileSync(new URL('../evaluation/baselines/original-public/seed-knowledge.json', import.meta.url), 'utf8'));
  for (const [id, query] of [['KB-2', 'first year open fee'], ['KB-3', 'hostel mess fee'], ['KB-10', 'cse intake']]) {
    const english = buildMaintainedAnswer(query, query, original);
    assert.equal(english.evidence[0].id, id);
    const translated = localizeResponse(english, 'hi', query, english.evidence, academicFeeSelection, parseLegacyFactText);
    assert.equal(translated.localizationStatus, 'template', id);
    assert.equal(sameNumbers(english.answer, translated.answer), true, id);
    assert.equal(original.find((item) => item.id === id).facts, undefined);
  }
});
