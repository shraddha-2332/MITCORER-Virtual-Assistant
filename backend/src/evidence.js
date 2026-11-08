import crypto from 'node:crypto';
import { availability, sourceReview } from './provenance.js';

// Published passages are public knowledge; never copy arbitrary record metadata.
export function publicEvidence(record, at = Date.now()) {
  if (availability(record, at) !== 'available' || typeof record.text !== 'string' || !record.text.trim()) throw new Error('Evidence must be an available published passage');
  const hash = crypto.createHash('sha256').update(record.text).digest('hex');
  const revision = Number.isSafeInteger(record.revision) && record.revision >= 0 ? record.revision : 0;
  return { id: record.id, title: record.title, category: record.category, source: record.source,
    sourceUrl: record.sourceUrl || '', score: record.score, revision,
    academicYear: record.facts?.academicYear || record.provenance?.academicYear || record.academicYear || null,
    provenance: record.provenance ? validatePublicProvenance(record.provenance) : {}, verification: sourceReview(record),
    citationId: `${record.id}:${revision}:${hash.slice(0, 12)}`,
    passage: { text: record.text.slice(0, 2800), sha256: hash, truncated: record.text.length > 2800 },
  };
}

function validatePublicProvenance(provenance) {
  const allowed = ['documentId', 'documentVersion', 'academicYear', 'section', 'capturedAt', 'pageStart', 'pageEnd', 'validFrom', 'validUntil'];
  return Object.fromEntries(allowed.filter(key => provenance[key] !== undefined).map(key => [key, provenance[key]]));
}
