# Mitra current completion status

**19 November 2026 � Phases B�D:** Local operations observability, current source routing, and campus image optimization are implemented; speech-to-text is future scope and its icon is disabled. The latest isolated run passed backend 292/292, focused Phase A 13/13, frontend 22/22, public evaluation 36/36, workflow 500/500, browser 49 checks, and bounded audit 150/150. See [AI review evidence](answer-review/AI_REVIEW.md). Human institutional and Marathi/Hindi review and deployment remain pending.

## Implemented and validated

| Area | Current behavior and evidence |
| --- | --- |
| Generation verification | Critical factual topics bypass advisory generation. Selected numeric/promise/citation checks and bounded category/gender/route/service clause checks reject the 11 invalid development probes; the four valid controls remain accepted |
| Known verifier misses | The previously exposed swapped fee and hostel/mess labels are rejected. This closes those specific regressions, not general semantic entailment |
| Conversations | Browser-session ownership, 30-minute idle expiry, bounded history, reset deletion, periodic pruning, expiry recovery and reset-during-generation protection |
| Query scope | Explicit route/year wording retained; negated profile values cleared; topic changes avoid unrelated fee enrichment; inherited scope no longer creates a phantom clause after a question mark |
| Canonical facts | Public facts exclude retired, unavailable, invalid or conflicting canonical records. Planner views no longer revive fixed fee amounts, and archived table images disappear when maintained values/year differ |
| Models | Configurable current embedding model, finite-vector checks, model/content-bound caches and unpublished-record exclusion. Optional bounded transient retry/fallback client, with actual accepted model reported |
| Authentication | Anonymous/malformed refresh returns 401; controlled validation errors; new signup passphrases at least 12 characters; login/signup client limits; production demo hashes rejected; unique admin provisioning command |
| Proxy/deployment preparation | Production same-origin `/api` requests and Vercel-to-Render rewrite; explicit forwarding-header trust; Nginx overwrites forwarded addresses |
| Operations | Liveness/readiness, safe request logs, checksum/WAL-aware backup verification, isolated restore, CI workflow and release/rollback instructions |
| Dependencies | Vite patched from 8.2.2 to 8.2.4; subsequent npm audit reported zero vulnerabilities |

## Latest verification

- Backend: **174/174 tests passed**, syntax check passed.
- Frontend: **16/16 tests passed**, lint and production build passed.
- Developer evaluators: **500/500** routing/content cases and **36/36** public cases passed.
- Exposed paraphrase diagnostics: **24/24** contract checks passed; independent semantic reviews: **0**.
- Browser checks: public-session, maintainer and language journeys passed; complete answer audit **468/468** journeys, using 78 questions × three languages × two isolated corpus snapshots. Numeric list ordinals are excluded from factual preservation checks because the UI renders them as bullets.
- Verifier diagnostics: token checker TP=2, FN=9, FP=0, TN=4; bounded slot/clause checker TP=11, FN=0, FP=0, TN=4 on the same 15 exposed synthetic probes. This is developer debugging evidence, not held-out accuracy.
- Local HTTP smoke: **100/100** non-model requests at concurrency 5 completed without errors. In-memory SQLite, raised test limits and this local machine bound the interpretation; production capacity has not been measured.
- Backup drill: maintained local data backed up, checksummed and restored into a new ignored directory; **1,146 files** verified. Running data was not overwritten.
- Docker Compose configuration validates; container startup was not verified because the Docker Linux daemon was stopped. The deployment target supplied by the user is the existing Vercel/Render site.
- Live pre-release site: public fee query returned 200 and the maintained Open first-year amount. Anonymous refresh returned 500; that root cause is fixed locally. New release behavior still needs post-deployment checks.
- Provider: authenticated model list includes `gemini-3.8-flash`; live `gemini-embedding-001` smoke returned 3072 dimensions. Live generation timed out; mocked retry/fallback/verification tests passed. No live model accuracy or cost comparison is claimed.
- Source links: **37/38 emitted URLs** were reachable in this audit; MSBTE timed out. This is a network reachability observation, not verification of every linked claim.

The source-bound experiment summaries are under `docs/research-review/`. Full generated reports and browser screenshots remain ignored. Historical baseline and post-fix reports are retained rather than rewritten as new results.

