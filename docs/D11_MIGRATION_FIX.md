# D11 source-library restart fix

## Symptom

An intentionally emptied official-source library acquired crawl seed entries after restart. The existing regression failed before this change.

## Root cause

Fresh initialization persisted current seed data but recorded only some completed migrations. On restart, the crawl-import migration appeared pending and interpreted deliberately removed sources as missing upgrade data. The importer also populated explicitly empty legacy source libraries.

## Fix

`backend/src/store.js` now records the complete current seed migration list with initial data, using the same list for current test fixtures. Existing databases still run pending upgrades. The crawl importer preserves an explicitly empty source library and records completion, so subsequent restarts preserve it too.

No production database was opened or repaired. This change cannot identify or automatically remove entries resurrected by an earlier run; those require maintainer review. Nonempty legacy libraries still receive the existing one-time crawl upgrade.

## Regression prevention

`backend/test/store.test.js` checks a fresh database after deletion across repeated independent process restarts, and checks an empty legacy library before and after restart. Existing migration tests continue to check legitimate upgrades and preserved maintainer edits/deletions. No tests were skipped or weakened.

## Validation

The disposable validation runner `node scripts/verify-phase-a.mjs` checks the current source without copying runtime databases, uploads or environment secrets. Current evidence is in [d11-validation](d11-validation/). The older Phase A evidence remains historical.

All runner stages exited zero: backend **281/281**, frontend **22/22**, focused Phase A **11/11**, public development **36/36**, workflow **500/500**, original audit **150/150 bounded checks**, and browser **47 checks**. Maintainer editing/restart/retirement journeys and public-session journeys passed. Production build, lint, source syntax and whitespace checks passed. [Download evidence ZIP](d11-validation/MITRA_D11_EVIDENCE.zip).

Independent institutional verification and Marathi/Hindi fluency review remain pending; automated scenario checks do not establish either. Deployment was not performed.
