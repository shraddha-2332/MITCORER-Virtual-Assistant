import docx

doc = docx.Document(r'A:\Projects\Mitra Clone\MITRA_Research_Paper_IRJMETS_5pages_Final.docx')
p = doc.paragraphs[62]
print('P62 pPr XML:')
print(p._p.pPr.xml)

