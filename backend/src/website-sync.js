import crypto from 'node:crypto';

export const monitoredWebsiteSources = [
  {
    title: 'MITCORER First Year B.Tech Admissions & Intake',
    url: 'https://mitcorer.edu.in/fy-btech.php',
    documentType: 'Programs & Intake',
    academicYear: '2026-27',
    sourceAuthority: 'MITCORER Admissions Office',
  },
  {
    title: 'MITCORER Direct Second Year Admissions',
    url: 'https://mitcorer.edu.in/d-sy-btech.php',
    documentType: 'Direct Second Year',
    academicYear: '2026-27',
    sourceAuthority: 'MITCORER Admissions Office',
  },
  {
    title: 'MITCORER Official Contact & Admission Enquiry',
    url: 'https://mitcorer.edu.in/contact.php',
    documentType: 'Contact',
    academicYear: '2026-27',
    sourceAuthority: 'MITCORER Admissions Office',
  },
  {
    title: 'MITCORER Scholarships & Government Schemes',
    url: 'https://mitcorer.edu.in/scholarship.php',
    documentType: 'Scholarships',
    academicYear: '2026-27',
    sourceAuthority: 'MITCORER Scholarship Cell',
  },
  {
    title: 'MITCORER Library & Digital Learning Facilities',
    url: 'https://mitcorer.edu.in/about-lib-details.php',
    documentType: 'Facilities',
    academicYear: '2026-27',
    sourceAuthority: 'MITCORER Central Library',
  },
  {
    title: 'MITCORER Training & Placement Cell Information',
    url: 'https://mitcorer.edu.in/placement-committee.php',
    documentType: 'Placements',
    academicYear: '2026-27',
    sourceAuthority: 'MITCORER Training & Placement Office',
  },
];

export function cleanHtml(html) {
  if (typeof html !== 'string') return '';
  let text = html
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
    changed: 0,
    unchanged: 0,
    errors: [],
    stagedSources: [],
    driftReports: [],
  };

  db.officialSources = db.officialSources || [];

  for (const source of sources) {
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
    const existing = db.officialSources.find((s) => s.sourceUrl === source.url);

    if (existing) {
      const existingHash = existing.contentHash || hashContent(existing.extractedText);
      if (existingHash === hash) {
        summary.unchanged += 1;
        continue;
      }
    }

    const drift = analyzeContentDrift(existing?.extractedText || '', cleaned);

    let stagedRecord;
    if (existing && existing.status === 'Review') {
      existing.extractedText = cleaned;
      existing.contentHash = hash;
      existing.extractionStatus = `Automated website sync updated — pending maintainer review (${cleaned.length} chars)`;
      existing.updatedAt = now;
      existing.syncMeta = { syncedAt: now, sourceUrl: source.url, length: cleaned.length };
      existing.driftAnalysis = drift;
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
      };
      db.officialSources.unshift(stagedRecord);
    }

    summary.changed += 1;
    summary.stagedSources.push(stagedRecord);
    summary.driftReports.push({
      url: source.url,
      title: source.title,
      drift,
    });
    if (auditFn) {
      auditFn('official_source.synced', 'official_source', stagedRecord.id, user, `${source.title} (${source.url})`);
    }
  }

  if (save && typeof saveFn === 'function') {
    saveFn();
  }

  return summary;
}

