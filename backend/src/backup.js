import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';

const digest = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
function safePath(root, relative) {
  if (typeof relative !== 'string' || !relative || path.isAbsolute(relative) || relative.includes('\\')) throw new Error('Invalid backup entry');
  if (relative.split('/').some(part => !part || part === '.' || part === '..')) throw new Error('Backup path escapes its root');
  const resolved = path.resolve(root, relative);
  if (!resolved.startsWith(`${path.resolve(root)}${path.sep}`)) throw new Error('Backup path escapes its root');
  let current = path.resolve(root);
  for (const part of relative.split('/')) {
    current = path.join(current, part);
    if (fs.existsSync(current) && fs.lstatSync(current).isSymbolicLink()) throw new Error('Backup symlinks are forbidden');
  }
  return resolved;
}
function files(root, prefix = '') {
  return fs.readdirSync(path.join(root, prefix), { withFileTypes: true }).flatMap(entry => {
    if (entry.isSymbolicLink()) throw new Error('Backup symlinks are forbidden');
    const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
    return entry.isDirectory() ? files(root, relative) : [relative];
  });
}
export function createBackup({ databaseFile, assetRoot, uploadDirectory = path.join(assetRoot, 'uploads'), outputDirectory }) {
  if (!fs.existsSync(databaseFile)) throw new Error('Database does not exist');
  if (fs.existsSync(outputDirectory)) throw new Error('Backup destination already exists');
  fs.mkdirSync(path.join(outputDirectory, 'data'), { recursive: true });
  const source = new DatabaseSync(databaseFile, { readOnly: true });
  try { source.prepare('VACUUM INTO ?').run(path.join(outputDirectory, 'data/mitra.sqlite')); }
  finally { source.close(); }
  for (const [name, from] of [['uploads', path.resolve(uploadDirectory)], ['official-sources', safePath(assetRoot, 'official-sources')]]) {
    if (fs.existsSync(from)) { files(from); fs.cpSync(from, path.join(outputDirectory, name), { recursive: true }); }
  }
  const entries = files(outputDirectory).sort().map(name => ({ path: name, bytes: fs.statSync(safePath(outputDirectory, name)).size, sha256: digest(safePath(outputDirectory, name)) }));
  const manifest = { version: 1, createdAt: new Date().toISOString(), consistency: 'SQLite-consistent database snapshot. Quiesce uploads/source maintenance for cross-file consistency.', files: entries };
  fs.writeFileSync(path.join(outputDirectory, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`, { flag: 'wx' });
  verifyBackup(outputDirectory);
  return manifest;
}
export function verifyBackup(directory) {
  const manifest = JSON.parse(fs.readFileSync(path.join(directory, 'manifest.json'), 'utf8'));
  if (manifest.version !== 1 || !Array.isArray(manifest.files) || !manifest.files.length) throw new Error('Invalid backup manifest');
  const seen = new Set();
  for (const entry of manifest.files) {
    const file = safePath(directory, entry.path);
    if (seen.has(entry.path) || !/^(?:data\/mitra\.sqlite|uploads\/.+|official-sources\/.+)$/.test(entry.path)) throw new Error('Invalid backup entry');
    seen.add(entry.path);
    if (fs.statSync(file).size !== entry.bytes || digest(file) !== entry.sha256) throw new Error('Backup checksum mismatch');
  }
  if (!seen.has('data/mitra.sqlite')) throw new Error('Backup database is missing');
  const database = new DatabaseSync(path.join(directory, 'data/mitra.sqlite'), { readOnly: true });
  try {
    if (database.prepare('PRAGMA integrity_check').get().integrity_check !== 'ok') throw new Error('Backup integrity check failed');
    const row = database.prepare("SELECT data FROM collections WHERE name = 'app'").get();
    if (!row || !Array.isArray(JSON.parse(row.data).knowledge)) throw new Error('Backup application collection is invalid');
  } finally { database.close(); }
  return manifest;
}
export function restoreBackup(directory, target) {
  const manifest = verifyBackup(directory);
  if (fs.existsSync(target)) throw new Error('Restore destination must be a new directory');
  fs.mkdirSync(target, { recursive: true });
  for (const entry of manifest.files) {
    const destination = safePath(target, entry.path);
    fs.mkdirSync(path.dirname(destination), { recursive: true });
    fs.copyFileSync(safePath(directory, entry.path), destination, fs.constants.COPYFILE_EXCL);
  }
  return manifest;
}
