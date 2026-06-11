-- ============================================================
-- GPS Geo-Fence Tracker — Supabase Schema
-- ============================================================

-- ASSETS table
CREATE TABLE IF NOT EXISTS assets (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT NOT NULL,
  asset_type    TEXT NOT NULL DEFAULT 'vehicle',
  icon          TEXT NOT NULL DEFAULT '🚛',
  speed_kmh     FLOAT NOT NULL DEFAULT 30,
  alert_count   INT  NOT NULL DEFAULT 0,
  current_lat   FLOAT,
  current_lon   FLOAT,
  current_speed FLOAT,
  current_heading FLOAT,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- FENCES table
CREATE TABLE IF NOT EXISTS fences (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name           TEXT NOT NULL,
  center_lat     FLOAT NOT NULL,
  center_lon     FLOAT NOT NULL,
  radius_meters  FLOAT NOT NULL,
  color          TEXT NOT NULL DEFAULT '#3B82F6',
  created_at     TIMESTAMPTZ DEFAULT NOW()
);

-- ASSET_ZONE_STATES table — per-asset per-fence IN/OUT state
CREATE TABLE IF NOT EXISTS asset_zone_states (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id   UUID NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
  fence_id   UUID NOT NULL REFERENCES fences(id) ON DELETE CASCADE,
  state      TEXT NOT NULL DEFAULT 'UNKNOWN', -- IN | OUT | UNKNOWN
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(asset_id, fence_id)
);

-- ALERTS table
CREATE TABLE IF NOT EXISTS alerts (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id    UUID NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
  asset_name  TEXT NOT NULL,
  asset_icon  TEXT NOT NULL,
  fence_id    UUID NOT NULL REFERENCES fences(id) ON DELETE CASCADE,
  fence_name  TEXT NOT NULL,
  event_type  TEXT NOT NULL, -- ENTERED | EXITED
  severity    TEXT NOT NULL, -- info | critical
  lat         FLOAT,
  lon         FLOAT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ROUTE_WAYPOINTS table — stores simulation routes
CREATE TABLE IF NOT EXISTS route_waypoints (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id   UUID NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
  seq        INT  NOT NULL,
  lat        FLOAT NOT NULL,
  lon        FLOAT NOT NULL
);

-- SIMULATOR_STATE — tracks interpolation progress per asset
CREATE TABLE IF NOT EXISTS simulator_state (
  asset_id   UUID PRIMARY KEY REFERENCES assets(id) ON DELETE CASCADE,
  step_idx   INT   NOT NULL DEFAULT 0,
  t_progress FLOAT NOT NULL DEFAULT 0.0,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable Realtime on alerts and assets
ALTER PUBLICATION supabase_realtime ADD TABLE alerts;
ALTER PUBLICATION supabase_realtime ADD TABLE assets;

-- ── Seed data ─────────────────────────────────────────────────
INSERT INTO assets (id, name, asset_type, icon, speed_kmh) VALUES
  ('a1000000-0000-0000-0000-000000000001', 'Truck Alpha', 'truck', '🚛', 28),
  ('a1000000-0000-0000-0000-000000000002', 'Bike Beta',   'bike',  '🏍️', 45),
  ('a1000000-0000-0000-0000-000000000003', 'Van Gamma',   'van',   '🚐', 22)
ON CONFLICT DO NOTHING;

INSERT INTO fences (id, name, center_lat, center_lon, radius_meters, color) VALUES
  ('f1000000-0000-0000-0000-000000000001', 'HQ Zone',          28.6180, 77.2100, 800,  '#3B82F6'),
  ('f1000000-0000-0000-0000-000000000002', 'Restricted Area',  28.6260, 77.2200, 400,  '#EF4444'),
  ('f1000000-0000-0000-0000-000000000003', 'Depot',            28.6070, 77.2240, 350,  '#10B981')
ON CONFLICT DO NOTHING;

-- Seed waypoints for Truck Alpha
INSERT INTO route_waypoints (asset_id, seq, lat, lon) VALUES
  ('a1000000-0000-0000-0000-000000000001', 0, 28.6139, 77.2090),
  ('a1000000-0000-0000-0000-000000000001', 1, 28.6180, 77.2150),
  ('a1000000-0000-0000-0000-000000000001', 2, 28.6220, 77.2200),
  ('a1000000-0000-0000-0000-000000000001', 3, 28.6260, 77.2180),
  ('a1000000-0000-0000-0000-000000000001', 4, 28.6300, 77.2120),
  ('a1000000-0000-0000-0000-000000000001', 5, 28.6280, 77.2050),
  ('a1000000-0000-0000-0000-000000000001', 6, 28.6230, 77.2010),
  ('a1000000-0000-0000-0000-000000000001', 7, 28.6180, 77.2020)
ON CONFLICT DO NOTHING;

-- Seed waypoints for Bike Beta
INSERT INTO route_waypoints (asset_id, seq, lat, lon) VALUES
  ('a1000000-0000-0000-0000-000000000002', 0, 28.6050, 77.2200),
  ('a1000000-0000-0000-0000-000000000002', 1, 28.6080, 77.2280),
  ('a1000000-0000-0000-0000-000000000002', 2, 28.6120, 77.2350),
  ('a1000000-0000-0000-0000-000000000002', 3, 28.6160, 77.2300),
  ('a1000000-0000-0000-0000-000000000002', 4, 28.6140, 77.2230),
  ('a1000000-0000-0000-0000-000000000002', 5, 28.6100, 77.2180)
ON CONFLICT DO NOTHING;

-- Seed waypoints for Van Gamma
INSERT INTO route_waypoints (asset_id, seq, lat, lon) VALUES
  ('a1000000-0000-0000-0000-000000000003', 0, 28.6200, 77.1950),
  ('a1000000-0000-0000-0000-000000000003', 1, 28.6240, 77.2000),
  ('a1000000-0000-0000-0000-000000000003', 2, 28.6270, 77.2070),
  ('a1000000-0000-0000-0000-000000000003', 3, 28.6250, 77.2130),
  ('a1000000-0000-0000-0000-000000000003', 4, 28.6210, 77.2100),
  ('a1000000-0000-0000-0000-000000000003', 5, 28.6190, 77.2040)
ON CONFLICT DO NOTHING;

-- Init simulator state
INSERT INTO simulator_state (asset_id, step_idx, t_progress) VALUES
  ('a1000000-0000-0000-0000-000000000001', 0, 0),
  ('a1000000-0000-0000-0000-000000000002', 0, 0),
  ('a1000000-0000-0000-0000-000000000003', 0, 0)
ON CONFLICT DO NOTHING;
