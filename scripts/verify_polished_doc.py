import docx

doc = docx.Document(r'A:\Projects\Mitra Clone\deliverables\MITRA_Research_Paper_IRJMETS_5pages_Final_Polished.docx')

print(f"Total paragraphs: {len(doc.paragraphs)}")
print(f"Section 0 margins: top={doc.sections[0].top_margin.inches:.2f}\", bottom={doc.sections[0].bottom_margin.inches:.2f}\"")
print(f"IV-A Gemini citation check: {'[18]' in doc.paragraphs[30].text}")
print(f"III-C rater sentence check: {'distinct from the task-specific' in doc.paragraphs[27].text}")
print(f"III-A provenance check: {'Principal and Head of Computer Science and Engineering' in doc.paragraphs[23].text}")
print(f"IV-D retention check: {'formal data retention and purging policy' in doc.paragraphs[37].text}")
print(f"V-A rounded check: {'rounded to two decimal places' in doc.paragraphs[43].text}")
print(f"VI trade-off check: {'33.3%, up from 28.6%' in doc.paragraphs[53].text}")
print(f"Abstract future work check: {'independently authored, held-out test set remains future work' in doc.paragraphs[7].text}")

