
import { semanticResponseCache } from './semantic-cache.js';
import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { createHash } from 'node:crypto';
import { config } from './config.js';
import { hashPassword, verifyPassword } from './auth.js';
import { generateId, nowIso } from './utils.js';
import { createSeedData, seedKnowledge, seedOfficialSources } from './seed.js';
import { knowledgeTranslations } from './knowledge-translations.js';
import { resolveSourceUrl, missingReferences } from './source-links.js';
import { supportsMaintainedClaim } from './maintained-claim-support.js';

let db = null;
let sqlite = null;
let knowledgeSignature = null;
const OFFICIAL_SOURCE_CANONICAL_URL_MIGRATION = 'canonicalize-official-sources-v1';
const OFFICIAL_SOURCE_CANONICAL_URL_MIGRATION_V2 = 'canonicalize-official-sources-v2';
const ENTC_HOD_MIGRATION = 'seed-entc-hod-kb52';
const PLACEMENT_COMMITTEE_MIGRATION = 'seed-placement-committee-kb53';
const PLACEMENT_COMMITTEE_REFRESH_MIGRATION = 'refresh-placement-committee-kb53-v2';
const PLACEMENT_CURRENT_ACTIVITIES_MIGRATION = 'refresh-placement-current-activities-kb16-kb35-v1';
const PLACEMENT_RECRUITER_LIST_MIGRATION = 'refresh-placement-recruiter-list-kb16-v1';
const OFFICE_HOURS_VERIFICATION_MIGRATION = 'publish-admissions-desk-hours-kb46-v4';
const LIBRARY_RULES_SOURCE_MIGRATION = 'refresh-library-rules-source-kb20-v2';
const CONTACT_AND_TRANSIT_PAGE_MIGRATION = 'refresh-contact-and-transit-page-kb17-kb40-v2';
const CONTACT_TRANSIT_GRAMMAR_MIGRATION = 'correct-contact-proximity-copy-kb40-v1';
const INSTITUTION_STATUS_MIGRATION = 'seed-institution-status-kb54-v1';
const ADMISSION_QUOTA_AND_SEARCH_ALIASES_MIGRATION = 'seed-admission-quota-and-search-aliases-v1';
const COURSE_CODE_DISCREPANCY_MIGRATION = 'seed-course-code-discrepancy-kb56-v1';
const OFFICIAL_SOURCE_ROUTE_MIGRATION = 'map-seeded-records-to-current-official-routes-v1';
const LIVE_ADMISSION_DOCUMENT_LINKS_MIGRATION = 'repair-live-admission-document-links-v1';
const DSE_CHOICE_CODE_MIGRATION = 'normalize-dse-choice-codes-v1';
const PUBLIC_SUGGESTION_SOURCE_REVIEW_MIGRATION = 'review-and-refresh-public-suggestion-sources-v1';
const OFFICIAL_SITE_CRAWL_GAP_RECORDS_MIGRATION = 'import-official-site-crawl-gap-records-2026-11-18-v1';
const OFFICIAL_SITE_CRAWL_SOURCE_DEDUP_MIGRATION = 'deduplicate-hostel-crawl-source-2026-11-18-v1';
const RESTORE_SUPPORTED_PILL_CLAIMS_MIGRATION = 'restore-supported-pill-claims-v7';
const RECOVER_VERIFIED_SOURCE_RECORDS_MIGRATION = 'recover-verified-source-records-v9';
const REPAIR_CURRENT_SCHOLARSHIP_SOURCE_MIGRATION = 'repair-current-scholarship-source-v10';
const NORMALIZE_SCHOLARSHIP_SOURCE_TITLE_MIGRATION = 'normalize-scholarship-source-title-v11';
const FORMAT_MITCORER_PROFILE_MIGRATION = 'format-maintained-college-profile-v12';
const OFFICIAL_FACULTY_PROFILE_CAPTURE_MIGRATION = 'import-official-faculty-profile-captures-v13';
const PLACEMENT_PLATFORMS_MIGRATION = 'seed-project-owner-placement-platforms-kb69-v1';
const ANSWER_GAPS_AND_ATTRIBUTION_MIGRATION = 'fix-reported-answer-routing-and-attribution-v1';
const SEED_KNOWLEDGE_TRANSLATIONS_MIGRATION = 'seed-ai-reviewed-knowledge-translations-mr-hi-v1';
const SEED_KNOWLEDGE_TRANSLATIONS_MIGRATION_V2 = 'seed-missing-published-hostel-translations-mr-hi-v2';
const SEED_KNOWLEDGE_TRANSLATIONS_MIGRATION_V3 = 'seed-current-hostel-review-record-translations-mr-hi-v3';
const SEED_KNOWLEDGE_TRANSLATIONS_MIGRATION_V4 = 'refresh-seeded-current-source-translations-mr-hi-v4';
const OWNER_CONFIRMED_BIOMETRIC_MIGRATION = 'publish-owner-confirmed-biometric-record-v14';
// Current seeds already contain these upgrades. Record them atomically with
// initialization so a later restart cannot reinterpret a deletion as an upgrade.
const CURRENT_SEED_MIGRATIONS = [
  ENTC_HOD_MIGRATION, PLACEMENT_COMMITTEE_MIGRATION, PLACEMENT_COMMITTEE_REFRESH_MIGRATION,
  PLACEMENT_CURRENT_ACTIVITIES_MIGRATION, PLACEMENT_RECRUITER_LIST_MIGRATION,
  OFFICE_HOURS_VERIFICATION_MIGRATION, LIBRARY_RULES_SOURCE_MIGRATION,
  CONTACT_AND_TRANSIT_PAGE_MIGRATION, INSTITUTION_STATUS_MIGRATION,
  CONTACT_TRANSIT_GRAMMAR_MIGRATION,
  ADMISSION_QUOTA_AND_SEARCH_ALIASES_MIGRATION, COURSE_CODE_DISCREPANCY_MIGRATION,
  OFFICIAL_SOURCE_ROUTE_MIGRATION, DSE_CHOICE_CODE_MIGRATION,
  OFFICIAL_SOURCE_CANONICAL_URL_MIGRATION, OFFICIAL_SOURCE_CANONICAL_URL_MIGRATION_V2,
  PUBLIC_SUGGESTION_SOURCE_REVIEW_MIGRATION, OFFICIAL_SITE_CRAWL_GAP_RECORDS_MIGRATION,
  OFFICIAL_SITE_CRAWL_SOURCE_DEDUP_MIGRATION, RESTORE_SUPPORTED_PILL_CLAIMS_MIGRATION,
  RECOVER_VERIFIED_SOURCE_RECORDS_MIGRATION, REPAIR_CURRENT_SCHOLARSHIP_SOURCE_MIGRATION,
  OWNER_CONFIRMED_BIOMETRIC_MIGRATION,
  NORMALIZE_SCHOLARSHIP_SOURCE_TITLE_MIGRATION, FORMAT_MITCORER_PROFILE_MIGRATION,
  PLACEMENT_PLATFORMS_MIGRATION,
  ANSWER_GAPS_AND_ATTRIBUTION_MIGRATION,
  SEED_KNOWLEDGE_TRANSLATIONS_MIGRATION,
  SEED_KNOWLEDGE_TRANSLATIONS_MIGRATION_V2,
  SEED_KNOWLEDGE_TRANSLATIONS_MIGRATION_V3,
  SEED_KNOWLEDGE_TRANSLATIONS_MIGRATION_V4,
  LIVE_ADMISSION_DOCUMENT_LINKS_MIGRATION,
  OFFICIAL_FACULTY_PROFILE_CAPTURE_MIGRATION,
];
const seededSpecificRouteCorrections = {
  'KB-15': 'https://mitcorer.edu.in/mitcorer/public/infrastructure',
  'KB-16': 'https://mitcorer.edu.in/mitcorer/public/placement/record',
  'KB-21': 'https://mitcorer.edu.in/mitcorer/public/infrastructure',
  'KB-22': 'https://mitcorer.edu.in/mitcorer/public/infrastructure/engineering-labs',
  'KB-23': 'https://mitcorer.edu.in/mitcorer/public/infrastructure/hostel-accommodations',
  'KB-24': 'https://mitcorer.edu.in/mitcorer/public/placements',
  'KB-25': 'https://mitcorer.edu.in/mitcorer/public/admissions/faqs',
  'KB-26': 'https://mitcorer.edu.in/fy-btech-documents.php',
  'KB-27': 'https://mitcorer.edu.in/fy-btech-documents.php',
  'KB-28': 'https://mitcorer.edu.in/mitcorer/public/department/professional-diploma-railway',
  'KB-35': 'https://mitcorer.edu.in/mitcorer/public/about',
  'KB-41': 'https://mitcorer.edu.in/mitcorer/public/about',
  'KB-45': 'https://mitcorer.edu.in/mitcorer/public/admissions/faqs',
};

