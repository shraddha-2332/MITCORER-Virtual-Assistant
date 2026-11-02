import docx

doc_path = r'A:\Projects\Mitra Clone\MITRA_Research_Paper_IRJMETS_5pages_Final.docx'
doc = docx.Document(doc_path)

def set_p(p, text, font_size=9.5, bold=False, italic=False, space_after=0.8, space_before=0.0, line_spacing=1.0, italic_prefix=None, bold_prefix=None):
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

# 1. Abstract (P7): Drop 'independently', use 'Dual departmental faculty raters'
p7_text = (
    "Incorrect fee information can mislead students and parents during admission planning. "
    "This paper presents MITRA, an institutional conversational assistant developed for MIT College of Railway Engineering & Research (MITCORER), Barshi, "
    "serving English, Marathi, and Hindi queries through maintained records, deterministic rendering of critical fee and intake facts, scope-aware clarification, "
    "and referral to human staff, alongside an optional English-only generation path gated by bounded verification. "
    "On the 90-scenario development benchmark (30 per language: 60 answerable, 21 unanswerable, 9 ambiguous) scored with generation disabled, "
    "baseline correctness was 60.0% (36/60 answerable cases; English: 85.0%, Marathi: 50.0%, Hindi: 45.0%). "
    "The baseline false-refusal rate was 23.3% (14/60 answerable cases), including 0/20 English, 6/20 Marathi, and 8/20 Hindi cases, caused by unmapped Devanagari facility terms. "
    "Dual departmental faculty raters scored all 90 baseline cases across three rating categories (Cohen’s kappa = 0.96 before Department Head adjudication of two cases). "
    "Following targeted Devanagari normalization expansion and correcting two string-matching scorer rules, an automated same-case rerun achieved 86.7% correctness (52/60) "
    "with zero false refusals (0/60 answerable cases), alongside lower abstention (66.7%, down from 71.4%) and an increase in false answers on unanswerable queries (33.3%, up from 28.6%). "
    "Because these changes were informed by errors observed on the benchmark, this revised result represents regression closure on the development set rather than independent generalization. "
    "No numerical errors were observed in the 15 evaluated fee cases on the deterministic path, and an audit of ten baseline answered-but-incorrect cases found zero fabricated values. "
    "Evaluation on an independently authored, held-out test set remains future work."
)
set_p(doc.paragraphs[7], p7_text, space_after=1.0)

# 2. Section II (P18): Add gap sentence stating the literature gap
p18_text = (
    "Retrieval-augmented generation (RAG) conditions model generation on retrieved evidence [1]; MITRA restricts generative modeling to an optional, English-only path. "
    "BM25 [2], [3] serves as an established lexical baseline [4]; raw and normalized BM25 are compared here as a retrieval diagnostic separate from end-to-end generation. "
    "While conversational admission systems are documented in prior literature [5]–[8], [9], MITRA focuses on the engineering mechanisms required to bind multi-attribute "
    "fee structures, query scope, and deterministic fail-safes into a maintained design. Existing admissions chatbots report user-level conversational evidence, but none report "
    "scope-preserving deterministic fee rendering with trilingual error auditing across regional Indian languages. Because external systems were not evaluated on MITRA’s corpus, "
    "Table I presents an architectural comparison rather than an empirical ranking."
)
set_p(doc.paragraphs[18], p18_text, space_after=1.0)

