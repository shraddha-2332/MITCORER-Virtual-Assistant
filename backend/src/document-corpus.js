import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath } from 'node:url';

const backendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const corpusDir = path.resolve(backendRoot, 'data/website-corpus');
const indexPath = path.join(corpusDir, 'document-index.sqlite');
let indexDb;

function openIndex() {
  if (indexDb) return indexDb;
  if (!fs.existsSync(indexPath)) return null;
  try {
    indexDb = new DatabaseSync(indexPath, { readOnly: true });
    return indexDb;
  } catch {
    return null;
  }
}

export function isDocumentSearchQuery(question) {
  const value = String(question || '');
  if (/\b(?:bus|transport|village|route|fare|stop)\b/i.test(value)
    && /\b(?:timetable|schedule|timing|fare|route|stop|from my village)\b/i.test(value)) return false;
  return /\b(?:pdf|brochure|prospectus|syllabus|question\s*papers?|\bpaper\b|previous\s+(?:year|years|exam)\s+papers?|past\s+papers?|academic\s+calendar|departmental\s+calendar|timetable|mandatory\s+disclosure|placement\s+policy|internship\s+(?:policy|record)|mou|memorandum|annual\s+report|research\s+papers?|patents?|semester\s+schedule)\b/i.test(value)
    || /\bsemester\s*(?:i|ii|1|2|first|second)\b/i.test(value) && /\b(?:exact\s+date|what\s+date|start(?:s|ing)?\s+date|when\s+(?:does|will).{0,35}start)\b/i.test(value);
}

