# AI semantic review of the 150 development answers

18 November 2026. The user selected AI review first, with human review later.

## Assessment

The assistant read all 150 questions and answers against their supplied evidence passages, including the 28 Marathi/Hindi requests and their localization metadata. Repeated answer families were checked for consistent facts, labels, numbers and conditions; multi-turn cases were read in their supplied conversation order. This is an AI review by the same assistant involved in implementation, not an independent benchmark or a native-speaker approval. No external LLM judge was invoked.

The review identified **11 grouped findings**: two high-priority scope errors, four medium-priority completeness/content issues and five lower-priority wording/consistency issues. These are findings on development outputs, not an estimated error rate. Several cases have multiple findings.

## Implemented corrections

- **AUD-148:** requesting a leaked exam paper previously returned an unrelated public student-achievement document. The answer now refuses the request before document retrieval and directs users to legitimate material. Legitimate officially published past-paper queries are not blocked by this boundary.
- **AUD-146:** asking for VIT Pune fees previously entered MITCORER's fee-clarification flow. Explicit named external institutions now receive an out-of-scope response before MITCORER retrieval. The rule covers a bounded list of institution names; it is not general entity recognition.
- **Hindi fallback template:** replaced awkward agreement with a concise notice stating that a reviewed Hindi translation is unavailable. Mixed-language output remains honestly labelled; this does not provide missing translations or claim human review.

The new refusals support English, Marathi and Hindi and mark native templates as awaiting speaker review. `backend/test/maintained-answer-regression.test.js` covers scope refusals, native metadata, a legitimate past-paper query and an ordinary MITCORER fee query. Original audit artifacts and human rating fields were not overwritten.

## Finding dispositions after the local fixes

| Finding | Cases | Current disposition |
|---|---|---|
| AIR-03 | 052, 135 | The answer asks for the scheme/year and links users to current official scheme portals without inventing a document list. Exact scheme requirements still need institutional source confirmation; the MITCORER checklist page could not be fetched during this review. |
| AIR-04 | 051 | The answer now includes the maintained CAP steps and eligibility conditions, then asks which route applies. Current-year notices still govern dates and candidate actions. |
| AIR-05 | 134 | Public about answers omit the unsupported blanket “verified guidance” claim. The maintained source record was not edited. |
| AIR-07 | 004 | The answer labels the figures as annual totals and says the passage does not establish tuition-only amounts. |
| AIR-08 | 017, 020, 054 | The same conditional checklist and route/category question are used. Romanized Marathi receives an explicit fallback notice and the English checklist because no reviewed complete Marathi version is available. |
| AIR-09 | 105, 111, 113, 133 | Hostel-only amounts use hostel-specific headings; requested hostel/mess amounts remain separate. |
| AIR-10 | 140 | The answer says no maintained cutoff exists for the requested future year; it does not predict or invent one. |
| AIR-11 | 150 | The answer states that no verified amount is established and directs applicants to current official scheme notices. |

AIR-01, AIR-02 and AIR-06 are also covered by the new regression set. After the complete run, `ai-review.json` records which software behaviors passed. Its 150/150 result remains a bounded contract check, not independent factual validation. AIR-03 still needs an institution-approved scheme document source, and the factual claims, Marathi/Hindi wording, and new voice copy remain pending competent human review.

## Language assessment

In the reviewed numeric templates, the displayed academic years, fee amounts, hostel/deposit totals, programme intake and choice codes matched the supplied passages. The reviewed native text retained the important annual-fee, refundable-deposit and non-guarantee distinctions. This limited observation does not certify the institutional figures themselves.

The 12 fallback/partial outputs remain a usability limitation for people who cannot read English. Native notices are preferable to fabricated translations, but they do not satisfy complete native-language guidance. Terms such as "सीधे द्वितीय वर्ष Engineering", retained English programme names and category abbreviations need a competent-speaker terminology review. New refusal templates also await that review. No fluency percentage or human approval was assigned.

The fee source lacks a source URL in the supplied evidence. Verify the approved fee circular and category conditions before institutional sign-off. The earlier screening's 54 missing-source-URL and 121 missing-verified-metadata counts remain verification prompts, not proven inaccuracies.

## Evidence and limitations

[ai-review.json](ai-review.json) records a disposition for every case, the findings, and the SHA-256 of the reviewed packet. Its authoring script serializes these AI annotations; it does not independently rerun semantic judgment. The original [review sheets](review-sheets.md) remain the pre-fix outputs and all human ratings remain blank. Preserve them for before/after comparison.

The two high-priority examples passed the old bounded contract checks despite being semantically inappropriate. Therefore 150/150 must continue to be described as a bounded development-check result, never as independently established accuracy. Current validation and post-fix responses are stored separately under `ai-validation/` when the run finishes.

No institutional records, production databases or deployment were changed. Human factual and Marathi/Hindi approval remains pending.

## Validation result

The complete disposable runner exited zero on 19 November 2026. Backend: **292/292**; focused Phase A regressions: **13/13**; frontend: **25/25**; browser: **49**; public development: **36/36**; workflow: **500/500**; original audit: **150/150 bounded checks**. Maintainer and public-session journeys, production build and lint passed. [Execution evidence and post-fix answers](ai-validation/validation.json) are retained separately from the reviewed pre-fix packet. The scenario result is a bounded development contract check, not an independent accuracy claim.

[Download the AI review and evidence](MITRA_AI_REVIEW.zip).
