// Offline lexical baseline; not selected by the production answering pipeline.
import { usableKnowledge } from './provenance.js';
export function lexicalTokens(text) {
  return String(text || '').normalize('NFKC').toLowerCase().match(/[\p{L}\p{M}\p{N}]+/gu) || [];
}

export function createBm25(records, { k1 = 1.2, b = 0.75 } = {}) {
  if (!Number.isFinite(k1) || k1 <= 0 || !Number.isFinite(b) || b < 0 || b > 1) throw new Error('Invalid BM25 parameters');
  const documents = records.filter(usableKnowledge).map(record => {
    const tokens = lexicalTokens([record.title, record.category, ...(record.tags || []), record.text].join(' '));
    const frequencies = new Map();
    for (const token of tokens) frequencies.set(token, (frequencies.get(token) || 0) + 1);
    return { record, length: tokens.length, frequencies };
  });
  const frequency = new Map();
  for (const document of documents) for (const token of document.frequencies.keys()) frequency.set(token, (frequency.get(token) || 0) + 1);
  const averageLength = documents.reduce((sum, document) => sum + document.length, 0) / (documents.length || 1) || 1;
  return question => {
    const query = new Set(lexicalTokens(question));
    return documents.map(({ record, length, frequencies }) => {
      let score = 0;
      for (const term of query) {
        const tf = frequencies.get(term) || 0;
        if (!tf) continue;
        const df = frequency.get(term);
        const idf = Math.log(1 + (documents.length - df + 0.5) / (df + 0.5));
        score += idf * tf * (k1 + 1) / (tf + k1 * (1 - b + b * length / averageLength));
      }
      return { ...record, score };
    }).filter(record => record.score > 0 && usableKnowledge(record)).sort((a, b) => b.score - a.score || a.id.localeCompare(b.id)).slice(0, 3);
  };
}

// Field-aware lexical candidate. Kept separate from createBm25 so evaluation
// can compare the added field boosts against the plain BM25 baseline.
export function createFieldedBm25(records, {
  k1 = 1.2, b = 0.75,
  weights = { title: 2, category: 1.5, tags: 1.8, text: 1 },
} = {}) {
  if (!Number.isFinite(k1) || k1 <= 0 || !Number.isFinite(b) || b < 0 || b > 1) throw new Error('Invalid BM25 parameters');
  const fields = ['title', 'category', 'tags', 'text'];
  if (!weights || fields.some(field => !Number.isFinite(weights[field]) || weights[field] < 0)) throw new Error('Invalid BM25 field weights');
  const documents = records.filter(usableKnowledge).map(record => ({
    record,
    fields: {
      title: String(record.title || ''),
      category: String(record.category || ''),
      tags: Array.isArray(record.tags) ? record.tags.join(' ') : '',
      text: String(record.text || ''),
    },
  }));
  const indexes = Object.fromEntries(fields.map(field => {
    const rows = documents.map(({ record, fields: values }) => {
      const tokens = lexicalTokens(values[field]);
      const frequencies = new Map();
      for (const token of tokens) frequencies.set(token, (frequencies.get(token) || 0) + 1);
      return { id: record.id, length: tokens.length, frequencies };
    });
    const frequency = new Map();
    for (const row of rows) for (const token of row.frequencies.keys()) frequency.set(token, (frequency.get(token) || 0) + 1);
    const averageLength = rows.reduce((sum, row) => sum + row.length, 0) / (rows.length || 1) || 1;
    return [field, { rows, frequency, averageLength }];
  }));
  const byId = new Map(documents.map(item => [item.record.id, item.record]));
  return question => {
    const query = new Set(lexicalTokens(question));
    const scores = new Map([...byId.keys()].map(id => [id, 0]));
    for (const field of fields) {
      const { rows, frequency, averageLength } = indexes[field];
      for (const row of rows) {
        let fieldScore = 0;
        for (const term of query) {
          const tf = row.frequencies.get(term) || 0;
          if (!tf) continue;
          const df = frequency.get(term);
          const idf = Math.log(1 + (rows.length - df + 0.5) / (df + 0.5));
          fieldScore += idf * tf * (k1 + 1) / (tf + k1 * (1 - b + b * row.length / averageLength));
        }
        scores.set(row.id, scores.get(row.id) + fieldScore * weights[field]);
      }
    }
    return [...scores].filter(([, score]) => score > 0)
      .map(([id, score]) => ({ ...byId.get(id), score }))
      .sort((a, b) => b.score - a.score || a.id.localeCompare(b.id)).slice(0, 3);
  };
}
