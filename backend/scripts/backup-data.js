import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { config } from '../src/config.js';
import { createBackup, restoreBackup, verifyBackup } from '../src/backup.js';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const [mode, backupPath, target] = process.argv.slice(2);
if (mode === '--verify' && backupPath) {
  verifyBackup(path.resolve(backupPath));
  console.log('Backup checksums and SQLite integrity verified.');
} else if (mode === '--restore' && backupPath && target) {
  restoreBackup(path.resolve(backupPath), path.resolve(target));
  console.log('Restored backup to new directory; running data was not overwritten.');
} else if (mode) throw new Error('Usage: no arguments, --verify DIRECTORY, or --restore DIRECTORY NEW_TARGET');
else {
  const output = path.join(root, 'backups', `mitra-${new Date().toISOString().replace(/[:.]/g, '-')}`);
  createBackup({
    databaseFile: config.databaseFile, assetRoot: root, uploadDirectory: config.uploadDirectory,
    officialSourceDirectory: config.officialSourceDirectory, outputDirectory: output,
  });
  console.log(`Verified backup created at ${output}`);
}
