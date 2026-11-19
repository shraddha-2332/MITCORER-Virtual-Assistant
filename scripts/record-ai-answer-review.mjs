import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const directory = path.join(root, 'docs/answer-review');
const packetBytes = fs.readFileSync(path.join(directory, 'review-packet.json'));
const packet = JSON.parse(packetBytes);
// These annotations record the assistant's semantic inspection of the frozen
// answers and cited passages. This script serializes that review; it is not an
// automated semantic evaluator and cannot rate future answers.
const findings = [
  { id: 'AIR-01', severity: 'high', cases: [148], issue: 'Leaked-paper request returned an irrelevant public achievement document.', action: 'Fixed explicit leaked/confidential-paper boundary before retrieval; regression checks refusal and legitimate past-paper request.', state: 'FIXED_PENDING_FULL_VALIDATION' },
  { id: 'AIR-02', severity: 'high', cases: [146], issue: 'An explicitly named other institution entered MITCORER fee clarification.', action: 'Added a bounded named-institution refusal before retrieval. This is not general entity recognition and does not cover every institution.', state: 'FIXED_PENDING_FULL_VALIDATION' },
  { id: 'AIR-03', severity: 'medium', cases: [52, 135], issue: 'The supplied scheme overview does not establish a complete, current scholarship document checklist.', action: 'Public guidance now asks for scheme and academic year and links to scheme portals without inventing documents. Exact checklist contents remain pending institutional source review; the MITCORER checklist URL could not be fetched in this audit.', state: 'MITIGATED_CHECKLIST_SOURCE_REVIEW_REQUIRED' },
  { id: 'AIR-04', severity: 'medium', cases: [51], issue: 'How to get admission previously received eligibility and allotment caveats without the actionable application workflow.', action: 'The response now includes the maintained CAP steps, route/year caution and eligibility conditions, then asks which route the applicant means.', state: 'FIXED_PENDING_FULL_VALIDATION' },
  { id: 'AIR-05', severity: 'medium', cases: [134], issue: 'The maintained about passage asserted that Mitra provides verified guidance; that product claim was not established by the cited passage.', action: 'Public about answers now omit the blanket verified-guidance claim. The maintained institutional record itself was not edited.', state: 'FIXED_PENDING_FULL_VALIDATION' },
  { id: 'AIR-06', severity: 'low', cases: [52, 53, 68, 69, 70], issue: 'Hindi fallback notice uses awkward agreement: "इस जानकारी का समीक्षा किया हुआ हिंदी अनुवाद".', action: 'Changed the template to "इस जानकारी का समीक्षित हिंदी अनुवाद उपलब्ध नहीं है। मूल अंग्रेज़ी जानकारी नीचे दी गई है।"; human language approval still pending.', state: 'FIXED_PENDING_FULL_VALIDATION' },
  { id: 'AIR-07', severity: 'low', cases: [4], issue: 'A tuition-specific question previously received annual total fees without distinguishing tuition from the total.', action: 'Answers now state that the figures are annual totals and that the cited passage does not establish a tuition-only breakdown.', state: 'FIXED_PENDING_FULL_VALIDATION' },
  { id: 'AIR-08', severity: 'low', cases: [17, 20, 54], issue: 'Generic admission-document questions had inconsistent scope and checklist handling.', action: 'The conditional general checklist is paired with a First Year/Direct Second Year and category clarification. Romanized Marathi now receives the same content with a transparent English-fallback notice when a reviewed full Marathi translation is unavailable.', state: 'FIXED_PENDING_FULL_VALIDATION' },
  { id: 'AIR-09', severity: 'low', cases: [105, 111, 113, 133], issue: 'A section labelled hostel and mess fees sometimes contained hostel charges only.', action: 'The section heading now matches the answered scope; the compound hostel question does not relabel hostel-only amounts as mess fees.', state: 'FIXED_PENDING_FULL_VALIDATION' },
  { id: 'AIR-10', severity: 'low', cases: [140], issue: 'An unavailable future-year cutoff previously triggered a round clarification without explaining that the requested year was unsupported.', action: 'The answer now states that no maintained cutoff exists for the requested year and does not predict or invent one.', state: 'FIXED_PENDING_FULL_VALIDATION' },
  { id: 'AIR-11', severity: 'medium', cases: [150], issue: 'A request for an unpublished scholarship amount previously received a scheme overview instead of an amount-unavailable statement.', action: 'The answer now states that no verified amount is established and directs applicants to current official scheme notices.', state: 'FIXED_PENDING_FULL_VALIDATION' },
];
const languageCases = packet.reviews.filter(r => ['mr', 'hi'].includes(r.language.requested)).map(r => r.caseId);
const validationFile = process.argv[2] ? path.resolve(process.argv[2]) : null;
const validation = validationFile ? JSON.parse(fs.readFileSync(validationFile)) : null;
if (validation) {
  const required = ['phase-a', 'backend', 'frontend', 'build', 'lint', 'public', 'workflow-500', 'browser', 'maintainer', 'session', 'audit-150'];
  if (!required.every(name => validation.some(check => check.name === name && check.exitCode === 0))) throw new Error('Complete passing validation required.');
  for (const finding of findings) if (finding.state === 'FIXED_PENDING_FULL_VALIDATION') finding.state = 'FIXED_AND_REGRESSION_VALIDATED';
}
const allCases = packet.reviews.map(r => {
  const number = Number(r.caseId.slice(4));
  const linked = findings.filter(f => f.cases.includes(number));
  return { caseId: r.caseId, reviewedDimensions: ['question relevance', 'claims against supplied passages', 'scope and uncertainty', 'number-to-label bindings', ...(['mr', 'hi'].includes(r.language.requested) ? ['native meaning and caveats', 'terminology and fallback transparency'] : [])],
    result: linked.length ? 'FINDING_RECORDED' : 'NO_ADDITIONAL_ISSUE_IDENTIFIED_IN_AI_PASS',
    findingIds: linked.map(f => f.id),
    note: 'AI inspection against supplied evidence only; source truth and native-speaker approval are not certified.',
    humanReviewCompleted: false };
});
fs.writeFileSync(path.join(directory, 'ai-review.json'), JSON.stringify({
  reviewer: 'Codex assistant involved in implementation', independent: false,
  reviewType: 'AI semantic review, not an external judge run',
  date: '2026-11-19', inputPacketSha256: crypto.createHash('sha256').update(packetBytes).digest('hex'),
  reviewedCases: allCases.length, languageCases, findings, cases: allCases,
  validation: validation ? { file: 'ai-validation/validation.json', checks: validation } : null,
  independentAccuracy: null, humanFluencyScore: null,
}, null, 2));
console.log(`Recorded AI review for ${allCases.length} cases; ${findings.length} grouped findings; no human ratings assigned.`);
