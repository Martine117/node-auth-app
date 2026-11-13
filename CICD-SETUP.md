# CI/CD Part 1 setup and checkpoints

Local project: `C:\Users\Martine\Desktop\505_assignments\node-auth-app\node-auth-app`.
Live deployment folder (outside Git repository): `C:\Users\Martine\Desktop\505_assignments\auth-app-deploy`.

This implements CICD_EXERCISE.pdf. Account creation, granting access, entering secrets and public exposure require the user's involvement. Never paste tokens/passwords into this chat, source files, command arguments typed into terminal history, screenshots, or recordings.

## 1. Docker Hub — user setup required

1. Sign in/create an account at https://hub.docker.com and verify email.
2. Create **auth-app**, visibility **Private**. Both images use this one repository with different tags: `<DockerId>/auth-app:frontend` and `<DockerId>/auth-app:backend`.
3. In Docker account settings → Personal access tokens, create `github-actions` with **Read & Write** and `local-deploy` with **Read-only**. Save each in your password manager. Do not send them to the assistant.
4. After providing only your nonsecret Docker ID, run the hidden-input login helper in an ordinary local PowerShell terminal (not recorded):

```powershell
Set-Location 'C:\Users\Martine\Desktop\505_assignments\node-auth-app\node-auth-app'
.\scripts\configure-deploy.ps1 -DockerId YOUR_DOCKER_ID
.\scripts\login-dockerhub.ps1 -DockerId YOUR_DOCKER_ID
```

The second helper requests the read-only `local-deploy` token using hidden input. Docker Desktop stores authentication in its credential store. The deploy server must run as the same Windows user who logged in.

## 2. GitHub — user setup required

1. Create/sign in to GitHub and create an empty repository (suggested name `node-auth-app`). Do not initialize it with a README/.gitignore, because this project is already initialized locally on `main`.
2. Repository Settings → Secrets and variables → Actions:
   - **Variables** tab: `DOCKERHUB_USERNAME` = your Docker ID.
   - **Secrets** tab: `DOCKERHUB_TOKEN` = the Read & Write `github-actions` token.
3. Provide the repository HTTPS URL (nonsecret). Authenticate through Git Credential Manager's browser flow when Git prompts; do not embed credentials in the URL.
4. Before committing, review the files with `git status --short` and verify `.env` is ignored. `.github` must be at the repository root. Use the inner `node-auth-app` folder as the repository root, not the assignment workspace.

```powershell
git check-ignore .env
git status --short
git add .
git commit -m "Implement full-stack CI/CD pipeline"
git remote add origin https://github.com/YOUR_GITHUB_USER/YOUR_REPOSITORY.git
git push -u origin main
```

If Git requests a name/email, enter your chosen commit identity locally. Do not guess another person's identity. If a remote is already configured, inspect its noncredential URL before changing it.

The workflow is named **CI/CD**, runs only on pushes to **main**, creates fresh masked CI database credentials, builds and starts all three services, installs Chromium, runs the ten E2E tests with Vite startup disabled, and tags/pushes the tested images only after success. The Python webhook tests run in CI too. Failed tests skip login/tag/push; reports are uploaded and CI containers are stopped.

Checkpoint: GitHub Actions green, both private Docker Hub tags have fresh push times. No remote run/publication can be claimed until this actually happens.

## 3. Switch to published images — after the first successful push

Do NOT switch until BOTH private tags exist and local Docker login succeeded. The original `.env` retains the existing database credentials; do not replace them with a newly generated password. PostgreSQL's initial-password setting does not change the password in an existing database.

The deployment file has no `build:` entries. It explicitly reuses external volume `node-auth-app_db-data`. Stop the development stack before starting deployment; never run two PostgreSQL containers against the same volume.

```powershell
Set-Location 'C:\Users\Martine\Desktop\505_assignments\node-auth-app\node-auth-app'
docker compose down
Set-Location 'C:\Users\Martine\Desktop\505_assignments\auth-app-deploy'
docker compose -f docker-compose.deploy.yml pull
docker compose -f docker-compose.deploy.yml up -d --wait --wait-timeout 120
docker compose -f docker-compose.deploy.yml ps
```

