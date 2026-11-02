import docx
import os
import sys

src_path = r'C:\Users\shrad\.gemini\antigravity\brain\3c35bb28-511e-425a-bcb2-131a0c02b676\.user_uploaded\media_1793121777200_dfbf767f.docx'
out_path = r'A:\Projects\Mitra Clone\deliverables\MITRA_Research_Paper_IRJMETS_5pages_Final.docx'

doc = docx.Document(src_path)

# Set tight margins: top=0.55", bottom=0.45", left=0.68", right=0.68"
for s in doc.sections:
    s.top_margin = docx.shared.Inches(0.55)
    s.bottom_margin = docx.shared.Inches(0.45)
    s.left_margin = docx.shared.Inches(0.68)
    s.right_margin = docx.shared.Inches(0.68)

# Scale all images by 15% to pull references from page 6 onto page 5
for s in doc.inline_shapes:
    s.height = docx.shared.Inches(s.height.inches * 0.85)
    s.width = docx.shared.Inches(s.width.inches * 0.85)

def update_p(p, text, italic_prefix=None, space_after=1.0):
    p.paragraph_format.space_after = docx.shared.Pt(space_after)
    p.paragraph_format.line_spacing = 1.0
    p.paragraph_format.space_before = docx.shared.Pt(0.0)
    
    # Clean out all existing runs from paragraph XML
    for r in list(p._p.xpath('.//w:r')):
        p._p.remove(r)
        
    if italic_prefix:
        r1 = p.add_run(italic_prefix)
        r1.font.name = 'Times New Roman'
        r1.font.size = docx.shared.Pt(9.5)
        r1.italic = True
    r2 = p.add_run(text)
    r2.font.name = 'Times New Roman'
    r2.font.size = docx.shared.Pt(9.5)

