import test from 'node:test';
import assert from 'node:assert/strict';
import { cleanHtml, hashContent, syncMonitoredWebsiteSources, analyzeContentDrift } from '../src/website-sync.js';
import { createServer } from '../src/server.js';
import { config } from '../src/config.js';
import { resetDbForTests } from '../src/store.js';

async function withServer(fn, serverOptions) {
  resetDbForTests();
  const server = createServer(serverOptions);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  const base = `http://127.0.0.1:${address.port}`;
  try {
    await fn(base);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

async function request(base, path, options = {}) {
  const response = await fetch(`${base}${path}`, options);
  const payload = await response.json().catch(() => ({}));
  return { response, payload };
}

test('cleanHtml strips scripts, styles, navigation, footer and decodes entities', () => {
  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <title>Test Page</title>
        <script>console.log("ignore");</script>
        <style>body { color: red; }</style>
      </head>
      <body>
        <nav><a href="/">Home</a></nav>
        <header><h1>Header to ignore</h1></header>
        <main>
          <h1>MITCORER Admissions &amp; Intake</h1>
          <p>Sanctioned intake for Computer Science &amp; Engineering is 120&nbsp;seats.</p>
          <br/>
          <p>Contact: office@mitcorer.edu.in</p>
        </main>
        <footer><p>&copy; 2026 MITCORER</p></footer>
      </body>
    </html>
  `;
  const cleaned = cleanHtml(html);
  assert.match(cleaned, /MITCORER Admissions & Intake/);
  assert.match(cleaned, /Sanctioned intake for Computer Science & Engineering is 120 seats\./);
  assert.match(cleaned, /Contact: office@mitcorer\.edu\.in/);
  assert.doesNotMatch(cleaned, /console\.log/);
  assert.doesNotMatch(cleaned, /color: red/);
  assert.doesNotMatch(cleaned, /<[^>]+>/);
});

test('syncMonitoredWebsiteSources stages changed pages in Review status without auto-publishing', async () => {
  const fakeDb = { officialSources: [] };
  const mockPages = {
    'https://mitcorer.edu.in/fy-btech.php': '<html><body><h1>FY B.Tech Admissions</h1><p>Approved intake for CSE is 120 seats for AY 2026-27.</p></body></html>',
    'https://mitcorer.edu.in/dse.php': '<html><body><h1>Direct Second Year Admissions</h1><p>DSE vacancy and reporting guidelines for AY 2026-27.</p></body></html>',
  };

  const mockFetcher = async (url) => {
    if (mockPages[url]) return mockPages[url];
    throw new Error(`404 Not Found: ${url}`);
  };

  const sources = [
    { title: 'FY B.Tech', url: 'https://mitcorer.edu.in/fy-btech.php', documentType: 'Programs', academicYear: '2026-27', sourceAuthority: 'Admissions' },
    { title: 'DSE', url: 'https://mitcorer.edu.in/dse.php', documentType: 'DSE', academicYear: '2026-27', sourceAuthority: 'Admissions' },
  ];

  // First sync: both pages should be staged as 'Review'
  const firstSync = await syncMonitoredWebsiteSources({
    db: fakeDb,
    sources,
    fetcher: mockFetcher,
    save: false,
  });

  assert.equal(firstSync.checked, 2);
  assert.equal(firstSync.changed, 2);
  assert.equal(firstSync.unchanged, 0);
  assert.equal(fakeDb.officialSources.length, 2);
  assert.equal(fakeDb.officialSources[0].status, 'Review');
  assert.equal(fakeDb.officialSources[1].status, 'Review');
  assert.match(fakeDb.officialSources[0].extractionStatus, /Automated website sync/);

  // Second sync: content is unchanged, should not duplicate
  const secondSync = await syncMonitoredWebsiteSources({
    db: fakeDb,
    sources,
    fetcher: mockFetcher,
    save: false,
  });

  assert.equal(secondSync.checked, 2);
  assert.equal(secondSync.changed, 0);
  assert.equal(secondSync.unchanged, 2);
  assert.equal(fakeDb.officialSources.length, 2);

  // Third sync: one page updates content
  mockPages['https://mitcorer.edu.in/fy-btech.php'] = '<html><body><h1>FY B.Tech Admissions</h1><p>Updated intake for CSE is 120 seats with new CAP dates.</p></body></html>';
  const thirdSync = await syncMonitoredWebsiteSources({
    db: fakeDb,
    sources,
    fetcher: mockFetcher,
    save: false,
  });

  assert.equal(thirdSync.checked, 2);
  assert.equal(thirdSync.changed, 1);
  assert.equal(thirdSync.unchanged, 1);
  const updatedSource = fakeDb.officialSources.find((s) => s.sourceUrl === 'https://mitcorer.edu.in/fy-btech.php');
  assert.match(updatedSource.extractedText, /with new CAP dates/);
  assert.equal(updatedSource.status, 'Review');
});

test('POST /api/official-sources/sync enforces admin authorization and executes website sync', async () => {
  const rootUrl = 'https://mitcorer.edu.in/mitcorer/public/index.php';
  const linkedPaths = [
    '/mitcorer/public/admissions/programmes',
    '/mitcorer/public/department/cse',
    '/mitcorer/public/department/civil',
    '/mitcorer/public/infrastructure/library',
    '/mitcorer/public/contact-us',
  ];
  const mockFetcher = async (url) => {
    if (url === rootUrl) {
      return `<html><body>${linkedPaths.map((path) => `<a href="${path}">Official section</a>`).join(' ')}</body></html>`;
    }
    return '<html><body><h1>Official MITCORER page</h1><p>Verified website content for deterministic CI synchronization checks.</p></body></html>';
  };

  await withServer(async (base) => {
    // 1. Unauthenticated request should fail
    const unauth = await request(base, '/api/official-sources/sync', { method: 'POST' });
    assert.equal(unauth.response.status, 401);

    // 2. Applicant request should be forbidden
    const applicantLogin = await request(base, '/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'applicant@example.com', password: 'mitra' }),
    });
    const applicantToken = applicantLogin.payload.data.token;
    const forbidden = await request(base, '/api/official-sources/sync', {
      method: 'POST',
      headers: { Authorization: `Bearer ${applicantToken}` },
    });
    assert.equal(forbidden.response.status, 403);

    // 3. Admin request succeeds
    const adminLogin = await request(base, '/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'admin@mitcorer.edu.in', password: 'mitra' }),
    });
    const adminToken = adminLogin.payload.data.token;
    const adminSync = await request(base, '/api/official-sources/sync', {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert.equal(adminSync.response.status, 200);
    assert.ok(adminSync.payload.data.checked >= 6);
    assert.ok(typeof adminSync.payload.data.unchanged === 'number');
    assert.ok(typeof adminSync.payload.data.changed === 'number');
  }, { officialSourceSyncOptions: { fetcher: mockFetcher } });
});

test('analyzeContentDrift detects metric changes, academic year updates, and character deltas', () => {
  const prevText = 'First Year B.Tech Intake for AY 2025-26: Computer Engineering is 60 seats, Mechanical is 60 seats.';
  const newText = 'First Year B.Tech Intake for AY 2026-27: Computer Engineering is 120 seats, Mechanical is 60 seats, AI & DS is 60 seats.';

  const drift = analyzeContentDrift(prevText, newText);
  assert.equal(drift.type, 'drift_detected');
  assert.ok(drift.lengthDelta > 0);
  assert.match(drift.summary, /Content drift detected/);

  const numMetric = drift.metricChanges.find((m) => m.metric === 'numeric_values');
  assert.ok(numMetric);
  assert.ok(numMetric.added.includes('120') || numMetric.added.includes('2026'));

  const yearMetric = drift.metricChanges.find((m) => m.metric === 'academic_years');
  assert.ok(yearMetric);
  assert.deepEqual(yearMetric.previous, ['2025-26']);
  assert.deepEqual(yearMetric.current, ['2026-27']);
});

