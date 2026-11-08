# Mitra Backend Pipeline Review and Improvement Plan

This document describes the current public question-answering path and the recommended work in implementation order. It is based on the repository code, not a live deployment review. The two existing local edits in `backend/src/conversations.js` and `backend/src/question-plan.js` were present before this review and are not included here.

## Current pipeline: stages 1–8

| # | Stage | What the backend currently uses | Main limitation |
|---|---|---|---|
| 1 | Request and safety | `POST /api/public-assistant/ask` validates a non-empty question up to 1,000 characters. `safety-guard.js` checks selected unsafe prompt patterns. | Pattern checks are bounded; they do not establish that all user or source-injection attempts are safe. The normal HTTP log records request ID, route, status, and duration, but not the internal answer path. |
| 2 | Language and normalization | `language.js` selects English, Marathi, or Hindi; `normalizeLocalTerms()` and `query-understanding.js` apply Unicode/digit normalization, selected Devanagari and Romanized mappings, aliases, plural handling, and a small typo vocabulary. | Rules are hand-maintained and incomplete. Normalization is lossy in places and is not equivalent to translating or understanding arbitrary language. |
| 3 | Intent, entities, and context | `understandQuery()` extracts selected topics, branches, admission routes, years, categories, gender, services, and negation. `queryClarification()` detects some ambiguous fees/programme queries. `conversations.js` carries selected context into some short follow-ups. | Parsing is regex/rule based. The public path uses a long chain of builders; `routeQuery()` is not the single authoritative router. Context resolution is heuristic and can inherit the wrong detail. |
| 4 | Retrieval | `retrieveKnowledge()` scans usable published records, applies weighted title/category/body keyword matches, tags, concepts, record-ID/topic bonuses, and optional embedding scores. `slotAwareRerank()` adds year/route/branch/category bonuses. It returns at most three records. | Scores are heuristics, not calibrated confidence or proof of support. Hard-coded IDs/bonuses and substring matching are brittle. BM25 is an offline comparison, not the production retriever. Embeddings are optional and currently only boost candidates. |
| 5 | Answer selection and composition | `answerAdmissionQuestion()` tries clarification, compound/contextual passages, direct answer builders, maintained structured facts, fallback rules, and no-answer behavior in a fixed order. Selected English advisory questions can use Gemini. | Overlapping builders and order-dependent matching make behavior hard to reason about. Some templates contain facts independent of the selected passage. A plausible answer may still be incomplete or unsupported. |
| 6 | Grounding, freshness, and citations | Published/available records are filtered using provenance. Evidence is attached to responses. Generated answers pass numeric, slot, speculative-figure, and selected claim checks. | These checks cover known failure classes and are not general semantic entailment. Some facts/templates are not centrally sourced. Source review metadata does not by itself authenticate the underlying institution document. |
| 7 | Conversation follow-ups | Public conversations are session-bound, expire, and retain selected context; the resolver expands short follow-ups such as fees, intake, and branch questions. | Context fields are heuristic summaries rather than an explicit user-confirmed state. Topic shifts, corrections, and ambiguous pronouns remain edge cases. |
| 8 | Evaluation and operations | Backend unit/API tests and offline public, retrieval, verifier, and load diagnostics exist. HTTP request logs include request ID/status/duration; assistant audit entries retain an answer source. | Most current question sets are developer-authored diagnostics. No independent final labels, formal multilingual quality scores, general entailment measure, or production load verification is established. Current logs do not explain the full parse → retrieval → answer path. |

## Recommended improvement order

### 1. Establish a reviewed evaluation set and trace failures

Before tuning rules, create a question set from real parent/student phrasing (with personal details removed). For every item, reviewers should identify requested facets, required qualifiers, acceptable evidence passages, answerability, and acceptable answer claims. Include typos, paraphrases, English/Marathi/Hindi and transliteration, multi-part questions, follow-ups, stale-year requests, unsupported details, and prompt-injection attempts.

For each request, capture a privacy-safe diagnostic trace: question hash (not raw question), language, parsed topics and slot counts, clarification flag, evidence IDs, outcome, model/fallback status, parse duration, and total duration. The current trace is intentionally limited: it does not yet expose normalized text, candidate rankings/scores, or separate retrieval/answer timings. Restrict access and retention. Do not log names, contact details, full question text, or uploaded content by default.

