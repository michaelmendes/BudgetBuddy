# BudgetBuddy API Backend

A fully-featured FastAPI backend for personal finance management with social features.

## Quick Start

```bash
# Create virtual environment
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Run migrations
alembic upgrade head

# Seed sample data (optional)
python scripts/seed_data.py

# Start the server
uvicorn app.main:app --reload --port 8000
```

## API Documentation

Once running, visit:
- **Swagger UI**: http://localhost:8000/api/v1/openapi.json
- **Interactive Docs**: http://localhost:8000/docs
- **ReDoc**: http://localhost:8000/redoc

## Architecture

```
backend/
├── app/
│   ├── main.py              # FastAPI app entry
│   ├── database.py          # Async SQLAlchemy setup
│   ├── core/
│   │   ├── config.py        # Settings from env vars
│   │   ├── security.py      # JWT & password hashing
│   │   └── exceptions.py    # Custom HTTP exceptions
│   ├── models/              # SQLAlchemy ORM models
│   ├── schemas/             # Pydantic request/response schemas
│   ├── services/            # Business logic layer
│   └── api/v1/              # API route handlers
├── alembic/                 # Database migrations
├── scripts/                 # Utility scripts
└── requirements.txt
```

## Key Features

### Pay Cycle Management
- Create, activate, and close pay cycles
- Automatic summary generation on close
- Rollover of unused category budgets

### Category Goals
- Fixed amount or percentage-based goals
- Per-cycle goal tracking with progress
- Automatic rollover to next cycle

### Recurring Transactions
- Weekly, biweekly, or monthly frequencies
- Automatic transaction generation
- Flexible day-of-week/month scheduling

### Social Features (Privacy-First)
- Friend connections with request/accept flow
- Shared categories (opt-in per category)
- **Only percentages exposed** - never raw amounts
- Leaderboard based on budget adherence

## Authentication

All endpoints except `/auth/register` and `/auth/login` require JWT authentication.

```bash
# Register
curl -X POST http://localhost:8000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","password":"Password123","display_name":"Test User"}'

# Login
curl -X POST http://localhost:8000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","password":"Password123"}'

# Use token
curl -X GET http://localhost:8000/api/v1/users/me \
  -H "Authorization: Bearer <your_token>"
```

## Environment Variables

Create a `.env` file:

```env
DATABASE_URL=sqlite+aiosqlite:///./finance.db
SECRET_KEY=your-super-secret-key-change-in-production
CORS_ORIGINS=["http://localhost:3000","http://localhost:5173"]
```

## API Endpoints

### Authentication
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/auth/register` | Register new user |
| POST | `/auth/login` | Get access token |

### Users
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/users/me` | Get current user |
| PATCH | `/users/me` | Update profile |
| DELETE | `/users/me` | Delete account |

### Pay Cycles
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/pay-cycles` | List all cycles |
| GET | `/pay-cycles/active` | Get active cycle |
| POST | `/pay-cycles` | Create cycle |
| POST | `/pay-cycles/{id}/activate` | Activate cycle |
| POST | `/pay-cycles/{id}/close` | Close & generate summary |
| GET | `/pay-cycles/{id}/summary` | Get summary |
| GET | `/pay-cycles/{id}/potential-rollover` | Preview rollover |

### Categories
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/categories` | List categories |
| POST | `/categories` | Create category |
| PATCH | `/categories/{id}` | Update category |
| POST | `/categories/{id}/archive` | Archive category |
| POST | `/categories/reorder` | Reorder categories |

### Transactions
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/transactions?pay_cycle_id=` | List transactions |
| POST | `/transactions` | Create transaction |
| PATCH | `/transactions/{id}` | Update transaction |
| DELETE | `/transactions/{id}` | Delete transaction |
| GET | `/transactions/summary/by-category` | Category totals |
| GET | `/transactions/summary/totals` | Income/expense totals |

### Recurring Transactions
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/recurring` | List recurring |
| POST | `/recurring` | Create recurring |
| POST | `/recurring/{id}/deactivate` | Deactivate |
| POST | `/recurring/generate-for-cycle` | Generate instances |

### Goals
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/goals/category?pay_cycle_id=` | List category goals |
| POST | `/goals/category` | Create category goal |
| POST | `/goals/category/copy` | Copy goals to new cycle |
| GET | `/goals/long-term` | List long-term goals |
| POST | `/goals/long-term/{id}/contribute` | Add contribution |

### Social
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/friends` | List friends |
| POST | `/friends/request` | Send friend request |
| POST | `/friends/{id}/accept` | Accept request |
| GET | `/social/friends` | All friends' progress |
| GET | `/social/friends/{id}` | Single friend's progress |
| GET | `/social/leaderboard` | Budget adherence leaderboard |

## Testing

```bash
pytest -v
```

## Production Deployment

1. Use PostgreSQL instead of SQLite
2. Set strong `SECRET_KEY`
3. Configure proper `CORS_ORIGINS`
4. Use Gunicorn with Uvicorn workers
5. Set up HTTPS reverse proxy

```bash
gunicorn app.main:app -w 4 -k uvicorn.workers.UvicornWorker
```
