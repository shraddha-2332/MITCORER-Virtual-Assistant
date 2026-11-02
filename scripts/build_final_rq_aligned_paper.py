import docx
import os
import shutil

src_path = r'C:\Users\shrad\.gemini\antigravity\brain\3c35bb28-511e-425a-bcb2-131a0c02b676\.user_uploaded\media_1793121777200_dfbf767f.docx'
out_path_final = r'A:\Projects\Mitra Clone\deliverables\MITRA_Research_Paper_IRJMETS_5pages_Final.docx'
out_path_strict = r'A:\Projects\Mitra Clone\deliverables\MITRA_Research_Paper_IRJMETS_Strict_5Pages.docx'

doc = docx.Document(src_path)

# 1. Calibrated margins
for s in doc.sections:
    s.top_margin = docx.shared.Inches(0.50)
    s.bottom_margin = docx.shared.Inches(0.40)
    s.left_margin = docx.shared.Inches(0.65)
    s.right_margin = docx.shared.Inches(0.65)

# 2. Scale images
for i, s in enumerate(doc.inline_shapes):
    if i in [0, 1]:  # Figs 1 & 2
        orig_h = s.height.inches
        s.height = docx.shared.Inches(1.45)
        s.width = docx.shared.Inches(s.width.inches * (1.45 / orig_h))
    else:  # Figs 3, 4, 5, 6
        orig_h = s.height.inches
        s.height = docx.shared.Inches(1.22)
        s.width = docx.shared.Inches(s.width.inches * (1.22 / orig_h))

def set_para(p, text, font_size=9.5, bold=False, italic=False, space_after=1.0, space_before=0.0, line_spacing=1.0, italic_prefix=None, bold_prefix=None):
    p.paragraph_format.space_after = docx.shared.Pt(space_after)
    p.paragraph_format.space_before = docx.shared.Pt(space_before)
    p.paragraph_format.line_spacing = line_spacing
    
    for r in list(p._p.xpath('.//w:r')):
        p._p.remove(r)
        
    if bold_prefix:
        r_bp = p.add_run(bold_prefix)
        r_bp.font.name = 'Times New Roman'
        r_bp.font.size = docx.shared.Pt(font_size)
        r_bp.bold = True
    if italic_prefix:
        r_ip = p.add_run(italic_prefix)
        r_ip.font.name = 'Times New Roman'
        r_ip.font.size = docx.shared.Pt(font_size)
        r_ip.italic = True
        
    r = p.add_run(text)
    r.font.name = 'Times New Roman'
    r.font.size = docx.shared.Pt(font_size)
    r.bold = bold
    r.italic = italic

# Abstract (P7)
p7_text = (
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
)
set_para(doc.paragraphs[7], p7_text, space_after=1.0)

# Introduction (P10)
p10_text = (
    "College admission information is distributed across circulars, fee schedules and intake documents. "
    "A brief inquiry often omits parameters that govern the final amount: category labels carry differing amounts across first-year and direct second-year admissions, "
    "and hostel, deposit, and mess fees mislead when detached from their respective categories. General-purpose generative language models exacerbate this risk "
    "by fabricating plausible figures ungrounded in official records. MITRA was developed as an institutional information assistant for MITCORER to provide "
    "reliable access to verified admission data. It couples a public client widget with an authenticated workflow for knowledge base updates. "
    "This study describes MITRA’s architecture, including document versioning, multilingual query processing, and verification of critical values, "
    "addressing three research questions: (RQ1) whether lightweight lexical retrieval with Devanagari normalization provides adequate coverage across regional languages, "
    "(RQ2) whether deterministic template rendering eliminates numerical distortion on critical fee facts, and (RQ3) how effectively a multi-stage decision hierarchy controls end-to-end response behavior."
)
set_para(doc.paragraphs[10], p10_text, space_after=1.0)

# Section I-A Heading (P11)
set_para(doc.paragraphs[11], "A. Research Questions and Objectives", font_size=10.0, bold=True, space_before=2.0, space_after=0.5)