**Cannot be completed by code alone:** independent institutional fact review, independent question authorship, and human Marathi/Hindi ratings require qualified reviewers. Existing diagnostic cases must not be relabeled as independent.

### 2. Make published reviewed knowledge the factual source of truth

Use maintained records and structured `facts` for factual claims. Remove factual duplication from answer templates over time; templates should format selected facts and explain their scope. Add record metadata for topic, programme, route, academic year, source authority/type, effective interval, and review state. Do not auto-publish extracted OCR/PDF text. Preserve the existing review/publish gate and require review after source text changes.

Prioritize admissions dates, fees, cutoffs, intake, transport routes, and service availability because they can change or have consequential qualifiers. Identify duplicate/conflicting records and resolve them through an administrator/reviewer workflow, not a ranking preference.

### 3. Centralize question interpretation and routing

Have one structured query plan drive clarification, retrieval, and answer selection. It should contain intent, requested facets, positive and excluded values, branch, route, academic year, language, and a state such as `complete`, `ambiguous`, or `unsupported`. Keep raw text alongside normalized text. Do not collapse negation or conflicting slot values. Ask for missing information when it changes the answer.

Deprecate independent raw-text routing checks incrementally; do not replace them all at once. Add equivalence checks so each migration preserves known supported behavior while closing reviewed failures.

### 4. Improve retrieval with metadata constraints and judged aliases

First deduplicate and improve titles/tags/aliases on canonical records. Apply hard filters only where scope is explicit and safe (for example, an explicitly requested academic year); otherwise use soft ranking and retain the reason. `slotAwareRerank()` now removes records with known year metadata that conflicts with an explicit requested year, while retaining records whose year is unknown. Rank by field-aware lexical relevance plus semantic similarity only when available. Evaluate a hybrid candidate against the same reviewed questions and frozen corpus. Keep the existing method until reviewed evidence supports a replacement.

Do not use score as answer confidence. Add separate answerability/coverage checks: every requested facet must have supporting evidence, and conflicting or expired records must lead to abstention or clarification.

### 5. Make answer selection evidence-first

Represent each answer as one or more sections, each bound to evidence IDs and requested facets. Deterministic answers should render from reviewed structured facts. Both advisory and fallback generated drafts now pass through `verifyGeneratedAnswer()` before speculative-figure and slot checks; a failed check falls back to deterministic behavior. This catches unsupported numeric/date/code tokens and selected claim patterns, but it does not prove general semantic entailment. The generator does not yet return claim/evidence associations in a constrained format. If validation is inconclusive, return a concise abstention and official contact route. Do not allow generated text to override deterministic safety, year, route, or eligibility constraints.

### 6. Harden freshness, conflicts, and source lifecycle

Require validity/review dates for time-sensitive records, distinguish historical from current records during retrieval, and refuse conflicting facts. Provide an admin view for records that are expired, nearing review, changed since review, or superseded without a usable successor. Keep page/document lineage and stable passage citations through ingestion. Make source links topic-specific and ensure the linked source supports the claim.

### 7. Make conversation state explicit and testable

Treat context as typed, topic-scoped slots with provenance (`explicit in this turn` vs `inherited from earlier turn`) and age. Clear incompatible slots on topic changes. Ask the user to confirm when inherited category/route/year would change a consequential answer. Include correction sequences, pronouns, topic changes, and reset behavior in evaluation.

### 8. Add operations and release gates

Track answer outcomes, unsupported/clarification rates, source age, retrieval coverage, provider errors, latency, and fallback frequency. Use aggregate metrics and bounded retention. Set thresholds from reviewed data before release. Verify backup/restore and durable storage on the actual host, and run a post-release smoke set against the deployed origin. Separate offline diagnostics, reviewed evaluation, and production observations in reports.

## Execution sequence and acceptance criteria

