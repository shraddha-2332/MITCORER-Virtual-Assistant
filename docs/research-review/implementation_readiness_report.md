# EGM Stage 9: Implementation Readiness Review

**Target:** `docs/RESEARCH_SCOPE_AND_EVALUATION_PLAN.md`
**Scope:** “Planned experiment” and “Metrics to report only after measurement” (research execution readiness; the target has no separate software implementation plan)

## Reviewer Status

| Reviewer | Status |
| --- | --- |
| EGM Implementation Readiness | Completed; read persona, standard, target, context, and Stage 8 report |
| EGM Codebase Details | Completed; read persona, standard, target, context, and Stage 8 report; inspected retrieval/evaluation code and templates |
| EGM Style | Completed; read persona, target, context, and Stage 8 report |

## Prioritized Findings

### Comparison methods are not reproducible — Major

**Reviewer lens:** Implementation Readiness, Codebase Details, Style
**Affected scope:** “Planned experiment,” steps 4–5

The plan names keyword/rules, raw and normalized BM25, conceptual/hybrid retrieval, and a controlled document-generation baseline, but does not identify exact methods, parameters, candidate depth, reranking, or generation model/version, prompt, evidence limit, and decoding settings. This leaves the central comparison choices to whoever executes the study. The repository has an existing retrieval comparison script for keyword, slot-aware variants, BM25 variants, candidate expansion, and reciprocal-rank fusion; it does not establish a separate conceptual retriever. Select and freeze the implementations to compare, adapt existing tooling where appropriate, and define or exclude the generation baseline.

### Ablation and wrong-row protocol is incomplete — Major

**Reviewer lens:** Implementation Readiness
**Affected scope:** “Planned experiment,” steps 5 and 7

The plan does not specify which deterministic-rendering and verification checks are ablated, how the ablation configurations are paired, or how each wrong-row probe is labeled and scored. Predefine named system configurations, error-positive cases and valid controls, the unit of analysis, and the metrics and denominators for false acceptance and rejection. The evaluation packet provides a paired verifier format and TP/FP/TN/FN guidance, but the study's actual variants and their mapping to the ablation remain open.

### Question-set allocation is not fixed — Major

**Reviewer lens:** Implementation Readiness
**Affected scope:** “Planned experiment,” steps 2–3 and 6

The plan requires fresh development and final sets, but does not specify feasible minimum counts or allocation across language, topic, answerability, scope, and natural versus synthetic cases. The evaluation packet calls for balanced coverage and actual count reporting, but leaves the sampling plan to be agreed. Set and justify the sampling table before collection, or state how sparse cells will be reported without broad claims.

### Historical and changed-fact cases lack a source rule — Major

**Reviewer lens:** Codebase Details
**Affected scope:** “Planned experiment,” steps 1 and 6

The plan includes retired/expired records and changed facts without saying whether they come from a frozen historical source snapshot, controlled mutations, or another source. The current retrieval comparison uses published seeded knowledge, while provenance code filters by validity metadata. Define the source and inclusion rule, and keep synthetic mutation probes separate from natural reviewer-authored questions.

### Metric and run conventions need an explicit protocol — Major

**Reviewer lens:** Implementation Readiness, Codebase Details, Style
**Affected scope:** “Planned experiment,” steps 1–8; “Metrics to report only after measurement”

The linked evaluation packet already covers corpus and code hashes, adjudication, claim support labels, refusal subsets, paired verifier probes, latency conditions, and exposure tracking. The plan does not state that this packet is the normative execution protocol, and important choices remain open, including retrieval K values, document versus evidence-group relevance units, aggregation, sample counts, correctness rubric, and run conditions. Point to the packet as the protocol, record unresolved choices before collection, and use the repository's existing metric helpers only within their documented limits; current Recall@K/MRR helpers use group-level evidence proxies.

### Existing evaluation assets should be explicitly reused — Nit

**Reviewer lens:** Codebase Details
**Affected scope:** “Planned experiment,” steps 3, 5, and 7; metrics subsection

The repository includes retrieval comparison code, retrieval metrics, verifier diagnostics, and a case template. State which assets will be reused or adapted for the independently labeled study, and preserve the distinction between synthetic developer probes and final study cases.

### Error terminology and quality ratings need definitions — Nit

**Reviewer lens:** Style
**Affected scope:** “Planned experiment,” step 7; “Metrics to report only after measurement,” items 4–5

The plan uses “false rejection” and “false alarms” without defining the positive class, and names refusal/clarification quality without its scoring rubric. Use one confusion-matrix convention with explicit denominators and identify the packet's answerability subsets or rating rubric.

## Cross-Stage Findings Still Open

These earlier Stage 8 findings remain relevant even though they fall outside the Stage 9 experiment-plan scope:

- **Major:** The linked manuscript reports a 90-case benchmark, accuracy, statistical tests, and fee results that conflict with the target's evidence boundary and the evaluation packet's preparation-only status. Reconcile these claims against source records before using the manuscript as a research account.
- **Major:** The target says public continuation still requires a separate session-isolation review, although current code and tests implement and check browser-session ownership. Update the historical statement or describe a verified remaining limitation.
- **Major:** The 24 October verification counts are dated but not pinned to a code revision or source hash. Keep them explicitly historical and identify the revision they validate.

## Overall Assessment

The experiment has a sensible high-level sequence, but it is not yet ready for reproducible execution. Baseline selection, ablations, sample allocation, data sources for historical cases, and remaining scoring conventions must be fixed in the protocol before collecting final questions or reporting comparative results.
