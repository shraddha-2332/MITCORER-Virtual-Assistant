import assert from 'node:assert/strict';
import path from 'node:path';
import { beforeEach, test } from 'node:test';
import { createServer, resetRuntimeStateForTests } from '../src/server.js';
import { config } from '../src/config.js';
import { resetDbForTests, getDb } from '../src/store.js';
import { createSeedData } from '../src/seed.js';

async function withServer(fn) {
  const server = createServer();
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();
  try {
    await fn(`http://127.0.0.1:${port}`);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

async function request(base, path, options = {}) {
  const response = await fetch(`${base}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });
  const payload = await response.json();
  return { response, payload };
}

async function login(base, email, password = 'local-fixture-password') {
  const { payload } = await request(base, '/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
  return payload.data.token;
}

function validPdfFixture() {
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 200 200] /Contents 4 0 R >>',
    '<< /Length 0 >>\nstream\n\nendstream',
  ];
  let pdf = '%PDF-1.4\n';
  const offsets = [0];
  for (const [index, object] of objects.entries()) {
    offsets.push(Buffer.byteLength(pdf));
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
  }
  const crossReferenceOffset = Buffer.byteLength(pdf);
  pdf += `xref\n0 ${offsets.length}\n0000000000 65535 f \n`;
  for (const offset of offsets.slice(1)) pdf += `${String(offset).padStart(10, '0')} 00000 n \n`;
  pdf += `trailer\n<< /Size ${offsets.length} /Root 1 0 R >>\nstartxref\n${crossReferenceOffset}\n%%EOF\n`;
  return Buffer.from(pdf);
}

beforeEach(() => {
  config.databaseFile = path.resolve(process.cwd(), 'data', 'mitra.file-api.test.sqlite');
  resetRuntimeStateForTests();
  resetDbForTests(createSeedData());
});
test('retired applicant document routes reject applicants and staff without changing stored records', async () => {
  const record = { id: 'DOC-LEGACY', ownerEmail: 'applicant@example.com', status: 'Submitted for review' };
  getDb().documents.push(record);
  const routes = [
    ['GET', '/api/documents'], ['POST', '/api/documents'],
    ['POST', '/api/documents/upload'], ['POST', '/api/documents/submit'],
    ['GET', '/api/documents/DOC-LEGACY/file'], ['PATCH', '/api/documents/DOC-LEGACY/status'],
    ['DELETE', '/api/documents/DOC-LEGACY'],
  ];
  await withServer(async (base) => {
    for (const email of ['applicant@example.com', 'staff@example.test']) {
      const token = await login(base, email);
      for (const [method, route] of routes) {
        const { response } = await request(base, route, {
          method, headers: { Authorization: `Bearer ${token}` },
          ...(['POST', 'PATCH'].includes(method) ? { body: '{}' } : {}),
        });
        assert.equal(response.status, 404, `${email} ${method} ${route}`);
      }
    }
    assert.deepEqual(getDb().documents.find(item => item.id === record.id), record);
  });
});

test('assistant attachments accept staff uploads and reject applicant uploads', async () => {
  await withServer(async (base) => {
    const applicantToken = await login(base, 'applicant@example.com');
    const staffToken = await login(base, 'staff@example.test');
    const formData = new FormData();
    formData.append('note', 'Please check this notice.');
    formData.append('file', new Blob([validPdfFixture()], { type: 'application/pdf' }), 'notice.pdf');
    const rejected = await fetch(`${base}/api/assistant/attachments/upload`, { method: 'POST', headers: { Authorization: `Bearer ${applicantToken}` }, body: formData });
    assert.equal(rejected.status, 403);
    const uploaded = await fetch(`${base}/api/assistant/attachments/upload`, { method: 'POST', headers: { Authorization: `Bearer ${staffToken}` }, body: formData });
    assert.equal(uploaded.status, 200);
    const attachment = (await uploaded.json()).data;
    const listed = await request(base, '/api/assistant/attachments', { headers: { Authorization: `Bearer ${staffToken}` } });
    assert.ok(listed.payload.data.items.some((item) => item.id === attachment.id));
    const content = await fetch(`${base}/api/assistant/attachments/${attachment.id}/file`, { headers: { Authorization: `Bearer ${staffToken}` } });
    assert.equal(content.status, 200);
    assert.deepEqual(Buffer.from(await content.arrayBuffer()), validPdfFixture());
  });
});

test('rejects a file whose declared MIME type does not match its contents', async () => {
  await withServer(async (base) => {
    const token = await login(base, 'staff@example.test');
    const formData = new FormData();
    formData.append('file', new Blob(['not a PDF'], { type: 'application/pdf' }), '10th-marksheet.pdf');
    const response = await fetch(`${base}/api/assistant/attachments/upload`, { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: formData });
    const payload = await response.json();
    assert.equal(response.status, 400);
    assert.match(payload.error.message, /valid PDF/i);
    const truncated = new FormData();
    truncated.append('file', new Blob(['%PDF-1.4\ntruncated'], { type: 'application/pdf' }), 'truncated.pdf');
    const truncatedResponse = await fetch(`${base}/api/assistant/attachments/upload`, { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: truncated });
    assert.equal(truncatedResponse.status, 400);
  });
});
