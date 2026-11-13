"""Receive signed GitHub workflow_run webhooks and redeploy the CI/CD app.

Python 3.10+, standard library only. Set WEBHOOK_SECRET before starting.
Based on the server provided in CICD_EXERCISE.pdf, with input validation,
explicit working directory and a request-size limit added.
"""
import hashlib
import hmac
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
import threading
from datetime import datetime
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

SECRET = os.environ.get("WEBHOOK_SECRET", "")
COMPOSE_FILE = str(Path(os.environ.get("COMPOSE_FILE", str(Path(__file__).with_name("docker-compose.deploy.yml")))).resolve())
WORKFLOW_NAME = os.environ.get("WORKFLOW_NAME", "CI/CD")
BRANCH = os.environ.get("BRANCH", "main")
PORT = int(os.environ.get("PORT", "9000"))
MAX_BODY = 2 * 1024 * 1024
deploy_lock = threading.Lock()


def log(message):
    print(f"[{datetime.now():%H:%M:%S}] {message}", flush=True)


def signature_ok(body, header):
    if not SECRET or not isinstance(header, str):
        return False
    expected = "sha256=" + hmac.new(SECRET.encode(), body, hashlib.sha256).hexdigest()
    try:
        return hmac.compare_digest(expected, header)
    except TypeError:
        return False


def redact(output):
    """Never print known environment/local configuration secret values."""
    values = [value for key, value in os.environ.items()
              if any(word in key.upper() for word in ("SECRET", "TOKEN", "PASSWORD", "DATABASE_URL"))]
    env_file = Path(COMPOSE_FILE).parent / ".env"
    if env_file.is_file():
        for line in env_file.read_text(encoding="utf-8-sig").splitlines():
            key, sep, value = line.partition("=")
            if sep and any(word in key.upper() for word in ("SECRET", "TOKEN", "PASSWORD", "DATABASE_URL")):
                values.append(value.strip().strip("\"'"))
    if SECRET:
        values.append(SECRET)
    for value in sorted(set(values), key=len, reverse=True):
        if value:
            output = output.replace(value, "[REDACTED]")
    return output


def run(args):
    log("Running: " + " ".join(args))
    try:
        result = subprocess.run(args, cwd=str(Path(COMPOSE_FILE).parent),
                                capture_output=True, text=True, encoding="utf-8",
                                errors="replace", timeout=1200)
    except (OSError, subprocess.TimeoutExpired):
        log("Docker command could not complete; check Docker Desktop and registry access.")
        return False
    output = (result.stdout + result.stderr).strip()
    if output:
        print(redact(output), flush=True)
    return result.returncode == 0


def deploy(commit):
    with deploy_lock:
        log(f"Deploying commit {commit[:7]}...")
        compose = ["docker", "compose", "-f", COMPOSE_FILE]
        if run(compose + ["pull"]) and run(compose + ["up", "-d"]):
            log(f"Deploy finished: commit {commit[:7]} is live on http://localhost:5173")
        else:
            log("Deploy FAILED (see the output above)")


def reason_to_ignore(payload):
    if not isinstance(payload, dict):
        return "payload is not an object"
    run_info = payload.get("workflow_run")
    if not isinstance(run_info, dict):
        return "workflow_run is missing or invalid"
    if payload.get("action") != "completed":
        return "waiting for action 'completed'"
    if run_info.get("name") != WORKFLOW_NAME:
        return "workflow name does not match"
    if run_info.get("head_branch") != BRANCH:
        return "branch does not match"
    if run_info.get("conclusion") != "success":
        return f"workflow conclusion is '{run_info.get('conclusion')}'"
    commit = run_info.get("head_sha", "")
    if not isinstance(commit, str) or not commit:
        return "commit SHA is missing or invalid"
    return None


class Handler(BaseHTTPRequestHandler):
    def do_GET(self):
        self.reply(200, "Deploy server is running")

    def do_POST(self):
        if self.path != "/deploy":
            return self.reply(404, "Not found")
        try:
            length = int(self.headers.get("Content-Length", "0"))
        except ValueError:
            return self.reply(400, "Invalid content length")
        if not 0 <= length <= MAX_BODY:
            return self.reply(413, "Request body too large")
        self.connection.settimeout(10)
        try:
            body = self.rfile.read(length)
        except (OSError, TimeoutError):
            return self.reply(408, "Request timed out")
        if not signature_ok(body, self.headers.get("X-Hub-Signature-256")):
            log("Rejected a request with an invalid signature")
            return self.reply(401, "Invalid signature")
        event = self.headers.get("X-GitHub-Event")
        if event == "ping":
            log("Ping from GitHub: the webhook is connected")
            return self.reply(200, "pong")
        if event != "workflow_run":
            return self.reply(202, "Ignored event")
        try:
            payload = json.loads(body)
        except (json.JSONDecodeError, UnicodeDecodeError):
            return self.reply(400, "Body is not JSON (set content type to application/json)")
        reason = reason_to_ignore(payload)
        if reason:
            log(f"Ignored: {reason}")
            return self.reply(202, f"Ignored: {reason}")
        commit = payload["workflow_run"]["head_sha"]
        threading.Thread(target=deploy, args=(commit,), daemon=True).start()
        self.reply(202, "Deploy started")

    def reply(self, status, text):
        data = (text + "\n").encode()
        self.send_response(status)
        self.send_header("Content-Type", "text/plain; charset=utf-8")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def log_message(self, *args):
        pass


if __name__ == "__main__":
    if not SECRET:
        sys.exit("Set the WEBHOOK_SECRET environment variable first.")
    if not shutil.which("docker"):
        sys.exit("Docker CLI not found. Start Docker Desktop and check PATH.")
    if not Path(COMPOSE_FILE).is_file():
        sys.exit("Deployment Compose file not found.")
    log(f"Deploy server listening on http://localhost:{PORT} (POST /deploy)")
    log(f"Deploys successful '{WORKFLOW_NAME}' runs on '{BRANCH}'")
    try:
        ThreadingHTTPServer(("127.0.0.1", PORT), Handler).serve_forever()
    except KeyboardInterrupt:
        log("Stopped")