## Subsequent local changes (18 November 2026)

- Query understanding now classifies CAP versus institute-level admission wording. Non-CAP, ACAP, Against-CAP and institute-level questions are routed to the maintained ACAP record rather than the generic B.Tech/CAP answer. The exact non-CAP prompt has a regression test; this does not verify current vacancy or admission availability.
- Marathi and Hindi phrases for institute-level admission are now normalized to that same bounded route and tested to select the ACAP record. The tests verify routing only; they do not establish translation fluency.
- Parent-style college classification questions now use a separate 2026-27 Maharashtra CET Cell institute-summary record for Un-Aided, Non-Autonomous, and Non-Minority status. Selected Marathi/Hindi phrases normalize to this same route. The answer is year-scoped and keeps institution classification distinct from CAP/ACAP route; this source does not establish future-year classification or fluent translations.
- Parent/student search phrases for programmes, DSE/lateral entry, diploma, fees, hostel, placements, contact, campus visits, and CAP/ACAP have been added as aliases on the corresponding knowledge records. An additive migration applies the aliases to existing local databases without replacing maintained record text or custom tags.
- Admission-quota questions now distinguish programme/year-specific CAP seat categories (including applicable State/All India, reservation, EWS and TFWS entries) from institutional-quota or post-CAP vacancy processes. KB-55 cites official CET Cell and MITCORER notices; it does not claim a fixed management-quota percentage or seat availability. The 2026-27 process is marked closed on the CET Cell portal, and other years require their own current notices.
- A source conflict surfaced during parent-style keyword review: the 2026-27 MITCORER First Year B.Tech page lists AI & Data Science choice code 0690126310, while the CET Cell institute summary lists 0690199510. KB-56 makes Mitra disclose both sources and ask applicants to verify the live CAP option-form code; this discrepancy is not presented as resolved.
- Successful `assistant_pipeline` logs now include up to five ordered `evidenceCitationIds` aligned with evidence record IDs. These identify the returned record revision and passage hash; they are not a corpus manifest and do not establish answer correctness.
- Backend syntax check passed with `npm.cmd run check`; the backend suite passed 252/252 tests with `npm.cmd test -- --test-reporter=dot`. These are local backend checks and do not represent frontend validation, independent evaluation, or deployment verification.
- A 192-question deterministic diagnostic sampled from the assistant-authored development bank ran with 48 questions each in English, Marathi, Hindi and Hinglish and zero provider calls. It exposed an anonymous document-status routing mismatch, now covered by privacy and account-isolation regressions; the same check surfaced missing fee/hostel source URLs that require institutional source confirmation. See `.arena/runs/multilingual-192/` for case-level reports. This is not independent accuracy or language-quality evaluation; fluent-speaker review and source adjudication remain pending.

## Institutional review and source evidence

## Recent user-facing follow-up and document workflow fixes

- Public chat follow-up clarification now carries the original document question with the chosen First Year or Direct Second Year route, so a short reply such as “for first year” does not become an unrelated standalone query.
- Applicant and parent accounts now have a public entry point to sign in/create an account, upload documents, submit a batch for staff review, and view their own statuses and correction notes. Uploaded files remain behind the existing authenticated, owner-scoped document API. Anonymous chat cannot inspect private document status.
- “Send question to staff queue” states where the request is stored: the MITCORER Staff Triage queue in the admin Review Inbox. It remains unassigned until staff assigns it; this workflow does not automatically notify a named person or send email/SMS.
- Placement responses now name the project-reported current student platforms (POD, Superset, Unstop) and placement drives, while directing historical recruiter/package claims to dated official records. Unscoped figures and a fixed recruiter list were removed because the public pages expose year-specific archives rather than a live current lineup. Platform names were supplied by the project owner and are not independently verified by a public source in this change.
- Compound address/contact/office-hours/travel questions are answered as separate evidence-backed sections. KB-46 records the Contact page check dated 2026-11-18: the page lists contact details and local Barshi directions but no current office hours, working days, visiting schedule, or Solapur-city route. The answer cites this dated observation and asks users to call before visiting. The separate Bus Facility page does not publish a route list, timetable, or fare.
- Staff can review submitted applicant documents from the admin Document Review page. Applicant uploads appear there only after they submit them; drafts remain private to the account owner.
- Institution classification output is structured as a short list. A passage revision/citation ID identifies the referenced evidence revision; it is not an evaluation manifest, human label, independent review, or proof that the answer is correct.

