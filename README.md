# Tracker (SvelteKit + Cloudflare D1)

A lightweight tracker for daily habits and other trackables (mood, enums, numbers, text). Built for Cloudflare Pages + Functions with a secure REST API and Home Assistant-friendly design.

## Architecture
- **Frontend**: SvelteKit SPA (no SSR) served via Cloudflare Pages Functions.
- **API**: `/api/*` SvelteKit server routes secured with a static bearer token from `API_TOKEN`.
- **Database**: Cloudflare D1 (SQLite) using a sparse daily entry model (defaults implied when no row exists).
- **Hosting**: Cloudflare Pages + Functions with `@sveltejs/adapter-cloudflare` and `wrangler`.
- **Time**: Dates are treated as date-only strings; `DEFAULT_TZ` controls the timezone for "today" (defaults to UTC).

## Getting started (local dev)
1. **Install dependencies**
   ```bash
   npm install
   ```
2. **Create a D1 database**
   ```bash
   wrangler d1 create tracker-db
   wrangler d1 execute tracker-db --file=./migrations/0001_init.sql
   ```
3. **Configure environment**
   - Copy `wrangler.toml` and set:
     - `API_TOKEN` (required for all API calls)
     - `DEFAULT_TZ` (optional, e.g., `America/New_York`)
     - `ALLOWED_ORIGINS` (optional comma list for CORS)
   - Bind the D1 database by updating `database_id` in `wrangler.toml`.
4. **Run dev server**
   ```bash
   npm run dev
   ```
   The SPA will call the local API; provide the same `API_TOKEN` in the UI.

## Deploy to Cloudflare Pages
1. **Build**
   ```bash
   npm run build
   ```
2. **Publish**
   - Set Pages project build to `npm run build` with output `.svelte-kit/cloudflare`.
   - Configure environment variables (`API_TOKEN`, `DEFAULT_TZ`, `ALLOWED_ORIGINS`).
   - Attach the D1 binding named `DB` and run the migration (`migrations/0001_init.sql`).

## REST API
All endpoints require `Authorization: Bearer <API_TOKEN>` and respond with `{ ok: boolean, data|error }`.

### `GET /api/stats/today`
Returns current date data with defaults applied and aggregates (habit progress).

### `GET /api/stats?days=21`
History window (default 21, max 90). Missing values imply defaults; `values` only includes stored non-default entries.

### `POST /api/action`
Single action endpoint:
- `trackable.create`: `{ name, key?, kind, value_type, config?, icon?, color?, sort_order? }`
- `trackable.update`: `{ id, ...fields }`
- `trackable.delete`: `{ id }`
- `entry.set`: `{ trackable_id|trackable_key, date:"YYYY-MM-DD", value }`
- `entry.clear`: `{ trackable_id|trackable_key, date }`
- `entry.toggle`: `{ trackable_id|trackable_key, date }` (boolean only)

Validation errors surface as `{ ok:false, error:{ code, message } }` with codes like `INVALID_DATE`, `INVALID_VALUE`, `OUT_OF_RANGE`, `NOT_FOUND`, `UNAUTHORIZED`.

## Data model
- **trackables**: definitions (kind, value_type, config JSON, optional key for HA, sort order, soft delete).
- **daily_entries**: sparse daily values (one row per non-default value). Default comes from `config.default` or type.

## Home Assistant integration (outline)
- **Sensors via polling**: Create a custom integration that polls `/api/stats/today` with the bearer token.
  - Boolean habits -> `binary_sensor.habit_<key>` (state on/off from `value`).
  - Other trackables -> `sensor.tracker_<key>` (state = typed value).
  - Aggregates -> e.g., `sensor.habits_done_today` using `aggregates.habits_done_today`.
- **Services**: Map `set_status` to `POST /api/action` with `"action":"entry.set"` and `clear_status` to `"entry.clear"`.
- **Stable IDs**: Use `key` per trackable to keep HA entity IDs stable; `id` is also stable UUID.

Example HA service payload:
```yaml
service: tracker.set_status
data:
  trackable_id: <id or key>
  date: 2024-12-30
  value: true
```

## Notes
- All API endpoints enforce bearer auth; missing/invalid tokens return 401 without stack traces.
- CORS is same-origin by default. Set `ALLOWED_ORIGINS="https://your-ha.local"` to allow cross-origin calls.
- Defaults are inferred; setting a value equal to default deletes the row (keeps storage sparse).
