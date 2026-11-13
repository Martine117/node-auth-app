# Screenshots and Loom commands

Run commands in VS Code PowerShell from:

```powershell
Set-Location 'C:\Users\Martine\Desktop\505_assignments\node-auth-app\node-auth-app'
```

## Two Docker Desktop screenshots

The supplied guides do not specify two exact screenshot layouts. These two views provide evidence of the requested services and database storage:

1. Open Docker Desktop **Containers**, expand the **node-auth-app** Compose project, and show all three rows (`frontend-1`, `backend-1`, `db-1`) with running indicators and the frontend port `5173:80`. Widen the window so names, status, and port are readable. Press **Win+Shift+S** and save as `01-compose-containers.png`.
2. Open Docker Desktop **Volumes**, select **node-auth-app_db-data**, and show its details and the attached/in-use `node-auth-app-db-1` container. If that view does not show the mount path, open Containers → `node-auth-app-db-1` → Inspect and show the `Mounts` entry with type `volume`, name `node-auth-app_db-data`, and destination `/var/lib/postgresql`. Capture as `02-postgres-volume.png`.

For image-size evidence during Loom, use Docker Desktop Images and filter `node-auth-app`, or show the comparison command below. Compare the same size column across tags.

## Loom sequence

Start screen recording with VS Code, Docker Desktop, and the browser available. Run each command separately and explain its output. Leave Compose running at the end.

```powershell
Set-Location 'C:\Users\Martine\Desktop\505_assignments\node-auth-app\node-auth-app'
docker --version
docker compose version
Get-Content Dockerfile
Get-Content Dockerfile.multistage
Get-Content .dockerignore
docker image ls node-auth-app
docker history node-auth-app:simple
docker history node-auth-app:multistage
Get-Content docker-compose.yml
Get-Content nginx.conf
docker compose up --build -d --wait --wait-timeout 120
docker compose ps
docker compose exec -T backend wget -qO- http://localhost:3000/api/health
docker compose exec -T db psql -U app -d auth -c "SELECT username, created_at FROM users ORDER BY created_at DESC LIMIT 5;"
docker inspect node-auth-app-db-1 --format '{{json .Mounts}}'
npx.cmd playwright test --config playwright.compose.config.js --headed
```

Explain: nginx serves built assets and proxies `/api` to Express; Express connects to PostgreSQL through the private Compose network; only frontend port 5173 is published. The database healthcheck controls startup order. The named volume preserves users independently of container lifetimes.

Open `http://localhost:5173/#/register`. Choose a NEW username (for example `loom_` plus the current time), use `secret123`, register, log in, and show the welcome heading. Log out, refresh, and log in with the SAME credentials to demonstrate database persistence. Existing usernames cannot be registered twice.

To demonstrate persistence across container recreation during the recording (optional; briefly interrupts the app):

```powershell
docker compose down
docker compose up -d --wait --wait-timeout 120
docker compose ps
```

Then log in with the same Loom account. `down` without the volume flag preserves the named volume. Never use `docker compose down -v`, `docker volume prune`, or `docker system prune --volumes` for this assignment.

The `simple`, `alpine`, and `multistage` comparison tags preserve the standalone Docker-guide images. The current source and Dockerfile.multistage have subsequently been adapted for Compose. Compose builds its own frontend/backend images; use the existing comparison tags for the historical size comparison.
