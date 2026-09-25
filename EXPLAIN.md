# FasalSetu — Project Explainer

This document explains what has been built so far: the overall idea, the frontend, the backend,
the database, authentication, environment configuration, and what is real vs. mock data today.
It reflects the state of the `profile_setup` branch.

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

This is a single repo with the frontend and backend split across branches during initial buildout:

| Branch | Contains |
| :--- | :--- |
| `main` | Merge target — currently equal to `backend` (frontend + backend scaffold), pushed to origin |
| `frontend` | The Next.js app as it stood after initial UI buildout (map view, farm search, satellite panel) |
| `backend` | Adds the FastAPI scaffold (layered structure, async SQLAlchemy, Alembic) on top of `frontend` |
| `back_auth` | Branched from `backend`; adds the full JWT + Google auth system, wires the frontend Login/Register pages to it, fixes per-account data isolation, and turns on a real Google OAuth Client ID. Pushed to origin, not yet merged to `main`. |
| `profile_setup` | **Current working branch.** Branched from `back_auth`; adds full profile fields (phone/state/location) to the User model and a `/profile` edit page, a profile-completion gate for Google signups, forgot/reset password, and per-account (not shared) demo farm data. Not yet pushed to origin or merged to `main`. |

`back_auth` and `profile_setup` together hold all authentication and account-management work. Neither has been merged into `main` yet.

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
- `google-auth` — verifies "Sign in with Google" ID tokens
- `pytest` + `pytest-asyncio` + `aiosqlite` — async test suite against an in-memory SQLite DB

**Database**
- PostgreSQL 17 with the **PostGIS** extension enabled (for future field-geometry storage; not
  used by any table yet)
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
| Forgot Password | `/forgot-password` | `ForgotPasswordPage.tsx` |
| Reset Password | `/reset-password?token=...` | `ResetPasswordPage.tsx` |
| Dashboard | `/dashboard` | `DashboardPage.tsx` |
| My Farms | `/farms` | `FarmsPage.tsx` |
| Farm detail / Field detail | `/farms/[farmId]`, `/farms/[farmId]/fields/[fieldId]` | (in `src/app/farms/...`) |
| Satellite Analysis | `/satellite` | `SatellitePage.tsx` |
| Weather & Alerts | `/weather` | `WeatherPage.tsx` |
| KrishiBot AI chat | `/ai-chat` | `AiChatPage.tsx` |
| Profile | `/profile` | `ProfilePage.tsx` |
| Features | `/features` | `FeaturesPage.tsx` |
| Help Center | `/help` | `HelpPage.tsx` |

`AppLayout.tsx` provides the shared sidebar/nav shell for the logged-in app pages (Dashboard,
Farms, Satellite, Weather, AI chat, Profile, Help). Login/Register/Forgot/Reset/Home are
standalone, full-page layouts.

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
- This is a separate, older, localStorage-backed store — *not* routed through `src/lib/api/` at
  all. It ships two canonical demo farms (Nashik Onion Field, Pune Wheat Block) with full
  synthetic soil/water/weather/satellite/yield detail baked in.
- `useFarmStore()` / `useUserStore()` are the hooks Dashboard/Farms/Satellite/AppLayout actually
  use for farm data and the farmer's profile (name/phone/state/language).
- **This store is now namespaced per logged-in user** (see §6.4) — each account's farms/profile
  live under their own localStorage key, and a fresh account starts with zero farms rather than
  the demo dataset. Signed-out visitors still see the two demo farms.

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
- Both collect email + password (min 8 characters, enforced both client-side via `minLength` and
  server-side via pydantic).
- Errors from the backend are shown inline (a duplicate-registration message, or the deliberately
  identical "Invalid email or password." for both "no such user" and "wrong password" on login —
  see §6.2).
- A "Sign in with Google" button (`GoogleSignInButton.tsx`) is wired up on both pages, renders
  whenever `NEXT_PUBLIC_GOOGLE_CLIENT_ID` is set, and is now **live** — see §6.5.
- Register also now sends `phone`/`state` straight to the backend on signup (previously they
  only ever reached `farmStore.ts` local storage, never the account itself — see §6.6).
- On successful email/password register or login, tokens are stored and the user is redirected
  to `/dashboard`. On Google sign-in, the redirect instead depends on profile completeness — an
  incomplete Google account goes to `/profile?complete=1` first (§6.6).