# P12: RQ1 bullet
p12_text = (
    "•  RQ1 (Retrieval Coverage): Determine whether BM25 lexical retrieval combined with targeted Devanagari query normalization can achieve high evidence recall (Recall@3 ≥ 0.95) across English, Marathi, and Hindi institutional inquiries without heavy translation models."
)
set_para(doc.paragraphs[12], p12_text, space_after=0.5)

# P13: RQ2 bullet
p13_text = (
    "•  RQ2 (Critical-Fact Fidelity): Evaluate whether deterministic template rendering over verified database records guarantees zero numerical discrepancy (100% attribute fidelity) on multi-attribute fee and intake inquiries without reliance on generative language models."
)
set_para(doc.paragraphs[13], p13_text, space_after=0.5)

# P14: RQ3 bullet
p14_text = (
    "•  RQ3 (Multilingual Response Control): Characterize the operational effectiveness of a multi-stage control hierarchy—spanning answerability, targeted clarification, safe abstention, and staff referral—across English, Marathi, and Hindi development scenarios."
)
set_para(doc.paragraphs[14], p14_text, space_after=1.0)

# Scope and Limitations (P16)
p16_text = (
    "This investigation is bounded to a single institution, 51 seeded administrative records, and developer-authored test cases. "
    "It targets defined institutional admissions scenarios rather than open-domain hallucination elimination, demonstrating architectural feasibility "
    "and observed diagnostic behaviour rather than causal effects on applicant decision quality or administrative workload."
)
set_para(doc.paragraphs[16], p16_text, space_after=1.0)

# Literature Review (P18)
p18_text = (
    "Retrieval-augmented generation (RAG) conditions model generation on retrieved evidence [1]; MITRA restricts generative modeling to an optional, English-only path. "
    "BM25 [2] serves as an established lexical baseline [12]; raw and normalized BM25 are compared here as a retrieval diagnostic separate from end-to-end generation. "
    "While conversational admission systems are documented in prior literature [3]–[6], [16], MITRA focuses on the engineering mechanisms required to bind multi-attribute "
    "fee structures, query scope, and deterministic fail-safes into a maintained design. Because external systems were not evaluated on MITRA’s corpus, Table I presents "
    "an architectural comparison rather than an empirical ranking."
)
set_para(doc.paragraphs[18], p18_text, space_after=1.0)

# Methodology B: Query Interpretation and Answer Workflow (P25)
p25_text = (
    "A bounded rule-based parser processes English, Marathi, Hindi, and transliterated expressions, extracting topic, programme, entry route, academic year, category, "
    "gender, and service attributes. Academic year and entry route are isolated, and conflicting values trigger explicit disambiguation. Candidate retrieval combines "
    "weighted lexical scoring with synonym mappings; optional Gemini embeddings [17] are applied strictly to English queries. Candidate relevance does not guarantee "
    "answerability; the retrieved record must contain verified values matching the extracted scope. The operational decision hierarchy executes in strict sequence: "
    "(1) validate input, extract scope, and retrieve eligible published records; (2) trigger targeted clarification when critical parameters are missing rather than "
    "synthesizing default values; (3) render canonical fee and intake facts deterministically from database records; (4) permit bounded generative drafting exclusively "
    "for non-critical English inquiries, while Marathi and Hindi rely entirely on deterministic rendering and hash-bound translations; (5) subject all generated drafts "
    "to verification checks including exact numeric match, citation presence, and clause-level slot binding; and (6) execute structured fallbacks (verified summary, "
    "explicit unanswerable notice, or human staff referral). Open-domain semantic entailment remains outside the operational scope."
)
set_para(doc.paragraphs[25], p25_text, space_after=1.0)

