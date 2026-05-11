# Backend — Inventory Reservation API

Express + TypeScript + Prisma REST API for the inventory + reservation system.

## Quick start

```bash
cd backend
cp .env.example .env   # fill in DATABASE_URL, DIRECT_URL, etc
npm install
npm run prisma:generate
npm run prisma:migrate
npm run seed
npm run dev
```

Server listens on `http://localhost:4000`. Health check at `GET /health`.

## Endpoints (added in later phases)

- `GET  /api/products` — list products with available stock per warehouse
- `GET  /api/warehouses` — list warehouses
- `POST /api/reservations` — reserve units (race-condition safe via `SELECT FOR UPDATE`)
- `POST /api/reservations/:id/confirm` — confirm a pending reservation
- `POST /api/reservations/:id/release` — release a pending reservation early
- `GET  /api/reservations/:id` — fetch a single reservation
- `POST /api/cron/expire` — release expired reservations (auth via `CRON_SECRET`)

## Env vars

See `.env.example`.
