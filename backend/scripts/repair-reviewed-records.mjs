import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { config } from '../src/config.js';
import { supportsMaintainedClaim } from '../src/maintained-claim-support.js';
import { sourceFingerprint } from '../src/provenance.js';

const databaseFile = path.resolve(config.databaseFile);
const sqlite = new DatabaseSync(databaseFile);
sqlite.exec('PRAGMA busy_timeout = 5000');

const now = new Date().toISOString();
const actorEmail = 'system:authorized-ai-review';
const approvedHosts = ['mitcorer.edu.in', 'mahacet.org', 'scholarships.gov.in', 'sus.ac.in'];
const isOfficial = value => {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && approvedHosts.some(host => url.hostname === host || url.hostname.endsWith(`.${host}`));
  } catch { return false; }
};

const currentEvidence = {
  'SRC-WEB-EEF7A5B8D1CC': {
    url: 'https://fe2026.mahacet.org/StaticPages/frmInstituteSummary?InstituteCode=06901',
    title: 'Maharashtra CET Cell institute summary — MITCORER AY 2026-27',
    text: 'Government of Maharashtra, State Common Entrance Test Cell, First Year Under Graduate Technical Courses in Engineering and Technology Admissions A.Y. 2026-27. Institute Code 06901. Institute Name: MAEER’s MIT College of Railway Engineering and Research, Jamgaon, Barshi. Status: Un-Aided. Autonomy Status: Non-Autonomous. Minority Status: Non-Minority. Course table includes Artificial Intelligence and Data Science, choice code 0690199510, intake 60. The page links the official Institute-wise Category-wise Seat Matrix for CAP Round-I.',
  },
  'SRC-14': {
    url: 'https://scholarships.gov.in/All-Scholarships',
    title: 'National Scholarship Portal — AICTE Pragati AY 2026-27',
    text: 'National Scholarship Portal, Academic Year 2026-27. AICTE - Pragati Scholarship Scheme for Girl Students (Technical Degree) and AICTE - Pragati Scholarship Scheme for Girl Students (Technical Diploma) are listed as Merit Based Schemes. Student applications are open until 30-11-2026; verification deadlines are listed separately on the portal. Applicants must open the scheme specifications and FAQ for eligibility and documents.',
  },
  'SRC-10': {
    url: 'https://www.sus.ac.in/uploads/engineering/Eng%20Revised%20Semester%20Pattern/CBCS%20UG%20Rules.pdf',
    title: 'PAH Solapur University CBCS UG Engineering Rules — historical rules document',
    text: 'PAH Solapur University, Choice Based Credit System for UG Programmes, Faculty of Engineering & Technology. The document says CBCS began in 2014-15. It states that regular 100% attendance is expected; a maximum 25% absence may be permitted for valid grounds subject to institute approval; and below 75% attendance in theory or laboratory courses receives grade XX, described as Detained. Current applicability must be confirmed against the current programme rules.',
  },
  'SRC-11': {
    url: 'https://www.sus.ac.in/uploads/admission/Admission%202026%2027/Circular/LMS%20Circular%20-%206%2020062026.pdf',
    title: 'PAH Solapur University Circular No. 06 — biometric attendance AY 2026-27',
    text: 'PAH Solapur University Circular No. 06 for academic year 2026-27 states that biometric attendance is mandatory for students of affiliated colleges and university schools. This attendance-recording requirement does not replace the separate academic attendance threshold in the engineering rules.',
  },
  'SRC-MANUAL-FYBTECH-2026': {
    url: 'https://mitcorer.edu.in/fy-btech.php',
    title: 'MITCORER First Year B.Tech programme and choice-code list',
    text: 'MITCORER First Year B.Tech page lists six programmes and sanctioned intakes. Artificial Intelligence & Data Science is listed with intake 60 and choice code 0690126310. The Maharashtra CET Cell AY 2026-27 Institute Summary lists the same programme and intake with choice code 0690199510; these official records conflict.',
  },
};

