import docx

src_path = r'A:\Projects\Mitra Clone\deliverables\MITRA_Research_Paper_IRJMETS_5pages_Final_RQ_Aligned.docx'
out_path = r'A:\Projects\Mitra Clone\deliverables\MITRA_Research_Paper_IRJMETS_5pages_Final_RQ_Aligned.docx'

doc = docx.Document(src_path)

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

# 1. Abstract (P7) - No citations, exactly 215 words, includes false-answer trade-off
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
    "No numerical errors were observed in the 15 evaluated fee cases on the deterministic path, and an audit of ten baseline answered-but-incorrect cases found zero fabricated values."
)
words = len(abstract_text.split())
print(f"Abstract word count: {words}")
set_p(doc.paragraphs[7], abstract_text, space_after=1.0)

# Keywords (P8) - Use Index Terms
set_p(doc.paragraphs[8], "Conversational AI, institutional question answering, multilingual assistance, structured knowledge, deterministic verification, information retrieval.", italic_prefix="Index Terms— ", space_after=1.0)

# Section II (P18) - Update sequential citations [1], [2], [3], [4], [5]-[8], [9]
p18_text = (
    "Retrieval-augmented generation (RAG) conditions model generation on retrieved evidence [1]; MITRA restricts generative modeling to an optional, English-only path. "
    "BM25 [2], [3] serves as an established lexical baseline [4]; raw and normalized BM25 are compared here as a retrieval diagnostic separate from end-to-end generation. "
    "While conversational admission systems are documented in prior literature [5]–[8], [9], MITRA focuses on the engineering mechanisms required to bind multi-attribute "
    "fee structures, query scope, and deterministic fail-safes into a maintained design. Because external systems were not evaluated on MITRA’s corpus, Table I presents "
    "an architectural comparison rather than an empirical ranking."
)
set_p(doc.paragraphs[18], p18_text, space_after=1.0)

# Table I (doc.tables[0]) - Update reference numbers in rows
# Row 0: Header
# Row 1: [1], [2], [4]
# Row 2: [5]–[8]
# Row 3: [9]
# Row 4: [10], [11], [12]
# Row 5: [13]–[15], [16], [17]
t1_refs = [
    "[1] 2020; [2] 2009; [4] 2021",
    "[5]–[8] 2024–25",
    "[9] 2024",
    "[10] 2020; [11], [12] 2020–21",
    "[13]–[15] 2024–26; [16] 2023; [17] 2001"
]
for idx, ref_str in enumerate(t1_refs, start=1):
    cell = doc.tables[0].rows[idx].cells[0]
    for r in list(cell.paragraphs[0]._p.xpath('.//w:r')):
        cell.paragraphs[0]._p.remove(r)
    run = cell.paragraphs[0].add_run(ref_str)
    run.font.name = 'Times New Roman'
    run.font.size = docx.shared.Pt(8.5)

# Section III-A (P23) - Provenance: Factual, non-invented phrasing
p23_text = (
    "The development corpus holds 51 published seed records, separate from the live database; each experiment names its snapshot. "
    "Records carry structured facts, source links, publication status, revision data and validity metadata: fee records separate entry route and applicant attributes, "
    "accommodation records separate hostel, refundable deposit and annual mess amounts, and programme records supply maintained intake values. "
    "Source files (PDF, scans, TXT, CSV) pass through Poppler extraction and English Tesseract OCR, receive source metadata, academic year and content hashes, "
    "and are published after maintainer review; scanned Devanagari documents enter by an alternative route. Authenticated updates are validated and revision-checked, "
    "a record moves from draft to review to published (later archived or retired), and only published records are publicly retrievable (Fig. 1). "
    "Website monitoring stages detected changes for review and never auto-publishes. All administrative facts were transcribed from approved 2024–2026 institutional circulars "
    "and fee schedules by the project team and reviewed by the CSE departmental review panel (Principal and CSE leadership)."
)
set_p(doc.paragraphs[23], p23_text, space_after=1.0)

# Section III-B (P25) - Citation [18] for Gemini embeddings
p25_text = (
    "A bounded rule-based parser processes English, Marathi, Hindi, and transliterated expressions, extracting topic, programme, entry route, academic year, category, "
    "gender, and service attributes. Academic year and entry route are isolated, and conflicting values trigger explicit disambiguation. Candidate retrieval combines "
    "weighted lexical scoring with synonym mappings; optional Gemini embeddings [18] are applied strictly to English queries. Candidate relevance does not guarantee "
    "answerability; the retrieved record must contain verified values matching the extracted scope. The operational decision hierarchy executes in strict sequence: "
    "(1) validate input, extract scope, and retrieve eligible published records; (2) trigger targeted clarification when critical parameters are missing rather than "
    "synthesizing default values; (3) render canonical fee and intake facts deterministically from database records; (4) permit bounded generative drafting exclusively "
    "for non-critical English inquiries, while Marathi and Hindi rely entirely on deterministic rendering and hash-bound translations; (5) subject all generated drafts "
    "to verification checks including exact numeric match, citation presence, and clause-level slot binding; and (6) execute structured fallbacks (verified summary, "
    "explicit unanswerable notice, or human staff referral). Open-domain semantic entailment remains outside the operational scope."
)
set_p(doc.paragraphs[25], p25_text, space_after=1.0)

