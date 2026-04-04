"""
Vercel Python Serverless Function (handler class).

Endpoint: POST /api/fraud_score  body: {"rows": [...]}
Response: {"probabilities": [...], "threshold": float, "error": null | str}

Place fraud_model.joblib + threshold.json + feature_order.json in project root or model/.
"""

from __future__ import annotations

import json
import os
import sys
from http.server import BaseHTTPRequestHandler
from pathlib import Path

_ROOT = Path(__file__).resolve().parent.parent
_py = _ROOT / "python"
if _py.is_dir() and str(_py) not in sys.path:
    sys.path.insert(0, str(_py))

from score_fraud_batch import score_rows  # noqa: E402


def _model_dir() -> Path:
    env = os.environ.get("FRAUD_MODEL_DIR")
    if env:
        return Path(env).resolve()
    if (_ROOT / "model" / "fraud_model.joblib").is_file():
        return (_ROOT / "model").resolve()
    if (_ROOT / "fraud_model.joblib").is_file():
        return _ROOT.resolve()
    return (_ROOT / "model").resolve()


_MODEL_DIR = _model_dir()


class handler(BaseHTTPRequestHandler):
    def do_GET(self) -> None:
        ok = (_MODEL_DIR / "fraud_model.joblib").is_file()
        self._send_json(
            200, {"ok": ok, "model_dir": str(_MODEL_DIR)}
        )

    def do_POST(self) -> None:
        length = int(self.headers.get("Content-Length", 0))
        raw = self.rfile.read(length) if length else b""
        try:
            payload = json.loads(raw.decode("utf-8") or "{}")
            rows = payload.get("rows") or []
            result = score_rows(rows, _MODEL_DIR)
        except Exception as e:  # noqa: BLE001
            result = {"probabilities": [], "threshold": 0.5, "error": str(e)}
        self._send_json(200, result)

    def _send_json(self, status: int, obj: dict) -> None:
        body = json.dumps(obj).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, format: str, *args) -> None:  # noqa: A003
        return
