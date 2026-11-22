const links = {
  syllabusHome: 'https://www.sus.ac.in/bos/Syllabus-Home',
  syllabusNep: 'https://www.sus.ac.in/bos/NEP-2020-Syllabus',
  syllabusCurrent: 'https://www.sus.ac.in/bos/Faculty-Of-Science-And-Technology-UG-Syllabus-2026-27',
  syllabusPrevious: 'https://www.sus.ac.in/bos/Faculty-Of-Science-And-Technology-UG-Syllabus-2025-26',
  syllabusLegacy: 'https://www.sus.ac.in/engineering/Syllabus',
  timetable: 'https://www.sus.ac.in/examination/Time-Table',
  papers: 'https://www.sus.ac.in/examination/Question-Papers',
  results: 'https://www.sus.ac.in/examination/Online-Result-(Ledger)',
  revaluation: 'https://www.sus.ac.in/examination/Online-Application/',
  examForms: 'https://www.sus.ac.in/examination/Forms-Related-To-Examinations',
  questionBank: 'https://www.sus.ac.in/examination/Question-Bank',
  circulars: 'https://www.sus.ac.in/examination/Circulars',
  studentHelpline: 'https://www.sus.ac.in/examination/Student-Helpline',
  sfc: 'https://www.sus.ac.in/sfc/Student-Facilitation-Centre',
  studentApplications: 'https://www.sus.ac.in/examination/Online-Application/',
  convocation: 'https://www.sus.ac.in/examination/Convocation',
  certificateApplications: 'https://su.digitaluniversity.ac/SFCShedule.aspx?ID=29329',
  universityAdmission: 'https://www.sus.ac.in/admission/Admission-2026-27',
  eligibility: 'https://www.sus.ac.in/admission/Eligibility',
  mitcorerAdmissions: 'https://mitcorer.edu.in/mitcorer/public/admissions',
  mitcorerDse: 'https://mitcorer.edu.in/mitcorer/public/admissions/dsy-overview',
  mitcorerPolytechnic: 'https://mitcorer.edu.in/mitcorer/public/department/polytechnic',
  mitcorerCalendar: 'https://mitcorer.edu.in/academic-calender.php',
  mitcorerPlacement: 'https://mitcorer.edu.in/mitcorer/public/placements',
  mitcorerPlacementRecords: 'https://mitcorer.edu.in/mitcorer/public/placement/record',
  mitcorerScholarships: 'https://mitcorer.edu.in/mitcorer/public/admissions/scholarship',
  mitcorerDocuments: 'https://mitcorer.edu.in/fy-btech-documents.php',
  mitcorerDseDocuments: 'https://mitcorer.edu.in/d-sy-btech-documents-required.php',
  mitcorerPolytechnicDocuments: 'https://mitcorer.edu.in/fy-polytechnic-documents.php',
  mahadbt2026: 'https://mahadbt2.maharashtra.gov.in/',
  nationalScholarships: 'https://scholarships.gov.in/',
  technicalAdmissions: 'https://fe2026.mahacet.org/StaticPages/HomePage',
};

function hasFindIntent(q) {
  return /\b(where|how|find|locate|link|url|website|webpage|page|section|workflow|navigate|download|access|get|apply|submit|check)\b/i.test(q)
    || /\b(syllabus|timetable|time table|question papers?|results?|revaluation|photocopy|scholarships?|placement records?|admission documents?)\b/i.test(q);
}

function hasDirectNavigationIntent(q) {
  return /\b(where|find|locate|link|url|website|webpage|page|section|navigate|download|access|apply|submit|check)\b/i.test(q);
}

function response(source, answer, officialLinks) {
  return { source, answer, evidence: [], officialLinks, model: 'deterministic-rag-fallback', outcomeStatus: 'ANSWERED' };
}

