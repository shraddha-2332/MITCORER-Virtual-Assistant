import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const backendDir = path.resolve(scriptDir, '..');
const crawlPath = path.resolve(backendDir, '../docs/new-website-audit/crawl.json');
const baseUrl = (process.env.MITRA_API_URL || 'http://127.0.0.1:4000').replace(/\/$/, '');
const email = process.env.MITRA_ADMIN_EMAIL;
const password = process.env.MITRA_ADMIN_PASSWORD;
const dryRun = process.argv.includes('--dry-run');

if (!email || !password) throw new Error('Set MITRA_ADMIN_EMAIL and MITRA_ADMIN_PASSWORD for the local admin account.');

function canonicalUrl(value) {
  const url = new URL(value);
  url.hash = '';
  url.search = '';
  url.hostname = url.hostname.toLowerCase().replace(/^www\./, '');
  if (url.pathname !== '/') url.pathname = url.pathname.replace(/\/+$/, '');
  return url.toString();
}

function normalizeText(value) {
  return String(value || '').normalize('NFKC').replace(/\u0000/g, '').replace(/\s+/g, ' ').trim().toLowerCase();
}

function yearForPage(text) {
  const years = new Set();
  for (const match of String(text || '').matchAll(/\b(20\d{2})[-–](\d{2}|20\d{2})\b/g)) {
    const start = Number(match[1]);
    const end = Number(match[2].length === 2 ? `${match[1].slice(0, 2)}${match[2]}` : match[2]);
    if (end === start + 1) years.add(`${start}-${String(end).slice(-2)}`);
  }
  return years.size === 1 ? [...years][0] : null;
}

function sectionFor(url) {
  const parts = new URL(url).pathname.split('/').filter(Boolean);
  const publicIndex = parts.indexOf('public');
  const section = parts[publicIndex + 1] || 'home';
  if (section === 'index.php') return 'Home';
  if (section === 'placement' || section === 'placements') return 'Placements';
  if (section === 'campus-life') return 'Campus Life';
  if (section === 'contact-us') return 'Contact';
  if (section === 'department') return 'Departments';
  if (section === 'infrastructure') return 'Infrastructure';
  if (section === 'admissions') return 'Admissions';
  if (section === 'about') return 'About';
  if (section === 'careers') return 'Careers';
  if (section === 'blog') return 'News & Blog';
  return 'MITCORER Website';
}

function readableTitle(page) {
  if (page.title && page.title !== 'MITVPU') return page.title.replace(/\s+/g, ' ').trim().slice(0, 180);
  const parts = new URL(page.url).pathname.split('/').filter(Boolean);
  let leaf = parts.at(-1) || 'Home';
  if (/\.php$/i.test(leaf)) leaf = leaf.replace(/\.php$/i, '');
  return leaf.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/[-_]+/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase()).slice(0, 160);
}

function cleanedLines(raw, repeatedLines) {
  return String(raw || '')
    .replace(/`n/g, '\n')
    .replace(/\r/g, '\n')
    .split('\n')
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .filter((line) => {
      if (!line || line === '-->' || repeatedLines.has(normalizeText(line))) return false;
      if (/student inquiry portal|please provide your details to access the full website|select your interest|verify & enter site/i.test(line)) return false;
      // These counters are zero in the static snapshot; do not teach those placeholder values.
      if (/^0\s*(?:b\.?tech programs|sanctioned seats|%|dte code)\b/i.test(line)) return false;
      return true;
    });
}

function splitText(lines, size = 2600) {
  const chunks = [];
  let current = '';
  for (const line of lines) {
    const pieces = line.length <= size ? [line] : line.match(new RegExp(`.{1,${size}}(?:\\s|$)|.{1,${size}}`, 'g')) || [line];
    for (const piece of pieces) {
      const next = current ? `${current}\n${piece.trim()}` : piece.trim();
      if (current && next.length > size) {
        chunks.push(current);
        current = piece.trim();
      } else current = next;
    }
  }
  if (current) chunks.push(current);
  return chunks.filter((chunk) => chunk.length >= 40);
}

async function request(route, options = {}) {
  const response = await fetch(`${baseUrl}${route}`, options);
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`${options.method || 'GET'} ${route} failed (${response.status}): ${payload?.error?.message || response.statusText}`);
  return payload.data ?? payload;
}

const rawCrawl = (await fs.readFile(crawlPath, 'utf8')).replace(/^\uFEFF/, '');
const crawl = JSON.parse(rawCrawl);
const pages = crawl.pages.filter((page) => page.status === 200);

// Suppress site chrome repeated on many routes while retaining page-specific repeated facts.
const lineFrequency = new Map();
for (const page of pages) {
  const uniqueLines = new Set(String(page.text || '').replace(/`n/g, '\n').split('\n').map(normalizeText).filter(Boolean));
  for (const line of uniqueLines) lineFrequency.set(line, (lineFrequency.get(line) || 0) + 1);
}
const repeatedLines = new Set([...lineFrequency].filter(([, count]) => count >= Math.max(12, Math.ceil(pages.length * 0.1))).map(([line]) => line));

