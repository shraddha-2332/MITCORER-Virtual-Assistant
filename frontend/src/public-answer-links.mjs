import { formatPublicAnswer } from './answer-format.mjs';

// These bundled notices are fixed 2026-27 snapshots, not automatically current evidence.
const feeSnapshots = {
  firstYear: ['1,05,000', '61,109', '17,217', '17,217', '8,000'],
  directSecondYear: ['98,000', '58,181', '18,362', '18,362', '10,000'],
  hostel: ['35,000', '5,000', '40,000', '42,000'],
};
export function matchesFeeSnapshot(route, academicYear, amounts) {
  return academicYear === '2026-27' && JSON.stringify(amounts.map(value => typeof value === 'number' ? value.toLocaleString('en-IN') : value)) === JSON.stringify(feeSnapshots[route]);
}
// Also correct answers already returned by a backend that has not been restarted.
export function resolvePublicSourceUrl(url) {
  try {
    const parsed = new URL(url);
    if (['http:', 'https:'].includes(parsed.protocol)
      && ['mitcorer.edu.in', 'www.mitcorer.edu.in'].includes(parsed.hostname)
      && parsed.pathname === '/about-lib-details.html') return 'https://mitcorer.edu.in/about-lib-details.php';
  } catch { /* Relative bundled notices keep their original URL. */ }
  return url;
}
export function publicAnswerLinks(message, assets = {}) {
  const links = [];
  const seen = new Set();
  const add = (label, url) => {
    url = resolvePublicSourceUrl(url);
    if (!url || seen.has(url)) return;
    seen.add(url);
    links.push({ label, url });
  };
  const passages = (message.evidence || []).filter(record => record.id === 'KB-2' || record.id === 'KB-3').map(record => record.passage?.text).filter(Boolean);
  for (const passage of passages) {
    const answer = String(message.text || '');
    for (const block of formatPublicAnswer(passage)) {
      if (block.type !== 'fees' || !/2026-27/.test(block.intro)) continue;
      const route = /First Year/.test(block.intro) ? 'firstYear' : /Direct Second Year/.test(block.intro) ? 'directSecondYear' : 'hostel';
      const matches = JSON.stringify(block.items.map(item => item.amount)) === JSON.stringify(feeSnapshots[route]);
      const relevant = route === 'hostel' ? /hostel|mess|वसतिगृह|मेस|छात्रावास/.test(answer)
        : route === 'firstYear' ? /First Year|प्रथम वर्ष|पहिले वर्ष/.test(answer)
          : /Direct Second Year|द्वितीय वर्ष|दुसरे वर्ष/.test(answer);
      if (matches && relevant) add(`${route === 'firstYear' ? 'First Year' : route === 'directSecondYear' ? 'Direct Second Year' : 'Hostel and mess'} fee table (AY 2026–27; provided notice)`, assets[route]);
    }
  }
  const evidenceSources = message.sourceLinks?.length
    ? message.sourceLinks
    : (message.evidence || []).filter(record => record.sourceUrl).map(record => ({
      label: [record.title, record.academicYear, record.provenance?.section].filter(Boolean).join(' · '),
      url: record.sourceUrl,
    }));
  for (const link of evidenceSources) add(`Evidence: ${link.label || 'official record'}`, link.url);
  if (!evidenceSources.length && message.sourceUrl) add('Related official page', message.sourceUrl);
  for (const link of message.relatedLinks || message.officialLinks || []) add(`Related: ${link.label}`, link.url);
  return links;
}
