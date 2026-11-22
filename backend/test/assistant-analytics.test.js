import assert from 'node:assert/strict';
import { mkdtempSync, unlinkSync, rmdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { recordAssistantUsage, assistantUsageReport } from '../src/assistant-analytics.js';
import { understandQuery } from '../src/query-understanding.js';
import { config } from '../src/config.js';
import { closeDb } from '../src/store.js';

test('question categories and outcomes persist across a SQLite reopen and respect the reporting window', () => {
  const directory = mkdtempSync(path.join(tmpdir(), 'mitra-analytics-'));
  const previous = config.databaseFile;
  config.databaseFile = path.join(directory, 'analytics.sqlite');
  const now = Date.parse('2026-11-22T13:00:00Z');
  const record = (question, outcome, time = now) => recordAssistantUsage(understandQuery(question), outcome, time);
  try {
    assert.equal(assistantUsageReport(now).totals.total, 0);
    record('Can I apply for lateral entry?', 'ANSWERED');
    record('How do I join DSE? Contact me at sample@example.test', 'NEEDS_CLARIFICATION');
    record('Where is the exam timetable?', 'INSUFFICIENT_EVIDENCE');
    record('What is the college fee?', 'ANSWERED', now - 30 * 86_400_000);
    closeDb();
    const report = assistantUsageReport(now);
    assert.deepEqual(report.totals, { total: 3, answered: 1, evidenceGap: 1, other: 1 });
    assert.deepEqual(report.questions.map(({ id, total }) => [id, total]), [['lateralEntry', 2], ['examinations', 1]]);
    assert.equal(JSON.stringify(report).includes('sample@example.test'), false);
  } finally {
    closeDb();
    unlinkSync(config.databaseFile);
    rmdirSync(directory);
    config.databaseFile = previous;
  }
});
