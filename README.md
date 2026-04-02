## Assignment 17 App Starter (Person A+B)

This is a Next.js App Router starter for your Chapter 17 deployment assignment.

It includes:
- Select Customer screen (no auth)
- Customer dashboard
- Place new order flow
- Order history page
- Late Delivery Priority Queue page
- Run Scoring button (`POST /api/scoring/run`)

The app uses Supabase when env vars are configured, and falls back to local mock data for quick development.

## Quick Start

1. Install and run:
   - `npm install`
   - `npm run dev`
2. Open [http://localhost:3000](http://localhost:3000)
3. Select a customer, then test the app flows.

## Environment Variables

Copy `.env.local.example` to `.env.local` and set:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

If these are not set, the app uses in-memory mock data.

## Core Routes

- `/` Select Customer
- `/dashboard` Customer dashboard
- `/orders/new` Place new order
- `/orders/history` Order history
- `/warehouse` Late delivery queue

## API Routes

- `GET /api/select-customer?customer_id=<id>` sets selected customer cookie
- `POST /api/orders` creates a new order
- `POST /api/scoring/run` runs scoring and redirects to warehouse queue

## Next Steps (Person A)

- Add `shop.db` -> Supabase migration script and run row-count checks.
- Replace any remaining mock assumptions with real Supabase tables.
- Add basic error handling and user-facing success/error messages.
- Deploy to Vercel after env vars are configured.

## SQLite -> Supabase Migration Script

Run this from `assignment17-app`:

1) Install migration dependency:
- `python3 -m venv .venv`
- `source .venv/bin/activate`
- `pip install -r scripts/requirements-migration.txt`

2) Set DB URL:
- `export SUPABASE_DB_URL='postgresql://postgres:YOUR_PASSWORD@db.YOUR_REF.supabase.co:5432/postgres?sslmode=require'`

3) Run migration:
- `python scripts/migrate_sqlite_to_supabase.py`

Notes:
- Source SQLite defaults to `../shop.db`.
- By default it truncates destination tables first (`TRUNCATE_FIRST=true`).
- It migrates: `customers`, `products`, `orders`, `order_items`, `product_reviews`, `shipments`.
- It prints row-count verification for each table.

## Deploy on Vercel

1. Push this repo to GitHub (or use Vercel CLI: `npx vercel`).
2. In Vercel **Import Project**, set **Root Directory** to `assignment17-app` if your repo root is the parent folder.
3. Add **Environment Variables** (Production + Preview):
   - `NEXT_PUBLIC_SUPABASE_URL` — from Supabase Project Settings → API
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` — publishable/anon key (same screen)
4. Do **not** add `SUPABASE_DB_URL` to Vercel unless you run migrations from CI; keep DB passwords off the edge app.
5. Deploy, then open the production URL and test Select Customer → Dashboard → Place Order → Warehouse.

Migration stays local: run `scripts/migrate_sqlite_to_supabase.py` from your machine when you need to refresh data.
