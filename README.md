# FasalSetu — Smart Farming Intelligence

A modern web application that helps farmers monitor their fields, get AI-powered crop advice, view satellite imagery, and receive weather alerts — all in one place.

**Tech Stack:** Next.js 14 · TypeScript · Tailwind CSS · shadcn/ui · Mapbox GL · TanStack Query

---

## Project Structure

```
farming/
├── frontend/               # Next.js 14 web application (this is where you work)
│   ├── src/
│   │   ├── views/          # ✅ Page components — edit these to change page content
│   │   ├── app/            # Next.js routing (don't edit unless adding a new route)
│   │   ├── components/     # Shared UI pieces (Navbar, Footer, buttons, etc.)
│   │   └── lib/            # Hooks, API clients, language settings
│   └── public/             # Images and static assets
├── backend/                # Python / FastAPI backend service
│   ├── app/
│   │   ├── core/            # config.py (settings) and database.py (async engine/session)
│   │   ├── models/          # SQLAlchemy ORM models
│   │   ├── schemas/         # Pydantic request/response schemas
│   │   ├── repositories/    # Data-access layer (DB queries)
│   │   ├── integrations/    # External API clients (weather, satellite, AI, ...)
│   │   ├── services/        # Business logic, orchestrates repositories/integrations
│   │   ├── routers/         # FastAPI route definitions (e.g. health.py)
│   │   └── main.py          # FastAPI app instance, CORS, router registration
│   └── alembic/             # Async database migrations
├── .env.example            # ← Environment variable template (start here)
└── README.md               # This file
```

### Pages Quick Reference

| Page | URL | Edit this file |
| :--- | :--- | :--- |
| Home | `/` | `frontend/src/views/HomePage.tsx` |
| Dashboard | `/dashboard` | `frontend/src/views/DashboardPage.tsx` |
| KrishiBot AI | `/ai-chat` | `frontend/src/views/AiChatPage.tsx` |
| Satellite Maps | `/satellite` | `frontend/src/views/SatellitePage.tsx` |
| Weather & Alerts | `/weather` | `frontend/src/views/WeatherPage.tsx` |
| Features | `/features` | `frontend/src/views/FeaturesPage.tsx` |
| Help Center | `/help` | `frontend/src/views/HelpPage.tsx` |
| Login | `/login` | `frontend/src/views/LoginPage.tsx` |
| Register | `/register` | `frontend/src/views/RegisterPage.tsx` |
| My Farms | `/farms` | `frontend/src/views/FarmsPage.tsx` |

---

## Getting Started (For New Team Members)

### Step 1 — Prerequisites

Make sure these are installed on your machine:

| Tool | Required Version | Check with |
| :--- | :--- | :--- |
| **Node.js** | v18.17+ or v20+ (LTS) | `node -v` |
| **npm** | v9+ or v10+ | `npm -v` |
| **Git** | Any modern version | `git --version` |

### Step 2 — Clone the Repository

```bash
git clone https://github.com/<your-username>/farming.git
cd farming
```

### Step 3 — Set Up Environment Variables

Copy the template and fill in your values:

**Windows (PowerShell):**
```powershell
Copy-Item .env.example frontend\.env.local
```

**Mac / Linux:**
```bash
cp .env.example frontend/.env.local
```

Then open `frontend/.env.local` and set your **Mapbox token** (the only value you need to change to get started). Get a free token at [account.mapbox.com](https://account.mapbox.com/).

```env
NEXT_PUBLIC_MAPBOX_TOKEN=pk.your_actual_token_here
```

> Leave `NEXT_PUBLIC_USE_MOCKS=true` if you don't have a backend running yet — the app works fully with mock data.

### Step 4 — Install Dependencies

```bash
cd frontend
npm install
```

### Step 5 — Run the App

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser. That's it!

---

## Useful Commands

Run these from inside the `frontend/` folder:

| Command | What it does |
| :--- | :--- |
| `npm run dev` | Start local development server on port 3000 |
| `npm run build` | Build production bundle |
| `npm run start` | Serve the production build |
| `npm run lint` | Check code quality with ESLint |

---

## Environment Variables Reference

Frontend variables are documented in [`.env.example`](.env.example) and go in `frontend/.env.local`.
Backend variables are also in [`.env.example`](.env.example) and go in a `.env` file at the **project root**.

| Variable | Required | Description |
| :--- | :--- | :--- |
| `NEXT_PUBLIC_MAPBOX_TOKEN` | ✅ Yes | Mapbox token for interactive maps and field drawing |
| `NEXT_PUBLIC_USE_MOCKS` | No (default: `true`) | `true` = use mock data, no backend needed |
| `NEXT_PUBLIC_API_URL` | No | Backend API URL if running a real backend |
| `PORT` | No (backend only) | Port the Python backend runs on |
| `ENVIRONMENT` | No (backend only) | `development`, `staging`, or `production` |
| `DATABASE_URL` | ✅ Yes (backend only) | Async SQLAlchemy connection string, e.g. `postgresql+asyncpg://user:pass@host:5432/db` |
| `FRONTEND_ORIGIN` | No (backend only, default: `http://localhost:3000`) | The one origin allowed by backend CORS |
| `WEATHER_API_KEY` / `SATELLITE_API_KEY` / `AI_API_KEY` | No (backend only) | Keys for external services used in `backend/app/integrations/` |

---

## Troubleshooting

**Map is blank or shows an error:**
→ Check that `NEXT_PUBLIC_MAPBOX_TOKEN` is correctly set in `frontend/.env.local`.

**Port 3000 already in use:**
```bash
npm run dev -- -p 3001
```

**Module not found / something broken after a pull:**
```bash
cd frontend
rm -rf node_modules .next
npm install
```

---

## Backend

`backend/` is a FastAPI service with a layered structure:

```
backend/app/
├── core/           # config.py (pydantic-settings) and database.py (async engine + session)
├── models/         # SQLAlchemy ORM models
├── schemas/        # Pydantic request/response schemas
├── repositories/   # Data-access layer
├── integrations/   # External API clients (weather, satellite, AI, ...)
├── services/       # Business logic
├── routers/        # FastAPI routes (e.g. GET /health)
└── main.py         # App instance, CORS, router registration
```

### Setup

1. Install Python 3.10+
2. Copy the env template to the project root and fill in `DATABASE_URL` (and any API keys you have):
   ```bash
   # from the project root
   cp .env.example .env        # Mac/Linux
   Copy-Item .env.example .env # Windows PowerShell
   ```
3. Create a virtual environment and install packages:
   ```bash
   cd backend
   python -m venv venv
   venv\Scripts\activate        # Windows
   source venv/bin/activate     # Mac/Linux
   pip install -r requirements.txt
   ```
4. Run database migrations:
   ```bash
   alembic upgrade head
   ```
5. Start the dev server:
   ```bash
   uvicorn app.main:app --reload
   ```
6. Check it's alive: [http://localhost:8000/health](http://localhost:8000/health)

### Adding a database migration

After changing/adding a model in `app/models/`, generate and apply a migration:

```bash
alembic revision --autogenerate -m "describe the change"
alembic upgrade head
```

### CORS

`main.py` only allows requests from `FRONTEND_ORIGIN` (default `http://localhost:3000`) — never `*`. Set `FRONTEND_ORIGIN` in `.env` if your frontend runs elsewhere.
