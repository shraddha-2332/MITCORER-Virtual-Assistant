import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sandbox = fs.mkdtempSync(path.join(os.tmpdir(), 'mitra-phase-a-validation-'));
for (const part of ['backend', 'frontend']) {
  fs.mkdirSync(path.join(sandbox, part), { recursive: true });
  for (const entry of ['src', 'test', 'scripts', 'evaluation', 'package.json', 'package-lock.json', 'public', 'index.html', 'vite.config.js', '.oxlintrc.json', '.gitignore', 'node_modules']) {
    const source = path.join(root, part, entry);
    if (fs.existsSync(source)) fs.cpSync(source, path.join(sandbox, part, entry), { recursive: true });
  }
}
fs.mkdirSync(path.join(sandbox, 'docs'), { recursive: true });
for (const file of ['audit-confirm.mjs', 'audit-reviewed-expectations.json', 'retrieval-review/corpus.json', 'retrieval-review/development-review.json']) {
  const source = path.join(root, 'docs', file);
  if (fs.existsSync(source)) {
    const target = path.join(sandbox, 'docs', file);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.copyFileSync(source, target);
  }
}
if (fs.existsSync(path.join(root, 'docs/audit-confirm.mjs'))) {
  fs.copyFileSync(path.join(root, 'docs/audit-confirm.mjs'), path.join(sandbox, 'audit-confirm.mjs'));
  const cases = JSON.parse(fs.readFileSync(path.join(root, 'docs/audit-reviewed-expectations.json'))).records;
  fs.writeFileSync(path.join(sandbox, 'audit-cases.json'), JSON.stringify({ cases }));
}
const index = path.join(root, 'backend/data/website-corpus/document-index.sqlite');
if (fs.existsSync(index)) {
  fs.mkdirSync(path.join(sandbox, 'backend/data/website-corpus'), { recursive: true });
  try { fs.copyFileSync(index, path.join(sandbox, 'backend/data/website-corpus/document-index.sqlite')); }
  catch (error) {
    if (error.code !== 'ENOSPC') throw error;
    throw new Error(`Cannot create isolated corpus fixture: temporary storage is full. Clear old ${path.basename(sandbox).replace(/[^a-z-]/gi, '')} validation artifacts or free disk space before retrying.`);
  }
}
console.log(`Disposable validation directory: ${sandbox}`);
const checks = [
  ['backend', ['--no-warnings=ExperimentalWarning', '--test', 'test/maintained-answer-regression.test.js'], 'phase-a'],
  ['backend', ['--no-warnings=ExperimentalWarning', '--test'], 'backend'],
  ['frontend', ['--test', 'test/*.test.mjs'], 'frontend'],
  ['frontend', ['node_modules/vite/bin/vite.js', 'build'], 'build'],
  ['frontend', ['node_modules/oxlint/bin/oxlint'], 'lint'],
  ['backend', ['--no-warnings=ExperimentalWarning', 'scripts/evaluate-public-assistant.js', '--strict'], 'public'],
  ['backend', ['--no-warnings=ExperimentalWarning', 'scripts/evaluate-assistant.js'], 'workflow-500'],
  ['frontend', ['--no-warnings=ExperimentalWarning', 'scripts/verify-phase-a.mjs'], 'browser'],
  ['frontend', ['--no-warnings=ExperimentalWarning', 'scripts/verify-maintainer.mjs'], 'maintainer'],
  ['frontend', ['--no-warnings=ExperimentalWarning', 'scripts/verify-public-session.mjs'], 'session'],
];
if (fs.existsSync(path.join(sandbox, 'audit-confirm.mjs'))) checks.push(['.', ['--no-warnings=ExperimentalWarning', 'audit-confirm.mjs'], 'audit-150']);
const results = [];
for (const [directory, args, name] of checks) {
  const result = spawnSync(process.execPath, args, { cwd: path.join(sandbox, directory), env: { ...process.env, NODE_ENV: name === 'build' ? 'production' : 'test', GEMINI_API_KEY: '', GROQ_API_KEY: '', DATA_FILE: path.join(sandbox, 'no-legacy.json') }, encoding: 'utf8', timeout: 180000, maxBuffer: 20 * 1024 * 1024 });
  fs.writeFileSync(path.join(sandbox, `${name}.log`), (result.stdout || '') + (result.stderr || ''));
  results.push({ name, exitCode: result.status, error: result.error?.message }); console.log(`${name}: exit ${result.status}`);
}
fs.writeFileSync(path.join(sandbox, 'validation.json'), JSON.stringify(results, null, 2));
const evidenceDirectory = path.join(root, 'docs/answer-review/ai-validation');
fs.mkdirSync(evidenceDirectory, { recursive: true });
for (const name of ['validation.json', 'audit-reviewed-results.json', ...checks.map(([, , name]) => `${name}.log`)]) {
  const source = path.join(sandbox, name);
  if (fs.existsSync(source)) fs.copyFileSync(source, path.join(evidenceDirectory, name));
}
if (results.some(r => r.exitCode !== 0)) process.exitCode = 1;
