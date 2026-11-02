import docx

doc = docx.Document(r'A:\Projects\Mitra Clone\MITRA_Research_Paper_IRJMETS_5pages_Final.docx')
for i, p in enumerate(doc.paragraphs):
    kwn = len(p._p.xpath('.//w:keepNext')) > 0
    kfl = len(p._p.xpath('.//w:keepLines')) > 0
    if kwn or kfl:
        print(f"P{i:02d}: keepNext={kwn}, keepLines={kfl} - {p.text[:40]}")

