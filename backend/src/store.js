
import { semanticResponseCache } from './semantic-cache.js';
import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { config } from './config.js';
import { createSeedData } from './seed.js';

let db = null;
let sqlite = null;

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
    inquiries: nextDb.inquiries || [],
    documents: (nextDb.documents || []).map((item) =>
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
  };
}

export function loadDb() {
  if (db) return db;

  const persisted = readCollection('app');

  if (persisted) {
    db = normalizeDb(persisted);
    return db;
  }

  db = normalizeDb(createSeedData());
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
}
