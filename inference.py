"""
Offline + Vercel Python inference for fraud_model.joblib.

Artifacts are expected next to this file (repo root): fraud_model.joblib, feature_order.json.
Training uses shop.db beside the notebooks; the Next.js app uses Supabase or mock data at runtime.
"""
from __future__ import annotations

import json
from pathlib import Path

import joblib
import pandas as pd

ROOT_DIR = Path(__file__).resolve().parent


def artifact_paths() -> tuple[Path, Path]:
    return ROOT_DIR / "fraud_model.joblib", ROOT_DIR / "feature_order.json"


def model_available() -> bool:
    model_path, feature_path = artifact_paths()
    return model_path.is_file() and feature_path.is_file()


def add_features(frame: pd.DataFrame) -> pd.DataFrame:
    out = frame.copy()
    dt = pd.to_datetime(out["order_datetime"])
    out["order_hour"] = dt.dt.hour.astype(float)
    out["order_dow"] = dt.dt.dayofweek.astype(float)
    out["order_month"] = dt.dt.month.astype(float)
    out["is_weekend"] = (dt.dt.dayofweek >= 5).astype(int)
    out["zip_mismatch"] = (
        out["billing_zip"].astype(str) != out["shipping_zip"].astype(str)
    ).astype(int)
    cust_created = pd.to_datetime(out["customer_created_at"])
    out["tenure_days"] = (dt - cust_created).dt.days.clip(lower=0).astype(float)
    out["state_mismatch"] = (
        out["shipping_state"].astype(str) != out["customer_state"].astype(str)
    ).astype(int)
    bd = pd.to_datetime(out["birthdate"])
    out["age_years"] = ((dt - bd).dt.days / 365.25).clip(0, 120).astype(float)
    return out


def load_feature_columns() -> list[str]:
    _, feature_path = artifact_paths()
    with open(feature_path, encoding="utf-8") as f:
        meta = json.load(f)
    return list(meta["all_columns"])


def predict_fraud_probabilities(payloads: list[dict]) -> list[float]:
    if not payloads:
        return []
    model_path, _ = artifact_paths()
    if not model_path.is_file():
        raise FileNotFoundError(str(model_path))
    feature_cols = load_feature_columns()
    pipe = joblib.load(model_path)
    frames: list[pd.DataFrame] = []
    for p in payloads:
        row = pd.DataFrame([p])
        row = add_features(row)
        frames.append(row[feature_cols])
    x = pd.concat(frames, ignore_index=True)
    probs = pipe.predict_proba(x)[:, 1]
    return [float(x) for x in probs]
