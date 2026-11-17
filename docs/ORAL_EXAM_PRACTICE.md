# Mitra oral-exam and answer verification practice

Use the first section as live questions for Mitra. Compare answers with the expected behavior; do not score a response as correct merely because it sounds confident. For changing details, check the linked official notice and academic year.

## Questions to ask Mitra

### Normal parent and student questions

1. What B.Tech programmes does MITCORER offer, and what is the published intake for each?
2. What is the difference between First Year B.Tech and Direct Second Year admission?
3. What is the diploma admission process after Class 10?
4. What are the basic First Year B.Tech eligibility requirements through MHT-CET or JEE Main?
5. What is the CAP admission process, from registration to reporting?
6. What is the non-CAP or ACAP admission process?
7. What admission documents should an Open-category applicant prepare?
8. What are the First Year Open-category fees for AY 2026-27?
9. What are the hostel and mess charges, and which amounts are refundable?
10. What facilities are available on campus and in the hostels?
11. What placement support and published recruiter information are available?
12. What is the college address, contact number, and official website?
13. How far is MITCORER from Solapur, and how can I reach the campus?
14. What are the college office timings, and how do I ask about a campus visit?

### Recent query-understanding and knowledge changes

15. Is MITCORER autonomous or non-autonomous? Is it aided or unaided?
16. Is MITCORER a private or government college? What does its official classification actually say?
17. What does “admission quota” mean at MITCORER? Explain CAP seat categories separately from institute-level and post-CAP vacant seats.
18. Does MITCORER have a guaranteed management-quota seat? Does the assistant have a verified fixed percentage?
19. What is the AI and Data Science choice code for the 2026-27 CAP option form?
20. What is the admission quota for AY 2025-26?
21. What were the office timings last year, and are they confirmed for this year?
22. Can you show me independent student ratings or prove MITCORER is the best placement college in Maharashtra?
23. I uploaded a document. What is its review status? (Ask anonymously; Mitra should not expose an applicant’s private record.)
24. Ask the college-type and institute-level admission questions in Marathi and Hindi. Check that intent is routed correctly; have a fluent speaker judge translation quality separately.

Expected checks: questions 15–16 should be answered from the year-specific CET Cell record; 17–18 should distinguish categories and avoid invented quota percentages or seat guarantees; 19 should disclose that the official CET Cell summary and MITCORER course page list conflicting codes and direct the applicant to confirm in the live CAP portal; 20 should abstain from reusing AY 2026-27 data; 22 should not present institutional marketing facts as independent reviews or rankings; 23 should direct an anonymous user to official contact channels without revealing applicant data.

## Oral-exam questions about the engineering

1. What user problem does Mitra solve, and who are its main users?
2. Describe the request flow from a question through intent understanding, retrieval, answer construction, and response.
3. What is the source of truth for current admission facts? How do you treat year-specific and historical records?
4. How does the assistant distinguish CAP, ACAP/non-CAP, Direct Second Year, and Polytechnic questions?
5. What does a query alias do? Why does adding a keyword not prove that Mitra knows or can answer the underlying fact?
6. How does Mitra behave when evidence is missing, conflicting, or from the wrong academic year?
7. Why are quota percentages, vacancies, and admission guarantees not inferred from “Un-Aided” or “Non-Minority” status?
8. What is the difference between a citation/revision ID, a frozen corpus manifest, an evaluation label, and answer correctness?
9. Which question and answer data are intentionally excluded from the `assistant_pipeline` log? What identifiers are logged?
10. How are private uploaded-document status questions protected for anonymous and authenticated users?
11. What does the additive SQLite migration change, and how does it preserve maintained content and custom tags?
12. What regression tests cover the recent CAP/ACAP, college classification, quota, source conflict, and evidence-trace changes?
13. What did the multilingual Arena run establish, and what did it not establish?
14. Why are assistant-authored test questions not independent evaluation evidence?
15. What are the current limitations in Marathi/Hindi fluency, source provenance, and independent evaluation?
16. What would be the next defensible evaluation step? (Fresh questions, independently adjudicated evidence/labels, and fluent-speaker review.)

## Known source issue to explain clearly

For AY 2026-27, the Maharashtra CET Cell institute summary lists AI and Data Science choice code `0690199510`, while MITCORER’s First Year B.Tech page lists `0690126310`. Mitra is configured to disclose both values and recommend checking the live CAP option form with the admissions office. The discrepancy remains unresolved; do not claim that the two sources agree.

## Local verification commands

Run from `backend`:

```powershell
npm.cmd run check
npm.cmd test -- --test-reporter=dot
npm.cmd run db:inspect
```

Run from `frontend`:

```powershell
npm.cmd test
npm.cmd run lint
npm.cmd run build
```

The database inspector opens SQLite read-only. Local passing tests and a successful build do not establish independent answer accuracy or deployment status.
