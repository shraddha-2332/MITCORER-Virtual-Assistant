# What BM25 missed and how to review the comparison

## Meaning of “missing evidence”

Evidence means a stored passage supporting a requested fact. Missing means the expected passage was absent from the first three ranked results. It was still in the corpus. This experiment measured retrieval, not generated-answer correctness, and did not change Mitra's production retriever.

Normalized BM25 missed required evidence on **2 of 30 questions**:

| Question | Required evidence | What BM25 returned | Passage audit |
|---|---|---|---|
| List first-year B.Tech courses and the Open-category fee for 2026–27. | KB-10 full programme list; KB-2 fees | KB-2 fees, KB-9 CSE intake, KB-30 admission portals | Fee facet was found. KB-9 mentions CSE only; it cannot support the requested complete branch list. KB-10 contains six branches and their codes/intakes. |
| How do students travel using college transportation? | KB-19 bus facility | KB-34 college overview, KB-28 railway career context, KB-17 contact details | These results do not provide the dedicated bus passage. KB-19 confirms a bus facility and explicitly says routes, stops, timings, seat availability and fares are unpublished. The correct response must preserve that limitation. |

Plain BM25 also missed four native-language questions: Marathi library, Hindi library, Marathi hostel/mess fees and Hindi first-year fees. The first three returned no records; the Hindi fee question retrieved programme records. The indexed corpus is English; raw Marathi/Hindi words do not match it sufficiently. Existing query normalization recovered all four. This explains the value of language normalization without claiming semantic multilingual retrieval.

The recorded **95%** is macro-averaged evidence-group Recall@3, not “95% of questions correct.” The compound miss loses half of that question's two required facets; the transport miss loses its one facet. `(28 + 0.5 + 0)/30 = 0.95`. Full group coverage occurred on 28/30 questions. Plain BM25 achieved full group coverage on 24/30 questions; its macro group Recall@3 was 81.67%.

This passage audit is assistant-authored, not independent approval. Broader judgment issues remain: overview passages may partially support facility questions, multiple records can support document guidance, and questions asking for operational details can be only partially answerable even when their topic is retrieved. No existing labels or scores were changed to improve the reported outcome.

## Review material prepared

- [Development review packet](retrieval-review/DEVELOPMENT_REVIEW.md): 30 questions with candidate passages, without method names, ranking order or proposed expected labels.
- [Editable judgments](retrieval-review/development-review.json): empty relevance decisions, facets, accepted groups, rationale and reviewer declaration.
- [Frozen corpus](retrieval-review/corpus.json): all 36 passages from the measured run, including source titles/URLs and facts. It is a benchmark snapshot, not an overwrite of maintained knowledge.
- [24 archived candidate paraphrases](../backend/evaluation/heldout-candidates.json): 12 English, 6 Marathi and 6 Hindi. These were subsequently tested at the user's request and promoted to development diagnostics. See [completed diagnostic results](retrieval-review/PARAPHRASE_RESULTS.md); they are no longer untouched held-out candidates.

## Independent relevance review

Use a person who did not author these questions or tune the retrievers. Have them read each question and source passages before consulting the previous comparison results.

1. Identify every requested facet and any route/year/category/gender constraints.
2. For each candidate passage, mark direct support, partial support, unrelated or wrong year, with a short supporting quotation or explanation.
3. Search the full frozen corpus for omitted alternatives. Pool membership itself can bias review; it is not an exhaustive relevance label.
4. Record answerability separately: supported, partially supported, unsupported or clarification needed. A library passage does not establish borrowing duration; bus availability does not establish a timetable.
5. Record acceptable alternative IDs per required facet, and explain excluded overlapping records. Separate unsupported facets instead of creating a fake supporting group.
6. Record reviewer identity, role/competence, date and independence. Resolve disagreements with a second reviewer where feasible. Preserve the original measured report and make reviewed labels a separately versioned dataset.

Do not mark `allCorpusRecordsConsidered` true without checking every passage. Precision cannot be calculated honestly from the pooled labels alone. Administrative publication, script checks and matching numeric tokens do not substitute for relevance or language review.

## Held-out preparation and leakage controls

The 24 questions are **assistant-authored candidates**, not an independently authored final test set. They are visible to the development team. Do not tune alias rules, retrieval weights, thresholds or prompts using them and later claim an untouched test result. Structural validation checks only duplicate wording, corpus identity and pending status; it cannot prove semantic independence or lack of leakage.

Ask an independent reviewer to write a fresh final set from the same topic coverage, using natural student wording rather than copying source terminology. They should also review native-language meaning. Keep that final file outside the developers' tuning workflow until parameters, normalization and source code are frozen. Store the frozen corpus and model/code hashes with the reviewed questions; keep development and final labels separate.

Include single topics, paraphrases, multiple facets, route/year constraints, unavailable information, ambiguity and adversarial instructions. Evaluate retrieval facet coverage only where a supporting passage exists. Evaluate abstention/clarification and unsupported facets separately through the API. Final answer correctness and citation support need review in addition to retrieval metrics.

If candidate questions influence a code change, move them into development and obtain fresh independent final questions. Once the final test has been examined for tuning, retire it as a held-out set and document that exposure.

## Validation and status

No independently reviewed final retrieval scores have been calculated. The 24 candidates are now exposed development diagnostics. No independent reviewer approval or formal speaker approval has been assigned. Keyword retrieval remains the production method, with subsequent normalization and answer-routing fixes. The user's acceptance of current language behavior permits continuing work; it is not a competence-based review stamp.

Regression tests check 24 distinct pending candidates, corpus hash binding, English/Marathi/Hindi coverage, rejection of exact development duplicates, source drift and premature review status, and omission of method/rank information from the development packet.

The preparation command (`npm.cmd run prepare:retrieval-review` from backend) refuses to overwrite existing review files, preserving reviewer work. Use a separately versioned batch for regeneration. Candidate validation is a structural development safeguard, not a final-test evaluator or a mechanism for granting independent approval.

Next external input: completed independent judgments and a separately authored final question set. Until those exist, the available result remains a development comparison rather than a defensible held-out accuracy claim.
