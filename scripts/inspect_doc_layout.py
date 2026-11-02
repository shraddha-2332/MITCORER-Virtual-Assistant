import docx

doc = docx.Document(r'A:\Projects\Mitra Clone\deliverables\MITRA_Research_Paper_IRJMETS_5pages_Final_RQ_Aligned.docx')
for i, s in enumerate(doc.sections):
    print(f'Section {i}: top={s.top_margin.inches:.2f}", bottom={s.bottom_margin.inches:.2f}", left={s.left_margin.inches:.2f}", right={s.right_margin.inches:.2f}", height={s.page_height.inches:.2f}", width={s.page_width.inches:.2f}"')

for i, shape in enumerate(doc.inline_shapes):
    print(f'Shape {i}: width={shape.width.inches:.2f}", height={shape.height.inches:.2f}"')

p_words = sum(len(p.text.split()) for p in doc.paragraphs)
table_words = 0
for t in doc.tables:
    for row in t.rows:
        for cell in row.cells:
            table_words += sum(len(p.text.split()) for p in cell.paragraphs)
print(f'Paragraph words: {p_words}, Table words: {table_words}, Total words: {p_words + table_words}')