1. **Baseline:** freeze corpus/code hashes and create independent review packets. Acceptance: reviewers can judge facets and evidence without seeing the retriever's ranking or expected answer.
2. **Trace:** add privacy-safe per-stage diagnostics. Acceptance: a wrong-answer report identifies normalization, parse, retrieval, selection, grounding, or freshness as the failing stage without exposing raw visitor data.
3. **Knowledge:** resolve high-impact duplicate/stale facts and centralize the top changing facts. Acceptance: answer values and citations come from the same reviewed record; conflicts and stale years abstain.
4. **Query plan:** unify interpretation/routing incrementally. Acceptance: reviewed positive, negative, ambiguous, multilingual, and compound cases follow one inspectable plan.
5. **Retrieval:** compare current, BM25, and hybrid candidates. Acceptance: held-out reviewer-scored facet coverage and unsupported retrieval are reported; no method is selected based only on development examples.
6. **Answer grounding:** bind claims to evidence and strengthen abstention. Acceptance: reviewers can trace every factual answer section to cited evidence; adversarial and contradiction cases fail safely.
7. **Context:** add provenance-aware follow-up slots. Acceptance: inherited qualifiers are visible in internal trace, clear on topic changes, and confirmed when consequential.
8. **Release:** monitor, test durability, and verify deployment. Acceptance: independent reviewed thresholds pass and production smoke/backup checks are recorded.

## Scope and status

This repository already contains parts of stages 1–8, including structured fee/programme facts, provenance, session-bound conversations, answer checks, tests, and diagnostic evaluators. The privacy-minimized assistant event logs a truncated HMAC question fingerprint keyed by a random process-local key, parser topic/slot counts, evidence IDs, outcome/model, and parse/total duration; it never logs raw question or answer text. The fingerprint cannot be correlated across process restarts. Invalid-length questions skip parsing in the diagnostic wrapper and are rejected by the existing validation path. Explicit requested academic years now exclude records that have known, conflicting years; undated records remain eligible. Generated advisory and fallback drafts now pass the general factual-token verifier before existing checks. These are targeted safeguards, not general correctness guarantees. Full candidate ranking/path traces, independent knowledge review, centralized routing, semantic claim-to-source verification, human language ratings, and deployment checks remain outstanding. Human review and deployment checks cannot be honestly marked complete from a local code change.

### Local validation for this increment

- Backend suite: **203/203 passed**.
- Backend syntax check: passed (`npm.cmd run check`).
- Strict public assistant development evaluation: **36/36 passed**; production retrieval remains unchanged by the experiment.
- Offline retrieval comparison: 44 development cases over 51 seeded records. Current keyword rules: group Recall@3 **1.000**, group MRR@3 **0.981**; fielded BM25 with normalized query: **0.977 / 0.890**; keyword + fielded BM25 RRF: **1.000 / 0.934**. Cases remain developer-authored/unreviewed, so the candidate is not promoted to production.
- The fielded BM25 candidate weights title 2.0, tags 1.8, category 1.5, and body 1.0. It has a separate unit test and is compared offline alongside plain BM25 and current keyword retrieval. The hybrid RRF matched the current keyword method's Recall@3 but had lower MRR; therefore the measured development set does not support a production switch.
- These are repository diagnostics, not independent accuracy results, human language ratings, or live deployment verification.

### Follow-up and provider audit

The resolver now infers a short branch-change follow-up from the immediately preceding user question for intake, cutoffs, HOD, laboratories, syllabus, placement, and programme questions. It uses parsed branch slots (including a distinct Electronics and Computer branch), carries a relevant academic year, and preserves the language selected from the original follow-up when the resolver rewrites it. A fee question followed by a short hostel/mess pivot retains the fee intent while availability/rules wording is left alone.

Generation providers are attempted in order: Groq, then Gemini. Each draft is verified before trying the next provider; unsupported Groq output now permits Gemini fallback. Both providers share a 15-second budget. Provider keys/settings are documented and forwarded in local, Docker Compose, and Render configuration. Retrieved evidence is explicitly marked as untrusted content in the model instruction. Mocked integration tests cover Groq success and invalid-draft fallback to Gemini. No live provider request was made; credentials, provider availability, cost, and live answer quality were therefore not verified.

Latest validation after these changes: backend suite **213/213 passed**, syntax check passed, and strict public development evaluation **36/36 passed**.
