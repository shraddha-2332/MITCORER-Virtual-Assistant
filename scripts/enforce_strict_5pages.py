import docx

doc_path = r'A:\Projects\Mitra Clone\deliverables\MITRA_Research_Paper_IRJMETS_5pages_Final_Polished.docx'
doc = docx.Document(doc_path)

# 1. Calibrate section margins: top=0.45", bottom=0.38", left=0.60", right=0.60"
for s in doc.sections:
    s.top_margin = docx.shared.Inches(0.45)
    s.bottom_margin = docx.shared.Inches(0.38)
    s.left_margin = docx.shared.Inches(0.60)
    s.right_margin = docx.shared.Inches(0.60)

# 2. Scale images to compact sizes:
# Figs 1-2: height = 1.30"
# Figs 3-6: height = 1.08"
for i, s in enumerate(doc.inline_shapes):
    if i in [0, 1]:
        orig_h = s.height.inches
        s.height = docx.shared.Inches(1.30)
        s.width = docx.shared.Inches(s.width.inches * (1.30 / orig_h))
    else:
        orig_h = s.height.inches
        s.height = docx.shared.Inches(1.08)
        s.width = docx.shared.Inches(s.width.inches * (1.08 / orig_h))

# 3. Clean up empty paragraphs
# Remove text or reduce height of empty paragraphs
empty_indices = [5, 20, 31, 42, 46]
for idx in empty_indices:
    p = doc.paragraphs[idx]
    p.paragraph_format.space_after = docx.shared.Pt(0.0)
    p.paragraph_format.space_before = docx.shared.Pt(0.0)
    p.paragraph_format.line_spacing = docx.shared.Pt(1.0)
    for r in list(p._p.xpath('.//w:r')):
        p._p.remove(r)
    # add a 1pt font run to collapse it to practically zero height
    r = p.add_run()
    r.font.size = docx.shared.Pt(1.0)

# 4. Format all body paragraphs to compact line spacing
for i in range(len(doc.paragraphs)):
    p = doc.paragraphs[i]
    if i >= 62: # References
        p.paragraph_format.space_after = docx.shared.Pt(0.0)
        p.paragraph_format.space_before = docx.shared.Pt(0.0)
        p.paragraph_format.line_spacing = 0.95
        for r in p.runs:
            r.font.name = 'Times New Roman'
            r.font.size = docx.shared.Pt(7.5)
    elif i in [9, 17, 21, 28, 38, 52, 59, 61]: # Main Section Headings (I, II, III, IV, V, VI, ACK, REF)
        p.paragraph_format.space_before = docx.shared.Pt(2.0)
        p.paragraph_format.space_after = docx.shared.Pt(0.5)
    elif i in [11, 15, 22, 24, 26, 29, 32, 34, 36, 40, 44, 50, 54]: # Subheadings (A, B, C...)
        p.paragraph_format.space_before = docx.shared.Pt(1.5)
        p.paragraph_format.space_after = docx.shared.Pt(0.5)
    elif i in [19, 41, 45]: # Table captions
        p.paragraph_format.space_before = docx.shared.Pt(1.5)
        p.paragraph_format.space_after = docx.shared.Pt(0.5)
    elif i in [12, 13, 14, 55, 56, 57, 58]: # Bullets
        p.paragraph_format.space_before = docx.shared.Pt(0.0)
        p.paragraph_format.space_after = docx.shared.Pt(0.5)
        p.paragraph_format.line_spacing = 1.0
    elif i not in empty_indices: # Regular body paragraphs
        p.paragraph_format.space_before = docx.shared.Pt(0.0)
        p.paragraph_format.space_after = docx.shared.Pt(0.8)
        p.paragraph_format.line_spacing = 1.0

# 5. Compact all table cells
for t in doc.tables:
    for row in t.rows:
        for cell in row.cells:
            for p in cell.paragraphs:
                p.paragraph_format.space_after = docx.shared.Pt(0.2)
                p.paragraph_format.space_before = docx.shared.Pt(0.2)
                p.paragraph_format.line_spacing = 1.0
                for r in p.runs:
                    if r.font.size and r.font.size.pt > 8.0:
                        r.font.size = docx.shared.Pt(8.0)

# Save to destination paths
out_final = r'A:\Projects\Mitra Clone\MITRA_Research_Paper_IRJMETS_5pages_Final.docx'
out_deliv = r'A:\Projects\Mitra Clone\deliverables\MITRA_Research_Paper_IRJMETS_5pages_Final.docx'
out_art = r'C:\Users\shrad\.gemini\antigravity\brain\3c35bb28-511e-425a-bcb2-131a0c02b676\.user_uploaded\media_1793121777200_dfbf767f.docx'

for pth in [out_final, out_deliv, out_art, doc_path]:
    try:
        doc.save(pth)
        print(f"SUCCESS: Saved {pth}")
    except Exception as e:
        print(f"FAILED: {pth} ({e})")

