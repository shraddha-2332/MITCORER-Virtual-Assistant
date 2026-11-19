import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { config } from '../src/config.js';
import { createSeedData } from '../src/seed.js';
import { closeDb, loadDb } from '../src/store.js';
import { answerAdmissionQuestion } from '../src/server.js';
import { supportsMaintainedClaim } from '../src/maintained-claim-support.js';

const programmePage = (record) => record.facts.programs.map(program =>
  `B.Tech in ${program.name} Sanctioned Intake ${program.intake} Seats Choice Code ${program.choiceCode}`).join('\n');
const scholarshipPage = 'Rajarshi Chhatrapati Shahu Maharaj Shikshan Shulkh Shishyavrutti Yojna. Dr. Punjabrao Deshmukh Vastigruh Nirvah Bhatta. OBC, SBC and VJNT Post Matric Scholarship. Persons with disability. Minority. Pragati Scholarship Scheme For Girl Students (Technical Degree).';

test('source support requires every maintained programme claim and scholarship scheme', () => {
  const data = createSeedData();
  const programme = data.knowledge.find(item => item.id === 'KB-10');
  const scholarship = data.knowledge.find(item => item.id === 'KB-18');
  assert.equal(supportsMaintainedClaim(programmePage(programme), programme), true);
  assert.equal(supportsMaintainedClaim(programmePage(programme).replace('120 Seats', '90 Seats'), programme), false);
  assert.equal(supportsMaintainedClaim(scholarshipPage, scholarship), true);
  assert.equal(supportsMaintainedClaim(scholarshipPage.replace('Pragati Scholarship Scheme For Girl Students', ''), scholarship), false);
});

test('supported pill records recover from a staged capture while unsupported hostel claims stay withheld', async () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'mitra-pill-availability-'));
  const previousFile = config.databaseFile;
  closeDb();
  config.databaseFile = path.join(directory, 'test.sqlite');
  try {
    const data = createSeedData();
    for (const id of ['KB-10', 'KB-18', 'KB-23']) {
      const record = data.knowledge.find(item => item.id === id);
      record.status = 'Review';
      record.freshnessReview = { reason: 'source-content-changed', changedSourceUrl: record.sourceUrl };
    }
    for (const [id, text] of [['KB-10', programmePage(data.knowledge.find(item => item.id === 'KB-10'))], ['KB-18', scholarshipPage]]) {
      const record = data.knowledge.find(item => item.id === id);
      data.officialSources.push({ id: `SRC-SYNC-${id}`, sourceUrl: record.sourceUrl, extractedText: text, status: 'Review', syncMeta: { healthStatus: 'available' } });
    }
    const sqlite = new DatabaseSync(config.databaseFile);
    sqlite.exec('CREATE TABLE collections (name TEXT PRIMARY KEY, data TEXT NOT NULL, updated_at TEXT NOT NULL)');
    sqlite.prepare('INSERT INTO collections (name, data, updated_at) VALUES (?, ?, ?)').run('app', JSON.stringify(data), new Date().toISOString());
    sqlite.close();
    const loaded = loadDb();
    assert.equal(loaded.knowledge.find(item => item.id === 'KB-10').status, 'Published');
    assert.equal(loaded.knowledge.find(item => item.id === 'KB-18').status, 'Published');
    assert.equal(loaded.knowledge.find(item => item.id === 'KB-23').status, 'Review');
    for (const [question, pattern] of [
      ['Which B.Tech programmes are available at MITCORER?', /Computer Science and Engineering/],
      ['What scholarships are available at MITCORER and where can I apply?', /Pragati/],
      ['What hostel and mess facilities does MITCORER provide?', /hostel/i],
      ['What MITCORER bus facility information is published?', /bus facility/i],
      ['Tell me about the MITCORER library and digital resources.', /library/i],
      ['What campus facilities are available at MITCORER?', /official MITCORER brochure lists/i],
    ]) {
      const answer = await answerAdmissionQuestion({ question }, null);
      assert.equal(answer.outcomeStatus, 'ANSWERED', question);
      assert.match(answer.answer, pattern, question);
      assert.ok(answer.evidence?.length, question);
    }
  } finally {
    closeDb();
    config.databaseFile = previousFile;
    fs.rmSync(directory, { recursive: true, force: true });
  }
});
