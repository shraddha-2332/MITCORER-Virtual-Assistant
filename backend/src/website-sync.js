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
  return { sources, errors, discovered: queued.size, fetched: pages.size, maxPages };
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
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': 'MITRA-Admission-Sync-Bot/1.0 (+https://mitcorer.edu.in)' },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
    return await res.text();
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
    conflictCount: 0,
    suspendedRecords: 0,
    errors: [],
    stagedSources: [],
    driftReports: [],
  };

  db.officialSources = db.officialSources || [];

  let sourceList = sources;
  if (sources.length === 1 && canonicalPageUrl(sources[0].url) === canonicalPageUrl(officialWebsiteRoot)) {
    const crawl = await discoverOfficialWebsitePages({ root: sources[0].url, fetcher });
    sourceList = crawl.sources;
    summary.discovered = crawl.discovered;
    summary.errors.push(...crawl.errors);
  }

  for (const source of sourceList) {
    summary.checked += 1;
    let html = '';
    try {
      html = await fetcher(source.url);
    } catch (err) {
      summary.errors.push({ url: source.url, error: err.message });
      continue;
    }

    const cleaned = cleanHtml(html);
    if (!cleaned || cleaned.length < 40) {
      summary.errors.push({ url: source.url, error: 'Insufficient text extracted from page' });
      continue;
    }

    const hash = hashContent(cleaned);
    const canonicalSourceUrl = canonicalPageUrl(source.url);
    const existing = db.officialSources.find((s) => {
      try { return s.sourceUrl && canonicalPageUrl(s.sourceUrl) === canonicalSourceUrl; } catch { return s.sourceUrl === source.url; }
    });

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
          syncMeta: { syncedAt: now, sourceUrl: canonicalSourceUrl, length: cleaned.length, baselineOnly: true },
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
        summary.unchanged += 1;
        continue;
      }
    }

    const drift = analyzeContentDrift(existing?.extractedText || '', cleaned);
    const conflicts = detectNumericConflicts(cleaned, db.knowledge || [], source.url);
    const removedClaimRecordIds = detectRemovedNumericClaims(cleaned, db.knowledge || [], source.url);
    const freshnessReviewIds = new Set([...conflicts.map((item) => item.recordId), ...removedClaimRecordIds]);
    for (const recordId of freshnessReviewIds) {
      const outdated = (db.knowledge || []).find((record) => record.id === recordId && record.status === 'Published');
      if (!outdated) continue;
      outdated.status = 'Review';
      outdated.freshnessReview = { detectedAt: now, changedSourceUrl: canonicalSourceUrl, reason: conflicts.some((item) => item.recordId === recordId) ? 'numeric-conflict' : 'numeric-claim-removed' };
      summary.suspendedRecords += 1;
      if (auditFn) auditFn('knowledge.freshness_review_required', 'knowledge', outdated.id, user, `Potential conflict with ${source.url}`);
    }

    let stagedRecord;
    if (existing && existing.status === 'Review') {
      existing.extractedText = cleaned;
      existing.contentHash = hash;
      existing.extractionStatus = `Automated website sync updated — pending maintainer review (${cleaned.length} chars)`;
      existing.updatedAt = now;
      existing.syncMeta = { syncedAt: now, sourceUrl: source.url, length: cleaned.length };
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
        syncMeta: { syncedAt: now, sourceUrl: source.url, length: cleaned.length },
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

  if (save && typeof saveFn === 'function') {
    saveFn();
  }

  return summary;
}

