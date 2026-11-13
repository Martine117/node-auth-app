# CI/CD Part 1 local verification — 2026-11-13

## Implemented locally

- Read all nine pages of `CICD_EXERCISE.pdf`.
- Added `.github/workflows/cicd.yml`: exact workflow name `CI/CD`, main-push-only trigger, isolated CI database credentials, full-stack Compose build/start, Chromium E2E, test-before-publish gate, Docker Hub login-action v4, frontend/backend tags in one auth-app repository, reports, cleanup and serialized runs.
- The tested Compose images are tagged for publishing without rebuilding, so tests and publication use the same image contents.
- Added `deployment/` templates, plus matching live files in the separate workspace-level `auth-app-deploy` folder: deployment Compose, Python server, hidden-input server launcher.
- Deployment has db/backend/frontend, private registry image references, no build sections, port 5173, and explicit external volume `node-auth-app_db-data` at `/var/lib/postgresql`.
- Python server implements the PDF's HMAC-SHA256 authentication, signed ping handling, successful/completed CI/CD-on-main filtering, background acknowledgement, and serialized pull/up. Added malformed input handling, request-size/time limits, fixed deployment working directory, secret redaction and Docker-command timeout.
- Added hidden-input Docker login, clipboard-only webhook secret generation, and nonsecret deployment-username helpers. These helpers have been syntax-checked; no real tokens or public tunnel were configured.
- Moved existing database credentials from Compose into excluded local `.env` files. Current credentials and existing data were retained. The pipeline generates its own fresh CI-only password; GitHub does not receive local database credentials.
- Initialized a local Git repository on main. Corrected initial Windows sandbox ownership by recreating only the new empty Git metadata under the user's account. No commits, remote configuration or pushes performed.
- App source, backend behavior and existing E2E tests were preserved.
- Added step-by-step external setup instructions and a final Loom checklist.

## Actual local test results

| Check | Result |
|---|---|
| Python webhook HTTP/unit tests | 25 passed |
| Initial local full-stack Chromium E2E | 10 passed, 0 failed (8.3s) |
| Deployment-only Compose full-stack E2E | 10 passed, 0 failed (5.1s) |
| Final restored-stack Chromium E2E | 10 passed, 0 failed (4.8s) |
| npm production build | Passed |
| Docker frontend/backend builds | Passed |
| Development Compose validation/start | Passed |
| Deployment Compose validation/start using LOCAL image tags | Passed |
| Workflow/schema/test-before-push gate checks | Passed |
| PowerShell helper syntax | Passed |
| Live/template deployment-file consistency | Passed |
| Git exclusion and existing DB credential scan | Passed |

Deployment-file integration test used local-only `local-verification/auth-app:frontend` and `:backend` tags with `--pull never`. It did NOT contact Docker Hub or prove private registry pull. No Docker Hub username was guessed or saved.

Before the deployment switch, database contained 114 existing users; all 114 remained after switching to the external deployment volume. Subsequent tests added new unique test accounts. Before the final E2E run, the count was 128. No users or volumes were deleted. Only one PostgreSQL stack ran against this volume at a time.

The first Python run hit a Windows connection-aborted error in the oversized-request test fixture. The fixture was corrected to send only oversized headers without leaving unread body bytes; final tests all passed. A deliberately failing temporary Playwright test was also run: 1 failed with expected process exit code 1. It was removed immediately, then the full passing suite was rerun. This is a local failure-gate check, not proof of a failed GitHub run.

## Current state

- Original `node-auth-app` Compose stack restored and running at http://localhost:5173.
- Existing database volume retained.
- Local deployment configuration is outside the Git repository; its `.env` contains preserved DB configuration only until the user supplies a Docker Hub username.
- No webhook secret generated/persisted, Docker Hub token entered, GitHub secret created, ngrok tunnel opened, registry image pushed, or real webhook-triggered deployment performed.
- Latest E2E report remains `playwright-report/index.html`, final status passed.

## Required external checkpoints still pending

1. User's GitHub repository and authenticated Git access.
2. User's Docker Hub account, private auth-app repository, Read & Write CI token, and read-only local token.
3. Actions variable DOCKERHUB_USERNAME and secret DOCKERHUB_TOKEN.
4. First real main push: hosted workflow green, both private tags published.
5. Private registry pull on this machine and switch to published images.
6. User's ngrok account, agent installation/authentication and approval for public forwarding.
7. Privately generated shared webhook secret and GitHub Workflow runs webhook configuration.
8. Successful signed ping, real successful workflow deployment with visible change, deliberately failing GitHub test run with no publication/deploy, then restored green main.
9. Final Loom recording/link of that actual end-to-end process.

Do not mark the whole assignment complete until these are observed. Follow `CICD-SETUP.md` and `CICD-LOOM-CHECKLIST.md`.
