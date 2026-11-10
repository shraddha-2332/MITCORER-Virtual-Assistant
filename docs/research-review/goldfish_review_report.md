# Goldfish Annotated Review Report

**Status:** Resolved — Stage 7: 4 fixes accepted; Stage 9: 8 fixes accepted; 0 contested, 0 escalated, 0 declined.

**Target:** `docs/RESEARCH_SCOPE_AND_EVALUATION_PLAN.md` (full file; Stage 7 findings)

## Prioritized Findings & AI Suggestions

### Study goals and result criteria are not explicit [EGM Design Critic / EGM Style] — Major

* **Affected scope:** `docs/RESEARCH_SCOPE_AND_EVALUATION_PLAN.md:7` and “Proposed paper scope”
* **Discrepancy description:** The research question asks whether the approach reduces unsupported or wrong-row answers while maintaining useful query coverage, but it defines neither the coverage measure nor how positive, null, or negative results will be interpreted.
* **Rationale:** A reader cannot tell what outcome would answer the question or whether the paper intends to claim a measured improvement.
* ***AI Suggestion:*** PROPOSE FIX
* ***Justification:*** The gap is valid. The plan should define a descriptive goal, metrics, and limits on claims without inventing a success threshold or results.
* ***Proposed Edit:***
  * **Location:** Replace the final sentence of “Assessment” and add a short “Goals and non-goals” subsection under “Proposed paper scope.”
  * **Change:** Use: “The study will characterize supported-answer correctness, wrong-row behavior, and answerable-query coverage on the frozen corpus and independently authored questions. It will report defined metrics, denominators, uncertainty, and representative failures, including null or negative outcomes. It will not claim broad superiority or generalization beyond the evaluated corpus and questions.” Add this metric under “Metrics to report only after measurement”: “Correct answerable-query coverage: the fraction of independently labeled answerable questions receiving a correct, evidence-supported answer.”

### Viable architecture alternatives are not evaluated [EGM Design Critic / EGM Structural] — Major

* **Affected scope:** “Proposed paper scope” and “Planned experiment”
* **Discrepancy description:** The experiment names retrieval and generation baselines but does not compare viable architecture alternatives or explain their trade-offs.
* **Rationale:** Experimental baselines do not document why the current combination of deterministic facts, retrieval, and optional generation was selected over other system designs.
* ***AI Suggestion:*** PROPOSE FIX
* ***Justification:*** The alternatives requirement applies to this design-and-evaluation plan. A compact table can describe known trade-offs without claiming experimental superiority.
* ***Proposed Edit:***
  * **Location:** Add “### Alternatives considered” under “Proposed paper scope,” before “Revised abstract foundation.”
  * **Change:** Add a table with these alternatives and reasons: (1) FAQ/rules-only: strongest control for known facts, but limited to explicitly maintained rules and answer patterns; retain for critical structured facts, not as the only path. (2) Retrieval plus generation for every question: flexible wording, but exposes exact fees/intake answers to generation errors and expands dependence on a provider; keep generation bounded to selected evidence-backed advisory questions. (3) Structured lookup only: precise for tabular facts, but does not cover published narrative policies and campus descriptions; use for exact structured facts alongside retrieval. (4) Current hybrid: separates deterministic critical facts from bounded retrieval and optional generation; describe this as a risk-based design choice, not a proven accuracy improvement.

### Literature verification status is ambiguous [EGM Design Critic / EGM Style] — Nit

* **Affected scope:** “Next step” and final follow-up-materials sentence
* **Discrepancy description:** The next step says primary-source literature verification remains to be completed, while the final sentence says focused literature verification is complete.
* **Rationale:** The linked literature audit reports a completed focused subset and an unverified exhaustive novelty search; the target should distinguish those scopes.
* ***AI Suggestion:*** PROPOSE FIX
* ***Justification:*** The status can be stated consistently without changing the evidence boundary.
* ***Proposed Edit:***
  * **Location:** Replace the second sentence of “Next step.”
  * **Change:** Use: “Extend the focused primary-source audit into a broader novelty and prior-art comparison, and complete independent question and label collection before writing comparative results.”

