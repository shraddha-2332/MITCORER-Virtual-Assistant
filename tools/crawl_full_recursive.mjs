import fs from 'fs';
import path from 'path';

const START_URL = 'https://mitcorer.edu.in/mitcorer/public/';
const DOMAIN = 'mitcorer.edu.in';
const BASE_PATH = '/mitcorer/public/';

const visited = new Set();
const queue = [START_URL];
const scrapedPages = {};

function normalizeUrl(href, parentUrl) {
  try {
    const full = new URL(href, parentUrl);
    // Only same host and starts with /mitcorer/public/
    if (full.hostname !== DOMAIN && full.hostname !== 'www.' + DOMAIN) return null;
    if (!full.pathname.startsWith(BASE_PATH)) return null;
    // Strip hash and search
    full.hash = '';
    full.search = '';
    // Skip static assets
    const ext = path.extname(full.pathname).toLowerCase();
    if (['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.css', '.js', '.pdf', '.doc', '.docx', '.zip'].includes(ext)) {
      return null;
    }
    return full.toString();
  } catch (e) {
    return null;
  }
}

function cleanHtmlToContent(html) {
  // Remove scripts, styles, comments, SVG
  const withoutScripts = html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<svg\b[^<]*(?:(?!<\/svg>)<[^<]*)*<\/svg>/gi, '');

  // Extract all links
  const links = [];
  const linkRegex = /<a\b[^>]*\bhref=["']([^"']+)["'][^>]*>(.*?)<\/a>/gi;
  let match;
  while ((match = linkRegex.exec(html)) !== null) {
    const href = match[1].trim();
    const text = match[2].replace(/<[^>]+>/g, '').trim();
    if (href && !href.startsWith('javascript:') && !href.startsWith('mailto:') && !href.startsWith('tel:')) {
      links.push({ href, text });
    }
  }

  // Extract headings
  const headings = [];
  const headingRegex = /<h([1-6])[^>]*>(.*?)<\/h\1>/gi;
  while ((match = headingRegex.exec(html)) !== null) {
    const hText = match[2].replace(/<[^>]+>/g, '').trim();
    if (hText) headings.push({ level: parseInt(match[1]), text: hText });
  }

  // Clean text lines
  const rawText = withoutScripts
    .replace(/<[^>]+>/g, '\n')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");

  const lines = rawText
    .split('\n')
    .map(l => l.trim())
    .filter(l => l.length > 0);

  return {
    text: lines.join('\n'),
    headings,
    links
  };
}

async function runCrawl() {
  console.log('Starting full site recursive crawler...');
  let processed = 0;

  while (queue.length > 0) {
    const currentUrl = queue.shift();
    if (visited.has(currentUrl)) continue;
    visited.add(currentUrl);
    processed++;

    try {
      const res = await fetch(currentUrl, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) MITRA-Bot/2.0' }
      });
      if (res.status !== 200) {
        console.log(`[${res.status}] Skipping: ${currentUrl}`);
        continue;
      }

      const html = await res.text();
      const parsed = cleanHtmlToContent(html);
      scrapedPages[currentUrl] = {
        url: currentUrl,
        length: html.length,
        headings: parsed.headings,
        text: parsed.text,
        outboundLinks: parsed.links.map(l => l.href)
      };

      console.log(`[${processed}/${visited.size + queue.length}] Crawled: ${currentUrl} (${html.length} bytes, ${parsed.headings.length} headings)`);

      // Enqueue new links
      for (const item of parsed.links) {
        const norm = normalizeUrl(item.href, currentUrl);
        if (norm && !visited.has(norm) && !queue.includes(norm)) {
          queue.push(norm);
        }
      }
    } catch (err) {
      console.error(`Failed to fetch ${currentUrl}:`, err.message);
    }
  }

  fs.mkdirSync('tools/scratch', { recursive: true });
  fs.writeFileSync('tools/scratch/full_website_crawl.json', JSON.stringify(scrapedPages, null, 2), 'utf8');
  console.log(`Finished crawling. Total pages crawled and parsed: ${Object.keys(scrapedPages).length}`);
}

runCrawl();

