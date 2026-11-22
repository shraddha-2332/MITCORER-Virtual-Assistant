# Mitra files that matter for the viva

For a 15–20 minute viva, learn the six files below first. Use the rest of the shortlist when the examiner asks about a feature. The source folders also contain assets and supporting modules beyond this shortlist.

## Learn these six first

1. **App.jsx** shows the chat and sends the question.
2. **api.js** sends the request from the browser to the backend.
3. **server.js** receives the question and decides what code handles it.
4. **query-understanding.js** finds what the user wants and details such as the admission route.
5. **knowledge.js** reads the matching facts from published records.
6. **store.js** loads and saves those records in SQLite.

Use the fee follow-up in the [viva guide](MITRA_VIVA_GUIDE.md) to connect these files.

## Other files to know for questions

The table includes the six files above so you can open them directly.

| File | What it does |
| --- | --- |
| [backend/src/auth.js](../backend/src/auth.js) | Checks passwords, signs login tokens and checks who can access a record. |
| [backend/src/backup.js](../backend/src/backup.js) | Saves, checks and restores backups of the database and files. |
| [backend/src/bm25.js](../backend/src/bm25.js) | Implements BM25, a way to rank text by matching words, for search comparisons. |
| [backend/src/config.js](../backend/src/config.js) | Loads settings such as database location, server port and model options. |
| [backend/src/conversations.js](../backend/src/conversations.js) | Saves chat history and remembers details such as the admission route in a follow-up. |
| [backend/src/document-corpus.js](../backend/src/document-corpus.js) | Searches the collection of indexed public documents. |
| [backend/src/errors.js](../backend/src/errors.js) | Defines common API errors such as unauthorized and not found. |
| [backend/src/evidence.js](../backend/src/evidence.js) | Builds the evidence shown with an answer, including the passage and its version. |
| [backend/src/generation-client.js](../backend/src/generation-client.js) | Calls optional AI providers and handles time limits and fallback models. |
| [backend/src/grounded-prompt.js](../backend/src/grounded-prompt.js) | Packages source passages as reference text for an AI request. |
| [backend/src/grounding.js](../backend/src/grounding.js) | Checks AI drafts for claims or question details the evidence does not support. |
| [backend/src/knowledge.js](../backend/src/knowledge.js) | Checks knowledge records and selects published facts about fees, hostel or programmes. |
| [backend/src/language.js](../backend/src/language.js) | Recognizes common language patterns and prepares supported translations and fallbacks. |
| [backend/src/maintained-profile.js](../backend/src/maintained-profile.js) | Finds published information about the college and contacts for staff help. |
| [backend/src/official-navigation.js](../backend/src/official-navigation.js) | Finds official links when users ask where to go for a service. |
| [backend/src/provenance.js](../backend/src/provenance.js) | Checks where a source came from, when it applies and whether it was replaced. |
| [backend/src/public-session.js](../backend/src/public-session.js) | Creates and reads the cookie token that links public chat to a browser. |
| [backend/src/query-router.js](../backend/src/query-router.js) | Chooses an answer route based on the question and the evidence it needs. |
| [backend/src/query-scope.js](../backend/src/query-scope.js) | Reads details such as year, branch and campus service, including exclusions. |
| [backend/src/query-understanding.js](../backend/src/query-understanding.js) | Recognizes the topic, finds important details and detects when it needs to ask a follow-up. |
| [backend/src/question-plan.js](../backend/src/question-plan.js) | Splits supported multi-part questions and prepares clarification messages. |
| [backend/src/rag-enhancer.js](../backend/src/rag-enhancer.js) | Reorders live search results using question details. Also contains experimental search helpers. |
| [backend/src/review-boundaries.js](../backend/src/review-boundaries.js) | Handles certain out-of-scope requests, such as questions about named external colleges. |
| [backend/src/safety-guard.js](../backend/src/safety-guard.js) | Looks for risky instructions in text sent to the assistant. |
| [backend/src/seed.js](../backend/src/seed.js) | Supplies starting records for a new database. |
| [backend/src/semantic.js](../backend/src/semantic.js) | Matches related terms and can compare numeric text representations called embeddings. |
| [backend/src/semantic-cache.js](../backend/src/semantic-cache.js) | Reuses public answers when their supporting records are still current. |
| [backend/src/server.js](../backend/src/server.js) | Receives API requests and runs public chat, optional checklist sign-in and saved progress, and staff workflows. |
| [backend/src/source-links.js](../backend/src/source-links.js) | Checks and cleans up source links and removes duplicates. |
| [backend/src/speculative-verifier.js](../backend/src/speculative-verifier.js) | Checks an AI draft for figures or claims that go beyond the records. |
| [backend/src/store.js](../backend/src/store.js) | Saves app data and embeddings in SQLite and applies updates to older databases. |
| [backend/src/utils.js](../backend/src/utils.js) | Shares small helpers for checking input, replying to requests and making IDs. |
| [backend/src/website-routes.js](../backend/src/website-routes.js) | Stores a map of pages on the official college website. |
| [backend/src/website-sync.js](../backend/src/website-sync.js) | Checks official pages for changes and sends updates for staff review. |
| [frontend/src/answer-format.mjs](../frontend/src/answer-format.mjs) | Turns answer text into headings, lists and tables the chat can show. |
| [frontend/src/api.js](../frontend/src/api.js) | Sends requests from the browser to the backend and handles replies. |
| [frontend/src/App.jsx](../frontend/src/App.jsx) | Contains the chat and the applicant, staff and admin screens. |
| [frontend/src/index.css](../frontend/src/index.css) | Controls the appearance and layout on different screen sizes. |
| [frontend/src/KnowledgeRecordEditor.jsx](../frontend/src/KnowledgeRecordEditor.jsx) | Lets admins update facts and sends the record version with each edit. |
| [frontend/src/main.jsx](../frontend/src/main.jsx) | Starts the React app in the browser. |
| [frontend/src/public-answer-links.mjs](../frontend/src/public-answer-links.mjs) | Checks and organizes the links shown in public answers. |
| [frontend/src/refresh-session.mjs](../frontend/src/refresh-session.mjs) | Restores a signed-in session when the browser can refresh it. |
| [frontend/src/request-json.mjs](../frontend/src/request-json.mjs) | Sends JSON requests and stops waiting when they take too long. |

