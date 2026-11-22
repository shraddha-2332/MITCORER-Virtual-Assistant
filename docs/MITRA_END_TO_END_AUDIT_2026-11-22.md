# MITRA end-to-end audit

## Final verification · 22 November 2026

The local application passed its core regression suites. Live health checks passed. Answer quality, some official source links, and production operations still have open verification items.

| Check | Result |
| --- | --- |
| Revised question bank | 214/214 entries returned HTTP 200 with answer text. All 14 tagged turns ran in their three conversations. The outcome distribution was 150 answered, 29 clarification, 28 insufficient evidence, four partial, and three unsupported. Cases 90, 178, and 196 returned answers supported by KB-43, KB-17, and KB-2 respectively. This run checks API and conversation behavior. |
| Developer diagnostic | 79/90 expected decisions matched and 44/54 answer-expected cases retrieved expected evidence. The 11 decision mismatches were reviewed against their prompts and retrieved evidence. Three admission guarantees, one future hostel guarantee, and one unpublished bus timetable/fare warranted a limit. One DSE fee response contained the requested amount and a spurious unresolved section. Five Marathi or Hindi requests for personal scholarship timing, personal Pragati approval, or a guaranteed recruiter/package returned general content without clearly addressing the personal limit. The Hindi scholarship timing case retrieved unrelated evidence. |
| Local browser | Microsoft Edge passed 21/21 mobile checks and 49/49 browser checks, including keyboard focus, formatting, and retry behavior, in addition to the earlier Chrome results. |
| Live endpoints | The Vercel homepage, Vercel-proxied health endpoint, and direct Render health endpoint each returned HTTP 200. These checks establish reachability. The revision running in production and authenticated workflows remain unverified. |
| Official links | 366/372 unique HTTPS URLs from published records and indexed documents passed the link checker. Five returned HTTP 404, including the MoU citation used by KB-43. The scholarship portal URL could not be verified on that run. |
| Live crawl | Read-only discovery found 137 pages and fetched 122. Of 15 failures, seven returned 404, seven returned 500, and one returned 400. Website sync remains paused and discovery did not modify maintained records. |
| Providers | Configured Gemini and Groq models each generated the expected response to a synthetic smoke prompt through the application’s provider clients. Real-provider answer grounding still needs a reviewed quality run. |
| Docker | Compose configuration passed with a disposable secret. The Docker daemon was unavailable for runtime verification. |