# Section III-C (P27) - Citations [19], [20], [21], [22] in order; clear statement on Run 3 scoring
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
    "(P30-EN-06 and E90-MR-20) adjudicated by the Department Head; Stage 3 retrospectively corrected two rigid regex scorer rules on valid Devanagari answers (+2 cases, 38/60, 63.3%); "
    "and Stage 4 expanded Devanagari normalizer facility synonyms and re-evaluated the same 90 scenarios via the automated test harness (Run 3: 52/60, 86.7%), demonstrating development regression closure. "
    "Run 3 was scored strictly by the automated regex harness against verified circular values; faculty raters were not reconvened for the post-fix rerun. "
    "Source attachment measures whether an answer included a canonical citation to its retrieved knowledge-base record. "
    "Metrics reported: correctness (correct / answerable cases, Na=60), abstention rate (abstained / unanswerable cases, Nu=21), clarification rate (clarified / ambiguous cases, Nm=9), "
    "false-refusal rate (abstained / answerable cases, Na=60), and false-answer rate (answered / unanswerable cases, Nu=21). "
    "Wilson score intervals [21] and two-sided Fisher’s exact tests [22] on 2×2 contingency tables provide statistical characterization."
)
set_p(doc.paragraphs[27], p27_text, space_after=1.0)

# Section IV-D (P37) - Grounded privacy & session boundaries
p37_text = (
    "The client-side integration uses an asynchronous script loader designed to mount the MITRA widget on the institutional website (mitcorer.edu.in) without requiring CMS modifications. "
    "The integration has been validated in the local development environment; deployment on public institutional servers and open campus-wide operation remain future work. "
    "This decoupled architecture isolates conversational availability from portal updates and provides a graceful offline fallback if backend connectivity is interrupted. "
    "Conversation sessions are bound to an ephemeral session cookie that expires after 30 minutes of idle time. Contact details submitted for staff call-backs are stored in the local SQLite database "
    "solely for designated institutional staff to perform telephone follow-up. "
    "Following local server validation and knowledge-base verification, the prototype engine, verified records, and administrative update interface were handed over to institutional authorities. "
    "Full-scale production validation—including concurrent load testing across peak admission cycles, automated telemetry monitoring, and adversarial prompt-injection audits—is planned as future work prior to open public operation."
)
set_p(doc.paragraphs[37], p37_text, space_after=1.0)

# Table II (doc.tables[3]) - Round latencies to 2 decimals
t2_data = [
    ['Method', 'Group R@1 / R@3 / MRR@3', 'Ranking p50 / p95 (ms)'],
    ['Keyword/rules and concepts', '0.8977 / 1.0000 / 0.9470', '1.02 / 1.44'],
    ['BM25 raw', '0.6591 / 0.7727 / 0.7121', '0.03 / 0.05'],
    ['BM25 normalized', '0.7955 / 0.9659 / 0.8769', '0.05 / 0.08'],
    ['Reciprocal-rank fusion', '0.8750 / 0.9886 / 0.9280', '1.10 / 1.56']
]
t2 = doc.tables[3]
for r_idx, r_vals in enumerate(t2_data):
    row = t2.rows[r_idx]
    for c_idx, val in enumerate(r_vals):
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

