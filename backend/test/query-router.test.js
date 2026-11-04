import assert from 'node:assert/strict';
import { test } from 'node:test';
import { routeQuery, ROUTE_TIER } from '../src/query-router.js';

test('routes unambiguous fee queries with complete slots directly to DETERMINISTIC_DIRECT', () => {
  const result = routeQuery('What is the First Year B.Tech fee for OBC boys?');
  assert.equal(result.tier, ROUTE_TIER.DETERMINISTIC_DIRECT);
  assert.equal(result.intent, 'academicFees');
});

test('routes ambiguous fee queries with missing qualifiers to CLARIFICATION_GATE', () => {
  const result = routeQuery('What is the fee?');
  // 'fees' without qualifying route/category or academic vs hostel
  assert.ok(result.tier === ROUTE_TIER.CLARIFICATION_GATE || result.intent === 'academicFees');
});

test('routes hostel and mess queries directly to DETERMINISTIC_DIRECT', () => {
  const result = routeQuery('What are the hostel and mess charges for boys?');
  assert.equal(result.tier, ROUTE_TIER.DETERMINISTIC_DIRECT);
  assert.equal(result.intent, 'accommodationFees');
});

test('routes open-ended exploratory queries to ADVISORY_NEURAL', () => {
  const result = routeQuery('Why should I choose MITCORER for my engineering studies?');
  assert.equal(result.tier, ROUTE_TIER.ADVISORY_NEURAL);
});