### Abstract foundation is overloaded [EGM Style] — Nit

* **Affected scope:** “Revised abstract foundation”
* **Discrepancy description:** One paragraph combines the system description, development checks, limitations, and proposed evaluation.
* **Rationale:** The reader must follow several different claims in one long paragraph; separating system design from evidence and evaluation makes the scope easier to assess.
* ***AI Suggestion:*** PROPOSE FIX
* ***Justification:*** A concise reorganization preserves the calibrated claims and makes the evidence boundary clearer.
* ***Proposed Edit:***
  * **Location:** Replace the “Revised abstract foundation” paragraph.
  * **Change:** Use two paragraphs: “Mitra is a web-based assistant for institution-specific admission and campus information at MITCORER Barshi. It combines maintained published records, deterministic rendering of selected structured facts, bounded multilingual query interpretation, source provenance, and optional evidence-conditioned generation. Selected generated factual tokens and slot values are checked before acceptance; these checks do not establish general semantic entailment.” Then: “Development tests exercise routing, persistence, maintenance authorization, localization, and failure behavior. Independent answer-quality, retrieval, multilingual, and latency measurements remain necessary. The proposed study uses newly authored questions to measure target-cell correctness, unsupported acceptance, refusal quality, retrieval performance, and generation cost.”

## Structural Status

The structural reviewer found no heading hierarchy, Markdown formatting, or relative-link defects. No changes are proposed for those areas.

## Stage 9 Resolution Proposals

**Target:** Research execution scope in `docs/RESEARCH_SCOPE_AND_EVALUATION_PLAN.md`, plus the linked evaluation and session documentation where noted.

### Automated pilot is presented as independent human evaluation [EGM Codebase Details / Stage 8 Zoom Out] — Major

* **Affected scope:** `backend/scripts/run-pilot-evaluation.mjs:260–328`; `deliverables/evaluation-record-kit/pilot-evaluation-report.json`; `deliverables/evaluation-record-kit/README.md`; `docs/MITRA_RESEARCH_MANUSCRIPT.md` Sections I, V–VIII and Data Availability; `docs/INDEPENDENT_EVALUATION_PACKET.md`
* **Discrepancy description:** The manuscript reports external human ratings and Cohen's kappa for the 90-case run. The checked-in runner answers cases and scores them with deterministic rules; its inter-rater section explicitly simulates reviewers, sets agreement to 100%, and hard-codes kappa to 0.96. The generated JSON contains these values, while the evaluation packet says independent questions and ratings have not been collected. The record-kit README calls the kit blank even though its case file and report contain populated pilot material.
* **Rationale:** The current script output cannot establish human review, reviewer independence, or inter-rater agreement. The manuscript's claims and the kit's description need to match the recorded process.
* ***AI Suggestion:*** PROPOSE FIX
* ***Justification:*** This is grounded in the source runner and generated report. Keep any independently collected human results only if separate original ratings, reviewer roles, and adjudication records can be tied to the cases.
* ***Proposed Edit:***
  * **Location:** Remove the simulated agreement block in `backend/scripts/run-pilot-evaluation.mjs`; update its generated output and the record-kit README; revise the manuscript's 90-case descriptions and outcome claims.
  * **Change:** Stop emitting `percentAgreement` and `cohensKappa` unless computed from actual independent ratings. Label the present 30/90 case outputs as automated developer diagnostics and describe the scoring as rule-based. Remove claims that those outputs were externally rated, independently reviewed, or constitute held-out results; remove the kappa and significance claims tied to those ratings. Update the kit README to identify its populated development cases/report and its lack of completed independent rating records. If independent records exist separately, cite and preserve those as a distinct dataset rather than attributing them to the generated report.

### Public session-isolation note is outdated [EGM Zoom Out] — Major

