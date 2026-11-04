import assert from 'node:assert/strict';
import { beforeEach, test } from 'node:test';
import { verifySpeculativeFigures } from '../src/speculative-verifier.js';
import { resetDbForTests } from '../src/store.js';
import { createSeedData } from '../src/seed.js';

beforeEach(() => {
  resetDbForTests(createSeedData());
});

test('accepts draft when all numbers match canonical database facts', () => {
  const draft = 'The First Year tuition fee for Open category is ₹1,05,000 for the academic year 2026-27, and hostel annual charge is ₹35,000.';
  const result = verifySpeculativeFigures(draft);
  assert.equal(result.verified, true);
});

test('rejects draft when hallucinated or unverified numbers are present', () => {
  const draft = 'The First Year fee is ₹1,99,999 and the special deposit is ₹77,777.';
  const result = verifySpeculativeFigures(draft);
  assert.equal(result.verified, false);
  assert.ok(result.unauthorized.includes('199999'));
  assert.ok(result.unauthorized.includes('77777'));
});

