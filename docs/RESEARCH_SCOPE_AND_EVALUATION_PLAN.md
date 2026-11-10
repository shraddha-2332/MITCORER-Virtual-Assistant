# Mitra: evidence-backed paper scope and evaluation plan

Prepared 24 October 2026. This document supersedes unsupported experimental framing in the existing IEEE draft; it does not establish novelty or independent accuracy.

## Assessment

Mitra addresses access to maintained MITCORER admission and campus information across programme, year, route, category, gender and selected languages. Its implementation combines structured factual rendering with bounded retrieval, optional generation and source maintenance. The research question is descriptive: it characterizes supported-answer correctness, wrong-row behavior, and answerable-query coverage on the frozen corpus and independently authored questions. The study will report defined metrics, denominators, uncertainty, and representative failures, including null or negative outcomes. It will not claim broad superiority or generalization beyond the evaluated corpus and questions.

## Proposed paper scope

Working title: **Mitra: An Institutional Information Assistant with Maintained Facts and Controlled Generation**.

The current paper can describe system design, implementation, trust boundaries, maintenance workflow and automated regression validation. An empirical superiority paper requires new independently reviewed measurements. A narrow wrong-row verification study is a possible later contribution, not an established result.

### Goals and non-goals

The evaluation goal is to characterize the defined answer behaviors on the frozen corpus and independently labeled questions. It is descriptive: no minimum effect or pass threshold is claimed, and null or negative outcomes will be reported. The paper does not claim superiority over other systems or generalization beyond the evaluated corpus and questions.

### Alternatives considered

| Architecture | Trade-off and role in this project |
| --- | --- |
| FAQ and rules only | Provides deterministic answers for covered intents, but requires explicit rules and maintained responses for each supported pattern. Retain it for critical facts, not as the only answer path. |
| Retrieval and generation for every question | Handles varied wording, but increases exposure of exact fee and intake facts to generation errors and adds provider cost and failure modes. Keep generation bounded to selected evidence-backed advisory questions. |
| Structured lookup only | Supports precise answers for defined fact fields, but does not cover narrative policies and campus descriptions. Use it for structured facts alongside retrieval over published information. |
| Current hybrid | Combines deterministic critical facts, bounded retrieval, and optional generation. This is a risk-based design choice; whether it improves answer quality remains an empirical question. |

### Revised abstract foundation

Mitra is a web-based assistant for institution-specific admission and campus information at MITCORER Barshi. It combines maintained published records, deterministic rendering of selected structured facts, bounded multilingual query interpretation, source provenance, and optional evidence-conditioned generation. Selected generated factual tokens and slot values are checked before acceptance; these checks do not establish general semantic entailment.

Development tests exercise routing, persistence, maintenance authorization, localization, and failure behavior. Independent answer-quality, retrieval, multilingual, and latency measurements remain necessary. The proposed study uses newly authored questions to measure target-cell correctness, unsupported acceptance, refusal quality, retrieval performance, and generation cost.

### Claims and evidence boundaries

| Claim | Current defensible wording |
| --- | --- |
| Factual control | Selected critical fee/intake routes render maintained records deterministically |
| Generation checks | Selected numeric, promise and slot checks are implemented; full semantic entailment is not verified |
| Languages | Bounded English/Marathi/Hindi handling, native structured tables and reviewed translations with explicit fallback |
| Conversation | Heuristic profile/topic context; not unrestricted coreference or general dialogue understanding |
| Source freshness | Optional validity metadata and staged website-change review; no universal live factual synchronization |
| Evaluation | Automated developer regression checks, explicitly separate from independent research evaluation |
| Novelty | Candidate engineering contribution; requires a verified primary-source literature comparison |
| Deployment | Configuration exists; production deployment, load and recovery remain unverified |

