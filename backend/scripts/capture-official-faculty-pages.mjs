import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { cleanHtml, defaultFetcher } from '../src/website-sync.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const pages = [
  ['SRC-FACULTY-CSE', 'Computer Science & Engineering', 'https://mitcorer.edu.in/computer-science-engineering-faculty-profile.php'],
  ['SRC-FACULTY-ENTC', 'Electronics & Telecommunication Engineering', 'https://mitcorer.edu.in/electronics-and-tele-communication-engineering-faculty-profile.php'],
  ['SRC-FACULTY-EC', 'Electronics & Computer Engineering', 'https://mitcorer.edu.in/electronic-computer-engineering-faculty-profile.php'],
  ['SRC-FACULTY-CIVIL', 'Civil Engineering', 'https://mitcorer.edu.in/civil-engineering-faculty-profile.php'],
  ['SRC-FACULTY-MECHANICAL', 'Mechanical & Rail Engineering', 'https://mitcorer.edu.in/mechanical-engineering-faculty-profile.php'],
  ['SRC-FACULTY-FY', 'F.Y. Engineering', 'https://mitcorer.edu.in/fy-engineering-faculty-profile.php'],
];

const captures = [];
for (const [id, department, sourceUrl] of pages) {
  const html = await defaultFetcher(sourceUrl, 15000);
  const pageText = cleanHtml(html);
  const heading = pageText.toLowerCase().lastIndexOf('faculty profile');
  if (heading < 0) throw new Error(`The official page did not contain a faculty profile heading: ${sourceUrl}`);
  const extractedText = pageText.slice(heading).split(/\n(?:MIT CORER\s*,\s*Barshi|MITCORER-Barshi)\b/i)[0].trim();
  if (!/designation\s*:/i.test(extractedText) || !/name\s*:/i.test(extractedText)) throw new Error(`The official faculty list could not be parsed: ${sourceUrl}`);
  captures.push({
    id, title: `MITCORER official faculty profiles — ${department}`, department,
    sourceUrl, sourceAuthority: 'MITCORER official website', documentType: 'Faculty profiles',
    academicYear: 'Not specified', status: 'Published',
    extractionStatus: `Captured from the official faculty profile page on ${new Date().toISOString().slice(0, 10)}.`,
    extractedText,
  });
  process.stdout.write(`Captured ${department}: ${extractedText.length} characters\n`);
}

await fs.writeFile(path.join(root, 'src', 'faculty-profile-captures.json'), `${JSON.stringify(captures, null, 2)}\n`, 'utf8');
process.stdout.write('Wrote src/faculty-profile-captures.json\n');
