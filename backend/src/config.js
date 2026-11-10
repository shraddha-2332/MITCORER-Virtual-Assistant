import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const nodeEnv = process.env.NODE_ENV || 'development';
const configuredTokenSecret = process.env.TOKEN_SECRET;
const configuredCorsOrigins = process.env.CORS_ORIGIN || 'http://127.0.0.1:5173';

if (nodeEnv === 'production' && !configuredTokenSecret) {
  throw new Error('TOKEN_SECRET must be configured when NODE_ENV=production.');
}

export const config = {
  nodeEnv,
  port: Number(process.env.PORT || 4000),
  host: process.env.HOST || (nodeEnv === 'production' ? '0.0.0.0' : '127.0.0.1'),
  corsOrigins: configuredCorsOrigins.split(',').map((origin) => origin.trim()).filter(Boolean),
  // A development fallback keeps the local academic demo runnable. Production must supply a secret.
  tokenSecret: configuredTokenSecret || 'mitra-development-only-secret',
  dataFile: path.resolve(rootDir, process.env.DATA_FILE || './data/db.json'),
  databaseFile: path.resolve(rootDir, process.env.DATABASE_FILE || './data/mitra.sqlite'),
  geminiApiKey: process.env.GEMINI_API_KEY || '',
  geminiModel: process.env.GEMINI_MODEL || 'gemini-3.8-flash',
  geminiEmbeddingModel: process.env.GEMINI_EMBEDDING_MODEL || 'gemini-embedding-001',
  geminiFallbackModel: process.env.GEMINI_FALLBACK_MODEL || '',
  groqApiKey: process.env.GROQ_API_KEY || '',
  groqModel: process.env.GROQ_MODEL || 'openai/gpt-oss-120b',
  groqFallbackModel: process.env.GROQ_FALLBACK_MODEL || 'openai/gpt-oss-20b',
  maxBodyBytes: 15 * 1024 * 1024,
  assistantRateLimitMax: Number(process.env.ASSISTANT_RATE_LIMIT_MAX || 30),
  publicAssistantRateLimitMax: Number(process.env.PUBLIC_ASSISTANT_RATE_LIMIT_MAX || process.env.ASSISTANT_RATE_LIMIT_MAX || 30),
  trustProxy: process.env.TRUST_PROXY === 'true',
  publicConversationTtlMs: 30 * 60 * 1000,
  evidenceNavigatorEnabled: process.env.EVIDENCE_GAP_NAVIGATOR_ENABLED === 'true',
};
