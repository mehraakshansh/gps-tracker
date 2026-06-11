-- ================================================================
-- BHARAT RAKSHA COMMAND SYSTEM (BRCS)
-- Military Asset Tracking & Operations Platform
-- Indian Armed Forces Structure
-- ================================================================

-- ── FORMATIONS (Army/Navy/Air Force Hierarchy) ─────────────────
CREATE TABLE formations (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  code        TEXT NOT NULL UNIQUE,        -- e.g. "1 CORPS", "21 STRIKE DIV"
  type        TEXT NOT NULL,               -- COMMAND|CORPS|DIVISION|BRIGADE|BATTALION|COMPANY|PLATOON|SECTION
  service     TEXT NOT NULL DEFAULT 'ARMY', -- ARMY|NAVY|AIR_FORCE|MARINES|SPECIAL_FORCES
  parent_id   UUID REFERENCES formations(id),
  commander   TEXT,
  strength    INT  DEFAULT 0,
  status      TEXT DEFAULT 'ACTIVE',       -- ACTIVE|ALERT|ENGAGED|STANDBY
  color       TEXT DEFAULT '#22c55e',
  lat         FLOAT,
  lon         FLOAT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ── ASSETS (All military hardware + personnel) ─────────────────
CREATE TABLE assets (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name            TEXT NOT NULL,
  callsign        TEXT NOT NULL UNIQUE,
  asset_type      TEXT NOT NULL,  -- TANK|APC|HELICOPTER|FIGHTER_JET|SOLDIER|TRUCK|ARTILLERY|NAVAL_VESSEL|UAV|SUBMARINE|etc
  category        TEXT NOT NULL,  -- ARMOUR|INFANTRY|AVIATION|ARTILLERY|LOGISTICS|SIGNALS|ENGINEER|SPECIAL_FORCES
  service         TEXT NOT NULL DEFAULT 'ARMY',
  formation_id    UUID REFERENCES formations(id),
  icon            TEXT NOT NULL,
  status          TEXT DEFAULT 'OPERATIONAL', -- OPERATIONAL|ENGAGED|DAMAGED|DESTROYED|MAINTENANCE|MISSING
  fuel_pct        FLOAT DEFAULT 100,
  ammo_pct        FLOAT DEFAULT 100,
  crew_count      INT   DEFAULT 1,
  speed_kmh       FLOAT DEFAULT 30,
  alert_count     INT   DEFAULT 0,
  current_lat     FLOAT,
  current_lon     FLOAT,
  current_speed   FLOAT,
  current_heading FLOAT,
  threat_level    TEXT  DEFAULT 'GREEN',  -- GREEN|YELLOW|ORANGE|RED
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ── ZONES (Geo-fences with military context) ───────────────────
CREATE TABLE zones (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name           TEXT NOT NULL,
  zone_type      TEXT NOT NULL,  -- SAFE|HOSTILE|RESTRICTED|FOB|OBJECTIVE|MINEFIELD|CIVILIAN|NO_FLY|SUPPLY
  center_lat     FLOAT NOT NULL,
  center_lon     FLOAT NOT NULL,
  radius_meters  FLOAT NOT NULL,
  color          TEXT  DEFAULT '#3B82F6',
  threat_level   TEXT  DEFAULT 'GREEN',
  active         BOOL  DEFAULT true,
  created_at     TIMESTAMPTZ DEFAULT NOW()
);

-- ── ASSET ZONE STATES ──────────────────────────────────────────
CREATE TABLE asset_zone_states (
  asset_id    UUID NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
  zone_id     UUID NOT NULL REFERENCES zones(id)  ON DELETE CASCADE,
  state       TEXT NOT NULL DEFAULT 'UNKNOWN',
  updated_at  TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (asset_id, zone_id)
);

-- ── ALERTS ────────────────────────────────────────────────────
CREATE TABLE alerts (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id    UUID REFERENCES assets(id) ON DELETE CASCADE,
  asset_name  TEXT,
  asset_icon  TEXT,
  zone_id     UUID REFERENCES zones(id) ON DELETE SET NULL,
  zone_name   TEXT,
  event_type  TEXT NOT NULL,  -- ENTERED|EXITED|THREAT_DETECTED|AMMO_LOW|FUEL_LOW|CONTACT|DESTROYED
  severity    TEXT NOT NULL,  -- INFO|WARNING|CRITICAL|EMERGENCY
  message     TEXT,
  lat         FLOAT,
  lon         FLOAT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ── ARMORY ─────────────────────────────────────────────────────
CREATE TABLE armory (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT NOT NULL,
  item_type     TEXT NOT NULL,  -- WEAPON|AMMUNITION|EQUIPMENT|VEHICLE|RATION|MEDICAL|EXPLOSIVE
  category      TEXT NOT NULL,
  formation_id  UUID REFERENCES formations(id),
  quantity      INT  NOT NULL DEFAULT 0,
  unit          TEXT DEFAULT 'units',
  min_threshold INT  DEFAULT 10,
  status        TEXT DEFAULT 'AVAILABLE',  -- AVAILABLE|DEPLOYED|MAINTENANCE|EXPENDED
  location_lat  FLOAT,
  location_lon  FLOAT,
  last_audit    TIMESTAMPTZ DEFAULT NOW(),
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ── ARMORY MOVEMENTS (in/out log) ─────────────────────────────
CREATE TABLE armory_movements (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  armory_id     UUID NOT NULL REFERENCES armory(id) ON DELETE CASCADE,
  asset_id      UUID REFERENCES assets(id) ON DELETE SET NULL,
  movement_type TEXT NOT NULL,  -- ISSUE|RETURN|TRANSFER|AUDIT|LOSS|RESUPPLY
  quantity      INT  NOT NULL,
  authorized_by TEXT NOT NULL,
  reason        TEXT,
  verified      BOOL DEFAULT false,
  lat           FLOAT,
  lon           FLOAT,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ── OPERATIONS ────────────────────────────────────────────────
CREATE TABLE operations (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name            TEXT NOT NULL,
  codename        TEXT NOT NULL UNIQUE,
  op_type         TEXT NOT NULL,  -- STRIKE|RECON|RESCUE|SUPPLY|PATROL|AMBUSH|SIEGE|AIRSTRIKE|NAVAL
  status          TEXT DEFAULT 'PLANNING',  -- PLANNING|ACTIVE|PAUSED|COMPLETE|ABORTED
  priority        TEXT DEFAULT 'HIGH',      -- LOW|MEDIUM|HIGH|CRITICAL
  commander       TEXT,
  formation_ids   UUID[],
  asset_ids       UUID[],
  objective_lat   FLOAT,
  objective_lon   FLOAT,
  start_time      TIMESTAMPTZ,
  end_time        TIMESTAMPTZ,
  -- Risk Assessment
  risk_score      FLOAT DEFAULT 0,
  est_casualties  INT   DEFAULT 0,
  est_cost_crore  FLOAT DEFAULT 0,  -- in Indian Crore INR
  civilian_risk   TEXT  DEFAULT 'LOW',
  success_prob    FLOAT DEFAULT 0.5,
  -- Simulation result
  sim_result      JSONB,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ── PATHFINDING REQUESTS/RESULTS ──────────────────────────────
CREATE TABLE pathfind_results (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id      UUID REFERENCES assets(id),
  algorithm     TEXT NOT NULL,  -- ASTAR|DIJKSTRA|BFS|DFS|FLOYD_WARSHALL|PRIMS|KRUSKALS|AO_STAR
  start_lat     FLOAT,
  start_lon     FLOAT,
  end_lat       FLOAT,
  end_lon       FLOAT,
  waypoints     JSONB,   -- computed path
  distance_km   FLOAT,
  time_min      FLOAT,
  threat_score  FLOAT,
  nodes_visited INT,
  compute_ms    FLOAT,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ── ROUTE WAYPOINTS ───────────────────────────────────────────
CREATE TABLE route_waypoints (
  id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id  UUID NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
  seq       INT  NOT NULL,
  lat       FLOAT NOT NULL,
  lon       FLOAT NOT NULL
);

-- ── SIMULATOR STATE ───────────────────────────────────────────
CREATE TABLE simulator_state (
  asset_id    UUID PRIMARY KEY REFERENCES assets(id) ON DELETE CASCADE,
  step_idx    INT   NOT NULL DEFAULT 0,
  t_progress  FLOAT NOT NULL DEFAULT 0.0,
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ── ENABLE REALTIME ───────────────────────────────────────────
ALTER PUBLICATION supabase_realtime ADD TABLE alerts;
ALTER PUBLICATION supabase_realtime ADD TABLE assets;
ALTER PUBLICATION supabase_realtime ADD TABLE operations;

-- ── ENABLE RLS ────────────────────────────────────────────────
ALTER TABLE formations       ENABLE ROW LEVEL SECURITY;
ALTER TABLE assets           ENABLE ROW LEVEL SECURITY;
ALTER TABLE zones            ENABLE ROW LEVEL SECURITY;
ALTER TABLE asset_zone_states ENABLE ROW LEVEL SECURITY;
ALTER TABLE alerts           ENABLE ROW LEVEL SECURITY;
ALTER TABLE armory           ENABLE ROW LEVEL SECURITY;
ALTER TABLE armory_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE operations       ENABLE ROW LEVEL SECURITY;
ALTER TABLE pathfind_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE route_waypoints  ENABLE ROW LEVEL SECURITY;
ALTER TABLE simulator_state  ENABLE ROW LEVEL SECURITY;

CREATE POLICY "svc_formations"        ON formations        FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "svc_assets"            ON assets            FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "svc_zones"             ON zones             FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "svc_asset_zone_states" ON asset_zone_states FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "svc_alerts"            ON alerts            FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "svc_armory"            ON armory            FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "svc_armory_movements"  ON armory_movements  FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "svc_operations"        ON operations        FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "svc_pathfind"          ON pathfind_results  FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "svc_waypoints"         ON route_waypoints   FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "svc_simstate"          ON simulator_state   FOR ALL USING (true) WITH CHECK (true);

