# EGM Stage 8: Intermediate Zoom Out Review

**Target:** `docs/RESEARCH_SCOPE_AND_EVALUATION_PLAN.md` (whole file)

## Reviewer Status

| Reviewer | Status |
| --- | --- |
| EGM Zoom Out | Completed; read target, zoom-out standard, all prior stage reports, README, and linked research materials; inspected relevant session and retrieval code |

## Prior Stage Findings

Stage 7's four findings are materially addressed: the plan now defines descriptive goals and outcome limits, compares architecture alternatives, clarifies the literature-review status, and separates the abstract's system description from its evidence and evaluation statements.

Stage 6's undefined comparison types are only partly addressed. The goal and metrics are clearer, but the planned experiment still does not define the retrieval methods and document-generation baseline it will compare.

## Prioritized Findings

### Linked manuscript reports results outside the evidence boundary — Major

**Affected scope:** Target “Claims and evidence boundaries” and “Verification for this increment”; linked `docs/MITRA_RESEARCH_MANUSCRIPT.md`, Sections V–VIII

The target says earlier comparative claims lack a reproducible independent experiment and directs authors not to retain those results. The linked manuscript still reports a 90-case externally rated benchmark, 86.7% Run 3 correctness, kappa=.96, significance tests, and 100% fee accuracy. The independent evaluation packet says independent questions, reviewer approvals, and final results have not been collected. Reconcile the manuscript with the evidence boundary and actual records before treating either document as the current research account.

### Public session-isolation statement is stale — Major

**Affected scope:** Target “Implementation corrections in this increment”

The target still says public continuation relies on a supplied conversation ID and requires a separate session-isolation review. Current backend code binds continuation and reset to a browser-session hash; tests cover cross-session rejection, valid continuation/reset, expiry, and reset during generation. Update the statement to describe the implemented controls and any verified remaining limitation.

### Verification results are not pinned to a code revision — Major

**Affected scope:** Target “Verification for this increment”

The 155/155, 500/500, and 36/36 results are dated 24 October 2026 but lack a code revision or source hash. The repository documents later work, and the current plan has changed. Keep these as a historical snapshot and identify the revision they validate; do not present them as current results without a rerun.

### Comparison methods and reuse are underspecified — Nit

**Affected scope:** Target “Planned experiment,” step 4, and steps 5 and “Metrics to report only after measurement”

“Conceptual/hybrid retrieval” and “controlled document-generation baseline” remain undefined. The repository already has a retrieval comparison script and metric helpers for keyword/rule/concept retrieval, BM25 variants, hybrid candidate expansion, and reciprocal-rank fusion. Define which existing methods will be frozen or adapted for the experiment, and specify the generation baseline before running it. Avoid implying a distinct “conceptual” method unless one is defined.

## Overall Assessment

The Stage 7 changes improved the study's scope and organization. The linked manuscript's unsupported result claims and the stale session and verification statements remain material trust-boundary issues. Resolve those before treating the research materials as a coherent manuscript baseline.
