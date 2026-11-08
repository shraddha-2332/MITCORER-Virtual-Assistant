import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const crawlPath = path.resolve(scriptDir, '../../docs/new-website-audit/crawl.json');
const baseUrl = (process.env.MITRA_API_URL || 'http://127.0.0.1:4000').replace(/\/$/, '');
const email = process.env.MITRA_ADMIN_EMAIL;
const password = process.env.MITRA_ADMIN_PASSWORD;
if (!email || !password) throw new Error('Set MITRA_ADMIN_EMAIL and MITRA_ADMIN_PASSWORD.');

async function request(path, options = {}) {
  const response = await fetch(`${baseUrl}${path}`, options);
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`${options.method || 'GET'} ${path} failed (${response.status}): ${payload?.error?.message || response.statusText}`);
  return payload.data ?? payload;
}

const auth = await request('/api/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email, password }),
});
const token = auth.data?.token || auth.token;
if (!token) throw new Error('Admin login did not return a token.');
const headers = { Authorization: `Bearer ${token}` };
const { items = [] } = await request('/api/knowledge', { headers });
const crawl = JSON.parse((await fs.readFile(crawlPath, 'utf8')).replace(/^\uFEFF/, ''));
const canonical = (value) => { const url = new URL(value); url.hash = ''; url.search = ''; url.hostname = url.hostname.toLowerCase().replace(/^www\./, ''); if (url.pathname !== '/') url.pathname = url.pathname.replace(/\/+$/, ''); return url.toString(); };
const pageYears = new Map();
for (const page of crawl.pages) {
  const matches = [...new Set([...String(page.text || '').replace(/`n/g, '\n').matchAll(/\b(20\d{2})[-–](\d{2}|20\d{2})\b/g)].map((match) => {
    const start = Number(match[1]);
    const end = Number(match[2].length === 2 ? `${match[1].slice(0, 2)}${match[2]}` : match[2]);
    return end === start + 1 ? `${start}-${String(end).slice(-2)}` : null;
  }).filter(Boolean))];
  pageYears.set(canonical(page.url), matches.length === 1 ? matches[0] : null);
}
const imported = items.filter((record) => record.source === 'MITCORER official new website (crawl 2026-11-05)')
  .filter((record) => !record.provenance?.capturedAt || (!record.provenance?.academicYear && pageYears.get(canonical(record.sourceUrl || ''))));

for (const record of imported) {
  await request(`/api/knowledge/${encodeURIComponent(record.id)}`, {
    method: 'PATCH',
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      expectedRevision: record.revision ?? 0,
      provenance: {
        ...(record.provenance || {}),
        capturedAt: record.provenance?.capturedAt || '2026-11-05',
        ...(!record.provenance?.academicYear && pageYears.get(canonical(record.sourceUrl || '')) ? { academicYear: pageYears.get(canonical(record.sourceUrl)) } : {}),
      },
      verifySource: true,
    }),
  });
}
console.log(`Backfilled crawl date and unambiguous academic year on ${imported.length} website knowledge records.`);