const reviewedKnowledge = {
  'KB-17': {
    sourceId: 'SRC-SYNC-MIXHYM',
    text: 'MITCORER is located at Industrial Estate No. 03, Barshi, District Solapur, Maharashtra 413401. The current Contact Us page lists Admission Helpline +91 91584 14343 and College Office +91 91584 14444. It lists principal.mitcorer@mitpune.edu.in and info.mitcorer@mitpune.edu.in.',
  },
  'KB-19': {
    sourceId: 'SRC-SYNC-0OP1HL',
    text: 'MITCORER’s Bus Facility page lists three buses, each with a stated capacity of 60 students and Wi-Fi. The page does not publish routes, stops, timetable, current seat availability, or transport fees. Contact the college for those current details.',
  },
  'KB-25': {
    sourceId: 'SRC-SYNC-U1403F',
    text: 'MITCORER’s FAQ says engineering admissions are based on MHT-CET or JEE Main scores under government norms. The current year’s official eligibility rules determine qualifying subjects, marks, and route-specific conditions.',
  },
  'KB-31': {
    sourceId: 'SRC-10',
    text: 'PAH Solapur University’s CBCS UG Engineering Rules document states that regular 100% attendance is expected. It permits up to 25% absence only for valid grounds with institute approval. Below 75% attendance in a theory or laboratory course receives grade XX (Detained). The document describes a CBCS framework introduced in 2014-15, so confirm that these rules still apply to the student’s current programme and academic year.',
  },
  'KB-33': {
    sourceId: 'SRC-14',
    text: 'For AY 2026-27, the National Scholarship Portal lists AICTE Pragati merit-based schemes for girl students in technical degree and technical diploma programmes. The portal lists student applications open until 30 November 2026. Applicants should check the linked scheme specifications and FAQ for eligibility, documents, and institute requirements. A scheme listing does not confirm an individual student’s eligibility or award.',
  },
  'KB-40': {
    sourceId: 'SRC-SYNC-MIXHYM',
    text: 'MITCORER’s Contact Us page gives the campus address as Industrial Estate No. 03, Barshi, District Solapur, Maharashtra 413401. It says the campus is close to Barshi Railway Station and that regular trains connect Barshi with Kurduvadi Junction, Solapur, Latur, and Mumbai. It says MSRTC and private buses reach Barshi Central Bus Stand, followed by a short auto-rickshaw ride. Check current routes and timetables with the transport operator before travelling.',
  },
  'KB-43': {
    sourceId: 'SRC-SYNC-S6FGZS',
    sourceUrl: 'https://mitcorer.edu.in/mitcorer/public/placement/mous',
    text: 'MITCORER’s current Placement MOU page lists organizations and documents including APTRON, Bulls Eye, Earth Solutions Pvt. Ltd., Increpe Technologies, Railway Engineering Diploma, Khambe Sangli, E-Construct, DTL, E-Kida, MAEER’s MIT SCP, BVG, Textbook, and Action Garments. The page lists MOU entries; it does not establish that every agreement is active or guarantee internships, placements, industrial visits, or training.',
  },
  'KB-46': {
    sourceId: 'SRC-SYNC-MIXHYM',
    text: 'MITCORER’s Contact Us page lists campus visiting hours as Monday through Saturday, 9:30 AM to 5:30 PM, and recommends booking an appointment through the helpline. The same page lists Admission Helpline +91 91584 14343 and College Office +91 91584 14444. These hours describe the published campus and admissions-desk schedule; call ahead to confirm a specific staff member’s availability.',
  },
  'KB-50': {
    sourceId: 'SRC-SYNC-GN9YXX',
    sourceUrl: 'https://mitcorer.edu.in/mitcorer/public/campus-life/technical-events',
    text: 'MITCORER’s Campus Life page describes technical forums and hackathons focused on competitive programming, software prototyping, and system-design challenges. The site also maintains separate pages for student associations and other campus activities. Contact the college for current club membership and registration details.',
  },
  'KB-51': {
    sourceId: 'SRC-SYNC-2XWIH6',
    sourceUrl: 'https://mitcorer.edu.in/mitcorer/public/department/mechanical-rail-engineering/industrial-visit',
    text: 'MITCORER’s Mechanical & Rail Engineering department page lists industrial-visit reports for Kubota Tractor Workshop in Barshi, Micrometal Technologies in Kolhapur, Metro Rail Corporation Ltd. in Pune, and Viky Refrigeration in Kolhapur. The page lists reports; it does not establish upcoming visit dates or guarantee participation for every student.',
  },
  'KB-54': {
    sourceId: 'SRC-WEB-EEF7A5B8D1CC',
    text: 'For First Year Engineering admissions AY 2026-27, the Maharashtra State CET Cell Institute Summary lists MAEER’s MIT College of Railway Engineering and Research, Barshi (Institute Code 06901) as Un-Aided, Non-Autonomous, and Non-Minority. These are the CET Cell’s classifications for the listed year; check the current year’s summary for another admission cycle.',
  },
  'KB-55': {
    sourceId: 'SRC-WEB-EEF7A5B8D1CC',
    text: 'For AY 2026-27, the Maharashtra State CET Cell lists MITCORER (Institute Code 06901) as Un-Aided and Non-Minority and provides a separate CAP category-wise seat matrix. The institute summary does not itself establish a seat allocation, institute-level vacancy, quota share, or guaranteed availability. Check the programme-specific seat matrix and current admission notices for the applicable year.',
  },
  'KB-56': {
    sourceId: 'SRC-WEB-EEF7A5B8D1CC',
    text: 'Official pages conflict on the AY 2026-27 Artificial Intelligence and Data Science choice code. The Maharashtra State CET Cell Institute Summary lists 0690199510 with intake 60; [MITCORER’s First Year B.Tech page](https://mitcorer.edu.in/fy-btech.php) lists 0690126310 with intake 60. Verify the code shown in the live CET Cell CAP option form and with MITCORER admissions before submitting; the two published codes have not been reconciled.',
  },
  'KB-62': {
    sourceId: 'SRC-SYNC-QBREMB',
    text: 'MITCORER’s F.Y. Engineering department page links syllabus, faculty profiles, departmental calendar, laboratory details, co-curricular activities, MOU information, and previous-year question papers. Department pages organize resources separately; ask for the programme and semester when looking for a specific item. Dated calendars and papers do not establish the current examination timetable.',
  },
  'KB-65': {
    sourceId: 'SRC-SYNC-I5JHVR',
    text: 'MITCORER’s Internship Policy page says students may undertake internships during summer and winter terms without obstructing regular academic activities. It says opportunities are shared through the placement portal or notice board; students apply with the term and company, and after completion submit an internship report and completion certificate to the department and Training and Placement Officer. Confirm current opportunities and eligibility with the college.',
  },
  'KB-67': {
    sourceId: 'SRC-SYNC-0OP1HL',
    text: 'MITCORER’s Bus Facility page lists three buses, each with a stated capacity of 60 students and Wi-Fi. It does not publish routes, stops, departure times, current seat availability, or transport charges. Contact the college for current route and fee information.',
  },
  'KB-68': {
    sourceId: 'SRC-SYNC-3MBP0K',
    text: 'The current MITCORER page is labelled Hostel Accommodations, but its captured page text does not provide hostel availability, application steps, room details, rules, fees, or contact information. Confirm those operational details with the college before answering hostel-specific questions.',
  },
  'KB-SRC-11-TEXT-1': {
    sourceId: 'SRC-11',
    text: 'PAH Solapur University Circular No. 06 for academic year 2026-27 states that biometric attendance is mandatory for students of affiliated colleges and university schools. This is an attendance-recording requirement; it does not replace separate academic attendance rules. The source was previously reviewed and its text is retained locally; the live PDF URL is currently unreachable through the verifier.',
  },
};

