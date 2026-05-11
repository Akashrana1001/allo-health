# Inventory Reservation System

Race-condition-safe inventory + reservation platform for multi-warehouse retail / D2C brands.

When a customer checks out, the system holds units for 10 minutes. If payment succeeds the hold is confirmed permanently. If it fails or expires, stock is returned to available inventory automatically.

## Repo layout

```
backend/    Express + TypeScript + Prisma REST API (port 4000)
frontend/   Next.js 14 App Router + Tailwind + shadcn/ui (port 3000)
```

## Quick start (local)

```bash
# 1. Backend
cd backend
cp .env.example .env          # fill in DATABASE_URL, DIRECT_URL, etc.
npm install
npm run prisma:generate
npm run prisma:deploy         # applies migrations to Neon
npm run seed                  # populates demo data
npm run dev                   # http://localhost:4000

# 2. Frontend (separate terminal)
cd frontend
cp .env.example .env.local    # set NEXT_PUBLIC_API_BASE_URL=http://localhost:4000
npm install
npm run dev                   # http://localhost:3000
```

Browse to `http://localhost:3000`. The root redirects to `/products`.

## Environment variables

### backend/.env

| Variable | Description |
|---|---|
| `DATABASE_URL` | Neon pooled connection string (used at runtime) |
| `DIRECT_URL` | Neon direct connection string (used for migrations only) |
| `UPSTASH_REDIS_REST_URL` | Upstash Redis endpoint |
| `UPSTASH_REDIS_REST_TOKEN` | Upstash Redis auth token |
| `CRON_SECRET` | Random string that authorises `POST /api/cron/expire` |
| `FRONTEND_ORIGIN` | CORS allowed origin (e.g. `http://localhost:3000`) |
| `PORT` | Server port (default `4000`) |
| `RESERVATION_TTL_MINUTES` | Hold window in minutes (default `10`) |

### frontend/.env.local

| Variable | Description |
|---|---|
| `NEXT_PUBLIC_API_BASE_URL` | URL of the Express backend |

## Architecture

```
Browser ──► Next.js (frontend)
                │  HTTP
                ▼
           Express (backend) ──► Postgres (Neon)
                │                     ▲
                └──► Redis (Upstash)   │
                     idempotency cache │
                                       │
                node-cron (in-process) ┘
                runs every minute
```

## Concurrency design

The core problem: two simultaneous checkout requests for the last unit of a SKU. Without locking, both read `available = 1`, both proceed, and one unit gets sold twice.

**Solution: pessimistic row-level locking with `SELECT FOR UPDATE`.**

```sql
BEGIN;

SELECT "totalQuantity", "reservedQuantity"
FROM "Inventory"
WHERE "productId" = $1 AND "warehouseId" = $2
FOR UPDATE;        -- exclusive lock on this row

-- check available = totalQuantity - reservedQuantity
-- if available < requested units → ROLLBACK → 409

UPDATE "Inventory" SET "reservedQuantity" = "reservedQuantity" + $3 ...;
INSERT INTO "Reservation" (...) VALUES (...);

COMMIT;
```

The second concurrent request blocks on `FOR UPDATE` until the first transaction commits. It then re-reads the updated `reservedQuantity`, finds zero available, and returns `409 INSUFFICIENT_STOCK`. Exactly one request wins; the loser gets a clear error immediately.

**Why not optimistic locking (version column + retry)?**
Optimistic locking retries on conflict, which amplifies load under real contention and can starve slow clients. In an inventory system where stock genuinely runs out, the losing request will fail on retry too — the retry is wasted work. Pessimistic locking serialises access and returns the right error in one round-trip.

**Why not Redis Redlock?**
Redlock is an advisory lock. It does not atomically check-and-update Postgres, so you'd still need a database transaction. That's two distributed systems that must both be healthy for every reservation request. Postgres already serialises correctly here; adding Redis for locking would be complexity without benefit.

## Expiry mechanism

Two complementary layers:

**Layer 1 — Lazy cleanup on read (immediate correctness)**

`GET /api/products` computes `availableQuantity` by summing only `PENDING` reservations where `expiresAt > NOW()`. Expired holds are invisible on read regardless of whether the background job has run. This means availability is always correct, even in the window between expiry and the next cron tick.

**Layer 2 — Background cleanup (database hygiene)**

A `node-cron` job inside the Express process fires every minute. It:
1. Finds all `PENDING` reservations where `expiresAt <= NOW()`
2. Groups them by `(productId, warehouseId)` and sums units to return
3. Decrements `reservedQuantity` and flips status to `RELEASED` in a single transaction

The cron endpoint is also exposed as `POST /api/cron/expire` (protected by `Authorization: Bearer <CRON_SECRET>`) so an external scheduler (Vercel Cron, GitHub Actions, etc.) can trigger it independently of the in-process job.

**Why both layers?**
Lazy cleanup alone keeps availability accurate but lets `reservedQuantity` drift upward — confusing in admin views and risky if the lazy logic ever has a bug. Background cleanup alone leaves a ≤60-second window after expiry where stock looks depleted. Together, accuracy is immediate and the database stays clean.

## Bonus: Idempotency

`POST /api/reservations` and `POST /api/reservations/:id/confirm` support the `Idempotency-Key` header. If a client retries with the same key, the server returns the original response without repeating the side effect.

**Implementation (`backend/src/lib/idempotency.ts`):**
1. Check Upstash Redis for a cached response keyed by `idem:<key>` — sub-millisecond fast path
2. If not in Redis, check the `IdempotencyKey` Postgres table — durable fallback if Redis evicts the key
3. On cache miss, run the handler, then write the result to both Redis (24h TTL) and Postgres
4. **Errors are not cached** — a `409` or `410` response is not stored, so retries can re-validate

This prevents a network retry from creating two reservations or charging twice.

## Trade-offs and future work

- **No authentication** — reservations are not scoped to a user session. A production system would attach a `userId` to each reservation and restrict confirm/release to the owner.
- **Cron granularity is 1 minute** — a persistent background worker (e.g. BullMQ with delayed jobs) would allow sub-minute precision and guaranteed delivery.
- **No rate limiting** — the reservation endpoint could be abused to lock up all stock without buying. A per-IP or per-session rate limiter (e.g. via Redis sliding window) would mitigate this.
- **No real-time stock sync across tabs** — the frontend polls every 5 seconds. WebSockets or Server-Sent Events would push stock updates instantly.
- **`reservedQuantity` column vs. live aggregation** — `reservedQuantity` is a denormalised counter updated on every reservation/release. An alternative is to always compute it from the `Reservation` table at query time. That's a simpler schema but slower reads under load; the counter approach is the standard trade-off in high-throughput inventory systems.
