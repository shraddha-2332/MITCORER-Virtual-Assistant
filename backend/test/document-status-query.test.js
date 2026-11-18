import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { config } from '../src/config.js';
import { closeDb, resetDbForTests } from '../src/store.js';
import { createSeedData } from '../src/seed.js';
import { answerAdmissionQuestion, resetRuntimeStateForTests } from '../src/server.js';

test('anonymous multilingual uploaded-document status queries get safe guidance without exposing applicant records', async () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'mitra-document-status-'));
  const previousDatabaseFile = config.databaseFile;
  const previousGeminiApiKey = config.geminiApiKey;
  config.databaseFile = path.join(directory, 'test.sqlite');
  config.geminiApiKey = '';
  const seed = createSeedData();
  seed.documents = [{
    id: 'DOC-PRIVATE-CANARY', ownerEmail: 'another-applicant@example.test',
    docName: 'Private identity document', fileName: 'private.pdf', status: 'Needs correction',
    reviewNote: 'PRIVATE_REVIEW_NOTE_CANARY',
  }];
  resetDbForTests(seed);

  try {
    const dataset = JSON.parse(fs.readFileSync(new URL('../evaluation/mitra-qa-360.json', import.meta.url), 'utf8')).records;
    const queries = ['en', 'mr', 'hi', 'hinglish'].map((language) => {
      const item = dataset.find((record) => record.intent === 'document_status' && record.language === language);
      assert.ok(item, `missing ${language} document-status regression prompt`);
      return [item.question, language === 'hinglish' ? 'auto' : language];
    });
    for (const [question, language] of queries) {
      resetRuntimeStateForTests();
      const response = await answerAdmissionQuestion({ question, language }, null);
      assert.match(response.answer, /private|खाजगी|निजी/i, question);
      assert.doesNotMatch(response.answer, /which category|which concession|first year or direct second year/i, question);
      assert.deepEqual(response.evidence, [], question);
      assert.equal(response.actionView, 'applicantPortal', question);
      const serialized = JSON.stringify(response);
      assert.ok(!serialized.includes('another-applicant@example.test'));
      assert.ok(!serialized.includes('PRIVATE_REVIEW_NOTE_CANARY'));
      assert.ok(!serialized.includes('DOC-PRIVATE-CANARY'));
      assert.ok(response.officialLinks.some((link) => link.url === 'https://mitcorer.edu.in/mitcorer/public/contact-us'));
    }
  } finally {
    closeDb();
    config.databaseFile = previousDatabaseFile;
    config.geminiApiKey = previousGeminiApiKey;
    if (path.dirname(directory) !== path.resolve(os.tmpdir()) || !path.basename(directory).startsWith('mitra-document-status-')) {
      throw new Error('Unsafe cleanup path');
    }
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

test('authenticated document-status answers remain scoped to the requesting account', async () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'mitra-document-status-owner-'));
  const previousDatabaseFile = config.databaseFile;
  const previousGeminiApiKey = config.geminiApiKey;
  config.databaseFile = path.join(directory, 'test.sqlite');
  config.geminiApiKey = '';
  const seed = createSeedData();
  seed.documents = [
    { id: 'DOC-OWN', ownerEmail: 'applicant@example.test', docName: 'Transcript', fileName: 'transcript.pdf', status: 'Submitted for review' },
    { id: 'DOC-OTHER', ownerEmail: 'another-applicant@example.test', docName: 'Identity card', fileName: 'identity.pdf', status: 'Needs correction', reviewNote: 'PRIVATE_REVIEW_NOTE_CANARY' },
  ];
  resetDbForTests(seed);

  try {
    resetRuntimeStateForTests();
    const response = await answerAdmissionQuestion({ question: 'What is my uploaded document review status?', language: 'en' }, {
      id: 'USER-OWN', email: 'applicant@example.test', name: 'Applicant', role: 'applicant',
    });
    assert.match(response.answer, /1 uploaded file: 1 Submitted for review/i);
    assert.ok(!response.answer.includes('Needs correction'));
    assert.ok(!response.answer.includes('PRIVATE_REVIEW_NOTE_CANARY'));
  } finally {
    closeDb();
    config.databaseFile = previousDatabaseFile;
    config.geminiApiKey = previousGeminiApiKey;
    if (path.dirname(directory) !== path.resolve(os.tmpdir()) || !path.basename(directory).startsWith('mitra-document-status-owner-')) {
      throw new Error('Unsafe cleanup path');
    }
    fs.rmSync(directory, { recursive: true, force: true });
  }
});