The project team reports that department professors reviewed responses internally and that institutional facts were transcribed from approved/signed circulars. No itemized faculty scoring rubric or independent numerical review file was provided. The three archived fee-table crops were visually inspected and match the canonical annual amounts. The inspected crops do not show signature/certification blocks, so this task does not independently authenticate the full signed originals. See `research-review/archived-fee-source-manifest.json` for their paths and hashes.

The original 18 public cases, 24 paraphrases, 15 mutations and existing blinded development packet remain exposed development material. Faculty approval reported by the team is not relabeled as an independent accuracy score. Formal Marathi/Hindi speaker ratings remain pending as the team confirmed.

## Explicitly unresolved external requirements

| Requirement | Why it is not marked complete |
| --- | --- |
| Independent final questions, labels and reviewer agreement | No new independent questions or adjudicated scoring records were supplied; these cannot be invented by the implementation agent |
| Formal language quality ratings | Competent-speaker rating sheets have not been conducted/provided |
| General semantic entailment and prompt-injection resistance | Bounded checks and selected tests do not establish universal correctness; broader independent evaluation is required |
| Successful live generation and cost study | The smoke timed out; provider/network/budget conditions need further operational measurement |
| New cloud release, persistent storage and monitoring | Commit/push approval and provider-side verification are pending; the declared free Render configuration does not establish durable SQLite storage |
| Hosted CI and cloud load/backup scheduling | Workflow/scripts are prepared; execution and scheduling need the approved release/provider environment |
| Remaining legacy prose/templates | Retained applicant/planner/institutional prose is not a fully normalized universal source of truth; no blanket claim that every fact is centralized is made. Further domain-specific consolidation must preserve the existing workflows and needs its own acceptance criteria |

This report closes the reproduced high-risk regressions and prepares the review/release materials. It deliberately does not call the system production-ready or independently evaluated.

## Commit boundary

No commit or push has been made in this task. Before proceeding, the user must approve the concrete reviewed change set. Unrelated pre-existing deletions and the old unverified IEEE Markdown/Word drafts remain outside the proposed change set. A push to the deployment branch may trigger provider auto-deployments; follow [operations instructions](OPERATIONS.md) before calling the release verified.

## Consolidated implementation and evaluation notes

- Operations: Assistant event summaries are held in process memory for 24 hours, capped at 500 events, and summarized in four rolling six-hour buckets. They omit question and answer text, tokens, contact details and IP addresses. Restarting the process resets them; durable monitoring needs an approved destination and retention policy.
- Sources and rural access: Scholarship and admission follow-ups route to relevant official pages and do not invent scheme-specific document requirements. The campus background was compressed from 953,906-byte PNG to 104,694-byte WebP. Institution-approved checklist sources are still needed.
- Speech input: Future scope. The microphone icon remains visible but disabled; no speech recognition or audio processing is active.
- Retrieval experiment: On 30 assistant-authored development questions, evidence-group Recall@3 was 100.00% for the current keyword/rules method, 81.67% for plain BM25 and 95.00% for normalized-query BM25. These are facet-group retrieval measures, not answer-accuracy scores. Production retrieval remains keyword/rules based. The retrieval review workflow retains misses, frozen corpus and pending independent judgments.
- Answer presentation: The answer audit catalogue covers 71 public question families in English, Marathi and Hindi. Browser checks and answer-source audit scripts test cards, topic links and citation order; they do not certify institutional facts or language quality.
- Evaluation tools: Backend provides evaluate:public, evaluate:retrieval, evaluate:verifiers, evaluate:guardrails, and evaluate:document-agent. The optional external judge requires MITRA_ENABLE_EXTERNAL_EVAL=true, sanitized reviewed cases and provider credentials; its recorded pilot produced no usable quality score. A previous RAGAS attempt also produced no score, and its optional runner has been removed. The 90-case diagnostic set is synthetic and unreviewed. See the answer-review packet for pending human review requirements.