The repository contains a generated 30/90-case development report. Its answers are scored by an automated deterministic harness; its inter-rater agreement values are simulated and are not human ratings. Treat these outputs only as development diagnostics, not as held-out results or independently reviewed accuracy. Do not present the draft's comparative figures as independent research results. No fresh independently authored final question set or human ratings have been collected. The 500 regression cases are not 500 independently collected helpdesk questions.

## Implementation corrections in this increment

- Initialize generation context before verification, fixing the reproduced successful-response crash.
- Keep recognized critical fee, intake and seat-matrix topics out of advisory generation routing.
- Remove independent hardcoded profile fee notes after maintained answer construction.
- Enrich the original fee follow-up rather than replacing its route/year/semester qualifiers.
- Retain a single explicit valid academic year in conversation context, while preserving explicit conflicting/invalid input for the scope parser.
- Forward explicit English exclusions unchanged rather than rewriting them from an older profile.
- Bound public conversation length to the same 200 messages used for authenticated history.
- Isolate conversation tests with in-memory databases.

These fixes do not resolve every context ambiguity, model failure or semantic claim. At the 24 October snapshot, public continuation used a supplied conversation ID without documented browser-session ownership. Current code binds continuation and reset to a cookie-derived session hash; `backend/test/public-session.test.js` covers cross-session rejection, expiry and reset during generation. These tests cover defined cases and are not a complete security audit.

## Planned experiment

1. Freeze the corpus, structured facts, provenance, source versions and code revision. Record source, corpus, case, model, runtime, and generation-parameter hashes/settings in the run manifest. Preserve official source snapshots and their validity dates for historical cases.
2. Obtain fresh independently authored questions from institutional/domain reviewers, with separate development and final sets. The proposed first final set is 90 new questions: 30 each in English, Marathi and Hindi; within each language, 18 answerable, six clarification-needed and six unsupported. This is a practical descriptive sample, not a power calculation. Include mixed-language cases within the primary-language allocation, label them separately, and report actual topic/language/answerability counts. Group translations and paraphrases in the same split. Do not reuse exposed cases as held-out material; keep synthetic adversarial probes in a separate verifier set.
3. Label answerability, expected evidence, required facts, forbidden claims, required clarification and exact target cells. Record reviewer disagreement and adjudication.
4. Adapt `backend/scripts/compare-retrieval.js` to the frozen corpus and independently labeled questions. Compare its named `keyword`, `keywordSlotAware`, `keywordExpandedSlotAware`, `keywordBm25Union`, `bm25Raw`, `bm25Normalized`, `bm25FieldedNormalized`, `hybridRrf` and `hybridFieldedRrf` methods. Freeze method source hashes, top-five outputs, BM25 parameters (`k1=1.2`, `b=0.75`), RRF constant (`k=60`), and reranking/candidate settings. The keyword method already includes conceptual synonym boosts; there is no separate conceptual-only baseline. Defer a generation comparison until provider, model/version, prompt, evidence limit, decoding parameters and retry policy are recorded and fixed.
5. Compare verifier configurations using paired supported and invalid drafts: no checks, `verifyGeneratedAnswer` only, `verifySlotGrounding` only, and both checks. Do not ablate critical deterministic rendering unless a safe, controlled study mode is specified. Keep verifier probes synthetic and separate from natural reviewer-authored questions. Keep retrieval-only metrics separate from end-to-end answer quality.
6. Evaluate fees across category, gender, route and year; accommodation across hostel/mess/deposit; intake across programme and year. Use frozen official source snapshots with explicit valid dates for natural retired/expired and changed-fact cases. If an historical source is unavailable, mark the question unsupported or use a versioned controlled mutation only in the synthetic verifier set. Include missing slots, negation, explicit topic changes and multi-turn DSE requests.
7. Construct wrong-row cases including answers with only a competing figure, both correct and incorrect figures, mislabeled amounts, and legitimate comparative tables. Define the positive class as an invalid answer that must be rejected. Report TP, FP, TN and FN; rejection recall is `TP/(TP+FN)`, false-alarm rate is `FP/(FP+TN)`, and false acceptance is an invalid answer accepted (`FN`).
8. Obtain competent-speaker judgments for regional-language answers. Native digit preservation is not a fluency score.

