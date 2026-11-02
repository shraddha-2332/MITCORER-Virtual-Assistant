import docx

doc_path = r'A:\Projects\Mitra Clone\deliverables\MITRA_Research_Paper_IRJMETS_5pages_Final_RQ_Aligned.docx'
polished_path = r'A:\Projects\Mitra Clone\deliverables\MITRA_Research_Paper_IRJMETS_5pages_Final_Polished.docx'
art_path = r'C:\Users\shrad\.gemini\antigravity\brain\3c35bb28-511e-425a-bcb2-131a0c02b676\.user_uploaded\media_1793121777200_dfbf767f.docx'
final_path = r'A:\Projects\Mitra Clone\deliverables\MITRA_Research_Paper_IRJMETS_5pages_Final.docx'

doc = docx.Document(doc_path)

def set_p(p, text, font_size=9.5, bold=False, italic=False, space_after=1.0, space_before=0.0, line_spacing=1.0, italic_prefix=None):
    p.paragraph_format.space_after = docx.shared.Pt(space_after)
    p.paragraph_format.space_before = docx.shared.Pt(space_before)
    p.paragraph_format.line_spacing = line_spacing
    for r in list(p._p.xpath('.//w:r')):
        p._p.remove(r)
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

# 1. Abstract (P7) - 245 words, includes false-answer trade-off and future work closing sentence
abstract_text = (
    "Incorrect fee information can mislead students and parents during admission planning. "
    "This paper presents MITRA, an institutional conversational assistant developed for MIT College of Railway Engineering & Research (MITCORER), Barshi, "
    "serving English, Marathi, and Hindi queries through maintained records, deterministic rendering of critical fee and intake facts, scope-aware clarification, "
    "and referral to human staff, alongside an optional English-only generation path gated by bounded verification. "
    "On the 90-scenario development benchmark (30 per language: 60 answerable, 21 unanswerable, 9 ambiguous) scored with generation disabled, "
    "baseline correctness was 60.0% (36/60 answerable cases; English: 85.0%, Marathi: 50.0%, Hindi: 45.0%). "
    "The baseline false-refusal rate was 23.3% (14/60 answerable cases), including 0/20 English, 6/20 Marathi, and 8/20 Hindi cases, caused by unmapped Devanagari facility terms. "
    "Two departmental faculty raters independently scored all 90 baseline cases across three rating categories (Cohen’s kappa = 0.96 before Department Head adjudication of two cases). "
    "Following targeted Devanagari normalization expansion and correcting two string-matching scorer rules, an automated same-case rerun achieved 86.7% correctness (52/60) "
    "with zero false refusals (0/60 answerable cases), alongside lower abstention (66.7%, down from 71.4%) and an increase in false answers on unanswerable queries (33.3%, up from 28.6%). "
    "Because these changes were informed by errors observed on the benchmark, this revised result represents regression closure on the development set rather than independent generalization. "
    "No numerical errors were observed in the 15 evaluated fee cases on the deterministic path, and an audit of ten baseline answered-but-incorrect cases found zero fabricated values. "
    "Evaluation on an independently authored, held-out test set remains future work."
)
words = len(abstract_text.split())
print(f"Abstract word count: {words}")
set_p(doc.paragraphs[7], abstract_text, space_after=1.0)

# 2. Section I-A (P13) - Soften RQ2 claim from 'guarantees' to 'evaluates elimination'
p13_text = (
    "•  RQ2 (Critical-Fact Fidelity): Evaluate whether deterministic template rendering over verified database records eliminates numerical discrepancies (aiming for 100% attribute fidelity) on multi-attribute fee and intake inquiries without reliance on generative language models."
)
set_p(doc.paragraphs[13], p13_text, space_after=0.5)

# 3. Section III-A (P23) - Accurate Institutional Provenance
p23_text = (
    "The development corpus holds 51 published seed records, separate from the live database; each experiment names its snapshot. "
    "Records carry structured facts, source links, publication status, revision data and validity metadata: fee records separate entry route and applicant attributes, "
    "accommodation records separate hostel, refundable deposit and annual mess amounts, and programme records supply maintained intake values. "
    "Source files (PDF, scans, TXT, CSV) pass through Poppler extraction and English Tesseract OCR, receive source metadata, academic year and content hashes, "
    "and are published after maintainer review; scanned Devanagari documents enter by an alternative route. Authenticated updates are validated and revision-checked, "
    "a record moves from draft to review to published (later archived or retired), and only published records are publicly retrievable (Fig. 1). "
    "Website monitoring stages detected changes for review and never auto-publishes. All administrative facts were transcribed from approved institutional "
    "fee schedules and circulars, and reviewed by the institutional review panel (Principal and Head of Computer Science and Engineering)."
)
set_p(doc.paragraphs[23], p23_text, space_after=1.0)

