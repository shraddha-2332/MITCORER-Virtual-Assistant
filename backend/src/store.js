
import { semanticResponseCache } from './semantic-cache.js';
import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { config } from './config.js';
import { createSeedData, seedKnowledge } from './seed.js';
import { resolveSourceUrl } from './source-links.js';

let db = null;
let sqlite = null;
const ENTC_HOD_MIGRATION = 'seed-entc-hod-kb52';
const PLACEMENT_COMMITTEE_MIGRATION = 'seed-placement-committee-kb53';
const PLACEMENT_COMMITTEE_REFRESH_MIGRATION = 'refresh-placement-committee-kb53-v2';
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
      if (user.id === 'USR-ADM') return { ...user, name: 'Mundhe' };
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
    if (hadDemoInquiries || hadDemoDocuments || didMigrate) {
      saveDb();
    }
    return db;
  }

  db = normalizeDb(createSeedData());
  db.migrations.push(ENTC_HOD_MIGRATION);
  db.migrations.push(PLACEMENT_COMMITTEE_MIGRATION);
  db.migrations.push(PLACEMENT_COMMITTEE_REFRESH_MIGRATION);
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
    PLACEMENT_COMMITTEE_REFRESH_MIGRATION, OFFICIAL_SOURCE_ROUTE_MIGRATION,
    DSE_CHOICE_CODE_MIGRATION]) {
    if (!db.migrations.includes(migration)) db.migrations.push(migration);
  }
}
