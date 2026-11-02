import http from 'node:http';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { config } from './config.js';
import { requestGeneration } from './generation-client.js';
import { askWithHistory, askPublicWithHistory, getConversation, listConversations, resetPublicConversation, extractConversationContext, prunePublicConversations } from './conversations.js';
import { readPublicSession, createPublicSession, publicSessionCookie } from './public-session.js';
import { validateKnowledgeFields, buildMaintainedAnswer, academicFeeSelection, parseLegacyFactText, extractPublicFacts } from './knowledge.js';
import { selectLanguage, localizeResponse, buildReviewedPassage } from './language.js';
import { buildClarificationAnswer, buildCompoundAnswer, buildContextualPassage } from './question-plan.js';
import { publicEvidence } from './evidence.js';
import { normalizeQuery, matchesIntent, understandQuery, isEmploymentQuery } from './query-understanding.js';
import { asksForAllPrograms } from './query-scope.js';
import { resolveSourceUrl, sourceRecord, uniqueSourceLinks } from './source-links.js';
import { availability, usableKnowledge, validateProvenance, validateSupersession, confirmSourceReview, splitPassage } from './provenance.js';
import { createRefreshToken, createToken, getBearerToken, hashPassword, hashToken, requireAuth, requireRole, verifyPassword, verifyToken, canAccessApplicantRecord } from './auth.js';
import { badRequest, forbidden, HttpError, notFound, tooManyRequests, unauthorized } from './errors.js';
import { getDb, loadDb, saveDb, checkStorageReady } from './store.js';
import { generateId, jsonResponse, nowIso, pick, requireString } from './utils.js';
import { verifyGeneratedAnswer, classifyAnswerOutcome, verifySlotGrounding } from './grounding.js';
import { syncMonitoredWebsiteSources } from './website-sync.js';
import { computeConceptScore, getSemanticVectorScores, syncKnowledgeVectorIndex } from './semantic.js';

const publicRoutes = new Set([
  'GET /api/health',
  'GET /api/ready',
  'GET /api/public-facts',
  'POST /api/auth/login',
  'POST /api/auth/signup',
  'POST /api/auth/refresh',
  'POST /api/auth/logout',
  'POST /api/public-assistant/ask',
  'DELETE /api/public-assistant/conversation',
  'POST /api/public/inquiries',
  'POST /api/public/escalate',
  'POST /api/public/feedback',
]);
const allowedRoles = ['applicant', 'parent', 'staff', 'admin'];
const authAttempts = new Map();
const loginIpAttempts = new Map();
const signupIpAttempts = new Map();
const assistantAttempts = new Map();
const publicAssistantAttempts = new Map();
const uploadDir = path.resolve(process.cwd(), 'uploads');
const officialSourceDir = path.resolve(process.cwd(), 'official-sources');
const allowedMimeTypes = new Set(['application/pdf', 'image/jpeg', 'image/png']);
const allowedOfficialMimeTypes = new Set([
  ...allowedMimeTypes,
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/csv',
  'text/plain',
]);
const extensionByMimeType = {
  'application/pdf': ['.pdf'],
  'image/jpeg': ['.jpg', '.jpeg'],
  'image/png': ['.png'],
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
  'text/csv': ['.csv'],
  'text/plain': ['.txt'],
};

export function resetRuntimeStateForTests() {
  authAttempts.clear();
  loginIpAttempts.clear();
  signupIpAttempts.clear();
  assistantAttempts.clear();
  publicAssistantAttempts.clear();
}
const assistantRules = [
  { match: ['direct admission', 'management quota', 'acap', 'institute level', 'institute-level', 'vacancy'], source: 'Institute-level admission notices', answer: 'Institute-level and ACAP admission follow the published schedule, merit list, vacancy notice, and applicable rules. They are separate from a CAP allotment and cannot guarantee a seat before the current notice is checked.', next: 'Open the ACAP notice and check the current schedule, merit list, and vacancy record.', actionView: 'cap', actionLabel: 'Check ACAP notices' },
  { match: ['cutoff', 'cut-off', 'closing percentile', 'closing rank'], source: 'Historical cutoff records', answer: 'Cutoffs must be matched by academic year, round, branch, exam, category, seat type, and candidature. Historical values support preference planning but do not guarantee current admission.', next: 'Specify the year, CAP round, branch, category, seat type, and whether the score is MHT-CET or JEE.', actionView: 'cap', actionLabel: 'Check CAP history' },
  { match: ['scholarship', 'ebc', 'ews', 'tfws', 'income', 'concession'], source: 'Scholarship readiness', answer: 'Scholarship fit depends on category, income, admission route, and required proof. Prepare documents before reporting.', next: 'Open scholarship readiness and check likely routes.', actionView: 'scholarships', actionLabel: 'Open scholarship' },
  { match: ['eligible', 'eligibility', 'percentile', 'cse', 'computer science', 'civil', 'mechanical', 'railway', 'ai', 'data science', 'entc', 'electronics'], source: 'Engineering eligibility and branch allotment guidance', answer: 'A CET or JEE percentile alone cannot confirm engineering branch admission. Basic eligibility and branch allotment are separate checks.', next: 'Share your category, candidature, qualifying-examination subjects and marks, admission route, and CAP round for a more useful assessment.', actionView: 'programs', actionLabel: 'Check programs' },
  { match: ['document', 'certificate', 'upload', 'validity', 'marksheet'], source: 'Document workflow', answer: 'Upload documents against the checklist. Staff can mark each record as ready or needing correction before reporting.', next: 'Open document checklist and upload the matching file.', actionView: 'documents', actionLabel: 'Open documents' },
  { match: ['cap', 'allotment', 'freeze', 'betterment', 'reporting'], source: 'Admission CAP workflow', answer: 'Use the CAP workflow to identify your current round, freeze/betterment choice, and reporting readiness before travelling.', next: 'Open CAP tracker and complete the reporting readiness checklist.', actionView: 'cap', actionLabel: 'Open CAP tracker' },
  { match: ['fee', 'fees', 'payment', 'amount', 'installment'], source: 'Fee planner', answer: 'Use the fee planner to estimate academic, hostel, and mess amount by admission type and category.', next: 'Open fee planner and verify scholarship/category documents before payment.', actionView: 'fees', actionLabel: 'Open fee planner' },
  { match: ['branch', 'program', 'course', 'choice code', 'preference'], source: 'Program finder', answer: 'Compare branches and build a draft preference order before CAP option form or institute-level discussion.', next: 'Open program finder and create preference draft.', actionView: 'programs', actionLabel: 'Open programs' },
  { match: ['placement', 'company', 'career', 'package'], source: 'Career outcome guidance', answer: 'Placement data should support branch decision, but does not guarantee outcome. Check branch-goal fit and preparation path.', next: 'Open placement readiness.', actionView: 'placements', actionLabel: 'Open placement' },
  { match: ['hostel', 'mess', 'room', 'bus', 'transport', 'stay'], source: 'Hostel and mess planning', answer: 'Estimate stay cost and confirm room availability, mess charges, transport route, and rules before travelling.', next: 'Open hostel and mess estimator.', actionView: 'visit', actionLabel: 'Open hostel & mess' },
];

export function normalizeIntentText(text) {
  return normalizeQuery(text);
}


function audit(action, resourceType, resourceId, user, details = '') {
  const db = getDb();
  db.auditLogs = db.auditLogs || [];
  db.auditLogs.unshift({
    id: generateId('AUD'),
    actorEmail: user?.email || 'anonymous',
    actorRole: user?.role || 'anonymous',
    action,
    resourceType,
    resourceId,
    details,
    createdAt: nowIso(),
  });
  db.auditLogs = db.auditLogs.slice(0, 500);
  if (action !== 'assistant.asked') saveDb();
}

function enforceRateLimit(bucket, key, maxRequests, windowMs) {
  const now = Date.now();
  if (bucket.size > 5000) {
    for (const [k, timestamps] of bucket.entries()) {
      if (!timestamps.some((t) => t > now - windowMs)) bucket.delete(k);
    }
  }
  const recent = (bucket.get(key) || []).filter((timestamp) => timestamp > now - windowMs);
  if (recent.length >= maxRequests) throw tooManyRequests();
  recent.push(now);
  bucket.set(key, recent);
}

function routeKey(req) {
  return `${req.method} ${new URL(req.url, 'http://localhost').pathname}`;
}

async function readJson(req) {
  if (!['POST', 'PATCH', 'PUT', 'DELETE'].includes(req.method)) return {};
  const chunks = [];
  let size = 0;
  const maxJsonBytes = 256 * 1024;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > maxJsonBytes) throw badRequest('Request body is too large.');
    chunks.push(chunk);
  }
  if (chunks.length === 0) return {};
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    throw badRequest('Request body must be valid JSON.');
  }
}

async function readRawBody(req) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > config.maxBodyBytes) throw badRequest('Request body is too large.');
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

function sanitizeFileName(fileName) {
  return path.basename(String(fileName || 'upload.bin')).replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 120);
}

function fileHasExpectedSignature(file) {
  const extension = path.extname(file.filename).toLowerCase();
  if (!extensionByMimeType[file.mimeType]?.includes(extension)) return false;
  if (file.mimeType === 'application/pdf') return file.content.subarray(0, 5).toString('ascii') === '%PDF-';
  if (file.mimeType === 'image/jpeg') return file.content.length >= 3 && file.content[0] === 0xff && file.content[1] === 0xd8 && file.content[2] === 0xff;
  if (file.mimeType === 'image/png') return file.content.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  if (file.mimeType.includes('openxmlformats')) return file.content.subarray(0, 2).equals(Buffer.from('PK'));
  return true;
}

function assertAllowedUpload(file, allowedTypes, message) {
  if (!file) throw badRequest('A file is required.');
  if (!allowedTypes.has(file.mimeType) || !fileHasExpectedSignature(file)) throw badRequest(message);
  if (file.content.length === 0) throw badRequest('Uploaded file is empty.');
}

function parseMultipart(req, bodyBuffer) {
  const contentType = req.headers['content-type'] || '';
  const boundary = contentType.match(/boundary=(?:"([^"]+)"|([^;]+))/)?.[1] || contentType.match(/boundary=(?:"([^"]+)"|([^;]+))/)?.[2];
  if (!boundary) throw badRequest('Multipart boundary is missing.');
  const body = bodyBuffer.toString('binary');
  const parts = body.split(`--${boundary}`).slice(1, -1);
  const fields = {};
  const files = {};

  for (const part of parts) {
    const trimmed = part.replace(/^\r\n/, '').replace(/\r\n$/, '');
    const separator = trimmed.indexOf('\r\n\r\n');
    if (separator < 0) continue;
    const rawHeaders = trimmed.slice(0, separator);
    const rawContent = trimmed.slice(separator + 4);
    const disposition = rawHeaders.match(/content-disposition:\s*form-data;([^\r\n]+)/i)?.[1] || '';
    const name = disposition.match(/name="([^"]+)"/)?.[1];
    if (!name) continue;
    const filename = disposition.match(/filename="([^"]*)"/)?.[1];
    const mimeType = rawHeaders.match(/content-type:\s*([^\r\n]+)/i)?.[1]?.trim() || 'application/octet-stream';
    const content = Buffer.from(rawContent, 'binary');
    if (filename) {
      files[name] = { filename: sanitizeFileName(filename), mimeType, content };
    } else {
      fields[name] = Buffer.from(rawContent, 'binary').toString('utf8');
    }
  }
  return { fields, files };
}

export function getClientIp(req) {
  if (!config.trustProxy) return req.socket?.remoteAddress || 'unknown-client';
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded && typeof forwarded === 'string') {
    const clientIp = forwarded.split(',')[0].trim();
    if (clientIp) return clientIp;
  }
  const realIp = req.headers['x-real-ip'];
  if (realIp && typeof realIp === 'string') {
    return realIp.trim();
  }
  return req.socket?.remoteAddress || 'unknown-client';
}

function attachCors(req, res) {
  const origin = req.headers.origin;
  const isLocalDevelopmentOrigin = config.nodeEnv !== 'production'
    && /^http:\/\/(?:127\.0\.0\.1|localhost):\d+$/.test(origin || '');
  const isCollegeOrigin = /^https?:\/\/(?:[a-zA-Z0-9-]+\.)*mitcorer\.edu\.in(?::\d+)?$/.test(origin || '');
  const allowOrigin = origin && (config.corsOrigins.includes('*') || config.corsOrigins.includes(origin) || isLocalDevelopmentOrigin || isCollegeOrigin)
    ? origin
    : config.corsOrigins[0];
  res.setHeader('Access-Control-Allow-Origin', allowOrigin);
  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Mitra-Session');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  if (config.nodeEnv === 'production') {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }
}

function getCookie(req, name) {
  const cookies = String(req.headers.cookie || '').split(';');
  const prefix = `${name}=`;
  const match = cookies.map((item) => item.trim()).find((item) => item.startsWith(prefix));
  if (!match) return '';
  try { return decodeURIComponent(match.slice(prefix.length)); } catch { return ''; }
}

function refreshCookie(token, maxAgeSeconds) {
  const secure = config.nodeEnv === 'production' ? '; Secure' : '';
  return `mitra_refresh=${encodeURIComponent(token || '')}; HttpOnly; SameSite=Strict; Path=/api/auth; Max-Age=${maxAgeSeconds}${secure}`;
}

function sanitizeUser(user) {
  return pick(user, ['id', 'name', 'email', 'role', 'createdAt']);
}

function issueSession(user) {
  const db = getDb();
  const refreshToken = createRefreshToken();
  const now = nowIso();
  db.refreshTokens = db.refreshTokens || [];
  db.refreshTokens.unshift({
    id: generateId('SES'),
    userId: user.id,
    tokenHash: hashToken(refreshToken),
    revoked: false,
    createdAt: now,
    expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 14).toISOString(),
  });
  db.refreshTokens = db.refreshTokens.slice(0, 1000);
  saveDb();
  return { token: createToken(user), refreshToken };
}

function refreshSession(body, req) {
  const db = getDb();
  const refreshToken = body.refreshToken || getCookie(req, 'mitra_refresh') || getCookie(req, 'campusguard_refresh');
  if (typeof refreshToken !== 'string' || !refreshToken.trim() || refreshToken.length > 500) throw unauthorized('No valid refresh session.');
  const tokenHash = hashToken(refreshToken);
  const session = (db.refreshTokens || []).find((item) => item.tokenHash === tokenHash);
  if (!session || session.revoked || new Date(session.expiresAt).getTime() < Date.now()) {
    throw unauthorized('Invalid refresh session.');
  }
  const user = db.users.find((item) => item.id === session.userId);
  if (!user) throw unauthorized('Session user no longer exists.');
  session.revoked = true;
  session.revokedAt = nowIso();
  const nextSession = issueSession(user);
  audit('auth.refresh', 'user', user.id, user, 'Access token refreshed.');
  return { user: sanitizeUser(user), ...nextSession };
}

function logoutSession(body, req) {
  const db = getDb();
  const refreshToken = String(body.refreshToken || getCookie(req, 'mitra_refresh') || getCookie(req, 'campusguard_refresh') || '');
  if (!refreshToken) return { loggedOut: true, clearRefreshCookie: true };
  const tokenHash = hashToken(refreshToken);
  const session = (db.refreshTokens || []).find((item) => item.tokenHash === tokenHash);
  if (session) {
    session.revoked = true;
    session.revokedAt = nowIso();
    saveDb();
  }
  return { loggedOut: true, clearRefreshCookie: true };
}

function getUserFromRequest(req) {
  const key = routeKey(req);
  if (publicRoutes.has(key)) return null;
  const token = getBearerToken(req);
  if (!token) throw unauthorized();
  const payload = verifyToken(token);
  const user = getDb().users.find((item) => item.id === payload.sub);
  if (!user) throw unauthorized('User no longer exists.');
  return user;
}

function filterRecordsForUser(records, user) {
  if (['staff', 'admin'].includes(user.role)) return records;
  return records.filter((item) => item.ownerEmail === user.email || item.contact === user.email);
}

function handleAuthLogin(body) {
  const email = requireString(body.email, 'email', 120).toLowerCase();
  const password = requireString(body.password, 'password', 200);
  const attempt = authAttempts.get(email) || { count: 0, lockedUntil: 0 };
  if (attempt.lockedUntil > Date.now()) {
    throw unauthorized('Too many failed login attempts. Try again shortly.');
  }
  const user = getDb().users.find((item) => item.email.toLowerCase() === email);
  if (!user || !verifyPassword(password, user.passwordHash)) {
    const nextCount = attempt.count + 1;
    authAttempts.set(email, {
      count: nextCount,
      lockedUntil: nextCount >= 5 ? Date.now() + 60_000 : 0,
    });
    throw unauthorized('Invalid email or password.');
  }
  authAttempts.delete(email);
  audit('auth.login', 'user', user.id, user, 'User signed in.');
  return { user: sanitizeUser(user), ...issueSession(user) };
}

function handleAuthSignup(body) {
  const db = getDb();
  const name = requireString(body.name, 'name', 120);
  const email = requireString(body.email, 'email', 120).toLowerCase();
  const password = requireString(body.password, 'password', 200);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw badRequest('Enter a valid email address.');
  if (password.length < 12) throw badRequest('Use a password or passphrase of at least 12 characters.');
  const role = body.role || 'applicant';
  if (!allowedRoles.includes(role)) throw badRequest('Invalid role.');
  if (['staff', 'admin'].includes(role)) throw forbidden('Staff and admin accounts must be provisioned by college admin.');
  if (db.users.some((item) => item.email.toLowerCase() === email)) throw badRequest('Email already exists.');
  const user = { id: generateId('USR'), name, email, role, passwordHash: hashPassword(password), createdAt: nowIso() };
  db.users.push(user);
  saveDb();
  audit('auth.signup', 'user', user.id, user, 'New applicant/parent account created.');
  return { user: sanitizeUser(user), ...issueSession(user) };
}

function createInquiry(body, user) {
  const db = getDb();
  const now = nowIso();
  const record = {
    id: generateId('INQ'),
    name: requireString(body.name || user.name, 'name', 120),
    role: user.role,
    topic: requireString(body.topic, 'topic', 80),
    priority: 'New',
    status: 'Unassigned',
    city: typeof body.city === 'string' && body.city.trim() ? body.city.trim() : 'Not provided',
    contact: requireString(body.contact || user.email, 'contact', 160),
    programmeInterest: typeof body.programmeInterest === 'string' && body.programmeInterest.trim() ? body.programmeInterest.trim().slice(0, 160) : '',
    leadConsent: body.leadConsent === true,
    consentRecordedAt: body.leadConsent === true && typeof body.consentRecordedAt === 'string' ? body.consentRecordedAt.slice(0, 40) : '',
    question: requireString(body.question, 'question', 1000),
    ownerEmail: user.email,
    assignedTo: '',
    messages: [],
    createdAt: now,
    updatedAt: now,
  };
  db.inquiries.unshift(record);
  if (db.inquiries.length > 2000) db.inquiries = db.inquiries.slice(0, 2000);
  saveDb();
  audit('inquiry.created', 'inquiry', record.id, user, record.topic);
  return record;
}

export function createPublicEscalatedInquiry(body) {
  const db = getDb();
  const now = nowIso();
  const contact = requireString(body?.contact, 'contact', 160);
  const question = requireString(body?.question, 'question', 1000);
  const name = typeof body?.name === 'string' && body.name.trim() ? body.name.trim().slice(0, 120) : 'Prospective Student';
  const topic = typeof body?.topic === 'string' && body.topic.trim() ? body.topic.trim().slice(0, 80) : 'Human Escalation';

  const record = {
    id: generateId('INQ'),
    name,
    role: 'applicant',
    topic,
    priority: 'High',
    status: 'Needs reply',
    city: typeof body?.city === 'string' && body.city.trim() ? body.city.trim().slice(0, 80) : 'Not provided',
    contact,
    programmeInterest: typeof body?.programmeInterest === 'string' ? body.programmeInterest.trim().slice(0, 160) : '',
    leadConsent: true,
    consentRecordedAt: now,
    question,
    ownerEmail: contact.includes('@') ? contact : 'public-escalation@mitcorer.edu.in',
    assignedTo: '',
    messages: [
      {
        id: generateId('MSG'),
        text: `[Human Escalation from Mitra Assistant]: Question was not found in verified knowledge base. Applicant Question: "${question}"`,
        authorName: 'Mitra Assistant',
        authorRole: 'system',
        createdAt: now,
      },
    ],
    createdAt: now,
    updatedAt: now,
  };
  db.inquiries.unshift(record);
  if (db.inquiries.length > 2000) db.inquiries = db.inquiries.slice(0, 2000);
  saveDb();
  audit('inquiry.escalated', 'inquiry', record.id, { email: record.ownerEmail, role: 'applicant' }, record.topic);
  return { success: true, inquiryId: record.id, message: 'Your enquiry has been escalated to MITCORER admissions staff.' };
}

export function recordFeedback(body) {
  const db = getDb();
  const now = nowIso();
  const question = typeof body?.question === 'string' ? body.question.trim().slice(0, 1000) : '';
  const answer = typeof body?.answer === 'string' ? body.answer.trim().slice(0, 2000) : '';
  const helpful = Boolean(body?.helpful);
  const comment = typeof body?.comment === 'string' ? body.comment.trim().slice(0, 500) : '';
  const model = typeof body?.model === 'string' ? body.model.trim().slice(0, 60) : 'unknown';

  const entry = {
    id: generateId('FDB'),
    question,
    answer,
    helpful,
    comment,
    model,
    createdAt: now,
  };

  db.feedback = db.feedback || [];
  db.feedback.unshift(entry);
  db.feedback = db.feedback.slice(0, 1000); // Keep last 1000 feedback records
  saveDb();
  audit('feedback.recorded', 'feedback', entry.id, { email: 'public', role: 'applicant' }, helpful ? 'helpful' : 'unhelpful');
  return { success: true, feedbackId: entry.id, message: 'Thank you for your feedback!' };
}

function updateInquiryStatus(id, body, user) {
  requireRole({ user }, ['staff', 'admin']);
  const validStatuses = ['Unassigned', 'Needs reply', 'In progress', 'Resolved'];
  if (!validStatuses.includes(body.status)) throw badRequest('Invalid inquiry status.');
  const record = getDb().inquiries.find((item) => item.id === id);
  if (!record) throw notFound('Inquiry not found.');
  const reply = typeof body.reply === 'string' ? body.reply.trim() : '';
  if (reply.length > 1500) throw badRequest('Reply must be 1500 characters or fewer.');
  if (body.status === 'Resolved' && !reply && !(record.messages || []).some((item) => item.authorRole === 'staff' || item.authorRole === 'admin')) {
    throw badRequest('Add a staff reply before resolving the inquiry.');
  }
  record.status = body.status;
  if (typeof body.assignedTo === 'string') record.assignedTo = body.assignedTo.trim().slice(0, 120);
  record.messages = record.messages || [];
  if (reply) {
    record.messages.push({ id: generateId('MSG'), text: reply, authorName: user.name, authorRole: user.role, createdAt: nowIso() });
    record.lastReplyAt = nowIso();
  }
  record.updatedAt = nowIso();
  saveDb();
  audit('inquiry.status_updated', 'inquiry', record.id, user, body.status);
  return record;
}

const workspaceSections = new Set(['cap', 'programs', 'fees', 'scholarship', 'stay']);

function getAdmissionWorkspace(user) {
  if (!['applicant', 'parent'].includes(user.role)) throw forbidden();
  return getDb().admissionWorkspaces.find((item) => item.ownerEmail === user.email) || {
    ownerEmail: user.email,
    cap: {},
    programs: { preferences: [] },
    fees: {},
    scholarship: {},
    stay: {},
    updatedAt: null,
  };
}