# 4. Section III-C (P27) - Include the missing rater clarification sentence explicitly
p27_text = (
    "Empirical evaluation is organized across three diagnostic layers with generation disabled: (1) Retrieval Diagnostics: 51 seeded records and 44 structured questions "
    "evaluate four retrieval configurations (application rule retriever, raw BM25, normalized BM25, and reciprocal-rank fusion [19]), measured across ten warmup runs and "
    "100 timed trials per query in Node.js on local hardware; Group Recall@k is calculated for each query as the proportion of its required evidence groups retrieved in the top-k results, "
    "then averaged across all 44 queries (41 single-group and three multi-group queries, where multi-group queries contribute fractional scores); "
    "(2) Verifier Probes: 15 synthetic probes (11 invalid drafts with injected numerical swaps or category distortions, and four valid controls) evaluate clause-level verification versus surface token matching; and "
    "(3) Multilingual Benchmark: 90 scenarios (30 per language: 20 answerable, 7 unanswerable, 3 ambiguous) authored by the development team and mapped to published college circulars. "
    "The benchmark followed a four-stage evaluation timeline: Stage 1 established baseline performance (Run 2: 60.0% correctness, 36/60 answerable cases) via automated harness scoring; "
    "Stage 2 conducted blind, independent evaluation by two departmental faculty raters across three nominal categories (correct, incorrect, refusal/abstention), "
    "yielding pre-adjudication inter-rater reliability of Cohen’s κ = 0.96 [20] (po = 0.978, pe = 0.429; 88/90 observed agreements: 52 correct, 21 abstained, 15 incorrect), with two discordant cases "
    "(P30-EN-06 and E90-MR-20) adjudicated by the Department Head. Faculty ratings served solely to assess baseline response quality and inter-rater reliability on a three-category nominal rubric "
    "(correct handling, refusal/abstention, incorrect handling); they are distinct from the task-specific automated harness metrics reported in Table III. "
    "Stage 3 retrospectively corrected two rigid regex scorer rules on valid Devanagari answers (+2 cases, 38/60, 63.3%); and Stage 4 expanded Devanagari normalizer facility synonyms "
    "and re-evaluated the same 90 scenarios via the automated test harness (Run 3: 52/60, 86.7%), demonstrating development regression closure. "
    "Run 3 was scored strictly by the automated regex harness against verified circular values; faculty raters were not reconvened for the post-fix rerun. "
    "Source attachment measures whether an answer included a canonical citation to its retrieved knowledge-base record. "
    "Metrics reported: correctness (correct / answerable cases, Na=60), abstention rate (abstained / unanswerable cases, Nu=21), clarification rate (clarified / ambiguous cases, Nm=9), "
    "false-refusal rate (abstained / answerable cases, Na=60), and false-answer rate (answered / unanswerable cases, Nu=21). "
    "Wilson score intervals [21] and two-sided Fisher’s exact tests [22] on 2×2 contingency tables provide statistical characterization."
)
set_p(doc.paragraphs[27], p27_text, space_after=1.0)

# 5. Section IV-A (P30) - Fix citation: Google Gemini API [18] (was [17])
p30_text = (
    "MITRA is a modular monolith: React 19 (Vite 8) provides the browser interface, Node.js the HTTP API, and SQLite the records and cached vectors. "
    "Public answering, authentication, knowledge maintenance, retrieval, and evidence checks are separate modules; public and administration APIs are separate "
    "entry points over one store. Optional embedding and generation calls go to the Google Gemini API [18], and deterministic rendering does not depend on them. "
    "The backend validates each question, resolves context, and returns an answer, clarification, unavailable-information response, or referral (Fig. 2). "
    "History is bound to a random HttpOnly session cookie with a 30-minute idle expiry, and admission approval is never inferred from it."
)
set_p(doc.paragraphs[30], p30_text, space_after=1.0)

