"""
Train RandomForestClassifier for member health grade (0=At Risk .. 3=Excellent).
Uses synthetic data only — no database connection.
"""
from __future__ import annotations

import os
import pickle
import random

import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import classification_report
from sklearn.model_selection import train_test_split

random.seed(42)
np.random.seed(42)

FEATURE_NAMES = [
    "on_time_rate",
    "missed_payments",
    "avg_days_late",
    "streak_months",
    "engagement_rate",
    "months_active",
    "total_contributions",
]

GRADE_AT_RISK = 0
GRADE_FAIR = 1
GRADE_GOOD = 2
GRADE_EXCELLENT = 3


def _noise(center: float, scale: float, low: float, high: float) -> float:
    v = np.random.normal(center, scale)
    return float(np.clip(v, low, high))


def _sample_row(label: int) -> dict:
    """Draw one feature row loosely matching the label narrative."""
    if label == GRADE_EXCELLENT:
        on_time = _noise(0.96, 0.04, 0.9, 1.0)
        missed = int(np.clip(np.random.poisson(0.15), 0, 1))
        late = _noise(0.4, 0.8, 0.0, 4.0) if on_time < 0.98 else _noise(0.2, 0.4, 0.0, 2.0)
        streak = int(np.clip(np.random.normal(9, 2), 6, 24))
        engagement = _noise(0.92, 0.08, 0.75, 1.0)
        months = int(np.clip(np.random.randint(8, 37), 1, 60))
        contributions = int(np.clip(np.random.poisson(months * 0.95), months - 2, months + 4))
    elif label == GRADE_GOOD:
        on_time = _noise(0.8, 0.06, 0.7, 0.92)
        missed = int(np.clip(np.random.poisson(1.2), 1, 3))
        late = _noise(3.5, 2.0, 0.5, 12.0)
        streak = int(np.clip(np.random.normal(4.5, 1.2), 3, 8))
        engagement = _noise(0.72, 0.12, 0.5, 0.95)
        months = int(np.clip(np.random.randint(4, 28), 1, 48))
        contributions = int(np.clip(np.random.poisson(months * 0.82), 1, months + 3))
    elif label == GRADE_FAIR:
        on_time = _noise(0.6, 0.06, 0.5, 0.72)
        missed = int(np.clip(np.random.poisson(2.8), 2, 5))
        late = _noise(7.0, 3.0, 2.0, 22.0)
        streak = int(np.clip(np.random.poisson(1.8), 1, 4))
        engagement = _noise(0.52, 0.14, 0.25, 0.85)
        months = int(np.clip(np.random.randint(2, 18), 1, 36))
        contributions = int(np.clip(np.random.poisson(months * 0.62), 1, months + 2))
    else:  # At Risk
        on_time = _noise(0.35, 0.12, 0.05, 0.52)
        missed = int(np.clip(np.random.poisson(5.5), 4, 14))
        late = _noise(14.0, 6.0, 5.0, 45.0)
        streak = int(np.clip(np.random.poisson(0.35), 0, 2))
        engagement = _noise(0.28, 0.12, 0.05, 0.55)
        months = int(np.clip(np.random.randint(1, 14), 1, 36))
        contributions = int(np.clip(np.random.poisson(months * 0.35), 0, months + 1))

    return {
        "on_time_rate": round(on_time, 4),
        "missed_payments": missed,
        "avg_days_late": round(max(0.0, late), 2),
        "streak_months": streak,
        "engagement_rate": round(float(np.clip(engagement, 0.0, 1.0)), 4),
        "months_active": max(1, months),
        "total_contributions": max(0, contributions),
        "health_grade": label,
    }


def build_dataset(n_samples: int = 2400) -> pd.DataFrame:
    # Rough class balance
    weights = [GRADE_AT_RISK] * (n_samples // 4) + [GRADE_FAIR] * (n_samples // 4)
    weights += [GRADE_GOOD] * (n_samples // 4) + [GRADE_EXCELLENT] * (n_samples - len(weights))
    random.shuffle(weights)
    rows = [_sample_row(lbl) for lbl in weights]
    return pd.DataFrame(rows)


def main() -> None:
    df = build_dataset(2400)
    X = df[FEATURE_NAMES].values
    y = df["health_grade"].values.astype(int)

    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42, stratify=y
    )

    clf = RandomForestClassifier(
        n_estimators=100,
        random_state=42,
        class_weight="balanced",
        n_jobs=-1,
    )
    clf.fit(X_train, y_train)

    y_pred = clf.predict(X_test)
    acc = float(np.mean(y_pred == y_test))
    print(f"Hold-out accuracy: {acc:.4f}")
    print(classification_report(y_test, y_pred, digits=3))

    out_dir = os.path.join(os.path.dirname(__file__), "model")
    os.makedirs(out_dir, exist_ok=True)
    model_path = os.path.join(out_dir, "health_score_model.pkl")
    names_path = os.path.join(out_dir, "feature_names.pkl")

    with open(model_path, "wb") as f:
        pickle.dump(clf, f)
    with open(names_path, "wb") as f:
        pickle.dump(FEATURE_NAMES, f)

    print(f"Saved model -> {model_path}")
    print(f"Saved feature names -> {names_path}")


if __name__ == "__main__":
    main()
