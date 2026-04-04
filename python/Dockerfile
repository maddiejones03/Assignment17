# Build from assignment17-app/python (so COPY paths match).
# Put artifacts in ./model/ next to this Dockerfile before build:
#   model/fraud_model.joblib  model/threshold.json  model/feature_order.json

FROM python:3.11-slim

WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
ENV FRAUD_MODEL_DIR=/app/model

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY score_fraud_batch.py scorer_api.py ./
COPY model/ ./model/

EXPOSE 8080

CMD ["uvicorn", "scorer_api:app", "--host", "0.0.0.0", "--port", "8080"]