### Metrics to report only after measurement

- Retrieval Recall@K/MRR at K=1, 3 and 5 with relevance unit and aggregation specified. Use document-level metrics only with complete corpus judgments; label incomplete evidence-group measures as group proxies.
- Answer correctness/completeness and exact target-cell accuracy with explicit denominators.
- Correct answerable-query coverage: the fraction of independently labeled answerable questions receiving a correct, evidence-supported answer.
- Wrong-row detection, false acceptance (`FN`), false alarms (`FP`), and missing-slot behavior with denominators.
- False refusals among answerable questions, false answers among unsupported questions, and appropriate clarification among ambiguous questions; use the answerability labels and rating rubric in `docs/INDEPENDENT_EVALUATION_PACKET.md`.
- Multi-turn slot retention and scope correctness, including topic changes.
- Language correctness and source/citation support.
- End-to-end p50/p95 latency, failure rates, actual model calls, token usage and cost.

Report dataset provenance, exposure, reviewer counts, model settings, repeated-run variability and representative failures. Local regression pass rates must not be relabeled as overall answer accuracy.

### Evaluation tooling and bounded-agent implementation status

Offline RAGAS and LLM-judge runners, labeled development guardrail diagnostics, request trace correlation with provider token counts when returned, and a feature-flagged two-search document navigator with a paired baseline comparison runner have been added. The project lead selected the published reviewed database records and public website index as the corpus, and approved external processing for a sanitized pilot of at most 12 cases. The corpus snapshot is frozen. An assistant-authored 90-case development set and isolated local diagnostic now exist; they are explicitly non-independent and are documented in the [reviewer handoff](EVALUATION_REVIEWER_HANDOFF.md). They do not satisfy the independent evaluation plan. The 12-case judge attempt produced no usable response; the RAGAS environment did not complete installation. No external score, faithfulness score, judge calibration or independent human result is claimed. The external runners enforce the 12-case limit. See [AI evaluation and LLMOps workflow](AI_EVALUATION_AND_LLMOPS.md).

#### Evaluation design

- Keep the independent question set and adjudicated evidence labels defined above as the evaluation source of truth. Score exact programme, year, route, category, amount, intake and choice-code claims with deterministic checks wherever possible.
- Run RAGAS metrics offline on frozen question, answer, retrieved-context and reference records: faithfulness, answer relevancy, context precision and context recall. Context recall requires a reference or annotated relevant evidence; record the exact metric implementation, judge model, prompt, retries and configuration used for each run. Do not interpret one aggregate RAGAS score as institutional answer accuracy.
- The offline judge implements a claim-level rubric for supported, contradicted and not-established claims, plus citation mismatch, missing required fact and unnecessary refusal issues. It requires structured output with claim spans and evidence IDs. Judge calibration on a blinded, human-adjudicated sample remains pending; human adjudication remains authoritative.
- Report judge false acceptance and false rejection against human labels, broken down by English, Marathi, Hindi, mixed-language, structured-fact and unsupported-question subsets. A judge score must not publish knowledge, change records, or override deterministic verification.

#### LLMOps and observability

- Keep evaluation execution separate from public request handling. Version and hash the corpus snapshot, code revision, prompts, provider/model identifiers, decoding settings, guardrail thresholds and evaluation dataset for every run.
- Privacy-minimized request traces now use a generated trace ID to correlate pipeline, provider-attempt and draft-validation events. They include selected evidence IDs and latency without question/answer text. Source revision IDs, per-stage retrieval timing, provider token usage and cost are not yet captured and must not be reported as measured.
- Define safe degradation: a timeout, provider error, invalid draft, failed grounding check or unavailable source falls back to a grounded deterministic answer or a clear abstention. Monitor error/timeout rate, verifier rejection rate, unsupported-answer acceptance from reviewed samples, citation failures, latency and cost. Missing provider usage data must be recorded as unavailable, not estimated as measured usage.

