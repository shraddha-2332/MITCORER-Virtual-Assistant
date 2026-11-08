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
import mitcorerCampus from './assets/mitcorer-campus.png';
import { api } from './api.js';
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

  const publishOfficialSource = async (id, verifiedText, resolveConflicts = false) => {
    setAppError('');
    try {
      const saved = await api.publishOfficialSource(token, id, verifiedText, resolveConflicts);
      setOfficialSources((items) => items.map((item) => (item.id === id ? saved : item)));
      const knowledgeResult = await api.getKnowledge(token);
      setKnowledge(knowledgeResult.items || []);
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
      setView('overview');
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
          {view === 'overview' && <AdminOverview user={user} token={token} knowledge={knowledge} sources={officialSources} setView={navigateTo} onOpenSources={() => { setKnowledgeInitialTab('sources'); navigateTo('knowledge'); }} onSyncWebsite={syncOfficialSources} />}
          {view === 'knowledge' && <KnowledgeManager canDeleteKnowledge={user.role === 'admin'} initialTab={knowledgeInitialTab} items={knowledge} sources={officialSources} onCreate={createKnowledgeItem} onUpdate={updateKnowledgeItem} onDelete={deleteKnowledgeItem} onUploadSource={uploadOfficialSource} onOpenSource={openOfficialSource} onReviewSource={reviewOfficialSource} onPublishSource={publishOfficialSource} onSyncWebsite={syncOfficialSources} onExtractStructuredSource={extractStructuredOfficialSource} />}
          {view === 'inquiries' && <ReviewInbox token={token} />}
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
  const [submissionId, setSubmissionId] = useState('');
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
      : 'Submitting saves your request to the MITCORER staff triage queue. It is not automatically assigned to a named counselor or sent by email/SMS. For urgent help, call one of the numbers below:';

  return (
    <div className="escalationCard" role="region" aria-label="MITCORER staff inquiry">
      <div className="escalationCardHeader">
        <Phone size={13} aria-hidden="true" />
        <span>{headerTitle}</span>
      </div>
      <p className="escalationCardPrompt">{promptText}</p>
      {language === 'en' && <div className="escalationVerifiedContacts" aria-label="Verified MITCORER admission desk contacts">
        <span>Admission Enquiry Desk</span>
        <a href="tel:+918459967882">+91 84599 67882</a>
        <a href="tel:+918669662106">+91 86696 62106</a>
        <a href="mailto:info.mitcorer@mitpune.edu.in">info.mitcorer@mitpune.edu.in</a>
      </div>}
      {submitted ? (
        <div className="escalationSuccess">
          <CheckCircle2 size={14} />
          <span>
            {language === 'mr'
    ? `तुमची विनंती ${submissionId ? `(${submissionId}) ` : ''}MITCORER कर्मचाऱ्यांच्या पुनरावलोकनासाठी नोंदवली आहे. कोणताही विशिष्ट सल्लागार आपोआप नियुक्त झालेला नाही. तातडीसाठी वरील क्रमांकांवर कॉल करा.`
              : language === 'hi'
      ? `आपका अनुरोध ${submissionId ? `(${submissionId}) ` : ''}MITCORER कर्मचारी समीक्षा कतार में दर्ज किया गया है। कोई विशेष परामर्शदाता अपने आप नियुक्त नहीं हुआ है। तत्काल सहायता के लिए ऊपर दिए गए नंबरों पर कॉल करें।`
                : `Your inquiry${submissionId ? ` (${submissionId})` : ''} was saved to the MITCORER staff triage queue. No individual counselor was assigned automatically. For urgent help, please call one of the numbers above.`}
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

function AdminOverview({ user, token, knowledge, sources, setView, onOpenSources, onSyncWebsite }) {
  const [reviewCounts, setReviewCounts] = useState({ inquiries: null, feedback: null });
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState('');

  useEffect(() => {
    let active = true;
    Promise.all([api.getInquiries(token), api.getFeedback(token)])
      .then(([inquiryResult, feedbackResult]) => {
        if (active) setReviewCounts({ inquiries: inquiryResult.items?.length || 0, feedback: feedbackResult.items?.length || 0 });
      })
      .catch(() => { if (active) setReviewCounts({ inquiries: null, feedback: null }); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [token]);

  const publishedKnowledge = knowledge.filter(item => item.status === 'Published').length;
  const needsReview = sources.filter(item => {
    const state = `${item.status || ''} ${item.extractionStatus || ''}`.toLowerCase();
    return /review|staged|conflict|pending|extract/.test(state);
  }).length;
  const pendingSources = sources.filter(item => /review|staged|conflict|pending|extract/i.test(`${item.status || ''} ${item.extractionStatus || ''}`)).slice(0, 5);
  const launchSync = async () => {
    if (syncing) return;
    setSyncing(true);
    setSyncMessage('');
    try {
      const result = await onSyncWebsite();
      if (result) setSyncMessage(`Sync checked ${result.checked} pages: ${result.changed} staged for review, ${result.conflictCount || 0} conflicts flagged, ${result.unchanged} unchanged.`);
    } finally { setSyncing(false); }
  };

  return <div className="pageStack adminDashboard">
    <section className="adminWelcome">
      <div><span className="eyebrow">MITCORER · Staff workspace</span><h2>Welcome, {user.name.split(' ')[0]}</h2><p>Manage verified assistant knowledge and review what visitors send to the college.</p></div>
      <button type="button" onClick={launchSync} disabled={syncing}><RefreshCw size={16} />{syncing ? 'Checking website…' : 'Sync official website'}</button>
    </section>
    {syncMessage && <div className="decisionResult positive"><strong>{syncMessage}</strong></div>}
    <section className="adminMetricGrid" aria-label="Workspace summary">
      <article><span>Published knowledge</span><strong>{publishedKnowledge}</strong><small>of {knowledge.length} knowledge records</small></article>
      <article><span>Sources to review</span><strong>{needsReview}</strong><small>staged pages, files or conflicts</small></article>
      <article><span>Visitor requests</span><strong>{loading ? '…' : reviewCounts.inquiries ?? '—'}</strong><small>saved in the review inbox</small></article>
      <article><span>Answer ratings</span><strong>{loading ? '…' : reviewCounts.feedback ?? '—'}</strong><small>visitor helpful / not helpful votes</small></article>
    </section>
    <section className="adminDashboardGrid">
      <article className="adminActionPanel">
        <div className="sectionHead"><span className="eyebrow">Daily work</span><h2>Workspace shortcuts</h2><p>Start with the tasks that maintain answer quality.</p></div>
        <div className="adminShortcutList">
          <button type="button" onClick={() => setView('knowledge')}><FileText size={19} /><span><strong>Manage verified knowledge</strong><small>Edit records and review official sources</small></span><ArrowRight size={16} /></button>
          <button type="button" onClick={() => setView('inquiries')}><Phone size={19} /><span><strong>Review visitor messages</strong><small>Assign, track and contact requesters</small></span><ArrowRight size={16} /></button>
          <button type="button" onClick={() => setView('inquiries')}><ThumbsDown size={19} /><span><strong>Inspect answer feedback</strong><small>Find answers visitors marked unhelpful</small></span><ArrowRight size={16} /></button>
          <button type="button" onClick={onOpenSources}><FileText size={19} /><span><strong>Review official sources</strong><small>Check indexed pages, files and source updates</small></span><ArrowRight size={16} /></button>
        </div>
      </article>
      <article className="adminActionPanel">
        <div className="sectionHead"><span className="eyebrow">Source review</span><h2>Needs attention</h2><p>Review staged website changes and document extraction before they become trusted answers.</p></div>
        {pendingSources.length ? <div className="adminPendingList">{pendingSources.map(item => <div key={item.id}><span className="statusDot" /><span><strong>{item.title}</strong><small>{item.status || item.extractionStatus || 'Needs review'}</small></span></div>)}<button type="button" onClick={onOpenSources}>Open source review <ArrowRight size={15} /></button></div> : <div className="adminAllClear"><CheckCircle2 size={20} /><span><strong>No staged sources found</strong><small>New source changes will appear here for review.</small></span></div>}
      </article>
    </section>
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
    <aside className={`sidebar ${navOpen ? 'open' : ''} ${collapsed ? 'collapsed' : ''}`}>
      <div className="sidebarBrandRow">
        <div className="brandLockup compact"><span className="collegeLogo"><img src={mitcorerLogo} alt="MITCORER logo" /></span><div><strong>MITCORER</strong><small>Admin workspace</small></div></div>
        <button className="sidebarToggle" type="button" onClick={toggleCollapsed} aria-label={collapsed ? 'Open sidebar' : 'Close sidebar'} title={collapsed ? 'Open sidebar' : 'Close sidebar'}>{collapsed ? <PanelLeftOpen size={19} /> : <PanelLeftClose size={19} />}</button>
      </div>
      <nav className="sideNav" aria-label="Admin workspace">
        <button className={view === 'overview' ? 'active' : ''} type="button" onClick={() => openView('overview')} title={collapsed ? 'Overview' : undefined} aria-label={collapsed ? 'Overview' : undefined}><LayoutDashboard size={17} /><span>Overview</span></button>
        <button className={view === 'knowledge' ? 'active' : ''} type="button" onClick={() => openView('knowledge')} title={collapsed ? 'Knowledge Base' : undefined} aria-label={collapsed ? 'Knowledge Base' : undefined}>
          <FileText size={17} /><span>Knowledge Base</span>
        </button>
        {['staff', 'admin'].includes(user.role) && <button className={view === 'inquiries' ? 'active' : ''} type="button" onClick={() => openView('inquiries')} title={collapsed ? 'Review inbox' : undefined} aria-label={collapsed ? 'Review inbox' : undefined}>
          <Phone size={17} /><span>Review inbox</span>
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

function ReviewInbox({ token }) {
  const [inquiries, setInquiries] = useState([]);
  const [feedback, setFeedback] = useState([]);
  const [selected, setSelected] = useState(null);
  const selectedRef = useRef(null);
  const [tab, setTab] = useState('inquiries');
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
        if (!initial && !previous) {
          const first = nextInquiries[0] || nextFeedback[0] || null;
          initial = first ? { ...first, type: first.question && 'helpful' in first ? 'feedback' : 'inquiry' } : null;
        }
        setSelected(initial);
        selectedRef.current = initial;
        if (initial?.type === 'inquiry') { setStatus(initial.status || 'Needs reply'); setAssignedTo(initial.assignedTo || ''); }
        setError('');
      }).catch(loadError => setError(loadError.message || 'Could not load the review inbox.'))
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [token, refreshCount]);
  const allRows = [
    ...inquiries.map(item => ({ ...item, type: 'inquiry' })),
    ...feedback.map(item => ({ ...item, type: 'feedback', topic: item.helpful ? 'Helpful answer' : 'Unhelpful answer' })),
  ].sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
  const visibleRows = allRows.filter(item => tab === 'inquiries' ? item.type === 'inquiry' : item.type === 'feedback');
  const choose = (item) => { selectedRef.current = item; setSelected(item); setStatus(item.status || 'Needs reply'); setAssignedTo(item.assignedTo || ''); setStaffNote(''); setNotice(''); };
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
      setNotice('Saved. Assignment is internal only; this does not email/text the submitter or assignee.');
    } catch (saveError) { setError(saveError.message || 'Could not update this inquiry.'); }
    finally { setSaving(false); }
  };
  const contactHref = selected?.contact?.includes('@') ? `mailto:${selected.contact}` : selected?.contact ? `tel:${selected.contact.replace(/[^0-9+]/g, '')}` : '';
  const hasStaffResponse = (selected?.messages || []).some(entry => ['staff', 'admin'].includes(entry.authorRole));

  return <div className="pageStack">
    <div className="sectionHead">
      <span className="eyebrow">Staff review</span>
      <h2>Review inbox</h2>
      <p>One place for visitor requests and answer ratings. Requests are stored locally in the application database; they are not automatically emailed or assigned.</p>
      <div className="reviewInboxTabs">
        <button type="button" className={tab === 'inquiries' ? 'active' : ''} onClick={() => setTab('inquiries')}>Requests <span>{inquiries.length}</span></button>
        <button type="button" className={tab === 'feedback' ? 'active' : ''} onClick={() => setTab('feedback')}>Answer feedback <span>{feedback.length}</span></button>
        <button className="inlineAction secondary" type="button" disabled={loading} onClick={() => { setLoading(true); setRefreshCount(count => count + 1); }}><RefreshCw size={15} /> Refresh</button>
      </div>
    </div>
    {error && <div className="errorBanner">{error}</div>}
    {notice && <div className="decisionResult positive"><strong>{notice}</strong></div>}
    {loading ? <div className="panelBlock">Loading review inbox?</div> : visibleRows.length === 0 ? (
      <div className="panelBlock">No {tab === 'inquiries' ? 'visitor requests' : 'answer feedback'} yet.</div>
    ) : <section className="inquiryWorkspace">
      <div className="inquiryList" aria-label={tab === 'inquiries' ? 'Visitor requests' : 'Answer feedback'}>
        {visibleRows.map(item => <button key={`${item.type}-${item.id}`} type="button" className={selected?.id === item.id ? 'active' : ''} onClick={() => choose(item)}>
          <div><span>{item.name || (item.helpful ? 'Helpful rating' : 'Not helpful rating')}</span><small>{item.topic || (item.model ? `Answer feedback ? ${item.model}` : 'General request')}</small></div>
          <span className="pill">{item.type === 'feedback' ? (item.helpful ? 'Helpful' : 'Not helpful') : item.status}</span>
          <p>{item.question || 'No question text recorded'}</p>
        </button>)}
      </div>
      {selected && <article className="inquiryDetail">
        <header><div><span className="eyebrow">{selected.type === 'feedback' ? 'Answer feedback' : selected.routingQueue || 'MITCORER Staff Triage'}</span><h2>{selected.name || (selected.helpful ? 'Helpful answer' : 'Unhelpful answer')}</h2></div><span className="pill">{selected.type === 'feedback' ? (selected.helpful ? 'Helpful' : 'Not helpful') : selected.priority || 'Normal'}</span></header>
        <dl>
          <div><dt>Received</dt><dd>{selected.createdAt ? new Date(selected.createdAt).toLocaleString() : 'Unknown'}</dd></div>
          {selected.type === 'inquiry' ? <><div><dt>Reference</dt><dd>{selected.id}</dd></div><div><dt>Contact</dt><dd>{contactHref ? <a href={contactHref}>{selected.contact}</a> : selected.contact || 'Not provided'}</dd></div><div><dt>Assigned to</dt><dd>{selected.assignedTo || 'Unassigned'}</dd></div></> : <><div><dt>Model</dt><dd>{selected.model || 'Unknown'}</dd></div><div><dt>Vote</dt><dd>{selected.helpful ? 'Helpful' : 'Not helpful'}</dd></div></>}
        </dl>
        <div className="inquiryQuestion"><strong>Visitor question</strong><p>{selected.question || 'No question was recorded.'}</p></div>
        {selected.type === 'feedback' ? <div className="inquiryQuestion"><strong>Assistant answer</strong><p>{selected.answer || 'No answer text was recorded.'}</p>{selected.comment && <><strong>Visitor comment</strong><p>{selected.comment}</p></>}</div> : <>
          {(selected.messages || []).length > 0 && <div className="staffReplyHistory">{selected.messages.map(entry => <div key={entry.id}><strong>{entry.authorName || entry.authorRole}</strong><p>{entry.text}</p><small>{entry.createdAt ? new Date(entry.createdAt).toLocaleString() : ''}</small></div>)}</div>}
          <label className="staffReply">Assign to staff member (name or email)<input type="text" maxLength={120} value={assignedTo} onChange={event => setAssignedTo(event.target.value)} placeholder="Enter a verified MITCORER staff contact" /></label>
          <label className="staffReply">Queue status<select value={status} onChange={event => setStatus(event.target.value)}>{['Unassigned', 'Needs reply', 'In progress', 'Resolved'].map(value => <option key={value}>{value}</option>)}</select></label>
          <label className="staffReply">Internal note<textarea rows={3} maxLength={1500} value={staffNote} onChange={event => setStaffNote(event.target.value)} placeholder="Record an action taken. This note is not sent to the visitor." /></label>
          <div className="inquiryActions"><button type="button" disabled={saving || status === 'Resolved' && !hasStaffResponse && !staffNote.trim()} onClick={saveAssignment}>{saving ? 'Saving?' : 'Save request'}</button></div>
          {status === 'Resolved' && !hasStaffResponse && !staffNote.trim() && <small>Add an internal note before resolving this request.</small>}
          <small>Use the displayed contact details to respond. Saving an assignment does not notify anyone automatically.</small>
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

function KnowledgeManager({ canDeleteKnowledge = false, initialTab = 'records', items, sources, onCreate, onUpdate, onDelete, onUploadSource, onOpenSource, onReviewSource, onPublishSource, onSyncWebsite, onExtractStructuredSource }) {
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
  const [activeTab, setActiveTab] = useState(initialTab);
  const [recordSearch, setRecordSearch] = useState('');
  const [recordCategory, setRecordCategory] = useState('All categories');
  const [recordStatus, setRecordStatus] = useState('All statuses');
  const [showRecordForm, setShowRecordForm] = useState(false);
  const [showSourceForm, setShowSourceForm] = useState(false);
  const [recordActionMessage, setRecordActionMessage] = useState('');
  const [recordActionBusy, setRecordActionBusy] = useState('');
  const filteredRecords = items
    .filter((item) => recordCategory === 'All categories' || item.category === recordCategory)
    .filter((item) => recordStatus === 'All statuses' || item.status === recordStatus)
    .filter((item) => !recordSearch.trim() || [item.title, item.category, item.source, item.text].some((value) => String(value || '').toLowerCase().includes(recordSearch.trim().toLowerCase())))
    .sort((a, b) => `${a.category}:${a.title}`.localeCompare(`${b.category}:${b.title}`));
  const categories = [...new Set(items.map((item) => item.category).filter(Boolean))].sort((a, b) => a.localeCompare(b));
  const statuses = [...new Set(items.map((item) => item.status).filter(Boolean))].sort((a, b) => a.localeCompare(b));
  const sourcesNeedingReview = sources.filter(item => /review|staged|conflict|pending|extract/i.test(`${item.status || ''} ${item.extractionStatus || ''}`)).length;
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
      status: result.extractionStatus,
      previousVersion: result.previousVersion || null,
      conflicts: result.conflicts || [],
      freshnessImpact: result.freshnessImpact || { withheldKnowledgeIds: [] },
      resolveConflicts: false,
    });
  };
  const publishReview = async (event) => {
    event.preventDefault();
    if (!review?.text.trim()) return;
    const saved = await onPublishSource(review.id, review.text, review.resolveConflicts);
    if (saved) setReview(null);
  };
  const handleSync = async () => {
    if (syncing || !onSyncWebsite) return;
    setSyncing(true);
    setSyncStatus('');
    try {
      const summary = await onSyncWebsite();
      if (summary) {
        setSyncStatus(`Website sync complete: ${summary.checked} pages checked${summary.discovered ? ` (${summary.discovered} discovered)` : ''}, ${summary.changed} updates staged for review, ${summary.conflictCount || 0} potential numeric conflicts flagged, ${summary.suspendedRecords || 0} conflicting knowledge records withheld pending review, ${summary.baselined || 0} monitoring baselines recorded, ${summary.unchanged} unchanged.`);
      }
    } finally {
      setSyncing(false);
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
    <div className="pageStack knowledgeManager">
      <header className="knowledgeHeader"><div><span className="eyebrow">Assistant knowledge</span><h2>Knowledge Base</h2><p>Keep visitor answers organized, traceable to official sources, and ready for retrieval.</p></div><button className="knowledgeSyncButton" type="button" disabled={syncing} onClick={handleSync}><RefreshCw size={16} />{syncing ? 'Syncing official site…' : 'Sync official site'}</button></header>
      <section className="knowledgeStats"><article><span>All records</span><strong>{items.length}</strong></article><article><span>Published</span><strong>{items.filter(item => item.status === 'Published').length}</strong></article><article><span>Needs review</span><strong>{items.filter(item => /review|draft|pending/i.test(item.status || '')).length + sourcesNeedingReview}</strong></article><article><span>Official sources</span><strong>{sources.length}</strong></article></section>
      {syncStatus && <div className="decisionResult positive"><strong>{syncStatus}</strong></div>}
      {recordActionMessage && <div className="decisionResult positive" role="status"><strong>{recordActionMessage}</strong></div>}
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
          <tbody>{sources.map((item) => <tr key={item.id}><td><strong>{item.title}</strong><br /><span>{item.originalFileName || item.id}</span></td><td>{item.documentType}</td><td>{item.academicYear || '—'}</td><td>{item.sourceAuthority || '—'}</td><td>{item.extractionStatus || 'Not extracted'}</td><td><span className={`knowledgeStatus ${item.status === 'Published' ? 'published' : 'review'}`}>{item.status}</span></td><td><div className="knowledgeRowActions">{item.storedFileName ? <button type="button" onClick={() => onOpenSource(item.id)}>Open file</button> : item.sourceUrl ? <a href={item.sourceUrl} target="_blank" rel="noreferrer">Open source</a> : null}{item.status !== 'Published' && <button type="button" onClick={() => openReview(item)}>Review text</button>}</div></td></tr>)}</tbody>
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
          {review.conflicts.length > 0 && (
            <div className="decisionResult notice" style={{ marginBottom: '1rem' }}>
              <strong>Potential factual conflicts found ({review.conflicts.length})</strong>
              <p>Compare the current page with already published answers. Publishing with confirmation will archive the conflicting older records.</p>
              <ul>{review.conflicts.slice(0, 10).map((conflict, index) => (
                <li key={`${conflict.recordId}-${index}`}>
                  <strong>Existing:</strong> {conflict.previousText}<br />
                  <strong>New page:</strong> {conflict.currentText}
                </li>
              ))}</ul>
              {review.conflicts.length > 10 && <p>Showing 10 of {review.conflicts.length} detected comparisons.</p>}
              <label className="wide">
                <input type="checkbox" checked={review.resolveConflicts} onChange={(event) => setReview((item) => ({ ...item, resolveConflicts: event.target.checked }))} />
                I reviewed these comparisons and approve this version as the source to publish.
              </label>
            </div>
          )}
          {review.freshnessImpact?.withheldKnowledgeIds?.length > 0 && (
            <div className="decisionResult notice" style={{ marginBottom: '1rem' }}>
              <strong>{review.freshnessImpact.withheldKnowledgeIds.length} published answer record(s) temporarily withheld</strong>
              <p>They contain numeric claims that changed or disappeared on this page. This prevents a possibly stale value from being returned while you review the source.</p>
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
            <button type="submit" disabled={!review.text.trim() || (review.conflicts.length > 0 && !review.resolveConflicts)}><CheckCircle2 size={17} /> Publish verified knowledge</button>
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
        {editing && <KnowledgeRecordEditor key={editing.id} record={editing} onSave={onUpdate} onCancel={() => setEditing(null)} />}
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
