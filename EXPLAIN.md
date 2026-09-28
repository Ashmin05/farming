# FasalSetu — Project Explainer

This document explains what has been built so far: the overall idea, the frontend, the backend,
the database, authentication, environment configuration, and what is real vs. mock data today.
It reflects the current state of `main`.

---

## 1. What this project is

FasalSetu ("crop bridge") is a farming intelligence web app aimed at Indian farmers. It gives a
farmer a dashboard per-farm view covering:

- Satellite crop health (NDVI/NDWI vegetation & moisture indices, stress-zone detection)
- Weather forecasts and alerts with farming-specific advisories
- Irrigation/soil recommendations
- Yield estimation and mandi (market) price trends
- An AI chat assistant ("KrishiBot")
- Multi-language UI (English, Bengali, Hindi)

The product is split into two independently deployable pieces: a Next.js frontend and a FastAPI
backend, talking over a REST API, backed by PostgreSQL (with the PostGIS extension enabled for
future geospatial work on field boundaries).

---

## 2. Repository / branch layout

This is a single repo. Feature branches (`frontend`, `backend`, `back_auth`, `profile_setup`,
`profile_fixes`, `farm-backend`, `earth-engine`, `satellite-analysis`, `satellite-frontend`,
`satellite-timeseries-alerts`, `redesign-dashboard-satellite-ui`, `satellite-map-tiles-stress-zones`,
`farm-environment-report`, `environment-nightly-refresh`, `new-frontend`, `bug-fixes`, `mandi-prices`, and the
market-price stack `feat/price-data-provider` → `feat/price-ingestion` → `feat/price-history-backfill` →
`feat/price-analytics` → `feat/price-forecast-model` → `feat/price-api` → `feat/price-frontend`) were used during buildout
and have all been merged into `main` (`new-ui`, §5.15, is the branch in progress), which is
what's pushed to origin and described by this document. Notable merged work, roughly in order:

- `back_auth` — JWT + Google auth system, real Login/Register pages, per-account data isolation.
- `profile_setup` — profile fields, `/profile` edit page, forgot/reset password (later removed).
- `profile_fixes` — fixed a `/profile` infinite-loading bug, removed mock/demo data leaking into
  logged-in accounts, removed forgot/reset password and "Remember me" entirely (§6.6), simplified
  registration, made the public nav auth-aware.
- `farm-backend` — real database persistence for farms (§5.4), replacing the farms half of the
  frontend's localStorage-only mock store.
- `earth-engine` — a Google Earth Engine client with a health-check endpoint (§5.5), the first
  step toward real satellite crop-health data.
- `satellite-analysis` — the first real satellite analysis endpoint: live Sentinel-2 NDVI/NDWI/
  EVI/NDMI per farm polygon, cached in a new `satellite_observations` table, with a 0–100 health
  score and a background refresh triggered on farm creation (§5.6).
- `satellite-frontend` — wires that endpoint into the UI: real NDVI/canopy stats and a live-data
  banner with a refresh button on the Satellite page and Dashboard, for real farms only (§5.7).
  Found and fixed two real bugs along the way that only showed up against live Earth Engine data,
  not the mocked tests (§5.7).
- `satellite-timeseries-alerts` — tracks a farm's NDVI/NDWI/EVI *history* (not just "right now"):
  per-crop benchmark curves, a nightly APScheduler job that rebuilds every farm's timeseries and
  runs three anomaly-detection alert rules (NDVI drop, below-benchmark, water stress), and the
  endpoints to read both (§5.9). Backend-only so far, same as §5.6 before §5.7 existed.
- `redesign-dashboard-satellite-ui` — full visual redesign of the Dashboard and Satellite pages to
  match a new mockup: a greeting hero card, restructured stat/suggestion/harvest cards, a canopy
  health donut chart, and a simplified layer-tab + map layout on the Satellite page. Presentation
  only — no backend changes.
- `satellite-map-tiles-stress-zones` — visualised Sentinel-2 map tiles (true colour, NDVI, NDWI,
  EVI, stress classification) clipped to the farm polygon via `getMapId()`, cached with a 12h
  expiry, plus per-pixel stress-zone vectorization (`reduceToVectors`) classified as water-stress
  or nutrient/pest-suspected and stored with area + a suggested action (§5.10). Wired end-to-end:
  the Satellite page's layer tabs now render the real raster overlay and stress-zone polygons on
  the map, not synthetic data.
- `farm-environment-report` — a farm-level environment report beyond vegetation indices: rainfall
  (CHIRPS), land-surface temperature (MODIS), soil moisture (SMAP, regional), and static soil
  properties (OpenLandMap: pH, organic carbon, USDA texture class), each carrying its own
  provenance and native resolution (§5.11). Backend-only so far, same as §5.6 before §5.7 existed.
- `new-frontend` — replaces the remaining mock data on the Satellite page and the Dashboard's
  health/NDVI cards with TanStack Query hooks over the real endpoints (`/satellite/latest`,
  `/timeseries`, `/layers`, `/environment`, `/alerts`) for signed-in users' farms, adds a Recharts
  season-curve chart, a pass-date slider that swaps the map layers, a `SourceBadge` on every
  satellite number, loading/empty/error states, and a Dashboard alerts strip with mark-as-read
  (§5.12). Found and fixed two real backend bugs that only live testing surfaced (§5.12).
- `bug-fixes` — a review pass over §5.12 and the paths it touches: automatic token refresh
  (users were effectively logged out after 30 minutes), load-error states instead of a
  misleading "No farms yet", nightly jobs that no longer skip every later farm after one DB
  error, Earth Engine errors as clean 503s, real error states for failed layers/timeseries, and
  no more duplicate first analyses (§5.13).
- `mandi-prices` — a first, data.gov.in-only mandi price sync into a flat `mandi_prices` table.
  Never released: superseded by the market price stack below before being merged.
- Market price intelligence (§5.14), built as seven stacked branches, each on top of the last:
  - `feat/price-data-provider`: a provider layer over Agmarknet 2.0 (primary, verified live), CEDA and
    data.gov.in, with the verified API write-up in `docs/market-price-api.md`.
  - `feat/price-ingestion`: a normalised catalogue + `market_prices` schema and an idempotent
    validate → dedupe → resolve → upsert pipeline, run by a nightly job.
  - `feat/price-history-backfill`: resumable month-by-month historical import. West Bengal
    2021–2026 is loaded: 456k records.
  - `feat/price-analytics`: precomputed daily series and per-market stats, a data-quality report,
    and nearby mandis with opt-in OSM geocoding.
  - `feat/price-forecast-model`: 7/14/30-day forecasting with baselines vs ML, chronological
    validation, prediction intervals, and a model registry.
  - `feat/price-api`: the `/market-prices/*` endpoints.
  - `feat/price-frontend`: the `/market` page, plus a real mandi card on the Dashboard.
- Assorted small UI passes since: removed the "Ask KrishiBot" button from the home hero, gated
  the KrishiBot AI chat behind sign-in (§6.8), added a glassmorphism background to Login/Register
  (§4.4).
- `limit-crop-list` — restricted every crop-selection control app-wide to five crops (Rice, Wheat,
  Onion, Sugarcane, Potato), instead of offering the full Agmarknet catalogue (§5.16).
- `market-sugarcane-crop` — fixed Sugarcane being silently missing from the Market page's crop
  dropdown despite being one of the five allowed crops, and added an honest "no data" notice for
  it instead of a blank page (§5.16).
- `weather` — a real Open-Meteo-backed weather forecast endpoint, replacing the Dashboard's Field
  Weather card's synthetic data for real farms (§5.17).
- `irrigation` — a real FAO-56 crop-coefficient irrigation model: a daily root-zone depletion
  balance per farm (CHIRPS/Open-Meteo history + forecast, NDVI-adjustable Kc, soil-texture-derived
  available water), with a farmer irrigation log and a "next irrigation date + depth" endpoint
  (§5.18). Backend-only so far, same as §5.6 before §5.7 existed.

---

## 3. Tech stack

**Frontend**
- Next.js 14 (App Router), React 18, TypeScript
- Tailwind CSS + shadcn/ui components (`@base-ui/react`, `class-variance-authority`)
- Mapbox GL + `@mapbox/mapbox-gl-draw` + `@turf/turf` — interactive satellite maps, field boundary drawing, area calculations
- `@tanstack/react-query` — server-state caching: the real satellite/environment/alerts hooks
  (§5.12), the mandi price hooks (§5.14) plus the (still mock) generic data hooks
- `recharts` — the NDVI season-curve chart (§5.12) and the mandi price trend / forecast charts (§5.14)
- `lucide-react` — icons

**Backend**
- FastAPI (Python 3.10+), fully async
- SQLAlchemy 2.0 (async engine, `asyncpg` driver) as the ORM
- Alembic — versioned database migrations
- `pydantic` / `pydantic-settings` — request/response validation and `.env`-backed config
- `bcrypt` — password hashing
- `PyJWT` — access/refresh token signing & verification
- `google-auth` — verifies "Sign in with Google" ID tokens, and (separately) authenticates the
  Earth Engine client via Application Default Credentials (§5.5)
- `shapely` + `pyproj` — validates farm polygons and computes area/centroid using a locally
  centered equal-area projection (not raw lat/lng math) — see §5.4
- `earthengine-api` — the official Google Earth Engine Python SDK (§5.5)
- `tenacity` — retries with exponential backoff for the mandi price providers (§5.14)
- `numpy`, `pandas`, `scikit-learn`, `lightgbm`, `joblib` — mandi price forecasting: dataset
  building, models, stored model artifacts (§5.14)
- `pytest` + `pytest-asyncio` + `aiosqlite` — async test suite against an in-memory SQLite DB
- `respx` — mocks `httpx` requests in tests, replaying trimmed copies of real Agmarknet/CEDA
  responses (§5.14)

**Database**
- PostgreSQL 17 with the **PostGIS** extension enabled — farms are stored with a `JSON`/`JSONB`
  polygon column (not a native PostGIS geometry type yet; see §5.4)
- Local dev instance managed via pgAdmin

---

## 4. Frontend

### 4.1 Pages (`src/app/*/page.tsx` → `src/views/*Page.tsx`)

Each route is a thin `page.tsx` that just re-exports the real implementation from `src/views/`,
per the project's own convention (documented in each `page.tsx`).

| Page | URL | View file |
| :--- | :--- | :--- |
| Home | `/` | `HomePage.tsx` |
| Login | `/login` | `LoginPage.tsx` |
| Register | `/register` | `RegisterPage.tsx` |
| Dashboard | `/dashboard` | `DashboardPage.tsx` |
| My Farms | `/farms` | `FarmsPage.tsx` |
| Farm detail / Field detail | `/farms/[farmId]`, `/farms/[farmId]/fields/[fieldId]` | (in `src/app/farms/...`) |
| Satellite Analysis | `/satellite` | `SatellitePage.tsx` |
| Market | `/market` | `MarketPage.tsx`: live mandi prices, 90-day + 30-day forecast chart, sell-or-hold suggestion, nearby mandis (§5.14, §5.15) |
| Weather & Alerts | `/weather` | `WeatherPage.tsx` — still exists, but no longer linked from the sidebar (removed as a redundant nav item; still reachable by direct URL) |
| KrishiBot AI chat | `/ai-chat` | `AiChatPage.tsx` — now requires sign-in (§6.8) |
| Profile | `/profile` | `ProfilePage.tsx` |
| Features | `/features` | `FeaturesPage.tsx` |
| Help Center | `/help` | `HelpPage.tsx` |

`AppLayout.tsx` provides the shared sidebar/nav shell for the logged-in app pages (Dashboard,
Farms, Satellite, Market, AI chat, Profile, Help — Weather is intentionally left off the sidebar, see
above). Login/Register/Home are standalone, full-page layouts using the public `Navbar.tsx`
(Home) or their own minimal header (Login/Register) — Login/Register also have their own
glassmorphism background (§4.4).

### 4.2 Two separate data layers (important distinction)

The frontend actually has **two unrelated data systems**, which is a common point of confusion:

**A. `src/lib/api/` — the mock/real API client for farm/field/satellite/weather/yield data**
- `src/lib/api/index.ts` picks between `mock-client.ts` and `real-client.ts` based on
  `NEXT_PUBLIC_USE_MOCKS` (currently `true`).
- `mock-client.ts` returns realistic fake data for every endpoint (farms, fields, satellite,
  weather, irrigation, yield, chat) — this is what actually powers the hooks in `src/lib/hooks/`
  (`useFarms`, `useFields`, `useSatellite`, `useWeather`, `useIrrigation`, `useYield`) and the
  KrishiBot chat widget.
- `real-client.ts` exists and is fully written (same interface, hits `NEXT_PUBLIC_API_URL`), but
  **the backend has no `/farms`, `/fields`, `/satellite`, `/weather`, etc. endpoints implemented
  yet** — only `/health` and `/auth/*` exist server-side. So flipping `NEXT_PUBLIC_USE_MOCKS` to
  `false` today would break every data page. This is intentionally left as mock-only for now.

**B. `src/lib/stores/farmStore.ts` — the actual data source for Dashboard/Farms/Satellite pages**
- `useFarmStore()` / `useUserStore()` are the hooks Dashboard/Farms/Satellite/AppLayout actually
  use for farm data and the farmer's profile (name/phone/state/language). This is *not* routed
  through `src/lib/api/`'s mock/real-client split (A, above) — it's its own thing.
- **Signed-in users now get real farms from the backend** (`src/lib/api/farms-client.ts` →
  `GET/POST/DELETE /farms`, §5.4), fetched via TanStack Query inside `useFarmStore()`. A fresh
  account starts with zero farms and calls "Register a Farm" to create a real one, persisted in
  Postgres — no more fabricated data for real accounts.
- **Signed-out guests still see localStorage-only mock data** — two canonical demo farms (Nashik
  Onion Field, Pune Wheat Block) with full synthetic soil/water/weather/satellite/yield detail,
  namespaced under a `:guest` key (§6.4). This is unchanged from before and intentional — it lets
  a visitor explore the UI without an account.
- `enrichFarmDraft()` / `backendFarmToFarm()` in `farmStore.ts` bridge the two shapes: a real
  farm from the backend only has geometry + crop/name/location, so the store still layers the
  same synthetic yield/soil/water/weather/satellite detail on top of it client-side (that data
  isn't backed by anything real yet — see §9) while the farm's identity, boundary, and area are
  now genuinely persisted.

**C. `src/lib/auth/auth-client.ts` — a third, dedicated client for authentication**
- Always calls the real backend's `/auth/*` routes directly (not gated by `NEXT_PUBLIC_USE_MOCKS`
  — there is no mock auth). This is the only part of the frontend that talks to a real, working
  backend endpoint today.
- Stores the JWT access/refresh tokens in `localStorage` (`fasalsetu_access_token` /
  `fasalsetu_refresh_token`).
