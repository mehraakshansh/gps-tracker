-- ─────────────────────────────────────────────────────────────────────────────
-- 008: KPI snapshot — SQL function + pg_cron schedule
-- No HTTP call needed: pg_cron calls the function directly in Postgres
-- ─────────────────────────────────────────────────────────────────────────────

CREATE EXTENSION IF NOT EXISTS pg_cron;

-- ── Core snapshot function ────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION take_kpi_snapshot()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_total_assets   INT;
  v_active_alerts  INT;
  v_convoys_active INT;
  v_active_users   INT;
  v_api_calls_1h   INT;
BEGIN
  SELECT COUNT(*) INTO v_total_assets   FROM assets;

  SELECT COUNT(*) INTO v_active_alerts  FROM alerts;

  SELECT COUNT(*) INTO v_convoys_active FROM convoys
    WHERE status IN ('EN_ROUTE', 'PLANNED');

  -- Users with an active session touched in the last 5 minutes
  SELECT COUNT(*) INTO v_active_users FROM user_sessions
    WHERE is_active = true
      AND login_at >= NOW() - INTERVAL '5 minutes';

  -- API rate-limit windows opened in the last hour
  SELECT COUNT(*) INTO v_api_calls_1h FROM rate_limits
    WHERE window_start >= NOW() - INTERVAL '1 hour';

  INSERT INTO kpi_snapshots
    (snapshot_at, active_users, total_assets, active_alerts, convoys_active, api_calls_1h)
  VALUES
    (NOW(), v_active_users, v_total_assets, v_active_alerts, v_convoys_active, v_api_calls_1h);

  -- Purge snapshots older than 30 days inline (keeps the table lean)
  DELETE FROM kpi_snapshots WHERE snapshot_at < NOW() - INTERVAL '30 days';
END;
$$;

-- ── pg_cron: run every hour at :00 ───────────────────────────────────────────
-- Unschedule first so re-running this migration is idempotent
DO $$
BEGIN
  PERFORM cron.unschedule('kpi-snapshot-hourly');
EXCEPTION WHEN OTHERS THEN NULL; -- job didn't exist yet, fine
END;
$$;

SELECT cron.schedule(
  'kpi-snapshot-hourly',
  '0 * * * *',
  'SELECT take_kpi_snapshot()'
);
