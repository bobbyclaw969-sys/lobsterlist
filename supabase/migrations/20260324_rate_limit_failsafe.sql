-- ── MED-1: Rate limit fails closed on DB error ───────────────────────────────
--
-- The check_rate_limit RPC had EXCEPTION WHEN OTHERS THEN RETURN allowed=true.
-- Any DB error (table unavailable, lock timeout, etc.) would silently disable
-- all rate limiting — opening every rate-limited endpoint to unlimited requests.
--
-- Fix: fail closed. Brief 429s during DB issues are safer than open access.

CREATE OR REPLACE FUNCTION check_rate_limit(
  p_key TEXT,
  p_max INTEGER,
  p_window_secs INTEGER,
  p_window_start TIMESTAMPTZ
) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_key_hash TEXT;
  v_current_count INTEGER;
  v_allowed BOOLEAN;
  v_result JSONB;
BEGIN
  v_key_hash := encode(sha256(p_key::bytea), 'hex');
  INSERT INTO rate_limits (key_prefix, key_hash, count, window_start)
  VALUES (left(p_key, 50), v_key_hash, 1, p_window_start)
  ON CONFLICT (key_hash, window_start) DO UPDATE SET count = rate_limits.count + 1
  RETURNING count INTO v_current_count;
  v_allowed := v_current_count <= p_max;
  DELETE FROM rate_limits
    WHERE window_start < now() - (p_window_secs || ' seconds')::interval
      AND window_start < p_window_start;
  v_result := jsonb_build_object('allowed', v_allowed, 'current_count', v_current_count);
  RETURN v_result;
EXCEPTION WHEN OTHERS THEN
  -- Fail CLOSED: DB errors cause rate limit rejection.
  -- Brief false 429s during DB issues are safer than unlimited open access.
  RETURN jsonb_build_object(
    'allowed', false,
    'current_count', 9999,
    'error', 'rate_limit_unavailable'
  );
END;
$$;
