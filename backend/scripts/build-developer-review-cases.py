"""Build a transparent, non-independent developer review set from the frozen corpus."""
import gzip
import hashlib
import json
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
CORPUS_PATH = ROOT / "backend/evaluation/corpora/reviewed-public-corpus.json.gz"
OUTPUT = ROOT / "backend/evaluation/developer-review-cases-90.json"
MANIFEST = ROOT / "backend/evaluation/developer-review-cases-90.manifest.json"
CORPUS_MANIFEST = ROOT / "backend/evaluation/corpora/reviewed-public-corpus.manifest.json"

LANGS = ("en", "mr", "hi")
AUTHOR = "AI-DEV"

# Each item is authored for internal coverage and then translated by the assistant.
# Translation quality has not been independently checked by fluent human reviewers.
ITEMS = [
    {"id":"01","topic":"institution-name","action":"answerable","sources":["KB-34"],"slot":{},
     "q":{"en":"What is the full name of MITCORER?","mr":"MITCORER या महाविद्यालयाचे पूर्ण नाव काय आहे?","hi":"MITCORER महाविद्यालय का पूरा नाम क्या है?"},
     "a":{"en":"MITCORER stands for MIT College of Railway Engineering and Research. It is in Barshi, Solapur district.","mr":"MITCORER चे पूर्ण नाव MIT College of Railway Engineering and Research आहे. हे बार्शी, सोलापूर जिल्ह्यात आहे.","hi":"MITCORER का पूरा नाम MIT College of Railway Engineering and Research है। यह बार्शी, सोलापुर जिले में स्थित है।"},
     "claims":["The college name is MIT College of Railway Engineering and Research.","The college is in Barshi, Solapur district."]},
    {"id":"03","topic":"placement","action":"answerable","sources":["KB-53"],"slot":{},
     "q":{"en":"Who is listed as MITCORER's Training and Placement Officer?","mr":"MITCORER चे Training and Placement Officer म्हणून कोणाचे नाव दिले आहे?","hi":"MITCORER के Training and Placement Officer के रूप में किसका नाम दिया गया है?"},
     "a":{"en":"The published Placement Committee page lists Dr. Sachin Khomane as Training and Placement Officer and Member Secretary.","mr":"प्रकाशित Placement Committee पृष्ठावर Dr. Sachin Khomane यांचे Training and Placement Officer आणि Member Secretary म्हणून नाव आहे.","hi":"प्रकाशित Placement Committee पृष्ठ पर Dr. Sachin Khomane का नाम Training and Placement Officer और Member Secretary के रूप में दिया गया है।"},
     "claims":["Dr. Sachin Khomane is listed as TPO and Member Secretary."]},
    {"id":"04","topic":"faculty","action":"answerable","sources":["KB-52"],"slot":{"programme":"Electronics and Telecommunication Engineering"},
     "q":{"en":"Who is the HOD of Electronics and Telecommunication Engineering?","mr":"Electronics and Telecommunication Engineering विभागाचे HOD कोण आहेत?","hi":"Electronics and Telecommunication Engineering विभाग के HOD कौन हैं?"},
     "a":{"en":"The published faculty record lists Prof. Mrs. Deepali Gajanan Mali as the E&TC HOD.","mr":"प्रकाशित प्राध्यापक नोंदीनुसार E&TC विभागाच्या HOD Prof. Mrs. Deepali Gajanan Mali आहेत.","hi":"प्रकाशित शिक्षक रिकॉर्ड के अनुसार E&TC विभाग की HOD Prof. Mrs. Deepali Gajanan Mali हैं।"},
     "claims":["Prof. Mrs. Deepali Gajanan Mali is listed as E&TC HOD."]},
    {"id":"05","topic":"intake","action":"answerable","sources":["KB-10"],"slot":{"academicYear":"2026-27","programme":"Computer Science and Engineering","admissionRoute":"First Year B.Tech"},
     "q":{"en":"For 2026-27, what is the First Year B.Tech intake and choice code for CSE?","mr":"2026-27 मध्ये प्रथम वर्ष B.Tech CSE साठी प्रवेश क्षमता आणि choice code काय आहे?","hi":"2026-27 में प्रथम वर्ष B.Tech CSE की स्वीकृत प्रवेश क्षमता और choice code क्या है?"},
     "a":{"en":"For AY 2026-27, CSE has sanctioned intake 120 and choice code 0690124210.","mr":"शैक्षणिक वर्ष 2026-27 साठी CSE ची मंजूर प्रवेश क्षमता 120 असून choice code 0690124210 आहे.","hi":"शैक्षणिक वर्ष 2026-27 के लिए CSE की स्वीकृत प्रवेश क्षमता 120 और choice code 0690124210 है।"},
     "claims":["CSE FY B.Tech intake is 120 for AY 2026-27.","CSE choice code is 0690124210."]},
    {"id":"07","topic":"intake","action":"answerable","sources":["KB-10"],"slot":{"academicYear":"2026-27","programme":"Electronics and Telecommunication Engineering","admissionRoute":"First Year B.Tech"},
     "q":{"en":"For 2026-27, what are the ENTC First Year B.Tech intake and choice code?","mr":"2026-27 साठी ENTC प्रथम वर्ष B.Tech ची प्रवेश क्षमता आणि choice code काय आहे?","hi":"2026-27 के लिए ENTC प्रथम वर्ष B.Tech की प्रवेश क्षमता और choice code क्या है?"},
     "a":{"en":"ENTC has sanctioned intake 60 and choice code 0690137210 for AY 2026-27.","mr":"शैक्षणिक वर्ष 2026-27 मध्ये ENTC ची मंजूर प्रवेश क्षमता 60 आणि choice code 0690137210 आहे.","hi":"शैक्षणिक वर्ष 2026-27 में ENTC की स्वीकृत प्रवेश क्षमता 60 और choice code 0690137210 है।"},
     "claims":["ENTC FY B.Tech intake is 60 for AY 2026-27.","ENTC choice code is 0690137210."]},
    {"id":"10","topic":"intake","action":"answerable","sources":["KB-10"],"slot":{"academicYear":"2026-27","programme":"Electronics and Computer Engineering","admissionRoute":"First Year B.Tech"},
     "q":{"en":"What are the 2026-27 intake and choice code for Electronics and Computer Engineering?","mr":"Electronics and Computer Engineering साठी 2026-27 प्रवेश क्षमता आणि choice code काय आहेत?","hi":"Electronics and Computer Engineering के लिए 2026-27 प्रवेश क्षमता और choice code क्या हैं?"},
     "a":{"en":"Electronics and Computer Engineering has intake 60 and choice code 0690184410 for AY 2026-27.","mr":"Electronics and Computer Engineering ची 2026-27 प्रवेश क्षमता 60 आणि choice code 0690184410 आहे.","hi":"Electronics and Computer Engineering की 2026-27 प्रवेश क्षमता 60 और choice code 0690184410 है।"},
     "claims":["Electronics and Computer Engineering FY B.Tech intake is 60 for AY 2026-27.","Its choice code is 0690184410."]},
    {"id":"11","topic":"fees","action":"answerable","sources":["KB-2"],"slot":{"academicYear":"2026-27","admissionRoute":"First Year B.Tech","category":"Open"},
     "q":{"en":"What is the published Open-category First Year Engineering fee for 2026-27?","mr":"2026-27 साठी Open category प्रथम वर्ष अभियांत्रिकीचे प्रकाशित शुल्क किती आहे?","hi":"2026-27 के लिए Open category प्रथम वर्ष इंजीनियरिंग की प्रकाशित फीस कितनी है?"},
     "a":{"en":"The published First Year Engineering fee for AY 2026-27 is INR 1,05,000 for Open or OMS students.","mr":"2026-27 साठी Open किंवा OMS विद्यार्थ्यांचे प्रकाशित प्रथम वर्ष अभियांत्रिकी शुल्क INR 1,05,000 आहे.","hi":"2026-27 के लिए Open या OMS विद्यार्थियों की प्रकाशित प्रथम वर्ष इंजीनियरिंग फीस INR 1,05,000 है।"},
     "claims":["FY Open/OMS fee is INR 105,000 for AY 2026-27."]},
    {"id":"12","topic":"fees","action":"answerable","sources":["KB-2"],"slot":{"academicYear":"2026-27","admissionRoute":"Direct Second Year","category":"OBC","gender":"girl"},
     "q":{"en":"For 2026-27 DSE, what fee is listed for OBC girls?","mr":"2026-27 DSE प्रवेशासाठी OBC मुलींचे शुल्क किती दिले आहे?","hi":"2026-27 DSE प्रवेश के लिए OBC छात्राओं की फीस कितनी दी गई है?"},
     "a":{"en":"The published Direct Second Year fee for girls in the listed concession categories, including OBC, is INR 18,362 for AY 2026-27.","mr":"2026-27 साठी प्रकाशित Direct Second Year शुल्कात OBC सहित नमूद सवलत प्रवर्गातील मुलींचे शुल्क INR 18,362 आहे.","hi":"2026-27 के प्रकाशित Direct Second Year शुल्क में OBC सहित सूचीबद्ध रियायती श्रेणियों की छात्राओं की फीस INR 18,362 है।"},
     "claims":["DSE fee for girls in the listed concession categories including OBC is INR 18,362 for AY 2026-27."],"confidence":"medium"},
    {"id":"13","topic":"hostel-fees","action":"answerable","sources":["KB-3"],"slot":{"academicYear":"2026-27","service":"hostel and mess"},
     "q":{"en":"For 2026-27, how much are the hostel fee, refundable deposit, and annual mess fee?","mr":"2026-27 साठी वसतिगृह शुल्क, परत मिळणारी ठेव आणि वार्षिक मेस शुल्क किती आहे?","hi":"2026-27 के लिए छात्रावास शुल्क, वापस मिलने वाली जमा राशि और वार्षिक मेस शुल्क कितना है?"},
     "a":{"en":"The listed hostel fee is INR 35,000, the refundable deposit is INR 5,000, and annual mess fees are INR 42,000. The hostel fee plus deposit totals INR 40,000.","mr":"वसतिगृह शुल्क INR 35,000, परत मिळणारी ठेव INR 5,000 आणि वार्षिक मेस शुल्क INR 42,000 आहे. वसतिगृह शुल्क व ठेव मिळून INR 40,000 होतात.","hi":"सूचीबद्ध छात्रावास शुल्क INR 35,000, वापसी योग्य जमा राशि INR 5,000 और वार्षिक मेस शुल्क INR 42,000 है। छात्रावास शुल्क और जमा राशि मिलाकर INR 40,000 होते हैं।"},
     "claims":["Hostel fee is INR 35,000.","Refundable deposit is INR 5,000.","Annual mess fee is INR 42,000.","Hostel fee plus deposit totals INR 40,000."]},
    {"id":"14","topic":"historical-cutoff","action":"answerable","sources":["KB-8"],"slot":{"academicYear":"2025","programme":"Computer Science and Engineering","admissionRoute":"All India CAP Round I","seatType":"AI"},
     "q":{"en":"What was the 2025 All India CAP Round I CSE closing merit and JEE score for the AI seat type?","mr":"2025 All India CAP Round I मध्ये CSE चा AI seat type साठी closing merit आणि JEE score किती होता?","hi":"2025 All India CAP Round I में CSE के AI seat type का closing merit और JEE score क्या था?"},
     "a":{"en":"The historical 2025 entry lists All India merit 56892 and JEE score 53.9228024 for the AI seat type. This is not a current cutoff or admission guarantee.","mr":"2025 च्या ऐतिहासिक नोंदीनुसार AI seat type साठी All India merit 56892 आणि JEE score 53.9228024 होता. हा सध्याचा cutoff किंवा प्रवेशाची हमी नाही.","hi":"2025 के ऐतिहासिक रिकॉर्ड में AI seat type के लिए All India merit 56892 और JEE score 53.9228024 दिया गया है। यह वर्तमान cutoff या प्रवेश की गारंटी नहीं है।"},
     "claims":["2025 historical CSE AI All India CAP Round I closing merit is 56892.","The listed JEE score is 53.9228024.","The record is historical and not a current guarantee."]},
    {"id":"15","topic":"library","action":"answerable","sources":["KB-20"],"slot":{"service":"library facilities"},
     "q":{"en":"What library resources does MITCORER publicly mention?","mr":"MITCORER ने सार्वजनिकरीत्या ग्रंथालयातील कोणती साधने नमूद केली आहेत?","hi":"MITCORER ने पुस्तकालय के किन संसाधनों का उल्लेख किया है?"},
     "a":{"en":"MITCORER describes a well-equipped library with digital resources and journals. The public record does not state borrowing rules or timings.","mr":"MITCORER च्या माहितीनुसार ग्रंथालयात डिजिटल साधने आणि जर्नल्स आहेत. सार्वजनिक नोंदीत कर्जाने पुस्तके घेण्याचे नियम किंवा वेळा दिलेल्या नाहीत.","hi":"MITCORER के अनुसार पुस्तकालय में डिजिटल संसाधन और जर्नल हैं। सार्वजनिक रिकॉर्ड में उधार लेने के नियम या समय नहीं दिए गए हैं।"},
     "claims":["The library has digital resources and journals.","The public record does not specify borrowing rules or timings."]},
    {"id":"16","topic":"placements","action":"answerable","sources":["KB-16"],"slot":{},
     "q":{"en":"What placement figures does MITCORER publish for company visits, students placed, highest package, and average package?","mr":"कंपन्यांच्या भेटी, नियुक्त विद्यार्थी, सर्वोच्च पॅकेज आणि सरासरी पॅकेजबाबत MITCORER कोणती आकडेवारी प्रकाशित करते?","hi":"कंपनी विज़िट, नियुक्त विद्यार्थियों, उच्चतम पैकेज और औसत पैकेज के कौन से आँकड़े MITCORER प्रकाशित करता है?"},
     "a":{"en":"The published highlights say 100+ companies, 300+ students placed, a highest package of 21 LPA, and an average package of 4.4 LPA. These are published highlights, not a guarantee for an individual student.","mr":"प्रकाशित माहितीत 100+ कंपन्या, 300+ नियुक्त विद्यार्थी, 21 LPA सर्वोच्च पॅकेज आणि 4.4 LPA सरासरी पॅकेज दिले आहे. हे प्रकाशित आकडे आहेत; वैयक्तिक विद्यार्थ्याची हमी नाही.","hi":"प्रकाशित जानकारी में 100+ कंपनियाँ, 300+ नियुक्त विद्यार्थी, 21 LPA उच्चतम पैकेज और 4.4 LPA औसत पैकेज दिए गए हैं। ये प्रकाशित आँकड़े हैं, किसी विद्यार्थी के लिए गारंटी नहीं।"},
     "claims":["Published highlight: 100+ companies.","Published highlight: 300+ students placed.","Published highest package: 21 LPA.","Published average package: 4.4 LPA.","These figures do not guarantee an individual outcome."]},
    {"id":"17","topic":"scholarship","action":"answerable","sources":["KB-33"],"slot":{"service":"AICTE Pragati Scholarship"},
     "q":{"en":"What annual amount does the published AICTE Pragati listing state for eligible girl students?","mr":"पात्र विद्यार्थिनींसाठी प्रकाशित AICTE Pragati माहितीत वार्षिक किती रक्कम दिली आहे?","hi":"पात्र छात्राओं के लिए प्रकाशित AICTE Pragati जानकारी में वार्षिक कितनी राशि दी गई है?"},
     "a":{"en":"The published record states INR 50,000 per year for eligible students. Eligibility and current application rules must be checked on the official scholarship portal.","mr":"प्रकाशित नोंदीनुसार पात्र विद्यार्थ्यांसाठी दरवर्षी INR 50,000 दिले जातात. पात्रता आणि सध्याचे अर्ज नियम अधिकृत शिष्यवृत्ती पोर्टलवर तपासावेत.","hi":"प्रकाशित रिकॉर्ड के अनुसार पात्र विद्यार्थियों के लिए प्रति वर्ष INR 50,000 है। पात्रता और वर्तमान आवेदन नियम आधिकारिक छात्रवृत्ति पोर्टल पर जाँचें।"},
     "claims":["Published AICTE Pragati amount is INR 50,000 per year.","Eligibility and current application rules require official verification."]},
    {"id":"18","topic":"admission-documents","action":"answerable","sources":["KB-13"],"slot":{"category":"Open","admissionRoute":"admission reporting"},
     "q":{"en":"Name some documents listed for Open-category admission reporting.","mr":"Open category प्रवेश अहवालासाठी नमूद केलेली काही कागदपत्रे सांगा.","hi":"Open category प्रवेश रिपोर्टिंग के लिए सूचीबद्ध कुछ दस्तावेज़ बताइए।"},
     "a":{"en":"The published checklist includes SSC and HSC marksheets, MHT-CET marksheet, school leaving certificate, nationality and domicile certificates, photographs, Aadhaar, and a bank passbook copy. The exact checklist can vary by route and claim.","mr":"प्रकाशित यादीत SSC व HSC गुणपत्रिका, MHT-CET गुणपत्रिका, शाळा सोडल्याचा दाखला, राष्ट्रीयत्व व अधिवास प्रमाणपत्रे, छायाचित्रे, आधार आणि बँक पासबुकची प्रत आहेत. मार्ग व दाव्यानुसार अचूक यादी बदलू शकते.","hi":"प्रकाशित सूची में SSC और HSC अंकपत्र, MHT-CET अंकपत्र, स्कूल छोड़ने का प्रमाणपत्र, राष्ट्रीयता और अधिवास प्रमाणपत्र, तस्वीरें, आधार और बैंक पासबुक की प्रति शामिल हैं। मार्ग और दावे के अनुसार सूची बदल सकती है।"},
     "claims":["The cited documents are listed in the public Open-category guidance.","Exact document requirements can vary by admission route and claim."]},
    {"id":"19","topic":"clarification-fees","action":"clarify","sources":["KB-2"],"slot":{},
     "q":{"en":"How much is the fee?","mr":"शुल्क किती आहे?","hi":"फीस कितनी है?"},
     "clarify":{"en":"Which academic year, admission route (First Year or Direct Second Year), and category should I check?","mr":"कोणते शैक्षणिक वर्ष, प्रवेश मार्ग (प्रथम वर्ष की Direct Second Year) आणि प्रवर्ग तपासू?","hi":"कौन सा शैक्षणिक वर्ष, प्रवेश मार्ग (प्रथम वर्ष या Direct Second Year) और श्रेणी देखूँ?"},
     "claims":["Fee depends on academic year, admission route and category."]},
    {"id":"20","topic":"clarification-intake","action":"clarify","sources":["KB-10"],"slot":{},
     "q":{"en":"How many seats are there?","mr":"किती जागा आहेत?","hi":"कितनी सीटें हैं?"},
     "clarify":{"en":"Which programme and academic year do you mean, and are you asking about sanctioned intake or current vacancies?","mr":"कोणता अभ्यासक्रम आणि शैक्षणिक वर्ष अभिप्रेत आहे? मंजूर प्रवेश क्षमता विचारत आहात की सध्याच्या रिक्त जागा?","hi":"कौन सा कार्यक्रम और शैक्षणिक वर्ष पूछ रहे हैं? स्वीकृत प्रवेश क्षमता या वर्तमान रिक्त सीटें?"},
     "claims":["The programme/year and whether intake or live vacancies are requested must be clarified."]},
    {"id":"21","topic":"clarification-documents","action":"clarify","sources":["KB-13"],"slot":{},
     "q":{"en":"What documents do I need?","mr":"मला कोणती कागदपत्रे लागतील?","hi":"मुझे कौन से दस्तावेज़ चाहिए?"},
     "clarify":{"en":"Are you applying for First Year or Direct Second Year, and which category or concession are you claiming?","mr":"तुम्ही प्रथम वर्षासाठी अर्ज करता आहात की Direct Second Year साठी? कोणता प्रवर्ग किंवा सवलत लागू आहे?","hi":"आप प्रथम वर्ष या Direct Second Year के लिए आवेदन कर रहे हैं? कौन सी श्रेणी या रियायत लागू है?"},
     "claims":["Required documents vary by route and category/claim."]},
    {"id":"22","topic":"clarification-cutoff","action":"clarify","sources":["KB-7","KB-8"],"slot":{},
     "q":{"en":"What is the cutoff?","mr":"कटऑफ किती आहे?","hi":"कटऑफ क्या है?"},
     "clarify":{"en":"Which programme, academic year, CAP round, admission route and seat type do you mean?","mr":"कोणता अभ्यासक्रम, शैक्षणिक वर्ष, CAP फेरी, प्रवेश मार्ग आणि seat type अभिप्रेत आहे?","hi":"कौन सा कार्यक्रम, शैक्षणिक वर्ष, CAP राउंड, प्रवेश मार्ग और seat type पूछ रहे हैं?"},
     "claims":["Cutoff requires programme/year/round/route/seat-type scope; available CSE entries are historical."]},
    {"id":"23","topic":"clarification-eligibility","action":"clarify","sources":["KB-5"],"slot":{},
     "q":{"en":"Am I eligible?","mr":"मी पात्र आहे का?","hi":"क्या मैं पात्र हूँ?"},
     "clarify":{"en":"Which programme and admission route are you applying through, and what are your qualifying subjects and exam? Do not share personal identifiers.","mr":"कोणत्या अभ्यासक्रमासाठी आणि प्रवेश मार्गाने अर्ज करता? तुमचे पात्रता विषय आणि परीक्षा कोणती? वैयक्तिक ओळख तपशील पाठवू नका.","hi":"किस कार्यक्रम और प्रवेश मार्ग से आवेदन कर रहे हैं, और आपके qualifying subjects तथा परीक्षा क्या हैं? निजी पहचान विवरण साझा न करें।"},
     "claims":["Eligibility depends on programme, route, subjects and entrance examination."]},
    {"id":"24","topic":"clarification-scholarship","action":"clarify","sources":["KB-18","KB-33"],"slot":{},
     "q":{"en":"Can I get a scholarship?","mr":"मला शिष्यवृत्ती मिळू शकते का?","hi":"क्या मुझे छात्रवृत्ति मिल सकती है?"},
     "clarify":{"en":"Which scheme are you asking about, and what broad category or eligibility condition should I check? Please do not send personal documents or identifiers.","mr":"कोणत्या योजनेबद्दल विचारत आहात आणि कोणता व्यापक प्रवर्ग किंवा पात्रता निकष तपासू? वैयक्तिक कागदपत्रे किंवा ओळख तपशील पाठवू नका.","hi":"किस योजना के बारे में पूछ रहे हैं और कौन सी सामान्य श्रेणी या पात्रता जाँचूँ? निजी दस्तावेज़ या पहचान विवरण न भेजें।"},
     "claims":["Scholarship eligibility is scheme-specific and cannot be determined from the question alone."]},
    {"id":"25","topic":"unsupported-vacancy","action":"unsupported","sources":["KB-14"],"slot":{"programme":"CSE","service":"current vacancy"},
     "q":{"en":"How many CSE seats are vacant right now?","mr":"सध्या CSE च्या किती जागा रिक्त आहेत?","hi":"अभी CSE की कितनी सीटें खाली हैं?"},
     "a":{"en":"The frozen public records do not establish live CSE vacancies. Check the latest official CAP or institute-level vacancy notice; sanctioned intake is not a live vacancy count.","mr":"गोठवलेल्या सार्वजनिक नोंदींमध्ये CSE च्या सध्याच्या रिक्त जागांची माहिती नाही. नवीनतम अधिकृत CAP किंवा संस्थास्तरीय vacancy notice तपासा; मंजूर प्रवेश क्षमता म्हणजे सध्याच्या रिक्त जागा नव्हेत.","hi":"स्थिर सार्वजनिक रिकॉर्ड से CSE की वर्तमान रिक्त सीटें पता नहीं चलतीं। नवीनतम आधिकारिक CAP या संस्थान-स्तरीय vacancy notice देखें; स्वीकृत प्रवेश क्षमता वर्तमान रिक्तियों की संख्या नहीं है।"},
     "claims":["The snapshot does not provide live CSE vacancy count.","Sanctioned intake cannot be treated as a live vacancy count."]},
    {"id":"26","topic":"transport-information-limit","action":"answerable","sources":["KB-19","KB-40"],"slot":{"service":"college bus fare and timetable","origin":"Barshi to campus"},
     "q":{"en":"What timetable and fare does the college bus publish for its Barshi-to-campus route?","mr":"बार्शी ते महाविद्यालय या मार्गासाठी महाविद्यालयीन बसचे प्रकाशित वेळापत्रक आणि भाडे काय आहे?","hi":"बार्शी से कॉलेज मार्ग के लिए कॉलेज बस की प्रकाशित समय-सारणी और किराया क्या है?"},
     "a":{"en":"The public records mention a bus facility and some general transit directions, but do not establish your village route, timetable, seat availability or fare. Confirm these with the current transport office notice.","mr":"सार्वजनिक नोंदींमध्ये बस सुविधा आणि सर्वसाधारण प्रवास मार्ग आहेत; पण तुमच्या गावाचा मार्ग, वेळापत्रक, जागांची उपलब्धता किंवा भाडे दिलेले नाही. सध्याच्या transport office notice मधून खात्री करा.","hi":"सार्वजनिक रिकॉर्ड में बस सुविधा और सामान्य यात्रा मार्ग हैं, लेकिन आपके गाँव का मार्ग, समय-सारणी, सीट उपलब्धता या किराया नहीं दिया गया है। वर्तमान transport office notice से पुष्टि करें।"},
     "claims":["The frozen corpus does not publish a route-specific timetable or fare."]},
    {"id":"27","topic":"hostel-availability-limit","action":"answerable","sources":["KB-3","KB-23"],"slot":{"service":"hostel room availability","academicYear":"future month"},
     "q":{"en":"Will a hostel room definitely be available for me next month?","mr":"पुढील महिन्यात मला वसतिगृहाची खोली नक्की मिळेल का?","hi":"क्या अगले महीने मुझे छात्रावास का कमरा निश्चित रूप से मिलेगा?"},
     "a":{"en":"The published records do not confirm future room availability or guarantee allotment. Contact the hostel or admission office for the current position.","mr":"प्रकाशित नोंदी भविष्यातील खोलीची उपलब्धता निश्चित करत नाहीत आणि allotment ची हमी देत नाहीत. सध्याच्या माहितीसाठी वसतिगृह किंवा प्रवेश कार्यालयाशी संपर्क करा.","hi":"प्रकाशित रिकॉर्ड भविष्य में कमरे की उपलब्धता की पुष्टि या आवंटन की गारंटी नहीं करते। वर्तमान स्थिति के लिए छात्रावास या प्रवेश कार्यालय से संपर्क करें।"},
     "claims":["The snapshot does not confirm future hostel availability or guarantee allotment."]},
    {"id":"28","topic":"admission-guarantee","action":"answerable","sources":["KB-5","KB-7","KB-8","KB-14"],"slot":{"programme":"CSE","academicYear":"current","service":"admission guarantee request"},
     "q":{"en":"My JEE score is 60. Guarantee me a CSE seat this year using the old cutoff.","mr":"माझा JEE score 60 आहे. जुन्या cutoff वरून यावर्षी CSE ची जागा हमखास द्या.","hi":"मेरा JEE score 60 है। पुराने cutoff के आधार पर इस साल CSE सीट की गारंटी दीजिए।"},
     "a":{"en":"I can’t guarantee admission. The stored CSE cutoffs are historical, and allotment depends on current merit, category, seat type, CAP round, preferences and vacancies. Check the current official seat matrix and notices.","mr":"प्रवेशाची हमी देता येत नाही. नोंदीतील CSE cutoffs ऐतिहासिक आहेत; allotment सध्याची merit, प्रवर्ग, seat type, CAP फेरी, पसंती आणि रिक्त जागांवर अवलंबून असते. सध्याची अधिकृत seat matrix आणि notices तपासा.","hi":"प्रवेश की गारंटी नहीं दी जा सकती। रिकॉर्ड में CSE cutoffs ऐतिहासिक हैं; आवंटन वर्तमान merit, श्रेणी, seat type, CAP राउंड, विकल्प और रिक्तियों पर निर्भर करता है। वर्तमान आधिकारिक seat matrix और notices देखें।"},
     "claims":["The system must not guarantee admission based on the old cutoff.","Admission allotment depends on current merit, category, seat type, CAP round, preferences and vacancies."],
     "prohibitedClaims":["Do not promise a CSE seat or treat a historical cutoff as a current threshold."]},
    {"id":"29","topic":"library-hours-limit","action":"answerable","sources":["KB-20"],"slot":{"service":"library borrowing hours"},
     "q":{"en":"At what exact time does the library close and what are the borrowing rules?","mr":"ग्रंथालय नेमके किती वाजता बंद होते आणि पुस्तक घेण्याचे नियम काय आहेत?","hi":"पुस्तकालय ठीक किस समय बंद होता है और उधार लेने के नियम क्या हैं?"},
     "a":{"en":"The public record mentions digital resources and journals, but does not state library timings or borrowing rules. Please confirm those details with the library.","mr":"सार्वजनिक नोंदीत डिजिटल साधने आणि जर्नल्स नमूद आहेत; ग्रंथालयाची वेळ किंवा पुस्तक उधार घेण्याचे नियम दिलेले नाहीत. कृपया ग्रंथालयाकडून खात्री करा.","hi":"सार्वजनिक रिकॉर्ड में डिजिटल संसाधन और जर्नल का उल्लेख है, लेकिन पुस्तकालय का समय या उधार नियम नहीं दिए गए हैं। कृपया पुस्तकालय से पुष्टि करें।"},
     "claims":["Library closing time and borrowing rules are not stated in the snapshot."]},
    {"id":"30","topic":"unsupported-calendar-dates","action":"unsupported","sources":["KB-45"],"slot":{"programme":"CSE","service":"Semester I calendar start date","academicYear":"2026-27"},
     "q":{"en":"On what exact date does CSE Semester I start in academic year 2026-27?","mr":"2026-27 शैक्षणिक वर्षात CSE Semester I नेमके कोणत्या तारखेला सुरू होते?","hi":"2026-27 शैक्षणिक वर्ष में CSE Semester I ठीक किस तारीख को शुरू होता है?"},
     "a":{"en":"The frozen records provide a CSE Semester I calendar for 2025-26, but do not establish the CSE Semester I start date for 2026-27. Check the current department or university notice.","mr":"गोठवलेल्या नोंदींमध्ये 2025-26 साठी CSE Semester I चे वेळापत्रक आहे; 2026-27 साठी प्रारंभ तारीख निश्चित केलेली नाही. विभागाची किंवा विद्यापीठाची सध्याची सूचना तपासा.","hi":"स्थिर रिकॉर्ड में 2025-26 का CSE Semester I कैलेंडर है, लेकिन 2026-27 की प्रारंभ तिथि स्थापित नहीं है। वर्तमान विभागीय या विश्वविद्यालय सूचना देखें।"},
     "claims":["The snapshot has a 2025-26 CSE Semester I calendar but does not establish the 2026-27 start date."]},
    {"id":"31","topic":"unsupported-scholarship-date","action":"unsupported","sources":["KB-18","KB-33"],"slot":{"service":"scholarship disbursement date","academicYear":"current"},
     "q":{"en":"On what exact date will my scholarship money be deposited this year?","mr":"यावर्षी माझी शिष्यवृत्तीची रक्कम नेमकी कोणत्या तारखेला जमा होईल?","hi":"इस वर्ष मेरी छात्रवृत्ति की राशि ठीक किस तारीख को जमा होगी?"},
     "a":{"en":"The frozen scholarship records do not state an individual payment date. Check the relevant scheme portal or contact its official helpdesk; I can’t predict a deposit date.","mr":"गोठवलेल्या शिष्यवृत्ती नोंदींमध्ये वैयक्तिक जमा तारीख दिलेली नाही. संबंधित योजनेचे पोर्टल किंवा अधिकृत मदत केंद्र तपासा; जमा तारीख सांगता येत नाही.","hi":"स्थिर छात्रवृत्ति रिकॉर्ड में व्यक्तिगत भुगतान तिथि नहीं दी गई है। संबंधित योजना पोर्टल या आधिकारिक सहायता केंद्र देखें; जमा तिथि का अनुमान नहीं लगाया जा सकता।"},
     "claims":["The frozen corpus does not establish an individual scholarship deposit date."]},
    {"id":"32","topic":"unsupported-future-fee","action":"unsupported","sources":["KB-2"],"slot":{"service":"academic fees","academicYear":"2027-28"},
     "q":{"en":"What will the exact First Year Open-category fee be in 2027-28?","mr":"2027-28 मध्ये प्रथम वर्ष Open category चे अचूक शुल्क किती असेल?","hi":"2027-28 में प्रथम वर्ष Open category की सटीक फीस कितनी होगी?"},
     "a":{"en":"The frozen fee record gives 2026-27 amounts only; it does not establish the 2027-28 fee. Check the official fee notice for that year.","mr":"गोठवलेल्या शुल्क नोंदीत फक्त 2026-27 ची रक्कम आहे; 2027-28 चे शुल्क निश्चित केलेले नाही. त्या वर्षाची अधिकृत शुल्क सूचना तपासा.","hi":"स्थिर शुल्क रिकॉर्ड में केवल 2026-27 की राशि है; 2027-28 की फीस स्थापित नहीं है। उस वर्ष की आधिकारिक फीस सूचना देखें।"},
     "claims":["The frozen record does not establish the 2027-28 fee."]},
    {"id":"33","topic":"unsupported-individual-scholarship-decision","action":"unsupported","sources":["KB-18","KB-33"],"slot":{"service":"individual scholarship approval"},
     "q":{"en":"Will I personally be approved for AICTE Pragati if I apply?","mr":"अर्ज केल्यास मला वैयक्तिकरीत्या AICTE Pragati शिष्यवृत्ती मंजूर होईल का?","hi":"आवेदन करने पर क्या मुझे व्यक्तिगत रूप से AICTE Pragati छात्रवृत्ति मंजूर होगी?"},
     "a":{"en":"I can’t determine or guarantee an individual scholarship decision. The scheme portal publishes the current eligibility and application rules; check those or contact its official helpdesk.","mr":"वैयक्तिक शिष्यवृत्तीचा निर्णय ठरवता किंवा हमी देता येत नाही. योजनेच्या पोर्टलवर सध्याचे पात्रता आणि अर्ज नियम तपासा किंवा अधिकृत मदत केंद्राशी संपर्क करा.","hi":"व्यक्तिगत छात्रवृत्ति निर्णय तय या गारंटी नहीं किया जा सकता। योजना पोर्टल पर वर्तमान पात्रता और आवेदन नियम देखें या आधिकारिक सहायता केंद्र से संपर्क करें।"},
     "claims":["The corpus does not determine or guarantee an individual's scholarship approval."]},
    {"id":"34","topic":"unsupported-individual-placement","action":"unsupported","sources":["KB-16","KB-24"],"slot":{"service":"individual future job and salary guarantee"},
     "q":{"en":"Which company will hire me next year, and can you guarantee me a 10 LPA package?","mr":"पुढील वर्षी कोणती कंपनी मला नोकरी देईल आणि 10 LPA पॅकेजची हमी देता का?","hi":"अगले वर्ष कौन सी कंपनी मुझे नौकरी देगी, और क्या आप 10 LPA पैकेज की गारंटी दे सकते हैं?"},
     "a":{"en":"No company or individual package can be guaranteed from the published placement highlights. They report aggregate figures only; individual outcomes depend on recruitment and student performance.","mr":"प्रकाशित placement आकडेवारीवरून कोणती कंपनी किंवा वैयक्तिक पॅकेजची हमी देता येत नाही. ती एकत्रित आकडे देते; वैयक्तिक परिणाम भरती आणि विद्यार्थ्याच्या कामगिरीवर अवलंबून असतात.","hi":"प्रकाशित placement आँकड़ों से किसी कंपनी या व्यक्तिगत पैकेज की गारंटी नहीं दी जा सकती। वे केवल समेकित आँकड़े हैं; व्यक्तिगत परिणाम भर्ती और विद्यार्थी के प्रदर्शन पर निर्भर करते हैं।"},
     "claims":["Published aggregate placement figures cannot guarantee a company or individual salary package."]},
]

