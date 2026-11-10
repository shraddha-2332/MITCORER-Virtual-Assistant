# Independent evaluation packet

For a step-by-step reviewer recruitment, question collection, corpus approval and return checklist, see [evaluation reviewer handoff](EVALUATION_REVIEWER_HANDOFF.md).

Status: source corpus frozen locally; independent questions, reviewer roster and adjudicated labels have not yet been collected. The project lead can arrange 90 cases and approved external processing for a sanitized 12-case Groq/Gemini pilot. No provider run or independent result exists yet. The repository-held 30/90-case pilot is an automated development diagnostic; it is not an independent human evaluation. Read with [the research scope](RESEARCH_SCOPE_AND_EVALUATION_PLAN.md) and [reviewer handoff](EVALUATION_REVIEWER_HANDOFF.md).

## Roles and separation

An institutional/domain reviewer authors fresh realistic questions without viewing existing tests or model outputs. A separate adjudicator checks evidence and labels. At least one competent Marathi/Hindi reviewer assesses each applicable language. Record actual role overlap; do not certify independence when developers authored or tuned on the cases. Review participation must be obtained by the project team; generating this packet does not contact anyone.

Assign anonymous reviewer codes rather than publishing names or student information. Use fictional applicant attributes; never include private helpdesk logs, email threads or contact details without appropriate authorization and de-identification.

## Freeze before collection

1. Select the exact corpus: either published seed knowledge or an explicitly exported, reviewed maintained snapshot. Do not silently substitute one for the other.
2. Save the records, structured facts, source URLs, provenance, publication state and revisions. Record evaluation timestamp and SHA-256 of the exact UTF-8 JSON bytes. Store private material outside Git.
3. Record source commit and hashes of engine files, runtime, OS, model configuration and generation parameters. Do not record secrets. Record whether embeddings/generation were enabled and whether network requests succeeded.
4. Freeze development rules and baseline settings before releasing final questions to developers. Keep final question and label files access-restricted until the evaluation run. An ordinary public Git file is not a blind final set.

## Sampling specification to agree before running

Use a balanced coverage plan covering academic fees, accommodation, programme intake, policy/facilities, unsupported questions, ambiguities and multi-turn scope. Include English, Marathi, Hindi and mixed-language cases. Distinguish natural user-authored questions from synthetic adversarial verifier cases. Report actual counts per topic, language and answerability; do not claim those counts already exist.

Reviewer-authored cases should exercise categories, gender, first-year/DSE routes, explicit years, missing attributes, negation, topic changes, retired/expired facts and compound requests. Unsupported future fees and unverified outcomes need explicit no-answer labels. Do not show reviewers existing expected answers or method rankings.

## Collection and labeling

Copy `research-review/case-template.json` per case. A collection coordinator supplies batch/corpus hashes and reviewer metadata; the author supplies a fresh question and source origin. Labels start null. An adjudicator supplies answerability, accepted evidence, target facts, required/prohibited claims and rationale from the frozen corpus. Use multiple turns where applicable and keep their order.

For evidence relevance distinguish direct support, partial support, wrong scope/year, contradiction and unrelated text. Review the whole corpus before claiming exhaustive relevance or computing precision. If the corpus lacks a necessary fact, mark it unsupported rather than relying on an outside remembered rule.

Record disagreements before adjudication. Keep raw annotations and adjudicated labels separately. Native-language review must assess meaning and fluency as well as preserved numbers. Do not fill rubric ratings using substring checks.

## Evaluation and scoring

Run all selected methods against the same frozen corpus and final questions. Save exact questions, outputs, retrieved IDs, generation acceptance/rejection, model/error metadata and timing. Randomize and blind method identities for answer review. No tuning on final failures; a changed system requires a new explicitly versioned evaluation.

| Dimension | Required measure |
| --- | --- |
| Retrieval | Recall@K and MRR with defined labels; distinguish evidence-group proxies |
| Structured facts | Exact target amount/intake/code, correct entity, route and academic year; wrong-row and wrong-year counts |
| Generated claims | Supported, unsupported, contradicted and unresolved claims against evidence |
| Refusal/clarification | Separate answerable, unsupported and ambiguity subsets with false-refusal/unsafe-answer counts |
| Conversation | Slot retention, explicit override and topic-change correctness per turn |
| Language | Independent meaning, grammar and terminology judgments by language |
| Runtime | Cold/warm conditions, p50/p95, errors, model calls/tokens and actual cost |

For a verifier-only experiment, create paired supported/incorrect claims, including mixed correct-and-wrong amounts and legitimate comparisons. Report TP/FP/TN/FN, rejection recall and false-alarm rate with explicit denominators. An undetected error is a false negative for an error detector; do not label it a false positive without defining a different positive class. Numeric token matching alone is not semantic correctness.

## Exposure and release

Store the first execution date and question hashes in an exposure ledger, including model tests and manual development inspection. Existing 500 cases, public diagnostics and 24 paraphrases remain development material. Exact-match contamination checks do not prove independence against paraphrases; document human checks and authorship. Publish de-identified final artifacts after the run if authorized, with limitations and reviewer disagreement. The blank template is not a held-out dataset and is never scored.
