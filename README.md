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
├── backend/                # Backend service (Python / FastAPI — future)
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

All environment variables are documented in [`.env.example`](.env.example).

| Variable | Required | Description |
| :--- | :--- | :--- |
| `NEXT_PUBLIC_MAPBOX_TOKEN` | ✅ Yes | Mapbox token for interactive maps and field drawing |
| `NEXT_PUBLIC_USE_MOCKS` | No (default: `true`) | `true` = use mock data, no backend needed |
| `NEXT_PUBLIC_API_URL` | No | Backend API URL if running a real backend |
| `PORT` | No (backend only) | Port the Python backend runs on |
| `ENVIRONMENT` | No (backend only) | `development`, `staging`, or `production` |

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

## Backend (Coming Soon)

The `backend/` folder is prepared for a Python FastAPI service. If you need to run it:
- Install Python 3.10+
- Create a virtual environment: `python -m venv venv`
- Activate it: `venv\Scripts\activate` (Windows) or `source venv/bin/activate` (Mac/Linux)
- Install packages: `pip install -r backend/requirements.txt`
