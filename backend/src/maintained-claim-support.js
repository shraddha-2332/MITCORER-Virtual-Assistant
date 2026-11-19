function compact(value) {
  return String(value || '').toLocaleLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]+/g, ' ').trim().replace(/\s+/g, ' ');
}

export function supportsProgrammeIntake(pageText, record) {
  if (record?.facts?.kind !== 'programIntake' || !Array.isArray(record.facts.programs) || record.facts.programs.length === 0) return false;
  const page = compact(pageText);
  return record.facts.programs.every(({ name, intake, choiceCode }) => {
    if (!name || !Number.isSafeInteger(intake) || !/^\d{10}$/.test(String(choiceCode))) return false;
    const start = page.indexOf(`b tech in ${compact(name)}`);
    if (start < 0) return false;
    const claim = page.slice(start, start + 220);
    return claim.includes(`sanctioned intake ${intake} seats`) && claim.includes(`choice code ${choiceCode}`);
  });
}

export function supportsScholarshipSummary(pageText, record) {
  if (record?.id !== 'KB-18' || !record.text || /\b\d+(?:%|,\d{3})\b/.test(record.text)) return false;
  const page = compact(pageText);
  return [
    'rajarshi chhatrapati shahu maharaj', 'punjabrao deshmukh',
    'obc', 'sbc', 'vjnt', 'post matric scholarship',
    'persons with disability', 'minority', 'pragati scholarship scheme for girl students',
  ].every(claim => page.includes(claim));
}

export function supportsMaintainedClaim(pageText, record) {
  if (record?.id === 'KB-10') return supportsProgrammeIntake(pageText, record);
  if (record?.id === 'KB-18') return supportsScholarshipSummary(pageText, record);
  const page = compact(pageText);
  const answer = compact(record?.text);
  const has = (...claims) => claims.every(claim => page.includes(compact(claim)));
  switch (record?.id) {
    case 'KB-17':
      return has('industrial estate no 03 barshi', 'admission helpline +91 91584 14343',
        'college office +91 91584 14444', 'principal mitcorer mitpune edu in', 'info mitcorer mitpune edu in');
    case 'KB-19':
    case 'KB-67':
      return ['bus facility 1', 'bus facility 2', 'bus facility 3'].every((facility) => {
        const start = page.indexOf(facility);
        return start >= 0 && /capacity 60 students wi fi enabled/.test(page.slice(start, start + 100));
      });
    case 'KB-25':
      return page.includes('mht cet jee main scores as per government norms')
        && answer.includes('mht cet') && answer.includes('jee main') && answer.includes('government norms');
    case 'KB-31':
      return page.includes('regular 100 attendance is expected')
        && page.includes('25 absence may be permitted')
        && page.includes('below 75 attendance in theory or laboratory courses')
        && page.includes('grade xx') && page.includes('detained');
    case 'KB-33':
      return has('aicte pragati scholarship scheme for girl students technical degree',
        'merit based scheme')
        && (page.includes('student application open till 30 11 2026')
          || page.includes('student applications are open until 30 11 2026'));
    case 'KB-40':
      return has('industrial estate no 03 barshi', 'barshi railway station', 'kurduvadi junction',
        'central bus stand', 'short auto ride');
    case 'KB-43':
      return ['aptron', 'bulls eye', 'earth solutions', 'increpe technologies', 'khambe sangli',
        'e construct', 'dtl', 'e kida', 'bvg'].every(name => page.includes(name));
    case 'KB-46':
      return has('admission helpline +91 91584 14343', 'college office +91 91584 14444',
        'monday through saturday', '09 30 am', '05 30 pm');
    case 'KB-50':
      return (page.includes('technical forums') && page.includes('hackathons'))
        || (page.includes('asimit overview') && page.includes('management forum'))
        || (page.includes('student association') && page.includes('robo race'));
    case 'KB-51':
      return ['kubota tractor workshop barshi', 'micrometal technologies kolhapur',
        'metro rail corporation ltd pune', 'viky refrigeration kolhapur'].every(name => page.includes(name));
    case 'KB-54':
      return has('institute code 06901', 'status un aided', 'autonomy status non autonomous',
        'minority status non minority');
    case 'KB-55':
      return has('institute code 06901', 'status un aided', 'minority status non minority')
        && /institute wise category wise (?:seat matrix|seats seat matrix)/.test(page);
    case 'KB-56':
      return page.includes('0690199510') && page.includes('artificial intelligence and data science')
        || page.includes('0690126310') && page.includes('artificial intelligence and data science');
    case 'KB-62':
      return ['syllabus', 'faculty profile', 'departmental calendar', 'laboratory details',
        'previous yrs question papers'].every(item => page.includes(item));
    case 'KB-65':
      return page.includes('internship opportunity') && page.includes('summer term')
        && page.includes('winter term') && page.includes('submit a report on the internship');
    case 'KB-68':
    case 'KB-SRC-24-TEXT-1':
      return page.includes('hostel accommodations') && !page.includes('hostel application')
        && !page.includes('hostel room availability');
    case 'KB-SRC-11-TEXT-1':
      return page.includes('circular no 06') && page.includes('biometric attendance is mandatory')
        && page.includes('academic year 2026 27');
    default:
      return Boolean(answer && page.includes(answer));
  }
}
