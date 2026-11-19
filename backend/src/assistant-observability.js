import crypto from 'node:crypto';
import { availability, sourceReview } from './provenance.js';
import { badRequest, notFound } from './errors.js';

const maxEvents = 500;
const retentionMs = 24 * 60 * 60 * 1000;
const events = [];
const outcomes = new Set(['ANSWERED', 'PARTIALLY_ANSWERED', 'NEEDS_CLARIFICATION', 'INSUFFICIENT_EVIDENCE', 'UNSUPPORTED_TOPIC', 'CONFLICTING_EVIDENCE', 'ERROR', 'UNKNOWN']);
const safeIds = ids => (ids || []).filter(id => typeof id === 'string' && /^(?:KB|SRC|DOC)-[A-Z0-9-]{1,100}$/i.test(id)).slice(0, 8);
function prune(now = Date.now()) {
  while (events.length && (events[0].at < now - retentionMs || events.length > maxEvents)) events.shift();
}
export function recordAssistantEvent(response, elapsedMs, now = Date.now()) {
  const outcome = outcomes.has(response?.outcomeStatus) ? response.outcomeStatus : 'UNKNOWN';
  // No question, answer, account/session, token, URL, IP, provider error or hash.
  const event = { id: crypto.randomUUID(), at: now, outcome,
    language: ['en', 'mr', 'hi', 'mixed'].includes(response?.responseLanguage) ? response.responseLanguage : 'unknown',
    localization: ['original', 'template', 'maintainer-reviewed', 'fallback', 'partial'].includes(response?.localizationStatus) ? response.localizationStatus : 'unknown',
    evidenceIds: safeIds((response?.evidence || []).map(item => item.id)),
    elapsedMs: Number.isFinite(elapsedMs) ? Math.min(300000, Math.max(0, Math.round(elapsedMs))) : null,
    status: 'Open',
  };
  events.push(event); prune(now);
}
export function clearAssistantEvents() { events.length = 0; }
export function reviewAssistantEvent(id, status) {
  prune();
  if (!['Open', 'Investigating', 'Resolved', 'Dismissed'].includes(status)) throw badRequest('Invalid triage status.');
  const event = events.find(item => item.id === id);
  if (!event) throw notFound('Diagnostic event is unavailable or expired.');
  if (event.outcome === 'ANSWERED' && !['fallback', 'partial'].includes(event.localization)) throw badRequest('This event has no diagnostic issue to triage.');
  event.status = status;
  return { ...event };
}
export function assistantOperations(db, includeTraces = false, now = Date.now()) {
  prune(now);
  const knowledge = db.knowledge || [];
  const availabilityCounts = {}, reviewCounts = {}, byOutcome = {}, byLanguage = {};
  const intervalMs = 6 * 60 * 60 * 1000;
  const trendPoints = Array.from({ length: 4 }, (_, index) => ({
    from: now - (4 - index) * intervalMs,
    to: now - (3 - index) * intervalMs,
    total: 0,
    answered: 0,
    triageCandidates: 0,
  }));
  for (const record of knowledge) {
    const state = availability(record, now), review = sourceReview(record).status;
    availabilityCounts[state] = (availabilityCounts[state] || 0) + 1;
    reviewCounts[review] = (reviewCounts[review] || 0) + 1;
  }
  const health = {};
  for (const source of db.officialSources || []) {
    const value = source.syncMeta?.healthStatus;
    const state = ['available', 'unreachable', 'changed'].includes(value) ? value : 'unknown';
    health[state] = (health[state] || 0) + 1;
  }
  for (const event of events) {
    byOutcome[event.outcome] = (byOutcome[event.outcome] || 0) + 1;
    byLanguage[event.language] = (byLanguage[event.language] || 0) + 1;
    const bucket = Math.min(3, Math.max(0, Math.floor((event.at - (now - retentionMs)) / intervalMs)));
    const point = trendPoints[bucket];
    point.total += 1;
    if (event.outcome === 'ANSWERED') point.answered += 1;
    if (event.outcome !== 'ANSWERED' || ['fallback', 'partial'].includes(event.localization)) point.triageCandidates += 1;
  }
  const issues = events.filter(e => e.outcome !== 'ANSWERED' || ['fallback', 'partial'].includes(e.localization));
  return { knowledge: { total: knowledge.length, availability: availabilityCounts, sourceReview: reviewCounts },
    sourceHealth: health, diagnostics: { total: events.length, byOutcome, byLanguage,
      trends: { intervalHours: 6, windowHours: 24, points: trendPoints },
      unresolved: issues.filter(e => !['Resolved', 'Dismissed'].includes(e.status)).length,
      retention: 'Process memory only; last 500 events, at most 24 hours; cleared on restart.',
      ...(includeTraces ? { events: issues.slice(-100).reverse().map(e => ({ ...e, evidenceIds: [...e.evidenceIds] })) } : {}) },
    limitations: ['Recorded review is a maintainer action, not independent certification.', 'Clarifications and refusals are diagnostic categories, not necessarily failures.', 'No raw questions or answers are collected by these diagnostics.'],
  };
}
