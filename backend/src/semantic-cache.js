/**
 * Semantic Response Cache for Mitra Virtual Assistant.
 *
 * Caches verified grounded responses indexed by normalized intent and language.
 * Bypasses redundant LLM generation, vector scoring, and multi-clause retrieval
 * for identical and near-duplicate student inquiries.
 *
 * Automatically evicts via LRU + TTL, and invalidates on knowledge mutation.
 */

export class SemanticResponseCache {
  constructor(maxSize = 500, ttlMs = 15 * 60 * 1000) {
    this.maxSize = maxSize;
    this.ttlMs = ttlMs;
    this.cache = new Map();
  }

  generateKey(normalizedIntent, language = 'en', context = {}) {
    const ctxString = context && typeof context === 'object' && Object.keys(context).length > 0
      ? JSON.stringify(context)
      : '';
    return `${language}:${normalizedIntent}:${ctxString}`;
  }

  get(normalizedIntent, language = 'en', context = {}) {
    if (!normalizedIntent) return null;
    const key = this.generateKey(normalizedIntent, language, context);
    const entry = this.cache.get(key);
    if (!entry) return null;

    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }

    // Refresh LRU order on hit
    this.cache.delete(key);
    this.cache.set(key, entry);

    // Return a deep copy with a cache indicator flag
    const copy = JSON.parse(JSON.stringify(entry.response));
    copy.__fromSemanticCache = true;
    return copy;
  }

  set(normalizedIntent, response, language = 'en', context = {}) {
    if (!normalizedIntent || !response) return;
    // Never cache unverified/insufficient evidence outcomes or clarification requests
    if (response.outcomeStatus === 'INSUFFICIENT_EVIDENCE' || response.clarification || response.source === 'No verified record') {
      return;
    }

    const key = this.generateKey(normalizedIntent, language, context);

    if (this.cache.has(key)) {
      this.cache.delete(key);
    } else if (this.cache.size >= this.maxSize) {
      // Evict oldest entry (LRU)
      const oldestKey = this.cache.keys().next().value;
      this.cache.delete(oldestKey);
    }

    this.cache.set(key, {
      response: JSON.parse(JSON.stringify(response)),
      cachedAt: Date.now(),
      expiresAt: Date.now() + this.ttlMs,
    });
  }

  clear() {
    this.cache.clear();
  }

  size() {
    return this.cache.size;
  }
}

export const semanticResponseCache = new SemanticResponseCache();

