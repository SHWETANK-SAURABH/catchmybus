# Built from the repo root (see docker-compose.yml) so scripts/ is available for training.
FROM python:3.11-slim

WORKDIR /app
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1

COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY backend/ /app/
COPY scripts/ /scripts/
EXPOSE 8000
# Train the models on first start if they are missing, then run the API (simulator runs in-process).
CMD ["sh", "-c", "python -m app.ml.train --if-missing && uvicorn app.main:app --host 0.0.0.0 --port 8000"]
