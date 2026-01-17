# Tracker (SvelteKit + Cloudflare D1)

A compact daily tracker for habits and trackables, built for Cloudflare Pages + Functions with cookie sessions for the UI and API key access for integrations.

## Architecture
- Frontend: SvelteKit SPA (no SSR) deployed on Cloudflare Pages.
- API: SvelteKit server routes under `/api/*` with session and API key auth.
- Database: Cloudflare D1 (SQLite) using sparse daily entry tables.
- Hosting: `@sveltejs/adapter-cloudflare` with Wrangler for local dev.

## Getting started (local dev)
1. Install dependencies
   ```bash
   npm install
   ```
2. Create a D1 database
   ```bash
   wrangler d1 create tracker-db
   wrangler d1 execute tracker-db --file=./migrations/0001_init.sql
   wrangler d1 execute tracker-db --file=./migrations/0002_api_key_encryption.sql
   ```
3. Configure environment
   - Update `wrangler.toml` with your D1 `database_id`.
   - Set variables (example in `.dev.vars`):
     - `DEFAULT_TZ` (optional, e.g. `America/New_York`)
     - `ALLOWED_ORIGINS` (optional comma list for CORS)
     - `DEV_SEED_TOKEN` (required to call the seed endpoint)
     - `API_KEY_SECRET` (required to decrypt/reveal API keys)
4. Seed demo data (optional)
   ```bash
   curl -X POST "http://127.0.0.1:5173/api/dev/seed" -H "X-Dev-Seed: dev-seed"
   ```
   Use the returned `email` and `password` to sign in.
5. Run dev server
   ```bash
   npm run dev
   ```

## Auth model
- Web UI uses cookie sessions stored in the `sessions` table.
- API key auth is supported via `Authorization: Bearer <api_key>` or `X-API-Key`.
- Passwords are hashed with `bcryptjs`.
- API keys are stored as SHA-256 hashes plus an encrypted copy (AES-GCM using `API_KEY_SECRET`) to allow reveal after login.

## Stats definitions
- Yearly completion: done (or entry) days divided by elapsed days in the year.
- Monthly completion: done (or entry) days divided by elapsed days in the month.
- Habit missing count: elapsed month days minus done days.
- Trackable missed count: elapsed month days minus entry days.
- Streaks are measured as consecutive days ending today.

## API summary
All endpoints return `{ ok: boolean, data|error }`.

### Auth
- `POST /api/auth/login` `{ email, password }`
- `POST /api/auth/signup` `{ email, password }`
- `POST /api/auth/logout`
- `GET /api/me`
- `POST /api/api-key/reveal`
- `POST /api/api-key/regenerate`

### Habits
- `GET /api/habits`
- `POST /api/habits` `{ name }`
- `PATCH /api/habits/:id` `{ name?, sort_order?, active? }`
- `DELETE /api/habits/:id`
- `PUT /api/habits/:id/entries/:day` `{ done }`

### Trackables
- `GET /api/trackables`
- `POST /api/trackables` `{ name, unit?, min_value?, max_value? }`
- `PATCH /api/trackables/:id` `{ name?, unit?, min_value?, max_value?, sort_order?, active? }`
- `DELETE /api/trackables/:id`
- `PUT /api/trackables/:id/entries/:day` `{ value }` (0 deletes the entry)

### Dashboard + stats
- `GET /api/dashboard?days=5&page=0`
- `GET /api/stats?year=YYYY&month=YYYY-MM`

## Deploy to Cloudflare Pages
1. Build
   ```bash
   npm run build
   ```
2. Configure Pages
   - Build command: `npm run build`
   - Output: `.svelte-kit/cloudflare`
   - Env vars: `DEFAULT_TZ`, `ALLOWED_ORIGINS`
   - Bind D1 database as `DB` and run the migration in `migrations/0001_init.sql`

## Notes
- D1 schema matches `migrations/0001_init.sql`.
- The UI is a single-page layout that mirrors `static_design.html`.
