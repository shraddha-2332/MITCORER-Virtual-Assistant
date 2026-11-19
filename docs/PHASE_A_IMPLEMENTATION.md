# Phase A implementation and validation

**Later D11 follow-up:** the previously remaining migration defect is now fixed locally, with 281/281 backend tests passing. See [the D11 report and new evidence](D11_MIGRATION_FIX.md). Results below describe the original Phase A run and are retained as historical evidence.

18 November 2026. Scope approved: accuracy, cache freshness, factual routing, compound answers, language, conversation context and public UI. Changes are local; no deployment, commit, production API write, dependency installation or institutional-record edit was performed.

## Result

The selected Phase A fixes are implemented. The overall backend suite remains red because of the previously confirmed **D11 source-migration defect**, which belongs to the separately scoped source/migration work. This is not a production-readiness declaration.

| Validation | Executed result |
|---|---|
| Focused Phase A regressions | 11/11 passed |
| Complete backend suite | 280/281 passed; D11 remains |
| Frontend unit tests | 22/22 passed |
| Existing public development evaluator | 36/36 passed after correcting the obsolete Polytechnic intake expectation |
| Existing workflow/routing evaluator | 500/500 passed |
| Original audit diagnostic, same 150 inputs | 150/150 bounded contract checks passed; zero exceptions |
| Browser matrix and edge cases | 47 checks passed: 3 widths × 3 languages × 5 answer families, plus formatting/XSS and hung-request/retry checks |
| Existing maintainer and public-session browser journeys | Passed |
| Production build and frontend lint | Passed |
| Syntax and whitespace checks | Passed |

These are developer-authored regression and contract checks, not independently reviewed factual accuracy, linguistic fluency, general conversational intelligence or production performance. Providers were disabled. The 150-case audit was already exposed during development; it is not held out.

Evidence and full responses are in [phase-a-validation](phase-a-validation/). The original audit artifacts remain unchanged as the baseline. The generated results include synthetic fixtures and must not be represented as institution-certified findings.

## Implementation

- **D01: maintained authority.** Existing routes still identify topics, but the shared factual boundary reads current published records. Profile/HOD, facilities, admissions, placement and scholarship answers no longer use a record's existence to authorize an independent factual literal. Selected facts and lists are extracted from maintained passages; unfamiliar wording falls back to the passage. Unsupported faculty/alumni counts and platform names are not restored merely because old tests expected them. Critical fee/intake figures continue to use validated maintained fact tables.
- **D02: cache freshness.** Entries bind to current record dependencies and recheck publication, revision, provenance and availability on reads. Knowledge changes invalidate cached responses through the storage boundary, including source withholding. Authenticated personal answers are excluded from the shared response cache. Content-specific cache heuristics were removed.
- **D03/D05: routing and scope.** Navigation no longer intercepts factual scholarship, admission, placement and document requests. Capacity/sanctioned-seat variants and bounded typo/alias coverage improved. Cutoff lookup refuses unsupported explicit rounds/exams and mismatched record years rather than substituting a Round-I/JEE record.
- **D04: compound completeness.** Comma-separated attributes, scholarship/admission/document facets, shared branch scope, branch comparisons and academic-plus-hostel cost requests are handled independently. A mixed response can carry supported evidence alongside a specific clarification; it reports `PARTIALLY_ANSWERED`.
- **D06/D08: conversation.** Short branch switches preserve intake; hostel/mess/deposit follow-ups retain cost context; scholarship context is distinct from academic fees. Resolved scope is persisted. Unresolved standalone references ask a clarification instead of selecting unrelated evidence. Existing ownership, expiry and reset controls remain in force.
- **D07: language.** Strong Marathi/Hindi and Romanized markers take precedence over shared nouns. Additional native entity aliases and compound section labels are supported. Explicit language choice wins. Missing reviewed translations still use an explicit English fallback; independent speaker review remains necessary.
- **D09: outcomes.** Clarifications consistently return `NEEDS_CLARIFICATION`; mixed compound responses distinguish partial support. Outcome/source-link metadata is retained in new conversation messages. Existing historical messages are not rewritten.
- **D10: escalation.** Contacts come from the maintained published contact record. Unsupported office hours and placeholder office phone numbers were removed from escalation construction and UI fallback. Contacts are displayed once and support the selected UI language.
- **D12–D14: presentation and recovery.** Ordered steps preserve numbering; document checklists, bounded Markdown headings/bold/comparison tables and paragraph/list boundaries render without raw HTML execution. Chat tables override the admin table minimum width and retain keyboard-scroll regions for larger tables. The conversation is a polite live log, message language metadata is retained, and reduced-motion preferences are respected. JSON requests have a 25-second deadline covering body reads, a usable error state and explicit retry. There are no automatic retries of writes.