Stop if pull fails; do not continue using stale images. Verify http://localhost:5173, login to an existing account, and inspect the attached volume. Never use `down -v`, volume prune, or system prune with volumes. Production/local data is never mounted on GitHub's isolated CI runner.

## 4. Webhook secret and Python server — user secret entry required

Generate one random secret directly into the clipboard, save it in your password manager, and use exactly the same value in the hidden server prompt and GitHub webhook Secret field. Neither helper prints the value.

```powershell
Set-Location 'C:\Users\Martine\Desktop\505_assignments\node-auth-app\node-auth-app'
.\scripts\new-webhook-secret.ps1
Set-Location 'C:\Users\Martine\Desktop\505_assignments\auth-app-deploy'
.\start-deploy.ps1
```

Paste the secret at the hidden prompt, then leave the terminal running. Python 3.10+ standard library only; no pip packages needed. Browser check: http://localhost:9000 says `Deploy server is running`.

Server settings: required `WEBHOOK_SECRET`, default `WORKFLOW_NAME=CI/CD`, `BRANCH=main`, `PORT=9000`, and deployment file beside the server. It listens only on loopback. Valid signed requests receive fast responses while Docker runs in a background thread, one deployment at a time. The server follows the PDF's `pull` then `up -d` behavior and filters workflow name, branch, action and conclusion. This local single-user educational setup trusts the webhook secret; tags are mutable and the logged SHA identifies the triggering run, not an immutable image pin.

If PowerShell blocks a helper, use the environment's approval flow or a process-only execution-policy exception for that reviewed script; do not weaken machine-wide policy. Stop before changing policies without authorization.

## 5. ngrok — user account/authorization required

1. Create/sign in at https://dashboard.ngrok.com/signup.
2. Install the Windows agent from https://ngrok.com/download. The assistant should check for an existing agent before installation.
3. Connect it to your account in a private, unrecorded terminal. The dashboard supplies the authtoken. Because a literal token in a command line can be retained in history, use hidden input through Python when configuring it:

```powershell
python -c "import getpass,subprocess; subprocess.run(['ngrok','config','add-authtoken',getpass.getpass('ngrok authtoken (hidden): ')],check=True)"
```

4. In a SECOND terminal, with the deploy server already running:

```powershell
ngrok http 9000
```

This intentionally exposes the signed deployment endpoint to GitHub; user approval is needed before starting the public tunnel. Copy the actual HTTPS forwarding URL. Use that URL rather than assuming an assigned domain. The inspector at http://127.0.0.1:4040 can show requests; avoid recording authentication setup or sensitive request headers.

## 6. GitHub webhook — user configuration/authorization required

Repository Settings → Webhooks → Add webhook:

| Field | Value |
|---|---|
| Payload URL | Actual ngrok HTTPS forwarding URL plus `/deploy` |
| Content type | `application/json` |
| Secret | Same value used in the hidden Python server prompt |
| Events | Choose individual events; untick Pushes; tick **Workflow runs** |
| Active | Enabled |

Checkpoint: GitHub sends a signed ping; server logs `Ping from GitHub: the webhook is connected`; Recent Deliveries shows HTTP 200. A completed successful CI/CD run on main should receive HTTP 202 and trigger Docker pull/up. Failed runs receive HTTP 202 as ignored, without Docker commands.

## 7. End-to-end proof and recording

Follow `CICD-LOOM-CHECKLIST.md`. All of GitHub Actions, private Docker Hub push/pull, ngrok, signed webhook delivery and the visible deployed change must actually work before the assignment is marked complete. Local tests alone do not prove the external pipeline.

## Official references checked during implementation

- Docker Hub action and token inputs: https://github.com/docker/login-action
- Node setup action: https://github.com/actions/setup-node
- Docker's test-before-push guidance: https://docs.docker.com/build/ci/github-actions/test-before-push/