* **Affected scope:** `docs/RESEARCH_SCOPE_AND_EVALUATION_PLAN.md`, “Implementation corrections in this increment”
* **Discrepancy description:** The target says public continuation still relies on the supplied conversation ID and requires a separate session-isolation review. Current code checks cookie-derived session ownership for continuation and reset, and the tests cover cross-session rejection, expiry, and reset during generation.
* **Rationale:** The target presents an already-implemented control as an open security gap.
* ***AI Suggestion:*** PROPOSE FIX
* ***Justification:*** The current source is directly checkable in `backend/src/conversations.js`, `backend/src/public-session.js`, and `backend/test/public-session.test.js`.
* ***Proposed Edit:***
  * **Location:** Replace the final sentence of “Implementation corrections in this increment.”
  * **Change:** State that the 24 October snapshot did not yet document browser-session ownership, while current code binds conversation continuation/reset to a cookie-derived session hash and tests cross-session rejection, expiry, and reset during generation. State that these tests cover specified cases and are not a complete security audit.

### Verification counts are not pinned to their source revision [EGM Zoom Out] — Major

* **Affected scope:** `docs/RESEARCH_SCOPE_AND_EVALUATION_PLAN.md`, “Verification for this increment”
* **Discrepancy description:** The 24 October test and evaluator counts have a date but no source commit or file hashes, so readers cannot identify the exact code those counts validate.
* **Rationale:** Later project changes mean these historical values cannot be read as current verification.
* ***AI Suggestion:*** PROPOSE FIX
* ***Justification:*** The available repository history does not establish a precise test-source revision for these counts; inventing one would overstate the evidence.
* ***Proposed Edit:***
  * **Location:** Replace the opening sentence of “Verification for this increment.”
  * **Change:** Label all counts as a historical 24 October snapshot, state that this document does not record the exact source revision for that run, and explicitly say they are not current results. Record commit and source hashes for future runs.

### Retrieval and generation baselines are underspecified [EGM Implementation Readiness / Codebase Details / Style] — Major

* **Affected scope:** “Planned experiment,” step 4
* **Discrepancy description:** The plan names “keyword/rules,” “conceptual/hybrid retrieval,” and a “controlled document-generation baseline” without defining exact variants or generation settings. The current code has no independent conceptual-only retriever.
* **Rationale:** Different executors could select different methods and produce incomparable outcomes. The existing `backend/scripts/compare-retrieval.js` already exposes named retrieval variants, including keyword, slot-aware reranking, BM25, candidate expansion, and RRF.
* ***AI Suggestion:*** PROPOSE FIX
* ***Justification:*** Existing implementation and settings can be frozen and adapted; do not claim a conceptual-only method that the code does not contain.
* ***Proposed Edit:***
  * **Location:** Replace step 4.
  * **Change:** Name the selected retrieval variants from `compare-retrieval.js`, freeze the source/configuration hashes, top-K and metric definitions, and adapt the script to the independently labeled corpus/questions. Treat the current keyword baseline as already including conceptual synonym boosts. Before any generation comparison, record provider, model/version, prompt, evidence limit, decoding settings, retries, and model availability; defer that comparison if these cannot be frozen.

### Ablation and wrong-row scoring matrix is missing [EGM Implementation Readiness] — Major

* **Affected scope:** “Planned experiment,” steps 5 and 7
* **Discrepancy description:** The plan does not name the checks to disable, the combinations to compare, the valid controls, or the positive class and denominators for wrong-row outcomes.
* **Rationale:** “Ablate deterministic rendering” is not supported by a documented study toggle, and the existing verifier diagnostics use paired invalid/valid cases with explicit rejection metrics.
* ***AI Suggestion:*** PROPOSE FIX
* ***Justification:*** A bounded verifier-only comparison can reuse `verifyGeneratedAnswer`, `verifySlotGrounding`, and `backend/evaluation/verifier-diagnostics.js`; a deterministic-rendering ablation should be deferred until a controlled study mode is designed.
* ***Proposed Edit:***
  * **Location:** Replace step 5 and refine step 7.
  * **Change:** Predefine full, token-check-only, slot-check-only, both-checks, and no-check configurations on paired invalid drafts and valid controls. Label the positive class as an invalid answer that must be rejected; report TP, FP, TN, FN, rejection recall `TP/(TP+FN)`, and false-alarm rate `FP/(FP+TN)`. Defer deterministic-rendering ablation unless a safe, controlled toggle is specified. Keep synthetic verifier probes separate from natural reviewer-authored questions.

