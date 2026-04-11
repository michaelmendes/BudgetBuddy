# BudgetBuddy Frontend

This is the React client for BudgetBuddy. It provides the authenticated budgeting experience, onboarding/setup flows, cycle management screens, social views, export tools, and account management pages.

## Stack

- React 18
- TypeScript
- Vite
- React Router
- TanStack Query
- Tailwind CSS
- Radix UI primitives and shared UI components
- React Hook Form + Zod
- Vitest + Testing Library

## Local Development

```bash
cd frontend
npm install
npm run dev
```

Default dev URL:

- `http://localhost:8080`

## Available Scripts

```bash
npm run dev
npm run build
npm run build:dev
npm run preview
npm run lint
npm run test
npm run test:watch
```

## Environment Variables

Create a `.env` file in `frontend/` when you need to override the API base URL:

```env
VITE_API_URL=http://localhost:8000/api/v1
```

If `VITE_API_URL` is not set, the frontend defaults to `http://localhost:8000/api/v1`.

## Application Structure

```text
frontend/
├── public/                  # Static assets
├── src/
│   ├── components/          # Shared app and UI components
│   ├── contexts/            # React context providers such as auth
│   ├── hooks/               # Reusable hooks
│   ├── layouts/             # Shared page layouts
│   ├── lib/                 # API client, utilities, helpers
│   ├── pages/               # Route-level pages
│   ├── test/                # Test setup and example tests
│   ├── types/               # API and app type definitions
│   ├── App.tsx              # Route tree and app providers
│   └── main.tsx             # Frontend entry point
├── package.json
├── vite.config.ts
└── vitest.config.ts
```

## Routing Overview

### Public Routes

- `/login`
- `/register`
- `/reset-password`

### Protected Routes

- `/dashboard`
- `/transactions`
- `/transactions/new`
- `/categories`
- `/recurring`
- `/goals`
- `/social`
- `/cycles`
- `/cycles/new`
- `/cycles/:id/close`
- `/cycles/:id/review`
- `/cycles/:id/summary`
- `/setup/categories`
- `/setup/goal-amounts`
- `/setup/starting-amounts`
- `/account`
- `/export-data`
- `/backup-data`

Users are wrapped in `ProtectedRoute` and rendered inside the shared application shell defined in [src/layouts/AppLayout.tsx](/Users/michaelmendes/Projects/Personal/BudgetBuddy/frontend/src/layouts/AppLayout.tsx).

## Authentication Model

The frontend uses an `AuthContext` provider to:

- log users in
- register new users
- fetch the current user
- store the JWT access token in local storage
- clear auth state on logout
- support password reset

Relevant files:

- [src/contexts/AuthContext.tsx](/Users/michaelmendes/Projects/Personal/BudgetBuddy/frontend/src/contexts/AuthContext.tsx)
- [src/components/ProtectedRoute.tsx](/Users/michaelmendes/Projects/Personal/BudgetBuddy/frontend/src/components/ProtectedRoute.tsx)
- [src/lib/api.ts](/Users/michaelmendes/Projects/Personal/BudgetBuddy/frontend/src/lib/api.ts)

## API Integration

The app uses a lightweight API client in [src/lib/api.ts](/Users/michaelmendes/Projects/Personal/BudgetBuddy/frontend/src/lib/api.ts). It centralizes:

- auth token handling
- request headers
- error parsing from FastAPI responses
- typed endpoint wrappers for the major app domains

The main API domains exposed by the client are:

- authentication
- users and setup state
- dashboard
- pay cycles
- categories
- goals
- transactions
- recurring transactions
- social and friendships
- backup and export workflows

## UI Layout And Navigation

The primary app shell includes:

- a desktop sidebar
- a mobile slide-out navigation panel
- account shortcuts for profile management, export, and local backup

Core navigation areas:

- Dashboard
- Pay Cycles
- Transactions
- Categories
- Recurring
- Goals
- Social

## Testing

Run the test suite with:

```bash
npm run test
```

Watch mode:

```bash
npm run test:watch
```

Vitest is configured with:

- `jsdom` environment
- Testing Library support
- alias resolution for `@`

## Build Notes

- `vite.config.ts` runs the dev server on port `8080`
- Path alias `@` resolves to `src/`
- Production builds are generated with `npm run build`

## Where To Extend The Frontend

### Add a new page

- Create a page component in `src/pages/`
- Register the route in [src/App.tsx](/Users/michaelmendes/Projects/Personal/BudgetBuddy/frontend/src/App.tsx)
- Add navigation in [src/layouts/AppLayout.tsx](/Users/michaelmendes/Projects/Personal/BudgetBuddy/frontend/src/layouts/AppLayout.tsx) if needed

### Add a new API call

- Extend the client in [src/lib/api.ts](/Users/michaelmendes/Projects/Personal/BudgetBuddy/frontend/src/lib/api.ts)
- Add or update shared types in [src/types/api.ts](/Users/michaelmendes/Projects/Personal/BudgetBuddy/frontend/src/types/api.ts)
- Use the call in the relevant page, hook, or component

### Add tests

- Place tests alongside the feature or under `src/test/`
- Use Vitest and Testing Library patterns already configured in the repo

## Integration Expectations

For local development, run the backend on port `8000` and the frontend on port `8080`. The backend CORS configuration already supports this pairing.
