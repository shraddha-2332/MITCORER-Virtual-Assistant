import docx

doc = docx.Document(r'A:\Projects\Mitra Clone\MITRA_Research_Paper_IRJMETS_5pages_Final.docx')

print(f"Number of sections: {len(doc.sections)}")
for i, s in enumerate(doc.sections):
    print(f"Section {i}: page_width={s.page_width.inches:.2f}\", page_height={s.page_height.inches:.2f}\", top={s.top_margin.inches:.2f}\", bottom={s.bottom_margin.inches:.2f}\", left={s.left_margin.inches:.2f}\", right={s.right_margin.inches:.2f}\"")

print(f"\nNumber of tables: {len(doc.tables)}")
for i, t in enumerate(doc.tables):
    print(f"Table {i}: rows={len(t.rows)}, cols={len(t.columns)}")

print(f"\nNumber of inline shapes: {len(doc.inline_shapes)}")
for i, s in enumerate(doc.inline_shapes):
    print(f"Shape {i}: width={s.width.inches:.2f}\", height={s.height.inches:.2f}\"")

# Print all paragraphs with their style, spacing, and length
print("\nParagraphs summary:")
for i, p in enumerate(doc.paragraphs):
    sp_after = p.paragraph_format.space_after.pt if p.paragraph_format.space_after else "None"
    sp_before = p.paragraph_format.space_before.pt if p.paragraph_format.space_before else "None"
    line_sp = p.paragraph_format.line_spacing
    words = len(p.text.split())
    if p.text.strip():
        print(f"P{i:02d} (w={words:3d}, after={sp_after}, before={sp_before}, lsp={line_sp}): {p.text[:65]}")
    else:
        print(f"P{i:02d} (EMPTY, after={sp_after}, before={sp_before})")

