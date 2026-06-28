import os
import sys
from pathlib import Path
from typing import Annotated
from urllib.parse import quote_plus

import certifi
import pandas as pd
from dotenv import load_dotenv
from fastapi import FastAPI, File, HTTPException, Request, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse, JSONResponse, Response
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from pymongo.mongo_client import MongoClient
from pymongo.server_api import ServerApi
from starlette.responses import RedirectResponse
from starlette.templating import _TemplateResponse
from uvicorn import run as app_run

from network_security.constant.training_pipeline import (
    DATA_INGESTION_COLLECTION_NAME,
    DATA_INGESTION_DATABASE_NAME,
)
from network_security.exception.exception import NetworkSecurityException
from network_security.logging.logger import logging
from network_security.pipeline.training_pipeline import TrainingPipeline
from network_security.utils.main_utils.utils import load_object
from network_security.utils.ml_utils.model.estimator import NetworkModel
from monitoring.prediction_logger import get_prediction_summary, log_batch_predictions

ca = certifi.where()

load_dotenv()

# Support both local MongoDB (via host/port) and MongoDB Atlas
_mongo_host = os.getenv("MONGO_DB_HOST", "")
_username = os.getenv("MONGO_DB_USERNAME", "")
_password = os.getenv("MONGO_DB_PASSWORD", "")

if _mongo_host and not _mongo_host.endswith(".mongodb.net"):
    # Local MongoDB (Docker)
    _port = os.getenv("MONGO_DB_PORT", "27017")
    mongo_db_url = f"mongodb://{quote_plus(_username)}:{quote_plus(_password)}@{_mongo_host}:{_port}/"
    client = MongoClient(mongo_db_url)
else:
    # MongoDB Atlas
    mongo_db_url = (
        f"mongodb+srv://{quote_plus(_username)}:{quote_plus(_password)}"
        "@cluster0.l5ee6dv.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0"
    )
    client = MongoClient(mongo_db_url, server_api=ServerApi("1"), tlsCAFile=ca)

database = client[DATA_INGESTION_DATABASE_NAME]
collection = database[DATA_INGESTION_COLLECTION_NAME]

app = FastAPI(
    title="NetSentinel-MLOps",
    description="AI-powered phishing URL detection system by Rayen Lassoued",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

templates = Jinja2Templates(directory="./templates")


@app.get("/", tags=["root"])
async def index() -> RedirectResponse:
    return RedirectResponse(url="/ui")


@app.get("/health", tags=["monitoring"])
async def health_check() -> JSONResponse:
    """Health check endpoint for Docker and load balancers."""
    try:
        # Verify MongoDB is reachable
        client.admin.command("ping")
        db_status = "connected"
    except Exception:
        db_status = "unavailable"

    model_loaded = Path("final_model/model.pkl").exists()

    status = "healthy" if db_status == "connected" and model_loaded else "degraded"
    return JSONResponse(
        content={
            "status": status,
            "service": "NetSentinel-MLOps",
            "version": "1.0.0",
            "database": db_status,
            "model_loaded": model_loaded,
        },
        status_code=200 if status == "healthy" else 207,
    )


@app.get("/metrics", tags=["monitoring"])
async def metrics() -> JSONResponse:
    """Model and prediction metrics endpoint."""
    summary = get_prediction_summary()
    return JSONResponse(
        content={
            "model_name": "NetSentinel-MLOps Phishing Detector",
            "algorithm": "Best of RandomForest/GradientBoosting/AdaBoost/DecisionTree/LogReg",
            "features_count": 30,
            "target_classes": {"1": "PHISHING", "-1": "LEGITIMATE"},
            "model_path": "final_model/model.pkl",
            "prediction_stats": {
                "total_predictions_served": summary["total_predictions"],
                "phishing_detected": summary["phishing_count"],
                "legitimate_classified": summary["legitimate_count"],
                "phishing_rate": summary["phishing_rate"],
                "avg_confidence": summary["avg_confidence"],
                "avg_latency_ms": summary["avg_latency_ms"],
            },
        }
    )


@app.get("/train", tags=["pipeline"])
async def train_route() -> Response:
    """Trigger the full training pipeline."""
    try:
        train_pipeline = TrainingPipeline()
        train_pipeline.run_pipeline()
        return Response("Training pipeline completed successfully")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e)) from e


