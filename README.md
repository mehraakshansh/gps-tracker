# 📡 GPS Geo-Fence Tracker — Full Stack

> React (Vercel) + Supabase Edge Functions + Postgres  
> Real-time asset monitoring with persistent geo-fence breach alerts

---

## Architecture

```
┌─────────────────────────────────────────────┐
│           FRONTEND  (React + Vite)           │
│   MapView · AssetCards · AlertFeed · Fences  │
│        Deployed on Vercel (HTTPS)            │
└──────────────────┬──────────────────────────┘
                   │  fetch /tick every 1s
                   │  fetch /fences (POST/DELETE)
                   │  fetch /alerts (GET/DELETE)
┌──────────────────▼──────────────────────────┐
│       SUPABASE EDGE FUNCTIONS (Deno)         │
│  /tick    — simulate + geo-fence engine      │
│  /fences  — CRUD for fence zones             │
│  /assets  — list assets + zone status        │
│  /alerts  — list / clear alerts              │
└──────────────────┬──────────────────────────┘
                   │  SQL queries
┌──────────────────▼──────────────────────────┐
│          SUPABASE POSTGRES                   │
│  assets · fences · alerts                   │
│  asset_zone_states · route_waypoints        │
│  simulator_state                            │
└─────────────────────────────────────────────┘
```

## OOP Design (Edge Function — Deno/TypeScript)

| Concept | Implementation |
|---------|---------------|
| `GeoFence` | Haversine containment check per fence row |
| `Asset` state machine | `asset_zone_states` table — IN/OUT/UNKNOWN per asset+fence |
| `RouteSimulator` | `simulator_state` + `route_waypoints` — interpolates between waypoints at configurable speed |
| Observer / alerts | Transition detection in `/tick` fires INSERT into `alerts` |

---

## Deploy in 15 minutes

### Step 1 — Create Supabase project

1. Go to [supabase.com](https://supabase.com) → New project
2. Note your **Project URL** and **anon key** (Settings → API)
3. Note your **service_role key** (Settings → API → Secret)

### Step 2 — Run the migration

In Supabase dashboard → SQL Editor → paste contents of  
`supabase/migrations/001_init.sql` → Run

### Step 3 — Deploy Edge Functions

```bash
npm install -g supabase

supabase login
supabase link --project-ref YOUR_PROJECT_REF

# Deploy all four functions
supabase functions deploy tick
supabase functions deploy fences
supabase functions deploy assets
supabase functions deploy alerts

# Set the service role secret (needed inside Edge Functions)
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

### Step 4 — Deploy frontend to Vercel

```bash
cd frontend

# Create env file (never commit this)
echo "VITE_SUPABASE_URL=https://xxxx.supabase.co"      > .env.local
echo "VITE_SUPABASE_ANON_KEY=eyJ..."                  >> .env.local

# Push to GitHub
git init && git add . && git commit -m "feat: GPS tracker"
git remote add origin https://github.com/YOUR_USERNAME/gps-tracker-frontend.git
git push -u origin main
```

Then on [vercel.com/new](https://vercel.com/new):
- Import the frontend repo
- Add **Environment Variables**:  
  `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`
- Click **Deploy** → live in ~30 seconds ✅

### Step 5 — Open your Vercel URL

The tracker is live. Assets move in real-time, alerts persist in Postgres,
fences can be added/deleted from the UI.

---

## Local dev

```bash
cd frontend
npm install
cp .env.local.example .env.local   # fill in your keys
npm run dev    # → http://localhost:5173
```

---

*Akshansh Mehra — Portfolio project demonstrating real-time systems, OOP design patterns, geo-spatial algorithms, and full-stack deployment.*
