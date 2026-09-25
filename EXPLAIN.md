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
`profile_fixes`, `farm-backend`, `earth-engine`, `satellite-analysis`) were used during buildout
and have all been merged into `main`, which is what's pushed to origin and described by this
document. Notable merged work, roughly in order:

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
  score and a background refresh triggered on farm creation (§5.6). Backend-only so far — see §9/§10
  for what's left to wire into the frontend.
- Assorted small UI passes since: removed the "Ask KrishiBot" button from the home hero, gated
  the KrishiBot AI chat behind sign-in (§6.8), added a glassmorphism background to Login/Register
  (§4.4).

---

## 3. Tech stack

**Frontend**
- Next.js 14 (App Router), React 18, TypeScript
- Tailwind CSS + shadcn/ui components (`@base-ui/react`, `class-variance-authority`)
- Mapbox GL + `@mapbox/mapbox-gl-draw` + `@turf/turf` — interactive satellite maps, field boundary drawing, area calculations
- `@tanstack/react-query` — server-state caching for the (currently mock) data hooks
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
- `pytest` + `pytest-asyncio` + `aiosqlite` — async test suite against an in-memory SQLite DB

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
| Weather & Alerts | `/weather` | `WeatherPage.tsx` — still exists, but no longer linked from the sidebar (removed as a redundant nav item; still reachable by direct URL) |
| KrishiBot AI chat | `/ai-chat` | `AiChatPage.tsx` — now requires sign-in (§6.8) |
| Profile | `/profile` | `ProfilePage.tsx` |
| Features | `/features` | `FeaturesPage.tsx` |
| Help Center | `/help` | `HelpPage.tsx` |

