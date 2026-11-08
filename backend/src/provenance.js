import crypto from 'node:crypto';
import { badRequest } from './errors.js';

const fields = ['documentId', 'documentVersion', 'academicYear', 'section', 'capturedAt', 'pageStart', 'pageEnd', 'validFrom', 'validUntil', 'supersededBy'];
export function validDate(value) {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)
    && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
}
export function validateProvenance(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).some(key => !fields.includes(key))) throw badRequest('Invalid source provenance fields.');
  const result = {};
  for (const field of fields) {
    if (value[field] === undefined || value[field] === '' || value[field] === null) continue;
    const item = value[field];
    if (field === 'pageStart' || field === 'pageEnd') {
      if (!Number.isSafeInteger(item) || item < 1 || item > 100000) throw badRequest('Pages must be whole numbers from 1 to 100000.');
    } else if (field === 'validFrom' || field === 'validUntil' || field === 'capturedAt') {
      if (!validDate(item)) throw badRequest('Use a real source date in YYYY-MM-DD format.');
    } else if (typeof item !== 'string' || !item.trim() || item.length > 180) throw badRequest(`Invalid ${field}.`);
    result[field] = typeof item === 'string' ? item.trim() : item;
  }
  if (result.academicYear) {
    const match = result.academicYear.match(/^(\d{4})-(\d{2})$/);
    if (!match || Number(match[2]) !== (Number(match[1]) + 1) % 100) throw badRequest('Use a consecutive academic year such as 2026-27.');
  }
  if (result.pageEnd && !result.pageStart || result.pageEnd < result.pageStart) throw badRequest('Page end requires a start page and cannot precede it.');
  if (result.validFrom && result.validUntil && result.validUntil < result.validFrom) throw badRequest('Validity end cannot precede its start.');
  return result;
}
export function sourceFingerprint(record) {
  const provenance = Object.fromEntries(Object.entries(record.provenance || {}).sort(([a], [b]) => a.localeCompare(b)));
  return crypto.createHash('sha256').update(JSON.stringify({ text: record.text, source: record.source, sourceUrl: record.sourceUrl || '', provenance })).digest('hex');
}
export function availability(record, at = Date.now()) {
  const p = record.provenance || {};
  if (record.status !== 'Published') return 'unpublished';
  if (p.supersededBy) return 'superseded';
  if (p.validFrom && !validDate(p.validFrom) || p.validUntil && !validDate(p.validUntil)) return 'invalid-metadata';
  if (p.validFrom && at < Date.parse(`${p.validFrom}T00:00:00.000Z`)) return 'not-effective';
  if (p.validUntil && at > Date.parse(`${p.validUntil}T23:59:59.999Z`)) return 'expired';
  return 'available';
}
export const usableKnowledge = record => availability(record) === 'available';
export function sourceReview(record) {
  const verification = record.verification;
  if (typeof verification?.verifiedAt !== 'string' || !Number.isFinite(Date.parse(verification.verifiedAt)) || !/^[a-f0-9]{64}$/.test(verification?.contentHash || '')) return { status: 'not-recorded', verifiedAt: null };
  return { status: verification.contentHash === sourceFingerprint(record) ? 'recorded' : 'source-changed', verifiedAt: verification.verifiedAt };
}
export function confirmSourceReview(record, user) {
  record.verification = { verifiedAt: new Date().toISOString(), verifiedBy: user.email, contentHash: sourceFingerprint(record) };
}
export function validateSupersession(record, records) {
  let id = record.provenance?.supersededBy;
  const visited = new Set([record.id]);
  while (id) {
    if (visited.has(id)) throw badRequest('Source supersession cannot contain a cycle.');
    visited.add(id);
    const target = records.find(item => item.id === id);
    if (!target) throw badRequest('The superseding knowledge record does not exist.');
    id = target.provenance?.supersededBy;
  }
}

export function splitPassage(text, size = 2800) {
  const chunks = [];
  let current = '';
  for (const paragraph of text.replace(/\r\n/g, '\n').trim().split(/\n\s*\n/)) {
    if (current && current.length + paragraph.length + 2 > size) { chunks.push(current); current = ''; }
    let remaining = paragraph;
    while (remaining.length > size) {
      const boundary = remaining.lastIndexOf(' ', size);
      const cut = boundary > size / 2 ? boundary : size;
      chunks.push(remaining.slice(0, cut)); remaining = remaining.slice(cut).trimStart();
    }
    current = current ? `${current}\n\n${remaining}` : remaining;
  }
  if (current) chunks.push(current);
  return chunks;
}
