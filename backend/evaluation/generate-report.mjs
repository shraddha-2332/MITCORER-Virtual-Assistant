import fs from 'fs';

const results = JSON.parse(fs.readFileSync('backend/evaluation/test-results-200.json', 'utf8'));

let md = '# MITRA 200-Question Evaluation & Live Response Log\n\n';
md += 'Generated from direct execution of all 200 questions across 20 test categories against MITRA.\n\n';

let currentSection = '';
for (const r of results) {
  if (r.section !== currentSection) {
    currentSection = r.section;
    md += '\n## ' + currentSection + '\n\n';
  }
  md += '### Q' + r.id + ': ' + r.question + '\n';
  md += '- **Outcome / Status**: `' + r.outcomeStatus + '`\n';
  md += '- **Official Source**: ' + (r.source || 'N/A') + '\n';
  md += '- **MITRA Response**:\n\n> ' + (r.answer || '').split('\n').join('\n> ') + '\n\n';
}

fs.writeFileSync('deliverables/mitra-200-test-answers.md', md, 'utf8');
console.log('Report generated at deliverables/mitra-200-test-answers.md');