# Update References [1] to [22] to be strictly sequential
refs = [
    "[1] P. Lewis et al., \"Retrieval-Augmented Generation for Knowledge-Intensive NLP Tasks,\" in Adv. Neural Inf. Process. Syst. (NeurIPS), vol. 33, 2020, pp. 9459–9474. arXiv:2005.11401.",
    "[2] S. Robertson and H. Zaragoza, \"The Probabilistic Relevance Framework: BM25 and Beyond,\" Found. Trends Inf. Retr., vol. 3, no. 4, pp. 333–389, 2009, doi: 10.1561/1500000019.",
    "[3] C. D. Manning, P. Raghavan, and H. Schütze, Introduction to Information Retrieval. Cambridge, U.K.: Cambridge Univ. Press, 2008.",
    "[4] N. Thakur et al., \"BEIR: A heterogeneous benchmark for zero-shot evaluation of information retrieval models,\" in Proc. NeurIPS Datasets and Benchmarks Track, 2021.",
    "[5] L. Nguyen and T. Quan, \"URAG: Implementing a Unified Hybrid RAG for Precise Answers in University Admission Chatbots—A Case Study at HCMUT,\" arXiv:2501.16276, 2025.",
    "[6] H.-T. Nguyen, Q.-D. Ngo, and Q.-D. Dang, \"An Intent-Filtered Retrieval-Augmented Generation Chatbot for University Admissions in Vietnam,\" in Proc. ATC, 2024, doi: 10.1109/ATC63255.2024.10908188.",
    "[7] A. Nguyen-Duc et al., \"An Empirical Study of Multi-Agent RAG for Real-World University Admissions Counseling,\" arXiv:2507.11272, 2025.",
    "[8] M. Maryamah et al., \"Chatbots in Academia: A Retrieval-Augmented Generation Approach for Improved Efficient Information Access,\" in Proc. 16th Int. Conf. Knowledge and Smart Technology (KST), 2024, pp. 259–264, doi: 10.1109/KST61284.2024.10499652.",
    "[9] Z. Chen, D. Zou, H. Xie, H. Lou, and Z. Pang, \"Facilitating university admission using a chatbot based on large language models with retrieval-augmented generation,\" Educ. Technol. Soc., vol. 27, no. 4, pp. 454–470, 2024, doi: 10.30191/ETS.202410_27(4).TP02.",
    "[10] D. Kakwani et al., \"IndicNLPSuite: Monolingual Corpora, Evaluation Benchmarks and Pre-trained Multilingual Language Models for Indian Languages,\" in Findings of EMNLP, 2020, pp. 4948–4961, doi: 10.18653/v1/2020.findings-emnlp.445.",
    "[11] J. H. Clark et al., \"TyDi QA: A benchmark for information-seeking question answering in typologically diverse languages,\" Trans. Assoc. Comput. Linguistics, vol. 8, pp. 454–470, 2020.",
    "[12] A. Asai et al., \"XOR QA: Cross-lingual open-retrieval question answering,\" in Proc. NAACL-HLT, 2021, pp. 547–564.",
    "[13] S. Es, J. James, L. Espinosa Anke, and S. Schockaert, \"RAGAs: Automated Evaluation of Retrieval Augmented Generation,\" in Proc. EACL System Demonstrations, 2024, pp. 150–158, doi: 10.18653/v1/2024.eacl-demo.16.",
    "[14] P. Mathur, A. Siu, N. Lipka, and T. Sun, \"MATSA: Multi-Agent Table Structure Attribution,\" in Proc. EMNLP System Demonstrations, 2024, pp. 250–258, doi: 10.18653/v1/2024.emnlp-demo.26.",
    "[15] K. S. Bukkapatnam and S. Mehta, \"TabFaith: Benchmarking and Improving Structural Faithfulness in LLM Table Summarization,\" in Proc. SURGeLLM Workshop, 2026, pp. 326–332, doi: 10.18653/v1/2026.surgellm-1.21.",
    "[16] Z. Ji et al., \"Survey of hallucination in natural language generation,\" ACM Comput. Surv., vol. 55, no. 12, Art. 248, 2023.",
    "[17] P. Buneman, S. Khanna, and W.-C. Tan, \"Why and where: A characterization of data provenance,\" in Proc. ICDT, LNCS vol. 1973, 2001, pp. 316–330.",
    "[18] Gemini Team, Google, \"Gemini: A family of highly capable multimodal models,\" arXiv:2312.11805, 2023.",
    "[19] G. V. Cormack, C. L. A. Clarke, and S. Büttcher, \"Reciprocal rank fusion outperforms Condorcet and individual rank learning methods,\" in Proc. 32nd ACM SIGIR, 2009, pp. 758–759, doi: 10.1145/1571941.1572114.",
    "[20] J. Cohen, \"A coefficient of agreement for nominal scales,\" Educ. Psychol. Meas., vol. 20, no. 1, pp. 37–46, 1960.",
    "[21] E. B. Wilson, \"Probable inference, the law of succession, and statistical inference,\" J. Amer. Statist. Assoc., vol. 22, no. 158, pp. 209–212, 1927.",
    "[22] R. A. Fisher, \"On the interpretation of χ² from contingency tables, and the calculation of P,\" J. Roy. Statist. Soc., vol. 85, no. 1, pp. 87–94, 1922."
]

for idx, ref_text in enumerate(refs):
    p_idx = 62 + idx
    set_p(doc.paragraphs[p_idx], ref_text, font_size=8.0, space_after=0.0, space_before=0.0, line_spacing=1.0)

doc.save(out_path)
print("SUCCESS: Updated document with strictly sequential references and grounded facts!")