# Methodology C: Evaluation Design with 4-Stage Chronology (P27)
p27_text = (
    "Empirical evaluation is organized across three diagnostic layers with generation disabled: (1) Retrieval Diagnostics: 51 seeded records and 44 structured questions "
    "evaluate four retrieval configurations (application rule retriever, raw BM25, normalized BM25, and reciprocal-rank fusion [19]), measured across ten warmup runs and "
    "100 timed trials per query in Node.js on local hardware; Group Recall@k is calculated for each query as the proportion of its required evidence groups retrieved in the top-k results, "
    "then averaged across all 44 queries (41 single-group and three multi-group queries, where multi-group queries contribute fractional scores); "
    "(2) Verifier Probes: 15 synthetic probes (11 invalid drafts with injected numerical swaps or category distortions, and four valid controls) evaluate clause-level verification versus surface token matching; and "
    "(3) Multilingual Benchmark: 90 scenarios (30 per language: 20 answerable, 7 unanswerable, 3 ambiguous) authored by the development team and mapped to published college circulars. "
    "The benchmark followed a four-stage evaluation timeline: Stage 1 established baseline performance (Run 2: 60.0% correctness, 36/60 answerable cases) via automated harness scoring; "
    "Stage 2 conducted blind, independent evaluation by two departmental faculty raters across three nominal categories (correct, incorrect, refusal/abstention), "
    "yielding pre-adjudication inter-rater reliability of Cohen’s κ = 0.96 (po = 0.978, pe = 0.429; 88/90 observed agreements: 52 correct, 21 abstained, 15 incorrect), with two discordant cases "
    "(P30-EN-06 and E90-MR-20) adjudicated by the Department Head; Stage 3 retrospectively corrected two rigid regex scorer rules on valid Devanagari answers (+2 cases, 38/60, 63.3%); "
    "and Stage 4 expanded Devanagari normalizer facility synonyms and re-evaluated the same 90 scenarios (Run 3: 52/60, 86.7%), demonstrating development regression closure. "
    "Source attachment measures whether an answer included a canonical citation to its retrieved knowledge-base record. "
    "Metrics reported: correctness (correct / answerable cases, Na=60), abstention rate (abstained / unanswerable cases, Nu=21), clarification rate (clarified / ambiguous cases, Nm=9), "
    "false-refusal rate (abstained / answerable cases, Na=60), and false-answer rate (answered / unanswerable cases, Nu=21). "
    "Wilson score intervals and two-sided Fisher’s exact tests on 2×2 contingency tables provide statistical characterization."
)
set_para(doc.paragraphs[27], p27_text, space_after=1.0)

# Section IV-C: UI and Example Interactions (P34 heading, P35 text)
set_para(doc.paragraphs[34], "C. User Interface and Example Interactions", font_size=10.0, bold=True, space_before=2.0, space_after=0.5)

p35_text = (
    "Users select Automatic, English, Marathi or Hindi in a floating widget needing no sign-in (Fig. 3). "
    "Fig. 4 shows a compound query answered in one response card (a 2026–27 hostel fee table, then a library notice that borrowing policies remain unpublished); "
    "Fig. 5 shows “first year fees kiti ahe” answered in Marathi with the full category-wise fee schedule; "
    "and Fig. 6 illustrates early-build referral behaviour for an unseeded inquiry prior to routing refinement. Figs. 3–6 represent author-selected interface captures."
)
set_para(doc.paragraphs[35], p35_text, space_after=1.0)

# Section IV-D: Deployment Status and Operational Boundaries (P36 heading, P37 text)
set_para(doc.paragraphs[36], "D. Deployment Status and Operational Boundaries", font_size=10.0, bold=True, space_before=2.0, space_after=0.5)

p37_text = (
    "The client-side integration uses an asynchronous script loader designed to mount the MITRA widget on the institutional website (mitcorer.edu.in) without requiring CMS modifications. "
    "The integration has been validated in the local development environment; deployment on public institutional servers and open campus-wide operation remain future work. "
    "This decoupled architecture isolates conversational availability from portal updates and provides a graceful offline fallback if backend connectivity is interrupted. "
    "Following local server validation and knowledge-base verification, the prototype engine, verified records, and administrative update interface were handed over to institutional authorities. "
    "Full-scale production validation—including concurrent load testing across peak admission cycles, automated telemetry monitoring, and adversarial prompt-injection audits—is planned as future work prior to open public operation."
)
set_para(doc.paragraphs[37], p37_text, space_after=1.0)

