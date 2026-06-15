-- ================================================================
-- 010_war_simulator.sql
-- Two-army war simulator: combat stats, zone capture, match state
-- ================================================================

-- ── 1. Combat stats on assets ────────────────────────────────────────────────
ALTER TABLE assets ADD COLUMN IF NOT EXISTS faction TEXT NOT NULL DEFAULT 'BRAVO'
  CHECK (faction IN ('BRAVO', 'ALPHA', 'NEUTRAL'));

ALTER TABLE assets ADD COLUMN IF NOT EXISTS hp            INTEGER  NOT NULL DEFAULT 100;
ALTER TABLE assets ADD COLUMN IF NOT EXISTS max_hp        INTEGER  NOT NULL DEFAULT 100;
ALTER TABLE assets ADD COLUMN IF NOT EXISTS attack_power  INTEGER  NOT NULL DEFAULT 10;
ALTER TABLE assets ADD COLUMN IF NOT EXISTS range_km      NUMERIC  NOT NULL DEFAULT 5;
ALTER TABLE assets ADD COLUMN IF NOT EXISTS detection_radius_km NUMERIC NOT NULL DEFAULT 10;
ALTER TABLE assets ADD COLUMN IF NOT EXISTS is_destroyed  BOOLEAN  NOT NULL DEFAULT FALSE;

-- Tag all pre-existing rows as BRAVO
UPDATE assets SET faction = 'BRAVO' WHERE faction = 'BRAVO'; -- no-op, ensures constraint passes

-- ── 2. Zone capture mechanics ────────────────────────────────────────────────
ALTER TABLE zones ADD COLUMN IF NOT EXISTS controlled_by       TEXT    NOT NULL DEFAULT 'NEUTRAL'
  CHECK (controlled_by IN ('BRAVO', 'ALPHA', 'NEUTRAL'));
ALTER TABLE zones ADD COLUMN IF NOT EXISTS capture_ticks_bravo  INTEGER NOT NULL DEFAULT 0;
ALTER TABLE zones ADD COLUMN IF NOT EXISTS capture_ticks_alpha  INTEGER NOT NULL DEFAULT 0;
ALTER TABLE zones ADD COLUMN IF NOT EXISTS capture_threshold    INTEGER NOT NULL DEFAULT 10;

-- ── 3. combat_log — record every engagement ──────────────────────────────────
CREATE TABLE IF NOT EXISTS combat_log (
  id                UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  attacker_id       TEXT    NOT NULL,
  attacker_faction  TEXT    NOT NULL,
  attacker_callsign TEXT,
  defender_id       TEXT    NOT NULL,
  defender_faction  TEXT    NOT NULL,
  defender_callsign TEXT,
  damage            INTEGER NOT NULL,
  defender_hp_before INTEGER NOT NULL,
  defender_hp_after  INTEGER NOT NULL,
  is_kill           BOOLEAN NOT NULL DEFAULT FALSE,
  lat               NUMERIC,
  lon               NUMERIC,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── 4. match_state — single-row game state ───────────────────────────────────
CREATE TABLE IF NOT EXISTS match_state (
  id                        INTEGER PRIMARY KEY DEFAULT 1,
  status                    TEXT    NOT NULL DEFAULT 'ACTIVE'
    CHECK (status IN ('ACTIVE', 'BRAVO_WINS', 'ALPHA_WINS', 'DRAW')),
  bravo_score               INTEGER NOT NULL DEFAULT 0,
  alpha_score               INTEGER NOT NULL DEFAULT 0,
  bravo_assets_destroyed    INTEGER NOT NULL DEFAULT 0,
  alpha_assets_destroyed    INTEGER NOT NULL DEFAULT 0,
  zones_controlled_bravo    INTEGER NOT NULL DEFAULT 0,
  zones_controlled_alpha    INTEGER NOT NULL DEFAULT 0,
  started_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ended_at                  TIMESTAMPTZ
);

INSERT INTO match_state (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

-- ── 5. RLS + grants ──────────────────────────────────────────────────────────
ALTER TABLE combat_log  ENABLE ROW LEVEL SECURITY;
ALTER TABLE match_state ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_read_combat_log"    ON combat_log;
DROP POLICY IF EXISTS "service_all_combat_log"  ON combat_log;
DROP POLICY IF EXISTS "anon_read_match_state"   ON match_state;
DROP POLICY IF EXISTS "service_all_match_state" ON match_state;

CREATE POLICY "anon_read_combat_log"   ON combat_log  FOR SELECT USING (true);
CREATE POLICY "service_all_combat_log" ON combat_log  FOR ALL    USING (true);
CREATE POLICY "anon_read_match_state"  ON match_state FOR SELECT USING (true);
CREATE POLICY "service_all_match_state" ON match_state FOR ALL   USING (true);

GRANT SELECT       ON combat_log  TO anon, authenticated;
GRANT ALL          ON combat_log  TO service_role;
GRANT SELECT       ON match_state TO anon, authenticated;
GRANT ALL          ON match_state TO service_role;

-- ── 6. Realtime publications ─────────────────────────────────────────────────
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE combat_log;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE match_state;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
