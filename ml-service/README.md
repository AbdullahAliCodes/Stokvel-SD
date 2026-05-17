# Member health score — ML service (internal)

Flask API that loads a scikit-learn `RandomForestClassifier` trained on synthetic stokvel-like data. **Bind:** `127.0.0.1` only. **No database or credentials.**

## Setup

1. `cd ml-service`
2. `pip install -r requirements.txt`
3. `python train_model.py` — trains and saves `model/health_score_model.pkl` and `model/feature_names.pkl`
4. `python app.py` — starts Flask on port **5001** (override with env var `PORT`)

The Node backend calls `http://127.0.0.1:5001/predict` by default. To change the URL without editing `.env` files, set `ML_HEALTH_PREDICT_URL` in your process environment when starting the API server.

## Endpoint

`POST /predict` — JSON body must include:

`on_time_rate`, `missed_payments`, `avg_days_late`, `streak_months`, `engagement_rate`, `months_active`, `total_contributions`

Responses are only accepted by clients whose source address is localhost (`127.0.0.1` or `::1`).
