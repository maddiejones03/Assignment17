## Assignment 17 App Starter (Person A+B)

This is a Next.js App Router starter for your Chapter 17 deployment assignment.

It includes:
- Select Customer screen (no auth)
- Customer dashboard
- Place new order flow
- Order history page
- Fraud verification queue (ML-scored priority list)
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
- `/warehouse` Fraud verification queue (top risk orders)

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

### Before you push

- Commit **`fraud_model.joblib`**, **`threshold.json`**, and **`feature_order.json`** in the app root (or put the three files under **`model/`**). The Python scorer (`api/fraud_score.py`) needs them in the deployment bundle. If they are gitignored, add them or set **`FRAUD_MODEL_DIR`** in Vercel to a path that exists in the build (or use **`FRAUD_SCORING_URL`** to an external scorer).

### Steps in the Vercel dashboard

1. Push the repo to GitHub (or GitLab / Bitbucket).
2. Go to [vercel.com](https://vercel.com) → **Add New…** → **Project** → **Import** your repository.
3. **Root Directory:** set to **`assignment17-app`** if the repo root is the parent `Assigment17` folder; leave blank if the repo is only the app folder.
4. **Framework Preset:** should detect **Next.js**. Leave the default build (`next build`) and output unless you changed them.
5. **Environment Variables** (add for **Production** and **Preview**):
   - `NEXT_PUBLIC_SUPABASE_URL` — Supabase → **Project Settings** → **API** → Project URL
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` — same page → **anon public** key
6. Do **not** put `SUPABASE_DB_URL` in Vercel for the running app (migrations stay on your machine). Optional: `FRAUD_MODEL_DIR` if artifacts live in a non-default folder.
7. Click **Deploy**. Vercel will install **npm** deps and, because **`requirements.txt`** exists at the app root, install **Python** packages for **`api/fraud_score.py`**.
8. After deploy, smoke-test:
   - Open **`https://<your-project>.vercel.app/api/fraud_score`** in the browser — you should see JSON like `{"ok": true, ...}` if the model file is present.
   - In the app: **Warehouse** → **Run Scoring** — it calls the Node route, which POSTs to `/api/fraud_score` automatically (no `FRAUD_SCORING_URL` needed on Vercel).

### CLI alternative

From `assignment17-app`: `npx vercel` (link account, accept defaults). Set env vars in the dashboard afterward if you skipped them.

### Local note

`npm run dev` uses the local Python subprocess for scoring. On Vercel, scoring uses the **Python serverless** route above.

Migration stays local: run `scripts/migrate_sqlite_to_supabase.py` from your machine when you need to refresh data.
