# Backend query understanding — approved first phase

Implemented on 10 October 2026 following explicit user approval. Scope: backend interpretation, regression tests and documentation. Frontend layout, answer rendering, fee/course table structure and source-link presentation were not edited in this increment. No dependency, paid API call, database migration or retriever replacement was introduced.

## Current technology and behavior

The public assistant uses Node.js, persisted SQLite knowledge, weighted keyword/rule retrieval, deterministic factual answers and existing Hindi/Marathi templates. Gemini remains an optional generation fallback; it is not the query parser. BM25 remains experimental.

`backend/src/query-understanding.js` provides a shared, bounded domain parser. It normalizes known plurals and paraphrases, recognizes a unique one-edit spelling correction only for long words from a small college-domain vocabulary, and extracts topics, branch, route, academic year, fee category, gender and service scope. Whole-token rule matching avoids interpreting “coffee” as “fee.” Numbers, choice codes, decimal scores, qualifications and negation are retained.

`query-scope.js` shares branch/service scope and consecutive academic-year parsing across English facts and native templates. The maintained answer builder and compound-question planner consume these fields. Hindi/Marathi conjunctions split relevant facets while official multiword programme names stay intact. Missing or contradictory personal fee details and ambiguous routes receive clarification using the existing response path. A supported compound section can still answer while another asks for clarification.

The shared parser now also extracts an `admissionPathway` field for CAP versus institute-level routes. Non-CAP, ACAP, Against-CAP and institute-level wording is routed to the maintained ACAP passage instead of the generic B.Tech/CAP answer. This determines the requested path; it does not establish current seat availability.

Institution-status queries (college/institute type, aided versus unaided, autonomy, and minority classification) route separately from admission-pathway queries. Selected Marathi/Hindi words for college type, autonomy, aided/unaided, and private/government are normalized to the same bounded intent. The current MITCORER classification record is explicitly scoped to AY 2026-27 and cites the Maharashtra CET Cell institute summary. A question about another year abstains and links to the CET Cell portal instead of reusing the old status. Routing tests do not establish fluent answer translation.

Admission quota terms are treated as a separate intent from general CAP vs institute-level routing. The answer distinguishes year/programme-specific CAP seat categories from institutional quota and post-CAP vacancy processes, links to CET Cell and MITCORER notices, and avoids inferring a fixed quota percentage or availability. Exact seat counts require the relevant programme/year seat matrix. Parent/student phrasing aliases were added to the existing programme, DSE, diploma, fees, facilities, placement, contact and timing records; an additive startup migration merges aliases into existing persisted records without replacing their maintained text or custom tags.

During verification, the CET Cell institute summary and MITCORER's First Year B.Tech page were found to list different AY 2026-27 AI & Data Science choice codes. Choice-code questions disclose both official values and link to both sources; users are directed to confirm the code in the live CAP option form. This source discrepancy remains unresolved.

Marathi and Hindi phrases for institute-level admission are normalized to the same route and regression-tested against the ACAP evidence record. These checks establish intent routing for the listed phrases only; a fluent speaker still needs to review the language quality of the answer.

Uploaded-document review-status questions are handled separately from document-requirement questions. The public assistant does not inspect an applicant's private document records; it directs the user to the official admissions contact page. Authenticated status summaries remain scoped to the requesting account. This route is covered with English, Marathi, Hindi and Hinglish diagnostic prompts, but the native-language phrasing has not had fluent-speaker review.

Examples covered by regression checks:

| Question | Required behavior |
| --- | --- |
| First-year fees for OBC girls? | Select the girls' concession amount, not the boys' amount or DSE table |
| I passed class 12. Direct Second Year fees? | Keep the qualification; select DSE, not First Year |
| What reading resources are available? / lbrary | Retrieve the library record |
| प्रथम वर्ष की फीस तथा छात्रावास की फीस | Answer academic fees and hostel fees as separate existing-format sections |
| प्रथम वर्ष शुल्क तसेच वसतिगृह शुल्क | Recognize both fee facets |
| I am not OBC. First-year fees? | Ask for the applicable category rather than infer an amount from an exclusion |
| OBC first-year fees? | Ask for boys/girls when selecting a concession amount |
| Mess fees, not hostel | Keep the mess scope rather than add hostel amounts |
| CSE seats and intake / CAP फेरी / CAP राउंड | Preserve existing seat-matrix and CAP routing |
| AY 2026/27 or 2026-2027 | Recognize the same consecutive academic year |
| AY 2026-29 | Clarify the invalid academic-year range |

## Validation

Regression checks use isolated test databases with Gemini disabled; the user's maintained database is not reset. These are exposed development diagnostics, not independent held-out accuracy measurements.

- Backend suite: 114/114 tests, including three new parser/API test groups with positive, negative, ambiguous and multilingual cases.
- Existing legacy diagnostic benchmark: 500/500.
- Public contract/evidence diagnostic benchmark: 18/18.
- Paraphrase diagnostic benchmark: 24/24; independent semantic reviews remain 0.
- Existing frontend unit checks: 15/15, covering answer formatting and source links.
- Language browser checks: 14 real API journeys, keyboard/mobile selector, empty-submit guard, safe literal rendering and network recovery passed. Human speaker approval remains pending.
- Maintainer browser checks: save failure, revision conflict, translation staleness, separate-process persistence, retirement and server authorization passed.
- Comprehensive browser audit: 426 real API answer journeys across seeded and maintained knowledge in English, Hindi and Marathi. Checks include factual numbers, complete source links, fee notices, mobile overflow and absence of the evidence panel.

Commands from the relevant directory:

```powershell
# backend
npm.cmd test
npm.cmd run evaluate
npm.cmd run evaluate:public
npm.cmd run evaluate:paraphrases
npm.cmd run check

# frontend; existing source is unchanged
npm.cmd test
npm.cmd run test:language-browser
npm.cmd run test:maintainer-browser
npm.cmd run test:all-answers-browser
```

## Limits and next increment

This is bounded domain interpretation, not general semantic understanding or a trained model. Spelling correction covers selected long ASCII domain words; unsupported phrasing and indirect/complex negation can still fail. Conversation context is not implemented. Human speaker approval of new clarification translations remains unverified, and uncovered prose retains explicit English fallback. Generated Gemini answers still need independent claim validation. No general accuracy or performance improvement is claimed from these development checks.

Next proposed increment requires separate user approval: backend-only validation of generated factual fields and allowed citation IDs, with refusal behavior and regression tests. It must preserve the existing public layout and answer format. Independent relevance judgments, a separately authored final benchmark and deployment verification also remain pending.

Restart an already-running backend to load this code; the development command does not watch files automatically.
