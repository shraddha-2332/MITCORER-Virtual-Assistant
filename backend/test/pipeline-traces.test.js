import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { config } from '../src/config.js';
import { resetDbForTests, closeDb } from '../src/store.js';
import { createSeedData } from '../src/seed.js';
import { answerAdmissionQuestion, resetRuntimeStateForTests } from '../src/server.js';

test('assistant pipeline traces identify bounded evidence revisions without logging question or answer text', async () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'mitra-pipeline-trace-'));
  const originalDatabaseFile = config.databaseFile;
  const originalGeminiApiKey = config.geminiApiKey;
  config.databaseFile = path.join(directory, 'test.sqlite');
  config.geminiApiKey = '';
  resetDbForTests(createSeedData());

  const askWithTrace = async (question) => {
    resetRuntimeStateForTests();
    const lines = [];
    const originalLog = console.log;
    console.log = (line) => lines.push(String(line));
    let response;
    try {
      response = await answerAdmissionQuestion({ question, language: 'en' }, null);
    } finally {
      console.log = originalLog;
    }
    const event = lines.map((line) => {
      try { return JSON.parse(line); } catch { return null; }
    }).find((item) => item?.event === 'assistant_pipeline');
    assert.ok(event, 'expected an assistant_pipeline event');
    return { response, event };
  };

  try {
    const question = 'What reading resources are available? TRACE_SECRET_7f42';
    const withEvidence = await askWithTrace(question);
    assert.ok(withEvidence.response.evidence.length > 0);
    const expectedEvidence = withEvidence.response.evidence.slice(0, 5);
    assert.deepEqual(withEvidence.event.evidenceIds, expectedEvidence.map((item) => item.id));
    assert.deepEqual(withEvidence.event.evidenceCitationIds, expectedEvidence.map((item) => item.citationId));
    const serializedEvent = JSON.stringify(withEvidence.event);
    assert.ok(!serializedEvent.includes(question));
    assert.ok(!serializedEvent.includes('TRACE_SECRET_7f42'));
    assert.ok(!serializedEvent.includes(withEvidence.response.answer));

    const questionWithoutEvidence = 'On what exact date does CSE Semester I start in academic year 2026-27?';
    const withoutEvidence = await askWithTrace(questionWithoutEvidence);
    assert.equal(withoutEvidence.response.evidence.length, 0);
    assert.deepEqual(withoutEvidence.event.evidenceIds, []);
    assert.deepEqual(withoutEvidence.event.evidenceCitationIds, []);
    assert.ok(!JSON.stringify(withoutEvidence.event).includes(questionWithoutEvidence));
    assert.ok(!JSON.stringify(withoutEvidence.event).includes(withoutEvidence.response.answer));
  } finally {
    closeDb();
    config.databaseFile = originalDatabaseFile;
    config.geminiApiKey = originalGeminiApiKey;
    if (path.dirname(directory) !== path.resolve(os.tmpdir()) || !path.basename(directory).startsWith('mitra-pipeline-trace-')) throw new Error('Unsafe cleanup path');
    fs.rmSync(directory, { recursive: true, force: true });
  }
});
