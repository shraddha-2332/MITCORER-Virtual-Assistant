import docx
from docx.shared import Inches, Pt, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.table import WD_TABLE_ALIGNMENT
from docx.oxml import parse_xml
from docx.oxml.ns import nsdecls
import os

doc = docx.Document()

# Margins
for section in doc.sections:
    section.top_margin = Inches(0.8)
    section.bottom_margin = Inches(0.8)
    section.left_margin = Inches(0.8)
    section.right_margin = Inches(0.8)

# Colors
MAROON = RGBColor(122, 21, 24)
DARK_TEXT = RGBColor(27, 36, 51)
MUTED = RGBColor(100, 100, 100)

def set_cell_shading(cell, color_hex):
    shading = parse_xml(f'<w:shd {nsdecls("w")} w:fill="{color_hex}"/>')
    cell._tc.get_or_add_tcPr().append(shading)

def set_cell_margins(cell, top=100, bottom=100, left=140, right=140):
    tcPr = cell._tc.get_or_add_tcPr()
    tcMar = parse_xml(f'<w:tcMar {nsdecls("w")}><w:top w:w="{top}" w:type="dxa"/><w:bottom w:w="{bottom}" w:type="dxa"/><w:left w:w="{left}" w:type="dxa"/><w:right w:w="{right}" w:type="dxa"/></w:tcMar>')
    tcPr.append(tcMar)

# Title Header
p_inst = doc.add_paragraph()
p_inst.alignment = WD_ALIGN_PARAGRAPH.CENTER
p_inst.paragraph_format.space_after = Pt(2)
r = p_inst.add_run("MAEER'S MIT COLLEGE OF RAILWAY ENGINEERING & RESEARCH, BARSHI")
r.font.name = 'Arial'
r.font.size = Pt(10)
r.font.bold = True
r.font.color.rgb = MAROON

p_dept = doc.add_paragraph()
p_dept.alignment = WD_ALIGN_PARAGRAPH.CENTER
p_dept.paragraph_format.space_after = Pt(14)
r = p_dept.add_run("Department of Computer Science & Engineering\nProject: MITRA (Multilingual Institutional Virtual Assistant)")
r.font.name = 'Arial'
r.font.size = Pt(9.5)
r.font.color.rgb = MUTED

p_title = doc.add_paragraph()
p_title.alignment = WD_ALIGN_PARAGRAPH.CENTER
p_title.paragraph_format.space_after = Pt(4)
r = p_title.add_run("MITRA Assistant: Technical Discrepancy Report & Answering Format Specification")
r.font.name = 'Arial'
r.font.size = Pt(15)
r.font.bold = True
r.font.color.rgb = MAROON

p_sub = doc.add_paragraph()
p_sub.alignment = WD_ALIGN_PARAGRAPH.CENTER
p_sub.paragraph_format.space_after = Pt(18)
r = p_sub.add_run("Analysis of Live mitcorer-chatbot.js vs. Official MITRA Engine & Mandatory Adjustments for Website Integration")
r.font.name = 'Arial'
r.font.size = Pt(10.5)
r.font.italic = True
r.font.color.rgb = DARK_TEXT

# Formatting helpers
def add_heading_1(text):
    p = doc.add_paragraph()
    p.paragraph_format.space_before = Pt(14)
    p.paragraph_format.space_after = Pt(4)
    p.paragraph_format.keep_with_next = True
    r = p.add_run(text)
    r.font.name = 'Arial'
    r.font.size = Pt(12)
    r.font.bold = True
    r.font.color.rgb = MAROON

def add_heading_2(text):
    p = doc.add_paragraph()
    p.paragraph_format.space_before = Pt(10)
    p.paragraph_format.space_after = Pt(3)
    p.paragraph_format.keep_with_next = True
    r = p.add_run(text)
    r.font.name = 'Arial'
    r.font.size = Pt(10.5)
    r.font.bold = True
    r.font.color.rgb = DARK_TEXT

def add_p(text, bold_prefix='', italic=False):
    p = doc.add_paragraph()
    p.paragraph_format.space_before = Pt(0)
    p.paragraph_format.space_after = Pt(4)
    p.paragraph_format.line_spacing = 1.15
    if bold_prefix:
        r_b = p.add_run(bold_prefix)
        r_b.font.name = 'Arial'
        r_b.font.size = Pt(10)
        r_b.font.bold = True
        r_b.font.color.rgb = DARK_TEXT
    r = p.add_run(text)
    r.font.name = 'Arial'
    r.font.size = Pt(10)
    r.font.italic = italic
    r.font.color.rgb = DARK_TEXT
    return p

