import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const input = path.join(root, 'docs/d11-validation/audit-reviewed-results.json');
const output = path.join(root, 'docs/answer-review');
const bytes = fs.readFileSync(input);
const cases = JSON.parse(bytes);
if (cases.length !== 150 || new Set(cases.map(c => c.id)).size !== 150) throw new Error('Expected 150 unique audit scenarios.');
const hash = text => crypto.createHash('sha256').update(text).digest('hex');
const counts = {};
const reviews = cases.map(item => {
  const response = item.actualResponse || {};
  const evidence = response.evidence || [];
  const flags = [];
  if (evidence.some(e => !e.sourceUrl)) flags.push('source-document-required');
  if (evidence.some(e => e.verification?.status !== 'verified')) flags.push('institutional-verification-required');
  if (response.requestedLanguage && ['mr', 'hi'].includes(response.requestedLanguage)) flags.push('competent-speaker-review-required');
  if (['fallback', 'partial'].includes(response.localizationStatus)) flags.push('incomplete-native-language-coverage');
  if (response.languageReviewStatus) flags.push('inspect-language-review-metadata');
  if (evidence.some(e => e.passage?.text && e.passage.sha256 !== hash(e.passage.text))) flags.push('passage-hash-mismatch');
  for (const flag of flags) counts[flag] = (counts[flag] || 0) + 1;
  return {
    caseId: item.id, question: item.question, conversationGroup: item.conversation,
    developmentAcceptance: item.acceptance, answer: response.answer,
    sections: response.sections || [], outcome: response.outcomeStatus,
    language: { requested: response.requestedLanguage, actual: response.responseLanguage,
      localization: response.localizationStatus, review: response.languageReviewStatus },
    evidence, officialLinks: response.officialLinks || [], automatedReviewPrompts: flags,
    humanReview: { reviewerCode: null, languageCompetence: null, involvedInDevelopment: null,
      sourceDocumentAndPage: null, academicYearAndScopeCorrect: null,
      factualCorrectness: null, conditionsAndNegationPreserved: null,
      numbersAndLabelsBoundCorrectly: null, citationsSupportClaims: null,
      abstentionAppropriate: null, nativeLanguageMeaning: null, fluency: null,
      terminology: null, severity: null, correction: null, reviewedAt: null },
  };
});
fs.mkdirSync(output, { recursive: true });
fs.writeFileSync(path.join(output, 'review-packet.json'), JSON.stringify({
  status: 'DEVELOPMENT_OUTPUTS_AWAITING_HUMAN_REVIEW', independent: false,
  inputSha256: hash(bytes), total: reviews.length,
  interpretation: 'Flags are review prompts, not proven errors. Exposed audit questions cannot become a fresh independent benchmark.',
  flagCounts: counts, reviews,
}, null, 2));
fs.writeFileSync(path.join(output, 'screening-summary.json'), JSON.stringify({
  total: reviews.length, inputSha256: hash(bytes), flagCounts: counts,
  independentFactualAccuracy: null, humanLanguageScores: null,
  passageIntegrityFailures: reviews.filter(r => r.automatedReviewPrompts.includes('passage-hash-mismatch')).map(r => r.caseId),
}, null, 2));
fs.writeFileSync(path.join(output, 'review-sheets.md'), [
  '# MITRA answer review sheets',
  'Development outputs; independent approval pending. All questions were exposed during development. Leave unknown ratings blank; do not assume a missing source URL proves an incorrect answer.',
  'For each case check scope/year, required conditions, negation, number-to-label bindings, cited support and appropriate abstention. Marathi/Hindi reviewers also check meaning, fluency and terminology. Record reviewer code, competence, development involvement and date. Do not add personal applicant information.',
  ...reviews.map(r => [
    `## ${r.caseId}`, `Question: ${r.question}`, `Conversation group: ${r.conversationGroup || 'none'}`,
    `Language: ${r.language.requested || 'unspecified'}; output: ${r.language.actual || 'unspecified'}; localization: ${r.language.localization || 'unspecified'}`,
    '### Answer', r.answer || '(No answer)', '### Cited evidence',
    ...r.evidence.map(e => `${e.id}: ${e.title}\n\nSource URL: ${e.sourceUrl || '(source document required)'}\n\n${e.passage?.text || '(no passage)'}`),
    '### Review', `Prompts: ${r.automatedReviewPrompts.join(', ') || 'standard review'}`,
    'Reviewer / date / competence / development involvement: PENDING',
    'Source document and page: PENDING',
    'Factual correctness / conditions / citation support / language meaning / fluency / terminology: PENDING',
    'Severity and proposed correction: PENDING',
  ].join('\n\n')),
].join('\n\n'));
console.log(JSON.stringify({ total: reviews.length, flags: counts, output }, null, 2));
