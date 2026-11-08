# Mitra Freshness and Conflict Review

## Project claim

Mitra is a source-grounded college information assistant that tracks the freshness and provenance of official information, detects likely numeric conflicts, and gates changed answers behind maintainer review.

This is a focused reliability contribution for MITCORER's changing admissions and campus information. The broad college-chatbot idea is common; the defensible engineering work is the source lifecycle, safe update process, and measured evaluation.

## Current implementation

1. **Discover** — on-demand sync crawls same-origin HTML routes under the new website's `/mitcorer/public` path, capped at 250 pages and eight concurrent requests. It skips linked documents, assets, and external URLs.
2. **Capture** — each successful page is cleaned, hashed and tied to its canonical URL. New site imports carry a crawl version and capture date.
3. **Compare** — content drift reports length, numeric and academic-year changes. A conservative detector compares numeric statements with the same normalized wording against published knowledge and records potential conflicts.
4. **Review** — a changed page is staged as `Review`, with its previous captured text and conflict examples available to an administrator. It does not replace published answer records during sync.
5. **Resolve and publish** — the UI requires explicit confirmation when potential conflicts are listed. Publishing a new version archives older records from that same source URL and explicitly selected conflict records, keeping stale answers out of retrieval. The action is audit logged.
6. **Answer with provenance** — published evidence exposes academic year, document version and capture date; official-source links show the capture date when available. When potential numeric facts are changed or removed, the old affected records are temporarily changed to `Review`, making the assistant abstain until staff decide what is current.

## Prioritized remaining work

### P0 — Validate the end-to-end lifecycle

- Test unchanged sync, changed page, numeric conflict, admin resolution, supersession/archive, and retrieval after publish.
- Confirm repeated syncs do not create duplicate source records.
- Exercise failed routes, redirect/canonical URL variants, and pages with no `<main>` element.

### P1 — Improve change understanding

- Replace the conservative exact-wording numeric detector with structured claim extraction for intake, fees, dates, HOD names, placement measures and policy clauses.
- Show a compact before/after text diff with highlighted additions, removals and changed values.
- Keep source-specific history with captured time, HTTP status, content hash and reviewer decision.

### P2 — Cover documents and freshness policy

- Add a separate, reviewed PDF/XLSX pipeline. The current website crawl intentionally skips those links.
- Assign validity windows to truly time-bound notices and fee/admission facts. Do not treat crawl date as the same thing as a fact's effective date.
- Configure a scheduler only after deployment storage and failure alerts are settled. Current sync is on demand.

### P3 — Demonstrate value with an evaluation

Create a reviewed benchmark of at least 100 college questions with expected answer facts, source URLs, academic years and follow-up context. Compare baseline keyword retrieval with the improved system on:

- Correct source in top results / Recall@5
- Answer fact accuracy and citation accuracy
- Follow-up entity resolution
- Stale-value and conflicting-source detection
- Unsupported-answer rate and safe abstention
- Median and p95 latency

Report dataset version, test date, model/provider configuration and failures. Do not claim an improvement until these values are measured.

## Known limits

- The numeric conflict detector is intentionally conservative and can miss paraphrased or non-numeric conflicts; it can also flag benign numeric changes for human review.
- Facts in conflicting records are withheld during review. If the updated page is rejected, staff must re-verify and restore any still-current older records; the system does not guess which value is right.
- Sync is on demand, not scheduled.
- The 15 routes that failed the crawl and 370 linked documents have not been added by the website-page sync.
- Existing imported content should be treated according to its recorded capture date; a capture date does not certify that the underlying fact is still effective.

## External-panel explanation

“We focused on a real failure mode in college information assistants: answers become stale when official pages change. Mitra records the source and capture version, detects likely changed numeric claims, stages updates for staff review, and archives superseded answer records only after the reviewer resolves the conflict. We are evaluating retrieval accuracy, citation correctness, stale-answer detection and safe abstention against a keyword baseline.”