- Login's "Forgot password?" now links to `/forgot-password` (previously a dead `href="#"`).
- "Sign out" (in `AppLayout.tsx`) clears the stored tokens.

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
│   │   └── deps.py        # get_current_user() FastAPI dependency (Bearer token → User)
│   ├── models/
│   │   ├── base.py        # declarative Base (Alembic autogenerate target)
│   │   └── user.py        # User ORM model
│   ├── schemas/
│   │   └── auth.py        # pydantic request/response models for /auth/*
│   ├── repositories/
│   │   └── user_repository.py   # DB queries for User (data-access layer)
│   ├── integrations/
│   │   └── google_auth.py       # verifies Google "Sign in with Google" ID tokens
│   ├── services/
│   │   └── auth_service.py      # business logic: register/login/refresh/google login
│   ├── routers/
│   │   ├── health.py      # GET /health
│   │   └── auth.py        # register/login/google/refresh/me + profile, forgot/reset-password
│   └── main.py             # FastAPI app, CORS, router registration
├── alembic/                 # versioned DB migrations
└── tests/                   # pytest suite (async, in-memory SQLite)
```

This is a classic layered architecture: **routers** (HTTP layer) → **services** (business logic)
→ **repositories** (DB queries) → **models** (ORM). `schemas/` are the pydantic request/response
shapes, kept separate from the ORM models.

### 5.2 API surface today

| Method | Path | Purpose |
| :--- | :--- | :--- |
| GET | `/health` | Liveness check |
| POST | `/auth/register` | Create an account (email, password, optional full name) |
| POST | `/auth/login` | Exchange email/password for an access + refresh token pair |
| POST | `/auth/google` | Exchange a Google ID token for an access + refresh token pair |
| POST | `/auth/refresh` | Exchange a valid refresh token for a new access token |
| GET | `/auth/me` | Return the current user (requires `Authorization: Bearer <access_token>`) |
| PATCH | `/auth/profile` | Update the current user's `full_name`/`phone`/`state`/`location` (email is never editable here) |
| POST | `/auth/forgot-password` | Request a password reset token for an email/password account (see §6.6) |
| POST | `/auth/reset-password` | Exchange a valid reset token + new password for an updated password |

Nothing else is implemented server-side yet — no `/farms`, `/fields`, `/satellite`, `/weather`,
etc. Those all remain frontend-mock-only for now (§4.2).

### 5.3 CORS

`FRONTEND_ORIGIN` (env var) is the single allowed CORS origin (`http://localhost:3000` in dev) —
deliberately not a wildcard.

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

### 6.6 Profile completion, editing, and forgot/reset password (`profile_setup` branch)

