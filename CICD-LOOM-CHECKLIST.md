# CI/CD Part 1 — final Loom checklist

The PDF requests a Loom video link showing the real process from push to local deployment. A silent local walkthrough or slides alone are not evidence of a completed remote pipeline.

## Before recording

- [ ] GitHub repository contains `.github/workflows/cicd.yml` at its root; main is configured.
- [ ] Private Docker Hub `auth-app` repository exists with frontend/backend tags.
- [ ] GitHub variable/secret and local read-only Docker login are configured off camera.
- [ ] Live stack runs the deployment Compose file with existing external volume `node-auth-app_db-data`.
- [ ] Python deploy server is running on port 9000 with the shared secret entered privately.
- [ ] ngrok tunnel is running; GitHub Workflow runs webhook ping succeeded.
- [ ] Close secret forms, password managers, `.env`, and terminal history containing credentials. Do not print resolved Compose configuration (it contains credentials).
- [ ] Open VS Code, GitHub Actions, private Docker Hub tags page, localhost app, and Docker Desktop Containers.

## Successful automatic deployment

Make a visible UI change that preserves the tested welcome heading, for example change the static paragraph `You are logged in.` in `src/main.js` to `You are logged in. CI/CD deployment verified.` Keep the dynamic heading unchanged so existing tests remain valid.

```powershell
Set-Location 'C:\Users\Martine\Desktop\505_assignments\node-auth-app\node-auth-app'
git diff -- src/main.js
git add src/main.js
git commit -m "Demonstrate automatic deployment"
git push origin main
```

- [ ] Show the actual pushed commit and GitHub **CI/CD** run starting.
- [ ] Show full-stack tests passing, then image publication, then a green workflow.
- [ ] Show both Docker Hub tags with updated last-pushed times.
- [ ] GitHub webhook Recent Deliveries: completed workflow_run response **202**.
- [ ] Deploy server: `Deploying commit ...`, `docker compose ... pull`, `up -d`, `Deploy finished`.
- [ ] Refresh localhost, log in with an existing account, show the visible new paragraph.
- [ ] Show Docker Desktop's three running deployment containers and attached database volume.

Optional terminal evidence (not resolved config):

```powershell
Set-Location 'C:\Users\Martine\Desktop\505_assignments\auth-app-deploy'
docker compose -f docker-compose.deploy.yml ps
docker inspect auth-app-deploy-db-1 --format '{{range .Mounts}}{{.Type}} {{.Name}} {{.Destination}}{{end}}'
```

## Failing-test demonstration

Do this ONLY after the successful recording checkpoint. Add a dedicated temporary demonstration test rather than damaging application behavior. It intentionally fails and must be removed/restored afterward.

```powershell
Set-Location 'C:\Users\Martine\Desktop\505_assignments\node-auth-app\node-auth-app'
@'
import { test, expect } from '@playwright/test';
test('Intentional CI failure demonstration', () => {
  expect(true).toBe(false);
});
'@ | Set-Content tests/ci-failure-demo.spec.js -Encoding UTF8
git add tests/ci-failure-demo.spec.js
git commit -m "Demonstrate that failing tests block deployment"
git push origin main
```

- [ ] Show the new workflow turns **red** at the Playwright test step.
- [ ] Show tag/login/push steps are skipped; Docker Hub tags have not been republished by this failed run.
- [ ] Show deploy server logs `Ignored: workflow conclusion is 'failure'`.
- [ ] Show the currently deployed app remains on the last successful version.
- [ ] Explain: failure is acknowledged by the webhook but does not run pull/up.

Restore a green main and show it before ending:

```powershell
git rm tests/ci-failure-demo.spec.js
git commit -m "Restore passing CI after failure demonstration"
git push origin main
```

- [ ] Final workflow is green and deployment succeeds again.
- [ ] Save Loom link; confirm viewing permissions before submission.
- [ ] Leave no intentionally failing test committed on main. Never delete a database volume for this demonstration.
