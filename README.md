# BudgetBuddy

BudgetBuddy is a full-stack personal finance app built around pay cycles instead of calendar months. It helps users plan income, assign spending goals, track transactions, carry balances forward, and review progress at the end of each cycle. The product also includes optional social features so users can share progress with friends without exposing raw financial amounts.

This repository contains:

- A FastAPI backend for authentication, budgeting workflows, pay-cycle management, reporting, exports, and social features
- A React + Vite frontend for the full user experience, from onboarding through cycle review

## What The App Does

BudgetBuddy is designed for people who think about money in terms of paychecks. Instead of forcing everything into a monthly budget, the app lets users:

- Create pay cycles that match their actual income cadence
- Define categories such as rent, groceries, transportation, and savings
- Set category goals as fixed amounts or percentages
- Record income and expense transactions within each cycle
- Manage recurring transactions
- Review cycle summaries and category balances
- Track long-term goals
- Export or locally back up data
- Share limited progress with friends through privacy-conscious social features

## Project Structure

```text
BudgetBuddy/
├── README.md                 # High-level project guide
├── backend/                  # FastAPI API, database models, migrations, seed scripts
│   ├── README.md
│   ├── app/
│   ├── alembic/
│   └── scripts/
└── frontend/                 # React/Vite client application
    ├── README.md
    └── src/
```

## Tech Stack

### Frontend

- React 18
- TypeScript
- Vite
- React Router
- TanStack Query
- Tailwind CSS
- Radix UI primitives and shadcn/ui-style components
- React Hook Form + Zod
- Vitest + Testing Library

### Backend

- Python 3.12+
- FastAPI
- SQLAlchemy asyncio
- Alembic
- Pydantic Settings
- JWT-based authentication
- SQLite for local development

## Architecture At A Glance

The frontend talks to the backend over a JSON API rooted at `/api/v1`. Authentication is token-based, and the client stores the access token in local storage. The backend is organized around route modules, schemas, services, and SQLAlchemy models, while the frontend is organized around pages, layouts, shared UI components, and an API client wrapper.

## Quick Start

### 1. Run the backend

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

### 2. Run the frontend

In a second terminal:

```bash
cd frontend
npm install
npm run dev
```

The frontend runs on `http://localhost:8080` by default and expects the API at `http://localhost:8000/api/v1` unless `VITE_API_URL` is set.

## Local Development Notes

- Backend CORS already allows `http://localhost:8080`, `http://localhost:3000`, and `http://localhost:5173`
- The backend creates tables on startup in development, but Alembic migrations should still be the source of truth
- A seeded development database includes example users:
  - `alice@example.com` / `Password123`
  - `bob@example.com` / `Password123`

## Useful Links

- Backend docs: [backend/README.md](/Users/michaelmendes/Projects/Personal/BudgetBuddy/backend/README.md)
- Frontend docs: [frontend/README.md](/Users/michaelmendes/Projects/Personal/BudgetBuddy/frontend/README.md)
- Health check: `http://localhost:8000/health`
- Swagger UI: `http://localhost:8000/docs`
- OpenAPI JSON: `http://localhost:8000/api/v1/openapi.json`

## Core User Flows

### Onboarding

- Register or log in
- Create categories
- Configure goal amounts
- Enter starting amounts

### Active Budgeting

- Create or activate a pay cycle
- Add transactions manually or from recurring templates
- Monitor dashboard and category progress
- Adjust goals and categories over time

### End Of Cycle

- Review pay-cycle performance
- Close a cycle
- Inspect summaries and balances
- Carry the next cycle forward with better context

## Repository Conventions

- `backend/` contains the API, business logic, persistence layer, and migrations
- `frontend/` contains the entire web app
- App-specific setup details live in the app-specific README files

## Current State

The repository already includes substantial product functionality across auth, pay cycles, transactions, categories, goals, recurring transactions, social features, and local backup/export. The documentation in this repo is intended to help a new contributor or future maintainer get the system running quickly and understand where to extend it.