### Sample allocation is left open [EGM Implementation Readiness] — Major

* **Affected scope:** “Planned experiment,” steps 2, 3, and 6
* **Discrepancy description:** The plan does not set question counts or allocation by language, topic, answerability, and natural versus synthetic case type.
* **Rationale:** The linked strengthening review already proposes a practical first study of 90 new cases: 30 per language, with 18 answerable, six clarification-needed, and six unsupported cases per language. It cautions that this is not a power calculation.
* ***AI Suggestion:*** PROPOSE FIX
* ***Justification:*** Adopt the existing proposed sample as a concrete initial plan while retaining the packet's limits and reporting actual cell counts.
* ***Proposed Edit:***
  * **Location:** Add a sample-allocation paragraph under “Planned experiment,” after step 2.
  * **Change:** Adopt 90 new questions as the proposed first study (30 each in English, Marathi, and Hindi; per language, 18 answerable, six clarification-needed, six unsupported). Specify whether mixed-language questions are included in these counts, group translations and paraphrases into the same split, and report sparse cells descriptively. Keep synthetic adversarial probes in a separate verifier set.

### Historical and changed-fact cases lack a source rule [EGM Codebase Details] — Major

* **Affected scope:** “Planned experiment,” steps 1 and 6
* **Discrepancy description:** Retired/expired facts and changed-fact cases are required, but the plan does not identify their source or inclusion rule.
* **Rationale:** Current retrieval comparisons use published seeded records; provenance metadata can expire facts, but the study needs an explicit, frozen source for any historical claim.
* ***AI Suggestion:*** PROPOSE FIX
* ***Justification:*** The plan can use only documented source snapshots and clearly labeled controlled mutations, avoiding invented historical facts.
* ***Proposed Edit:***
  * **Location:** Add a source rule to step 1 and qualify step 6.
  * **Change:** Use frozen official snapshots with source dates for natural historical/expired cases. If a historical source is unavailable, use a versioned controlled mutation only in the separate synthetic verifier set, or mark the query unsupported. Do not mix synthetic mutations with reviewer-authored natural cases.

### Metric, logging, and scoring protocol is not declared normative [EGM Implementation Readiness / Style] — Major

* **Affected scope:** “Planned experiment,” steps 1–8; “Metrics to report only after measurement”
* **Discrepancy description:** The linked evaluation packet defines source hashes, labels, blinding, adjudication, subsets, and runtime capture, but the plan does not make that packet the required protocol. K values, relevance unit, aggregation, and some quality measures remain unspecified.
* **Rationale:** The repository metric helper reports evidence-group proxies, not document-level exhaustive Recall or MRR. The target's terms “false rejection,” “false alarms,” and “quality” need operational definitions.
* ***AI Suggestion:*** PROPOSE FIX
* ***Justification:*** The packet is already designed to hold these procedures; the plan should incorporate it and name remaining decisions before data collection.
* ***Proposed Edit:***
  * **Location:** Add a protocol requirement to the beginning of “Planned experiment” and clarify the metric bullets.
  * **Change:** Make `docs/INDEPENDENT_EVALUATION_PACKET.md` the required protocol for source/corpus/code hashes, model settings, case schema, relevance and answerability labels, reviewer/adjudication process, exposure ledger, blinding, raw response capture, and cold/warm timing. Before collection, set K values (proposed 1, 3, and 5), define document-level versus evidence-group relevance and aggregation, and use group metrics only when labels are incomplete, explicitly naming them as proxies. Define answerable false refusal, unsupported false answer, ambiguity clarification, wrong-row acceptance, and verifier false alarm with denominators. Use the packet's rubric for generated claims and language ratings.

## Stage 9 Reviewer Status

Implementation Readiness, Codebase Details, and Style completed. The full findings and cross-stage issues are in `docs/research-review/implementation_readiness_report.md`.
