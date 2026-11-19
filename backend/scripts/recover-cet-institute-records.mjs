import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { config } from '../src/config.js';
import { seedKnowledge } from '../src/seed.js';

const db = new DatabaseSync(path.resolve(config.databaseFile));
db.exec('PRAGMA busy_timeout = 5000');
const row = db.prepare("SELECT data FROM collections WHERE name = 'app'").get();
if (!row) throw new Error('Application database collection is missing.');
const data = JSON.parse(row.data);
const ids = ['KB-54', 'KB-55', 'KB-56'];
const source = data.officialSources.find(item => item.id === 'SRC-WEB-D9847CB7EA3A');
if (!source || !/HTTP 404/.test(source.syncMeta?.lastError || '')) throw new Error('Expected generic 404 source issue was not found; no changes made.');
const seed = new Map(seedKnowledge.map(item => [item.id, item]));
const changes = [];
for (const id of ids) {
  const record = data.knowledge.find(item => item.id === id);
  const expected = seed.get(id);
  if (!record || !expected || record.text !== expected.text) throw new Error(`Maintained text mismatch for ${id}; no changes made.`);
}
const institute = data.knowledge.find(item => item.id === 'KB-54');
const quota = data.knowledge.find(item => item.id === 'KB-55');
const discrepancy = data.knowledge.find(item => item.id === 'KB-56');
institute.sourceUrl = 'https://fe2026.mahacet.org/StaticPages/frmInstituteSummary?InstituteCode=06901';
institute.source = 'Maharashtra State CET Cell 2026-27 Institute Summary (Institute Code 06901)';
institute.status = 'Published'; delete institute.freshnessReview; delete institute.sourceCheck;
institute.revision = (institute.revision ?? 0) + 1; institute.updatedAt = new Date().toISOString();
changes.push('KB-54');
quota.status = 'Published'; delete quota.freshnessReview; delete quota.sourceCheck;
quota.revision = (quota.revision ?? 0) + 1; quota.updatedAt = new Date().toISOString();
changes.push('KB-55');
discrepancy.status = 'Published'; delete discrepancy.freshnessReview; delete discrepancy.sourceCheck;
discrepancy.revision = (discrepancy.revision ?? 0) + 1; discrepancy.updatedAt = new Date().toISOString();
changes.push('KB-56');
source.title = 'Maharashtra State CET Cell 2026-27 Institute Summary — Institute Code 06901';
source.sourceUrl = institute.sourceUrl;
source.status = 'Published';
source.extractionStatus = 'Current institute-specific page URL restored. Summary values are recorded in reviewed knowledge records; verify live values before changing them.';
source.syncMeta = { ...source.syncMeta, sourceUrl: institute.sourceUrl, healthStatus: 'unknown', lastError: 'The generic URL without InstituteCode returns 404; institute-specific URL has not yet been fetched by this service.' };
source.linkedKnowledgeCount = 3;
const statement = db.prepare("UPDATE collections SET data = ?, updated_at = ? WHERE name = 'app'");
db.exec('BEGIN IMMEDIATE');
try { statement.run(JSON.stringify(data), new Date().toISOString()); db.exec('COMMIT'); }
catch (error) { db.exec('ROLLBACK'); throw error; }
db.close();
console.log(JSON.stringify({ changed: changes, sourceUrl: source.sourceUrl, sourceHealth: source.syncMeta.healthStatus,
  caveat: source.syncMeta.lastError, remainingReview: data.knowledge.filter(item => item.status === 'Review').map(item => item.id) }, null, 2));
