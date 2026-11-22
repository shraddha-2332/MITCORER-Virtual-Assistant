import test from 'node:test';
import assert from 'node:assert/strict';
import { validateProvenance, availability, confirmSourceReview, sourceReview, validateSupersession, splitPassage } from '../src/provenance.js';
import { publicEvidence } from '../src/evidence.js';

test('provenance rejects fabricated review fields, invalid dates, pages and non-consecutive years', () => {
  for (const value of [{ verifiedAt: '2026-10-10' }, { validUntil: '2026-02-29' }, { pageStart: 1.5 }, { pageEnd: 2 },
    { pageStart: 4, pageEnd: 3 }, { academicYear: '2026-29' }, { validFrom: '2026-10-10', validUntil: '2026-10-09' }]) assert.throws(() => validateProvenance(value));
  assert.deepEqual(validateProvenance({ academicYear: '2026-27', pageStart: 4, pageEnd: 7, validUntil: '2028-02-29' }),
    { academicYear: '2026-27', pageStart: 4, pageEnd: 7, validUntil: '2028-02-29' });
});
test('provenance accepts existing source attribution metadata while rejecting unknown fields', () => {
  assert.deepEqual(validateProvenance({ capturedAt: '2026-11-19', section: 'Contact Us', verifiedFrom: 'MITCORER official Contact Us page' }),
    { capturedAt: '2026-11-19', section: 'Contact Us', verifiedFrom: 'MITCORER official Contact Us page' });
  assert.deepEqual(validateProvenance({ suppliedBy: 'project owner excerpt' }), { suppliedBy: 'project owner excerpt' });
  assert.throws(() => validateProvenance({ verifiedFrom: `x${'a'.repeat(180)}` }), /Invalid verifiedFrom/);
  assert.throws(() => validateProvenance({ arbitrary: 'not supported' }), /Invalid source provenance fields/);
});
test('validity uses inclusive UTC days and never expires an academic year implicitly', () => {
  const record = { status: 'Published', provenance: { academicYear: '2024-25', validFrom: '2026-10-10', validUntil: '2026-10-10' } };
  assert.equal(availability(record, Date.parse('2026-10-09T23:59:59.999Z')), 'not-effective');
  assert.equal(availability(record, Date.parse('2026-10-10T00:00:00.000Z')), 'available');
  assert.equal(availability(record, Date.parse('2026-10-10T23:59:59.999Z')), 'available');
  assert.equal(availability(record, Date.parse('2026-10-11T00:00:00.000Z')), 'expired');
  assert.equal(availability({ status: 'Published', provenance: { academicYear: '2024-25' } }), 'available');
  assert.equal(availability({ status: 'Published', provenance: { validUntil: 'bad' } }), 'invalid-metadata');
});
test('recorded review binds text, source and lineage but does not publish reviewer identity', () => {
  const record = { id: 'KB-test', status: 'Published', text: 'Library passage', source: 'FAQ', provenance: { section: 'Library', pageStart: 4 } };
  assert.equal(sourceReview(record).status, 'not-recorded');
  confirmSourceReview(record, { email: 'private-reviewer@example.com' });
  assert.equal(sourceReview(record).status, 'recorded');
  assert.ok(!JSON.stringify(publicEvidence(record)).includes('private-reviewer'));
  record.provenance.pageStart = 5;
  assert.equal(sourceReview(record).status, 'source-changed');
});
test('supersession rejects missing targets and cycles, and blocks obsolete facts regardless of replacement status', () => {
  const a = { id: 'a', status: 'Published', provenance: { supersededBy: 'b' } };
  const b = { id: 'b', status: 'Review' };
  validateSupersession(a, [a, b]);
  assert.equal(availability(a), 'superseded');
  assert.throws(() => validateSupersession(a, [a]));
  b.provenance = { supersededBy: 'a' };
  assert.throws(() => validateSupersession(a, [a, b]));
});
test('paragraph-aware chunks preserve whole short paragraphs and bound oversized ones', () => {
  assert.deepEqual(splitPassage('First paragraph.\n\nSecond paragraph.', 20), ['First paragraph.', 'Second paragraph.']);
  const original = 'word '.repeat(1000).trim();
  const chunks = splitPassage(original);
  assert.ok(chunks.every(chunk => chunk.length <= 2800));
  assert.equal(chunks.join(' '), original);
});
test('evidence projection uses the shared evaluation instant at expiry boundaries', () => {
  const record = { id: 'dated', status: 'Published', text: 'A dated source', source: 'Fixture', provenance: { validUntil: '2000-01-01' } };
  assert.equal(publicEvidence(record, Date.parse('2000-01-01T23:59:59.999Z')).id, 'dated');
  assert.throws(() => publicEvidence(record, Date.parse('2000-01-02T00:00:00.000Z')));
});