function updateAdmissionWorkspace(body, user) {
  if (!['applicant', 'parent'].includes(user.role)) throw forbidden();
  const section = requireString(body.section, 'section', 40);
  if (!workspaceSections.has(section)) throw badRequest('Invalid admission workspace section.');
  if (!body.value || typeof body.value !== 'object' || Array.isArray(body.value)) throw badRequest('Workspace value must be an object.');
  const serialized = JSON.stringify(body.value);
  if (serialized.length > 5000) throw badRequest('Workspace section is too large.');
  const db = getDb();
  let workspace = db.admissionWorkspaces.find((item) => item.ownerEmail === user.email);
  if (!workspace) {
    workspace = { ownerEmail: user.email, cap: {}, programs: { preferences: [] }, fees: {}, scholarship: {}, stay: {}, updatedAt: nowIso() };
    db.admissionWorkspaces.push(workspace);
  }
  workspace[section] = body.value;
  workspace.updatedAt = nowIso();
  saveDb();
  audit('admission_workspace.updated', 'admission_workspace', user.id, user, section);
  return workspace;
}

function createDocument(body, user) {
  const db = getDb();
  const now = nowIso();
  const ownerEmail = body.ownerEmail || user.email;
  if (!canAccessApplicantRecord(user, ownerEmail)) throw forbidden();
  const record = {
    id: generateId('DOC'),
    ownerName: requireString(body.ownerName || user.name, 'ownerName', 120),
    ownerEmail: requireString(ownerEmail, 'ownerEmail', 120).toLowerCase(),
    ownerRole: ['staff', 'admin'].includes(user.role) && allowedRoles.includes(body.ownerRole) ? body.ownerRole : user.role,
    docName: requireString(body.docName, 'docName', 160),
    fileName: requireString(body.fileName, 'fileName', 220),
    status: 'Uploaded (not submitted)',
    createdAt: now,
    updatedAt: now,
  };
  const existingIndex = db.documents.findIndex((item) => item.ownerEmail === record.ownerEmail && item.docName === record.docName);
  if (existingIndex >= 0) db.documents.splice(existingIndex, 1, record);
  else db.documents.unshift(record);
  saveDb();
  audit('document.uploaded', 'document', record.id, user, record.docName);
  return record;
}

function createDocumentFromUpload(fields, file, user) {
  assertAllowedUpload(file, allowedMimeTypes, 'Only valid PDF, JPG, and PNG files are allowed.');
  const db = getDb();
  const now = nowIso();
  const ownerEmail = fields.ownerEmail || user.email;
  if (!canAccessApplicantRecord(user, ownerEmail)) throw forbidden();
  const id = generateId('DOC');
  const storedFileName = `${id}-${file.filename}`;
  fs.mkdirSync(uploadDir, { recursive: true });
  fs.writeFileSync(path.join(uploadDir, storedFileName), file.content);
  const record = {
    id,
    ownerName: requireString(fields.ownerName || user.name, 'ownerName', 120),
    ownerEmail: requireString(ownerEmail, 'ownerEmail', 120).toLowerCase(),
    ownerRole: ['staff', 'admin'].includes(user.role) && allowedRoles.includes(fields.ownerRole) ? fields.ownerRole : user.role,
    docName: requireString(fields.docName, 'docName', 160),
    fileName: file.filename,
    storedFileName,
    mimeType: file.mimeType,
    sizeBytes: file.content.length,
    status: 'Uploaded (not submitted)',
    createdAt: now,
    updatedAt: now,
  };
  const existingIndex = db.documents.findIndex((item) => item.ownerEmail === record.ownerEmail && item.docName === record.docName);
  if (existingIndex >= 0) db.documents.splice(existingIndex, 1, record);
  else db.documents.unshift(record);
  saveDb();
  audit('document.file_uploaded', 'document', record.id, user, record.docName);
  return record;
}

function updateDocumentStatus(id, body, user) {
  requireRole({ user }, ['staff', 'admin']);
  const validStatuses = ['Submitted for review', 'Ready for reporting', 'Needs correction'];
  if (!validStatuses.includes(body.status)) throw badRequest('Invalid document status.');
  const record = getDb().documents.find((item) => item.id === id);
  if (!record) throw notFound('Document not found.');
  record.status = body.status;
  record.reviewNote = typeof body.reviewNote === 'string' ? body.reviewNote.trim().slice(0, 500) : '';
  record.reviewedBy = user.name;
  record.reviewedAt = nowIso();
  record.updatedAt = nowIso();
  saveDb();
  audit('document.status_updated', 'document', record.id, user, body.status);
  return record;
}

function submitDocumentsForReview(user) {
  if (!['applicant', 'parent'].includes(user.role)) throw forbidden();
  const db = getDb();
  const records = db.documents.filter((item) => item.ownerEmail === user.email && ['Uploaded (not submitted)', 'Needs correction'].includes(item.status));
  if (records.length === 0) throw badRequest('Upload a new or corrected document before submitting for review.');
  const submittedAt = nowIso();
  records.forEach((record) => {
    record.status = 'Submitted for review';
    record.submittedAt = submittedAt;
    record.updatedAt = submittedAt;
    record.reviewNote = '';
    record.reviewedBy = '';
    record.reviewedAt = '';
  });
  saveDb();
  audit('documents.submitted_for_review', 'document_batch', user.id, user, `${records.length} document(s)`);
  return { items: records, submittedCount: records.length, submittedAt };
}

function deleteDocument(id, user) {
  const db = getDb();
  const record = db.documents.find((item) => item.id === id);
  if (!record) throw notFound('Document not found.');
  if (!canAccessApplicantRecord(user, record.ownerEmail)) throw forbidden();
  if (!['staff', 'admin'].includes(user.role) && ['Submitted for review', 'Ready for reporting'].includes(record.status)) {
    throw forbidden('Submitted documents cannot be removed unless staff requests a correction.');
  }
  db.documents = db.documents.filter((item) => item.id !== id);
  if (record.storedFileName) {
    const filePath = path.resolve(uploadDir, record.storedFileName);
    if (filePath.startsWith(uploadDir) && fs.existsSync(filePath)) fs.unlinkSync(filePath);
  }
  saveDb();
  audit('document.deleted', 'document', id, user, record.docName);
  return { deleted: true };
}

function getDocumentFile(id, user) {
  const record = getDb().documents.find((item) => item.id === id);
  if (!record) throw notFound('Document not found.');
  if (!canAccessApplicantRecord(user, record.ownerEmail)) throw forbidden();
  if (['staff', 'admin'].includes(user.role) && record.status === 'Uploaded (not submitted)') throw forbidden('This document has not been submitted for review.');
  if (!record.storedFileName) throw notFound('The original file is not available for this record.');
  const filePath = path.resolve(uploadDir, record.storedFileName);
  if (!filePath.startsWith(uploadDir) || !fs.existsSync(filePath)) throw notFound('Document file is unavailable.');
  audit('document.file_opened', 'document', record.id, user, record.docName);
  return { __file: true, filePath, mimeType: record.mimeType || 'application/octet-stream', fileName: record.fileName };
}

function createContent(body, user) {
  requireRole({ user }, ['admin']);
  const db = getDb();
  const record = {
    id: generateId('CNT'),
    title: requireString(body.title, 'title', 180),
    category: requireString(body.category, 'category', 80),
    status: body.status || 'Review',
    updatedAt: nowIso(),
  };
  db.content.unshift(record);
  saveDb();
  audit('content.created', 'content', record.id, user, record.title);
  return record;
}

function updateContent(id, body, user) {
  requireRole({ user }, ['admin']);
  const record = getDb().content.find((item) => item.id === id);
  if (!record) throw notFound('Content item not found.');
  Object.assign(record, pick(body, ['title', 'category', 'status']), { updatedAt: nowIso() });
  saveDb();
  audit('content.updated', 'content', record.id, user, record.title);
  return record;
}

