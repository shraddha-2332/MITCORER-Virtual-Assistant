// Only the browser-test harness launches this process, with its own temporary DATABASE_FILE.
import { config } from '../../backend/src/config.js';
import { createServer } from '../../backend/src/server.js';
import { closeDb, getDb, saveDb } from '../../backend/src/store.js';

if (!process.send || !process.env.MITRA_MAINTAINER_TEST) throw new Error('Launch through the maintainer browser harness');
config.geminiApiKey = '';
config.groqApiKey = '';
const db = getDb();
if (!db.officialSources.some(source => source.id === 'SRC-BROWSER-VERIFICATION')) {
  db.officialSources.unshift({
    id: 'SRC-BROWSER-VERIFICATION',
    title: 'Browser source verification fixture',
    documentType: 'Admissions',
    academicYear: '2026-27',
    sourceAuthority: 'Test fixture',
    originalFileName: 'browser-verification.txt',
    status: 'Review',
    revision: 2,
    extractedText: 'RIVER-NOTICE123: The reporting desk uses the blue verification slip.',
  });
  saveDb();
}
const server = createServer();
server.listen(config.port, '127.0.0.1', () => process.send({ port: server.address().port }));
process.on('message', message => {
  if (message !== 'shutdown') return;
  server.close(() => { closeDb(); process.disconnect(); });
  server.closeAllConnections();
});
