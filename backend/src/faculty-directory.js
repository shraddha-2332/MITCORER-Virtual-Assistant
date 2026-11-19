const DEPARTMENTS = [
  { label: 'Computer Science & Engineering', terms: ['cse', 'computer science', 'computer engineering'], slug: 'computer-science-engineering/faculty', sourcePath: '/computer-science-engineering-faculty-profile.php' },
  { label: 'Electronics & Telecommunication Engineering', terms: ['entc', 'e&tc', 'electronics and telecommunication', 'electronics & telecommunication', 'telecommunication'], slug: 'electronic-telecommunication-engineering/faculty', sourcePath: '/electronics-and-tele-communication-engineering-faculty-profile.php' },
  { label: 'Electronics & Computer Engineering', terms: ['electronics and computer', 'electronics & computer', 'e&c'], slug: 'electronics-computer-engineering/faculty', sourcePath: '/electronic-computer-engineering-faculty-profile.php' },
  { label: 'Civil Engineering', terms: ['civil'], slug: 'civil-engineering/faculty', sourcePath: '/civil-engineering-faculty-profile.php' },
  { label: 'Mechanical & Rail Engineering', terms: ['mechanical', 'mech', 'rail engineering'], slug: 'mechanical-rail-engineering/faculty', sourcePath: '/mechanical-engineering-faculty-profile.php' },
  { label: 'First Year Engineering', terms: ['first year', 'fy', 'f.y.', 'fe', 'foundation engineering'], slug: 'fy-engineering/faculty', sourcePath: '/fy-engineering-faculty-profile.php' },
  { label: 'Polytechnic', terms: ['polytechnic', 'diploma'], slug: 'polytechnic/faculty', sourcePath: '/polytechnic-faculty-profile.php' },
];

function parseProfiles(text) {
  const lines = String(text || '').replace(/\r/g, '').split('\n').map(line => line.trim()).filter(Boolean);
  const namedProfiles = [];
  let current = null;
  for (const line of lines) {
    const nameMatch = line.replace(/^#+\s*/, '').match(/^name\s*:\s*(.+)$/i);
    if (nameMatch) {
      if (current?.designation) namedProfiles.push(current);
      current = { name: nameMatch[1].trim() };
      continue;
    }
    if (!current) continue;
    const fieldMatch = line.match(/^([^:]+?)\s*:\s*(.*)$/);
    if (!fieldMatch) continue;
    const key = fieldMatch[1].trim().toLowerCase();
    const value = fieldMatch[2].trim();
    if (/^designation$/i.test(key)) current.designation = value;
    else if (/^qualification$/i.test(key)) current.qualification = value;
    else if (/^area of research(?: interest)?$/i.test(key)) current['area of research'] = value;
    else if (/^teaching experience$/i.test(key)) current['teaching experience'] = value;
  }
  if (current?.designation) namedProfiles.push(current);
  if (namedProfiles.length) return namedProfiles;
  const start = lines.map(line => line.toLowerCase()).lastIndexOf('faculty profile');
  if (start >= 0) lines.splice(0, start + 1);
  const profiles = [];
  for (let i = 0; i < lines.length; i += 1) {
    if (lines[i].replace(/:$/, '').toLowerCase() !== 'designation') continue;
    const name = lines[i - 1];
    if (!name || ['faculty profile', 'designation', 'qualification', 'email'].includes(name.toLowerCase())) continue;
    const fields = { designation: lines[i + 1] || '' };
    for (let j = i + 2; j < lines.length && lines[j].replace(/:$/, '').toLowerCase() !== 'designation'; j += 1) {
      const key = lines[j].replace(/:$/, '').toLowerCase();
      if (['designation', 'qualification', 'email', 'area of research', 'area of research interest', 'professional membership', 'teaching experience'].includes(key)) {
        const value = lines[j + 1];
        if (value && !['designation', 'qualification', 'email', 'area of research', 'area of research interest', 'professional membership', 'teaching experience'].includes(value.replace(/:$/, '').toLowerCase())) fields[key] = value;
      }
    }
    if (fields.designation) profiles.push({ name, ...fields });
  }
  return profiles;
}

function isFacultyQuestion(question) {
  const normalized = question.toLowerCase();
  return ['faculty', 'faculties', 'teacher', 'professor', 'teaching staff', 'lecturer', 'staff profile'].some(term => normalized.includes(term))
    && !['hiring', 'recruitment', 'vacancy', 'vacancies', 'job', 'career', 'opening', 'employment'].some(term => normalized.includes(term));
}

export function buildFacultyDirectoryAnswer(question, officialSources = []) {
  if (!isFacultyQuestion(question)) return null;
  const normalized = question.toLowerCase();
  const askedAll = /\ball\b.{0,35}\b(?:branches|departments|faculty|faculties|staff|profiles)\b|\b(?:branches|departments)\b.{0,35}\ball\b|\bevery\b.{0,35}\b(?:branch|department|faculty|staff|profile)/i.test(normalized);
  const selected = DEPARTMENTS.filter(department => department.terms.some(term => normalized.includes(term)));
  if (!askedAll && selected.length !== 1) return null;
  const targets = askedAll ? DEPARTMENTS : selected;
  const sections = [];
  const evidence = [];
  for (const department of targets) {
    const source = officialSources.find(item => item.status === 'Published'
      && (String(item.sourceUrl || '').toLowerCase().includes(`/department/${department.slug}`)
        || String(item.sourceUrl || '').toLowerCase().endsWith(department.sourcePath))
      && String(item.extractedText || '').trim());
    if (!source) continue;
    const people = parseProfiles(source.extractedText);
    if (!people.length) continue;
    const roster = people.map(person => {
      const research = person['area of research interest'] || person['area of research'];
      const details = [person.designation, person.qualification, research, person['teaching experience']].filter(Boolean);
      return `- ${person.name} — ${details.join(' | ')}`;
    }).join('\n');
    sections.push(`### ${department.label} (${people.length})\n${roster}`);
    evidence.push({ id: source.id, title: source.title, category: source.documentType || 'Faculty', source: source.sourceAuthority || 'MITCORER official faculty page', sourceUrl: source.sourceUrl, text: source.extractedText, status: source.status, score: 200 });
  }
  if (!sections.length) return null;
  return {
    source: 'MITCORER official faculty profile pages',
    answer: `${askedAll ? 'Faculty profiles captured from MITCORER official department pages' : `${targets[0].label} faculty, from the published official faculty page`}\n\n${sections.join('\n\n')}\n\nFaculty assignments and profile details can change; see the linked official page for the current listing.`,
    evidence, officialLinks: [], next: '', actionView: 'programs', actionLabel: 'Explore departments', outcomeStatus: 'ANSWERED',
  };
}
