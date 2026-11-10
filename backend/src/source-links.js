import { newWebsiteRouteMap } from './website-routes.js';

// Verified aliases and missing references. Do not replace arbitrary URLs.
const libraryOld = 'https://www.mitcorer.edu.in/about-lib-details.html';
const libraryCurrent = 'https://mitcorer.edu.in/about-lib-details.php';

export const verifiedUrlRewrites = {
  [libraryOld]: libraryCurrent,
  'https://mitcorer.edu.in/dse.php': 'https://mitcorer.edu.in/d-sy-btech.php',
  'https://www.mitcorer.edu.in/dse.php': 'https://mitcorer.edu.in/d-sy-btech.php',
  'https://mitcorer.edu.in/electronics-and-computer-engineering.php': 'https://mitcorer.edu.in/electronic-computer-engineering.php',
  'https://www.mitcorer.edu.in/electronics-and-computer-engineering.php': 'https://mitcorer.edu.in/electronic-computer-engineering.php',
  'https://mitcorer.edu.in/training-and-placement-cell.php': 'https://mitcorer.edu.in/placement-cell.php',
  'https://www.mitcorer.edu.in/training-and-placement-cell.php': 'https://mitcorer.edu.in/placement-cell.php',
  'https://mitcorer.edu.in/training-placement.php': 'https://mitcorer.edu.in/placement-cell.php',
  'https://www.mitcorer.edu.in/training-placement.php': 'https://mitcorer.edu.in/placement-cell.php',
};

const missingReferences = {
  'KB-1': 'https://mitcorer.edu.in/fy-btech-documents.php',
  'KB-5': 'https://mitcorer.edu.in/fy-btech-eligibility-criteria.php',
};

export function resolveSourceUrl(url) {
  if (!url) return '';
  const resolved = verifiedUrlRewrites[url] ?? url;
  return newWebsiteRouteMap[resolved] ?? resolved;
}

export function sourceRecord(record) {
  return { ...record, sourceUrl: resolveSourceUrl(record.sourceUrl ?? missingReferences[record.id]) };
}

export function uniqueSourceLinks(links, primaryUrl = '') {
  const seen = new Set(primaryUrl ? [resolveSourceUrl(primaryUrl)] : []);
  return (links || []).flatMap(link => {
    const url = resolveSourceUrl(link.url);
    if (!url || seen.has(url)) return [];
    seen.add(url);
    return [{ ...link, url }];
  });
}
