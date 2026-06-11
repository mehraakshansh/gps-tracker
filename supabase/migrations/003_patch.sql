-- ================================================================
-- PATCH 003 — Fix schema gaps for BRCS v4
-- Safe to re-run (all IF NOT EXISTS / IF EXISTS guards)
-- ================================================================

-- Ensure zones table has 'active' column (not just 'is_active')
ALTER TABLE zones ADD COLUMN IF NOT EXISTS active BOOL DEFAULT true;
-- Backfill: if is_active column exists, copy values
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='zones' AND column_name='is_active') THEN
    UPDATE zones SET active = is_active WHERE active IS NULL;
  END IF;
END $$;

-- Add current_speed + current_heading to assets if missing
ALTER TABLE assets ADD COLUMN IF NOT EXISTS current_speed   FLOAT DEFAULT 0;
ALTER TABLE assets ADD COLUMN IF NOT EXISTS current_heading FLOAT DEFAULT 0;
ALTER TABLE assets ADD COLUMN IF NOT EXISTS fuel_pct        FLOAT DEFAULT 100;
ALTER TABLE assets ADD COLUMN IF NOT EXISTS ammo_pct        FLOAT DEFAULT 100;
ALTER TABLE assets ADD COLUMN IF NOT EXISTS crew_count      INT   DEFAULT 1;
ALTER TABLE assets ADD COLUMN IF NOT EXISTS speed_kmh       FLOAT DEFAULT 30;
ALTER TABLE assets ADD COLUMN IF NOT EXISTS alert_count     INT   DEFAULT 0;
ALTER TABLE assets ADD COLUMN IF NOT EXISTS threat_level    TEXT  DEFAULT 'GREEN';

-- Ensure callsign has a default so seed doesn't fail on NOT NULL
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name='assets' AND column_name='callsign'
      AND column_default IS NULL AND is_nullable='NO'
  ) THEN
    ALTER TABLE assets ALTER COLUMN callsign SET DEFAULT 'ASSET';
  END IF;
END $$;

-- simulator_state needs updated_at for upsert merges
ALTER TABLE simulator_state ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Seed default operation row needed by simulate function
INSERT INTO operations (id, name, codename, op_type, status, priority, objective_lat, objective_lon)
VALUES ('00000000-0000-0000-0000-000000000001','Default Simulation','OP-DEFAULT','STRIKE','PLANNING','HIGH',28.626,77.228)
ON CONFLICT DO NOTHING;

-- Set all zones active=true to make them visible to tick
UPDATE zones SET active = true WHERE active IS NULL OR active = false;
