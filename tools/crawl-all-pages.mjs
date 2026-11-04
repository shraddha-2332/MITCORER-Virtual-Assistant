import fs from 'node:fs';

const pages = JSON.parse(fs.readFileSync('tools/scratch/pages_to_crawl.json', 'utf8'));

fs.mkdirSync('tools/scratch/pages', { recursive: true });

function cleanHtmlToText(html) {
  return html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
    .replace(/<header\b[^<]*(?:(?!<\/header>)<[^<]*)*<\/header>/gi, '')
    .replace(/<footer\b[^<]*(?:(?!<\/footer>)<[^<]*)*<\/footer>/gi, '')
    .replace(/<nav\b[^<]*(?:(?!<\/nav>)<[^<]*)*<\/nav>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

async function run() {
  console.log(`Starting crawl of ${pages.length} pages...`);
  const results = [];

  for (let i = 0; i < pages.length; i++) {
    const url = pages[i];
    try {
      console.log(`[${i + 1}/${pages.length}] Fetching ${url}`);
      const res = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
      });
      if (!res.ok) {
        console.warn(`Failed: ${res.status}`);
        continue;
      }
      const html = await res.text();
      const title = html.match(/<title>([^<]+)<\/title>/i)?.[1]?.trim() || '';
      const text = cleanHtmlToText(html);

      results.push({ url, title, text, htmlLength: html.length, textLength: text.length });
    } catch (e) {
      console.error(`Error on ${url}:`, e.message);
    }
  }

  console.log(`\nSuccessfully scraped ${results.length} pages!`);
  fs.writeFileSync('tools/scratch/crawled_knowledge.json', JSON.stringify(results, null, 2), 'utf8');
}

run().catch(console.error);

