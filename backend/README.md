# BudgetBuddy Backend

This is the FastAPI backend for BudgetBuddy. It owns authentication, pay-cycle budgeting workflows, transaction tracking, goals, recurring items, dashboards, friendships, social sharing, and backup/export-oriented APIs.

## Stack

- FastAPI
- SQLAlchemy asyncio
- Alembic
- Pydantic + pydantic-settings
- JWT authentication
- SQLite for local development

## Quick Start

```bash
cd backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
alembic upgrade head
uvicorn app.main:app --reload --port 8000
```

Optional sample data:

```bash
python scripts/seed_data.py
```

## API Docs

Once the server is running:

- Swagger UI: `http://localhost:8000/docs`
- ReDoc: `http://localhost:8000/redoc`
- OpenAPI JSON: `http://localhost:8000/api/v1/openapi.json`
- Health check: `http://localhost:8000/health`

## Configuration

Settings are loaded from environment variables via `pydantic-settings`.

Default values in the app:

```env
PROJECT_NAME=Personal Finance API
API_V1_PREFIX=/api/v1
DATABASE_URL=sqlite+aiosqlite:///./finance.db
SECRET_KEY=your-super-secret-key-change-in-production
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=10080
```

Recommended local `.env` example:

```env
DATABASE_URL=sqlite+aiosqlite:///./finance.db
SECRET_KEY=replace-this-for-real-use
CORS_ORIGINS=["http://localhost:8080","http://localhost:3000","http://localhost:5173"]
```

The settings class lives in [app/core/config.py](/Users/michaelmendes/Projects/Personal/BudgetBuddy/backend/app/core/config.py).

## Project Structure

```text
backend/
├── app/
│   ├── api/v1/              # Route modules and dependency helpers
│   ├── core/                # Config, security, exceptions
│   ├── models/              # SQLAlchemy ORM models
│   ├── schemas/             # Pydantic request/response models
│   ├── services/            # Business logic layer
│   ├── database.py          # Async engine and session setup
│   └── main.py              # FastAPI app entry point
├── alembic/                 # Database migrations
├── scripts/                 # Utility scripts such as sample seeding
├── requirements.txt
└── alembic.ini
```

## Architecture

### Entry Point

[app/main.py](/Users/michaelmendes/Projects/Personal/BudgetBuddy/backend/app/main.py) creates the FastAPI app, configures CORS, mounts the versioned router, and exposes a `/health` endpoint.

### Route Layer

The main API router is assembled in [app/api/v1/router.py](/Users/michaelmendes/Projects/Personal/BudgetBuddy/backend/app/api/v1/router.py). Route groups include:

- authentication
- users
- dashboard
- pay cycles
- categories
- transactions
- recurring transactions
- goals
- friendships
- social
- backup

### Service Layer

Business logic is isolated into service modules under `app/services/`. This keeps route handlers smaller and makes domain logic easier to evolve over time.

### Persistence Layer

SQLAlchemy models define the domain entities, including:

- users
- pay cycles
- category goals
- category balances
- transactions
- recurring transactions
- friendships
- long-term goals

Alembic tracks schema changes in `alembic/versions/`.

## Core Capabilities

### Authentication And Users

- register
- login
- get current user
- update profile details
- change password
- complete setup flow
- manage starting amounts

### Pay Cycles

- create and list cycles
- fetch the active cycle
- update cycle details
- close a cycle
- generate summaries
- inspect category balances tied to a cycle

### Categories And Goals

- create and update categories
- archive or delete categories
- manage category goals
- support fixed and percentage-based budgeting
- track long-term goals

### Transactions

- create and update transactions
- delete transactions
- batch-create transactions
- summarize totals and category activity

### Recurring Workflows

- define recurring income or expense templates
- generate cycle transactions from recurring templates
- deactivate recurring items

### Social And Backup

- send and accept friend requests
- view friend progress in privacy-conscious ways
- expose leaderboard-style comparisons
- support backup/export flows for user data

## Authentication

Most endpoints require a bearer token. The usual flow is:

1. Register or log in
2. Receive an access token
3. Send `Authorization: Bearer <token>` on protected requests

Example:

```bash
curl -X POST http://localhost:8000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","password":"Password123","display_name":"Test User"}'
```

```bash
curl -X POST http://localhost:8000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","password":"Password123"}'
```

```bash
curl -X GET http://localhost:8000/api/v1/users/me \
  -H "Authorization: Bearer <your_token>"
```

## Development Database

Local development uses SQLite by default:

```env
DATABASE_URL=sqlite+aiosqlite:///./finance.db
```

The application currently creates tables on startup in development via the lifespan handler, but migrations should still be treated as the authoritative schema history.

## Seed Data

The seed script creates:

- two sample users
- a sample friendship
- categories
- an active pay cycle
- category goals
- transactions
- one recurring transaction
- one long-term goal

Default seeded credentials:

- `alice@example.com` / `Password123`
- `bob@example.com` / `Password123`

Run it with:

```bash
python scripts/seed_data.py
```

## Testing

Install dependencies, then run:

```bash
pytest -v
```

## Deployment Notes

For production, plan to:

- replace SQLite with a production database such as PostgreSQL
- set a strong `SECRET_KEY`
- restrict `CORS_ORIGINS`
- run migrations during deploys
- serve FastAPI behind a reverse proxy

Example production command:

```bash
gunicorn app.main:app -w 4 -k uvicorn.workers.UvicornWorker
```

## Where To Extend The Backend

### Add a new endpoint

- Create or update a route module under `app/api/v1/`
- Add request/response schemas under `app/schemas/`
- Put domain logic in `app/services/`
- Register the router in [app/api/v1/router.py](/Users/michaelmendes/Projects/Personal/BudgetBuddy/backend/app/api/v1/router.py) if it is new

### Add a schema change

- Update the SQLAlchemy model
- Create an Alembic migration
- Apply the migration locally with `alembic upgrade head`

### Add a new domain workflow

- Keep route handlers thin
- Centralize state changes and orchestration in a service module
- Reuse schemas for consistent API contracts