# Section V: RESULTS AND DISCUSSION (P38 heading)
set_para(doc.paragraphs[38], "V. RESULTS AND DISCUSSION", font_size=11.0, bold=True, space_before=2.5, space_after=1.0)

# P39: Opening sentence framed around RQ1, RQ2, RQ3
p39_text = (
    "Empirical findings from the developer-run diagnostic evaluations and 90-scenario benchmark (evaluated with generation disabled) are organized around research questions RQ1, RQ2, and RQ3."
)
set_para(doc.paragraphs[39], p39_text, space_after=1.0)

# Section V-A Heading (P40)
set_para(doc.paragraphs[40], "A. RQ1: Retrieval Coverage and RQ2: Critical-Fact Fidelity", font_size=10.0, bold=True, space_before=2.0, space_after=0.5)

# P41: Caption for Table II
set_para(doc.paragraphs[41], "Table II. Development retrieval results (44 questions, 51 seeded records)", font_size=9.0, italic=True, space_before=1.5, space_after=0.5)

# P43: Retrieval & Verifier text
p43_text = (
    "Devanagari query normalization improves BM25 Group Recall@3 from 0.7727 to 0.9659 across the 44 diagnostic queries; for normalized BM25, the sum of per-query evidence-group recall scores "
    "is 42.5 across 44 queries, giving a mean Group Recall@3 of 0.9659 (the numerator represents the sum of per-query recall scores rather than a count of distinct retrieved groups). "
    "The application retriever achieves 1.0000 and RRF achieves 0.9886. Table II reports exact in-process Node.js retrieval ranking latency across 100 timed trials per query post-warmup: "
    "application retriever p50 1.02 ms, p95 1.44 ms; raw BM25 p50 0.03 ms, p95 0.05 ms; normalized BM25 p50 0.05 ms, p95 0.08 ms; RRF p50 1.10 ms, p95 1.56 ms. "
    "Latencies reflect in-memory candidate ranking without network transit or database write overhead. A retrieval Recall@3 of 1.0000 confirms candidate presence in top ranks but does not guarantee "
    "downstream answer validity. On the 15 verifier probes, surface token matching rejected only 2 of 11 invalid drafts (18.18%), whereas slot/clause verification rejected 11 of 11 (100%, Wilson 74.1–100%), "
    "with 0/4 false alarms on valid controls. The development verification suite recorded 1,218 checks across five categories: 174 backend unit and integration tests, 16 frontend build and lint checks, "
    "100 HTTP smoke tests, 468 Playwright UI journey checks, and 460 verifier and knowledge-integrity assertions."
)
set_para(doc.paragraphs[43], p43_text, space_after=1.0)

# Section V-B Heading (P44)
set_para(doc.paragraphs[44], "B. RQ3: End-to-End Multilingual Response Control", font_size=10.0, bold=True, space_before=2.0, space_after=0.5)

# P45: Caption for Table III
set_para(doc.paragraphs[45], "Table III. Development-set baseline and post-fix regression results on the same 90 scenarios", font_size=9.0, italic=True, space_before=1.5, space_after=0.5)

# P47: Baseline (Run 2)
p47_text = (
    "On the 60 answerable cases, baseline correctness was 60.0% (36/60; English 85.0%, Marathi 50.0%, Hindi 45.0%; Wilson 47.4–71.4%). "
    "The baseline false-refusal rate was 23.3% (14/60 answerable cases), including 0/20 English, 6/20 Marathi, and 8/20 Hindi cases (35.0% across the 40 Devanagari answerable cases). "
    "Among the 21 unanswerable scenarios, 15 drew appropriate abstentions (71.4%), while 7 of 9 ambiguous inquiries elicited clarification (77.8%). "
    "Two-sided Fisher’s exact tests on 2×2 contingency tables (p = 0.0407 English vs. Marathi, p = 0.0187 English vs. Hindi, p = 0.0058 English vs. pooled Devanagari) "
    "confirm significant regional language disparity in baseline normalization."
)
set_para(doc.paragraphs[47], p47_text, italic_prefix="Baseline (Run 2). ", space_after=1.0)

