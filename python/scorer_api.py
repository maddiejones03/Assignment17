"""
HTTP fraud scorer for Vercel-adjacent deploy (Railway, Render, Fly, etc.).

POST /score  JSON {"rows": [ ... ]}  ->  {"probabilities": [...], "threshold": float, "error": null | str}

Set FRAUD_MODEL_DIR to the directory containing fraud_model.joblib, threshold.json, feature_order.json
(default in Docker: /app/model).

Run locally:
  export FRAUD_MODEL_DIR=/path/to/assignment17-app
  uvicorn scorer_api:app --reload --port 8765

Next.js (Vercel server env):
  FRAUD_SCORING_URL=https://your-service.up.railway.app/score
"""

from __future__ import annotations

import os
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from score_fraud_batch import score_rows

app = FastAPI(title="Fraud batch scorer")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


def model_dir() -> Path:
    return Path(os.environ.get("FRAUD_MODEL_DIR", "/app/model")).resolve()


class ScoreBody(BaseModel):
    rows: list[dict]


@app.get("/health")
def health() -> dict:
    d = model_dir()
    ok = (d / "fraud_model.joblib").is_file()
    return {"ok": ok, "model_dir": str(d)}


@app.post("/score")
def score(body: ScoreBody) -> dict:
    return score_rows(body.rows, model_dir())