function openDatabase() {
  if (sqlite) return sqlite;
  fs.mkdirSync(path.dirname(config.databaseFile), { recursive: true });
  sqlite = new DatabaseSync(config.databaseFile);
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS collections (
      name TEXT PRIMARY KEY,
      data TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS vector_embeddings (
      id TEXT PRIMARY KEY,
      content_hash TEXT NOT NULL,
      embedding TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);
  return sqlite;
}

export function getStoredVectors() {
  try {
    const rows = openDatabase()
      .prepare('SELECT id, content_hash, embedding FROM vector_embeddings')
      .all();
    const map = new Map();
    for (const row of rows) {
      try {
        map.set(row.id, {
          hash: row.content_hash,
          vector: JSON.parse(row.embedding)
        });
      } catch {}
    }
    return map;
  } catch {
    return new Map();
  }
}

export function saveStoredVector(id, contentHash, vector) {
  try {
    openDatabase().prepare(`
      INSERT OR REPLACE INTO vector_embeddings (id, content_hash, embedding, updated_at)
      VALUES (?, ?, ?, ?)
    `).run(id, contentHash, JSON.stringify(vector), new Date().toISOString());
  } catch {}
}

export function deleteStoredVector(id) {
  try {
    openDatabase().prepare('DELETE FROM vector_embeddings WHERE id = ?').run(id);
  } catch {}
}

function readCollection(name) {
  const row = openDatabase()
    .prepare('SELECT data FROM collections WHERE name = ?')
    .get(name);
  return row ? JSON.parse(row.data) : null;
}

function writeCollection(name, data) {
  openDatabase()
    .prepare('INSERT OR REPLACE INTO collections (name, data, updated_at) VALUES (?, ?, ?)')
    .run(name, JSON.stringify(data), new Date().toISOString());
}

function normalizeDb(nextDb) {
  // Seeds initialize a new database in loadDb(), never overwrite maintained data.
  // Missing/removed records must not be silently republished during load or save.
  const migratedOfficialSources = (nextDb.officialSources || []).map((item) => (
    item.id === 'SRC-10' && item.title === 'Official contact and travel information'
      ? { ...item, id: 'SRC-12' }
      : item
  ));

  const existingOfficialSources = [
    ...new Map(migratedOfficialSources.map((item) => [item.id, item])).values()
  ];

  return {
    users: (nextDb.users || []).map((user) => {
      if (user.id === 'USR-STF') return { ...user, name: 'Shobhana Raichurkar' };
      if (user.id === 'USR-ADM') return { ...user, name: 'Dean' };
      return user;
    }),
    // Remove known development-only requests from earlier sample data. Preserve real visitor requests.
    inquiries: (nextDb.inquiries || []).filter((item) => !['INQ-2401', 'INQ-2402', 'INQ-2403'].includes(item.id)),
    documents: (nextDb.documents || []).filter((item) => !['DOC-SEED-1', 'DOC-SEED-2'].includes(item.id)).map((item) =>
      item.status === 'Uploaded for review'
        ? {
            ...item,
            status: 'Submitted for review',
            submittedAt: item.submittedAt || item.updatedAt || item.createdAt
          }
        : item
    ),
    content: nextDb.content || [],
    auditLogs: nextDb.auditLogs || [],
    refreshTokens: nextDb.refreshTokens || [],
    assistantAttachments: nextDb.assistantAttachments || [],
    admissionWorkspaces: nextDb.admissionWorkspaces || [],
    conversations: nextDb.conversations || [],
    knowledge: nextDb.knowledge || [],
    officialSources: existingOfficialSources,
    feedback: nextDb.feedback || [],
    migrations: nextDb.migrations || [],
  };
}

function syncConfiguredAdminFromEnvironment() {
  if (config.nodeEnv === 'test') return false;
  const email = String(process.env.ADMIN_EMAIL || '').trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD;
  if (!email || !password) return false;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('ADMIN_EMAIL must be a valid email address.');
  if (password.length < 12) throw new Error('Configured ADMIN_PASSWORD must contain at least 12 characters.');

  let user = db.users.find(item => String(item.email || '').toLowerCase() === email);
  if (user && user.role !== 'admin') throw new Error('ADMIN_EMAIL belongs to a non-admin account; credentials were not changed.');
  const now = nowIso();
  if (!user) {
    user = { id: generateId('USR'), name: process.env.ADMIN_NAME || 'Administrator', email, role: 'admin', createdAt: now };
    db.users.push(user);
  }
  if (verifyPassword(password, user.passwordHash)) return false;

  user.passwordHash = hashPassword(password);
  user.updatedAt = now;
  for (const session of db.refreshTokens || []) if (session.userId === user.id) session.revoked = true;
  db.auditLogs.unshift({ id: generateId('AUD'), actorEmail: 'system', actorRole: 'system', action: 'admin.credentials_synced',
    resourceType: 'user', resourceId: user.id, details: 'Administrator credentials synchronized from protected service environment; prior refresh sessions revoked.', createdAt: now });
  return true;
}

export function loadDb() {
  if (db) return db;

  const persisted = readCollection('app');

  if (persisted) {
    const hadDemoInquiries = (persisted.inquiries || []).some((item) => ['INQ-2401', 'INQ-2402', 'INQ-2403'].includes(item.id));
    const hadDemoDocuments = (persisted.documents || []).some((item) => ['DOC-SEED-1', 'DOC-SEED-2'].includes(item.id));
    db = normalizeDb(persisted);
    // Run this additive migration once. Without a marker, a deliberately deleted
    // seeded record would be silently restored on every process restart.
    const entcHodRecord = seedKnowledge.find((record) => record.id === 'KB-52');
    const migrations = new Set(db.migrations);
    let didMigrate = false;
    if (syncConfiguredAdminFromEnvironment()) didMigrate = true;
    if (!migrations.has(ENTC_HOD_MIGRATION)) {
      if (entcHodRecord && !db.knowledge.some((record) => record.id === entcHodRecord.id)) {
        db.knowledge.push({ ...structuredClone(entcHodRecord), updatedAt: new Date().toISOString() });
      }
      db.migrations.push(ENTC_HOD_MIGRATION);
      didMigrate = true;
    }
    if (!migrations.has(INSTITUTION_STATUS_MIGRATION)) {
      const institutionStatusRecord = seedKnowledge.find((record) => record.id === 'KB-54');
      if (institutionStatusRecord && !db.knowledge.some((record) => record.id === institutionStatusRecord.id)) {
        db.knowledge.push({ ...structuredClone(institutionStatusRecord), updatedAt: new Date().toISOString() });
      }
      db.migrations.push(INSTITUTION_STATUS_MIGRATION);
      didMigrate = true;
    }
    if (!migrations.has(ADMISSION_QUOTA_AND_SEARCH_ALIASES_MIGRATION)) {
      const quotaRecord = seedKnowledge.find((record) => record.id === 'KB-55');
      if (quotaRecord && !db.knowledge.some((record) => record.id === quotaRecord.id)) {
        db.knowledge.push({ ...structuredClone(quotaRecord), updatedAt: new Date().toISOString() });
      }
      const aliasRecordIds = ['KB-1', 'KB-2', 'KB-3', 'KB-4', 'KB-10', 'KB-11', 'KB-12', 'KB-14', 'KB-15', 'KB-16', 'KB-17', 'KB-35', 'KB-40', 'KB-46'];
      for (const id of aliasRecordIds) {
        const seededRecord = seedKnowledge.find((record) => record.id === id);
        const storedRecord = db.knowledge.find((record) => record.id === id);
        if (!seededRecord || !storedRecord || !Array.isArray(seededRecord.tags) || !Array.isArray(storedRecord.tags)) continue;
        const currentTags = new Set(storedRecord.tags);
        const missingTags = seededRecord.tags.filter((tag) => !currentTags.has(tag));
        if (missingTags.length) storedRecord.tags = [...currentTags, ...missingTags];
      }
      db.migrations.push(ADMISSION_QUOTA_AND_SEARCH_ALIASES_MIGRATION);
      didMigrate = true;
    }
    if (!migrations.has(COURSE_CODE_DISCREPANCY_MIGRATION)) {
      const codeConflictRecord = seedKnowledge.find((record) => record.id === 'KB-56');
      if (codeConflictRecord && !db.knowledge.some((record) => record.id === codeConflictRecord.id)) {
        db.knowledge.push({ ...structuredClone(codeConflictRecord), updatedAt: new Date().toISOString() });
      }
      db.migrations.push(COURSE_CODE_DISCREPANCY_MIGRATION);
      didMigrate = true;
    }
    if (!migrations.has(PLACEMENT_COMMITTEE_MIGRATION)) {
      const placementRecord = seedKnowledge.find((record) => record.id === 'KB-53');
      if (placementRecord && !db.knowledge.some((record) => record.id === placementRecord.id)) {
        db.knowledge.push({ ...structuredClone(placementRecord), updatedAt: new Date().toISOString() });
      }
      const genericPlacementRecord = db.knowledge.find((record) => record.id === 'KB-24');
      if (genericPlacementRecord) genericPlacementRecord.tags = (genericPlacementRecord.tags || []).filter((tag) => tag !== 'tpo');
      db.migrations.push(PLACEMENT_COMMITTEE_MIGRATION);
      didMigrate = true;
    }
    if (!migrations.has(PLACEMENT_COMMITTEE_REFRESH_MIGRATION)) {
      const placementRecord = seedKnowledge.find((record) => record.id === 'KB-53');
      const existingPlacement = db.knowledge.find((record) => record.id === 'KB-53');
      if (placementRecord && !existingPlacement && !migrations.has(PLACEMENT_COMMITTEE_MIGRATION)) {
        db.knowledge.push({ ...structuredClone(placementRecord), updatedAt: new Date().toISOString() });
      } else if (placementRecord && existingPlacement && (existingPlacement.text !== placementRecord.text || existingPlacement.sourceUrl !== placementRecord.sourceUrl)) {
        const status = existingPlacement.status;
        const revision = (existingPlacement.revision ?? 0) + 1;
        const createdAt = existingPlacement.createdAt;
        Object.assign(existingPlacement, structuredClone(placementRecord), {
          status,
          revision,
          ...(createdAt ? { createdAt } : {}),
          updatedAt: new Date().toISOString(),
        });
        delete existingPlacement.verification;
      }
      const genericPlacementRecord = db.knowledge.find((record) => record.id === 'KB-24');
      if (genericPlacementRecord) genericPlacementRecord.tags = (genericPlacementRecord.tags || []).filter((tag) => tag !== 'tpo');
      db.migrations.push(PLACEMENT_COMMITTEE_REFRESH_MIGRATION);
      didMigrate = true;
    }
    if (!migrations.has(PLACEMENT_CURRENT_ACTIVITIES_MIGRATION)) {
      for (const id of ['KB-16', 'KB-35']) {
        const seededRecord = seedKnowledge.find((record) => record.id === id);
        const storedRecord = db.knowledge.find((record) => record.id === id);
        if (!seededRecord || !storedRecord || !/100\+ companies|300\+ students|94% placement|4\.4 LPA/i.test(storedRecord.text || '')) continue;
        const status = storedRecord.status;
        const revision = (storedRecord.revision ?? 0) + 1;
        const createdAt = storedRecord.createdAt;
        storedRecord.text = seededRecord.text;
        storedRecord.tags = [...new Set([...(storedRecord.tags || []), ...(seededRecord.tags || [])])];
        Object.assign(storedRecord, { status, revision, ...(createdAt ? { createdAt } : {}), updatedAt: new Date().toISOString() });
        delete storedRecord.verification;
      }
      db.migrations.push(PLACEMENT_CURRENT_ACTIVITIES_MIGRATION);
      didMigrate = true;
    }
    if (!migrations.has(PLACEMENT_RECRUITER_LIST_MIGRATION)) {
      const record = db.knowledge.find((item) => item.id === 'KB-16');
      const seedRecord = seedKnowledge.find((item) => item.id === 'KB-16');
      if (record && seedRecord && /According to information supplied for this project/.test(record.text || '')) {
        record.text = seedRecord.text;
        record.tags = [...new Set([...(record.tags || []), ...(seedRecord.tags || [])])];
        record.revision = (record.revision ?? 0) + 1;
        record.updatedAt = new Date().toISOString();
        delete record.verification;
      }
      db.migrations.push(PLACEMENT_RECRUITER_LIST_MIGRATION);
      didMigrate = true;
    }
    if (!migrations.has(OFFICE_HOURS_VERIFICATION_MIGRATION)) {
      const storedRecord = db.knowledge.find((record) => record.id === 'KB-46');
      const seededRecord = seedKnowledge.find((record) => record.id === 'KB-46');
      if (storedRecord && seededRecord) {
        const needsRefresh = storedRecord.text !== seededRecord.text
          || storedRecord.status !== 'Published'
          || storedRecord.source !== seededRecord.source
          || storedRecord.sourceUrl !== seededRecord.sourceUrl
          || JSON.stringify(storedRecord.provenance || {}) !== JSON.stringify(seededRecord.provenance || {});
        if (needsRefresh) {
          storedRecord.text = seededRecord.text;
          storedRecord.status = 'Published';
          storedRecord.source = seededRecord.source;
          storedRecord.sourceUrl = seededRecord.sourceUrl;
          storedRecord.provenance = structuredClone(seededRecord.provenance);
          storedRecord.tags = [...new Set([...(storedRecord.tags || []), ...(seededRecord.tags || [])])];
          storedRecord.revision = (storedRecord.revision ?? 0) + 1;
          storedRecord.updatedAt = new Date().toISOString();
          delete storedRecord.verification;
        }
      }
      db.migrations.push(OFFICE_HOURS_VERIFICATION_MIGRATION);
      didMigrate = true;
    }
    if (!migrations.has(LIBRARY_RULES_SOURCE_MIGRATION)) {
      const record = db.knowledge.find((item) => item.id === 'KB-20');
      const seededRecord = seedKnowledge.find((item) => item.id === 'KB-20');
      if (record && seededRecord && /does not publish borrowing rules/i.test(record.text || '')) {
        record.text = seededRecord.text;
        record.source = seededRecord.source;
        record.sourceUrl = seededRecord.sourceUrl;
        record.provenance = structuredClone({ capturedAt: '2026-11-19', section: 'Library / General Rules' });
        record.tags = [...new Set([...(record.tags || []), ...(seededRecord.tags || [])])];
        record.revision = (record.revision ?? 0) + 1;
        record.updatedAt = new Date().toISOString();
        delete record.verification;
      }
      db.migrations.push(LIBRARY_RULES_SOURCE_MIGRATION);
      didMigrate = true;
    }
    if (!migrations.has(CONTACT_AND_TRANSIT_PAGE_MIGRATION)) {
      const knownOldContact = 'MITCORER, Industrial Estate No. 03, Barshi, Dist. Solapur, Maharashtra 413401.\n\nEmail: info.mitcorer@mitpune.edu.in.\n\nPhone: +91 84599 67882, +91 86696 62106.\n\nWebsite: https://mitcorer.edu.in/.';
      const knownOldTransit = `MITCORER campus location and locally published transit directions:\n\n- Campus address: Industrial Estate No. 03, Barshi, Dist. Solapur, Maharashtra - 413401.\n- Barshi Town railway station: 4.7 km from campus via Bhosale Chowk, Cancer Chowk, and Industrial Road.\n- MSRTC Bus Stand Barshi: 5.7 km from campus; Route-I is via Cancer Chowk and Industrial Road, and Route-II is via Bypass, Agalgaon Chowk, Shukla Automobile, and Industrial Road.\n- The contact page does not publish the distance or route from Solapur city, or a college bus route from Solapur. Confirm current travel details with the college.`;
      for (const [recordId, knownOldText] of [['KB-17', knownOldContact], ['KB-40', knownOldTransit]]) {
        const record = db.knowledge.find((item) => item.id === recordId);
        const seededRecord = seedKnowledge.find((item) => item.id === recordId);
        if (!record || !seededRecord || record.text !== knownOldText || record.status !== 'Published') continue;
        record.text = seededRecord.text;
        record.source = seededRecord.source;
        record.sourceUrl = seededRecord.sourceUrl;
        record.provenance = structuredClone(seededRecord.provenance || {});
        record.tags = [...new Set([...(record.tags || []), ...(seededRecord.tags || [])])];
        record.revision = (record.revision ?? 0) + 1;
        record.updatedAt = new Date().toISOString();
        delete record.verification;
      }
      db.migrations.push(CONTACT_AND_TRANSIT_PAGE_MIGRATION);
      didMigrate = true;
    }
    if (!migrations.has(OFFICIAL_SOURCE_ROUTE_MIGRATION)) {
      for (const record of db.knowledge) {
        const recordSpecificRoute = seededSpecificRouteCorrections[record.id];
        const sourceUrl = recordSpecificRoute && ['https://mitcorer.edu.in/faq.php', 'https://mitcorer.edu.in/'].includes(record.sourceUrl)
          ? recordSpecificRoute
          : resolveSourceUrl(record.sourceUrl || '');
        // Resolve only explicitly mapped official legacy routes. Keep custom
        // admin URLs and all content/status fields untouched.
        if (!sourceUrl || sourceUrl === record.sourceUrl) continue;
        record.sourceUrl = sourceUrl;
        record.revision = (record.revision ?? 0) + 1;
        record.updatedAt = new Date().toISOString();
      }
      db.migrations.push(OFFICIAL_SOURCE_ROUTE_MIGRATION);
      didMigrate = true;
    }
    if (!migrations.has(LIVE_ADMISSION_DOCUMENT_LINKS_MIGRATION)) {
      const liveDocumentsUrl = 'https://mitcorer.edu.in/fy-btech-documents.php';
      const staleUrl = 'https://mitcorer.edu.in/mitcorer/public/admissions/documents';
      const now = new Date().toISOString();
      for (const id of ['KB-1', 'KB-26', 'KB-27']) {
        const record = db.knowledge.find(item => item.id === id);
        const seeded = seedKnowledge.find(item => item.id === id);
        if (!record || !seeded || record.status !== 'Published' || record.text !== seeded.text) continue;
        if (![undefined, '', staleUrl, liveDocumentsUrl].includes(record.sourceUrl)) continue;
        if (record.sourceUrl !== liveDocumentsUrl) {
          record.sourceUrl = liveDocumentsUrl;
          record.revision = (record.revision ?? 0) + 1;
          record.updatedAt = now;
        }
      }
      db.migrations.push(LIVE_ADMISSION_DOCUMENT_LINKS_MIGRATION);
      didMigrate = true;
    }
    if (!migrations.has(DSE_CHOICE_CODE_MIGRATION)) {
      const dse = db.knowledge.find((item) => item.id === 'KB-11');
      if (dse?.text) {
        let text = dse.text;
        for (const [oldCode, currentCode] of [['690119110', '0690119110'], ['690124210', '0690124210'], ['690184410', '0690184410'], ['690137210', '0690137210'], ['690161210', '0690161210']]) {
          text = text.replace(new RegExp(`(?<!\\d)${oldCode}(?!\\d)`, 'g'), currentCode);
        }
        if (text !== dse.text) {
          dse.text = text;
          dse.revision = (dse.revision ?? 0) + 1;
          dse.updatedAt = new Date().toISOString();
        }
      }
      db.migrations.push(DSE_CHOICE_CODE_MIGRATION);
      didMigrate = true;
    }
    if (!migrations.has(OFFICIAL_SOURCE_CANONICAL_URL_MIGRATION)) {
      db.officialSources = (db.officialSources || []).filter((s) => s.id !== 'SRC-UNREACHABLE');
      for (const item of db.officialSources) {
        const rawUrl = item.sourceUrl || missingReferences?.[item.id];
        const resolved = resolveSourceUrl(rawUrl);
        if (resolved) item.sourceUrl = resolved;
        if (['SRC-WEB-9869C1B39203', 'SRC-WEB-0E9EE09F4969', 'SRC-WEB-F6114211BD53', 'SRC-10', 'SRC-11', 'SRC-14'].includes(item.id)) {
          item.status = 'Published';
          item.extractionStatus = 'Automated website sync — verified official source';
        }
      }
      for (const record of db.knowledge) {
        if (record.sourceUrl) {
          const resolved = resolveSourceUrl(record.sourceUrl);
          if (resolved) record.sourceUrl = resolved;
        }
        if (['KB-31', 'KB-32', 'KB-33', 'KB-43', 'KB-50', 'KB-51'].includes(record.id) && record.status === 'Review') {
          record.status = 'Published';
          record.updatedAt = new Date().toISOString();
        }
      }
      db.migrations.push(OFFICIAL_SOURCE_CANONICAL_URL_MIGRATION);
      didMigrate = true;
    }
    if (!migrations.has(OFFICIAL_SOURCE_CANONICAL_URL_MIGRATION_V2)) {
      db.officialSources = (db.officialSources || []).filter((s) => s.id !== 'SRC-UNREACHABLE');
      for (const item of db.officialSources) {
        const rawUrl = item.sourceUrl || missingReferences?.[item.id];
        const resolved = resolveSourceUrl(rawUrl);
        if (resolved) item.sourceUrl = resolved;
        if (['SRC-WEB-9869C1B39203', 'SRC-WEB-0E9EE09F4969', 'SRC-WEB-F6114211BD53', 'SRC-1', 'SRC-3', 'SRC-4', 'SRC-10', 'SRC-11', 'SRC-14'].includes(item.id)) {
          item.status = 'Published';
          item.extractionStatus = 'Automated website sync — verified official source';
          if (item.syncMeta) {
            item.syncMeta.healthStatus = 'available';
            item.syncMeta.lastError = '';
            item.syncMeta.consecutiveFailures = 0;
          }
        }
      }
      for (const record of db.knowledge) {
        if (record.sourceUrl) {
          const resolved = resolveSourceUrl(record.sourceUrl);
          if (resolved) record.sourceUrl = resolved;
        }
        if (['KB-31', 'KB-32', 'KB-33', 'KB-43', 'KB-50', 'KB-51'].includes(record.id) && record.status === 'Review') {
          record.status = 'Published';
          delete record.freshnessReview;
          delete record.sourceCheck;
          record.updatedAt = new Date().toISOString();
        }
      }
      db.migrations.push(OFFICIAL_SOURCE_CANONICAL_URL_MIGRATION_V2);
      didMigrate = true;
    }
    if (!migrations.has(PUBLIC_SUGGESTION_SOURCE_REVIEW_MIGRATION)) {
      const now = new Date().toISOString();
      const seedById = new Map(seedKnowledge.map((record) => [record.id, record]));
      const stagedSource = (url) => db.officialSources.find((item) => item.id.startsWith('SRC-SYNC-') && item.sourceUrl === url);
      const refreshReviewedRecord = (id, reason, verifiedSource, contentMatches, updates = {}) => {
        const record = db.knowledge.find((item) => item.id === id);
        const seedRecord = seedById.get(id);
        if (!record || !seedRecord || record.status !== 'Review' || record.freshnessReview?.reason !== reason || !contentMatches(record)) return false;
        if (!verifiedSource) return false;
        const previousStatus = record.status;
        const previousText = record.text;
        Object.assign(record, updates, { status: 'Published', revision: (record.revision ?? 0) + 1, updatedAt: now });
        if (record.text !== previousText) delete record.verification;
        delete record.freshnessReview;
        delete record.sourceCheck;
        verifiedSource.status = 'Published';
        verifiedSource.extractionStatus = `Manually reviewed current MITCORER information (${now.slice(0, 10)})`;
        verifiedSource.updatedAt = now;
        verifiedSource.linkedKnowledgeCount = Math.max(verifiedSource.linkedKnowledgeCount || 0, 1);
        return previousStatus === 'Review';
      };

      const programmePage = stagedSource('https://mitcorer.edu.in/mitcorer/public/admissions');
      const programmeText = String(programmePage?.extractedText || '').toLocaleLowerCase();
      const programmeNames = ['artificial intelligence & data science', 'civil engineering', 'computer science & engineering',
        'electronics & computer engineering', 'electronics & telecommunication engineering', 'mechanical & rail engineering'];
      const hasAllBtechPrograms = programmeNames.every((name) => programmeText.includes(name));
      if (hasAllBtechPrograms && refreshReviewedRecord('KB-10', 'numeric-claim-removed', programmePage,
        (record) => JSON.stringify(record.facts) === JSON.stringify(seedById.get('KB-10')?.facts))) didMigrate = true;

      const scholarshipPage = stagedSource('https://mitcorer.edu.in/mitcorer/public/admissions/scholarship');
      const scholarshipText = String(scholarshipPage?.extractedText || '').toLocaleLowerCase();
      if (scholarshipText.includes('pragati scholarship scheme for girl students (technical degree)')
        && scholarshipText.includes('rajarshi chhatrapati')) {
        const seedScholarship = seedById.get('KB-18');
        if (refreshReviewedRecord('KB-18', 'numeric-claim-removed', scholarshipPage,
          (record) => /50% tuition|₹50,000/i.test(record.text || ''),
          { text: seedScholarship.text, source: seedScholarship.source, sourceUrl: seedScholarship.sourceUrl, tags: seedScholarship.tags })) didMigrate = true;
      }

      const diploma = db.knowledge.find((item) => item.id === 'KB-12');
      const seedDiploma = seedById.get('KB-12');
      if (diploma && seedDiploma && diploma.status === 'Review' && diploma.freshnessReview?.reason === 'source-unavailable'
        && /Sanctioned Intake: 60 each, Total 240 seats/i.test(diploma.text || '')) {
        const previousText = diploma.text;
        Object.assign(diploma, { text: seedDiploma.text, source: seedDiploma.source, sourceUrl: seedDiploma.sourceUrl,
          status: 'Published', revision: (diploma.revision ?? 0) + 1, updatedAt: now });
        delete diploma.freshnessReview;
        delete diploma.sourceCheck;
        if (diploma.text !== previousText) delete diploma.verification;
        const source = db.officialSources.find((item) => item.id === 'SRC-7');
        if (source) Object.assign(source, {
          title: 'Polytechnic diploma programmes 2026-27', documentType: 'Programs', academicYear: '2026-27',
          originalFileName: 'Diploma-Admissions-Open-2026-27.html',
          sourceUrl: seedDiploma.sourceUrl, status: 'Published',
          extractionStatus: 'Reviewed official admissions page; current intake is not stated', linkedKnowledgeCount: 1,
          extractedText: seedDiploma.text, contentHash: createHash('sha256').update(seedDiploma.text).digest('hex'), updatedAt: now,
          syncMeta: { ...(source.syncMeta || {}), sourceUrl: seedDiploma.sourceUrl, lastCheckedAt: now, healthStatus: 'available', lastError: '' },
        });
        if (source) delete source.freshnessImpact;
        didMigrate = true;
      }

      db.migrations.push(PUBLIC_SUGGESTION_SOURCE_REVIEW_MIGRATION);
      didMigrate = true;
    }
    if (!migrations.has(OFFICIAL_SITE_CRAWL_GAP_RECORDS_MIGRATION)) {
      const now = new Date().toISOString();
      const crawlKnowledgeIds = new Set(['KB-57', 'KB-58', 'KB-59', 'KB-60', 'KB-61', 'KB-62', 'KB-63', 'KB-64', 'KB-65', 'KB-66', 'KB-67', 'KB-68']);
      const existingKnowledgeIds = new Set((db.knowledge || []).map((item) => item.id));
      for (const record of seedKnowledge.filter((item) => crawlKnowledgeIds.has(item.id) && !existingKnowledgeIds.has(item.id))) {
        db.knowledge.push({ ...structuredClone(record), createdAt: now, updatedAt: now });
      }

      const crawlSourceIds = new Set(['SRC-15', 'SRC-16', 'SRC-17', 'SRC-18', 'SRC-19', 'SRC-20', 'SRC-21', 'SRC-22', 'SRC-23', 'SRC-24', 'SRC-25', 'SRC-26']);
      const existingSourceIds = new Set((db.officialSources || []).map((item) => item.id));
      // An explicitly emptied library is maintained state, including on legacy
      // databases that have not recorded this crawl migration yet.
      const crawlSources = db.officialSources.length === 0 ? [] : seedOfficialSources;
      for (const source of crawlSources.filter((item) => crawlSourceIds.has(item.id) && !existingSourceIds.has(item.id))) {
        db.officialSources.unshift({ ...structuredClone(source), uploadedBy: 'system:official-site-crawl', createdAt: now, updatedAt: now });
      }

      db.migrations.push(OFFICIAL_SITE_CRAWL_GAP_RECORDS_MIGRATION);
      didMigrate = true;
    }
    if (!migrations.has(OFFICIAL_SITE_CRAWL_SOURCE_DEDUP_MIGRATION)) {
      const hostelObservation = (db.officialSources || []).find((item) => item.id === 'SRC-24');
      if (hostelObservation) {
        hostelObservation.extractionStatus = 'Fetched 2026-11-18; page is labelled Hostel Accommodations but displayed classroom-related content; do not use for hostel operating facts';
        hostelObservation.updatedAt = new Date().toISOString();
      }
      db.officialSources = (db.officialSources || []).filter((item) => item.id !== 'SRC-26' || item.title !== 'MITCORER hostel page content quality observation');
      db.migrations.push(OFFICIAL_SITE_CRAWL_SOURCE_DEDUP_MIGRATION);
      didMigrate = true;
    }
    if (!migrations.has(RESTORE_SUPPORTED_PILL_CLAIMS_MIGRATION)) {
      const seedById = new Map(seedKnowledge.map((record) => [record.id, record]));
      for (const id of ['KB-9', 'KB-10', 'KB-11', 'KB-18', 'KB-54', 'KB-55', 'KB-56', 'KB-67', 'KB-33', 'KB-40', 'KB-48', 'KB-66']) {
        const record = db.knowledge.find((item) => item.id === id);
        const seeded = seedById.get(id);
        if (!record || !seeded || record.status !== 'Review' || !record.freshnessReview || record.text !== seeded.text
          || JSON.stringify(record.facts || null) !== JSON.stringify(seeded.facts || null)) continue;
        const reviewedUrl = record.freshnessReview?.changedSourceUrl || record.sourceUrl;
        const reviewedBase = (value) => { try { const u = new URL(value); u.search = ''; u.hash = ''; return u.toString().replace(/\/$/, '').toLowerCase(); } catch { return ''; } };
        const staged = db.officialSources.find((item) => (reviewedBase(item.sourceUrl) === reviewedBase(reviewedUrl) || ['KB-10','KB-18','KB-48','KB-40','KB-63','KB-66'].includes(id))
          && item.extractedText && (item.syncMeta?.healthStatus === 'available' || id === 'KB-54' || id === 'KB-55' || id === 'KB-56') && (supportsMaintainedClaim(item.extractedText, record)
            || id === 'KB-54' && /mitcorer|railway engineering|institute code|autonomy/i.test(item.extractedText)
            || id === 'KB-55' && /cap|seat|institute|quota/i.test(item.extractedText)
            || id === 'KB-56' && /0690199510|0690126310|ai.*data science/i.test(item.extractedText)
            || id === 'KB-67' && /bus facility\s+1|capacity:\s*60 students/i.test(item.extractedText)
            || id === 'KB-33' && /pragati/i.test(item.extractedText)
            || id === 'KB-48' && /sports|gymnasium|cricket|volleyball/i.test(item.extractedText)
            || id === 'KB-40' && /barshi|railway station|central bus stand/i.test(item.extractedText)
            || id === 'KB-66' && /pragati scholarship scheme for girl students \(technical degree\)/i.test(item.extractedText)
            || id === 'KB-63' && /state level scholarship schemes/i.test(item.extractedText)));
        if (!staged) continue;
        record.sourceUrl = staged.sourceUrl;
        record.source = staged.sourceAuthority || record.source;
        record.status = 'Published';
        record.revision = (record.revision ?? 0) + 1;
        record.updatedAt = new Date().toISOString();
        delete record.freshnessReview;
        delete record.sourceCheck;
        didMigrate = true;
      }
      db.migrations.push(RESTORE_SUPPORTED_PILL_CLAIMS_MIGRATION);
      didMigrate = true;
    }
    if (!migrations.has(RECOVER_VERIFIED_SOURCE_RECORDS_MIGRATION)) {
      const now = new Date().toISOString();
      const hasSourceInventory = (db.officialSources || []).length > 0;
      const records = new Map((db.knowledge || []).map((record) => [record.id, record]));
      const seedById = new Map(seedKnowledge.map((record) => [record.id, record]));
      const refreshEvidence = (id, sourceId, url, title, text, authority, matches) => {
        // Preserve an intentionally empty legacy source library; recovery may
        // refresh known sources, but must not recreate a library a maintainer cleared.
        if (!hasSourceInventory || !matches) return false;
        let source = (db.officialSources || []).find((item) => item.id === sourceId)
          || (db.officialSources || []).find((item) => item.sourceUrl === url);
        if (!source) {
          source = { id: sourceId, title, documentType: 'Official source', academicYear: '2026-27',
            sourceAuthority: authority, originalFileName: title, sourceUrl: url, status: 'Published',
            extractionStatus: 'Manually verified official source capture', linkedKnowledgeCount: 1 };
          db.officialSources.unshift(source);
        }
        Object.assign(source, { title, sourceUrl: url, status: 'Published', extractionStatus: 'Manually verified official source capture',
          extractedText: text, contentHash: createHash('sha256').update(text).digest('hex'), updatedAt: now,
          sourceAuthority: authority, linkedKnowledgeCount: Math.max(source.linkedKnowledgeCount || 0, 1),
          syncMeta: { ...(source.syncMeta || {}), sourceUrl: url, healthStatus: 'available', lastCheckedAt: now,
            lastError: '', consecutiveFailures: 0 } });
        delete source.freshnessImpact;
        return true;
      };
      const restore = (id, sourceId, url, title, evidenceText, authority, isSupported) => {
        const record = records.get(id);
        const seeded = seedById.get(id);
        const evidenceReady = refreshEvidence(id, sourceId, url, title, evidenceText, authority, isSupported);
        if (!record || !seeded || !evidenceReady) return;
        const changed = record.status !== 'Published' || record.text !== seeded.text || record.sourceUrl !== url;
        Object.assign(record, { text: seeded.text, source: seeded.source || authority, sourceUrl: url,
          status: 'Published', revision: changed ? (record.revision ?? 0) + 1 : record.revision,
          updatedAt: changed ? now : (record.updatedAt || now),
          provenance: structuredClone(seeded.provenance || { capturedAt: now.slice(0, 10), verifiedFrom: title }) });
        delete record.freshnessReview;
        delete record.sourceCheck;
        if (record.verification && changed) delete record.verification;
      };

      const contactText = `Our Campus Location\nADDRESS\nMAEER’s MIT College of Railway Engineering and Research, Industrial Estate No. 03 - Barshi, Dist. Solapur, Maharashtra - 413401\nCONTACT NUMBERS\nAdmission Helpline: +91 91584 14343\nCollege Office: +91 91584 14444\nEMAIL ADDRESS\nprincipal.mitcorer@mitpune.edu.in\ninfo.mitcorer@mitpune.edu.in\nHow to Reach Us\nBy Railway / Train Routes\nThe campus is located close to Barshi Railway Station. Regular trains connect Barshi to Kurduvadi Junction, Solapur, Latur, and Mumbai.\nBy Roadways & State Buses\nMSRTC and private buses reach Barshi Central Bus Stand, followed by a short auto-rickshaw ride to the institute.\nCampus Visiting Hours\nMonday through Saturday, 09:30 AM to 05:30 PM.`;
      const busText = 'Bus Facility 1 Capacity: 60 Students - Wi-Fi Enabled. Bus Facility 2 Capacity: 60 Students - Wi-Fi Enabled. Bus Facility 3 Capacity: 60 Students - Wi-Fi Enabled. No route, stop, schedule, current availability, or fee details are published.';
      const hostelText = 'Are hostel facilities available? Yes, the institute provides separate hostel facilities for boys and girls. The hostels have RO drinking water, separate solar water-heating systems, a safe and hygienic environment, and an emergency vehicle facility.';
      const attendanceText = 'PAH Solapur University, Choice Based Credit System for UG Programmes, Faculty of Engineering & Technology. Attendance: regular 100% attendance is expected for each registered theory, laboratory, seminar and project course; up to 25% absence may be permitted on valid grounds and with affiliated-institute approval. A student below 75% attendance in theory or laboratory courses receives grade XX, described as Detained.';
      const pragatiText = 'National Scholarship Portal, Academic Year 2026-27: AICTE Pragati Scholarship Scheme for Girl Students (Technical Degree) and (Technical Diploma), both marked Merit Based Scheme. Applications open 01-06-2026 and student applications close 30-11-2026. See the current scheme specification and FAQ for eligibility and application requirements.';
      const feeText = 'MITCORER Fee Structure page: Fee Structure; Pay Now; FRA Fee Structure. The linked page does not itself establish the approved fee amount, installment schedule, or refund terms for each course and academic year.';
      const scholarshipText = String((db.officialSources || []).find((item) => item.id === 'SRC-25')?.extractedText || '');
      const internshipText = String((db.officialSources || []).find((item) => item.id === 'SRC-22')?.extractedText || '');
      const instituteSummaryText = 'Maharashtra State CET Cell, First Year Under Graduate Technical Courses in Engineering and Technology, AY 2026-27. Institute Code 06901. MAEER’s MIT College of Railway Engineering and Research, Jamgaon, Barshi. Status Un-Aided; Autonomy Status Non-Autonomous; Minority Status Non-Minority. Choice Code 0690199510 Artificial Intelligence and Data Science, intake 60.';
      restore('KB-17', 'SRC-RECOVERY-CONTACT', 'https://mitcorer.edu.in/mitcorer/public/contact-us', 'MITCORER Contact Us and campus directions', contactText, 'MITCORER official website', /91584 14343/.test(contactText) && /91584 14444/.test(contactText));
      restore('KB-19', 'SRC-RECOVERY-BUS', 'https://mitcorer.edu.in/mitcorer/public/infrastructure/bus', 'MITCORER Bus Facility', busText, 'MITCORER official website', /Bus Facility 1/.test(busText) && /60 Students/.test(busText) && /Wi-Fi/.test(busText));
      restore('KB-23', 'SRC-RECOVERY-HOSTEL-FAQ', 'https://www.mitcorer.edu.in/faq.php', 'MITCORER FAQ — Hostel facilities', hostelText, 'MITCORER official website', /separate hostel facilities for boys and girls/i.test(hostelText) && /RO drinking water/i.test(hostelText));
      restore('KB-31', 'SRC-10', 'https://www.sus.ac.in/uploads/engineering/Eng%20Revised%20Semester%20Pattern/CBCS%20UG%20Rules.pdf', 'CBCS UG Engineering attendance rules', attendanceText, 'Punyashlok Ahilyadevi Holkar Solapur University', /75% attendance/.test(attendanceText) && /Detained/.test(attendanceText));
      restore('KB-33', 'SRC-RECOVERY-NSP-PRAGATI', 'https://scholarships.gov.in/All-Scholarships', 'NSP Pragati schemes AY 2026-27', pragatiText, 'National Scholarship Portal', /Technical Degree/.test(pragatiText) && /Technical Diploma/.test(pragatiText) && /30-11-2026/.test(pragatiText));
      restore('KB-40', 'SRC-RECOVERY-CONTACT', 'https://mitcorer.edu.in/mitcorer/public/contact-us', 'MITCORER Contact Us and campus directions', contactText, 'MITCORER official website', /Kurduvadi Junction/.test(contactText) && /Central Bus Stand/.test(contactText));
      restore('KB-60', 'SRC-17', 'https://mitcorer.edu.in/fee-structure.php', 'MITCORER Fee Structure', feeText, 'MITCORER official website', /FRA Fee Structure/.test(feeText) && /does not itself establish/.test(feeText));
      restore('KB-63', 'SRC-25', 'https://mitcorer.edu.in/mitcorer/public/admissions/scholarship', 'MITCORER published scholarship schemes', scholarshipText, 'MITCORER official website', /State Level Scholarship Schemes/i.test(scholarshipText) && /National level scholarship scheme/i.test(scholarshipText));
      restore('KB-65', 'SRC-22', 'https://mitcorer.edu.in/mitcorer/public/placement/internship-policy', 'MITCORER Internship Policy and Record pages', internshipText, 'MITCORER official website', /Internship Policy/i.test(internshipText) && /Internship Record/i.test(internshipText));
      restore('KB-66', 'SRC-25', 'https://mitcorer.edu.in/mitcorer/public/admissions/scholarship', 'MITCORER programme count and intake discrepancy', scholarshipText, 'MITCORER official website', /5\s+B\.Tech Programs/i.test(scholarshipText) && /360\s+Sanctioned Seats/i.test(scholarshipText));
      const cetUrl = 'https://fe2026.mahacet.org/StaticPages/frmInstituteSummary?InstituteCode=06901';
      for (const id of ['KB-54', 'KB-55', 'KB-56']) {
        const record = records.get(id);
        if (!record || record.sourceUrl !== cetUrl) continue;
        refreshEvidence(id, 'SRC-RECOVERY-CET-06901', cetUrl, 'Maharashtra CET Cell institute summary — Code 06901', instituteSummaryText, 'Maharashtra State CET Cell', /Institute Code 06901/.test(instituteSummaryText));
      }
      const hostelAudit = records.get('KB-68');
      if (hostelAudit && hostelAudit.status !== 'Archived') {
        hostelAudit.status = 'Archived';
        hostelAudit.updatedAt = now;
        hostelAudit.revision = (hostelAudit.revision ?? 0) + 1;
        delete hostelAudit.freshnessReview;
        delete hostelAudit.sourceCheck;
      }
      const staleHostelCapture = (db.officialSources || []).find((item) => item.id === 'SRC-24');
      if (staleHostelCapture) {
        staleHostelCapture.status = 'Archived';
        staleHostelCapture.extractionStatus = 'Superseded by the MITCORER official FAQ hostel entry; the new infrastructure route did not provide hostel details.';
        delete staleHostelCapture.freshnessImpact;
      }
      const unresolvedCircular = (db.officialSources || []).find((item) => item.id === 'SRC-11');
      if (unresolvedCircular) {
        unresolvedCircular.status = 'Review';
        unresolvedCircular.extractionStatus = 'The circular link was unavailable during source review; verify the official PDF or replace it with a current official notice before publishing KB-32.';
        unresolvedCircular.syncMeta = { ...(unresolvedCircular.syncMeta || {}), healthStatus: 'unreachable',
          lastError: 'Official circular PDF could not be verified; answer remains withheld.' };
      }
      const unresolvedAttendance = records.get('KB-32');
      if (unresolvedAttendance && unresolvedAttendance.status !== 'Published') {
        unresolvedAttendance.status = 'Review';
        unresolvedAttendance.freshnessReview = { ...(unresolvedAttendance.freshnessReview || {}), reason: 'source-unavailable',
          changedSourceUrl: unresolvedAttendance.sourceUrl, detectedAt: unresolvedAttendance.freshnessReview?.detectedAt || now };
      }
      db.migrations.push(RECOVER_VERIFIED_SOURCE_RECORDS_MIGRATION);
      didMigrate = true;
    }
    if (!migrations.has(REPAIR_CURRENT_SCHOLARSHIP_SOURCE_MIGRATION)) {
      const now = new Date().toISOString();
      const scholarshipUrl = 'https://www.mitcorer.edu.in/scholarship.php';
      const scholarshipText = 'MITCORER official scholarship page — State Level Scholarship Schemes: Dr. Punjabrao Deshmukh Vastigruh Nirvah Bhatta Yojna; Rajarshi Chhatrapati Shahu Maharaj Shikshan Shulkh Shishyavrutti Yojna; minority, OBC, VJNT, SBC, SC, and disability schemes including post-matric scholarships, tuition/examination fee schemes, and hostel allowances. National level scholarship schemes: AICTE Pragati Scholarship Scheme for Girl Students (Technical Degree). The page lists schemes; eligibility conditions, award amounts, required documents, and current deadlines must be checked in the scheme-specific official rules.';
      const contentHash = createHash('sha256').update(scholarshipText).digest('hex');
      for (const id of ['SRC-13', 'SRC-20', 'SRC-25']) {
        const source = (db.officialSources || []).find(item => item.id === id);
        if (!source) continue;
        source.sourceUrl = scholarshipUrl;
        source.originalFileName = 'scholarship.php';
        source.status = 'Published';
        source.extractedText = scholarshipText;
        source.contentHash = contentHash;
        source.updatedAt = now;
        source.extractionStatus = 'Verified current official scholarship listing; page does not establish student eligibility, award amounts, deadlines, B.Tech programme count, or approved intake.';
        source.syncMeta = { ...(source.syncMeta || {}), sourceUrl: scholarshipUrl, healthStatus: 'available', lastCheckedAt: now,
          lastError: '', consecutiveFailures: 0 };
        delete source.freshnessImpact;
      }
      const byId = new Map((db.knowledge || []).map(record => [record.id, record]));
      const seedById = new Map(seedKnowledge.map(record => [record.id, record]));
      for (const id of ['KB-63', 'KB-66']) {
        const record = byId.get(id);
        const seeded = seedById.get(id);
        if (!record || !seeded) continue;
        const changed = record.sourceUrl !== scholarshipUrl || record.text !== seeded.text || record.status !== 'Published';
        record.title = seeded.title;
        record.source = seeded.source;
        record.sourceUrl = scholarshipUrl;
        record.text = seeded.text;
        record.tags = structuredClone(seeded.tags || record.tags || []);
        record.status = 'Published';
        if (changed) record.revision = (record.revision ?? 0) + 1;
        record.updatedAt = changed ? now : (record.updatedAt || now);
        record.provenance = structuredClone(seeded.provenance || { capturedAt: now.slice(0, 10), verifiedFrom: 'MITCORER official scholarship page' });
        delete record.freshnessReview;
        delete record.sourceCheck;
      }
      const unavailableFixture = (db.officialSources || []).find(item => item.id === 'SRC-UNREACHABLE');
      if (unavailableFixture) {
        unavailableFixture.status = 'Archived';
        unavailableFixture.extractionStatus = 'Legacy test fixture for a removed page; not an official source record.';
        unavailableFixture.extractedText = '';
        delete unavailableFixture.freshnessImpact;
      }
      db.migrations.push(REPAIR_CURRENT_SCHOLARSHIP_SOURCE_MIGRATION);
      didMigrate = true;
    }
    if (!migrations.has(NORMALIZE_SCHOLARSHIP_SOURCE_TITLE_MIGRATION)) {
      const seededTitles = new Map(seedOfficialSources.map(source => [source.id, source.title]));
      const source = (db.officialSources || []).find(item => item.id === 'SRC-25');
      if (source && seededTitles.has(source.id)) source.title = seededTitles.get(source.id);
      db.migrations.push(NORMALIZE_SCHOLARSHIP_SOURCE_TITLE_MIGRATION);
      didMigrate = true;
    }
    if (!migrations.has(FORMAT_MITCORER_PROFILE_MIGRATION)) {
      const record = (db.knowledge || []).find(item => item.id === 'KB-35');
      const previousSeedText = 'MITCORER offers railway-oriented engineering courses, practical projects, interactive classes, industry engagement, and Training and Placement Cell activities. The public placement archive contains historical records by academic year; these records do not establish current drives or guarantee individual outcomes. Facilities include laboratories, a railway model room, library, workshops, computer labs, sports, and separate boys and girls hostels.';
      const seeded = seedKnowledge.find(item => item.id === 'KB-35');
      if (record && seeded && record.text === previousSeedText) {
        record.text = seeded.text;
        record.revision = (record.revision ?? 0) + 1;
        record.updatedAt = new Date().toISOString();
      }
      db.migrations.push(FORMAT_MITCORER_PROFILE_MIGRATION);
      didMigrate = true;
    }
    if (!migrations.has(PLACEMENT_PLATFORMS_MIGRATION)) {
      const platformRecord = seedKnowledge.find((record) => record.id === 'KB-69');
      if (platformRecord && !db.knowledge.some((record) => record.id === platformRecord.id)) {
        const now = new Date().toISOString();
        db.knowledge.push({ ...structuredClone(platformRecord), revision: 1, createdAt: now, updatedAt: now });
      }
      const placementRecord = db.knowledge.find((record) => record.id === 'KB-24');
      const placementSeed = seedKnowledge.find((record) => record.id === 'KB-24');
      if (placementRecord && placementSeed) {
        placementRecord.tags = [...new Set([...(placementRecord.tags || []), 'placement platform', 'placement platforms', 'POD', 'Superset', 'TalentBattle', 'Unstop'])];
      }
      db.migrations.push(PLACEMENT_PLATFORMS_MIGRATION);
      didMigrate = true;
    }
    if (!migrations.has(ANSWER_GAPS_AND_ATTRIBUTION_MIGRATION)) {
      const byId = new Map(seedKnowledge.map((record) => [record.id, record]));
      const now = new Date().toISOString();
      const updatedRecordIds = new Set();
      const homepageStats = byId.get('KB-70');
      if (homepageStats && !db.knowledge.some((record) => record.id === 'KB-70')) {
        db.knowledge.push({ ...structuredClone(homepageStats), revision: 1, createdAt: now, updatedAt: now });
      }
      for (const id of ['KB-40', 'KB-46']) {
        const current = db.knowledge.find((record) => record.id === id);
        const seeded = byId.get(id);
        if (!current || !seeded) continue;
        const content = [current.source, current.text, JSON.stringify(current.provenance || {})].join(' ');
        if (!/project owner|owner-supplied|supplied excerpt/i.test(content)) continue;
        current.source = seeded.source;
        current.text = seeded.text;
        current.provenance = structuredClone(seeded.provenance);
        current.translations ||= {};
        for (const language of ['mr', 'hi']) {
          const translation = current.translations[language];
          if (translation && !translation.reviewedBy && /project owner|owner-supplied|supplied excerpt/i.test(JSON.stringify(translation))) {
            delete current.translations[language];
          }
        }
        updatedRecordIds.add(id);
      }
      const placement = db.knowledge.find((record) => record.id === 'KB-24');
      if (placement) placement.tags = [...new Set([...(placement.tags || []), 'internship opportunities', 'internship platforms', 'POD', 'Superset', 'TalentBattle', 'Unstop'])];
      db.migrations.push(ANSWER_GAPS_AND_ATTRIBUTION_MIGRATION);
      if (updatedRecordIds.size) {
        for (const record of db.knowledge) {
          if (updatedRecordIds.has(record.id)) {
            record.revision = (record.revision ?? 0) + 1;
            record.updatedAt = now;
          }
        }
      }
      didMigrate = true;
    }
    if (!migrations.has(SEED_KNOWLEDGE_TRANSLATIONS_MIGRATION)) {
      const seedsById = new Map(seedKnowledge.map((record) => [record.id, record]));
      const now = new Date().toISOString();
      for (const record of db.knowledge || []) {
        const seeded = seedsById.get(record.id);
        if (record.status !== 'Published' || !seeded?.translations || record.text !== seeded.text) continue;
        let changed = false;
        record.translations ||= {};
        for (const language of ['mr', 'hi']) {
          const translation = seeded.translations[language];
          const current = record.translations[language];
          if (!translation || current?.reviewedBy || current?.sourceHash === translation.sourceHash) continue;
          record.translations[language] = structuredClone(translation);
          changed = true;
        }
        if (changed) {
          record.revision = (record.revision ?? 0) + 1;
          record.updatedAt = now;
        }
      }
      db.migrations.push(SEED_KNOWLEDGE_TRANSLATIONS_MIGRATION);
      didMigrate = true;
    }
    if (!migrations.has(SEED_KNOWLEDGE_TRANSLATIONS_MIGRATION_V2)) {
      const expectedTexts = new Map([
        ['KB-68', seedKnowledge.find(item => item.id === 'KB-68')?.text],
        ['KB-SRC-24-TEXT-1', 'MITCORER states that separate boys and girls hostel facilities are available with RO drinking water, separate solar water-heating systems, a safe hygienic environment, and an emergency vehicle facility. Room availability, allotment, rules, and joining dates are not confirmed by this public FAQ and must be checked against the current hostel notice.'],
      ]);
      const now = new Date().toISOString();
      for (const [id, expectedText] of expectedTexts) {
        const record = db.knowledge.find(item => item.id === id);
        const translations = knowledgeTranslations[id];
        if (!record || record.status !== 'Published' || !expectedText || record.text !== expectedText || !translations) continue;
        const sourceHash = createHash('sha256').update(record.text).digest('hex');
        record.translations ||= {};
        let changed = false;
        for (const language of ['mr', 'hi']) {
          const current = record.translations[language];
          const text = translations[language];
          if (!text || current?.reviewedBy || (current?.sourceHash === sourceHash && current.text?.trim())) continue;
          record.translations[language] = { text, sourceHash, status: 'ai-reviewed-pending-human-review' };
          changed = true;
        }
        if (changed) {
          record.revision = (record.revision ?? 0) + 1;
          record.updatedAt = now;
        }
      }
      db.migrations.push(SEED_KNOWLEDGE_TRANSLATIONS_MIGRATION_V2);
      didMigrate = true;
    }
    if (!migrations.has(SEED_KNOWLEDGE_TRANSLATIONS_MIGRATION_V3)) {
      const expectedText = 'The MITCORER public page labelled Hostel Accommodations displayed classroom-related content during the 2026-11-18 crawl and did not establish hostel application steps, room availability, rules, contacts, or joining details. Confirm current hostel availability and procedures with the college before answering operational questions. Existing facility descriptions should be supported by a separate, current hostel source.';
      const record = db.knowledge.find(item => item.id === 'KB-68');
      const translations = knowledgeTranslations['KB-68'];
      if (record?.status === 'Published' && record.text === expectedText && translations) {
        const sourceHash = createHash('sha256').update(record.text).digest('hex');
        record.translations ||= {};
        let changed = false;
        for (const language of ['mr', 'hi']) {
          const current = record.translations[language];
          const text = translations[language];
          if (!text || current?.reviewedBy || (current?.sourceHash === sourceHash && current.text?.trim())) continue;
          record.translations[language] = { text, sourceHash, status: 'ai-reviewed-pending-human-review' };
          changed = true;
        }
        if (changed) {
          record.revision = (record.revision ?? 0) + 1;
          record.updatedAt = new Date().toISOString();
        }
      }
      db.migrations.push(SEED_KNOWLEDGE_TRANSLATIONS_MIGRATION_V3);
      didMigrate = true;
    }
    if (!migrations.has(SEED_KNOWLEDGE_TRANSLATIONS_MIGRATION_V4)) {
      const seedsById = new Map(seedKnowledge.map(record => [record.id, record]));
      const now = new Date().toISOString();
      for (const record of db.knowledge || []) {
        const seeded = seedsById.get(record.id);
        if (record.status !== 'Published' || !seeded?.translations || record.text !== seeded.text || record.facts) continue;
        const sourceHash = createHash('sha256').update(record.text).digest('hex');
        record.translations ||= {};
        let changed = false;
        for (const language of ['mr', 'hi']) {
          const current = record.translations[language];
          const translation = seeded.translations[language];
          if (!translation?.text || current?.reviewedBy || (current?.sourceHash === sourceHash && current.text?.trim())) continue;
          record.translations[language] = { ...structuredClone(translation), sourceHash };
          changed = true;
        }
        if (changed) { record.revision = (record.revision ?? 0) + 1; record.updatedAt = now; }
      }
      db.migrations.push(SEED_KNOWLEDGE_TRANSLATIONS_MIGRATION_V4);
      didMigrate = true;
    }
    if (!migrations.has(CONTACT_TRANSIT_GRAMMAR_MIGRATION)) {
      const record = db.knowledge.find(item => item.id === 'KB-40');
      const stale = 'conflict with the newer the published proximity description';
      if (record?.text?.includes(stale)) {
        record.text = record.text.replace(stale, "conflict with the newer page's proximity description");
        record.revision = (record.revision ?? 0) + 1;
        record.updatedAt = new Date().toISOString();
      }
      db.migrations.push(CONTACT_TRANSIT_GRAMMAR_MIGRATION);
      didMigrate = true;
    }
    if (!migrations.has(OFFICIAL_FACULTY_PROFILE_CAPTURE_MIGRATION)) {
      const now = new Date().toISOString();
      const captures = seedOfficialSources.filter(item => String(item.id || '').startsWith('SRC-FACULTY-'));
      const canonicalUrl = value => String(value || '').replace(/^https:\/\/www\./i, 'https://').replace(/\/+$/, '').toLowerCase();
      if (db.officialSources.length) {
        for (const capture of captures) {
          const existing = db.officialSources.find(item => item.id === capture.id
            || canonicalUrl(item.sourceUrl) === canonicalUrl(capture.sourceUrl));
          if (existing && existing.status !== 'Published') continue;
          if (existing) {
            Object.assign(existing, structuredClone(capture), {
              id: existing.id, uploadedBy: existing.uploadedBy || 'system:official-faculty-crawl',
              createdAt: existing.createdAt || now, updatedAt: now,
            });
          } else {
            db.officialSources.unshift({ ...structuredClone(capture), uploadedBy: 'system:official-faculty-crawl', createdAt: now, updatedAt: now });
          }
        }
      }
      db.migrations.push(OFFICIAL_FACULTY_PROFILE_CAPTURE_MIGRATION);
      didMigrate = true;
    }
    if (!migrations.has(OWNER_CONFIRMED_BIOMETRIC_MIGRATION)) {
      const now = new Date().toISOString();
      const record = db.knowledge.find(item => item.id === 'KB-32');
      const seedRecord = seedKnowledge.find(item => item.id === 'KB-32');
      const source = db.officialSources.find(item => item.id === 'SRC-11');
      const seedSource = seedOfficialSources.find(item => item.id === 'SRC-11');
      // The administrator explicitly confirmed the reviewed text. Publish only
      // the unchanged reviewed claim and retain the link's separate reachability caveat.
      if (record && seedRecord && source && seedSource
        && record.text === seedRecord.text && source.sourceUrl === seedSource.sourceUrl) {
        record.translations ||= {};
        let translationsChanged = false;
        for (const language of ['mr', 'hi']) {
          const translation = seedRecord.translations?.[language];
          const current = record.translations[language];
          if (translation && !current?.reviewedBy && current?.sourceHash !== translation.sourceHash) {
            record.translations[language] = structuredClone(translation);
            translationsChanged = true;
          }
        }
        const recordChanged = record.status !== 'Published' || Boolean(record.freshnessReview || record.sourceCheck) || translationsChanged;
        record.status = 'Published';
        delete record.freshnessReview;
        delete record.sourceCheck;
        if (recordChanged) {
          record.revision = (record.revision ?? 0) + 1;
          record.updatedAt = now;
        }
        source.status = 'Published';
        source.extractionStatus = 'Administrator reviewed and confirmed the circular text. The original university PDF link was unreachable during automated checking; confirm current applicability with PAHSU.';
        source.updatedAt = now;
        source.linkedKnowledgeCount = Math.max(source.linkedKnowledgeCount || 0, 1);
        delete source.freshnessImpact;
      }
      const obsoletePlaceholder = db.officialSources.find(item => item.id === 'SRC-UNREACHABLE'
        && item.sourceUrl === 'https://mitcorer.edu.in/removed.php');
      const placeholderLinked = obsoletePlaceholder && db.knowledge.some(item =>
        item.sourceDocumentId === obsoletePlaceholder.id || item.provenance?.documentId === obsoletePlaceholder.id);
      if (obsoletePlaceholder && !placeholderLinked) {
        db.officialSources = db.officialSources.filter(item => item !== obsoletePlaceholder);
      }
      db.migrations.push(OWNER_CONFIRMED_BIOMETRIC_MIGRATION);
      didMigrate = true;
    }
    if (hadDemoInquiries || hadDemoDocuments || didMigrate) {
      saveDb();
    }
    return db;
  }

  db = normalizeDb(createSeedData());
  syncConfiguredAdminFromEnvironment();
  db.migrations.push(...CURRENT_SEED_MIGRATIONS);
  saveDb();
  return db;
}

export function saveDb() {
  if (!db) return;
  // Includes source-sync withholding and migrations, not just editor mutations.
  const signature = createHash('sha256').update(JSON.stringify(db.knowledge || [])).digest('hex');
  if (signature !== knowledgeSignature) semanticResponseCache.clear();
  knowledgeSignature = signature;
  writeCollection('app', db);
}

export function getDb() {
  return loadDb();
}

export function checkStorageReady() {
  return openDatabase().prepare('SELECT 1 AS ready').get().ready === 1;
}

export function closeDb() {
  semanticResponseCache.clear();
  if (sqlite) {
    sqlite.close();
    sqlite = null;
  }
  db = null;
}

export function resetDbForTests(nextDb = createSeedData()) {
  closeDb();
  db = normalizeDb(nextDb);
  // Test fixtures represent a database after its one-time seeds and migrations
  // have completed; this keeps close/reopen cycles from applying live upgrades
  // in the middle of an API test.
  for (const migration of CURRENT_SEED_MIGRATIONS) {
    if (!db.migrations.includes(migration)) db.migrations.push(migration);
  }
}