# 6. Section IV-D (P37) - Grounded privacy + retention policy note + Gemini API note
p37_text = (
    "The client-side integration uses an asynchronous script loader designed to mount the MITRA widget on the institutional website (mitcorer.edu.in) without requiring CMS modifications. "
    "The integration has been validated in the local development environment; deployment on public institutional servers and open campus-wide operation remain future work. "
    "This decoupled architecture isolates conversational availability from portal updates and provides a graceful offline fallback if backend connectivity is interrupted. "
    "Conversation sessions are bound to an ephemeral session cookie that expires after 30 minutes of idle time. Contact details submitted for staff call-backs are stored in the local SQLite database "
    "for counselor telephone follow-up; a formal data retention and purging policy remains future work. Optional English embedding calls transmit non-critical query strings to the external Google Gemini API [18] "
    "without user-identifying session metadata. Following local server validation and knowledge-base verification, the prototype engine, verified records, and administrative update interface were handed over to institutional authorities. "
    "Full-scale production validation—including concurrent load testing across peak admission cycles, automated telemetry monitoring, and adversarial prompt-injection audits—is planned as future work prior to open public operation."
)
set_p(doc.paragraphs[37], p37_text, space_after=1.0)

# 7. Section V-A (P43) - Change 'exact' latency to 'latency (rounded to two decimal places)'
p43_text = (
    "Devanagari query normalization improves BM25 Group Recall@3 from 0.7727 to 0.9659 across the 44 diagnostic queries; for normalized BM25, the sum of per-query evidence-group recall scores "
    "is 42.5 across 44 queries, giving a mean Group Recall@3 of 0.9659 (the numerator represents the sum of per-query recall scores rather than a count of distinct retrieved groups). "
    "The application retriever achieves 1.0000 and RRF achieves 0.9886. Table II reports in-process Node.js retrieval ranking latency (rounded to two decimal places) across 100 timed trials per query post-warmup: "
    "application retriever p50 1.02 ms, p95 1.44 ms; raw BM25 p50 0.03 ms, p95 0.05 ms; normalized BM25 p50 0.05 ms, p95 0.08 ms; RRF p50 1.10 ms, p95 1.56 ms. "
    "Latencies reflect in-memory candidate ranking without network transit or database write overhead. A retrieval Recall@3 of 1.0000 confirms candidate presence in top ranks but does not guarantee "
    "downstream answer validity. On the 15 verifier probes, surface token matching rejected only 2 of 11 invalid drafts (18.18%), whereas slot/clause verification rejected 11 of 11 (100%, Wilson 74.1–100%), "
    "with 0/4 false alarms on valid controls. The development verification suite recorded 1,218 checks across five categories: 174 backend unit and integration tests, 16 frontend build and lint checks, "
    "100 HTTP smoke tests, 468 Playwright UI journey checks, and 460 verifier and knowledge-integrity assertions."
)
set_p(doc.paragraphs[43], p43_text, space_after=1.0)

# 8. Section VI Conclusion (P53) - Update trade-off (false-answers rise to 33.3%)
p53_text = (
    "MITRA demonstrates an architectural approach for institutional information assistance that decouples verified administrative facts from unconstrained generative modeling. "
    "Across a 90-scenario developer-authored benchmark, baseline correctness was 60.0% (36/60 answerable cases). The baseline false-refusal rate was 23.3% (14/60 answerable cases: 0/20 in English [0.0%], "
    "6/20 in Marathi [30.0%], and 8/20 in Hindi [40.0%], representing 35.0% across the 40 answerable Devanagari cases) resulting from lexical gaps in Devanagari normalization. "
    "Normalizer expansion and two scorer adjustments raised same-case correctness to 86.7% (52/60) with zero false refusals (0/60 answerable cases), alongside a minor reduction in abstention (66.7%) "
    "and an increase in false answers on unanswerable queries (33.3%, up from 28.6%). Because adjustments were informed by observed errors on these scenarios, this performance reflects regression closure "
    "rather than independent generalization. No numerical errors were observed across the 15 evaluated fee cases (15/15, Wilson 95% CI 79.6–100%), and an audit of ten baseline answered-but-incorrect cases "
    "found zero fabricated values. Two faculty raters from the department confirmed high pre-adjudication inter-rater reliability (Cohen’s κ = 0.96). These results provide initial evidence of implementation feasibility; "
    "independent testing on unobserved student interactions is required to assess generalization."
)
set_p(doc.paragraphs[53], p53_text, space_after=1.0)

# Save to polished_path (guaranteed fresh name)
doc.save(polished_path)
print(f"SUCCESS: Saved {polished_path}")

# Attempt to save to others if not locked
for pth in [art_path, final_path, doc_path]:
    try:
        doc.save(pth)
        print(f"SUCCESS: Saved {pth}")
    except Exception as e:
        print(f"LOCKED/SKIPPED: {pth} ({e})")
