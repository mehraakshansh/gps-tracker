-- ─────────────────────────────────────────────────────────────────────────────
-- 009: Atomic rate-limit increment function
-- Called by edge functions via sb.rpc('increment_rate_limit', {...})
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION increment_rate_limit(p_user_uid TEXT)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_count INT;
BEGIN
  INSERT INTO rate_limits (user_uid, window_start, call_count)
  VALUES (p_user_uid, date_trunc('minute', NOW()), 1)
  ON CONFLICT (user_uid, window_start)
  DO UPDATE SET call_count = rate_limits.call_count + 1
  RETURNING call_count INTO v_count;

  -- Auto-clean windows older than 2 hours (probabilistic: 5% of calls)
  -- Avoids a dedicated cron just for this table
  IF random() < 0.05 THEN
    DELETE FROM rate_limits WHERE window_start < NOW() - INTERVAL '2 hours';
  END IF;

  RETURN v_count;
END;
$$;

GRANT EXECUTE ON FUNCTION increment_rate_limit TO service_role;
