import fs from 'node:fs';

const links = JSON.parse(fs.readFileSync('tools/scratch/discovered_links.json', 'utf8'));

// Filter only pages under https://mitcorer.edu.in/mitcorer/public/
const targetPages = links.filter(link => {
  return typeof link === 'string' &&
    link.startsWith('https://mitcorer.edu.in/mitcorer/public/') &&
    !link.includes('/assets/') &&
    !link.endsWith('.css') &&
    !link.endsWith('.js') &&
    !link.endsWith('.jpg') &&
    !link.endsWith('.png') &&
    !link.endsWith('.pdf');
});

console.log('Target HTML pages to crawl:', targetPages.length);
console.log(targetPages.join('\n'));
fs.writeFileSync('tools/scratch/pages_to_crawl.json', JSON.stringify(targetPages, null, 2), 'utf8');