## Important files

| Layer | Files |
|---|---|
| Maintained facts/routing | `backend/src/maintained-profile.js`, `server.js`, `official-navigation.js`, `knowledge.js` |
| Understanding/context | `query-understanding.js`, `question-plan.js`, `conversations.js`, `language.js` |
| Cache/storage boundary | `semantic-cache.js`, `store.js` |
| UI/network | `frontend/src/App.jsx`, `answer-format.mjs`, `request-json.mjs`, `api.js`, `index.css` |
| Regressions | `backend/test/maintained-answer-regression.test.js`, related existing suites, frontend formatter/request tests |
| Isolated verification | `scripts/verify-phase-a.mjs`, `frontend/scripts/verify-phase-a.mjs` |

The repository already contained extensive uncommitted modifications and deletions before this work. Those were preserved; the full Git diff is not a list of changes introduced by Phase A.

## Verification details and test-oracle corrections

The runner copies source, tests, required documentation fixtures, existing frontend dependencies and the read-only document index into a disposable directory. It excludes the runtime application database, environment secrets, uploads and original source documents. Backend tests create only disposable fixture data. The frontend build explicitly uses `NODE_ENV=production`; test/browser checks use test mode. No packages are installed by the runner.

Run from the repository root:

```powershell
node scripts/verify-phase-a.mjs
```

The command intentionally exits nonzero while D11 remains. Logs and generated results are retained at the printed temporary path. Full execution is not silently converted into a pass.

Old expectations tied to literal wording were updated to check maintained content and uncertainty. In particular:

- PUB-021 now requires the record's explicit lack of a verified current Polytechnic intake, rather than an unsupported intake of 60.
- Faculty/alumni tests now reject counts absent from their maintained record.
- General placement support uses KB-24. Platform questions use KB-69, which records the project-owner-provided list (POD, Superset, TalentBattle, Unstop) and marks public-source verification as pending. Dated recruiter information remains linked to KB-16.
- Scholarship-specific evidence uses the available published scheme record, with a published general-record fallback when the scheme record is withheld.
- Ordered-list expectations now require preserved ordering. Equivalent source wording is accepted for attendance, transport caveats, admissions and institutional classifications.

The new edit/retirement/expiry/scope regressions ensure these changes cannot pass solely by relaxing old wording checks. Browser testing exposed both an existence-only library guard and an inherited 820px admin table width; both were corrected and verified visually and through assertions.

Production build: JavaScript 295.24 kB (88.37 kB gzip), CSS 88.73 kB (16.68 kB gzip). The campus image remains 953.90 kB; asset compression belongs to the later rural-accessibility phase. No throughput or production latency improvement is claimed.

## Known limitations and remaining work

1. **D11 remains:** `backend/test/store.test.js` confirms that an intentionally empty official-source library receives crawl seed entries on restart. This predates Phase A. No migration or production data correction was authorized or applied here.
2. Independent institutional verification, native-speaker review, live Groq/Gemini evaluation, real production latency/load, and full assistive-technology testing remain unverified.
3. Formatting support is deliberately bounded, not a full Markdown/HTML engine. Unrecognized material remains text. A manual retry can create another chat turn if the first request reached the server; no exactly-once guarantee is claimed.
4. The streaming endpoint still emits an already-constructed answer; the public widget uses the non-streaming API. No unverified model draft is streamed to users.
5. Admin analytics/RBAC expansion, migration/source-governance changes, voice, deployment and production data edits remain outside this implementation.

The next separately scoped correction is D11. The backend suite is not wholly green, and deployment has not been attempted.