# Section 1
add_heading_1("1. Executive Summary & Context")
add_p("This document details the architectural and functional discrepancies between the chat assistant recently added to the official MITCORER website (assets/js/mitcorer-chatbot.js on mitcorer.edu.in) and the official MITRA virtual assistant developed by the Department of Computer Science & Engineering under faculty supervision. While the launcher icon and basic floating window on the website look visually clean, the underlying answering mechanism operates as a standalone script using static, hardcoded regular expressions rather than connecting to the verified institutional knowledge base.")
add_p("Because college admissions involve binding financial commitments, strict regulatory compliance with the Fees Regulating Authority (FRA) and DTE Maharashtra, and category-specific reservations, unverified or misattributed responses pose serious legal and financial liabilities for the institution. This document specifies the exact differences and outlines the mandatory answering format changes required for official website deployment.")

# Section 2
add_heading_1("2. Architectural Comparison: Live Website vs. Official MITRA")
add_p("The table below contrasts the technical architecture of the live website script against the official MITRA system:")

t1 = doc.add_table(rows=1, cols=3)
t1.alignment = WD_TABLE_ALIGNMENT.CENTER
headers = ["Dimension", "Live Website Widget (mitcorer-chatbot.js)", "Official MITRA System"]
for j, h in enumerate(headers):
    cell = t1.cell(0, j)
    cell.text = h
    set_cell_shading(cell, "7A1518")
    set_cell_margins(cell, top=120, bottom=120, left=140, right=140)
    p = cell.paragraphs[0]
    for run in p.runs:
        run.font.name = "Arial"
        run.font.size = Pt(9.5)
        run.font.bold = True
        run.font.color.rgb = RGBColor(255, 255, 255)

t1_data = [
    ("Core Engine", "Client-side standalone JavaScript (42 KB); makes zero backend network calls.", "Client-server architecture powered by Node.js backend & SQLite verified store."),
    ("Knowledge Base", "34 hardcoded static regular expressions and hardcoded string arrays.", "51 canonical records extracted from signed circulars via Poppler OCR and reviewed by college authority."),
    ("Multilingual Support", "English keywords only (0% Marathi, 0% Hindi).", "Full native Marathi (Devanagari & transliterated), Hindi, and English support with native dictionary normalization."),
    ("Fee Disambiguation", "Dumps a single static First-Year table regardless of the route asked.", "Route-aware (First Year vs. Direct Second Year), category-specific (Open, OBC, EBC, SC/ST, TFWS), and gender-aware."),
    ("Evidence Provenance", "Zero official circular citations or provenance metadata.", "Attaches verifiable official circular references, notification dates, and direct PDF links to every answer."),
    ("Safe Abstention", "Generic fallback: 'Sorry, I didn't get that. Try a topic below or contact us.'", "Safe abstention with verified Admissions Enquiry Desk card (+91 84599 67882) and working hours."),
    ("Maintenance Lifecycle", "Hardcoded; requires manually editing production JavaScript code to update any fee or date.", "Authenticated Admin Portal with versioning and audit trails allowing maintainers to stage and publish updates.")
]

for row_idx, data in enumerate(t1_data):
    row = t1.add_row()
    bg = "FBF6F6" if row_idx % 2 == 1 else "FFFFFF"
    for col_idx, text in enumerate(data):
        cell = row.cells[col_idx]
        cell.text = text
        set_cell_shading(cell, bg)
        set_cell_margins(cell, top=100, bottom=100, left=140, right=140)
        p = cell.paragraphs[0]
        for run in p.runs:
            run.font.name = "Arial"
            run.font.size = Pt(9)
            if col_idx == 0:
                run.font.bold = True
            run.font.color.rgb = DARK_TEXT

doc.add_paragraph().paragraph_format.space_after = Pt(8)

# Section 3
add_heading_1("3. Detailed Gap Analysis & Mandatory Changes")

