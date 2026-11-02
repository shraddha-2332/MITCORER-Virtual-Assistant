import docx

doc = docx.Document(r'A:\Projects\Mitra Clone\deliverables\MITRA_Research_Paper_IRJMETS_5pages_Final_RQ_Aligned.docx')

print(f"Total paragraphs: {len(doc.paragraphs)}")
print(f"Total tables: {len(doc.tables)}")
for i, s in enumerate(doc.sections):
    print(f"Section {i}: top={s.top_margin.inches:.2f}\", bottom={s.bottom_margin.inches:.2f}\", left={s.left_margin.inches:.2f}\", right={s.right_margin.inches:.2f}\"")

# Check reference spacing
ref_p = doc.paragraphs[62]
print(f"Ref [1] space_after: {ref_p.paragraph_format.space_after.pt if ref_p.paragraph_format.space_after else None} pt")
print(f"Ref [1] space_before: {ref_p.paragraph_format.space_before.pt if ref_p.paragraph_format.space_before else None} pt")
print(f"Ref [1] line_spacing: {ref_p.paragraph_format.line_spacing}")
print(f"Ref [1] font_size: {ref_p.runs[0].font.size.pt if ref_p.runs[0].font.size else None} pt")

# Check P11, P12, P13, P14
print("P11:", doc.paragraphs[11].text)
print("P12:", doc.paragraphs[12].text[:60])
print("P13:", doc.paragraphs[13].text[:60])
print("P14:", doc.paragraphs[14].text[:60])

# Check Section IV
print("P34:", doc.paragraphs[34].text)
print("P36:", doc.paragraphs[36].text)

# Check Section V
print("P38:", doc.paragraphs[38].text)
print("P39:", doc.paragraphs[39].text[:60])
print("P40:", doc.paragraphs[40].text)
print("P44:", doc.paragraphs[44].text)
print("P45:", doc.paragraphs[45].text)
print("P50:", doc.paragraphs[50].text)

