import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { beforeEach, test } from 'node:test';
import { semanticResponseCache } from '../src/semantic-cache.js';
import { createServer, resetRuntimeStateForTests } from '../src/server.js';
import { config } from '../src/config.js';
import { resetDbForTests, closeDb, getDb, saveDb } from '../src/store.js';
import { createSeedData } from '../src/seed.js';
import { DatabaseSync } from 'node:sqlite';
import { searchDocumentCorpus } from '../src/document-corpus.js';

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

async function login(base, email, password = 'mitra') {
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
test('applicant can upload a real document file record', async () => {
  await withServer(async (base) => {
    const token = await login(base, 'applicant@example.com');
    const formData = new FormData();
    formData.append('ownerName', 'Applicant');
    formData.append('ownerEmail', 'applicant@example.com');
    formData.append('ownerRole', 'Applicant');
    formData.append('docName', '10th marksheet');
    formData.append('file', new Blob([validPdfFixture()], { type: 'application/pdf' }), '10th-marksheet.pdf');
    const response = await fetch(`${base}/api/documents/upload`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: formData,
    });
    const payload = await response.json();
    assert.equal(response.status, 200);
    assert.equal(payload.data.docName, '10th marksheet');
    assert.equal(payload.data.mimeType, 'application/pdf');
    assert.equal(payload.data.status, 'Uploaded (not submitted)');
    assert.ok(payload.data.storedFileName.endsWith('10th-marksheet.pdf'));
    const opened = await fetch(`${base}/api/documents/${payload.data.id}/file`, { headers: { Authorization: `Bearer ${token}` } });
    assert.equal(opened.status, 200);
    assert.deepEqual(Buffer.from(await opened.arrayBuffer()), validPdfFixture());
    const storedPath = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'uploads', payload.data.storedFileName);
    fs.writeFileSync(storedPath, '%PDF-1.4\ntruncated');
    const invalid = await fetch(`${base}/api/documents/${payload.data.id}/file`, { headers: { Authorization: `Bearer ${token}` } });
    assert.equal(invalid.status, 400);
    assert.match((await invalid.json()).error.message, /stored PDF is incomplete or invalid/i);
    fs.unlinkSync(storedPath);
  });
});

test('document submission hands drafts to staff and returns review feedback to applicant', async () => {
  await withServer(async (base) => {
    const applicantToken = await login(base, 'applicant@example.com');
    const staffToken = await login(base, 'staff@mitcorer.edu.in');
    const parentToken = await login(base, 'parent@example.com');
    const formData = new FormData();
    formData.append('ownerName', 'Applicant');
    formData.append('ownerEmail', 'applicant@example.com');
    formData.append('docName', '12th marksheet');
    formData.append('file', new Blob([validPdfFixture()], { type: 'application/pdf' }), '12th-marksheet.pdf');
    const uploaded = await fetch(`${base}/api/documents/upload`, { method: 'POST', headers: { Authorization: `Bearer ${applicantToken}` }, body: formData });
    const record = (await uploaded.json()).data;
    const staffDrafts = await request(base, '/api/documents', { headers: { Authorization: `Bearer ${staffToken}` } });
    assert.equal(staffDrafts.payload.data.items.some((item) => item.id === record.id), false);
    const hiddenDraft = await fetch(`${base}/api/documents/${record.id}/file`, { headers: { Authorization: `Bearer ${staffToken}` } });
    assert.equal(hiddenDraft.status, 403);
    const submitted = await request(base, '/api/documents/submit', { method: 'POST', headers: { Authorization: `Bearer ${applicantToken}` }, body: '{}' });
    assert.equal(submitted.response.status, 200);
    assert.ok(submitted.payload.data.items.some((item) => item.id === record.id && item.status === 'Submitted for review'));
    const staffQueue = await request(base, '/api/documents', { headers: { Authorization: `Bearer ${staffToken}` } });
    assert.ok(staffQueue.payload.data.items.some((item) => item.id === record.id));
    const staffFile = await fetch(`${base}/api/documents/${record.id}/file`, { headers: { Authorization: `Bearer ${staffToken}` } });
    assert.equal(staffFile.status, 200);
    assert.deepEqual(Buffer.from(await staffFile.arrayBuffer()), validPdfFixture());
    const parentFile = await fetch(`${base}/api/documents/${record.id}/file`, { headers: { Authorization: `Bearer ${parentToken}` } });
    assert.equal(parentFile.status, 403);
    const correction = await request(base, `/api/documents/${record.id}/status`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${staffToken}` },
      body: JSON.stringify({ status: 'Needs correction', reviewNote: 'Upload a readable full-page scan.' }),
    });
    assert.equal(correction.response.status, 200);
    const applicantDocuments = await request(base, '/api/documents', { headers: { Authorization: `Bearer ${applicantToken}` } });
    const correctedRecord = applicantDocuments.payload.data.items.find((item) => item.id === record.id);
    assert.equal(correctedRecord.status, 'Needs correction');
    assert.equal(correctedRecord.reviewNote, 'Upload a readable full-page scan.');
  });
});

test('assistant attachments are visible to staff without claiming document-checklist status', async () => {
  await withServer(async (base) => {
    const applicantToken = await login(base, 'applicant@example.com');
    const staffToken = await login(base, 'staff@mitcorer.edu.in');
    const formData = new FormData();
    formData.append('note', 'Please check this notice.');
    formData.append('file', new Blob([validPdfFixture()], { type: 'application/pdf' }), 'notice.pdf');
    const uploaded = await fetch(`${base}/api/assistant/attachments/upload`, { method: 'POST', headers: { Authorization: `Bearer ${applicantToken}` }, body: formData });
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
    const token = await login(base, 'applicant@example.com');
    const formData = new FormData();
    formData.append('docName', '10th marksheet');
    formData.append('file', new Blob(['not a PDF'], { type: 'application/pdf' }), '10th-marksheet.pdf');
    const response = await fetch(`${base}/api/documents/upload`, { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: formData });
    const payload = await response.json();
    assert.equal(response.status, 400);
    assert.match(payload.error.message, /valid PDF/i);
    const truncated = new FormData();
    truncated.append('docName', '10th marksheet');
    truncated.append('file', new Blob(['%PDF-1.4\ntruncated'], { type: 'application/pdf' }), 'truncated.pdf');
    const truncatedResponse = await fetch(`${base}/api/documents/upload`, { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: truncated });
    assert.equal(truncatedResponse.status, 400);
  });
});