- Exposes `register`, `login`, `loginWithGoogle`, `refreshAccessToken`, `getCurrentUser`,
  `logout`, `isAuthenticated`, and `getUserId()` (decodes the JWT's `sub` claim client-side, no
  network call — used to namespace `farmStore.ts`'s localStorage keys per account).

### 4.3 Login / Register pages

- Both call `auth-client.ts` for real registration/login against the FastAPI backend (previously
  they didn't call any backend at all — Login was a plain `<form action="/dashboard" method="get">`
  and Register only wrote to `localStorage`).
- **Register is intentionally minimal**: full name, email, password (min 8 characters, enforced
  both client-side via `minLength` and server-side via pydantic) — no phone/state at signup time
  anymore, that's collected right after on `/profile` (§6.6). Login is just email + password; no
  "Remember me" (removed, was never wired to anything) and no "Forgot password?" link (feature was
  built then removed entirely — §6.6).
- Errors from the backend are shown inline (a duplicate-registration message, or the deliberately
  identical "Invalid email or password." for both "no such user" and "wrong password" on login —
  see §6.2).
- A "Sign in with Google" button (`GoogleSignInButton.tsx`) is wired up on both pages, renders
  whenever `NEXT_PUBLIC_GOOGLE_CLIENT_ID` is set, and is now **live** — see §6.5.
- On successful register or login (email/password *or* Google), the redirect depends on profile
  completeness — an account without `phone`+`state` set goes to `/profile?complete=1` first;
  otherwise straight to `/dashboard` (§6.6). This is the same rule for every signup method.
- "Sign out" clears the stored tokens — available both in `AppLayout.tsx` (logged-in app pages)
  and now in the public `Navbar.tsx` (Home/Weather/Features/etc.), which is auth-aware: it shows
  "Sign out" instead of "Login" once a token is present, so a signed-in visitor never sees a
  dead-end "Login" button on public pages.

### 4.4 Login / Register background

Both pages float their form in a frosted-glass card (`bg-white/60 backdrop-blur-2xl`) over a
full-bleed aerial satellite photo of farmland (`/images/field_satellite.jpg`) with a dark
gradient overlay for text contrast — tying the auth screens visually to the product's Earth
Engine/satellite-analysis identity. This is scoped to just Login/Register; the main app pages
(Dashboard, Farms, Satellite, KrishiBot AI, Profile, Help) intentionally use a plain solid
background, not this photo.

---

## 5. Backend

### 5.1 Layout (`backend/app/`)

```
backend/
├── app/
│   ├── core/
│   │   ├── config.py      # pydantic-settings Settings, loaded from root .env
│   │   ├── database.py    # async SQLAlchemy engine + session + get_db() FastAPI dependency
│   │   ├── security.py    # bcrypt hashing, JWT create/decode
│   │   ├── deps.py        # get_current_user() FastAPI dependency (Bearer token → User)
│   │   ├── geometry.py    # farm polygon validation + area/centroid math (shapely + pyproj)
│   │   └── satellite_health.py  # health-score math + generic benchmark curve, EE-free (§5.6)
│   ├── ml/
│   │   ├── crop_benchmarks.py  # per-crop NDVI-by-growth-stage reference curves (§5.9)
│   │   ├── irrigation_kc.py    # FAO-56 Kc/root-depth-by-growth-stage tables + NDVI-Kc formula (§5.18)
│   │   ├── soil_water.py       # soil-texture -> available water capacity lookup (§5.18)
│   │   └── price_forecast/     # mandi price forecasting (§5.14)
│   │       ├── dataset.py      #   leakage-safe features + targets per market x day
│   │       ├── models.py       #   baselines (naive/MA/seasonal) + ridge/RF/LightGBM(+Huber)
│   │       ├── evaluate.py     #   rolling-origin validation, selection, prediction intervals
│   │       └── service.py      #   train + store models, generate stored forecasts
│   ├── models/
│   │   ├── base.py        # declarative Base (Alembic autogenerate target)
│   │   ├── user.py        # User ORM model
│   │   ├── farm.py        # Farm ORM model
│   │   ├── satellite_observation.py  # SatelliteObservation ORM model (§5.6)
│   │   ├── index_timeseries.py  # IndexTimeseriesPoint ORM model (§5.9)
│   │   ├── farm_alert.py  # FarmAlert ORM model (§5.9)
│   │   ├── satellite_layer_set.py  # SatelliteLayerSet ORM model — cached tile URLs (§5.10)
│   │   ├── stress_zone.py  # StressZone ORM model — vectorized zones (§5.10)
│   │   ├── environment_snapshot.py  # EnvironmentSnapshot ORM model — rainfall/temp/soil (§5.11)
│   │   ├── weather_cache.py  # WeatherCache ORM model — cached Open-Meteo forecast (§5.17)
│   │   ├── irrigation_plan.py  # IrrigationPlan ORM model — root-zone water balance (§5.18)
│   │   ├── irrigation_log.py  # IrrigationLog ORM model — farmer-reported irrigation events (§5.18)
│   │   └── market_price.py  # mandi catalogue (states/districts/markets/commodities/varieties/grades),
│   │                        # market_prices, daily series, stats, ingestion runs, quality issues,
│   │                        # backfill jobs/tasks, forecast models + forecasts (§5.14)
│   ├── schemas/
│   │   ├── auth.py        # pydantic request/response models for /auth/*
│   │   ├── farm.py        # pydantic request/response models for /farms
│   │   ├── satellite.py   # pydantic request/response models for /farms/{id}/satellite/*
│   │   ├── timeseries.py  # pydantic request/response models for timeseries + alerts (§5.9)
│   │   ├── map_layers.py  # pydantic request/response models for /satellite/layers (§5.10)
│   │   ├── environment.py  # pydantic request/response models for /farms/{id}/environment (§5.11)
│   │   ├── weather.py      # pydantic request/response models for /farms/{id}/weather (§5.17)
│   │   ├── irrigation.py   # pydantic request/response models for /farms/{id}/irrigation(/log) (§5.18)
│   │   └── market_prices.py  # pydantic response models for /market-prices/* (§5.14)
│   ├── repositories/
│   │   ├── user_repository.py   # DB queries for User (data-access layer)
│   │   ├── farm_repository.py   # DB queries for Farm, scoped to owner
│   │   ├── satellite_repository.py  # DB queries for SatelliteObservation
│   │   ├── index_timeseries_repository.py  # DB queries for IndexTimeseriesPoint, incl. upsert
│   │   ├── farm_alert_repository.py  # DB queries for FarmAlert, incl. de-dup check
│   │   ├── satellite_layer_repository.py  # DB queries for SatelliteLayerSet, incl. upsert (§5.10)
│   │   ├── stress_zone_repository.py  # DB queries for StressZone, replace-not-accumulate (§5.10)
│   │   ├── environment_snapshot_repository.py  # DB queries for EnvironmentSnapshot, partial upsert (§5.11)
│   │   ├── weather_cache_repository.py  # DB queries for WeatherCache, incl. upsert (§5.17)
│   │   ├── irrigation_plan_repository.py  # DB queries for IrrigationPlan, incl. upsert (§5.18)
│   │   ├── irrigation_log_repository.py  # DB queries for IrrigationLog (§5.18)
│   │   └── market_price_repository.py  # price bulk insert/update, ingestion runs, quality issue log (§5.14)
│   ├── integrations/
│   │   ├── google_auth.py       # verifies Google "Sign in with Google" ID tokens
│   │   ├── earth_engine_client.py  # Google Earth Engine SDK wrapper (§5.5, §5.6, §5.9, §5.10, §5.11, §5.18)
│   │   ├── open_meteo_client.py # Open-Meteo forecast + historical-archive client, key-free (§5.17, §5.18)
│   │   └── market_prices/       # mandi price providers behind one interface (§5.14)
│   │       ├── base.py          #   PriceDataProvider, NormalizedMarketPrice, catalogue types
│   │       ├── agmarknet.py     #   Agmarknet 2.0 (primary)
│   │       ├── ceda.py          #   CEDA Agri Market API (archive to 2025-10-30)
│   │       ├── data_gov.py      #   data.gov.in (optional, latest day only)
│   │       ├── http.py, text.py #   retries/timeouts; parsing + name matching helpers
│   │       └── registry.py      #   configured providers in fallback order
│   ├── services/
│   │   ├── auth_service.py      # business logic: register/login/refresh/google login
│   │   ├── farm_service.py      # business logic: create/list/update/delete farms
│   │   ├── satellite_service.py # business logic: analysis, timeseries, alerts, map layers, environment
│   │   ├── weather_service.py   # business logic: cached Open-Meteo forecast + flags (§5.17)
│   │   ├── irrigation_service.py # business logic: FAO-56 water balance + irrigation log (§5.18)
│   │   └── market_prices/       # mandi price pipeline (§5.14): validation, catalog (sync +
│   │                            # resolver), ingestion, backfill, analytics, quality, nearby,
│   │                            # watchlist, queries (API read side)
│   ├── routers/
│   │   ├── health.py      # GET /health, GET /health/earth-engine
│   │   ├── auth.py        # register/login/google/refresh/me + profile
│   │   ├── farms.py       # farm CRUD, all scoped to the current user
│   │   ├── satellite.py   # satellite refresh/latest/timeseries/layers/environment + background-refresh helper
│   │   ├── alerts.py      # GET /farms/{id}/alerts, PATCH /alerts/{id}/read (§5.9)
│   │   ├── weather.py     # GET /farms/{id}/weather (§5.17)
│   │   ├── irrigation.py  # GET /farms/{id}/irrigation, POST /farms/{id}/irrigation/log (§5.18)
│   │   └── market_prices.py  # GET /market-prices/*, GET /farms/{id}/market-prices, GET /farms/{id}/market/forecast (§5.14, §5.15)
│   ├── jobs/
│   │   ├── scheduler.py   # APScheduler jobs: timeseries+alerts (§5.9), environment (§5.11), mandi prices (§5.14)
│   │   └── market_prices.py  # mandi price ingestion / catalogue / training / forecast jobs (§5.14)
│   └── main.py             # FastAPI app, CORS, router registration, Earth Engine + scheduler startup
├── alembic/                 # versioned DB migrations
├── scripts/                 # manual triggers for the mandi price jobs (§5.14): sync_market_catalog,
│                            # ingest_market_prices, backfill_market_prices, market_price_report,
│                            # geocode_markets, train_price_models
├── models_store/            # trained price models (gitignored, PRICE_MODEL_DIR)
└── tests/                   # pytest suite (async, in-memory SQLite): 286 tests
    └── fixtures/market_prices/  # trimmed copies of real Agmarknet/CEDA responses
```

This is a classic layered architecture: **routers** (HTTP layer) → **services** (business logic)
→ **repositories** (DB queries) → **models** (ORM). `schemas/` are the pydantic request/response
shapes, kept separate from the ORM models. `integrations/` wraps external services (Google auth,
Earth Engine, the mandi price sources) behind a small interface the rest of the app depends on.

### 5.2 API surface today

| Method | Path | Purpose |
| :--- | :--- | :--- |
| GET | `/health` | Liveness check |
| GET | `/health/earth-engine` | Earth Engine connectivity check — never 500s, always returns `{configured, ok, auth_mode, image_count, latency_ms, detail}` (§5.5) |
| POST | `/auth/register` | Create an account (email, password, optional full name — `phone`/`state`/`location` are also accepted but unused by the frontend, see §6.6) |
| POST | `/auth/login` | Exchange email/password for an access + refresh token pair |
| POST | `/auth/google` | Exchange a Google ID token for an access + refresh token pair |
| POST | `/auth/refresh` | Exchange a valid refresh token for a new access token |
| GET | `/auth/me` | Return the current user (requires `Authorization: Bearer <access_token>`) |
| PATCH | `/auth/profile` | Update the current user's `full_name`/`phone`/`state`/`location` (email is never editable here) |
| GET | `/farms` | List the current user's farms |
| POST | `/farms` | Create a farm (name, crop, polygon GeoJSON) — area/centroid computed server-side (§5.4) |
| GET | `/farms/{farm_id}` | Get one farm — 404 (never 403) if it's not yours |
| PATCH | `/farms/{farm_id}` | Update a farm — 404 if it's not yours |
| DELETE | `/farms/{farm_id}` | Delete a farm — 404 if it's not yours |
| POST | `/farms/{farm_id}/satellite/refresh` | Run a live Sentinel-2 analysis for this farm right now and cache the result (§5.6) |
| GET | `/farms/{farm_id}/satellite/latest` | Read the most recently cached analysis — never calls Earth Engine; 404 if none exists yet (§5.6) |
| GET | `/farms/{farm_id}/satellite/timeseries` | Read the farm's accumulated NDVI/NDWI/EVI history, oldest first — cache-only, built by the nightly job (§5.9) |
| GET | `/farms/{farm_id}/alerts` | List detected anomalies for the farm (NDVI drop, below-benchmark, water stress), most recent first (§5.9) |
| PATCH | `/alerts/{alert_id}/read` | Mark one alert read — 404 (never 403) if it's not yours (§5.9) |
| GET | `/farms/{farm_id}/satellite/layers?date=` | Visualised tile URLs (true colour/NDVI/NDWI/EVI/stress) + vectorized stress zones for one scene, cached ~12h; defaults `date` to the farm's latest analysis (§5.10) |
| GET | `/farms/{farm_id}/environment` | Cache-only read of rainfall (CHIRPS)/land-surface temperature (MODIS)/soil moisture (SMAP, regional), refreshed nightly, plus soil pH/organic carbon/texture (OpenLandMap, static, fetched once); each section carries its own provenance + native resolution; 404 if no report yet (§5.11) |
| GET | `/farms/{farm_id}/weather` | 10-day Open-Meteo forecast for the farm's centroid (temperature, precipitation, wind, humidity, UV, ET0) with heavy-rain/heat-stress/good-spray-window flags per day, cached 3h; never 404s — the first call fetches live (§5.17) |
| GET | `/farms/{farm_id}/irrigation` | FAO-56 root-zone water balance: current depletion vs. readily available water, and the next modelled irrigation date + depth (mm); never 404s — the first call computes a plan from scratch (§5.18) |
| POST | `/farms/{farm_id}/irrigation/log` | Record a farmer-reported irrigation event (date + depth mm), returns the recomputed plan (§5.18) |
| GET | `/market-prices/commodities`, `/locations`, `/markets` | Mandi catalogue with stored prices: commodities, states + districts, markets (with coordinates if known) (§5.14) |
| GET | `/market-prices/latest?commodity=&state=&district=` | Each market's latest price with its precomputed analytics + `provenance` {sources, as_of, is_stale, last ingestion run} (§5.14) |
| GET | `/market-prices?commodity=&from=&to=&page=` | Individual stored reports (variety/grade level), paginated (§5.14) |
| GET | `/market-prices/history?market_id=&commodity=&from=&to=` | Daily modal/min/max/arrivals series for one market (default 180 days, max 3 years) (§5.14) |
| GET | `/market-prices/nearby?commodity=&lat=&lon=&radius_km=&state=&district=` | Markets by distance (where coordinates are known), then same district, then same state; only markets that reported in the last 30 days (§5.14) |
| GET | `/market-prices/trends?commodity=&state=` | Trend counts, median changes, top gainers/decliners across fresh markets (§5.14) |
| GET | `/market-prices/analytics?market_id=&commodity=` | One market's stats + a deterministic outlook (§5.14) |
| GET | `/market-prices/forecast?market_id=&commodity=&horizon=` | Stored 7/14/30-day estimates with expected range, model + validation metrics, or the reason there's none (§5.14) |
| GET | `/market-prices/quality?days=` | Data-quality report (§5.14) |
| GET | `/farms/{farm_id}/market-prices` | The farm's crop mapped to mandi commodities + nearby markets from its centre point; 404 if not yours (§5.14) |
| GET | `/farms/{farm_id}/market/forecast?commodity_id=&market_id=` | The farm's crop at the nearest mandi with a forecast (or the given crop/mandi): live price, 90-day history, 7/14/30-day estimates, nearby mandis and a sell-now / hold-N-days suggestion; 404 if not yours or an unknown crop/mandi (§5.15) |

Still not implemented server-side: `/fields`, `/yield`, chat. Those remain frontend-mock-only for
now (§4.2). (`/weather` and `/irrigation` are real as of §5.17/§5.18 -- this line wasn't updated
when §5.17 landed.)

### 5.3 CORS

`FRONTEND_ORIGIN` (env var) is the single allowed CORS origin (`http://localhost:3000` in dev) —
deliberately not a wildcard.

### 5.4 Farm persistence

Farms used to live only in the frontend's localStorage. They're now real, backend-owned records:

- **`Farm` model** (`app/models/farm.py`): `id`, `owner_id` (FK → `users.id`), `name`, `crop`,
  `planted_date`, `polygon_geojson`, `area_hectares`, `centroid_lat`, `centroid_lng`,
  `created_at`. `polygon_geojson` uses `JSON().with_variant(JSONB(), "postgresql")` so the same
  model works against both real Postgres (JSONB) and the in-memory SQLite test DB (plain JSON).
- **Area/centroid are computed server-side**, not trusted from the client — `app/core/geometry.py`
  validates the polygon with `shapely`, then projects it into a **local Albers Equal-Area CRS
  centered on the polygon's own centroid** (via `pyproj`) before measuring area, rather than doing
  raw lat/lng math (which distorts area badly, especially at scale). Polygons outside a sane
  0.05–500 hectare range, or that are self-intersecting/invalid, are rejected with a clear error.
- **Ownership is enforced at the repository layer** — every query is scoped to
  `owner_id == current_user.id`, and a farm that exists but belongs to someone else returns
  **404, never 403** (so you can't even confirm another user's farm id exists).
- The migration (`9b61433cc742_add_farms_table.py`) is hand-written, not autogenerated, and uses
  the real `postgresql.JSONB` type (the model's cross-dialect variant is a test-only concession).
- On the frontend, `src/lib/api/farms-client.ts` calls this API and `farmStore.ts` wires it into
  `useFarmStore()` for signed-in users (§4.2B) — this is the one piece of "real backend data" in
  an otherwise mock-heavy farm data story (see §9).

### 5.5 Google Earth Engine integration

The connectivity layer that §5.6's real per-farm analysis is built on:

- **`app/integrations/earth_engine_client.py`** wraps the `earthengine-api` SDK behind a small
  `EarthEngineClient` class that degrades gracefully instead of crashing the app — if Earth Engine
  isn't configured or reachable, `configured`/`ok` come back `false` with a `detail` message
  rather than raising.
- **Two supported auth paths**, tried in order:
  1. **Service-account key** (`GEE_SERVICE_ACCOUNT_EMAIL` + `GEE_KEY_PATH`) — the normal path for
     production, but **not usable in this project's GCP org**, which blocks service-account key
     creation via the `iam.disableServiceAccountKeyCreation` org policy.
  2. **Application Default Credentials** (ADC) — the actual path used in local dev today. Run
     once per machine:
     ```bash
     gcloud auth application-default login --scopes=https://www.googleapis.com/auth/earthengine,https://www.googleapis.com/auth/cloud-platform
     ```
     This signs in with your own Google account (which must have registered the `GEE_PROJECT_ID`
     project for Earth Engine access at https://code.earthengine.google.com/register) and saves
     credentials to `%APPDATA%\gcloud\application_default_credentials.json` (Windows) — read
     automatically by `google.auth.default()`, no key file needed. `GEE_PROJECT_ID` is passed
     explicitly to `ee.Initialize(credentials, project=...)`; it does **not** have to match
     whatever "quota project" `gcloud` itself is configured to use, which is a separate, mostly
     unrelated bit of `gcloud` bookkeeping.
- Blocking Earth Engine calls (`.getInfo()`) are wrapped in `asyncio.to_thread` + a
  `asyncio.wait_for` timeout, so a slow/hung Earth Engine call can never block the FastAPI event
  loop for other requests.
- **`GET /health/earth-engine`** is the way to check this is actually working — it runs a real
  test query (`count_recent_sentinel2_images`, a Sentinel-2 image count near a fixed point) and
  reports `{configured, ok, auth_mode, image_count, latency_ms, detail}`. `ok: true` with a
  non-null `image_count` means it's genuinely connected, not just configured.
- The client initializes once at FastAPI startup (`lifespan` in `app/main.py`), not per-request.

### 5.6 Real per-farm satellite analysis (NDVI / NDWI / EVI / NDMI)

Building on §5.4 (real farm polygons) and §5.5 (a working Earth Engine connection), this is the
actual satellite crop-health analysis — not the health-check's trivial image count, a real
per-field vegetation/moisture computation over a farm's own boundary.

**`EarthEngineClient.analyze_field(polygon_geojson)`** (`app/integrations/earth_engine_client.py`):
1. Converts the farm's GeoJSON polygon straight into an `ee.Geometry` and filters
   `COPERNICUS/S2_SR_HARMONIZED` to it and the last 45 days.
2. **Cloud/shadow masking uses the SCL (Scene Classification Layer) band** — S2_SR_HARMONIZED ships
   it on every scene, so this needs only one collection, not a second
   `COPERNICUS/S2_CLOUD_PROBABILITY` join. SCL classes 3 (cloud shadow), 8/9 (cloud medium/high
   probability), and 10 (thin cirrus) are masked out.
3. **Per-image field cloud %** is computed by reducing the cloud/shadow mask over the field's own
   geometry (not the whole scene) — a scene can be mostly clear elsewhere but cloudy exactly over
   this field, or vice versa, so the scene-level cloud metadata Sentinel-2 ships isn't good enough.
4. **Scene selection**: the most recent scene with field cloud % under 20% is used. If none in the
   45-day window qualifies, the single least-cloudy scene is used instead and the response is
   flagged `is_fallback: true`. If the window has no Sentinel-2 coverage of the field at all,
   `NoSentinelImageryAvailableError` is raised. This selection logic is pure Python (`EarthEngineClient._select_best_image`, unit-tested directly with plain dicts) — cloud % per scene still has to be
   computed in Earth Engine, but *picking* the best one doesn't.
5. **Indices**, all computed on reflectance-scaled bands (raw S2 SR bands are Int16, ×0.0001 to get
   true reflectance):
   - NDVI = normalizedDifference(B8, B4)
   - NDWI = normalizedDifference(B3, B8)
   - NDMI = normalizedDifference(B8, B11)
   - EVI = `2.5 * (NIR − RED) / (NIR + 6·RED − 7.5·BLUE + 1)` via `.expression()`
6. **Field statistics** (mean/min/max per index) come from one combined `reduceRegion` call
   (`ee.Reducer.mean().combine(min).combine(max)`, `scale=10`, `bestEffort=True`).
7. **Health classification**: the % of field pixels that are healthy (NDVI > 0.6), moderate
   (0.3–0.6), or stressed (< 0.3), via three boolean bands reduced with `Reducer.mean()` (equivalent
   to a per-class pixel fraction).
8. All of the above — selection metadata plus final stats — costs exactly two `getInfo()` round
   trips to Earth Engine per analysis, both wrapped in the same `asyncio.to_thread` +
   `asyncio.wait_for` pattern as the health check (§5.5), just with a longer timeout (60s vs 20s)
   since a `reduceRegion` over a whole collection is slower than a single count.

**Health score** (`app/core/satellite_health.py` — deliberately Earth-Engine-free, so it's testable
with plain numbers): a 0–100 score, 70% weighted on how the field's mean NDVI compares to a
generic NDVI-by-growth-stage benchmark curve (`crop_stage_benchmark_ndvi(days_since_sowing)` —
a rough, non-scientific piecewise curve, not crop-specific), 30% on how little of the field is in
the stressed band. Exceeding the benchmark caps at 100% credit rather than overflowing the score.

**`SatelliteService`** (`app/services/satellite_service.py`) ties it together:
- `refresh_analysis(farm)` calls `analyze_field`, computes the health score, and stores a new
  `SatelliteObservation` row — a real Earth Engine round trip, so this is the slower path.
- `get_latest(farm)` is a cache-only read — never touches Earth Engine.
- Earth Engine failures (`EarthEngineNotConfiguredError`, `EarthEngineTimeoutError`,
  `NoSentinelImageryAvailableError`) are all wrapped as `SatelliteAnalysisError`, which the router
  maps to `503 Service Unavailable`.

**`satellite_observations` table** (`app/models/satellite_observation.py`,
`49d07458618e_add_satellite_observations_table.py`): one row per analysis run — `farm_id` (FK,
indexed), `image_date`, `satellite` ("S2A"/"S2B"), `cloud_pct`, `is_fallback`, flat `<index>_mean` /
`_min` / `_max` columns for NDVI/NDWI/EVI/NDMI, `healthy_pct`/`moderate_pct`/`stressed_pct`,
`health_score`, `source`, `created_at`. A farm accumulates a history; "latest" is just the most
recent row by `created_at`, read via `GET /farms/{id}/satellite/latest`.

**Every satellite API response carries provenance** — `{source: "Sentinel-2 via Earth Engine",
is_live: true, as_of: <image_date>, cloud_pct}` — so a caller (or a reviewer) can tell at a glance
that a number is real, dated satellite data and not a synthetic placeholder.

**Background trigger**: `POST /farms` now schedules `run_background_refresh(farm.id)` as a FastAPI
`BackgroundTask` right after a farm is created, so `/satellite/latest` usually isn't empty the
first time a farmer opens the Satellite page. It runs in its own DB session (decoupled from the
request that created the farm) and fails silently on error — a missing Earth Engine credential or
no imagery yet just means `/satellite/latest` still 404s with a clear message until someone calls
`/satellite/refresh` explicitly.

### 5.7 Frontend wiring for the real satellite analysis

`SatellitePage.tsx` and `DashboardPage.tsx`'s "Crop Canopy Vigour" card now call the real API for
real (backend-persisted) farms:

- **`src/lib/api/satellite-client.ts`** — a thin client for `/farms/{id}/satellite/*`.
  `getLatestSatelliteAnalysis()` returns `null` (not a throw) on a 404, since "no analysis yet" is
  an expected, common state for a new farm.
- **`src/lib/hooks/useFarmSatelliteAnalysis.ts`** — wraps that in TanStack Query, gated on whether
  the farm id actually looks like a backend UUID (`isRealFarmId()`). Guest/demo farm ids
  (`"farm-1"`, `"farm-<timestamp>"`) never hit the network at all — the hook is a deliberate no-op
  for them, so no error, no loading state, nothing.
- **`applyLiveSatellite()`** (`farmStore.ts`) overlays a real `SatelliteObservation` onto a farm's
  synthetic `FarmSatellite` — but **only the current-stats fields** (NDVI/NDWI mean/min/max, canopy
  health %, vigour label, mission/cloud/quality metadata). *(At the time, the historical trend
  graph and stress zones stayed synthetic with a "Demo trend" / "Demo" tag; both are real now —
  see §5.12.)*
- The Satellite page shows a status banner for real farms: a loading state while checking,
  "Live Sentinel-2 data · S2A/S2B · imaged \<date\> · \<cloud %\>%" (plus a fallback-scene note when
  applicable) once an observation exists, or "No live analysis yet" with a **"Run Sentinel-2
  Analysis"** button when it doesn't — the same button becomes **"Refresh from Sentinel-2"** once
  data exists. Both call `POST /satellite/refresh` and update the cached query on success.
- Cloud-cover and data-quality badges are computed from the real value instead of being hardcoded
  ("Clear Sky" no longer shows for a 95% cloudy fallback scene, for example) — a bug caught during
  live testing of this feature, not from the synthetic data path.

**Two real bugs found and fixed during live end-to-end testing** (mocked EE tests didn't catch
these, since they only exercise the `_get_info` boundary, not real Earth Engine semantics):
1. `reduceRegion` includes every requested band as a key in its result **even when no pixels were
   valid for it — with the value set to `null`, not the key omitted**. `dict.get(key, default)`
   only substitutes a default for a *missing* key, so it silently does nothing for a
   present-but-`null` value, and `ee.Number(null).multiply(...)` throws. Fixed with EE's
   null-coalescing idiom, `ee.List([value, fallback]).reduce(ee.Reducer.firstNonNull())`, in
   `_tag_field_cloud_pct` (treats "no data over the field for this scene" as maximally cloudy,
   which correctly excludes it from selection). The same class of bug existed in the final
   stats-parsing on the Python side (`result.get(key, 0.0)` doesn't rescue a JSON `null` either) —
   fixed with an explicit `None` check.
2. The hardcoded "(Clear Sky)" / "High Quality" labels in `SatelliteAnalyticsPanel` (fine for
   synthetic data, which was always a low, fixed cloud %) are now computed from the actual value.

### 5.8 What's still not done

*(Historical note — this was the gap list right after §5.7. Most of it has since been closed: the
timeseries (§5.9), real stress zones and map layers (§5.10), soil pH/organic carbon/texture and
soil moisture (§5.11), wiring all of it into the UI (§5.12), and weather (§5.17).)* What remains
synthetic even for signed-in users: **soil N-P-K** (not remotely sensed — needs a soil test or a
different data source). NDMI is computed and stored (§5.6) but not surfaced in the UI.

### 5.9 NDVI/NDWI/EVI timeseries, benchmark alerts, and the nightly scheduler job

Builds on §5.6's single-scene analysis to track a farm's vegetation *history* over time and flag
anomalies automatically, instead of only ever showing "right now":

- **`EarthEngineClient.build_field_timeseries(polygon, start, end)`** computes NDVI/NDWI/EVI field
  means and field cloud % for **every** Sentinel-2 scene in the date range (not just the one best
  scene, unlike `analyze_field`) — the same one-`.map()`-then-one-`getInfo()` principle as
  everywhere else in this client, so scanning up to ~120 days of scenes still costs exactly one
  Earth Engine round trip, never one per scene/per Python-loop-iteration.
- **`app/ml/crop_benchmarks.py`** holds small, hand-assembled NDVI-by-growth-stage reference curves
  for rice, wheat, onion, tomato, sugarcane, cotton, maize, and soybean — explicitly labelled as
  approximate reference curves, not a trained model or scientifically calibrated agronomic data.
  An unrecognised crop falls back to the generic curve already used by §5.6's health score
  (`app/core/satellite_health.py`, refactored to expose a reusable `interpolate_benchmark_curve()`
  that both the generic and per-crop curves now share).
- **`SatelliteService.build_timeseries(farm)`**: queries from `max(farm.sowing_date, today - 120
  days)` through today (the 120-day cap keeps the Earth Engine query bounded even for an
  old/perennial field), keeps only scenes under 30% field cloud, and **upserts** each one into
  `index_timeseries` keyed on `(farm_id, image_date)` — re-running it (the nightly job does, every
  night, over a rolling window) updates existing points rather than duplicating them. Each stored
  point also carries the crop-stage benchmark NDVI *as of that point's date*, so later alert
  comparisons don't need to recompute it.
- **Three alert rules**, checked over the full stored series after every `build_timeseries` call:
  1. **`ndvi_drop`** (warning) — NDVI fell more than 15% (relative) between two consecutive clear
     passes.
  2. **`below_benchmark`** (warning) — NDVI has been more than 0.1 below the crop-stage benchmark
     for two consecutive passes (a single low pass doesn't fire this — could just be noise).
  3. **`water_stress`** (critical) — NDWI fell below 0 while the farm is in a rough "vegetative
     stage" window (day 20–90 after sowing), a generic (not per-crop) gate on *when* this check is
     worth running.
  Alerts are de-duplicated per `(farm_id, alert_type, detected_at)` — re-scanning the same
  historical passes (which the nightly job does every run) never creates duplicate alerts.
- **`app/jobs/scheduler.py`** registers an `AsyncIOScheduler` job (APScheduler) at `02:00` server
  time, started/stopped in `main.py`'s `lifespan`. It runs `build_timeseries` for **every** farm
  across every user (`FarmRepository.list_all()`) — skipping the whole run quietly if Earth Engine
  isn't configured, and skipping (logging why) just the one farm, not the whole batch, if a single
  farm's analysis fails.
- **`GET /farms/{id}/satellite/timeseries`** and **`GET /farms/{id}/alerts`** are both cache-only
  reads — they show what the nightly job has already found, never triggering a live Earth Engine
  call themselves. **`PATCH /alerts/{id}/read`** marks one alert read, checking ownership via the
  alert's farm (an alert has no `user_id` of its own) with the same 404-never-403
  anti-enumeration pattern used throughout `/farms`.
- New dependency: **`apscheduler`** (added to `requirements.txt`).
- Wired into the frontend in §5.12 (season-curve chart, pass-date slider, Dashboard alerts strip).

### 5.10 Map tiles (true colour / NDVI / NDWI / EVI / stress) and stress-zone vectorization

Turns the single-scene stats from §5.6 into something visual: real Earth Engine imagery drawn on
the farm's map, plus automatically detected stress zones instead of a synthetic overlay.

- **`EarthEngineClient.get_field_map_layers(polygon, image_date)`**: finds the exact Sentinel-2
  scene for `image_date`, builds five `ee.Image`s clipped to the farm polygon — true colour
  (B4/B3/B2, `min:0 max:0.3`), NDVI (`min:0 max:0.9`, red→yellow→green), NDWI, EVI, and a
  `stress_class` image built by `.where()`-chaining pixels below/above the field's
  `mean − 1·stdDev` NDVI threshold — then calls `getMapId(vis_params)` on each and keeps
  `tile_fetcher.url_format` (the XYZ tile URL template Mapbox/Leaflet can consume directly). All
  five `getMapId` calls run concurrently via `asyncio.gather()`, since each is an independent
  blocking SDK call wrapped in `asyncio.to_thread()`.
- **Stress-zone vectorization**, in the same method: pixels with NDVI below `field mean − 1·stdDev`
  are converted from a raster mask into polygons with `reduceToVectors` (scale 10m, min area
  ~200m²), then each resulting zone is classified by its own mean NDWI — negative NDWI →
  `water_stress`, otherwise → `nutrient_pest_suspected` — with a canned suggested action per type.
  Zone geometry, area (via `ee.Geometry.area()`, converted to hectares), type, and action all come
  back from **one** `getInfo()` call on the vectorized `FeatureCollection`, not one per zone.
- **Caching**: `SatelliteLayerSet` (one row per farm+date, the 5 tile URLs + `expires_at`) and
  `StressZone` (one row per detected zone) are both stored so repeat requests within ~12h don't
  re-hit Earth Engine — `SatelliteService.get_or_build_layers()` checks `expires_at` and only
  regenerates on a cache miss or expiry. Earth Engine tile URLs themselves expire, which is the
  reason for the 12h window. Regenerating stress zones **replaces** the farm's prior zones for that
  date (delete-then-insert in one repository call) rather than accumulating duplicates across
  re-generations.
- **`GET /farms/{id}/satellite/layers?date=`**: returns the 5 tile URLs, `generated_at`/`expires_at`,
  and the stress zones (geometry as GeoJSON, area_ha, type, suggested action). `date` defaults to
  the farm's latest cached `SatelliteObservation` date; 400s if there's no date and no prior
  observation to default to.
- **Frontend wiring** (`components/map/MapView.tsx`): two new props, `rasterTileUrl` (adds/replaces
  a Mapbox raster source+layer pointing at the EE tile template whenever it changes, gated on
  `map.isStyleLoaded()`/`map.once("load", …)` since the map only initialises once and never
  remounts) and `stressZones` (a GeoJSON source + fill/outline layers colored by zone type, with a
  click popup showing type/area/suggested action). `SatellitePage`'s existing layer tabs (NDVI /
  NDWI / True Colour / Stress Zones) now select which cached tile URL to pass down, via
  `useFarmSatelliteLayers()` (a `useFarmSatelliteAnalysis()`-style hook: no-op for guest/demo farm
  ids, real farms get a React Query-cached fetch against `/satellite/layers`).
- Live-verified: `GET .../layers` returns real Earth Engine tile URLs in ~8s on a cache miss;
  spot-checking one tile URL directly returns a genuine small clipped PNG (the test farm is only
  ~1 hectare, so its clipped tiles are correctly tiny — a handful of colored pixels against an
  otherwise-transparent tile, invisible until zoomed into the farm itself). The same test farm's
  heavy persistent cloud cover (§5.9's known limitation) means it never has real detected stress
  zones on its own — polygon rendering + click popups were verified live by seeding two synthetic
  `StressZone` rows for it directly through the real `StressZoneRepository` (not raw SQL, not
  mocked), confirming the map renders both zone colors and that clicking each shows the correct
  type/area/action popup, then deleting the rows again to restore the farm's real (empty) state.

### 5.11 Farm environment report (rainfall / temperature / soil moisture / soil)

Moves beyond vegetation indices to the environmental context around a farm — four independent Earth
Engine datasets, each with a very different native resolution and update cadence:

- **Rainfall — CHIRPS Daily (`UCSB-CHG/CHIRPS/DAILY`)**: accumulated mm over the trailing 7/30/90
  days and since `sowing_date` (capped at 365 days). CHIRPS's "final" product lags real time by
  several weeks, so a naive "last 7 days from today" window can come back empty — windows are
  anchored to the latest date actually present in the collection instead (one `_get_info` call to
  find it, then one combined `reduceRegion` over all four windows built as separate bands of one
  image, in a second call).
- **Land-surface temperature — MODIS (`MODIS/061/MOD11A2`)**: mean °C and a count of 8-day
  composites with field-mean LST above 35°C, over the trailing 60 days. Computed the same way as
  the NDVI timeseries (§5.9) — one `.map()` over the collection producing a `FeatureCollection` of
  per-period `{date, temp_c}`, one `getInfo()` for the whole window, individual masked/cloudy
  periods dropped in Python rather than corrupting the average.
- **Soil moisture — NASA SMAP L4 (`NASA/SMAP/SPL4SMGP/007`)**: latest available surface soil
  moisture (m³/m³). This is the exact collection asked for, but it's flagged deprecated by Earth
  Engine (superseded by `.../008`) and stopped receiving new data around mid-2025 — confirmed live,
  the "latest" image for this project's test farm is dated 2025-06-27. Rather than silently treating
  a year-old reading as current, `as_of` is always the real date of whatever image was actually used,
  labelled `"~9-11 km regional"` in `resolution` so the UI can visually de-emphasize it next to the
  10m-scale vegetation data.
- **Soil — OpenLandMap (pH, organic carbon, USDA texture class)**: static, ~2017-vintage global
  layers with no real acquisition date. **Fetched once per farm and reused after that** — as asked —
  via `EnvironmentSnapshot.soil_fetched_at`: `SatelliteService.refresh_environment()` only calls
  `EarthEngineClient.get_soil_properties()` when that column is still null, and the repository's
  `upsert()` only overwrites the `soil_*` columns when the caller just fetched them, leaving them
  untouched on every other call.
- **Nightly refresh, cache-only reads** — same split as §5.9's timeseries/alerts: `refresh_environment()`
  (rainfall/temperature/soil moisture recomputed every call; soil only on the first) is what the
  nightly scheduler job calls for every farm, never what the API route calls directly.
  `GET /farms/{id}/environment` only reads back whatever `EnvironmentSnapshot` row is already
  cached (`SatelliteService.get_environment()`) — it never touches Earth Engine itself, and returns
  404 for a farm with no report yet. `app/jobs/scheduler.py`'s `run_nightly_environment_refresh()`
  runs at 02:30 server time (staggered 30 minutes after the 02:00 timeseries job, same
  `AsyncIOScheduler`/`CronTrigger`, registered as its own job id alongside it in `start_scheduler()`),
  looping every farm via `FarmRepository.list_all()` with the same per-farm error isolation as the
  timeseries job — one farm's Earth Engine failure is logged and skipped, never aborts the batch.
- **A real, live-caught scale bug**: OpenLandMap's soil layers and each dynamic dataset's own native
  pixel is far coarser than this project's ~1 hectare test farm polygon (SMAP ~11km, CHIRPS ~5.5km,
  OpenLandMap 250m). Passing that native resolution as `reduceRegion`'s `scale` parameter made Earth
  Engine's grid-sampling miss the polygon entirely and silently return `null` for rainfall/soil
  moisture/soil pH — confirmed empirically live (`scale=5566` on the test farm → `None`; `scale=30`
  on the identical call → the real value). Fixed by using a small fixed sampling scale
  (`SMALL_FIELD_REDUCE_SCALE_M = 30`) for every environment `reduceRegion` call, which only changes
  how finely Earth Engine resamples before reducing, not which pixel's value comes back for a region
  this small — the dataset's true native resolution is still what's shown to the UI via each
  section's own `provenance.resolution` string, a deliberately separate concern. MODIS wasn't
  affected (its per-period map+filter approach already tolerates individual masked pixels).
- OpenLandMap's organic-carbon scale factor isn't exposed via `getInfo()` (unlike pH, which is
  documented as ×10); the ×5 factor used here (`OPENLANDMAP_ORGANIC_CARBON_SCALE_FACTOR`) was
  determined empirically — the raw pixel value at the test farm, divided by 5, gives an implausibly
  bare 0.4 g/kg, while multiplied by 5 gives 10 g/kg (1% organic carbon), a normal figure for real
  cropland. Flagged in code in case an authoritative source turns up a different documented factor.
- **`GET /farms/{id}/environment`**: returns the cached `EnvironmentSnapshot` row's values plus a
  `Provenance` (source, resolution, as-of date) per section, so the UI can show e.g. "10 m field"
  next to a vegetation stat and "~10 km regional" next to soil moisture rather than presenting every
  number as equally precise.
- Live-verified end-to-end, including the scheduler wiring itself, not just the underlying method:
  confirmed `GET .../environment` 404s for a farm with no cached report yet; manually invoked
  `run_nightly_environment_refresh()` (the exact function `start_scheduler()` registers at 02:30) and
  watched it correctly refresh **all 6 real farms** in the database in one run, logging
  `"6/6 farm(s) refreshed"`; then confirmed `GET .../environment` returned the newly cached values in
  ~0.3s (down from the ~15-25s a live Earth Engine round trip takes) — proof it's now a pure DB read.
  Values for the test farm: 8.8mm/36.4mm/507.4mm rainfall over 7/30/90 days (plausible for peak
  Maharashtra monsoon season), 25.2°C mean LST with 0 hot periods, 0.455 m³/m³ soil moisture (dated
  2025-06-27, correctly surfaced as stale), and pH 7.4 / 10.0 g/kg organic carbon / "Clay" texture.
- Wired into the frontend in §5.12.

### 5.12 Frontend on real data: season curve, pass slider, source badges, alerts (`new-frontend`)

For a signed-in user's real (backend-UUID) farm, the Satellite page and the Dashboard's health/NDVI
cards no longer show any synthetic satellite values. Guests keep the demo farms, now explicitly
labelled with a **"Demo data"** badge. Guest farm ids never hit the network (`isRealFarmId()`, §5.7).

**TanStack Query hooks** (`src/lib/hooks/`), all over `src/lib/api/satellite-client.ts`:

| Hook | Endpoint | Notes |
| :--- | :--- | :--- |
| `useFarmSatelliteAnalysis` | `/satellite/latest` (+ `/satellite/refresh`) | Exposes a `status`: `guest` / `checking` / `analysing` / `ready` / `no-imagery` / `error`, plus `retry` |
| `useFarmSatelliteTimeseries` | `/satellite/timeseries` | Every clear pass, oldest first; empty is normal for a new farm |
| `useFarmSatelliteLayers` | `/satellite/layers?date=` | Only fires once a pass date is known |
| `useFarmEnvironment` | `/environment` | `null` until the nightly job has run (404 → `null`) |
| `useFarmAlerts` | `/alerts` + `PATCH /alerts/{id}/read` | Optimistic mark-as-read with rollback on error |

- **First analysis**: when `/latest` 404s, the hook runs `POST /satellite/refresh` automatically and
  shows **"Analysing your field from space… ~30 s"**. That first run is a *query*
  (`["satellite-first-analysis", farmId]`), not a mutation, so the Dashboard and Satellite page share
  one in-flight Earth Engine run and one error state via the query cache instead of each starting
  its own. A 503 whose message starts "No Sentinel-2 imagery" becomes the **empty state** ("No clear
  satellite image yet"). Anything else becomes the **error state** with a Retry button that re-runs
  whichever step failed. A failed *background* refetch never hides already-loaded data.
- **`components/charts/SeasonCurveChart.tsx`** (Recharts): the field's NDVI as a solid line with a
  dot per pass, the crop-stage benchmark as a dashed line, and a tooltip with the pass date, NDVI vs.
  benchmark and cloud %. Clicking a dot selects that pass on the map. Guests see the same chart
  drawn from demo history.
- **`components/satellite/PassDateSlider.tsx`**: a range slider over every known pass (timeseries
  dates ∪ the latest analysis date). Moving it refetches `/layers?date=` for that pass, so the map's
  tiles and stress zones swap, and the caption's mean value and badges follow the selected pass.
- **`SourceBadge`** (`components/SourceBadge.tsx`) gained two forms besides the original
  `provenance` one: `live` → e.g. **"Live — Sentinel-2, 20 Sep, cloud 0.3%"** (any backend
  resolution label containing "regional", such as SMAP's, gets a blue "· regional" variant), and
  `demo` → "Demo data". Every satellite number on both pages carries one.
- **`components/satellite/EnvironmentReportCard.tsx`**: rainfall / land-surface heat / soil moisture
  / soil sections from `/environment`, each with its own badge. The Dashboard's Soil card shows real
  pH, texture and organic carbon, and its Moisture card shows real NDWI plus SMAP soil moisture
  (regional). Soil N-P-K remains demo, since there's no source for it (§5.8); the Field Weather
  card went live in §5.17.
- **`components/dashboard/AlertsStrip.tsx`**: unread alerts for the selected farm with severity,
  pass date, the backend's message and a **Mark as read** button. It replaces the demo weather
  banner for real farms; guests still see the demo banner.

**Two real backend bugs found and fixed during live testing of this branch** (neither was
reachable before the UI started asking for arbitrary pass dates, or before Sentinel-2C passes
became common):
1. **`get_field_map_layers` crashed on a fully clouded pass.** When every field pixel is
   cloud-masked, the NDVI mean/std-dev `reduceRegion` returns `null`, and building the stress
   threshold raised `EEException: Number.multiply: Parameter 'left' ... null` → an unhandled 500
   (which the browser reports as a CORS failure, since the error response carries no CORS headers).
   Both values now default to 0 via `ee.Algorithms.If`, so a clouded pass renders transparent
   tiles with no stress zones instead of failing.
2. **Sentinel-2C passes could never be stored.** `_short_satellite_name()` only mapped 2A/2B and
   passed any other spacecraft name through raw. "Sentinel-2C" (11 chars) then overflowed the
   `String(10)` `satellite` column → `StringDataRightTruncationError` → 500 on
   `/satellite/refresh` (and the post-create background refresh) for any farm whose best recent
   pass came from S2C. It now maps any "Sentinel-2X" to "S2X" and truncates anything unrecognised to
   10 chars. Covered by new unit tests (`TestShortSatelliteName`).

**Live-verified** in the browser against the real backend, Postgres and Earth Engine (the test farm
had no timeseries or alerts of its own, so 6 timeseries rows were seeded **using real Sentinel-2
scene dates and cloud % for that field** (NDVI values synthetic), plus 2 alerts, then deleted
again): every slider step fetched and received real tiles for that pass. The chart tooltip, the
chart-dot → slider sync, all environment badges including SMAP's "regional", the Dashboard's live
cards, mark-as-read (PATCH 200, strip updated immediately) and the guest demo view with zero backend
calls were all checked. A temporary second farm exercised the real error → Retry → "Analysing…" →
ready flow on a genuine 0% cloud S2C pass (which is how bug 2 was found), and was then deleted.

### 5.13 Bug-fix pass (`bug-fixes`)

A review of §5.12 and the paths it touches turned up the following, all fixed:

1. **Signed-in users saw "No farms yet" 30 minutes after signing in.** Access tokens expire
   after 30 min, but nothing ever called `refreshAccessToken()`, so every API call 401'd and
   `farmStore` read the failed load as an empty account. Now every authenticated call goes
   through **`authorizedFetch()`** (`src/lib/auth/auth-client.ts`). On a 401 it refreshes once
   via `/auth/refresh` (concurrent 401s share one refresh call) and retries. If the refresh token
   is rejected too, it clears the tokens and redirects to **`/login?expired=1`**, which shows
   "Your session has expired". A network failure during refresh no longer signs the user out
   (previously *any* refresh failure cleared the tokens). "Failed to fetch" is replaced by a
   readable "Can't reach the FasalSetu server" message.
2. **A failed farm-list load looked like an empty account.** `farmStore` now exposes
   `loadError`/`retryLoad`, and the Dashboard, Satellite and Farms pages show **"Couldn't load
   your farms" + Try again** (`components/FarmsLoadError.tsx`). Readiness now waits for the query
   to actually succeed or fail: TanStack Query pauses retries in a background tab, and the old
   `!isLoading` check treated that paused state as "loaded, no farms".
3. **One farm's DB error made the nightly jobs skip every farm after it.** Both jobs share one
   session; a failed commit left it unusable (`PendingRollbackError` for every later farm). Each
   per-farm failure now calls `session.rollback()`, and the loop re-reads each farm by id (a
   rollback expires loaded ORM objects, which can't lazy-load in async). Covered by
   `tests/test_scheduler.py`, which fails without the fix.
4. **Unexpected Earth Engine errors escaped as bare 500s.** Any `ee.EEException` from a network
   call (quota, server-side computation errors) is now raised as `EarthEngineRequestError` by
   `_get_info`/`_get_map_id` and turned into `SatelliteAnalysisError` → a 503 with the real
   message, like the other Earth Engine failures.
5. **A failed `/layers` request showed "0 Zones Detected — no anomalies".** `getSatelliteLayers`
   no longer turns a 503 into `null`. The map shows "Couldn't load imagery for this pass · Retry",
   and the stress-zone list shows an error with Retry.
6. **A failed `/timeseries` request showed the "builds up nightly" empty message**; it now shows an
   error with Retry.
7. **A new farm could get two concurrent ~30 s Earth Engine analyses** (the post-create background
   refresh plus the UI's first analysis). `SatelliteService.refresh_analysis()` now holds a
   per-farm `asyncio.Lock`. A caller arriving mid-run waits and returns that run's result.
   Per-process only, which is enough for today's single-worker deployment.

Live-verified in the browser: an invalid access token plus a valid refresh token produced
`401 → /auth/refresh 200 → retry 200`, with the farm shown normally. Both tokens invalid
redirected to `/login?expired=1` with the notice. With the backend down, the Dashboard and Satellite
page showed the load error, and Try again recovered once the backend was back. Racing a refresh
against a new farm's background analysis stored exactly one analysis (the temp farm was then
deleted).

### 5.14 Mandi price intelligence (`feat/price-*` branches)

Real mandi (APMC market) prices, analytics and forecasts. The pipeline runs end to end:

source → ingestion → normalisation → validation → PostgreSQL → history → analytics → forecasting → FastAPI → `/market`

Rules the module keeps:
- **Real data only.** Every price shown was reported by a mandi.
- **The browser only talks to FasalSetu's backend.** It never calls Agmarknet, and no API key is in the frontend.
- **Nothing is computed per request.** Scheduled jobs fill precomputed tables and the API reads them.
- **Forecasts are always labelled estimates**, with the error they showed in testing.

It replaced a first data.gov.in-only version (`mandi-prices`, never merged). data.gov.in's gateway
returned 502/504 throughout development, so it's now just an optional provider.

**Sources (verified live on 2026-09-27; full write-up in `docs/market-price-api.md`)**

| Provider | Role | Notes |
|---|---|---|
| Agmarknet 2.0 (`api.agmarknet.gov.in/v1/`) | Primary | No key. `daily-price-arrival/filters` = the whole catalogue in one request; `prices-and-arrivals/date-wise/specific-commodity` = every market's daily prices + arrivals for one state × commodity × month, from Jan 2021. nginx 403s generic library User-Agents, so requests identify as `FasalSetu/0.1 (...)` — honest, not a browser disguise. The CAPTCHA-protected report and login-only endpoints are deliberately not used. |
| CEDA Agri Market API | Fallback / archive | `CEDA_API_KEY` bearer auth, 40 requests/hour, data ends 2025-10-30 (archive of the old portal). Its ids differ from Agmarknet 2.0's, so everything is matched by name. Used automatically for months Agmarknet 2.0 doesn't have (before 2021). |
| data.gov.in | Optional | Latest day only; unreliable gateway. |

**Pipeline** (`app/integrations/market_prices/`, `app/services/market_prices/`)
1. **Providers → `NormalizedMarketPrice`.** Values are only cleaned (whitespace, number and date
   formats), never changed in meaning:
   - prices are `Decimal` in Rs/quintal, arrivals in tonnes
   - units are read from the source's column titles, not assumed
   - anything unreadable becomes `None` plus a recorded reason
2. **Validation** (`validation.py`) never "fixes" a record.
   - *Reject* (the row goes to `price_quality_issues` with its raw source row): missing or zero
     modal price, negative values, bad or future date, unexpected unit, missing market/commodity.
   - *Flag* (stored as reported, with `quality_flags`): min > max, modal outside [min, max],
     missing min/max, a market not in the catalogue.
3. **In-batch dedupe** by `(source, source_record_id)`: exact duplicates are skipped; conflicting
   ones are rejected, keeping the first. Agmarknet can list the same variety twice for one
   market/day. These are separate lots, since their arrivals add up to the day's total, so each
   keeps its own record (numbered in report order).
4. **Catalogue resolution** (`catalog.py`): Agmarknet ids first, then names within the right
   parent (case/punctuation/"APMC"-suffix-insensitive, plus known aliases such as
   "Paddy(Dhan)(Common)" = "Paddy(Common)").
   - An ambiguous name is rejected, never guessed. The catalogue has same-named markets in
     different districts.
   - Unknown states and commodities are rejected.
   - An unknown market, variety or grade reported by a source is created and flagged.
5. **Upsert**: new rows are inserted, changed rows updated, unchanged rows skipped. The key is
   `(source, source_record_id)`, so **ingestion is idempotent**. Verified live: a second run of
   the same fetch inserted 0 and skipped 3,115.
6. Each run is logged in `price_ingestion_runs`: fetched, inserted, updated, skipped, rejected,
   flagged, requests made, duration and errors, with a per-query breakdown. If one provider
   errors, the next one in `MARKET_PRICE_PROVIDERS` is tried.

**Schema**: `states`, `districts`, `markets` (lat/lon + `coordinate_source`/`coordinate_precision`),
`commodities`, `varieties`, `grades`, `market_prices` (Numeric money, arrivals, units, source, flags;
indexes on market, commodity, date, market+commodity+date, commodity+date, state+commodity+date),
`market_price_daily`, `market_price_stats`, `price_ingestion_runs`, `price_quality_issues`,
`price_backfill_jobs/tasks`, `price_forecast_models`, `price_forecasts`. The farm tables are
untouched. Farm `state`/`district` strings are mapped onto the catalogue by name.

**Jobs**:
- **23:00 nightly ingestion.** Re-fetches the last 10 days for `MARKET_PRICE_STATES` ×
  `MARKET_PRICE_COMMODITIES`, plus every farm's state × crop. Crop → commodity:
  Rice → Paddy(Common), Rice; Soybean → Soyabean; Chilli → Green/Dry Chillies.
- **23:45 forecasts.**
- **Saturday 03:00 model retraining.**
- **Sunday 22:00 catalogue refresh.**
- **Backfill** (`backfill.py`, `scripts/backfill_market_prices.py`): a job is split into one task
  per state × commodity × month (one request each) and committed per task. An interrupted job
  resumes where it stopped; failed tasks keep their error and are retried up to 3 times; jobs over
  2,000 requests are refused. **Loaded: West Bengal, Jan 2021 → today**:
  - 6 commodities (Potato, Tomato, Onion, Rice, Wheat, Paddy)
  - 414/414 tasks succeeded
  - **456,681 reports**

**Analytics** (`analytics.py`, refreshed after each ingestion for just the commodities and dates it touched):
- `market_price_daily`: one price per market × commodity × day. The day's reports are combined
  into an **arrival-weighted modal** (a plain mean if any report lacks arrivals). Min/max are the
  day's extremes. When sources overlap, the primary wins.
- `market_price_stats` per market (modal price is the primary metric):
  - current modal/min/max/arrivals
  - 7/14/30-day averages, 7-day and 30-day min/max
  - 7/30-day % change. The reference is the latest price within a grace window; a zero or missing
    reference gives `null`, never a division by zero.
  - 30-day volatility (standard deviation of daily % changes)
  - trading days
  - trend: last 7 days' mean vs the previous 7 days'. ±2.5% counts as stable; fewer than 3 trading
    days in either week is "insufficient data".
- **Data-quality report** (`quality.py`, `GET /market-prices/quality`,
  `scripts/market_price_report.py --quality`): issues by code, flags, cross-source overlaps,
  abnormal day-over-day moves (> 50%), date gaps (> 7 days), stale markets, recent runs.
  On the real data it surfaces what you'd expect:
  - variety-mix jumps in Rice
  - long seasonal gaps (tomato/rice off-season)
  - one ambiguous market ("Bishnupur APMC" vs the catalogue's "Bishnupur(Bankura) APMC"): kept
    separate and flagged, never merged by guess

**Nearby mandis** (`nearby.py`): no source publishes market coordinates.
- `scripts/geocode_markets.py` (opt-in) fills them from OpenStreetMap Nominatim, at ≤1 request/s
  with an identifying User-Agent.
- Each point records its source and precision: `place` = town found, `district` = only the
  district centroid, shown as "~".
- Markets it can't place stay without coordinates. West Bengal: 53 place, 21 district, 2 not
  found (Agmarknet spells a district "Sounth 24 Parganas").
- Ranking: distance where known, then same district, then same state.
- Only markets that reported in the last 30 days are listed.
- OSM attribution is shown with any distance.
- It's a comparison. The UI says the highest price isn't necessarily the best market.

**Forecasting** (`app/ml/price_forecast/`):
- **Dataset.** One sample per market × traded day. Features:
  - calendar and season (Kharif/Rabi/Zaid)
  - lags 1/3/7/14/30
  - rolling mean/std 7/14/30
  - price range, 7/30-day change
  - arrivals, their 7-day lag and 7/30-day means
  - last year's move over the same stretch
  - market/district ids

  Everything is computed from data up to the origin day. A test alters every future price and
  checks that past features are bit-for-bit unchanged. The target is the log price ratio at t+h
  (the latest report within 3 days of t+h), so one model can pool markets with different price
  levels. Varieties are merged in the daily series; the per-variety split is a known next step.
- **Candidates**: naive (no change), 7-day moving average, seasonal naive (baselines); Ridge,
  random forest, LightGBM, and LightGBM with Huber loss (learned). No LSTM/GRU: with a few years
  of daily data per market, tree and linear models are the right tools, and validation decides.
  Predicted moves are capped at ×0.22–×4.5, the same in validation and in production.
- **Validation**: rolling-origin, never shuffled.
  - 4 folds × 30 days; each trains only on samples whose *target* date is before the fold (purged).
  - MAE / RMSE / MAPE are pooled, per fold and per market. Modal prices are strictly positive, so
    MAPE is well-defined.
  - A learned model is selected only if it beats the best baseline.
  - 80% prediction intervals come from the chosen model's validation-error quantiles. Coverage is
    checked honestly: quantiles from earlier folds, measured on the last fold.
- **Storage**: artifacts go in `PRICE_MODEL_DIR/<commodity>/<state>/<h>d/<version>/`
  (`model.pkl`, `metadata.json`, `metrics.json`), which is gitignored. The registry
  `price_forecast_models` records model, version, training dates and data range, features, every
  candidate's metrics, and the interval. `price_forecasts` records base date/price, forecast date,
  horizon, predicted price, bounds, and model name/version. A market gets no forecast if it's
  stale (> 10 days behind) or thin (< 15 trading days in 60). The API then says why.

**Real results, West Bengal (validation, Rs/quintal)**

| Commodity | Horizon | Selected | MAE | MAPE | Naive MAE | Best learned (MAE) | 80% interval held (last fold) |
|---|---|---|---|---|---|---|---|
| Onion | 7d | Ridge | 235.8 | 7.4% | 238.3 | Ridge 235.8 | 91% |
| Onion | 14d | Ridge | 363.5 | 11.2% | 404.2 | Ridge 363.5 | 89% |
| Onion | 30d | Ridge | 617.2 | 18.1% | 761.3 | Ridge 617.2 (−17% vs best baseline) | 76% |
| Tomato | 7d | naive | 328.8 | 9.6% | 328.8 | LightGBM-Huber 345.6 | 88% |
| Tomato | 14d | naive | 477.6 | 13.9% | 477.6 | LightGBM-Huber 490.9 | 93% |
| Tomato | 30d | LightGBM-Huber | 660.1 | 20.2% | 692.8 | LightGBM-Huber 660.1 | 96% |
| Potato | 7 / 14 / 30d | naive | 20.6 / 34.8 / 62.7 | 2.7 / 4.6 / 8.4% | same | LightGBM-Huber 22.3 / 36.6 / 63.5 | 89 / 90 / 93% |
| Rice | 7 / 14 / 30d | naive | 33.6 / 50.5 / 82.8 | 0.8 / 1.3 / 2.1% | same | RF 35.4 / LGBM-H 54.8 / 91.1 | 79 / 68 / 62% |
| Wheat | 7 / 14 / 30d | naive | 35.3 / 46.4 / 71.2 | 1.3 / 1.7 / 2.6% | same | RF 39.1 / LGBM-H 51.2 / 80.5 | 90 / 91 / 83% |
| Paddy(Common) | 7 / 14 / 30d | naive / naive / 7-day MA | 13.9 / 20.7 / 28.8 | 0.6 / 0.9 / 1.2% | 13.9 / 20.7 / 29.4 | RF 15.4 / 23.3 / LGBM-H 33.8 | 69 / 62 / 66% |

690 forecasts were generated across 50–69 markets per commodity; stale or thin markets got none.

Reading the table:
- **Learned models earn their place for Onion** (all horizons) **and for Tomato at 30 days.**
- **Everywhere else the plain "no change" estimate is the most accurate**, and that is what's served.
- **The Rice and Paddy intervals under-cover.** They held only 62–79% of the time on the most
  recent month, not 80%. Their prices had a calmer training history than the latest weeks. Widening
  them, e.g. with conformal recalibration on recent folds, is in §10.

Two findings shaped the model set:
- **Squared-error models lost to "no change" at short horizons.** Mandi modal prices are sticky
  (20–28% of 7-day changes are exactly zero) with occasional jumps. The median change is 0, which
  is what naive predicts. That led to adding the Huber-loss LightGBM.
- **A linear model once extrapolated to an infinite price on tomato.** That led to the prediction
  cap and finite-only metrics.

Where a baseline wins, the UI says so plainly: "none beat the naive (last price) baseline, so that
is what this estimate uses". It never implies ML was used when it wasn't.

**API** — see §5.2.
- Unknown names → 404, ambiguous names → 422.
- Every price response carries `provenance` {sources, as_of, is_stale, last ingestion run}.
- The outlook (`/analytics`) is deterministic and built from the stored numbers. Example:
  "Potato prices at X have decreased 12.3% over the last 30 days. The 7-day forecast estimates
  prices to remain relatively stable (estimate, not guaranteed). Among nearby markets, Bolpur APMC
  (76 km away) currently has the highest modal price (₹1,000/quintal on 27 Sep 2026)."
  No LLM is involved and nothing is hard-coded.

**Frontend** (`/market`, `views/MarketPage.tsx`, `components/market/*`):
- **Filters:** crop / state / district / market / period. They default to the signed-in user's
  first farm, via `GET /farms/{id}/market-prices`.
- **Current price card:** modal, min, max and last updated, with a warning when the price is more
  than 7 days old.
- **Recharts trend chart:** the modal line with the day's min–max band.
- **Summary:** averages and changes, plus a trend pill with an icon and text, never colour alone.
- **Outlook.**
- **Sortable nearby-mandi table:** by distance, price or 7-day change.
- **Forecast panel:** 7/14/30-day tabs. The chart shows history solid, the estimate dashed and the
  expected range shaded, on a real time axis. The panel lists:
  - estimated price, expected range, typical error
  - the model and its training period
  - validation MAE vs the no-change baseline
  - last model update and a disclaimer

Loading, empty, error, stale and "forecast unavailable" states are handled throughout. The
Dashboard's hard-coded "Nashik Onion Mandi ₹2,400" card was replaced by a real mandi card (since
replaced again by `MarketPriceCard`, §5.15). The page layout described above was reworked in §5.15.

**Tests** (110 new, 242 in the suite, all against in-memory SQLite + respx; fixtures are trimmed
copies of real Agmarknet/CEDA responses):
- providers: 29
- ingestion/validation/resolution: 31
- backfill: 11
- analytics/quality/nearby: 16
- forecasting: 12
- API: 11

### 5.15 Market page redesign + sell-or-hold suggestion (`new-ui`)

Builds on §5.14's prices and forecasts: a farm-level "sell now or hold?" answer, and a Market page
built around it.

**`PriceService.recommendation(farm)`** (`app/services/market_prices/price_service.py`):
1. The farm's crop is mapped to its mandi commodity (the same map as §5.14; Rice → Paddy(Common)).
2. It picks the **nearest model-ready mandi**, going through the nearby list in order (distance,
   then district, then state). A mandi is model-ready when it has a stored forecast made from a
   price no more than 7 days old. If the closest mandi has no forecast, the next one is used, so
   the answer comes from somewhere a forecast actually exists. The user can pick any crop or
   mandi instead.
3. For each horizon (7, 14 and 30 days) it compares the mandi's latest modal price with the
   estimate:
   - **gain** = estimate − today's price
   - **error** = the model's validation MAPE at that horizon × today's price. The models forecast
     relative moves pooled across mandis, so a % error scaled to this mandi's price is fairer than
     pooled rupees. It falls back to the MAE when there's no MAPE.
   - **holding cost** = today's price × the crop's assumed % per 30 days × days/30.
     `MARKET_HOLDING_COST_PCT` defaults to wheat/rice 1%, potato 3%, onion 4%, green chilli 15%,
     tomato 20% and sugarcane 10%; anything else gets 3%.
4. **"Hold ~N days" only if gain > error + holding cost.** When several horizons qualify, it picks
   the one that clears the bar by the most. Otherwise the answer is **"Sell now"**, with a one-line
   reason taken from the most optimistic estimate:
   - no model beat "no change"
   - prices are estimated flat or falling
   - the rise doesn't cover the holding cost
   - the rise after holding cost is within the model's error
5. The response includes:
   - the expected gain (₹/quintal, %, by date)
   - the error range (typical error plus the 80% interval as a gain range)
   - the holding cost (marked as assumed)
   - a breakdown for every horizon
   - the **best mandi nearby today** (highest modal price reported in the last 7 days, and how
     much more it pays than the selected mandi, before transport)
   - a disclaimer
6. **Perishables** (`MARKET_PERISHABLE_COMMODITIES`) get a warning that holding may not be
   possible without cold storage. They get it even when there's no suggestion.
7. When there's no forecast, the price is stale, or no mandi nearby has reported the crop, the
   answer is **"No suggestion"** with the reason. A "Sell now" is never made up.

On real West Bengal data (27 Sep 2026) every crop currently says **Sell now**:
- Potato, wheat and paddy: the selected models are the no-change baselines.
- Tomato: the 30-day estimate of +₹342 doesn't cover the ~₹700 assumed cost of holding a
  perishable.
- Onion: the rise after holding cost (₹271) is well within the model's ±₹896 error.

That's the rule working as intended. It only says hold when the forecast is clearly better than
its own error.

**Route:** `GET /farms/{id}/market/forecast?commodity_id=&market_id=` (owner only). It returns the
selected crop and mandi (with distance and whether it's model-ready), today's stats, 90 days of
history, the stored forecasts and model info, the recommendation, and nearby mandis flagged
`model_ready`.

**Frontend**:
- **`/market` (`views/MarketPage.tsx`)**
  - Selectors: farm → crop → mandi. Mandis are nearest first, with forecast-ready ones marked.
    With no farm selected it's crop → state → mandi over the public endpoints, and the sell/hold
    panel asks the user to pick or add a farm.
  - Sections in order: **today's price** (Live), the **Sell or hold?** card, the **90 + 30 day
    chart**, **nearby mandis**, then the longer history, summary and outlook.
- **`components/charts/PriceForecastChart.tsx`:** 90 days of actual modal prices as a solid
  **Live** line, the 7/14/30-day estimates as a dashed **Estimate** line with the 80% range
  shaded, and a vertical **Today** marker. The time axis is real, so horizons are spaced
  correctly. The horizon behind the suggestion is drawn with a bigger dot.
- **`components/market/RecommendationCard.tsx`:** the headline and reason; gain / error range /
  holding cost; the perishable warning; the best mandi nearby (with "View this mandi"); and a
  collapsible "How this was worked out" table (per horizon: estimate, gain, holding, error, worth
  it?).
- **`components/market/ModelInfoTooltip.tsx`:** an (i) Model button. On hover, focus or tap it shows
  the version, trained date and MAPE per horizon, plus the training period.
- **Labels:** actual prices carry a green **Live** badge and model output a dashed-blue
  **Estimate** badge (`components/market/Badges.tsx`). The legend spells them out, so colour
  never carries the meaning alone.
- **Nearby mandis table:** tags the **Best today** mandi and those with an **Estimate**.
- **Sidebar:** "Mandi Prices" → **Market**.
- **Dashboard:** `MarketPriceCard` shows the Live price at the chosen mandi, the 30-day Estimate
  and the suggestion's headline and reason, with a perishable note. Guests get a sign-in prompt.
- **Removed:** `ForecastPanel` and `ForecastChart` (replaced by the chart above), and
  `MandiPulseCard`.
- **Empty states:** when there's no estimate, the chart still draws the Live line, the legend
  drops its Estimate / Expected range entries, and a notice gives the reason. The x-axis has fixed
  date ticks every 15 days, so a mandi with only a few days of data still gets a readable
  timeline.

**Checked in the browser** (27 Sep 2026, against the real database):
- **A crop with no model:** Wheat at Shevgaon(Bodhegaon), Maharashtra. The page showed the Live
  price (₹2,700 on 26 Sep), the 90-day actual line and "No estimate for this mandi: no model has
  been trained for this commodity in this state yet". The card said "No suggestion".
- **Actual vs forecast:** Onion at Bara Bazar, West Bengal. The chart showed the solid Live line
  up to the Today marker, then the dashed Estimate line with the shaded 80% range. The 7/14/30-day
  estimate cards sat above the chart.
- **Never hold inside the error:** checked on the same onion data, the suggestion is "Sell now".
  The 30-day estimate is +₹469/quintal, but the rise left after holding cost (₹271) is inside the
  model's ±₹896 error. The card was rendered with this real payload.
  - This one isn't visible on the owners' farms yet. They're all in Maharashtra, where no model is
    trained, so every farm there gets "No suggestion".
  - Seeing it on a real farm needs a farm in West Bengal, or a Maharashtra backfill and training
    run (§10).

Fixes made during those checks:
- The model tooltip closed straight after a click. Focusing the button opened it and the click
  then toggled it shut; a click now only opens it.
- A "Sell now" reason quoted the 7-day estimate ("rise ₹0") while the 30-day estimate rose. The
  reason now uses the most favourable estimate.
- The two chart empty-state fixes above.

**Tests** (10 new, 252 in the suite): the rule itself covers
- hold only when the rise beats error + holding cost
- sell when the rise is within the error, doesn't cover the holding cost, or is flat/falling, or
  when the model is naive
- a higher holding cost (tomato) turning the same estimate from hold into sell
- a stale price giving no suggestion
- per-commodity costs and perishables

API tests cover:
- no forecast → no suggestion
- skipping a closer mandi without a forecast for the nearest one with one
- an explicit mandi choice, and 404 for an unknown mandi
- best mandi nearby and its price difference
- a sell-now case

### 5.16 Crop list restricted to five crops, and Sugarcane's missing-data fix

Every crop-selection control across the app (`ALLOWED_CROPS` in the relevant view/component) was
narrowed to just **Rice, Wheat, Onion, Sugarcane, Potato** — the full Agmarknet catalogue (hundreds
of commodities) was more choice than the product wants to support today.

That surfaced a real bug: the Market page's crop dropdown (`MarketPage.tsx`) called
`useMarketCommodities()` with no arguments, which hits `GET /market-prices/commodities` — a list
built from `commodities_with_data()` (`app/services/market_prices/queries.py`), which only ever
returned commodities that already had stored `MarketPriceStats` rows. Sugarcane had none, so it
silently never appeared, even though it's one of the five allowed crops.

**Root cause is a real-world data gap, not a bug in the ingestion pipeline**: sugarcane in India is
procured directly by sugar mills under the Sugarcane Control Order, not auctioned through open APMC
mandis — confirmed empirically (zero Agmarknet/CEDA records for Sugarcane in both West Bengal and
Uttar Pradesh, a major cane state). No amount of backfilling fixes this; the data genuinely doesn't
exist upstream. `Sugarcane` was still added to `MARKET_PRICE_COMMODITIES` (`app/core/config.py`,
§9's env table) so ingestion keeps trying, in case some mandi ever does start reporting it.

**Fix — show it, but say so honestly** (matching the page's stated "never fake a number" design,
§5.14):
- `commodities_with_data()` gained an `always_include: list[str] | None` parameter: a `LEFT OUTER
  JOIN` (was an inner join) plus a `HAVING count(...) > 0 OR name IN (...)` clause, so a named
  commodity is returned even with zero price rows.
- `GET /market-prices/commodities` takes a new `include=` query param (comma-separated names)
  threaded through to `always_include`.
- `MarketPage.tsx` calls `useMarketCommodities(undefined, ALLOWED_CROPS.join(","))`, so the
  dropdown always offers exactly the five allowed crops regardless of data availability.
- A new notice — "No mandi price data is available for Sugarcane yet. Agmarknet mandis haven't
  reported any trades for it." — covers the specific case the page's existing empty-state handling
  didn't: a commodity with literally zero rows anywhere means `stats`/`locations`/`browseState` all
  end up `undefined`, which previously just rendered nothing below the dropdown.

Verified live: the crop dropdown lists exactly Rice/Wheat/Onion/Sugarcane/Potato; selecting
Sugarcane shows the new notice with no blank/broken sections; switching back to any real crop
(Wheat) still renders full live price/mandi/sell-hold sections with no regression.

### 5.17 Real weather forecast (Open-Meteo) (`weather` branch)

Closes the last of §5.8's "still synthetic" gaps — the Dashboard's Field Weather card now has a
real backend behind it, the same live/demo split as satellite and environment:

- **`app/integrations/open_meteo_client.py`** — an `httpx`-based async client for
  `api.open-meteo.com/v1/forecast`, key-free (no `configured` gate, unlike Earth Engine or the paid
  mandi-price providers) with its own retry/backoff (`tenacity`, 4 attempts, exponential 2-30s,
  retrying only network errors/429/5xx) rather than reusing `market_prices/http.py`'s helper, to
  keep weather's error types independent of the mandi-price domain. Requests the farm centroid's
  daily temperature max/min, precipitation sum/probability, wind speed, relative humidity, UV index
  and `et0_fao_evapotranspiration`, `timezone=Asia/Kolkata`, for the next `FORECAST_DAYS = 10` days.
- **`WeatherService.get_weather(farm)`** (`app/services/weather_service.py`) maps the raw forecast
  into the response shape the frontend's `FarmDetailedWeather` (`FarmWeatherReport.tsx`) needs, and
  derives three per-day flags from fixed thresholds: `heavy_rain` (>25mm/day), `heat_stress`
  (>38°C), `good_spray_window` (rain probability <20% and wind <15 km/h). Same cache-read-through
  pattern as `SatelliteService.get_or_build_layers` (§5.10) — a `WeatherCache` row per farm
  (`daily` stored as JSON rather than one column per field, so a new Open-Meteo variable never needs
  a migration), refetched only once `expires_at` (`generated_at + WEATHER_CACHE_HOURS`, 3h) has
  passed; unlike satellite analysis there's no separate `/refresh` endpoint, since Open-Meteo is
  free enough that a single `GET` can always serve fresh-enough data itself.
- **`GET /farms/{id}/weather`** (`app/routers/weather.py`) — farm-ownership-checked the same way as
  every other `/farms/{id}/...` route (`FarmService.get_farm`), 503 on an Open-Meteo failure, and
  (unlike `/satellite/latest`) never 404s: the first call for a farm just fetches live.
- **Frontend**: `lib/api/weather-client.ts` + `lib/hooks/useFarmWeather.ts` follow the
  `satellite-client.ts`/`useFarmEnvironment.ts` pattern exactly (§5.12), gated by the same
  `isRealFarmId` check, `staleTime` matched to the backend's 3h cache. `farmStore.ts`'s
  `applyLiveWeather(base, weather)` overlays the live forecast onto the demo `FarmDetailedWeather`
  the same way `applyLiveSatellite` does (§5.7) — condition/icon are approximated from
  precipitation sum/probability since Open-Meteo's daily block has no cloud-cover field in what's
  requested here; `feelsLike`/`windDir`/`pressureHpa` have no live source and stay as the demo
  value. `DashboardPage.tsx`'s Field Weather card gained the same
  loading/error/`SourceBadge`(`live`/`demo`) treatment as the Soil and Canopy Moisture cards, with
  the live badge showing both the Open-Meteo pass date and the exact local time the forecast was
  fetched (`provenance.fetched_at`).
- **Verification**: `pytest backend/tests/test_weather_service.py` (fetch-and-cache, cache reuse,
  expired-cache refetch, `OpenMeteoError` → `WeatherServiceError` wrapping, per-day flag
  derivation) plus the full existing suite, 263/263 passing; `GET /farms/{id}/weather` confirmed
  registered via `app.openapi()`; frontend `tsc --noEmit` and `eslint` both clean; the guest/demo
  Dashboard path confirmed live in-browser (Field Weather card renders with a "Demo data" badge, no
  console errors). The live, signed-in path (`SourceBadge live={...}`, real Open-Meteo data) is
  exercised by the unit tests but wasn't separately smoke-tested end-to-end in a browser this round
  — local account registration in this dev environment hung on the database call, an environment
  issue unrelated to this feature's code.

### 5.18 Irrigation recommendation — FAO-56 water balance (`irrigation` branch)

A real per-farm irrigation model, built on top of §5.17's weather forecast and §5.11's soil/rainfall
data rather than a fixed rule of thumb:

- **The model, in one line**: a daily root-zone depletion balance, `depletion += ETc - effective_rain
  - logged_irrigation`, where `ETc = ET0 x Kc` (FAO-56 single crop coefficient method). Depletion is
  clamped to `[0, TAW]`; irrigation is recommended once it's projected to cross `RAW = p x TAW`
  (readily available water).
- **`app/ml/irrigation_kc.py`** — per-crop FAO-56 stage tables (initial/development/mid/late-season
  lengths, Kc_ini/Kc_mid/Kc_end, root-depth min/max, depletion fraction `p`), reusing
  `interpolate_benchmark_curve` from `app/core/satellite_health.py` (§5.6) to turn each crop's stage
  lengths into a piecewise-linear Kc-by-day-since-sowing curve — same clamp-at-the-ends behaviour as
  the NDVI benchmark curves, just a different curve. Covers the five currently farm-registerable crops
  (rice, wheat, onion, sugarcane, potato, §5.16) plus the other crops `crop_benchmarks.py` already has
  NDVI curves for; an unrecognised crop falls back to a generic mid-range profile. **Typical published
  FAO-56 figures, not a site-calibrated agronomic dataset** — same caveat as §5.9's NDVI curves.
  `ndvi_adjusted_kc()` implements the optional NDVI override: `Kc ~ 1.25 x NDVI + 0.1`, clamped to the
  crop's own `[kc_min, kc_max]` — used instead of the stage curve whenever the farm has a satellite
  observation (§5.6) less than `NDVI_MAX_AGE_DAYS` (20) old.
- **`app/ml/soil_water.py`** — USDA texture class → available water capacity (mm of plant-available
  water per metre of root depth), keyed on the exact strings `EarthEngineClient.get_soil_properties`
  (§5.11) returns, so a farm's `EnvironmentSnapshot.soil_texture_class` maps straight through.
  `TAW = AWC x root_depth`. No soil reading yet (no `EnvironmentSnapshot`, or its OpenLandMap fetch
  hasn't run) falls back to a mid-range "Loam" texture — always surfaced honestly via the response's
  `soil_texture_is_default` flag, never silently assumed.
- **Two new historical data sources**, both reused/extended from existing integrations rather than a
  new provider:
  - **`OpenMeteoClient.get_historical()`** (`app/integrations/open_meteo_client.py`) — a second
    endpoint (`archive-api.open-meteo.com`) on the same key-free client as §5.17's forecast, for past
    ET0 (the forecast endpoint only ever looks ahead). Also returns precipitation as a fallback rain
    source. The shared retry/parsing logic was factored out into `_fetch()` so both endpoints use it.
  - **`EarthEngineClient.get_rainfall_daily_series()`** (`app/integrations/earth_engine_client.py`) —
    daily CHIRPS precipitation over a date range, the per-day counterpart to §5.11's
    `_get_rainfall_summary` (which only returns rolling-window totals). Same one-`.map()`-then-one-
    `getInfo()` FeatureCollection pattern as `_get_temperature_summary`. Preferred over Open-Meteo's
    reanalysis precipitation when Earth Engine is configured and reachable; falls back to it
    (`EarthEngineNotConfiguredError`/timeout/request errors are caught) otherwise — same graceful-
    degradation principle used everywhere else Earth Engine is optional.
- **`IrrigationService.get_plan(farm)`** (`app/services/irrigation_service.py`) is the orchestrator:
  1. Loads the farm's `IrrigationPlan` row (one per farm, like `WeatherCache`/`EnvironmentSnapshot` —
     not a timeseries) if one exists; starts depletion at 0 (field capacity) otherwise, anchored to
     `sowing_date - 1 day` and capped at `MAX_BACKFILL_DAYS` (180) back so an old/perennial field's
     first-ever computation can't trigger an unbounded history fetch.
  2. Resolves today's Kc (NDVI-adjusted or stage-curve) and root depth once, and applies that single
     value across this whole call's roll-forward *and* forward projection — a deliberate simplification
     (reconstructing a full historical per-day Kc/NDVI series is out of scope for a demo-grade model),
     noted here rather than left implicit.
  3. **Rolls the balance forward** from the day after `computed_through` through yesterday, using the
     historical ET0/rain sources above plus any `IrrigationLog` rows for those dates, stopping at the
     first day data isn't available for yet (CHIRPS/the archive both lag a few days) rather than
     guessing. `computed_through` only advances as far as it actually processed.
  4. **Projects forward** over the cached Open-Meteo forecast (via `WeatherService.get_weather`, so it
     shares that 3h cache rather than making a second Open-Meteo call) to find the first day depletion
     is projected to cross RAW — that's `next_irrigation_date` / `next_irrigation_depth_mm` (capped at
     TAW: irrigate back to field capacity, not beyond). Already past RAW as of yesterday short-circuits
     this to "now" without needing the forecast at all.
  5. Upserts the `IrrigationPlan` row and returns it, labelled `basis: "Modelled"` throughout.
- **Effective rainfall**: a simplified rule of thumb — a day's rain counts only once it's above 5mm
  (smaller amounts are assumed lost to interception/evaporation before reaching the root zone), and
  only 80% of the rain above that threshold reaches the crop. This specific interpretation (a
  threshold-then-fraction rule, not "80% of the excess over 5mm") is a judgement call the spec text
  didn't fully pin down, documented here and in `EFFECTIVE_RAIN_THRESHOLD_MM`/`EFFECTIVE_RAIN_FRACTION`.
- **`irrigation_plans` / `irrigation_logs` tables** (`app/models/irrigation_plan.py`,
  `irrigation_log.py`, migration `79c227277080_add_irrigation_plans_and_logs_tables.py`).
  `IrrigationLogRepository` is otherwise a plain insert/list — the interesting logic is in how
  `IrrigationService.log_irrigation()` applies a log: a date already folded into `computed_through`
  (a backdated log) is subtracted from the stored `depletion_mm` immediately, since a future
  roll-forward will never revisit that day; a log for today/a pending day needs no special handling —
  the normal roll-forward picks it up the next time `get_plan` processes that date.
- **`GET /farms/{id}/irrigation`** / **`POST /farms/{id}/irrigation/log`** (`app/routers/irrigation.py`)
  — same farm-ownership-checked, 404-never-403 pattern as every other `/farms/{id}/...` route; 503 on
  an Open-Meteo forecast failure (only reachable when the plan isn't already in deficit, per step 4
  above), 400 on an invalid log (non-positive depth, future date). `GET` never 404s, matching
  `/weather` — the first call computes a plan from scratch.
- **Frontend**: `lib/api/irrigation-client.ts` + `useFarmIrrigation.ts` (same `isRealFarmId`-gated,
  `apiFetch`/`SourceBadge` pattern as `weather-client.ts`/`useFarmWeather.ts`, §5.17) wire
  `GET /farms/{id}/irrigation` into the Dashboard's Canopy Moisture card — a "Modelled" `SourceBadge`
  plus either the next irrigation date/depth (in deficit) or the current depletion vs. RAW (not yet
  in deficit), alongside the card's existing NDWI/soil-moisture numbers. `POST .../irrigation/log`
  (recording a farmer-reported irrigation) and the Satellite page's irrigation card are still
  unwired — see "not done yet" below. No test exercises live Earth Engine/Open-Meteo archive calls
  (same as the rest of `earth_engine_client.py`);
  `tests/test_irrigation_kc.py` covers the pure Kc/root-depth/TAW math and
  `tests/test_irrigation_service.py` covers the service against mocked clients (roll-forward math,
  CHIRPS-preferred-over-archive fallback, backdated-log adjustment, NDVI-driven Kc) — 23 new tests,
  286/286 passing overall.

### 5.19 AI Advisor — KrishiBot (`ai-advisor` branch)

A real LLM-backed advisor answering a farmer's free-text question about ONE farm, grounded only in
that farm's already-computed data — never general agronomy knowledge, never another farm's data:

- **`app/integrations/gemini_client.py`** — thin wrapper over Google's `google-genai` SDK.
  `generate_structured(system_instruction, contents, response_model)` runs a `generateContent` call
  asking for JSON matching a given pydantic model (`response_mime_type="application/json"` +
  `response_schema`), and returns `response.parsed` already validated. `GEMINI_API_KEYS` is
  comma-separated (see §7) — the client tries each key in turn and falls through to the next on
  *any* error, since several free-tier keys quota-exhaust independently (confirmed live: Google's
  free tier for `GEMINI_MODEL` is capped at `GenerateRequestsPerDayPerProjectPerModel-FreeTier` —
  as low as 20 requests/day per key/project — so the 3-key fallback is doing real work, not just
  covering a hypothetical). A `5xx` (Google's own "high demand" overload) gets one short in-place
  retry on the *same* key with backoff before moving on, since that's the model being momentarily
  overloaded, not the key; a `429` moves straight to the next key with no retry, since it means this
  key/project's own quota is exhausted, which a couple of seconds of backoff can't fix. A key that
  hit a `429` is pushed to the back of the order for that model (1 hour for a daily quota, 5 minutes
  otherwise; in-memory, resets on restart) so later requests don't pay a failed round-trip on it
  first. If the model itself is the problem — still overloaded after the retry, or `404` retired for
  these keys — the same keys are tried on each `GEMINI_FALLBACK_MODELS` entry (§7); free-tier quota
  is per model, so a fallback model is also fresh quota on keys that are exhausted on the primary.
  Only raises `GeminiRequestError` once every key has failed on every model (after retries). `GeminiNotConfiguredError` is a
  distinct case (list is empty) so callers can tell "not set up" from "set up but broken." Runs off
  the event loop via `asyncio.to_thread` in `AdvisorService.ask` (the SDK's HTTP client is
  synchronous, and now sometimes sleeps mid-call for retries — either would otherwise block every
  other request this process is serving).
- **`AdvisorService.ask(farm, user, question, language)`** (`app/services/advisor_service.py`) is the
  orchestrator:
  1. Checks the caller against a per-user, in-memory rate limit (`ADVISOR_RATE_LIMIT_PER_HOUR`, §7) —
     there's no Redis/rate-limiting infra anywhere else in this stack yet, so this is a deliberately
     simple fixed-window counter, single-process, resets on restart.
  2. Builds a small `context` dict, module by module, calling each existing service exactly the way
     its own router does (never re-deriving anything): `farm` (profile, always present), `season`
     (days-since-sowing + `benchmark_ndvi_for_crop`, §5.9, computed here rather than stored anywhere),
     `satellite` (`SatelliteService.get_latest`, §5.6) + `alerts` (`get_alerts`, §5.9) when a satellite
     observation exists, `environment` (`get_environment`, §5.11), `weather`
     (`WeatherService.get_weather`, §5.17, today + next-3-days rain/heat/heavy-rain flags),
     `irrigation` (`IrrigationService.get_plan`, §5.18), `market_price` (`PriceService.farm_forecast`,
     §5.14/§5.15's today price + recommendation). Every module is tagged with a human `label` and an
     `as_of` date; a module with no data for this farm is simply left out of the dict rather than sent
     as null — the system instruction tells Gemini it may only cite a module that's actually present.
     Each per-module fetch is independently best-effort (its own try/except) so one missing/broken
     data source (e.g. Open-Meteo down) degrades the context instead of failing the whole question.
  3. If `GEMINI_API_KEYS` is empty, **or** Gemini itself is unavailable (`GeminiRequestError` — every
     key failed after retries), skips/gives up on the model and calls `_scripted_reply()` — a short,
     rule-based summary of whatever's in the context (crop health score, next irrigation date, mandi
     price + recommendation headline, rain/heat/critical-alert warnings). It doesn't attempt the
     farmer's actual question (that needs the model) — only reports what's known — and is flagged back
     to the client via `is_scripted_fallback: true` so the UI can tell the difference. KrishiBot never
     surfaces a hard error to the chat UI for a Gemini-side failure; it always answers from the real
     data it already has. (Not to be confused with the frontend's own separate guest/demo fallback,
     `apiClient.sendChatMessage`, §6.8, used for signed-out or non-real-farm sessions before the
     backend is ever called.)
  4. Otherwise calls Gemini with `_SYSTEM_INSTRUCTION` (answer strictly from context; say "I don't
     have that data" rather than guess; answer in the requested `language`; be short and practical)
     requesting `AdvisorLLMOutput {answer, action_points[], warnings[], sources_used[]}`.
  5. **`sources_used` is re-validated server-side**, not trusted from the model: `_finalize()` drops
     any module key the model names that isn't actually a key in `context`, then maps each surviving
     key to its `label` and its *real, already-known* `as_of` date (never a date the model wrote
     itself) — this is what lets the UI show "Based on: Satellite 20 Sep, Agmarknet 24 Sep" without
     trusting the LLM to get dates right.
- **`POST /farms/{id}/ask`** (`app/routers/assistant.py`) — same farm-ownership-checked, 404-never-403
  pattern as every other `/farms/{id}/...` route (§5.x). Maps `AdvisorRateLimitError` → 429;
  `AdvisorServiceError` → 503 is still mapped defensively but isn't raised by a Gemini failure any
  more (see point 3 above — that now degrades to the scripted reply instead), so in practice it's
  currently unreachable except from a genuine unexpected error. Takes `{question, language}`, returns
  `AdvisorAskResponse {answer, action_points, warnings, sources_used, language, is_scripted_fallback,
  generated_at}`.
- **No new database table** — unlike every other `/farms/{id}/...` feature, nothing here is cached or
  persisted; each question re-gathers the context fresh (all the underlying reads are themselves
  already cached by their own service) and the rate-limit counter is in-memory only.
- **Frontend**: `lib/api/advisor-client.ts` (same `isRealFarmId`-gated, `apiFetch`/error-class pattern
  as `irrigation-client.ts`, §5.18) + a new shared `lib/hooks/useKrishiBot.ts` that both
  `KrishiBotWidget.tsx` (the floating widget) and `AiChatPage.tsx` (`/ai-chat`) now call: a real,
  signed-in farm (`isRealFarmId`, picked from `useFarmStore()` — the widget defaults to the account's
  first farm, `/ai-chat` also accepts a `?farm=<id>` query param) routes through `askAdvisor()` to the
  real endpoint above; a guest/demo session keeps using the existing `apiClient.sendChatMessage`
  scripted/mock replies exactly as before (§6.8) — the AI advisor never runs for a farm it has no real
  data for. Both surfaces render `action_points` as a bullet list, `warnings` as amber callouts, and
  `sources_used` as a "Based on: Satellite 20 Sep, Agmarknet 24 Sep"-style line using the existing
  `formatPassDate` helper (`SourceBadge.tsx`, §5.12) — the same per-module labels/dates
  `AdvisorService._finalize` computed server-side.
- **What's not done yet**: no automated tests for `AdvisorService`/`gemini_client.py` (the rest of the
  external-API integrations, e.g. `earth_engine_client.py`, are similarly untested against the live
  API — this follows that same pattern, not a new gap); no per-farm chat history persistence (every
  question is answered independently, previous turns aren't included as context); rate limiting is
  in-memory only, so it resets on every backend restart and isn't shared across multiple worker
  processes if this ever moves beyond a single-process deployment.

---

## 6. Authentication system (the main feature built so far)

### 6.1 Flow

1. **Register** (`POST /auth/register`): validates email format + password length (pydantic),
   rejects duplicate emails, hashes the password with bcrypt, stores the user, returns the public
   user record (no tokens — the frontend calls `login` immediately after).
2. **Login** (`POST /auth/login`): looks up the user by email, verifies the bcrypt hash, checks
   `is_active`, and if all good issues a signed JWT **access token** (short-lived, 30 min default)
   and **refresh token** (long-lived, 7 days default).
3. **Refresh** (`POST /auth/refresh`): verifies the refresh token's signature/expiry/type, looks
   up the user, and issues a new access token (refresh token itself doesn't rotate). The
   frontend calls this automatically: every authenticated request goes through
   `authorizedFetch()`, which refreshes once on a 401 and retries, or ends the session with a
   redirect to `/login?expired=1` if the refresh token is rejected too (§5.13).
4. **`/auth/me`**: `get_current_user()` dependency decodes the Bearer access token, verifies it's
   an `access`-type token (not a refresh token used where it shouldn't be), loads the user, and
   401s with `Could not validate credentials` if anything is wrong.
5. **Google login** (`POST /auth/google`): verifies the Google ID token's signature and audience
   (must match `GOOGLE_CLIENT_ID`) via `google-auth`, requires the Google account's email to be
   verified, then finds-or-creates the user — matching first by `google_sub` (Google's stable
   per-account id), falling back to linking by email if a password account with that email
   already exists — and issues the same access/refresh JWT pair as a normal login.

### 6.2 Security decisions worth knowing about

- **No user enumeration via login errors**: "no such user" and "wrong password" both return the
  exact same `401 {"detail": "Invalid email or password."}` — an attacker can't use the error
  message to figure out which registered emails exist.
- **Passwords are bcrypt-hashed**, never stored or logged in plaintext.
- **JWTs are signed with `JWT_SECRET_KEY`** (HS256). The dev `.env` files ship with an obviously
  fake default (`dev-only-insecure-secret-change-me`) — must be overridden with a real random
  value in any non-local environment.
- **Google-only accounts have `hashed_password = NULL`** — `verify_password()` explicitly returns
  `False` for a `None` hash, so a Google-only account can never be logged into with a guessed or
  blank password via the normal `/auth/login` route.
- Access and refresh tokens carry a `"type"` claim (`"access"` vs `"refresh"`) so one can't be
  used in place of the other even though both are structurally valid JWTs.

### 6.3 Database: `users` table

```
id                UUID            PRIMARY KEY
email             VARCHAR(255)    UNIQUE, NOT NULL, indexed
hashed_password   VARCHAR(255)    NULL       -- null for Google-only accounts
google_sub        VARCHAR(255)    UNIQUE, NULL, indexed  -- Google's stable per-account id
full_name         VARCHAR(255)    NULL
phone             VARCHAR(20)     NULL       -- profile field, see §6.6
state             VARCHAR(100)    NULL       -- profile field, see §6.6
location          VARCHAR(255)    NULL       -- profile field (district/village), see §6.6
is_active         BOOLEAN         NOT NULL, default true
created_at        TIMESTAMPTZ     NOT NULL
```

Three Alembic migrations so far:
1. `774b15db0131_add_users_table.py` — creates the table.
2. `c6342965f907_user_password_nullable_add_google_sub.py` — makes `hashed_password` nullable,
   adds `google_sub`.
3. `58e05dafe2c1_add_user_profile_fields.py` — adds `phone`, `state`, `location`.

(Both migrations had to manually strip a false-positive Alembic autogenerate line that would have
dropped PostGIS's `spatial_ref_sys` system table — that table isn't part of our ORM metadata, so
autogenerate misreads it as "removed" every time. Worth remembering for any future migration.)

### 6.4 Per-account data isolation (frontend)

Originally `farmStore.ts` (the localStorage-backed farm data — §4.2B) used a single fixed
localStorage key for the whole browser, meaning every account saw the same two demo farms, and
two different people logging into different accounts on the same browser would see and could
edit each other's data. This is now fixed:

- `getUserId()` (in `auth-client.ts`) reads the logged-in user's id straight out of the stored
  JWT (`sub` claim), no network round-trip.
- `farmStore.ts` namespaces its localStorage keys as `fasalsetu_farms_v2:<userId>` and
  `fasalsetu_user_v2:<userId>`.
- Signed-out visitors share a `:guest` namespace that keeps the demo dataset (so the app still has
  something to show without logging in).
- Every real account starts with an **empty** farms list — `DashboardPage.tsx` and
  `SatellitePage.tsx` both show an "Add your first farm" empty state rather than crashing or
  showing fabricated data.

### 6.5 Google Sign-In — now live

The Google OAuth code path (backend token verification, user find-or-create/link, frontend button)
is implemented, tested, and now **turned on** with a real OAuth Client ID from Google Cloud
Console (project `gen-lang-client-0911723218`), set in both `NEXT_PUBLIC_GOOGLE_CLIENT_ID`
(frontend) and `GOOGLE_CLIENT_ID` (backend). The Cloud Console OAuth client is configured as a
**Web application** with `http://localhost:3000` as an authorized JavaScript origin (dev only —
add the production origin before deploying).

What was needed to actually make it work end-to-end (beyond just setting the client ID):
- The `google-auth` package from `requirements.txt` had never actually been installed into
  `backend/venv` — the backend crashed on startup with `ModuleNotFoundError: No module named
  'google'` until `pip install google-auth` was run. If you rebuild the venv from scratch, `pip
  install -r requirements.txt` covers this.
- The backend's `--reload` watcher was pointed at the whole `backend/` folder, including
  `backend/venv` — every `pip install` triggered a multi-second reload storm as it re-scanned
  installed packages. Fixed by scoping the reload watch to `backend/app` only (see
  `.claude/launch.json`).

Verified working: the "Continue with Google" button renders on both `/login` and `/register`,
and clicking it correctly opens Google's `accounts.google.com` OAuth popup. `POST /auth/google`
now verifies real ID tokens (previously it would 401 with "Google sign-in is not configured on
this server." when the client ID was blank — that path is now inactive since a config value is
set; an actually-invalid token instead gets `401 {"detail": "Invalid Google sign-in token."}`).

### 6.6 Profile completion and editing (forgot/reset password was tried and removed)

**Why this exists**: neither a Google sign-in nor (now) email/password registration gives an
account a phone number or state, which the rest of the app (dashboard greeting, farm defaults,
etc.) expects. `phone`/`state`/`location` live on the `User` row itself (§6.3), and
`UserResponse` exposes a computed `profile_complete` field (`true` once both `phone` and `state`
are set — `location` is optional).

**Registration is deliberately minimal** (`RegisterPage.tsx`): just full name, email, and
password. It no longer collects phone/state at signup time (an earlier version did) — that
turned out to make the signup form noisier for no benefit, since the profile step right after
covers it anyway. `POST /auth/register` still *accepts* optional `phone`/`state`/`location` for
API flexibility, but the frontend never sends them, so every new account (Google or email/
password alike) starts with `profile_complete: false`.

**Every new account is routed to `/profile?complete=1` right after signing up** — both
`LoginPage.tsx`'s and `RegisterPage.tsx`'s post-auth handlers check
`getCurrentUser().profile_complete` and push to `/profile?complete=1` (showing a banner) instead
of `/dashboard` when it's false. A returning user whose profile is already complete goes straight
to `/dashboard` as before. This is intentionally the *same* gate for both signup methods now,
not just Google — "simple login, then complete your profile, then register a farm" is the whole
flow.

**Editing a profile** (`/profile`, `ProfilePage.tsx`): a signed-in farmer can change their full
name, phone, state, and location. **Email is always read-only** — shown disabled with an
explanatory note — since it's the account's sign-in identifier; there is no "change email" flow.
Saves go through `PATCH /auth/profile` (`get_current_user` dependency — must be signed in, always
edits your own account, there's no user-id parameter to spoof) and are also mirrored into
`farmStore.ts`'s local profile store so the dashboard greeting/sidebar stay in sync without a
page reload.

`/profile` had a bug where it could get stuck on "Loading profile…" forever: `getCurrentUser()`
threw on a network error instead of resolving, so the page's loading state never cleared. Fixed
by having `getCurrentUser()` catch fetch failures and return `null`, and by having `ProfilePage`
distinguish "not signed in at all" (`isAuthenticated()` false → redirect to `/login`) from
"signed in but the request failed" (show a Retry button instead of redirecting or hanging).

**Forgot / reset password was built, then removed.** An earlier pass
(`profile_setup`) added `/forgot-password` and `/reset-password` pages plus
`POST /auth/forgot-password` / `POST /auth/reset-password` endpoints, using a short-lived JWT as
the reset token since there was no real email service to send a link through — the dev-only
version showed the reset link directly on screen. That whole feature (frontend pages, the
"Forgot password?" link, and the backend endpoints/schemas/service methods) has since been
**deleted outright** rather than kept disabled, because without real email delivery it wasn't
usable and only added surface area. The **"Remember me" checkbox** was removed at the same time —
it was UI-only and never actually did anything (tokens always persisted in `localStorage`
regardless). If password reset is wanted again later, it needs a real email service from the
start (see §10) rather than the dev-token workaround.

### 6.7 Mock/demo data only shows for signed-out guests

An earlier pass gave every new real account one auto-generated demo farm instead of an empty
dashboard. That's been **reverted**: a real, signed-in account now always starts with zero farms
— no fabricated data, ever — until they register one themselves via "Register a Farm" (which
routes to `/farms`). Only **signed-out guests** browsing the app without an account see the
canonical two-farm demo dataset (`DEFAULT_FARMS` in `farmStore.ts`), unchanged from the original
design. This is enforced in `getStoredFarms()`: `isGuest ? DEFAULT_FARMS : []`.

Dashboard/Satellite both show a proper empty state with a "Register a Farm" call-to-action when a
real account has no farms yet, rather than a bare line of text.

### 6.8 KrishiBot AI now requires sign-in

Previously the AI chat was reachable by anyone, signed in or not. It's now gated at both entry
points:

- **`KrishiBotWidget.tsx`** (the floating chat bubble on every page): if opened while signed out,
  it shows a "Sign in to chat with KrishiBot AI" panel with Sign In / Create Account links instead
  of the chat UI. It also hides itself entirely on `/login` and `/register`.
- **`AiChatPage.tsx`** (the full `/ai-chat` page): wrapped in an `AuthGate` that redirects to
  `/login` via `router.replace()` if `isAuthenticated()` is false — this covers every other way to
  land on the page (typed URL, footer link, bookmark), not just the widget.
- The homepage hero's standalone "Ask KrishiBot" button was also removed — chat is now only
  reachable through the widget or `/ai-chat` directly, both gated as above.

---

## 7. Environment variables

Defined in `.env.example` at the repo root. Copy it to `.env` (backend, root-level) and
`frontend/.env.local` (frontend) and fill in real values.

| Variable | Used by | Notes |
| :--- | :--- | :--- |
| `NEXT_PUBLIC_USE_MOCKS` | Frontend | `true` = mock data client (current default) |
| `NEXT_PUBLIC_API_URL` | Frontend | Backend base URL for the (mock/real) data client — `/auth/*` calls strip the `/api/v1` suffix themselves |
| `NEXT_PUBLIC_MAPBOX_TOKEN` | Frontend | Mapbox GL token for maps/field drawing |
| `NEXT_PUBLIC_GOOGLE_CLIENT_ID` | Frontend | Google OAuth Client ID — blank disables the Google button |
| `PORT` | Backend | Port uvicorn listens on |
| `ENVIRONMENT` | Backend | `development` / `staging` / `production` |
| `DATABASE_URL` | Backend | Async SQLAlchemy/Postgres connection string (`postgresql+asyncpg://...`) |
| `FRONTEND_ORIGIN` | Backend | Sole allowed CORS origin |
| `WEATHER_API_KEY` / `SATELLITE_API_KEY` / `AI_API_KEY` | Backend | Reserved for future `app/integrations/` clients — unused today. Real weather (§5.17) uses Open-Meteo, which is free and key-free, so `WEATHER_API_KEY` stays unused/reserved for a future paid provider |
| `CEDA_API_KEY` | Backend | CEDA Agri Market API bearer key (§5.14). Optional: historical fallback archive to 2025-10-30, 40 requests/hour. Backend only, never in `frontend/.env` |
| `DATA_GOV_IN_API_KEY` | Backend | data.gov.in API key (§5.14). Optional, latest day only; free at https://data.gov.in |
| `MARKET_PRICE_PROVIDERS` | Backend | Provider fallback order, default `agmarknet,ceda,data_gov_in`. Agmarknet 2.0 needs no key; providers without a key are skipped |
| `MARKET_PRICE_STATES` / `MARKET_PRICE_COMMODITIES` | Backend | What the nightly job keeps fresh (comma-separated Agmarknet names). Default `West Bengal` × `Potato,Rice,Paddy(Common),Wheat,Tomato,Onion,Sugarcane`. Every farm's state × crop is added when `MARKET_PRICE_INCLUDE_FARM_CROPS` is true (default). Sugarcane never actually gets ingested — no Agmarknet mandi reports it (§5.16) — but stays configured in case one ever does |
| `MARKET_PRICE_CURRENT_DAYS` | Backend | Days re-fetched each night (default 10: late/revised reports are picked up; the upsert makes the overlap free) |
| `PRICE_MODEL_DIR` | Backend | Where trained forecast models are written (default `backend/models_store`, gitignored) |
| `MARKET_HOLDING_COST_PCT` / `MARKET_HOLDING_COST_DEFAULT_PCT` | Backend | Assumed cost of holding a crop (storage + losses) as % of its value per 30 days, as `Commodity:pct` pairs, e.g. `Wheat:1,…,Tomato:20`; unlisted commodities use the default (3). Rough planning figures for the sell/hold suggestion, not measurements (§5.15) |
| `MARKET_PERISHABLE_COMMODITIES` | Backend | Crops that get the "holding may not be possible" warning (default `Tomato,Green Chilli,Sugarcane`) (§5.15) |
| `JWT_SECRET_KEY` | Backend | Signs JWTs — **must** be overridden outside local dev |
| `JWT_ALGORITHM` | Backend | Default `HS256` |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | Backend | Default `30` |
| `REFRESH_TOKEN_EXPIRE_DAYS` | Backend | Default `7` |
| `GOOGLE_CLIENT_ID` | Backend | Same value as `NEXT_PUBLIC_GOOGLE_CLIENT_ID` — verifies Google ID tokens |
| `GEE_PROJECT_ID` | Backend | The Google Cloud project registered for Earth Engine access (§5.5) — required for Earth Engine to work at all |
| `GEE_SERVICE_ACCOUNT_EMAIL` / `GEE_KEY_PATH` | Backend | Optional production auth path (service-account key). Leave both blank to use local Application Default Credentials instead (§5.5) — that's the dev setup today |
| `GEMINI_API_KEYS` | Backend | Comma-separated Gemini API key(s) for the AI Advisor / KrishiBot (§5.19). `GeminiClient` tries each in order, falling through on a quota/auth/other error. Blank = KrishiBot runs in its scripted (non-LLM) fallback mode instead |
| `GEMINI_MODEL` | Backend | Gemini model id used for `POST /farms/{id}/ask` (default `gemini-3.6-flash` — Google retired `gemini-2.5-flash` for new API keys) |
| `GEMINI_FALLBACK_MODELS` | Backend | Comma-separated models tried, with every key, when `GEMINI_MODEL` is overloaded, retired or out of quota (default `gemini-3.5-flash-lite,gemini-3.1-flash-lite`) |
| `ADVISOR_RATE_LIMIT_PER_HOUR` | Backend | Per-user cap on `POST /farms/{id}/ask` (default `20`) — in-memory, resets on restart (§5.19) |

---

## 8. Running it locally

**Database**: PostgreSQL with PostGIS running locally (e.g. via pgAdmin), a database + user
created, `DATABASE_URL` pointed at it in the root `.env`.

**Earth Engine (optional but recommended)**: register `GEE_PROJECT_ID` for Earth Engine access at
https://code.earthengine.google.com/register, set it in `.env`, then run once per machine:
```bash
gcloud auth application-default login --scopes=https://www.googleapis.com/auth/earthengine,https://www.googleapis.com/auth/cloud-platform
```
Skipping this is fine — the backend starts up and runs normally without it, `/health/earth-engine`
just reports `configured: false` / `ok: false` with a `detail` explaining why.

**Backend**:
```bash
cd backend
python -m venv venv && venv\Scripts\activate   # Windows
pip install -r requirements.txt
alembic upgrade head        # applies all migrations, incl. phone/state/location and farms
uvicorn app.main:app --reload --port 8000
```

**Backend tests**:
```bash
cd backend
pip install -r requirements.txt -r requirements-dev.txt
pytest        # 242 tests, async, in-memory SQLite — no Postgres, Earth Engine or price APIs needed (mocked)
```

**Scheduled jobs (§5.9, §5.11, §5.14)**: all start automatically with the backend (registered in `main.py`'s
`lifespan`). Times are server time:
- timeseries + alerts at 02:00
- environment at 02:30
- mandi price ingestion at 23:00, then forecasts at 23:45
- forecast model retraining Saturdays at 03:00
- market catalogue Sundays at 22:00

The mandi jobs have their own manual triggers (below). The rest are inconvenient to wait for
during local dev. To trigger either immediately instead, run (from `backend/` with the venv active,
and `earth_engine_client.initialize()` first if running outside the actual FastAPI process):
```bash
python -c "import asyncio; from app.jobs.scheduler import run_nightly_timeseries_refresh; asyncio.run(run_nightly_timeseries_refresh())"
python -c "import asyncio; from app.jobs.scheduler import run_nightly_environment_refresh; asyncio.run(run_nightly_environment_refresh())"
```

**Mandi prices (§5.14)**: Agmarknet 2.0 needs no key. From `backend/` with the venv active, a first
full setup is:
```bash
python scripts/sync_market_catalog.py            # states/districts/markets/commodities (~2 s)
python scripts/backfill_market_prices.py create --start 2021-01-01 --end 2026-09-27     --state "West Bengal" --commodity Potato --commodity Tomato --run   # resumable; ~3 s per month
python scripts/market_price_report.py --rebuild  # daily series + stats (runs automatically after jobs)
python scripts/geocode_markets.py --state "West Bengal"   # optional: distances for nearby mandis
python scripts/train_price_models.py --forecast  # evaluate/select/store models, write forecasts
```
Day to day: `python scripts/ingest_market_prices.py` runs the nightly ingestion now,
`python scripts/backfill_market_prices.py run --job 1` resumes a backfill, and
`python scripts/market_price_report.py --quality` prints the data-quality report.

**Frontend**:
```bash
cd frontend
npm install
npm run dev    # http://localhost:3000
```

---

## 9. What's real vs. what's mock — quick summary

| Feature | Status |
| :--- | :--- |
| Register / Login / Refresh / `/auth/me` | ✅ Real — hits FastAPI, writes to Postgres, bcrypt + JWT |
| Google Sign-In | ✅ Real — live with a configured Google OAuth Client ID, verified working end-to-end |
| Profile editing (name/phone/state/location) | ✅ Real — `PATCH /auth/profile`, email fixed/read-only |
| Profile completion gate (all signup methods) | ✅ Real — routes to `/profile?complete=1` until phone+state are set |
| Per-account data isolation | ✅ Real — localStorage namespaced by user id |
| Farm records (name, crop, boundary, area/centroid) | ✅ Real for signed-in users — `/farms` API, persisted in Postgres, geometry computed server-side; see §5.4 |
| Mock/demo farm data only for signed-out guests | ✅ Real — see §6.7; a real account always starts empty, no fabricated data |
| Auth-aware public nav (Login vs. Sign out) | ✅ Real — `Navbar.tsx`, see §4.3 |
| KrishiBot AI chat requires sign-in | ✅ Real — see §6.8 |
| Earth Engine connectivity | ✅ Real (when `GEE_PROJECT_ID` + ADC login are set up) — `/health/earth-engine` runs a live Sentinel-2 query; see §5.5 |
| Real per-farm NDVI/NDWI/EVI/NDMI analysis (backend) | ✅ Real — `POST /farms/{id}/satellite/refresh` runs a live Sentinel-2 query against the farm's own polygon, cached in `satellite_observations`; see §5.6 |
| Live NDVI/canopy % shown on Dashboard/Satellite for real farms | ✅ Real — `useFarmSatelliteAnalysis()` + `applyLiveSatellite()` overlay real current stats onto the UI, with a "Live Sentinel-2 data" banner and a refresh button; see §5.7. Guest/demo farms still show synthetic data, as they should (no real polygon to analyze) |
| NDVI/NDWI/EVI timeseries + automated alerts (backend) | ✅ Real — nightly `AsyncIOScheduler` job rebuilds every farm's history from Sentinel-2 and runs 3 alert rules (NDVI drop, below-benchmark, water stress); `GET .../timeseries` and `GET .../alerts` are real, working endpoints; see §5.9 |
| NDVI season curve + pass-date slider | ✅ Real for real farms — Recharts chart of `GET .../timeseries` (field vs. dashed benchmark, dot per pass, date + cloud % tooltip) and a slider that swaps the map layers per pass; guests see the demo curve, labelled "Demo data"; see §5.12 |
| Satellite alerts on the Dashboard | ✅ Real for real farms — alerts strip over `GET .../alerts` with mark-as-read (`PATCH /alerts/{id}/read`); see §5.12 |
| Source badges on satellite numbers | ✅ Real — one "Live — Sentinel-2, 20 Sep, cloud 0.3%" (or "Demo data") badge in the Satellite map's top-right corner; the per-card Sentinel-2/SMAP/CHIRPS/MODIS badges were removed as clutter. The environment card's soil section still says whether values are from the farmer's Soil Health Card or estimated from satellite soil maps; see §5.12 |
| Satellite map tiles (true colour/NDVI/NDWI/EVI/stress) | ✅ Real for real farms — `GET /farms/{id}/satellite/layers` returns live Earth Engine tile URLs clipped to the farm polygon, rendered as a raster overlay on the map; see §5.10 |
| Stress-zone detection + map overlay | ✅ Real for real farms — per-pixel NDVI vectorized into zones (water-stress/nutrient-pest), drawn as clickable polygons on the map; guest/demo farms still show the synthetic stress-zone list; see §5.10 |
| Farm environment report (backend) | ✅ Real — nightly `AsyncIOScheduler` job (02:30) refreshes every farm's CHIRPS rainfall, MODIS land-surface temperature, and SMAP soil moisture, plus OpenLandMap soil pH/organic carbon/texture on a farm's first-ever refresh; `GET /farms/{id}/environment` is a cache-only read of the result, each section with its own provenance/resolution; see §5.11. Shown on the Satellite page (environment card) and the Dashboard's soil/moisture cards for real farms (§5.12) |
| Soil pH/N-P-K | 🟡 Partial — real soil pH/organic carbon/texture are shown for real farms (§5.12); N-P-K is still a demo value, since no data source exists for it yet |
| Field Weather forecast | ✅ Real for real farms — `GET /farms/{id}/weather` reads a farm's centroid forecast from Open-Meteo (temperature, precipitation, wind, humidity, UV, ET0), cached 3h, with heavy-rain/heat-stress/good-spray-window flags per day; Dashboard's Field Weather card shows it with a "Live" badge and fetched time; guests see the demo values labelled "Demo data"; see §5.17 |
| Mandi prices, trends, nearby mandis | ✅ Real, from Agmarknet 2.0 (§5.14). Nightly ingestion, 2021–2026 West Bengal history (456k reports), precomputed analytics. The `/market` page and the Dashboard's mandi card read them. Data is loaded for West Bengal plus the states/crops of registered farms. The crop selector is capped at five crops app-wide (Rice, Wheat, Onion, Sugarcane, Potato, §5.16); Sugarcane has no real mandi data anywhere (mills buy it directly, not via APMC auctions) and honestly says so instead of faking a number |
| Mandi price forecasts | ✅ Real estimates (§5.14). 7/14/30-day, chosen by chronological validation against baselines, with expected range and validation error shown. Labelled estimates, never guaranteed |
| Sell-now / hold-N-days suggestion | ✅ Real, derived (§5.15). Computed from stored prices and forecasts; the holding cost is a configured assumption and is labelled as one. Only for crops/states with a trained model (West Bengal today) |
| Dashboard "Agri News" cards / Smart Suggestion / Harvest Estimation / weather "Field Advisory" | ❌ Removed — all were sample/generated text, not real data. The public `/weather` page (was a hard-coded forecast) now shows the signed-in user's live farm forecast, or a sign-in prompt; `/features`, `/help`, the home page and the footer were cut back to features that actually exist |
| Farm state/district | ✅ Real — reverse-geocoded (Mapbox) from the drawn boundary's centroid when a farm is registered. Previously hard-coded to "Maharashtra", which sent mandi-price lookups to the wrong state |
| Irrigation recommendation | ✅ Real — `GET /farms/{id}/irrigation` computes a FAO-56 root-zone water balance (depletion vs. readily available water) from CHIRPS/Open-Meteo history + forecast, soil texture, and optionally NDVI; `POST .../irrigation/log` records farmer irrigation; see §5.18. Wired into the **Dashboard's** Canopy Moisture card for real farms (`useFarmIrrigation`, `SourceBadge`); the **Satellite page's** irrigation card and the log-entry UI still show/use `farmStore.ts`'s synthetic data |
| Fields / Yield data | ❌ Mock only — `farmStore.ts` localStorage demo data (guests) or synthetic per-farm data (signed-in, see above); no backend endpoints exist yet |
| KrishiBot AI chat responses | ❌ Mock only — via `mock-client.ts` (auth gate is real, the replies aren't) |
| Forgot / reset password | ❌ Removed — was built, then deleted for lack of real email delivery; see §6.6 |
| "Remember me" checkbox on login | ❌ Removed — was UI-only and never did anything |

---

## 10. Known gaps / natural next steps

- Set a real `JWT_SECRET_KEY` before any non-local deployment.
- Add the production frontend origin to the Google OAuth client's authorized origins before
  deploying (currently only `http://localhost:3000` is authorized).
- **If password reset is wanted again**, don't resurrect the dev-token workaround — set up a real
  email service (SES/SendGrid/Postmark) first, since that was the reason it got removed.
- **Surface NDMI client-side** — computed, stored and returned by the API (§5.6), but not shown in
  the UI. (NDVI/NDWI/EVI, the health score, the timeseries, alerts and the environment report are
  all shown as of §5.12.)
- **Give the "no imagery" case its own status code** — the frontend detects it by the 503 message
  prefix "No Sentinel-2 imagery" (§5.12), which works but is brittle; a distinct code (or an
  `error_code` field) would be cleaner.
- **Move the refresh-analysis dedupe lock (§5.13) to the database or Redis before running more than
  one backend worker.** Today it's a per-process `asyncio.Lock`.
- **Recalibrate the Rice/Paddy forecast intervals (§5.14).** They covered 62–79% instead of 80%
  on the latest month. Conformal recalibration on the most recent folds would fix the width.
- **Mandi forecasting (§5.14) mostly doesn't beat "no change" at short horizons, and that is the
  honest result.** Learned models win for Onion and for Tomato at 30 days. Worth trying next:
  - per-variety series for crops with mixed varieties (Rice)
  - weather/arrival forecasts as features
  - quantile models for the intervals
- **Backfill more states** (only West Bengal has history). Farms' states get current prices
  nightly, but they need a backfill before forecasts can be trained for them. Until then, farms
  outside West Bengal get "No suggestion" on the Market page (§5.15). All the registered farms
  are in Maharashtra, so run `backfill_market_prices` + `train_price_models` for Maharashtra ×
  the farms' crops next.
- **Rice's daily series mixes varieties** (fine vs coarse), which causes most of the "abnormal
  change" rows in the quality report. A dominant-variety series would be cleaner.
- **Market name ambiguity**: a price reported as "Bishnupur APMC" doesn't match the catalogue's
  "Bishnupur(Bankura) APMC". It's kept as a separate, flagged market rather than guessed; an alias
  table could merge such cases after a human check.
- **District names in farm records vs Agmarknet's** (e.g. "Ahmednagar" vs "Ahilyanagar", and
  Agmarknet's own "Sounth 24 Parganas" typo). Nearby mandis fall back to distance/state, but the
  same-district step needs matching names.
- **Holding costs (§5.15) are assumptions.** Replace them with regional storage tariffs and
  measured loss rates, and consider non-linear losses for perishables (today's cost grows linearly
  with days held).
- **The Harvest Estimation card's "Target Mandi Rate"** is still generated demo data; it could
  now read the farm's real modal price.
- **Revisit the SMAP soil-moisture source** — `NASA/SMAP/SPL4SMGP/007` (§5.11) is what was asked
  for, but Earth Engine flags it deprecated and it stopped updating around mid-2025; the response
  already surfaces this honestly via `as_of` rather than hiding it, but the underlying collection
  should move to `.../008` once that's confirmed to have the same `sm_surface` band and coverage.
- **Verify the nightly scheduler job against farms with real historical cloud-free passes** — the
  alert rules (§5.9) are covered by 13 unit tests against a mocked `EarthEngineClient`, and the
  live Earth Engine integration itself was verified end-to-end, but the *combination* (a real farm
  whose polygon actually has clear historical Sentinel-2 passes, producing a real stored timeseries
  and a real alert) hasn't been observed live yet — the one test polygon used for live verification
  happened to have persistent heavy cloud cover in its analysis window.
- Build real backend endpoints for fields/yield, and a corresponding `real-client.ts` cutover
  (`NEXT_PUBLIC_USE_MOCKS=false`) for whatever isn't covered by the farms/satellite/weather/irrigation
  API.
- **Wire `GET /farms/{id}/irrigation` into the Satellite page** (§5.18) — only the Dashboard's Canopy
  Moisture card uses `useFarmIrrigation` so far; the Satellite page's irrigation card still shows
  `farmStore.ts`'s synthetic data. Also still unwired: a UI for `POST .../irrigation/log` (recording
  a farmer-reported irrigation) — today that endpoint has no frontend caller at all.
- **Irrigation's per-call Kc/root-depth is a single snapshot, not a true historical reconstruction**
  (§5.18) — the roll-forward over historical days and the forward projection both use *today's*
  resolved Kc, not a day-by-day recomputation from what NDVI/growth-stage actually was on each of
  those past days. Reasonable for a demo model over a period of days-to-weeks, but would drift for a
  farm that hasn't opened its irrigation plan in a long time (bounded by `MAX_BACKFILL_DAYS`, 180).
- Add email verification (registration currently trusts any email address given).
- Add authenticated route protection (currently `/dashboard` etc. are reachable without being
  logged in — they just show guest demo data instead of redirecting to `/login`; that's an
  intentional "let people explore before signing up" choice today, but worth revisiting).
- For production Earth Engine auth, either get the org's `iam.disableServiceAccountKeyCreation`
  policy relaxed for a dedicated service account, or find another non-interactive auth path — ADC
  (§5.5) requires an interactive `gcloud` login per machine, which doesn't work for a server
  deployment.