#### Guardrails to evaluate

Retain deterministic rendering for critical maintained facts. The synthetic development suite now includes 20 ingress prompts, four retrieved-content prompt-boundary probes and ten seeded answer-pipeline cases covering stale-source withholding, conflicting structured sources, ambiguous scope, live vacancy/availability, document-specific clarification, a private-record non-echo check and a valid multi-value comparison. The retrieved-content probes verify JSON data serialization and presence of the untrusted-evidence policy; they do not establish semantic resistance by an LLM. This remains a development smoke set, not a complete adversarial benchmark. Report false acceptance and false rejection with explicit denominators; pattern checks alone do not establish semantic faithfulness.

#### Small agentic feature: Evidence Gap Navigator

The implemented navigator is a bounded, read-only planner for document-specific questions such as finding a CSE academic-calendar PDF for a named year and semester. It calls only the indexed-document search, makes at most two searches (the original question and a focused rewrite), asks one clarification when a calendar year or syllabus programme is missing, and returns matches through the existing document response builder. It does not search arbitrary knowledge records, use an LLM, write to the database, contact staff, submit forms, decide eligibility/admission, infer live vacancies, or treat retrieved text as instructions. The `EVIDENCE_GAP_NAVIGATOR_ENABLED` flag is false by default. A paired baseline comparison runner records input/index/code hashes, exact title/branch/year/term match, wrong-scope hits, clarification/abstention, latency and tool-call counts. Human review of expected titles and citations is still required before enabling the feature. Its value is the constrained multi-step retrieval workflow for real document-search failures, not the label “agentic AI.”

RAGAS metric definitions: [official metric catalogue](https://docs.ragas.io/en/latest/concepts/metrics/available_metrics/). Original framework paper: [RAGAS: Automated Evaluation of Retrieval Augmented Generation](https://aclanthology.org/2024.eacl-demo.16/). The offline runner uses the RAGAS 0.4.3 API and remains isolated from the backend runtime.

## Verification for this increment

Historical snapshot dated 24 October 2026: backend tests **155/155 passed**; backend syntax check passed; legacy development evaluator **500/500 passed**; strict public diagnostics **36/36 passed**; `git diff --check` passed. Current implementation validation on 10 November 2026: backend tests **248/248 passed**; backend syntax check passed; the expanded guardrail suite passed all expected checks—20 ingress cases (TP=10, FP=0, TN=10, FN=0), four retrieved-context boundary checks and ten seeded pipeline behavior cases; document-agent comparison unit tests passed; `git diff --check` passed. These are synthetic development probes and do not establish broad security or quality. The assistant-authored local diagnostic has 54/90 expected decision-label matches; this is not an accuracy or faithfulness score. The external judge produced no usable result, RAGAS did not complete, and an adjudicated document-agent comparison still awaits independent labels. No judge calibration, independent language quality, production deployment or load result is claimed. A local two-case smoke comparison is only a harness check, not a ranking result. The existing Word manuscript was not regenerated and remains an unverified prior draft.

## Next step

Use the corrected implementation and regression report as the system-description baseline. Extend the focused primary-source audit into a broader novelty and prior-art comparison, and complete independent question and label collection before writing comparative results. Until then, prepare a design-and-implementation manuscript with a clearly marked evaluation plan.

Follow-up materials: [verified literature and corrections](LITERATURE_VERIFICATION.md), [design-and-implementation manuscript](MITRA_RESEARCH_MANUSCRIPT.md), and [independent evaluation packet](INDEPENDENT_EVALUATION_PACKET.md). Focused literature verification and a blank review schema are complete; independent collection and judgments remain pending. The older IEEE draft and its Word rendering are not validated by these materials.
