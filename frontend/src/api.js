import { createRefreshSession } from './refresh-session.mjs';

// Production uses the same-origin Vite/Nginx/Vercel API proxy so Strict cookies
// are first-party. Direct cross-site APIs would break browser session isolation.
const API_BASE_URL = import.meta.env.VITE_API_URL || '';

async function request(path, { token, method = 'GET', body } = {}) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = payload?.error?.message || 'MITRA API request failed.';
    const error = new Error(message);
    error.status = response.status;
    throw error;
  }
  return payload.data;
}

async function upload(path, { token, formData }) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: 'POST',
    credentials: 'include',
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: formData,
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = payload?.error?.message || 'MITRA upload failed.';
    throw new Error(message);
  }
  return payload.data;
}

async function openProtectedFile(path, token) {
  const response = await fetch(`${API_BASE_URL}${path}`, { credentials: 'include', headers: { Authorization: `Bearer ${token}` } });
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload?.error?.message || 'The requested file is unavailable.');
  }
  const blob = await response.blob();
  const objectUrl = URL.createObjectURL(blob);
  window.open(objectUrl, '_blank', 'noopener,noreferrer');
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
}

export const api = {
  login: (body) => request('/api/auth/login', { method: 'POST', body }),
  signup: (body) => request('/api/auth/signup', { method: 'POST', body }),
  refresh: createRefreshSession(() => request('/api/auth/refresh', { method: 'POST' })),
  logout: () => request('/api/auth/logout', { method: 'POST' }),
  getInquiries: (token) => request('/api/inquiries', { token }),
  getConversations: (token, offset = 0) => request(`/api/conversations?offset=${offset}`, { token }),
  getConversation: (token, id) => request(`/api/conversations/${encodeURIComponent(id)}`, { token }),
  askInConversation: (token, question, conversationId) => request('/api/conversations/ask', { token, method: 'POST', body: { question, conversationId } }),
  askAssistant: (token, question) => request('/api/assistant/ask', { token, method: 'POST', body: { question } }),
  askPublicAssistant: async (question, language = 'auto', conversationId = null) => {
    try { return await request('/api/public-assistant/ask', { method: 'POST', body: { question, language, conversationId } }); }
    catch (error) {
      if (!conversationId || error.status !== 404) throw error;
      const fresh = await request('/api/public-assistant/ask', { method: 'POST', body: { question, language } });
      return { ...fresh, conversationReset: true };
    }
  },
  streamPublicAssistant: async (question, language = 'auto', conversationId = null, onToken, onMeta, onDone, onError) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/public-assistant/stream`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question, language, conversationId }),
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload?.error?.message || 'Streaming failed');
      }
      const reader = response.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let buffer = '';
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n\n');
        buffer = lines.pop();
        for (const block of lines) {
          if (!block.trim()) continue;
          const eventMatch = block.match(/^event:\s*(.+)$/m);
          const dataMatch = block.match(/^data:\s*(.+)$/m);
          const event = eventMatch ? eventMatch[1].trim() : 'message';
          const data = dataMatch ? JSON.parse(dataMatch[1]) : null;
          if (event === 'meta' && onMeta) onMeta(data);
          else if (event === 'token' && onToken) onToken(data?.delta || '');
          else if (event === 'done' && onDone) onDone(data);
          else if (event === 'error' && onError) onError(new Error(data?.message || 'Stream error'));
        }
      }
    } catch (err) {
      if (onError) onError(err);
      else throw err;
    }
  },
  resetPublicConversation: (conversationId) => request('/api/public-assistant/conversation', { method: 'DELETE', body: { conversationId } }),
  getAssistantAttachments: (token) => request('/api/assistant/attachments', { token }),
  uploadAssistantAttachment: (token, note, file) => {
    const formData = new FormData();
    formData.append('note', note);
    formData.append('file', file);
    return upload('/api/assistant/attachments/upload', { token, formData });
  },
  openAssistantAttachment: (token, id) => openProtectedFile(`/api/assistant/attachments/${id}/file`, token),
  escalateInquiry: (body) => request('/api/public/escalate', { method: 'POST', body }),
  submitFeedback: (body) => request('/api/public/feedback', { method: 'POST', body }),
  createInquiry: (token, body) => request('/api/inquiries', { token, method: 'POST', body }),
  updateInquiryStatus: (token, id, updates) => request(`/api/inquiries/${id}/status`, { token, method: 'PATCH', body: updates }),
  getFeedback: (token) => request('/api/feedback', { token }),
  getAdmissionWorkspace: (token) => request('/api/admission-workspace', { token }),
  updateAdmissionWorkspace: (token, section, value) => request('/api/admission-workspace', { token, method: 'PATCH', body: { section, value } }),
  getDocuments: (token) => request('/api/documents', { token }),
  createDocument: (token, body) => request('/api/documents', { token, method: 'POST', body }),
  uploadDocument: (token, body, file) => {
    const formData = new FormData();
    Object.entries(body).forEach(([key, value]) => formData.append(key, value));
    formData.append('file', file);
    return upload('/api/documents/upload', { token, formData });
  },
  submitDocuments: (token) => request('/api/documents/submit', { token, method: 'POST' }),
  updateDocumentStatus: (token, id, status, reviewNote = '') => request(`/api/documents/${id}/status`, { token, method: 'PATCH', body: { status, reviewNote } }),
  deleteDocument: (token, id) => request(`/api/documents/${id}`, { token, method: 'DELETE' }),
  openDocument: (token, id) => openProtectedFile(`/api/documents/${id}/file`, token),
  getContent: (token) => request('/api/content', { token }),
  createContent: (token, body) => request('/api/content', { token, method: 'POST', body }),
  updateContent: (token, id, body) => request(`/api/content/${id}`, { token, method: 'PATCH', body }),
  getKnowledge: (token) => request('/api/knowledge', { token }),
  createKnowledge: (token, body) => request('/api/knowledge', { token, method: 'POST', body }),
  updateKnowledge: (token, id, body) => request(`/api/knowledge/${encodeURIComponent(id)}`, { token, method: 'PATCH', body }),
  deleteKnowledge: (token, id, body) => request(`/api/knowledge/${encodeURIComponent(id)}`, { token, method: 'DELETE', body }),
  getOfficialSources: (token) => request('/api/official-sources', { token }),
  uploadOfficialSource: (token, body, file) => {
    const formData = new FormData();
    Object.entries(body).forEach(([key, value]) => formData.append(key, value));
    formData.append('file', file);
    return upload('/api/official-sources/upload', { token, formData });
  },
  getOfficialSourceExtractedText: (token, id) => request(`/api/official-sources/${id}/extracted-text`, { token }),
  publishOfficialSource: (token, id, verifiedText, resolveConflicts = false) => request(`/api/official-sources/${id}/publish`, { token, method: 'PATCH', body: { verifiedText, resolveConflicts } }),
  extractStructuredOfficialSource: (token, id) => request(`/api/official-sources/${id}/extract-structured`, { token, method: 'POST' }),
  openOfficialSource: (token, id) => openProtectedFile(`/api/official-sources/${id}/file`, token),
  syncOfficialSources: (token) => request('/api/official-sources/sync', { token, method: 'POST' }),
  getReports: (token) => request('/api/reports', { token }),
  getAuditLogs: (token) => request('/api/audit-logs', { token }),
  getPublicFacts: () => request('/api/public-facts'),
};
