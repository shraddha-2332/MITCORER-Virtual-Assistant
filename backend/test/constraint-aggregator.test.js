import assert from 'node:assert/strict';
import { beforeEach, test } from 'node:test';
import { aggregateInstitutionalCost } from '../src/constraint-aggregator.js';
import { resetDbForTests } from '../src/store.js';
import { createSeedData } from '../src/seed.js';

beforeEach(() => {
  resetDbForTests(createSeedData());
});

test('aggregateInstitutionalCost computes total tuition with hostel and caution deposit', () => {
  const result = aggregateInstitutionalCost({
    route: 'firstYear',
    category: 'open',
    gender: 'boy',
    includeHostel: true,
  });

  assert.ok(result);
  assert.equal(result.academicFees.tuitionPayable, 105000);
  assert.equal(result.accommodation.hostelAnnualRent, 35000);
  assert.equal(result.accommodation.messAnnualCharges, 42000);
  assert.equal(result.accommodation.refundableDeposit, 5000);
  assert.equal(result.accommodation.subtotal, 82000);
  assert.equal(result.totalPayable, 105000 + 82000);
});

test('aggregateInstitutionalCost applies concession for girl OBC candidates', () => {
  const result = aggregateInstitutionalCost({
    route: 'firstYear',
    category: 'obc',
    gender: 'girl',
    includeHostel: false,
  });

  assert.ok(result);
  assert.equal(result.academicFees.tuitionPayable, 17217);
  assert.equal(result.totalPayable, 17217);
});
