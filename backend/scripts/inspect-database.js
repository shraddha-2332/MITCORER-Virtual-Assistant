import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { config } from '../src/config.js';

const dbPath = path.resolve(config.databaseFile);
console.log(`Database file: ${dbPath}`);

if (!fs.existsSync(dbPath)) {
  console.log('Database file does not exist yet.');
  process.exit(0);
}

const stats = fs.statSync(dbPath);
console.log(`File size: ${(stats.size / 1024).toFixed(2)} KB`);
console.log(`Last modified: ${stats.mtime.toLocaleString()}`);

const sqlite = new DatabaseSync(dbPath, { readOnly: true });
try {
  const integrity = sqlite.prepare('PRAGMA integrity_check').get()?.integrity_check;
  console.log(`SQLite integrity check: ${integrity || 'no result'}`);

  const tables = new Set(sqlite.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all().map(({ name }) => name));
  if (!tables.has('collections')) {
    console.log('Application collections table is not present.');
    process.exitCode = integrity === 'ok' ? 0 : 1;
  } else {
    const row = sqlite.prepare('SELECT data FROM collections WHERE name = ?').get('app');
    const appData = row ? JSON.parse(row.data) : null;
    if (!appData) {
      console.log('Application collection is not present.');
    } else {
      for (const name of ['knowledge', 'officialSources', 'users', 'inquiries', 'documents', 'feedback', 'conversations']) {
        const records = Array.isArray(appData[name]) ? appData[name] : [];
        console.log(`${name}: ${records.length}`);
      }
      const knowledge = Array.isArray(appData.knowledge) ? appData.knowledge : [];
      console.log(`Published knowledge: ${knowledge.filter((record) => record.status === 'Published').length}`);
      console.log(`Knowledge in review: ${knowledge.filter((record) => record.status === 'Review').length}`);
    }
    if (tables.has('vector_embeddings')) {
      const vectorCount = sqlite.prepare('SELECT count(*) AS count FROM vector_embeddings').get().count;
      console.log(`Stored vector embeddings: ${vectorCount}`);
    }
    process.exitCode = integrity === 'ok' ? 0 : 1;
  }
} finally {
  sqlite.close();
}