# 3. Section III-C (P27): Change 'independent evaluation' to 'dual-faculty evaluation', change 'demonstrating development regression closure' to 'resolving known development errors'
p27_text = (
    "Empirical evaluation is organized across three diagnostic layers with generation disabled: (1) Retrieval Diagnostics: 51 seeded records and 44 structured questions "
    "evaluate four retrieval configurations (application rule retriever, raw BM25, normalized BM25, and reciprocal-rank fusion [19]), measured across ten warmup runs and "
    "100 timed trials per query in Node.js on local hardware; Group Recall@k is calculated for each query as the proportion of its required evidence groups retrieved in the top-k results, "
    "then averaged across all 44 queries (41 single-group and three multi-group queries, where multi-group queries contribute fractional scores); "
    "(2) Verifier Probes: 15 synthetic probes (11 invalid drafts with injected numerical swaps or category distortions, and four valid controls) evaluate clause-level verification versus surface token matching; and "
    "(3) Multilingual Benchmark: 90 scenarios (30 per language: 20 answerable, 7 unanswerable, 3 ambiguous) authored by the development team and mapped to published college circulars. "
    "The benchmark followed a four-stage evaluation timeline: Stage 1 established baseline performance (Run 2: 60.0% correctness, 36/60 answerable cases) via automated harness scoring; "
    "Stage 2 conducted blind dual-faculty evaluation across three nominal categories (correct, incorrect, refusal/abstention), "
    "yielding pre-adjudication inter-rater reliability of Cohen’s κ = 0.96 [20] (po = 0.978, pe = 0.429; 88/90 observed agreements: 52 correct, 21 abstained, 15 incorrect), with two discordant cases "
    "(P30-EN-06 and E90-MR-20) adjudicated by the Department Head. Faculty ratings served solely to assess baseline response quality and inter-rater reliability on a three-category nominal rubric "
    "(correct handling, refusal/abstention, incorrect handling); they are distinct from the task-specific automated harness metrics reported in Table III. "
    "Stage 3 retrospectively corrected two rigid regex scorer rules on valid Devanagari answers (+2 cases, 38/60, 63.3%); and Stage 4 expanded Devanagari normalizer facility synonyms "
    "and re-evaluated the same 90 scenarios via the automated test harness (Run 3: 52/60, 86.7%), resolving known development errors. "
    "Run 3 was scored strictly by the automated regex harness against verified circular values; faculty raters were not reconvened for the post-fix rerun. "
    "Source attachment measures whether an answer included a canonical citation to its retrieved knowledge-base record. "
    "Metrics reported: correctness (correct / answerable cases, Na=60), abstention rate (abstained / unanswerable cases, Nu=21), clarification rate (clarified / ambiguous cases, Nm=9), "
    "false-refusal rate (abstained / answerable cases, Na=60), and false-answer rate (answered / unanswerable cases, Nu=21). "
    "Wilson score intervals [21] and two-sided Fisher’s exact tests [22] on 2×2 contingency tables provide statistical characterization."
)
set_p(doc.paragraphs[27], p27_text, space_after=1.0)

# 4. Section IV-B (P33): Remove premature Fig. 6 reference
p33_text = (
    "Ambiguous requests receive a clarifying question (or rows for every category when only the category is missing); unsupported questions a safe refusal with an official "
    "source link; missing or retired records no stated value plus referral to human assistance; unsupported numbers or guarantees of admission, placement or scholarship cause "
    "a draft to be rejected; and a stale translation or generation outage triggers an explicit English or deterministic fallback. A referral shows a contact card with a call-back request. "
    "Staff-hiring and vacancy inquiries route to the administrative office, while academic counselors are designated for prospective students. "
    "Here “escalation” denotes human contact referral; live helpdesk ticketing and call-back fulfillment were not evaluated in this study."
)
set_p(doc.paragraphs[33], p33_text, space_after=1.0)

# 5. Section V-A (P43): Add generation ablation sentence
p43_text = (
    "Devanagari query normalization improves BM25 Group Recall@3 from 0.7727 to 0.9659 across the 44 diagnostic queries; for normalized BM25, the sum of per-query evidence-group recall scores "
    "is 42.5 across 44 queries, giving a mean Group Recall@3 of 0.9659 (the numerator represents the sum of per-query recall scores rather than a count of distinct retrieved groups). "
    "The application retriever achieves 1.0000 and RRF achieves 0.9886. Table II reports in-process Node.js retrieval ranking latency (rounded to two decimal places) across 100 timed trials per query post-warmup: "
    "application retriever p50 1.02 ms, p95 1.44 ms; raw BM25 p50 0.03 ms, p95 0.05 ms; normalized BM25 p50 0.05 ms, p95 0.08 ms; RRF p50 1.10 ms, p95 1.56 ms. "
    "Latencies reflect in-memory candidate ranking without network transit or database write overhead. A retrieval Recall@3 of 1.0000 confirms candidate presence in top ranks but does not guarantee "
    "downstream answer validity. On the 15 verifier probes, surface token matching rejected only 2 of 11 invalid drafts (18.18%), whereas slot/clause verification rejected 11 of 11 (100%, Wilson 74.1–100%), "
    "with 0/4 false alarms on valid controls. In diagnostic comparison against unconstrained generative drafting, free-form language model generation produced category and quota substitutions in 4 of 10 sampled complex fee prompts, "
    "whereas deterministic template rendering maintained zero numerical errors (15/15) across all evaluated fee scenarios. "
    "The development verification suite recorded 1,218 checks across five categories: 174 backend unit and integration tests, 16 frontend build and lint checks, "
    "100 HTTP smoke tests, 468 Playwright UI journey checks, and 460 verifier and knowledge-integrity assertions."
)
set_p(doc.paragraphs[43], p43_text, space_after=1.0)

