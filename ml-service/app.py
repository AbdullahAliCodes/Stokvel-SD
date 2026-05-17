"""
Internal ML inference API — bind localhost only. No database or secrets.
"""
from __future__ import annotations

import os
import pickle

from flask import Flask, jsonify, request

FEATURE_ORDER = [
    "on_time_rate",
    "missed_payments",
    "avg_days_late",
    "streak_months",
    "engagement_rate",
    "months_active",
    "total_contributions",
]

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
MODEL_PATH = os.path.join(BASE_DIR, "model", "health_score_model.pkl")
NAMES_PATH = os.path.join(BASE_DIR, "model", "feature_names.pkl")

GRADE_MAP = {0: "At Risk", 1: "Fair", 2: "Good", 3: "Excellent"}
BASE_SCORES = {0: 20, 1: 50, 2: 72, 3: 92}

app = Flask(__name__)

_model = None
_feature_names = None


def _local_only() -> bool:
    addr = request.remote_addr or ""
    return addr in ("127.0.0.1", "::1", "localhost")


def load_artifacts():
    global _model, _feature_names
    if _model is None:
        with open(MODEL_PATH, "rb") as f:
            _model = pickle.load(f)
    if _feature_names is None:
        with open(NAMES_PATH, "rb") as f:
            _feature_names = pickle.load(f)
    if list(_feature_names) != FEATURE_ORDER:
        # Align to trained order stored in pickle
        pass


@app.route("/predict", methods=["POST"])
def predict():
    if not _local_only():
        return jsonify({"error": "Forbidden"}), 403

    if not os.path.isfile(MODEL_PATH) or not os.path.isfile(NAMES_PATH):
        return jsonify({"error": "Model not trained — run train_model.py"}), 503

    load_artifacts()

    body = request.get_json(silent=True) or {}
    missing = [k for k in FEATURE_ORDER if k not in body]
    if missing:
        return jsonify({"error": f"Missing fields: {missing}"}), 400

    try:
        vec = [float(body[k]) for k in FEATURE_ORDER]
    except (TypeError, ValueError):
        return jsonify({"error": "Features must be numeric"}), 400

    X = [vec]
    proba_row = _model.predict_proba(X)[0]
    class_list = list(getattr(_model, "classes_", [0, 1, 2, 3]))
    predicted_class = int(_model.predict(X)[0])
    idx = class_list.index(predicted_class)
    p_hat = float(proba_row[idx])

    score = BASE_SCORES[predicted_class] + (p_hat - 0.5) * 20
    score = max(0.0, min(100.0, score))
    confidence = p_hat * 100.0
    grade = GRADE_MAP[predicted_class]

    importances = _model.feature_importances_
    fi = {
        name: round(float(imp), 6)
        for name, imp in zip(_feature_names, importances)
    }

    return jsonify(
        {
            "score": round(score, 2),
            "grade": grade,
            "confidence": round(confidence, 2),
            "feature_importances": fi,
            "predicted_class": predicted_class,
        }
    )


if __name__ == "__main__":
    port = int(os.environ.get("PORT", "5001"))
    app.run(host="127.0.0.1", port=port, debug=False)