add_heading_2("A. Query Interpretation & Regional Languages")
add_p("The current script matches queries strictly against 34 English regex expressions (e.g., /(first.?year|\\bfy\\b).*(fee|cost)/). In rural and semi-urban Maharashtra, prospective students and parents frequently ask in Marathi or Hindi. Queries such as 'फी किती आहे?', 'प्रवेश प्रक्रिया कशी आहे?', 'हॉस्टेल सुविधा', or transliterated terms like 'first year fees kiti ahe' trigger immediate failure in the live script.", bold_prefix="Current Flaw: ")
add_p("The answering engine must normalize regional expressions (Marathi, Hindi, and transliterated queries) into canonical topics, ensuring that students asking in regional languages receive the exact same verified answers as English applicants.", bold_prefix="Mandatory Change: ")

add_heading_2("B. Answering Format for Academic & Concession Fees")
add_p("The current script dumps a single static First-Year fee table when any fee keyword is detected. If an applicant asks 'What is the Direct Second Year fee for OBC?', the script either misinforms them by showing First-Year figures or drops into a generic page link.", bold_prefix="Current Flaw: ")
add_p("Every fee response must adhere to four strict formatting rules:", bold_prefix="Mandatory Changes: ")
add_p("Fees must never be stated without explicit route attribution (First Year B.Tech vs. Direct Second Year DSE). Direct Second Year fees differ substantially from First Year fees.", bold_prefix="1. Route Qualification: ")
add_p("If an applicant asks 'fees for OBC' without specifying route or gender, the assistant must issue a clarification question asking for the missing details rather than assuming First Year.", bold_prefix="2. Scope Disambiguation: ")
add_p("Every fee card must explicitly state: 'Annual tuition and development fees for Academic Year 2026-27. Category concessions are contingent upon submitting valid Caste/Income/EWS certificates at admission reporting.'", bold_prefix="3. Statutory Caution Notice: ")
add_p("Every fee breakdown must attach a verified reference link pointing to the FRA-approved fee circular PDF.", bold_prefix="4. Provenance Attachment: ")

add_heading_2("C. Safe Abstention & Human Escalation Cards")
add_p("The current script emits dead-end strings: 'Hostel & mess fees aren't listed in this chat' or 'Cutoffs aren't listed here.' This leaves parents stranded without guidance.", bold_prefix="Current Flaw: ")
add_p("When an answer cannot be verified from college records (e.g., unseeded local bus stops, AICTE central schemes, CAP cutoffs), the system must emit an official Human Escalation Card containing: Destination desk (Admissions Enquiry Desk for applicants, Administrative Office for recruitment), phone numbers (+91 84599 67882 / +91 86696 11211), email (info.mitcorer@mitpune.edu.in), and official working hours (Mon-Sat, 9:00 AM – 5:00 PM).", bold_prefix="Mandatory Change: ")

add_heading_2("D. Compound / Multi-Intent Queries")
add_p("If a user asks 'What is the hostel fee and what are the library timings?', the live script only executes the first matched regex and ignores the second part.", bold_prefix="Current Flaw: ")
add_p("The response format must split compound queries into separate structured sub-cards (Section 1: Hostel accommodation fee & facilities; Section 2: Library timings, OPAC access, and book bank rules).", bold_prefix="Mandatory Change: ")

# Section 4
add_heading_1("4. Real-World Case Comparisons")

t2 = doc.add_table(rows=1, cols=3)
t2.alignment = WD_TABLE_ALIGNMENT.CENTER
headers2 = ["Applicant Query", "Current Live Widget Output (Faulty)", "MITRA Expected Answering Format"]
for j, h in enumerate(headers2):
    cell = t2.cell(0, j)
    cell.text = h
    set_cell_shading(cell, "7A1518")
    set_cell_margins(cell, top=120, bottom=120, left=140, right=140)
    p = cell.paragraphs[0]
    for run in p.runs:
        run.font.name = "Arial"
        run.font.size = Pt(9.5)
        run.font.bold = True
        run.font.color.rgb = RGBColor(255, 255, 255)

t2_data = [
    ("Direct Second Year OBC fee kiti ahe?", "Fails or displays First-Year Engineering fees (INR 61,109 / INR 17,217). Misleads DSE applicants.", "Clarifies DSY route, displays verified DSE OBC fee, attaches DSE FRA fee notice link, and adds document validity warning."),
    ("प्रवेश प्रक्रिया कशी आहे? (Marathi)", "'Sorry, I didn't get that. Try a topic below or contact us.' (Total refusal).", "Answers in fluent Marathi explaining Centralized Admission Process (CAP), registration steps, eligibility criteria, and attaches DTE portal link."),
    ("What is the hostel fee and mess charges?", "'Hostel & mess fees aren't listed in this chat. Please check fee structure...'", "Structured accommodation card listing annual hostel rent (INR 35,000), mess charges (INR 28,000), deposit (INR 5,000), and contact details."),
    ("Can I get computer engineering with 75 percentile?", "Outputs generic cut-off disclaimer with no referral action.", "Explains CAP merit variance, cites previous year reference ranges, and renders the Admissions Counsellor contact card with call-back option.")
]

