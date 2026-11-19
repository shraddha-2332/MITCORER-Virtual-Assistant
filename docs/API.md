# MITRA API

Base URL: `http://127.0.0.1:4000`

Authentication uses a short-lived bearer access token. Login and signup return:

```json
{
  "data": {
    "user": { "id": "USR-APP", "email": "applicant@example.com", "role": "applicant" },
    "token": "access-token"
  }
}
```

The refresh token is an HttpOnly, `SameSite=Strict` cookie scoped to `/api/auth`. Call `POST /api/auth/refresh` without a body to restore a browser session, and `POST /api/auth/logout` to revoke and clear it. The assistant route is limited to 30 requests per authenticated user per minute.

## Auth

Administrator knowledge creation/editing: `POST /api/knowledge`, `PATCH /api/knowledge/:id`. Patches require `expectedRevision`, return 409 for stale edits, and validate publication status, URLs and structured fact tables. Only designated published records drive maintained fee, hostel/mess and intake facts; other legacy answer rules still need consolidation.

- `POST /api/auth/login`
- `POST /api/auth/signup`
- `POST /api/auth/refresh`
- `POST /api/auth/logout`
- `GET /api/me`

## Assistant / RAG

- `POST /api/assistant/ask`
- `GET /api/assistant/attachments`
- `POST /api/assistant/attachments/upload`
- `GET /api/assistant/attachments/:id/file`

Body:

```json
{ "question": "Which documents are required for reporting?" }
```

Returns routed guidance, source, next action, and retrieval evidence.

Optional question field `language` accepts `auto` (default), `en`, `mr`, or `hi`, including on `/api/conversations/ask`. Responses include requested/actual language and localization provenance; unsupported preferences return 400. Admin knowledge creation/editing accepts reviewed `translations` keyed by mr/hi, bound to the source-text hash and invalidated by source edits. Unsupported free text falls back explicitly; Marathi/Hindi quality requires competent-speaker review, with the [review packet](language-review/REVIEW_PACKET.md) awaiting approval.

Both `POST /api/assistant/ask` and the unauthenticated `POST /api/public-assistant/ask` can return `sections` for compound questions. Each section contains `topic`, `title`, `question`, `answer`, `status` and `evidenceIds`. Numbered citations match the returned evidence order; source links retain `{ label, url }`. An ambiguous reference returns `clarification: true` with an evidence-empty question requesting the missing programme/route.

The assistant returns deterministic answers from verified records. Gemini can generate a response only when retrieved evidence exists but no direct verified answer matches; it cannot override verified rules or source records.

## Inquiries

- `GET /api/inquiries`
- `POST /api/inquiries`
- `PATCH /api/inquiries/:id/status`

Applicants/parents see their own records. Staff/admin see all records.

## Documents

- `GET /api/documents`
- `POST /api/documents`
- `POST /api/documents/upload`
- `PATCH /api/documents/:id/status`
- `DELETE /api/documents/:id`
- `GET /api/documents/:id/file`

Real upload supports PDF, JPG, and PNG. Staff/admin can update review status.

## Content And Knowledge

- `GET /api/public-facts` (unauthenticated single source of truth for academic fees, hostel/mess, and programme intake)
- `GET /api/content`
- `POST /api/content`
- `PATCH /api/content/:id`
- `GET /api/knowledge`
- `POST /api/knowledge`
- `GET /api/official-sources`
- `POST /api/official-sources/upload`
- `POST /api/official-sources/sync` (admin-only; currently paused and returns `409 OFFICIAL_SOURCE_SYNC_PAUSED` without changing records)
- `GET /api/official-sources/:id/extracted-text`
- `PATCH /api/official-sources/:id/publish`
- `GET /api/official-sources/:id/file`

Knowledge records are used by backend retrieval when answering assistant questions. Staff/admin can list official sources; only college admins can upload, inspect extracted text, or publish it. Official-source upload supports PDF, DOCX, XLSX, CSV, TXT, JPG, and PNG. TXT/CSV content is extracted automatically; Docker deployments also extract text from PDFs. DOCX, XLSX, image-based PDFs, and images require reviewed text to be supplied manually.

An upload stays in `Review` until a college admin calls `PATCH /api/official-sources/:id/publish` with reviewed `verifiedText`. Publishing replaces any prior retrieval chunks for that source and records an audit event. Unpublished source text is never used to answer applicants.

Assistant attachments support PDF, JPG, and PNG. They are stored as support files for the owner and staff/admin review; MITRA does not claim to extract or interpret their visual content unless that capability is explicitly deployed.

## Assistant evidence snapshots

Source provenance and freshness are implemented. Knowledge POST/PATCH accepts optional validated `provenance` and boolean `verifySource`; verification stamps cannot be supplied by clients. Evidence includes safe provenance and `verification: { status, verifiedAt }`, never reviewer identity. Source publishing also accepts reviewed page batches, source URL/provenance and an optional revision precondition. Explicit dates/supersession exclude unavailable evidence; absent dates are not fabricated. Page-aware publication preserves passage lineage and revision history; conflicting structured facts require clarification or refusal instead of a fabricated resolution.

Public/authenticated answers expose supporting published records in `data.evidence`. Each now includes `revision`, `citationId`, `academicYear` (null when unknown), and `passage: { text, sha256, truncated }` alongside existing ID/title/category/source/URL/score fields. Excerpts are capped at 2,800 characters; the hash covers the full original passage. Compound numbered references follow evidence-array order. Account history retains the evidence snapshot. These fields identify source content; they do not prove every answer claim or establish human verification. No PDF pages or verification dates are invented.

## Reports And Audit

- `GET /api/reports`
- `GET /api/audit-logs`

Staff/admin only.