## Run, test and deploy

| Path | Why it matters |
| --- | --- |
| [README.md](../README.md) | Local setup, scripts and feature overview |
| [backend/package.json](../backend/package.json) and [frontend/package.json](../frontend/package.json) | Runtime requirements and runnable commands |
| [frontend/package-lock.json](../frontend/package-lock.json) | Reproducible frontend dependency installation |
| [backend/.env.example](../backend/.env.example) and [.env.production.example](../.env.production.example) | Configuration templates |
| [frontend/vite.config.js](../frontend/vite.config.js) and [frontend/index.html](../frontend/index.html) | Frontend development, build and entry shell |
| [backend/test/api.test.js](../backend/test/api.test.js), [backend/test/file-api.test.js](../backend/test/file-api.test.js), [backend/test/maintained-answer-regression.test.js](../backend/test/maintained-answer-regression.test.js) and [backend/test/store.test.js](../backend/test/store.test.js) | API, file handling, maintained-answer scope, and restart persistence |
| [frontend/test/answer-format.test.mjs](../frontend/test/answer-format.test.mjs) and [frontend/test/request-json.test.mjs](../frontend/test/request-json.test.mjs) | Rendering and timeout regressions |
| [scripts/verify-phase-a.mjs](../scripts/verify-phase-a.mjs) | Reproduces the isolated validation run |
| [GitHub Actions CI](../.github/workflows/ci.yml) | Automated checks |
| [docker-compose.yml](../docker-compose.yml), [frontend/nginx.conf](../frontend/nginx.conf), [frontend/vercel.json](../frontend/vercel.json) and [render.yaml](../render.yaml) | Local containers and hosting configuration |
| [API.md](API.md), [DATABASE_SCHEMA.md](DATABASE_SCHEMA.md) and [OPERATIONS.md](OPERATIONS.md) | API contract, storage design and operational procedures |
| [Phase A report](PHASE_A_IMPLEMENTATION.md), [D11 report](D11_MIGRATION_FIX.md) and [AI review](answer-review/AI_REVIEW.md) | Technical changes, a migration case study and the latest saved validation results |

## Validation inputs to keep

The docs folder contains inputs as well as reports. For example, backend retrieval tests read `docs/retrieval-review/corpus.json` and `docs/retrieval-review/development-review.json`. The Phase A runner uses `docs/audit-confirm.mjs` and `docs/audit-reviewed-expectations.json`. Keep the Phase A, D11 and answer-review evidence while you are using it to substantiate viva claims.
