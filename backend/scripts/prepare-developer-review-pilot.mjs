import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const backendRoot = path.resolve(here, '..');
const casesPath = path.join(backendRoot, 'evaluation/developer-review-cases-90.json');
const runPath = path.resolve(backendRoot, process.argv[2] || 'evaluation/reports/developer-review-run.json');
const outputPath = path.resolve(backendRoot, process.argv[3] || 'evaluation/reports/developer-review-pilot-12.json');
const cases = JSON.parse(await fs.readFile(casesPath, 'utf8'));
const report = JSON.parse(await fs.readFile(runPath, 'utf8'));
const chosenIds = ['05', '15', '19', '30'];
const pilot = [];
for (const language of ['en', 'mr', 'hi']) {
  for (const suffix of chosenIds) {
    const id = `DEV-${language.toUpperCase()}-${suffix}`;
    const source = cases.find(item => item.caseId === id);
    const response = report.rows.find(item => item.id === id);
    if (!source || !response) throw new Error(`Missing source case or local run response for ${id}`);
    if (!response.answer || !source.referenceAnswer) throw new Error(`Missing answer/reference for ${id}`);
    if (response.contexts.length > 8 || response.contexts.some(text => text.length > 6000)) throw new Error(`Context size limit exceeded for ${id}`);
    const payloadText = [source.turns.at(-1).text, response.answer, ...response.contexts].join('\n');
    if (/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i.test(payloadText)
      || /(?:\+?91[\s-]?)?[6-9]\d{9}/.test(payloadText)) throw new Error(`Potential contact information found in ${id}; inspect and sanitize manually before provider submission.`);
    pilot.push({ id, question: source.turns.at(-1).text, answer: response.answer,
      contexts: response.contexts, reference: source.referenceAnswer });
  }
}
if (pilot.length !== 12) throw new Error(`Expected exactly 12 pilot cases, got ${pilot.length}`);
if (await fs.access(outputPath).then(() => true).catch(() => false)) throw new Error(`Refusing to overwrite ${outputPath}`);
await fs.writeFile(outputPath, `${JSON.stringify(pilot, null, 2)}\n`, { flag: 'wx' });
console.log(JSON.stringify({ output: outputPath, caseCount: pilot.length,
  languages: { en: 4, mr: 4, hi: 4 }, adjudicatorType: 'developer assistant; not human or independent',
  humanFaithfulLabels: 0, contextsPresent: pilot.filter(item => item.contexts.length > 0).length }, null, 2));