# P48: Error audit
p48_text = (
    "Across all 15 institutional fee scenarios, deterministic rendering preserved all factual attributes with zero numerical errors (15/15; Wilson 95% CI 79.6–100%, lower bound ≈ 80%). "
    "When expanded to all 21 critical fee, accommodation, and placement scenarios (15 fee, three hostel, and three placement cases), all 21 were answered with full attribute fidelity and no numerical distortion (21/21; Wilson 95% CI 84.5–100%). "
    "Tracing the 14 false refusals confirmed that 13 yielded zero candidate hits and one failed confidence thresholding due to missing facility terminology (sports, ground, campus distance) in the Devanagari lexicon. "
    "An audit of ten baseline answered-but-incorrect cases found no fabricated values: two were incomplete (P30-EN-06, E90-EN-19); two were valid Marathi/Hindi answers penalized by rigid regex scoring "
    "(E90-MR-22, E90-HI-23; crediting these yields 38/60, 63.3%); five requested data absent from college circulars (three AICTE Pragati stipend queries and two rural bus routes); "
    "and one (E90-MR-20) defaulted to English contact guidance. Referral routing succeeded in 15/15 test queries following an initial Run 1 rule correction that separated non-student recruitment inquiries from admission counselling (Run 1: 13/15, 86.7%), a configuration retained in Run 3."
)
set_para(doc.paragraphs[48], p48_text, italic_prefix="Error audit. ", space_after=1.0)

# P49: Regression closure (Run 3)
p49_text = (
    "Rerunning the 90 cases combined two distinct evaluation stages: (1) a retrospective scoring adjustment crediting two valid Devanagari responses previously penalized by rigid regex rules "
    "(+2 cases, reaching 38/60, 63.3%), and (2) system-level normalizer expansion of Devanagari facility synonyms, which recovered 14 false refusals (+14 cases), elevating final answerable correctness "
    "to 86.7% (52/60; Wilson 75.8–93.1%) with zero false refusals (0/60 answerable cases). Because every answered record attaches its canonical knowledge-base citation, attached sources rose from 46/60 (76.7%) to 60/60 (100.0%). "
    "Post-normalization Fisher’s exact test showed no detectable difference between English (17/20, 85.0%) and pooled Devanagari (35/40, 87.5%; p = 1.0000). "
    "A secondary post-hoc sensitivity analysis excluding the five unseeded circular-omission queries yields 52/55 (94.5%), illustrating ground-truth label sensitivity rather than primary system accuracy. "
    "Appropriate abstention on unanswerable queries dropped from 15/21 (71.4%) to 14/21 (66.7%), and false answers rose from 6/21 (28.6%) to 7/21 (33.3%), "
    "because an unanswerable historical query (E90-MR-26, requesting 2017 cutoffs) matched a general CAP-round record due to expanded Devanagari lexical coverage."
)
set_para(doc.paragraphs[49], p49_text, italic_prefix="Regression closure (Run 3). ", space_after=1.0)

# Section V-C Heading (P50)
set_para(doc.paragraphs[50], "C. Interpretation, Limitations, and Threats to Validity", font_size=10.0, bold=True, space_before=2.0, space_after=0.5)

# P51: Discussion & Threats to Validity
p51_text = (
    "The development experiments demonstrate that MITRA can retrieve and render maintained fee records without relying on language-model generation for those values. "
    "The absence of numerical discrepancies reflects deterministic template rendering over developer-authored test cases and does not imply generalized hallucination immunity "
    "during unconstrained language generation. Primary threats to empirical validity include development leakage (refinements were made following inspection of errors on the same 90 cases), "
    "modest cell sizes (7 unanswerable and 3 ambiguous cases per language), regex-based scoring, faculty raters originating from the same academic department, and differences "
    "between the prototype environment and live webmaster deployment."
)
set_para(doc.paragraphs[51], p51_text, space_after=1.0)

