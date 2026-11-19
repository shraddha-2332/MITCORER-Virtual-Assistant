// Prepare candidate cases from a supplied CSV. Independent review is recorded separately.
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const backendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const [inputArg, outputArg] = process.argv.slice(2);
if (!inputArg || !outputArg) {
  throw new Error('Usage: node scripts/build-human-evaluation-dataset.mjs <fresh-cases.csv> <candidate-output.json>');
}
const inputPath = path.resolve(inputArg);
const outputPath = path.resolve(outputArg);
const manifestPath = outputPath.replace(/\.json$/i, '.manifest.json');
if (manifestPath === outputPath) throw new Error('Output path must end in .json.');
if (inputPath === outputPath) throw new Error('Input and output must differ.');
const sha256 = (bytes) => crypto.createHash('sha256').update(bytes).digest('hex');

function parseCsv(text) {
  const rows = [];
  let row = [], field = '', quoted = false;
  const input = text.replace(/^\uFEFF/, '');
  for (let i = 0; i < input.length; i++) {
    const char = input[i];
    if (quoted) {
      if (char === '"' && input[i + 1] === '"') { field += '"'; i++; }
      else if (char === '"') quoted = false;
      else field += char;
    } else if (char === '"') quoted = true;
    else if (char === ',') { row.push(field); field = ''; }
    else if (char === '\n') { row.push(field.replace(/\r$/, '')); rows.push(row); row = []; field = ''; }
    else field += char;
  }
  if (quoted) throw new Error('CSV has an unclosed quoted field.');
  if (field || row.length) { row.push(field); rows.push(row); }
  const [headers, ...values] = rows;
  if (!headers) throw new Error('CSV is empty.');
  const required = ['case_id', 'language', 'topic', 'question', 'author_reviewer_code'];
  for (const name of required) if (!headers.includes(name)) throw new Error(`CSV is missing ${name}.`);
  return values.filter((fields) => fields.some((value) => value.trim())).map((fields, index) => {
    if (fields.length !== headers.length) throw new Error(`CSV row ${index + 2} has the wrong number of columns.`);
    return Object.fromEntries(headers.map((name, column) => [name, fields[column].trim()]));
  });
}

const csvBytes = await fs.readFile(inputPath);
const rows = parseCsv(csvBytes.toString('utf8'));
if (!rows.length) throw new Error('CSV contains no cases.');
const ids = new Set();
for (const row of rows) {
  if (!row.case_id || !row.question || !row.author_reviewer_code) throw new Error('Every case needs an ID, question and author code.');
  if (!['en', 'mr', 'hi'].includes(row.language)) throw new Error(`Unsupported language for ${row.case_id}.`);
  if (ids.has(row.case_id)) throw new Error(`Duplicate case ID: ${row.case_id}.`);
  ids.add(row.case_id);
}
const corpusManifestPath = path.join(backendRoot, 'evaluation/corpora/reviewed-public-corpus.manifest.json');
const corpusManifest = JSON.parse(await fs.readFile(corpusManifestPath, 'utf8'));
const cases = rows.map((row) => ({
  schemaVersion: 1,
  status: 'candidate-needs-independent-adjudication',
  caseId: row.case_id,
  corpusSha256: corpusManifest.outputSha256,
  split: 'review-candidate',
  authorReviewerCode: row.author_reviewer_code,
  independenceConfirmed: false,
  language: row.language,
  topic: row.topic,
  turns: [{ role: 'user', text: row.question }],
  proposedAnswerability: row.reference_answerability || null,
  proposedDecision: row.reference_expected_decision || null,
  proposedEvidenceIds: (row.source_page_or_record_id || '').split(';').map((value) => value.trim()).filter(Boolean),
  proposedRequiredClaims: (row.required_facts || '').split(';').map((value) => value.trim()).filter(Boolean),
  reviewerAnnotations: [],
  adjudication: null,
  exposure: { hasBeenExecuted: false, firstExecutionAt: null, questionHashes: [] },
}));
const content = Buffer.from(`${JSON.stringify(cases, null, 2)}\n`);
const manifest = {
  schemaVersion: 1,
  datasetId: path.basename(outputPath, '.json'),
  independent: false,
  reviewStatus: 'candidate-needs-independent-adjudication',
  createdAt: new Date().toISOString(),
  caseCount: cases.length,
  inputCsvSha256: sha256(csvBytes),
  caseFileSha256: sha256(content),
  corpusSha256: corpusManifest.outputSha256,
};
await fs.mkdir(path.dirname(outputPath), { recursive: true });
const outputHandle = await fs.open(outputPath, 'wx');
try { await outputHandle.writeFile(content); }
finally { await outputHandle.close(); }
try { await fs.writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, { flag: 'wx' }); }
catch (error) { await fs.unlink(outputPath); throw error; }
console.log(JSON.stringify({ dataset: outputPath, manifest: manifestPath, caseCount: cases.length, reviewStatus: manifest.reviewStatus }, null, 2));