function buildReports(user) {
  requireRole({ user }, ['staff', 'admin']);
  const db = getDb();
  const topicCounts = db.inquiries.reduce((items, item) => {
    items[item.topic] = (items[item.topic] || 0) + 1;
    return items;
  }, {});
  const topTopic = Object.entries(topicCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || 'No data';
  const readyDocs = db.documents.filter((item) => item.status === 'Ready for reporting').length;
  return {
    topTopic,
    openInquiries: db.inquiries.filter((item) => item.status !== 'Resolved').length,
    unresolved: db.inquiries.filter((item) => ['Unassigned', 'Needs reply'].includes(item.status)).length,
    documentReviews: db.documents.length,
    readyDocuments: readyDocs,
    documentReadinessPercent: db.documents.length ? Math.round((readyDocs / db.documents.length) * 100) : 0,
  };
}

function tokenize(text) {
  return String(text || '')
    .normalize('NFKC')
    .toLocaleLowerCase()
    .match(/[\p{L}\p{N}]+/gu)
    ?.filter((word) => word.length > 1) || [];
}

function buildCutoffAnswer(question, records) {
  const normalized = normalizeIntentText(question);
  if (!/\b(?:cutoffs?|cut[- ]?offs?|closing percentile|closing rank|closing merit|cap cutoff)\b/i.test(normalized)) {
    return null;
  }
  const query = understandQuery(question);
  const positive = query.branch.positive;
  const is2025 = /2025/.test(normalized);

  if (positive.includes('civil')) {
    const record = records.find((r) => r.id === 'KB-10' && usableKnowledge(r)) || records.find((r) => r.id === 'KB-6');
    return {
      source: record ? record.source : 'Maharashtra CET Cell admission process guidance',
      sourceUrl: 'https://fe2026.mahacet.org/',
      answer: 'For choice code 0690119110, Civil Engineering at institute 06901 (sanctioned intake 60), seat allotment is governed by MHT-CET/JEE merit rank, candidate category (GOPEN, LOPEN, OBC, SC, ST, EWS, TFWS), CAP round, and home university quota. For official Civil Engineering closing cutoffs across CAP rounds, please refer to the Maharashtra CET Cell CAP portal (https://fe2026.mahacet.org/) or consult the MITCORER admission desk.',
      evidence: record ? [{ ...record, score: 200 }] : [],
      anchored: true,
      actionView: 'cap',
      actionLabel: 'Check CAP notices',
      next: 'Check the official Maharashtra CET Cell CAP Round cutoff lists or contact the admission desk.',
    };
  }

  if (positive.includes('mechanical')) {
    const record = records.find((r) => r.id === 'KB-10' && usableKnowledge(r)) || records.find((r) => r.id === 'KB-6');
    return {
      source: record ? record.source : 'Maharashtra CET Cell admission process guidance',
      sourceUrl: 'https://fe2026.mahacet.org/',
      answer: 'For choice code 0690158510, Mechanical and Rail Engineering at institute 06901 (sanctioned intake 60, historical 2024 choice code 0690161210), seat allotment is governed by MHT-CET/JEE merit rank, candidate category, CAP round, and home university quota. For official Mechanical and Rail Engineering closing cutoffs across CAP rounds, please refer to the Maharashtra CET Cell CAP portal (https://fe2026.mahacet.org/) or consult the MITCORER admission desk.',
      evidence: record ? [{ ...record, score: 200 }] : [],
      anchored: true,
      actionView: 'cap',
      actionLabel: 'Check CAP notices',
      next: 'Check the official Maharashtra CET Cell CAP Round cutoff lists or contact the admission desk.',
    };
  }

  if (positive.includes('aids')) {
    const record = records.find((r) => r.id === 'KB-10' && usableKnowledge(r)) || records.find((r) => r.id === 'KB-6');
    return {
      source: record ? record.source : 'Maharashtra CET Cell admission process guidance',
      sourceUrl: 'https://fe2026.mahacet.org/',
      answer: 'For choice code 0690126310, Artificial Intelligence and Data Science at institute 06901 (sanctioned intake 60), seat allotment is governed by MHT-CET/JEE merit rank, candidate category, CAP round, and quota. For official Artificial Intelligence and Data Science closing cutoffs across CAP rounds, please refer to the Maharashtra CET Cell CAP portal (https://fe2026.mahacet.org/) or consult the MITCORER admission desk.',
      evidence: record ? [{ ...record, score: 200 }] : [],
      anchored: true,
      actionView: 'cap',
      actionLabel: 'Check CAP notices',
      next: 'Check the official Maharashtra CET Cell CAP Round cutoff lists or contact the admission desk.',
    };
  }

  if (positive.includes('entc')) {
    const record = records.find((r) => r.id === 'KB-10' && usableKnowledge(r)) || records.find((r) => r.id === 'KB-6');
    return {
      source: record ? record.source : 'Maharashtra CET Cell admission process guidance',
      sourceUrl: 'https://fe2026.mahacet.org/',
      answer: 'For choice code 0690137210, Electronics and Telecommunication Engineering at institute 06901 (sanctioned intake 60), seat allotment is governed by MHT-CET/JEE merit rank, candidate category, and CAP round. For official Electronics and Telecommunication closing cutoffs across CAP rounds, please refer to the Maharashtra CET Cell CAP portal (https://fe2026.mahacet.org/) or consult the MITCORER admission desk.',
      evidence: record ? [{ ...record, score: 200 }] : [],
      anchored: true,
      actionView: 'cap',
      actionLabel: 'Check CAP notices',
      next: 'Check the official Maharashtra CET Cell CAP Round cutoff lists or contact the admission desk.',
    };
  }

  if (positive.includes('electronicsComputer')) {
    const record = records.find((r) => r.id === 'KB-10' && usableKnowledge(r)) || records.find((r) => r.id === 'KB-6');
    return {
      source: record ? record.source : 'Maharashtra CET Cell admission process guidance',
      sourceUrl: 'https://fe2026.mahacet.org/',
      answer: 'For choice code 0690184410, Electronics and Computer Engineering at institute 06901 (sanctioned intake 60), seat allotment is governed by MHT-CET/JEE merit rank, candidate category, and CAP round. For official closing cutoffs across CAP rounds, please refer to the Maharashtra CET Cell CAP portal (https://fe2026.mahacet.org/) or consult the MITCORER admission desk.',
      evidence: record ? [{ ...record, score: 200 }] : [],
      anchored: true,
      actionView: 'cap',
      actionLabel: 'Check CAP notices',
      next: 'Check the official Maharashtra CET Cell CAP Round cutoff lists or contact the admission desk.',
    };
  }

  const targetId = is2025 ? 'KB-8' : 'KB-7';
  const cseRecord = records.find((r) => r.id === targetId && usableKnowledge(r));
  if (cseRecord) {
    return {
      source: cseRecord.source,
      sourceUrl: cseRecord.sourceUrl || '',
      answer: cseRecord.text,
      evidence: [{ ...cseRecord, score: 200 }],
      anchored: true,
      actionView: 'cap',
      actionLabel: 'Check CAP history',
      next: 'Specify the year, CAP round, branch, category, seat type, and whether the score is MHT-CET or JEE.',
    };
  }

  return null;
}

function buildEligibilityAnswer(question) {
  const normalized = normalizeIntentText(question);
  if (/\b(?:scholarship|ebc|tfws|concession)\b/i.test(normalized)) return null;
  const isEligibilityQuestion = /\b(?:eligible|eligibility|percentile)\b/i.test(normalized);
  const isBranchQuestion = /\b(?:cse|computer science|computer engineering|civil|mechanical|rail(?:way)?|ai|data science|entc|electronics|branch|department|course)\b/i.test(normalized);
  if (!isEligibilityQuestion || !isBranchQuestion) return null;

  const query = understandQuery(question);
  const branchLabels = {
    cse: 'Computer Science and Engineering (CSE)',
    civil: 'Civil Engineering',
    mechanical: 'Mechanical and Rail Engineering',
    aids: 'Artificial Intelligence and Data Science',
    entc: 'Electronics and Telecommunication Engineering',
    electronicsComputer: 'Electronics and Computer Engineering',
  };
  const positive = query.branch.positive;
  const targetBranch = positive.length === 1 ? branchLabels[positive[0]] : null;
  const targetBranchText = targetBranch || 'your desired engineering branch';

  const percentile = normalized.match(/(\d+(?:\.\d+)?)\s*(?:%|percentile|percent)/)?.[1];
  const scoreReference = percentile ? `${percentile} percentile` : 'the stated percentile';
  return {
    source: 'Maharashtra CET Cell admission process guidance',
    answer: `${scoreReference} alone is not enough to confirm admission to ${targetBranchText}. First, basic engineering eligibility must be checked from your qualifying-examination subjects and marks, entrance score, candidature, and documents. After that, ${targetBranchText} allotment depends on merit rank, category, seat type, CAP or institute-level route, round, preferences, vacancies, and the applicable cutoff. A percentile alone cannot guarantee or rule out admission.`,
    next: 'Provide your category, Maharashtra candidature status, qualifying-examination subjects and marks, CAP or institute-level route, and current round to refine the guidance.',
    actionView: 'programs',
    actionLabel: 'Check programs',
  };
}

function buildDocumentStatusAnswer(question, user) {
  const normalized = normalizeIntentText(question);
  const asksStatus = ['status', 'review', 'uploaded', 'upload'].some((term) => normalized.includes(term));
  const asksDocuments = ['document', 'documents', 'certificate', 'marksheet'].some((term) => normalized.includes(term));
  if (!asksStatus || !asksDocuments) return null;
  const records = getDb().documents.filter((item) => item.ownerEmail === user.email);
  if (records.length === 0) {
    return {
      source: 'My document records',
      answer: 'There are no uploaded admission documents in your record yet. Upload each required document from the Documents section for staff review.',
      next: 'Open Documents and upload the required files together.',
      actionView: 'documents',
      actionLabel: 'Open documents',
    };
  }
  const summary = records.reduce((items, item) => {
    items[item.status] = (items[item.status] || 0) + 1;
    return items;
  }, {});
  const statusSummary = Object.entries(summary).map(([status, count]) => `${count} ${status}`).join(', ');
  return {
    source: 'My document records',
    answer: `Your document record contains ${records.length} uploaded file${records.length === 1 ? '' : 's'}: ${statusSummary}. Staff review status is shown in the Documents section.`,
    next: 'Open Documents to see each file and any correction request.',
    actionView: 'documents',
    actionLabel: 'Open documents',
  };
}

function buildAdmissionReadinessAnswer(question, user) {
  const normalized = normalizeIntentText(question);
  const rawQuestion = String(question || '').normalize('NFKC').toLocaleLowerCase();
  const intentText = `${normalized} ${rawQuestion}`;
  const hasStrongReadinessMarker = ['what else', 'what remaining', 'what is remaining', 'remaining', 'pending', 'last step', 'final step', 'admission complete', 'complete admission', 'reporting checklist', 'admission checklist', 'final admission checklist', 'before institute reporting', 'after allotment']
    .some((term) => intentText.includes(term));
  const hasProgressSignal = ['received', 'got', 'accepted', 'uploaded', 'paid', 'payment done', 'reporting complete'].some((term) => intentText.includes(term));
  const asksWhatRemains = hasStrongReadinessMarker || (['what next', 'what should i do next', 'next step'].some((term) => intentText.includes(term)) && hasProgressSignal);
  const mentionsAdmissionWorkflow = ['admission', 'allotment', 'reporting', 'cap', 'acap'].some((term) => intentText.includes(term));
  if (!asksWhatRemains || !mentionsAdmissionWorkflow) return null;

  const documents = getDb().documents.filter((item) => item.ownerEmail === user.email);
  const uploaded = new Set(documents.map((item) => item.docName.toLocaleLowerCase()));
  const coreDocuments = ['10th marksheet', '12th marksheet', 'CET or JEE scorecard', 'school leaving certificate', 'nationality or domicile proof', 'Aadhaar copy', 'bank passbook copy'];
  const missingKnownDocuments = coreDocuments.filter((name) => !uploaded.has(name.toLocaleLowerCase()));
  const hasAllotment = /allotment.*(?:received|got|available)|(?:received|got).*allotment|allotted/i.test(intentText);
  const hasAcceptance = /seat.*accepted|accepted.*seat|acceptance.*complete|freeze.*complete/i.test(intentText);
  const hasPayment = /payment.*(?:done|paid|complete)|(?:paid|payment done|fee paid)/i.test(intentText);
  const saysDocumentsReady = /documents?.*(?:uploaded|ready|complete)|(?:uploaded|ready).*documents?/i.test(intentText);
  const hasReported = /reported.*(?:college|institute)|reporting.*complete|admission.*complete/i.test(intentText);
  const workflowSteps = [
    ['allotment or institute-level merit/vacancy confirmation', hasAllotment],
    ['seat acceptance or freeze/betterment decision where applicable', hasAcceptance],
    ['document upload and staff readiness check', saysDocumentsReady || documents.length > 0],
    ['approved fee payment or payment-schedule confirmation', hasPayment],
    ['institute reporting within the current notice deadline', hasReported],
  ];
  const remainingSteps = workflowSteps.filter(([, complete]) => !complete).map(([label]) => label);
  const documentSummary = documents.length === 0
    ? 'No documents have been uploaded in this workspace yet.'
    : `${documents.length} document file${documents.length === 1 ? '' : 's'} ${documents.length === 1 ? 'is' : 'are'} currently uploaded.`;
  const isOpenCategory = /\bopen\b|general category/i.test(normalized);
  const remainingText = remainingSteps.length
    ? `Based on what you wrote, the remaining workflow items are: ${remainingSteps.join('; ')}.`
    : 'Based on what you wrote, all main workflow stages appear complete; only the current official reporting confirmation and staff document status remain authoritative.';
  return {
    source: 'Verified admission checklist',
    answer: `${isOpenCategory ? 'For Open-category reporting, ' : 'For admission reporting, '}the core documents are 10th marksheet, 12th marksheet, CET or JEE scorecard, school leaving certificate, nationality or domicile proof, Aadhaar copy, bank passbook copy, and photographs. Migration certificate, gap certificate, and income certificate are only needed where applicable. ${remainingText} ${documentSummary} ${missingKnownDocuments.length ? `The workspace does not yet show: ${missingKnownDocuments.join(', ')}.` : 'The core named documents are present in the workspace; staff review status still matters.'}`,
    next: 'Open Documents to upload or check files, then confirm your CAP/ACAP route, allotment acceptance, reporting date, and payment status.',
    actionView: 'documents',
    actionLabel: 'Check reporting checklist',
  };
}

function buildDeadlineAnswer(question) {
  const normalized = normalizeIntentText(question);
  if (!/\b(?:deadline|last date|admission date|schedule|reporting date)\b/.test(normalized)
    || /\bfee\s+schedule\b/.test(normalized) && !/deadline|last date|admission date|reporting date/.test(normalized)) return null;
  return {
    source: 'Maharashtra CET Cell 2026-27 admission portals',
    answer: 'Admission dates and reporting deadlines change by academic year, route, and round. Check the current official portal for the applicable route; an exact date needs a current published notice.',
    next: 'Specify B.Tech CAP, Direct Second Year, Polytechnic, or ACAP and the relevant round for an exact check.',
    actionView: 'cap',
    actionLabel: 'Check current notices',
  };
}

function getOfficialAdmissionLinks(question) {
  const normalized = normalizeIntentText(question);
  const links = [];
  const add = (label, url) => links.push({ label, url });
  const asksDse = /direct second|dse|lateral|second year/.test(normalized);
  const asksPolytechnic = /polytechnic|diploma|post ssc/.test(normalized);
  const asksAcap = /acap|non cap|non-cap|institute level|institute-level|against cap|vacancy/.test(normalized);
  const asksCap = (!asksAcap && /\bcap\b/.test(normalized)) || /allotment|option form|freeze|betterment|seat acceptance|reporting|deadline|schedule|last date/.test(normalized);
  const years = understandQuery(normalized).academicYears;
  const currentYear = !years.length || years.every(year => year === '2026-27');

  if (currentYear && asksDse) add('Official DSE Engineering portal 2026-27', 'https://dse2026.mahacet.org.in/');
  else if (currentYear && asksPolytechnic) add('Official Polytechnic admission portal 2026-27', 'https://poly26.dtemaharashtra.gov.in/poly_26/home');
  else if (currentYear && asksCap) add('Official B.Tech CAP portal 2026-27', 'https://fe2026.mahacet.org/StaticPages/HomePage');
  if (asksAcap) add('MITCORER ACAP and institute-level notices', 'https://mitcorer.edu.in/acap-institute-level-admission.php');
  if (asksCap || asksAcap) add('Maharashtra CET Cell notices', 'https://cetcell.mahacet.org/notices/');
  return links;
}

function getOfficialScholarshipLinks(question) {
  const normalized = normalizeIntentText(question);
  if (!/scholarship|pragati|financial aid|mahadbt|nsp/.test(normalized)) return [];
  const links = [
    { label: 'MITCORER scholarship schemes', url: 'https://www.mitcorer.edu.in/scholarship.php' },
  ];
  if (normalized.includes('pragati')) links.push({ label: 'National Scholarship Portal schemes', url: 'https://scholarships.gov.in/All-Scholarships' });
  if (!normalized.includes('pragati')) links.push({ label: 'MahaDBT scholarship portal', url: 'https://mahadbt.maharashtra.gov.in/login/login' });
  return links;
}

function getOfficialExperienceLinks(question) {
  const normalized = normalizeIntentText(question);
  const links = [];
  if (/placement|company|recruiter|package|internship/.test(normalized)) {
    links.push({ label: 'MITCORER Training and Placement Cell', url: 'https://mitcorer.edu.in/placement-cell.php' });
    links.push({ label: 'MITCORER published recruiters', url: 'https://mitcorer.edu.in/our-recruiters.php' });
  }
  if (/about mitcorer|about us|why mitcorer|why choose mitcorer/.test(normalized)) {
    links.push({ label: 'About MITCORER', url: 'https://www.mitcorer.edu.in/mit-corer.php' });
  }
  if (/faculty|teacher|professor|staff|mandatory disclosure|brochure/.test(normalized)) {
    links.push({ label: 'Official AICTE Mandatory Disclosure (Complete Faculty Roster)', url: 'https://mitcorer.edu.in/pdf/Mandatory-Disclousure.pdf' });
    links.push({ label: 'MITCORER College Brochure', url: 'https://mitcorer.edu.in/pdf/MITCORER_Brochure-26-27.pdf' });
  }
  if (/affiliation|solapur university|pahsu|dte code|aicte|principal/.test(normalized)) {
    links.push({ label: 'Punyashlok Ahilyadevi Holkar Solapur University', url: 'https://www.sus.ac.in/' });
    links.push({ label: 'DTE Maharashtra Official Portal', url: 'https://www.dtemaharashtra.gov.in/' });
  }
  if (/nss|national service scheme/.test(normalized)) {
    links.push({ label: 'MITCORER NSS Unit', url: 'https://mitcorer.edu.in/nss.php' });
  }
  if (/rail-mit|rail mit|technical event|asimit|space/.test(normalized)) {
    links.push({ label: 'Rail-MIT Technical Events', url: 'https://mitcorer.edu.in/technical-events-rail-mit.php' });
  }
  const asksCivil = /civil|amit shinde/.test(normalized);
  const asksMech = /mechanical|rail engineering|sanjay mane/.test(normalized);
  const asksCse = /computer science|cse|somnath mule/.test(normalized);
  const asksAllDepts = /hod|head of department|departments?/.test(normalized);

  if (asksCivil && !asksAllDepts) {
    links.push({ label: 'Civil Engineering Department', url: 'https://mitcorer.edu.in/civil-engineering.php' });
  } else if (asksMech && !asksAllDepts) {
    links.push({ label: 'Mechanical & Rail Engineering Department', url: 'https://mitcorer.edu.in/mechanical-engineering.php' });
  } else if (asksCse && !asksAllDepts) {
    links.push({ label: 'Computer Science & Engineering Department', url: 'https://mitcorer.edu.in/computer-science-engineering.php' });
  } else if (asksAllDepts || asksCivil || asksMech || asksCse) {
    links.push({ label: 'Computer Science & Engineering Department', url: 'https://mitcorer.edu.in/computer-science-engineering.php' });
    links.push({ label: 'Civil Engineering Department', url: 'https://mitcorer.edu.in/civil-engineering.php' });
    links.push({ label: 'Mechanical & Rail Engineering Department', url: 'https://mitcorer.edu.in/mechanical-engineering.php' });
  }
  if (/transit|nearest railway station|nearest station|nearest bus|railway station|bus stand|how to reach/.test(normalized)) {
    links.push({ label: 'MITCORER Contact & Transit Directions', url: 'https://mitcorer.edu.in/contact.php' });
    links.push({ label: 'MITCORER Bus Facility', url: 'https://mitcorer.edu.in/bus-facility.php' });
  }
  if (/mit pune|maeer|parent trust|mit group/.test(normalized)) {
    links.push({ label: "MAEER's MIT Group", url: 'https://mitcorer.edu.in/maeers.php' });
    links.push({ label: 'MITCORER Admissions FAQ', url: 'https://mitcorer.edu.in/faq.php' });
  }
  if (/railway model|railway practical|railway lab/.test(normalized)) {
    links.push({ label: 'MITCORER Railway Model Room', url: 'https://www.mitcorer.edu.in/railway-model-room.php' });
  }
  if (/mou|mous|corporate readiness|industry partner|industry tie-?up|aptitude training|soft skills training/.test(normalized)) {
    links.push({ label: 'MITCORER Industry MoUs', url: 'https://mitcorer.edu.in/our-mou.php' });
    links.push({ label: 'Training and Placement Cell', url: 'https://mitcorer.edu.in/training-and-placement-cell.php' });
  }
  if (/ragging|safety|medical|ambulance|grievance|committee/.test(normalized)) {
    links.push({ label: 'MITCORER Anti-Ragging Notification', url: 'https://mitcorer.edu.in/pdf/Anti-Ragging-2025-26.pdf' });
    links.push({ label: 'Student Grievance Redressal Cell', url: 'https://mitcorer.edu.in/grievance-redressal-cell.php' });
  }
  if (/artificial intelligence|data science|ai ?&? ?ds|aids/.test(normalized)) {
    links.push({ label: 'Artificial Intelligence & Data Science Department', url: 'https://mitcorer.edu.in/artificial-intelligence-data-science.php' });
  }
  if (/electronics and telecommunication|e&tc|entc/.test(normalized)) {
    links.push({ label: 'Electronics & Telecommunication Engineering Department', url: 'https://mitcorer.edu.in/electronics-and-tele-communication-engineering.php' });
  }
  if (/electronics and computer/.test(normalized)) {
    links.push({ label: 'Electronics & Computer Engineering Department', url: 'https://mitcorer.edu.in/electronics-and-computer-engineering.php' });
  }
  if (/nep|nep 2020|outcome based|obe|curriculum|medium of instruction/.test(normalized)) {
    links.push({ label: 'MITCORER Academic FAQ', url: 'https://mitcorer.edu.in/faq.php' });
    links.push({ label: 'PAH Solapur University Engineering Rules', url: 'https://www.sus.ac.in/uploads/engineering/Eng%20Revised%20Semester%20Pattern/CBCS%20UG%20Rules.pdf' });
  }
  if (/office hours|office timings|working hours|visiting hours|admission desk|enquiry desk|college timings/.test(normalized)) {
    links.push({ label: 'MITCORER Contact & Office Hours', url: 'https://mitcorer.edu.in/contact.php' });
  }
  if (/professional diploma|railway diploma|railway track technology|railway signaling|railway signalling|rolling stocks?|software technology in railway/.test(normalized)) {
    links.push({ label: 'MITCORER Professional Railway Diplomas', url: 'https://mitcorer.edu.in/about-professional-diploma-railway.php' });
  }
  if (/polytechnic|msbte|post[- ]?ssc|diploma (?:course|program|engineering|admission|intake|branch)/.test(normalized) && !/professional diploma|railway diploma/.test(normalized)) {
    links.push({ label: 'MITCORER Polytechnic Admissions', url: 'https://mitcorer.edu.in/fy-polytechnic.php' });
    links.push({ label: 'MSBTE Official Portal', url: 'https://msbte.org.in/' });
  }
  if (/sports|cricket|volleyball|badminton|gym|gymnasium|cultural event|cultural gathering|shiv jayanti|ganesh utsav/.test(normalized)) {
    links.push({ label: 'MITCORER Sports Facilities', url: 'https://mitcorer.edu.in/sports.php' });
    links.push({ label: 'MITCORER Cultural Events', url: 'https://mitcorer.edu.in/cultural-events.php' });
  }
  if (/workshop|machine shop|fitting shop|welding|carpentry/.test(normalized)) {
    links.push({ label: 'MITCORER Central Workshop', url: 'https://mitcorer.edu.in/workshops.php' });
  }
  if (/computer center|computing center/.test(normalized)) {
    links.push({ label: 'MITCORER Computer Center', url: 'https://mitcorer.edu.in/computer-center.php' });
  }
  if (/seminar hall/.test(normalized)) {
    links.push({ label: 'MITCORER Seminar Hall', url: 'https://mitcorer.edu.in/seminar-hall.php' });
  }
  return links;
}

function getContactMapLink(question) {
  if (!/contact|address|location|how to reach|map/i.test(question)) return [];
  return [{ label: 'Find MITCORER on Google Maps', url: 'https://www.google.com/maps/search/?api=1&query=MIT+College+of+Railway+Engineering+and+Research+Barshi' }];
}

function getOfficialFeeLinks(question) {
  if (!/\bfees?\b|fee structure/i.test(question) || !/2025-26|previous.year|historical|\bfra\b/i.test(question)) return [];
  if (/hostel|mess|bus|transport|polytechnic|diploma/i.test(question)) return [];
  return [{ label: 'Official FRA fee PDF (AY 2025-26; previous-year reference)', url: 'https://mitcorer.edu.in/pdf/FRA_Fee_Structure.pdf' }];
}

function buildCollegeProfileAnswer(question) {
  const normalized = normalizeIntentText(question);
  if (/\b(?:sports grounds?|sports facilit\w*|box cricket|cricket ground|volleyball (?:court|ground)|badminton court|campus gym|gymnasium|cultural events?|cultural gathering|annual gathering|cultural fest|shiv jayanti|ganesh (?:utsav|festival)|traditional day)\b/.test(normalized) && !/nss|rail-mit|technical event|world cup|icc/.test(normalized)) {
    return {
      recordId: 'KB-48',
      source: 'MITCORER Sports and Cultural Events official portals',
      sourceUrl: 'https://mitcorer.edu.in/sports.php',
      answer: "MITCORER Sports Infrastructure & Campus Cultural Life:\n\n- Sports Facilities: Dedicated outdoor campus grounds for cricket, box cricket, and volleyball, alongside badminton facilities, indoor recreation (chess, carrom), and a campus gymnasium for student fitness.\n- Sports Tournaments: Annual inter-departmental sports meet and participation in university/zonal athletic competitions.\n- Cultural Festivities: Annual Cultural Gathering showcasing student music, drama, and dance performances, alongside grand celebrations of Chhatrapati Shivaji Maharaj Jayanti (Shiv Jayanti), Ganesh Utsav, National Engineer's Day, and Teachers' Day.\n- Holistic Development: Encourages extracurricular excellence, cultural vitality, and physical wellness alongside technical railway engineering studies.",
      next: '', actionView: 'visit', actionLabel: 'Explore campus life',
    };
  }
  if (/\b(?:professional diplomas?|railway diplomas?|railway track technology|railway signaling|railway signalling|rolling stocks?(?: and operations)?|software technology in railway|railway specializations?|railway modules?)\b/.test(normalized)) {
    return {
      recordId: 'KB-47',
      source: 'MITCORER Professional Railway Diploma portal and syllabus records',
      sourceUrl: 'https://mitcorer.edu.in/about-professional-diploma-railway.php',
      answer: 'MITCORER Specialized Professional Railway Diplomas:\n\n- Railway Signaling & Telecommunication: Professional Diploma covering railway signaling fundamentals, train detection, electronic interlocking, and telecommunication networks (for E&TC/Electrical/allied branches).\n- Railway Track Technology: Professional Diploma covering permanent way alignment, ballastless high-speed track design, track maintenance, and geometric safety (for Civil Engineering).\n- Rolling Stocks and Operations: Professional Diploma covering locomotive mechanics, coach/wagon dynamic design, braking systems, and train operations (for Mechanical/Automobile Engineering).\n- Software Technology in Railway Sector: Professional Diploma covering automated train control systems, signaling software safety, and smart railway analytics (for Computer Science/IT).\n\nThese value-added professional diplomas are offered concurrently to bridge academia and railway industry requirements.',
      next: '', actionView: 'programs', actionLabel: 'Explore railway diplomas',
    };
  }
  if (/\b(?:polytechnic|msbte|post[- ]?ssc diploma|diploma in engineering|diploma courses?|diploma programs?|diploma intake|diploma branches?|polytechnic courses?|polytechnic branches?|polytechnic intake|polytechnic eligibility)\b/.test(normalized) && !/\b(?:professional diploma|railway diploma|railway track|railway signaling|rolling stocks?|software technology in railway|direct second|dse|lateral|fees?|cost|charges?)\b/.test(normalized)) {
    return {
      recordId: 'KB-12',
      source: 'MITCORER Polytechnic admissions page',
      sourceUrl: 'https://mitcorer.edu.in/fy-polytechnic.php',
      answer: 'MITCORER Polytechnic (Diploma in Engineering) Programs under MSBTE:\n\n- Affiliation & Approvals: Affiliated to Maharashtra State Board of Technical Education (MSBTE), Mumbai; approved by AICTE, New Delhi and DTE Maharashtra (Institute Code: 06901).\n- Branches Offered & Intake (Sanctioned Intake: 60 each, Total 240 seats):\n  1. Computer Science & Engineering (Intake: 60)\n  2. Civil Engineering (Intake: 60)\n  3. Mechanical Engineering (Intake: 60)\n  4. Electronic & Telecom Engineering (Intake: 60)\n- Program Duration: 3-Year Full-Time Diploma program (6 Semesters under MSBTE curriculum).\n- First Year (Post-SSC) Eligibility: Candidate must have passed 10th Standard (SSC) examination from Maharashtra State Board or equivalent with at least 35% aggregate marks.\n- Direct Second Year (Lateral Entry): Available for candidates who have passed 12th Science / HSC Vocational / Technical or 2-year ITI as per DTE/MSBTE norms.\n- Separate Process: Polytechnic admission cycles, CAP seat allotment, fees, and documentation are administered separately from degree B.Tech admissions.',
      next: '', actionView: 'programs', actionLabel: 'Explore polytechnic',
    };
  }
  if (/\b(?:office hours?|office timings?|working hours?|visiting hours?|admission desk|enquiry desk|college timings?|working days?|visiting the college|visiting schedule|office open|office close|open on saturday|admission helpline|helpline number|campus visit|visit booking)\b/.test(normalized)) {
    return {
      recordId: 'KB-46',
      source: 'MITCORER Contact Us and Admissions Office portal',
      sourceUrl: 'https://mitcorer.edu.in/contact.php',
      answer: 'MITCORER Administrative Office & Admission Enquiry Desk Hours:\n\n- Working Days: Monday to Saturday (closed on Sundays and public holidays).\n- Operating Timings: 9:30 AM to 5:30 PM.\n- Admission Enquiry Desk: Open during working hours in the Administrative Building for admission counseling, document verification checks, campus visits, and seat enquiry.\n- Contact Lines: +91 84599 67882 / +91 86696 62106; Email: info.mitcorer@mitpune.edu.in.',
      next: '', actionView: 'visit', actionLabel: 'View office details',
    };
  }
  if (/\b(?:nep(?: 2020)?|national education policy|outcome[- ]based education|obe|medium of instruction|english medium|curriculum pattern|evaluation pattern)\b/.test(normalized)) {
    return {
      recordId: 'KB-45',
      source: 'PAH Solapur University academic regulations and MITCORER academic portal',
      sourceUrl: 'https://mitcorer.edu.in/faq.php',
      answer: 'MITCORER Academic Framework, NEP 2020 & Medium of Instruction:\n\n- NEP 2020 & OBE Framework: MITCORER delivers degree engineering under the PAH Solapur University (PAHSU) curriculum aligned with National Education Policy (NEP 2020) and Outcome-Based Education (OBE) principles, incorporating credit frameworks, honors degrees, and multidisciplinary minors.\n- Medium of Instruction: The official medium of instruction for all lectures, laboratory practicals, project reports, and semester examinations is English.\n- Continuous Evaluation: Combines semester credit examinations with continuous internal evaluation, technical seminar presentations, and industry internships.',
      next: '', actionView: 'programs', actionLabel: 'Explore programmes',
    };
  }
  if (/\b(?:anti[- ]?ragging|ragging|ragging[- ]free|campus safety|emergency vehicle|ambulance|medical emergenc\w*|medical facilit\w*|student welfare|internal complaints committee|grievance cell)\b/.test(normalized)) {
    return {
      recordId: 'KB-44',
      source: 'MITCORER Anti-Ragging Committee notifications and Student Welfare portal',
      sourceUrl: 'https://mitcorer.edu.in/pdf/Anti-Ragging-2025-26.pdf',
      answer: "MITCORER Campus Safety, Anti-Ragging Policy & Medical Services:\n\n- Zero-Tolerance Anti-Ragging: Ragging is strictly banned across campus and hostel premises under AICTE and UGC statutory regulations.\n- Anti-Ragging Squad & Committee: A high-level committee chaired by the Principal with faculty, local police, civil authorities, parents, and student members conducts continuous monitoring.\n- Emergency Medical Support: A dedicated 24/7 campus emergency vehicle / ambulance is available on site for immediate medical transit, supported by campus first-aid facilities.\n- Welfare Bodies: Statutory committees including the Internal Complaints Committee (Women's Safety), SC/ST Committee, and Student Grievance Redressal Committee ensure a secure, respectful campus environment.",
      next: '', actionView: 'visit', actionLabel: 'Explore student welfare',
    };
  }
  if (/\b(?:mous?|industry mou|industry mous|corporate readiness|collaborations?|industry partners?|industry tie-?ups?|aptitude training|soft skills training|mock interviews?|bvg india|aptron)\b/.test(normalized)) {
    return {
      recordId: 'KB-43',
      source: 'MITCORER Training & Placement Cell and Official MoU Portal',
      sourceUrl: 'https://mitcorer.edu.in/our-mou.php',
      answer: 'MITCORER Industry MoUs & Corporate Readiness Program:\n\n- Active Industry MoUs: Formal memorandums of understanding (MoUs) signed with organizations including APTRON Solutions, Bulls Eye, Earth Solutions Pvt. Ltd., Increpe Technologies, E-Construct, Khambe Sangli, DTL, E-Kida, and BVG India.\n- Practical Industry Exposure: MoUs facilitate student internships, sponsored live projects, guest lecture series, industrial visits, and hands-on technical workshops.\n- Corporate Readiness Program (CRP): Dedicated training organized by the Training & Placement Cell covering quantitative aptitude, logical reasoning, verbal ability, resume preparation, and domain technical skills.\n- Professional Grooming: Personality development workshops, soft skills training, group discussion rounds, and mock interviews by industry HR specialists to ensure campus placement readiness.',
      next: '', actionView: 'placements', actionLabel: 'View placement support',
    };
  }
  if (/\b(?:student clubs?|technical clubs?|coding club|robotics club|student associations?|technical chapters?|space|mesa|cesa|eesa|asimit|co[- ]?curricular)\b/.test(normalized)) {
    return {
      recordId: 'KB-50',
      source: 'MITCORER Student Affairs and Co-Curricular Activities portal',
      sourceUrl: 'https://mitcorer.edu.in/campus-life.php',
      answer: 'MITCORER Student Clubs, Departmental Bodies, and Co-Curricular Associations:\n\n- Departmental Student Associations: Active student-led technical associations including SPACE (Students\' Association of Computer Engineering), MESA (Mechanical Engineering), and CESA (Civil Engineering). These bodies organize expert guest lectures, hands-on software workshops, coding bootcamps, and technical site visits.\n- Technical & Innovation Clubs: Robotics & Automation Club, Coding & Algorithm Club, and Railway Innovation Cell, where students build practical prototypes, participate in smart hackathons, and compete in national technical symposiums.\n- Rail-MIT Technical Symposium: Annual flagship national-level technical event hosted on campus featuring technical paper presentations, CAD modeling competitions, coding battles, and project exhibitions.\n- NSS & Community Outreach: Active National Service Scheme (NSS) unit affiliated to PAH Solapur University driving blood donation drives, tree plantation campaigns, and rural technology awareness initiatives.',
      next: '', actionView: 'visit', actionLabel: 'Explore campus life',
    };
  }
  if (/\b(?:industrial visits?|railway visits?|railway workshop visit|field visits?|field training|summer internships?|practical internships?)\b/.test(normalized)) {
    return {
      recordId: 'KB-51',
      source: 'MITCORER Training and Placement Cell & IIIC records',
      sourceUrl: 'https://mitcorer.edu.in/training-placement.php',
      answer: 'MITCORER Industrial Visits, Railway Field Training, and Practical Internships:\n\n- Railway Field Exposure: Proximity to Central Railway hubs enables guided technical visits to the historic Kurduwadi Railway Workshop, Solapur Railway Divisional Headquarters, diesel/electric loco sheds, and signaling interlock installations for practical railway systems understanding.\n- Multi-Industry Site Visits: Regular industrial visits to manufacturing units, structural construction sites, thermal power stations, and IT software companies across Barshi, Solapur, Pune, and surrounding industrial belts.\n- Mandatory Internships: In alignment with AICTE and PAH Solapur University curriculum, all B.Tech students undergo 4-to-8-week industrial internships with leading infrastructure, manufacturing, and software organizations before final-year graduation.\n- Practical Application: Field training bridges classroom engineering theory with operational railway maintenance, safety standards, and modern corporate engineering practices.',
      next: '', actionView: 'placements', actionLabel: 'View training details',
    };
  }
  if (/\b(?:same as mit pune|mitcorer (?:barshi )?(?:and|or) mit pune|connection (?:with|between) mit pune|relationship (?:with|to) mit pune|part of mit pune|branch of mit pune|under mit pune|mit wpu|maeer('s)? mit pune|parent trust|difference between mitcorer and mit pune)\b/.test(normalized)) {
    return {
      recordId: 'KB-41',
      source: 'MITCORER Admissions FAQ and official website',
      sourceUrl: 'https://mitcorer.edu.in/faq.php',
      answer: "MITCORER Barshi and MAEER's MIT Pune Relationship:\n\n- Parent Organization: Both MITCORER Barshi and MIT Pune operate under the same parent trust, Maharashtra Academy of Engineering and Educational Research (MAEER's MIT Group of Institutions, Pune), founded by Prof. Dr. Vishwanath D. Karad.\n- Establishment Mission: The Barshi campus was established under the MAEER group to deliver quality technical and railway engineering education to rural and regional students.\n- Operational Structure: While sharing common parent trust governance, MITCORER functions as an independent institution with its own campus facilities, courses, and affiliation to PAH Solapur University (PAHSU) and MSBTE under DTE Code 06901.",
      next: '', actionView: 'programs', actionLabel: 'Explore programmes',
    };
  }
  if (/\b(?:nearest railway station|nearest station|which railway station|station to college|barshi town station|kurduwadi junction|nearest bus (?:stop|stand)|barshi bus stand|how to reach (?:mitcorer|the college|barshi college)|distance from (?:station|bus stand)|reach (?:by train|by bus))\b/.test(normalized)) {
    return {
      recordId: 'KB-40',
      source: 'MITCORER Contact Us portal and campus transit directions',
      sourceUrl: 'https://mitcorer.edu.in/contact.php',
      answer: 'MITCORER Transit Directions & Commuting Access:\n\n- Campus Location: Industrial Estate No. 03, Barshi, Dist. Solapur, Maharashtra - 413401.\n- Nearest Railway Station: Barshi Town Station is 4.7 km from campus (via Bhosale Chowk – Cancer Chowk – Industrial Road). Major long-distance train connectivity is accessible at Kurduwadi Junction (~38 km).\n- Nearest Bus Stand: MSRTC Bus Stand Barshi is 5.7 km away (Route-I: via Cancer Chowk & Industrial Road; Route-II: via Bypass Agalgaon Chowk – Shukla Automobile – Industrial Road).\n- Daily College Bus Network: The college operates dedicated daily bus routes across Barshi, Kurduwadi, and Solapur for commuting students and staff.',
      next: '', actionView: 'visit', actionLabel: 'View campus location',
    };
  }
  if (/\b(?:who is the principal|principal name|name of the principal|principal of mitcorer|college principal)\b/.test(normalized) && !/\b(?:affiliation|affiliated|dte|aicte|university|code)\b/.test(normalized)) {
    return {
      recordId: 'KB-37',
      source: 'MITCORER official leadership portal',
      sourceUrl: 'https://mitcorer.edu.in/',
      answer: 'The Principal of MIT College of Railway Engineering and Research (MITCORER), Barshi is Dr. Madhukar J. Lengare.',
      next: '', actionView: 'visit', actionLabel: 'View college details',
    };
  }
  if (/\b(?:affiliation|affiliated|which university|what university|solapur university|pahsu|aicte approval|approved by aicte|aicte approved|dte code|institute code|code 06901|principal of|college principal)\b/.test(normalized)) {
    return {
      recordId: 'KB-37',
      source: 'MITCORER official portal and AICTE Mandatory Disclosure',
      sourceUrl: 'https://mitcorer.edu.in/',
      answer: 'MIT College of Railway Engineering and Research (MITCORER), Barshi:\n\n- Parent Trust: Under the aegis of MAEER\'s MIT Pune\n- Affiliation: Affiliated to Punyashlok Ahilyadevi Holkar Solapur University (PAHSU) for degree engineering and MSBTE for polytechnic diplomas\n- Approvals: Approved by AICTE, New Delhi, and recognized by Govt. of Maharashtra & DTE Mumbai\n- DTE Institute Code: 06901\n- Principal: Dr. Madhukar J. Lengare',
      next: '', actionView: 'programs', actionLabel: 'Explore programmes',
    };
  }
  const asksMech = /\b(?:mechanical|mech|railway|rail|sanjay mane|mesa)\b/i.test(normalized);
  const asksCivil = /\b(?:civil|amit shinde|cesa)\b/i.test(normalized);
  const asksCse = /\b(?:cse|computer|somnath mule|space|ai ml honors|cybersecurity honors)\b/i.test(normalized);
  const asksHod = /\b(?:hod|head of department|department head)\b/i.test(normalized);
  const asksLabs = /\b(?:labs?|laborator(?:y|ies))\b/i.test(normalized);
  const asksSyllabus = /\b(?:syllabus|curriculum|subjects)\b/i.test(normalized);
  const asksHodOrDept = /\b(?:hod|head of department|department head|labs?|laborator(?:y|ies)|syllabus|specializations?|honor degrees?|minor degrees?)\b/i.test(normalized);
  const isExcludedFromProfile = /\b(?:eligible|eligibility|percentile|cutoff|cut-off|fee|fees|scholarship)\b/i.test(normalized);

  if (!isExcludedFromProfile && (asksHodOrDept || /\b(?:about\s+civil|civil\s+branch|civil\s+department|about\s+mechanical|mechanical\s+branch|mechanical\s+department|about\s+computer|computer\s+branch|computer\s+department)\b/i.test(normalized) || /^(?:mechanical engineering|computer engineering|civil engineering)$/.test(normalized) || /\b(?:computer engineering syllabus|mechanical engineering syllabus)\b/.test(normalized))) {
    if (asksMech && !asksCivil && !asksCse) {
      if (asksHod && !asksLabs && !asksSyllabus) {
        return {
          recordId: 'KB-38',
          source: 'MITCORER Mechanical & Rail Engineering department portal',
          sourceUrl: 'https://mitcorer.edu.in/mechanical-engineering.php',
          answer: 'The Head of Department (HOD) of Mechanical & Rail Engineering at MITCORER is Dr. Sanjay Pandurang Mane.',
          next: '', actionView: 'programs', actionLabel: 'Explore Mechanical & Rail Engineering',
        };
      }
      if (asksLabs && !asksHod && !asksSyllabus) {
        return {
          recordId: 'KB-38',
          source: 'MITCORER Mechanical & Rail Engineering department portal',
          sourceUrl: 'https://mitcorer.edu.in/mechanical-engineering.php',
          answer: 'MITCORER Department of Mechanical & Rail Engineering Laboratories:\n\n- CAD/CAM Lab\n- Robotics Lab\n- Heat Transfer Lab\n- Dynamics of Machinery Lab\n- Central Workshop fabrication facilities',
          next: '', actionView: 'programs', actionLabel: 'Explore Mechanical & Rail Engineering',
        };
      }
      return {
        recordId: 'KB-38',
        source: 'MITCORER Mechanical & Rail Engineering department portal',
        sourceUrl: 'https://mitcorer.edu.in/mechanical-engineering.php',
        answer: 'MITCORER Department of Mechanical & Rail Engineering:\n\n- Head of Department (HOD): Dr. Sanjay Pandurang Mane.\n- Academic Focus: Railway technology, rolling stocks, robotics, thermal engineering, and automotive mechanics.\n- Departmental Facilities & Labs: Equipped with advanced CAD/CAM Lab, Robotics Lab, Heat Transfer Lab, Dynamics of Machinery Lab, and Central Workshop fabrication facilities.\n- Student Association: Mechanical Engineering Students Association (MESA).\n- Specialized Diploma: Professional Diploma in Rolling Stocks and Operations.',
        next: '', actionView: 'programs', actionLabel: 'Explore Mechanical & Rail Engineering',
      };
    }
    if (asksCivil && !asksMech && !asksCse) {
      if (asksHod && !asksLabs && !asksSyllabus) {
        return {
          recordId: 'KB-38',
          source: 'MITCORER Civil Engineering department portal',
          sourceUrl: 'https://mitcorer.edu.in/civil-engineering.php',
          answer: 'The Head of Department (HOD) of Civil Engineering at MITCORER is Prof. Amit Raosaheb Shinde.',
          next: '', actionView: 'programs', actionLabel: 'Explore Civil Engineering',
        };
      }
      if (asksLabs && !asksHod && !asksSyllabus) {
        return {
          recordId: 'KB-38',
          source: 'MITCORER Civil Engineering department portal',
          sourceUrl: 'https://mitcorer.edu.in/civil-engineering.php',
          answer: 'MITCORER Department of Civil Engineering Laboratories:\n\n- Strength of Materials Lab\n- Surveying Lab\n- Concrete Technology Lab\n- Environmental Engineering Lab\n- Computer-Aided Civil Design (CAD) Lab',
          next: '', actionView: 'programs', actionLabel: 'Explore Civil Engineering',
        };
      }
      return {
        recordId: 'KB-38',
        source: 'MITCORER Civil Engineering department portal',
        sourceUrl: 'https://mitcorer.edu.in/civil-engineering.php',
        answer: 'MITCORER Department of Civil Engineering (Established 2017):\n\n- Head of Department (HOD): Prof. Amit Raosaheb Shinde.\n- Academic Offerings: 4-Year B.Tech with Minor Degrees in AI & Data Science and Software Engineering.\n- Departmental Laboratories: Strength of Materials Lab, Surveying Lab, Concrete Technology Lab, Environmental Engineering Lab, and Computer-Aided Civil Design (CAD) Lab.\n- Student Association: Civil Engineering Students Association (CESA).\n- Specialized Diploma: Professional Diploma in Railway Track Technology.',
        next: '', actionView: 'programs', actionLabel: 'Explore Civil Engineering',
      };
    }
    if (asksCse && !asksMech && !asksCivil) {
      if (asksHod && !asksLabs && !asksSyllabus) {
        return {
          recordId: 'KB-38',
          source: 'MITCORER Computer Science & Engineering department portal',
          sourceUrl: 'https://mitcorer.edu.in/computer-science-engineering.php',
          answer: 'The Head of Department (HOD) of Computer Science & Engineering (CSE) at MITCORER is Prof. Somnath Mule.',
          next: '', actionView: 'programs', actionLabel: 'Explore Computer Science & Engineering',
        };
      }
      if (asksLabs && !asksHod && !asksSyllabus) {
        return {
          recordId: 'KB-38',
          source: 'MITCORER Computer Science & Engineering department portal',
          sourceUrl: 'https://mitcorer.edu.in/computer-science-engineering.php',
          answer: 'MITCORER Department of Computer Science & Engineering Laboratories:\n\n- High-Performance Computing Lab\n- AI/ML & Deep Learning Lab\n- Database Systems Lab\n- Software Engineering Lab\n- Programming Computational Center',
          next: '', actionView: 'programs', actionLabel: 'Explore Computer Science & Engineering',
        };
      }
      return {
        recordId: 'KB-38',
        source: 'MITCORER Computer Science & Engineering department portal',
        sourceUrl: 'https://mitcorer.edu.in/computer-science-engineering.php',
        answer: 'MITCORER Department of Computer Science & Engineering (CSE):\n\n- Head of Department (HOD): Prof. Somnath Mule.\n- Academic Offerings: 4-Year B.Tech with Honor Degrees in Artificial Intelligence (AI), Machine Learning (ML), and Cybersecurity.\n- Departmental Laboratories: High-Performance Computing Lab, AI/ML & Deep Learning Lab, Database Systems Lab, Software Engineering Lab, and Programming Computational Center.\n- Student Association: Students Association of Computer Engineering (SPACE).\n- Specialized Diploma: Professional Diploma in Software Technology in Railway Sector.',
        next: '', actionView: 'programs', actionLabel: 'Explore Computer Science & Engineering',
      };
    }
    return {
      recordId: 'KB-38',
      source: 'MITCORER official department portals and brochure',
      sourceUrl: 'https://mitcorer.edu.in/computer-science-engineering.php',
      answer: 'MITCORER Department Leadership & Academic Specializations:\n\n- Computer Science & Engineering (CSE): Head of Department is Prof. Somnath Mule. Offers B.Tech with Honor Degrees in Artificial Intelligence (AI), Machine Learning (ML), and Cybersecurity, backed by high-performance programming, AI/ML, and computational laboratories.\n- Civil Engineering: Head of Department is Prof. Amit Raosaheb Shinde (established 2017). Offers B.Tech with Minor Degrees in AI & Data Science and Software Engineering, featuring Strength of Materials, Surveying, Concrete Technology, Environmental, and CAD laboratories.\n- Mechanical & Rail Engineering: Head of Department is Dr. Sanjay Pandurang Mane. Focuses on railway technology, robotics, and automotive engineering, equipped with CAD/CAM, Robotics, Heat Transfer, and Central Workshop fabrication facilities.',
      next: '', actionView: 'programs', actionLabel: 'View department details',
    };
  }
  if (/nss|national service scheme|rail-mit|rail mit|technical event|asimit|space|student association/.test(normalized)) {
    return {
      recordId: 'KB-39',
      source: 'MITCORER Campus Life portal and official brochure',
      sourceUrl: 'https://mitcorer.edu.in/technical-events-rail-mit.php',
      answer: 'MITCORER Co-curricular and Campus Life:\n\n- National Service Scheme (NSS): Active NSS unit affiliated with PAH Solapur University organizing community service, blood donation camps, environmental initiatives, and youth leadership projects.\n- Rail-MIT Technical Symposium: Annual flagship national-level technical event featuring technical paper presentations, working model competitions, coding contests, and robotics.\n- Student Associations: Departmental bodies (SPACE for Computer Engineering, CESA for Civil, MESA for Mechanical) conducting coding bootcamps, technical workshops, and expert industrial sessions.\n- Sports & Culture: Campus grounds and facilities for student sports, alongside a campus gymnasium and annual cultural festivities.',
      next: '', actionView: 'visit', actionLabel: 'Explore campus life',
    };
  }
  if (/\b(?:faculty|teacher|professor|teaching staff)\b/.test(normalized) && !/\b(?:hiring|recruitment|vacancy|vacancies|job|jobs|career|careers|opening|openings|employment|apply for job|work with us)\b/.test(normalized)) {
    return {
      recordId: 'KB-35',
      source: 'MITCORER Admissions FAQ and official website',
      sourceUrl: 'https://mitcorer.edu.in/faq.php',
      answer: 'MITCORER features 60+ experienced faculty members across engineering and polytechnic disciplines, supporting students with interactive classes, practical assignments, and industry-oriented railway engineering projects.\n\nFor the complete department-wise roster of faculty names, designations, and qualifications, refer to the official AICTE Mandatory Disclosure on the college website.',
      next: '', actionView: 'inquiry', actionLabel: 'View official disclosure',
    };
  }
  if (/alumni|alumnus/.test(normalized)) {
    return {
      recordId: 'KB-35',
      source: 'MITCORER Admissions FAQ and official website',
      sourceUrl: 'https://mitcorer.edu.in/faq.php',
      answer: 'MITCORER has an alumni network of 900+ graduates working in railway engineering, core engineering, and technology domains across India.',
      next: '', actionView: 'programs', actionLabel: 'Explore programmes',
    };
  }
  if (/why should i choose mitcorer|why mitcorer|why choose mitcorer/.test(normalized)) {
    return {
      recordId: 'KB-35',
      source: 'MITCORER Admissions FAQ and official website',
      answer: 'What sets MITCORER apart?\n\n- Railway-oriented engineering courses based on practical railway work\n- Projects, interactive classes, and industry engagement\n- 60+ faculty and 900+ alumni listed on the college website\n- Dedicated placement support; 100+ companies visiting and 300+ students placed in the published highlights\n- Highest published package: 21 LPA\n- Laboratories, railway model room, library, workshops, and computer labs\n- Separate hostels for boys and girls, sports, and other campus facilities',
      next: '', actionView: 'programs', actionLabel: 'Explore programmes',
    };
  }
  if (/\b(?:b\.?tech admission(?: process)?|engineering admission(?: process)?|admission process|how to apply|apply for (?:engineering|b\.?tech)|apply to mitcorer|admission 2026|admission eligibility criteria)\b/.test(normalized) && !/\b(?:exam|exams|entrance|test|cet|jee|polytechnic|diploma|dse|direct second|fee|fees|cost|document|documents|hostel|mess|accommodation)\b/.test(normalized)) {
    return {
      recordId: 'KB-29',
      source: 'Maharashtra CET Cell and MITCORER Admissions Office',
      sourceUrl: 'https://mitcorer.edu.in/acap-institute-level-admission.php',
      answer: 'MITCORER B.Tech Engineering Admission Process (AY 2026-27):\n\n- Centralized Admission Process (CAP): Conducted by Maharashtra State CET Cell (fe2026.mahacet.org). Candidates register online, complete document e-verification, and submit option forms listing MITCORER (DTE Code: 06901) and preferred branch choice codes.\n- Entrance Exam Accepted: Valid non-zero score in MHT-CET 2026 or JEE Main Paper-I.\n- Institute-Level / Against-CAP (ACAP) Seats: Direct admission against institute quota and vacant seats following CAP rounds, conducted as per published merit lists and schedules on the college website.\n- Reporting & Document Verification: Allotted students report to the campus Admission Desk with original marksheets, scorecards, domicile, and category proofs to confirm enrollment.',
      next: '', actionView: 'cap', actionLabel: 'Explore admission process',
    };
  }
  if (/\b(?:education loan|bank loan|loan assistance)\b/.test(normalized)) {
    return {
      recordId: 'KB-1',
      source: 'MITCORER Admissions Office and Accounts Section',
      sourceUrl: 'https://mitcorer.edu.in/faq.php',
      answer: 'MITCORER Education Loan Support:\n\n- Bank Loan Support: The college administrative office assists admitted students with official documentation required for education loans across nationalized, private, and cooperative banks.\n- Documentation Provided: Official Bonafide Certificate, itemized Fee Estimate on institute letterhead, and AICTE Approval Letter copies needed by banks for loan processing.\n- Assistance Desk: Students can visit the college Admission Enquiry Desk or contact the Administrative Office (Mon-Sat, 9:30 AM to 5:30 PM) for loan documentation assistance.',
      next: '', actionView: 'fees', actionLabel: 'Explore fee details',
    };
  }
  if (/\b(?:campus interview|placement interview process|campus recruitment process|student recruitment process|placement selection process)\b/.test(normalized) || (/\b(?:recruitment process|interview process|selection process)\b/.test(normalized) && !/\b(?:faculty|teacher|professor|staff|employee)\b/.test(normalized))) {
    return {
      recordId: 'KB-43',
      source: 'MITCORER Training and Placement Cell',
      sourceUrl: 'https://mitcorer.edu.in/placement-cell.php',
      answer: 'MITCORER Campus Interview & Recruitment Process:\n\n- Corporate Readiness Program (CRP): Pre-placement grooming covering quantitative aptitude, logical reasoning, verbal communication, resume optimization, and domain technical preparation.\n- Company Presentations: Visiting recruiters deliver Pre-Placement Talks (PPT) detailing job profiles, career progression, and CTC packages.\n- Multi-Stage Evaluation: Standard recruitment rounds include online coding/aptitude assessments, Group Discussions (GD), technical panel interviews, and HR rounds.\n- Dedicated Infrastructure: Placement cell hosts on-campus, virtual, and pooled recruitment drives supported by the computing center and conference facilities.',
      next: '', actionView: 'placements', actionLabel: 'Explore placement cell',
    };
  }
  if (/\b(?:official website|college website|website link)\b/.test(normalized)) {
    return {
      recordId: 'KB-34',
      source: 'MITCORER official website',
      sourceUrl: 'https://mitcorer.edu.in/',
      answer: 'The official website of MIT College of Railway Engineering and Research (MITCORER), Barshi is:\n\nhttps://mitcorer.edu.in/\n\nVisit the portal for official announcements, online enquiry, admission portals, syllabus, academic calendar, and mandatory disclosures.',
      next: '', actionView: 'inquiry', actionLabel: 'Visit website',
    };
  }
  if (/\b(?:chatbot|virtual assistant|mitra chatbot|chatbot support)\b/.test(normalized)) {
    return {
      recordId: 'KB-34',
      source: 'MITCORER Virtual Assistant Mitra',
      sourceUrl: 'https://mitcorer.edu.in/',
      answer: 'Mitra is the official Virtual Assistant for MIT College of Railway Engineering and Research (MITCORER), Barshi.\n\nMitra provides 24/7 verified guidance on B.Tech and Polytechnic admissions, eligibility criteria, choice codes, fee structures, government scholarships, hostel amenities, campus facilities, and placement records based directly on official college records.',
      next: '', actionView: 'programs', actionLabel: 'Explore with Mitra',
    };
  }
  if (/\b(?:college reviews?|student reviews?|ratings?)\b/.test(normalized)) {
    return {
      recordId: 'KB-35',
      source: 'MITCORER institutional records and AICTE disclosure',
      sourceUrl: 'https://mitcorer.edu.in/faq.php',
      answer: 'MITCORER Barshi institutional facts and verified benchmarks:\n\n- Legacy: Established under MAEER\'s MIT Pune Group (founded by Prof. Dr. Vishwanath D. Karad)\n- Approvals: Approved by AICTE, New Delhi; recognized by Govt. of Maharashtra & DTE Mumbai (Code: 06901); affiliated to PAH Solapur University (PAHSU) & MSBTE\n- Placements: 100+ visiting recruiters, 300+ students placed, highest published package of 21 LPA\n- Faculty & Alumni: 60+ qualified faculty members and an alumni network of 900+ graduates across core engineering and railway industries\n- Practical Infrastructure: Dedicated Railway Model Room, advanced departmental laboratories, central fabrication workshop, air-conditioned computing center, and separate student hostels.',
      next: '', actionView: 'programs', actionLabel: 'Explore programmes',
    };
  }
  if (/\b(?:barshi to solapur|solapur to barshi|distance (?:from|to) solapur|solapur distance)\b/.test(normalized)) {
    return {
      recordId: 'KB-40',
      source: 'MITCORER Contact Us portal and campus transit directions',
      sourceUrl: 'https://mitcorer.edu.in/contact.php',
      answer: 'MITCORER Barshi to Solapur Transit & Commute:\n\n- Road Distance: Approximately 70 km from Solapur city to MITCORER campus in Barshi (about 1.5 to 2 hours via NH-52 / state highway).\n- College Bus Network: The college runs dedicated daily bus routes between Barshi, Kurduwadi, and Solapur for commuting day scholars and staff.\n- Rail Transit: Barshi Town railway station is 4.7 km from campus, while Kurduwadi Junction (~38 km) offers extensive rail connections across Solapur and Maharashtra.',
      next: '', actionView: 'visit', actionLabel: 'Explore campus transit',
    };
  }
  if (/\b(?:contact details?|contact number|contact email|phone number|email address|helpline number|contact us|college address|official contact|email and phone|how to contact)\b/.test(normalized) || (/\b(?:contact|phone|telephone|email|address)\b/.test(normalized) && /\b(?:mitcorer|college|barshi|solapur)\b/.test(normalized))) {
    return {
      recordId: 'KB-17',
      source: 'MITCORER Contact Us page',
      sourceUrl: 'https://mitcorer.edu.in/contact.php',
      answer: 'MITCORER, Industrial Estate No. 03, Barshi, Dist. Solapur, Maharashtra 413401.\n\nEmail: info.mitcorer@mitpune.edu.in.\n\nPhone: +91 84599 67882, +91 86696 62106.\n\nWebsite: https://mitcorer.edu.in/.',
      next: '', actionView: 'visit', actionLabel: 'View contact details',
    };
  }
  if (/^(?:mitcorer|mit college|mitcorer barshi|mit college barshi|engineering college barshi|railway engineering college)$|tell me about mitcorer|about mitcorer|about us|about the college/.test(normalized)) {
    return {
      recordId: 'KB-34',
      source: 'MITCORER About Us page',
      answer: 'MIT College of Railway Engineering and Research (MITCORER) is an MIT Group college in Barshi, Solapur district, created with a focus on railway technology. Its railway-oriented curriculum draws on real railway practices and aims to prepare students for technological and social challenges.\n\nStudents learn through practical assignments, projects, interactive classes, campus facilities, and industry engagement.',
      next: '', actionView: 'programs', actionLabel: 'Explore programmes',
    };
  }
  return null;
}

function buildCampusFacilitiesAnswer(question) {
  const normalized = normalizeIntentText(question);
  if (!/campus facilit|college facilit|facilities available|campus infrastructure/.test(normalized)) return null;
  return {
    source: 'MITCORER official brochure and Admissions FAQ',
    answer: 'MITCORER campus facilities include:\n\n- Learning: classrooms, laboratories, computer labs, workshops, railway model room, library, and seminar halls\n- Student life: separate hostels, mess/canteen, sports, and gym\n- Services: transport, Wi-Fi, RO drinking water, solar water heating, parking, security, and guest houses',
    next: '', actionView: 'visit', actionLabel: 'Explore facilities',
  };
}

function buildPlacementAnswer(question) {
  const normalized = normalizeIntentText(question);
  if (!/placement|company|companies|recruiter|package|internship/.test(normalized)) return null;
  if (/placement assistance|internship/.test(normalized) && !/company|companies|recruiter|package|highlight/.test(normalized)) return null;
  return {
    source: 'MITCORER website and Admissions FAQ',
    answer: 'MITCORER Placement Highlights\n\n- 100+ companies visiting\n- 300+ students placed\n- Highest published package: 21 LPA\n- Average published package: 4.4 LPA\n\nThe Training and Placement Cell supports internships and placement preparation.',
    answerPart2: 'Published recruiter records include\n\n- TCS\n- Infosys\n- Cognizant\n- Bosch\n- Cybage\n- Apisero\n- MNGL\n- BYJU’S',
    next: '', actionView: 'placements', actionLabel: 'View placement support',
  };
}

function buildScholarshipAnswer(question) {
  const normalized = normalizeIntentText(question);
  if (!/scholarship|pragati|financial aid|mahadbt|nsp/.test(normalized)) return null;
  const asksPragati = normalized.includes('pragati');
  const isNonCap = /non cap|non-cap|acap|institute level|institute-level|against cap/.test(normalized);
  if (asksPragati) {
    return {
      source: 'National Scholarship Portal and MITCORER scholarship page',
      answer: `MITCORER lists AICTE Pragati for girl students, and NSP lists separate merit-based Pragati schemes for technical degree and diploma students. It is potentially relevant to a girl student in an AICTE-approved technical course. Final eligibility depends on the current NSP specification, merit and family conditions, admission details, documents, and application dates.${isNonCap ? ' Because this is an institute-level/non-CAP admission, do not assume eligibility: confirm that the current Pragati specification accepts that route.' : ''} NSP One Time Registration is required before applying.`,
      next: 'Open the current Pragati specification on NSP and verify course level, admission route, family conditions, documents, and deadline.',
      actionView: 'scholarships',
      actionLabel: 'Check scholarship readiness',
    };
  }
  if (isNonCap) {
    return {
      source: 'MITCORER scholarship and institute-level admission guidance',
      answer: 'A non-CAP or institute-level student may check scholarships, but admission through that route does not automatically qualify the student for a scheme. Each MahaDBT or NSP scheme has its own admission-route, category, income, domicile, merit, and document conditions. Verify the current scheme specification before relying on a concession or paying fees.',
      next: 'Select the exact scheme and compare its current admission-route condition with your institute-level allotment or merit proof.',
      actionView: 'scholarships',
      actionLabel: 'Check scholarship readiness',
    };
  }
  return null;
}

function getOfficialUniversityLinks(question) {
  const normalized = normalizeIntentText(question);
  if (!/attendance|present|absen|detain|condonation|biometric|\bxx\b/.test(normalized)) return [];
  return [
    { label: 'Official engineering attendance rules', url: 'https://www.sus.ac.in/uploads/engineering/Eng%20Revised%20Semester%20Pattern/CBCS%20UG%20Rules.pdf' },
    { label: 'Official biometric attendance circular 2026-27', url: 'https://www.sus.ac.in/uploads/admission/Admission%202026%2027/Circular/LMS%20Circular%20-%206%2020062026.pdf' },
  ];
}

function buildAttendanceAnswer(question) {
  const normalized = normalizeIntentText(question);
  if (!/attendance|present|absen|detain|condonation|biometric|\bxx\b/.test(normalized)) return null;
  return {
    source: 'PAH Solapur University CBCS UG Engineering Rules',
    answer: 'For engineering courses, regular 100% attendance is expected. The minimum threshold is 75% in each theory and laboratory course because only a maximum of 25% absence may be permitted. Falling below 75% results in an XX grade (Detained) for that course. Absence relaxation is not automatic: it is limited to valid grounds such as illness, death in the family, or another emergency beyond the student\'s control and requires approval from the affiliated institute. For AY 2026-27, the university also requires biometric attendance for students of affiliated colleges and university schools.',
    next: 'Check your subject-wise attendance with the college and submit supporting evidence promptly if you need institute consideration for an eligible absence.',
    actionView: 'inquiry',
    actionLabel: 'Ask attendance support',
  };
}

function buildFacilityAnswer(question) {
  const normalized = normalizeIntentText(question);
  if (/hostel/.test(normalized) && !/fee|cost|charge|payment/.test(normalized)) {
    const isAllotmentOrProcess = /\b(?:admission|process|allotment|apply|procedure|rules|joining|room)\b/.test(normalized);
    return {
      recordId: 'KB-23',
      source: 'MITCORER Admissions FAQ and official brochure',
      sourceUrl: 'https://www.mitcorer.edu.in/hostel-amenities.php',
      answer: isAllotmentOrProcess
        ? 'MITCORER Hostel Accommodation & Allotment Guidance:\n\n- Separate Facilities: Dedicated on-campus boys and girls hostels with safe, hygienic living spaces.\n- Amenities: RO purified drinking water, solar water-heating systems, hygienic campus mess/dining, and 24/7 emergency vehicle facility.\n- Allotment & Admission: Hostel room allotment is conducted during reporting and admission on a first-come, first-served basis subject to room availability.\n- Formalities: Students complete the hostel enrollment form, submit required identification/undertakings, and obtain room keys from the hostel warden/admission desk.\n- Fees (AY 2026-27): Hostel fee INR 35,000 with INR 5,000 refundable deposit; mess charges are INR 42,000 annually.'
        : 'MITCORER provides separate hostel and mess facilities for students:\n\n- Separate hostels for boys and girls with safe accommodation\n- RO purified drinking water and solar water-heating systems\n- Emergency vehicle facility on campus for student safety\n- Campus mess and canteen facilities providing daily meals',
      next: isAllotmentOrProcess ? 'Check room availability and complete the hostel enrollment form at the admission desk.' : '',
      actionView: 'visit', actionLabel: 'Explore facilities',
    };
  }
  if ((/\b(?:sports grounds?|sports facilit\w*|box cricket|cricket ground|volleyball court|volleyball ground|badminton court|campus gym|college gym|gymnasium|physical fitness)\b/.test(normalized) || /\b(?:sports|gym)\b/.test(normalized)) && !/\b(?:world cup|icc|olympics?)\b/.test(normalized)) {
    return {
      recordId: 'KB-48',
      source: 'MITCORER Sports and Cultural Events official portals',
      sourceUrl: 'https://mitcorer.edu.in/sports.php',
      answer: "MITCORER Sports Infrastructure & Campus Cultural Life:\n\n- Sports Facilities: Dedicated outdoor campus grounds for cricket, box cricket, and volleyball, alongside badminton facilities, indoor recreation (chess, carrom), and a campus gymnasium for student fitness.\n- Sports Tournaments: Annual inter-departmental sports meet and participation in university/zonal athletic competitions.\n- Cultural Festivities: Annual Cultural Gathering showcasing student music, drama, and dance performances, alongside grand celebrations of Chhatrapati Shivaji Maharaj Jayanti (Shiv Jayanti), Ganesh Utsav, National Engineer's Day, and Teachers' Day.\n- Holistic Development: Encourages extracurricular excellence, cultural vitality, and physical wellness alongside technical railway engineering studies.",
      next: '', actionView: 'visit', actionLabel: 'Explore campus life',
    };
  }
  if (/\b(?:central workshop|machine shop|fitting shop|welding shop|carpentry shop|smithy|sheet metal|computer center|computing center|seminar halls?|audiovisual hall)\b/.test(normalized)) {
    return {
      recordId: 'KB-49',
      source: 'MITCORER Facilities portals and workshop documentation',
      sourceUrl: 'https://mitcorer.edu.in/workshops.php',
      answer: 'MITCORER Central Workshop, Computing Center, and Seminar Halls:\n\n- Central Workshop: Fully equipped fabrication and practical training facility featuring specialized sections: Machine Shop (lathes, shapers, drilling, and milling equipment), Fitting Shop, Welding Shop (electric arc & oxy-acetylene gas welding), Carpentry Shop, and Sheet Metal/Smithy for hands-on fabrication and railway prototype modeling.\n- Central Computing Center: Air-conditioned facility equipped with 100+ high-performance networked desktop systems, dedicated high-speed optical fiber internet connectivity, and licensed engineering software suites for CAD/CAM, numerical computation, and programming.\n- Seminar Halls: Acoustically treated halls with ergonomic seating, multimedia audio-visual projection equipment, and high-fidelity sound systems hosting guest lectures, academic symposia, corporate seminars, and placement sessions.',
      next: '', actionView: 'visit', actionLabel: 'Explore facilities',
    };
  }
  const hasBranchLabIntent = /\b(?:cse|computer|civil|mechanical|mech|railway|rail|aids|entc)\b/i.test(normalized);
  if (/labs|laborator|workshop/.test(normalized) && !hasBranchLabIntent && !/\b(?:industrial visits?|field visits?|railway visits?|workshop visit)\b/.test(normalized)) {
    return {
      recordId: 'KB-22',
      source: 'MITCORER Admissions FAQ and official workshop page',
      sourceUrl: 'https://mitcorer.edu.in/workshops.php',
      answer: 'MITCORER provides departmental laboratories and workshops for practical learning:\n\n- Specialized departmental laboratories for hands-on experiments\n- Computer labs equipped with modern systems and software\n- Mechanical and engineering workshops for practical training',
      next: '', actionView: 'visit', actionLabel: 'Explore facilities',
    };
  }
  if ((/\bbus\b|transport facility|bus facility|bus route|bus stop|bus fee|bus timing/.test(normalized)) && !/\b(?:nearest|distance|how far|bus stand|railway station|barshi town|kurduwadi)\b/.test(normalized)) {
    return {
      recordId: 'KB-19',
      source: 'MITCORER Bus Facility page',
      sourceUrl: 'https://mitcorer.edu.in/bus-facility.php',
      answer: 'MITCORER lists a bus facility under campus infrastructure:\n\n- College bus transportation is provided for student and staff commute\n- The published Bus Facility page does not state a route list, stops, timetable, seat availability, or transport fee\n- Route details and transport fees must be confirmed from the current transport notice or admission staff before travel',
      next: 'Request the current route, stop, timing, seat availability, and fee for your location from admission staff.',
      actionView: 'inquiry',
      actionLabel: 'Request bus details',
    };
  }
  if (/\blibrary\b|digital resources|journal/.test(normalized)) {
    return {
      recordId: 'KB-20',
      source: 'MITCORER Admissions FAQ',
      sourceUrl: 'https://mitcorer.edu.in/about-lib-details.php',
      answer: 'The MITCORER central library provides learning and research resources:\n\n- Extensive collection of reference books and engineering textbooks\n- Well-equipped library with digital resources and journals\n- Dedicated quiet reading hall for students and faculty\n- Note: The public FAQ does not publish borrowing rules, timings, or access eligibility; confirm operational details with the library',
      next: 'Check the library page for access details.',
      actionView: 'inquiry',
      actionLabel: 'Request library details',
    };
  }
  if (/cafeteria|computer center|railway model|seminar hall|classroom/.test(normalized)) {
    const facility = normalized.includes('cafeteria') ? 'cafeteria'
      : normalized.includes('computer center') ? 'computer center'
        : normalized.includes('railway model') ? 'railway model room'
          : normalized.includes('seminar') ? 'seminar hall'
            : 'classrooms';
    const pointsMap = {
      'railway model room': 'MITCORER features a dedicated Railway Model Room and practical demonstration facilities:\n\n- Scale Working Models: Working scale railway track layouts, signaling setups, and rolling stock models.\n- Practical Demonstration: Functional point-and-crossing mechanisms, interlocking simulations, and track technology cross-sections.\n- Interdisciplinary Training: Practical training across Civil Engineering (track design, structural permanent way), Mechanical & Rail Engineering (locomotive systems, rolling stock), and Computer/Electronics Engineering (railway signaling, automation).\n- Industry Exposure: Bridges classroom theory with real-world railway and metro transportation systems.',
      'computer center': 'MITCORER provides a dedicated computer center:\n\n- High-speed internet and networked computing systems\n- Modern software packages for engineering coursework and project work',
      'seminar hall': 'MITCORER features well-equipped seminar halls:\n\n- Audio-visual projection and presentation facilities\n- Space for guest lectures, workshops, and technical conferences',
      'classrooms': 'MITCORER provides modern classroom infrastructure:\n\n- Spacious and ventilated lecture classrooms\n- Interactive presentation tools and teaching aids',
      'cafeteria': 'MITCORER provides a campus cafeteria:\n\n- Clean and hygienic dining environment for students and staff\n- Daily snacks, refreshments, and meal options',
    };
    return {
      recordId: facility === 'railway model room' ? 'KB-42' : 'KB-36',
      source: facility === 'railway model room' ? 'MITCORER Railway Model Room portal and official brochure' : 'MITCORER Admissions FAQ and infrastructure pages',
      ...(facility === 'railway model room' ? { sourceUrl: 'https://www.mitcorer.edu.in/railway-model-room.php' } : {}),
      answer: pointsMap[facility] || `MITCORER lists a ${facility} among its campus facilities.`,
      next: facility === 'railway model room' ? '' : 'Use the official contact details to confirm the current operational details before making a visit decision.',
      actionView: facility === 'railway model room' ? 'visit' : 'inquiry',
      actionLabel: facility === 'railway model room' ? 'Explore facilities' : 'Request facility details',
    };
  }
  return null;
}

export function retrieveKnowledge(question, vectorScores = null) {
  const normalizedQuestion = normalizeIntentText(question);
  const rawQuestion = String(question || '').normalize('NFKC').toLocaleLowerCase();
  if (/\b(?:personal\s*(?:whatsapp|phone|number|mobile|contact)|private\s*(?:number|phone|mobile|contact)|student\s*(?:phone|mobile|number|record)|personal record)\b/i.test(rawQuestion)) {
    return [];
  }
  if (isEmploymentQuery(question) || isEmploymentQuery(normalizedQuestion)) {
    return [];
  }
  const intentText = `${normalizedQuestion} ${rawQuestion}`;
  const stopWords = new Set(['the', 'and', 'for', 'with', 'then', 'that', 'this', 'from', 'into', 'got', 'have', 'has', 'are', 'was', 'what', 'which', 'can']);
  const words = new Set(tokenize(normalizedQuestion).filter((word) => !stopWords.has(word)));
  const categoryHints = [
    [['eligible', 'eligibility', 'percentile', 'pcm'], 'eligibility'],
    [['cutoff', 'closing', 'rank'], 'cutoff'],
    [['fee', 'payment', 'amount', 'installment'], 'fees'],
    [['document', 'certificate', 'marksheet', 'aadhaar', 'domicile', 'validity'], 'documents'],
    [['scholarship', 'pragati', 'concession', 'ebc', 'ews', 'tfws', 'income'], 'scholarship'],
    [['hostel', 'mess', 'library', 'wifi', 'laboratory', 'bus', 'transport', 'facility'], 'facilities'],
    [['placement', 'package', 'company', 'recruiter', 'internship', 'career'], 'placement'],
    [['contact', 'phone', 'email', 'address', 'reach', 'station'], 'contact'],
    [['seat matrix', 'cap seats', 'sanctioned intake'], 'seat matrix'],
    [['polytechnic', 'diploma', 'program', 'course', 'branch', 'choice code', 'intake'], 'programs'],
    [['acap', 'non cap', 'non-cap', 'institute level', 'management quota', 'vacancy', 'merit list'], 'admissions'],
    [['attendance', 'absence', 'detained', 'biometric', 'condonation'], 'university rules'],
    [['faculty', 'teacher', 'professor', 'teaching staff', 'alumni', 'why choose'], 'About MITCORER'],
  ];
  const preferredCategory = categoryHints.find(([terms]) => terms.some((term) => matchesIntent(rawQuestion, term) || matchesIntent(normalizedQuestion, term)))?.[1] || '';
  const targetedRecordIds = new Set();
  const primaryRecordIds = new Set();
  const asksForDocuments = ['document', 'documents', 'certificate', 'certificates', 'checklist', 'papers'].some((term) => words.has(term));
  const hasWorkflowContext = ['admission', 'allotment', 'reporting', 'cap', 'acap'].some((term) => intentText.includes(term));
  const hasStrongReadinessMarker = ['what else', 'what remaining', 'what is remaining', 'remaining', 'pending', 'last step', 'final step', 'reporting checklist', 'admission checklist', 'final admission checklist', 'before institute reporting', 'after allotment']
    .some((term) => intentText.includes(term));
  const hasProgressSignal = ['received', 'got', 'accepted', 'uploaded', 'paid', 'payment done', 'reporting complete'].some((term) => intentText.includes(term));
  const hasNextStepWithProgress = ['what next', 'what should i do next', 'next step'].some((term) => intentText.includes(term)) && hasProgressSignal;
  const isReadinessQuestion = hasWorkflowContext && (hasStrongReadinessMarker || hasNextStepWithProgress);
  if (asksForDocuments && (words.has('sc') || words.has('st') || normalizedQuestion.includes('scheduled caste') || normalizedQuestion.includes('scheduled tribe'))) targetedRecordIds.add('KB-26');
  if (asksForDocuments && (['obc', 'ews', 'vjnt', 'sbc'].some((term) => words.has(term)) || normalizedQuestion.includes('non creamy'))) targetedRecordIds.add('KB-27');
  if (asksForDocuments) targetedRecordIds.add('KB-1');
  if (['what else', 'what remaining', 'what is remaining', 'last step', 'final step'].some((term) => normalizedQuestion.includes(term)) && normalizedQuestion.includes('admission')) targetedRecordIds.add('KB-1');
  if (isReadinessQuestion) {
    targetedRecordIds.add('KB-1');
    primaryRecordIds.add('KB-1');
  }
  if (['exam', 'exams', 'entrance'].some((term) => words.has(term)) && ['accepted', 'accept', 'which'].some((term) => words.has(term))) targetedRecordIds.add('KB-25');
  if (/\b(?:mht[- ]?cet|jee|jee main|entrance exam)\b/.test(normalizedQuestion) && !/\b(?:scholarship|eligibility|percentage|criteria|percentile|pcm)\b/.test(normalizedQuestion)) {
    targetedRecordIds.add('KB-25');
    if (/\b(?:accepted|entrance|exam)\b/.test(normalizedQuestion)) primaryRecordIds.add('KB-25');
  }
  if (rawQuestion.includes('cap round') || rawQuestion.includes('cap process') || rawQuestion.includes('option form') || rawQuestion.includes('betterment') || rawQuestion.includes('freeze')) targetedRecordIds.add('KB-29');
  if (rawQuestion.includes('acap') || rawQuestion.includes('non cap') || rawQuestion.includes('non-cap') || rawQuestion.includes('institute level') || rawQuestion.includes('management quota') || rawQuestion.includes('against cap')) {
    targetedRecordIds.add('KB-14');
    primaryRecordIds.add('KB-14');
  }
  if (['deadline', 'last date', 'admission date', 'reporting date', 'admission schedule'].some((term) => rawQuestion.includes(term)) || normalizedQuestion.includes('deadline')) targetedRecordIds.add('KB-30');
  if (/attendance|present|absen|detain|condonation|biometric|\bxx\b/.test(normalizedQuestion)) {
    if (normalizedQuestion.includes('biometric')) {
      targetedRecordIds.add('KB-32');
      primaryRecordIds.add('KB-32');
    } else {
      targetedRecordIds.add('KB-31');
      primaryRecordIds.add('KB-31');
    }
  }
  if (['scholarship', 'financial aid', 'mahadbt'].some((term) => rawQuestion.includes(term)) && !rawQuestion.includes('fee')) targetedRecordIds.add('KB-18');
  if (rawQuestion.includes('pragati') || normalizedQuestion.includes('pragati')) {
    targetedRecordIds.add('KB-33');
    primaryRecordIds.add('KB-33');
  }
  if (rawQuestion.includes('bus') || rawQuestion.includes('transport')) targetedRecordIds.add('KB-19');
  if (rawQuestion.includes('library') || rawQuestion.includes('digital resources') || rawQuestion.includes('journal')) targetedRecordIds.add('KB-20');
  if (rawQuestion.includes('wifi') || rawQuestion.includes('wi-fi') || rawQuestion.includes('internet')) targetedRecordIds.add('KB-21');
  if (rawQuestion.includes('laboratory') || rawQuestion.includes('laboratories') || rawQuestion.includes(' lab ') || rawQuestion.includes('workshop')) targetedRecordIds.add('KB-22');
  if (rawQuestion.includes('hostel') && !['fee', 'fees', 'payment', 'amount', 'charges', 'cost'].some((term) => rawQuestion.includes(term))) targetedRecordIds.add('KB-23');
  if (rawQuestion.includes('placement assistance') || rawQuestion.includes('placement cell') || rawQuestion.includes('internship')) targetedRecordIds.add('KB-24');
  if (['placement', 'company', 'companies', 'package', 'recruiter'].some((term) => rawQuestion.includes(term))) targetedRecordIds.add('KB-16');
  if (['contact', 'phone', 'email', 'address', 'how to reach'].some((term) => rawQuestion.includes(term))) targetedRecordIds.add('KB-17');
  if (rawQuestion.includes('tell me about mitcorer') || rawQuestion.includes('about mitcorer') || rawQuestion.includes('about us') || rawQuestion.includes('about the college')) {
    targetedRecordIds.add('KB-34');
    primaryRecordIds.add('KB-34');
  }
  if (rawQuestion.includes('why should i choose mitcorer') || rawQuestion.includes('why mitcorer') || rawQuestion.includes('why choose mitcorer')) {
    targetedRecordIds.add('KB-35');
    primaryRecordIds.add('KB-35');
  }
  if (['faculty', 'faculties', 'teacher', 'teachers', 'professor', 'professors', 'teaching staff', 'staff', 'alumni'].some((term) => rawQuestion.includes(term) || normalizedQuestion.includes(term))) {
    const isJobOrHiringQuery = /\b(?:hiring|recruitment|vacancy|vacancies|job|jobs|career|careers|vacancy notice|opening|openings|employment|apply for job|work with us)\b/i.test(rawQuestion);
    if (!isJobOrHiringQuery) {
      targetedRecordIds.add('KB-35');
      primaryRecordIds.add('KB-35');
    }
  }
  if (['affiliation', 'affiliated', 'solapur university', 'pahsu', 'aicte', 'dte code', 'institute code', '06901', 'who is the principal', 'college principal', 'principal of', 'principal name', 'madhukar lengare'].some((term) => rawQuestion.includes(term) || normalizedQuestion.includes(term))) {
    targetedRecordIds.add('KB-37');
    primaryRecordIds.add('KB-37');
  }
  if (['hod', 'head of department', 'department head', 'somnath mule', 'amit shinde', 'sanjay mane', 'honors degree', 'minor degree'].some((term) => rawQuestion.includes(term) || normalizedQuestion.includes(term)) || (normalizedQuestion.includes('lab') && (normalizedQuestion.includes('cse') || normalizedQuestion.includes('civil') || normalizedQuestion.includes('mechanical')))) {
    targetedRecordIds.add('KB-38');
    primaryRecordIds.add('KB-38');
  }
  if (['nss', 'national service scheme', 'rail-mit', 'rail mit', 'technical event', 'technical events', 'asimit', 'space'].some((term) => rawQuestion.includes(term) || normalizedQuestion.includes(term))) {
    targetedRecordIds.add('KB-39');
    primaryRecordIds.add('KB-39');
  }
  if (['nearest railway station', 'railway station', 'barshi town', 'kurduwadi', 'nearest bus stop', 'nearest bus stand', 'barshi bus stand', 'how to reach the college', 'reach mitcorer', 'transit direction', 'distance from station', 'distance from bus stand', 'reach by train', 'reach by bus'].some((term) => rawQuestion.includes(term) || normalizedQuestion.includes(term))) {
    targetedRecordIds.add('KB-40');
    primaryRecordIds.add('KB-40');
  }
  if (['student club', 'student clubs', 'technical club', 'technical clubs', 'robotics club', 'coding club', 'student association', 'technical chapter', 'space', 'mesa', 'cesa', 'eesa', 'asimit'].some((term) => rawQuestion.includes(term) || normalizedQuestion.includes(term))) {
    targetedRecordIds.add('KB-50');
    primaryRecordIds.add('KB-50');
  }
  if (['industrial visit', 'industrial visits', 'railway visit', 'railway visits', 'field visit', 'field training', 'workshop visit', 'kurduwadi workshop'].some((term) => rawQuestion.includes(term) || normalizedQuestion.includes(term))) {
    targetedRecordIds.add('KB-51');
    primaryRecordIds.add('KB-51');
  }
  if (['same as mit pune', 'mit pune', 'maeer mit pune', 'mit wpu', 'parent trust', 'mit group of institutions', 'connection with mit pune', 'relationship with mit pune'].some((term) => rawQuestion.includes(term) || normalizedQuestion.includes(term))) {
    targetedRecordIds.add('KB-41');
    primaryRecordIds.add('KB-41');
  }
  if (['railway model room', 'railway model', 'model room', 'railway practical', 'signaling setup', 'railway simulation', 'track models'].some((term) => rawQuestion.includes(term) || normalizedQuestion.includes(term))) {
    targetedRecordIds.add('KB-42');
    primaryRecordIds.add('KB-42');
  }
  if (['mou', 'mous', 'industry mou', 'corporate readiness', 'industry partner', 'industry tie-up', 'aptitude training', 'soft skills training', 'mock interview', 'bvg india', 'aptron'].some((term) => rawQuestion.includes(term) || normalizedQuestion.includes(term))) {
    targetedRecordIds.add('KB-43');
    primaryRecordIds.add('KB-43');
  }
  if (['anti-ragging', 'anti ragging', 'ragging', 'ragging free', 'campus safety', 'emergency vehicle', 'ambulance', 'medical emergency', 'medical facility', 'student welfare', 'grievance cell'].some((term) => rawQuestion.includes(term) || normalizedQuestion.includes(term))) {
    targetedRecordIds.add('KB-44');
    primaryRecordIds.add('KB-44');
  }
  if (['nep', 'nep 2020', 'national education policy', 'outcome based education', 'obe', 'medium of instruction', 'english medium', 'curriculum pattern'].some((term) => rawQuestion.includes(term) || normalizedQuestion.includes(term))) {
    targetedRecordIds.add('KB-45');
    primaryRecordIds.add('KB-45');
  }
  if (['office hour', 'office hours', 'office timing', 'office timings', 'working hour', 'working hours', 'admission desk', 'enquiry desk', 'visiting hour', 'visiting hours', 'college timing', 'college timings', 'working days', 'open on saturday'].some((term) => rawQuestion.includes(term) || normalizedQuestion.includes(term))) {
    targetedRecordIds.add('KB-46');
    primaryRecordIds.add('KB-46');
  }
  if (['professional diploma', 'professional diplomas', 'railway diploma', 'railway diplomas', 'railway track technology', 'railway signaling', 'railway signalling', 'rolling stock', 'rolling stocks', 'software technology in railway', 'railway specializations', 'railway modules'].some((term) => rawQuestion.includes(term) || normalizedQuestion.includes(term))) {
    targetedRecordIds.add('KB-47');
    primaryRecordIds.add('KB-47');
  }
  if (['sports facility', 'sports facilities', 'sports ground', 'sports grounds', 'cricket ground', 'box cricket', 'volleyball court', 'volleyball ground', 'badminton court', 'gym', 'gymnasium', 'cultural event', 'cultural events', 'cultural gathering', 'annual gathering', 'cultural fest', 'shiv jayanti', 'ganesh utsav'].some((term) => rawQuestion.includes(term) || normalizedQuestion.includes(term)) && !['nss', 'rail-mit', 'technical event', 'world cup', 'icc'].some((term) => rawQuestion.includes(term) || normalizedQuestion.includes(term))) {
    targetedRecordIds.add('KB-48');
    primaryRecordIds.add('KB-48');
  }
  if (['central workshop', 'machine shop', 'fitting shop', 'welding shop', 'carpentry shop', 'computer center', 'computing center', 'seminar hall', 'seminar halls'].some((term) => rawQuestion.includes(term) || normalizedQuestion.includes(term))) {
    targetedRecordIds.add('KB-49');
    primaryRecordIds.add('KB-49');
  }
  if (/campus facilit|college facilit|facilities available|campus infrastructure/.test(normalizedQuestion)) {
    targetedRecordIds.add('KB-36');
    primaryRecordIds.add('KB-36');
  }
  if (rawQuestion.includes('how do i apply') || rawQuestion.includes('admission enquiry') || rawQuestion.includes('start my application')) {
    targetedRecordIds.add('KB-14');
    primaryRecordIds.add('KB-14');
  }
  if ((rawQuestion.includes('polytechnic') || rawQuestion.includes('polytechnic course') || ['polytechnic diploma', 'msbte', 'diploma engineering', 'diploma courses', 'diploma after 10th', 'post ssc diploma', 'polytechnic intake', 'polytechnic eligibility'].some((term) => rawQuestion.includes(term) || normalizedQuestion.includes(term))) && !['railway diploma', 'professional diploma', 'direct second', 'dse', 'fee', 'fees', 'cost'].some((term) => rawQuestion.includes(term) || normalizedQuestion.includes(term))) {
    targetedRecordIds.add('KB-12');
    primaryRecordIds.add('KB-12');
  }
  if (rawQuestion.includes('available b.tech programs') || rawQuestion.includes('all b.tech programs') || rawQuestion.includes('programs and choice codes') || ['artificial intelligence', 'data science', 'ai and ds', 'ai ds', 'electronics and telecommunication', 'electronics and computer', 'branches offered', 'courses offered', 'programs offered'].some((term) => rawQuestion.includes(term) || normalizedQuestion.includes(term))) {
    targetedRecordIds.add('KB-10');
    primaryRecordIds.add('KB-10');
  }
  if (normalizedQuestion.includes('scholarship')) primaryRecordIds.add('KB-18');
  if (normalizedQuestion.includes('seat matrix')) primaryRecordIds.add('KB-6');
  if (normalizedQuestion.includes('program') && rawQuestion.includes('b.tech')) primaryRecordIds.add('KB-10');
  const hasAccommodation = ['hostel', 'mess', 'accommodation', 'stay'].some((term) => matchesIntent(rawQuestion, term) || matchesIntent(normalizedQuestion, term));
  const hasFee = ['fee', 'fees', 'payment', 'amount', 'charges', 'cost', 'deposit', 'price'].some((term) => matchesIntent(rawQuestion, term) || matchesIntent(normalizedQuestion, term));
  const asksAccommodationFee = hasAccommodation && hasFee;
  if (asksAccommodationFee) {
    targetedRecordIds.add('KB-3');
    primaryRecordIds.add('KB-3');
  }
  if (hasAccommodation && !hasFee) {
    targetedRecordIds.add('KB-23');
    primaryRecordIds.add('KB-23');
  }
  if (hasFee) {
    targetedRecordIds.add('KB-2');
    if (!asksAccommodationFee && !isReadinessQuestion) primaryRecordIds.add('KB-2');
  }
  if (rawQuestion.includes('seat matrix')) targetedRecordIds.add('KB-6');
  if (words.has('eligible')) words.add('eligibility');
  if (words.has('eligibility')) words.add('eligible');
  if (words.has('cse')) {
    words.add('computer');
    words.add('science');
  }
  const publishedKnowledge = (getDb().knowledge || []).filter(usableKnowledge);
  const referenceTokens = rawQuestion.match(/(?=[a-z0-9-]*[a-z])(?=[a-z0-9-]*\d)[a-z0-9-]{5,}/g) || [];
  return publishedKnowledge
    .map((item) => {
      const titleWords = new Set(tokenize(item.title));
      const categoryWords = new Set(tokenize(item.category));
      const textWords = new Set(tokenize(item.text));
      const tags = (item.tags || []).map((tag) => String(tag).toLocaleLowerCase());
      const relevanceScore = [...words].reduce((total, word) => {
        if (titleWords.has(word)) return total + 5;
        if (categoryWords.has(word)) return total + 3;
        if (textWords.has(word)) return total + 1;
        return total;
      }, 0);
      const tagScore = tags.reduce((total, tag) => {
        if (normalizedQuestion.includes(tag)) return total + 18;
        const tagWords = tokenize(tag);
        if (tagWords.length > 0 && tagWords.every((word) => words.has(word))) return total + 16;
        return total + (words.has(tag) ? 10 : 0);
      }, 0);
      const referenceTokenScore = referenceTokens.some((token) => `${item.title} ${item.text}`.toLocaleLowerCase().includes(token)) ? 200 : 0;
      const conceptScore = computeConceptScore(question, item);
      const vectorScore = (vectorScores instanceof Map) ? (vectorScores.get(item.id) || 0) : 0;
      const semanticBoost = Math.max(conceptScore, vectorScore);
      let branchScoreAdjustment = 0;
      const qBranchObj = understandQuery(question);
      const activeBranches = qBranchObj.branch.positive;
      if (activeBranches.length === 1 && !asksForAllPrograms(normalizedQuestion)) {
        const b = activeBranches[0];
        const itemTags = (item.tags || []).map(t => String(t).toLowerCase());
        const itemTitle = String(item.title || '').toLowerCase();
        const branchKeywords = {
          civil: ['civil', 'amit shinde'],
          mechanical: ['mechanical', 'rail', 'sanjay mane'],
          cse: ['cse', 'computer', 'somnath mule'],
        };
        const competingMap = {
          civil: ['cse', 'computer', 'mechanical', 'sanjay mane', 'somnath mule'],
          mechanical: ['cse', 'computer', 'civil', 'amit shinde', 'somnath mule'],
          cse: ['civil', 'mechanical', 'amit shinde', 'sanjay mane'],
        };
        const matchesTarget = (branchKeywords[b] || []).some(k => itemTags.includes(k) || itemTitle.includes(k));
        const matchesCompeting = (competingMap[b] || []).some(k => itemTags.includes(k) || itemTitle.includes(k));
        if (matchesTarget && !matchesCompeting) branchScoreAdjustment += 50;
        else if (matchesCompeting && !matchesTarget) branchScoreAdjustment -= 50;
      }
      const score = relevanceScore + tagScore + referenceTokenScore + semanticBoost + branchScoreAdjustment + (item.category.toLocaleLowerCase() === preferredCategory ? 20 : 0) + (targetedRecordIds.has(item.id) ? 50 : 0) + (primaryRecordIds.has(item.id) ? 100 : 0);
      return { ...item, score };
    })
    .filter((item) => item.score >= 2)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);
}

/**
 * Detect advisory / synthesis questions that deserve a Gemini-generated
 * conversational answer rather than a flat deterministic database record.
 * These are open-ended questions asking for explanations, comparisons, or
 * recommendations — NOT factual lookups (fees, cutoffs, codes, deadlines).
 */
function isAdvisoryQuestion(normalized) {
  const advisoryPatterns = [
    /\bwhy should\b/,
    /\bwhy (?:choose|select|pick|join|study|consider)\b/,
    /\bwhat makes (?:mitcorer|this college|the college|it)\b/,
    /\bis it worth\b/,
    /\bhow does (?:mitcorer|the college|this college|practical|learning|training)\b/,
    /\bdescribe (?:the|mitcorer)\b/,
    /\bcan you (?:describe|explain|tell me about|give (?:me )?an overview)\b/,
    /\bexplain (?:the|how|why|what)\b/,
    /\bwhat (?:is the (?:learning|teaching|practical|training)|are the benefits|are the advantages)\b/,
    /\bshould i (?:choose|join|apply|consider|go for)\b/,
    /\btell me (?:about|more about|an overview)\b/,
    /\boverview of\b/,
    /\bwhat (?:kind of|type of) (?:learning|experience|environment|training)\b/,
    /\bhow (?:do students|are students|is the)\b/,
  ];
  return advisoryPatterns.some((pattern) => pattern.test(normalized));
}

/**
 * FIX #4 — Smart no-answer suggestions.
 * When Mitra cannot find a verified answer, instead of always showing the same
 * generic "contact us" buttons, this function analyses what the student was trying
 * to ask and returns 3 topic-relevant follow-up questions they CAN actually answer.
 *
 * This prevents dead ends and keeps the student engaged in the right direction.
 */
function buildNoAnswerSuggestions(normalized) {
  // Placement / career related
  if (/\b(?:placement|recruiter|package|internship|job|career|company|companies|alumni)\b/.test(normalized)) {
    return [
      { label: 'Highest Package (21 LPA)', question: 'What is the highest package at MITCORER?' },
      { label: 'Top Recruiters List', question: 'Which companies visit MITCORER for campus placement?' },
      { label: 'T&P Cell & MoUs', question: 'What is the MITCORER Training and Placement cell?' },
    ];
  }
  // Fee / cost / scholarship related
  if (/\b(?:fee|fees|cost|charge|tuition|scholarship|loan|concession|mahadbt|ebc|ews|tfws)\b/.test(normalized)) {
    return [
      { label: 'B.Tech Fee Structure', question: 'What are the B.Tech engineering fees for Open category?' },
      { label: 'Category Fee Concessions', question: 'What are the engineering fees for OBC and SC categories?' },
      { label: 'Scholarship Options', question: 'What scholarship support is available at MITCORER?' },
    ];
  }
  // Hostel / accommodation related
  if (/\b(?:hostel|mess|accommodation|room|food|stay|residential|canteen)\b/.test(normalized)) {
    return [
      { label: 'Hostel & Mess Fees', question: 'What are the hostel and mess fees at MITCORER?' },
      { label: 'Hostel Facilities', question: 'What facilities are available in the MITCORER hostel?' },
      { label: 'Hostel Admission Process', question: 'What is the MITCORER hostel admission process?' },
    ];
  }
  // Course / program / branch related
  if (/\b(?:course|courses|programme|branch|department|syllabus|subject|curriculum|btech|b\.tech|diploma)\b/.test(normalized)) {
    return [
      { label: 'All B.Tech Courses', question: 'Which B.Tech courses are offered at MITCORER?' },
      { label: 'Computer Science & Engineering', question: 'Tell me about Computer Science and Engineering at MITCORER' },
      { label: 'Railway Engineering Focus', question: 'What are the professional railway diplomas at MITCORER?' },
    ];
  }
  // Admission / eligibility / cutoff related
  if (/\b(?:admission|apply|eligib|cutoff|percentile|mht cet|jee|cap round|document|certificate)\b/.test(normalized)) {
    return [
      { label: 'Admission Process', question: 'What is the MITCORER B.Tech admission process?' },
      { label: 'Eligibility Criteria', question: 'What is the eligibility criteria for B.Tech admission?' },
      { label: 'Required Documents', question: 'What documents are needed for MITCORER admission?' },
    ];
  }
  // Facilities / campus / infrastructure related
  if (/\b(?:lab|laborator|workshop|library|facility|facilities|infrastructure|building|campus|equipment)\b/.test(normalized)) {
    return [
      { label: 'Labs & Workshops', question: 'What laboratories and workshops are available at MITCORER?' },
      { label: 'Railway Model Room', question: 'Tell me about the Railway Model Room at MITCORER' },
      { label: 'Library & Computer Labs', question: 'What are the library and computer lab facilities at MITCORER?' },
    ];
  }
  // Faculty / staff / teaching related
  if (/\b(?:faculty|teacher|professor|staff|hod|principal|head|department)\b/.test(normalized)) {
    return [
      { label: 'Faculty Count & Highlights', question: 'How many faculty members does MITCORER have?' },
      { label: 'Why Choose MITCORER', question: 'Why should an engineering aspirant consider MITCORER?' },
      { label: 'Contact Admissions Office', question: 'What is the MITCORER admission helpline number?' },
    ];
  }
  // Contact / location / address related
  if (/\b(?:contact|phone|email|address|location|reach|distance|timing|office|website)\b/.test(normalized)) {
    return [
      { label: 'Admission Helpline & Hours', question: 'What are the MITCORER office timings and admission helpline?' },
      { label: 'College Address & Map', question: 'Where is MITCORER located and what is the address?' },
      { label: 'Official Website & Email', question: 'What is the official MITCORER website and email address?' },
    ];
  }
  // Default — generic but still useful suggestions
  return [
    { label: 'Admission Process', question: 'What is the MITCORER B.Tech admission process?' },
    { label: 'B.Tech Fees', question: 'What are the B.Tech engineering fees at MITCORER?' },
    { label: 'Contact Admissions', question: 'What is the MITCORER admission helpline number?' },
  ];
}


async function generateWithGemini(question, routedAnswer, evidence) {
  if (!config.geminiApiKey || evidence.length === 0) return null;
  const evidenceText = evidence.map((item, index) => `[${index + 1}] ${item.title} (${item.source}): ${item.text}`).join('\n\n');
  return requestGeneration({ apiKey: config.geminiApiKey, primaryModel: config.geminiModel,
    fallbackModel: config.geminiFallbackModel, body: {
        // FIX #1 — Rich system prompt with college identity, tone, citation rules, and language guidance.
        systemInstruction: {
          parts: [{
            text: `You are Mitra, the friendly and knowledgeable admission assistant for MIT College of Railway Engineering and Research (MITCORER), Barshi, Solapur District, Maharashtra, India.

Your role: Help students, parents, and aspirants understand MITCORER — its admissions, courses, fees, hostel, campus life, placements, and facilities — using only the verified evidence provided.

STRICT RULES you must follow at all times:
1. Use ONLY the verified evidence provided below. Do NOT add any information from your own training or the internet.
2. Preserve all numbers, percentages, dates, seat counts, choice codes, and fee amounts EXACTLY as they appear in the evidence — never round, estimate, or change them.
3. Never promise or guarantee admission, placement, scholarships, hostel allocation, or any specific outcome.
4. If the provided evidence is insufficient to answer the question accurately, respond EXACTLY with the word: INSUFFICIENT_EVIDENCE
5. Write in a warm, helpful, specific, and conversational tone — as if a knowledgeable staff member is advising a student in person.
6. Respond in the same language the student used. If they wrote in English, reply in English. If they wrote in Marathi (or Roman Marathi), reply in Marathi.
7. Keep your answer concise — under 180 words. Be specific, not vague.
8. Do not start your answer with "Based on the evidence" or "According to the evidence" — just answer directly.

College context for tone only (do not use as factual source):
MITCORER is an MIT Group college with a unique focus on railway engineering alongside Computer Science, Mechanical, Civil, Electronics, and AI & Data Science programmes. It is affiliated to PAHSU (Pune) and approved by AICTE, with DTE institute code 06901.`,
          }],
        },
        contents: [{
          role: 'user',
          parts: [{ text: `Student question: ${question}\n\nVerified official evidence:\n${evidenceText}\n\nAnswer the student's question warmly and accurately using only the evidence above.` }],
        }],
        generationConfig: { temperature: 0.2, maxOutputTokens: 420 },
      } });
}

export function generateQuerySuggestions(question, normalized) {
  const norm = String(normalized || '').toLocaleLowerCase();
  if (/\b(?:placement|recruiter|package|internship)\b/.test(norm)) {
    return [
      { label: 'Highest Package (21 LPA)', question: 'What is the highest package at MITCORER?' },
      { label: 'Top Recruiters List', question: 'Which companies visit MITCORER for campus placement?' },
      { label: 'T&P Cell MoUs', question: 'What industry MoUs does MITCORER have?' },
      { label: 'Interview Process', question: 'What is the MITCORER campus interview process?' },
    ];
  }
  if (/\b(?:fee|fees|cost|charge|tuition|installment)\b/.test(norm) && !/\bhostel\b/.test(norm)) {
    return [
      { label: 'B.Tech Open Category Fee', question: 'What are the first-year B.Tech engineering fees for Open category?' },
      { label: 'OBC / EBC Concession', question: 'What are the B.Tech engineering fees for OBC category?' },
      { label: 'SC / ST Concession', question: 'What are the B.Tech engineering fees for SC category?' },
      { label: 'Direct Second Year Fee', question: 'What are the Direct Second Year engineering fees?' },
    ];
  }
  if (/\b(?:hostel|mess|accommodation)\b/.test(norm)) {
    return [
      { label: 'Hostel & Mess Annual Cost', question: 'What are the hostel and mess fees at MITCORER?' },
      { label: 'Boys & Girls Hostel Amenities', question: 'What facilities are available in the hostel?' },
      { label: 'Hostel Food & Security', question: 'Tell me about MITCORER hostel food and safety' },
      { label: 'Hostel Admission Steps', question: 'What is the MITCORER hostel admission process?' },
    ];
  }
  if (/\b(?:b\.?tech admission|engineering admission|admission process|how to apply|admission 2026)\b/.test(norm)) {
    return [
      { label: 'CAP Round Process', question: 'What is the CAP round engineering admission process?' },
      { label: 'Required Documents', question: 'What are the required admission documents?' },
      { label: 'Entrance Exams Accepted', question: 'Which exams are accepted for engineering admission?' },
      { label: 'Institute-Level (ACAP) Seats', question: 'What is ACAP and institute-level admission?' },
    ];
  }
  if (/\b(?:courses?|programmes?|branches?)\b/.test(norm)) {
    return [
      { label: 'B.Tech Courses List', question: 'Which B.Tech courses are offered at MITCORER?' },
      { label: 'Computer Science & Engineering', question: 'Tell me about Computer Science and Engineering at MITCORER' },
      { label: 'Mechanical & Rail Engineering', question: 'Tell me about Mechanical and Rail Engineering' },
      { label: 'Polytechnic Diploma', question: 'Which Polytechnic diploma courses are offered?' },
    ];
  }
  if (/\b(?:computer science|computer engineering|cse)\b/.test(norm)) {
    return [
      { label: 'CSE Intake & Choice Code', question: 'What is the choice code and intake for Computer Science and Engineering?' },
      { label: 'Honors in AI/ML & Cyber Security', question: 'What honor degrees are offered in CSE?' },
      { label: 'CSE Labs & Infrastructure', question: 'What laboratories does Computer Science Department have?' },
      { label: 'CSE Placement Highlights', question: 'What are the placement opportunities after Computer Engineering?' },
    ];
  }
  if (/\b(?:mechanical|rail engineering)\b/.test(norm)) {
    return [
      { label: 'Rail Engineering Scope', question: 'What are the career opportunities in railway engineering?' },
      { label: 'Railway Model Room', question: 'Tell me about the Railway Model Room at MITCORER' },
      { label: 'Professional Railway Diplomas', question: 'What are the professional railway diplomas at MITCORER?' },
      { label: 'Central Workshop Facilities', question: 'Tell me about the central workshop and labs' },
    ];
  }
  if (/\b(?:ai and data science|ai & ds|data science)\b/.test(norm)) {
    return [
      { label: 'AI & DS Eligibility & Intake', question: 'What is the eligibility and intake for AI and Data Science?' },
      { label: 'Career Scope after AI & DS', question: 'What is the career after AI and Data Science engineering?' },
      { label: 'AI & Data Science Labs', question: 'What computing facilities support AI and Data Science?' },
      { label: 'B.Tech Program Details', question: 'Which B.Tech courses are offered at MITCORER?' },
    ];
  }
  if (/\b(?:civil engineering)\b/.test(norm)) {
    return [
      { label: 'Civil Engineering Intake', question: 'What is the intake for Civil Engineering?' },
      { label: 'Railway Track Specialization', question: 'Tell me about railway track technology specialization' },
      { label: 'Civil Department Labs', question: 'What laboratories are available in Civil Engineering?' },
      { label: 'Minor Degree in Software', question: 'Can Civil students take a minor degree in Software Engineering?' },
    ];
  }
  if (/\b(?:contact|helpline|phone|address|location|reach|distance|timings?)\b/.test(norm)) {
    return [
      { label: 'Admission Helpline & Office Hours', question: 'What are the office timings and admission helpline?' },
      { label: 'College Address & Map', question: 'Where is MITCORER located and what is the address?' },
      { label: 'Solapur to Barshi Distance', question: 'What is the distance from Solapur to MITCORER Barshi?' },
      { label: 'Official Website & Email', question: 'What is the official website and email address?' },
    ];
  }
  if (/\b(?:scholarship|pragati|mahadbt|concession)\b/.test(norm)) {
    return [
      { label: 'Government Scholarships (MahaDBT)', question: 'What scholarship support is available?' },
      { label: 'AICTE Pragati for Girls', question: 'Tell me about the AICTE Pragati scholarship for girl students' },
      { label: 'Education Loan Assistance', question: 'What education loan assistance is provided?' },
      { label: 'Category Fee Concessions', question: 'What are the engineering fees for OBC and SC categories?' },
    ];
  }
  return [];
}

function validateBranchRelevance(answerText, question, context = {}) {
  const normQ = String(question || '').normalize('NFKC').toLowerCase();
  const qObj = understandQuery(question);
  const branches = qObj.branch.positive;
  let targetBranch = branches.length === 1 ? branches[0] : null;
  if (!targetBranch && context.branch && !qObj.branch.excluded.length && !asksForAllPrograms(normQ)) {
    const map = {
      'Civil Engineering': 'civil',
      'Computer Engineering': 'cse',
      'Mechanical & Rail Engineering': 'mechanical',
      'AI & Data Science': 'aids',
      'Electronics & Telecommunication': 'entc',
    };
    targetBranch = map[context.branch] || null;
  }
  if (!targetBranch || asksForAllPrograms(normQ)) return answerText;

  const competingSignatures = {
    civil: [/\bmechanical(?: and rail)?(?: engineering)?\b/i, /\bdr\.? sanjay (?:pandurang )?mane\b/i, /\bprof\.? somnath mule\b/i, /\bcomputer science & engineering\b/i, /\b0690124210\b/, /\b0690161210\b/],
    mechanical: [/\bcivil engineering\b/i, /\bprof\.? amit (?:raosaheb )?shinde\b/i, /\bprof\.? somnath mule\b/i, /\bcomputer science & engineering\b/i, /\b0690119110\b/, /\b0690124210\b/],
    cse: [/\bcivil engineering\b/i, /\bprof\.? amit (?:raosaheb )?shinde\b/i, /\bdr\.? sanjay (?:pandurang )?mane\b/i, /\bmechanical(?: and rail)?(?: engineering)?\b/i, /\b0690119110\b/, /\b0690161210\b/],
  };

  const forbidden = competingSignatures[targetBranch];
  if (!forbidden) return answerText;

  const hasCompeting = forbidden.some(regex => regex.test(answerText));
  if (hasCompeting && answerText.includes('\n- ')) {
    const lines = answerText.split('\n');
    const filteredLines = [];
    let keeping = true;
    for (const line of lines) {
      if (line.trim().startsWith('- ')) {
        if (targetBranch === 'civil') keeping = /\bcivil\b|amit shinde/i.test(line);
        else if (targetBranch === 'mechanical') keeping = /\bmechanical|rail\b|sanjay mane/i.test(line);
        else if (targetBranch === 'cse') keeping = /\bcomputer|cse\b|somnath mule/i.test(line);
      }
      if (keeping) filteredLines.push(line);
    }
    const filtered = filteredLines.join('\n').trim();
    if (filtered.length > 20) return filtered;
  }
  return answerText;
}

export async function answerAdmissionQuestion(body, user) {
  if (typeof body?.question !== 'string' || !body.question.trim() || body.question.trim().length > 1000) {
    throw badRequest('Enter a question of up to 1000 characters.');
  }
  const question = body.question.trim();
  const context = extractConversationContext(question, body.context && typeof body.context === 'object' && !Array.isArray(body.context) ? body.context : {});
  const queryScope = understandQuery(question);
  const language = selectLanguage(question, body.language);
  const normalized = normalizeIntentText(question);
  if (isEmploymentQuery(question) || isEmploymentQuery(normalized)) {
    const unverifiedAnswer = {
      source: 'No verified record',
      answer: 'I could not find an official answer for that question. Please ask about a specific programme, fee, scholarship, admission step, or campus facility.',
      next: '',
      actionView: 'inquiry',
      actionLabel: 'Request verified information',
      evidence: [],
      officialLinks: [],
      model: 'deterministic-rag-fallback',
      outcomeStatus: 'INSUFFICIENT_EVIDENCE',
      escalation: {
        available: true,
        reason: 'UNVERIFIED_INFORMATION',
        department: 'administrative_office',
        message: 'Staff recruitment, faculty vacancies, and employment inquiries are handled directly by the Administrative Office and Principal Desk. MITRA does not maintain live staff vacancy notices.',
        helplines: [
          { label: 'Administrative Office', number: '02184-222222', tel: '02184222222' },
          { label: 'Principal Office Desk', number: '02184-222223', tel: '02184222223' },
        ],
        email: 'office@mitcorer.edu.in',
        officeHours: 'Monday to Saturday, 9:30 AM to 5:30 PM IST',
        actionLabel: 'Escalate to Administrative Office',
      },
      suggestions: buildNoAnswerSuggestions(normalized),
    };
    audit('assistant.asked', 'assistant', generateId('ASK'), user, unverifiedAnswer.source);
    return localizeResponse(unverifiedAnswer, language, normalized, [], academicFeeSelection, parseLegacyFactText);
  }
  const records = getDb().knowledge;
  const guard = (result, id, anchor = true) => {
    if (!result) return null;
    const targetId = result.recordId || id;
    if (!targetId) return result;
    const required = Array.isArray(targetId) ? targetId : [targetId];
    const unavailable = required.find(key => { const record = records.find(item => item.id === key); return !record || !usableKnowledge(record); });
    return !unavailable ? anchor ? { ...result, anchored: true, evidence: required.map(key => ({ ...records.find(item => item.id === key), score: 200 })) } : result : { managedRecordId: unavailable, source: 'No verified record', evidence: [],
      answer: 'I could not find a published official record for that information. Please check with the college for verified details.', next: '' };
  };
  const fallbackRule = assistantRules.find(item => item.match.some(word => matchesIntent(normalized, word)));
  const ruleRecords = { 'Institute-level admission notices': 'KB-14', 'Historical cutoff records': /2025/.test(normalized) ? 'KB-8' : 'KB-7',
    'Engineering eligibility and branch allotment guidance': 'KB-5', 'Document workflow': 'KB-1', 'Admission CAP workflow': 'KB-29',
    'Fee planner': 'KB-2', 'Scholarship readiness': 'KB-18', 'Program finder': /polytechnic/.test(normalized) ? 'KB-12' : /direct second|dse|lateral/.test(normalized) ? 'KB-11' : 'KB-10',
    'Career outcome guidance': 'KB-4', 'Hostel and mess planning': 'KB-23' };
  const vectorScores = (language === 'en' && config.geminiApiKey && config.geminiApiKey !== 'test-unused-key' && process.env.NODE_ENV !== 'test')
    ? await getSemanticVectorScores(question, records)
    : new Map();
  const retrievedEvidence = retrieveKnowledge(question, vectorScores);
  // Do not attach a loosely matched MITCORER record to an unrelated question.
  let evidence = retrievedEvidence[0]?.score >= 15 ? retrievedEvidence : [];

  // FIX #2 — Advisory routing: for open-ended / synthesis questions (e.g. "why should I choose
  // MITCORER?", "explain the learning environment", "what makes MITCORER unique?"), skip the flat
  // deterministic KB record and let Gemini synthesise a warm conversational answer from the top
  // retrieved evidence. The deterministic chain runs as normal fallback if Gemini fails or the
  // evidence score is too low.
  const criticalFactQuery = queryScope.topics.some(topic => ['academicFees', 'accommodationFees', 'programmes', 'seatMatrix'].includes(topic));
  if (language === 'en' && !criticalFactQuery && isAdvisoryQuestion(normalized) && retrievedEvidence.length > 0 && retrievedEvidence[0].score >= 5) {
    const advisoryEvidence = retrievedEvidence.slice(0, 3).map(sourceRecord);
    const advisoryDraft = await generateWithGemini(question, null, advisoryEvidence);
    const rawAdvisory = advisoryDraft?.text;
    if (rawAdvisory) {
      const advisoryVerification = verifySlotGrounding(rawAdvisory, context, advisoryEvidence);
      if (advisoryVerification.verified) {
        const advisoryOfficialLinks = [
          ...getOfficialAdmissionLinks(question),
          ...getOfficialExperienceLinks(question),
          ...getOfficialFeeLinks(question),
        ];
        audit('assistant.asked', 'assistant', generateId('ASK'), user, advisoryEvidence[0]?.source || 'Gemini advisory');
        return localizeResponse({
          source: advisoryEvidence[0]?.source || 'MITCORER verified knowledge',
          answer: rawAdvisory.replace(/CampusGuard/gi, 'the assistant'),
          evidence: advisoryEvidence.map((r) => publicEvidence(r, Date.now())),
          officialLinks: uniqueSourceLinks(advisoryOfficialLinks),
          model: advisoryDraft.model,
          outcomeStatus: 'ANSWERED',
          next: '',
        }, language, normalized, [], academicFeeSelection, parseLegacyFactText);
      }
    }
    // Gemini failed verification or returned null — fall through to deterministic chain below.
  }

  const answer = (user && (buildAdmissionReadinessAnswer(question, user) || buildDocumentStatusAnswer(question, user))) || buildCompoundAnswer(question, normalized, records) || buildClarificationAnswer(normalized) || buildReviewedPassage(normalized, language, records) || buildContextualPassage(normalized, records) || guard(buildFacilityAnswer(question)) || guard(buildCollegeProfileAnswer(question)) || guard(buildCampusFacilitiesAnswer(question), 'KB-36') || guard(buildPlacementAnswer(question), 'KB-16') || guard(buildDeadlineAnswer(question), 'KB-30') || guard(buildAttendanceAnswer(question), ['KB-31', 'KB-32']) || buildCutoffAnswer(question, records) || buildMaintainedAnswer(question, normalized, records) || guard(buildEligibilityAnswer(question), 'KB-5') || guard(buildScholarshipAnswer(question), /pragati/.test(normalized) ? 'KB-33' : 'KB-18') || (fallbackRule ? guard(fallbackRule, ruleRecords[fallbackRule.source] || 'KB-15', false) : null) || {
    source: 'No verified record',
    answer: 'I could not find an official answer for that question. Please ask about a specific programme, fee, scholarship, admission step, or campus facility.',
    next: '',
    actionView: 'inquiry',
    actionLabel: 'Request verified information',
  };
  if (answer.managedRecordId || answer.composed || answer.clarification || answer.anchored) evidence = answer.evidence;
  else if (evidence.length) evidence = evidence.slice(0, 1);
  evidence = evidence.map(sourceRecord);
  const officialLinks = answer.composed ? answer.officialLinks : answer.clarification ? [] : [...getOfficialAdmissionLinks(question), ...getOfficialScholarshipLinks(question), ...getOfficialUniversityLinks(question), ...getOfficialExperienceLinks(question), ...getContactMapLink(question), ...getOfficialFeeLinks(question)];
  // The LLM is deliberately not allowed to replace verified admissions answers.
  // It is evaluated against evidence tokens and verified before acceptance.
  let generated = null;
  let generatedModel = config.geminiModel;
  if (language === 'en' && !answer.managedRecordId && !answer.composed && !answer.clarification && answer.source === 'No verified record' && evidence.length) {
    const generationDraft = await generateWithGemini(question, answer, evidence.slice(0, 2));
    const rawGenerated = generationDraft?.text;
    if (rawGenerated) {
      const verification = verifySlotGrounding(rawGenerated, context, evidence.slice(0, 2));
      if (verification.verified) {
        generated = rawGenerated;
        generatedModel = generationDraft.model;
      }
    }
  }
  const workflowOnlySources = new Set([
    'Historical cutoff records',
    'Engineering eligibility and branch allotment guidance',
    'Document workflow',
    'Admission CAP workflow',
    'Fee planner',
    'Scholarship readiness',
    'Program finder',
    'Career outcome guidance',
    'Hostel and mess planning',
    'Institute-level admission notices',
  ]);
  const deterministicText = answer.composed || answer.clarification || answer.source === evidence[0]?.source || answer.source === 'My document records'
    ? answer.answer
    : answer.source === 'No verified record'
      ? (evidence[0]?.text || answer.answer)
    : workflowOnlySources.has(answer.source) || answer.source === 'Admission support rules'
      ? `${evidence[0]?.text || answer.answer}${user && answer.next ? `\n\nNext: ${answer.next}` : ''}`
      : answer.answer;
  const freshnessAt = Date.now();
  if (evidence.some(record => availability(record, freshnessAt) !== 'available')) {
    audit('assistant.asked', 'assistant', generateId('ASK'), user, 'Source validity changed during answering');
    return localizeResponse({ source: 'No verified record', answer: 'Source validity changed while answering. Please check with the college for current verified information.', evidence: [], officialLinks: [], model: 'deterministic-rag-fallback', outcomeStatus: 'OUTDATED_EVIDENCE' }, language, normalized, [], academicFeeSelection, parseLegacyFactText);
  }
  const outcomeStatus = classifyAnswerOutcome(answer, evidence, freshnessAt);
  const effectiveOutcome = answer.source === 'No verified record' && evidence.length ? 'ANSWERED' : outcomeStatus;
  const groundedAnswer = evidence.length
    ? {
        ...answer,
        source: answer.composed ? answer.source : evidence[0].source,
        answer: (generated || deterministicText).replace(/CampusGuard/gi, 'the assistant'),
        sourceUrl: answer.composed ? '' : resolveSourceUrl(answer.sourceUrl || evidence[0].sourceUrl),
        evidence: evidence.map(record => publicEvidence(record, freshnessAt)),
        officialLinks,
        model: generated ? generatedModel : 'deterministic-rag-fallback',
        outcomeStatus: effectiveOutcome,
      }
    : { ...answer, answer: answer.answer.replace(/CampusGuard/gi, 'the assistant'), evidence: [], officialLinks, model: 'deterministic-rag-fallback', outcomeStatus };
  audit('assistant.asked', 'assistant', generateId('ASK'), user, answer.source);
  groundedAnswer.sourceUrl = resolveSourceUrl(groundedAnswer.sourceUrl);
  groundedAnswer.officialLinks = uniqueSourceLinks([
    ...officialLinks,
    ...evidence.filter(record => record.sourceUrl).map(record => ({ label: record.title, url: record.sourceUrl })),
  ]);
  const isUnverified = groundedAnswer.source === 'No verified record'
    || (!evidence.length && ['UNSUPPORTED_TOPIC', 'OUTDATED_EVIDENCE', 'INSUFFICIENT_EVIDENCE', 'CONFLICTING_EVIDENCE'].includes(effectiveOutcome))
    || (!evidence.length && !groundedAnswer.anchored && groundedAnswer.source !== 'Verified admission checklist' && groundedAnswer.source !== 'My document records')
    || groundedAnswer.answer.includes('could not find an official answer')
    || groundedAnswer.answer.includes('could not find a published official record');
  if (isUnverified) {
    const isEmployment = isEmploymentQuery(question) || isEmploymentQuery(normalized);
    if (isEmployment) {
      groundedAnswer.escalation = {
        available: true,
        reason: 'UNVERIFIED_INFORMATION',
        department: 'administrative_office',
        message: 'Staff recruitment, faculty vacancies, and employment inquiries are handled directly by the Administrative Office and Principal Desk. MITRA does not maintain live staff vacancy notices.',
        helplines: [
          { label: 'Administrative Office', number: '02184-222222', tel: '02184222222' },
          { label: 'Principal Office Desk', number: '02184-222223', tel: '02184222223' },
        ],
        email: 'office@mitcorer.edu.in',
        officeHours: 'Monday to Saturday, 9:30 AM to 5:30 PM IST',
        actionLabel: 'Escalate to Administrative Office',
      };
    } else {
      groundedAnswer.escalation = {
        available: true,
        reason: 'UNVERIFIED_INFORMATION',
        message: 'This question does not have a verified published record. You can escalate directly to our human admissions counselors.',
        helplines: [
          { label: 'Admissions Office Desk 1', number: '+91 84599 67882', tel: '+918459967882' },
          { label: 'Admissions Office Desk 2', number: '+91 86696 62106', tel: '+918669662106' },
        ],
        email: 'info.mitcorer@mitpune.edu.in',
        officeHours: 'Monday to Saturday, 9:30 AM to 5:30 PM IST',
        actionLabel: 'Escalate to Admissions Staff',
      };
    }
  }
  groundedAnswer.suggestions = generateQuerySuggestions(question, normalized);
  if ((!groundedAnswer.suggestions || groundedAnswer.suggestions.length === 0) && isUnverified) {
    // FIX #4 — Topic-aware suggestions: analyse what the student was asking about
    // and surface 3 questions they CAN get a real answer for, instead of always
    // showing the same generic "contact us" buttons.
    groundedAnswer.suggestions = buildNoAnswerSuggestions(normalized);
  }
  groundedAnswer.answer = validateBranchRelevance(groundedAnswer.answer, question, context);
  return localizeResponse(groundedAnswer, language, normalized, evidence, academicFeeSelection, parseLegacyFactText);
}

function createKnowledge(body, user) {
  requireRole({ user }, ['admin']);
  const db = getDb();
  const record = {
    ...validateKnowledgeFields({ ...body, source: body?.source ?? 'Admin verified source' }),
    id: generateId('KB'),
    revision: 1,
    updatedAt: nowIso(),
  };
  stampTranslations(record, body, user);
  validateSupersession(record, db.knowledge);
  if (body.verifySource) confirmSourceReview(record, user);
  db.knowledge.unshift(record);
  saveDb();
  audit('knowledge.created', 'knowledge', record.id, user, record.title);
  return record;
}

function updateKnowledge(id, body, user) {
  requireRole({ user }, ['admin']);
  const db = getDb();
  const index = db.knowledge.findIndex((item) => item.id === id);
  if (index < 0) throw notFound('Knowledge record not found.');
  const current = db.knowledge[index];
  if (!Number.isSafeInteger(body?.expectedRevision) || body.expectedRevision < 0) throw badRequest('Provide the record expectedRevision.');
  if (body.expectedRevision !== (current.revision ?? 0)) throw new HttpError(409, 'REVISION_CONFLICT', 'This record changed. Reload it before saving your edits.');
  const updated = { ...validateKnowledgeFields(body, current), revision: (current.revision ?? 0) + 1, updatedAt: nowIso() };
  stampTranslations(updated, body, user);
  validateSupersession(updated, db.knowledge);
  if (body.verifySource) confirmSourceReview(updated, user);
  db.knowledge[index] = updated;
  saveDb();
  audit('knowledge.updated', 'knowledge', id, user, `${updated.title}: revision ${updated.revision}, ${updated.status}`);
  return updated;
}

function stampTranslations(record, body, user) {
  for (const language of Object.keys(body?.translations || {})) {
    if (record.translations?.[language]) Object.assign(record.translations[language], { reviewedBy: user.email, reviewedAt: nowIso() });
  }
}

function normalizeExtractedText(text) {
  return String(text || '').replace(/\u0000/g, '').replace(/\s+/g, ' ').trim().slice(0, 100000);
}

function runOcr(filePath) {
  try {
    return normalizeExtractedText(execFileSync('tesseract', [filePath, 'stdout', '-l', 'eng'], {
      encoding: 'utf8',
      timeout: 30000,
      maxBuffer: 2 * 1024 * 1024,
      stdio: ['ignore', 'pipe', 'ignore'],
    }));
  } catch {
    return '';
  }
}

function extractScannedPdfText(filePath) {
  const tempDir = path.join(officialSourceDir, `.ocr-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`);
  try {
    fs.mkdirSync(tempDir, { recursive: true });
    execFileSync('pdftoppm', ['-f', '1', '-l', '20', '-jpeg', '-r', '150', filePath, path.join(tempDir, 'page')], {
      timeout: 60000,
      maxBuffer: 512 * 1024,
      stdio: 'ignore',
    });
    const pages = fs.readdirSync(tempDir)
      .filter((name) => /^page-\d+\.jpg$/i.test(name))
      .sort((left, right) => left.localeCompare(right, undefined, { numeric: true }));
    return normalizeExtractedText(pages.map((page) => runOcr(path.join(tempDir, page))).filter(Boolean).join('\n'));
  } catch {
    return '';
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

function extractOfficialText(file, filePath) {
  if (file.mimeType === 'text/plain' || file.mimeType === 'text/csv') {
    return { text: normalizeExtractedText(file.content.toString('utf8')), status: 'Text extracted - admin review required' };
  }
  if (file.mimeType === 'application/pdf') {
    try {
      const text = execFileSync('pdftotext', ['-layout', filePath, '-'], {
        encoding: 'utf8',
        timeout: 15000,
        maxBuffer: 2 * 1024 * 1024,
      });
      const normalized = normalizeExtractedText(text);
      if (normalized.length >= 80) return { text: normalized, status: 'PDF text extracted - admin review required' };
    } catch {
      // Docker installs Poppler. Local development can still use manually supplied verified text.
    }
    const ocrText = extractScannedPdfText(filePath);
    if (ocrText) return { text: ocrText, status: 'PDF OCR extracted - admin review required' };
  }
  if (file.mimeType === 'image/jpeg' || file.mimeType === 'image/png') {
    const ocrText = runOcr(filePath);
    if (ocrText) return { text: ocrText, status: 'Image OCR extracted - admin review required' };
  }
  return { text: '', status: 'Manual verified text required for this file type' };
}

function chunkKnowledgeText(text, chunkSize = 2800) {
  return splitPassage(normalizeExtractedText(text), chunkSize);
}

function publishOfficialSource(id, body, user) {
  requireRole({ user }, ['admin']);
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw badRequest('Provide a source publishing object.');
  const db = getDb();
  const source = (db.officialSources || []).find((item) => item.id === id);
  if (!source) throw notFound('Official source not found.');
  if (Object.keys(body).some(key => !['verifiedText', 'verifiedPages', 'provenance', 'sourceUrl', 'expectedRevision'].includes(key))) throw badRequest('Invalid source publishing fields.');
  if (body.expectedRevision !== undefined && (!Number.isSafeInteger(body.expectedRevision) || body.expectedRevision < 0)) throw badRequest('Source revision must be a non-negative whole number.');
  if (body.expectedRevision !== undefined && body.expectedRevision !== (source.revision ?? 0)) throw new HttpError(409, 'REVISION_CONFLICT', 'This source changed. Reload it before publishing.');
  if (body.verifiedPages && body.verifiedText) throw badRequest('Supply reviewed text or reviewed pages, not both.');
  const metadata = validateProvenance(body.provenance || source.provenance || {});
  if (metadata.documentId && metadata.documentId !== source.id) throw badRequest('Document ID must identify this source.');
  metadata.documentId = source.id;
  if (!metadata.academicYear && /^\d{4}-\d{2}$/.test(source.academicYear || '')) metadata.academicYear = validateProvenance({ academicYear: source.academicYear }).academicYear;
  let pages;
  if (body.verifiedPages !== undefined) {
    if (!Array.isArray(body.verifiedPages) || !body.verifiedPages.length || body.verifiedPages.length > 500) throw badRequest('Provide 1 to 500 reviewed pages.');
    const seen = new Set();
    pages = body.verifiedPages.map(item => {
      if (!item || Object.keys(item).some(key => !['page', 'text'].includes(key))) throw badRequest('Invalid reviewed page fields.');
      validateProvenance({ pageStart: item.page });
      if (!item.page || seen.has(item.page)) throw badRequest('Reviewed page numbers must be unique.');
      seen.add(item.page);
      return { page: item.page, text: requireString(item.text, 'page text', 100000) };
    }).sort((a, b) => a.page - b.page);
  } else pages = [{ page: null, text: requireString(body.verifiedText || source.extractedText, 'verifiedText', 100000) }];
  const verifiedText = pages.map(page => page.text).join('\n\n');
  if (verifiedText.length > 100000) throw badRequest('Reviewed source text must not exceed 100000 characters in total.');
  const chunks = pages.flatMap(page => chunkKnowledgeText(page.text).map((text, index) => ({ text, page: page.page, index: index + 1 })));
  if (chunks.length === 0) throw badRequest('Verified text could not be converted into retrieval records.');
  const now = nowIso();
  const sourceLabel = `${source.sourceAuthority} - ${source.originalFileName}`;
  const existing = new Map(db.knowledge.filter(item => item.sourceDocumentId === source.id).map(item => [item.id, item]));
  const published = chunks.map(({ text, page, index }, ordinal) => {
    const id = `KB-${source.id}-${page ? `P${page}` : 'TEXT'}-${index}`;
    const record = validateKnowledgeFields({
      title: chunks.length === 1 ? source.title : `${source.title} (part ${ordinal + 1} of ${chunks.length})`,
      category: source.documentType, source: sourceLabel, text, status: 'Published',
      sourceUrl: body.sourceUrl ?? source.sourceUrl ?? '',
      provenance: { ...metadata, ...(page ? { pageStart: page, pageEnd: page } : {}) },
    });
    Object.assign(record, { id, revision: (existing.get(id)?.revision ?? 0) + 1,
      sourceDocumentId: source.id,
      updatedAt: now,
    });
    validateSupersession(record, db.knowledge);
    confirmSourceReview(record, user);
    return record;
  });
  const replacementIds = new Set(published.map(item => item.id));
  db.knowledge = [...published, ...db.knowledge.filter(item => !replacementIds.has(item.id)).map(item => item.sourceDocumentId === source.id ? { ...item, status: 'Archived' } : item)];
  source.provenance = metadata;
  if (metadata.academicYear) source.academicYear = metadata.academicYear;
  source.sourceUrl = published[0].sourceUrl;
  source.revision = (source.revision ?? 0) + 1;
  source.verifiedAt = now;
  source.verifiedBy = user.email;
  source.extractedText = verifiedText;
  source.status = 'Published';
  source.extractionStatus = `Admin verified and published (${chunks.length} retrieval ${chunks.length === 1 ? 'record' : 'records'})`;
  source.linkedKnowledgeCount = chunks.length;
  source.updatedAt = now;
  saveDb();
  audit('official_source.published', 'official_source', source.id, user, `${source.title}: ${chunks.length} retrieval records`);
  return source;
}

function createOfficialSourceFromUpload(fields, file, user) {
  requireRole({ user }, ['admin']);
  assertAllowedUpload(file, allowedOfficialMimeTypes, 'Official sources must be valid PDF, DOCX, XLSX, CSV, TXT, JPG, or PNG files.');

  const db = getDb();
  const now = nowIso();
  const id = generateId('SRC');
  const storedFileName = `${id}-${file.filename}`;
  fs.mkdirSync(officialSourceDir, { recursive: true });
  const filePath = path.join(officialSourceDir, storedFileName);
  fs.writeFileSync(filePath, file.content);

  const verifiedText = String(fields.verifiedText || '').trim();
  const extraction = extractOfficialText(file, filePath);
  const record = {
    id,
    title: requireString(fields.title, 'title', 180),
    documentType: requireString(fields.documentType, 'documentType', 80),
    academicYear: requireString(fields.academicYear || 'Not specified', 'academicYear', 30),
    sourceAuthority: requireString(fields.sourceAuthority || 'College admin upload', 'sourceAuthority', 180),
    originalFileName: file.filename,
    storedFileName,
    mimeType: file.mimeType,
    sizeBytes: file.content.length,
    status: 'Review',
    extractionStatus: verifiedText ? 'Verified text supplied - ready to publish' : extraction.status,
    extractedText: verifiedText || extraction.text,
    linkedKnowledgeCount: 0,
    uploadedBy: user.email,
    createdAt: now,
    updatedAt: now,
  };

  db.officialSources = db.officialSources || [];
  db.officialSources.unshift(record);
  saveDb();
  audit('official_source.uploaded', 'official_source', id, user, record.title);
  return verifiedText ? publishOfficialSource(id, { verifiedText }, user) : record;
}

function getOfficialSourceExtractedText(id, user) {
  requireRole({ user }, ['admin']);
  const source = (getDb().officialSources || []).find((item) => item.id === id);
  if (!source) throw notFound('Official source not found.');
  audit('official_source.extraction_opened', 'official_source', source.id, user, source.title);
  return pick(source, ['id', 'title', 'extractedText', 'extractionStatus', 'status']);
}

export function parseStructuredFactsFallback(text, metadata = {}) {
  const content = String(text || '').trim();
  const yearMatch = content.match(/\b(20\d{2}[-/]\d{2,4})\b/);
  const academicYear = yearMatch ? yearMatch[1] : (metadata.academicYear || 'Not specified');

  let docType = metadata.documentType || 'Admissions';
  if (/cutoff|closing merit/i.test(content)) docType = 'Cutoff';
  else if (/fee|tuition|development fee/i.test(content)) docType = 'Fees';
  else if (/seat matrix|intake|choice code/i.test(content)) docType = 'Seat matrix';
  else if (/eligibility/i.test(content)) docType = 'Eligibility';

  const paragraphs = content.split(/\n\s*\n/).map((p) => p.trim()).filter((p) => p.length >= 20);
  const keyFacts = (paragraphs.length ? paragraphs.slice(0, 5) : [content.slice(0, 500)]).map((para, i) => ({
    category: docType,
    title: `${metadata.title || docType} Fact ${i + 1}`,
    text: para,
    tags: [docType.toLowerCase()],
  }));

  return {
    documentType: docType,
    academicYear,
    summary: content.slice(0, 200),
    keyFacts,
    method: 'deterministic-rule-cdm',
  };
}

export async function extractStructuredFactsWithCdm(text, metadata = {}) {
  const content = String(text || '').trim();
  if (config.geminiApiKey) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20000);
    try {
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(config.geminiModel)}:generateContent`, {
        method: 'POST',
        signal: controller.signal,
        headers: { 'x-goog-api-key': config.geminiApiKey, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            role: 'user',
            parts: [{
              text: `You are a Constrained Decoding Extraction Model for official college circulars and admissions documents.
Extract the structured facts from the following official document text. Adhere strictly to the requested schema.

Document Metadata:
Title: ${metadata.title || ''}
Type: ${metadata.documentType || ''}
Year: ${metadata.academicYear || ''}

Document Content:
${content.slice(0, 30000)}`,
            }],
          }],
          generationConfig: {
            responseMimeType: 'application/json',
            responseSchema: {
              type: 'OBJECT',
              properties: {
                documentType: { type: 'STRING', enum: ['Cutoff', 'Fees', 'Seat matrix', 'Eligibility', 'Programs', 'Admissions', 'Facilities', 'University rules'] },
                academicYear: { type: 'STRING' },
                summary: { type: 'STRING' },
                keyFacts: {
                  type: 'ARRAY',
                  items: {
                    type: 'OBJECT',
                    properties: {
                      category: { type: 'STRING' },
                      title: { type: 'STRING' },
                      text: { type: 'STRING' },
                      tags: { type: 'ARRAY', items: { type: 'STRING' } },
                    },
                    required: ['category', 'title', 'text', 'tags'],
                  },
                },
              },
              required: ['documentType', 'keyFacts'],
            },
          },
        }),
      });
      clearTimeout(timeout);
      if (response.ok) {
        const payload = await response.json();
        const jsonText = payload?.candidates?.[0]?.content?.parts?.[0]?.text;
        if (jsonText) {
          const parsed = JSON.parse(jsonText);
          return { ...parsed, method: 'cdm-gemini-schema' };
        }
      }
    } catch {
      clearTimeout(timeout);
    }
  }

  return parseStructuredFactsFallback(content, metadata);
}

async function extractStructuredOfficialSource(id, body, user) {
  requireRole({ user }, ['admin']);
  const source = (getDb().officialSources || []).find((item) => item.id === id);
  if (!source) throw notFound('Official source not found.');
  const text = source.extractedText || '';
  if (!text.trim()) throw badRequest('Source has no extracted text to structure.');

  const structured = await extractStructuredFactsWithCdm(text, {
    title: source.title,
    documentType: source.documentType,
    academicYear: source.academicYear,
  });

  audit('official_source.structured_extracted', 'official_source', source.id, user, source.title);
  return { id: source.id, title: source.title, ...structured };
}

function getOfficialSourceFile(id, user) {
  requireRole({ user }, ['staff', 'admin']);
  const record = (getDb().officialSources || []).find((item) => item.id === id);
  if (!record) throw notFound('Official source not found.');
  if (!record.storedFileName) throw notFound('The original file is not stored locally for this source.');
  const filePath = path.resolve(officialSourceDir, record.storedFileName);
  if (!filePath.startsWith(officialSourceDir) || !fs.existsSync(filePath)) throw notFound('Official source file is unavailable.');
  audit('official_source.file_opened', 'official_source', record.id, user, record.title);
  return { __file: true, filePath, mimeType: record.mimeType || 'application/octet-stream', fileName: record.originalFileName };
}

function createAssistantAttachment(fields, file, user) {
  assertAllowedUpload(file, allowedMimeTypes, 'Only valid PDF, JPG, and PNG files are allowed.');
  const id = generateId('ATT');
  const storedFileName = `${id}-${file.filename}`;
  fs.mkdirSync(uploadDir, { recursive: true });
  fs.writeFileSync(path.join(uploadDir, storedFileName), file.content);
  const record = {
    id,
    ownerEmail: user.email,
    ownerName: user.name,
    fileName: file.filename,
    storedFileName,
    mimeType: file.mimeType,
    sizeBytes: file.content.length,
    note: String(fields.note || '').trim().slice(0, 1000),
    createdAt: nowIso(),
  };
  const db = getDb();
  db.assistantAttachments = db.assistantAttachments || [];
  db.assistantAttachments.unshift(record);
  saveDb();
  audit('assistant_attachment.uploaded', 'assistant_attachment', id, user, file.filename);
  return record;
}

function getAssistantAttachments(user) {
  const items = getDb().assistantAttachments || [];
  return ['staff', 'admin'].includes(user.role) ? items : items.filter((item) => item.ownerEmail === user.email);
}

function getAssistantAttachmentFile(id, user) {
  const record = (getDb().assistantAttachments || []).find((item) => item.id === id);
  if (!record) throw notFound('Assistant attachment not found.');
  if (!canAccessApplicantRecord(user, record.ownerEmail)) throw forbidden();
  const filePath = path.resolve(uploadDir, record.storedFileName);
  if (!filePath.startsWith(uploadDir) || !fs.existsSync(filePath)) throw notFound('Attachment file is unavailable.');
  audit('assistant_attachment.file_opened', 'assistant_attachment', record.id, user, record.fileName);
  return { __file: true, filePath, mimeType: record.mimeType, fileName: record.fileName };
}

async function handleApi(req) {
  const url = new URL(req.url, 'http://localhost');
  const user = getUserFromRequest(req);
  const context = { user };
  if (req.method === 'POST' && url.pathname === '/api/documents/upload') {
    const { fields, files } = parseMultipart(req, await readRawBody(req));
    return createDocumentFromUpload(fields, files.file, user);
  }
  if (req.method === 'POST' && url.pathname === '/api/official-sources/upload') {
    const { fields, files } = parseMultipart(req, await readRawBody(req));
    return createOfficialSourceFromUpload(fields, files.file, user);
  }
  if (req.method === 'POST' && url.pathname === '/api/assistant/attachments/upload') {
    const { fields, files } = parseMultipart(req, await readRawBody(req));
    return createAssistantAttachment(fields, files.file, user);
  }
  const body = await readJson(req);

  if (req.method === 'GET' && url.pathname === '/api/health') {
    return { status: 'ok', service: 'mitra-backend', time: nowIso() };
  }
  if (req.method === 'GET' && url.pathname === '/api/ready') {
    try { if (!checkStorageReady()) throw new Error('Storage not ready'); }
    catch { throw new HttpError(503, 'NOT_READY', 'Storage is unavailable.'); }
    return { status: 'ready', service: 'mitra-backend' };
  }
  if (req.method === 'GET' && url.pathname === '/api/public-facts') {
    return extractPublicFacts(getDb().knowledge || []);
  }
  if (req.method === 'POST' && url.pathname === '/api/auth/login') {
    enforceRateLimit(loginIpAttempts, getClientIp(req), 30, 60_000);
    return handleAuthLogin(body);
  }
  if (req.method === 'POST' && url.pathname === '/api/auth/signup') {
    enforceRateLimit(signupIpAttempts, getClientIp(req), 5, 60_000);
    return handleAuthSignup(body);
  }
  if (req.method === 'POST' && url.pathname === '/api/auth/refresh') return refreshSession(body, req);
  if (req.method === 'POST' && url.pathname === '/api/auth/logout') return logoutSession(body, req);
  if (req.method === 'GET' && url.pathname === '/api/me') return { user: sanitizeUser(requireAuth(context)) };
  if (req.method === 'POST' && url.pathname === '/api/assistant/ask') {
    enforceRateLimit(assistantAttempts, user.id, config.assistantRateLimitMax, 60_000);
    return answerAdmissionQuestion(body, user);
  }
  if (req.method === 'POST' && url.pathname === '/api/public-assistant/ask') {
    const clientKey = getClientIp(req);
    enforceRateLimit(publicAssistantAttempts, clientKey, config.publicAssistantRateLimitMax, 60_000);
    const session = readPublicSession(req, body) || createPublicSession();
    const result = await askPublicWithHistory(body, answerAdmissionQuestion, session);
    return { ...result, sessionToken: session, __publicSessionCookie: publicSessionCookie(session) };
  }
  if (req.method === 'DELETE' && url.pathname === '/api/public-assistant/conversation') {
    const session = readPublicSession(req, body);
    if (!session) throw notFound('Conversation not found or expired.');
    if (typeof body.conversationId !== 'string') throw badRequest('A conversation ID is required.');
    return resetPublicConversation(body.conversationId, session);
  }
  if (req.method === 'POST' && (url.pathname === '/api/public/inquiries' || url.pathname === '/api/public/escalate')) {
    const clientKey = getClientIp(req);
    enforceRateLimit(publicAssistantAttempts, clientKey, config.publicAssistantRateLimitMax, 60_000);
    return createPublicEscalatedInquiry(body);
  }
  if (req.method === 'POST' && url.pathname === '/api/public/feedback') {
    const clientKey = getClientIp(req);
    enforceRateLimit(publicAssistantAttempts, clientKey, config.publicAssistantRateLimitMax, 60_000);
    return recordFeedback(body);
  }
  if (req.method === 'GET' && url.pathname === '/api/feedback') {
    requireRole({ user }, ['staff', 'admin']);
    return { items: getDb().feedback || [] };
  }
  if (req.method === 'GET' && url.pathname === '/api/conversations') return listConversations(user, url.searchParams.get('offset'));
  const conversationMatch = url.pathname.match(/^\/api\/conversations\/([^/]+)$/);
  if (req.method === 'GET' && conversationMatch) {
    return pick(getConversation(conversationMatch[1], user), ['id', 'title', 'createdAt', 'updatedAt', 'messages']);
  }
  if (req.method === 'POST' && url.pathname === '/api/conversations/ask') {
    enforceRateLimit(assistantAttempts, user.id, config.assistantRateLimitMax, 60_000);
    return askWithHistory(body, user, answerAdmissionQuestion);
  }
  if (req.method === 'GET' && url.pathname === '/api/assistant/attachments') return { items: getAssistantAttachments(user) };
  const assistantAttachmentFileMatch = url.pathname.match(/^\/api\/assistant\/attachments\/([^/]+)\/file$/);
  if (req.method === 'GET' && assistantAttachmentFileMatch) return getAssistantAttachmentFile(assistantAttachmentFileMatch[1], user);
  if (req.method === 'GET' && url.pathname === '/api/knowledge') {
    requireRole({ user }, ['staff', 'admin']);
    return { items: getDb().knowledge || [] };
  }
  if (req.method === 'POST' && url.pathname === '/api/knowledge') return createKnowledge(body, user);
  const knowledgeMatch = url.pathname.match(/^\/api\/knowledge\/([^/]+)$/);
  if (req.method === 'PATCH' && knowledgeMatch) return updateKnowledge(knowledgeMatch[1], body, user);
  if (req.method === 'GET' && url.pathname === '/api/official-sources') {
    requireRole({ user }, ['staff', 'admin']);
    return { items: getDb().officialSources || [] };
  }
  if (req.method === 'POST' && url.pathname === '/api/official-sources/sync') {
    requireRole({ user }, ['admin']);
    return syncMonitoredWebsiteSources({ db: getDb(), user, saveFn: saveDb, auditFn: audit });
  }
  const officialSourceExtractionMatch = url.pathname.match(/^\/api\/official-sources\/([^/]+)\/extracted-text$/);
  if (req.method === 'GET' && officialSourceExtractionMatch) return getOfficialSourceExtractedText(officialSourceExtractionMatch[1], user);
  const officialSourceStructuredMatch = url.pathname.match(/^\/api\/official-sources\/([^/]+)\/extract-structured$/);
  if (req.method === 'POST' && officialSourceStructuredMatch) return extractStructuredOfficialSource(officialSourceStructuredMatch[1], body, user);
  const officialSourcePublishMatch = url.pathname.match(/^\/api\/official-sources\/([^/]+)\/publish$/);
  if (req.method === 'PATCH' && officialSourcePublishMatch) return publishOfficialSource(officialSourcePublishMatch[1], body, user);
  const officialSourceFileMatch = url.pathname.match(/^\/api\/official-sources\/([^/]+)\/file$/);
  if (req.method === 'GET' && officialSourceFileMatch) return getOfficialSourceFile(officialSourceFileMatch[1], user);

  if (req.method === 'GET' && url.pathname === '/api/inquiries') return { items: filterRecordsForUser(getDb().inquiries, user) };
  if (req.method === 'POST' && url.pathname === '/api/inquiries') return createInquiry(body, user);
  const inquiryStatusMatch = url.pathname.match(/^\/api\/inquiries\/([^/]+)\/status$/);
  if (req.method === 'PATCH' && inquiryStatusMatch) return updateInquiryStatus(inquiryStatusMatch[1], body, user);

  if (req.method === 'GET' && url.pathname === '/api/admission-workspace') return getAdmissionWorkspace(user);
  if (req.method === 'PATCH' && url.pathname === '/api/admission-workspace') return updateAdmissionWorkspace(body, user);

  if (req.method === 'GET' && url.pathname === '/api/documents') {
    const records = filterRecordsForUser(getDb().documents, user);
    return { items: ['staff', 'admin'].includes(user.role) ? records.filter((item) => item.status !== 'Uploaded (not submitted)') : records };
  }
  if (req.method === 'POST' && url.pathname === '/api/documents/submit') return submitDocumentsForReview(user);
  if (req.method === 'POST' && url.pathname === '/api/documents') return createDocument(body, user);
  const documentStatusMatch = url.pathname.match(/^\/api\/documents\/([^/]+)\/status$/);
  if (req.method === 'PATCH' && documentStatusMatch) return updateDocumentStatus(documentStatusMatch[1], body, user);
  const documentFileMatch = url.pathname.match(/^\/api\/documents\/([^/]+)\/file$/);
  if (req.method === 'GET' && documentFileMatch) return getDocumentFile(documentFileMatch[1], user);
  const documentMatch = url.pathname.match(/^\/api\/documents\/([^/]+)$/);
  if (req.method === 'DELETE' && documentMatch) return deleteDocument(documentMatch[1], user);

  if (req.method === 'GET' && url.pathname === '/api/content') {
    requireAuth(context);
    return { items: getDb().content };
  }
  if (req.method === 'POST' && url.pathname === '/api/content') return createContent(body, user);
  const contentMatch = url.pathname.match(/^\/api\/content\/([^/]+)$/);
  if (req.method === 'PATCH' && contentMatch) return updateContent(contentMatch[1], body, user);

  if (req.method === 'GET' && url.pathname === '/api/reports') return buildReports(user);
  if (req.method === 'GET' && url.pathname === '/api/audit-logs') {
    requireRole({ user }, ['staff', 'admin']);
    return { items: (getDb().auditLogs || []).slice(0, 100) };
  }

  throw notFound('API route not found.');
}

export function createServer() {
  loadDb();
  if (prunePublicConversations()) saveDb();
  if (config.geminiApiKey && config.geminiApiKey !== 'test-unused-key' && process.env.NODE_ENV !== 'test') {
    syncKnowledgeVectorIndex(getDb().knowledge, config.geminiApiKey).catch(() => {});
  }
  const server = http.createServer(async (req, res) => {
    const requestId = generateId('REQ');
    const requestStarted = performance.now();
    if (config.nodeEnv === 'production' || process.env.LOG_REQUESTS === 'true') {
      res.once('finish', () => console.log(JSON.stringify({ event: 'http_request', requestId,
        method: req.method, status: res.statusCode, durationMs: Math.round((performance.now() - requestStarted) * 100) / 100 })));
    }
    res.setHeader('X-Request-Id', requestId);
    if (req.url.startsWith('/api/conversations') || req.url.startsWith('/api/public-assistant')) res.setHeader('Cache-Control', 'private, no-store');
    attachCors(req, res);
    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }
    try {
      const payload = await handleApi(req);
      if (payload?.__file) {
        res.writeHead(200, {
          'Content-Type': payload.mimeType,
          'Content-Length': fs.statSync(payload.filePath).size,
          'Content-Disposition': `inline; filename="${sanitizeFileName(payload.fileName)}"`,
          'Cache-Control': 'private, no-store',
        });
        const stream = fs.createReadStream(payload.filePath);
        stream.on('error', () => { if (!res.headersSent) res.writeHead(500); res.destroy(); });
        stream.pipe(res);
        return;
      }
      const cookies = [];
      if (payload?.refreshToken) {
        cookies.push(refreshCookie(payload.refreshToken, 60 * 60 * 24 * 14));
      } else if (payload?.clearRefreshCookie) {
        cookies.push(refreshCookie('', 0));
      }
      if (payload?.__publicSessionCookie) cookies.push(payload.__publicSessionCookie);
      if (cookies.length) res.setHeader('Set-Cookie', cookies.length === 1 ? cookies[0] : cookies);
      const { refreshToken, clearRefreshCookie, __publicSessionCookie, ...responsePayload } = payload || {};
      jsonResponse(res, 200, { data: responsePayload });
    } catch (error) {
      const status = error instanceof HttpError ? error.status : 500;
      const code = error instanceof HttpError ? error.code : 'INTERNAL_ERROR';
      const message = error instanceof HttpError ? error.message : 'Unexpected server error.';
      jsonResponse(res, status, { error: { code, message } });
    }
  });
  const cleanup = setInterval(() => {
    try { if (prunePublicConversations()) saveDb(); }
    catch { console.error(JSON.stringify({ event: 'public_history_cleanup_failed' })); }
  }, 60_000);
  cleanup.unref();
  server.once('close', () => clearInterval(cleanup));
  return server;
}

const currentFile = fileURLToPath(import.meta.url);
const entryFile = process.argv[1] ? path.resolve(process.argv[1]) : '';

if (currentFile === entryFile) {
  createServer().listen(config.port, config.host, () => {
    console.log(`MITRA backend listening on http://${config.host}:${config.port}`);
  });
}
