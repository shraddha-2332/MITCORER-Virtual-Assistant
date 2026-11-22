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
import { verifyPassword } from '../src/auth.js';

test('office-hours migration replaces the stale absence claim with the supplied admissions-desk schedule', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'mitra-office-hours-migration-'));
  const previousDatabaseFile = config.databaseFile;
  const databaseFile = path.join(directory, 'migration.sqlite');
  closeDb();
  config.databaseFile = databaseFile;
  try {
    const persisted = createSeedData();
    persisted.migrations = [
      'seed-entc-hod-kb52', 'seed-institution-status-kb54-v1', 'seed-admission-quota-and-search-aliases-v1',
      'seed-course-code-discrepancy-kb56-v1', 'seed-placement-committee-kb53', 'refresh-placement-committee-kb53-v2',
      'refresh-placement-current-activities-kb16-kb35-v1', 'map-seeded-records-to-current-official-routes-v1',
      'normalize-dse-choice-codes-v1', 'quarantine-unverified-office-hours-kb46-v1',
      'publish-dated-office-hours-observation-kb46-v2',
    ];
    const record = persisted.knowledge.find((item) => item.id === 'KB-46');
    record.text = 'Hours: 9:30 AM to 5:30 PM';
    record.revision = 4;
    record.status = 'Published';
    const library = persisted.knowledge.find((item) => item.id === 'KB-20');
    library.text = 'The public FAQ does not publish borrowing rules, timings, or access eligibility.';
    const contact = persisted.knowledge.find((item) => item.id === 'KB-17');
    contact.text = 'MITCORER, Industrial Estate No. 03, Barshi, Dist. Solapur, Maharashtra 413401.\n\nEmail: info.mitcorer@mitpune.edu.in.\n\nPhone: +91 84599 67882, +91 86696 62106.\n\nWebsite: https://mitcorer.edu.in/.';
    const transit = persisted.knowledge.find((item) => item.id === 'KB-40');
    transit.text = `MITCORER campus location and locally published transit directions:\n\n- Campus address: Industrial Estate No. 03, Barshi, Dist. Solapur, Maharashtra - 413401.\n- Barshi Town railway station: 4.7 km from campus via Bhosale Chowk, Cancer Chowk, and Industrial Road.\n- MSRTC Bus Stand Barshi: 5.7 km from campus; Route-I is via Cancer Chowk and Industrial Road, and Route-II is via Bypass, Agalgaon Chowk, Shukla Automobile, and Industrial Road.\n- The contact page does not publish the distance or route from Solapur city, or a college bus route from Solapur. Confirm current travel details with the college.`;
    const sqlite = new DatabaseSync(databaseFile);
    sqlite.exec('CREATE TABLE collections (name TEXT PRIMARY KEY, data TEXT NOT NULL, updated_at TEXT NOT NULL)');
    sqlite.prepare('INSERT INTO collections (name, data, updated_at) VALUES (?, ?, ?)').run('app', JSON.stringify(persisted), new Date().toISOString());
    sqlite.close();

    const migrated = loadDb();
    const current = migrated.knowledge.find((item) => item.id === 'KB-46');
    assert.equal(current.status, 'Published');
    assert.equal(current.revision, 5);
    assert.match(current.text, /Monday–Saturday, 9:00 AM–5:00 PM/);
    assert.match(current.text, /Admission Helpline as \+91 91584 14343 and College Office as \+91 91584 14444/i);
    assert.doesNotMatch(current.text, /\+91 86696 11211/);
    assert.match(current.text, /not a confirmed schedule for all administrative offices or campus visits/i);
    assert.doesNotMatch(current.text, /9:30 AM to 5:30 PM/);
    assert.equal(current.provenance.capturedAt, '2026-11-19');
    assert.ok(migrated.migrations.includes('publish-admissions-desk-hours-kb46-v4'));
    const currentLibrary = migrated.knowledge.find((item) => item.id === 'KB-20');
    assert.equal(currentLibrary.sourceUrl, 'https://mitcorer.edu.in/library.php');
    assert.match(currentLibrary.text, /identity card is compulsory for library access/i);
    assert.doesNotMatch(currentLibrary.text, /does not publish borrowing rules/i);
    assert.ok(migrated.migrations.includes('refresh-library-rules-source-kb20-v2'));
    const currentContact = migrated.knowledge.find((item) => item.id === 'KB-17');
    assert.equal(currentContact.sourceUrl, 'https://mitcorer.edu.in/mitcorer/public/contact-us');
    assert.match(currentContact.text, /Admission Helpline: \+91 91584 14343/);
    assert.match(currentContact.text, /College Office: \+91 91584 14444/);
    assert.match(currentContact.text, /principal\.mitcorer@mitpune\.edu\.in/);
    const currentTransit = migrated.knowledge.find((item) => item.id === 'KB-40');
    assert.equal(currentTransit.sourceUrl, 'https://mitcorer.edu.in/mitcorer/public/contact-us');
    assert.match(currentTransit.text, /Kurduvadi Junction, Solapur, Latur, and Mumbai/);
    assert.match(currentTransit.text, /local station\/bus-stand distances that conflict with the newer page's proximity description/i);
    assert.doesNotMatch(currentTransit.text, /4\.7 km/);
    assert.ok(migrated.migrations.includes('refresh-contact-and-transit-page-kb17-kb40-v2'));
  } finally {
    closeDb();
    config.databaseFile = previousDatabaseFile;
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

test('reviewed current programme and scholarship sources restore public suggestion answers safely', async () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'mitra-suggestion-source-migration-'));
  const previousDatabaseFile = config.databaseFile;
  const previousGeminiApiKey = config.geminiApiKey;
  const databaseFile = path.join(directory, 'migration.sqlite');
  closeDb();
  config.databaseFile = databaseFile;
  config.geminiApiKey = '';
  try {
    const persisted = createSeedData();
    persisted.migrations = [
      'seed-entc-hod-kb52', 'seed-placement-committee-kb53', 'seed-institution-status-kb54-v1',
      'seed-admission-quota-and-search-aliases-v1', 'seed-course-code-discrepancy-kb56-v1',
      'refresh-placement-committee-kb53-v2', 'map-seeded-records-to-current-official-routes-v1',
      'normalize-dse-choice-codes-v1', 'canonicalize-official-sources-v1', 'refresh-placement-current-activities-kb16-kb35-v1',
      'quarantine-unverified-office-hours-kb46-v1', 'canonicalize-official-sources-v2', 'publish-dated-office-hours-observation-kb46-v2',
    ];
    const btech = persisted.knowledge.find((item) => item.id === 'KB-10');
    btech.status = 'Review';
    btech.freshnessReview = { reason: 'numeric-claim-removed', changedSourceUrl: btech.sourceUrl };
    const diploma = persisted.knowledge.find((item) => item.id === 'KB-12');
    diploma.status = 'Review';
    diploma.text = 'MITCORER Polytechnic branches offered (Sanctioned Intake: 60 each, Total 240 seats).';
    diploma.sourceUrl = 'https://mitcorer.edu.in/mitcorer/public/department/polytechnic';
    diploma.freshnessReview = { reason: 'source-unavailable', changedSourceUrl: diploma.sourceUrl };
    const placement = persisted.knowledge.find((item) => item.id === 'KB-16');
    placement.text = 'MITCORER Training and Placement Cell coordinates activities. According to information supplied for this project, student activities are shared through POD, Superset, and Unstop.';
    const scholarship = persisted.knowledge.find((item) => item.id === 'KB-18');
    scholarship.status = 'Review';
    scholarship.text = 'MITCORER lists EBC Concession: 50% tuition and AICTE Pragati scholarship (₹50,000/year).';
    scholarship.freshnessReview = { reason: 'numeric-claim-removed', changedSourceUrl: scholarship.sourceUrl };
    const pragati = persisted.knowledge.find((item) => item.id === 'KB-33');
    pragati.status = 'Review';
    pragati.freshnessReview = { reason: 'source-unavailable', changedSourceUrl: pragati.sourceUrl };
    persisted.officialSources.push(
      { id: 'SRC-SYNC-ADMISSIONS', sourceUrl: 'https://mitcorer.edu.in/mitcorer/public/admissions', status: 'Review',
        extractedText: 'Programs Offered: B.Tech in Artificial Intelligence & Data Science; Civil Engineering; Computer Science & Engineering; Electronics & Computer Engineering; Electronics & Telecommunication Engineering; Mechanical & Rail Engineering.' },
      { id: 'SRC-SYNC-SCHOLARSHIP', sourceUrl: 'https://mitcorer.edu.in/mitcorer/public/admissions/scholarship', status: 'Review',
        extractedText: 'Rajarshi Chhatrapati Shahu Maharaj Shikshan Shulkh Shishyavrutti Yojna (EBC). National Level Scholarship Scheme: Pragati Scholarship Scheme For Girl Students (Technical Degree).' },
    );
    const sqlite = new DatabaseSync(databaseFile);
    sqlite.exec('CREATE TABLE collections (name TEXT PRIMARY KEY, data TEXT NOT NULL, updated_at TEXT NOT NULL)');
    sqlite.prepare('INSERT INTO collections (name, data, updated_at) VALUES (?, ?, ?)').run('app', JSON.stringify(persisted), new Date().toISOString());
    sqlite.close();

    const migrated = loadDb();
    for (const id of ['KB-10', 'KB-12', 'KB-18']) {
      const record = migrated.knowledge.find((item) => item.id === id);
      assert.equal(record.status, 'Published', `${id} should be restored from the reviewed current official source`);
      assert.equal(record.freshnessReview, undefined);
    }
    assert.equal(migrated.officialSources.find((item) => item.id === 'SRC-7').sourceUrl,
      'https://mitcorer.edu.in/Diploma-Admissions-Open-2026-27.html');

    const ask = async (question) => answerAdmissionQuestion({ question }, null);
    const btechAnswer = await ask('Which B.Tech programmes are available at MITCORER?');
    assert.equal(btechAnswer.outcomeStatus, 'ANSWERED');
    assert.deepEqual(btechAnswer.evidence.map((record) => record.id), ['KB-10']);

    const diplomaAnswer = await ask('Which Polytechnic diploma programmes are available at MITCORER?');
    assert.equal(diplomaAnswer.outcomeStatus, 'ANSWERED');
    assert.match(diplomaAnswer.answer, /Civil Engineering.*Mechanical Engineering.*Electronics & Telecommunication.*Computer Science & Engineering/s);
    assert.doesNotMatch(diplomaAnswer.answer, /60 each|240 seats/);
    assert.deepEqual(diplomaAnswer.evidence.map((record) => record.id), ['KB-12']);

    const recruiterAnswer = await ask('List the companies which visit MITCORER for recruitment.');
    assert.equal(recruiterAnswer.outcomeStatus, 'ANSWERED');
    assert.deepEqual(recruiterAnswer.evidence.map((record) => record.id), ['KB-16']);
    assert.match(recruiterAnswer.answer, /AY 2024-25/);
    assert.match(recruiterAnswer.answer, /JUSPAY/);
    assert.match(recruiterAnswer.answer, /Cognizant/);
    assert.doesNotMatch(recruiterAnswer.answer, /POD, Superset, and Unstop/);
    for (const question of [
      'What scholarships are available at MITCORER and where can I apply?',
      'Where do I apply for MITCORER MahaDBT scholarship schemes?',
      'What should I check before applying for a MITCORER scholarship?',
      'Tell me about the AICTE Pragati scholarship for girl students and where to apply.',
    ]) {
      const answer = await ask(question);
      assert.equal(answer.outcomeStatus, 'ANSWERED', question);
      assert.deepEqual(answer.evidence.map((record) => record.id), [question.includes('AICTE Pragati') ? 'KB-33' : 'KB-18'], question);
      assert.match(answer.answer, /MahaDBT|NSP|Pragati/i, question);
    }
  } finally {
    closeDb();
    config.databaseFile = previousDatabaseFile;
    config.geminiApiKey = previousGeminiApiKey;
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

test('administrator-confirmed biometric text stays published and stale unreachable placeholder is removed', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'mitra-biometric-confirmation-migration-'));
  const previousDatabaseFile = config.databaseFile;
  const databaseFile = path.join(directory, 'migration.sqlite');
  closeDb();
  config.databaseFile = databaseFile;
  try {
    const persisted = createSeedData();
    persisted.migrations = [
      'seed-entc-hod-kb52', 'seed-institution-status-kb54-v1', 'seed-admission-quota-and-search-aliases-v1',
      'seed-course-code-discrepancy-kb56-v1', 'seed-placement-committee-kb53', 'refresh-placement-committee-kb53-v2',
      'refresh-placement-current-activities-kb16-kb35-v1', 'map-seeded-records-to-current-official-routes-v1',
      'normalize-dse-choice-codes-v1', 'canonicalize-official-sources-v1', 'canonicalize-official-sources-v2',
      'review-and-refresh-public-suggestion-sources-v1', 'import-official-site-crawl-gap-records-2026-11-18-v1',
      'deduplicate-hostel-crawl-source-2026-11-18-v1', 'restore-supported-pill-claims-v7',
      'recover-verified-source-records-v9', 'repair-current-scholarship-source-v10', 'normalize-scholarship-source-title-v11',
      'format-maintained-college-profile-v12', 'seed-project-owner-placement-platforms-kb69-v1',
      'seed-ai-reviewed-knowledge-translations-mr-hi-v1', 'import-official-faculty-profile-captures-v13',
    ];
    const record = persisted.knowledge.find(item => item.id === 'KB-32');
    record.status = 'Archived';
    record.freshnessReview = { reason: 'source-unavailable', changedSourceUrl: record.sourceUrl };
    const source = persisted.officialSources.find(item => item.id === 'SRC-11');
    source.status = 'Archived';
    persisted.officialSources.push({ id: 'SRC-UNREACHABLE', title: 'Unavailable source', sourceUrl: 'https://mitcorer.edu.in/removed.php', status: 'Review' });

    const sqlite = new DatabaseSync(databaseFile);
    sqlite.exec('CREATE TABLE collections (name TEXT PRIMARY KEY, data TEXT NOT NULL, updated_at TEXT NOT NULL)');
    sqlite.prepare('INSERT INTO collections (name, data, updated_at) VALUES (?, ?, ?)').run('app', JSON.stringify(persisted), new Date().toISOString());
    sqlite.close();

    const migrated = loadDb();
    const restoredRecord = migrated.knowledge.find(item => item.id === 'KB-32');
    const restoredSource = migrated.officialSources.find(item => item.id === 'SRC-11');
    assert.equal(restoredRecord.status, 'Published');
    assert.equal(restoredRecord.freshnessReview, undefined);
    assert.ok(restoredRecord.translations.mr.text);
    assert.ok(restoredRecord.translations.hi.text);
    assert.equal(restoredSource.status, 'Published');
    assert.match(restoredSource.extractionStatus, /administrator reviewed and confirmed/i);
    assert.equal(migrated.officialSources.some(item => item.id === 'SRC-UNREACHABLE'), false);
    assert.ok(migrated.migrations.includes('publish-owner-confirmed-biometric-record-v14'));
  } finally {
    closeDb();
    config.databaseFile = previousDatabaseFile;
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

for (const nodeEnv of ['development', 'production']) {
  test(`configured ${nodeEnv} admin password updates the persisted hash and revokes old sessions`, () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'mitra-admin-credentials-migration-'));
    const previousDatabaseFile = config.databaseFile;
    const previousNodeEnv = config.nodeEnv;
    const previousEmail = process.env.ADMIN_EMAIL;
    const previousPassword = process.env.ADMIN_PASSWORD;
    const databaseFile = path.join(directory, 'migration.sqlite');
    closeDb();
    config.databaseFile = databaseFile;
    try {
      const persisted = createSeedData();
      persisted.refreshTokens.push({ id: 'RT-ADMIN-TEST', userId: 'USR-ADM', revoked: false });
      const sqlite = new DatabaseSync(databaseFile);
      sqlite.exec('CREATE TABLE collections (name TEXT PRIMARY KEY, data TEXT NOT NULL, updated_at TEXT NOT NULL)');
      sqlite.prepare('INSERT INTO collections (name, data, updated_at) VALUES (?, ?, ?)').run('app', JSON.stringify(persisted), new Date().toISOString());
      sqlite.close();

      config.nodeEnv = nodeEnv;
      process.env.ADMIN_EMAIL = 'admin@mitcorer.edu.in';
      process.env.ADMIN_PASSWORD = 'TestPass@2026!Secure';
      const migrated = loadDb();
      const admin = migrated.users.find(item => item.email === 'admin@mitcorer.edu.in');
      assert.equal(verifyPassword(process.env.ADMIN_PASSWORD, admin.passwordHash), true);
      assert.equal(migrated.refreshTokens.find(item => item.id === 'RT-ADMIN-TEST').revoked, true);
    } finally {
      closeDb();
      config.databaseFile = previousDatabaseFile;
      config.nodeEnv = previousNodeEnv;
      if (previousEmail === undefined) delete process.env.ADMIN_EMAIL; else process.env.ADMIN_EMAIL = previousEmail;
      if (previousPassword === undefined) delete process.env.ADMIN_PASSWORD; else process.env.ADMIN_PASSWORD = previousPassword;
      fs.rmSync(directory, { recursive: true, force: true });
    }
  });
}

