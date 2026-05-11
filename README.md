# Inventory Reservation System — Allo Engineering Take-Home

A race-condition-safe inventory + reservation platform for multi-warehouse retail / D2C brands.

**Live demo → https://frontend-nu-lake-96.vercel.app**

---

## The problem in one sentence

Two customers reach checkout simultaneously for the last unit of a SKU. Without locking, both read `available = 1`, both proceed, and one unit gets sold twice. This system guarantees exactly one wins.

---

## Live URLs

| Service | URL |
|---|---|
| Frontend (Vercel) | https://frontend-nu-lake-96.vercel.app |
| Backend API (Render) | https://allo-health-v5rh.onrender.com |
| Health check | https://allo-health-v5rh.onrender.com/health |
| GitHub | https://github.com/Akashrana1001/allo-health |

> **Debrief demo tip:** To trigger the 409 race condition live, open two browser tabs on the products page, find **"Adjustable Dumbbell"** (Delhi Hub — 1 unit) or **"Gym Gloves"** (Mumbai Central — 1 unit), and click Reserve from both tabs at the same time. Exactly one succeeds; the other sees "Not enough stock."

---

## Repo layout

```
backend/    Express + TypeScript + Prisma REST API  →  deployed on Render
frontend/   Next.js 14 (App Router) + Tailwind + shadcn/ui  →  deployed on Vercel
```

> **Architecture note:** The task spec suggests a single Next.js app with API routes. I chose to separate the API into its own Express service for cleaner isolation and easier horizontal scaling of the concurrency-critical reservation endpoint. The trade-off is an extra service to deploy; the benefit is that the API can be tested, scaled, and reasoned about independently of the UI.

---

## Quick start (local)

### Prerequisites

