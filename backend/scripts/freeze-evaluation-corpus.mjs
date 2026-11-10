import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { gzipSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const backendRoot = path.resolve(here, '..');
const repoRoot = path.resolve(backendRoot, '..');
const dbPath = path.join(backendRoot, 'data/mitra.sqlite');
const indexPath = path.join(backendRoot, 'data/website-corpus/document-index.sqlite');
const outputPath = path.join(backendRoot, 'evaluation/corpora/reviewed-public-corpus.json.gz');
const manifestPath = path.join(backendRoot, 'evaluation/corpora/reviewed-public-corpus.manifest.json');

const sha256 = (value) => crypto.createHash('sha256').update(value).digest('hex');
const readOnly = (file) => new DatabaseSync(file, { readOnly: true });
async function sha256File(file) {
  const hash = crypto.createHash('sha256');
  for await (const chunk of createReadStream(file)) hash.update(chunk);
  return hash.digest('hex');
}
const publicKnowledgeFields = ['id', 'title', 'category', 'text', 'source', 'sourceUrl', 'status', 'tags', 'facts', 'provenance', 'updatedAt'];
const publicSourceFields = ['id', 'title', 'sourceUrl', 'status', 'extractedText', 'academicYear', 'documentType', 'sourceAuthority', 'extractionStatus', 'linkedKnowledgeCount', 'syncMeta'];
const publicContentFields = ['id', 'title', 'category', 'status', 'updatedAt'];

function selectFields(records, fields) {
  if (!Array.isArray(records)) throw new Error('Expected a collection array');
  return records.filter(record => record?.status === 'Published').map(record => Object.fromEntries(
    fields.filter(field => Object.hasOwn(record, field)).map(field => [field, record[field]]),
  ));
}

function loadAppCollection() {
  const db = readOnly(dbPath);
  try {
    const row = db.prepare("SELECT data FROM collections WHERE name = 'app'").get();
    if (!row) throw new Error('Application data collection is missing');
    return JSON.parse(row.data);
  } finally {
    db.close();
  }
}

function loadPublicDocumentMetadata() {
  const db = readOnly(indexPath);
  try {
    const docs = db.prepare(`
      SELECT document_id AS id, title, source_url AS sourceUrl, referring_page AS referringPage,
             checksum, captured_at AS capturedAt, status, chunk_count AS chunkCount
      FROM documents WHERE status = 'Published' ORDER BY document_id
    `).all();
    const chunks = db.prepare(`
      SELECT c.chunk_id AS id, c.document_id AS documentId, c.ordinal,
             c.page_start AS pageStart, c.page_end AS pageEnd, c.content
      FROM chunks c JOIN documents d USING(document_id)
      WHERE d.status = 'Published' ORDER BY c.document_id, c.ordinal
    `).all();
    const chunkTextBytes = chunks.reduce((sum, chunk) => sum + Buffer.byteLength(chunk.content, 'utf8'), 0);
    return { documents: docs, chunks, chunkCount: chunks.length, chunkTextBytes };
  } finally {
    db.close();
  }
}

await fs.access(dbPath);
await fs.access(indexPath);
const app = loadAppCollection();
const publishedKnowledge = selectFields(app.knowledge || [], publicKnowledgeFields);
const publishedSources = selectFields(app.officialSources || [], publicSourceFields);
const publishedContent = selectFields(app.content || [], publicContentFields);
const documentIndex = loadPublicDocumentMetadata();
const snapshot = {
  schemaVersion: 1,
  corpusPolicy: 'Published public institutional information only. Operational user, inquiry, uploaded-document, conversation, feedback, audit, token and workspace collections are excluded.',
  createdAt: new Date().toISOString(),
  knowledge: publishedKnowledge,
  officialSources: publishedSources,
  institutionalContent: publishedContent,
  websiteDocumentIndex: documentIndex,
};
const snapshotBytes = gzipSync(Buffer.from(`${JSON.stringify(snapshot)}\n`, 'utf8'), { level: 9, mtime: 0 });
const manifest = {
  schemaVersion: 1,
  createdAt: snapshot.createdAt,
  output: path.relative(repoRoot, outputPath).replaceAll(path.sep, '/'),
  outputSha256: sha256(snapshotBytes),
  sourceHashes: {
    applicationDatabase: await sha256File(dbPath),
    websiteDocumentIndex: await sha256File(indexPath),
  },
  includedCounts: {
    publishedKnowledge: publishedKnowledge.length,
    publishedOfficialSources: publishedSources.length,
    publishedInstitutionalContent: publishedContent.length,
    publishedWebsiteDocuments: documentIndex.documents.length,
    websiteChunks: documentIndex.chunkCount,
    websiteChunkTextBytes: documentIndex.chunkTextBytes,
  },
  excludedStatuses: {
    knowledge: (app.knowledge || []).length - publishedKnowledge.length,
    officialSources: (app.officialSources || []).length - publishedSources.length,
    institutionalContent: (app.content || []).length - publishedContent.length,
  },
  excludedCollections: ['users', 'inquiries', 'documents', 'auditLogs', 'refreshTokens', 'assistantAttachments', 'admissionWorkspaces', 'conversations', 'feedback'],
  note: 'The application database hash covers the full local database file but no operational records are copied into this snapshot. The compressed snapshot includes only allowlisted fields from Published knowledge, officialSources, and content plus metadata and text chunks from Published public website documents. Review extracted text before sharing any case evidence with a model provider.',
};

await fs.mkdir(path.dirname(outputPath), { recursive: true });
await fs.writeFile(outputPath, snapshotBytes, { flag: 'wx' });
try {
  await fs.writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, { flag: 'wx' });
} catch (error) {
  await fs.rm(outputPath, { force: true });
  throw error;
}
console.log(JSON.stringify({ outputPath, manifestPath, ...manifest.includedCounts, ...manifest.excludedStatuses,
  compressedBytes: snapshotBytes.byteLength, outputSha256: manifest.outputSha256,
  websiteDocumentIndexSha256: manifest.sourceHashes.websiteDocumentIndex }, null, 2));
