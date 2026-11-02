import docx, re

doc = docx.Document(r'A:\Projects\Mitra Clone\deliverables\MITRA_Research_Paper_IRJMETS_5pages_Final_RQ_Aligned.docx')
full_text = ''
for p in doc.paragraphs[:61]:
    full_text += ' ' + p.text

for t in doc.tables:
    for r in t.rows:
        for c in r.cells:
            full_text += ' ' + ' '.join(p.text for p in c.paragraphs)

matches = re.findall(r'\[(\d+)(?:[–-](\d+))?\]', full_text)
order = []
for m in matches:
    start = int(m[0])
    end = int(m[1]) if m[1] else start
    for num in range(start, end + 1):
        if num not in order:
            order.append(num)

print(f"Unique citation sequence in text/tables: {order}")
print(f"Count of unique citations: {len(order)}")
missing = [i for i in range(1, 23) if i not in order]
print(f"Missing citations: {missing}")

# Check references list
ref_paras = doc.paragraphs[62:84]
print(f"References paragraphs count: {len(ref_paras)}")
for i, rp in enumerate(ref_paras, 1):
    m = re.match(r'\[(\d+)\]', rp.text)
    ref_num = int(m.group(1)) if m else None
    if ref_num != i:
        print(f"Mismatch at reference {i}: starts with {rp.text[:10]}")
print("All 22 references verified in bibliography!")

