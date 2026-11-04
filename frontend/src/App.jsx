import { Fragment, useEffect, useLayoutEffect, useRef, useState } from 'react';
import {
  ArrowLeft, ArrowRight, BookOpen, CheckCircle2, Cpu, FileText,
  HandCoins, LockKeyhole, LogOut, Menu, Phone,
  Send, ShieldCheck, UploadCloud, X,
  PanelLeftClose, PanelLeftOpen, Languages, RefreshCw,
  ThumbsDown, ThumbsUp,
} from 'lucide-react';
import feeFirstYearImage from './assets/fee-first-year-2026.jpeg';
import feeDirectSecondYearImage from './assets/fee-direct-second-year-2026.jpeg';
import hostelMessFeeImage from './assets/hostel-mess-fee-2026.jpeg';
import mitcorerLogo from './assets/mitcorer-logo.png';
import mitcorerCampus from './assets/mitcorer-campus.png';
import { api } from './api.js';
import { formatPublicResponse } from './answer-format.mjs';
import { publicAnswerLinks, matchesFeeSnapshot } from './public-answer-links.mjs';
import { KnowledgeRecordEditor } from './KnowledgeRecordEditor.jsx';


const institution = {
  name: 'MIT College of Railway Engineering and Research',
  shortName: 'MITCORER',
  city: 'Barshi',
  code: 'DTE 06901',
  university: 'Punyashlok Ahilyadevi Holkar Solapur University',
  contact: '91 84599 67882, +91 86696 62106',
  email: 'info.mitcorer@mitpune.edu.in',
  address: 'Industrial Estate No. 03, Barshi, Dist. Solapur, Maharashtra - 413401',
  status: ['AICTE approved', 'AY 2026-27 admissions', 'Verified source mode'],
};




const courses = [
  { name: 'Computer Science and Engineering', intake: 120, choiceCode: '0690124210' },
  { name: 'Artificial Intelligence and Data Science', intake: 60, choiceCode: '0690126310' },
  { name: 'Civil Engineering', intake: 60, choiceCode: '0690119110' },
  { name: 'Electronics and Computer Engineering', intake: 60, choiceCode: '0690184410' },
  { name: 'Electronics and Telecommunication Engineering', intake: 60, choiceCode: '0690137210' },
  { name: 'Mechanical and Rail Engineering', intake: 60, choiceCode: '0690158510' },
];

const dseCourses = [
  { name: 'Civil Engineering', choiceCode: '690119110' },
  { name: 'Computer Science and Engineering', choiceCode: '690124210' },
  { name: 'Electronics and Computer Engineering', choiceCode: '690184410' },
  { name: 'Electronics and Telecommunication Engineering', choiceCode: '690137210' },
  { name: 'Mechanical and Rail Engineering', choiceCode: '690161210' },
];

const polytechnicCourses = [
  { name: 'Civil Engineering', intake: 60 },
  { name: 'Computer Science and Engineering', intake: 60 },
  { name: 'Electronics and Telecommunication Engineering', intake: 60 },
  { name: 'Mechanical Engineering', intake: 60 },
];

const facilities = [
  'Hostel',
  'Bus facility',
  'Library',
  'Computer center',
  'Railway model room',
  'Workshop',
  'Cafeteria',
  'Seminar hall',
];

const scholarshipSchemes = [
  'AICTE Pragati Scholarship Scheme for Girl Students (Technical Degree / Diploma)',
  'Dr. Panjabrao Deshmukh Vastigruh Nirvah Bhatta Yojna',
  'Rajarshi Chhatrapati Shahu Maharaj Shikshan Shulkh Shishyavrutti Yojna',
  'Minority communities scholarship for higher and professional courses',
  'OBC / VJNT / SBC post-matric and maintenance allowance schemes',
  'Tuition and examination fee support for eligible category students',
];

const scholarshipDocuments = {
  open: ['Income certificate', 'Domicile / nationality proof', 'Admission / allotment proof', 'Bank passbook'],
  ews: ['EWS certificate', 'Income certificate', 'Domicile / nationality proof', 'Bank passbook'],
  obc: ['Caste certificate', 'Caste validity if required', 'Non-creamy layer certificate', 'Income certificate', 'Domicile / nationality proof'],
  vjnt: ['Caste certificate', 'Caste validity if required', 'Non-creamy layer certificate', 'Income certificate', 'Domicile / nationality proof'],
  scst: ['Caste certificate', 'Caste validity if required', 'Domicile / nationality proof', 'Bank passbook'],
  minority: ['Minority declaration/certificate', 'Income certificate', 'Domicile / nationality proof', 'Bank passbook'],
};

const scholarshipChecklist = [
  ['Admission route', 'CAP and institute-level/non-CAP admissions must be checked against each scheme\'s current route condition.'],
  ['Income proof', 'Needed for EBC/EWS/OBC/minority or other income-linked claims.'],
  ['Category proof', 'Caste certificate, validity, and non-creamy layer wherever applicable.'],
  ['Domicile / nationality', 'Often required to confirm Maharashtra/state scheme eligibility.'],
  ['Bank details', 'Keep passbook or account details ready for scheme applications.'],
  ['Hostel claim', 'If hostel benefit is expected, confirm stay proof and scheme condition with staff.'],
];

function getLikelyScholarships(profile) {
  const items = [];
  if (profile.gender === 'girl' && profile.income === 'under8') {
    items.push({
      title: 'AICTE Pragati Scholarship for Girl Students',
      reason: profile.route === 'cap'
        ? 'Potential match for a girl student in an AICTE-approved technical degree or diploma course. Confirm the current NSP merit criteria, family limit, admission details, and documents before applying.'
        : 'Potential profile match, but institute-level/non-CAP admission does not automatically establish Pragati eligibility. Verify that the current NSP specification accepts this admission route before applying.',
    });
  }
  if (profile.income === 'under8' && ['open', 'ews'].includes(profile.category)) {
    items.push({
      title: 'Rajarshi Chhatrapati Shahu Maharaj Shikshan Shulkh Shishyavrutti Yojna',
      reason: 'Relevant for EBC/EWS or eligible open-category fee concession checks where income criteria are satisfied.',
    });
  }
  if (profile.hostel === 'yes' && ['open', 'ews', 'minority'].includes(profile.category)) {
    items.push({
      title: 'Dr. Panjabrao Deshmukh Vastigruh Nirvah Bhatta Yojna',
      reason: 'Relevant when the student is claiming hostel/residence-related support and satisfies scheme conditions.',
    });
  }
  if (profile.category === 'minority') {
    items.push({
      title: 'Minority scholarship for higher and professional courses',
      reason: 'Relevant for eligible minority-community students pursuing professional courses.',
    });
  }
  if (profile.category === 'obc') {
    items.push({
      title: 'Post Matric Scholarship / Tuition and Examination Fee support for OBC',
      reason: 'Relevant for eligible OBC/SEBC students, with income and required category documents.',
    });
  }
  if (profile.category === 'vjnt') {
    items.push({
      title: 'VJNT / SBC maintenance allowance and post-matric support',
      reason: 'Relevant for eligible VJNT/SBC students, especially where hostel or professional-course support applies.',
    });
  }
  if (profile.category === 'scst') {
    items.push({
      title: 'SC/ST post-matric or fee support route',
      reason: 'Relevant for eligible SC/ST students as per applicable state scholarship rules and category verification.',
    });
  }
  if (profile.admission === 'polytechnic') {
    items.push({
      title: 'Diploma admission scholarship check',
      reason: 'Scheme applicability can differ from B.Tech, so diploma candidates should verify the exact portal/scheme route.',
    });
  }
  if (profile.route === 'nonCap') {
    items.push({
      title: 'Institute-level / non-CAP route verification',
      reason: 'Keep the institute application, merit-list or allotment proof, fee receipt, and originals ready. Confirm the selected scheme explicitly accepts this admission route before relying on a scholarship or concession.',
    });
  }
  if (items.length === 0) {
    items.push({
      title: 'No clear concession route from selected profile',
      reason: 'The student may follow the regular fee route unless another official scheme, category, or income condition applies.',
    });
  }
  return items;
}

const placementSignals = [
  ['Final-year students', '113'],
  ['Internships recorded', '81'],
  ['Students placed', '48'],
  ['Highest CTC', '21 LPA'],
];

const branchPlacementRecords = [
  ['Civil Engineering', '13', '0', '11'],
  ['Computer Science Engineering', '62', '50', '13'],
  ['E&TC Engineering', '35', '31', '21'],
  ['Mechanical Engineering', '3', '0', '3'],
];

const placementPlatforms = [
  { name: 'Preskilet', purpose: 'Build recruiter-facing readiness', details: ['Create a live/video profile', 'Practise communication and presentation', 'Show projects and proof of work', 'Complete recruiter-recommended tasks'], url: 'https://preskilet.com/' },
  { name: 'POD.AI', purpose: 'Track and apply for opportunities', details: ['Receive company and job-description updates', 'Check eligibility and register for drives', 'Follow interview or selection stages', 'Receive recruitment notifications'], url: 'https://pod.ai/' },
];

const recruiters = ['Accenture', 'Amdocs', 'TCS', 'Wipro', 'IBM', 'Infosys', 'Cognizant', 'Cummins', 'Atlas Copco', 'Cloud4C', "Byju's", 'Clover', 'Atos', 'Juspay'];

const branchCareerOutcomes = {
  'Computer Science and Engineering': { roles: ['Software developer', 'Web or app developer', 'Cloud and DevOps associate', 'Data analyst'], skills: ['Programming fundamentals', 'Data structures and problem solving', 'Projects and Git portfolio', 'Aptitude and communication'] },
  'Artificial Intelligence and Data Science': { roles: ['Data analyst', 'Junior ML engineer', 'Business intelligence analyst', 'Software developer'], skills: ['Python and SQL', 'Statistics and data handling', 'Machine-learning projects', 'Programming and aptitude'] },
  'Civil Engineering': { roles: ['Site engineer', 'Quantity surveyor', 'CAD/BIM trainee', 'Government exam pathway'], skills: ['Surveying and estimation', 'CAD/BIM tools', 'Site exposure', 'Core aptitude and communication'] },
  'Electronics and Computer Engineering': { roles: ['Embedded systems trainee', 'Software developer', 'IoT engineer', 'Electronics testing engineer'], skills: ['C/C++ and programming', 'Microcontrollers and embedded systems', 'Electronics fundamentals', 'Projects and aptitude'] },
  'Electronics and Telecommunication Engineering': { roles: ['Telecom engineer', 'Embedded systems trainee', 'Network support engineer', 'Electronics testing engineer'], skills: ['Communication systems', 'Networking basics', 'Embedded projects', 'Core aptitude and communication'] },
  'Mechanical and Rail Engineering': { roles: ['Design engineer', 'Production engineer', 'Quality engineer', 'Railway and government exam pathway'], skills: ['CAD and design tools', 'Manufacturing fundamentals', 'Workshop or industry exposure', 'Core aptitude and communication'] },
};

