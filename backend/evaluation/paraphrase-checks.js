import { numericTokens } from '../src/language.js';

// Developer diagnostics only. These checks do not replace reviewed relevance or fluency judgments.
export function checkParaphrase(id, data, corpus) {
  const records = new Map(corpus.map(record => [record.id, record]));
  const answer = data?.answer || '';
  const evidence = new Set((data?.evidence || []).map(record => record.id));
  const numbers = numericTokens(answer);
  const failures = [];
  const expectRecord = recordId => { if (!evidence.has(recordId)) failures.push(`missing_${recordId}`); };
  const expectNumbers = values => { for (const value of values) if (!numbers.has(String(value))) failures.push(`missing_number_${value}`); };
  const fees = records.get('KB-2').facts;
  const stay = records.get('KB-3').facts;
  const programs = records.get('KB-10').facts.programs;
  if (['HOC-01', 'HOC-13', 'HOC-19'].includes(id)) {
    expectRecord('KB-2'); expectNumbers([fees.firstYear.open]);
    if (numbers.has(String(fees.directSecondYear.open))) failures.push('unrequested_second_year_total');
  } else if (id === 'HOC-02') {
    expectRecord('KB-2'); expectNumbers([fees.firstYear.open, fees.directSecondYear.open]);
  } else if (['HOC-03', 'HOC-14', 'HOC-20'].includes(id)) {
    expectRecord('KB-3'); expectNumbers([stay.hostel, stay.refundableDeposit, stay.messAnnual]);
  } else if (id === 'HOC-04') {
    expectRecord('KB-3'); expectNumbers([stay.refundableDeposit]);
    if (!/refundable/.test(answer)) failures.push('deposit_refund_condition');
  } else if (['HOC-05', 'HOC-15', 'HOC-21'].includes(id)) {
    expectRecord('KB-10');
    for (const program of programs) {
      if (!answer.includes(program.name)) failures.push(`missing_program_${program.name}`);
      expectNumbers([program.choiceCode, program.intake]);
    }
  } else if (id === 'HOC-06') {
    expectRecord('KB-10'); expectNumbers([programs.find(program => program.name === 'Computer Science and Engineering').intake]);
    if (!/does not confirm current vacancies/.test(answer)) failures.push('vacancies_uncertainty');
  } else if (['HOC-07', 'HOC-16', 'HOC-22'].includes(id)) {
    expectRecord('KB-19');
    const hasTransportLimit = /does not (?:state|publish|give).*(?:route|timetable)/s.test(answer)
      || /मार्ग.*(?:वेळापत्रक|समय-सारणी).*(?:दिलेले नाही|नहीं दिया|प्रकाशित नहीं)/s.test(answer);
    if (!hasTransportLimit) failures.push('transport_unknown_details');
  } else if (['HOC-08', 'HOC-17', 'HOC-23'].includes(id)) {
    expectRecord('KB-20');
    const hasLibraryLimit = /does not (?:specify|publish|state)[^.]{0,150}(?:opening hours|borrowing (?:rules|limits)|loan periods|timings)/i.test(answer)
      || /(?:ग्रंथालय.*वेळ.*नमूद नाही|पुस्तकालय.*समय.*नहीं बताई गई)/s.test(answer);
    if (!hasLibraryLimit) failures.push('library_unknown_details');
  } else if (id === 'HOC-09') {
    expectRecord('KB-26');
    if (!/caste certificate and caste validity/.test(answer)) failures.push('category_documents');
  } else if (id === 'HOC-10') {
    expectRecord('KB-14');
    if (!/admission alone does not establish scheme eligibility/.test(answer)) failures.push('concession_not_guaranteed');
  } else if (['HOC-11', 'HOC-12', 'HOC-18', 'HOC-24'].includes(id)) {
    if (evidence.size) failures.push('unexpected_evidence');
    if (id !== 'HOC-11' && !data?.clarification) failures.push('missing_clarification');
  } else throw new Error(`No diagnostic checks defined for ${id}`);
  return failures;
}
