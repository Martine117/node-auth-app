# Docker and Compose verification — 2026-11-12

## Actual results

- Existing simple image had already passed 10 headed Chromium E2E tests.
- Built `node-auth-app:alpine` using the original Dockerfile with only its base image replaced through stdin; the original Dockerfile remains `FROM node:26`.
- Built `node-auth-app:multistage` before adapting the project to Compose.
- Standalone multi-stage nginx container passed **10 tests, 0 failures**, in 9.2 seconds.
- Inspected built static files inside nginx and verified `node` was absent.
- Inspected simple and multi-stage image layer history.
- Same Docker disk-usage column: simple **1.97 GB**, Alpine **434 MB**, multi-stage **92.7 MB**. Corresponding content sizes: **507 MB**, **125 MB**, **26.1 MB**. Sizes differ from the guide's rough expectations because image versions change.
- Built the Express backend and Compose frontend successfully. Backend dependency audit reported zero vulnerabilities.
- `npm.cmd run build` succeeded after frontend API integration; Compose's multi-stage production build also succeeded.
- `docker compose up --build -d --wait --wait-timeout 120` completed with exit code 0.
- Verified `node-auth-app-frontend-1`, `node-auth-app-backend-1`, and `node-auth-app-db-1` running. PostgreSQL has a healthy database healthcheck; frontend and backend have no custom healthchecks.
- Only frontend port **5173 → 80** is published. Backend 3000 and PostgreSQL 5432 remain private.
- Confirmed volume **node-auth-app_db-data**, type **volume**, attached read/write to PostgreSQL at **/var/lib/postgresql**.
- Backend `/api/health` returned `{"status":"ok"}`.
- First Compose Chromium E2E run: **10 passed, 0 failed** in 6.0 seconds.
- Queried database accounts and confirmed 97-character salted password-hash representations, rather than plaintext password storage.
- Malformed JSON registration request: **400**, `Invalid JSON`.
- SQL-injection-style login request: **401**.
- Created `persistence_check`, ran `docker compose down` WITHOUT volume deletion, then `docker compose up -d --wait --wait-timeout 120`. Login with the same account succeeded afterward, proving persistence across container recreation.
- Second Compose Chromium E2E run against the populated database: **10 passed, 0 failed** in 6.9 seconds.
- Tests used `playwright.compose.config.js`, which disables Playwright's Vite startup and uses `http://localhost:5173`.
- No persistent database volumes were deleted. Compose services are intentionally left running for evidence capture.

## Implementation

- Added Express API routes for registration, login, and database health, plus malformed JSON and internal-error handling.
- Added PostgreSQL connection pool, users table initialization, parameterized SQL, duplicate-username handling, PBKDF2 password hashing, and timing-safe password comparison.
- Replaced browser-only auth logic with `src/api.js`; adapted `src/main.js` to use the API.
- Added nginx reverse-proxy configuration, updated the multi-stage Dockerfile, added backend Docker files/package lock, and added three-service `docker-compose.yml`.
- Expanded `.dockerignore` exclusions for backend/test/config content.
- Adapted the existing ten E2E tests to unique database usernames and persistent accounts; refresh still clears UI login state but no longer deletes registered users.
- Added `playwright.compose.config.js`, `RECORDING.md`, and this report.

## Errors and limits

All build/start/test commands completed successfully. New image downloads were slow. Playwright emitted a harmless NO_COLOR/FORCE_COLOR warning. PostgreSQL's initialization logs include an expected temporary-server shutdown before normal startup.

This follows the educational guide: UI login state is not a server-issued session, there are no protected-data API routes, and database credentials are local learning defaults in Compose. It is not production authentication. The optional exercise that deletes the volume was deliberately not executed, as requested. Exploratory exercises that alter dependencies, remove ignore rules, add extra endpoints, or expose database ports were not necessary for the requested stack verification.

## Evidence

- Latest test report: `playwright-report/index.html`.
- Exact screenshot layouts and Loom commands: `RECORDING.md`.
- Container group: `node-auth-app`.
- App: `http://localhost:5173`.
