import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';
import { config } from '../src/config.js';
import { createSeedData } from '../src/seed.js';
import { closeDb, getDb, saveDb } from '../src/store.js';

const backendRoot = fileURLToPath(new URL('../', import.meta.url));
function withDatabase(run) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'mitra-store-test-'));
  const previousFile = config.databaseFile;
  closeDb();
  config.databaseFile = path.join(directory, 'test.sqlite');
  try { run(config.databaseFile); }
  finally {
    closeDb();
    config.databaseFile = previousFile;
    if (path.dirname(directory) !== path.resolve(os.tmpdir()) || !path.basename(directory).startsWith('mitra-store-test-')) throw new Error('Unsafe test cleanup path.');
    fs.rmSync(directory, { recursive: true, force: true });
  }
}

function readFromNewProcess(databaseFile) {
  const output = execFileSync(process.execPath, ['--no-warnings=ExperimentalWarning', '--input-type=module', '-e',
    "import {getDb,closeDb} from './src/store.js'; console.log(JSON.stringify(getDb())); closeDb();"], {
    cwd: backendRoot, env: { ...process.env, DATABASE_FILE: databaseFile }, encoding: 'utf8', timeout: 15_000,
  });
  return JSON.parse(output);
}

test('fresh initialization does not create sample review inbox requests', () => {
  withDatabase(() => {
    const db = getDb();
    assert.deepEqual(db.inquiries, []);
    assert.deepEqual(db.documents, []);
  });
});

test('fresh initialization seeds knowledge once and maintainer edits survive save and process restart', () => {
  withDatabase((databaseFile) => {
    const db = getDb();
    assert.equal(db.knowledge.length, createSeedData().knowledge.length);
    const record = db.knowledge.find((item) => item.id === 'KB-2');
    Object.assign(record, { title: 'Reviewed fee record', text: 'Maintainer-approved revised fee text',
      source: 'Reviewed official circular', sourceUrl: 'https://example.edu/fees', status: 'Draft',
      tags: ['reviewed'], updatedAt: '2026-10-09T00:00:00.000Z' });
    const expected = structuredClone(record);
    saveDb();
    assert.deepEqual(getDb().knowledge.find((item) => item.id === 'KB-2'), expected);
    const persisted = readFromNewProcess(databaseFile);
    assert.deepEqual(persisted.knowledge.find((item) => item.id === 'KB-2'), expected);
    closeDb();
    assert.deepEqual(getDb().knowledge.find((item) => item.id === 'KB-2'), expected);
  });
});

test('removed seed entries stay removed; custom records and empty source libraries survive restart', () => {
  withDatabase((databaseFile) => {
    const db = getDb();
    db.knowledge = db.knowledge.filter((item) => item.id !== 'KB-2');
    const custom = { id: 'KB-CUSTOM', title: 'Custom record', text: 'Reviewed campus information',
      source: 'Maintainer', category: 'Facilities', status: 'Published' };
    db.knowledge.push(custom);
    db.officialSources = [];
    saveDb();
    const restarted = readFromNewProcess(databaseFile);
    assert.equal(restarted.knowledge.some((item) => item.id === 'KB-2'), false);
    assert.deepEqual(restarted.knowledge.find((item) => item.id === custom.id), custom);
    assert.deepEqual(restarted.officialSources, []);
    closeDb();
    const loaded = getDb();
    loaded.knowledge = [];
    saveDb();
    assert.deepEqual(readFromNewProcess(databaseFile).knowledge, []);
  });
});

test('existing legacy collection retains edited knowledge and unrelated data during normalization', () => {
  withDatabase((databaseFile) => {
    const legacy = { knowledge: [{ id: 'KB-2', title: 'Older maintained title', text: 'Preserve this edit',
      source: 'Circular', category: 'Fees', status: 'Retired' }], officialSources: [],
      inquiries: [{ id: 'INQ-KEEP', question: 'Keep this inquiry' }, { id: 'INQ-2401', question: 'Old sample' }], documents: [{ id: 'DOC-KEEP' }, { id: 'DOC-SEED-1' }], feedback: [{ id: 'FB-KEEP', helpful: false }], conversations: [{ id: 'CHAT-KEEP', messages: [] }] };
    const sqlite = new DatabaseSync(databaseFile);
    try {
      sqlite.exec('CREATE TABLE collections (name TEXT PRIMARY KEY, data TEXT NOT NULL, updated_at TEXT NOT NULL)');
      sqlite.prepare('INSERT INTO collections VALUES (?, ?, ?)').run('app', JSON.stringify(legacy), '2026-01-01');
    } finally { sqlite.close(); }
    const loaded = getDb();
    assert.deepEqual(loaded.knowledge.find((item) => item.id === 'KB-2'), legacy.knowledge[0]);
    assert.ok(loaded.knowledge.some((item) => item.id === 'KB-52'));
    assert.deepEqual(loaded.inquiries, [{ id: 'INQ-KEEP', question: 'Keep this inquiry' }]);
    assert.deepEqual(loaded.documents, [{ id: 'DOC-KEEP' }]);
    assert.deepEqual(loaded.feedback, legacy.feedback);
    assert.deepEqual(loaded.conversations, legacy.conversations);
    saveDb();
    const restarted = readFromNewProcess(databaseFile);
    assert.deepEqual(restarted.knowledge.find((item) => item.id === 'KB-2'), legacy.knowledge[0]);
    assert.ok(restarted.knowledge.some((item) => item.id === 'KB-52'));
  });
});
