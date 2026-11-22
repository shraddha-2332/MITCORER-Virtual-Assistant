# MITRA Backend

Zero-dependency Node.js API for the MITRA backend foundation.

## Run

```bash
cd backend
npm run dev
```

Default URL: `http://127.0.0.1:4000`

## Administrator credentials

Provision deployed administrator credentials through `ADMIN_EMAIL`, `ADMIN_PASSWORD` (minimum 12 characters), and optional `ADMIN_NAME`. Seeded local accounts use reserved `.test` addresses and are for development/test data only; never reuse local fixture credentials in a deployed environment.

## API Summary

- `GET /api/health`
- `POST /api/auth/login`
- `POST /api/auth/signup`
- `GET /api/me`
- `GET /api/inquiries`
- `POST /api/inquiries`
- `PATCH /api/inquiries/:id/status`
- `GET /api/documents`
- `POST /api/documents`
- `PATCH /api/documents/:id/status`
- `DELETE /api/documents/:id`
- `GET /api/content`
- `POST /api/content`
- `PATCH /api/content/:id`
- `GET /api/reports`

## Current Scope

This backend provides SQLite-backed persistence, password hashing, signed short-lived access tokens, refresh-token rotation, backend RBAC, audit logs, upload validation, and staff/admin workflows. Official sources flow through an admin review and publish gate; only published source chunks are available to retrieval. It remains a college-project deployment baseline rather than a completed institutional production service: malware scanning, object storage, normalized relational tables, OCR for scanned material, and managed secret/session infrastructure still require deployment-specific work.

### Public inquiry escalation

Submitting the public assistant escalation form stores a high-priority inquiry in the SQLite-backed `inquiries` collection with status `Needs reply`, routing queue `MITCORER Staff Triage`, and no individual assignee. Staff/admin users can review it through `GET /api/inquiries` and update assignment/status through `PATCH /api/inquiries/:id/status`; the workspace includes an inquiry-triage view. The current system does not send email/SMS notifications and does not automatically assign a faculty member or promise a callback. Staff must monitor the queue and contact the submitter using the supplied contact details.

## Assistant Answers and Generation Providers

The assistant retrieves published MITCORER knowledge and uses direct verified answers for admission rules, fees, programmes, profile questions, and facilities. For selected questions with retrieved evidence, Groq is tried first when configured, then Gemini. A draft is accepted only after factual-token, speculative-figure, and slot-grounding checks; failed Groq drafts allow Gemini fallback. If no provider returns a verified answer, the backend uses deterministic evidence or abstains.

Set optional provider variables in `.env`:

```bash
GROQ_API_KEY=your-groq-key
GROQ_MODEL=openai/gpt-oss-120b
GROQ_FALLBACK_MODEL=openai/gpt-oss-20b
GEMINI_API_KEY=your-gemini-key
GEMINI_MODEL=gemini-3.8-flash
GEMINI_FALLBACK_MODEL=
```

Provider keys stay on the backend. Retrieval with generation is not model training. Embeddings use the Gemini key independently of answer generation. Review cited official sources for consequential admission decisions.

### Preparing a new review candidate set

The optional offline builder no longer reads the removed repository evaluation kit. Supply a fresh CSV and a new output path:

```bash
node scripts/build-human-evaluation-dataset.mjs path/to/fresh-cases.csv path/to/candidates.json
```

The CSV needs `case_id`, `language`, `topic`, `question`, and `author_reviewer_code` columns. The command writes a candidate JSON file and matching manifest, refuses to overwrite either, and marks independent adjudication as pending. A reviewer must establish authorship, source support, and labels before treating cases as an independent evaluation. The historical 90-case artifact has been marked as a development candidate; the evaluation runner rejects it as an independent set.

### Official website sync

Website sync is paused while the existing official-source inventory is reviewed. The admin endpoint `POST /api/official-sources/sync` returns `409 OFFICIAL_SOURCE_SYNC_PAUSED` and does not fetch pages or change source/knowledge records. The manual `npm run sync:website` command is disabled. Existing uploaded-source review and publishing remain available.