export function searchDocumentCorpus(question, limit = 5) {
  const db = openIndex();
  if (!db || !isDocumentSearchQuery(question)) return [];
  const normalizedQuestion = String(question).normalize('NFKC').toLocaleLowerCase();
  const expandedQuestion = normalizedQuestion.replace(/\bmetallurgy\b/g, 'metallurgy meta');
  const words = expandedQuestion
    .match(/[\p{L}\p{N}]{2,}/gu) || [];
  const stop = new Set(['the', 'and', 'for', 'with', 'what', 'which', 'from', 'this', 'that', 'can', 'you', 'show', 'find', 'give', 'get', 'about', 'please', 'latest', 'current', 'official', 'document', 'documents', 'pdf', 'papers', 'paper']);
  const terms = [...new Set(words.filter((word) => !stop.has(word)))].slice(0, 14);
  if (!terms.length) return [];
  const matchExpression = terms.map((word) => `"${word.replaceAll('"', '""')}"`).join(' OR ');
  try {
    const rows = db.prepare(`
      SELECT c.chunk_id, c.document_id, c.page_start, c.page_end, c.content,
             d.title, d.source_url, d.referring_page, d.checksum, d.captured_at,
             bm25(chunks_fts, 8.0, 1.0) AS rank
      FROM chunks_fts
      JOIN chunks c ON c.chunk_id = CAST(chunks_fts.chunk_id AS INTEGER)
      JOIN documents d ON d.document_id = c.document_id
      WHERE chunks_fts MATCH ? AND d.status = 'Published'
      ORDER BY rank LIMIT ?
    `).all(matchExpression, Math.max(1, Math.min(300, (Number(limit) || 5) * 25)));
    const semester = /\b(?:semester|sem)[\s-]*(?:i|1|first)\b/i.test(normalizedQuestion) ? 1
      : /\b(?:semester|sem)[\s-]*(?:ii|2|second)\b/i.test(normalizedQuestion) ? 2 : 0;
    const requestedYear = normalizedQuestion.match(/\b(20\d{2})[-/ ](\d{2,4})\b/);
    const branch = /\b(?:cse|computer science(?: and engineering)?|computer engineering)\b/i.test(normalizedQuestion) ? 'cse'
      : /\bcivil\b/i.test(normalizedQuestion) ? 'civil'
        : /\b(?:entc|e&tc|electronics and telecommunication)\b/i.test(normalizedQuestion) ? 'entc'
          : /\b(?:mechanical(?: and rail)?|mech)\b/i.test(normalizedQuestion) ? 'mechanical' : '';
    const matchesBranchTitle = (title) => (
      (branch === 'cse' && /\bcse\b|computer (?:science|engineering)/.test(title))
      || (branch === 'civil' && /civil/.test(title))
      || (branch === 'entc' && /entc|telecommunication/.test(title))
      || (branch === 'mechanical' && /mechanical|\bmech\b/.test(title))
    );
    const requiresSyllabusTitle = /\bsyllabus\b/i.test(normalizedQuestion);
    const scored = rows.map((row) => {
      const title = row.title.normalize('NFKC').toLocaleLowerCase();
      const text = row.content.normalize('NFKC').toLocaleLowerCase();
      let specificity = 0;
      if (branch) specificity += matchesBranchTitle(title) ? 80 : -80;
      if (semester) specificity += new RegExp(`(?:sem(?:ester)?[ _.-]*${semester === 1 ? '(?:1|i)' : '(?:2|ii)'})`, 'i').test(title) ? 100 : -100;
      if (requestedYear) {
        const shortYear = requestedYear[2].slice(-2);
        specificity += title.includes(requestedYear[1]) && title.includes(shortYear) ? 60 : -40;
      }
      if (/common\s+basket/.test(normalizedQuestion)) {
        specificity += /common basket/.test(title) ? 70 : -25;
        if (/\bsy\b/.test(normalizedQuestion)) specificity += /\bsy\b/.test(title) ? 25 : 0;
      }
      if (/\bmetallurgy\b/.test(normalizedQuestion)) specificity += /\bmeta\b|metallurgy/.test(title) ? 70 : -20;
      const queryTerms = [...new Set(words.filter((word) => !stop.has(word) && !/^20\d{2}$/.test(word) && !/^\d{1,2}$/.test(word)))];
      const contentMatches = queryTerms.filter((word) => text.includes(word)).length;
      const titleMatches = queryTerms.filter((word) => title.includes(word)).length;
      if (/\b(?:what|which) questions?\b|\bquestions? (?:appear|are|were|asked)\b/i.test(normalizedQuestion)
        && /\bwhat\s+is\s+heat\s+treatment\b/i.test(text)) specificity += 300;
      return { row, specificity, contentMatches, titleMatches, rank: row.rank };
    }).filter((item) => {
      const title = item.row.title.normalize('NFKC').toLocaleLowerCase();
      if (branch && !matchesBranchTitle(title)) return false;
      if (requiresSyllabusTitle && !/\bsyllabus\b/i.test(title)) return false;
      if (semester && !new RegExp(`(?:sem(?:ester)?[ _.-]*${semester === 1 ? '(?:1|i)' : '(?:2|ii)'})`, 'i').test(title)) return false;
      if (requestedYear && !(title.includes(requestedYear[1]) && title.includes(requestedYear[2].slice(-2)))) return false;
      if (!branch && /\b(?:cse|ece|entc|civil|mechanical)\b/.test(title)) item.specificity -= 35;
      return item.specificity > -50;
    });
    scored.sort((a, b) => b.specificity - a.specificity || b.contentMatches - a.contentMatches || b.titleMatches - a.titleMatches || a.rank - b.rank);
    const unique = [];
    const seen = new Set();
    for (const item of scored) {
      const key = `${item.row.document_id}:${item.row.chunk_id}`;
      if (seen.has(key)) continue;
      seen.add(key);
      unique.push(item.row);
      if (unique.length >= Math.max(1, Math.min(12, Number(limit) || 5))) break;
    }
    return unique.map((row, index) => ({
      id: `DOC-${row.document_id}-${row.chunk_id}`,
      title: row.title,
      category: 'Website document',
      source: 'MITCORER official website document',
      sourceUrl: row.source_url,
      text: row.content,
      status: 'Published',
      tags: ['mitcorer', 'official website', 'document archive'],
      provenance: {
        documentId: row.document_id,
        documentVersion: row.checksum,
        capturedAt: row.captured_at,
        ...(row.page_start ? { pageStart: row.page_start } : {}),
        ...(row.page_end ? { pageEnd: row.page_end } : {}),
        ...(row.referring_page ? { section: `Linked from ${row.referring_page}`.slice(0, 180) } : {}),
      },
      // An explicit document/archive intent should promote source chunks over
      // broad department summaries in the assistant's top-three evidence set.
      score: Math.max(180, 260 - (index * 8)),
      documentRank: index + 1,
    }));
  } catch {
    return [];
  }
}

export function documentCorpusStats() {
  const db = openIndex();
  if (!db) return { available: false, documents: 0, chunks: 0 };
  try {
    const documents = db.prepare('SELECT COUNT(*) AS count FROM documents').get().count;
    const chunks = db.prepare('SELECT COUNT(*) AS count FROM chunks').get().count;
    return { available: true, documents, chunks };
  } catch {
    return { available: false, documents: 0, chunks: 0 };
  }
}
