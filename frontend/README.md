# Frontend — Inventory Reservation UI

Next.js 14 (App Router) + Tailwind + shadcn/ui. Talks to the Express backend.

## Quick start

```bash
cd frontend
cp .env.example .env.local   # point NEXT_PUBLIC_API_BASE_URL at the backend
npm install
npm run dev
```

App runs on `http://localhost:3000`. Make sure the backend is up first.

## Pages

- `/products` — product listing with stock badges per warehouse + reserve modal
- `/reservations/[id]` — reservation detail with live countdown, confirm + cancel
