-- Sprint 7: Scenario Editor
-- Run this in Supabase Dashboard > SQL Editor

CREATE TABLE IF NOT EXISTS scenarios (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  name            text        NOT NULL,
  description     text        DEFAULT '',
  scenario_type   text        DEFAULT 'PATROL',
  difficulty      text        DEFAULT 'MEDIUM',
  duration_min    int         DEFAULT 30,
  created_by      text        DEFAULT '',
  asset_count     int         DEFAULT 0,
  zone_count      int         DEFAULT 0,
  assets_snapshot jsonb,
  zones_snapshot  jsonb,
  created_at      timestamptz DEFAULT now()
);

-- Enable RLS (allow all for now — tighten per org later)
ALTER TABLE scenarios ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "scenarios_allow_all" ON scenarios;
CREATE POLICY "scenarios_allow_all" ON scenarios FOR ALL USING (true) WITH CHECK (true);
