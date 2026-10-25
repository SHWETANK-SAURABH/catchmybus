# CatchMyBus

AI-powered public transport tracking and smart travel assistant. Software Engineering lab project (VIT, BCSE301P).

> Work in progress. The full README (architecture, demo script, API summary, AI metrics, traceability) is filled in during the final phase.

## Quick start

```bash
make up && make seed      # Docker: Postgres + API + web
```

Without Docker (SQLite):

```bash
cp .env.example .env      # then set DATABASE_URL=sqlite:///./catchmybus.db
cd backend && python -m pip install -r requirements.txt && python -m app.seed
python -m uvicorn app.main:app --port 8000
cd ../frontend && npm install && npm run dev
```
