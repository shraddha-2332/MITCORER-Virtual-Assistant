import crypto from 'node:crypto';
import { config } from './config.js';

export const publicSessionCookieName = 'mitra_public_session';
export function readPublicSession(req, body = null) {
  const value = String(req.headers?.cookie || '').split(';').map(part => part.trim())
    .find(part => part.startsWith(`${publicSessionCookieName}=`))?.slice(publicSessionCookieName.length + 1);
  if (/^[a-f0-9]{64}$/.test(value || '')) return value;
  const headerToken = req?.headers?.['x-mitra-session'];
  if (/^[a-f0-9]{64}$/.test(headerToken || '')) return headerToken;
  const bodyToken = body?.sessionToken;
  if (/^[a-f0-9]{64}$/.test(bodyToken || '')) return bodyToken;
  return null;
}
export function createPublicSession() { return crypto.randomBytes(32).toString('hex'); }
export function publicSessionHash(token) {
  if (!/^[a-f0-9]{64}$/.test(token || '')) throw new Error('A valid public session is required.');
  return crypto.createHash('sha256').update(token).digest('hex');
}
export function publicSessionCookie(token) {
  const sameSite = config.nodeEnv === 'production' ? 'None' : 'Strict';
  const secure = config.nodeEnv === 'production' ? '; Secure' : '';
  return `${publicSessionCookieName}=${token}; HttpOnly; SameSite=${sameSite}; Path=/api/public-assistant; Max-Age=${Math.floor(config.publicConversationTtlMs / 1000)}${secure}`;
}