@app.post("/api/predict", tags=["inference"])
async def predict_json(
    file: Annotated[UploadFile, File(description="CSV file with URL features")] = ...,
) -> JSONResponse:
    """Run batch prediction, return JSON instead of HTML table."""
    import time as _time
    try:
        if not file.filename or not file.filename.endswith(".csv"):
            raise HTTPException(status_code=400, detail="Only CSV files are accepted")
        df = pd.read_csv(file.file)
        if df.empty:
            raise HTTPException(status_code=400, detail="Uploaded CSV is empty")

        preprocessor = load_object("final_model/preprocessor.pkl")
        final_model = load_object("final_model/model.pkl")
        network_model = NetworkModel(preprocessor=preprocessor, model=final_model)

        t0 = _time.perf_counter()
        y_pred = network_model.predict(df)
        latency_ms = (_time.perf_counter() - t0) * 1000

        df["prediction"] = y_pred
        df["prediction_label"] = df["prediction"].map({1: "PHISHING", -1: "LEGITIMATE"})

        features_list = df.drop(columns=["prediction", "prediction_label"], errors="ignore").to_dict(orient="records")
        log_batch_predictions(features_list=features_list, predictions=y_pred.tolist(), model_version="1.0.0", latency_ms=latency_ms)

        import math
        rows = df.to_dict(orient="records")
        # Sanitize values: numpy scalars → Python, NaN/Inf → None
        for row in rows:
            for k, v in row.items():
                if hasattr(v, 'item'):
                    v = v.item()
                if isinstance(v, float) and (math.isnan(v) or math.isinf(v)):
                    v = None
                row[k] = v

        phishing = int((df["prediction"] == 1).sum())
        total = len(df)
        PREVIEW_LIMIT = 500
        return JSONResponse(content={
            "total": total,
            "phishing": phishing,
            "legitimate": total - phishing,
            "phishing_rate": round(phishing / total, 4) if total > 0 else 0.0,
            "latency_ms": round(latency_ms, 2),
            "rows": rows[:PREVIEW_LIMIT],
            "rows_truncated": total > PREVIEW_LIMIT,
        })
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e)) from e


@app.post("/predict", tags=["inference"])
async def predict_route(
    request: Request,
    file: Annotated[UploadFile, File(description="CSV file with URL features")] = ...,
) -> _TemplateResponse:
    """Run batch prediction on uploaded CSV of URL features."""
    try:
        if not file.filename or not file.filename.endswith(".csv"):
            raise HTTPException(status_code=400, detail="Only CSV files are accepted")

        df = pd.read_csv(file.file)

        if df.empty:
            raise HTTPException(status_code=400, detail="Uploaded CSV is empty")

        preprocessor = load_object("final_model/preprocessor.pkl")
        final_model = load_object("final_model/model.pkl")
        network_model = NetworkModel(preprocessor=preprocessor, model=final_model)

        import time as _time
        t0 = _time.perf_counter()
        y_pred = network_model.predict(df)
        latency_ms = (_time.perf_counter() - t0) * 1000

        df["predicted_column"] = y_pred
        df["prediction_label"] = df["predicted_column"].map({1: "PHISHING", -1: "LEGITIMATE"})

        Path("prediction_output").mkdir(exist_ok=True)
        df.to_csv("prediction_output/output.csv", index=False)

        # Log predictions for monitoring
        features_list = df.drop(columns=["predicted_column", "prediction_label"], errors="ignore").to_dict(orient="records")
        log_batch_predictions(
            features_list=features_list,
            predictions=y_pred.tolist(),
            model_version="1.0.0",
            latency_ms=latency_ms,
        )

        phishing_count = int((df["predicted_column"] == 1).sum())
        logging.info(f"Predictions made: {len(df)} rows, {phishing_count} phishing detected, {latency_ms:.1f}ms")

        table_html = df.to_html(classes="table table-striped")
        return templates.TemplateResponse(
            "table.html", {"request": request, "table": table_html},
        )

    except HTTPException:
        raise
    except Exception as e:
        raise NetworkSecurityException(e, sys)


