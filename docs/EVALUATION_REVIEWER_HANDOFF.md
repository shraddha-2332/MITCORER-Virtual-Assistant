# MITRA evaluation: what the project team must supply

## Purpose

This evaluation asks whether MITRA gives students and parents correct, evidence-supported answers from a frozen official MITCORER corpus, asks for clarification when the question is underspecified, and abstains when current or private information is not in that corpus. It is not a general test of whether an LLM sounds helpful.

The repository now has executable synthetic guardrail checks, an offline RAGAS runner, an opt-in LLM judge, and a document-search planner comparison runner. Those tools cannot create independent questions, verify official facts, recruit reviewers or provide human language judgments. No independent evaluation result exists until those inputs are collected and adjudicated.

## Developer-authored diagnostic (not reviewer data)

The assistant created a separate internal development set from the frozen published corpus:

- `backend/evaluation/developer-review-cases-90.json` contains 90 synthetic scenarios (30 each in English, Marathi, and Hindi; 18 answerable, 6 clarify, and 6 unsupported per language).
- `backend/evaluation/developer-review-cases-90.manifest.json` records the corpus and dataset hashes, author code `AI-DEV`, `independent: false`, and pending native-language review.
- `backend/evaluation/reports/developer-review-run.json` records an isolated deterministic-pipeline run against a temporary database populated only from the frozen public corpus. It does not use the live database or model keys.
- `backend/evaluation/reports/developer-review-pilot-12.json` is a 12-case sanitized subset for optional provider diagnostics. It contains no human faithfulness labels.

This is a developer diagnostic, not a substitute for independent reviewers. The assistant authored the questions and labels after inspecting the system and corpus; the cases are not blinded, not sampled from real visitor traffic, and the Marathi/Hindi phrasing and outputs have not been reviewed by fluent human speakers. Do not report these results as independent accuracy, RAGAS faithfulness, language quality, or user performance.

The local diagnostic records **54/90 expected answer/clarify/abstain decisions**, including **6/18 clarification cases** and **4/18 unsupported cases**. These are decision-label matches only, not semantic answer correctness. Expected evidence was retrieved in 54/90 cases. Treat misses as regression candidates for review, not as a validated benchmark.

The approved external judge pilot was attempted, but the judge returned no usable response for `DEV-EN-05`; no judge report or score was produced. RAGAS dependencies were unavailable in the system Python, and the isolated temporary environment did not complete installation. No external RAGAS scores were produced. The pilot remains a provider-harness diagnostic pending a successful run and human review of its inputs.

## Proposed first independent set

Use 90 fresh cases: 30 English, 30 Marathi and 30 Hindi. For each language, target 18 answerable, 6 needing clarification and 6 unsupported. Keep multi-turn scenarios grouped and report scenario-level results so turns from one conversation are not treated as independent samples. This is a practical starting design, not a statistical-power claim.

Questions must be authored by people who did not implement or tune MITRA and who have not seen the existing tests or model answers. Adjudicate the evidence and expected behavior separately before showing reviewers MITRA's answer. Use anonymous reviewer codes in files.

## Existing evaluation-kit files are not independent reviewer data

The current `deliverables/evaluation-record-kit/cases.csv` has 90 populated rows, but all 90 question texts exactly match `backend/evaluation/pilot-dataset-90.json`; they are previously exposed development cases, not a fresh blinded set. Their current distribution is 60 answerable, 21 unanswerable, and 9 ambiguous, rather than the proposed 54/18/18 balance. The 90 rows in `adjudication.csv`, `responses.csv`, and `ratings-template.csv` are blank template rows; they contain no completed review evidence. `pilot-evaluation-report.json` explicitly identifies itself as an automated developer diagnostic with no independent human ratings. These artifacts can support development checks, but must not be presented as independent evaluation results or sent as the approved reviewer pilot.

## People and roles to arrange

1. **Question authors:** someone familiar with student/parent questions and the relevant language; authors must not view existing expected answers.
2. **Evidence adjudicator:** a domain-competent reviewer who checks the frozen official sources and labels answerability, acceptable evidence, required facts and prohibited claims.
3. **Marathi/Hindi reviewers:** competent speakers who judge meaning, terminology and fluency for those outputs. A script-presence check is not a language-quality rating.
4. **MITRA operator:** a developer runs the frozen system on the cases but does not adjudicate their own outputs.

One person may have more than one role only if that overlap is recorded. Do not call a result independent when an author or adjudicator participated in tuning the evaluated behavior.

## Frozen corpus selected for this evaluation

The project lead selected the reviewed information published in the local MITRA database plus the public website document index. `npm run freeze:evaluation-corpus` creates `backend/evaluation/corpora/reviewed-public-corpus.json.gz` and a hash/count manifest. The compressed snapshot includes Published knowledge (53 records), Published official sources (14), Published institutional content (3), and all public website document metadata and text (316 documents / 43,222 chunks). Entries marked Review are excluded.

Operational collections (`users`, `inquiries`, uploaded `documents`, `auditLogs`, `refreshTokens`, `assistantAttachments`, `admissionWorkspaces`, `conversations`, and `feedback`) are never exported. The corpus directory is git-ignored because it is a local snapshot of runtime data. Preserve the JSON and manifest together outside Git for evaluation reproducibility. Do not share the whole SQLite database.

