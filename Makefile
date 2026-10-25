# CatchMyBus - common tasks.
# Docker flow:  make up && make seed
# Local flow (no Docker, SQLite):  make install && make dev-backend / make dev-frontend

PY ?= python
COMPOSE = docker compose

.PHONY: env up down logs seed train data test test-backend test-frontend loadtest backup \
        install dev-backend dev-frontend

env:
	@test -f .env || (cp .env.example .env && echo "Created .env from .env.example")

up: env
	$(COMPOSE) up -d --build
	@echo "API: http://localhost:8000/docs   Web: http://localhost:5173"

down:
	$(COMPOSE) down

logs:
	$(COMPOSE) logs -f backend

seed: env
	$(COMPOSE) exec backend python -m app.seed

data:
	cd backend && $(PY) ../scripts/generate_data.py

train: data
	cd backend && $(PY) -m app.ml.train

test: test-backend test-frontend

test-backend:
	cd backend && $(PY) -m pytest -q

test-frontend:
	cd frontend && npm test

loadtest:
	$(PY) -m locust -f scripts/locustfile.py --headless -u 50 -r 10 -t 60s --host http://localhost:8000

backup:
	sh scripts/backup.sh

# ---- local development without Docker ----
install: env
	cd backend && $(PY) -m pip install -r requirements.txt
	cd frontend && npm install

dev-backend:
	cd backend && DATABASE_URL=sqlite:///./catchmybus.db $(PY) -m uvicorn app.main:app --reload --port 8000

dev-frontend:
	cd frontend && npm run dev