const hostelConfirmations = [
  'Room availability and allotment timing',
  'Deposit refund process',
  'Documents needed for hostel admission',
  'Mess joining date and payment process',
  'Local transport or bus option if hostel is not selected',
  'Parent visit timing before final reporting',
];


function App() {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState('');
  const [view, setView] = useState('knowledge');
  const [viewHistory, setViewHistory] = useState([]);
  const [navOpen, setNavOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => localStorage.getItem('mitra.sidebarCollapsed') === 'true');
  const [publicFacts, setPublicFacts] = useState(null);
  const [knowledge, setKnowledge] = useState([]);
  const [officialSources, setOfficialSources] = useState([]);
  const [appError, setAppError] = useState('');

  const navigateTo = (nextView) => {
    if (!nextView || nextView === view) return;
    setViewHistory((items) => [...items, view].slice(-20));
    setView(nextView);
  };

  const returnToPreviousView = () => {
    if (!viewHistory.length) return;
    const nextHistory = [...viewHistory];
    const previousView = nextHistory.pop();
    setViewHistory(nextHistory);
    setView(previousView);
  };

  const refreshWorkspaceData = async (authToken) => {
    try {
      const [knowledgeResult, sourceResult, factsResult] = await Promise.all([
        api.getKnowledge(authToken).catch(() => ({ items: [] })),
        api.getOfficialSources(authToken).catch(() => ({ items: [] })),
        api.getPublicFacts().catch(() => null),
      ]);
      setKnowledge(knowledgeResult.items || []);
      setOfficialSources(sourceResult.items || []);
      if (factsResult) setPublicFacts(factsResult);
    } catch (error) {
      setAppError(error.message);
    }
  };

  useEffect(() => {
    let active = true;
    api.getPublicFacts().then((facts) => {
      if (active && facts) setPublicFacts(facts);
    }).catch(() => {});
    const restoreSession = async () => {
      try {
        const payload = await api.refresh();
        if (!active) return;
        setToken(payload.token);
        setView('knowledge');
        setViewHistory([]);
        await refreshWorkspaceData(payload.token);
        setUser(payload.user);
      } catch {
        // No active session cookie is the normal state for a visitor.
      }
    };
    restoreSession();
    return () => { active = false; };
  }, []);

  const logout = async () => {
    await api.logout().catch(() => {});
    setUser(null);
    setToken('');
    setKnowledge([]);
    setOfficialSources([]);
    setView('knowledge');
    setViewHistory([]);
  };

  const createKnowledgeItem = async (record) => {
    setAppError('');
    try {
      const saved = await api.createKnowledge(token, record);
      setKnowledge((items) => [saved, ...items]);
      api.getPublicFacts().then((facts) => setPublicFacts(facts)).catch(() => setPublicFacts(null));
      return saved;
    } catch (error) {
      setAppError(error.message);
    }
  };

  const updateKnowledgeItem = async (id, changes) => {
    const saved = await api.updateKnowledge(token, id, changes);
    setKnowledge((items) => items.map((item) => item.id === id ? saved : item));
    api.getPublicFacts().then((facts) => setPublicFacts(facts)).catch(() => setPublicFacts(null));
    return saved;
  };

  const uploadOfficialSource = async (record, file) => {
    setAppError('');
    try {
      const saved = await api.uploadOfficialSource(token, record, file);
      setOfficialSources((items) => [saved, ...items]);
      if (record.verifiedText?.trim()) {
        const knowledgeResult = await api.getKnowledge(token);
        setKnowledge(knowledgeResult.items || []);
      }
      return true;
    } catch (error) {
      setAppError(error.message);
      return false;
    }
  };

  const openOfficialSource = async (id) => {
    try {
      await api.openOfficialSource(token, id);
    } catch (error) {
      setAppError(error.message);
    }
  };

  const reviewOfficialSource = async (id) => {
    try {
      return await api.getOfficialSourceExtractedText(token, id);
    } catch (error) {
      setAppError(error.message);
      return null;
    }
  };

  const publishOfficialSource = async (id, verifiedText) => {
    setAppError('');
    try {
      const saved = await api.publishOfficialSource(token, id, verifiedText);
      setOfficialSources((items) => items.map((item) => (item.id === id ? saved : item)));
      const knowledgeResult = await api.getKnowledge(token);
      setKnowledge(knowledgeResult.items || []);
      api.getPublicFacts().then((facts) => setPublicFacts(facts)).catch(() => setPublicFacts(null));
      return saved;
    } catch (error) {
      setAppError(error.message);
      return null;
    }
  };

  const syncOfficialSources = async () => {
    setAppError('');
    try {
      const summary = await api.syncOfficialSources(token);
      const sourceResult = await api.getOfficialSources(token);
      setOfficialSources(sourceResult.items || []);
      return summary;
    } catch (error) {
      setAppError(error.message);
      return null;
    }
  };

  const handleAdminLogin = async (email, password) => {
    setAppError('');
    try {
      const payload = await api.login({ email, password });
      setToken(payload.token);
      setView('knowledge');
      setViewHistory([]);
      await refreshWorkspaceData(payload.token);
      setUser(payload.user);
      return true;
    } catch (error) {
      setAppError(error.message);
      return false;
    }
  };

  const extractStructuredOfficialSource = async (id) => {
    setAppError('');
    try {
      return await api.extractStructuredOfficialSource(token, id);
    } catch (error) {
      setAppError(error.message);
      return null;
    }
  };

  if (!user) {
    return <PublicAssistantWidget onAdminLogin={handleAdminLogin} />;
  }

  return (
    <div className={`appShell ${sidebarCollapsed ? 'sidebarCollapsed' : ''}`}>
      <Sidebar user={user} view={view} setView={navigateTo} navOpen={navOpen} setNavOpen={setNavOpen} collapsed={sidebarCollapsed} setCollapsed={setSidebarCollapsed} onLogout={logout} />
      <main className="workspace">
        <Header user={user} setNavOpen={setNavOpen} canGoBack={viewHistory.length > 0} onBack={returnToPreviousView} />
        {navOpen && <button className="mobileScrim" type="button" aria-label="Close navigation" onClick={() => setNavOpen(false)}><X size={18} /></button>}
        <section className="workspaceBody">
          {appError && <div className="errorBanner">{appError}</div>}
          {view === 'knowledge' && <KnowledgeManager items={knowledge} sources={officialSources} onCreate={createKnowledgeItem} onUpdate={updateKnowledgeItem} onUploadSource={uploadOfficialSource} onOpenSource={openOfficialSource} onReviewSource={reviewOfficialSource} onPublishSource={publishOfficialSource} onSyncWebsite={syncOfficialSources} onExtractStructuredSource={extractStructuredOfficialSource} />}
          {view === 'programs' && <Programs publicFacts={publicFacts} />}
          {view === 'fees' && <Fees setView={navigateTo} publicFacts={publicFacts} />}
          {view === 'scholarships' && <ScholarshipAid />}
          {view === 'placements' && <CareerOutcomes setView={navigateTo} />}
          {view === 'visit' && <HostelMess setView={navigateTo} publicFacts={publicFacts} />}
        </section>
      </main>
    </div>
  );
}

