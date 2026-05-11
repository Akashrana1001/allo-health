# Inventory Reservation System

A race-condition-safe inventory and reservation platform for multi-warehouse retail. When a customer checks out, the system holds units for 10 minutes. If payment succeeds the hold is confirmed permanently. If it fails or the timer runs out, stock is returned automatically.

**Live app → https://frontend-nu-lake-96.vercel.app**

---

## Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 14 (App Router), TypeScript, Tailwind CSS, shadcn/ui, React Query |
| Backend | Express, TypeScript, Prisma ORM |
| Database | PostgreSQL via Neon (hosted) |
| Cache | Redis via Upstash (idempotency) |
| Validation | Zod (shared between API and forms) |
| Hosting | Vercel (frontend) + Render (backend) |

---

## Project structure

```
allo-health/
├── backend/                  Express REST API
│   ├── prisma/
│   │   ├── schema.prisma     Data model
│   │   ├── migrations/       SQL migration history
│   │   └── seed.ts           Demo data seeder
│   └── src/
│       ├── config/env.ts     Typed environment config
│       ├── db/
│       │   ├── reserve.ts    SELECT FOR UPDATE reservation logic
│       │   └── expire.ts     Batch expiry release logic
│       ├── lib/
│       │   ├── prisma.ts     Prisma client singleton
│       │   ├── redis.ts      Upstash Redis client
│       │   ├── errors.ts     Typed error classes
│       │   ├── schemas.ts    Zod request/response schemas
│       │   └── idempotency.ts  Redis + Postgres idempotency wrapper
│       ├── middleware/
│       │   ├── errorHandler.ts  Global Express error handler
│       │   └── validate.ts      Zod body validation middleware
│       ├── routes/
│       │   ├── products.ts
│       │   ├── warehouses.ts
│       │   ├── reservations.ts
│       │   └── cron.ts
│       └── index.ts          Express app + node-cron scheduler
│
└── frontend/                 Next.js 14 App Router
    ├── app/
    │   ├── products/         Product listing page (Server Component)
    │   └── reservations/[id] Reservation detail page (Client Component)
    ├── components/
    │   ├── ui/               shadcn/ui primitives
    │   ├── navbar.tsx
    │   ├── product-card.tsx
    │   ├── reserve-modal.tsx
    │   └── countdown-timer.tsx
    └── lib/
        ├── api.ts            Typed fetch wrapper
        └── schemas.ts        Shared Zod types (mirrors backend)
```

---

## Running locally

### Prerequisites

