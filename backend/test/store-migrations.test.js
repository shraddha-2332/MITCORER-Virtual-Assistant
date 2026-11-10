import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { config } from '../src/config.js';
import { createSeedData } from '../src/seed.js';
import { closeDb, loadDb } from '../src/store.js';

test('placement committee migration repairs stale persisted TPO record without changing its status', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'mitra-placement-migration-'));
  const previousDatabaseFile = config.databaseFile;
  const databaseFile = path.join(directory, 'migration.sqlite');
  closeDb();
  config.databaseFile = databaseFile;
  try {
    const persisted = createSeedData();
    persisted.migrations = persisted.migrations || [];
    persisted.migrations.push('seed-entc-hod-kb52', 'seed-placement-committee-kb53');
    const stale = persisted.knowledge.find((record) => record.id === 'KB-53');
    stale.text = 'MITCORER has a Training and Placement Cell. Contact the college for details.';
    stale.sourceUrl = 'https://mitcorer.edu.in/faq.php';
    stale.revision = 7;

    const sqlite = new DatabaseSync(databaseFile);
    sqlite.exec('CREATE TABLE collections (name TEXT PRIMARY KEY, data TEXT NOT NULL, updated_at TEXT NOT NULL)');
    sqlite.prepare('INSERT INTO collections (name, data, updated_at) VALUES (?, ?, ?)').run('app', JSON.stringify(persisted), new Date().toISOString());
    sqlite.close();

    const migrated = loadDb();
    const record = migrated.knowledge.find((item) => item.id === 'KB-53');
    assert.match(record.text, /Dr\. Sachin Khomane as Training and Placement Officer/);
    assert.equal(record.sourceUrl, 'https://mitcorer.edu.in/mitcorer/public/placement/committee');
    assert.equal(record.revision, 8);
    assert.equal(record.status, 'Published');
    assert.ok(migrated.migrations.includes('refresh-placement-committee-kb53-v2'));
  } finally {
    closeDb();
    config.databaseFile = previousDatabaseFile;
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

test('placement migration does not restore an intentionally removed record after the original migration ran', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'mitra-placement-deletion-'));
  const previousDatabaseFile = config.databaseFile;
  const databaseFile = path.join(directory, 'migration.sqlite');
  closeDb();
  config.databaseFile = databaseFile;
  try {
    const persisted = createSeedData();
    persisted.migrations = ['seed-entc-hod-kb52', 'seed-placement-committee-kb53'];
    persisted.knowledge = persisted.knowledge.filter((record) => record.id !== 'KB-53');
    const sqlite = new DatabaseSync(databaseFile);
    sqlite.exec('CREATE TABLE collections (name TEXT PRIMARY KEY, data TEXT NOT NULL, updated_at TEXT NOT NULL)');
    sqlite.prepare('INSERT INTO collections (name, data, updated_at) VALUES (?, ?, ?)').run('app', JSON.stringify(persisted), new Date().toISOString());
    sqlite.close();
    assert.ok(!loadDb().knowledge.some((record) => record.id === 'KB-53'));
  } finally {
    closeDb();
    config.databaseFile = previousDatabaseFile;
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

test('official-route migration changes only known stale URLs and preserves edits, status, and deletions', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'mitra-route-migration-'));
  const previousDatabaseFile = config.databaseFile;
  const databaseFile = path.join(directory, 'migration.sqlite');
  closeDb();
  config.databaseFile = databaseFile;
  try {
    const persisted = createSeedData();
    persisted.migrations = ['seed-entc-hod-kb52', 'seed-placement-committee-kb53', 'refresh-placement-committee-kb53-v2'];
    const documents = persisted.knowledge.find((record) => record.id === 'KB-13');
    documents.text = 'Admin-reviewed document checklist text.';
    documents.status = 'Review';
    documents.sourceUrl = 'https://mitcorer.edu.in/faq.php';
    const dse = persisted.knowledge.find((record) => record.id === 'KB-11');
    dse.text = dse.text.replace('0690119110', '690119110').replace('0690124210', '690124210').replace('0690184410', '690184410').replace('0690137210', '690137210').replace('0690161210', '690161210');
    persisted.knowledge = persisted.knowledge.filter((record) => record.id !== 'KB-23');
    const sqlite = new DatabaseSync(databaseFile);
    sqlite.exec('CREATE TABLE collections (name TEXT PRIMARY KEY, data TEXT NOT NULL, updated_at TEXT NOT NULL)');
    sqlite.prepare('INSERT INTO collections (name, data, updated_at) VALUES (?, ?, ?)').run('app', JSON.stringify(persisted), new Date().toISOString());
    sqlite.close();

    const migrated = loadDb();
    const record = migrated.knowledge.find((item) => item.id === 'KB-13');
    assert.equal(record.sourceUrl, 'https://mitcorer.edu.in/mitcorer/public/admissions/faqs');
    assert.equal(record.text, 'Admin-reviewed document checklist text.');
    assert.equal(record.status, 'Review');
    assert.equal(record.revision, 1);
    assert.match(migrated.knowledge.find((item) => item.id === 'KB-11').text, /Computer Science and Engineering 0690124210/);
    assert.equal(migrated.knowledge.find((item) => item.id === 'KB-11').revision, 2);
    assert.ok(!migrated.knowledge.some((item) => item.id === 'KB-23'));
    assert.ok(migrated.migrations.includes('map-seeded-records-to-current-official-routes-v1'));
  } finally {
    closeDb();
    config.databaseFile = previousDatabaseFile;
    fs.rmSync(directory, { recursive: true, force: true });
  }
});
