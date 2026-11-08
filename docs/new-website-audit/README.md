# MITCORER New Website Audit

Audit target: `https://mitcorer.edu.in/mitcorer/public/index.php`  
Snapshot date: 2026-11-05 (UTC crawl timestamp is recorded in `crawl.json`).

## What was reviewed

The internal-link crawl recorded **122 successful page responses**, **15 routes that failed after retry**, and **370 unique linked documents** (369 PDFs and one XLSX). The page snapshot contains page text and outgoing internal links. See:

- [`page-inventory.csv`](page-inventory.csv): reachable routes, title, section and extracted text length.
- [`failed-routes.csv`](failed-routes.csv): internal routes that need a second/manual check.
- [`document-inventory.csv`](document-inventory.csv): linked document URL and referring page.
- [`crawl.json`](crawl.json): raw crawl snapshot including extracted page text, internal links and document links.

The largest part of the site is the department section (72 pages), followed by admissions (15), infrastructure (8), placement (8), about (7), and campus life (6). It also includes contact, careers, blog and homepage routes. Department routes include profile, faculty, facilities, activities, syllabus and academic/research content. The linked document set includes a large syllabus and previous-question-paper archive. There are **370 unique linked files**: 369 PDFs and one XLSX. Of those, **316 files were downloaded** and **54 remain inaccessible** (53 HTTP 404 and one HTTP 400).

## Important findings before using this as assistant knowledge

1. **The ongoing sync is on demand.** The backend now starts at the new site root and discovers same-origin HTML routes under `/mitcorer/public`. It does not run on a recurring schedule.
2. **Do not publish this entire crawl as one source.** Department, admissions, placement, policies and news have different owners, freshness requirements and answer scope. Linked files are now extracted into a separate document index; extraction does not confirm that a dated document is still current.
3. **Some pages are generic group content.** Several pages have a `MITVPU` title or generic MAEER/MIT Group claims. The `/about` page is one such page. Confirm relevance to MITCORER before treating its statements as institution-specific facts.
4. **Homepage numbers need DOM-aware extraction.** Its counters render as zero in the captured static text while the HTML advertises JavaScript `data-target` values (6 programs, 360 seats, 20% institute quota, DTE target 6901). The page also separately prints DTE code `06901`. A plain-text scraper can therefore ingest false zeros or lose leading zeros. Resolve counters from rendered DOM / `data-target` and retain the exact source representation.
5. **Claims can conflict with legacy content.** The new homepage says 500+ placed, 100+ companies, 94% placement rate for AY 2024–25, and ₹8.5L average package. Older assistant sources contain different placement figures. Keep year, metric, cohort and source URL together; do not merge those numbers into timeless facts.
6. **An inquiry modal appears in homepage text.** It asks for personal details to enter the site. This is a website access flow, not FAQ knowledge; exclude forms, personal data prompts, menus, and repeated footer/sidebar material during extraction.
7. **Some routes were inaccessible.** The 15 failed URLs are in `failed-routes.csv`; failure is not evidence the page has no content. Later retries and current equivalents are recorded in `route-retry-aliases.csv`.
8. **Crawl completeness is bounded.** The site did not expose a usable robots sitemap during the crawl; navigation links were followed. Hidden pages, client-side-only routes, and documents not linked from those pages may be absent.

## Recommended knowledge ingestion order

### Tier 1 — high-value visitor questions

Admissions overview, FY B.Tech programs/intakes, direct second year, diploma, application and CAP/institute-level process, current notices, fees, scholarships, required documents, contact/enquiry details, and location. These are time-sensitive. Store academic year and effective/expiry dates as structured metadata.

### Tier 2 — department questions

For each of the six B.Tech departments and diploma offerings: department overview, HOD, faculty, program names, facilities/labs, department contacts, student activities and verified achievements. Keep each department page as its own source and apply department entity metadata so a follow-up such as “who is the HOD there?” stays scoped to the previously mentioned department.

### Tier 3 — campus and institutional information

Infrastructure, library, transport/hostel if published, sports, NSS, cultural/technical activities, leadership, vision/mission, committees and contact. Exclude generic parent-group claims unless they explicitly describe MITCORER.

### Tier 4 — policy, placements and academic archives

Placement/internship rules and records, research/patents, syllabus, calendars and question papers. Keep large exam archives in the separate document index and retrieve them only for document-oriented questions. The spreadsheet still needs a working source URL; OCR is complete for the downloaded scanned PDFs.

## Backend changes recommended before bulk ingestion

