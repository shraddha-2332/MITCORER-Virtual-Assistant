# Mitra operations and release instructions

Use Node 22.12 or newer in the Node 22 series; local verification used 22.23.1. See [current completion evidence](CURRENT_COMPLETION_STATUS.md). Production deployment is a separate step from local validation.

## Production configuration

Keep real settings in environment variables or untracked `.env` files. Required in production: a unique `TOKEN_SECRET`. For a new protected administrator also set `ADMIN_EMAIL`, `ADMIN_PASSWORD` (at least 12 characters) and optionally `ADMIN_NAME`. Known demo password hashes are rejected in production even if they survive in an older database. New production databases do not contain fictitious applicant inquiries or uploaded documents.

Optional generation uses `GEMINI_API_KEY`, `GEMINI_MODEL`, `GEMINI_EMBEDDING_MODEL` and `GEMINI_FALLBACK_MODEL`. The embedding default is `gemini-embedding-001`; `text-embedding-004` was not listed in the authenticated provider check. The generation default is `gemini-3.8-flash`. A listed model is not proof of a successful generation: the live generation smoke timed out. Embedding smoke returned a 3072-element vector.

Generation has one overall 15-second budget, per-attempt timeouts, one primary transient retry and an optional configured fallback model. Only temporary HTTP/network failures are retried; invalid credentials, billing/permission failures, safety blocks and insufficient evidence do not cascade. All returned drafts pass the same verification. No API-key rotation or quota bypass is implemented. Credentials and prompts are not included in request logs.

## Same-origin deployment

The supplied site is `https://mitra-the-virtual-assistant.vercel.app/`; observed API traffic uses `https://mitra-the-virtual-assistant.onrender.com/`. Production frontend requests now use `/api` on their own origin. `frontend/vercel.json` proxies that prefix to the existing Render backend before its SPA fallback. Vite development and Nginx provide corresponding local proxies. `VITE_API_URL` is a development-only override; production does not send private-session cookies to a different site.

Set exact CORS origins appropriate to the deployment. Keep `TRUST_PROXY=false` when client-supplied forwarding headers are not guaranteed to be replaced by a trusted edge. With `TRUST_PROXY=true`, the backend uses forwarded addresses for rate limiting. Nginx overwrites the forwarding address and the Compose backend is not exposed directly. Render's edge/header behavior needs environment-specific verification before enabling trust there; with trust off, callers behind a shared edge can share a limiter key.