test('placement committee migration repairs stale persisted TPO record without changing its status', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'mitra-placement-migration-'));
  const previousDatabaseFile = config.databaseFile;
  const databaseFile = path.join(directory, 'migration.sqlite');
  closeDb();
  config.databaseFile = databaseFile;
  try {
    const persisted = createSeedData();
    persisted.migrations = persisted.migrations || [];
    persisted.migrations.push('seed-entc-hod-kb52', 'seed-placement-committee-kb53');
    const stale = persisted.knowledge.find((record) => record.id === 'KB-53');
    stale.text = 'MITCORER has a Training and Placement Cell. Contact the college for details.';
    stale.sourceUrl = 'https://mitcorer.edu.in/faq.php';
    stale.revision = 7;

    const sqlite = new DatabaseSync(databaseFile);
    sqlite.exec('CREATE TABLE collections (name TEXT PRIMARY KEY, data TEXT NOT NULL, updated_at TEXT NOT NULL)');
    sqlite.prepare('INSERT INTO collections (name, data, updated_at) VALUES (?, ?, ?)').run('app', JSON.stringify(persisted), new Date().toISOString());
    sqlite.close();

    const migrated = loadDb();
    const record = migrated.knowledge.find((item) => item.id === 'KB-53');
    assert.match(record.text, /Dr\. Sachin Khomane as Training and Placement Officer/);
    assert.equal(record.sourceUrl, 'https://mitcorer.edu.in/mitcorer/public/placement/committee');
    assert.equal(record.revision, 8);
    assert.equal(record.status, 'Published');
    assert.ok(migrated.migrations.includes('refresh-placement-committee-kb53-v2'));
  } finally {
    closeDb();
    config.databaseFile = previousDatabaseFile;
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

test('institution status migration adds KB-54 once to an existing database', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'mitra-institution-status-migration-'));
  const previousDatabaseFile = config.databaseFile;
  const databaseFile = path.join(directory, 'migration.sqlite');
  closeDb();
  config.databaseFile = databaseFile;
  try {
    const persisted = createSeedData();
    persisted.knowledge = persisted.knowledge.filter((record) => record.id !== 'KB-54');
    const sqlite = new DatabaseSync(databaseFile);
    sqlite.exec('CREATE TABLE collections (name TEXT PRIMARY KEY, data TEXT NOT NULL, updated_at TEXT NOT NULL)');
    sqlite.prepare('INSERT INTO collections (name, data, updated_at) VALUES (?, ?, ?)').run('app', JSON.stringify(persisted), new Date().toISOString());
    sqlite.close();

    const migrated = loadDb();
    assert.equal(migrated.knowledge.filter((record) => record.id === 'KB-54').length, 1);
    assert.ok(migrated.migrations.includes('seed-institution-status-kb54-v1'));
  } finally {
    closeDb();
    config.databaseFile = previousDatabaseFile;
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

test('institution status migration does not restore a deliberately deleted record after its marker exists', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'mitra-institution-status-deletion-'));
  const previousDatabaseFile = config.databaseFile;
  const databaseFile = path.join(directory, 'migration.sqlite');
  closeDb();
  config.databaseFile = databaseFile;
  try {
    const persisted = createSeedData();
    persisted.migrations = [...(persisted.migrations || []), 'seed-institution-status-kb54-v1'];
    persisted.knowledge = persisted.knowledge.filter((record) => record.id !== 'KB-54');
    const sqlite = new DatabaseSync(databaseFile);
    sqlite.exec('CREATE TABLE collections (name TEXT PRIMARY KEY, data TEXT NOT NULL, updated_at TEXT NOT NULL)');
    sqlite.prepare('INSERT INTO collections (name, data, updated_at) VALUES (?, ?, ?)').run('app', JSON.stringify(persisted), new Date().toISOString());
    sqlite.close();
    assert.ok(!loadDb().knowledge.some((record) => record.id === 'KB-54'));
  } finally {
    closeDb();
    config.databaseFile = previousDatabaseFile;
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

test('admission quota and search migration adds KB-55 and only appends missing aliases', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'mitra-admission-quota-migration-'));
  const previousDatabaseFile = config.databaseFile;
  const databaseFile = path.join(directory, 'migration.sqlite');
  closeDb();
  config.databaseFile = databaseFile;
  try {
    const persisted = createSeedData();
    persisted.knowledge = persisted.knowledge.filter((record) => !['KB-55', 'KB-56'].includes(record.id));
    const programmes = persisted.knowledge.find((record) => record.id === 'KB-10');
    programmes.tags = ['admin-maintained custom alias'];
    programmes.text = 'Keep this maintained programme text.';
    const sqlite = new DatabaseSync(databaseFile);
    sqlite.exec('CREATE TABLE collections (name TEXT PRIMARY KEY, data TEXT NOT NULL, updated_at TEXT NOT NULL)');
    sqlite.prepare('INSERT INTO collections (name, data, updated_at) VALUES (?, ?, ?)').run('app', JSON.stringify(persisted), new Date().toISOString());
    sqlite.close();

    const migrated = loadDb();
    const record = migrated.knowledge.find((item) => item.id === 'KB-10');
    assert.equal(record.text, 'Keep this maintained programme text.');
    assert.ok(record.tags.includes('admin-maintained custom alias'));
    assert.ok(record.tags.includes('MITCORER B.Tech courses'));
    assert.ok(migrated.knowledge.some((item) => item.id === 'KB-55'));
    assert.ok(migrated.knowledge.some((item) => item.id === 'KB-56'));
    assert.ok(migrated.migrations.includes('seed-admission-quota-and-search-aliases-v1'));
  } finally {
    closeDb();
    config.databaseFile = previousDatabaseFile;
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

test('placement migration does not restore an intentionally removed record after the original migration ran', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'mitra-placement-deletion-'));
  const previousDatabaseFile = config.databaseFile;
  const databaseFile = path.join(directory, 'migration.sqlite');
  closeDb();
  config.databaseFile = databaseFile;
  try {
    const persisted = createSeedData();
    persisted.migrations = ['seed-entc-hod-kb52', 'seed-placement-committee-kb53'];
    persisted.knowledge = persisted.knowledge.filter((record) => record.id !== 'KB-53');
    const sqlite = new DatabaseSync(databaseFile);
    sqlite.exec('CREATE TABLE collections (name TEXT PRIMARY KEY, data TEXT NOT NULL, updated_at TEXT NOT NULL)');
    sqlite.prepare('INSERT INTO collections (name, data, updated_at) VALUES (?, ?, ?)').run('app', JSON.stringify(persisted), new Date().toISOString());
    sqlite.close();
    assert.ok(!loadDb().knowledge.some((record) => record.id === 'KB-53'));
  } finally {
    closeDb();
    config.databaseFile = previousDatabaseFile;
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

test('official-route migration changes only known stale URLs and preserves edits, status, and deletions', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'mitra-route-migration-'));
  const previousDatabaseFile = config.databaseFile;
  const databaseFile = path.join(directory, 'migration.sqlite');
  closeDb();
  config.databaseFile = databaseFile;
  try {
    const persisted = createSeedData();
    persisted.migrations = ['seed-entc-hod-kb52', 'seed-placement-committee-kb53', 'refresh-placement-committee-kb53-v2'];
    const documents = persisted.knowledge.find((record) => record.id === 'KB-13');
    documents.text = 'Admin-reviewed document checklist text.';
    documents.status = 'Review';
    documents.sourceUrl = 'https://mitcorer.edu.in/faq.php';
    const dse = persisted.knowledge.find((record) => record.id === 'KB-11');
    dse.text = dse.text.replace('0690119110', '690119110').replace('0690124210', '690124210').replace('0690184410', '690184410').replace('0690137210', '690137210').replace('0690161210', '690161210');
    persisted.knowledge = persisted.knowledge.filter((record) => record.id !== 'KB-23');
    const sqlite = new DatabaseSync(databaseFile);
    sqlite.exec('CREATE TABLE collections (name TEXT PRIMARY KEY, data TEXT NOT NULL, updated_at TEXT NOT NULL)');
    sqlite.prepare('INSERT INTO collections (name, data, updated_at) VALUES (?, ?, ?)').run('app', JSON.stringify(persisted), new Date().toISOString());
    sqlite.close();

    const migrated = loadDb();
    const record = migrated.knowledge.find((item) => item.id === 'KB-13');
    assert.equal(record.sourceUrl, 'https://mitcorer.edu.in/mitcorer/public/admissions/faqs');
    assert.equal(record.text, 'Admin-reviewed document checklist text.');
    assert.equal(record.status, 'Review');
    assert.equal(record.revision, 1);
    assert.match(migrated.knowledge.find((item) => item.id === 'KB-11').text, /Computer Science and Engineering 0690124210/);
    assert.equal(migrated.knowledge.find((item) => item.id === 'KB-11').revision, 2);
    assert.ok(!migrated.knowledge.some((item) => item.id === 'KB-23'));
    assert.ok(migrated.migrations.includes('map-seeded-records-to-current-official-routes-v1'));
  } finally {
    closeDb();
    config.databaseFile = previousDatabaseFile;
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

test('live admission document link migration repairs only unchanged published document records', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'mitra-live-document-links-'));
  const previousDatabaseFile = config.databaseFile;
  const databaseFile = path.join(directory, 'migration.sqlite');
  closeDb();
  config.databaseFile = databaseFile;
  try {
    const persisted = createSeedData();
    persisted.migrations = ['map-seeded-records-to-current-official-routes-v1'];
    const staleUrl = 'https://mitcorer.edu.in/mitcorer/public/admissions/documents';
    for (const id of ['KB-1', 'KB-26', 'KB-27']) {
      const record = persisted.knowledge.find(item => item.id === id);
      record.sourceUrl = staleUrl;
      record.revision = 3;
    }
    const custom = persisted.knowledge.find(item => item.id === 'KB-28');
    custom.sourceUrl = 'https://example.test/custom-maintainer-link';
    const sqlite = new DatabaseSync(databaseFile);
    sqlite.exec('CREATE TABLE collections (name TEXT PRIMARY KEY, data TEXT NOT NULL, updated_at TEXT NOT NULL)');
    sqlite.prepare('INSERT INTO collections (name, data, updated_at) VALUES (?, ?, ?)').run('app', JSON.stringify(persisted), new Date().toISOString());
    sqlite.close();

    const migrated = loadDb();
    for (const id of ['KB-1', 'KB-26', 'KB-27']) {
      const record = migrated.knowledge.find(item => item.id === id);
      assert.equal(record.sourceUrl, 'https://mitcorer.edu.in/fy-btech-documents.php');
      assert.equal(record.revision, 4);
      assert.equal(record.status, 'Published');
    }
    assert.equal(migrated.knowledge.find(item => item.id === 'KB-28').sourceUrl, 'https://example.test/custom-maintainer-link');
    assert.ok(migrated.migrations.includes('repair-live-admission-document-links-v1'));
  } finally {
    closeDb();
    config.databaseFile = previousDatabaseFile;
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

test('current scholarship source migration restores the live official URL and retires the stale intake claim', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'mitra-scholarship-source-migration-'));
  const previousDatabaseFile = config.databaseFile;
  const databaseFile = path.join(directory, 'migration.sqlite');
  closeDb();
  config.databaseFile = databaseFile;
  try {
    const persisted = createSeedData();
    persisted.migrations = ['recover-verified-source-records-v9'];
    const staleSource = persisted.officialSources.find(item => item.id === 'SRC-20');
    staleSource.status = 'Review';
    staleSource.sourceUrl = 'https://mitcorer.edu.in/mitcorer/public/admissions/scholarship';
    const obsoleteClaim = persisted.knowledge.find(item => item.id === 'KB-66');
    obsoleteClaim.text = 'Stale programme count discrepancy requiring review.';
    const sqlite = new DatabaseSync(databaseFile);
    sqlite.exec('CREATE TABLE collections (name TEXT PRIMARY KEY, data TEXT NOT NULL, updated_at TEXT NOT NULL)');
    sqlite.prepare('INSERT INTO collections (name, data, updated_at) VALUES (?, ?, ?)').run('app', JSON.stringify(persisted), new Date().toISOString());
    sqlite.close();

    const migrated = loadDb();
    const source = migrated.officialSources.find(item => item.id === 'SRC-20');
    assert.equal(source.status, 'Published');
    assert.equal(source.sourceUrl, 'https://www.mitcorer.edu.in/scholarship.php');
    assert.match(source.extractedText, /AICTE Pragati Scholarship Scheme/);
    assert.equal(source.syncMeta.healthStatus, 'available');
    const knowledge = migrated.knowledge.find(item => item.id === 'KB-66');
    assert.equal(knowledge.status, 'Published');
    assert.match(knowledge.text, /does not establish B\.Tech programme counts/);
    assert.doesNotMatch(knowledge.text, /360 Sanctioned Seats/);
    assert.ok(migrated.migrations.includes('repair-current-scholarship-source-v10'));
  } finally {
    closeDb();
    config.databaseFile = previousDatabaseFile;
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

test('reported answer migration removes internal attribution, restores platform guidance, and adds dated placement highlights', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'mitra-answer-gaps-migration-'));
  const previousDatabaseFile = config.databaseFile;
  const databaseFile = path.join(directory, 'migration.sqlite');
  closeDb();
  config.databaseFile = databaseFile;
  try {
    const persisted = createSeedData();
    persisted.migrations = ['seed-project-owner-placement-platforms-kb69-v1'];
    const contact = persisted.knowledge.find(item => item.id === 'KB-46');
    contact.text = 'Hours reported in excerpt supplied by project owner.';
    contact.provenance.note = 'Project owner supplied this excerpt.';
    const transit = persisted.knowledge.find(item => item.id === 'KB-40');
    transit.source = 'Owner-supplied contact excerpt';
    const placement = persisted.knowledge.find(item => item.id === 'KB-24');
    placement.tags = placement.tags.filter(tag => !/internship platforms/i.test(tag));
    persisted.knowledge = persisted.knowledge.filter(item => item.id !== 'KB-70');
    const sqlite = new DatabaseSync(databaseFile);
    sqlite.exec('CREATE TABLE collections (name TEXT PRIMARY KEY, data TEXT NOT NULL, updated_at TEXT NOT NULL)');
    sqlite.prepare('INSERT INTO collections (name, data, updated_at) VALUES (?, ?, ?)').run('app', JSON.stringify(persisted), new Date().toISOString());
    sqlite.close();

    const migrated = loadDb();
    const currentContact = migrated.knowledge.find(item => item.id === 'KB-46');
    assert.doesNotMatch(JSON.stringify(currentContact), /project owner|supplied excerpt|owner-supplied/i);
    assert.match(currentContact.text, /Monday[â€“–-]Saturday, 9:00 AM/);
    assert.equal(migrated.knowledge.find(item => item.id === 'KB-40').source, createSeedData().knowledge.find(item => item.id === 'KB-40').source);
    assert.ok(migrated.knowledge.find(item => item.id === 'KB-24').tags.includes('internship platforms'));
    assert.ok(migrated.knowledge.some(item => item.id === 'KB-70'));
    assert.ok(migrated.migrations.includes('fix-reported-answer-routing-and-attribution-v1'));
  } finally {
    closeDb();
    config.databaseFile = previousDatabaseFile;
    fs.rmSync(directory, { recursive: true, force: true });
  }
});
