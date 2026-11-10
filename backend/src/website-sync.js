import crypto from 'node:crypto';

export const officialWebsiteRoot = 'https://mitcorer.edu.in/mitcorer/public/index.php';
const websitePathRoot = '/mitcorer/public';
const maxDiscoveredPages = 250;
const crawlConcurrency = 8;

export const monitoredWebsiteSources = [{
  title: 'MITCORER New Official Website',
  url: officialWebsiteRoot,
  documentType: 'Website page',
  academicYear: 'Not specified',
  sourceAuthority: 'MITCORER official website',
}];

function canonicalPageUrl(value) {
  const url = new URL(value);
  url.hash = '';
  url.search = '';
  url.hostname = url.hostname.toLowerCase().replace(/^www\./, '');
  if (url.pathname !== '/') url.pathname = url.pathname.replace(/\/+$/, '');
  return url.toString();
}

function routeCategory(url) {
  const parts = new URL(url).pathname.split('/').filter(Boolean);
  const section = parts[parts.indexOf('public') + 1] || 'home';
  const labels = {
    about: 'About', admissions: 'Admissions', department: 'Department',
    infrastructure: 'Infrastructure', placement: 'Placements', placements: 'Placements',
    'campus-life': 'Campus Life', careers: 'Careers', 'contact-us': 'Contact', blog: 'News & Blog',
    'index.php': 'Home',
  };
  return labels[section] || 'MITCORER Website';
}

function pageTitle(html, url) {
  const raw = html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)?.[1]
    || html.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i)?.[1];
  const title = raw?.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  if (title && title !== 'MITVPU') return title.slice(0, 150);
  const last = new URL(url).pathname.split('/').filter(Boolean).at(-1) || 'Home';
  return last.replace(/\.php$/i, '').replace(/([a-z])([A-Z])/g, '$1 $2').replace(/[-_]+/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase()).slice(0, 150);
}

