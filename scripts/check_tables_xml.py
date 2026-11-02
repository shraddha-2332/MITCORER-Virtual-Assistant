import docx

doc = docx.Document(r'A:\Projects\Mitra Clone\MITRA_Research_Paper_IRJMETS_5pages_Final.docx')

for t_idx, t in enumerate(doc.tables):
    print(f"\n--- Table {t_idx} ---")
    for r_idx, r in enumerate(t.rows):
        cantSplit = len(r._tr.xpath('.//w:cantSplit')) > 0
        print(f"Row {r_idx}: cantSplit={cantSplit}, height={r.height.inches if r.height else 'None'}")