- Build a site crawler that discovers same-origin pages from navigation and sitemaps, canonicalizes URLs, records redirects/HTTP status, and reports coverage. Do not hard-code a few pages as if they represent the whole site.
- Extract main content semantically (`main`/article) and remove modal, nav, footer, scripts, duplicated cards, forms and non-content widgets. Handle JavaScript counters and encoded text explicitly.
- Preserve page title, canonical URL, section, department/program entity, content owner, captured time, academic year/effective dates, and document version on each source/chunk.
- Stage all newly discovered or changed material as **Review**. Compare it to existing published sources, show exact changes and conflicting claims, then require a maintainer to approve/promote. Never let crawling directly overwrite published facts.
- Chunk by page section/heading and keep sibling chunks linked to their parent page. Avoid mixing several departments in a single chunk; this is a likely cause of cross-department HOD answers.
- Use hybrid retrieval (lexical + embeddings) with metadata filters, followed by reranking. Resolve pronouns/follow-ups using conversation entities (e.g. `department=Electronics and Telecommunication Engineering`) before retrieval; do not use an LLM answer when evidence is missing.
- Evaluate with a labeled question set covering direct lookups, paraphrases, follow-ups, stale/year-sensitive values, ambiguous department names, unanswerable/current-vacancy questions, and citations. Track Recall@K, correct-source rate, grounded answer rate, citation accuracy, abstention quality and latency.

## Crawl import status (2026-11-06)

The crawl snapshot has been imported through the running backend admin API into the assistant's `knowledge` collection:

- **162 retrieval records** across **121 distinct page bodies** are now present. Long pages were split into retrievable chunks, each with its original page URL and crawl-version provenance. The one unrepresented successful URL, `/mitcorer/public/`, is a duplicate of the homepage at `/index.php`.
- **151 records are Published** and available to retrieval. **11 records across five URLs are in Review**: the homepage and `/about` need factual scoping, and three short pages (FY brochure, DSE brochure, Civil industrial visit) need human review because the extraction is very sparse.
- The duplicate homepage alias was collapsed; repeated lines such as site navigation and the inquiry overlay were stripped. Existing knowledge/source records were preserved, and exact repeated text or URLs are skipped by the import script.
- The **15 failed routes and 370 linked files were not part of the first page import**. Their retry and extraction results are summarized below.

The import can be repeated idempotently using `backend/scripts/import-website-crawl.js` with `MITRA_ADMIN_EMAIL` and `MITRA_ADMIN_PASSWORD`. Run with `--dry-run` to preview counts. The manual admin sync action and `npm run sync:website` now discover pages on the new site and stage changes for review. The first sync records a baseline for pages already in knowledge instead of adding another set of records. No scheduled/background sync is configured. The import status confirms that records entered the collection, not that assistant answer quality has been evaluated.

## Retry and linked-document extraction (2026-11-06)

The 15 previously failed routes were retried against the live site. **None of the exact old URLs returned a usable page**: some now return HTTP 404, while others return HTTP 400/500 or close the connection. Several page functions have current replacement routes already present in the successful crawl, including `/placements`, `/placement/policy`, `/placement/record`, `/campus-life/sports`, the Civil question-papers route, and Polytechnic child pages. Routes without a current equivalent are listed in `route-retry-aliases.csv`.

All **370 document links** were fetched with bounded retries:

- **316 files downloaded successfully** (about 1.10 GB total); no byte-identical downloaded files were found.
- **282 PDFs initially yielded embedded text**. Three returned only page labels and were too sparse to index directly. They were included in the OCR pass together with the **34 image-only PDFs**.
- **All 37 sparse/scanned PDFs were OCR-processed** with the built-in Windows.Media.Ocr English engine. The OCR extracted usable text from all 37 documents. One page (page 15 of the 24-page META May 2012 paper) is blank in the source scan and contains no OCR text; the manifest records this page-level gap. The other 23 pages of that paper, including page 24, are indexed.
- **54 links could not be retrieved** (53 HTTP 404 and one HTTP 400). This includes `published-paper-record.xlsx`: the official patents page still links to it, but the file URL returns 404, so the spreadsheet has not been extracted.
- Per-link status, byte size, checksum, extraction type, page count and referring page are in [`document-retrieval-results.csv`](document-retrieval-results.csv) and the full runtime manifest at `backend/data/website-corpus/manifest.json`. Raw files and extracted text are under `backend/data/website-corpus/`; that runtime data directory is ignored by Git.

The downloaded documents now produce **43,222 page-aware chunks across 316 indexed documents**. They are stored in a separate SQLite FTS5 index so question-paper archives do not inflate or slow the general FAQ collection. The assistant searches this index only for document-oriented questions (for example, syllabus, PDFs, question papers, calendars, policies and disclosures). Retrieved evidence retains the original document URL and page range when available. Staff/admin can inspect the index at `GET /api/document-corpus` and search it at `GET /api/document-corpus/search?q=...`.

To rebuild after refreshing the crawl on Windows:

```powershell
python -m pip install -r backend/scripts/requirements-website-corpus.txt
python backend/scripts/extract-website-corpus.py
python backend/scripts/ocr-existing-website-pdfs.py
python backend/scripts/build-website-document-index.py
```

The OCR script uses Windows built-in OCR APIs and runs on Windows. **Coverage is not yet complete.** The 15 exact routes, 54 unavailable links and spreadsheet still need current working source URLs or alternate official copies. The 122-page snapshot and its successful imports remain intact; document retrieval is a separate layer. The per-item manifest is the source of truth for file outcomes. The 397 MB index and raw corpus are runtime data excluded from Git, so a deployment must retrieve/build them in its own persistent environment; this local build has not been deployed.