# Section VI: Conclusion (P53)
p53_text = (
    "MITRA demonstrates an architectural approach for institutional information assistance that decouples verified administrative facts from unconstrained generative modeling. "
    "Across a 90-scenario developer-authored benchmark, baseline correctness was 60.0% (36/60 answerable cases). The baseline false-refusal rate was 23.3% (14/60 answerable cases: 0/20 in English [0.0%], "
    "6/20 in Marathi [30.0%], and 8/20 in Hindi [40.0%], representing 35.0% across the 40 answerable Devanagari cases) resulting from lexical gaps in Devanagari normalization. "
    "Normalizer expansion and two scorer adjustments raised same-case correctness to 86.7% (52/60) with zero false refusals (0/60 answerable cases), alongside a minor reduction in abstention (66.7%). "
    "Because adjustments were informed by observed errors on these scenarios, this performance reflects regression closure rather than independent generalization. "
    "No numerical errors were observed across the 15 evaluated fee cases (15/15, Wilson 95% CI 79.6–100%), and an audit of ten baseline answered-but-incorrect cases found zero fabricated values. "
    "Two faculty raters from the department confirmed high pre-adjudication inter-rater reliability (Cohen’s κ = 0.96). These results provide initial evidence of implementation feasibility; "
    "independent testing on unobserved student interactions is required to assess generalization."
)
set_para(doc.paragraphs[53], p53_text, space_after=1.0)

# Acknowledgements (P60)
p60_text = (
    "The authors acknowledge Prof. Shobhana Raichurkar, Assistant Professor, Department of Computer Science and Engineering, MITCORER, Barshi, for project guidance; "
    "thank the two departmental faculty reviewers and the Department Head who rated and adjudicated the benchmark responses; and thank the college administration "
    "for receiving the prototype handover and supporting portal integration planning. The authors used an AI assistant for language editing and document formatting "
    "and are responsible for all technical content."
)
set_para(doc.paragraphs[60], p60_text, space_after=1.0)

# Format all body paragraphs (ensure space_after=1.0 pt, space_before=0.0 pt)
for i in range(5, 61):
    p = doc.paragraphs[i]
    if i not in [11, 34, 36, 38, 40, 41, 44, 45, 50, 52, 54, 59, 61]:
        p.paragraph_format.space_after = docx.shared.Pt(1.0)
        p.paragraph_format.space_before = docx.shared.Pt(0.0)
        p.paragraph_format.line_spacing = 1.0

# Format References [1] to [22] (P62 to end)
# Explicitly set space_after=0.0 pt, space_before=0.0 pt, line_spacing=1.0, font_size=8.0 pt
for i in range(62, len(doc.paragraphs)):
    p = doc.paragraphs[i]
    p.paragraph_format.space_after = docx.shared.Pt(0.0)
    p.paragraph_format.space_before = docx.shared.Pt(0.0)
    p.paragraph_format.line_spacing = 1.0
    for r in p.runs:
        r.font.name = 'Times New Roman'
        r.font.size = docx.shared.Pt(8.0)

# Format Table III (doc.tables[4])
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
        run.font.size = docx.shared.Pt(8.0 if r_idx > 0 else 8.5)
        if r_idx == 0:
            run.font.bold = True
        cell.paragraphs[0].paragraph_format.space_after = docx.shared.Pt(0.5)
        cell.paragraphs[0].paragraph_format.space_before = docx.shared.Pt(0.5)

# Save to destination paths (handling any file lock)
saved_paths = []
for pth in [out_path_final, out_path_strict, src_path]:
    try:
        doc.save(pth)
        saved_paths.append(pth)
        print(f"SUCCESS: Saved to {pth}")
    except PermissionError:
        alt_path = pth.replace('.docx', '_Unlocked.docx')
        doc.save(alt_path)
        saved_paths.append(alt_path)
        print(f"LOCKED: Saved to alternative {alt_path}")

print("Build complete!")

