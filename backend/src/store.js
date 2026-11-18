
import { semanticResponseCache } from './semantic-cache.js';
import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { config } from './config.js';
import { createSeedData, seedKnowledge } from './seed.js';
import { resolveSourceUrl, missingReferences } from './source-links.js';

let db = null;
let sqlite = null;
const OFFICIAL_SOURCE_CANONICAL_URL_MIGRATION = 'canonicalize-official-sources-v1';
const OFFICIAL_SOURCE_CANONICAL_URL_MIGRATION_V2 = 'canonicalize-official-sources-v2';
const ENTC_HOD_MIGRATION = 'seed-entc-hod-kb52';
const PLACEMENT_COMMITTEE_MIGRATION = 'seed-placement-committee-kb53';
const PLACEMENT_COMMITTEE_REFRESH_MIGRATION = 'refresh-placement-committee-kb53-v2';
const PLACEMENT_CURRENT_ACTIVITIES_MIGRATION = 'refresh-placement-current-activities-kb16-kb35-v1';
const OFFICE_HOURS_VERIFICATION_MIGRATION = 'publish-dated-office-hours-observation-kb46-v2';
const INSTITUTION_STATUS_MIGRATION = 'seed-institution-status-kb54-v1';
const ADMISSION_QUOTA_AND_SEARCH_ALIASES_MIGRATION = 'seed-admission-quota-and-search-aliases-v1';
const COURSE_CODE_DISCREPANCY_MIGRATION = 'seed-course-code-discrepancy-kb56-v1';
const OFFICIAL_SOURCE_ROUTE_MIGRATION = 'map-seeded-records-to-current-official-routes-v1';
const DSE_CHOICE_CODE_MIGRATION = 'normalize-dse-choice-codes-v1';
const seededSpecificRouteCorrections = {
  'KB-15': 'https://mitcorer.edu.in/mitcorer/public/infrastructure',
  'KB-16': 'https://mitcorer.edu.in/mitcorer/public/placement/record',
  'KB-21': 'https://mitcorer.edu.in/mitcorer/public/infrastructure',
  'KB-22': 'https://mitcorer.edu.in/mitcorer/public/infrastructure/engineering-labs',
  'KB-23': 'https://mitcorer.edu.in/mitcorer/public/infrastructure/hostel-accommodations',
  'KB-24': 'https://mitcorer.edu.in/mitcorer/public/placements',
  'KB-25': 'https://mitcorer.edu.in/mitcorer/public/admissions/faqs',
  'KB-26': 'https://mitcorer.edu.in/mitcorer/public/admissions/documents',
  'KB-27': 'https://mitcorer.edu.in/mitcorer/public/admissions/documents',
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
    if (hadDemoInquiries || hadDemoDocuments || didMigrate) {
      saveDb();
    }
    return db;
  }

  db = normalizeDb(createSeedData());
  db.migrations.push(ENTC_HOD_MIGRATION);
  db.migrations.push(INSTITUTION_STATUS_MIGRATION);
  db.migrations.push(ADMISSION_QUOTA_AND_SEARCH_ALIASES_MIGRATION);
  db.migrations.push(COURSE_CODE_DISCREPANCY_MIGRATION);
  db.migrations.push(PLACEMENT_COMMITTEE_MIGRATION);
  db.migrations.push(PLACEMENT_COMMITTEE_REFRESH_MIGRATION);
  db.migrations.push(OFFICE_HOURS_VERIFICATION_MIGRATION);
  db.migrations.push(OFFICIAL_SOURCE_ROUTE_MIGRATION);
  db.migrations.push(DSE_CHOICE_CODE_MIGRATION);
  saveDb();
  return db;
}

export function saveDb() {
  if (!db) return;
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
  for (const migration of [ENTC_HOD_MIGRATION, PLACEMENT_COMMITTEE_MIGRATION,
    INSTITUTION_STATUS_MIGRATION, ADMISSION_QUOTA_AND_SEARCH_ALIASES_MIGRATION,
    COURSE_CODE_DISCREPANCY_MIGRATION,
    PLACEMENT_COMMITTEE_REFRESH_MIGRATION, OFFICIAL_SOURCE_ROUTE_MIGRATION,
    DSE_CHOICE_CODE_MIGRATION, OFFICIAL_SOURCE_CANONICAL_URL_MIGRATION]) {
    if (!db.migrations.includes(migration)) db.migrations.push(migration);
  }
}
