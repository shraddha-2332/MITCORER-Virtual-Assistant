import { usableKnowledge } from './provenance.js';
import { understandQuery } from './query-understanding.js';

// Routing identifies a record; it cannot authorize independent factual literals.
export function maintainedProfile(result, question, records) {
  if (!result?.recordId) return result;
  // The capability menu describes application behavior, not institutional facts.
  if (result.source === 'MITCORER Virtual Assistant Mitra') return result;
  if (Array.isArray(result.recordId)) {
    const passages = result.recordId.map(id => maintainedProfile({ recordId: id }, question, records));
    const unavailable = passages.find(passage => passage.source === 'No verified record');
    if (unavailable) return { ...unavailable, recordId: result.recordId };
    return { ...result, answer: passages.map(passage => passage.answer).filter(Boolean).join('\n\n') };
  }
  const record = records.find(item => item.id === result.recordId && usableKnowledge(item));
  if (!record) return result; // The caller's publication guard handles refusal.
  const text = String(record.text || '').trim();
  const query = understandQuery(question);
  const requestedYears = query.academicYears;
  if (requestedYears.some(year => record.facts?.academicYear !== year && record.provenance?.academicYear !== year && !text.includes(year))) return { ...result, managedRecordId: record.id, source: 'No verified record', evidence: [], answer: 'The maintained record does not establish this information for the requested academic year. Please confirm with the college.' };
  const branch = query.branch.positive;
  let answer = text;
  // Application marketing is not institutional evidence or a verification proof.
  if (record.id === 'KB-34') answer = answer.split('\n').filter(line => !/^\s*[-*]?\s*Virtual Assistant:/i.test(line)).join('\n').trim();
  if (record.id === 'KB-16') {
    const companies = text.match(/named companies include ([\s\S]+?)\.\s*(These[\s\S]*)/);
    const year = text.match(/\b20\d{2}-\d{2}\b/)?.[0];
    if (companies && /\b(?:company|companies|recruiter|recruiters)\b/i.test(question)) answer = `Companies named in the maintained placement record${year ? ` (${year})` : ''}:\n\n` + companies[1].split(/,\s*(?:and\s+)?/).map(name => `- ${name}`).join('\n') + `\n\n${companies[2]}`;
    if (/\b(?:highest|average|package|salary)\b/i.test(question) && !/\b(?:company|companies|recruiter)\b/i.test(question)) answer = 'The maintained placement record does not establish a highest or average package. Please check the dated placement records or confirm with the Training and Placement Cell.';
  }
  if (record.id === 'KB-34' && /full name|full form|stand for|name of|^what is mitcorer[?. ]*$/i.test(question)) {
    const name = text.match(/MIT College of Railway Engineering and Research/);
    if (name) answer = /^what is mitcorer[?. ]*$/i.test(question) ? `MITCORER stands for ${name[0]}.` : `The full name of MITCORER is ${name[0]}.`;
  }
  if (record.id === 'KB-37' && /\bprincipal\b/i.test(question)) {
    answer = text.match(/(?:The )?Principal is [^\n]+/i)?.[0] || 'The maintained record does not establish the current Principal. Please confirm with the college.';
  }
  if (record.id === 'KB-29') {
    const workflow = text.match(/^CAP admission proceeds through ([^.]+)\.\s*([\s\S]*)$/);
    if (workflow) answer = 'CAP admission steps:\n\n' + workflow[1].split(/,\s*(?:and\s+)?/).map((step, index) => `${index + 1}. ${step}`).join('\n') + `\n\n${workflow[2]}`;
  }
  if (record.id === 'KB-35' && /\b(?:how many|number of|count)\b/i.test(question) && !/\d/.test(text)) {
    answer = 'The maintained record does not establish a current faculty or alumni count. Please confirm the requested count with the college.';
  }
  if (record.id === 'KB-38' && branch.length === 1) {
    const patterns = { cse: /computer (?:science|engineering)|\bcse\b/i, civil: /civil engineering/i, mechanical: /mechanical.*(?:rail|engineering)/i };
    const pattern = patterns[branch[0]];
    const passages = text.split(/\n+/).map(line => line.replace(/^\s*[-*]\s*/, '').trim()).filter(Boolean);
    answer = pattern ? passages.filter(line => pattern.test(line)).join('\n\n') : '';
  }
  if (/\b(?:hod|head of department|department head)\b/i.test(question) && !/\b(?:lab|syllabus|honou?r|specializ)/i.test(question)) {
    const head = answer.match(/(?:head of department(?:\s*\(hod\))?|hod)\s*(?:of\s+[^:]+?\s+)?(?:is|:)\s*([^\n]+?)(?=\.\s+(?:Offers|Focuses|B\.?Tech|The |Department)|$)/i);
    const names = { cse: 'Computer Science and Engineering', civil: 'Civil Engineering', mechanical: 'Mechanical & Rail Engineering', entc: 'Electronics and Telecommunication Engineering' };
    const selected = branch[0] || (record.id === 'KB-52' ? 'entc' : null);
    if (head) answer = `${names[selected] || record.title} — Head of Department: ${head[1].trim()}`;
  }
  if (record.id === 'KB-38' && branch.length === 1 && /\b(?:labs?|laborator\w*)\b/i.test(question) && !/\bhod\b/i.test(question)) {
    const labs = answer.match(/(?:with specialized|featuring|backed by) ([^.]+(?:laboratories|facilities))/i);
    if (labs) {
      const title = { cse: 'Computer Science and Engineering', civil: 'Civil Engineering', mechanical: 'Mechanical and Rail Engineering' }[branch[0]];
      answer = `${title} Laboratories:\n\n` + labs[1].replace(/\s+(?:laboratories|facilities)$/, '').split(/,\s*(?:and\s+)?|\s+and\s+/).map(item => `- ${item.trim()}${/laboratories$/.test(labs[1]) ? ' Lab' : ''}`).join('\n');
    }
  }
  if (!answer) return { ...result, source: 'No verified record', answer: 'The maintained record does not establish that department detail. Please confirm with the college.', evidence: [], managedRecordId: record.id };
  return { ...result, answer, source: record.source, sourceUrl: record.sourceUrl || '', managedRecordId: record.id };
}

export function maintainedContacts(records) {
  const record = records.find(item => item.id === 'KB-17' && usableKnowledge(item));
  const text = record?.text || '';
  const numbers = [...new Set(text.match(/\+91[ -]*\d{5}[ -]*\d{5}/g) || [])];
  const email = text.match(/info\.mitcorer@mitpune\.edu\.in/i)?.[0]
    || text.match(/[\w.+-]+@mitpune\.edu\.in/i)?.[0]
    || text.match(/[\w.+-]+@[\w.-]+\.[a-z]{2,}/i)?.[0];
  return { helplines: numbers.map((number, index) => ({ label: index === 0 ? 'Admission Helpline' : 'College Office', number, tel: number.replace(/[^+\d]/g, '') })), ...(email ? { email } : {}) };
}
