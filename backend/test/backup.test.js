import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { createBackup, restoreBackup, verifyBackup } from '../src/backup.js';
test('backup includes committed WAL data and restores assets without overwriting or accepting tampering', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'mitra-backup-test-'));
  const sourceFile = path.join(directory, 'source.sqlite');
  const db = new DatabaseSync(sourceFile);
  try {
    db.exec('PRAGMA journal_mode=WAL; CREATE TABLE collections(name TEXT PRIMARY KEY, data TEXT);');
    db.prepare('INSERT INTO collections VALUES (?, ?)').run('app', JSON.stringify({ knowledge: [{ id: 'RESTORE-PROBE' }] }));
    fs.mkdirSync(path.join(directory, 'uploads'));
    fs.writeFileSync(path.join(directory, 'uploads/example.txt'), 'fixture asset');
    const backup = path.join(directory, 'snapshot');
    const officialSourceDirectory = path.join(directory, 'persistent-sources');
    fs.mkdirSync(officialSourceDirectory);
    fs.writeFileSync(path.join(officialSourceDirectory, 'notice.txt'), 'official notice fixture');
    createBackup({ databaseFile: sourceFile, assetRoot: directory, officialSourceDirectory, outputDirectory: backup });
    const target = path.join(directory, 'restored');
    restoreBackup(backup, target);
    const restored = new DatabaseSync(path.join(target, 'data/mitra.sqlite'), { readOnly: true });
    try { assert.equal(JSON.parse(restored.prepare("SELECT data FROM collections WHERE name='app'").get().data).knowledge[0].id, 'RESTORE-PROBE'); }
    finally { restored.close(); }
    assert.equal(fs.readFileSync(path.join(target, 'uploads/example.txt'), 'utf8'), 'fixture asset');
    assert.equal(fs.readFileSync(path.join(target, 'official-sources/notice.txt'), 'utf8'), 'official notice fixture');
    assert.throws(() => restoreBackup(backup, target), /new directory/);
    const manifestPath = path.join(backup, 'manifest.json');
    const original = fs.readFileSync(manifestPath, 'utf8');
    const tampered = JSON.parse(original); tampered.files[0].path = '../escape';
    fs.writeFileSync(manifestPath, JSON.stringify(tampered));
    assert.throws(() => verifyBackup(backup), /escapes/);
    fs.writeFileSync(manifestPath, original);
    fs.writeFileSync(path.join(backup, 'uploads/example.txt'), 'corrupt');
    assert.throws(() => restoreBackup(backup, path.join(directory, 'invalid-restore')), /checksum/);
    assert.equal(fs.existsSync(path.join(directory, 'invalid-restore')), false);
  } finally {
    db.close();
    if (path.dirname(directory) !== path.resolve(os.tmpdir()) || !path.basename(directory).startsWith('mitra-backup-test-')) throw new Error('Unsafe cleanup');
    fs.rmSync(directory, { recursive: true, force: true });
  }
});