- Node.js 20+
- A [Neon](https://neon.tech) Postgres project (free tier)
- An [Upstash](https://upstash.com) Redis database (free tier, optional — idempotency degrades gracefully without it)

### 1. Backend

```bash
cd backend
cp .env.example .env
# Fill in DATABASE_URL, DIRECT_URL, UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN
# CRON_SECRET can be any random string for local dev

npm install
npm run prisma:migrate   # creates tables on your Neon database
npm run seed             # populates 6 products, 3 warehouses, 18 inventory rows
npm run dev              # http://localhost:4000
```

### 2. Frontend

```bash
cd frontend
cp .env.example .env.local
# Set NEXT_PUBLIC_API_BASE_URL=http://localhost:4000

npm install
npm run dev              # http://localhost:3000
```

Browse to `http://localhost:3000`. The root `/` redirects to `/products`.

### Environment variables

**backend/.env**

| Variable | Description |
|---|---|
| `DATABASE_URL` | Neon **pooled** connection string (runtime) |
| `DIRECT_URL` | Neon **direct** connection string (migrations only) |
| `UPSTASH_REDIS_REST_URL` | Upstash Redis endpoint |
| `UPSTASH_REDIS_REST_TOKEN` | Upstash Redis token |
| `CRON_SECRET` | Random string — authorises `POST /api/cron/expire` |
| `FRONTEND_ORIGIN` | CORS allowed origin (e.g. `http://localhost:3000`) |
| `PORT` | Server port (default `4000`) |
| `RESERVATION_TTL_MINUTES` | Hold window in minutes (default `10`) |

**frontend/.env.local**

| Variable | Description |
|---|---|
| `NEXT_PUBLIC_API_BASE_URL` | Full URL of the Express backend |

---

## Architecture

```
Browser
  │
  │  HTTPS
  ▼
Next.js — Vercel (frontend)
  │
  │  HTTPS (REST API)
  ▼
Express — Render (backend)
  │                    │
  │  Prisma ORM        │  @upstash/redis
  ▼                    ▼
Postgres (Neon)    Redis (Upstash)
                   idempotency cache

[ node-cron, in-process on Render ]
  fires every minute → releases expired reservations
```

---

## Concurrency design

### The double-spend problem

Without locking, two simultaneous requests for the last unit produce a race:

```
T1: SELECT available = 1   → ok, proceed
T2: SELECT available = 1   → ok, proceed
T1: UPDATE reserved += 1   → reserved = 1
T2: UPDATE reserved += 1   → reserved = 2, available = -1  ← double-spend
```

Both transactions read `available = 1` before either writes. Both succeed. One unit is sold twice.

### Solution: pessimistic row-level locking

Every reservation runs inside a Postgres transaction that opens with `SELECT … FOR UPDATE` on the `Inventory` row for that `(productId, warehouseId)` pair:

```sql
BEGIN;

SELECT "totalQuantity", "reservedQuantity"
FROM "Inventory"
WHERE "productId" = $1 AND "warehouseId" = $2
FOR UPDATE;                  -- exclusive row lock

-- T2 blocks here until T1 commits

-- application checks: available = totalQuantity - reservedQuantity
-- if available < requested → ROLLBACK → 409 INSUFFICIENT_STOCK

UPDATE "Inventory"
SET "reservedQuantity" = "reservedQuantity" + $3
WHERE "productId" = $1 AND "warehouseId" = $2;

INSERT INTO "Reservation" (..., "status" = 'PENDING', "expiresAt" = NOW() + '10 minutes')
RETURNING *;

COMMIT;                      -- T2 unblocks, re-reads, finds 0 available → 409
```

**Why `FOR UPDATE` and not optimistic locking?**
Optimistic locking (version column + retry) amplifies load under real contention and can starve slow clients. In an inventory system where stock genuinely runs out, the losing request fails on retry too — the retry is wasted work. `FOR UPDATE` serialises access to a single row, guarantees one winner, and returns the correct error to the loser in one round-trip.

**Why not Redis Redlock?**
Redlock is an advisory lock. It does not atomically check-and-update Postgres, so you still need a database transaction. That is two distributed systems that must both be available for every reservation. Postgres already serialises correctly with `FOR UPDATE` — adding Redis for locking would be complexity without benefit. Redis is used only for idempotency caching (the bonus feature), where it is the right tool.

**Code location:** `backend/src/db/reserve.ts`

---

## Reservation expiry

Expired `PENDING` reservations must release their hold on stock automatically. Two complementary layers handle this:

### Layer 1 — Lazy cleanup on read (immediate correctness)

`GET /api/products` computes `availableQuantity` by summing only `PENDING` reservations where `expiresAt > NOW()`:

```typescript
// backend/src/routes/products.ts
const activeReserved = await prisma.reservation.aggregate({
  _sum: { units: true },
  where: {
    productId, warehouseId,
    status: "PENDING",
    expiresAt: { gt: now },   // ← expired holds excluded
  },
});
availableQuantity = totalQuantity - (activeReserved._sum.units ?? 0);
```

Expired holds are invisible on read regardless of whether the background job has run. This means availability is always accurate — even in the seconds between expiry and the next cron tick.

### Layer 2 — Background cleanup (database hygiene)

A `node-cron` job inside the Express process fires every minute. It:

1. Finds all `PENDING` reservations where `expiresAt ≤ NOW()`
2. Groups them by `(productId, warehouseId)` and sums units to return
3. Decrements `reservedQuantity` and flips status to `RELEASED` in a **single transaction**

The `Reservation(status, expiresAt)` compound index makes this query fast even at scale.

The cron job is also exposed as `POST /api/cron/expire` (protected by `Authorization: Bearer <CRON_SECRET>`) so any external scheduler can trigger it independently.

**Code location:** `backend/src/db/expire.ts`, `backend/src/routes/cron.ts`

**Why both layers?**
Lazy cleanup keeps availability exact but lets `reservedQuantity` drift upward — confusing in admin views and a latent bug if the lazy logic ever has a regression. Background cleanup keeps the database clean but leaves up to a 60-second window after expiry where `reservedQuantity` is stale. Together, availability is always exact and the database stays clean.

---

## Bonus: Idempotency

`POST /api/reservations` and `POST /api/reservations/:id/confirm` support the `Idempotency-Key` request header. If a client retries with the same key, the server returns the original response without repeating the side effect — no double reservation, no double charge.

### Implementation

```
Request with Idempotency-Key header
         │
         ▼
  Redis GET idem:<key>  ──hit──►  return cached response (sub-ms)
         │ miss
         ▼
  Postgres SELECT idempotency_keys WHERE key = ?  ──hit──►  return DB response
         │ miss
         ▼
  Execute handler (create reservation / confirm)
         │
         ▼
  Store result in Redis (24h TTL)  +  INSERT idempotency_keys
         │
         ▼
  Return response
```

**Key properties:**
- Redis is the fast path (sub-millisecond reads on cache hits)
- Postgres `IdempotencyKey` table is the durable fallback if Redis evicts the key before TTL
- **Errors are not cached** — a `409` or `410` response is not stored, so a retry can re-validate against current state
- 24-hour TTL matches standard industry practice (Stripe, PayPal)

**Code location:** `backend/src/lib/idempotency.ts`

---

## API reference

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/products` | Products with `availableQuantity` per warehouse (lazy-cleaned) |
| `GET` | `/api/warehouses` | All warehouses |
| `POST` | `/api/reservations` | Reserve units — `409` if insufficient stock, supports `Idempotency-Key` |
| `GET` | `/api/reservations/:id` | Fetch a single reservation with product + warehouse details |
| `POST` | `/api/reservations/:id/confirm` | Confirm (payment succeeded) — `410` if expired, supports `Idempotency-Key` |
| `POST` | `/api/reservations/:id/release` | Release early — idempotent if already released |
| `POST` | `/api/cron/expire` | Trigger expiry cleanup — requires `Authorization: Bearer <CRON_SECRET>` |
| `GET` | `/health` | Uptime check |

All error responses use the shape `{ error: string, code: string }`.

---

## Trade-offs and things I'd do differently

**Architecture deviation**
The task suggests a single Next.js app with API routes. I separated the API into its own Express service. The upside is cleaner isolation and independent deployability of the concurrency-critical layer. The downside is two services to deploy and an extra CORS configuration step.

**No authentication**
Reservations are not scoped to a user session. Anyone who knows a reservation ID can confirm or cancel it. A production system would attach a `userId` or `sessionId` to each reservation and enforce ownership on confirm/release.

**Cron granularity is 1 minute**
The `node-cron` in-process scheduler fires every minute, so there is up to a 60-second window after expiry where `reservedQuantity` is stale in the database (availability is still accurate via the lazy layer). A persistent worker with delayed jobs (e.g. BullMQ) would allow sub-minute precision and guaranteed delivery even if the process restarts mid-window.

**No rate limiting**
The reservation endpoint has no per-IP or per-session rate limit. A bad actor could lock up all stock across all warehouses without purchasing. A sliding-window rate limiter (implementable with the existing Upstash Redis connection) would mitigate this.

**Polling instead of WebSockets**
The reservation detail page polls `GET /api/reservations/:id` every 5 seconds to detect state changes from other tabs. Server-Sent Events or WebSockets would push updates instantly without the polling overhead, but polling is simpler and sufficient for a debrief demo.

**`reservedQuantity` counter vs. live aggregation**
`reservedQuantity` is a denormalised counter on the `Inventory` row, updated on every reservation and release. An alternative is to always compute it from the `Reservation` table at query time, which gives a simpler schema. The counter approach is faster under read-heavy load (one row read vs. an aggregate query) but adds a consistency obligation: every write path must update it atomically in the same transaction. The `FOR UPDATE` lock on `Inventory` enforces this.