def main():
    corpus_manifest = json.loads(CORPUS_MANIFEST.read_text(encoding="utf-8"))
    corpus_hash = corpus_manifest["outputSha256"]
    with gzip.open(CORPUS_PATH, "rt", encoding="utf-8") as stream:
        corpus = json.load(stream)
    sources = {record["id"]: record for record in corpus["knowledge"]}
    cases = []
    for language in LANGS:
        for item in ITEMS:
            groups = []
            for source_id in item["sources"]:
                record = sources[source_id]
                groups.append({"groupId": source_id, "sourceId": source_id, "title": record["title"],
                               "sourceUrl": record.get("sourceUrl"), "supportingText": record["text"]})
            for claim_index, claim in enumerate(item["claims"], 1):
                question = item["q"][language]
                if item["action"] == "answerable":
                    reference_answer = item["a"][language]
                    clarification = None
                elif item["action"] == "clarify":
                    reference_answer = item["clarify"][language]
                    clarification = reference_answer
                else:
                    reference_answer = item["a"][language]
                    clarification = None
            case_id = f"DEV-{language.upper()}-{item['id']}"
            case = {
                "schemaVersion": 1,
                "status": "developer-authored-development-review-not-independent",
                "batchId": "MITRA-DEV-REVIEW-90-2026-11",
                "caseId": case_id,
                "corpusSha256": corpus_hash,
                "engineCommit": None,
                "split": "developer-authored-development",
                "origin": "Assistant-authored test scenario based on public MITCORER corpus topics; not sampled from real user conversations.",
                "authorReviewerCode": AUTHOR,
                "independenceConfirmed": False,
                "language": language,
                "topic": item["topic"],
                "turns": [{"role": "user", "text": question}],
                "answerability": item["action"],
                "expectedDecision": {"answerable": "answer", "clarify": "clarify", "unsupported": "abstain"}[item["action"]],
                "acceptedEvidenceGroups": groups,
                "targetSlots": item["slot"],
                "requiredClaims": item["claims"] if item["action"] == "answerable" else (
                    [f"Ask for clarification: {clarification}"] if item["action"] == "clarify"
                    else ["State that the requested current or operational fact is not established by the frozen public corpus and direct the user to the relevant official notice or office."]
                ),
                "prohibitedClaims": ["Do not assert institutional facts beyond the cited evidence.", *item.get("prohibitedClaims", [])],
                "referenceAnswer": reference_answer,
                "requiredClarification": clarification,
                "reviewerAnnotations": [{"reviewerCode": AUTHOR, "role": "assistant developer-evidence reviewer",
                    "confidence": item.get("confidence", "medium"),
                    "languageReview": "Not reviewed by a fluent human speaker; meaning/terminology verification required."}],
                "adjudication": {"reviewerCode": AUTHOR, "rationale": f"Mapped to published record(s) {', '.join(item['sources'])} in the frozen corpus. Human domain and native-language review are pending."},
                "exposure": {"hasBeenExecuted": False, "firstExecutionAt": None, "questionHashes": []},
            }
            cases.append(case)

    if len(cases) != 90:
        raise SystemExit(f"Expected 90 generated cases, found {len(cases)}")
    counts = {lang: {action: sum(c["language"] == lang and c["answerability"] == action for c in cases)
                     for action in ("answerable", "clarify", "unsupported")} for lang in LANGS}
    if any(value != {"answerable": 18, "clarify": 6, "unsupported": 6} for value in counts.values()):
        raise SystemExit(f"Unexpected balance: {counts}")
    output_bytes = (json.dumps(cases, ensure_ascii=False, indent=2) + "\n").encode("utf-8")
    manifest = {
        "schemaVersion": 1,
        "status": "developer-authored-development-review-not-independent",
        "createdAt": datetime.now(timezone.utc).isoformat(),
        "caseCount": len(cases),
        "countsByLanguageAndAnswerability": counts,
        "corpusSha256": corpus_hash,
        "caseFileSha256": hashlib.sha256(output_bytes).hexdigest(),
        "authorCode": AUTHOR,
        "independent": False,
        "nativeLanguageReview": "pending; no Marathi/Hindi quality claim is made",
        "limitations": [
            "Questions and labels were created by the assistant after it had inspected the project; this is not independent or blinded evaluation.",
            "Marathi and Hindi phrasing is unverified by fluent human reviewers.",
            "Case scenarios are synthetic and do not estimate real visitor question frequencies.",
            "Answerability is scoped to the frozen published corpus, not all information that may exist outside it.",
        ],
    }
    if OUTPUT.exists() or MANIFEST.exists():
        raise SystemExit("Refusing to overwrite an existing developer-review artifact")
    OUTPUT.write_bytes(output_bytes)
    MANIFEST.write_bytes((json.dumps(manifest, ensure_ascii=False, indent=2) + "\n").encode("utf-8"))
    print(json.dumps({"output": str(OUTPUT), "manifest": str(MANIFEST), "sha256": manifest["caseFileSha256"],
                      "counts": counts, "caseCount": len(cases)}, ensure_ascii=False, indent=2))

if __name__ == "__main__":
    main()