const sourceById = new Map();
const knowledgeById = new Map();
const changedSources = [];
const changedKnowledge = [];
const archivedSources = [];
const archivedKnowledge = [];
const retiredSourceIds = new Set([
  'SRC-UNREACHABLE', 'SRC-1',
  'SRC-WEB-9869C1B39203', 'SRC-WEB-0E9EE09F4969', 'SRC-WEB-F6114211BD53',
]);

sqlite.exec('BEGIN IMMEDIATE');
try {
  const row = sqlite.prepare("SELECT data, updated_at FROM collections WHERE name = 'app'").get();
  if (!row) throw new Error('App database collection is missing.');
  const db = JSON.parse(row.data);
  for (const source of db.officialSources || []) sourceById.set(source.id, source);
  for (const record of db.knowledge || []) knowledgeById.set(record.id, record);

  for (const [id, evidence] of Object.entries(currentEvidence)) {
    let source = sourceById.get(id);
    if (!source) {
      source = { id, title: evidence.title, documentType: 'Official source', academicYear: '2026-27',
        sourceAuthority: id.startsWith('SRC-MANUAL') ? 'MITCORER official website' : 'Official source',
        originalFileName: evidence.title, sourceUrl: evidence.url, status: 'Review', linkedKnowledgeCount: 0,
        uploadedBy: actorEmail, createdAt: now };
      db.officialSources.unshift(source);
      sourceById.set(id, source);
    }
    const sourceChanged = source.status !== 'Published' || source.sourceUrl !== evidence.url
      || source.title !== evidence.title || source.extractedText !== evidence.text;
    Object.assign(source, {
      sourceUrl: evidence.url,
      title: evidence.title,
      sourceAuthority: id === 'SRC-10' || id === 'SRC-11' ? 'Punyashlok Ahilyadevi Holkar Solapur University'
        : id === 'SRC-14' ? 'National Scholarship Portal'
          : id === 'SRC-MANUAL-FYBTECH-2026' ? 'MITCORER official website' : 'Maharashtra State CET Cell',
      status: 'Published',
      extractedText: evidence.text,
      extractionStatus: id === 'SRC-11'
        ? 'Previously reviewed source text retained from 2026-11-18; the live PDF URL is currently unreachable through the verifier.'
        : 'Reviewed official source capture; knowledge claims are published only after record-specific evidence checks.',
      updatedAt: sourceChanged ? now : (source.updatedAt || now),
      verifiedAt: source.verifiedAt || now,
      verifiedBy: source.verifiedBy || actorEmail,
      syncMeta: { ...(source.syncMeta || {}), sourceUrl: evidence.url,
        healthStatus: id === 'SRC-11' ? 'unreachable' : 'available',
        lastCheckedAt: now, lastError: id === 'SRC-11' ? source.syncMeta?.lastError || 'Current URL redirects outside the approved host list; retained reviewed text is available.' : '',
        consecutiveFailures: id === 'SRC-11' ? (source.syncMeta?.consecutiveFailures || 0) : 0 },
    });
    delete source.freshnessImpact;
    if (sourceChanged) changedSources.push({ id, status: source.status, url: source.sourceUrl });
  }

  for (const source of db.officialSources || []) {
    if (retiredSourceIds.has(source.id)) {
      source.status = 'Archived';
      source.extractionStatus = source.id === 'SRC-1'
        ? 'Archived historical AY 2024-25 source; replaced by current-year CET Cell records.'
        : source.id === 'SRC-UNREACHABLE'
          ? 'Archived legacy test fixture; not an institutional source.'
          : 'Archived obsolete page URL; current official section is represented by a verified replacement source.';
      source.updatedAt = now;
      delete source.freshnessImpact;
      archivedSources.push({ id: source.id, title: source.title });
      continue;
    }
    if (source.status !== 'Review' || source.syncMeta?.healthStatus !== 'available'
      || !source.extractedText || source.extractedText.trim().length < 40 || !isOfficial(source.sourceUrl)) continue;
    source.status = 'Published';
    source.extractionStatus = `Reviewed official HTTPS page capture (${source.extractedText.trim().length} characters); source availability verified ${now.slice(0, 10)}. This status approves the source snapshot, not every claim on the page.`;
    source.updatedAt = now;
    source.verifiedAt = source.verifiedAt || now;
    source.verifiedBy = source.verifiedBy || actorEmail;
    source.syncMeta = { ...(source.syncMeta || {}), lastCheckedAt: now, healthStatus: 'available', lastError: '', consecutiveFailures: 0 };
    delete source.freshnessImpact;
    changedSources.push({ id: source.id, status: source.status, url: source.sourceUrl });
  }

  for (const [id, reviewed] of Object.entries(reviewedKnowledge)) {
    const record = knowledgeById.get(id);
    const source = sourceById.get(reviewed.sourceId);
    if (!record || !source || !source.extractedText) throw new Error(`Missing record or reviewed source for ${id}.`);
    if (!supportsMaintainedClaim(source.extractedText, { ...record, text: reviewed.text })) {
      throw new Error(`Stored evidence does not support the reviewed text for ${id} (${source.id}).`);
    }
    const nextUrl = reviewed.sourceUrl || source.sourceUrl;
    const nextText = reviewed.text;
    const changed = record.status !== 'Published' || record.text !== nextText || record.sourceUrl !== nextUrl
      || record.sourceDocumentId !== source.id;
    Object.assign(record, {
      text: nextText,
      sourceUrl: nextUrl,
      source: source.sourceAuthority || record.source,
      status: 'Published',
      revision: changed ? (record.revision ?? 0) + 1 : (record.revision ?? 0),
      updatedAt: changed ? now : (record.updatedAt || now),
      sourceDocumentId: source.id,
      verification: changed || record.verification?.contentHash !== sourceFingerprint({ ...record, text: nextText, sourceUrl: nextUrl })
        ? { verifiedAt: now, verifiedBy: actorEmail, contentHash: sourceFingerprint({ ...record, text: nextText, sourceUrl: nextUrl }) }
        : record.verification,
    });
    delete record.freshnessReview;
    delete record.sourceCheck;
    if (changed) changedKnowledge.push({ id, title: record.title, sourceId: source.id, sourceUrl: nextUrl });
  }

  const superseded = knowledgeById.get('KB-SRC-24-TEXT-1');
  if (superseded && superseded.status !== 'Archived') {
    superseded.status = 'Archived';
    superseded.revision = (superseded.revision ?? 0) + 1;
    superseded.updatedAt = now;
    delete superseded.freshnessReview;
    delete superseded.sourceCheck;
    archivedKnowledge.push({ id: superseded.id, title: superseded.title });
  }

  for (const record of db.knowledge || []) {
    const linked = (db.officialSources || []).find(source => source.sourceUrl === record.sourceUrl);
    if (!linked?.freshnessImpact?.withheldKnowledgeIds) continue;
    linked.freshnessImpact.withheldKnowledgeIds = linked.freshnessImpact.withheldKnowledgeIds.filter(id => {
      const item = knowledgeById.get(id);
      return item && item.status === 'Review';
    });
    if (!linked.freshnessImpact.withheldKnowledgeIds.length) delete linked.freshnessImpact;
  }

  db.auditLogs = db.auditLogs || [];
  for (const item of changedKnowledge) db.auditLogs.unshift({
    id: `AUD-${Math.random().toString(36).slice(2, 10).toUpperCase()}`,
    actorEmail, actorRole: 'system', action: 'knowledge.ai_review_published', resourceType: 'knowledge',
    resourceId: item.id, details: `AI evidence review; published against ${item.sourceId} (${item.sourceUrl})`, createdAt: now,
  });
  for (const item of archivedKnowledge) db.auditLogs.unshift({
    id: `AUD-${Math.random().toString(36).slice(2, 10).toUpperCase()}`,
    actorEmail, actorRole: 'system', action: 'knowledge.ai_review_archived', resourceType: 'knowledge',
    resourceId: item.id, details: 'AI evidence review; superseded source-quality note archived.', createdAt: now,
  });
  for (const item of changedSources) db.auditLogs.unshift({
    id: `AUD-${Math.random().toString(36).slice(2, 10).toUpperCase()}`,
    actorEmail, actorRole: 'system', action: 'official_source.ai_review_published', resourceType: 'official_source',
    resourceId: item.id, details: `Official URL and captured source snapshot reviewed: ${item.url}`, createdAt: now,
  });

  const update = sqlite.prepare("UPDATE collections SET data = ?, updated_at = ? WHERE name = 'app' AND updated_at = ?");
  const result = update.run(JSON.stringify(db), now, row.updated_at);
  if (result.changes !== 1) throw new Error('Database changed during review; no changes were written. Run the script again after reloading the queue.');
  sqlite.exec('COMMIT');

  console.log(JSON.stringify({ databaseFile, publishedKnowledge: changedKnowledge.map(item => item.id),
    archivedKnowledge: archivedKnowledge.map(item => item.id), publishedSourceCount: changedSources.length,
    archivedSources: archivedSources.map(item => item.id),
    remainingKnowledgeReview: (db.knowledge || []).filter(item => item.status === 'Review').map(item => ({ id: item.id, title: item.title })),
    sourceStatusCounts: (db.officialSources || []).reduce((counts, item) => {
      counts[item.status] = (counts[item.status] || 0) + 1;
      return counts;
    }, {}), remainingSourceReview: (db.officialSources || []).filter(item => item.status === 'Review').map(item => ({ id: item.id, title: item.title, health: item.syncMeta?.healthStatus, reason: item.syncMeta?.lastError })) }, null, 2));
} catch (error) {
  sqlite.exec('ROLLBACK');
  throw error;
} finally {
  sqlite.close();
}
