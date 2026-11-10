# MITRA evaluation and bounded agent workflow

This is an offline evaluation workflow plus one feature-flagged, read-only document-search planner. It does not make an LLM or judge authoritative for college facts. No evaluation scores are claimed by adding these tools.

## What exists

- Existing deterministic evidence, figure, slot and prompt-safety checks remain in the request path.
- The expanded synthetic suite separates ingress attack detection (`guardrail-cases.json`), retrieved-text JSON/policy boundary checks (`retrieved-context-guardrail-cases.json`), and answer-pipeline behavior (`behavioral-guardrail-cases.json`). Run `npm run evaluate:guardrails` from `backend`. Current output: 20 ingress probes with TP=10, FP=0, TN=10, FN=0; structural retrieved-context checks 4/4; seeded pipeline behavior checks 10/10. The retrieved-text check is structural; it does not prove an LLM will resist injected text. Pipeline probes use seeded in-memory data, including deliberately withheld and conflicting records, and do not cover all institution data.
- `backend/evaluation/llm-judge.js` and `backend/scripts/run-llm-judge.mjs` provide an offline, structured claim judge using the configured Groq provider first and Gemini as fallback. The judge runs only when `MITRA_ENABLE_EXTERNAL_EVAL=true` is set.
- `backend/scripts/evaluate-ragas.py` uses RAGAS 0.4.3 for faithfulness, answer relevancy, context precision and, where a reference is supplied, context recall. Run this in a separate Python environment using `backend/requirements-ragas-eval.txt`; do not add those dependencies to the serving container.
- Each request gets a random trace ID to correlate privacy-minimized pipeline, provider-attempt and draft-validation logs. No question or answer text is written to these events. Provider input/output/total token counts are logged when Gemini/Groq returns them; unavailable usage stays absent. Cost is not computed because provider pricing is model/date dependent and no approved pricing table is configured.
- The Evidence Gap Navigator is an optional, two-search maximum planner for document-intent questions. It only invokes the existing indexed-document search and returns its evidence through the existing document response builder. It cannot mutate records or call an LLM. It asks for a year when an academic-calendar request omits one and asks for a subject/programme when a syllabus request omits one. Enable with `EVIDENCE_GAP_NAVIGATOR_ENABLED=true`; it is disabled by default pending comparison against baseline.

## Evaluation data format

Prepare an access-controlled JSON array based on `backend/evaluation/rag-eval-template.json` and keep real held-out cases outside Git until the independent evaluation is complete:

```json
[
  {
    "id": "anonymous-case-id",
    "question": "Question text",
    "answer": "Observed MITRA answer",
    "contexts": ["Retrieved evidence text"],
    "reference": "Adjudicated reference answer",
    "humanFaithful": true
  }
]
```

`reference` is required to measure context recall and is the reference for context precision. When absent, RAGAS uses context precision without reference and omits context recall. `humanFaithful` is optional and must only be filled after human adjudication; without it, judge agreement is reported as null. Use fictional details, remove personal information and confidential documents, and do not run a blind final set while it is still being used to tune the system.

## Running the offline judge

From `backend`, after reviewing the evaluation dataset for disclosure:

```powershell
$env:MITRA_ENABLE_EXTERNAL_EVAL = "true"
npm run evaluate:judge -- evaluation\my-reviewed-cases.json evaluation\reports\judge-run.json
```

The script refuses to overwrite output and enforces the currently approved 12-case maximum. Questions, answers and retrieved contexts are sent to the configured external judge provider; the report stores case IDs, claim-level labels, judge provider/model, input hash and human agreement counts, not copies of the source text. Do not enable this for private applicant conversations or unreleased confidential records.

## Running RAGAS

Create a separate Python virtual environment and install `requirements-ragas-eval.txt`. After setting `MITRA_ENABLE_EXTERNAL_EVAL=true`, the runner reads `GROQ_API_KEY`, `GEMINI_API_KEY`, `GEMINI_EMBEDDING_MODEL` and optionally `MITRA_RAGAS_MODEL` from the process environment or `backend/.env`. RAGAS uses Groq for LLM metrics and Gemini embeddings for answer relevancy. It sends evaluation inputs to those providers and enforces the currently approved 12-case maximum. Then, from `backend`:

```powershell
$env:MITRA_ENABLE_EXTERNAL_EVAL = "true"
python scripts/evaluate-ragas.py evaluation\my-reviewed-cases.json evaluation\reports\ragas-run.json
```

Reports include the dataset hash, exact RAGAS version, model IDs, per-case metric scores and aggregate denominators. Compare automated scores to blinded human labels; do not call them institutional accuracy or independent review. Pin the Python environment and record the source commit before publishing results.

## Agent comparison before enabling

The paired local comparison is implemented as `npm run evaluate:document-agent -- <cases.json> <report.json>`. Use the case format in [the reviewer handoff](EVALUATION_REVIEWER_HANDOFF.md). It compares the baseline's first search with the candidate's up-to-two-search planner, records input/index/source hashes, top-hit branch/year/semester/title scope, clarification/abstention, paired gain/regression, p50/p95 local latency and search calls. It makes no provider calls. The case expectations still require human adjudication; this runner does not decide whether a cited document actually answers the user's request. Keep the live feature flag off unless reviewed results support enabling it.

## Developer diagnostic artifacts

The assistant-authored 90-case set and local run are documented in [the reviewer handoff](EVALUATION_REVIEWER_HANDOFF.md). They are synthetic, non-independent development diagnostics. The recorded 54/90 outcome-label matches and 54/90 expected-evidence hits are not answer-accuracy, faithfulness, or language-quality scores. The 12-case sanitized subset has no human faithfulness labels. An external judge attempt returned no usable response for its first case and produced no report; RAGAS dependencies were not installed successfully and no RAGAS run completed. These failures are harness/provider setup issues to resolve after human review; they are not zero scores.

## Known gaps

- The checked-in guardrail cases are synthetic probes, not a complete adversarial benchmark. Retrieved prompt-injection checks validate prompt serialization and policy text, not semantic model resistance.
- The external judge and RAGAS jobs are approved only for a sanitized pilot of up to 12 cases. The developer pilot has not produced usable external scores and has no human labels; no quality score or judge calibration result is claimed.
- The planner is a small deterministic tool-orchestration feature, not a general autonomous agent. It cannot search the knowledge database beyond the indexed document corpus.
- Request traces include token counts only when supplied by the provider. They do not yet include cost, corpus revision IDs or end-to-end retrieval stage timings. Those require a maintained pricing table and stable source-version fields before adding reliable metrics.
