import test from 'node:test';
import assert from 'node:assert/strict';
import { buildOfficialNavigationAnswer } from '../src/official-navigation.js';

test('scholarship guidance links the current MahaDBT and NSP portals without inventing eligibility', () => {
  const result = buildOfficialNavigationAnswer('Give me the MITCORER scholarship webpage link for AY 2026-27.');
  assert.match(result.answer, /eligibility, documents, amounts, and deadlines depend on the scheme/i);
  assert.match(result.answer, /MahaDBT 2\.0/);
  assert.deepEqual(result.officialLinks.map(link => link.url), [
    'https://mitcorer.edu.in/mitcorer/public/admissions/scholarship',
    'https://mahadbt2.maharashtra.gov.in/',
    'https://scholarships.gov.in/',
  ]);
});

test('a general scholarship availability question remains with the factual answer route', () => {
  assert.equal(buildOfficialNavigationAnswer('What scholarships are available at MITCORER?'), null);
});

test('scholarship guidance does not apply AY 2026-27 MahaDBT routing to another requested year', () => {
  const result = buildOfficialNavigationAnswer('Give me the MITCORER scholarship webpage link for AY 2025-26.');
  assert.match(result.answer, /For AY 2025-26, check the official portal for that year's application channel and status/);
  assert.doesNotMatch(result.answer, /For Maharashtra MahaDBT applications in AY 2026-27/);
  assert.ok(result.officialLinks.some(link => link.url === 'https://mahadbt.maharashtra.gov.in/'));
});

test('admission document guidance separates the route-specific checklist from current CET Cell notices', () => {
  const result = buildOfficialNavigationAnswer('Which admission documents does MITCORER require after allotment?');
  assert.match(result.answer, /First Year or Direct Second Year, CAP or institute-level/);
  assert.match(result.answer, /compare it with the current-year State CET Cell/);
  assert.deepEqual(result.officialLinks.map(link => link.url), [
    'https://mitcorer.edu.in/fy-btech-documents.php',
    'https://fe2026.mahacet.org/StaticPages/HomePage',
  ]);
});
