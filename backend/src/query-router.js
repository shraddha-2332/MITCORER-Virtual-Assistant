/**
 * Dynamic Query Router for MITRA
 *
 * Inspects incoming admission queries and classifies them into:
 * 1. DETERMINISTIC_DIRECT: Has complete qualifiers (category, admission route, branch/service).
 *    Can be answered immediately from canonical SQLite records with 0 external API cost.
 * 2. CLARIFICATION_GATE: Essential attributes are missing (e.g., "what is the fee" without category/route).
 *    Generates interactive clarification guidance rather than guessing.
 * 3. ADVISORY_NEURAL: Broad, contextual, or subjective queries ("tell me about campus culture").
 *    Requires neural synthesis with grounded RAG context.
 */

import { understandQuery, queryClarification } from './query-understanding.js';

export const ROUTE_TIER = {
  DETERMINISTIC_DIRECT: 'DETERMINISTIC_DIRECT',
  CLARIFICATION_GATE: 'CLARIFICATION_GATE',
  ADVISORY_NEURAL: 'ADVISORY_NEURAL',
};

/**
 * Classifies an incoming user query to determine the fastest and most reliable execution tier.
 *
 * @param {string} query - Raw user question
 * @param {object} conversationContext - Active multi-turn context (e.g., prior category, route)
 * @returns {object} { tier: ROUTE_TIER, intent: string, slots: object, reason: string }
 */
export function routeQuery(query, conversationContext = {}) {
  const parsed = understandQuery(query);
  const clarification = queryClarification(query);

  // Merge conversational context if not explicitly overridden
  const effectiveRoute = parsed.admissionRoute || conversationContext.route || null;
  const effectiveCategory = (parsed.category?.positive?.length === 1 ? parsed.category.positive[0] : null) || conversationContext.category || null;

  // 1. Check for missing qualifiers that trigger a clarification gate
  if (clarification) {
    return {
      tier: ROUTE_TIER.CLARIFICATION_GATE,
      intent: clarification.kind,
      message: clarification.message,
      slots: { ...parsed, effectiveRoute, effectiveCategory },
      reason: `Missing critical qualifiers: ${clarification.kind}`,
    };
  }

  // 2. Direct Deterministic Match:
  // If query is specifically about academic fees and has both route and category specified
  const isFeeQuery = parsed.topics.includes('academicFees');
  if (isFeeQuery && (effectiveRoute || effectiveCategory)) {
    return {
      tier: ROUTE_TIER.DETERMINISTIC_DIRECT,
      intent: 'academicFees',
      slots: { ...parsed, effectiveRoute, effectiveCategory },
      reason: 'Complete fee query attributes matching canonical knowledge',
    };
  }

  // If query is accommodation / hostel / mess
  const isAccommodation = parsed.topics.includes('accommodationFees') || parsed.topics.includes('hostel');
  if (isAccommodation) {
    return {
      tier: ROUTE_TIER.DETERMINISTIC_DIRECT,
      intent: 'accommodationFees',
      slots: { ...parsed, effectiveRoute, effectiveCategory },
      reason: 'Direct accommodation / hostel lookup',
    };
  }

  // If query is branch intake / seat matrix
  const isIntakeOrProgram = parsed.topics.includes('programmes') || parsed.topics.includes('seatMatrix');
  if (isIntakeOrProgram && parsed.branch?.positive?.length) {
    return {
      tier: ROUTE_TIER.DETERMINISTIC_DIRECT,
      intent: 'programIntake',
      slots: { ...parsed, effectiveRoute, effectiveCategory },
      reason: 'Direct branch intake / seat matrix lookup',
    };
  }

  // 3. Open-ended or synthesis query -> Advisory Neural Path
  return {
    tier: ROUTE_TIER.ADVISORY_NEURAL,
    intent: parsed.topics[0] || 'generalAdvisory',
    slots: { ...parsed, effectiveRoute, effectiveCategory },
    reason: 'Open-ended or general exploratory query',
  };
}

