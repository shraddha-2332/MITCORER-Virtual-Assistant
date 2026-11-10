import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { config } from '../src/config.js';
import { resetDbForTests, closeDb } from '../src/store.js';
import { createSeedData } from '../src/seed.js';
import { answerAdmissionQuestion, resetRuntimeStateForTests } from '../src/server.js';

test('sources follow answer topics and unsupported routes never use engineering fees', async () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'mitra-source-test-'));
  config.databaseFile = path.join(directory, 'test.sqlite');
  config.geminiApiKey = '';
  resetDbForTests(createSeedData());
  const ask = async question => { resetRuntimeStateForTests(); return answerAdmissionQuestion({ question }, null); };
  try {
    assert.equal((await ask('Tell me about the library.')).sourceUrl, 'https://mitcorer.edu.in/mitcorer/public/infrastructure');
    assert.equal((await ask('What is the railway model room?')).evidence[0].id, 'KB-42');
    const placement = await ask('Who are the recruiters?');
    assert.ok(placement.officialLinks.some(link => link.url.endsWith('/placements')));
    assert.ok(placement.officialLinks.some(link => link.url.endsWith('/placement/ourrecruiters')));
    assert.ok(!placement.officialLinks.some(link => link.url.includes('youtube')));
    const fees = await ask('What are DSE fees?');
    assert.ok(!fees.officialLinks.some(link => link.url.includes('FRA_Fee')));
    const diploma = await ask('What are Polytechnic fees?');
    assert.equal(diploma.evidence.length, 0);
    assert.doesNotMatch(diploma.answer, /1,05,000/);
    const bus = await ask('What bus routes and fees are available?');
    assert.deepEqual(bus.evidence.map(record => record.id), ['KB-19']);
    assert.doesNotMatch(bus.answer, /1,05,000/);
    const docs = await ask('What documents are required for First Year admission?');
    assert.equal(docs.sourceUrl, 'https://mitcorer.edu.in/mitcorer/public/admissions/documents');
    assert.deepEqual(docs.evidence.map(record => record.id), ['KB-1']);
    const acap = await ask('Can a non-CAP student get a scholarship?');
    assert.ok(!acap.officialLinks.some(link => link.url.includes('fe2026')));
    for (const question of ['What are DSE fees for AY 2030-31?', 'What are Polytechnic fees for AY 2025-26?']) {
      const result = await ask(question);
      assert.ok(!result.officialLinks.some(link => /dse2026|poly26|fe2026/.test(link.url)));
    }
    for (const answer of [placement, fees, docs, acap]) {
      const urls = answer.officialLinks.map(link => link.url);
      assert.equal(new Set(urls).size, urls.length);
    }
  } finally {
    closeDb();
    if (path.dirname(directory) !== path.resolve(os.tmpdir()) || !path.basename(directory).startsWith('mitra-source-test-')) throw new Error('Unsafe cleanup path');
    fs.rmSync(directory, { recursive: true, force: true });
  }
});