function PublicAssistantWidget({ onAdminLogin }) {
  const [showAdminLogin, setShowAdminLogin] = useState(() => {
    try {
      return typeof window !== 'undefined' && (new URLSearchParams(window.location.search).has('admin') || window.location.hash === '#admin');
    } catch { return false; }
  });
  const [adminEmail, setAdminEmail] = useState('admin@mitcorer.edu.in');
  const [adminPassword, setAdminPassword] = useState('');
  const [adminLoggingIn, setAdminLoggingIn] = useState(false);
  const [adminLoginError, setAdminLoginError] = useState('');
  const [language, setLanguage] = useState('auto');
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const textareaRef = useRef(null);
  useLayoutEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = '38px';
    if (input) {
      const scrollH = el.scrollHeight;
      const targetH = Math.max(38, Math.min(scrollH, 130));
      el.style.height = `${targetH}px`;
      el.style.overflowY = scrollH > 130 ? 'auto' : 'hidden';
      if (scrollH <= 130) el.scrollTop = 0;
    } else {
      el.style.overflowY = 'hidden';
    }
  }, [input]);
  const [busy, setBusy] = useState(false);
  const [activePills, setActivePills] = useState(null);
  const [conversationId, setConversationId] = useState(null);
  const [teaserDismissed, setTeaserDismissed] = useState(() => {
    try { return sessionStorage.getItem('mitra_teaser_dismissed') === '1'; } catch { return false; }
  });
  const [messages, setMessages] = useState([
    { type: 'assistant', text: "Hello and Welcome to MITCORER! I'm your virtual assistant. How can I help you today?" },
  ]);
  const quickReplies = [
    { label: 'Programmes', choices: [
      { label: 'B.Tech Engineering', question: 'Which B.Tech programmes are available at MITCORER?' },
      { label: 'Polytechnic Diploma', question: 'Which Polytechnic diploma programmes are available at MITCORER?' },
      { label: 'Direct Second Year (DSE)', question: 'What is the Direct Second Year engineering admission process?' },
      { label: 'More', action: 'main' },
    ] },
    { label: 'Fees & Concessions', choices: [
      { label: 'B.Tech First-Year Fees', question: 'What are the first-year B.Tech fees?' },
      { label: 'OBC / EBC Concession', question: 'What are the B.Tech engineering fees for OBC category?' },
      { label: 'SC / ST Concession', question: 'What are the B.Tech engineering fees for SC category?' },
      { label: 'Direct Second Year Fees', question: 'What are the Direct Second Year engineering fees?' },
      { label: 'Hostel & Mess Fees', question: 'What are the hostel and mess fees at MITCORER?' },
      { label: 'More', action: 'main' },
    ] },
    { label: 'Cutoffs', question: 'What are the historical cutoffs for Computer Science and Engineering?' },
    { label: 'Required Documents', question: 'What are the required admission documents?' },
    { label: 'Scholarships', question: 'What scholarships are available at MITCORER and where can I apply?' },
    { label: 'Placements', question: 'What placement support and published placement highlights does MITCORER offer?' },
    { label: 'Facilities', choices: [
      { label: 'Hostel & mess', question: 'What hostel and mess facilities does MITCORER provide?' },
      { label: 'Bus facility', question: 'What MITCORER bus facility information is published?' },
      { label: 'Library', question: 'Tell me about the MITCORER library and digital resources.' },
      { label: 'Labs & workshops', question: 'What laboratories and workshops does MITCORER have?' },
      { label: 'Railway model room', question: 'Tell me about the MITCORER railway model room.' },
      { label: 'Campus facilities', question: 'What campus facilities are available at MITCORER?' },
      { label: 'More', action: 'main' },
    ] },
    { label: 'About MITCORER', question: 'Tell me about MITCORER.' },
    { label: 'Why MITCORER?', question: 'Why should I choose MITCORER?' },
    { label: 'Admission enquiry', href: 'https://www.mitcorer.edu.in/Admissions-Open-2026-27.html' },
    { label: 'Contact us', question: 'What are the MITCORER admission contact details?' },
  ];
  const endRef = useRef(null);

  const resetConversation = async () => {
    if (busy) return;
    if (conversationId) {
      setBusy(true);
      try { await api.resetPublicConversation(conversationId); }
      catch (error) {
        if (!/not found or expired/i.test(error.message)) {
          setMessages(items => [...items, { type: 'assistant', text: 'I could not clear the stored chat. Please try resetting again.' }]);
          setBusy(false);
          return;
        }
      }
      setBusy(false);
    }
    setActivePills(null);
    setConversationId(null);
    setInput('');
    setMessages([
      { type: 'assistant', text: "Hello and Welcome to MITCORER! I'm your virtual assistant. How can I help you today?" },
    ]);
  };

  useEffect(() => {
    if (open) endRef.current?.scrollIntoView({ block: 'nearest' });
  }, [messages, open]);

  const ask = async (forcedText = '', pillsContext = activePills) => {
    const question = (forcedText || input).trim();
    if (!question || busy) return;
    if (!forcedText) setActivePills(null);
    const retainedChoices = forcedText ? pillsContext : null;
    setMessages((items) => [...items, { type: 'user', text: question }]);
    setInput('');
    setBusy(true);
    try {
      const answer = await api.askPublicAssistant(question, language, conversationId);
      if (answer.conversationId) {
        setConversationId(answer.conversationId);
      }
      setMessages((items) => [
        ...items,
        ...(answer.conversationReset ? [{ type: 'assistant', text: 'The previous chat expired or was reset. This answer starts a new conversation.' }] : []),
        {
          type: 'assistant',
          text: answer.answer,
          next: answer.next,
          source: answer.source,
          sourceUrl: answer.sourceUrl,
          officialLinks: answer.officialLinks,
          evidence: answer.evidence,
          sections: answer.sections,
          requestedLanguage: answer.requestedLanguage,
          showQuickReplies: !answer.answerPart2,
          choices: retainedChoices || undefined,
          suggestions: answer.suggestions,
          escalation: answer.escalation,
          originalQuestion: question,
          model: answer.model,
        },
        ...(answer.answerPart2 ? [{
          type: 'assistant',
          text: answer.answerPart2,
          choices: retainedChoices || undefined,
          suggestions: answer.suggestions,
          escalation: answer.escalation,
          originalQuestion: question,
          model: answer.model,
        }] : []),
      ]);
    } catch (error) {
      const limited = /Too many requests/.test(error.message);
      const failure = language === 'mr' ? limited ? 'खूप विनंत्या आल्या आहेत. कृपया थोड्या वेळाने पुन्हा प्रयत्न करा.' : 'सध्या अधिकृत माहिती मिळवता आली नाही. कृपया पुन्हा प्रयत्न करा किंवा प्रवेश कार्यालयाशी संपर्क साधा.'
        : language === 'hi' ? limited ? 'बहुत अधिक अनुरोध आए हैं। कृपया कुछ देर बाद फिर कोशिश करें।' : 'अभी आधिकारिक जानकारी प्राप्त नहीं हो सकी। कृपया फिर कोशिश करें या प्रवेश कार्यालय से संपर्क करें.'
          : limited ? error.message : 'I could not retrieve a verified answer right now. Please try again, or contact the admissions office.';
      setMessages((items) => [...items, { type: 'assistant', text: failure, choices: retainedChoices || undefined }]);
    } finally {
      setBusy(false);
    }
  };

  const selectTopic = (topic) => {
    if (topic.action === 'main') {
      setActivePills(null);
      setMessages((items) => [...items, { type: 'assistant', text: 'What else would you like to know about MITCORER?', choices: null }]);
      return;
    }
    if (topic.choices) {
      setActivePills(topic.choices);
      setMessages((items) => [...items,
        { type: 'user', text: topic.label },
        { type: 'assistant', text: `Please select a ${topic.label.toLowerCase()} option.`, choices: topic.choices },
      ]);
      return;
    }
    const isMainMenuTopic = quickReplies.some((item) => item.label === topic.label);
    const nextPills = isMainMenuTopic ? null : activePills;
    if (isMainMenuTopic) {
      setActivePills(null);
    }
    ask(topic.question, nextPills);
  };

  return (
    <main className="publicAssistantShell">
      {!open && !teaserDismissed && (
        <div className="assistantTeaser" onClick={() => setOpen(true)} role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setOpen(true); }}>
          <button
            type="button"
            aria-label="Dismiss welcome message"
            onClick={(e) => {
              e.stopPropagation();
              setTeaserDismissed(true);
              try { sessionStorage.setItem('mitra_teaser_dismissed', '1'); } catch {}
            }}
          >
            <X size={13} />
          </button>
          <p>Hi! I’m Mitra, your MIT Barshi admission assistant.</p>
        </div>
      )}
      {open && <section className="publicAssistantPanel" aria-label="MIT Barshi admission assistant">
        <header>
          <div className="publicAssistantAvatar"><img src={mitcorerLogo} alt="MITCORER" /></div>
          <div><strong>Mitra</strong><span><i />MIT Barshi admission assistant</span></div>
          <div className="publicHeaderActions">
            <label className="publicLanguageControl" title={`Response language: ${{ auto: 'Automatic', en: 'English', mr: 'मराठी', hi: 'हिंदी' }[language]}`}>
              <Languages size={19} aria-hidden="true" />
              <span className="publicLanguageBadge" aria-hidden="true">{{ auto: 'A', en: 'EN', mr: 'मर', hi: 'हि' }[language]}</span>
              <select aria-label="Response language" value={language} disabled={busy} onChange={(event) => setLanguage(event.target.value)}>
                <option value="auto">Automatic</option><option value="en">English</option><option value="mr">मराठी</option><option value="hi">हिंदी</option>
              </select>
            </label>
            <button
              type="button"
              className="publicResetButton"
              onClick={resetConversation}
              title={language === 'mr' ? 'नवीन संभाषण सुरू करा' : language === 'hi' ? 'नई बातचीत शुरू करें' : 'Start new conversation'}
              aria-label={language === 'mr' ? 'नवीन संभाषण' : language === 'hi' ? 'नई बातचीत' : 'New conversation'}
              disabled={busy}
            >
              <RefreshCw size={15} />
            </button>
            <button type="button" onClick={() => setOpen(false)} aria-label="Minimize assistant">−</button>
          </div>
        </header>
        <div className="publicChatMessages">
          <section className="publicCampusWelcome" style={{ backgroundImage: `linear-gradient(90deg, rgba(7,32,51,.78), rgba(7,32,51,.25)), url(${mitcorerCampus})` }}><div><span>MITCORER, Barshi</span><strong>Start your engineering journey.</strong><a href="https://www.mitcorer.edu.in/Admissions-Open-2026-27.html" target="_blank" rel="noreferrer">Start admission enquiry <ArrowRight size={13} /></a></div></section>
          {messages.map((message, index) => <Fragment key={`${message.type}-${index}`}><article className={`publicBubble ${message.type}`}>
            {message.type === 'assistant' && <div className="publicBubbleAvatar"><img src={mitcorerLogo} alt="" /></div>}
            <div>
              <PublicAnswerBody message={message} />
              {publicAnswerLinks(message, { firstYear: feeFirstYearImage, directSecondYear: feeDirectSecondYearImage, hostel: hostelMessFeeImage }).map(link => <a key={link.url} href={link.url} target="_blank" rel="noreferrer">{link.label} <ArrowRight size={13} /></a>)}
              {message.type === 'assistant' && (message.escalation?.available || message.source === 'No verified record') && (
                <PublicEscalationCard message={message} language={language} />
              )}
              {message.type === 'assistant' && Boolean(message.originalQuestion) && (
                <AnswerFeedback message={message} language={language} />
              )}
            </div>
          </article>{message.type === 'assistant' && (message.suggestions?.length > 0 || message.showQuickReplies !== false) && <section className="publicQuickReplies publicQuickRepliesInline" aria-label="Quick questions"><div>{(message.suggestions && message.suggestions.length > 0 ? message.suggestions : (message.choices || quickReplies)).map((topic) => topic.href ? <a key={topic.label} href={topic.href} target="_blank" rel="noreferrer">{topic.label} <ArrowRight size={13} /></a> : <button key={topic.label} type="button" disabled={busy} onClick={() => selectTopic(topic)}>{topic.label}</button>)}</div></section>}</Fragment>)}
          {busy && <article className="publicBubble assistant"><div className="publicBubbleAvatar"><img src={mitcorerLogo} alt="" /></div><div className="typingDots" role="status" aria-label={language === 'mr' ? 'माहिती तपासत आहे' : language === 'hi' ? 'जानकारी जाँची जा रही है' : 'Checking information'}><i /><i /><i /></div></article>}
          <div ref={endRef} />
        </div>
        <form className="publicComposer" onSubmit={(event) => { event.preventDefault(); ask(); }}>
          <textarea ref={textareaRef} value={input} onChange={(event) => setInput(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); ask(); } }} rows={1} placeholder={language === 'mr' ? 'तुमचा प्रश्न येथे लिहा…' : language === 'hi' ? 'अपना प्रश्न यहाँ लिखें…' : 'Type your message here…'} aria-label={language === 'mr' ? 'प्रवेशाबद्दल तुमचा प्रश्न' : language === 'hi' ? 'प्रवेश के बारे में आपका प्रश्न' : 'Ask MIT Barshi admissions'} disabled={busy} />
          <button type="submit" aria-label={language === 'mr' ? 'प्रश्न पाठवा' : language === 'hi' ? 'प्रश्न भेजें' : 'Send message'} disabled={busy || !input.trim()}><Send size={19} /></button>
        </form>
        <footer>
          Powered by MITCORER{' '}
          <button
            type="button"
            className="adminEntryBtn"
            onClick={() => setShowAdminLogin(true)}
            title="Administrator Portal"
            style={{ background: 'transparent', border: 'none', color: 'inherit', cursor: 'pointer', padding: '0 2px', font: 'inherit' }}
          >
            ©
          </button>
        </footer>
      </section>}
      {showAdminLogin && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(7, 32, 51, 0.72)', display: 'grid', placeItems: 'center', zIndex: 10000, padding: '20px' }}>
          <div style={{ background: '#fff', borderRadius: '12px', maxWidth: '420px', width: '100%', padding: '28px', boxShadow: '0 20px 40px rgba(0,0,0,0.3)', color: '#202724' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <strong style={{ fontSize: '18px', color: '#146548' }}>Administrator Portal</strong>
              <button type="button" onClick={() => setShowAdminLogin(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#69756e' }}><X size={18} /></button>
            </div>
            <p style={{ fontSize: '13px', color: '#555', margin: '0 0 16px' }}>Sign in to manage verified sources, run CDM structured extraction, and publish knowledge.</p>
            {adminLoginError && <div style={{ background: '#fef2f2', color: '#b91c1c', padding: '8px 12px', borderRadius: '6px', fontSize: '12px', marginBottom: '12px' }}>{adminLoginError}</div>}
            <form onSubmit={async (e) => {
              e.preventDefault();
              if (adminLoggingIn || !onAdminLogin) return;
              setAdminLoggingIn(true);
              setAdminLoginError('');
              try {
                const ok = await onAdminLogin(adminEmail, adminPassword);
                if (!ok) setAdminLoginError('Invalid credentials. Check email and password.');
              } catch (err) {
                setAdminLoginError(err.message || 'Login failed.');
              } finally {
                setAdminLoggingIn(false);
              }
            }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}>Admin Email</label>
              <input type="email" required value={adminEmail} onChange={(e) => setAdminEmail(e.target.value)} style={{ width: '100%', padding: '10px 12px', borderRadius: '6px', border: '1px solid #cfd8d2', marginBottom: '12px', boxSizing: 'border-box' }} />
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}>Password</label>
              <input type="password" required value={adminPassword} onChange={(e) => setAdminPassword(e.target.value)} style={{ width: '100%', padding: '10px 12px', borderRadius: '6px', border: '1px solid #cfd8d2', marginBottom: '16px', boxSizing: 'border-box' }} />
              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                <button type="button" onClick={() => setShowAdminLogin(false)} style={{ padding: '8px 16px', borderRadius: '6px', border: '1px solid #cfd8d2', background: '#f6f8f7', cursor: 'pointer' }}>Cancel</button>
                <button type="submit" disabled={adminLoggingIn} style={{ padding: '8px 20px', borderRadius: '6px', border: 'none', background: '#146548', color: '#fff', fontWeight: 600, cursor: 'pointer' }}>{adminLoggingIn ? 'Signing in…' : 'Sign in'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
      <button className="assistantLauncher" type="button" onClick={() => setOpen(true)} aria-label="Open MIT Barshi admission assistant"><span className="launcherPulse" /><img src={mitcorerLogo} alt="" /></button>
    </main>
  );
}

function PublicEscalationCard({ message, language }) {
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState('');
  const [contact, setContact] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');

  const escalation = message.escalation || {
    available: true,
    helplines: [
      { label: 'Desk 1', number: '+91 84599 67882', tel: '+918459967882' },
      { label: 'Desk 2', number: '+91 86696 62106', tel: '+918669662106' },
    ],
    email: 'info.mitcorer@mitpune.edu.in',
    officeHours: 'Monday to Saturday, 9:30 AM to 5:30 PM IST',
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!contact.trim()) return;
    setSubmitting(true);
    setError('');
    try {
      await api.escalateInquiry({
        name: name.trim() || 'Prospective Student',
        contact: contact.trim(),
        question: message.originalQuestion || message.text || 'Inquiry regarding MITCORER admissions',
        topic: 'Human Escalation',
      });
      setSubmitted(true);
      setShowForm(false);
    } catch (err) {
      setError(err.message || 'Could not send escalation request. Please call directly.');
    } finally {
      setSubmitting(false);
    }
  };

  const headerTitle = language === 'mr'
    ? 'मानव प्रवेश सल्लागारांशी संपर्क साधा'
    : language === 'hi'
      ? 'मानव प्रवेश परामर्शदाता से संपर्क करें'
      : 'Connect with Admission Counselors';

  const promptText = language === 'mr'
    ? 'या प्रश्नाची अधिकृत माहिती खात्रीशीर नसल्यास, थेट आमच्या प्रवेश कार्यालयाशी बोला किंवा संपर्क नोंदवा:'
    : language === 'hi'
      ? 'यदि इस प्रश्न की आधिकारिक जानकारी सत्यापित नहीं है, तो सीधे हमारे प्रवेश कार्यालय से संपर्क करें:'
      : 'For unverified queries or specific guidance, connect directly with MITCORER admissions staff:';

  return (
    <div className="escalationCard" role="region" aria-label="Admissions escalation">
      <div className="escalationCardHeader">
        <Phone size={13} aria-hidden="true" />
        <span>{headerTitle}</span>
      </div>
      <p className="escalationCardPrompt">{promptText}</p>
      {submitted ? (
        <div className="escalationSuccess">
          <CheckCircle2 size={14} />
          <span>
            {language === 'mr'
              ? 'तुमची विनंती नोंदवली गेली आहे! आमचे प्रवेश अधिकारी लवकरच संपर्क साधतील.'
              : language === 'hi'
                ? 'आपका अनुरोध दर्ज कर लिया गया है! हमारे प्रवेश अधिकारी शीघ्र संपर्क करेंगे।'
                : 'Callback requested! Our admissions counselor will contact you shortly.'}
          </span>
        </div>
      ) : (
        <>
          <div className="escalationActions">
            {escalation.helplines?.map((hl) => (
              <a key={hl.tel} href={`tel:${hl.tel.replace(/[^0-9+]/g, '')}`} className="escalationBtn callBtn">
                <Phone size={11} /> {hl.number}
              </a>
            ))}
            {!showForm && (
              <button
                type="button"
                className="escalationBtn staffBtn"
                onClick={() => setShowForm(true)}
              >
                {language === 'mr' ? 'कॉल-बॅक विनंती करा' : language === 'hi' ? 'कॉल-बैक अनुरोध करें' : 'Request Staff Callback'}
              </button>
            )}
          </div>
          {showForm && (
            <form className="escalationForm" onSubmit={handleSubmit}>
              <input
                type="text"
                placeholder={language === 'mr' ? 'तुमचे नाव (पर्यायी)' : language === 'hi' ? 'आपका नाम (वैकल्पिक)' : 'Your Name (optional)'}
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={submitting}
              />
              <input
                type="text"
                placeholder={language === 'mr' ? 'फोन नंबर किंवा ईमेल*' : language === 'hi' ? 'फ़ोन नंबर या ईमेल*' : 'Phone number or Email*'}
                value={contact}
                required
                onChange={(e) => setContact(e.target.value)}
                disabled={submitting}
              />
              {error && <span style={{ color: '#b91c1c', fontSize: '11px' }}>{error}</span>}
              <div className="escalationFormBtns">
                <button type="submit" disabled={submitting || !contact.trim()}>
                  {submitting ? '...' : language === 'mr' ? 'पाठवा' : language === 'hi' ? 'भेजें' : 'Submit'}
                </button>
                <button type="button" onClick={() => setShowForm(false)} disabled={submitting}>
                  {language === 'mr' ? 'रद्द करा' : language === 'hi' ? 'रद्द करें' : 'Cancel'}
                </button>
              </div>
            </form>
          )}
        </>
      )}
    </div>
  );
}

function AnswerFeedback({ message, language }) {
  const [voted, setVoted] = useState(null); // 'up' | 'down' | null
  const [submitting, setSubmitting] = useState(false);

  const handleVote = async (helpful) => {
    if (voted || submitting) return;
    setSubmitting(true);
    try {
      await api.submitFeedback({
        question: message.originalQuestion || '',
        answer: message.text || '',
        helpful,
        model: message.model || 'unknown',
      });
      setVoted(helpful ? 'up' : 'down');
    } catch {
      // Best-effort feedback submission
      setVoted(helpful ? 'up' : 'down');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="answerFeedbackRow" aria-label="Answer feedback">
      {voted === null ? (
        <>
          <span className="feedbackLabel">
            {language === 'mr' ? 'हे उत्तर उपयुक्त होते का?' : language === 'hi' ? 'क्या यह उत्तर उपयोगी था?' : 'Was this answer helpful?'}
          </span>
          <button
            type="button"
            className="feedbackVoteBtn"
            onClick={() => handleVote(true)}
            disabled={submitting}
            title={language === 'mr' ? 'होय' : language === 'hi' ? 'हाँ' : 'Yes'}
            aria-label="Yes, helpful"
          >
            <ThumbsUp size={12} />
          </button>
          <button
            type="button"
            className="feedbackVoteBtn"
            onClick={() => handleVote(false)}
            disabled={submitting}
            title={language === 'mr' ? 'नाही' : language === 'hi' ? 'नहीं' : 'No'}
            aria-label="No, not helpful"
          >
            <ThumbsDown size={12} />
          </button>
        </>
      ) : (
        <span className="feedbackThanks">
          {voted === 'up' ? '👍 ' : '👎 '}
          {language === 'mr' ? 'तुमच्या अभिप्रायाबद्दल धन्यवाद!' : language === 'hi' ? 'आपकी प्रतिक्रिया के लिए धन्यवाद!' : 'Thanks for your feedback!'}
        </span>
      )}
    </div>
  );
}

function PublicAnswerBody({ message }) {
  return formatPublicResponse(message).map((block, blockIndex) => {
    if (block.type === 'heading') return <p key={blockIndex}><strong>{block.text}</strong></p>;
    if (block.type === 'programmes' || block.type === 'fees' || block.type === 'cards') {
      return <Fragment key={blockIndex}><p>{block.intro}</p><ul className="publicAnswerList">{block.items.map((item, itemIndex) => <li key={itemIndex}><strong>{item.name}</strong><span>{block.type === 'cards' ? item.detail : block.type === 'fees' ? `INR ${item.amount}` : `Intake: ${item.intake} | Choice code: ${item.choiceCode}`}</span></li>)}</ul></Fragment>;
    }
    return block.type === 'list' ? <ul key={blockIndex}>{block.items.map((item, itemIndex) => <li key={itemIndex}>{linkOfficialContact(item)}</li>)}</ul> : <p key={blockIndex}>{linkOfficialContact(block.text)}</p>;
  });
}

function linkOfficialContact(text) {
  const value = String(text || '');
  const contactPattern = /\+91\s*(?:84599\s*67882|86696\s*62106)|info\.mitcorer@mitpune\.edu\.in/gi;
  const parts = [];
  let cursor = 0;
  for (const match of value.matchAll(contactPattern)) {
    const start = match.index;
    if (start > cursor) parts.push(value.slice(cursor, start));
    const isEmail = match[0].includes('@');
    parts.push(<a className="publicPhoneLink" key={`${start}-${match[0]}`} href={isEmail ? `mailto:${match[0]}` : `tel:${match[0].replace(/\s/g, '')}`}>{match[0]}</a>);
    cursor = start + match[0].length;
  }
  if (cursor < value.length) parts.push(value.slice(cursor));
  return parts.length ? parts : value;
}

function Sidebar({ user, view, setView, navOpen, setNavOpen, collapsed, setCollapsed, onLogout }) {
  const openView = (id) => { setView(id); setNavOpen(false); };
  const toggleCollapsed = () => {
    const next = !collapsed;
    setCollapsed(next);
    localStorage.setItem('mitra.sidebarCollapsed', String(next));
  };
  return (
    <aside className={`sidebar ${navOpen ? 'open' : ''} ${collapsed ? 'collapsed' : ''}`}>
      <div className="sidebarBrandRow">
        <div className="brandLockup compact"><span className="collegeLogo"><img src={mitcorerLogo} alt="MITCORER logo" /></span><div><strong>MITCORER</strong><small>{institution.code}</small></div></div>
        <button className="sidebarToggle" type="button" onClick={toggleCollapsed} aria-label={collapsed ? 'Open sidebar' : 'Close sidebar'} title={collapsed ? 'Open sidebar' : 'Close sidebar'}>{collapsed ? <PanelLeftOpen size={19} /> : <PanelLeftClose size={19} />}</button>
      </div>
      <button className="collegeMini" type="button" onClick={() => openView('knowledge')}>
        <strong>{institution.shortName}</strong>
        <span>Knowledge Management</span>
      </button>
      <nav className="sideNav">
        <button className={view === 'knowledge' ? 'active' : ''} type="button" onClick={() => openView('knowledge')} title={collapsed ? 'Knowledge Base' : undefined} aria-label={collapsed ? 'Knowledge Base' : undefined}>
          <FileText size={17} /><span>Knowledge Base</span>
        </button>
        <button className={view === 'programs' ? 'active' : ''} type="button" onClick={() => openView('programs')} title={collapsed ? 'Programs' : undefined} aria-label={collapsed ? 'Programs' : undefined}>
          <BookOpen size={17} /><span>Programs</span>
        </button>
        <button className={view === 'fees' ? 'active' : ''} type="button" onClick={() => openView('fees')} title={collapsed ? 'Fees' : undefined} aria-label={collapsed ? 'Fees' : undefined}>
          <HandCoins size={17} /><span>Fees</span>
        </button>
        <button className={view === 'scholarships' ? 'active' : ''} type="button" onClick={() => openView('scholarships')} title={collapsed ? 'Scholarships' : undefined} aria-label={collapsed ? 'Scholarships' : undefined}>
          <ShieldCheck size={17} /><span>Scholarships</span>
        </button>
        <button className={view === 'visit' ? 'active' : ''} type="button" onClick={() => openView('visit')} title={collapsed ? 'Hostel & Mess' : undefined} aria-label={collapsed ? 'Hostel & Mess' : undefined}>
          <CheckCircle2 size={17} /><span>Hostel & Mess</span>
        </button>
      </nav>
      <div className="accountFooter" title={user.email}>
        <span aria-hidden="true">{user.name.trim().charAt(0).toUpperCase()}</span>
        <div><strong>{user.name}</strong><small>Maintainer</small></div>
        <button type="button" onClick={onLogout} title="Sign out" aria-label="Sign out"><LogOut size={17} /></button>
      </div>
    </aside>
  );
}

function Header({ user, setNavOpen, canGoBack, onBack }) {
  return (
    <header className="topHeader">
      <button className="menuBtn" type="button" aria-label="Open navigation" onClick={() => setNavOpen(true)}><Menu size={20} /></button>
      <button className="backBtn" type="button" disabled={!canGoBack} aria-label="Return to previous activity" title="Back" onClick={onBack}><ArrowLeft size={19} /></button>
      <div>
        <h1>{institution.name}</h1>
      </div>
      <div className="authBadge"><LockKeyhole size={15} /><span>{user.email}</span></div>
    </header>
  );
}

function Programs({ initial, onSave = () => {}, publicFacts }) {
  const activeCourses = publicFacts?.programs || [];
  const [preferences, setPreferences] = useState(initial?.preferences || []);
  const updatePreferences = (updater) => setPreferences((items) => { const next = typeof updater === 'function' ? updater(items) : updater; onSave({ preferences: next }); return next; });
  const addPreference = (course) => {
    updatePreferences((items) => (items.some((item) => item.choiceCode === course.choiceCode) ? items : [...items, course]));
  };
  const removePreference = (choiceCode) => updatePreferences((items) => items.filter((item) => item.choiceCode !== choiceCode));
  const movePreference = (index, direction) => {
    updatePreferences((items) => {
      const target = index + direction;
      if (target < 0 || target >= items.length) return items;
      const next = [...items];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  };

  return (
    <div className="pageStack">
      <section className="panelBlock verificationStrip">
        <div><span className="eyebrow">Official verification</span><h2>Approval and university records</h2></div>
        <div className="workflowActions">
          <a href="https://mitcorer.edu.in/pdf/Extension-of-Approval-2025-26.pdf" target="_blank" rel="noreferrer">AICTE extension of approval <ArrowRight size={16} /></a>
          <a href="https://mitcorer.edu.in/pdf/Mandatory-Disclousure.pdf" target="_blank" rel="noreferrer">Mandatory disclosure <ArrowRight size={16} /></a>
          <a href="https://su.digitaluniversity.ac/" target="_blank" rel="noreferrer">PAHSUS University portal <ArrowRight size={16} /></a>
        </div>
      </section>
      <div className="sectionHead"><span className="eyebrow">Program Finder</span><h2>Compare admission options before filling preferences.</h2><p>Shortlist branches, arrange a draft preference order, and keep choice codes ready for CAP or institute-level discussion.</p></div>
      <section className="decisionPanel">
        <div className="programGrid">
          {activeCourses.map((course) => {
            const added = preferences.some((item) => item.choiceCode === course.choiceCode);
            return (
              <article key={course.choiceCode}>
                <h3>{course.name}</h3>
                <dl><div><dt>Intake</dt><dd>{course.intake}</dd></div><div><dt>Choice code</dt><dd>{course.choiceCode}</dd></div></dl>
                <button className="inlineAction secondary" type="button" disabled={added} onClick={() => addPreference(course)}>{added ? 'Added to draft' : 'Add to preference'} <ArrowRight size={15} /></button>
              </article>
            );
          })}
        </div>
        <div className="decisionResult">
          <span className="eyebrow">CAP preference draft</span>
          {preferences.length === 0 ? (
            <p>Add branches from the left side to build a draft order before CAP option form discussion.</p>
          ) : (
            <div className="preferenceList">
              {preferences.map((course, index) => (
                <div className="preferenceItem" key={course.choiceCode}>
                  <strong>{index + 1}. {course.name}</strong>
                  <span>{course.choiceCode}</span>
                  <div>
                    <button type="button" onClick={() => movePreference(index, -1)} disabled={index === 0}>Up</button>
                    <button type="button" onClick={() => movePreference(index, 1)} disabled={index === preferences.length - 1}>Down</button>
                    <button type="button" onClick={() => removePreference(course.choiceCode)}>Remove</button>
                  </div>
                </div>
              ))}
            </div>
          )}
          {preferences.length > 0 && <a className="inlineAction" href="https://www.mitcorer.edu.in/Admissions-Open-2026-27.html" target="_blank" rel="noreferrer">Check admission details <ArrowRight size={16} /></a>}
        </div>
      </section>
      <section className="panelBlock"><div className="sectionHead"><span className="eyebrow">Direct Second Year</span><h2>DSE choice codes</h2></div><div className="compactList">{dseCourses.map((course) => <div key={course.choiceCode}><strong>{course.name}</strong><span>{course.choiceCode}</span></div>)}</div></section>
      <section className="panelBlock"><div className="sectionHead"><span className="eyebrow">Polytechnic</span><h2>Diploma courses</h2></div><div className="compactList">{polytechnicCourses.map((course) => <div key={course.name}><strong>{course.name}</strong><span>Intake {course.intake}</span></div>)}</div></section>
    </div>
  );
}

function Fees({ initial, onSave = () => {}, setView, publicFacts }) {
  const [estimate, setEstimate] = useState(Object.keys(initial || {}).length ? initial : { admission: 'fy', category: 'open', hostel: 'no', mess: 'no' });
  const updateEstimate = (key, value) => { const next = { ...estimate, [key]: value }; setEstimate(next); onSave(next); };
  if (!publicFacts?.academicFees || !publicFacts?.accommodationFees) return <section className="panelBlock" role="status"><h2>Maintained fee records are unavailable</h2><p>Check with the college before estimating payment. Retired, conflicting or unavailable records cannot supply a fee estimate.</p></section>;
  const academicFees = { fy: publicFacts.academicFees.fy, dse: publicFacts.academicFees.dse };
  const academic = academicFees[estimate.admission][estimate.category];
  const hostelTotalAmount = publicFacts.accommodationFees.hostelTotal;
  const messTotalAmount = publicFacts.accommodationFees.messAnnual;
  const hostel = estimate.hostel === 'yes' ? hostelTotalAmount : 0;
  const mess = estimate.mess === 'yes' ? messTotalAmount : 0;
  const total = academic + hostel + mess;
  const formatCurrency = (amount) => `INR ${amount.toLocaleString('en-IN')}`;
  const scholarshipHint = estimate.category === 'open'
    ? 'Open/OMS profile may need EBC/EWS income proof if concession is expected.'
    : estimate.category === 'scst'
      ? 'SC/ST profile should prepare category proof and applicable scholarship documents.'
      : 'Category profile should verify scholarship/concession documents before reporting.';

  const displayFeeRecords = [
    {
      title: 'First Year Engineering',
      year: `AY ${publicFacts.academicFees.academicYear}`,
      image: matchesFeeSnapshot('firstYear', publicFacts.academicFees.academicYear, Object.values(publicFacts.academicFees.fy)) ? feeFirstYearImage : null,
      rows: [
        `Open/OMS: INR ${publicFacts.academicFees.fy.open.toLocaleString('en-IN')}`,
        `Open EBC/EWS/OBC/SEBC boys: INR ${publicFacts.academicFees.fy.boys.toLocaleString('en-IN')}`,
        `Girls: INR ${publicFacts.academicFees.fy.girls.toLocaleString('en-IN')}`,
        `VJNT/SBC/TFWS: INR ${publicFacts.academicFees.fy.vjnt.toLocaleString('en-IN')}`,
        `SC/ST: INR ${publicFacts.academicFees.fy.scst.toLocaleString('en-IN')}`,
      ],
    },
    {
      title: 'Direct Second Year',
      year: `AY ${publicFacts.academicFees.academicYear}`,
      image: matchesFeeSnapshot('directSecondYear', publicFacts.academicFees.academicYear, Object.values(publicFacts.academicFees.dse)) ? feeDirectSecondYearImage : null,
      rows: [
        `Open/OMS: INR ${publicFacts.academicFees.dse.open.toLocaleString('en-IN')}`,
        `Open EBC/EWS/OBC/SEBC boys: INR ${publicFacts.academicFees.dse.boys.toLocaleString('en-IN')}`,
        `Girls: INR ${publicFacts.academicFees.dse.girls.toLocaleString('en-IN')}`,
        `VJNT/SBC/TFWS: INR ${publicFacts.academicFees.dse.vjnt.toLocaleString('en-IN')}`,
        `SC/ST: INR ${publicFacts.academicFees.dse.scst.toLocaleString('en-IN')}`,
      ],
    },
    {
      title: 'Hostel and Mess',
      year: `AY ${publicFacts.accommodationFees?.academicYear || publicFacts.academicFees.academicYear}`,
      image: matchesFeeSnapshot('hostel', publicFacts.accommodationFees.academicYear, [publicFacts.accommodationFees.hostel, publicFacts.accommodationFees.refundableDeposit, hostelTotalAmount, messTotalAmount]) ? hostelMessFeeImage : null,
      rows: [
        `Hostel fee: INR ${(publicFacts.accommodationFees.hostel).toLocaleString('en-IN')}`,
        `Refundable deposit: INR ${(publicFacts.accommodationFees.refundableDeposit).toLocaleString('en-IN')}`,
        `Hostel total: INR ${hostelTotalAmount.toLocaleString('en-IN')}`,
        `Mess fee per year: INR ${messTotalAmount.toLocaleString('en-IN')}`,
      ],
    },
  ];

  return <div className="pageStack"><div className="sectionHead"><span className="eyebrow">Fee Planner</span><h2>Estimate what to confirm before reporting.</h2><p>Select admission route and category to get an estimated payable amount before visiting campus.</p></div><section className="decisionPanel"><div><div className="sectionHead"><span className="eyebrow">Estimate calculator</span><h2>{formatCurrency(total)}</h2></div><div className="decisionForm"><label>Admission type<select value={estimate.admission} onChange={(event) => updateEstimate('admission', event.target.value)}><option value="fy">First Year Engineering</option><option value="dse">Direct Second Year</option></select></label><label>Category<select value={estimate.category} onChange={(event) => updateEstimate('category', event.target.value)}><option value="open">Open / OMS</option><option value="boys">Open EBC/EWS/OBC/SEBC Boys</option><option value="girls">Girls</option><option value="vjnt">VJNT / SBC / TFWS</option><option value="scst">SC / ST</option></select></label><label>Hostel<select value={estimate.hostel} onChange={(event) => updateEstimate('hostel', event.target.value)}><option value="no">No</option><option value="yes">Yes</option></select></label><label>Mess<select value={estimate.mess} onChange={(event) => updateEstimate('mess', event.target.value)}><option value="no">No</option><option value="yes">Yes</option></select></label></div></div><div className="decisionResult positive"><span className="eyebrow">Current estimate</span><div className="stepRow compact"><CheckCircle2 size={17} /> Academic fee: {formatCurrency(academic)}</div><div className="stepRow compact"><CheckCircle2 size={17} /> Hostel: {formatCurrency(hostel)}</div><div className="stepRow compact"><CheckCircle2 size={17} /> Mess: {formatCurrency(mess)}</div><strong>Total: {formatCurrency(total)}</strong></div></section><section className="panelBlock"><div className="sectionHead"><span className="eyebrow">Scholarship connection</span><h2>Check concession documents before payment.</h2><p>{scholarshipHint}</p></div><div className="workflowActions"><button type="button" onClick={() => setView('scholarships')}>Check scholarship readiness <ArrowRight size={16} /></button><a href="https://www.mitcorer.edu.in/Admissions-Open-2026-27.html" target="_blank" rel="noreferrer">Check required documents <ArrowRight size={16} /></a><a href="https://mahafra.org/" target="_blank" rel="noreferrer">Verify approved fees on FRA <ArrowRight size={16} /></a><a href="https://mitcorer.edu.in/contact.php" target="_blank" rel="noreferrer">Contact admission office <ArrowRight size={16} /></a></div></section>{displayFeeRecords.map((record) => <section className="feeRecord" key={record.title}><div><span className="eyebrow">{record.year}</span><h3>{record.title}</h3><ul>{record.rows.map((row) => <li key={row}>{row}</li>)}</ul></div>{record.image && <img src={record.image} alt={`${record.title} fee table`} />}</section>)}</div>;
}

function ScholarshipAid({ initial, onSave = () => {} }) {
  const [profile, setProfile] = useState({
    category: 'obc',
    income: 'under8',
    hostel: 'yes',
    admission: 'firstYear',
    gender: 'girl',
    route: 'cap',
    ...(initial || {}),
  });
  const updateProfile = (key, value) => { const next = { ...profile, [key]: value }; setProfile(next); onSave(next); };
  const pragatiDocuments = profile.gender === 'girl' && profile.income === 'under8'
    ? ['10th / 12th marksheet as applicable', 'Admission letter or institute-level allotment / merit proof', 'Institute certificate', 'Tuition fee receipt', 'Aadhaar-seeded student bank passbook', 'Aadhaar card', 'Parent declaration']
    : [];
  const selectedDocs = [...new Set([...(scholarshipDocuments[profile.category] || scholarshipDocuments.open), ...pragatiDocuments])];
  const likelyScholarships = getLikelyScholarships(profile);
  return (
    <div className="pageStack scholarshipPage">
      <div className="sectionHead"><span className="eyebrow">Scholarship Aid</span><h2>Find likely scholarship routes from student profile.</h2><p>Select the profile to see which scholarship or concession route may fit and which documents should be prepared.</p></div>
      <section className="decisionPanel">
        <div className="decisionForm">
          <label>Admission type<select value={profile.admission} onChange={(event) => updateProfile('admission', event.target.value)}><option value="firstYear">First Year Engineering</option><option value="dse">Direct Second Year</option><option value="polytechnic">Polytechnic</option></select></label>
          <label>Admission route<select value={profile.route || 'cap'} onChange={(event) => updateProfile('route', event.target.value)}><option value="cap">CAP / centralized admission</option><option value="nonCap">Institute-level / non-CAP</option></select></label>
          <label>Student gender<select value={profile.gender || 'girl'} onChange={(event) => updateProfile('gender', event.target.value)}><option value="girl">Girl</option><option value="boy">Boy</option><option value="other">Other / prefer not to say</option></select></label>
          <label>Category / claim<select value={profile.category} onChange={(event) => updateProfile('category', event.target.value)}><option value="open">Open / OMS</option><option value="ews">EWS / EBC</option><option value="obc">OBC / SEBC</option><option value="vjnt">VJNT / SBC</option><option value="scst">SC / ST</option><option value="minority">Minority</option></select></label>
          <label>Family income<select value={profile.income} onChange={(event) => updateProfile('income', event.target.value)}><option value="under8">Up to 8 lakh</option><option value="over8">Above 8 lakh / not claiming</option></select></label>
          <label>Hostel needed<select value={profile.hostel} onChange={(event) => updateProfile('hostel', event.target.value)}><option value="yes">Yes</option><option value="no">No</option><option value="unsure">Not decided</option></select></label>
        </div>
        <div className="decisionResult scholarshipDocuments">
          <span className="eyebrow">Required document checklist</span>
          {selectedDocs.map((item) => <div className="stepRow compact" key={item}><CheckCircle2 size={17} /> {item}</div>)}
        </div>
      </section>
      <section className="panelBlock">
        <div className="sectionHead"><span className="eyebrow">Likely applicable routes</span><h2>Based on selected situation</h2></div>
        <div className="ruleGrid">{likelyScholarships.map((item) => <div key={item.title}><strong>{item.title}</strong><p>{item.reason}</p></div>)}</div>
        <p className="warningText"><ShieldCheck size={16} /> This is guidance for preparation. Final eligibility depends on official scheme rules and document verification.</p>
        <div className="workflowActions"><a href="https://mahadbt.maharashtra.gov.in/login/login" target="_blank" rel="noreferrer">Apply through MahaDBT <ArrowRight size={16} /></a><a href="https://scholarships.gov.in/All-Scholarships" target="_blank" rel="noreferrer">Check Pragati on NSP <ArrowRight size={16} /></a><a href="https://www.mitcorer.edu.in/scholarship.php" target="_blank" rel="noreferrer">MITCORER scholarship list <ArrowRight size={16} /></a><a href="https://mitcorer.edu.in/contact.php" target="_blank" rel="noreferrer">Contact scholarship desk <ArrowRight size={16} /></a></div>
      </section>
      <div className="visitGrid">
      <section className="panelBlock">
        <div className="sectionHead"><span className="eyebrow">Scheme groups</span><h2>Scholarships listed for admission guidance</h2></div>
        {scholarshipSchemes.map((scheme) => <div className="stepRow" key={scheme}><HandCoins size={17} /> {scheme}</div>)}
      </section>
      <section className="panelBlock">
        <div className="sectionHead"><span className="eyebrow">Document purpose</span><h2>Why each proof matters</h2></div>
        <div className="compactList">{scholarshipChecklist.map(([label, text]) => <div key={label}><strong>{label}</strong><span>{text}</span></div>)}</div>
      </section>
      </div>
    </div>
  );
}

function CareerOutcomes({ setView }) {
  const [branch, setBranch] = useState('Computer Science and Engineering');
  const outcome = branchCareerOutcomes[branch];
  return (
    <div className="pageStack careerPage">
      <div className="placementHero"><div><span className="eyebrow">Career & Placement</span><h2>From admission to a placement opportunity</h2><p>Understand how students prepare, discover opportunities, register for drives, and verify MITCORER placement outcomes.</p></div><a href="https://www.mitcorer.edu.in/placement-committee.php" target="_blank" rel="noreferrer">Contact placement cell <ArrowRight size={16} /></a></div>
      <section className="placementJourney"><article><span>1</span><div><h3>Build your profile</h3><p>Keep academics, resume, projects, skills, and communication evidence ready.</p></div></article><article><span>2</span><div><h3>Become placement-ready</h3><p>Use Preskilet for video-profile, communication, proof-of-work, and recruiter-oriented activities.</p></div></article><article><span>3</span><div><h3>Find and register</h3><p>Use POD.AI and official TPO communication for job descriptions, eligibility, registrations, dates, and updates.</p></div></article><article><span>4</span><div><h3>Complete the drive</h3><p>Attend tests, interviews, and selection stages; follow the company criteria and placement policy.</p></div></article></section>
      <section className="placementPlatformGrid">{placementPlatforms.map((platform) => <article key={platform.name}><div><span>Student platform</span><h2>{platform.name}</h2><p>{platform.purpose}</p></div><ul>{platform.details.map((item) => <li key={item}>{item}</li>)}</ul><a href={platform.url} target="_blank" rel="noreferrer">Open official platform <ArrowRight size={15} /></a></article>)}</section>
      <section className="branchExplorer">
        <label>Choose the branch you are considering<select value={branch} onChange={(event) => setBranch(event.target.value)}>{courses.map((course) => <option key={course.choiceCode} value={course.name}>{course.name}</option>)}</select></label>
        <div className="branchOutcomeColumns"><div><span>Possible career directions</span><h2>{branch}</h2><ul>{outcome.roles.map((item) => <li key={item}>{item}</li>)}</ul></div><div><span>What the student should prepare</span><h2>Skills and exposure</h2><ul>{outcome.skills.map((item) => <li key={item}>{item}</li>)}</ul></div></div>
        <p className="careerDisclaimer">These are possible directions, not guaranteed jobs. Actual eligibility depends on the recruiter, student skills, academic performance, and market conditions.</p>
      </section>
      <section className="placementEvidence"><div className="sectionHead"><span className="eyebrow">Official 2024-25 record</span><h2>Placement and internship snapshot</h2><p>Period-specific figures from MITCORER's published Placement/Internship Statistics 2024–25. They should not be combined with lifetime promotional totals.</p></div><div className="reportGrid">{placementSignals.map(([label, value]) => <article key={label}><span>{label}</span><strong>{value}</strong></article>)}</div><div className="placementTable"><div><strong>Branch</strong><strong>Students</strong><strong>Internships</strong><strong>Placed</strong></div>{branchPlacementRecords.map((row) => <div key={row[0]}>{row.map((value) => <span key={value}>{value}</span>)}</div>)}</div><div className="evidenceLinks"><a href="https://www.mitcorer.edu.in/pdf/Placement_Internship_statistics_2024-2025.pdf" target="_blank" rel="noreferrer">Open official 2024-25 record <ArrowRight size={15} /></a><a href="https://mitcorer.edu.in/" target="_blank" rel="noreferrer">View current college highlights <ArrowRight size={15} /></a></div></section>
      <section className="placementEvidence"><div className="sectionHead"><span className="eyebrow">Recruiter context</span><h2>Companies highlighted in college admission material</h2><p>Presence in published material does not mean every company recruits every branch or visits every year.</p></div><div className="facilityList">{recruiters.map((item) => <span key={item}>{item}</span>)}</div></section>
      <section className="placementQuestions"><div><h2>Before taking admission, ask the TPO:</h2><ul><li>Show the latest branch-wise eligible, placed, internship, and offer counts.</li><li>Which opportunities are currently posted through POD.AI?</li><li>How will students be onboarded and assessed through Preskilet?</li><li>Which training begins in first year, and which activities are compulsory?</li><li>Are package figures college-wide, branch-specific, or single-student outcomes?</li></ul></div><div className="workflowActions"><a href="https://www.mitcorer.edu.in/placement-committee.php" target="_blank" rel="noreferrer">Contact placement cell <ArrowRight size={16} /></a><button type="button" onClick={() => setView('programs')}>Compare programs</button></div></section>
    </div>
  );
}

function HostelMess({ initial, onSave = () => {}, setView, publicFacts }) {
  const [plan, setPlan] = useState(Object.keys(initial || {}).length ? initial : { hostel: 'yes', mess: 'yes', transport: 'no' });
  const updatePlan = (key, value) => { const next = { ...plan, [key]: value }; setPlan(next); onSave(next); };
  if (!publicFacts?.accommodationFees) return <section className="panelBlock" role="status"><h2>Maintained accommodation fees are unavailable</h2><p>Please confirm hostel, deposit and mess charges with the college.</p></section>;
  const hostelFeeTotal = publicFacts.accommodationFees.hostelTotal;
  const messFeeAnnual = publicFacts.accommodationFees.messAnnual;
  const hostelTotal = plan.hostel === 'yes' ? hostelFeeTotal : 0;
  const messTotal = plan.mess === 'yes' ? messFeeAnnual : 0;
  const stayTotal = hostelTotal + messTotal;
  const formatCurrency = (amount) => `INR ${amount.toLocaleString('en-IN')}`;
  const displayHostelDetails = [
    ['Hostel fee', `INR ${(publicFacts.accommodationFees.hostel).toLocaleString('en-IN')}`],
    ['Refundable deposit', `INR ${(publicFacts.accommodationFees.refundableDeposit).toLocaleString('en-IN')}`],
    ['Hostel total', `INR ${hostelFeeTotal.toLocaleString('en-IN')}`],
    ['Mess fee per year', `INR ${messFeeAnnual.toLocaleString('en-IN')}`],
  ];
  return (
    <div className="pageStack">
      <div className="sectionHead"><span className="eyebrow">Hostel & Mess</span><h2>Check stay and meal planning before reporting.</h2><p>Estimate stay cost and confirm availability, rules, and payment process before travelling.</p></div>
      <section className="decisionPanel">
        <div className="decisionForm">
          <label>Hostel needed<select value={plan.hostel} onChange={(event) => updatePlan('hostel', event.target.value)}><option value="yes">Yes</option><option value="no">No</option></select></label>
          <label>Mess needed<select value={plan.mess} onChange={(event) => updatePlan('mess', event.target.value)}><option value="yes">Yes</option><option value="no">No</option></select></label>
          <label>Bus/transport query<select value={plan.transport} onChange={(event) => updatePlan('transport', event.target.value)}><option value="no">No</option><option value="yes">Yes</option></select></label>
        </div>
        <div className="decisionResult positive">
          <span className="eyebrow">Stay cost estimate</span>
          <strong>{formatCurrency(stayTotal)}</strong>
          <p>Hostel: {formatCurrency(hostelTotal)}<br />Mess: {formatCurrency(messTotal)}{plan.transport === 'yes' ? <><br />Bus route and charges should be confirmed with staff.</> : null}</p>
        </div>
      </section>
      <div className="reportGrid">{displayHostelDetails.map(([label, value]) => <article key={label}><span>{label}</span><strong>{value}</strong></article>)}</div>
      <div className="visitGrid"><section className="panelBlock"><div className="sectionHead"><span className="eyebrow">Confirm before admission</span><h2>Stay decision checklist</h2></div>{hostelConfirmations.map((item) => <div className="stepRow" key={item}><CheckCircle2 size={17} /> {item}</div>)}</section><section className="panelBlock"><div className="sectionHead"><span className="eyebrow">Campus facilities</span><h2>Useful infrastructure</h2></div><div className="facilityList">{facilities.map((item) => <span key={item}>{item}</span>)}</div><p className="warningText"><ShieldCheck size={16} /> Final room availability, rules, and payment process should be confirmed by admission/hostel staff.</p></section></div>
      <section className="panelBlock"><div className="sectionHead"><span className="eyebrow">Continue</span><h2>Confirm current availability with the college.</h2></div><div className="workflowActions"><a href="https://mitcorer.edu.in/contact.php" target="_blank" rel="noreferrer">Contact campus office <ArrowRight size={16} /></a><button type="button" onClick={() => setView('fees')}>Include stay cost in fee plan</button></div></section>
    </div>
  );
}


function KnowledgeManager({ items, sources, onCreate, onUpdate, onUploadSource, onOpenSource, onReviewSource, onPublishSource, onSyncWebsite, onExtractStructuredSource }) {
  const [cdmExtracting, setCdmExtracting] = useState(false);
  const [cdmNotice, setCdmNotice] = useState('');
  const managedUsage = { 'KB-2': 'Public academic fee answers use this record.', 'KB-3': 'Public hostel and mess fee answers use this record.', 'KB-10': 'Public B.Tech intake answers use this record.', 'KB-6': 'Historical seat matrix answers use this record.' };
  const [editing, setEditing] = useState(null);
  const [creating, setCreating] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState('');
  const [form, setForm] = useState({ title: '', category: 'Admissions', source: 'Admin verified source', text: '', status: 'Published' });
  const [sourceForm, setSourceForm] = useState({ title: '', documentType: 'Eligibility', academicYear: '2026-27', sourceAuthority: 'MITCORER / Maharashtra CET Cell', verifiedText: '' });
  const [sourceFile, setSourceFile] = useState(null);
  const [review, setReview] = useState(null);
  const update = (key, value) => setForm((item) => ({ ...item, [key]: value }));
  const updateSource = (key, value) => setSourceForm((item) => ({ ...item, [key]: value }));
  const submit = async (event) => {
    event.preventDefault();
    if (!form.title.trim() || !form.text.trim()) return;
    if (creating) return;
    setCreating(true);
    try {
      const saved = await onCreate(form);
      if (saved) setForm({ title: '', category: 'Admissions', source: 'Admin verified source', text: '', status: 'Published' });
    } finally { setCreating(false); }
  };
  const submitSource = async (event) => {
    event.preventDefault();
    if (!sourceFile || !sourceForm.title.trim()) return;
    const saved = await onUploadSource(sourceForm, sourceFile);
    if (saved) {
      setSourceForm({ title: '', documentType: 'Eligibility', academicYear: '2026-27', sourceAuthority: 'MITCORER / Maharashtra CET Cell', verifiedText: '' });
      setSourceFile(null);
      event.currentTarget.reset();
    }
  };
  const openReview = async (source) => {
    const result = await onReviewSource(source.id);
    if (result) setReview({ id: source.id, title: source.title, text: result.extractedText || '', status: result.extractionStatus });
  };
  const publishReview = async (event) => {
    event.preventDefault();
    if (!review?.text.trim()) return;
    const saved = await onPublishSource(review.id, review.text);
    if (saved) setReview(null);
  };
  const handleSync = async () => {
    if (syncing || !onSyncWebsite) return;
    setSyncing(true);
    setSyncStatus('');
    try {
      const summary = await onSyncWebsite();
      if (summary) {
        setSyncStatus(`Website sync complete: ${summary.checked} pages inspected, ${summary.changed} staged for review, ${summary.unchanged} unchanged.`);
      }
    } finally {
      setSyncing(false);
    }
  };
  return (
    <div className="pageStack">
      <div className="sectionHead"><span className="eyebrow">Official source library</span><h2>Documents and verified admission knowledge</h2><p>Upload institutional sources here or synchronize directly with the official college website. Staged pages require admin review before publication.</p></div>
      <div className="workflowActions" style={{ marginBottom: '1rem' }}>
        <button className="inlineAction secondary" type="button" disabled={syncing} onClick={handleSync}>
          <RefreshCw size={16} /> {syncing ? 'Inspecting college website…' : 'Sync college website'}
        </button>
      </div>
      {syncStatus && <div className="decisionResult positive" style={{ marginBottom: '1rem' }}><strong>{syncStatus}</strong></div>}
      <section className="formBlock">
        <form onSubmit={submitSource}>
          <label>Document title<input value={sourceForm.title} onChange={(event) => updateSource('title', event.target.value)} placeholder="Example: CAP Round I cutoff 2025" /></label>
          <label>Document type<select value={sourceForm.documentType} onChange={(event) => updateSource('documentType', event.target.value)}><option>Eligibility</option><option>Cutoff</option><option>Seat Matrix</option><option>Admissions</option><option>Fees</option><option>Scholarship</option><option>Programs</option><option>Facilities</option><option>Placement</option><option>Calendar</option></select></label>
          <label>Academic year<input value={sourceForm.academicYear} onChange={(event) => updateSource('academicYear', event.target.value)} placeholder="2026-27" /></label>
          <label>Source authority<input value={sourceForm.sourceAuthority} onChange={(event) => updateSource('sourceAuthority', event.target.value)} placeholder="MITCORER or Maharashtra CET Cell" /></label>
          <label className="wide">Official file<input type="file" accept=".pdf,.docx,.xlsx,.csv,.txt,image/png,image/jpeg" onChange={(event) => setSourceFile(event.target.files?.[0] || null)} /></label>
          <label className="wide">Verified extracted text (optional)<textarea rows={4} value={sourceForm.verifiedText} onChange={(event) => updateSource('verifiedText', event.target.value)} placeholder="Paste the reviewed eligibility rule, cutoff row, seat matrix, fee notice, or policy text. Leaving this empty stores the source for later extraction and review." /></label>
          <button type="submit" disabled={!sourceFile || !sourceForm.title.trim()}><UploadCloud size={17} /> Upload official source</button>
        </form>
      </section>
      <div className="tableWrap sourceTable">
        <table>
          <thead><tr><th>Source</th><th>Type</th><th>Academic year</th><th>Authority</th><th>Extraction</th><th>Status</th><th>File</th></tr></thead>
          <tbody>{sources.map((item) => <tr key={item.id}><td><strong>{item.title}</strong><br /><span>{item.originalFileName}</span></td><td>{item.documentType}</td><td>{item.academicYear}</td><td>{item.sourceAuthority}</td><td>{item.extractionStatus}</td><td>{item.status}</td><td>{item.storedFileName ? <button className="miniEditBtn" type="button" onClick={() => onOpenSource(item.id)}>Open file</button> : item.sourceUrl ? <a className="miniEditBtn sourceReference" href={item.sourceUrl} target="_blank" rel="noreferrer">Open source</a> : 'Reference only'} {item.status !== 'Published' && <button className="miniEditBtn" type="button" onClick={() => openReview(item)}>Review text</button>}</td></tr>)}</tbody>
        </table>
      </div>
      {review && (
        <section className="formBlock">
          <div className="sectionHead">
            <span className="eyebrow">Source review</span>
            <h2>{review.title}</h2>
            <p>{review.status}</p>
          </div>
          {cdmNotice && <div className="decisionResult positive" style={{ marginBottom: '1rem' }}><strong>{cdmNotice}</strong></div>}
          <div style={{ marginBottom: '0.75rem' }}>
            <button
              className="inlineAction secondary"
              type="button"
              disabled={cdmExtracting}
              onClick={async () => {
                if (!review?.id || !onExtractStructuredSource) return;
                setCdmExtracting(true);
                setCdmNotice('');
                try {
                  const result = await onExtractStructuredSource(review.id);
                  const facts = result?.structuredFacts;
                  if (facts?.keyFacts?.length) {
                    const lines = facts.keyFacts.map((f) => `[${f.category || 'Facts'}] ${f.title}: ${f.text}`).join('\n\n');
                    setReview((prev) => ({
                      ...prev,
                      text: prev.text ? `${prev.text.trim()}\n\n--- CDM Structured Facts ---\n${lines}` : lines,
                    }));
                    setCdmNotice(`Extracted ${facts.keyFacts.length} structured facts via CDM schema!`);
                  } else {
                    setCdmNotice('CDM returned no structured keyFacts.');
                  }
                } catch (err) {
                  setCdmNotice(`CDM extraction failed: ${err.message}`);
                } finally {
                  setCdmExtracting(false);
                }
              }}
            >
              <Cpu size={16} /> {cdmExtracting ? 'Extracting via CDM…' : 'Auto-extract structured facts (CDM)'}
            </button>
          </div>
          <form onSubmit={publishReview}>
            <label className="wide">
              Verified text for retrieval
              <textarea
                rows={9}
                value={review.text}
                onChange={(event) => setReview((item) => ({ ...item, text: event.target.value }))}
                placeholder="No text was extracted. Paste the reviewed official text before publishing."
              />
            </label>
            <button type="submit" disabled={!review.text.trim()}><CheckCircle2 size={17} /> Publish verified knowledge</button>
            <button className="miniEditBtn" type="button" onClick={() => { setReview(null); setCdmNotice(''); }}>Cancel</button>
          </form>
        </section>
      )}
      <div className="sectionHead"><span className="eyebrow">Knowledge records</span><h2>Reviewed text available to retrieval</h2></div>
      <section className="formBlock">
        <form onSubmit={submit}>
          <label>Title<input value={form.title} onChange={(event) => update('title', event.target.value)} placeholder="Example: CAP 2026 reporting rules" /></label>
          <label>Category<select value={form.category} onChange={(event) => update('category', event.target.value)}><option>Admissions</option><option>Eligibility</option><option>Cutoff</option><option>Seat Matrix</option><option>Documents</option><option>Fees</option><option>Scholarship</option><option>Facilities</option><option>Programs</option><option>Placement</option></select></label>
          <label className="wide">Source<input value={form.source} onChange={(event) => update('source', event.target.value)} placeholder="Official brochure / website / notice" /></label>
          <label>Status<select value={form.status} onChange={(event) => update('status', event.target.value)}><option>Published</option><option>Review</option><option>Archived</option></select></label>
          <label className="wide">Verified text<textarea rows={5} value={form.text} onChange={(event) => update('text', event.target.value)} placeholder="Paste concise verified admission information..." /></label>
          <button type="submit" disabled={creating}>{creating ? 'Saving…' : 'Add knowledge record'} <ArrowRight size={16} /></button>
        </form>
      </section>
      {editing && <KnowledgeRecordEditor key={editing.id} record={editing} onSave={onUpdate} onCancel={() => setEditing(null)} />}
      <div className="knowledgeGrid">{items.map((item) => <article key={item.id}><span className="eyebrow">{item.category}</span><h3>{item.title}</h3>{managedUsage[item.id] && <small>{managedUsage[item.id]}</small>}<p>{item.text}</p><footer>{item.source} · {item.status}</footer><button type="button" disabled={Boolean(editing)} onClick={() => setEditing(item)}>Edit record</button></article>)}</div>
    </div>
  );
}


export default App;
