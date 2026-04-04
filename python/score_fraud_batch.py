#!/usr/bin/env python3
"""
Batch fraud scoring for the Next.js app.

Reads JSON from stdin:
  {"rows": [ {same keys as notebook df_raw row}, ... ], "model_dir": "/optional/path"}

Writes JSON to stdout:
  {"probabilities": [float, ...], "threshold": float, "error": null | string}

Requires: pandas, numpy, joblib, scikit-learn, and (if your pipeline uses them) xgboost, lightgbm, catboost.

Place artifacts next to this file or set model_dir:
  fraud_model.joblib
  threshold.json
  feature_order.json
"""

from __future__ import annotations

import json
import os
import sys
from pathlib import Path

import joblib
import pandas as pd

DROP_FROM_FEATURES = {"order_id", "order_datetime", "birthdate", "customer_created_at"}


def add_features(frame: pd.DataFrame) -> pd.DataFrame:
    out = frame.copy()
    dt = pd.to_datetime(out["order_datetime"])
    out["order_hour"] = dt.dt.hour.astype(float)
    out["order_dow"] = dt.dt.dayofweek.astype(float)
    out["order_month"] = dt.dt.month.astype(float)
    out["is_weekend"] = (dt.dt.dayofweek >= 5).astype(int)
    out["zip_mismatch"] = (out["billing_zip"].astype(str) != out["shipping_zip"].astype(str)).astype(int)
    cust_created = pd.to_datetime(out["customer_created_at"])
    out["tenure_days"] = (dt - cust_created).dt.days.clip(lower=0).astype(float)
    out["state_mismatch"] = (out["shipping_state"].astype(str) != out["customer_state"].astype(str)).astype(int)
    bd = pd.to_datetime(out["birthdate"])
    out["age_years"] = ((dt - bd).dt.days / 365.25).clip(0, 120).astype(float)
    return out


def resolve_model_dir(payload: dict | None, script_dir: Path) -> Path:
    """Same rules as CLI: payload model_dir, env, ./model/, or app root."""
    app_root = script_dir.parent
    default_dir = app_root / "model"
    env_dir = os.environ.get("FRAUD_MODEL_DIR")
    if payload and payload.get("model_dir"):
        return Path(str(payload["model_dir"])).resolve()
    if env_dir:
        return Path(env_dir).resolve()
    if (default_dir / "fraud_model.joblib").is_file():
        return default_dir
    return app_root.resolve()


def score_rows(rows: list, model_dir: Path) -> dict:
    """
    Returns {"probabilities": [...], "threshold": float, "error": str | None}.
    Used by CLI stdin/stdout and by scorer_api (FastAPI).
    """
    model_path = model_dir / "fraud_model.joblib"
    threshold_path = model_dir / "threshold.json"
    feature_path = model_dir / "feature_order.json"

    if not model_path.is_file():
        return {"probabilities": [], "threshold": 0.5, "error": f"missing model: {model_path}"}

    try:
        pipe = joblib.load(model_path)
        with open(threshold_path, encoding="utf-8") as f:
            thr_data = json.load(f)
        threshold = float(thr_data["threshold"])

        with open(feature_path, encoding="utf-8") as f:
            fo = json.load(f)
        all_cols = fo.get("all_columns")
        if not all_cols:
            return {"probabilities": [], "threshold": threshold, "error": "feature_order.json missing all_columns"}

        df_raw = pd.DataFrame(rows)
        df = add_features(df_raw)
        feature_df = df.drop(columns=list(DROP_FROM_FEATURES) + ["is_fraud"], errors="ignore")
        X = feature_df[all_cols]
        probs = pipe.predict_proba(X)[:, 1].astype(float)
        return {"probabilities": [float(p) for p in probs], "threshold": threshold, "error": None}
    except Exception as e:  # noqa: BLE001 — return JSON-safe error to caller
        return {"probabilities": [], "threshold": 0.5, "error": str(e)}


def main() -> None:
    raw = sys.stdin.read()
    if not raw.strip():
        print(json.dumps({"probabilities": [], "threshold": 0.5, "error": "empty stdin"}))
        sys.exit(1)

    try:
        payload = json.loads(raw)
    except json.JSONDecodeError as e:
        print(json.dumps({"probabilities": [], "threshold": 0.5, "error": str(e)}))
        sys.exit(1)

    rows = payload.get("rows") or []
    script_dir = Path(__file__).resolve().parent
    model_dir = resolve_model_dir(payload, script_dir)
    out = score_rows(rows, model_dir)
    print(json.dumps(out))
    if out.get("error"):
        sys.exit(1)


if __name__ == "__main__":
    main()