updates = {
    7: ('', (
        "Incorrect fee information can mislead students and parents during admission planning. "
        "This paper presents MITRA, an institutional conversational assistant developed for MIT College of Railway Engineering & Research (MITCORER), Barshi, "
        "serving English, Marathi, and Hindi queries through maintained records, deterministic rendering of critical fee and intake facts, scope-aware clarification, "
        "and referral to human staff, alongside an optional English-only generation path gated by bounded verification. "
        "On the 90-scenario development benchmark (30 per language: 60 answerable, 21 unanswerable, 9 ambiguous) scored with generation disabled, "
        "baseline correctness was 60.0% (36/60 answerable cases; English 85.0%, Marathi 50.0%, Hindi 45.0%). "
        "The baseline false-refusal rate was 23.3% (14/60 answerable cases), including 0/20 English, 6/20 Marathi, and 8/20 Hindi cases, caused by unmapped Devanagari facility terms. "
        "Two departmental faculty raters independently scored all 90 baseline cases across three rating categories (κ = 0.96 before Department Head adjudication of two cases). "
        "Following targeted Devanagari normalization expansion and correcting two string-matching scorer rules, a same-case rerun achieved 86.7% correctness (52/60) "
        "with zero false refusals (0/60 answerable cases), alongside lower abstention (66.7%, down from 71.4%). "
        "Because these changes were informed by errors observed on the benchmark, this revised result represents regression closure on the development set rather than independent generalization. "
        "No numerical errors were observed in the 15 evaluated fee cases on the deterministic path (95% CI lower bound ≈ 80%), and an audit of ten baseline answered-but-incorrect cases found zero fabricated values. "
        "Evaluation on an independently authored, held-out test set remains future work."
    )),
    10: ('', (
        "College admission information is distributed across circulars, fee schedules and intake documents. "
        "A brief inquiry often omits parameters that govern the final amount: category labels carry differing amounts across first-year and direct second-year admissions, "
        "and hostel, deposit, and mess fees mislead when detached from their respective categories. General-purpose generative language models exacerbate this risk "
        "by fabricating plausible figures ungrounded in official records. MITRA was developed as an institutional information assistant for MITCORER to provide "
        "reliable access to verified admission data. It couples a public client widget with an authenticated workflow for knowledge base updates. "
        "This study describes MITRA’s architecture, including document versioning, multilingual query processing, and verification of critical values, "
        "supported by diagnostic evaluations and a 90-scenario benchmark evaluated by an automated harness alongside independent scoring by two departmental faculty reviewers."
    )),
    16: ('', (
        "This investigation is bounded to a single institution, 51 seeded administrative records, and developer-authored test cases. "
        "It targets defined institutional admissions scenarios rather than open-domain hallucination elimination, demonstrating architectural feasibility "
        "and observed diagnostic behaviour rather than causal effects on applicant decision quality or administrative workload."
    )),
    18: ('', (
        "Retrieval-augmented generation (RAG) conditions model generation on retrieved evidence [1]; MITRA restricts generative modeling to an optional, English-only path. "
        "BM25 [2] serves as an established lexical baseline [12]; raw and normalized BM25 are compared here as a retrieval diagnostic separate from end-to-end generation. "
        "While conversational admission systems are documented in prior literature [3]–[6], [16], MITRA focuses on the engineering mechanisms required to bind multi-attribute "
        "fee structures, query scope, and deterministic fail-safes into a maintained design. Because external systems were not evaluated on MITRA’s corpus, Table I presents "
        "an architectural comparison rather than an empirical ranking."
    )),
    25: ('', (
        "A bounded rule-based parser processes English, Marathi, Hindi, and transliterated expressions, extracting topic, programme, entry route, academic year, category, "
        "gender, and service attributes. Academic year and entry route are isolated, and conflicting values trigger explicit disambiguation. Candidate retrieval combines "
        "weighted lexical scoring with synonym mappings; optional Gemini embeddings [17] are applied strictly to English queries. Candidate relevance does not guarantee "
        "answerability; the retrieved record must contain verified values matching the extracted scope. The operational decision hierarchy executes in strict sequence: "
        "(1) validate input, extract scope, and retrieve eligible published records; (2) trigger targeted clarification when critical parameters are missing rather than "
        "synthesizing default values; (3) render canonical fee and intake facts deterministically from database records; (4) permit bounded generative drafting exclusively "
        "for non-critical English inquiries, while Marathi and Hindi rely entirely on deterministic rendering and hash-bound translations; (5) subject all generated drafts "
        "to verification checks including exact numeric match, citation presence, and clause-level slot binding; and (6) execute structured fallbacks (verified summary, "
        "explicit unanswerable notice, or human staff referral). Open-domain semantic entailment remains outside the operational scope."
    )),
    27: ('', (
        "Empirical evaluation is organized across three diagnostic layers with generation disabled: (1) Retrieval Diagnostics: 51 seeded records and 44 structured questions "
        "evaluate four retrieval configurations (application rule retriever, raw BM25, normalized BM25, and reciprocal-rank fusion [19]), measured across ten warmup runs and "
        "100 timed trials per query in Node.js on local hardware; Group Recall@k is calculated for each query as the proportion of its required evidence groups retrieved in the top-k results, "
        "then averaged across all 44 queries (41 single-group and three multi-group queries, where multi-group queries contribute fractional scores); "
        "(2) Verifier Probes: 15 synthetic probes (11 invalid drafts with injected numerical swaps or category distortions, and four valid controls) evaluate clause-level verification versus surface token matching; and "
        "(3) Multilingual Benchmark: 90 scenarios (30 per language: 20 answerable, 7 unanswerable, 3 ambiguous) authored by the development team and mapped to published college circulars. "
        "Evaluation attribution is two-fold: faculty ratings were used to assess baseline response quality and inter-rater agreement across three nominal categories (correct, incorrect, refusal/abstention), "
        "yielding pre-adjudication agreement of Cohen’s κ = 0.96 (po = 0.978, pe = 0.429; 88/90 agreements: 52 correct, 21 abstained, 15 incorrect), with disagreements on two cases "
        "(P30-EN-06, scored Correct by R1 and Incorrect by R2; and E90-MR-20, scored Incorrect by R1 and Abstained by R2) resolved by the Department Head; "
        "the Run 2 and Run 3 metrics in Table III are automated-harness results evaluated by regex matching against verified circular values and are not faculty-adjudicated scores. "
        "Source attachment measures whether an answer included a source reference linked to its retrieved knowledge-base record; it does not independently measure semantic correctness or cited document accuracy. "
        "Metrics reported: correctness (correct / answerable cases, Na=60), abstention rate (abstained / unanswerable cases, Nu=21), clarification rate (clarified / ambiguous cases, Nm=9), "
        "false-refusal rate (abstained / answerable cases, Na=60), and false-answer rate (answered / unanswerable cases, Nu=21). Wilson score intervals and two-sided Fisher’s exact tests on 2×2 contingency "
        "tables of correct versus non-correct outcomes provide statistical characterization."
    )),
    33: ('', (
        "Ambiguous requests receive a clarifying question (or rows for every category when only the category is missing); unsupported questions a safe refusal with an official "
        "source link; missing or retired records no stated value plus referral to human assistance; unsupported numbers or guarantees of admission, placement or scholarship cause "
        "a draft to be rejected; and a stale translation or generation outage triggers an explicit English or deterministic fallback. A referral shows a contact card with a call-back request. "
        "Staff-hiring and vacancy inquiries route to the administrative office, while academic counselors are designated for prospective students (Fig. 6 illustrates an earlier-build "
        "diagnostic trace prior to routing rule refinement). Here “escalation” denotes human contact referral; live helpdesk ticketing and call-back fulfillment were not evaluated in this study."
    )),
    35: ('', (
        "Users select Automatic, English, Marathi or Hindi in a floating widget that needs no sign-in (Fig. 3). Fig. 4 shows a compound query answered in one response (a 2026–27 hostel "
        "fee card, then a library answer stating that borrowing rules and timings are not published); Fig. 5 shows “first year fees kiti ahe” answered in Marathi with the first-year fee "
        "for every category; Fig. 6 illustrates earlier-build referral behaviour for an unseeded inquiry. Figs. 3–6 are author-selected interface captures."
    )),
    37: ('', (
        "The client-side integration uses an asynchronous script loader designed to mount the MITRA widget on the institutional website (mitcorer.edu.in) without requiring CMS modifications. "
        "The integration has been validated in the local development environment; deployment on public institutional servers and open campus-wide operation remain future work. "
        "This decoupled architecture isolates conversational availability from portal updates and provides a graceful offline fallback if backend connectivity is interrupted. "
        "Following local server validation and knowledge-base verification, the prototype engine, verified records, and administrative update interface were handed over to institutional authorities. "
        "Full-scale production validation—including concurrent load testing across peak admission cycles, automated telemetry monitoring, and adversarial prompt-injection audits—is planned as future work prior to open public operation."
    )),
    43: ('', (
        "Devanagari query normalization improves BM25 Group Recall@3 from 0.7727 to 0.9659 across the 44 diagnostic queries; for normalized BM25, the sum of per-query evidence-group recall scores "
        "is 42.5 across 44 queries, giving a mean Group Recall@3 of 0.9659 (the numerator represents the sum of per-query recall scores rather than a count of distinct retrieved groups). "
        "The application retriever achieves 1.0000 and RRF achieves 0.9886. Table II reports exact in-process Node.js retrieval ranking latency across 100 timed trials per query post-warmup: "
        "application retriever p50 1.02 ms, p95 1.44 ms; raw BM25 p50 0.03 ms, p95 0.05 ms; normalized BM25 p50 0.05 ms, p95 0.08 ms; RRF p50 1.10 ms, p95 1.56 ms. "
        "Latencies reflect in-memory candidate ranking without network transit or database write overhead. A retrieval Recall@3 of 1.0000 confirms candidate presence in top ranks but does not guarantee "
        "downstream answer validity. On the 15 verifier probes, surface token matching rejected only 2 of 11 invalid drafts (18.18%), whereas slot/clause verification rejected 11 of 11 (100%, Wilson 74.1–100%), "
        "with 0/4 false alarms on valid controls. The development verification suite recorded 1,218 checks across five categories: 174 backend unit and integration tests, 16 frontend build and lint checks, "
        "100 HTTP smoke tests, 468 Playwright UI journey checks, and 460 verifier and knowledge-integrity assertions."
    )),
    47: ('Baseline (Run 2).', (
        " On the 60 answerable cases, baseline correctness was 60.0% (36/60; English 85.0%, Marathi 50.0%, Hindi 45.0%; Wilson 47.4–71.4%). "
        "The baseline false-refusal rate was 23.3% (14/60 answerable cases), including 0/20 English, 6/20 Marathi, and 8/20 Hindi cases (35.0% across the 40 Devanagari answerable cases). "
        "Among the 21 unanswerable scenarios, 15 drew appropriate abstentions (71.4%), while 7 of 9 ambiguous inquiries elicited clarification (77.8%). "
        "Two-sided Fisher’s exact tests on 2×2 contingency tables (p = 0.0407 English vs. Marathi, p = 0.0187 English vs. Hindi, p = 0.0058 English vs. pooled Devanagari) "
        "confirm significant regional language disparity in baseline normalization."
    )),
    48: ('Error audit.', (
        " Across all 15 institutional fee scenarios, deterministic rendering preserved all factual attributes with zero numerical errors (15/15; Wilson 95% CI 79.6–100%, lower bound ≈ 80%). "
        "When expanded to all 21 critical fee, accommodation, and placement scenarios (15 fee, three hostel, and three placement cases), all 21 were answered with full attribute fidelity and no numerical distortion (21/21; Wilson 95% CI 84.5–100%). "
        "Tracing the 14 false refusals confirmed that 13 yielded zero candidate hits and one failed confidence thresholding due to missing facility terminology (sports, ground, campus distance) in the Devanagari lexicon. "
        "An audit of ten baseline answered-but-incorrect cases found no fabricated values: two were incomplete (P30-EN-06, E90-EN-19); two were valid Marathi/Hindi answers penalized by rigid regex scoring "
        "(E90-MR-22, E90-HI-23; crediting these yields 38/60, 63.3%); five requested data absent from college circulars (three AICTE Pragati stipend queries and two rural bus routes); "
        "and one (E90-MR-20) defaulted to English contact guidance. Referral routing succeeded in 15/15 test queries following an initial Run 1 rule correction that separated non-student recruitment inquiries from admission counselling (Run 1: 13/15, 86.7%), a configuration retained in Run 3."
    )),
    49: ('Regression closure (Run 3).', (
        " Rerunning the 90 cases combined two distinct evaluation stages: (1) a retrospective scoring adjustment crediting two valid Devanagari responses previously penalized by rigid regex rules "
        "(+2 cases, reaching 38/60, 63.3%), and (2) system-level normalizer expansion of Devanagari facility synonyms, which recovered 14 false refusals (+14 cases), elevating final answerable correctness "
        "to 86.7% (52/60; Wilson 75.8–93.1%) with zero false refusals (0/60 answerable cases). Because every answered record attaches its canonical knowledge-base citation, attached sources rose from 46/60 (76.7%) to 60/60 (100.0%). "
        "Post-normalization Fisher’s exact test showed no detectable difference between English (17/20, 85.0%) and pooled Devanagari (35/40, 87.5%; p = 1.0000). "
        "A secondary post-hoc sensitivity analysis excluding the five unseeded circular-omission queries yields 52/55 (94.5%), illustrating ground-truth label sensitivity rather than primary system accuracy. "
        "Appropriate abstention on unanswerable queries dropped from 15/21 (71.4%) to 14/21 (66.7%), and false answers rose from 6/21 (28.6%) to 7/21 (33.3%), "
        "because an unanswerable historical query (E90-MR-26, requesting 2017 cutoffs) matched a general CAP-round record due to expanded Devanagari lexical coverage."
    )),
    51: ('', (
        "The development experiments demonstrate that MITRA can retrieve and render maintained fee records without relying on language-model generation for those values. "
        "The absence of numerical discrepancies reflects deterministic template rendering over developer-authored test cases and does not imply generalized hallucination immunity "
        "during unconstrained language generation. Primary threats to empirical validity include development leakage (refinements were made following inspection of errors on the same 90 cases), "
        "modest cell sizes (7 unanswerable and 3 ambiguous cases per language), regex-based scoring, faculty raters originating from the same academic department, and differences "
        "between the prototype environment and live webmaster deployment."
    )),
    53: ('', (
        "MITRA demonstrates an architectural approach for institutional information assistance that decouples verified administrative facts from unconstrained generative modeling. "
        "Across a 90-scenario developer-authored benchmark, baseline correctness was 60.0% (36/60 answerable cases). The baseline false-refusal rate was 23.3% (14/60 answerable cases: 0/20 in English [0.0%], "
        "6/20 in Marathi [30.0%], and 8/20 in Hindi [40.0%], representing 35.0% across the 40 answerable Devanagari cases) resulting from lexical gaps in Devanagari normalization. "
        "Normalizer expansion and two scorer adjustments raised same-case correctness to 86.7% (52/60) with zero false refusals (0/60 answerable cases), alongside a minor reduction in abstention (66.7%). "
        "Because adjustments were informed by observed errors on these scenarios, this performance reflects regression closure rather than independent generalization. "
        "No numerical errors were observed across the 15 evaluated fee cases (15/15, Wilson 95% CI 79.6–100%), and an audit of ten baseline answered-but-incorrect cases found zero fabricated values. "
        "Two faculty raters from the department confirmed high pre-adjudication inter-rater reliability (Cohen’s κ = 0.96). These results provide initial evidence of implementation feasibility; "
        "independent testing on unobserved student interactions is required to assess generalization."
    )),
    60: ('', (
        "The authors acknowledge Prof. Shobhana Raichurkar, Assistant Professor, Department of Computer Science and Engineering, MITCORER, Barshi, for project guidance; "
        "thank the two departmental faculty reviewers and the Department Head who rated and adjudicated the benchmark responses; and thank the college administration "
        "for receiving the prototype handover and supporting portal integration planning. The authors used an AI assistant for language editing and document formatting "
        "and are responsible for all technical content."
    )),
}