@app.get("/api/model-stats", tags=["monitoring"])
async def model_stats() -> JSONResponse:
    """Real metrics computed from the trained model + held-out test split."""
    import time as _time
    from sklearn.metrics import f1_score, accuracy_score, precision_score, recall_score
    from sklearn.model_selection import train_test_split

    try:
        preprocessor = load_object("final_model/preprocessor.pkl")
        final_model   = load_object("final_model/model.pkl")
        network_model = NetworkModel(preprocessor=preprocessor, model=final_model)

        data_path = Path("Network_Data/phisingData.csv")
        if not data_path.exists():
            raise HTTPException(status_code=404, detail="Training data not found")

        df = pd.read_csv(data_path)
        X = df.drop(columns=["Result"])
        y = df["Result"].map({1: 1, -1: 0}).values

        _, X_test, _, y_test = train_test_split(X, y, test_size=0.2, random_state=42)

        t0 = _time.perf_counter()
        y_pred = network_model.predict(X_test)
        eval_latency_ms = (_time.perf_counter() - t0) * 1000

        cols = list(X.columns)
        fi = final_model.feature_importances_.tolist()
        importances = sorted(
            [{"feature": c, "importance": round(v * 100, 2)} for c, v in zip(cols, fi)],
            key=lambda x: -x["importance"],
        )

        return JSONResponse(content={
            "model_type": type(final_model).__name__,
            "n_estimators": int(getattr(final_model, "n_estimators", 0)),
            "n_features": int(getattr(final_model, "n_features_in_", 30)),
            "test_set_size": len(y_test),
            "dataset_size": len(df),
            "metrics": {
                "accuracy":     round(float(accuracy_score(y_test, y_pred)) * 100, 3),
                "f1_weighted":  round(float(f1_score(y_test, y_pred, average="weighted")) * 100, 3),
                "f1_phishing":  round(float(f1_score(y_test, y_pred, pos_label=1, average="binary", zero_division=0)) * 100, 3),
                "f1_legit":     round(float(f1_score(y_test, y_pred, pos_label=0, average="binary", zero_division=0)) * 100, 3),
                "precision":    round(float(precision_score(y_test, y_pred, average="weighted", zero_division=0)) * 100, 3),
                "recall":       round(float(recall_score(y_test, y_pred, average="weighted", zero_division=0)) * 100, 3),
            },
            "feature_importances": importances[:10],
            "eval_latency_ms": round(eval_latency_ms, 1),
        })
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e)) from e