for row_idx, data in enumerate(t2_data):
    row = t2.add_row()
    bg = "FBF6F6" if row_idx % 2 == 1 else "FFFFFF"
    for col_idx, text in enumerate(data):
        cell = row.cells[col_idx]
        cell.text = text
        set_cell_shading(cell, bg)
        set_cell_margins(cell, top=100, bottom=100, left=140, right=140)
        p = cell.paragraphs[0]
        for run in p.runs:
            run.font.name = "Arial"
            run.font.size = Pt(9)
            if col_idx == 0:
                run.font.bold = True
            run.font.color.rgb = DARK_TEXT

doc.add_paragraph().paragraph_format.space_after = Pt(8)

# Section 5
add_heading_1("5. Recommended Implementation Path (Zero UI Redesign)")
add_p("The web development team does NOT need to redesign the HTML/CSS layout or discard the existing widget shell in mitcorer-chatbot.js. All existing launcher icons, colors, and layout structures can remain untouched.")
add_p("To resolve all discrepancies, simply replace the local static match(text) lookup with an asynchronous fetch to the MITRA Public Assistant API endpoint:")

code_p = doc.add_paragraph()
code_p.paragraph_format.space_before = Pt(6)
code_p.paragraph_format.space_after = Pt(6)
r_code = code_p.add_run(
"// In assets/js/mitcorer-chatbot.js -> inside send(text, id):\n"
"async function queryMitraBackend(userText) {\n"
"  try {\n"
"    const response = await fetch(\"https://mitra-the-virtual-assistant.onrender.com/api/public-assistant/ask\", {\n"
"      method: \"POST\",\n"
"      headers: { \"Content-Type\": \"application/json\" },\n"
"      body: JSON.stringify({ question: userText, language: \"auto\" })\n"
"    });\n"
"    const resData = await response.json();\n"
"    const data = resData.data || resData;\n"
"    return {\n"
"      a: data.answer,\n"
"      l: (data.evidence || []).map(e => [e.title, e.url]),\n"
"      note: data.caution || null,\n"
"      f: [\"courses\", \"fees\", \"contact\"]\n"
"    };\n"
"  } catch (err) {\n"
"    // Fallback to Admissions Desk if network is unreachable\n"
"    return {\n"
"      a: \"Admissions Enquiry Desk: +91 84599 67882 | info.mitcorer@mitpune.edu.in\",\n"
"      l: [[\"Contact Admissions Office\", \"contact-us\"]],\n"
"      f: [\"adm\", \"contact\"]\n"
"    };\n"
"  }\n"
"}"
)
r_code.font.name = 'Consolas'
r_code.font.size = Pt(8.5)
r_code.font.color.rgb = RGBColor(0, 51, 102)

add_p("By routing queries through this endpoint, the college website immediately acquires full Marathi/Hindi capability, verified fee breakdowns, statutory caveats, and official circular attachments—with zero manual fee recalculation or script maintenance required by the web developer.")

# Section 6
add_heading_1("6. Contact & Department Sign-Off")
add_p("For technical coordination, testing sessions, or questions regarding API parameters, please contact the MITRA project team:")
add_p("Department of Computer Science & Engineering, MIT College of Railway Engineering & Research, Barshi\nFaculty Project Guide: Prof. Shobhana Raichurkar\nStudent Leads: Shraddha Ukirade, Anzalna Tamboli, Sayali Kakade, Dnyaneshwari Vyavahare\nOfficial Repository: https://github.com/shraddha-2332/MITRA-The-Virtual-Assistant", italic=True)

out_dir = 'deliverables'
os.makedirs(out_dir, exist_ok=True)
out_file = os.path.join(out_dir, 'MITRA_Developer_Technical_Discrepancy_and_Changes.docx')
doc.save(out_file)
print(f"Successfully generated {out_file} ({os.path.getsize(out_file)} bytes)")

