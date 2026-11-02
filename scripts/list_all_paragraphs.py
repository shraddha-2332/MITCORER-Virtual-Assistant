import docx

doc = docx.Document(r'A:\Projects\Mitra Clone\deliverables\MITRA_Research_Paper_IRJMETS_5pages_Final.docx')
for i, p in enumerate(doc.paragraphs):
    if p.text.strip():
        print(f'{i}: [{p.text[:30]}...] (len={len(p.text)})')

