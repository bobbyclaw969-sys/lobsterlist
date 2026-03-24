-- Security fix: Supabase-backed rate limiter RPC
-- Run this in Supabase SQL Editor to enable persistent rate limiting

-- Create rate_limits table
CREATE TABLE IF NOT EXISTS rate_limits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key_prefix TEXT NOT NULL,
  key_hash TEXT NOT NULL,
  count INTEGER NOT NULL DEFAULT 1,
  window_start TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(key_hash, window_start)
);

CREATE INDEX IF NOT EXISTS idx_rate_limits_key_hash ON rate_limits(key_hash);
CREATE INDEX IF NOT EXISTS idx_rate_limits_window ON rate_limits(window_start) WHERE window_start > now();

-- Atomic rate limit check-and-increment function
CREATE OR REPLACE FUNCTION check_rate_limit(
  p_key TEXT,
  p_max INTEGER,
  p_window_secs INTEGER,
  p_window_start TIMESTAMPTZ
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_key_hash TEXT;
  v_current_count INTEGER;
  v_allowed BOOLEAN;
  v_result JSONB;
BEGIN
  -- Hash the key to prevent timing attacks on key comparison
  v_key_hash := encode(sha256(p_key::bytea), 'hex');

  -- Try to increment atomically
  INSERT INTO rate_limits (key_prefix, key_hash, count, window_start)
  VALUES (left(p_key, 50), v_key_hash, 1, p_window_start)
  ON CONFLICT (key_hash, window_start)
  DO UPDATE SET count = rate_limits.count + 1
  RETURNING count INTO v_current_count;

  -- Check if under limit
  v_allowed := v_current_count <= p_max;

  -- Clean up old entries (older than 2 windows)
  DELETE FROM rate_limits
  WHERE window_start < now() - (p_window_secs || ' seconds')::interval
    AND window_start < p_window_start; -- Only cleanup entries before current window

  v_result := jsonb_build_object(
    'allowed', v_allowed,
    'current_count', v_current_count
  );

  RETURN v_result;
EXCEPTION WHEN OTHERS THEN
  -- Fail open with logging
  RAISE NOTICE 'Rate limit check failed: %', SQLERRM;
  RETURN jsonb_build_object('allowed', true, 'current_count', 0);
END;
$$;

-- Add abuse contact to rate limit responses
COMMENT ON FUNCTION check_rate_limit IS 'Atomic rate limit check. Returns {allowed, current_count}. Fails open on errors.';
