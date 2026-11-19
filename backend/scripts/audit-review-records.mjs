import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';
import { config } from '../src/config.js';
import { seedKnowledge } from '../src/seed.js';
import { supportsMaintainedClaim } from '../src/maintained-claim-support.js';

const dbFile = path.resolve(config.databaseFile);
const sqlite = new DatabaseSync(dbFile, { readOnly: true });
try {
  const data = JSON.parse(sqlite.prepare('SELECT data FROM collections WHERE name = ?').get('app')?.data || '{}');
  const sourceByUrl = new Map();
  for (const source of data.officialSources || []) {
    const url = String(source.sourceUrl || '').replace(/[?#].*$/, '').replace(/\/$/, '').toLowerCase();
    if (!sourceByUrl.has(url)) sourceByUrl.set(url, []);
    sourceByUrl.get(url).push(source);
  }
  const report = (data.knowledge || []).filter(item => item.status === 'Review').map(item => {
    const url = String(item.freshnessReview?.changedSourceUrl || item.sourceUrl || '').replace(/[?#].*$/, '').replace(/\/$/, '').toLowerCase();
    const sources = (data.officialSources || []).filter(source => String(source.sourceUrl || '').replace(/[?#].*$/, '').replace(/\/$/, '').toLowerCase() === url);
    const seeded = seedKnowledge.find(record => record.id === item.id);
    const captureSupports = sources.some(source => source.extractedText && supportsMaintainedClaim(source.extractedText, item));
    return { id: item.id, title: item.title, reason: item.freshnessReview?.reason || 'manual-review', status: item.status,
      sourceUrl: item.sourceUrl || null, changedSourceUrl: item.freshnessReview?.changedSourceUrl || null,
      textMatchesSeed: item.text === seeded?.text, factsMatchSeed: JSON.stringify(item.facts || null) === JSON.stringify(seeded?.facts || null),
      availability: item.sourceUrl ? sources.map(source => ({ id: source.id, status: source.status, health: source.syncMeta?.healthStatus || null,
        captured: Boolean(source.extractedText), excerpt: String(source.extractedText || '').slice(0, 240) })) : [],
      captureSupportsMaintainedClaim: captureSupports };
  });
  console.log(JSON.stringify({ dbFile, reviewed: report.length, items: report }, null, 2));
} finally { sqlite.close(); }