@app.post("/api/predict-single", tags=["inference"])
async def predict_single(body: dict) -> JSONResponse:
    """Classify a single URL feature vector supplied as JSON.

    Body: { "features": [30 numeric values], "label": "optional display name" }
    """
    import time as _time
    try:
        features = body.get("features")
        if not features or len(features) != 30:
            raise HTTPException(status_code=400, detail=f"Expected 30 features, got {len(features) if features else 0}")

        cols = [
            "having_IP_Address","URL_Length","Shortining_Service","having_At_Symbol",
            "double_slash_redirecting","Prefix_Suffix","having_Sub_Domain","SSLfinal_State",
            "Domain_registeration_length","Favicon","port","HTTPS_token","Request_URL",
            "URL_of_Anchor","Links_in_tags","SFH","Submitting_to_email","Abnormal_URL",
            "Redirect","on_mouseover","RightClick","popUpWidnow","Iframe","age_of_domain",
            "DNSRecord","web_traffic","Page_Rank","Google_Index","Links_pointing_to_page",
            "Statistical_report",
        ]
        df = pd.DataFrame([features], columns=cols)

        preprocessor = load_object("final_model/preprocessor.pkl")
        final_model   = load_object("final_model/model.pkl")
        network_model = NetworkModel(preprocessor=preprocessor, model=final_model)

        t0 = _time.perf_counter()
        X_transformed = preprocessor.transform(df)
        proba = final_model.predict_proba(X_transformed)[0]   # [P(legit), P(phishing)]
        y_pred = network_model.predict(df)
        latency_ms = (_time.perf_counter() - t0) * 1000

        raw_pred = int(round(float(y_pred[0])))
        label = {1: "PHISHING", 0: "LEGITIMATE"}.get(raw_pred, "UNKNOWN")

        # classes_ = [0., 1.] so proba[0]=P(legitimate), proba[1]=P(phishing)
        p_legitimate = round(float(proba[0]) * 100, 1)
        p_phishing   = round(float(proba[1]) * 100, 1)
        confidence   = p_phishing if label == "PHISHING" else p_legitimate

        log_batch_predictions(
            features_list=[dict(zip(cols, features))],
            predictions=[raw_pred],
            model_version="1.0.0",
            latency_ms=latency_ms,
        )

        return JSONResponse(content={
            "prediction": raw_pred,
            "label": label,
            "latency_ms": round(latency_ms, 2),
            "features": features,
            "p_phishing": p_phishing,
            "p_legitimate": p_legitimate,
            "confidence": confidence,
        })
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e)) from e


@app.get("/api/recent-predictions", tags=["monitoring"])
async def recent_predictions(limit: int = 20) -> JSONResponse:
    """Return the most recent N predictions from the JSONL log."""
    from monitoring.prediction_logger import LOG_FILE
    if not LOG_FILE.exists():
        return JSONResponse(content={"entries": [], "total": 0})
    entries = []
    with open(LOG_FILE, encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if line:
                try:
                    entries.append(__import__("json").loads(line))
                except Exception:
                    continue
    recent = entries[-limit:][::-1]
    return JSONResponse(content={"entries": recent, "total": len(entries)})


@app.get("/api/timeline", tags=["monitoring"])
async def prediction_timeline() -> JSONResponse:
    """Return per-hour prediction counts for the last 24 hours."""
    import json as _json
    from datetime import datetime, timezone, timedelta
    from monitoring.prediction_logger import LOG_FILE

    now = datetime.now(tz=timezone.utc)
    buckets: dict[str, dict] = {}
    for h in range(23, -1, -1):
        ts = now - timedelta(hours=h)
        key = ts.strftime("%H:00")
        buckets[key] = {"hour": key, "phishing": 0, "legitimate": 0, "total": 0}

    if LOG_FILE.exists():
        with open(LOG_FILE, encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if not line:
                    continue
                try:
                    e = _json.loads(line)
                    ts = datetime.fromisoformat(e["timestamp"])
                    if ts.tzinfo is None:
                        ts = ts.replace(tzinfo=timezone.utc)
                    if (now - ts).total_seconds() <= 86400:
                        key = ts.strftime("%H:00")
                        if key in buckets:
                            buckets[key]["total"] += 1
                            if e.get("label") == "PHISHING":
                                buckets[key]["phishing"] += 1
                            else:
                                buckets[key]["legitimate"] += 1
                except Exception:
                    continue

    return JSONResponse(content={"timeline": list(buckets.values())})


static_dir = Path(__file__).parent / "static"
if static_dir.exists():
    app.mount("/assets", StaticFiles(directory=static_dir / "assets"), name="assets")

    def _serve_index():
        index = static_dir / "index.html"
        return HTMLResponse(index.read_text()) if index.exists() else HTMLResponse("<h1>Frontend not built</h1>", 404)

    @app.get("/ui", response_class=HTMLResponse)
    async def serve_ui():
        return _serve_index()

    @app.get("/ui/{path:path}", response_class=HTMLResponse)
    async def serve_ui_routes(path: str):
        return _serve_index()


if __name__ == "__main__":
    app_run(app, host="0.0.0.0", port=8080)