function extractInternalPageLinks(html, currentUrl) {
  const links = new Set();
  const origin = new URL(officialWebsiteRoot).origin;
  for (const match of String(html || '').matchAll(/\bhref\s*=\s*(["'])(.*?)\1/gi)) {
    const href = match[2].replace(/&amp;/gi, '&').trim();
    if (!href || /^(?:#|mailto:|tel:|javascript:|data:)/i.test(href)) continue;
    try {
      const url = new URL(href, currentUrl);
      if (url.origin !== origin || !(url.pathname === websitePathRoot || url.pathname.startsWith(`${websitePathRoot}/`))) continue;
      if (/\/(?:assets|uploads|storage)\//i.test(url.pathname)) continue;
      if (/\.(?:pdf|xlsx?|docx?|pptx?|jpe?g|png|gif|svg|zip|mp4|mp3)$/i.test(url.pathname)) continue;
      links.add(canonicalPageUrl(url.toString()));
    } catch {}
  }
  return [...links];
}

function sourceForPage(url, html) {
  const category = routeCategory(url);
  const academicYears = new Set([...String(html || '').matchAll(/\b(20\d{2})[-–](\d{2}|20\d{2})\b/g)].flatMap((match) => {
    const start = Number(match[1]);
    const end = Number(match[2].length === 2 ? `${match[1].slice(0, 2)}${match[2]}` : match[2]);
    return end === start + 1 ? [`${start}-${String(end).slice(-2)}`] : [];
  }));
  return {
    title: `MITCORER ${category}: ${pageTitle(html, url)}`.slice(0, 180),
    url,
    documentType: category,
    academicYear: academicYears.size === 1 ? [...academicYears][0] : 'Not specified',
    sourceAuthority: 'MITCORER official website',
  };
}

export async function discoverOfficialWebsitePages({
  root = officialWebsiteRoot,
  fetcher = defaultFetcher,
  maxPages = maxDiscoveredPages,
  concurrency = crawlConcurrency,
} = {}) {
  const startUrl = canonicalPageUrl(root);
  const queue = [startUrl];
  const queued = new Set(queue);
  const pages = new Map();
  const errors = [];
  let cursor = 0;
  let active = 0;

  async function worker() {
    while (true) {
      if (cursor >= queue.length) {
        if (active === 0) return;
        await new Promise((resolve) => setTimeout(resolve, 5));
        continue;
      }
      if (pages.size >= maxPages) return;
      const url = queue[cursor++];
      active += 1;
      try {
        const html = await fetcher(url);
        pages.set(url, html);
        for (const link of extractInternalPageLinks(html, url)) {
          if (queued.size >= maxPages) break;
          if (!queued.has(link)) {
            queued.add(link);
            queue.push(link);
          }
        }
      } catch (error) {
        errors.push({ url, error: error.message });
      } finally {
        active -= 1;
      }
    }
  }

  await Promise.all(Array.from({ length: Math.max(1, Math.min(concurrency, maxPages)) }, () => worker()));
  const sources = [...pages].map(([url, html]) => sourceForPage(url, html));
  return { sources, errors, discovered: queued.size, fetched: pages.size, maxPages, pageContents: pages };
}

export function cleanHtml(html) {
  if (typeof html !== 'string') return '';
  const main = html.match(/<main\b[^>]*>[\s\S]*?<\/main>/i)?.[0];
  let text = (main || html)
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, ' ')
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, ' ')
    .replace(/<noscript\b[^<]*(?:(?!<\/noscript>)<[^<]*)*<\/noscript>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<(header|footer|nav)\b[^<]*(?:(?!<\/\1>)<[^<]*)*<\/\1>/gi, ' ');

  text = text
    .replace(/<\/(p|div|h[1-6]|li|tr|section|article)>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, ' ');

  text = text
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&#(\d+);/g, (_match, value) => String.fromCodePoint(Number(value)))
    .replace(/&#x([\da-f]+);/gi, (_match, value) => String.fromCodePoint(parseInt(value, 16)))
    .replace(/&mdash;/gi, '—')
    .replace(/&ndash;/gi, '–');

  return text
    .split('\n')
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .join('\n')
    .slice(0, 100000);
}

export function hashContent(text) {
  return crypto.createHash('sha256').update(String(text || '')).digest('hex');
}

export async function defaultFetcher(url, timeoutMs = 8000) {
  const initial = new URL(url);
  if (initial.protocol !== 'https:' || initial.username || initial.password || !isApprovedOfficialHost(initial.hostname)) {
    throw new Error('Website sync only fetches approved official HTTPS hosts.');
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    let target = initial;
    for (let redirects = 0; redirects <= 5; redirects += 1) {
      const res = await fetch(target, {
        signal: controller.signal,
        redirect: 'manual',
        headers: { 'User-Agent': 'MITRA-Admission-Sync-Bot/1.0 (+https://mitcorer.edu.in)' },
      });
      if (res.status >= 300 && res.status <= 399) {
        const location = res.headers.get('location');
        res.body?.cancel().catch(() => {});
        if (!location) throw new Error(`HTTP ${res.status} ${res.statusText}`);
        if (redirects === 5) throw new Error('Website sync exceeded the redirect limit.');
        const next = new URL(location, target);
        if (next.protocol !== 'https:' || next.username || next.password || !isApprovedOfficialHost(next.hostname)) {
          throw new Error('Website sync refused a redirect outside the approved official HTTPS host list.');
        }
        target = next;
        continue;
      }
      if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
      return await res.text();
    }
    throw new Error('Website sync exceeded the redirect limit.');
  } finally {
    clearTimeout(timer);
  }
}

const officialSourceHostRoots = [
  'mitcorer.edu.in', 'mitpune.edu.in', 'mahacet.org', 'mahacet.org.in',
  'dtemaharashtra.gov.in', 'sus.ac.in', 'scholarships.gov.in',
  'mahadbt.maharashtra.gov.in', 'msbte.org.in', 'aicte-india.org', 'aicte.gov.in',
];

function isApprovedOfficialHost(hostname) {
  const host = String(hostname || '').toLowerCase().replace(/^www\./, '');
  return officialSourceHostRoots.some((root) => host === root || host.endsWith(`.${root}`));
}

export async function defaultLinkChecker(value, timeoutMs = 8000) {
  const url = new URL(value);
  if (url.protocol !== 'https:' || url.username || url.password || !isApprovedOfficialHost(url.hostname)) {
    return { ok: false, skipped: true, error: 'URL is outside the approved official HTTPS host list.' };
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const requestSafely = async (method, startUrl) => {
      let target = new URL(startUrl);
      for (let redirects = 0; redirects <= 5; redirects += 1) {
        const response = await fetch(target, { method, signal: controller.signal, redirect: 'manual', headers: { 'User-Agent': 'MITRA-Source-Check/1.0', ...(method === 'GET' ? { Range: 'bytes=0-0' } : {}) } });
        if (response.status < 300 || response.status > 399) return { response, target };
        const location = response.headers.get('location');
        response.body?.cancel().catch(() => {});
        if (!location) return { response, target };
        if (redirects === 5) return { response, target, redirectError: 'Official source exceeded the redirect limit.' };
        const next = new URL(location, target);
        if (next.protocol !== 'https:' || next.username || next.password || !isApprovedOfficialHost(next.hostname)) {
          return { response, target, redirectError: 'The source redirected outside the approved official HTTPS host list.' };
        }
        target = next;
      }
      throw new Error('Official source exceeded the redirect limit.');
    };
    let checked = await requestSafely('HEAD', url);
    let response = checked.response;
    if (response.status === 403 || response.status === 405 || response.status === 501) {
      response.body?.cancel().catch(() => {});
      checked = await requestSafely('GET', checked.target);
      response = checked.response;
    }
    const safeRedirect = !checked.redirectError;
    const result = {
      ok: response.ok && safeRedirect,
      status: response.status,
      finalUrl: safeRedirect ? canonicalPageUrl(checked.target.toString()) : '',
      etag: response.headers.get('etag') || '',
      lastModified: response.headers.get('last-modified') || '',
      contentLength: response.headers.get('content-length') || '',
      contentType: response.headers.get('content-type') || '',
      ...(safeRedirect ? {} : { error: checked.redirectError }),
    };
    response.body?.cancel().catch(() => {});
    return result;
  } finally {
    clearTimeout(timer);
  }
}

export function analyzeContentDrift(previousText, newText) {
  const prev = String(previousText || '');
  const curr = String(newText || '');
  if (!prev) {
    return {
      type: 'initial_capture',
      lengthDelta: curr.length,
      previousLength: 0,
      newLength: curr.length,
      summary: `Initial official source capture: ${curr.length} characters staged for review.`,
      metricChanges: [],
    };
  }

  const prevNumbers = new Set(prev.match(/\b\d+(?:[.,]\d+)?\b/g) || []);
  const currNumbers = new Set(curr.match(/\b\d+(?:[.,]\d+)?\b/g) || []);
  const addedNumbers = [...currNumbers].filter((n) => !prevNumbers.has(n));
  const removedNumbers = [...prevNumbers].filter((n) => !currNumbers.has(n));

  const prevYears = [...new Set(prev.match(/20\d{2}[-–/]\d{2,4}/g) || [])];
  const currYears = [...new Set(curr.match(/20\d{2}[-–/]\d{2,4}/g) || [])];

  const lengthDelta = curr.length - prev.length;
  const metricChanges = [];

  if (addedNumbers.length > 0 || removedNumbers.length > 0) {
    metricChanges.push({
      metric: 'numeric_values',
      added: addedNumbers.slice(0, 10),
      removed: removedNumbers.slice(0, 10),
    });
  }

  if (JSON.stringify(prevYears) !== JSON.stringify(currYears)) {
    metricChanges.push({
      metric: 'academic_years',
      previous: prevYears,
      current: currYears,
    });
  }

  const summary = `Content drift detected: ${lengthDelta >= 0 ? '+' : ''}${lengthDelta} chars. ${addedNumbers.length} new figures, ${removedNumbers.length} removed figures.`;

  return {
    type: 'drift_detected',
    lengthDelta,
    previousLength: prev.length,
    newLength: curr.length,
    summary,
    metricChanges,
  };
}

function numericClaims(text) {
  return String(text || '').split(/(?<=[.!?])\s+|\n+/).map((sentence) => sentence.trim())
    .filter((sentence) => /\d/.test(sentence))
    .map((sentence) => {
      const values = [...new Set([...sentence.matchAll(/\d[\d,]*(?:\.\d+)?/g)].map((match) => match[0].replaceAll(',', '')))];
      const key = sentence.toLowerCase().replace(/\d[\d,]*(?:\.\d+)?/g, '#')
        .replace(/[^a-z#]+/g, ' ').replace(/\s+/g, ' ').trim();
      return { sentence, key, values };
    }).filter((claim) => claim.key.replace(/#/g, '').replace(/\s/g, '').length >= 12 && claim.values.length);
}

export function detectNumericConflicts(currentText, knowledgeRecords = [], sourceUrl = '') {
  const currentClaims = numericClaims(currentText);
  const currentByKey = new Map(currentClaims.map((claim) => [claim.key, claim]));
  const conflicts = new Map();
  for (const record of knowledgeRecords) {
    if (!(record.status === 'Published' || record.status === 'Review' && record.freshnessReview) || !record.text) continue;
    const claims = numericClaims(record.text);
    for (const claim of claims) {
      const current = currentByKey.get(claim.key);
      if (!current || current.values.join('|') === claim.values.join('|')) continue;
      const key = `${claim.key}|${record.id}|${current.values.join('|')}|${claim.values.join('|')}`;
      conflicts.set(key, {
        type: 'numeric_claim_changed',
        statement: current.key.replace(/#/g, '…'),
        previousText: claim.sentence.slice(0, 500),
        currentText: current.sentence.slice(0, 500),
        previousValues: claim.values,
        currentValues: current.values,
        recordId: record.id,
        previousSourceUrl: record.sourceUrl || '',
        currentSourceUrl: sourceUrl,
      });
    }
  }
  return [...conflicts.values()].slice(0, 30);
}

export function detectRemovedNumericClaims(currentText, knowledgeRecords = [], sourceUrl = '') {
  const current = new Set(numericClaims(currentText).map((claim) => `${claim.key}|${claim.values.join('|')}`));
  const removed = new Set();
  const canonicalUrl = sourceUrl ? canonicalPageUrl(sourceUrl) : '';
  for (const record of knowledgeRecords) {
    if (!(record.status === 'Published' || record.status === 'Review' && record.freshnessReview) || !record.text) continue;
    if (canonicalUrl) {
      try { if (canonicalPageUrl(record.sourceUrl || '') !== canonicalUrl) continue; } catch { continue; }
    }
    if (numericClaims(record.text).some((claim) => !current.has(`${claim.key}|${claim.values.join('|')}`))) removed.add(record.id);
  }
  return [...removed];
}

export async function syncMonitoredWebsiteSources({
  db,
  user = { email: 'system:website-sync', role: 'admin' },
  fetcher = defaultFetcher,
  linkChecker = null,
  sources = monitoredWebsiteSources,
  save = true,
  saveFn = null,
  auditFn = null,
} = {}) {
  const now = new Date().toISOString();
  const summary = {
    checked: 0,
    discovered: 0,
    changed: 0,
    baselined: 0,
    unchanged: 0,
    linkChecks: 0,
    skippedLinkChecks: 0,
    conflictCount: 0,
    suspendedRecords: 0,
    errors: [],
    stagedSources: [],
    driftReports: [],
  };

  db.officialSources = db.officialSources || [];

  let sourceList = sources;
  let pageContents = new Map();
  let discoveryErrors = new Map();
  if (sources.length === 1 && canonicalPageUrl(sources[0].url) === canonicalPageUrl(officialWebsiteRoot)) {
    const crawl = await discoverOfficialWebsitePages({ root: sources[0].url, fetcher });
    pageContents = crawl.pageContents || new Map();
    discoveryErrors = new Map(crawl.errors.map((item) => {
      try { return [canonicalPageUrl(item.url), item.error]; } catch { return [item.url, item.error]; }
    }));
    const discoveredUrls = new Set(crawl.sources.map((item) => canonicalPageUrl(item.url)));
    const knownSources = (db.officialSources || []).filter((item) => item.sourceUrl).map((item) => ({
      title: item.title,
      url: item.sourceUrl,
      documentType: item.documentType || 'Website page',
      academicYear: item.academicYear || 'Not specified',
      sourceAuthority: item.sourceAuthority || 'MITCORER official website',
    }));
    const knownKnowledge = (db.knowledge || []).filter((item) => item.sourceUrl).map((item) => ({
      title: item.title,
      url: item.sourceUrl,
      documentType: item.category || 'Website page',
      academicYear: item.provenance?.academicYear || 'Not specified',
      sourceAuthority: item.source || 'MITCORER official website',
    }));
    const monitoredRoot = new URL(officialWebsiteRoot);
    const previouslyKnownPages = [...knownSources, ...knownKnowledge].filter((item) => {
      try {
        const url = new URL(item.url);
        return url.origin === monitoredRoot.origin && url.pathname.startsWith(websitePathRoot) && !discoveredUrls.has(canonicalPageUrl(item.url));
      } catch { return false; }
    });
    sourceList = [...crawl.sources, ...new Map(previouslyKnownPages.map((item) => [canonicalPageUrl(item.url), item])).values()];
    summary.discovered = crawl.discovered;
  }

  function findExistingSource(url) {
    return db.officialSources.find((item) => {
      try { return item.sourceUrl && canonicalPageUrl(item.sourceUrl) === canonicalPageUrl(url); } catch { return item.sourceUrl === url; }
    });
  }

  function withholdLinkedKnowledge(url, reason) {
    let count = 0;
    for (const record of db.knowledge || []) {
      let matches = false;
      try { matches = record.sourceUrl && canonicalPageUrl(record.sourceUrl) === canonicalPageUrl(url); } catch {}
      if (!matches || record.status !== 'Published') continue;
      record.status = 'Review';
      record.freshnessReview = { detectedAt: now, changedSourceUrl: canonicalPageUrl(url), reason };
      count += 1;
      if (auditFn) auditFn('knowledge.freshness_review_required', 'knowledge', record.id, user, `Source ${reason}: ${url}`);
    }
    summary.suspendedRecords += count;
    return count;
  }

  function stageUnavailableSource(source, error) {
    const url = source.url;
    const canonicalUrl = canonicalPageUrl(url);
    let existing = findExistingSource(url);
    const withheld = withholdLinkedKnowledge(url, 'source-unavailable');
    if (!existing) {
      existing = {
        id: `SRC-WEB-${crypto.createHash('sha256').update(canonicalUrl).digest('hex').slice(0, 12).toUpperCase()}`,
        title: source.title,
        documentType: source.documentType,
        academicYear: source.academicYear,
        sourceAuthority: source.sourceAuthority,
        originalFileName: `${new URL(url).pathname.split('/').filter(Boolean).at(-1) || 'page'}.html`,
        storedFileName: null,
        mimeType: 'text/html',
        sourceUrl: canonicalUrl,
        sizeBytes: 0,
        status: 'Review',
        extractionStatus: 'Source unavailable; linked answers withheld until the page is reachable and reviewed.',
        extractedText: '',
        contentHash: '',
        linkedKnowledgeCount: withheld,
        uploadedBy: user.email || 'system:website-sync',
        createdAt: now,
      };
      db.officialSources.unshift(existing);
    }
    existing.status = 'Review';
    existing.extractionStatus = 'Source unavailable; linked answers withheld until the page is reachable and reviewed.';
    existing.updatedAt = now;
    existing.linkedKnowledgeCount = (db.knowledge || []).filter((record) => {
      try { return record.sourceUrl && canonicalPageUrl(record.sourceUrl) === canonicalUrl; } catch { return false; }
    }).length;
    existing.syncMeta = {
      ...(existing.syncMeta || {}),
      sourceUrl: canonicalUrl,
      lastAttemptAt: now,
      healthStatus: 'unreachable',
      lastError: String(error || 'Source check failed').slice(0, 240),
    };
    existing.freshnessImpact = { withheldKnowledgeIds: (db.knowledge || []).filter((record) => record.freshnessReview?.changedSourceUrl === canonicalUrl).map((record) => record.id) };
    summary.stagedSources.push({ id: existing.id, title: existing.title, sourceUrl: canonicalUrl, status: existing.status });
    summary.errors.push({ url, error: String(error || 'Source check failed').slice(0, 240) });
    if (auditFn) auditFn('official_source.unavailable', 'official_source', existing.id, user, `${url} (${error})`);
  }

  for (const source of sourceList) {
    summary.checked += 1;
    let html = '';
    const canonicalSourceUrl = canonicalPageUrl(source.url);
    try {
      const discoveryError = discoveryErrors.get(canonicalSourceUrl);
      if (discoveryError) throw new Error(discoveryError);
      html = pageContents.has(canonicalSourceUrl) ? pageContents.get(canonicalSourceUrl) : await fetcher(source.url);
    } catch (err) {
      stageUnavailableSource(source, err.message);
      continue;
    }

    const cleaned = cleanHtml(html);
    if (!cleaned || cleaned.length < 40) {
      stageUnavailableSource(source, 'Insufficient text extracted from page');
      continue;
    }

    const hash = hashContent(cleaned);
    const existing = findExistingSource(source.url);

    if (!existing) {
      const existingKnowledge = (db.knowledge || []).filter((record) => {
        try { return record.sourceUrl && canonicalPageUrl(record.sourceUrl) === canonicalSourceUrl; } catch { return record.sourceUrl === source.url; }
      });
      if (existingKnowledge.length) {
        const now = new Date().toISOString();
        const baseline = {
          id: `SRC-WEB-${crypto.createHash('sha256').update(canonicalSourceUrl).digest('hex').slice(0, 12).toUpperCase()}`,
          title: source.title,
          documentType: source.documentType,
          academicYear: source.academicYear,
          sourceAuthority: source.sourceAuthority,
          originalFileName: `${new URL(source.url).pathname.split('/').filter(Boolean).at(-1) || 'page'}.html`,
          storedFileName: null,
          mimeType: 'text/html',
          sourceUrl: canonicalSourceUrl,
          sizeBytes: Buffer.byteLength(cleaned),
          status: existingKnowledge.every((record) => record.status === 'Review') ? 'Review' : 'Published',
          extractionStatus: `Website monitoring baseline linked to ${existingKnowledge.length} existing knowledge records (${cleaned.length} chars)`,
          extractedText: cleaned,
          contentHash: hash,
          linkedKnowledgeCount: existingKnowledge.length,
          uploadedBy: user.email || 'system:website-sync',
          createdAt: now,
          updatedAt: now,
          syncMeta: { syncedAt: now, lastCheckedAt: now, sourceUrl: canonicalSourceUrl, length: cleaned.length, contentHash: hash, healthStatus: 'available', consecutiveFailures: 0, baselineOnly: true },
          driftAnalysis: analyzeContentDrift('', cleaned),
        };
        db.officialSources.unshift(baseline);
        summary.baselined += 1;
        summary.unchanged += 1;
        if (auditFn) auditFn('official_source.baselined', 'official_source', baseline.id, user, `${source.title} (${source.url})`);
        continue;
      }
    }

    if (existing) {
      const existingHash = existing.contentHash || hashContent(existing.extractedText);
      if (existingHash === hash) {
        existing.syncMeta = { ...(existing.syncMeta || {}), lastCheckedAt: now, lastAttemptAt: now, sourceUrl: canonicalSourceUrl, healthStatus: 'available', consecutiveFailures: 0, lastError: '' };
        summary.unchanged += 1;
        continue;
      }
    }

    const drift = analyzeContentDrift(existing?.extractedText || '', cleaned);
    const conflicts = detectNumericConflicts(cleaned, db.knowledge || [], source.url);
    const removedClaimRecordIds = detectRemovedNumericClaims(cleaned, db.knowledge || [], source.url);
    const directlyLinkedRecords = (db.knowledge || []).filter((record) => {
      try { return record.status === 'Published' && record.sourceUrl && canonicalPageUrl(record.sourceUrl) === canonicalSourceUrl; } catch { return false; }
    });
    const freshnessReviewIds = new Set([
      ...directlyLinkedRecords.map((record) => record.id),
      ...conflicts.map((item) => item.recordId),
      ...removedClaimRecordIds,
    ]);
    for (const recordId of freshnessReviewIds) {
      const outdated = (db.knowledge || []).find((record) => record.id === recordId && record.status === 'Published');
      if (!outdated) continue;
      outdated.status = 'Review';
      const reason = conflicts.some((item) => item.recordId === recordId)
        ? 'numeric-conflict'
        : removedClaimRecordIds.includes(recordId) ? 'numeric-claim-removed' : 'source-content-changed';
      outdated.freshnessReview = { detectedAt: now, changedSourceUrl: canonicalSourceUrl, reason };
      summary.suspendedRecords += 1;
      if (auditFn) auditFn('knowledge.freshness_review_required', 'knowledge', outdated.id, user, `Source content changed at ${source.url}`);
    }

    let stagedRecord;
    if (existing && existing.status === 'Review') {
      if (existing.extractedText && existing.contentHash !== hash) {
        existing.previousVersion = {
          sourceId: existing.id,
          title: existing.title,
          contentHash: existing.contentHash || hashContent(existing.extractedText),
          text: existing.extractedText,
          capturedAt: existing.updatedAt || existing.createdAt,
        };
      }
      existing.extractedText = cleaned;
      existing.contentHash = hash;
      existing.extractionStatus = `Automated website sync updated — pending maintainer review (${cleaned.length} chars)`;
      existing.updatedAt = now;
      existing.syncMeta = { ...(existing.syncMeta || {}), syncedAt: now, lastCheckedAt: now, sourceUrl: canonicalSourceUrl, length: cleaned.length, contentHash: hash, healthStatus: 'available', consecutiveFailures: 0, lastError: '' };
      existing.driftAnalysis = drift;
      existing.conflicts = conflicts;
      existing.freshnessImpact = { withheldKnowledgeIds: [...freshnessReviewIds], removedClaimRecordIds };
      stagedRecord = existing;
    } else {
      const id = `SRC-SYNC-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
      let pagePath = 'page';
      try {
        pagePath = new URL(source.url).pathname.replace(/^\//, '') || 'page';
      } catch {
        pagePath = 'page';
      }
      stagedRecord = {
        id,
        title: source.title,
        documentType: source.documentType,
        academicYear: source.academicYear,
        sourceAuthority: source.sourceAuthority,
        originalFileName: `${pagePath}.html`,
        storedFileName: null,
        mimeType: 'text/html',
        sourceUrl: source.url,
        sizeBytes: Buffer.byteLength(cleaned),
        status: 'Review',
        extractionStatus: `Automated website sync — pending maintainer review (${cleaned.length} chars)`,
        extractedText: cleaned,
        contentHash: hash,
        linkedKnowledgeCount: 0,
        uploadedBy: user.email || 'system:website-sync',
        createdAt: now,
        updatedAt: now,
        syncMeta: { syncedAt: now, lastCheckedAt: now, sourceUrl: canonicalSourceUrl, length: cleaned.length, contentHash: hash, healthStatus: 'available', consecutiveFailures: 0, lastError: '' },
        driftAnalysis: drift,
        ...(existing ? {
          previousVersion: {
            sourceId: existing.id,
            title: existing.title,
            contentHash: existing.contentHash || hashContent(existing.extractedText),
            text: existing.extractedText,
            capturedAt: existing.updatedAt || existing.createdAt,
          },
        } : {}),
        conflicts,
        freshnessImpact: { withheldKnowledgeIds: [...freshnessReviewIds], removedClaimRecordIds },
      };
      db.officialSources.unshift(stagedRecord);
    }

    summary.changed += 1;
    summary.stagedSources.push({
      id: stagedRecord.id,
      title: stagedRecord.title,
      sourceUrl: stagedRecord.sourceUrl,
      status: stagedRecord.status,
    });
    summary.driftReports.push({
      url: source.url,
      title: source.title,
      drift,
      conflicts,
    });
    summary.conflictCount += conflicts.length;
    if (auditFn) {
      auditFn('official_source.synced', 'official_source', stagedRecord.id, user, `${source.title} (${source.url})`);
    }
  }

  // Check official URLs outside the new-site crawl as well. A positive HTTP check
  // only establishes reachability; validator changes quarantine records for a
  // human content review instead of claiming their meaning is unchanged.
  const checkedPageUrls = new Set(sourceList.map((item) => canonicalPageUrl(item.url)));
  const externalTargets = new Map();
  for (const item of [...(db.officialSources || []), ...(db.knowledge || [])]) {
    if (!item.sourceUrl) continue;
    let url;
    try { url = new URL(item.sourceUrl); } catch { continue; }
    if (url.protocol !== 'https:' || !isApprovedOfficialHost(url.hostname)) continue;
    const canonicalUrl = canonicalPageUrl(item.sourceUrl);
    if (checkedPageUrls.has(canonicalUrl)) continue;
    if (!externalTargets.has(canonicalUrl)) externalTargets.set(canonicalUrl, {
      title: item.title,
      url: canonicalUrl,
      documentType: item.documentType || item.category || 'Official source',
      academicYear: item.academicYear || item.provenance?.academicYear || 'Not specified',
      sourceAuthority: item.sourceAuthority || item.source || 'Official source',
    });
  }

  const checkOfficialLink = linkChecker || (fetcher === defaultFetcher
    ? defaultLinkChecker
    : async (url) => {
      try { await fetcher(url); return { ok: true, status: 200 }; }
      catch (error) { return { ok: false, error: error?.message || 'Source check failed' }; }
    });
  for (const source of externalTargets.values()) {
    summary.checked += 1;
    summary.linkChecks += 1;
    let result;
    try { result = await checkOfficialLink(source.url); }
    catch (error) { result = { ok: false, error: error?.message || 'Source check failed' }; }
    if (result?.skipped) {
      summary.skippedLinkChecks += 1;
      continue;
    }
    if (!result?.ok) {
      stageUnavailableSource(source, result?.error || `HTTP ${result?.status || 'check failed'}`);
      continue;
    }

    const canonicalUrl = canonicalPageUrl(source.url);
    const existing = findExistingSource(source.url);
    const linkedRecords = (db.knowledge || []).filter((record) => {
      try { return record.sourceUrl && canonicalPageUrl(record.sourceUrl) === canonicalUrl; } catch { return false; }
    });
    const priorValidators = existing?.syncMeta?.remoteValidators
      || linkedRecords.find((record) => record.sourceCheck?.remoteValidators)?.sourceCheck.remoteValidators
      || {};
    const currentValidators = {
      etag: String(result.etag || ''),
      lastModified: String(result.lastModified || ''),
      contentLength: String(result.contentLength || ''),
    };
    const stableKeys = ['etag', 'lastModified', 'contentLength'].filter((key) => priorValidators[key] && currentValidators[key]);
    const validatorChanged = stableKeys.some((key) => priorValidators[key] !== currentValidators[key]);
    const hadBaseline = stableKeys.length > 0;
    const checkedAt = new Date().toISOString();
    for (const record of linkedRecords) {
      record.sourceCheck = {
        ...(record.sourceCheck || {}),
        lastCheckedAt: checkedAt,
        healthStatus: 'available',
        statusCode: result.status || 200,
        remoteValidators: currentValidators,
        contentSupportStatus: record.verification?.contentHash ? 'review-recorded' : 'not-reviewed',
      };
    }
    if (validatorChanged) {
      const withheld = withholdLinkedKnowledge(source.url, 'source-version-changed');
      let staged = existing;
      if (staged) {
        staged.previousVersion = {
          sourceId: staged.id,
          title: staged.title,
          contentHash: staged.contentHash || '',
          text: staged.extractedText || '',
          capturedAt: staged.updatedAt || staged.createdAt,
          remoteValidators: priorValidators,
        };
        staged.extractedText = '';
        staged.contentHash = '';
      }
      if (!staged) {
        staged = {
          id: `SRC-WEB-${crypto.createHash('sha256').update(canonicalUrl).digest('hex').slice(0, 12).toUpperCase()}`,
          title: source.title,
          documentType: source.documentType,
          academicYear: source.academicYear,
          sourceAuthority: source.sourceAuthority,
          originalFileName: `${new URL(canonicalUrl).pathname.split('/').filter(Boolean).at(-1) || 'source'}.html`,
          storedFileName: null,
          mimeType: result.contentType || 'application/octet-stream',
          sizeBytes: Number(result.contentLength) || 0,
          sourceUrl: canonicalUrl,
          extractedText: '',
          contentHash: '',
          linkedKnowledgeCount: linkedRecords.length,
          uploadedBy: user.email || 'system:website-sync',
          createdAt: checkedAt,
        };
        db.officialSources.unshift(staged);
      }
      staged.status = 'Review';
      staged.extractionStatus = 'Remote source version changed; compare the current official source with each linked answer before republishing.';
      staged.updatedAt = checkedAt;
      staged.syncMeta = { ...(staged.syncMeta || {}), sourceUrl: canonicalUrl, lastCheckedAt: checkedAt, lastAttemptAt: checkedAt, healthStatus: 'available', remoteValidators: currentValidators, validatorBaseline: true };
      staged.freshnessImpact = { withheldKnowledgeIds: linkedRecords.map((record) => record.id), validatorChanged: true };
      summary.changed += 1;
      summary.stagedSources.push({ id: staged.id, title: staged.title, sourceUrl: canonicalUrl, status: staged.status });
      if (auditFn) auditFn('official_source.remote_version_changed', 'official_source', staged.id, user, canonicalUrl);
    } else {
      if (existing) {
        existing.syncMeta = { ...(existing.syncMeta || {}), sourceUrl: canonicalUrl, lastCheckedAt: checkedAt, lastAttemptAt: checkedAt, healthStatus: 'available', remoteValidators: currentValidators, validatorBaseline: hadBaseline || Boolean(existing.syncMeta?.validatorBaseline) };
      }
      summary.unchanged += 1;
    }
  }

  if (save && typeof saveFn === 'function') {
    saveFn();
  }

  return summary;
}

