import { offices } from '../src/office-routing.js';
import { getDb, saveDb, closeDb } from '../src/store.js';
import { hashPassword } from '../src/auth.js';
import { generateId, nowIso } from '../src/utils.js';

if (!process.argv.includes('--backend-stopped')) throw new Error('Stop the backend before provisioning office staff.');
const email = (process.env.STAFF_EMAIL || '').trim().toLowerCase();
const office = offices.find(item => item.email === email);
const password = process.env.STAFF_PASSWORD;
if (!office || !password || password.length < 12) throw new Error('Set STAFF_EMAIL to a configured office owner and STAFF_PASSWORD to a unique password of at least 12 characters.');

try {
  const db = getDb();
  const existing = db.users.find(user => user.email.toLowerCase() === email);
  if (existing) {
    if (!['staff', 'admin'].includes(existing.role)) throw new Error('This email belongs to another account role. Resolve the account conflict before provisioning.');
    console.log('Staff account already exists.');
  } else {
    db.users.push({ id: generateId('USR'), name: office.owner, email, role: 'staff', passwordHash: hashPassword(password), createdAt: nowIso() });
    saveDb();
    console.log('Office staff account provisioned.');
  }
} finally {
  closeDb();
}