The six link-check exceptions were the [MITCORER MoU page](https://mitcorer.edu.in/our-mou.php), [campus life page](https://mitcorer.edu.in/campus-life.php), [training and placement page](https://mitcorer.edu.in/training-placement.php), [2026 CET institute summary](https://fe2026.mahacet.org/StaticPages/frmInstituteSummary?InstituteCode=06901), [2024 CET portal](https://fe2024.mahacet.org/StaticPages/HomePage), and [National Scholarship Portal scheme list](https://scholarships.gov.in/All-Scholarships).

## Fix verification

- Tuition requests now remove explicit exclusions for hostel, mess, and transport charges before routing. Requests that include hostel fees still return the supported combined breakdown.
- Placement preparation now returns the training topics in the published Corporate Readiness record, including aptitude, reasoning, résumé preparation, technical skills, and mock interviews. The answer directs students to the Training and Placement Cell for current details.
- A campus visit request for location and contact details now returns those details as one complete answer.
- The applicant design pilot opens at `/?ui=shadcn-applicant` on the Vite development server. Its document checklist describes self-reported preparation. The regular homepage remains the default entry.

The updated backend suite passed 316/316 tests. The 150-case audit passed with and without the document index. All six targeted API requests passed against a maintained SQLite snapshot. Chromium verified pilot navigation and viewport bounds at 320, 390, 768, and 1440 px.

## Full local retest · 22 November 2026

The public assistant, applicant checklist, staff inbox, and administrator publishing workflows passed their browser suites. The expanded question-bank run found three reproducible answer-quality defects. Testing used Node 22.23.1 and Chromium on a disposable copy of the working tree, with a consistent SQLite snapshot for maintained-data checks and external model calls disabled.

### Verified coverage

| Area | Current result |
| --- | --- |
| Backend pipeline and storage | 315/315 tests passed. Suites cover API contracts, auth and roles, sessions, streaming, retrieval and generation fallback, evidence and provenance, migrations, backup/restore, and source intake through publication. The original maintained SQLite database passed a read-only integrity check. |
| Source and build | 206 files passed static parsing (145 JS/MJS, four Python, 57 JSON). Frontend lint and production build passed. Frontend utilities passed 24/24 tests. Static parsing establishes file validity, while the functional suites establish behavior for exercised paths. |
| Public browser and styling | 49 viewport and formatting checks, 21 mobile checks, and 14 language journeys passed. Checks include keyboard focus, list and table rendering, mobile overflow, loading and retry states, feedback, and safe rendering of fixture text. |
| Applicant and staff | Browser checks passed for CAP and reporting guidance, checklist save and reload, public session isolation/reset, staff inbox, and the staff checklist view. |
| Admin workspace | Browser checks passed for sign-in with invalid and offline states, quality monitoring, knowledge verification, stale revisions, persistence, and publication into public chat. Unsigned and staff edit requests returned 401 and 403. The knowledge editor stayed within the viewport at 320, 390, 768, and 1440 px, and the Cancel control was reachable at each width. |
| Question contracts | Workflow 500/500, strict public 36/36, reviewed regression 150/150 with the document index present and 150/150 without it, and paraphrases 24/24. The browser answer catalogue passed 426 real API journeys across seeded and maintained data and three languages. These sets may overlap. |
| Broader question bank | The file named test-bank-200 contains 214 entries. All returned an HTTP 200 response with answer text on the maintained snapshot. As standalone requests, 146 were marked answered, 31 clarification, 28 insufficient evidence, six partial, and three unsupported. All 14 tagged turns were also replayed in their three conversations. The CSE-to-Civil branch switch correctly preserved intake context. HTTP success and response labels alone provide no factual accuracy score. |
| Developer diagnostics | 79/90 expected answer/clarify/abstain decisions matched, with 11 differences. Expected evidence was found on 44/54 answer-expected cases. The 90-case set is synthetic and non-independent. The first run lacked Git metadata in the disposable checkout, then completed using read-only access to the original Git metadata. |
| Retrieval and verification | Across 44 cases and 69 records, keyword evidence-group recall at 3 was 98.86% and expanded slot-aware keyword recall at 3 was 100%. The document comparison returned 2/2 for the candidate and 1/2 for its baseline. Guardrail fixtures passed 20/20 ingress, 4/4 retrieved-context, and 10/10 behavioral checks. The slot verifier passed 15/15 synthetic drafts. |
| Local performance | 100/100 valid HTTP responses at concurrency 5. p50 was 44 ms and p95 was 73 ms in the in-memory smoke test with the rate limit raised and external model calls disabled. |

### Findings from the full retest

| Priority | Reproduction | Observed behavior |
| --- | --- | --- |
| High | Bank 196 asks for CSE fees and explicitly excludes hostel and transport. A more specific variant asks for first-year Open CSE tuition excluding those charges. | The first answer includes the INR 40,000 hostel total. The specific variant labels academic fees as “Hostel fees” and adds bus information. The tuition-only control without an exclusion clause uses the academic fee record. The defect reproduced without the document index. |
| Medium | Bank 90 asks “What skills should I learn for campus placements?” A second phrasing asks how to prepare. | The first returns a historical recruiter list, and the second describes the Placement Cell and internships. Both report an answered outcome while omitting the requested skills or preparation guidance. |
| Medium | Bank 178 asks for location and contact details for a visit. The shorter “Share the location and contact details” also reproduces it. | Both include the address and contact information, but insert a generic “Other requested information” evidence gap and mark the response partial. |
| Informational | Open `/?ui=shadcn-applicant` under Vite. | The public homepage renders. The pilot component has no route or importing entry point in the working tree, so its styling and interactions were unavailable through the app. |

Evidence was saved under `%TEMP%\mitra-phase-a-validation-KS6Cpp`, including the per-file static results, the full standalone and contextual question-bank responses, targeted reproductions, and editor screenshots. Application changes were outside this testing pass. Coverage gaps include per-file behavioral verification across the entire repository, all external links and documents, a live recrawl, live model output, native-speaker and institutional factual review, assistive-technology and cross-browser checks, production authenticated workflows, and production capacity. Docker runtime checks were blocked by the unavailable daemon.

## Original audit and remediation history

22 November 2026 · Current local working tree, including existing uncommitted applicant workspace changes

## Remediation follow-up

The seven reproduced answer issues were fixed locally. The timetable query uses the official PAHSU navigation route. The seat and deposit queries use the published intake and accommodation records. The four unsupported requests explain the evidence limit and link to the college contact page. Focused regressions passed against the seeded data, and the same seven questions passed through the public API on a copy of the maintained database. Both checks ran with the document index present and absent.

The audit runner now exits 1 after recording a failed or errored case. A disposable run with one forced failure confirmed the exit code.

The follow-up expanded checks to related phrasings, including Solapur University exam schedules, remaining seats in another branch, dormitory caution money and mess fees, refund timing, step-free access, teaching assignments, private WhatsApp details, and attendance percentages. Indexed timetable searches require a timetable title and the requested session year, plus the named month when supplied.

The Blueprint uses free Render with bundled knowledge and an ephemeral filesystem. Durable SQLite, uploads, and indexed document search use the local or Docker deployment. The operations guide covers provisioning and backups. The mobile audit passed all 21 checks after removal of the remote font request and now reports failing request URLs. Frontend lint is clean. Strict verifier diagnostics gate the slot-aware checker while reporting the token-only baseline separately. Production rollout and paid persistence are outside this follow-up. The sections below record the original audit baseline.

## Final assessment

The core local applicant, staff, and administrator journeys work through Chromium and the real API. The assistant still returns topically related but unresponsive answers for several ordinary questions. The 150-scenario audit returned 147 passes and three failures, although the wrapper exited successfully. The deployed homepage and the Vercel-to-Render health route both returned HTTP 200.

## High-priority issues

| Question or check | Observed result | Correct behavior |
| --- | --- | --- |
| Where do I find the PAHSU exam timetable? | `ANSWERED` with a March/April 2024 question paper excerpt about KNN. Indexed document retrieval returns before the official navigation handler. | Route explicit navigation to the [PAHSU Time Table page](https://www.sus.ac.in/examination/Time-Table). Require appropriate document type and session when returning a specific timetable. |
| What are the first year Civil Engineering seats? | `ANSWERED` with eligibility requirements from KB-5. | Resolve whether the user wants sanctioned intake or live vacancy, and use the maintained branch and year data or ask a focused clarification. |
| How much is hostel including deposit? | Audit case AUD-010 returned general hostel amenities from KB-23. | Recognize deposit as a charge and use maintained accommodation fee evidence, including the refundable deposit where supported. |
| Is there wheelchair access in the hostel? | Both this question and a girls’ hostel ramp variant returned KB-23 amenities with `ANSWERED`. The passage contains no wheelchair access evidence. | State that accessibility could not be verified and provide the applicable official contact. |
| 150-scenario check in CI | `docs/audit-confirm.mjs` writes the summary but sets no failing exit status. `scripts/verify-phase-a.mjs` trusts process status, so it reported exit 0 with three known failures. | Fail on contract failures or evaluation errors after saving the report. |
| Render persistence configuration | `render.yaml` specifies a free service and a persistent disk. Render documents disk support for paid services. Live health succeeded, but the deployed disk configuration was unavailable. | Align the Blueprint plan and persisted storage, then verify data and uploaded files after a restart. The native deployment mounts `/app/data`, while the source file handler uses `backend/official-sources` relative to the application tree. |
| Indexed retrieval deployment | The local index has 316 documents and 43,222 chunks. The Docker image copies only the package manifest and application source, and the Docker ignore file excludes data. The index lives under the backend data directory and is opened read-only when present. | Provision the index explicitly on a fresh deployment and verify the staff-only corpus status endpoint. Health checks alone do not establish corpus availability. |

## Medium-priority issues

- “Who teaches first year mathematics?” returned a department-head overview from KB-38. The faculty directory trigger misses “who teaches,” and a staff profile alone cannot verify a teaching assignment.
- The HOD personal-mobile request (AUD-144) returned a department-head record without the requested number. A clear boundary and public office contact would answer the request more directly. No personal number was observed.
- “What is tomorrow attendance?” (AUD-147) returned generic CBCS attendance rules from KB-31. The reply needs to state that it cannot verify tomorrow’s schedule or individual attendance and point to the official timetable or office.
- On 15 synthetic verifier scenarios, the token verifier missed nine of 11 invalid drafts. The slot verifier detected all 11 and correctly accepted all four valid drafts. These diagnostics do not establish live generation quality.
- The mobile tester passed 20 of 21 checks. Its console check recorded `ERR_NETWORK_ACCESS_DENIED`. The HTML loads Google Fonts remotely, but the tester did not record the failed URL, so the cause is unconfirmed.
- Frontend lint passed with two warnings involving `Date.now()` during render and a mixed component export affecting Fast Refresh.

## Verification evidence

| Area | Result |
| --- | --- |
| Backend and API | 312/312 automated tests. Coverage includes auth and role checks, public-session isolation, streaming, storage migrations, backup, source upload and publishing, website-sync fixtures, grounding and provenance. |
| Source syntax and frontend | 146/146 JavaScript and module scripts passed Node syntax checks. Frontend passed 24/24 unit tests and the production build. Lint completed with two warnings. |
| Public browser | The Phase A browser suite passed 49 checks. The answer catalogue passed 426 browser-to-API rendering journeys across seeded and maintained data in English, Marathi and Hindi. It checked numeric token preservation, link rendering, local notices and viewport overflow. Other browser suites exercised session reset, session isolation, language controls, safe rendering, feedback and network recovery. |
| Applicant and staff browser | CAP/reporting guidance, checklist save and reload, staff inbox, and staff checklist flow passed. |
| Administrator browser | Sign-in, authorization, knowledge verification, revision conflicts, persistence, source review and publishing into public chat, and dashboard navigation passed. |
| Answer evaluation | Workflow 500/500, strict public contract 36/36, paraphrase diagnostics 24/24, reviewed development contracts 147/150. These are distinct, bounded test sets and may overlap. |
| Retrieval | 44-case evaluation over 69 records. Keyword evidence-group recall at 3 was 98.86%. Expanded slot-aware keyword recall at 3 was 100% on that set. A local document corpus was present during the PAHSU reproduction. |
| Maintained SQLite | Read-only quick check returned `ok`. A consistent snapshot contained 69 published and one archived knowledge record, plus 30 published, one in-review, and one archived official-source record. Local health, readiness and public facts returned 200. |
| Maintained translations | All 132 present Hindi/Marathi translations matched their English text hash and are flagged pending human review. Six translation entries were absent across KB-2, KB-3 and KB-10. Fee records may use structured rendering independently of stored passage translation. |
| Maintained citations | Eight published records lacked a source URL (KB-2 through KB-8 and KB-69). Some may use offline notices or frontend reference images. Verify the user-visible evidence path before adding links. |
| Deployment | Render direct health, Vercel homepage and Vercel-proxied health returned 200. Docker Compose configuration parsed with a disposable placeholder secret. Docker runtime validation was blocked by the unavailable daemon. |

## Pipeline reviewed

The public widget calls the Vite or production proxy, which forwards to the Node API. The API applies public session and request handling, resolves language, context and query intent, and selects structured handlers, document search, maintained knowledge retrieval or optional grounded generation. Evidence and status return to the widget for formatting. The administrator workflow stages source material for review before publishing it into the answerable knowledge base. The applicant checklist persists self-reported progress through the signed-in workspace API.

## Remaining verification

The seven original answer regressions passed with and without the document index. The 150-case suite also passed in both configurations, and a forced failure confirmed that the runner exits with code 1. The later fee, placement, and visit fixes passed six targeted requests against a maintained SQLite snapshot. A local 100-request smoke test at concurrency 5 also passed.

- Resolve the six actionable diagnostic mismatches. Obtain human review of the broader question bank against current official evidence.
- Recheck the six link exceptions, reconcile the 15 crawl failures, and review real-provider grounding. Extend behavioral coverage and check links outside the published records and document index.
- Obtain native-speaker sign-off and institutional factual verification. Extend browser coverage beyond Edge and Chrome and complete assistive-technology checks.
- Verify deployment of the local fixes, authenticated production workflows, Docker runtime, production load capacity, and production backup and restore.
