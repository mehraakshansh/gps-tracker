-- ─────────────────────────────────────────────────────────────────────────────
-- 007: Convoys + Audit Logs + KPI snapshots + Rate limiting
-- Run: supabase db push
-- ─────────────────────────────────────────────────────────────────────────────

-- ── Convoy table ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS convoys (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name            TEXT        NOT NULL,
  description     TEXT,
  status          TEXT        NOT NULL DEFAULT 'PLANNED',
  -- PLANNED | EN_ROUTE | COMPLETED | COMPROMISED | CANCELLED | HALTED
  route_waypoints JSONB       NOT NULL DEFAULT '[]',
  asset_ids       TEXT[]      NOT NULL DEFAULT '{}',
  scheduled_at    TIMESTAMPTZ,
  started_at      TIMESTAMPTZ,
  completed_at    TIMESTAMPTZ,
  repeat_type     TEXT        NOT NULL DEFAULT 'NONE',
  -- NONE | DAILY | WEEKLY
  priority        TEXT        NOT NULL DEFAULT 'NORMAL',
  -- LOW | NORMAL | HIGH | CRITICAL
  commander       TEXT,
  notes           TEXT,
  created_by_uid  TEXT,
  created_by_email TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Audit logs ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS audit_logs (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_uid      TEXT,
  user_email    TEXT,
  action        TEXT        NOT NULL,
  resource      TEXT,
  resource_id   TEXT,
  details       JSONB       NOT NULL DEFAULT '{}',
  ip_address    TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Rate limit counters (per user per minute) ─────────────────────────────────
CREATE TABLE IF NOT EXISTS rate_limits (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_uid     TEXT        NOT NULL,
  window_start TIMESTAMPTZ NOT NULL DEFAULT date_trunc('minute', NOW()),
  call_count   INT         NOT NULL DEFAULT 1,
  UNIQUE(user_uid, window_start)
);

-- ── KPI snapshots ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS kpi_snapshots (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  snapshot_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  active_users   INT         NOT NULL DEFAULT 0,
  total_assets   INT         NOT NULL DEFAULT 0,
  active_alerts  INT         NOT NULL DEFAULT 0,
  convoys_active INT         NOT NULL DEFAULT 0,
  api_calls_1h   INT         NOT NULL DEFAULT 0
);

-- ── Session tracking ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS user_sessions (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_uid     TEXT        NOT NULL,
  user_email   TEXT,
  login_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  logout_at    TIMESTAMPTZ,
  ip_address   TEXT,
  user_agent   TEXT,
  is_active    BOOLEAN     NOT NULL DEFAULT TRUE
);

-- ── Indexes ───────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_audit_user    ON audit_logs(user_uid, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_action  ON audit_logs(action, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_convoy_status ON convoys(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_rate_limit    ON rate_limits(user_uid, window_start);
CREATE INDEX IF NOT EXISTS idx_session_user  ON user_sessions(user_uid, login_at DESC);

-- ── Trigger: auto-update convoys.updated_at ───────────────────────────────────
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS convoy_updated_at ON convoys;
CREATE TRIGGER convoy_updated_at
  BEFORE UPDATE ON convoys
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ── RLS: enable on all new tables ─────────────────────────────────────────────
ALTER TABLE convoys        ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs     ENABLE ROW LEVEL SECURITY;
ALTER TABLE rate_limits    ENABLE ROW LEVEL SECURITY;
ALTER TABLE kpi_snapshots  ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_sessions  ENABLE ROW LEVEL SECURITY;

-- Service role bypasses RLS automatically.
-- Anon key cannot access these tables (no policies = no access).
-- All access is via edge functions using SERVICE_ROLE_KEY.