**Why this exists**: a Google sign-in only gives an account an email and a name — no phone number
or state, which the rest of the app (dashboard greeting, farm defaults, etc.) expects. Email/
password registration already collected phone/state in the UI, but never actually sent them to
the backend (they only ever reached `farmStore.ts`'s browser-local storage). Both are now fixed
via the same mechanism: `phone`/`state`/`location` live on the `User` row itself (§6.3), and
`UserResponse` exposes a computed `profile_complete` field (`true` once both `phone` and `state`
are set — `location` is optional).

**Registration** (`POST /auth/register`) now accepts optional `phone`/`state`/`location` and
persists them immediately — so an email/password signup is `profile_complete` from the start.

**Google sign-in** still creates a user with only `email`/`full_name` (Google never gives you a
phone number or state), so a first-time Google account is *not* `profile_complete`. The frontend
checks this right after a successful Google sign-in (`getCurrentUser().profile_complete`) — both
`LoginPage.tsx` and `RegisterPage.tsx`'s `handleGoogleSuccess` — and routes to `/profile?complete=1`
instead of `/dashboard` when it's false, showing a banner explaining the account needs a couple
more details. A returning Google user whose profile is already complete goes straight to
`/dashboard` as before.

**Editing a profile** (`/profile`, `ProfilePage.tsx`): a signed-in farmer can change their full
name, phone, state, and location. **Email is always read-only** — shown disabled with an
explanatory note — since it's the account's sign-in identifier; there is no "change email" flow.
Saves go through `PATCH /auth/profile` (`get_current_user` dependency — must be signed in, always
edits your own account, there's no user-id parameter to spoof) and are also mirrored into
`farmStore.ts`'s local profile store so the dashboard greeting/sidebar/demo-farm naming (§6.7)
stay in sync without a page reload.

**Forgot / reset password** (`/forgot-password` → `/reset-password?token=...`):
- `POST /auth/forgot-password` always returns the same generic message regardless of whether the
  email is registered (same anti-enumeration principle as login, §6.2) — but no email is actually
  sent, because **this project has no email-sending service configured** (there's no SMTP/mailer
  in `app/integrations/`, unlike `WEATHER_API_KEY`/`SATELLITE_API_KEY`/`AI_API_KEY` which are at
  least reserved for future clients). Real delivery is a known gap — see §10.
- As a stand-in so the flow is actually testable/demoable end-to-end, when `ENVIRONMENT=development`
  the response includes a `dev_reset_token` field; the frontend shows this as a clickable dev-only
  link directly on the `/forgot-password` page, clearly labeled "Dev mode — no email service
  configured." **This field is never populated outside development** (`settings.ENVIRONMENT` gate
  in the router) — a production deployment must set `ENVIRONMENT=production` (or add a real mailer)
  before this endpoint goes live, or resetting a password becomes impossible for users.
- The reset token itself is a short-lived (30 min) JWT with `type: "password_reset"` — reusing the
  existing `create_token`/`decode_token` helpers in `core/security.py` rather than a new DB table.
  `POST /auth/reset-password` decodes it, checks the type claim, and calls `hash_password` +
  `UserRepository.set_password`.
- Verified end-to-end (backend `curl` + through the actual UI): register → forgot-password → follow
  the dev reset link → set a new password → old password correctly rejected, new password logs in.

### 6.7 Per-account demo data (not identical across every account)

Previously (documented in the `back_auth` version of this doc), every new real account started
with **zero** farms — an intentional "don't show fabricated data" decision. That's been changed:
every account (Google or email/password) that has no farms of their own now gets **one** fake demo
farm to look at instead of a blank dashboard, generated from `buildDemoFarmForUser()` in
`farmStore.ts`:
- The template (one of the two canonical farms, §4.2B) is picked **deterministically per user id**
  (a simple string hash, `hashString(userId) % DEFAULT_FARMS.length`) — stable across sessions for
  the same account, but not guaranteed distinct between any two accounts, since there are currently
  only two templates to choose from. A future improvement would be adding more templates so more
  accounts diverge (see §10).
- It's lightly personalized: renamed to `"<Farmer's Name>'s <Crop> Farm"` once they've set a name,
  and its `state`/`address` are overridden to match the farmer's own selected state if it differs
  from the template's.
- **Guests (signed out) still see the full two-farm canonical demo set** — that behavior is
  unchanged; this only affects what a *real, signed-in* account with no farms of its own sees.
- This is still fake/demo data, not real farm data — it exists purely so new accounts have
  something to explore; "Add your first farm" still works the normal way from there.

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
| `ENVIRONMENT` | Backend | `development` / `staging` / `production` — also gates whether `/auth/forgot-password` returns `dev_reset_token` (§6.6); never `development` in a real deployment |
| `DATABASE_URL` | Backend | Async SQLAlchemy/Postgres connection string (`postgresql+asyncpg://...`) |
| `FRONTEND_ORIGIN` | Backend | Sole allowed CORS origin |
| `WEATHER_API_KEY` / `SATELLITE_API_KEY` / `AI_API_KEY` | Backend | Reserved for future `app/integrations/` clients — unused today |
| `JWT_SECRET_KEY` | Backend | Signs JWTs — **must** be overridden outside local dev |
| `JWT_ALGORITHM` | Backend | Default `HS256` |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | Backend | Default `30` |
| `REFRESH_TOKEN_EXPIRE_DAYS` | Backend | Default `7` |
| `GOOGLE_CLIENT_ID` | Backend | Same value as `NEXT_PUBLIC_GOOGLE_CLIENT_ID` — verifies Google ID tokens |

---

## 8. Running it locally

**Database**: PostgreSQL with PostGIS running locally (e.g. via pgAdmin), a database + user
created, `DATABASE_URL` pointed at it in the root `.env`.

**Backend**:
```bash
cd backend
python -m venv venv && venv\Scripts\activate   # Windows
pip install -r requirements.txt
alembic upgrade head        # applies all users-table migrations, incl. phone/state/location
uvicorn app.main:app --reload --port 8000
```

**Backend tests**:
```bash
cd backend
pip install -r requirements.txt -r requirements-dev.txt
pytest        # 14 tests, async, in-memory SQLite — no Postgres needed
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
| Google-signup profile completion gate | ✅ Real — routes to `/profile?complete=1` until phone+state are set |
| Forgot / reset password | ✅ Real backend flow (JWT-based reset token) — ⚠️ no real email delivery; dev-only, see §6.6 |
| Per-account data isolation | ✅ Real — localStorage namespaced by user id |
| Per-account demo farm (not identical for every account) | ✅ Real — see §6.7; guests still see the full canonical demo set |
| Farms / Fields / Satellite / Weather / Irrigation / Yield data | ❌ Mock only — `farmStore.ts` localStorage demo data; no backend endpoints exist yet |
| KrishiBot AI chat | ❌ Mock only — via `mock-client.ts` |
| "Remember me" checkbox on login | ❌ UI only, not implemented (tokens always persist in localStorage regardless) |

---

## 10. Known gaps / natural next steps

- Merge `back_auth` and `profile_setup` into `main` once reviewed.
- Set a real `JWT_SECRET_KEY` before any non-local deployment.
- Add the production frontend origin to the Google OAuth client's authorized origins before
  deploying (currently only `http://localhost:3000` is authorized).
- **Add a real email service** (e.g. SES/SendGrid/Postmark) and wire it into
  `request_password_reset` in `auth_service.py` so `/auth/forgot-password` actually emails the
  reset link instead of relying on the dev-only `dev_reset_token` response field (§6.6). Also
  confirm `ENVIRONMENT` is never `development` in any deployed environment, since that's what
  currently gates that field.
- Build real backend endpoints for farms/fields/satellite/weather/yield, and a corresponding
  `real-client.ts` cutover (`NEXT_PUBLIC_USE_MOCKS=false`) — this is the largest remaining piece
  of backend work.
- Add email verification (registration currently trusts any email address given).
- Add more demo-farm templates (§6.7) — with only two templates, different accounts can land on
  the same one; more variety would make per-account demo data feel more distinct.
- Add authenticated route protection (currently `/dashboard` etc. are reachable without being
  logged in — they just show demo/guest data instead of redirecting to `/login`).
