import fs from 'node:fs';

const baseUrl = 'https://mitcorer.edu.in/mitcorer/public/';

async function crawl() {
  console.log('Fetching:', baseUrl);
  const res = await fetch(baseUrl, {
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
  });
  console.log('Status:', res.status);
  const html = await res.text();
  console.log('HTML Length:', html.length);
  
  const titleMatch = html.match(/<title>([^<]+)<\/title>/i);
  console.log('Title:', titleMatch ? titleMatch[1].trim() : 'No title');

  // Extract all href links
  const hrefs = [];
  const regex = /href=["']([^"']+)["']/gi;
  let match;
  while ((match = regex.exec(html)) !== null) {
    hrefs.push(match[1]);
  }

  const unique = [...new Set(hrefs)];
  console.log('Total unique links found on home page:', unique.length);

  // Filter links on the domain or relative paths
  const internalLinks = unique.filter(link => {
    return !link.startsWith('#') && !link.startsWith('javascript:') && !link.startsWith('tel:') && !link.startsWith('mailto:');
  });

  console.log('\nInternal / candidate links (sample 50):');
  console.log(internalLinks.slice(0, 50).join('\n'));

  // Save raw homepage HTML to scratch for parsing
  fs.mkdirSync('tools/scratch', { recursive: true });
  fs.writeFileSync('tools/scratch/homepage.html', html, 'utf8');
  fs.writeFileSync('tools/scratch/discovered_links.json', JSON.stringify(unique, null, 2), 'utf8');
}

crawl().catch(console.error);

