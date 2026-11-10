# Research results and evaluation review

Reviewed 25 October 2026: `C:\Users\shrad\OneDrive\Documents\MITRA_Paper_Corrected_IJIRT.docx`. The supplied Word file was read, not edited. This is a methodological and claim review, not visual layout QA or a complete reference audit.

## Current assessment

Sections V–VII correctly distinguish development diagnostics from the faculty pilot. The 44-query retrieval comparison, 15 exposed verifier probes and overlapping implementation checks are useful engineering evidence. They do not establish held-out answer accuracy. The paper already acknowledges many of these boundaries; collecting new auditable observations is more useful than changing descriptive wording to imply stronger results.

## Claims to resolve before submission

1. **Table VII and sections 5.4/6.4:** language-specific correct/referral counts are English 9/1, Marathi 7/3 and Hindi 8/2. Earlier supplied information established only ten questions per language and totals 24 correct/six referrals. Obtain faculty confirmation of the language split and identify its source. If unavailable, retain only the aggregate total. Do not reverse-engineer case judgments from those totals.
2. **Section 6.4 and 7.1:** the inference that all answerable questions were answered correctly and all unanswerable questions correctly escalated needs item-level answerability labels and exact responses. Preserve it as an attributed faculty report, not a measured confusion matrix. Showing an escalation option is not evidence of a submitted callback, counselor receipt or completed resolution.
3. **Author block:** Prof. Shobhana Raichurkar is listed as fifth author and also acknowledged. Earlier user instructions selected guide acknowledgement. Confirm current authorship agreement; do not infer it from this attached document. No authorship edits were made here.
4. **Section 5.5:** distinguish four actual retrieval methods (application keyword/rules/concepts, raw BM25, normalized BM25, RRF) from any proposed conceptual-only ablation. The current application retriever already includes concept boosts; it is not an independent conceptual retriever. Freeze k=1/3/5 labels if the new study really collects top-five rankings.
5. **Section 3.1:** document the distinction between status values/publication controls and a mandatory approval state machine. Inspect and test actual transitions before saying every record must go through draft, review and approval. Existence of status fields alone does not prove enforced separation of reviewer and author.
6. **Sections 6.3/7.3:** keep the deployed version and local working-tree version separate. A live pilot cannot validate later undeployed session or verifier fixes. HTTPS availability, durable storage, backup scheduling and generation behavior should be separately measured, not combined into a general deployment claim.
7. **Paper title/venue:** an IJIRT-style document or a journal's advertised impact number does not by itself establish compliance with the earlier Clarivate JIF requirement of 7.5–9.5. Verify the exact journal and metric year separately; this review does not certify that venue.

## Recommended new study

Agree a protocol with faculty before running. A feasible proposed first study is **90 new cases**, 30 per language: 18 answerable, six clarification-needed and six unsupported per language. This balances the study around MITRA's answer/clarify/refuse behavior. It is a practical design, not a universal minimum or proof of statistical power. Publish actual denominators and uncertainty. Separate single-turn cases from multi-turn scenarios, and score turns plus whole-scenario success without counting correlated turns as independent questions.

Ask students/parents or faculty outside the implementation team to author realistic new wording without seeing old tests or MITRA outputs. Reviewers should use the frozen corpus to determine required facts, accepted evidence and answerability before seeing answers. Group translations, paraphrases and variants of the same information need within one split; do not put one language version in development and its translation in the final test. Record author/developer overlap honestly. Reusing the previous 30 cases is useful for a newly recorded regression pilot, not an untouched independent test.

Use two reviewers with recorded domain competence and language competence. Have each submit a separate immutable scoring file, blind to system/method identity where practical. A third reviewer or documented discussion resolves disagreements in a new adjudication file; preserve both original judgments. Reviewer independence includes separation from rule tuning, not merely employment outside the college.

Freeze the exact code/working-file hashes, corpus JSON bytes and source documents, model settings, deployment identifier, endpoint, evaluation timestamp, test order and generation/embedding state. Unknown hosted version remains unknown. Once final questions are exposed for tuning, move them to development and collect new final questions. Do not tune midway and pool pre-fix and post-fix answers into one system result.

## Experiments that would strengthen the result

| Experiment | Controlled comparison | Measure |
| --- | --- | --- |
| Answer quality | Current pipeline versus the same pipeline without optional generation | Strict correctness and evidence support; answer/refusal trade-off |
| Scope checks | Current checker versus token-only or slot checks disabled, with offline outputs only | Unseen wrong-category/year/service binding detection and valid-comparison false alarms |
| Retrieval | Existing four methods on one frozen corpus and independent relevance labels | Recall/MRR only where labeling supports their definitions; distinguish group proxies |
| Multilingual behavior | Comparable topic/answerability coverage in English, Marathi and Hindi | Correct facts, meaning preservation, terminology, fluency and fallback frequency |
| Conversation | Fresh scenarios with route override, negation and topic changes | Per-turn and whole-scenario success |

Keep unsafe ablations offline; do not disable production checks for actual applicants. For generation experiments, save model version/configuration and generated outputs even when rejected. A provider timeout is an observed failure, not a missing row to discard. Predetermine repeat policy and report per-case variability if nondeterministic runs are repeated. If live generation remains unavailable, omit generated-pipeline superiority claims and retain the deterministic study.

For verifier evaluation, collect fresh invalid mutations and substantially more valid controls, including correctly labeled multi-value comparisons. Vary clause order, grammar, script, negation, currency format and conflicting years. Do not simply translate the same 15 exposed mutations and call the resulting set independent. Paired valid/invalid variants share a group and should be treated as correlated observations.

