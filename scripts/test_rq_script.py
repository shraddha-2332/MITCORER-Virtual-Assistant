import docx
import os
import sys

src_path = r'C:\Users\shrad\.gemini\antigravity\brain\3c35bb28-511e-425a-bcb2-131a0c02b676\.user_uploaded\media_1793121777200_dfbf767f.docx'
out_path_final = r'A:\Projects\Mitra Clone\deliverables\MITRA_Research_Paper_IRJMETS_5pages_Final.docx'
out_path_strict = r'A:\Projects\Mitra Clone\deliverables\MITRA_Research_Paper_IRJMETS_Strict_5Pages.docx'

doc = docx.Document(src_path)

# Set ultra-calibrated margins: top=0.50", bottom=0.40", left=0.65", right=0.65"
for s in doc.sections:
    s.top_margin = docx.shared.Inches(0.50)
    s.bottom_margin = docx.shared.Inches(0.40)
    s.left_margin = docx.shared.Inches(0.65)
    s.right_margin = docx.shared.Inches(0.65)

# Scale all images:
# Shapes 0, 1 (Architecture & Taxonomy): height = 1.45"
# Shapes 2, 3, 4, 5 (UI Figures 3-6): height = 1.25"
for i, s in enumerate(doc.inline_shapes):
    if i in [0, 1]:
        orig_h = s.height.inches
        s.height = docx.shared.Inches(1.45)
        s.width = docx.shared.Inches(s.width.inches * (1.45 / orig_h))
    else:
        orig_h = s.height.inches
        s.height = docx.shared.Inches(1.25)
        s.width = docx.shared.Inches(s.width.inches * (1.25 / orig_h))

def set_para_font_and_spacing(p, text, font_size=9.5, bold=False, italic=False, space_after=1.0, space_before=0.0, line_spacing=1.0, italic_prefix=None, bold_prefix=None):
    p.paragraph_format.space_after = docx.shared.Pt(space_after)
    p.paragraph_format.space_before = docx.shared.Pt(space_before)
    p.paragraph_format.line_spacing = line_spacing
    
    # Remove existing runs
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

# Check paragraph mapping
print(f"Total paragraphs: {len(doc.paragraphs)}")

# Apply text updates
# P10: Introduction with explicit RQ introduction at the end
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
set_para_font_and_spacing(doc.paragraphs[10], p10_text, space_after=1.0)

# P11: Rename heading to A. Research Questions and Objectives
set_para_font_and_spacing(doc.paragraphs[11], "A. Research Questions and Objectives", font_size=10.0, bold=True, space_before=2.0, space_after=1.0)

# P12, P13, P14: Concrete RQ and Objectives bullet items
p12_text = (
    "•  RQ1 (Retrieval Coverage): Determine whether BM25 lexical retrieval combined with targeted Devanagari query normalization can achieve high evidence recall (Recall@3 ≥ 0.95) across English, Marathi, and Hindi institutional inquiries without heavy translation models."
)
set_para_font_and_spacing(doc.paragraphs[12], p12_text, space_after=0.5)

p13_text = (
    "•  RQ2 (Critical-Fact Fidelity): Evaluate whether deterministic template rendering over verified database records guarantees zero numerical discrepancy (100% attribute fidelity) on multi-attribute fee and intake inquiries without reliance on generative language models."
)
set_para_font_and_spacing(doc.paragraphs[13], p13_text, space_after=0.5)

p14_text = (
    "•  RQ3 (Multilingual Response Control): Characterize the operational effectiveness of a multi-stage control hierarchy—spanning answerability, targeted clarification, safe abstention, and staff referral—across English, Marathi, and Hindi development scenarios."
)
set_para_font_and_spacing(doc.paragraphs[14], p14_text, space_after=1.0)

# P27: Methodology Evaluation Design with 4-stage chronology
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
set_para_font_and_spacing(doc.paragraphs[27], p27_text, space_after=1.0)

# P34: Split Section IV into IV-C and IV-D
# Current P34 is heading. Let's make it IV-C. User Interface and Example Interactions
set_para_font_and_spacing(doc.paragraphs[34], "C. User Interface and Example Interactions", font_size=10.0, bold=True, space_before=2.0, space_after=1.0)

# Current P35 is UI walkthrough (Figs 3-6)
p35_text = (
    "Users select Automatic, English, Marathi or Hindi in a floating client widget requiring no authentication (Fig. 3). "
    "Fig. 4 shows a compound inquiry answered within a single response card (a 2026–27 hostel fee table, followed by a library response indicating borrowing policies remain unpublished); "
    "Fig. 5 shows “first year fees kiti ahe” answered directly in Marathi with the complete category-wise fee schedule; "
    "and Fig. 6 illustrates early-build referral behavior for an unseeded inquiry prior to routing refinement. Figs. 3–6 represent author-selected interface captures."
)
set_para_font_and_spacing(doc.paragraphs[35], p35_text, space_after=1.0)

# Check P36 and P37. Let's inspect them before editing

