"""
Prediction logger for NetSentinel-MLOps.
Logs each prediction request to a JSON Lines file for monitoring,
drift detection, and audit trail.
"""
import csv
import hashlib
import json
import os
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


LOG_DIR = Path(os.getenv("PREDICTION_LOG_DIR", "prediction_output/logs"))
LOG_FILE = LOG_DIR / "predictions.jsonl"
SUMMARY_FILE = LOG_DIR / "summary.csv"


def _ensure_log_dir() -> None:
    LOG_DIR.mkdir(parents=True, exist_ok=True)


def _hash_features(features: dict) -> str:
    """Create a short hash of the feature dict for deduplication tracking."""
    feature_str = json.dumps(features, sort_keys=True)
    return hashlib.sha256(feature_str.encode()).hexdigest()[:12]


def log_prediction(
    features: dict[str, Any],
    prediction: int,
    confidence: float | None = None,
    model_version: str = "1.0.0",
    latency_ms: float | None = None,
) -> dict[str, Any]:
    """
    Log a single prediction to the JSONL log file.

    Args:
        features: Input feature dict (URL features)
        prediction: Raw model output (1=phishing, -1=legitimate)
        confidence: Optional confidence score [0.0, 1.0]
        model_version: Model version string
        latency_ms: Inference latency in milliseconds

    Returns:
        The log entry dict
    """
    _ensure_log_dir()

    label_map = {1: "PHISHING", -1: "LEGITIMATE", 0: "LEGITIMATE"}
    label = label_map.get(int(prediction), "UNKNOWN")

    entry = {
        "timestamp": datetime.now(tz=timezone.utc).isoformat(),
        "features_hash": _hash_features(features),
        "feature_count": len(features),
        "prediction": int(prediction),
        "label": label,
        "confidence": round(float(confidence), 4) if confidence is not None else None,
        "model_version": model_version,
        "latency_ms": round(float(latency_ms), 2) if latency_ms is not None else None,
    }

    with open(LOG_FILE, "a", encoding="utf-8") as f:
        f.write(json.dumps(entry) + "\n")

    return entry


def log_batch_predictions(
    features_list: list[dict[str, Any]],
    predictions: list[int],
    confidences: list[float] | None = None,
    model_version: str = "1.0.0",
    latency_ms: float | None = None,
) -> list[dict[str, Any]]:
    """
    Log a batch of predictions at once.

    Args:
        features_list: List of feature dicts
        predictions: List of model outputs
        confidences: Optional list of confidence scores
        model_version: Model version string
        latency_ms: Total batch latency in milliseconds

    Returns:
        List of log entry dicts
    """
    _ensure_log_dir()

    if confidences is None:
        confidences = [None] * len(predictions)

    per_item_latency = (latency_ms / len(predictions)) if latency_ms and len(predictions) > 0 else None

    entries = []
    for features, pred, conf in zip(features_list, predictions, confidences, strict=False):
        entry = log_prediction(
            features=features,
            prediction=pred,
            confidence=conf,
            model_version=model_version,
            latency_ms=per_item_latency,
        )
        entries.append(entry)

    return entries


def get_prediction_summary() -> dict[str, Any]:
    """
    Read the prediction log and return aggregate statistics.

    Returns:
        Summary dict with counts, rates, and recent history
    """
    _ensure_log_dir()

    if not LOG_FILE.exists():
        return {
            "total_predictions": 0,
            "phishing_count": 0,
            "legitimate_count": 0,
            "phishing_rate": 0.0,
            "avg_confidence": None,
            "avg_latency_ms": None,
            "recent_entries": [],
        }

    entries = []
    with open(LOG_FILE, encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if line:
                try:
                    entries.append(json.loads(line))
                except json.JSONDecodeError:
                    continue

    total = len(entries)
    if total == 0:
        return {
            "total_predictions": 0,
            "phishing_count": 0,
            "legitimate_count": 0,
            "phishing_rate": 0.0,
            "avg_confidence": None,
            "avg_latency_ms": None,
            "recent_entries": [],
        }

    phishing_count = sum(1 for e in entries if e.get("label") == "PHISHING")
    legitimate_count = total - phishing_count

    confidences = [e["confidence"] for e in entries if e.get("confidence") is not None]
    latencies = [e["latency_ms"] for e in entries if e.get("latency_ms") is not None]

    avg_confidence = round(sum(confidences) / len(confidences), 4) if confidences else None
    avg_latency = round(sum(latencies) / len(latencies), 2) if latencies else None

    return {
        "total_predictions": total,
        "phishing_count": phishing_count,
        "legitimate_count": legitimate_count,
        "phishing_rate": round(phishing_count / total, 4) if total > 0 else 0.0,
        "avg_confidence": avg_confidence,
        "avg_latency_ms": avg_latency,
        "recent_entries": entries[-10:],
    }


def export_summary_csv() -> Path:
    """Export a summary CSV with one row per prediction (for spreadsheet analysis)."""
    _ensure_log_dir()

    if not LOG_FILE.exists():
        return SUMMARY_FILE

    entries = []
    with open(LOG_FILE, encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if line:
                try:
                    entries.append(json.loads(line))
                except json.JSONDecodeError:
                    continue

    if not entries:
        return SUMMARY_FILE

    fieldnames = ["timestamp", "features_hash", "feature_count", "prediction", "label", "confidence", "model_version", "latency_ms"]

    with open(SUMMARY_FILE, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        for entry in entries:
            writer.writerow({k: entry.get(k, "") for k in fieldnames})

    return SUMMARY_FILE
