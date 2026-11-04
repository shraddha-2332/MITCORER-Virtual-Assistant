import assert from 'node:assert/strict';
import { beforeEach, test } from 'node:test';
import { createServer, resetRuntimeStateForTests } from '../src/server.js';
import { config } from '../src/config.js';
import { resetDbForTests } from '../src/store.js';
import { createSeedData } from '../src/seed.js';
import path from 'node:path';

async function withServer(fn) {
  const server = createServer();
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();
  try {
    await fn(`http://127.0.0.1:${port}`);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

beforeEach(() => {
  config.databaseFile = path.resolve(process.cwd(), 'data', 'mitra.test.sqlite');
  resetRuntimeStateForTests();
  resetDbForTests(createSeedData());
});

test('POST /api/public-assistant/stream streams SSE event tokens and done payload', async () => {
  await withServer(async (base) => {
    const response = await fetch(`${base}/api/public-assistant/stream`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question: 'What is the First Year B.Tech fee for OBC boys?' }),
    });

    assert.equal(response.status, 200);
    assert.equal(response.headers.get('content-type'), 'text/event-stream');

    const text = await response.text();
    assert.ok(text.includes('event: meta'));
    assert.ok(text.includes('event: token'));
    assert.ok(text.includes('event: done'));
    assert.ok(text.includes('61,109') || text.includes('61109'));
  });
});

