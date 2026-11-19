import test from 'node:test';
import assert from 'node:assert/strict';
import { formatAnswer, formatPublicAnswer, formatPublicResponse } from '../src/answer-format.mjs';

test('Polytechnic and DSE lists preserve every maintained course and their cautions', () => {
  const poly = formatPublicAnswer('The official Polytechnic page lists Civil Engineering, Computer Science and Engineering, and Mechanical Engineering, each with intake 61. Eligibility must be checked.');
  assert.equal(poly[0].items.length, 3);
  assert.equal(poly[0].items[1].detail, 'Intake: 61');
  assert.equal(poly[1].text, 'Eligibility must be checked.');
  const dse = formatPublicAnswer('The official Direct Second Year B.Tech page lists Civil Engineering choice code 00123, and Computer Science and Engineering 00456. Check current vacancies.');
  assert.equal(dse[0].items[1].detail, 'Choice code: 00456');
  assert.equal(dse[1].text, 'Check current vacancies.');
});

test('native table labels and compound sections retain their own structure', () => {
  const native = 'शैक्षणिक वर्ष 2026-27:\nCourse A — मंजूर प्रवेश क्षमता: 61; चॉइस कोड: 00123\nCourse B — मंजूर प्रवेश क्षमता: 121; चॉइस कोड: 00456';
  const blocks = formatPublicResponse({ text: 'Flattened text', sections: [{ title: 'अभ्यासक्रम', answer: native }, { title: 'इतर माहिती', answer: 'Admission is not guaranteed.' }] });
  assert.equal(blocks[0].text, 'अभ्यासक्रम');
  assert.equal(blocks[1].items.length, 2);
  assert.equal(blocks[1].items[0].detail, 'मंजूर प्रवेश क्षमता: 61; चॉइस कोड: 00123');
  assert.equal(blocks[3].text, 'Admission is not guaranteed.');
});

test('fee tables retain edited amounts, route years and remaining cautions', () => {
  const row = (route, year, amount) => `${route} fees${year ? ` for AY ${year}` : ''} include Open or OMS total INR ${amount}, Open EBC EWS OBC SEBC boys INR 61,109, girls INR 17,217, VJNT SBC TFWS INR 17,218, and SC ST INR 8,000.`;
  const blocks = formatPublicAnswer(`${row('First Year Engineering', '2027-28', '1,12,345')} ${row('Direct Second Year', '2028-29', '98,001')} Confirm eligibility before paying.`);
  assert.equal(blocks[0].items[0].amount, '1,12,345');
  assert.equal(blocks[0].items[3].amount, '17,218');
  assert.match(blocks[1].intro, /2028-29/);
  assert.equal(blocks[2].text, 'Confirm eligibility before paying.');
  const legacy = formatPublicAnswer(`${row('First Year Engineering', '2027-28', '1,12,345')} ${row('Direct Second Year', '', '98,001')}`);
  assert.match(legacy[1].intro, /2027-28/);
});

test('hostel fee rows preserve refundable status, annual mess and cautions', () => {
  const blocks = formatPublicAnswer('Hostel fee structure for AY 2027-28 includes hostel fees INR 36,000 and refundable hostel deposit INR 6,000, total INR 42,000. Mess fees per year are INR 43,000. Confirm room availability.');
  assert.equal(blocks[0].items[1].name, 'Refundable deposit');
  assert.equal(blocks[0].items[3].amount, '43,000');
  assert.equal(blocks[1].text, 'Confirm room availability.');
});

test('programme cards preserve maintained values in canonical and legacy tables', () => {
  for (const rows of ['Course A, sanctioned intake 121, choice code 00123; Course B, sanctioned intake 61, choice code 00456', 'Course A, intake 121, choice code 00123; and Course B, 61, 00456']) {
    const blocks = formatPublicAnswer(`For AY 2027-28, the official First Year B.Tech page lists: ${rows}.`);
    assert.equal(blocks[0].type, 'programmes');
    assert.match(blocks[0].intro, /2027-28/);
    assert.deepEqual(blocks[0].items, [{ name: 'Course A', intake: '121', choiceCode: '00123' }, { name: 'Course B', intake: '61', choiceCode: '00456' }]);
  }
});

test('unrecognised programme prose and admission cautions remain intact', () => {
  const text = 'For AY 2026-27, the official First Year B.Tech page lists: Course A, 60, 00123; Course B, intake not published. Admission is not guaranteed.';
  assert.deepEqual(formatPublicAnswer(text), formatAnswer(text));
  const translated = '\u0936\u0948\u0915\u094d\u0937\u0923\u093f\u0915 \u0935\u0930\u094d\u0937 2026-27:\nCourse A — 60; 00123';
  assert.deepEqual(formatPublicAnswer(translated), formatAnswer(translated));
});

test('removes only the repeated next-step suffix', () => {
  assert.deepEqual(formatAnswer('A fee is annual.\n\nNext: Check your category.', 'Check your category.'), [{ type: 'paragraph', text: 'A fee is annual.' }]);
  assert.equal(formatAnswer('Next: A different instruction.', 'Check your category.')[0].text, 'Next: A different instruction.');
});
test('preserves decimal values, abbreviations and qualification text', () => {
  const text = 'B.Tech fees are 17,217 rupees. The historical score was 61.2790648. Eligibility does not guarantee admission. ' + 'The academic year, category, candidature, admission route and applicable official notice must be considered before making a decision. '.repeat(2);
  const blocks = formatAnswer(text);
  assert.equal(blocks[0].type, 'paragraph');
  assert.equal(blocks[0].text, text.trim());
});
test('renders explicit lists and preserves short multilingual answers', () => {
  assert.deepEqual(formatAnswer('1. Scorecard\n2. Marksheet'), [{ type: 'list', ordered: true, start: 1, items: ['Scorecard', 'Marksheet'] }]);
  assert.deepEqual(formatAnswer('प्रवेशाची माहिती येथे उपलब्ध आहे.'), [{ type: 'paragraph', text: 'प्रवेशाची माहिती येथे उपलब्ध आहे.' }]);
});

test('bounded Markdown headings and comparisons preserve values without HTML interpretation', () => {
  const blocks = formatAnswer('## Fees\n\n| Route | Amount |\n| --- | --- |\n| FY | 1,05,000 |\n| DSE | 98,000 |');
  assert.equal(blocks[0].type, 'heading'); assert.equal(blocks[1].type, 'table');
  assert.deepEqual(blocks[1].rows, [['FY', '1,05,000'], ['DSE', '98,000']]);
  assert.equal(formatAnswer('<script>alert(1)</script>')[0].text, '<script>alert(1)</script>');
});

test('introductory text does not flatten a following procedure into a paragraph', () => {
  const blocks = formatAnswer('Follow these steps:\n1. Register\n2. Verify documents');
  assert.equal(blocks[0].type, 'paragraph'); assert.equal(blocks[1].ordered, true);
  assert.deepEqual(blocks[1].items, ['Register', 'Verify documents']);
});