# Apply paragraph updates with 1.0 pt space_after
for idx, (prefix, text) in updates.items():
    update_p(doc.paragraphs[idx], text, italic_prefix=prefix if prefix else None, space_after=1.0)

# Set all other body paragraphs space_after to 1.0 pt
for i, p in enumerate(doc.paragraphs):
    if i not in updates and 5 < i < 61:
        p.paragraph_format.space_after = docx.shared.Pt(1.0)

# Tighten references (P62 to P83) to 0.0 pt space_after
for i in range(62, len(doc.paragraphs)):
    p = doc.paragraphs[i]
    p.paragraph_format.space_after = docx.shared.Pt(0.0)
    p.paragraph_format.line_spacing = 1.0

# Update Table 4 (Table III in paper)
t3 = doc.tables[4]
table_data = [
    ['Metric', 'English', 'Marathi', 'Hindi', 'Overall, Run 2', 'Overall, Run 3'],
    ['Run 2 baseline correctness', '85.0% (17/20)', '50.0% (10/20)', '45.0% (9/20)', '60.0% (36/60)', '—'],
    ['Run 2 after retrospective scorer fix', '—', '—', '—', '63.3% (38/60)', '—'],
    ['Run 3 correctness (normalizer + scorer)', '85.0% (17/20)', '85.0% (17/20)', '90.0% (18/20)', '—', '86.7% (52/60)'],
    ['Source citation attached', '100.0% (20/20)', '70.0% (14/20)', '60.0% (12/20)', '76.7% (46/60)', '100.0% (60/60)'],
    ['Appropriate abstention', '57.1% (4/7)', '71.4% (5/7)', '85.7% (6/7)', '71.4% (15/21)', '66.7% (14/21)'],
    ['Clarification accuracy', '33.3% (1/3)', '100.0% (3/3)', '100.0% (3/3)', '77.8% (7/9)', '77.8% (7/9)'],
    ['False-answer rate', '42.9% (3/7)', '28.6% (2/7)', '14.3% (1/7)', '28.6% (6/21)', '33.3% (7/21)'],
    ['False-refusal rate', '0.0% (0/20)', '30.0% (6/20)', '40.0% (8/20)', '23.3% (14/60)', '0.0% (0/60)'],
    ['Referral routing (after Run 1 rule fix)', '100% (4/4)', '100% (5/5)', '100% (6/6)', '100% (15/15)', '—*']
]

for r_idx, row_vals in enumerate(table_data):
    row = t3.rows[r_idx]
    for c_idx, val in enumerate(row_vals):
        cell = row.cells[c_idx]
        for r in list(cell.paragraphs[0]._p.xpath('.//w:r')):
            cell.paragraphs[0]._p.remove(r)
        run = cell.paragraphs[0].add_run(val)
        run.font.name = 'Times New Roman'
        run.font.size = docx.shared.Pt(8.5 if r_idx > 0 else 9.0)
        if r_idx == 0:
            run.font.bold = True
        cell.paragraphs[0].paragraph_format.space_after = docx.shared.Pt(0.5)
        cell.paragraphs[0].paragraph_format.space_before = docx.shared.Pt(0.5)

# Save artifact
doc.save(src_path)
print("SUCCESS: Saved to artifact docx!")

# Save to out_path
doc.save(out_path)
print(f"SUCCESS: Saved to {out_path}!")

