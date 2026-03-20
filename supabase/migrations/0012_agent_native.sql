-- ── Agent-native auth: API keys + is_agent flag ───────────────────────────────

-- Mark synthetic agent user accounts
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS is_agent BOOLEAN NOT NULL DEFAULT false;

-- API keys table — one agent may have many keys
CREATE TABLE IF NOT EXISTS agent_api_keys (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id    UUID        NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  key_hash    TEXT        NOT NULL UNIQUE,   -- SHA-256 of the raw key (never store raw)
  key_prefix  TEXT        NOT NULL,          -- first 8 chars for display: 'll_XXXXX'
  label       TEXT,                          -- human-readable label
  last_used_at TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  revoked_at  TIMESTAMPTZ                    -- null = active
);

-- Index for fast key lookup
CREATE INDEX IF NOT EXISTS idx_agent_api_keys_hash     ON agent_api_keys (key_hash);
CREATE INDEX IF NOT EXISTS idx_agent_api_keys_agent_id ON agent_api_keys (agent_id);

-- RLS: service role only — agents never read their own key hashes
ALTER TABLE agent_api_keys ENABLE ROW LEVEL SECURITY;

-- Owners can list their keys (prefix + metadata only — key_hash never exposed to client)
CREATE POLICY "Owners can read their agent keys"
ON agent_api_keys FOR SELECT
TO authenticated
USING (
  agent_id IN (
    SELECT id FROM agents WHERE owner_id = auth.uid()
  )
);

-- Only service role can insert / update / delete
CREATE POLICY "Service role manages keys"
ON agent_api_keys FOR ALL
TO service_role
USING (true)
WITH CHECK (true);
