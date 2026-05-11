# algo-health — Inventory Reservation System

Race-condition-safe inventory + reservation system for a multi-warehouse retail / D2C setup.

When a customer proceeds to checkout, the system holds units for a short window so the same physical unit can never be sold twice. If payment succeeds the hold becomes a permanent decrement; if it fails or expires, the units flow back to available stock.

## Repo layout

```
backend/    Express + TypeScript + Prisma REST API
frontend/   Next.js 14 (App Router) + Tailwind + shadcn/ui
```

Each directory has its own `README.md` with setup instructions.

## Architecture in one diagram

```
Browser ──► Next.js (frontend)  ──HTTP──►  Express (backend) ──► Postgres (Neon)
                                                  │
                                                  └────────────►  Redis (Upstash)  ← idempotency cache
```

## Quick start (local)

```bash
# 1. Backend
cd backend
cp .env.example .env
npm install
npm run prisma:migrate
npm run seed
npm run dev          # http://localhost:4000

# 2. Frontend (in a second terminal)
cd frontend
cp .env.example .env.local
npm install
npm run dev          # http://localhost:3000
```

Browse to `http://localhost:3000`.

## What's interesting in this codebase

- **Concurrency:** `POST /api/reservations` runs inside a Postgres transaction with `SELECT … FOR UPDATE` on the inventory row. Two simultaneous requests for the last unit produce exactly one `201` and one `409`.
- **Two-layer expiry:** `availableQuantity` always excludes expired pending reservations on read (lazy cleanup, immediate correctness). A node-cron job runs every minute to release expired rows and decrement `reservedQuantity` (background cleanup, keeps the DB clean).
- **Idempotency:** `Idempotency-Key` header on `POST /api/reservations` and `POST /api/reservations/:id/confirm` is cached in Upstash Redis (24h TTL) with a Postgres fallback table for durability. Errors are not cached so retries can re-validate.

See `backend/README.md` and `frontend/README.md` for more.
