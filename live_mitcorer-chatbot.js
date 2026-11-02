/*! MITCORER Chat Assistant "Mitra" — single-file widget. Add with one <script> tag. */
(function () {
  if (window.__mitBot) return; window.__mitBot = 1;

  /* ---------- EASY SETTINGS ---------- */
  var C = {
    primary: "#ae2e30", dark: "#7a1518", accent: "#f6c9ca", /* colours taken from the MIT logo */
    logo: "data:image/png;base64,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", /* or use "/mitcorer/public/assets/images/header/MIT_eng_logo.webp" */
    base: "https://mitcorer.edu.in/mitcorer/public/",
    enq: "https://www.mitcorer.edu.in/Admissions-Open-2026-27.html",
    site: "https://mitcorer.edu.in/",
    debug: true, /* shows a small 🛠 line with the technical reason when MITRA cannot be reached; set false when everything works */
    proxy: "/mitcorer/public/mitra-proxy.php", /* upload mitra-proxy.php there; avoids browser CORS problems. Falls back to C.api if missing */
    translateUrl: "", /* optional: your own server translate endpoint, POST {q,source,target} -> {translatedText} (recommended for production) */
    translateEmail: "", /* optional: email that raises the free MyMemory daily limit */
    api: "https://mitra-the-virtual-assistant.onrender.com/api/public-assistant/ask", /* MITRA backend (verified answers) */
    tip: "Hi! Need help with admissions? 👋"
  };

  /* ---------- KNOWLEDGE (only facts published on mitcorer.edu.in) ---------- */
  var M = { menu:"Main menu", adm:"Admissions", fees:"Fees & Concessions", courses:"Programmes", docs:"Required Documents", place:"Placements", infra:"Facilities", brochure:"Brochures", contact:"Contact us", camp:"Campus Life", poly:"Diploma Programmes", about:"About MITCORER", cut:"Cutoffs", schol:"Scholarships", why:"Why MITCORER?", enq:"Admission enquiry →", fyfees:"B.Tech First-Year Fees", dsyfees:"Direct Second Year Fees", hmfees:"Hostel & Mess Fees", conc:"Concessions", hostel:"Hostel Facilities", lang_en:"English", lang_mr:"मराठी", lang_hi:"हिन्दी" };
  var MAIN = ["courses","fees","cut","docs","schol","place","infra","about","why","enq","contact"], LC = { enq: C.enq };

  /* ---------- LANGUAGES (UI text; answers come from MITRA in the selected / detected language) ---------- */
  var LANG = "en", LOCKED = 0, LANGS = ["lang_en","lang_mr","lang_hi"];
  var I = {
    en: { ph:"Type your question…", welcome:"Hello and Welcome to MITCORER! 👋 I'm <b>Mitra</b>, your virtual assistant. How can I help you today?", heroS:"MITCORER, BARSHI", heroH:"Start your engineering journey.", heroC:"Start admission enquiry →", tip:"Hi! Need help with admissions? 👋", foot:"Powered by MITRA · MITCORER · v8", fbq:"Was this helpful?", fbY:"Thanks for the feedback! 😊", fbN:"Sorry about that — please contact the admission office.", menu:"What would you like to know?", greet:"Hello! 👋 What would you like to know?", thanks:"You're welcome! 😊 Anything else I can help with?", feesnav:"Which fees would you like to know about? Please choose:", dFail:"I couldn't reach the verified assistant just now.", site:"Visit our website", dNF:"I couldn't find this information in our records. You can check our website or contact the admission desk.", orig:"Show English original", trFail:"(Translation unavailable — showing the English answer.)", dTitle:"Admissions Enquiry Desk", dHours:"Mon–Sat, 9:00 AM – 5:00 PM", call:"Call", dEmail:"Email the Admission Office", dForm:"Admission Enquiry Form" },
    mr: { ph:"तुमचा प्रश्न येथे लिहा…", welcome:"MITCORER मध्ये आपले स्वागत आहे! 👋 मी <b>मित्रा</b>, तुमची व्हर्च्युअल सहाय्यक. मी तुम्हाला कशी मदत करू?", heroS:"MITCORER, बार्शी", heroH:"तुमच्या अभियांत्रिकी प्रवासाची सुरुवात करा.", heroC:"प्रवेश चौकशी सुरू करा →", tip:"नमस्कार! प्रवेशासाठी मदत हवी आहे का? 👋", foot:"MITRA द्वारे समर्थित · MITCORER · v8", fbq:"हे उत्तर उपयुक्त होते का?", fbY:"अभिप्रायाबद्दल धन्यवाद! 😊", fbN:"क्षमस्व — कृपया प्रवेश कार्यालयाशी संपर्क साधा.", menu:"तुम्हाला काय जाणून घ्यायचे आहे?", greet:"नमस्कार! 👋 तुम्हाला काय जाणून घ्यायचे आहे?", thanks:"आपले स्वागत आहे! 😊 आणखी काही मदत हवी आहे का?", feesnav:"तुम्हाला कोणत्या शुल्काबद्दल जाणून घ्यायचे आहे? कृपया निवडा:", dFail:"सध्या मी पडताळलेल्या सहाय्यकापर्यंत पोहोचू शकले नाही.", site:"आमच्या वेबसाइटला भेट द्या", dNF:"ही माहिती आमच्या नोंदींमध्ये सापडली नाही. कृपया आमची वेबसाइट पहा किंवा प्रवेश कक्षाशी संपर्क साधा.", orig:"इंग्रजी मूळ उत्तर पहा", trFail:"(भाषांतर उपलब्ध नाही — इंग्रजी उत्तर दाखवत आहे.)", dTitle:"प्रवेश चौकशी कक्ष", dHours:"सोम–शनि, सकाळी ९:०० ते सायं. ५:००", call:"कॉल करा", dEmail:"प्रवेश कार्यालयाला ईमेल करा", dForm:"प्रवेश चौकशी फॉर्म",
      M:{ menu:"मुख्य मेनू", adm:"प्रवेश", fees:"शुल्क आणि सवलती", courses:"अभ्यासक्रम", docs:"आवश्यक कागदपत्रे", place:"प्लेसमेंट", infra:"सुविधा", brochure:"माहितीपत्रक", contact:"संपर्क", camp:"कॅम्पस जीवन", poly:"पदविका अभ्यासक्रम", about:"MITCORER बद्दल", cut:"कटऑफ", schol:"शिष्यवृत्ती", why:"MITCORER का?", enq:"प्रवेश चौकशी →", fyfees:"बी.टेक. प्रथम वर्ष शुल्क", dsyfees:"थेट द्वितीय वर्ष शुल्क", hmfees:"वसतिगृह व मेस शुल्क", conc:"सवलती", hostel:"वसतिगृह सुविधा" } },
    hi: { ph:"अपना प्रश्न यहाँ लिखें…", welcome:"MITCORER में आपका स्वागत है! 👋 मैं <b>मित्रा</b>, आपकी वर्चुअल सहायक हूँ। मैं आपकी कैसे मदद कर सकती हूँ?", heroS:"MITCORER, बार्शी", heroH:"अपनी इंजीनियरिंग यात्रा शुरू करें।", heroC:"प्रवेश पूछताछ शुरू करें →", tip:"नमस्ते! प्रवेश में मदद चाहिए? 👋", foot:"MITRA द्वारा संचालित · MITCORER · v8", fbq:"क्या यह उत्तर उपयोगी था?", fbY:"प्रतिक्रिया के लिए धन्यवाद! 😊", fbN:"क्षमा करें — कृपया प्रवेश कार्यालय से संपर्क करें।", menu:"आप क्या जानना चाहते हैं?", greet:"नमस्ते! 👋 आप क्या जानना चाहते हैं?", thanks:"आपका स्वागत है! 😊 क्या और कोई मदद चाहिए?", feesnav:"आप किस शुल्क के बारे में जानना चाहते हैं? कृपया चुनें:", dFail:"अभी मैं सत्यापित सहायक तक नहीं पहुँच सकी।", site:"हमारी वेबसाइट देखें", dNF:"यह जानकारी हमारे रिकॉर्ड में नहीं मिली। कृपया हमारी वेबसाइट देखें या प्रवेश केंद्र से संपर्क करें।", orig:"अंग्रेज़ी मूल उत्तर देखें", trFail:"(अनुवाद उपलब्ध नहीं — अंग्रेज़ी उत्तर दिखा रहे हैं।)", dTitle:"प्रवेश पूछताछ केंद्र", dHours:"सोम–शनि, सुबह 9:00 से शाम 5:00", call:"कॉल करें", dEmail:"प्रवेश कार्यालय को ईमेल करें", dForm:"प्रवेश पूछताछ फॉर्म",
      M:{ menu:"मुख्य मेनू", adm:"प्रवेश", fees:"शुल्क और रियायतें", courses:"पाठ्यक्रम", docs:"आवश्यक दस्तावेज़", place:"प्लेसमेंट", infra:"सुविधाएँ", brochure:"ब्रोशर", contact:"संपर्क करें", camp:"कैंपस जीवन", poly:"डिप्लोमा पाठ्यक्रम", about:"MITCORER के बारे में", cut:"कटऑफ", schol:"छात्रवृत्ति", why:"MITCORER क्यों?", enq:"प्रवेश पूछताछ →", fyfees:"बी.टेक. प्रथम वर्ष शुल्क", dsyfees:"सीधे द्वितीय वर्ष का शुल्क", hmfees:"छात्रावास और मेस शुल्क", conc:"रियायतें", hostel:"छात्रावास सुविधाएँ" } }
  };
  var T = function (k) { var v = I[LANG][k]; return v !== undefined ? v : I.en[k]; };
  var lab = function (id) { var m = I[LANG].M; return (m && m[id]) || M[id]; };

  var dept = function (id, re, name, seats, path) {
    return { id: id, k: re, a: "<b>" + name + "</b>" + (seats === "see page" ? "" : " · Intake: <b>" + seats + "</b>"), l: [[name + " – Department", path], ["Admission Process", "admissions"], ["Apply / Enquire", "contact-us"]], f: ["courses", "fees", "place"] };
  };
  var esc = function (t) { return String(t).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); };
  var fmt = function (t) {
    if (!t) return "";
    var s = esc(t);
    s = s.replace(/^###\s+(.+)$/gm, "<div style='font-weight:700;font-size:1.05em;margin:8px 0 4px;color:#1e293b;'>$1</div>");
    s = s.replace(/^##\s+(.+)$/gm, "<div style='font-weight:700;font-size:1.1em;margin:10px 0 4px;color:#1e293b;'>$1</div>");
    s = s.replace(/\*\*(.+?)\*\*/g, "<b>$1</b>");
    s = s.replace(/(^|[^\*])\*([^\*\n]+)\*([^\*]|$)/g, "$1<i>$2</i>$3");
    s = s.replace(/^[•\*\-]\s+(.+)$/gm, "<div style='display:flex;align-items:flex-start;margin:3px 0;'><span style='margin-right:6px;color:#ae2e30;'>•</span><span>$1</span></div>");
    s = s.replace(/^(\d+)\.\s+(.+)$/gm, "<div style='display:flex;align-items:flex-start;margin:3px 0;'><span style='margin-right:6px;font-weight:600;color:#ae2e30;'>$1.</span><span>$2</span></div>");
    s = s.replace(/\n\n+/g, "<div style='height:8px;'></div>");
    s = s.replace(/\n/g, "<br>");
    return s;
  };
  var desk = function (pre) { return { a: (pre ? pre + "<br><br>" : "") + "<b>" + T("dTitle") + "</b><br>📞 +91 84599 67882 / +91 86696 11211<br>✉️ info.mitcorer@mitpune.edu.in<br>🕘 " + T("dHours"), l: [[T("site"),C.site],[T("call") + " +91 84599 67882","tel:+918459967882"],[T("call") + " +91 86696 11211","tel:+918669611211"],[T("dEmail"),"mailto:info.mitcorer@mitpune.edu.in"],[T("dForm"),C.enq]], f: ["courses","fees","menu"] }; };
  var DESK = desk();
  var D = [
    { id:"greet", tk:"greet", k:/^(hi+|hello+|hey+|namaste|good (morning|afternoon|evening))\b|^(नमस्कार|नमस्ते|हॅलो|हैलो|हेलो)/, a:"Hello! 👋 What would you like to know?", f:MAIN },
    { id:"thanks", tk:"thanks", k:/\b(thanks|thank you|thx|ok thanks)\b|धन्यवाद|आभार/, a:"You're welcome! 😊 Anything else I can help with?", f:["adm","contact","menu"] },
    { id:"menu", tk:"menu", k:/\b(menu|main menu|start over)\b/, a:"What would you like to know?", f:MAIN },
    { id:"why", k:/\bwhy\b|choose|best|reason|benefit|special/, a:"<b>Why MIT CORER?</b> Part of MAEER's MIT Group — 35+ years of excellence.", stats:[["94%","Placement rate 2024-25"],["100+","Companies visited"],["NAAC A","Accredited grade"],["25+","MOUs signed"]], l:[["About Overview","about"],["Placement Record","placement/record"]], f:["courses","place","adm"] },
    { id:"fees", tk:"feesnav", k:/fee|payment|pay\b|cost|tuition|fra\b|shulk|kiti/, a:"Which fees would you like to know about? Please choose:", f:["fyfees","dsyfees","conc","hmfees","schol"], nav:1 },
    { id:"brochure", k:/brochure|prospectus|download/, a:"Download brochures:", l:[["B.Tech Brochure","admissions/brochure"],["DSY Brochure","admissions/dsy-brochure"],["Complete College Brochure","admissions/college-brochure"]], f:["adm","fees","courses"] },
    dept("fy", /first year|\bfy\b|\bfe\b/, "First Year Engineering", "see page", "department/fy-engineering"),
    dept("civil", /civil/, "Civil Engineering", "60 seats", "department/civil-engineering"),
    dept("cse", /computer|cse|software|coding/, "Computer Science & Engineering", "120 seats", "department/computer-science-engineering"),
    dept("entc", /e ?& ?tc|entc|telecom|e and tc/, "Electronics & Telecommunication Engineering", "60 seats", "department/electronic-telecommunication-engineering"),
    dept("ece", /electronics/, "Electronics & Computer Engineering", "60 seats", "department/electronics-computer-engineering"),
    dept("mech", /mechanical|rail eng|railway eng|\bmech\b/, "Mechanical & Rail Engineering", "60 seats", "department/mechanical-rail-engineering"),
    { id:"aids", k:/\bai\b|artificial|data science|aids/, a:"<b>Artificial Intelligence & Data Science</b><br>Intake: <b>60 seats</b>. Covers data processing models, algorithm tuning and deep learning.", l:[["Admission Process","admissions"],["Apply / Enquire","contact-us"]], f:["courses","fees","place"] },
    { id:"poly", k:/diploma|polytechnic|poly\b/, a:"<b>Diploma</b> (60 seats each): CSE, E&TC, Mechanical, Civil.", l:[["Diploma in Railway Engineering","department/professional-diploma-railway"],["Faculty Profile","department/polytechnic/faculty"],["Syllabus","department/polytechnic/syllabus"],["Laboratory Details","department/polytechnic/labs"],["Previous Year Question Papers","department/polytechnic/question-papers"],["Departmental Calendar","department/polytechnic/calendar"]], f:["adm","fees","contact"] },
    { id:"courses", k:/course|program|branch|stream|department|seat|intake|b\.?tech|engineering/, a:"<b>B.Tech programmes</b> — tap one for details:", rows:[["Artificial Intelligence & Data Science","60 seats","admissions"],["Civil Engineering","60 seats","department/civil-engineering"],["Computer Science & Engineering","120 seats","department/computer-science-engineering"],["Electronics & Computer Engineering","60 seats","department/electronics-computer-engineering"],["Electronics & Telecommunication","60 seats","department/electronic-telecommunication-engineering"],["Mechanical & Rail Engineering","60 seats","department/mechanical-rail-engineering"]], f:["poly","adm","fees"] },
    { id:"place", k:/placement|package|recruit|compan|job|internship|salary|lpa/, a:"<b>Placement highlights</b>", stats:[["500+","Students placed"],["100+","Companies visited"],["94%","Placement rate 2024-25"],["₹8.5L","Average package"]], l:[["Placement Record","placement/record"],["Our Recruiters","placement/ourrecruiters"],["Placement Overview","placements"],["Internship Policy","placement/internship-policy"]], f:["courses","adm","contact"] },
    { id:"hostel", k:/hostel|accommodation|\bstay\b|mess|canteen/, a:"<b>Hostel & mess facilities</b>", pts:["Separate hostels for boys and girls with safe accommodation","RO purified drinking water and solar water-heating systems","Emergency vehicle facility on campus for student safety","Campus mess and canteen facilities providing daily meals"], l:[["Hostel Accommodations","infrastructure/hostel-accommodations"],["Cafeteria","infrastructure/cafeteria"]], f:["hmfees","infra","adm"] },
    { id:"bus", k:/\bbus\b|transport/, a:"Bus facility details:", l:[["Bus Facility","infrastructure/bus"]], f:["infra","contact"] },
    { id:"infra", k:/infra|campus facilit|lab|classroom|library|workshop|canteen|cafeteria|computer center/, a:"Campus facilities:", l:[["Infra Overview","infrastructure"],["Smart Classrooms","infrastructure/smart-classrooms"],["Engineering Labs","infrastructure/engineering-labs"],["Workshops","infrastructure/workshops"],["Computer Center","infrastructure/computer-center"],["Hostel Accommodations","infrastructure/hostel-accommodations"],["Library – OPAC","http://122.252.238.217:5000/"]], f:["adm","place","contact"] },
    { id:"camp", k:/campus life|nss|sport|cultural|event|asimit|technical event|fest|railmit/, a:"Life at MIT CORER:", l:[["NSS Unit","campus-life/nss"],["Sports","campus-life/sports"],["Cultural Events","campus-life/cultural-events"],["ASIMIT","campus-life/asimit"],["Technical Events","campus-life/technical-events"]], f:["place","adm","contact"] },
    { id:"login", k:/login|log in|portal|edu ?plus|erp|moodle/, a:"Use these portals to sign in:", l:[["Student Login","https://mymitcorer.edupluscampus.com"],["Faculty Login","https://mitcorer.edupluscampus.com"],["Moodle","http://122.252.238.217/moodle/install.php"]], f:["menu"] },
    { id:"notice", k:/notice|announcement|news|update|circular/, a:"Latest admission notices and campus announcements:", l:[["Latest Admission Notices","admissions/notice"],["Home – Notice Board","index.php"],["MIT CORER on LinkedIn","https://www.linkedin.com/company/maeer-s-mit-college-of-railway-engineering-research-barshi/"]], f:["adm","menu"] },
    { id:"career", k:/career|vacanc|faculty recruit|hiring/, a:"Open positions at MIT CORER are listed here:", l:[["Careers","careers"]], f:["contact","menu"] },
    { id:"about", k:/about|naac|aicte|affiliat|approved|accredit|established|history|leader|principal/, a:"<b>MIT CORER, Barshi</b> — MAEER's MIT Group. Est. 2008 · AICTE approved · NAAC Grade A · PAH Solapur University.", l:[["About Overview","about"],["Leadership","about/leadership"],["Governing Body","about/governing-body"],["Mandatory Disclosure (PDF)","assets/pdf/Mandatory-Disclousure.pdf"]], f:["courses","adm","contact"] },
    { id:"contact", k:/contact|call|phone|number|email|mail|address|location|where|reach|visit|enquiry|inquiry|counsel/, a:DESK.a, l:DESK.l, f:DESK.f },
  ];
  var byId = {}; D.forEach(function (d) { byId[d.id] = d; });
  var FALL = DESK;

  /* ---------- STYLES ---------- */
  var css = "#mcb{--p:" + C.primary + ";--a:" + C.accent + ";--d:" + C.dark + ";position:fixed;right:22px;bottom:22px;z-index:2147483000;font-family:system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;font-size:14px;line-height:1.45;color:#1b2433;text-align:left}#mcb *{box-sizing:border-box}" +
    ".mcb-fab{position:relative;width:62px;height:62px;border:0;border-radius:50%;cursor:pointer;color:#fff;background:linear-gradient(135deg,var(--p),var(--d));box-shadow:0 10px 28px rgba(122,21,24,.45);display:grid;place-items:center;transition:transform .25s;animation:mcbFloat 3.2s ease-in-out infinite}.mcb-fab:hover{transform:scale(1.08)}" +
    ".mcb-fab svg{width:28px;height:28px;position:absolute;transition:transform .35s,opacity .25s}.mcb-fab .ix{opacity:0;transform:rotate(-90deg) scale(.5)}.open .mcb-fab .ic{opacity:0;transform:rotate(90deg) scale(.5)}.open .mcb-fab .ix{opacity:1;transform:none}.open .mcb-fab{animation:none}" +
    ".mcb-ring{position:absolute;inset:0;border-radius:50%;border:2px solid var(--p);animation:mcbRing 2.2s ease-out infinite}.open .mcb-ring,.open .mcb-dot{display:none}" +
    ".mcb-dot{position:absolute;top:-3px;right:-3px;background:#fff;color:var(--p);box-shadow:0 0 0 2px var(--p);font:700 11px/20px system-ui;width:20px;height:20px;border-radius:50%;text-align:center;animation:mcbPop .5s 1.2s both}" +
    ".mcb-tip{position:absolute;right:0;bottom:78px;background:#fff;padding:10px 30px 10px 14px;border-radius:14px 14px 4px 14px;box-shadow:0 8px 30px rgba(0,0,0,.18);white-space:nowrap;font-weight:600;opacity:0;transform:translateY(10px) scale(.9);pointer-events:none;transition:.4s cubic-bezier(.2,.9,.3,1.3)}.mcb-tip.show{opacity:1;transform:none;pointer-events:auto}.mcb-tip button{position:absolute;right:6px;top:5px;border:0;background:none;font-size:18px;cursor:pointer;color:#888}" +
    ".mcb-win{position:absolute;right:0;bottom:80px;width:384px;max-width:calc(100vw - 28px);height:600px;max-height:calc(100vh - 120px);background:#fbf6f6;border-radius:20px;box-shadow:0 24px 70px rgba(122,21,24,.35);display:flex;flex-direction:column;overflow:hidden;transform-origin:bottom right;transform:scale(.4) translateY(40px);opacity:0;visibility:hidden;transition:transform .45s cubic-bezier(.2,.9,.3,1.2),opacity .25s,visibility .45s}.open .mcb-win{transform:none;opacity:1;visibility:visible}" +
    ".mcb-win .mcb-hd{position:relative;display:flex;align-items:center;gap:10px;padding:14px 12px 18px 14px;color:#fff;background:linear-gradient(135deg,var(--p),var(--d))}.mcb-win .mcb-hd .t{flex:1;line-height:1.2}.mcb-win .mcb-hd small{opacity:.85;font-size:12px;display:flex;align-items:center;gap:6px}.mcb-win .mcb-hd small i{width:8px;height:8px;border-radius:50%;background:#3ddc84;box-shadow:0 0 0 0 #3ddc84;animation:mcbLive 1.8s infinite}" +
    ".mcb-win .mcb-hd button{border:0;background:rgba(255,255,255,.15);color:#fff;width:30px;height:30px;border-radius:50%;cursor:pointer;font-size:14px;transition:.2s}.mcb-win .mcb-hd button:hover{background:rgba(255,255,255,.3);transform:rotate(15deg)}" +
    ".track{position:absolute;left:0;right:0;bottom:0;height:6px;background:repeating-linear-gradient(90deg,#fff 0 14px,transparent 14px 24px);background-size:24px 100%;animation:mcbTrack 1s linear infinite;opacity:.9}.track:before{content:'';position:absolute;left:0;right:0;top:0;height:2px;background:rgba(255,255,255,.55)}" +
    ".av{flex:none;width:36px;height:36px;border-radius:50%;background:#fff;padding:4px;display:grid;place-items:center;box-shadow:0 2px 8px rgba(0,0,0,.2)}.av img{width:100%;height:100%;object-fit:contain}" +
    ".mcb-body{flex:1;overflow-y:auto;padding:16px 14px 6px;scroll-behavior:smooth}.m{display:flex;gap:8px;margin-bottom:12px;animation:mcbIn .4s cubic-bezier(.2,.9,.3,1.2) both}.m.u{justify-content:flex-end}" +
    ".b{max-width:82%;padding:10px 13px;border-radius:16px;background:#fff;box-shadow:0 2px 8px rgba(122,21,24,.08);border-top-left-radius:4px;word-wrap:break-word}.u .b{background:linear-gradient(135deg,var(--p),var(--d));color:#fff;border-radius:16px 16px 4px 16px;box-shadow:none}" +
    ".ty{display:inline-flex;gap:4px;padding:4px 0}.ty i{width:7px;height:7px;border-radius:50%;background:#b79a9b;animation:mcbDot 1.1s infinite}.ty i:nth-child(2){animation-delay:.15s}.ty i:nth-child(3){animation-delay:.3s}" +
    ".lk{display:flex;flex-direction:column;gap:6px;margin-top:10px}.lk a{display:flex;justify-content:space-between;align-items:center;gap:8px;padding:9px 12px;border-radius:10px;text-decoration:none;color:var(--p);font-weight:600;background:#fbeeee;border:1px solid #f0d2d2;transition:.2s;opacity:0;animation:mcbIn .4s both}.lk a:hover{background:var(--p);color:#fff;transform:translateX(4px)}.lk em{font-style:normal}" +
    ".mcb-chips{display:flex;gap:7px;flex-wrap:wrap;padding:6px 14px 10px;max-height:112px;overflow-y:auto}.mcb-chips button{border:1.5px solid var(--p);background:#fff;color:var(--p);padding:6px 12px;border-radius:999px;font:600 12.5px system-ui;cursor:pointer;transition:.2s;animation:mcbIn .35s both}.mcb-chips button:hover{background:var(--p);color:#fff;transform:translateY(-2px)}" +
    ".mcb-win form{display:flex;gap:8px;padding:10px 12px;background:#fff;border-top:1px solid #f0e1e1}.mcb-win input{flex:1;background:#fff;color:#1b2433;border:1.5px solid #e6d3d3;border-radius:999px;padding:10px 15px;font:inherit;outline:0;transition:.2s}.mcb-win input:focus{border-color:var(--p);box-shadow:0 0 0 3px rgba(122,21,24,.12)}.mcb-win form button{width:42px;border:0;border-radius:50%;background:var(--p);color:#fff;font-size:16px;cursor:pointer;transition:.2s}.mcb-win form button:hover{transform:scale(1.1) rotate(-12deg)}" +
    ".mcb-win .mcb-ft{text-align:center;font-size:11px;color:#8a7a7a;padding:0 0 8px;background:#fff}" +
    "@keyframes mcbFloat{50%{transform:translateY(-6px)}}@keyframes mcbRing{0%{transform:scale(1);opacity:.9}100%{transform:scale(1.7);opacity:0}}@keyframes mcbPop{from{transform:scale(0)}60%{transform:scale(1.3)}to{transform:scale(1)}}@keyframes mcbLive{70%{box-shadow:0 0 0 8px rgba(61,220,132,0)}100%{box-shadow:0 0 0 0 rgba(61,220,132,0)}}@keyframes mcbTrack{to{background-position:24px 0}}@keyframes mcbIn{from{opacity:0;transform:translateY(12px) scale(.96)}to{opacity:1;transform:none}}@keyframes mcbDot{40%{transform:translateY(-5px);background:var(--p)}}" +
    "@media(max-width:480px){#mcb{right:14px;bottom:14px}.mcb-win{position:fixed;inset:0;width:100%;max-width:none;height:100%;max-height:none;border-radius:0}.open .mcb-fab{display:none}.mcb-tip{bottom:76px}}" +
    ".mcb-fab{background:#fff;color:var(--p);box-shadow:0 10px 28px rgba(0,0,0,.35),0 0 0 3px var(--p),0 0 0 5px #fff}.mcb-fab img{position:absolute;width:34px;height:44px;object-fit:contain;transition:transform .35s,opacity .25s}.mcb-ring{border-color:var(--a)}" +
    ".mcb-lg{position:absolute;right:12px;top:62px;z-index:5;background:#fff;border-radius:12px;box-shadow:0 10px 30px rgba(0,0,0,.28);padding:6px;display:none;flex-direction:column;min-width:130px}.mcb-lg.show{display:flex}.mcb-lg button{border:0;background:none;text-align:left;padding:9px 12px;border-radius:8px;font:600 14px system-ui;color:#1b2433;cursor:pointer}.mcb-lg button:hover,.mcb-lg button.on{background:#fbeeee;color:var(--p)}.mcb-chips button.lg{background:#fbeeee;border-style:dashed}" +
    ".b details{margin-top:8px;font-size:12.5px;color:#6b5a5a}.b summary{cursor:pointer;font-weight:600;color:var(--p)}" +
    ".mcb-win{width:400px;height:620px}.mcb-body{background-image:radial-gradient(#ead9d9 1px,transparent 1px);background-size:16px 16px}.b{max-width:90%}" +
    ".hero{display:block;text-decoration:none;color:#fff;padding:18px;border-radius:16px;margin-bottom:14px;background:linear-gradient(120deg,rgba(122,21,24,.97),rgba(174,46,48,.88)),repeating-linear-gradient(90deg,rgba(255,255,255,.12) 0 2px,transparent 2px 14px);animation:mcbIn .5s both;transition:.25s}.hero:hover{transform:translateY(-2px);box-shadow:0 10px 24px rgba(122,21,24,.3)}.hero small{display:block;font-weight:700;opacity:.85;letter-spacing:.08em;font-size:11px}.hero b{display:block;font-size:19px;margin:4px 0 8px;line-height:1.2}.hero u{font-weight:700;font-size:13px}" +
    ".pts ul{margin:8px 0 0;padding-left:18px}.pts li{margin:4px 0}.st{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:10px}.st div{background:linear-gradient(135deg,var(--p),var(--d));color:#fff;border-radius:12px;padding:10px 6px;text-align:center;animation:mcbIn .4s both}.st div b{display:block;font-size:20px}.st span{font-size:11.5px;opacity:.92}" +
    ".rws{margin-top:10px;display:flex;flex-direction:column;gap:7px}.rw{display:flex;justify-content:space-between;align-items:center;gap:10px;padding:9px 12px;border-radius:10px;background:#fbeeee;border:1px solid #f0d2d2;text-decoration:none;color:#1b2433;animation:mcbIn .4s both;transition:.2s}a.rw:hover{background:var(--p);color:#fff;transform:translateX(4px)}.rw span{font-size:12.5px}#mcb .rw b{color:var(--p);white-space:nowrap}#mcb a.rw:hover b{color:#fff}" +
    ".nt{font-size:12px;color:#6b5a5a;margin-top:8px}.fb{margin-top:10px;padding-top:8px;border-top:1px solid #f0e1e1;font-size:12px;color:#8a7a7a}.fb button{border:1px solid #e6d3d3;background:#fff;border-radius:8px;padding:2px 7px;margin-left:5px;cursor:pointer}.fb button:hover{background:#fbeeee}" +
    ".mcb-chips a.lc{border:1.5px solid var(--p);background:var(--p);color:#fff;padding:6px 12px;border-radius:999px;font:600 12.5px system-ui;text-decoration:none;animation:mcbIn .35s both;transition:.2s}.mcb-chips a.lc:hover{background:var(--d);transform:translateY(-2px)}" +
    "#mcb b,#mcb strong{color:inherit}#mcb .b{color:#1b2433}#mcb .u .b{color:#fff}" +
    "@media(prefers-reduced-motion:reduce){#mcb *{animation:none!important;transition:none!important}}";
  var st = document.createElement("style"); st.textContent = css; document.head.appendChild(st);

  /* ---------- MARKUP ---------- */
  var root = document.createElement("div"); root.id = "mcb";
  root.innerHTML = '<div class="mcb-tip" id="mcbTip">' + C.tip + '<button aria-label="Dismiss">×</button></div>' +
    '<button class="mcb-fab" id="mcbFab" aria-label="Open chat assistant" aria-expanded="false"><span class="mcb-ring"></span>' +
    '<img class="ic" src="' + C.logo + '" alt="">' +
    '<svg class="ix" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg><i class="mcb-dot">1</i></button>' +
    '<section class="mcb-win" id="mcbWin" role="dialog" aria-label="MITCORER assistant"><div class="mcb-hd"><div class="av"><img src="' + C.logo + '" alt=""></div><div class="t"><b>Mitra</b><small><i></i> MITCORER Admission Assistant</small></div>' +
    '<button id="mcbLang" title="Language / भाषा" aria-label="Language">🌐</button><button id="mcbReset" title="Restart chat" aria-label="Restart chat">↻</button><button id="mcbClose" title="Close" aria-label="Close chat">✕</button><div class="track"></div></div>' +
    '<div class="mcb-lg" id="mcbLg"><button data-l="en">English</button><button data-l="mr">मराठी</button><button data-l="hi">हिन्दी</button></div><div class="mcb-body" id="mcbBody" aria-live="polite"></div><div class="mcb-chips" id="mcbChips"></div>' +
    '<form id="mcbForm"><input id="mcbIn" placeholder="Type your question…" autocomplete="off" maxlength="200" aria-label="Your question"><button aria-label="Send">➤</button></form>' +
    '<div class="mcb-ft" id="mcbFt">Powered by MITRA · MITCORER</div></section>';
  document.body.appendChild(root);

  /* ---------- LOGIC ---------- */
  var $ = function (id) { return document.getElementById(id); };
  var body = $("mcbBody"), chips = $("mcbChips"), tip = $("mcbTip"), inp = $("mcbIn"), busy = 0, started = 0;
  var url = function (p) { return /^(https?:|tel:|mailto:)/.test(p) ? p : C.base + p; };
  var down = function () { body.scrollTo({ top: body.scrollHeight, behavior: "smooth" }); };

  function userMsg(t) { var r = document.createElement("div"); r.className = "m u"; var b = document.createElement("div"); b.className = "b"; b.textContent = t; r.appendChild(b); body.appendChild(r); down(); }
  function showChips(f, nm) {
    chips.innerHTML = "";
    var list = (f || MAIN).slice(); if (!nm && list.indexOf("menu") < 0 && list.join() !== MAIN.join()) list.push("menu");
    list.forEach(function (id, i) {
      var b; if (LC[id]) { b = document.createElement("a"); b.href = LC[id]; b.target = "_blank"; b.rel = "noopener"; b.className = "lc"; }
      else { b = document.createElement("button"); b.onclick = function () { send(lab(id), id); }; }
      b.textContent = lab(id); if (id.indexOf("lang_") === 0) b.className = "lg"; b.style.animationDelay = i * 45 + "ms"; chips.appendChild(b);
    });
  }
  function botMsg(p) {
    busy = 1; chips.innerHTML = "";
    var r = document.createElement("div"); r.className = "m";
    r.innerHTML = '<div class="av"><img src="' + C.logo + '" alt=""></div><div class="b"><span class="ty"><i></i><i></i><i></i></span></div>'; body.appendChild(r); down();
    Promise.all([Promise.resolve(p), new Promise(function (ok) { setTimeout(ok, 450); })]).then(function (v) {
      var d = v[0];
      var b = r.querySelector(".b"); b.innerHTML = d.tk ? T(d.tk) : d.a;
      var x = function (h, c) { var e = document.createElement("div"); e.className = c; e.innerHTML = h; b.appendChild(e); };
      if (d.pts) x("<ul>" + d.pts.map(function (t) { return "<li>" + t + "</li>"; }).join("") + "</ul>", "pts");
      if (d.stats) x(d.stats.map(function (t) { return "<div><b>" + t[0] + "</b><span>" + t[1] + "</span></div>"; }).join(""), "st");
      if (d.rows) x(d.rows.map(function (t) { var i = "<span>" + t[0] + "</span><b>" + t[1] + "</b>"; return t[2] ? '<a class="rw" target="_blank" rel="noopener" href="' + url(t[2]) + '">' + i + "</a>" : '<div class="rw">' + i + "</div>"; }).join(""), "rws");
      if (d.note) x(d.note, "nt");
      if (d.l && d.l.length) {
        var w = document.createElement("div"); w.className = "lk";
        d.l.slice(0, 5).forEach(function (x, i) { var a = document.createElement("a"); a.href = url(x[1]); if (!/^(tel|mailto):/.test(a.href)) { a.target = "_blank"; a.rel = "noopener"; } a.style.animationDelay = 150 + i * 70 + "ms"; a.innerHTML = "<span>" + x[0] + "</span><em>↗</em>"; w.appendChild(a); });
        b.appendChild(w);
      }
      if (d.l || d.rows || d.stats || d.pts) { var fb = document.createElement("div"); fb.className = "fb"; fb.innerHTML = T('fbq') + ' <button aria-label="Yes">👍</button><button aria-label="No">👎</button>'; fb.onclick = function (e) { if (e.target.tagName === "BUTTON") fb.textContent = e.target.getAttribute("aria-label") === "Yes" ? T("fbY") : T("fbN"); }; b.appendChild(fb); }
      down(); setTimeout(down, 500); showChips(d.f, d.nm); busy = 0;
    });
  }
  function match(t) { t = t.toLowerCase(); for (var i = 0; i < D.length; i++) if (D[i].k && D[i].k.test(t)) return D[i]; return FALL; }
  var SMALL = { greet: 1, thanks: 1, menu: 1 };
  var DEV = /[\u0900-\u097F]/;
  var MRW = /नमस्कार|आहे|आहेत|किती|कशी|कसे|काय|माझ्या|मला|तुम्ही|साठी|मध्ये|वसतिगृह|नाही|होईल/g, HIW = /नमस्ते|है|हैं|कितना|कितनी|कैसे|क्या|मेरा|मेरी|मुझे|आप|के लिए|में|छात्रावास|नहीं|होगा|करें/g;
  function detect(t) { if (!DEV.test(t)) return null; return (t.match(HIW) || []).length > (t.match(MRW) || []).length ? "hi" : "mr"; }
  function applyUI() {
    inp.placeholder = T("ph"); $("mcbFt").textContent = T("foot"); tip.firstChild.nodeValue = T("tip");
    [].forEach.call($("mcbLg").children, function (b) { b.className = b.getAttribute("data-l") === LANG ? "on" : ""; });
  }
  function setLang(code, reset, auto) { LANG = code; LOCKED = auto ? 0 : 1; applyUI(); $("mcbLg").classList.remove("show"); if (reset) start(); }
  /* ---------- MITRA backend ---------- */
  var activeConversationId = null;
  var activeSessionToken = null;
  function post(url, q, lang) {
    var ctl = window.AbortController ? new AbortController() : null, to = setTimeout(function () { if (ctl) ctl.abort(); }, 45000);
    var payload = { question: q, language: lang };
    if (activeConversationId) payload.conversationId = activeConversationId;
    if (activeSessionToken) payload.sessionToken = activeSessionToken;
    var headers = { "Content-Type": "application/json" };
    if (activeSessionToken) headers["X-Mitra-Session"] = activeSessionToken;
    return fetch(url, { method: "POST", credentials: "include", headers: headers, body: JSON.stringify(payload), signal: ctl ? ctl.signal : undefined })
      .then(function (r) { clearTimeout(to); if (!r.ok) { var e = new Error("http"); e.status = r.status; throw e; } return r.json(); })
      .then(function (res) {
        var d = res.data || res;
        if (!d || !d.answer) throw new Error("empty");
        if (d.conversationId) activeConversationId = d.conversationId;
        if (d.sessionToken) activeSessionToken = d.sessionToken;
        return d;
      }, function (e) { clearTimeout(to); throw e; });
  }
  function ask(q, lang) {
    var eps = [C.proxy, C.api].filter(Boolean), i = 0, trail = [];
    function go() {
      return post(eps[i], q, lang).catch(function (e) {
        window.__mitraError = e; trail.push((eps[i] === C.proxy && C.proxy ? "proxy" : "direct") + " → " + (e && e.status ? "HTTP " + e.status : e && e.name === "AbortError" ? "timeout" : e && e.name === "TypeError" ? "network/CORS blocked" : e && e.message)); if (window.console) console.warn("[Mitra] " + eps[i] + " failed:", e && (e.status ? "HTTP " + e.status : (e.name || "") + " " + (e.message || "")), "(TypeError = network/CORS)");
        var retry = e && e.message !== "empty" && (!e.status || e.status === 404 || e.status >= 500);
        if (retry && ++i < eps.length) return go();
        e.trail = trail; throw e;
      });
    }
    return go();
  }
  function view(d, a, n) {
    var l = (d.evidence || []).filter(function (e) { return e && e.url && /^https?:\/\//i.test(e.url); }).map(function (e) { return [esc(e.title || "Official source"), e.url]; });
    return { a: a, l: l, note: n ? "⚠️ " + n : null, f: ["courses", "fees", "contact"] };
  }
  function queryMitra(q, fb) {
    var lp = LOCKED ? LANG : (detect(q) || "auto");
    return ask(q, lp).catch(function (e) { if (lp !== "auto" && e && e.status >= 400 && e.status < 500) return ask(q, "auto"); throw e; })
      .then(function (d) {
        return view(d, fmt(d.answer), d.caution && fmt(d.caution));
      }).catch(function (e) {
        if (e && e.message === "empty") return desk(T("dNF"));
        if (fb && fb !== DESK) {
          var r = Object.assign({}, fb);
          if (C.debug && e && e.trail) r.note = "🛠 " + esc(e.trail.join(" | "));
          return r;
        }
        var r = desk(T("dFail"));
        if (C.debug && e && e.trail) r.note = "🛠 " + esc(e.trail.join(" | "));
        return r;
      });
  }
  /* Fixed English questions for topic buttons and Marathi/Hindi keywords (these wordings are known to work with MITRA) */
  var QT = { courses:"Which programs are available?", docs:"What documents are required for admission?", adm:"What is the admission process?", place:"Placements", infra:"Facilities", about:"About MIT CORER", why:"Why choose MIT CORER?", schol:"Scholarships", cut:"Cutoffs", brochure:"Brochure", fyfees:"What are the first-year B.Tech fees?", dsyfees:"What are the Direct Second Year fees?", hmfees:"What are the hostel and mess fees?", conc:"What are the category fee concessions?", hostel:"What hostel and mess facilities does MITCORER provide?" };
  var FEEW = /फी|फीस|शुल्क|खर्च|fee|shulk/i, TL = /abhyas|pathya|kagad|pravesh|vasti|sampark|\bkors\b/i;
  var TOPICS = [
    [/संपर्क|फोन|पत्ता|नंबर|नम्बर|sampark/i, "contact"],
    [/अभ्यासक्रम|पाठ्यक्रम|कोर्स|प्रोग्राम|शाखा|ब्रांच|abhyas ?kram|pathya ?kram|\bkors\b/i, "courses"],
    [/कागदपत्र|दस्तऐवज|दस्तावेज|kagad ?patr/i, "docs"],
    [/प्लेसमेंट|नोकरी|नौकरी/, "place"],
    [/वसतिगृह|हॉस्टेल|होस्टल|छात्रावास|vasti ?gruh/i, "hostel"],
    [/सुविधा/, "infra"],
    [/शिष्यवृत्ती|शिष्यवृत्ति|छात्रवृत्ति|छात्रवृत्ती|स्कॉलरशिप/, "schol"],
    [/कटऑफ|कट ऑफ/, "cut"],
    [/ब्रोशर|माहितीपत्रक/, "brochure"],
    [/प्रवेश|एडमिशन|दाखला|pravesh/i, "adm"]
  ];
  function topicOf(t) { if (!(DEV.test(t) || TL.test(t)) || FEEW.test(t)) return null; for (var i = 0; i < TOPICS.length; i++) if (TOPICS[i][0].test(t)) return TOPICS[i][1]; return null; }
  function send(text, id) {
    if (busy || !text.trim()) return;
    if (id && id.indexOf("lang_") === 0) { setLang(id.slice(5), 1); return; }
    if (!id) { var dl = detect(text); if (dl) { if (dl !== LANG || LOCKED) setLang(dl, 0, 1); } else if (LANG !== "en" && !LOCKED) setLang("en", 0, 1); }
    userMsg(text);
    var loc = id ? byId[id] : match(text);
    if (loc === DESK) loc = null;
    if (!id && loc && loc.nav) loc = null;                                       /* typed fee questions always go to MITRA */
    if (!id && /fee|cost|tuition|फी|शुल्क|किती|कितना/i.test(text) && !(loc && SMALL[loc.id])) loc = null;
    if (loc && loc.id === "contact") return botMsg(desk());
    if ((loc && (SMALL[loc.id] || (id && loc.nav))) || id === "menu") return botMsg(loc || byId.menu);
    var tid = id ? null : topicOf(text);
    if (tid === "contact") return botMsg(desk());
    if (!id && DEV.test(text) && FEEW.test(text) && text.trim().split(/\s+/).length <= 2) return botMsg(byId.fees);

    /* Chip click (or keyword) that has a local answer → show it immediately.
       This makes Marathi/Hindi menu options work even when MITRA proxy is down / 404. */
    if (id && loc && loc.a && !loc.nav) {
      return botMsg(loc);
    }
    if (!id && tid && byId[tid] && byId[tid].a && !byId[tid].nav) {
      return botMsg(byId[tid]);
    }

    botMsg(queryMitra(id ? (QT[id] || M[id] || text) : (tid ? QT[tid] : text), tid ? byId[tid] : loc));
  }
  function start() {
    activeConversationId = null;
    body.innerHTML = '<a class="hero" href="' + C.enq + '" target="_blank" rel="noopener"><small>' + T('heroS') + '</small><b>' + T('heroH') + '</b><u>' + T('heroC') + '</u></a>'; started = 1;
    botMsg({ a: T("welcome"), f: LANGS.concat(MAIN), nm: 1 });
  }
  function toggle(open) {
    var o = open === undefined ? !root.classList.contains("open") : open;
    root.classList.toggle("open", o); $("mcbFab").setAttribute("aria-expanded", o); tip.classList.remove("show");
    if (o) { if (!started) start(); setTimeout(function () { inp.focus(); }, 450); }
  }
  $("mcbFab").onclick = function () { toggle(); };
  $("mcbLang").onclick = function (e) { e.stopPropagation(); $("mcbLg").classList.toggle("show"); };
  $("mcbLg").onclick = function (e) { var l = e.target.getAttribute && e.target.getAttribute("data-l"); if (l) setLang(l, 1); };
  document.addEventListener("click", function () { $("mcbLg").classList.remove("show"); });
  $("mcbClose").onclick = function () { toggle(false); };
  $("mcbReset").onclick = function () { if (!busy) start(); };
  tip.querySelector("button").onclick = function () { tip.classList.remove("show"); };
  $("mcbForm").onsubmit = function (e) { e.preventDefault(); var v = inp.value; inp.value = ""; send(v); };
  document.addEventListener("keydown", function (e) { if (e.key === "Escape") toggle(false); });
  applyUI();
  setTimeout(function () { if (!root.classList.contains("open")) tip.classList.add("show"); }, 2500);
  setTimeout(function () { tip.classList.remove("show"); }, 11000);
})();
