import docx

doc = docx.Document(r'A:\Projects\Mitra Clone\deliverables\MITRA_Research_Paper_IRJMETS_5pages_Final.docx')
for i, p in enumerate(doc.paragraphs):
    if len(p._p.xpath('.//w:drawing')) > 0:
        print(f'Paragraph {i} contains drawing. Text: {p.text[:60]}')
for t_idx, t in enumerate(doc.tables):
    print(f'Table {t_idx}: {len(t.rows)} rows, {len(t.columns)} cols')