const canonicalPages = new Map();
for (const page of pages) {
  const url = canonicalUrl(page.url);
  if (canonicalPages.has(url)) continue; // Keep the first canonical page; e.g. / and /index.php aliases.
  canonicalPages.set(url, { ...page, canonicalUrl: url });
}

const uniquePages = [];
const seenPageText = new Set();
for (const page of canonicalPages.values()) {
  const lines = cleanedLines(page.text, repeatedLines);
  const normalized = normalizeText(lines.join('\n'));
  if (normalized.length < 40 || seenPageText.has(normalized)) continue;
  seenPageText.add(normalized);
  uniquePages.push({ ...page, lines });
}

const { token } = await request('/api/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email, password }),
}).then((result) => result.data || result);
if (!token) throw new Error('Admin login did not return a token.');

const headers = { Authorization: `Bearer ${token}` };
const [knowledgePayload, sourcesPayload] = await Promise.all([
  request('/api/knowledge', { headers }),
  request('/api/official-sources', { headers }),
]);
const existingKnowledge = knowledgePayload.items || [];
const existingSources = sourcesPayload.items || [];
const existingUrls = new Set([
  ...existingKnowledge.map((record) => record.sourceUrl).filter(Boolean),
  ...existingSources.map((record) => record.sourceUrl).filter(Boolean),
].map((url) => { try { return canonicalUrl(url); } catch { return ''; } }));
const existingText = new Set(existingKnowledge.map((record) => normalizeText(record.text)).filter(Boolean));

const pending = [];
const skipped = { existingUrl: 0, duplicateText: 0, noText: 0 };
const publicationStatuses = { Published: 0, Review: 0 };
for (const page of uniquePages) {
  if (existingUrls.has(page.canonicalUrl)) {
    skipped.existingUrl += 1;
    continue;
  }
  const chunks = splitText(page.lines);
  if (!chunks.length) {
    skipped.noText += 1;
    continue;
  }
  const docId = `WEB-${crypto.createHash('sha256').update(page.canonicalUrl).digest('hex').slice(0, 16).toUpperCase()}`;
  const category = sectionFor(page.canonicalUrl);
  let part = 0;
  for (const text of chunks) {
    const fingerprint = normalizeText(text);
    if (existingText.has(fingerprint)) {
      skipped.duplicateText += 1;
      continue;
    }
    existingText.add(fingerprint);
    part += 1;
    const title = chunks.length > 1 ? `${readableTitle(page)} (part ${part})` : readableTitle(page);
    const slugTags = new URL(page.canonicalUrl).pathname.split('/').filter(Boolean).slice(-3).map((item) => item.toLowerCase().replace(/[^a-z0-9]+/g, ' ')).filter(Boolean);
    const sensitiveLandingPage = /\/public\/(?:index\.php|about)$/.test(new URL(page.canonicalUrl).pathname);
    const thinPage = normalizeText(page.lines.join('\n')).length < 120;
    const status = sensitiveLandingPage || thinPage ? 'Review' : 'Published';
    publicationStatuses[status] += 1;
    const academicYear = yearForPage(page.lines.join('\n'));
    pending.push({
      title,
      category,
      source: 'MITCORER official new website (crawl 2026-11-05)',
      sourceUrl: page.canonicalUrl,
      text,
      status,
      tags: [...new Set(['mitcorer', 'official website', 'new website', category.toLowerCase(), ...slugTags])].slice(0, 30),
      provenance: { documentId: docId, documentVersion: 'crawl-2026-11-05', capturedAt: '2026-11-05', ...(academicYear ? { academicYear } : {}), section: `${category}: ${new URL(page.canonicalUrl).pathname}`.slice(0, 180) },
      verifySource: true,
    });
  }
  existingUrls.add(page.canonicalUrl);
}

console.log(JSON.stringify({
  mode: dryRun ? 'dry-run' : 'import',
  successfulCrawlPages: pages.length,
  uniqueCanonicalPages: canonicalPages.size,
  pagesAfterExactContentDeduplication: uniquePages.length,
  existingKnowledgeRecords: existingKnowledge.length,
  existingOfficialSources: existingSources.length,
  plannedKnowledgeRecords: pending.length,
  publicationStatuses,
  skipped,
}, null, 2));

if (!dryRun) {
  const imported = [];
  for (let index = 0; index < pending.length; index += 1) {
    const record = await request('/api/knowledge', {
      method: 'POST',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify(pending[index]),
    });
    imported.push(record.id);
    if ((index + 1) % 25 === 0 || index + 1 === pending.length) console.log(`Imported ${index + 1}/${pending.length} knowledge records.`);
  }
  console.log(JSON.stringify({ importedCount: imported.length, importedIds: imported }, null, 2));
}