## Metric definitions and denominators

- Answerable-question correctness: fully correct substantive answers / all reference-answerable cases. An unnecessary refusal counts as a failure here.
- Answer coverage: substantive answers / all cases. Coverage is not accuracy.
- Answered-response accuracy: fully correct substantive answers / substantive answers given. Report alongside coverage so a system cannot appear strong by refusing most questions.
- Appropriate unsupported handling: supported abstention/referral / reference-unsupported cases. Verify absence against the frozen corpus; a merely unretrieved answer is not truly absent.
- Unsupported-answer rate: unsupported cases receiving asserted factual answers / reference-unsupported cases.
- Clarification success: necessary and relevant clarification / reference-ambiguous cases. Over-clarification on answerable cases is a separate error.
- False-refusal rate: answerable cases receiving no substantive answer / reference-answerable cases.
- Citation support: claims directly supported by cited evidence / claims assessed. Link reachability alone is not support; wrong year/category counts as wrong scope.
- Verifier recall and false alarms: TP/(TP+FN), FP/(FP+TN), with TP defined as rejecting an invalid draft. Always publish all four counts.
- Reviewer agreement: pre-adjudication percentage agreement and Cohen's kappa for nominal judgments when defined. Report category distribution, denominators and disagreement examples; kappa can be undefined with no category variation. Do not apply ordinary kappa to mean Likert scores.
- Language ratings: separate meaning/factual fidelity, terminology and fluency. Report the rubric, score distribution and reviewer competence. N/A is not zero.
- Runtime: request-start to fully received response p50/p95, HTTP/provider errors, warm/cold conditions and request counts. Ranking-only milliseconds must stay separate.

Report Wilson or another justified proportion interval with the numerator and denominator. Intervals quantify sampling uncertainty; they do not correct developer leakage, biased sampling, missing transcripts or dependence between translations. Use paired case/group comparisons for methods and avoid significance claims without an appropriate analysis plan. RAGAs may supplement claim review but must not be presented as independent human truth.

Sources: NIST proportion intervals, https://www.itl.nist.gov/div898/handbook/prc/section2/prc241.htm ; RAGAs primary paper, https://aclanthology.org/2024.eacl-demo.16/ .

## Saving records

The accompanying `deliverables/evaluation-record-kit/` contains repository-held 30/90-case pilot questions and an automated development report, plus blank rating/adjudication templates and a manifest. The pilot report is not a record of independent human ratings. Copy only blank templates to a new private run directory. The rating and adjudication forms are blank; the manifest reports zero independently collected cases. Fill it as follows:

1. The coordinator fills `run-manifest.json` and saves the frozen corpus/source documents with hashes. Do not save API keys, cookies, passwords or real applicant data.
2. Independent authors create a new `cases.csv` with actual questions, topic/language, case-group identity, expected outcome and documentary reference. Faculty completes reference facts before viewing responses. Do not reuse the existing P30 pilot questions as independent or held-out cases. The current manifest's `caseCountCollected` value is zero.
3. Run each method against the same new cases. For a manual UI run, open a new conversation per case; preserve turns inside multi-turn cases. Save the exact transcript as UTF-8 text/JSON plus an optional screenshot. Record response IDs, request/response timestamps, errors and the actual deployed version where available. Browser/API results must be identified separately.
4. `responses.csv` indexes raw response files and their SHA-256 hashes. Keep original transcripts immutable. For example, `raw/C001/current/turn-01.txt`; never replace a failed attempt with a successful retry. Give each attempt its own response ID and report failures.
5. Send each reviewer a separate copy of `ratings-template.csv` with anonymized response IDs, question, reference facts and exact answers. Reviewers must not see one another's scores. Use separate R1/R2 files and retain original submissions.
6. Fill `adjudication.csv` only after both reviews. Record original rating IDs, disagreement, final judgment and rationale. Save summaries in a separate analysis folder. Do not edit original scores to make them match.
7. Freeze finished files with checksums. Keep private backups and access controls. Publish only authorized de-identified data; a SHA-256 hash detects later changes but does not prove authorship, independence or institutional approval.

Suggested private structure: `run-manifest.json`, `cases.csv`, `sources/`, `raw/`, `responses.csv`, `reviews/R1.csv`, `reviews/R2.csv`, `adjudication.csv`, `analysis/`, `checksums.sha256`. Store reviewer-name mappings separately from the publication dataset.

## Rubric

Correctness: correct / partial / incorrect / not-applicable. For unsupported or ambiguous cases, factual correctness can be N/A while decision appropriateness is scored separately. Decision: answer / clarify / abstain / refer / technical-error. Evidence support: full / partial / unsupported / contradicted / not-applicable. Completeness: complete / partial / incomplete / not-applicable. Language scores: 1 seriously impairs meaning, 2 substantial problems, 3 understandable with problems, 4 clear with minor problems, 5 clear and appropriate. Language meaning and factual fidelity must be judged against the reference, not fluency alone. Each score needs a short rationale; material wrong year, amount, route or category prevents a fully correct judgment.

## Historical pilot

Keep the 24-correct/six-referral report as aggregate historical evidence. If faculty supplies a signed or dated retrospective statement, label it retrospective and preserve its date. Do not backdate transcripts or manufacture 30 individual judgments. Rerun old cases as a new recorded pilot with new timestamps; it is a new run and exposed material, not recovery of the missing original records.

## Final assessment

The paper is a defensible implementation/development study when its limitations remain explicit. A new source-bound, independently authored, twice-rated evaluation with raw transcripts would materially strengthen the results. More decimal places, another successful run of exposed tests, or relabeling referral counts as accuracy would not.