export function buildOfficialNavigationAnswer(question) {
  const q = question.toLowerCase();
  if (/\b(?:scholarships?|pragati|mahadbt|nsp)\b/.test(q)
    && (!hasDirectNavigationIntent(q) || /\b(?:what|which|tell|explain|details)\b/.test(q))) return null;
  if (/\bplacement\b/.test(q) && !/\b(?:where|find|link|url|page|navigate|download)\b/.test(q)) return null;
  if (/\b(?:admission|reporting)\b/.test(q) && /\b(?:documents?|certificates?|marksheets?)\b/.test(q) && !hasFindIntent(q)) return null;
  // Mixed fact/application questions belong to factual handlers with links.
  if (/\b(?:scholarships?|pragati|placement|recruiters?|faculty|admission)\b/.test(q)
    && /\b(?:what|which|tell|explain|details|how many|process|steps|procedure|eligible|eligibility|get admission|apply for admission|apply for .*admission)\b/.test(q)
    && !hasDirectNavigationIntent(q) && !/\b(?:documents?|certificates?|marksheets?|checklist)\b/.test(q)) return null;
  if (!hasFindIntent(q)) return null;

  const asksUniversity = /\b(pahsu|solapur university|university|sus\.ac\.in|b\.?\s*tech|bachelor of technology|engineering|semester|exam|examination|marksheet|migration|transcript|convocation|hall ticket|question bank|question paper|result|revaluation|photocopy|student helpline|eligibility|prospectus|syllabus|circular|ordinance)\b/i.test(q);
  const asksSyllabus = /\b(syllabus|curriculum|subjects?)\b/i.test(q);
  if (asksSyllabus && (asksUniversity || /\b(s\.?y\.?|second year|2nd year|t\.?y\.?|third year|3rd year)\b/i.test(q))) {
    const year = /\b(t\.?y\.?|third year|3rd year)\b/i.test(q) ? 'third year (T.Y.)' : /\b(s\.?y\.?|second year|2nd year)\b/i.test(q) ? 'second year (S.Y.)' : 'required year/semester';
    const branch = /\b(computer science|cse|mechanical|rail|electronics|entc|civil|artificial intelligence|\bai\b|data science)\b/i.test(q)
      ? ' Then open the matching branch and select the ' + year + ' syllabus/structure entry.'
      : ' Then open your engineering branch and select the required year/semester entry.';
    return response('PAHSU B.Tech syllabus navigation',
      `For the university-approved B.Tech syllabus, go to PAHSU → BOS → Faculty of Science and Technology → UG Syllabus → choose the academic year → B.Tech.${branch} The latest year page may not list every branch/year; if your entry is missing, check the previous year page or the Engineering syllabus archive and confirm the applicable syllabus with your department. MITCORER’s department pages are useful for department resources, but PAHSU is the university source for the syllabus.`,
      [
        { label: 'PAHSU All Syllabus index', url: links.syllabusHome },
        { label: 'PAHSU NEP 2020 syllabus index', url: links.syllabusNep },
        { label: 'PAHSU Faculty of Science and Technology UG syllabus 2026–27', url: links.syllabusCurrent },
        { label: 'PAHSU UG syllabus 2025–26', url: links.syllabusPrevious },
        { label: 'PAHSU Engineering syllabus archive', url: links.syllabusLegacy },
      ]);
  }

  if (/\b(timetable|time table|exam schedule|exam date)\b/i.test(q) && asksUniversity) {
    return response('PAHSU examination timetable navigation',
      'Open PAHSU → Examination → Time Table. Find the current examination session/year, then open the Engineering/B.Tech timetable matching your semester. Check the notice date and session before relying on a PDF.',
      [{ label: 'PAHSU Examination Time Table', url: links.timetable }]);
  }
  if (/\b(question papers?|previous papers?|old papers?)\b/i.test(q) && asksUniversity) {
    return response('PAHSU question paper navigation',
      'Open PAHSU → Examination → Question Papers. Select the relevant examination session/year and find your B.Tech branch, semester, and subject. These are past papers; use the current syllabus and timetable for current course/exam information.',
      [{ label: 'PAHSU Examination Question Papers', url: links.papers }]);
  }
  if (/\b(result|marksheet|ledger)\b/i.test(q) && asksUniversity) {
    return response('PAHSU examination results navigation',
      'Open PAHSU → Examination → Online Result (Ledger), then select the exam/course and enter the requested seat or registration details on the official result service.',
      [{ label: 'PAHSU Online Result (Ledger)', url: links.results }]);
  }
  if (/\b(revaluation|verification|photocopy|answer book)\b/i.test(q) && asksUniversity) {
    return response('PAHSU revaluation and verification navigation',
      'Open PAHSU → Examination → Online Application and choose the applicable revaluation, answer-book photocopy, or verification service. Follow the current notice for eligibility, fee, and deadline; these can change by exam session.',
      [{ label: 'PAHSU Examination Online Applications', url: links.revaluation }]);
  }
  if (/\b(question bank|model questions?|practice questions?)\b/i.test(q) && asksUniversity) {
    return response('PAHSU question bank navigation',
      'Open PAHSU → Examination → Question Bank. Choose the programme or subject available there; if you need previous exam papers, use Examination → Question Papers instead.',
      [{ label: 'PAHSU Question Bank', url: links.questionBank }, { label: 'PAHSU Question Papers', url: links.papers }]);
  }
  if (/\b(exam(?:ination)? forms?|exam form|hall ticket|admit card)\b/i.test(q) && asksUniversity) {
    return response('PAHSU examination forms navigation',
      'Open PAHSU → Examination → Forms Related to Examinations for examination forms and related notices. The actual form or submission window may be session-specific, so follow the latest circular and your college instructions.',
      [{ label: 'PAHSU Forms Related to Examinations', url: links.examForms }, { label: 'PAHSU Examination Circulars', url: links.circulars }]);
  }
  if (/\b(circular|notice|notification|ordinance|exam rule|examination rule)\b/i.test(q) && asksUniversity) {
    return response('PAHSU notices and examination rules navigation',
      /\b(ordinance|exam rule|examination rule)\b/i.test(q)
        ? 'Open PAHSU → Examination → Ordinance of Exam for examination rules. For a recent change or session-specific instruction, also check Examination → Circulars.'
        : 'Open PAHSU → Examination → Circulars for examination notices, and check the notice date and academic/exam session before following it.',
      [{ label: 'PAHSU Examination Circulars', url: links.circulars }, { label: 'PAHSU Examination Ordinances', url: 'https://www.sus.ac.in/examination/Ordinance-of-Exam' }]);
  }
  if (/\b(migration|duplicate (?:marksheet|statement of marks)|transcript|degree certificate|provisional certificate|convocation|passing certificate|rank certificate)\b/i.test(q) && asksUniversity) {
    const convocation = /\b(convocation|degree certificate|passing certificate|rank certificate)\b/i.test(q);
    return response('PAHSU student certificate application navigation',
      'Open PAHSU → Examination → Student Corners → Online Application Forms, then select the relevant service (migration, duplicate statement of marks, transcript, or certificate). For convocation, use the Convocation section and its current event notice. Check the linked service for current fees, documents, and application status.',
      [{ label: 'PAHSU Student Online Application Forms', url: links.studentApplications }, { label: 'PAHSU Convocation', url: links.convocation }, ...(convocation ? [{ label: 'PAHSU certificate application portal', url: links.certificateApplications }] : [])]);
  }
  if (/\b(student helpline|student help|facilitation centre|facilitation center|student support|complaint|grievance)\b/i.test(q) && asksUniversity) {
    return response('PAHSU student help and facilitation navigation',
      'For university student support, open PAHSU → Examination → Student Corners → Student Helpline. For in-person or service-related university assistance, use the Student Facilitation Centre page; college-level academic issues should also be raised with your MITCORER department or office.',
      [{ label: 'PAHSU Student Helpline', url: links.studentHelpline }, { label: 'PAHSU Student Facilitation Centre', url: links.sfc }]);
  }
  if (/\b(university admission|university eligibility|eligibility criteria|prospectus|admission notice)\b/i.test(q) && asksUniversity) {
    return response('PAHSU admission and eligibility navigation',
      'Open PAHSU → Admission and Eligibility, then choose Undergraduate or Postgraduate courses and the relevant prospectus/eligibility page. For admission to MITCORER engineering programmes, also follow the current Maharashtra CET Cell and MITCORER admission instructions.',
      [{ label: 'PAHSU Admission 2026–27', url: links.universityAdmission }, { label: 'PAHSU Eligibility', url: links.eligibility }]);
  }

  const asksMitcorer = /\b(mitcorer|mit corer|college|institute|our college)\b/i.test(q);
  if (asksMitcorer && /\b(admission|apply|application|dse|direct second|polytechnic|diploma)\b/i.test(q)
    && !/\b(?:scholarships?|mahadbt|financial aid|documents?|certificates?|marksheets?|reporting|after allotment|how|what|which|tell|explain|details|steps|process|procedure|eligibility|eligible)\b/i.test(q)) {
    const selected = /\b(dse|direct second|second year)\b/i.test(q)
      ? [{ label: 'MITCORER Direct Second Year B.Tech admissions', url: links.mitcorerDse }]
      : /\b(polytechnic|diploma)\b/i.test(q)
        ? [{ label: 'MITCORER Polytechnic department and admissions', url: links.mitcorerPolytechnic }]
        : [{ label: 'MITCORER Admissions', url: links.mitcorerAdmissions }];
    return response('MITCORER admissions navigation',
      'Open the MITCORER site → Admissions, then select the route for your course/year. Use the current-year notice for the live steps, dates, and eligibility; admission procedures and portal links can change each cycle.', selected);
  }
  if (asksMitcorer && /\b(scholarships?|mahadbt|financial aid)\b/i.test(q)
    && /\b(?:link|url|website|webpage|page)\b/i.test(q)) {
    const requestedYear = q.match(/\b20\d{2}-\d{2}\b/)?.[0];
    const mahadbtGuidance = !requestedYear || requestedYear === '2026-27'
      ? 'For Maharashtra MahaDBT applications in AY 2026-27, use MahaDBT 2.0.'
      : `For AY ${requestedYear}, check the official portal for that year's application channel and status.`;
    const mahaDbtUrl = !requestedYear || requestedYear === '2026-27' ? links.mahadbt2026 : 'https://mahadbt.maharashtra.gov.in/';
    const mahaDbtLabel = !requestedYear || requestedYear === '2026-27' ? 'MahaDBT 2.0 (AY 2026-27)' : `MahaDBT portal (AY ${requestedYear})`;
    return response('MITCORER scholarship navigation',
      `Scholarship eligibility, documents, amounts, and deadlines depend on the scheme; confirm them on that scheme’s official portal. ${mahadbtGuidance} Open the MITCORER scheme list to identify the applicable scheme, then verify its current requirements before applying.`,
      [{ label: 'MITCORER Scholarship Schemes', url: links.mitcorerScholarships }, { label: mahaDbtLabel, url: mahaDbtUrl }, { label: 'National Scholarship Portal', url: links.nationalScholarships }]);
  }
  if (asksMitcorer && /\b(document|certificate|marksheet|reporting|after allotment)\b/i.test(q)
    && hasFindIntent(q)) {
    const documentRoute = /\b(?:direct second year|dse|lateral entry)\b/i.test(q) ? 'dse'
      : /\b(?:polytechnic|post\s*ssc|diploma)\b/i.test(q) ? 'polytechnic' : 'firstYear';
    const routeDocumentLink = documentRoute === 'dse'
      ? { label: 'MITCORER Direct Second Year B.Tech documents', url: links.mitcorerDseDocuments }
      : documentRoute === 'polytechnic'
        ? { label: 'MITCORER Polytechnic documents', url: links.mitcorerPolytechnicDocuments }
        : { label: 'MITCORER First Year B.Tech documents', url: links.mitcorerDocuments };
    return response('MITCORER admission document navigation',
      'Required admission documents depend on the course and route (First Year or Direct Second Year, CAP or institute-level). Open the matching MITCORER document list and compare it with the current-year State CET Cell technical admission notice before reporting.',
      [
        routeDocumentLink,
        { label: 'State CET Cell technical admission notices', url: links.technicalAdmissions },
      ]);
  }
  if (asksMitcorer && /\b(calendar|timetable|time table|semester dates|academic year)\b/i.test(q)) {
    return response('MITCORER academic calendar navigation',
      'Open MITCORER → Academic Calendar, then use the current academic year and your programme/department. Dates and timetables are year-specific; verify the year shown on the linked file.',
      [{ label: 'MITCORER Academic Calendar', url: links.mitcorerCalendar }]);
  }
  if (asksMitcorer && /\b(syllabus|curriculum|subjects?|question papers?|department|faculty|laborator(?:y|ies)|labs?)\b/i.test(q)) {
    return response('MITCORER department learning resources navigation',
      'Open MITCORER → Department, choose your programme/branch, then open its academic resources for syllabi, faculty, laboratories, calendars, activities, or previous question papers. For the university-approved B.Tech curriculum, use PAHSU → BOS → All Syllabus and match the academic year and pattern.',
      [{ label: 'MITCORER Engineering Department resources', url: 'https://mitcorer.edu.in/mitcorer/public/department/fy-engineering' }, { label: 'PAHSU All Syllabus index', url: links.syllabusHome }]);
  }
  if (asksMitcorer && /\b(placement|recruiter|company|companies|drive)\b/i.test(q)) {
    const records = /\b(company|companies|recruiter|recruiters|list)\b/i.test(q);
    return response('MITCORER placement navigation',
      records
        ? 'Open MITCORER → Placement → Placement Records for dated recruiter and outcome lists by academic year. Treat those as historical records; use the Training and Placement Cell page for support, platforms, and drive information.'
        : 'Open MITCORER → Placement / Training and Placement Cell for placement support and drive information. Student opportunities may also be shared through the platforms listed by the college; access and eligibility are student-specific.',
      records
        ? [{ label: 'MITCORER Placement Records', url: links.mitcorerPlacementRecords }, { label: 'MITCORER Training and Placement Cell', url: links.mitcorerPlacement }]
        : [{ label: 'MITCORER Training and Placement Cell', url: links.mitcorerPlacement }]);
  }
  return null;
}
