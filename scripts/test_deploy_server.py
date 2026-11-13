"""Local HTTP tests; Docker is mocked and no registry or volume is changed."""
import contextlib
import hashlib
import hmac
import http.client
import importlib.util
import io
import json
from pathlib import Path
import secrets
import threading
import unittest
from unittest.mock import patch, Mock

spec = importlib.util.spec_from_file_location("deploy_server", Path(__file__).resolve().parents[1] / "deployment" / "deploy_server.py")
server = importlib.util.module_from_spec(spec)
spec.loader.exec_module(server)


def payload(**changes):
    info = {"name": "CI/CD", "head_branch": "main", "conclusion": "success", "head_sha": "a" * 40}
    info.update(changes)
    return {"action": "completed", "workflow_run": info}


class WebhookTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        server.SECRET = secrets.token_hex(32)
        cls.httpd = server.ThreadingHTTPServer(("127.0.0.1", 0), server.Handler)
        cls.thread = threading.Thread(target=cls.httpd.serve_forever, daemon=True)
        cls.thread.start()

    @classmethod
    def tearDownClass(cls):
        cls.httpd.shutdown()
        cls.httpd.server_close()
        cls.thread.join()

    def request(self, body=None, event="workflow_run", signed=True, path="/deploy", method="POST", headers=None):
        if body is None:
            body = json.dumps(payload()).encode()
        request_headers = {"X-GitHub-Event": event, "Content-Type": "application/json"}
        if signed:
            request_headers["X-Hub-Signature-256"] = "sha256=" + hmac.new(server.SECRET.encode(), body, hashlib.sha256).hexdigest()
        request_headers.update(headers or {})
        connection = http.client.HTTPConnection(*self.httpd.server_address, timeout=5)
        connection.request(method, path, body=body, headers=request_headers)
        response = connection.getresponse()
        result = response.status, response.read().decode()
        connection.close()
        return result

    def test_health(self):
        self.assertEqual(self.request(method="GET")[0], 200)

    def test_ping(self):
        self.assertEqual(self.request(event="ping"), (200, "pong\n"))

    def test_unsigned_ping_rejected(self):
        self.assertEqual(self.request(event="ping", signed=False)[0], 401)

    def test_missing_signature(self):
        with patch.object(server, "deploy") as deploy:
            self.assertEqual(self.request(signed=False)[0], 401)
            deploy.assert_not_called()

    def test_bad_signature(self):
        self.assertEqual(self.request(headers={"X-Hub-Signature-256": "sha256=invalid"})[0], 401)

    def test_tampered_body(self):
        signature = "sha256=" + hmac.new(server.SECRET.encode(), b"different body", hashlib.sha256).hexdigest()
        self.assertEqual(self.request(headers={"X-Hub-Signature-256": signature})[0], 401)

    def test_wrong_route(self):
        self.assertEqual(self.request(path="/other")[0], 404)

    def test_push_event_ignored(self):
        with patch.object(server, "deploy") as deploy:
            status, text = self.request(event="push")
            self.assertEqual(status, 202)
            self.assertIn("Ignored", text)
            deploy.assert_not_called()

    def test_malformed_json(self):
        self.assertEqual(self.request(body=b"{")[0], 400)

    def test_invalid_utf8(self):
        self.assertEqual(self.request(body=b"\xff")[0], 400)

    def test_invalid_payload_shapes(self):
        for value in [[], None, "string", {}, {"workflow_run": []}]:
            with self.subTest(value=value), patch.object(server, "deploy") as deploy:
                self.assertEqual(self.request(body=json.dumps(value).encode())[0], 202)
                deploy.assert_not_called()

    def test_failed_run_does_not_deploy(self):
        with patch.object(server, "deploy") as deploy:
            status, text = self.request(body=json.dumps(payload(conclusion="failure")).encode())
            self.assertEqual(status, 202)
            self.assertIn("failure", text)
            deploy.assert_not_called()

    def test_non_success_conclusions_ignored(self):
        for conclusion in ["cancelled", "timed_out", "skipped", None]:
            with self.subTest(conclusion=conclusion), patch.object(server, "deploy") as deploy:
                self.assertEqual(self.request(body=json.dumps(payload(conclusion=conclusion)).encode())[0], 202)
                deploy.assert_not_called()

    def test_wrong_branch_ignored(self):
        with patch.object(server, "deploy") as deploy:
            self.assertEqual(self.request(body=json.dumps(payload(head_branch="feature")).encode())[0], 202)
            deploy.assert_not_called()

    def test_wrong_workflow_ignored(self):
        with patch.object(server, "deploy") as deploy:
            self.assertEqual(self.request(body=json.dumps(payload(name="Other")).encode())[0], 202)
            deploy.assert_not_called()

    def test_incomplete_run_ignored(self):
        data = payload()
        data["action"] = "in_progress"
        with patch.object(server, "deploy") as deploy:
            self.assertEqual(self.request(body=json.dumps(data).encode())[0], 202)
            deploy.assert_not_called()

    def test_missing_commit_ignored(self):
        self.assertIsNotNone(server.reason_to_ignore(payload(head_sha="")))

    def test_success_acknowledged_and_deployed_in_background(self):
        called = threading.Event()
        with patch.object(server, "deploy", side_effect=lambda commit: called.set()) as deploy:
            self.assertEqual(self.request(), (202, "Deploy started\n"))
            self.assertTrue(called.wait(2))
            deploy.assert_called_once_with("a" * 40)

    def test_oversized_body(self):
        self.assertEqual(self.request(body=b"", headers={"Content-Length": str(server.MAX_BODY + 1)})[0], 413)

    def test_invalid_length(self):
        self.assertEqual(self.request(body=b"", headers={"Content-Length": "invalid"})[0], 400)

    def test_empty_secret_never_authenticates(self):
        with patch.object(server, "SECRET", ""):
            self.assertFalse(server.signature_ok(b"{}", "sha256=invalid"))

    def test_secret_redacted(self):
        self.assertNotIn(server.SECRET, server.redact("value=" + server.SECRET))

    def test_successful_deploy_pulls_before_up(self):
        with patch.object(server, "run", return_value=True) as run:
            server.deploy("a" * 40)
            self.assertEqual([call.args[0][-1] for call in run.call_args_list], ["pull", "-d"])
            self.assertEqual(run.call_args_list[1].args[0][-2:], ["up", "-d"])

    def test_failed_pull_never_runs_up(self):
        with patch.object(server, "run", return_value=False) as run:
            server.deploy("a" * 40)
            run.assert_called_once()

    def test_docker_output_is_redacted(self):
        completed = Mock(returncode=0, stdout=server.SECRET, stderr="")
        output = io.StringIO()
        with patch.object(server.subprocess, "run", return_value=completed), contextlib.redirect_stdout(output):
            self.assertTrue(server.run(["docker", "compose", "pull"]))
        self.assertNotIn(server.SECRET, output.getvalue())


if __name__ == "__main__":
    unittest.main()
