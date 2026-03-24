-- Rate Limits Table + RPC + Audit Logs (idempotent)
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
CREATE INDEX IF NOT EXISTS idx_rate_limits_window ON rate_limits(window_start);

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
  DELETE FROM rate_limits WHERE window_start < now() - (p_window_secs || ' seconds')::interval AND window_start < p_window_start;
  v_result := jsonb_build_object('allowed', v_allowed, 'current_count', v_current_count);
  RETURN v_result;
EXCEPTION WHEN OTHERS THEN RETURN jsonb_build_object('allowed', true, 'current_count', 0);
END;
$$;

-- Audit Logs Table
CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID,
  agent_id UUID,
  action VARCHAR(50) NOT NULL,
  resource_type VARCHAR(50) NOT NULL,
  resource_id UUID,
  ip_address VARCHAR(45),
  user_agent TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON audit_logs(created_at);
