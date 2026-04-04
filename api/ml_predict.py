"""Vercel serverless entry: POST JSON {\"rows\":[{...}]} -> {\"probabilities\":[...]} ."""
from __future__ import annotations

import json
import sys
from http.server import BaseHTTPRequestHandler
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from inference import model_available, predict_fraud_probabilities  # noqa: E402


class handler(BaseHTTPRequestHandler):
    def do_OPTIONS(self) -> None:
        self.send_response(204)
        self._cors_headers()
        self.end_headers()

    def do_POST(self) -> None:
        length = int(self.headers.get("Content-Length", "0") or 0)
        raw = self.rfile.read(length) if length else b"{}"
        try:
            body = json.loads(raw.decode("utf-8") or "{}")
        except json.JSONDecodeError:
            self._json(400, {"error": "invalid_json"})
            return
        rows = body.get("rows")
        if not isinstance(rows, list):
            self._json(400, {"error": "expected_rows_array"})
            return
        if not model_available():
            self._json(503, {"error": "model_unavailable"})
            return
        try:
            probs = predict_fraud_probabilities(rows)
        except FileNotFoundError:
            self._json(503, {"error": "model_unavailable"})
            return
        except Exception as exc:  # noqa: BLE001 — surface as 500 for ops
            self._json(500, {"error": "inference_failed", "detail": str(exc)})
            return
        self._json(200, {"probabilities": probs})

    def _cors_headers(self) -> None:
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")

    def _json(self, status: int, payload: dict) -> None:
        data = json.dumps(payload).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(data)))
        self._cors_headers()
        self.end_headers()
        self.wfile.write(data)

    def log_message(self, fmt: str, *args) -> None:  # noqa: A003
        return