- Node.js 20+
- A [Neon](https://neon.tech) Postgres project (free tier)
- An [Upstash](https://upstash.com) Redis database (free tier, optional — idempotency works without it)

### 1. Backend

```bash
cd backend
cp .env.example .env
```

Fill in `.env`:

```env
DATABASE_URL="postgresql://..."        # Neon pooled connection string
DIRECT_URL="postgresql://..."          # Neon direct connection string (for migrations)
UPSTASH_REDIS_REST_URL="https://..."   # Upstash Redis URL
UPSTASH_REDIS_REST_TOKEN="..."         # Upstash Redis token
CRON_SECRET="any-random-string"        # Protects POST /api/cron/expire
FRONTEND_ORIGIN="http://localhost:3000"
PORT=4000
RESERVATION_TTL_MINUTES=10
```

```bash
npm install
npm run prisma:migrate   # creates all tables on Neon
npm run seed             # inserts 6 products, 3 warehouses, 18 inventory rows
npm run dev              # http://localhost:4000
```

### 2. Frontend

```bash
cd frontend
cp .env.example .env.local
# set NEXT_PUBLIC_API_BASE_URL=http://localhost:4000

npm install
npm run dev              # http://localhost:3000
```

Browse to `http://localhost:3000`. The root `/` redirects to `/products`.

---

## Data model

```
Product
  └─< Inventory >─ Warehouse      (one row per product-warehouse pair)
  └─< Reservation                 (one per checkout attempt)
```

**Inventory** stores `totalQuantity` (physical units) and `reservedQuantity` (units held by active pending reservations). `availableQuantity` is never stored — it is always computed.

**Reservation** statuses: `PENDING` → `CONFIRMED` or `RELEASED`.

**IdempotencyKey** is the durable backing store for the idempotency cache.

---

## API

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/products` | Products with real-time `availableQuantity` per warehouse |
| `GET` | `/api/warehouses` | All warehouses |
| `POST` | `/api/reservations` | Create a reservation — `409` if insufficient stock |
| `GET` | `/api/reservations/:id` | Fetch reservation with product + warehouse details |
| `POST` | `/api/reservations/:id/confirm` | Confirm (payment succeeded) — `410` if expired |
| `POST` | `/api/reservations/:id/release` | Release early — idempotent if already released |
| `POST` | `/api/cron/expire` | Release expired reservations — requires `Authorization: Bearer <CRON_SECRET>` |
| `GET` | `/health` | Uptime check |

All `4xx` errors return `{ error: string, code: string }`.

---

## Concurrency: how two simultaneous requests are handled

The core problem: two requests arrive at the same millisecond for the last unit of a SKU. Without a lock, both read `available = 1`, both pass the check, and both succeed — one unit is sold twice.

The solution is `SELECT … FOR UPDATE` inside a Postgres transaction (`backend/src/db/reserve.ts`):

```sql
BEGIN;

SELECT "totalQuantity", "reservedQuantity"
FROM "Inventory"
WHERE "productId" = $1 AND "warehouseId" = $2
FOR UPDATE;
-- Request 2 blocks here until Request 1 commits

-- check: available = totalQuantity - reservedQuantity
-- if available < requested units → ROLLBACK → 409

UPDATE "Inventory" SET "reservedQuantity" = "reservedQuantity" + $3 ...;
INSERT INTO "Reservation" (..., status = 'PENDING', expiresAt = NOW() + 10min);

COMMIT;
-- Request 2 unblocks, re-reads, finds 0 available → 409
```

**Result:** exactly one request wins with `201`. The other gets `409 INSUFFICIENT_STOCK` immediately — no retries, no race.

**Why not optimistic locking?** Optimistic locking retries on conflict. Under real contention the losing request will fail again after re-reading — the retry is wasted work. `FOR UPDATE` serialises access in one round-trip.

**Why not Redis distributed lock?** Redis locks are advisory — they don't atomically check-and-update the database, so a transaction is still required. That's two systems that must both be healthy for every reservation. Postgres handles this correctly on its own.

---

## Reservation expiry

Two layers work together:

### Layer 1 — Lazy cleanup on read

`GET /api/products` computes `availableQuantity` by summing only `PENDING` reservations where `expiresAt > NOW()`. Expired holds are excluded on every read regardless of whether the background job has run yet. Availability is always accurate.

### Layer 2 — Background job

A `node-cron` scheduler inside the Express process fires every minute. It finds all expired `PENDING` reservations, groups units to return per inventory row, and in a single transaction decrements `reservedQuantity` and sets status to `RELEASED`.

The same logic is also exposed as `POST /api/cron/expire` so an external scheduler can trigger it independently.

**Why both?** Lazy cleanup keeps availability correct instantly. The background job keeps `reservedQuantity` clean so the database stays trustworthy and doesn't drift.

---

## Idempotency (bonus)

`POST /api/reservations` and `POST /api/reservations/:id/confirm` accept an `Idempotency-Key` header. Retrying with the same key returns the original response without repeating the side effect.

**Flow** (`backend/src/lib/idempotency.ts`):

1. Check Upstash Redis for `idem:<key>` — returns cached response in sub-millisecond if found
2. Check the `IdempotencyKey` Postgres table — durable fallback if Redis has evicted the key
3. On cache miss, run the handler and write the result to both Redis (24h TTL) and Postgres
4. **Error responses (`4xx`) are not cached** — retries re-validate against current state

---

## Trade-offs

**Separate backend service**
The task suggests a single Next.js app with API routes. A standalone Express API was chosen for cleaner isolation of the concurrency-critical reservation logic. The trade-off is an extra service to deploy.

**No authentication**
Reservations are not scoped to a user. Anyone with a reservation ID can confirm or cancel it. A production system would attach a session or user ID and enforce ownership.

**Cron granularity is 1 minute**
There is up to a 60-second window after expiry where `reservedQuantity` is stale in the database (availability is still accurate via the lazy layer). A job queue with delayed tasks (e.g. BullMQ) would allow per-reservation precision.

**No rate limiting**
The reservation endpoint has no per-IP limit. A sliding-window rate limiter using the existing Upstash Redis connection would prevent stock lock-up abuse.

**Polling instead of WebSockets**
The reservation detail page polls every 5 seconds. Server-Sent Events would push updates instantly with less overhead.