`AppLayout.tsx` provides the shared sidebar/nav shell for the logged-in app pages (Dashboard,
Farms, Satellite, AI chat, Profile, Help — Weather is intentionally left off the sidebar, see
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
│   │   └── satellite_health.py  # health-score math, EE-free and unit-testable (§5.6)
│   ├── models/
│   │   ├── base.py        # declarative Base (Alembic autogenerate target)
│   │   ├── user.py        # User ORM model
│   │   ├── farm.py        # Farm ORM model
│   │   └── satellite_observation.py  # SatelliteObservation ORM model (§5.6)
│   ├── schemas/
│   │   ├── auth.py        # pydantic request/response models for /auth/*
│   │   ├── farm.py        # pydantic request/response models for /farms
│   │   └── satellite.py   # pydantic request/response models for /farms/{id}/satellite/*
│   ├── repositories/
│   │   ├── user_repository.py   # DB queries for User (data-access layer)
│   │   ├── farm_repository.py   # DB queries for Farm, scoped to owner
│   │   └── satellite_repository.py  # DB queries for SatelliteObservation
│   ├── integrations/
│   │   ├── google_auth.py       # verifies Google "Sign in with Google" ID tokens
│   │   └── earth_engine_client.py  # Google Earth Engine SDK wrapper (§5.5, §5.6)
│   ├── services/
│   │   ├── auth_service.py      # business logic: register/login/refresh/google login
│   │   ├── farm_service.py      # business logic: create/list/update/delete farms
│   │   └── satellite_service.py # business logic: run/cache a farm's satellite analysis
│   ├── routers/
│   │   ├── health.py      # GET /health, GET /health/earth-engine
│   │   ├── auth.py        # register/login/google/refresh/me + profile
│   │   ├── farms.py       # farm CRUD, all scoped to the current user
│   │   └── satellite.py   # satellite refresh/latest + the background-refresh helper (§5.6)
│   └── main.py             # FastAPI app, CORS, router registration, Earth Engine startup init
├── alembic/                 # versioned DB migrations
└── tests/                   # pytest suite (async, in-memory SQLite) — 68 tests
```

This is a classic layered architecture: **routers** (HTTP layer) → **services** (business logic)
→ **repositories** (DB queries) → **models** (ORM). `schemas/` are the pydantic request/response
shapes, kept separate from the ORM models. `integrations/` wraps external services (Google auth,
Earth Engine) behind a small interface the rest of the app depends on.

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

Still not implemented server-side: `/fields`, `/weather`, `/irrigation`, `/yield`, chat. Those
remain frontend-mock-only for now (§4.2).

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

**Not done yet**: no frontend wiring. `SatellitePage.tsx`/`DashboardPage.tsx` still show
`enrichFarmDraft()`'s synthetic NDVI/canopy numbers (see §9) — this section is backend-only so far.
Also not done: soil pH/N-P-K and weather stay synthetic (not satellite-derived at all); NDWI/EVI/NDMI
are computed and stored but nothing surfaces them client-side yet either.

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
   up the user, and issues a new access token (refresh token itself doesn't rotate).
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
| `WEATHER_API_KEY` / `SATELLITE_API_KEY` / `AI_API_KEY` | Backend | Reserved for future `app/integrations/` clients — unused today |
| `JWT_SECRET_KEY` | Backend | Signs JWTs — **must** be overridden outside local dev |
| `JWT_ALGORITHM` | Backend | Default `HS256` |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | Backend | Default `30` |
| `REFRESH_TOKEN_EXPIRE_DAYS` | Backend | Default `7` |
| `GOOGLE_CLIENT_ID` | Backend | Same value as `NEXT_PUBLIC_GOOGLE_CLIENT_ID` — verifies Google ID tokens |
| `GEE_PROJECT_ID` | Backend | The Google Cloud project registered for Earth Engine access (§5.5) — required for Earth Engine to work at all |
| `GEE_SERVICE_ACCOUNT_EMAIL` / `GEE_KEY_PATH` | Backend | Optional production auth path (service-account key). Leave both blank to use local Application Default Credentials instead (§5.5) — that's the dev setup today |

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
pytest        # 68 tests, async, in-memory SQLite — no Postgres or Earth Engine needed (mocked)
```

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
| Real per-farm NDVI/NDWI/EVI/NDMI analysis (backend) | ✅ Real — `POST /farms/{id}/satellite/refresh` runs a live Sentinel-2 query against the farm's own polygon, cached in `satellite_observations`; see §5.6. **Not yet wired into the frontend** (below) |
| Per-farm satellite numbers shown on Dashboard/Satellite (frontend) | ❌ Still synthetic — `enrichFarmDraft()` in `farmStore.ts` generates these client-side even for a real farm; the real backend endpoint above exists but nothing on the frontend calls it yet |
| Soil pH/N-P-K, weather | ❌ Mock only — not satellite-derived at all, need a different data source |
| Fields / Weather / Irrigation / Yield data | ❌ Mock only — `farmStore.ts` localStorage demo data (guests) or synthetic per-farm data (signed-in, see above); no backend endpoints beyond farms/satellite exist yet |
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
- **Wire the real satellite analysis (§5.6) into the frontend** — `POST/GET
  /farms/{id}/satellite/*` exist and work, but `SatellitePage.tsx`/`DashboardPage.tsx` still read
  `enrichFarmDraft()`'s synthetic NDVI/canopy numbers instead of calling them. This is the natural
  next step now that the backend side is done.
- **Surface NDWI/EVI/NDMI and the health score client-side** — computed and stored (§5.6) but
  currently NDVI is the only index anything would plausibly show; NDWI (moisture) is the obvious
  next one to add to the UI once the wiring above exists.
- Build real backend endpoints for fields/weather/irrigation/yield, and a corresponding
  `real-client.ts` cutover (`NEXT_PUBLIC_USE_MOCKS=false`) for whatever isn't covered by the
  farms/satellite API.
- Add email verification (registration currently trusts any email address given).
- Add authenticated route protection (currently `/dashboard` etc. are reachable without being
  logged in — they just show guest demo data instead of redirecting to `/login`; that's an
  intentional "let people explore before signing up" choice today, but worth revisiting).
- For production Earth Engine auth, either get the org's `iam.disableServiceAccountKeyCreation`
  policy relaxed for a dedicated service account, or find another non-interactive auth path — ADC
  (§5.5) requires an interactive `gcloud` login per machine, which doesn't work for a server
  deployment.