The corpus snapshot contains source text. For the external 12-case pilot, send only the adjudicated question, MITRA answer and relevant public evidence excerpts per case; never send applicant records or unrelated corpus text. A reviewer should inspect excerpts before they enter the pilot file.

## What the question authors should return

Use `docs/research-review/case-template.json` as the schema guide, or send one CSV row per case with:

| Field | Meaning |
| --- | --- |
| case ID | Anonymous unique ID, such as `EN-001` |
| language | `en`, `mr`, or `hi`; mark mixed language explicitly |
| topic | Fees, programme/intake, admissions, facilities, documents, scholarship, placement, etc. |
| turns | Exact user messages in order; do not include real names, phone numbers, applications or private histories |
| origin | Broad origin such as “parent enquiry” or “website navigation”; no identifying details |
| author code / expertise | Anonymous reviewer code, language/domain competence, and whether they helped develop or tune MITRA |

Authors should leave answerability, accepted evidence, expected answer and adjudication fields blank. Do not include an answer just because the author already knows it; the separate adjudicator checks it against the frozen corpus.

## What the adjudicator should return

For each case, provide:

- answerability: `answerable`, `clarify`, or `unsupported`;
- accepted source/document IDs and exact page/section where available;
- target scope: branch/programme, academic year, admission route, category, gender, semester/round as relevant;
- required facts/claims and claims that would be wrong or unsafe;
- whether the correct behavior is answer, clarify, abstain, or refer to an official contact;
- adjudicator code, confidence and a short rationale;
- disagreement records before a final adjudication.

For retrieval metrics, label relevant evidence groups for each question. Do not report corpus-wide context precision unless the relevant corpus has actually been judged; otherwise label the measure as a limited evidence-group proxy.

## Document navigator comparison cases

The baseline comparison uses one search on the original query. The candidate uses the original query and, if necessary, one focused rewrite; it cannot call an LLM. Copy `backend/evaluation/document-agent-comparison-template.json` and provide cases with this shape:

```json
[
  {
    "id": "DOC-EN-001",
    "question": "Show the CSE academic calendar PDF for 2025-26 Semester I",
    "expectedAction": "evidence",
    "expectedTitleIncludes": "academic calendar",
    "expectedBranch": "cse",
    "expectedYear": "2025-26",
    "expectedSemester": "I"
  },
  {
    "id": "DOC-EN-002",
    "question": "Show the academic calendar PDF",
    "expectedAction": "clarify",
    "clarificationIncludes": "academic year"
  }
]
```

`expectedAction` is `evidence`, `clarify`, or `abstain`. For evidence cases, the adjudicator must confirm title/branch/year/semester constraints against the frozen index. Include wrong-year, wrong-branch, missing-document and unqualified cases. Do not fabricate expected titles. Run from `backend`:

```powershell
npm run evaluate:document-agent -- evaluation\reviewed-document-cases.json evaluation\reports\document-agent-run.json
```

The report records the input hash, index hash, code-file hashes, candidate/baseline paired gains and regressions, wrong-scope hits, latency and tool-call counts. The evaluator tests retrieval/planning only; human review is still needed for citation correctness and answer usefulness. Keep the navigator disabled until this comparison supports enabling it.

## RAGAS and LLM judge pilot

Before a full run, prepare a **12-case pilot** (4 per language) from adjudicated cases. Include supported answers, one clarification case and one unsupported case per language where possible. The external runners send the user question, MITRA answer, retrieved context text and any supplied reference to model providers; RAGAS also sends text to the Gemini embedding service. The LLM judge sends the same case material to Groq, with Gemini fallback if needed. Do not send personal applicant records or confidential source material.

The project lead approved external processing for a sanitized 12-case pilot. That approval covers the selected pilot cases and their relevant evidence excerpts only. Use the existing backend `.env` keys; never paste API keys into reviewer files or chat. For RAGAS, install the separate `backend/requirements-ragas-eval.txt` environment. Set `MITRA_ENABLE_EXTERNAL_EVAL=true` only for this pilot run. The LLM judge calls Groq first and may fall back to Gemini; RAGAS uses Groq for evaluation and Gemini embeddings. Preserve the exact model IDs, dependency freeze, input hash, output report and provider failures. Do not run the 90-case set through external providers unless separately approved.

The LLM judge's agreement is meaningful only for cases with `humanFaithful` filled after human adjudication. RAGAS faithfulness/context metrics are automated diagnostics, not institution-level correctness. Review false accepts and false refusals manually before citing any results.

## Reply format for the project lead

To start the outstanding human/external work, reply with:

1. **Reviewers:** provide anonymous codes, role (author/adjudicator/language reviewer), languages, domain competence, and whether each helped develop/tune MITRA. Names are not needed here.
2. **Question collection:** the project lead can arrange 90 fresh cases. Use 30 per language (English, Marathi, Hindi), each with 18 answerable, 6 clarify and 6 unsupported. Authors must not view existing expected answers or model outputs.
3. **Pilot selection:** from the adjudicated set, select 12 sanitized cases (4 per language) for the already-approved provider pilot. The lead/reviewer should check each question, answer and evidence excerpt for personal/confidential data before returning it.
4. **Return files:** send case author files first with only IDs, language, topic, exact question turns, broad non-identifying origin and anonymous author code. Send adjudication labels and pilot evidence in a separate file after the questions are frozen. Use `docs/research-review/case-template.json` as the schema reference.
