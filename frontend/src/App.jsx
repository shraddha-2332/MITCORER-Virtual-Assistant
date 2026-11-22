import { Fragment, useEffect, useLayoutEffect, useRef, useState } from 'react';
import {
  ArrowLeft, ArrowRight, CheckCircle2, Cpu, FileText, LayoutDashboard,
  LockKeyhole, LogOut, Menu, Phone,
  Send, ShieldCheck, UploadCloud, X,
  PanelLeftClose, PanelLeftOpen, Languages, RefreshCw,
  ThumbsDown, ThumbsUp,
} from 'lucide-react';
import feeFirstYearImage from './assets/fee-first-year-2026.jpeg';
import feeDirectSecondYearImage from './assets/fee-direct-second-year-2026.jpeg';
import hostelMessFeeImage from './assets/hostel-mess-fee-2026.jpeg';
import mitcorerLogo from './assets/mitcorer-logo.png';
import mitcorerCampus from './assets/mitcorer-campus.webp';
import { api } from './api.js';
import { AssistantOperations } from './AssistantOperations.jsx';
import { AssistantAnalytics } from './AssistantAnalytics.jsx';
import { formatPublicResponse } from './answer-format.mjs';
import { publicAnswerLinks } from './public-answer-links.mjs';
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




function App() {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState('');
  const [view, setView] = useState('overview');
  const [viewHistory, setViewHistory] = useState([]);
  const [navOpen, setNavOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => localStorage.getItem('mitra.sidebarCollapsed') === 'true');
  const [knowledge, setKnowledge] = useState([]);
  const [officialSources, setOfficialSources] = useState([]);
  const [knowledgeInitialTab, setKnowledgeInitialTab] = useState('records');
  const [knowledgeInitialSearch, setKnowledgeInitialSearch] = useState('');
  const [reviewInitialTab, setReviewInitialTab] = useState('inquiries');
  const [appError, setAppError] = useState('');

  const navigateTo = (nextView, recordId = '') => {
    if (!nextView || nextView === view) return;
    if (nextView === 'knowledge') setKnowledgeInitialSearch(recordId);
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
      const [knowledgeResult, sourceResult] = await Promise.all([
        api.getKnowledge(authToken).catch(() => ({ items: [] })),
        api.getOfficialSources(authToken).catch(() => ({ items: [] })),
      ]);
      setKnowledge(knowledgeResult.items || []);
      setOfficialSources(sourceResult.items || []);
    } catch (error) {
      setAppError(error.message);
    }
  };

  useEffect(() => {
    let active = true;
    const restoreSession = async () => {
      try {
        const payload = await api.refresh();
        if (!active) return;
        setToken(payload.token);
        setView('overview');
        setViewHistory([]);
        if (['staff', 'admin'].includes(payload.user.role)) await refreshWorkspaceData(payload.token);
        if (active) setUser(payload.user);
      } catch {
        // No active session cookie is the normal state for a visitor.
      }
    };
    restoreSession();
    return () => { active = false; };
  }, []);

  const logout = async () => {
    await api.logout().catch(() => {});
    setNavOpen(false);
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
        return saved;
    } catch (error) {
      setAppError(error.message);
    }
  };

  const updateKnowledgeItem = async (id, changes) => {
    setAppError('');
    try {
      const saved = await api.updateKnowledge(token, id, changes);
      setKnowledge((items) => items.map((item) => item.id === id ? saved : item));
      return saved;
    } catch (error) {
      setAppError(error.message);
      return null;
    }
  };

  const deleteKnowledgeItem = async (id, expectedRevision) => {
    setAppError('');
    try {
      await api.deleteKnowledge(token, id, { expectedRevision });
      setKnowledge((items) => items.filter((item) => item.id !== id));
      return true;
    } catch (error) {
      setAppError(error.message);
      return false;
    }
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

  const publishOfficialSource = async (id, verifiedText, resolveConflicts, expectedRevision) => {
    setAppError('');
    try {
      const saved = await api.publishOfficialSource(token, id, verifiedText, resolveConflicts, expectedRevision);
      setOfficialSources((items) => items.map((item) => (item.id === id ? saved : item)));
      const knowledgeResult = await api.getKnowledge(token);
      setKnowledge(knowledgeResult.items || []);
        return saved;
    } catch (error) {
      setAppError(error.message);
      return null;
    }
  };

  const handleAdminLogin = async (email, password) => {
    setAppError('');
    const payload = await api.login({ email, password });
    if (!['admin', 'staff'].includes(payload.user.role)) {
      await api.logout().catch(() => {});
      throw new Error('This account does not have access to the administrator portal.');
    }
    setToken(payload.token);
    setView('overview');
    setViewHistory([]);
    await refreshWorkspaceData(payload.token);
    setUser(payload.user);
  };

  const handleApplicantPortalAuth = async ({ mode, name, email, password, role, admissionRoute }) => {
    const payload = mode === 'signup'
      ? await api.signup({ name, email, password, role, admissionRoute })
      : await api.login({ email, password });
    if (!['applicant', 'parent'].includes(payload.user.role)) {
      await api.logout().catch(() => {});
      throw new Error('Use an applicant or parent account to save a checklist.');
    }
    setToken(payload.token);
    setUser(payload.user);
    return true;
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

  if (!user || ['applicant', 'parent'].includes(user.role)) {
    return <PublicAssistantWidget signedIn={Boolean(user)} token={token} onLogout={logout} onAdminLogin={handleAdminLogin} onApplicantPortalAuth={handleApplicantPortalAuth} />;
  }

  return (
    <div className="appShell">
      <Sidebar user={user} view={view} setView={navigateTo} navOpen={navOpen} setNavOpen={setNavOpen} collapsed={sidebarCollapsed} setCollapsed={setSidebarCollapsed} onLogout={logout} />
      <main className="workspace">
        <Header user={user} setNavOpen={setNavOpen} canGoBack={viewHistory.length > 0} onBack={returnToPreviousView} />
        {navOpen && <button className="mobileScrim" type="button" aria-label="Close navigation" onClick={() => setNavOpen(false)}><X size={18} /></button>}
        <section className="workspaceBody">
          {appError && <div className="errorBanner">{appError}</div>}
          {view === 'overview' && <AdminOverview user={user} token={token} knowledge={knowledge} sources={officialSources} setView={navigateTo} onOpenSources={() => { setKnowledgeInitialTab('sources'); navigateTo('knowledge'); }} onOpenKnowledge={() => { setKnowledgeInitialTab('records'); navigateTo('knowledge'); }} onOpenKnowledgeRecord={(id) => { setKnowledgeInitialTab('records'); navigateTo('knowledge', id); }} onOpenInquiries={() => { setReviewInitialTab('inquiries'); navigateTo('inquiries'); }} onOpenFeedback={() => { setReviewInitialTab('feedback'); navigateTo('inquiries'); }} />}
          {view === 'knowledge' && <KnowledgeManager canDeleteKnowledge={user.role === 'admin'} initialTab={knowledgeInitialTab} initialSearch={knowledgeInitialSearch} items={knowledge} sources={officialSources} onCreate={createKnowledgeItem} onUpdate={updateKnowledgeItem} onDelete={deleteKnowledgeItem} onUploadSource={uploadOfficialSource} onOpenSource={openOfficialSource} onReviewSource={reviewOfficialSource} onPublishSource={publishOfficialSource} onExtractStructuredSource={extractStructuredOfficialSource} />}
          {view === 'inquiries' && <ReviewInbox token={token} initialTab={reviewInitialTab} />}
          {view === 'analytics' && <AssistantAnalytics token={token} />}
          {view === 'applicant-workspaces' && <ApplicantWorkspaceReview token={token} />}
        </section>
      </main>
    </div>
  );
}

function PublicAssistantWidget({ signedIn, token, onLogout, onAdminLogin, onApplicantPortalAuth }) {
  const [showAdminLogin, setShowAdminLogin] = useState(() => {
    try {
      return typeof window !== 'undefined' && (new URLSearchParams(window.location.search).has('admin') || window.location.hash === '#admin');
    } catch { return false; }
  });
  const [adminEmail, setAdminEmail] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [adminLoggingIn, setAdminLoggingIn] = useState(false);
  const [adminLoginError, setAdminLoginError] = useState('');
  const [showApplicantPortal, setShowApplicantPortal] = useState(false);
  const [showChecklist, setShowChecklist] = useState(false);
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
    { type: 'assistant', text: 'Hi, I’m MITRA. How can I help with admissions?' },
  ]);
  const quickReplies = [
    { label: 'CAP admission', prompt: 'Where are you in the CAP process?', choices: [
      { label: 'How CAP works', question: 'What is the CAP admission process for MITCORER?' },
      { label: 'I have an allotment', prompt: 'Which programme route were you allotted through CAP?', choices: [
        { label: 'First Year B.Tech', question: 'I got MITCORER in CAP for First Year B.Tech. What do I do now?' },
        { label: 'Direct Second Year B.Tech', question: 'I got MITCORER in CAP for Direct Second Year B.Tech. What do I do now?' },
        { label: 'Polytechnic', question: 'I got MITCORER in CAP for Polytechnic. What do I do now?' },
        { label: 'More', action: 'main' },
      ] },
      { label: 'More', action: 'main' },
    ] },
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
    { label: 'Required Documents', question: 'What are the required admission documents?' },
    { label: 'Facilities', choices: [
      { label: 'Hostel & mess', question: 'What hostel and mess facilities does MITCORER provide?' },
      { label: 'Bus facility', question: 'What MITCORER bus facility information is published?' },
      { label: 'Library', question: 'Tell me about the MITCORER library and digital resources.' },
      { label: 'Labs & workshops', question: 'What laboratories and workshops does MITCORER have?' },
      { label: 'Railway model room', question: 'Tell me about the MITCORER railway model room.' },
      { label: 'Campus facilities', question: 'What campus facilities are available at MITCORER?' },
      { label: 'Back to main topics', action: 'main' },
    ] },
    { label: 'Contact us', question: 'What are the MITCORER admission contact details?' },
    { label: 'More topics', prompt: 'What else would you like to ask about?', choices: [
      { label: 'Scholarships', prompt: 'Which category should I use to narrow the scholarship list?', choices: [
        ...['Open / EBC', 'EWS', 'SEBC', 'OBC', 'SC', 'ST', 'VJNT / SBC', 'Other or unsure'].map(label => {
          const profile = label === 'Other or unsure' ? 'an unspecified category' : `the ${label} category`;
          const question = `Which scholarship schemes should a student in ${profile} check at MITCORER`;
          return { label, prompt: 'Would you like to include schemes for girls?', choices: [
            { label: 'Include schemes for girls', question: `${question}, including schemes for girls?` },
            { label: 'Show category schemes', question: `${question}?` },
            { label: 'Back to main topics', action: 'main' },
          ] };
        }),
        { label: 'View all schemes', question: 'What scholarships are available at MITCORER and where can I apply?' },
        { label: 'Back to main topics', action: 'main' },
      ] },
      { label: 'Placements', question: 'What placement support and published placement highlights does MITCORER offer?' },
      { label: 'About MITCORER', question: 'Tell me about MITCORER.' },
      { label: 'Why MITCORER?', question: 'Why should I choose MITCORER?' },
      { label: 'Admission checklist', action: 'checklist' },
      { label: 'Back to main topics', action: 'main' },
    ] },
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
      { type: 'assistant', text: 'Hi, I’m MITRA. How can I help with admissions?' },
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
          sourceLinks: answer.sourceLinks,
          relatedLinks: answer.relatedLinks,
          officialLinks: answer.officialLinks,
          evidence: answer.evidence,
          sections: answer.sections,
          actionView: answer.actionView,
          requestedLanguage: answer.requestedLanguage,
          responseLanguage: answer.responseLanguage,
          showQuickReplies: !answer.answerPart2,
          choices: retainedChoices || undefined,
          suggestions: answer.suggestions,
          escalation: answer.escalation,
          clarification: answer.clarification,
          outcomeStatus: answer.outcomeStatus,
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
      setMessages((items) => [...items, { type: 'assistant', text: failure, choices: retainedChoices || undefined, retryQuestion: question }]);
    } finally {
      setBusy(false);
    }
  };

  const selectTopic = (topic) => {
    if (topic.action === 'checklist') {
      setShowChecklist(true);
      return;
    }
    if (topic.action === 'main') {
      setActivePills(null);
      setMessages((items) => [...items, { type: 'assistant', text: 'What else would you like to know about MITCORER?', choices: null }]);
      return;
    }
    if (topic.choices) {
      setActivePills(topic.choices);
      setMessages((items) => [...items,
        { type: 'user', text: topic.label },
        { type: 'assistant', text: topic.prompt || `Please select a ${topic.label.toLowerCase()} option.`, choices: topic.choices },
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
        <div className="publicChatMessages" role="log" aria-live="polite" aria-relevant="additions" aria-label="Conversation">
          <div className="publicCampusWelcome" style={{ backgroundImage: `linear-gradient(0deg, rgba(7,32,51,.82), rgba(7,32,51,.18)), url(${mitcorerCampus})` }}>
            <a href="https://www.mitcorer.edu.in/Admissions-Open-2026-27.html" target="_blank" rel="noreferrer">Start admission enquiry <ArrowRight size={13} aria-hidden="true" /></a>
          </div>
          {messages.map((message, index) => <Fragment key={`${message.type}-${index}`}><article className={`publicBubble ${message.type}`} lang={['en', 'mr', 'hi'].includes(message.responseLanguage) ? message.responseLanguage : undefined}>
            {message.type === 'assistant' && <div className="publicBubbleAvatar"><img src={mitcorerLogo} alt="" /></div>}
            <div>
              <PublicAnswerBody message={message} />
              {message.retryQuestion && <button type="button" className="publicRetry" disabled={busy} onClick={() => ask(message.retryQuestion)}>{language === 'mr' ? 'पुन्हा प्रयत्न करा' : language === 'hi' ? 'फिर कोशिश करें' : 'Try again'}</button>}
              {message.type === 'assistant' && message.actionView === 'applicantPortal' && (
                <button type="button" className="applicantPortalEntry answerPortalEntry" onClick={() => setShowChecklist(true)}>
                  Open admission checklist <ArrowRight size={13} />
                </button>
              )}
              {publicAnswerLinks(message, { firstYear: feeFirstYearImage, directSecondYear: feeDirectSecondYearImage, hostel: hostelMessFeeImage }).map(link => <a key={link.url} href={link.url} target="_blank" rel="noreferrer">{link.label} <ArrowRight size={13} /></a>)}
              {message.type === 'assistant' && !message.clarification && message.outcomeStatus !== 'NEEDS_CLARIFICATION'
                && (message.escalation?.available || message.source === 'No verified record') && (
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
          <span>Powered by MITCORER{' '}</span>
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
            <div style={{ display: 'grid', gridTemplateColumns: '28px minmax(0, 1fr) 28px', alignItems: 'center', marginBottom: '12px' }}>
              <strong style={{ gridColumn: 2, textAlign: 'center', fontSize: '18px', color: '#146548' }}>Administrator Portal</strong>
              <button type="button" aria-label="Close administrator sign-in" onClick={() => setShowAdminLogin(false)} style={{ display: 'grid', placeItems: 'center', minHeight: '28px', padding: 0, background: 'none', border: 'none', cursor: 'pointer', color: '#69756e' }}><X size={18} /></button>
            </div>
            {adminLoginError && <div role="alert" style={{ background: '#fef2f2', color: '#b91c1c', padding: '8px 12px', borderRadius: '6px', fontSize: '12px', marginBottom: '12px' }}>{adminLoginError}</div>}
            <form onSubmit={async (e) => {
              e.preventDefault();
              if (adminLoggingIn || !onAdminLogin) return;
              setAdminLoggingIn(true);
              setAdminLoginError('');
              try {
                await onAdminLogin(adminEmail, adminPassword);
              } catch (err) {
                setAdminLoginError(err.status === 401 ? 'Invalid credentials. Check email and password.'
                  : err instanceof TypeError ? 'Could not reach MITRA. Try again when the server is available.'
                  : err.message || 'Login failed. Please try again.');
              } finally {
                setAdminLoggingIn(false);
              }
            }}>
              <label htmlFor="admin-login-email" style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}>Admin Email</label>
              <input id="admin-login-email" type="email" autoComplete="username" required value={adminEmail} onChange={(e) => setAdminEmail(e.target.value)} style={{ width: '100%', padding: '10px 12px', borderRadius: '6px', border: '1px solid #cfd8d2', marginBottom: '12px', boxSizing: 'border-box' }} />
              <label htmlFor="admin-login-password" style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}>Password</label>
              <input id="admin-login-password" type="password" autoComplete="current-password" required value={adminPassword} onChange={(e) => setAdminPassword(e.target.value)} style={{ width: '100%', padding: '10px 12px', borderRadius: '6px', border: '1px solid #cfd8d2', marginBottom: '16px', boxSizing: 'border-box' }} />
              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                <button type="button" onClick={() => setShowAdminLogin(false)} style={{ padding: '8px 16px', borderRadius: '6px', border: '1px solid #cfd8d2', background: '#f6f8f7', cursor: 'pointer' }}>Cancel</button>
                <button type="submit" disabled={adminLoggingIn} style={{ padding: '8px 20px', borderRadius: '6px', border: 'none', background: '#146548', color: '#fff', fontWeight: 600, cursor: 'pointer' }}>{adminLoggingIn ? 'Signing in…' : 'Sign in'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
      <AdmissionChecklist open={showChecklist && !showApplicantPortal} onClose={() => setShowChecklist(false)}
        token={signedIn ? token : ''} onSaveGuest={() => setShowApplicantPortal(true)} onLogout={onLogout} />
      {showApplicantPortal && <ApplicantPortalAccess
        onClose={() => setShowApplicantPortal(false)}
        onAuthenticate={onApplicantPortalAuth}
      />}
      <button className="assistantLauncher" type="button" onClick={() => setOpen(true)} aria-label="Open MIT Barshi admission assistant"><span className="launcherPulse" /><img src={mitcorerLogo} alt="" /></button>
    </main>
  );
}

function ApplicantPortalAccess({ onClose, onAuthenticate }) {
  const [mode, setMode] = useState('login');
  const [role, setRole] = useState('applicant');
  const [admissionStream, setAdmissionStream] = useState('');
  const [engineeringEntry, setEngineeringEntry] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const admissionRoute = admissionStream === 'engineering'
    ? engineeringEntry === 'first-year' ? 'btech-fy' : engineeringEntry === 'direct-second-year' ? 'btech-dse' : ''
    : admissionStream === 'polytechnic' ? 'polytechnic' : '';
  const submit = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const ok = await onAuthenticate({ mode, name, email, password, role, admissionRoute });
      if (ok) onClose();
      else setError('Check your details and try again.');
    } catch (submitError) {
      setError(submitError.message || 'Could not sign in.');
    } finally { setBusy(false); }
  };
  return <div className="portalModalBackdrop" role="presentation">
    <section className="portalModal" role="dialog" aria-modal="true" aria-labelledby="applicant-portal-title">
      <button type="button" className="portalModalClose" onClick={onClose} disabled={busy} aria-label="Close checklist sign-in"><X size={18} /></button>
      <span className="eyebrow">Save your admission checklist</span>
      <h2 id="applicant-portal-title">{mode === 'login' ? 'Sign in to save your checklist' : 'Create an applicant account'}</h2>
      {error && <div className="errorBanner" role="alert">{error}</div>}
      <form onSubmit={submit} className="portalAccessForm">
        {mode === 'signup' && <>
          <label>Full name<input required maxLength={120} value={name} onChange={event => setName(event.target.value)} /></label>
          <label>Who is this account for?<select value={role} onChange={event => setRole(event.target.value)}><option value="applicant">Applicant</option><option value="parent">Parent / guardian</option></select></label>
          <label>{role === 'parent' ? 'Student’s admission stream' : 'Your admission stream'}<select required value={admissionStream} onChange={event => { setAdmissionStream(event.target.value); setEngineeringEntry(''); }}><option value="">Choose engineering or diploma</option><option value="engineering">Engineering (B.Tech)</option><option value="polytechnic">Polytechnic (Diploma)</option></select></label>
          {admissionStream === 'engineering' && <label>Engineering entry route<select required value={engineeringEntry} onChange={event => setEngineeringEntry(event.target.value)}><option value="">Choose entry route</option><option value="first-year">First Year B.Tech</option><option value="direct-second-year">Direct Second Year B.Tech</option></select></label>}
        </>}
        <label>Email<input type="email" required autoComplete="email" value={email} onChange={event => setEmail(event.target.value)} /></label>
        <label>Password<input type="password" required minLength={mode === 'signup' ? 12 : undefined} autoComplete={mode === 'signup' ? 'new-password' : 'current-password'} value={password} onChange={event => setPassword(event.target.value)} /></label>
        {mode === 'signup' && <>
          <small>Use at least 12 characters. Keep your account credentials private.</small>
          <small>Authorized admissions staff can view your saved checklist progress.</small>
        </>}
        <button type="submit" disabled={busy || (mode === 'signup' && !admissionRoute)}>{busy ? 'Please wait…' : mode === 'login' ? 'Sign in' : 'Create account'}</button>
      </form>
      <button type="button" className="portalModeToggle" disabled={busy} onClick={() => { setMode(mode === 'login' ? 'signup' : 'login'); setError(''); }}>
        {mode === 'login' ? 'New applicant? Create an account' : 'Already have an account? Sign in'}
      </button>
    </section>
  </div>;
}

const admissionRoutes = {
  'btech-fy': { label: 'B.Tech — First Year', url: 'https://mitcorer.edu.in/fy-btech.php', portalUrl: 'https://fe2026.mahacet.org/StaticPages/HomePage', documentsUrl: 'https://mitcorer.edu.in/fy-btech-documents.php' },
  'btech-dse': { label: 'B.Tech — Direct Second Year', url: 'https://mitcorer.edu.in/d-sy-btech.php', portalUrl: 'https://dsd26.dtemaharashtra.gov.in/', documentsUrl: 'https://mitcorer.edu.in/d-sy-btech-documents-required.php' },
  polytechnic: { label: 'Polytechnic Diploma — First Year', url: 'https://mitcorer.edu.in/fy-polytechnic.php', portalUrl: 'https://poly26.dtemaharashtra.gov.in/poly_26/home', documentsUrl: 'https://mitcorer.edu.in/fy-polytechnic-documents.php' },
};
const capStages = ['Not started', 'Registration submitted', 'Scrutiny and application confirmation complete', 'Provisional merit list checked', 'Final merit list checked', 'Option form confirmed', 'Allotment checked', 'Seat acceptance action complete', 'Reported to institute', 'Admission confirmed'];
const acapStages = ['Not started', 'Application submitted', 'Provisional institute merit list checked', 'Grievance submitted (if needed)', 'Final institute merit list checked', 'Vacancy or offer checked', 'Reported to institute', 'Admission confirmed'];
const capNextSteps = {
  'Not started': 'Open the correct route portal and read its current information brochure and schedule before registering.',
  'Registration submitted': 'Complete the route portal’s document scrutiny. Watch for objections or corrections and confirm the application within the schedule.',
  'Scrutiny and application confirmation complete': 'Check your provisional merit details. Use the published correction or grievance window if anything is wrong.',
  'Provisional merit list checked': 'Check the final merit list and the available seat matrix for your route and category.',
  'Final merit list checked': 'Submit and confirm your ordered choices in the official candidate login.',
  'Option form confirmed': 'Check the allotment result in your official candidate login when the authority publishes it.',
  'Allotment checked': 'Follow that round’s instructions for self-verification, seat acceptance, any required fee, and freeze or betterment choice.',
  'Seat acceptance action complete': 'Report to the allotted institute within the notice deadline with the originals and proofs specified for your route and category.',
  'Reported to institute': 'Confirm that the institute recorded your admission and keep the receipt and official confirmation.',
  'Admission confirmed': 'Keep your admission confirmation, receipts, and official messages for reference.',
};
const acapNextSteps = {
  'Not started': 'Check MITCORER’s current institute-level notice for vacancies, application dates, merit-list steps, and reporting instructions. Dates from a past cycle do not carry forward.',
  'Application submitted': 'Check the provisional institute merit list and follow the notice if you need to raise a grievance.',
  'Provisional institute merit list checked': 'If a detail is incorrect, submit a grievance in the way and by the time specified in the institute notice; otherwise check the final list.',
  'Grievance submitted (if needed)': 'Check the final institute merit list and any current vacancy or offer notice.',
  'Final institute merit list checked': 'Check the institute’s current vacancy or offer instructions and confirm the reporting date directly from the notice.',
  'Vacancy or offer checked': 'Report to MITCORER with the original documents and complete admission formalities within the published schedule.',
  'Reported to institute': 'Confirm that the college has recorded your admission and keep the receipt and official confirmation.',
  'Admission confirmed': 'Keep your admission confirmation, receipts, and official messages for reference.',
};
const checklistDocuments = {
  'btech-fy': ['10th marksheet', '12th marksheet', 'CET or JEE scorecard'],
  'btech-dse': ['10th marksheet', 'Diploma or B.Sc. marksheets'],
  polytechnic: ['10th marksheet'],
};
const commonChecklistDocuments = ['School leaving certificate', 'Nationality or domicile proof'];

function AdmissionChecklist({ open, onClose, token, onSaveGuest, onLogout }) {
  const dialogRef = useRef(null);
  const [draft, setDraft] = useState(null);
  const [saved, setSaved] = useState({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [attempt, setAttempt] = useState(0);
  const [loadFailed, setLoadFailed] = useState(false);
  const [loadedFor, setLoadedFor] = useState('');
  const requestKey = `${token || ''}:${attempt}`;
  const loading = Boolean(token && open && !loadFailed && loadedFor !== requestKey);

  useEffect(() => {
    if (open && !dialogRef.current.open) dialogRef.current.showModal();
    if (!open && dialogRef.current.open) dialogRef.current.close();
  }, [open]);

  useEffect(() => {
    if (!token || !open) return;
    let active = true;
    api.getAdmissionWorkspace(token).then(workspace => {
      if (active) {
        setSaved({ ...workspace.cap, route: workspace.cap?.route || workspace.programs?.route || '' });
        setLoadedFor(requestKey);
      }
    }).catch(loadError => {
      if (active) {
        setLoadFailed(true);
        setLoadedFor(requestKey);
        setError(loadError.message || 'Could not load your saved checklist.');
      }
    });
    return () => { active = false; };
  }, [token, open, requestKey]);

  const progress = draft || (token ? saved : {});
  const route = Object.hasOwn(admissionRoutes, progress.route) ? admissionRoutes[progress.route] : null;
  const channel = ['cap', 'acap'].includes(progress.channel) ? progress.channel : 'unsure';
  const stages = channel === 'acap' ? acapStages : capStages;
  const previousStage = progress.stage || progress.status;
  const stage = stages.includes(previousStage) ? previousStage : stages[0];
  const documents = route ? [...checklistDocuments[progress.route], ...commonChecklistDocuments] : [];
  const checked = Array.isArray(progress.checkedDocuments) ? progress.checkedDocuments : [];
  const update = changes => {
    setNotice('');
    setDraft({ ...progress, ...changes });
  };
  const save = async () => {
    if (!token) {
      onSaveGuest();
      return;
    }
    setSaving(true);
    setError('');
    try {
      const workspace = await api.updateAdmissionWorkspace(token, 'cap', {
        ...saved, route: progress.route, channel, stage, checkedDocuments: checked,
      });
      setSaved(workspace.cap);
      setLoadedFor(requestKey);
      setDraft(null);
      setNotice('Checklist saved.');
    } catch (saveError) {
      setNotice('');
      setError(saveError.message || 'Could not save your checklist.');
    } finally {
      setSaving(false);
    }
  };

  return <dialog ref={dialogRef} className="admissionChecklistDialog" aria-labelledby="admission-checklist-title"
    onCancel={event => { event.preventDefault(); onClose(); }}>
    <button type="button" className="portalModalClose" onClick={onClose} aria-label="Close checklist"><X size={18} /></button>
    <h2 id="admission-checklist-title">Admission checklist</h2>
    <p>Track your own preparation. Confirm requirements, deadlines and admission status through the official links.</p>
    {loading && <p role="status">Loading saved checklist...</p>}
    {error && <p role="alert">{error} <button type="button" onClick={() => { setLoadFailed(false); setError(''); setAttempt(value => value + 1); }}>Reload saved checklist</button></p>}
    {notice && <p role="status">{notice}</p>}
    <fieldset disabled={loading || saving}>
      <label>Programme route<select value={route ? progress.route : ''} onChange={event => update({ route: event.target.value, stage: stages[0], checkedDocuments: [] })}>
        <option value="">Choose your route</option>
        {Object.entries(admissionRoutes).map(([id, item]) => <option key={id} value={id}>{item.label}</option>)}
      </select></label>
      {route && <>
        <label>Admission process<select value={channel} onChange={event => update({ channel: event.target.value, stage: 'Not started' })}>
          <option value="unsure">I'm not sure</option><option value="cap">Centralized CAP</option><option value="acap">Institute-level / against CAP</option>
        </select></label>
        {channel !== 'unsure' && <label>Latest step completed<select value={stage} onChange={event => update({ stage: event.target.value })}>
          {stages.map(item => <option key={item}>{item}</option>)}
        </select></label>}
        <h3>Next official action</h3>
        <p>{channel === 'unsure' ? 'Check your official notice or ask the college whether your seat is through CAP or an institute-level round.' : (channel === 'acap' ? acapNextSteps : capNextSteps)[stage]}</p>
        {channel !== 'acap' && <a href={route.portalUrl} target="_blank" rel="noreferrer">Open official CAP portal</a>}
        {channel !== 'cap' && <a href={progress.route === 'polytechnic' ? route.url : 'https://mitcorer.edu.in/acap-institute-level-admission.php'} target="_blank" rel="noreferrer">Open MITCORER admission notices</a>}
        <h3>Documents to prepare</h3>
        {documents.map(name => <label className="checklistItem" key={name}><input type="checkbox" checked={checked.includes(name)} onChange={event => update({ checkedDocuments: event.target.checked ? [...checked, name] : checked.filter(item => item !== name) })} />{name}</label>)}
        <a href={route.documentsUrl} target="_blank" rel="noreferrer">Check the full document list and category-specific requirements</a>
      </>}
      <div className="checklistActions">
        <button type="button" disabled={!route || Boolean(token && (!draft || loadFailed))} onClick={save}>{saving ? 'Saving...' : 'Save my checklist'}</button>
        {token && draft && <button type="button" onClick={() => { setDraft(null); setNotice(''); }}>Use saved checklist</button>}
        {token && <button type="button" onClick={async () => { await onLogout(); setDraft(null); setSaved({}); setNotice(''); setError(''); }}>Sign out</button>}
      </div>
    </fieldset>
  </dialog>;
}

function PublicEscalationCard({ message, language }) {
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState('');
  const [contact, setContact] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submissionId, setSubmissionId] = useState('');
  const [error, setError] = useState('');

  const escalation = message.escalation || {
    available: true,
    helplines: [],
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!contact.trim()) return;
    setSubmitting(true);
    setError('');
    try {
      const result = await api.escalateInquiry({
        name: name.trim() || 'Prospective Student',
        contact: contact.trim(),
        question: message.originalQuestion || message.text || 'Inquiry regarding MITCORER admissions',
        topic: 'Human Escalation',
      });
      setSubmissionId(result.inquiryId || '');
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
      : 'Contact MITCORER Staff';

  const promptText = language === 'mr'
    ? 'तुमची विनंती MITCORER कर्मचाऱ्यांच्या पुनरावलोकनासाठी नोंदवली जाईल. ती आपोआप एखाद्या विशिष्ट सल्लागाराकडे पाठवली जात नाही. तातडीसाठी खालील क्रमांकांवर कॉल करा:'
    : language === 'hi'
      ? 'आपका अनुरोध MITCORER कर्मचारी समीक्षा कतार में दर्ज होगा। यह अपने आप किसी विशेष परामर्शदाता को नहीं भेजा जाता। तत्काल सहायता के लिए नीचे दिए गए नंबरों पर कॉल करें:'
      : 'Enter a phone number or email address where staff can reach you. Staff will review your request and may contact you directly.';

  return (
    <div className="escalationCard" role="region" aria-label="MITCORER staff inquiry">
      <div className="escalationCardHeader">
        <Phone size={13} aria-hidden="true" />
        <span>{headerTitle}</span>
      </div>
      <p className="escalationCardPrompt">{promptText}</p>
      {language !== 'mr' && language !== 'hi' && escalation.helplines?.length > 0 && (
        <p className="escalationCardPrompt">For urgent help, call one of the numbers below.</p>
      )}
      {(escalation.helplines?.length > 0 || escalation.email) && <div className="escalationVerifiedContacts" aria-label="Published college contacts">
        <span>{language === 'mr' ? 'महाविद्यालय संपर्क' : language === 'hi' ? 'कॉलेज संपर्क' : 'College contacts'}</span>
        {(escalation.helplines || []).map(line => <a key={line.tel} href={`tel:${line.tel}`}>{line.number}</a>)}
        {escalation.email && <a href={`mailto:${escalation.email}`}>{escalation.email}</a>}
      </div>}
      {submitted ? (
        <div className="escalationSuccess">
          <CheckCircle2 size={14} />
          <span>
            {language === 'mr'
    ? `तुमची विनंती ${submissionId ? `(${submissionId}) ` : ''}MITCORER कर्मचाऱ्यांच्या पुनरावलोकनासाठी नोंदवली आहे. कोणताही विशिष्ट सल्लागार आपोआप नियुक्त झालेला नाही. तातडीसाठी वरील क्रमांकांवर कॉल करा.`
              : language === 'hi'
      ? `आपका अनुरोध ${submissionId ? `(${submissionId}) ` : ''}MITCORER कर्मचारी समीक्षा कतार में दर्ज किया गया है। कोई विशेष परामर्शदाता अपने आप नियुक्त नहीं हुआ है। तत्काल सहायता के लिए ऊपर दिए गए नंबरों पर कॉल करें।`
                : `Your inquiry${submissionId ? ` (${submissionId})` : ''} was saved to Admin → Review Inbox → Requests. No individual counselor was assigned automatically, and no email/SMS was sent. For urgent help, please call one of the numbers above.`}
          </span>
        </div>
      ) : (
        <>
          <div className="escalationActions">
            {!showForm && (
              <button
                type="button"
                className="escalationBtn staffBtn"
                onClick={() => setShowForm(true)}
              >
                {language === 'mr' ? 'कॉल-बॅक विनंती करा' : language === 'hi' ? 'कॉल-बॅक अनुरोध करें' : 'Submit for Staff Review'}
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
    if (block.type === 'table') return <div key={blockIndex} className="publicTableScroll" tabIndex={0} role="region" aria-label="Answer comparison"><table><thead><tr>{block.headers.map((cell, i) => <th key={i} scope="col">{linkOfficialContact(cell)}</th>)}</tr></thead><tbody>{block.rows.map((row, i) => <tr key={i}>{row.map((cell, j) => <td key={j}>{linkOfficialContact(cell)}</td>)}</tr>)}</tbody></table></div>;
    if (block.type === 'programmes' || block.type === 'fees' || block.type === 'cards') {
      return <Fragment key={blockIndex}><p>{block.intro}</p><ul className="publicAnswerList">{block.items.map((item, itemIndex) => <li key={itemIndex}><strong>{item.name}</strong><span>{block.type === 'cards' ? item.detail : block.type === 'fees' ? `INR ${item.amount}` : `Intake: ${item.intake} | Choice code: ${item.choiceCode}`}</span></li>)}</ul></Fragment>;
    }
    if (block.type === 'list') {
      const List = block.ordered ? 'ol' : 'ul';
      return <List key={blockIndex} {...(block.ordered ? { start: block.start } : {})}>{block.items.map((item, itemIndex) => <li key={itemIndex}>{linkOfficialContact(item)}</li>)}</List>;
    }
    return <p key={blockIndex}>{linkOfficialContact(block.text)}</p>;
  });
}

function linkOfficialContact(text) {
  const value = String(text || '');
  const emphasis = [...value.matchAll(/\*\*([^*\n]+)\*\*/g)];
  if (emphasis.length) {
    const parts = []; let index = 0;
    for (const match of emphasis) {
      parts.push(...[linkOfficialContact(value.slice(index, match.index)), <strong key={`bold-${match.index}`}>{linkOfficialContact(match[1])}</strong>]);
      index = match.index + match[0].length;
    }
    parts.push(linkOfficialContact(value.slice(index))); return parts;
  }
  const contactPattern = /\+91[ -]*\d{5}[ -]*\d{5}\b|[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi;
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

function AdminOverview({ user, token, knowledge, sources, setView, onOpenSources, onOpenKnowledge, onOpenKnowledgeRecord, onOpenInquiries, onOpenFeedback }) {
  const [reviewCounts, setReviewCounts] = useState({ inquiries: null, feedback: null, unhelpfulFeedback: 0, pendingInquiries: 0, applicants: null, inquiryError: '', feedbackError: '', applicantError: '' });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    Promise.allSettled([api.getInquiries(token), api.getFeedback(token), api.getApplicantWorkspaces(token)])
      .then(([inquiryState, feedbackState, applicantState]) => {
        if (!active) return;
        const inquiryResult = inquiryState.status === 'fulfilled' ? inquiryState.value : { items: [] };
        const feedbackResult = feedbackState.status === 'fulfilled' ? feedbackState.value : { items: [] };
        const applicantResult = applicantState.status === 'fulfilled' ? applicantState.value : { items: [] };
        const inqItems = inquiryResult.items || [];
        const fdbItems = feedbackResult.items || [];
        const unhelpful = fdbItems.filter(f => !f.helpful && f.status !== 'Resolved' && f.status !== 'Dismissed').length;
        const pendingInq = inqItems.filter(i => i.status !== 'Resolved').length;
        setReviewCounts({
          inquiries: inquiryState.status === 'fulfilled' ? inqItems.length : null,
          feedback: feedbackState.status === 'fulfilled' ? fdbItems.length : null,
          unhelpfulFeedback: feedbackState.status === 'fulfilled' ? unhelpful : null,
          pendingInquiries: inquiryState.status === 'fulfilled' ? pendingInq : null,
          applicants: applicantState.status === 'fulfilled' ? (applicantResult.items || []).filter(hasSavedAdmissionChecklist).length : null,
          inquiryError: inquiryState.status === 'rejected' ? inquiryState.reason.message || 'Could not load visitor requests.' : '',
          feedbackError: feedbackState.status === 'rejected' ? feedbackState.reason.message || 'Could not load answer feedback.' : '',
          applicantError: applicantState.status === 'rejected' ? applicantState.reason.message || 'Could not load saved admission checklists.' : '',
        });
      })
      .catch(() => { if (active) setReviewCounts({ inquiries: null, feedback: null, unhelpfulFeedback: null, pendingInquiries: null, applicants: null, inquiryError: 'Could not load the operations summary.', feedbackError: 'Could not load the operations summary.', applicantError: 'Could not load the operations summary.' }); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [token]);

  const publishedKnowledge = knowledge.filter(item => item.status === 'Published').length;
  const reviewKnowledge = knowledge.filter(item => item.status === 'Review');
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(timer);
  }, []);
  const expiryAlerts = knowledge.flatMap(item => {
    const { validFrom, validUntil, supersededBy } = item.provenance || {};
    if (item.status !== 'Published' || supersededBy || !validUntil) return [];
    const end = Date.parse(`${validUntil}T23:59:59.999Z`);
    const start = validFrom ? Date.parse(`${validFrom}T00:00:00.000Z`) : now;
    if (!Number.isFinite(end) || !(start <= now) || end > now + 14 * 86_400_000) return [];
    return [{ item, validUntil, end }];
  }).sort((a, b) => a.end - b.end);
  const needsReview = sources.filter(item => ['review', 'staged', 'conflict', 'pending'].includes(String(item.status || '').toLowerCase())).length;
  const pendingSources = sources.filter(item => ['review', 'staged', 'conflict', 'pending'].includes(String(item.status || '').toLowerCase()));
  const unreachableSources = pendingSources.filter(item => item.syncMeta?.healthStatus === 'unreachable').length;
  const scrollToSection = (id) => {
    const target = document.getElementById(id) || document.getElementById('assistant-quality-monitor');
    target?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };
  return <div className="pageStack adminPage">
    <AdminPageHeader title="Overview" description={`Welcome, ${user.name.split(' ')[0]}. Review visitor requests and maintain assistant knowledge.`} />
    <section className="adminMetricGrid" aria-label="Operations summary">
      <article><span>Published knowledge</span><strong>{publishedKnowledge}</strong><small>of {knowledge.length} knowledge records</small></article>
      <article><span>Sources to review</span><strong>{needsReview}</strong><small>{unreachableSources} unreachable; {Math.max(0, needsReview - unreachableSources)} staged or changed</small></article>
      <article><span>Open visitor requests</span><strong>{loading ? '…' : reviewCounts.pendingInquiries ?? '—'}</strong><small>{reviewCounts.inquiries ?? '—'} total in the inbox</small></article>
    </section>
    <section className="adminDashboardGrid">
      <article className="adminActionPanel">
        <div className="sectionHead"><span className="eyebrow">Needs attention</span><h2>Work waiting for action</h2><p>Prioritized queues and issues based on current workspace data.</p></div>
        <div className="adminPendingList">
          {reviewCounts.inquiryError && <div role="alert"><span className="statusDot" style={{ background: '#dc2626' }} /><span><strong>Visitor requests unavailable</strong><small>{reviewCounts.inquiryError}</small></span></div>}
          {reviewCounts.feedbackError && <div role="alert"><span className="statusDot" style={{ background: '#dc2626' }} /><span><strong>Answer feedback unavailable</strong><small>{reviewCounts.feedbackError}</small></span></div>}
          {reviewCounts.applicantError && <div role="alert"><span className="statusDot" style={{ background: '#dc2626' }} /><span><strong>Applicant progress unavailable</strong><small>{/API route not found/i.test(reviewCounts.applicantError) ? 'Update the backend service to enable Applicant Progress.' : reviewCounts.applicantError}</small></span></div>}
          {reviewCounts.pendingInquiries > 0 && <div><span className="statusDot" /><span><strong>{reviewCounts.pendingInquiries} visitor request{reviewCounts.pendingInquiries === 1 ? '' : 's'} open</strong><small>Check the inbox for requests that still need a reply.</small></span></div>}
          {reviewCounts.unhelpfulFeedback > 0 && <div><span className="statusDot" style={{ background: '#dc2626' }} /><span><strong>{reviewCounts.unhelpfulFeedback} answer rating issue{reviewCounts.unhelpfulFeedback === 1 ? '' : 's'}</strong><small>Investigate visitor feedback marked unhelpful.</small></span></div>}
          {reviewKnowledge.slice(0, 2).map(item => <div key={item.id}><span className="statusDot" style={{ background: '#d97706' }} /><span><strong>{item.title}</strong><small>Knowledge record needs source review.</small></span></div>)}
          {expiryAlerts.map(({ item, validUntil, end }) => <div key={item.id}><span className="statusDot" /><span><strong>{item.title}</strong><small>{end < now ? 'Expired' : 'Expires soon'} · Valid until {validUntil} (UTC)</small><button className="inlineAction" type="button" onClick={() => onOpenKnowledgeRecord(item.id)}>Open {item.id} <ArrowRight size={15} /></button></span></div>)}
          {pendingSources.slice(0, 2).map(item => <div key={item.id}><span className="statusDot" /><span><strong>{item.title}</strong><small>{item.syncMeta?.lastError || item.extractionStatus || item.status || 'Source change needs review'}</small></span></div>)}
          {!reviewCounts.inquiryError && !reviewCounts.feedbackError && !reviewCounts.applicantError && reviewCounts.inquiries !== null && reviewCounts.feedback !== null && !reviewCounts.pendingInquiries && !reviewCounts.unhelpfulFeedback && !reviewKnowledge.length && !pendingSources.length && !expiryAlerts.length && <div className="adminAllClear"><CheckCircle2 size={20} /><span><strong>No queued work is currently flagged</strong><small>New submissions and source changes will appear here when they need action.</small></span></div>}
        </div>
        <div className="adminAttentionActions">
          {reviewCounts.pendingInquiries > 0 && <button type="button" onClick={onOpenInquiries || (() => setView('inquiries'))}>Open visitor inbox ({reviewCounts.pendingInquiries}) <ArrowRight size={15} /></button>}
          {reviewCounts.unhelpfulFeedback > 0 && <button type="button" onClick={onOpenFeedback || (() => setView('inquiries'))}>Inspect answer feedback <ArrowRight size={15} /></button>}
          {pendingSources.length > 0 && <button type="button" onClick={onOpenSources}>Review sources ({needsReview}) <ArrowRight size={15} /></button>}
          {reviewKnowledge.length > 0 && <button type="button" onClick={onOpenKnowledge}>Review knowledge ({reviewKnowledge.length}) <ArrowRight size={15} /></button>}
          {reviewCounts.applicants > 0 && <button type="button" onClick={() => setView('applicant-workspaces')}>Applicant Progress ({reviewCounts.applicants}) <ArrowRight size={15} /></button>}
        </div>
      </article>
      <article className="adminActionPanel">
        <div className="sectionHead"><span className="eyebrow">Operations</span><h2>Open a workspace</h2><p>Management tools and quality signals stay available here.</p></div>
        <div className="adminOpsGrid">
          <button type="button" onClick={onOpenKnowledge}><FileText size={18} /><span><strong>Knowledge Base</strong><small>Edit, verify and retire answer records</small></span><ArrowRight size={15} /></button>
          <button type="button" onClick={onOpenSources}><RefreshCw size={18} /><span><strong>Source Verification</strong><small>Review official sources and changes</small></span><ArrowRight size={15} /></button>
          <button type="button" onClick={onOpenInquiries || (() => setView('inquiries'))}><Phone size={18} /><span><strong>Review inbox</strong><small>Visitor requests and answer feedback</small></span><ArrowRight size={15} /></button>
          <button type="button" onClick={() => setView('applicant-workspaces')}><LayoutDashboard size={18} /><span><strong>Applicant Progress</strong><small>{reviewCounts.applicantError ? 'Progress unavailable' : loading ? 'Loading accounts…' : `${reviewCounts.applicants} saved`}</small></span><ArrowRight size={15} /></button>
          <button type="button" onClick={() => scrollToSection('assistant-query-analytics')}><Cpu size={18} /><span><strong>AI quality and analytics</strong><small>Inspect answer outcomes and unresolved patterns</small></span><ArrowRight size={15} /></button>
          {user.role === 'admin' && <button type="button" onClick={() => scrollToSection('assistant-unanswered-review')}><ThumbsDown size={18} /><span><strong>Unanswered questions</strong><small>Triage unresolved assistant outcomes</small></span><ArrowRight size={15} /></button>}
        </div>
      </article>
    </section>
    <AssistantOperations token={token} />
    <footer className="adminWorkspaceNote"><ShieldCheck size={16} /><span>Only published, verified records are used for official answers. Staff assignments and review actions in this workspace do not send automatic email or SMS notifications.</span></footer>
  </div>;
}

function Sidebar({ user, view, setView, navOpen, setNavOpen, collapsed, setCollapsed, onLogout }) {
  const openView = (id) => { setView(id); setNavOpen(false); };
  const toggleCollapsed = () => {
    const next = !collapsed;
    setCollapsed(next);
    localStorage.setItem('mitra.sidebarCollapsed', String(next));
  };
  return (
    <aside id="admin-sidebar" className={`sidebar ${navOpen ? 'open' : ''} ${collapsed ? 'collapsed' : ''}`}>
      <div className="sidebarBrandRow">
        <div className="brandLockup compact"><span className="collegeLogo"><img src={mitcorerLogo} alt="MITCORER logo" /></span><div><strong>MITCORER</strong><small>Admin workspace</small></div></div>
        <button className="sidebarToggle" type="button" onClick={toggleCollapsed} aria-expanded={!collapsed} aria-controls="admin-sidebar" aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'} title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}>{collapsed ? <PanelLeftOpen size={19} aria-hidden="true" /> : <PanelLeftClose size={19} aria-hidden="true" />}</button>
      </div>
      <nav className="sideNav" aria-label="Admin workspace">
        <button className={view === 'overview' ? 'active' : ''} type="button" onClick={() => openView('overview')}><span>Overview</span></button>
        <button className={view === 'knowledge' ? 'active' : ''} type="button" onClick={() => openView('knowledge')}>
          <span>Knowledge Base</span>
        </button>
        <button className={view === 'analytics' ? 'active' : ''} type="button" onClick={() => openView('analytics')}><span>Analytics</span></button>
        {['staff', 'admin'].includes(user.role) && <button className={view === 'inquiries' ? 'active' : ''} type="button" onClick={() => openView('inquiries')}>
          <span>Review inbox</span>
        </button>}
        {['staff', 'admin'].includes(user.role) && <button className={view === 'applicant-workspaces' ? 'active' : ''} type="button" onClick={() => openView('applicant-workspaces')}>
          <span>Applicant Progress</span>
        </button>}
      </nav>
      <div className="accountFooter" title={user.email}>
        <span aria-hidden="true">{user.name.trim().charAt(0).toUpperCase()}</span>
        <div><strong>{user.name}</strong><small>{user.role === 'admin' ? 'Administrator' : 'Staff'}</small></div>
        <button type="button" onClick={onLogout} title="Sign out" aria-label="Sign out"><LogOut size={17} /></button>
      </div>
    </aside>
  );
}

function hasSavedAdmissionChecklist({ cap }) {
  return Boolean(cap?.stage || cap?.status);
}

function AdminPageHeader({ title, description, children }) {
  return <header className="adminPageHeader">
    <div><h2>{title}</h2><p>{description}</p></div>
    {children}
  </header>;
}

function AdminRefreshButton({ loading, onClick, label = 'Refresh' }) {
  return <button className="adminRefreshButton" type="button" disabled={loading} onClick={onClick}>
    <RefreshCw size={15} aria-hidden="true" />{loading ? 'Refreshing…' : label}
  </button>;
}

function AdminStatus({ children }) {
  return <div className="adminStatus" role="status"><CheckCircle2 size={16} aria-hidden="true" />{children}</div>;
}

function ApplicantWorkspaceReview({ token }) {
  const [items, setItems] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  useEffect(() => {
    if (!notice) return;
    const timeout = window.setTimeout(() => setNotice(''), 4000);
    return () => window.clearTimeout(timeout);
  }, [notice]);
  const reload = async () => {
    const result = await api.getApplicantWorkspaces(token);
    setItems((result.items || []).filter(hasSavedAdmissionChecklist));
  };
  useEffect(() => {
    let active = true;
    api.getApplicantWorkspaces(token).then(result => { if (active) setItems((result.items || []).filter(hasSavedAdmissionChecklist)); })
      .catch(loadError => { if (active) setError(loadError.message || 'Could not load saved admission checklists.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [token]);
  const normalizedSearch = search.trim().toLowerCase();
  const visibleItems = items.filter(item => !normalizedSearch || `${item.ownerName} ${item.ownerEmail}`.toLowerCase().includes(normalizedSearch));
  const refresh = () => {
    setLoading(true); setError(''); setNotice('');
    reload().then(() => setNotice('Progress refreshed.'))
      .catch(loadError => setError(loadError.message || 'Could not refresh saved admission checklists.'))
      .finally(() => setLoading(false));
  };
  return <div className="pageStack adminPage">
    <AdminPageHeader title="Applicant Progress" description="View progress reported by applicants and parents.">
      <AdminRefreshButton loading={loading} onClick={refresh} label="Refresh progress" />
    </AdminPageHeader>
    <div className="knowledgeFilters applicantAdminFilters"><label>Find an applicant<input type="search" value={search} onChange={event => setSearch(event.target.value)} placeholder="Name or account email" /></label><span>{visibleItems.length} of {items.length} records</span></div>
    {error && <div className="errorBanner" role="alert">{/API route not found/i.test(error) ? 'Update the backend service to enable Applicant Progress, then refresh this page.' : error}</div>}
    {notice && <AdminStatus>{notice}</AdminStatus>}
    {loading ? <div className="panelBlock">Loading applicant workspaces…</div> : visibleItems.length === 0 ? <div className="knowledgeEmpty">{items.length ? 'No applicants match this search.' : 'No admission checklists have been saved yet.'}</div> : <div className="applicantAdminList">{visibleItems.map(item => {
      const route = item.cap?.route || item.programs?.route;
      const channel = item.cap?.channel;
      const documentLabels = Object.hasOwn(checklistDocuments, route) ? [...checklistDocuments[route], ...commonChecklistDocuments] : [];
      const checked = Array.isArray(item.cap?.checkedDocuments) ? item.cap.checkedDocuments : [];
      const prepared = documentLabels.filter(name => checked.includes(name));
      return <article className="applicantAdminCard" key={item.ownerEmail}>
        <header><div><h2>{item.ownerName || 'Applicant'}</h2><span>{item.ownerEmail && <>{item.ownerEmail} {'\u00b7'} </>}{item.ownerRole === 'parent' ? 'Parent / guardian account' : 'Applicant account'}</span></div></header>
        <div className="applicantAdminDetails">
          <section><h3>Admission progress</h3><dl>
            <div><dt>Route</dt><dd>{admissionRoutes[route]?.label || 'Not selected'}</dd></div>
            <div><dt>Process</dt><dd>{channel === 'acap' ? 'Institute-level / ACAP' : channel === 'cap' ? 'Centralized CAP' : 'To confirm'}</dd></div>
            <div><dt>Latest completed step</dt><dd>{item.cap?.stage || item.cap?.status || 'Not selected'}</dd></div>
          </dl></section>
          <section><h3>Documents marked prepared</h3>
            {prepared.length > 0 ? <ul>{prepared.map(name => <li key={name}>{name}</li>)}</ul> : <p>No documents marked prepared.</p>}
          </section>
        </div>
        <footer>Last updated: {item.updatedAt ? new Date(item.updatedAt).toLocaleString() : 'No admission-plan changes yet'}</footer>
      </article>;
    })}</div>}
  </div>;
}

function ReviewInbox({ token, initialTab = 'inquiries' }) {
  const [inquiries, setInquiries] = useState([]);
  const [feedback, setFeedback] = useState([]);
  const [selected, setSelected] = useState(null);
  const selectedRef = useRef(null);
  const [tab, setTab] = useState(initialTab);
  const [unresolvedOnly, setUnresolvedOnly] = useState(false);
  const [status, setStatus] = useState('Needs reply');
  const [assignedTo, setAssignedTo] = useState('');
  const [staffNote, setStaffNote] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshCount, setRefreshCount] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(() => {
    let active = true;
    Promise.all([api.getInquiries(token), api.getFeedback(token)])
      .then(([inquiryResult, feedbackResult]) => {
        if (!active) return;
        const nextInquiries = inquiryResult.items || [];
        const nextFeedback = feedbackResult.items || [];
        setInquiries(nextInquiries);
        setFeedback(nextFeedback);
        const previous = selectedRef.current;
        let initial = previous?.type === 'feedback'
          ? nextFeedback.find(item => item.id === previous.id) || null
          : nextInquiries.find(item => item.id === previous?.id) || null;
        if (initial) initial = { ...initial, type: previous.type };
        if (!initial && !previous) {
          const isFeedback = initialTab === 'feedback';
          const first = (isFeedback ? nextFeedback : nextInquiries)[0];
          initial = first ? { ...first, type: isFeedback ? 'feedback' : 'inquiry' } : null;
        }
        setSelected(initial);
        selectedRef.current = initial;
        if (initial?.type === 'inquiry') {
          setStatus(initial.status || 'Needs reply');
          setAssignedTo(initial.assignedTo || '');
          setStaffNote('');
        } else if (initial?.type === 'feedback') {
          setStatus(initial.status || (initial.helpful ? 'Appreciated' : 'Needs review'));
          setStaffNote(initial.resolutionNote || '');
        }
        setError('');
      }).catch(loadError => setError(loadError.message || 'Could not load the review inbox.'))
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [token, refreshCount, initialTab]);
  const allRows = [
    ...inquiries.map(item => ({ ...item, type: 'inquiry' })),
    ...feedback.map(item => ({ ...item, type: 'feedback', topic: item.helpful ? 'Helpful answer' : 'Unhelpful answer', status: item.status || (item.helpful ? 'Appreciated' : 'Needs review') })),
  ].sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
  const visibleRows = allRows.filter(item => tab === 'inquiries'
    ? item.type === 'inquiry' && (!unresolvedOnly || item.status !== 'Resolved')
    : item.type === 'feedback');
  const selectedIsVisible = visibleRows.some(item => item.type === selected?.type && item.id === selected?.id);
  const choose = (item) => {
    selectedRef.current = item;
    setSelected(item);
    setStatus(item.status || (item.type === 'feedback' ? (item.helpful ? 'Appreciated' : 'Needs review') : 'Needs reply'));
    setAssignedTo(item.assignedTo || '');
    setStaffNote(item.resolutionNote || '');
    setError('');
    setNotice('');
  };
  const openTab = (nextTab) => {
    if (nextTab === tab) return;
    setTab(nextTab);
    const first = allRows.find(item => nextTab === 'feedback'
      ? item.type === 'feedback'
      : item.type === 'inquiry' && (!unresolvedOnly || item.status !== 'Resolved'));
    if (first) choose(first);
    else {
      selectedRef.current = null;
      setSelected(null);
      setNotice('');
    }
  };
  const saveAssignment = async () => {
    if (!selected || selected.type !== 'inquiry') return;
    setSaving(true); setError(''); setNotice('');
    try {
      const updated = await api.updateInquiryStatus(token, selected.id, { status, assignedTo, reply: staffNote });
      setInquiries(current => current.map(item => item.id === updated.id ? updated : item));
      const nextSelected = { ...updated, type: 'inquiry' };
      selectedRef.current = nextSelected;
      setSelected(nextSelected);
      setStaffNote('');
      setNotice('Request updated.');
    } catch (saveError) { setError(saveError.message || 'Could not update this inquiry.'); }
    finally { setSaving(false); }
  };
  const saveFeedbackStatus = async () => {
    if (!selected || selected.type !== 'feedback') return;
    setSaving(true); setError(''); setNotice('');
    try {
      const updated = await api.updateFeedbackStatus(token, selected.id, { status, resolutionNote: staffNote });
      setFeedback(current => current.map(item => item.id === updated.id ? { ...updated, type: 'feedback' } : item));
      const nextSelected = { ...updated, type: 'feedback' };
      selectedRef.current = nextSelected;
      setSelected(nextSelected);
      setNotice(updated.status === 'Resolved' ? 'Feedback marked as resolved.' : 'Feedback status updated.');
    } catch (saveError) {
      setError(saveError.message || 'Could not update feedback status.');
    } finally {
      setSaving(false);
    }
  };
  const contactHref = selected?.contact?.includes('@') ? `mailto:${selected.contact}` : selected?.contact ? `tel:${selected.contact.replace(/[^0-9+]/g, '')}` : '';
  const requestActivity = selected?.messages || [];
  const hasStaffNote = requestActivity.some(entry => ['staff', 'admin'].includes(entry.authorRole));

  return <div className="pageStack adminPage">
    <AdminPageHeader title="Review inbox" description="Review visitor requests and answer feedback.">
      <AdminRefreshButton loading={loading} onClick={() => { setNotice(''); setLoading(true); setRefreshCount(count => count + 1); }} />
    </AdminPageHeader>
    <div className="reviewInboxTabs">
        <button type="button" className={tab === 'inquiries' ? 'active' : ''} aria-pressed={tab === 'inquiries'} disabled={loading || saving} onClick={() => openTab('inquiries')}>Requests <span>{inquiries.length}</span></button>
        <button type="button" className={tab === 'feedback' ? 'active' : ''} aria-pressed={tab === 'feedback'} disabled={loading || saving} onClick={() => openTab('feedback')}>Answer feedback <span>{feedback.length}</span></button>
        {tab === 'inquiries' && <button type="button" aria-pressed={unresolvedOnly} className={unresolvedOnly ? 'active' : ''} onClick={() => setUnresolvedOnly(value => !value)}>Unresolved only</button>}
    </div>
    {error && <div className="errorBanner">{error}</div>}
    {notice && <AdminStatus>{notice}</AdminStatus>}
    {loading ? <div className="panelBlock">Loading review inbox…</div> : visibleRows.length === 0 ? (
      <div className="panelBlock">{tab === 'inquiries' && unresolvedOnly ? 'No unresolved visitor requests.' : `No ${tab === 'inquiries' ? 'visitor requests' : 'answer feedback'} yet.`}</div>
    ) : <section className={`inquiryWorkspace${selectedIsVisible ? ' hasDetail' : ''}`}>
      <div className="inquiryList" aria-label={tab === 'inquiries' ? 'Visitor requests' : 'Answer feedback'}>
        {visibleRows.map(item => <button key={`${item.type}-${item.id}`} type="button" className={selected?.id === item.id ? 'active' : ''} onClick={() => choose(item)}>
          <div><span>{item.name || (item.helpful ? 'Helpful rating' : 'Not helpful rating')}</span><small>{item.topic || (item.model ? `Answer feedback · ${item.model}` : 'General request')}</small></div>
          <span className={`pill ${item.status === 'Resolved' || item.status === 'Appreciated' || item.status === 'Acknowledged' ? 'published' : item.status === 'Needs review' || item.status === 'Needs reply' || item.status === 'Investigating' ? 'review' : ''}`}>
            {item.status || (item.type === 'feedback' ? (item.helpful ? 'Appreciated' : 'Needs review') : 'Needs reply')}
          </span>
          <p>{item.question || 'No question text recorded'}</p>
        </button>)}
      </div>
      {selectedIsVisible && <article className="inquiryDetail">
        <header><div><span className="eyebrow">{selected.type === 'feedback' ? 'Answer feedback' : selected.routingQueue || 'MITCORER Staff Triage'}</span><h2>{selected.name || (selected.helpful ? 'Helpful answer' : 'Unhelpful answer')}</h2></div><span className={`pill ${selected.status === 'Resolved' || selected.status === 'Appreciated' || selected.status === 'Acknowledged' ? 'published' : selected.status === 'Needs review' || selected.status === 'Needs reply' || selected.status === 'Investigating' ? 'review' : ''}`}>{selected.status || (selected.type === 'feedback' ? (selected.helpful ? 'Appreciated' : 'Needs review') : selected.priority || 'Normal')}</span></header>
        <dl>
          <div><dt>Received</dt><dd>{selected.createdAt ? new Date(selected.createdAt).toLocaleString() : 'Unknown'}</dd></div>
          {selected.type === 'inquiry' ? <><div><dt>Reference</dt><dd>{selected.id}</dd></div><div><dt>Contact</dt><dd>{contactHref ? <a href={contactHref}>{selected.contact}</a> : selected.contact || 'Not provided'}</dd></div><div><dt>Assigned to</dt><dd>{selected.assignedTo || 'Unassigned'}</dd></div></> : <><div><dt>Model</dt><dd>{selected.model || 'Unknown'}</dd></div><div><dt>Vote</dt><dd>{selected.helpful ? 'Helpful' : 'Not helpful'}</dd></div></>}
        </dl>
        <section className="inquiryQuestion"><h3>Visitor’s question</h3><p>{selected.question || 'No question was recorded.'}</p></section>
        {selected.type === 'feedback' ? <>
          <div className="inquiryQuestion">
            <strong>Assistant answer</strong>
            <p>{selected.answer || 'No answer text was recorded.'}</p>
            {selected.comment && <><strong>Visitor comment</strong><p>{selected.comment}</p></>}
          </div>
          {selected.resolvedBy && <div className="staffReplyHistory">
            <div>
              <strong>{selected.resolvedBy}</strong>
              <p>{selected.resolutionNote ? `Resolution: ${selected.resolutionNote}` : `Status: ${selected.status}`}</p>
              <small>{selected.updatedAt ? new Date(selected.updatedAt).toLocaleString() : ''}</small>
            </div>
          </div>}
          <label className="staffReply">
            {selected.helpful ? 'Feedback acknowledgment status' : 'Resolution status'}
            <select value={status} onChange={event => setStatus(event.target.value)}>
              {selected.helpful
                ? ['Appreciated', 'Acknowledged', 'Reviewed'].map(v => <option key={v}>{v}</option>)
                : ['Needs review', 'Investigating', 'Resolved', 'Dismissed'].map(v => <option key={v}>{v}</option>)}
            </select>
          </label>
          <label className="staffReply">
            {selected.helpful ? 'Internal note (optional)' : 'Resolution / action taken (e.g. updated knowledge record, verified accuracy)'}
            <textarea
              rows={3}
              maxLength={1500}
              value={staffNote}
              onChange={event => setStaffNote(event.target.value)}
              placeholder={selected.helpful ? 'Record any insight or acknowledgment.' : 'Describe how the issue was investigated or resolved.'}
            />
          </label>
          <div className="inquiryActions">
            <button type="button" disabled={saving} onClick={saveFeedbackStatus}>
              {saving ? 'Saving…' : 'Save feedback status'}
            </button>
          </div>
        </> : <>
          <p className="inquiryFollowUp">Contact the visitor by phone or email using the details above. Assignments and internal notes stay in the Review Inbox.</p>
          {requestActivity.length > 0 && <section className="requestActivity" aria-label="Request activity">
            <h3>Request activity</h3>
            <ol>{requestActivity.map(entry => {
              const isSystem = entry.authorRole === 'system';
              const isStaff = ['staff', 'admin'].includes(entry.authorRole);
              const legacyEscalation = isSystem && entry.text?.startsWith('[Human Escalation from Mitra Assistant]:');
              return <li key={entry.id}>
                <strong>{isSystem ? 'MITRA system update' : isStaff ? 'Internal staff note' : entry.authorName || 'Request update'}</strong>
                <p>{legacyEscalation ? 'MITRA recorded a request for staff follow-up.' : entry.text}</p>
                {((isStaff && entry.authorName) || entry.createdAt) && <small>
                  {isStaff && entry.authorName && <span>{entry.authorName}</span>}
                  {entry.createdAt && <time dateTime={entry.createdAt}>{new Date(entry.createdAt).toLocaleString()}</time>}
                </small>}
              </li>;
            })}</ol>
          </section>}
          <label className="staffReply">Assign to staff member (name or email)<input type="text" maxLength={120} value={assignedTo} onChange={event => setAssignedTo(event.target.value)} placeholder="Enter a verified MITCORER staff contact" /></label>
          <label className="staffReply">Queue status<select value={status} onChange={event => setStatus(event.target.value)}>{['Unassigned', 'Needs reply', 'In progress', 'Resolved'].map(value => <option key={value}>{value}</option>)}</select></label>
          <label className="staffReply">Internal note<textarea rows={3} maxLength={1500} value={staffNote} onChange={event => setStaffNote(event.target.value)} placeholder="Record an action taken. This note is not sent to the visitor." /></label>
          <div className="inquiryActions"><button type="button" disabled={saving || status === 'Resolved' && !hasStaffNote && !staffNote.trim()} onClick={saveAssignment}>{saving ? 'Saving…' : 'Save request'}</button></div>
          {status === 'Resolved' && !hasStaffNote && !staffNote.trim() && <small>Add an internal note before resolving this request.</small>}
        </>}
      </article>}
    </section>}
  </div>;
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

function KnowledgeManager({ canDeleteKnowledge = false, initialTab = 'records', initialSearch = '', items, sources, onCreate, onUpdate, onDelete, onUploadSource, onOpenSource, onReviewSource, onPublishSource, onExtractStructuredSource }) {
  const [cdmExtracting, setCdmExtracting] = useState(false);
  const [cdmNotice, setCdmNotice] = useState('');
  const managedUsage = { 'KB-2': 'Public academic fee answers use this record.', 'KB-3': 'Public hostel and mess fee answers use this record.', 'KB-10': 'Public B.Tech intake answers use this record.', 'KB-6': 'Historical seat matrix answers use this record.' };
  const [editing, setEditing] = useState(null);
  const editorRef = useRef(null);
  useLayoutEffect(() => {
    if (!editing || !editorRef.current) return;
    const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    editorRef.current.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
  }, [editing]);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ title: '', category: 'Admissions', source: 'Admin verified source', text: '', status: 'Published' });
  const [sourceForm, setSourceForm] = useState({ title: '', documentType: 'Eligibility', academicYear: '2026-27', sourceAuthority: 'MITCORER / Maharashtra CET Cell', verifiedText: '' });
  const [sourceFile, setSourceFile] = useState(null);
  const [review, setReview] = useState(null);
  const [publishingSource, setPublishingSource] = useState(false);
  const [activeTab, setActiveTab] = useState(initialTab);
  const [recordSearch, setRecordSearch] = useState(initialSearch);
  const [recordCategory, setRecordCategory] = useState('All categories');
  const [recordStatus, setRecordStatus] = useState('All statuses');
  const [showRecordForm, setShowRecordForm] = useState(false);
  const [showSourceForm, setShowSourceForm] = useState(false);
  const [recordActionMessage, setRecordActionMessage] = useState('');
  const [recordActionBusy, setRecordActionBusy] = useState('');
  const filteredRecords = items
    .filter((item) => recordCategory === 'All categories' || item.category === recordCategory)
    .filter((item) => recordStatus === 'All statuses' || item.status === recordStatus)
    .filter((item) => !recordSearch.trim() || item.id.toLowerCase() === recordSearch.trim().toLowerCase() || [item.title, item.category, item.source, item.text].some((value) => String(value || '').toLowerCase().includes(recordSearch.trim().toLowerCase())))
    .sort((a, b) => `${a.category}:${a.title}`.localeCompare(`${b.category}:${b.title}`));
  const categories = [...new Set(items.map((item) => item.category).filter(Boolean))].sort((a, b) => a.localeCompare(b));
  const statuses = [...new Set(items.map((item) => item.status).filter(Boolean))].sort((a, b) => a.localeCompare(b));
  const sourcesNeedingReview = sources.filter(item => ['review', 'staged', 'conflict', 'pending', 'draft'].includes(String(item.status || '').toLowerCase())).length;
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
    if (result) setReview({
      id: source.id,
      title: source.title,
      text: result.extractedText || '',
      revision: result.revision ?? source.revision ?? 0,
      status: result.extractionStatus,
      previousVersion: result.previousVersion || null,
      conflicts: result.conflicts || [],
      freshnessImpact: result.freshnessImpact || { withheldKnowledgeIds: [] },
      syncMeta: result.syncMeta || {},
      resolveConflicts: false,
    });
  };
  const publishReview = async (event) => {
    event.preventDefault();
    if (publishingSource || !review?.text.trim()) return;
    setPublishingSource(true);
    try {
      const saved = await onPublishSource(review.id, review.text, review.resolveConflicts, review.revision);
      if (saved) setReview(current => current?.id === review.id ? null : current);
    } finally {
      setPublishingSource(false);
    }
  };
  const archiveRecord = async (item) => {
    if (recordActionBusy) return;
    setRecordActionBusy(item.id);
    setRecordActionMessage('');
    try {
      const saved = await onUpdate(item.id, { status: 'Archived', expectedRevision: item.revision ?? 0 });
      if (saved) setRecordActionMessage(`Archived “${item.title}”. You can delete it if it is not linked to an official source.`);
    } finally { setRecordActionBusy(''); }
  };
  const deleteRecord = async (item) => {
    if (recordActionBusy || !window.confirm(`Permanently delete “${item.title}”? This cannot be undone.`)) return;
    setRecordActionBusy(item.id);
    setRecordActionMessage('');
    try {
      if (await onDelete(item.id, item.revision ?? 0)) setRecordActionMessage(`Deleted “${item.title}”.`);
    } finally { setRecordActionBusy(''); }
  };
  return (
    <div className="pageStack adminPage">
      <AdminPageHeader title="Knowledge Base" description="Manage answer records and review official sources." />
      <section className="knowledgeStats"><article><span>All records</span><strong>{items.length}</strong></article><article><span>Published</span><strong>{items.filter(item => item.status === 'Published').length}</strong></article><article><span>Needs review</span><strong>{items.filter(item => /review|draft|pending/i.test(item.status || '')).length + sourcesNeedingReview}</strong></article><article><span>Official sources</span><strong>{sources.length}</strong></article></section>
      {recordActionMessage && <AdminStatus>{recordActionMessage}</AdminStatus>}
      <nav className="knowledgeTabs" aria-label="Knowledge Base sections">
        <button type="button" className={activeTab === 'records' ? 'active' : ''} onClick={() => setActiveTab('records')}>Knowledge records <span>{items.length}</span></button>
        <button type="button" className={activeTab === 'sources' ? 'active' : ''} onClick={() => setActiveTab('sources')}>Official sources <span>{sources.length}</span></button>
      </nav>
      {activeTab === 'sources' && <section className="knowledgePane">
        <div className="knowledgePaneHead"><div><h3>Official sources</h3><p>Uploaded documents and synchronized pages. Review staged changes before publishing them.</p></div><button className="knowledgePrimaryAction" type="button" onClick={() => setShowSourceForm(value => !value)}><UploadCloud size={16} />{showSourceForm ? 'Close upload form' : 'Add official source'}</button></div>
        {showSourceForm && <section className="formBlock knowledgeFormBlock"><form onSubmit={submitSource}>
          <label>Document title<input value={sourceForm.title} onChange={(event) => updateSource('title', event.target.value)} placeholder="Example: CAP Round I cutoff 2025" /></label>
          <label>Document type<select value={sourceForm.documentType} onChange={(event) => updateSource('documentType', event.target.value)}><option>Eligibility</option><option>Cutoff</option><option>Seat Matrix</option><option>Admissions</option><option>Fees</option><option>Scholarship</option><option>Programs</option><option>Facilities</option><option>Placement</option><option>Calendar</option></select></label>
          <label>Academic year<input value={sourceForm.academicYear} onChange={(event) => updateSource('academicYear', event.target.value)} placeholder="2026-27" /></label>
          <label>Source authority<input value={sourceForm.sourceAuthority} onChange={(event) => updateSource('sourceAuthority', event.target.value)} placeholder="MITCORER or Maharashtra CET Cell" /></label>
          <label className="wide">Official file<input type="file" accept=".pdf,.docx,.xlsx,.csv,.txt,image/png,image/jpeg" onChange={(event) => setSourceFile(event.target.files?.[0] || null)} /></label>
          <label className="wide">Verified extracted text (optional)<textarea rows={4} value={sourceForm.verifiedText} onChange={(event) => updateSource('verifiedText', event.target.value)} placeholder="Paste reviewed official text, or leave this empty to store the file for later extraction." /></label>
          <button type="submit" disabled={!sourceFile || !sourceForm.title.trim()}><UploadCloud size={17} /> Upload source</button>
        </form></section>}
        <div className="tableWrap sourceTable knowledgeSourceTable"><table>
          <thead><tr><th>Source</th><th>Type</th><th>Year</th><th>Authority</th><th>Extraction</th><th>Status</th><th>Actions</th></tr></thead>
          <tbody>{sources.map((item) => <tr key={item.id}><td><strong>{item.title}</strong><br /><span>{item.originalFileName || item.id}</span></td><td>{item.documentType}</td><td>{item.academicYear || '—'}</td><td>{item.sourceAuthority || '—'}</td><td>{item.extractionStatus || 'Not extracted'}{item.syncMeta?.lastCheckedAt && <><br /><small>Last checked {item.syncMeta.lastCheckedAt} · {item.syncMeta.healthStatus || 'unknown'}</small></>}</td><td><span className={`knowledgeStatus ${item.status === 'Published' ? 'published' : 'review'}`}>{item.status}</span></td><td><div className="knowledgeRowActions">{item.storedFileName ? <button type="button" onClick={() => onOpenSource(item.id)}>Open file</button> : item.sourceUrl ? <a href={item.sourceUrl} target="_blank" rel="noreferrer">Open source</a> : null}{item.status !== 'Published' && <button type="button" onClick={() => openReview(item)}>Review text</button>}</div></td></tr>)}</tbody>
        </table>{sources.length === 0 && <div className="knowledgeEmpty">No official sources have been added yet.</div>}</div>
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
          {review.syncMeta?.healthStatus === 'unreachable' && (
            <div className="decisionResult notice" role="alert" style={{ marginBottom: '1rem' }}>
              <strong>Source unavailable — publishing is blocked</strong>
              <p>The last check could not reach this official URL ({review.syncMeta.lastError || 'no response'}). Restore the source and run sync again, then review its current content. Linked answers remain withheld until the source is reachable and reviewed.</p>
            </div>
          )}
          {(review.conflicts.length > 0 || review.freshnessImpact?.withheldKnowledgeIds?.length > 0) && (
            <div className="decisionResult notice" style={{ marginBottom: '1rem' }}>
              {review.conflicts.length > 0 && <>
                <strong>Potential factual conflicts found ({review.conflicts.length})</strong>
                <p>Compare the current page with already published answers. Publishing with confirmation will archive the conflicting older records.</p>
                <ul>{review.conflicts.slice(0, 10).map((conflict, index) => (
                  <li key={`${conflict.recordId}-${index}`}>
                    <strong>Existing:</strong> {conflict.previousText}<br />
                    <strong>New page:</strong> {conflict.currentText}
                  </li>
                ))}</ul>
                {review.conflicts.length > 10 && <p>Showing 10 of {review.conflicts.length} detected comparisons.</p>}
              </>}
              {review.freshnessImpact?.withheldKnowledgeIds?.length > 0 && <p>{review.freshnessImpact.withheldKnowledgeIds.length} linked answer(s) were withheld. Compare each claim with the current official source before restoring them.</p>}
              <label className="wide">
                <input type="checkbox" checked={review.resolveConflicts} onChange={(event) => setReview((item) => ({ ...item, resolveConflicts: event.target.checked }))} />
                I reviewed the source and all listed conflicts or withheld answers, and approve the verified text for publication.
              </label>
            </div>
          )}
          {review.freshnessImpact?.withheldKnowledgeIds?.length > 0 && (
            <div className="decisionResult notice" style={{ marginBottom: '1rem' }}>
              <strong>{review.freshnessImpact.withheldKnowledgeIds.length} published answer record(s) temporarily withheld</strong>
              <p>The source page changed or could not be reached. These records are unavailable to the assistant until an administrator checks their claims against the current source and verifies them.</p>
            </div>
          )}
          {review.previousVersion?.text && (
            <details className="decisionResult" style={{ marginBottom: '1rem' }}>
              <summary>View previous captured version ({review.previousVersion.capturedAt || 'capture date unavailable'})</summary>
              <pre style={{ maxHeight: '18rem', overflow: 'auto', whiteSpace: 'pre-wrap' }}>{review.previousVersion.text}</pre>
            </details>
          )}
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
            <button type="submit" disabled={publishingSource || !review.text.trim() || review.syncMeta?.healthStatus === 'unreachable' || ((review.conflicts.length > 0 || review.freshnessImpact?.withheldKnowledgeIds?.length > 0) && !review.resolveConflicts)}><CheckCircle2 size={17} /> {publishingSource ? 'Publishing…' : 'Publish verified knowledge'}</button>
            <button className="miniEditBtn" type="button" onClick={() => { setReview(null); setCdmNotice(''); }}>Cancel</button>
          </form>
        </section>
      )}
      </section>}
      {activeTab === 'records' && <section className="knowledgePane">
        <div className="knowledgePaneHead"><div><h3>Knowledge records</h3><p>Search and filter verified answers. Expand a row to inspect the exact text used for retrieval.</p></div><button className="knowledgePrimaryAction" type="button" onClick={() => setShowRecordForm(value => !value)}><FileText size={16} />{showRecordForm ? 'Close record form' : 'Add knowledge record'}</button></div>
        <div className="knowledgeFilters"><label className="knowledgeSearch">Search records<input type="search" value={recordSearch} onChange={event => setRecordSearch(event.target.value)} placeholder="Search title, answer text, source…" /></label><label>Category<select value={recordCategory} onChange={event => setRecordCategory(event.target.value)}><option>All categories</option>{categories.map(category => <option key={category}>{category}</option>)}</select></label><label>Status<select value={recordStatus} onChange={event => setRecordStatus(event.target.value)}><option>All statuses</option>{statuses.map(status => <option key={status}>{status}</option>)}</select></label></div>
        {showRecordForm && <section className="formBlock knowledgeFormBlock"><form onSubmit={submit}>
          <label>Title<input value={form.title} onChange={(event) => update('title', event.target.value)} placeholder="Example: CAP 2026 reporting rules" /></label>
          <label>Category<select value={form.category} onChange={(event) => update('category', event.target.value)}><option>Admissions</option><option>Eligibility</option><option>Cutoff</option><option>Seat Matrix</option><option>Documents</option><option>Fees</option><option>Scholarship</option><option>Facilities</option><option>Programs</option><option>Placement</option></select></label>
          <label className="wide">Source<input value={form.source} onChange={(event) => update('source', event.target.value)} placeholder="Official page, notice or document" /></label>
          <label>Status<select value={form.status} onChange={(event) => update('status', event.target.value)}><option>Published</option><option>Review</option><option>Archived</option></select></label>
          <label className="wide">Verified text<textarea rows={5} value={form.text} onChange={(event) => update('text', event.target.value)} placeholder="Enter concise, reviewed facts and include scope such as year, branch and admission route." /></label>
          <button type="submit" disabled={creating || !form.title.trim() || !form.text.trim()}>{creating ? 'Saving…' : 'Save record'} <ArrowRight size={16} /></button>
        </form></section>}
        {editing && <div className="knowledgeEditorAnchor" ref={editorRef}><KnowledgeRecordEditor key={editing.id} record={editing} onSave={onUpdate} onCancel={() => setEditing(null)} /></div>}
        <div className="knowledgeRecordList">{filteredRecords.map(item => {
          const sourceLinked = Boolean(item.sourceDocumentId || item.provenance?.documentId || sources.some(source => (source.knowledgeIds || source.linkedKnowledgeIds || []).includes(item.id)));
          const hasSuccessor = items.some(candidate => candidate.id !== item.id && candidate.provenance?.supersededBy === item.id);
          const deleteBlockedReason = item.status === 'Published' ? 'Archive this published record before deleting it.' : sourceLinked ? 'This record is managed by an official source and cannot be deleted directly.' : hasSuccessor ? 'Another record refers to this record in its source history.' : '';
          return <article className="knowledgeRecordRow" key={item.id}>
          <div className="knowledgeRecordMain"><div className="knowledgeRecordTitle"><span className="knowledgeCategory">{item.category || 'Uncategorized'}</span><span className={`knowledgeStatus ${item.status === 'Published' ? 'published' : item.status === 'Review' ? 'review' : 'archived'}`}>{item.status}</span><small>{item.id}</small></div><h4>{item.title}</h4><p>{item.source || 'Source not specified'}</p>
            <details><summary>View indexed text</summary><div className="knowledgeRecordText">{managedUsage[item.id] && <strong>{managedUsage[item.id]}</strong>}<p>{item.text}</p></div></details>
          </div><div className="knowledgeRecordActions"><button className="knowledgeEditButton" type="button" disabled={Boolean(editing) || Boolean(recordActionBusy)} onClick={() => setEditing(item)}>Edit</button>{canDeleteKnowledge && <>{item.status === 'Published' && <button className="knowledgeArchiveButton" type="button" disabled={Boolean(recordActionBusy)} onClick={() => archiveRecord(item)}>Archive</button>}<button className="knowledgeDeleteButton" type="button" disabled={Boolean(deleteBlockedReason) || Boolean(recordActionBusy)} title={deleteBlockedReason || 'Permanently delete this record'} onClick={() => deleteRecord(item)}>{recordActionBusy === item.id ? 'Working…' : 'Delete'}</button>{deleteBlockedReason && <small className="knowledgeDeleteHint">{deleteBlockedReason}</small>}</>}</div>
        </article>;})}{filteredRecords.length === 0 && <div className="knowledgeEmpty">No records match those filters.</div>}</div>
        <footer className="knowledgeResultsCount">Showing {filteredRecords.length} of {items.length} records</footer>
      </section>}
    </div>
  );
}

export default App;
