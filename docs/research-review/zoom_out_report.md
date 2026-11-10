# EGM Stage 5: Initial Zoom Out Review

**Target:** `docs/RESEARCH_SCOPE_AND_EVALUATION_PLAN.md` (whole file)
**Review mode:** Feature design and evaluation plan

## Reviewer Status

| Reviewer | Status |
| --- | --- |
| EGM Zoom Out | Completed; read persona, standard, target, and README; checked relevant backend code |
| EGM Inventive Catalyst | Completed; read persona, target, and README |

## Prioritized Findings

### Public session isolation statement is stale — Major

**Affected scope:** “Implementation corrections in this increment”

The target says public continuation still relies on a supplied conversation ID and requires a separate session-isolation review. The current README and backend code describe a 256-bit HttpOnly, SameSite=Strict cookie binding public conversations to browser sessions, with a session-hash check for continuation and reset. The statement no longer matches the implementation. Update it to describe the current control and cite the session-isolation tests, or label it clearly as a historical snapshot.

### Evaluation evidence is not pinned to a revision — Major

**Affected scope:** “Implementation corrections in this increment” and “Verification for this increment”

The document is dated 24 October and reports 155/155 backend tests, 500/500 evaluator cases, and 36/36 diagnostics, while other project documentation describes later changes. Readers cannot tell which revision those results validate or whether the summary describes the current implementation. Pin these claims to the code revision and date they came from, and reconcile the implementation summary with current code before using it as the manuscript baseline. Do not imply that the reported results were rerun on a newer revision.

### Reuse existing retrieval implementations in the experiment — Nit

**Affected scope:** “Planned experiment,” items 4–5

The repository already includes BM25, hybrid candidate retrieval, and slot-aware reranking in `backend/src/bm25.js` and `backend/src/rag-enhancer.js`. Clarify that the experiment will compare and freeze the existing implementations where applicable, rather than suggesting those components still need to be built.

## Inventive Catalyst

No false compromise detected. The plan describes deterministic rendering for critical facts and bounded optional generation as an intentional trust boundary. It discloses current limitations and proposes measurements for the unresolved trade-offs; no additional architectural pattern is justified by this document.

## Overall Assessment

The objective and research scope are understandable, and the plan distinguishes developer regression checks from independent answer-quality evaluation. Resolve the two major documentation inconsistencies before using this plan as a current manuscript baseline.

## Stage 5 Re-audit — 10 November 2026

The current on-disk target still contains the findings below. No revisions to `docs/RESEARCH_SCOPE_AND_EVALUATION_PLAN.md` were present during this re-audit.

### Public session isolation statement remains stale — Major

**Affected scope:** “Implementation corrections in this increment”

The plan still says public continuation requires a separate session-isolation review. Current backend code binds a conversation to a browser-session hash, rejects cross-session continuation and reset, and checks ownership after generation; `backend/test/public-session.test.js` covers these behaviors. Update the plan to describe the implemented control and any remaining limitations.

### Verification results need a code revision — Major

**Affected scope:** “Verification for this increment”

The 155/155, 500/500, and 36/36 results are dated 24 October 2026, but are not tied to a code revision. The plan also describes changes from that increment, while the repository documents later work. Keep the date and results as a historical snapshot and identify the revision they verify; do not present them as current results without a rerun.

### Linked manuscript conflicts with the stated evidence boundary — Major

**Affected scope:** Target “Claims and evidence boundaries” and “Verification for this increment”; linked `docs/MITRA_RESEARCH_MANUSCRIPT.md`, Sections 7 and 8

The target says the existing comparative results are unsupported and must not be retained, and that independent answer-quality measurement remains necessary. The linked manuscript currently reports 90-case benchmark accuracy, language-specific scores, external human raters, significance tests, and fee accuracy as measured results. Reconcile the manuscript with the evidence boundary and the independent-evaluation packet before treating either document as the current research account. The packet says independent questions, approvals, and final results have not been collected.

### Reuse existing evaluation tooling — Nit

**Affected scope:** “Planned experiment,” items 4–5

The repository already has retrieval comparisons, metric helpers, public-answer evaluation, and verifier evaluation. Adapt these tools for the frozen corpus and independently authored questions, adding only measures they do not support. This can avoid a parallel evaluation pipeline while keeping the new data and labels distinct from exposed development cases.

## Re-audit Reviewer Status

| Reviewer | Status |
| --- | --- |
| EGM Zoom Out | Completed; read the target, standard, README, and all three linked research documents; inspected relevant session and evaluation code |
| EGM Inventive Catalyst | Completed; read the target, README, and all three linked research documents; found no architectural contradiction requiring a pattern |