The Render Blueprint uses the free plan with an ephemeral filesystem. Use the hosted service for public questions backed by the bundled seed and for disposable demos. Keep the maintained database, uploaded notices, and corpus on a local machine or in Docker volumes you control. Render can discard runtime-created SQLite records, accounts, conversations, uploads, and published edits on a restart, redeploy, or spin-down. Export anything you need from the existing service before making deployment changes. [Render free-service limits](https://render.com/docs/free)

### Provision the document index

The default index is `backend/data/website-corpus/document-index.sqlite` locally and `/app/data/website-corpus/document-index.sqlite` in Docker. The free Render deployment uses bundled knowledge and official-navigation links without the optional local index. Obtain the approved index from the corpus builder or preserve the current index before replacing a local instance. The Docker image ships application source only. With a fresh Compose volume, seed the index after starting the backend and before using document search:

```powershell
docker compose exec -T backend mkdir -p /app/data/website-corpus
docker compose cp ./backend/data/website-corpus/document-index.sqlite backend:/app/data/website-corpus/document-index.sqlite
```

Verify `GET /api/document-corpus` as staff or admin and confirm `available` is true with nonzero document and chunk counts on the deployment where the index was provisioned. Restart the backend after replacing an already loaded index. Keep a recoverable copy of the index or rebuild it from the approved corpus.

## Credentials on an existing database

Set `ADMIN_EMAIL` and a unique `ADMIN_PASSWORD` (at least 12 characters) in the protected production environment or in the untracked backend `.env` for local development. With both values set, the backend reconciles that administrator with SQLite on startup. A changed password replaces its stored hash and revokes existing refresh sessions. Start the local backend with `npm run dev` from `backend` so it loads `.env`. Restart the backend after changing the configured password. Keep the password out of shell arguments, source files, and deployment manifests.

For a deliberate offline repair instead, stop the single backend instance, take a verified backup, set the administrator variables in the operator environment, then run from `backend`:

```powershell
npm.cmd run provision:admin
```

This creates or updates an administrator by email, refuses to silently promote an existing different-role account, hashes the unique password and revokes that user's refresh sessions. Existing access tokens remain valid for their normal short lifetime; schedule credential rotation accordingly. Restart the backend and verify login. Do not commit the password or pass it in shell arguments.

## Public conversation privacy

A random 256-bit HttpOnly `SameSite=Strict` cookie owns public conversations; only its hash is persisted. Production cookies are Secure. Conversations expire after 30 idle minutes, with at most 200 messages per conversation and 200 public conversations retained. Startup, public chat/reset traffic and a one-minute timer prune expired or legacy unbound public histories. Back up an old database before upgrading. Full database backups can retain historical data until their own retention period ends.

`DELETE /api/public-assistant/conversation` accepts `{ "conversationId": "..." }` and the matching cookie. Cross-session, expired and unknown IDs receive 404. Reset deletes the stored exchange; refresh alone loses the browser's active reference. The widget recovers from expired IDs by creating a fresh conversation and displaying a notice. No previous context is silently carried into the replacement. Authenticated account history is a separate, owner-checked workflow.

## Health, readiness and logs

- `GET /api/health` is liveness.
- `GET /api/ready` checks a SQLite query and returns a controlled 503 when storage is unavailable. It does not certify external models, backups or durable disk.
- Production request logs contain request ID, method, status and duration. Questions, bodies, passwords and keys are omitted. `LOG_REQUESTS=true` enables the same logs in development.
- In-memory public, login and registration limiters protect the single-instance prototype. They are not a distributed rate-limit service. Monitor 429/5xx rates, readiness failures and storage errors in the hosting provider before increasing traffic.

## Backups and restore

From `backend`, with the correct untracked environment configuration:

```powershell
npm.cmd run backup
npm.cmd run backup -- --verify BACKUP_DIRECTORY
npm.cmd run backup -- --restore BACKUP_DIRECTORY NEW_TARGET_DIRECTORY
```

The database snapshot uses SQLite `VACUUM INTO`, including committed WAL data. Asset copies have checksums; verification checks those hashes and SQLite integrity/application shape. Quiesce upload and source-maintenance writes for database-to-file consistency. The backup includes files from `UPLOAD_DIR` and `OFFICIAL_SOURCE_DIR`, which default to `backend/uploads` and `backend/official-sources`. Preserve the document index separately. A PDF upload must contain a complete header, cross-reference target and EOF marker; older test fixtures that contain only `%PDF-` text are invalid and must be replaced with real files. Do not delete stored files solely by extension: compare them with database records first. A failed backup without a verified manifest is not an accepted snapshot. Backups include sensitive application data: restrict access, encrypt/offsite-copy as appropriate and define retention. Secrets in `.env` are not copied.

Restore only into a new directory; existing data is never overwritten by this tool. Inspect the restored copy, stop the service, review target paths, keep the current snapshot, then deliberately change the runtime storage location. The automated drill uses an isolated target; no running database was replaced. Schedule periodic backup/restore drills and monitor their completion in the actual deployment.

## Validation commands

Backend: `npm.cmd run check`, `npm.cmd test`, `npm.cmd run evaluate`, `npm.cmd run evaluate:public -- --strict`, `npm.cmd run evaluate:verifiers -- --strict`, `npm.cmd run evaluate:retrieval`, and `npm.cmd run evaluate:load`. The load command runs against an in-memory local test instance. The verifier command reports both checkers and fails on decision errors from the slot-aware verifier used in production. The token-only baseline shows which errors a token match can miss.

Frontend: `npm.cmd ci`, `npm.cmd test`, `npm.cmd run lint`, `npm.cmd run build`, `npm.cmd audit`, `npm.cmd run test:public-session-browser`, `npm.cmd run test:language-browser`, and `npm.cmd run test:maintainer-browser`. The complete answer journey requires first running `backend/scripts/audit-answer-sources.js`, then `npm.cmd run test:all-answers-browser`. Installed Chrome or Edge is required locally. Review packets generated by language tests go to ignored `frontend/tmp/language-review`; existing reviewer files are preserved.

The GitHub Actions workflow runs backend checks/evaluators and frontend unit/build/critical browser checks without model credentials. Its cloud run is not verified until the approved changes are pushed and Actions executes.

## Release and rollback

1. Review the concrete diff and obtain the user's commit/push approval.
2. Verify a fresh backup and the existing deployment's durable-storage configuration.
3. Commit only the reviewed files; exclude old unverified drafts, unrelated file deletions, databases, secrets, uploads and temporary reports.
4. Push only after approval; provider auto-deployments may be triggered.
5. Verify the deployed commit, `/api/health`, `/api/ready`, first-party cookies, two-browser rejection, reset, maintained fees, anonymous refresh 401, and protected maintainer access. Check actual Render/Vercel logs for 5xx and 429 responses.
6. If release checks fail, redeploy the previous verified application version through the provider or a reviewed forward revert. Restore data only when necessary and after inspecting an isolated copy. Do not force-push or destructively reset storage.

The current local change set has not been committed or deployed. The live smoke establishes the pre-release site's public fee response only; it does not establish these new controls on the hosted application.

## Applicant checklist rollout

The public assistant opens the admissions checklist for guests. Applicant or parent accounts can save their route, self-reported stage and document checks to resume later. Official portals and notices provide the admission result, deadlines and final requirements.

Applicant document intake and review have been retired. Existing records and files are retained in storage and backups. Assistant attachment uploads are staff-only. Official-source uploads are managed separately.