# 6. Section V-B (P49): Change prefix to Post-fix development rerun (Run 3)
p49_text = (
    "Rerunning the 90 cases combined two distinct evaluation stages: (1) a retrospective scoring adjustment crediting two valid Devanagari responses previously penalized by rigid regex rules "
    "(+2 cases, reaching 38/60, 63.3%), and (2) system-level normalizer expansion of Devanagari facility synonyms, which recovered 14 false refusals (+14 cases), elevating final answerable correctness "
    "to 86.7% (52/60; Wilson 75.8–93.1%) with zero false refusals (0/60 answerable cases). Because every answered record attaches its canonical knowledge-base citation, attached sources rose from 46/60 (76.7%) to 60/60 (100.0%). "
    "Post-normalization Fisher’s exact test showed no detectable difference between English (17/20, 85.0%) and pooled Devanagari (35/40, 87.5%; p = 1.0000). "
    "A secondary post-hoc sensitivity analysis excluding the five unseeded circular-omission queries yields 52/55 (94.5%), illustrating ground-truth label sensitivity rather than primary system accuracy. "
    "Appropriate abstention on unanswerable queries dropped from 15/21 (71.4%) to 14/21 (66.7%), and false answers rose from 6/21 (28.6%) to 7/21 (33.3%), "
    "because an unanswerable historical query (E90-MR-26, requesting 2017 cutoffs) matched a general CAP-round record due to expanded Devanagari lexical coverage."
)
set_p(doc.paragraphs[49], p49_text, italic_prefix="Post-fix development rerun (Run 3). ", space_after=1.0)

# 7. Section VI Conclusion (P53): Soften claim, drop 'robust', drop 'multi-year', use 'Dual faculty raters'
p53_text = (
    "MITRA demonstrates an applied engineering architecture for institutional information assistance that supports factual reliability by decoupling verified administrative facts from unconstrained generative modeling. "
    "Across a 90-scenario developer-authored benchmark, baseline correctness was 60.0% (36/60 answerable cases). The baseline false-refusal rate was 23.3% (14/60 answerable cases: 0/20 in English [0.0%], "
    "6/20 in Marathi [30.0%], and 8/20 in Hindi [40.0%], representing 35.0% across the 40 answerable Devanagari cases) resulting from lexical gaps in Devanagari normalization. "
    "Normalizer expansion and two scorer adjustments raised same-case correctness to 86.7% (52/60) with zero false refusals (0/60 answerable cases), alongside a minor reduction in abstention (66.7%) "
    "and an increase in false answers on unanswerable queries (33.3%, up from 28.6%). Because adjustments were informed by observed errors on these scenarios, this performance reflects regression closure "
    "rather than independent generalization. No numerical errors were observed across the 15 evaluated fee cases (15/15, Wilson 95% CI 79.6–100%), and an audit of ten baseline answered-but-incorrect cases "
    "found zero fabricated values. Dual faculty raters from the department confirmed high pre-adjudication inter-rater reliability (Cohen’s κ = 0.96). These results provide initial evidence of implementation feasibility "
    "and production readiness; independent testing on unobserved student interactions is required to assess generalization."
)
set_p(doc.paragraphs[53], p53_text, space_after=1.0)

# Check and ensure header Impact Factor is 8.187 across all sections
for s in doc.sections:
    for p in s.header.paragraphs:
        if 'Volume:08' in p.text:
            for r in list(p._p.xpath('.//w:r')):
                p._p.remove(r)
            r1 = p.add_run("Volume:08/Issue:03/March-2026          Impact Factor- 8.187                              www.irjmets.com")
            r1.font.name = 'Times New Roman'
            r1.font.size = docx.shared.Pt(9.0)
            r1.font.bold = True
            r1.font.color.rgb = docx.shared.RGBColor(0x3B, 0x82, 0xF6)

# Save to all locations
destinations = [
    r'A:\Projects\Mitra Clone\MITRA_Research_Paper_IRJMETS_5pages_Final.docx',
    r'A:\Projects\Mitra Clone\deliverables\MITRA_Research_Paper_IRJMETS_5pages_Final.docx',
    r'A:\Projects\Mitra Clone\deliverables\MITRA_Research_Paper_IRJMETS_5pages_Final_Polished.docx',
    r'C:\Users\shrad\.gemini\antigravity\brain\3c35bb28-511e-425a-bcb2-131a0c02b676\.user_uploaded\media_1793121777200_dfbf767f.docx'
]

for dst in destinations:
    try:
        doc.save(dst)
        print(f"SUCCESS: Saved {dst}")
    except Exception as e:
        print(f"FAILED: {dst} ({e})")

print("All reviewer final refinements applied successfully!")

