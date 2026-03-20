-- Phase 3: Bitcoin Wallet Authentication

-- Add wallet fields to users table
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS btc_wallet_address TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS wallet_type TEXT CHECK (wallet_type IN ('unisat', 'xverse', 'leather')),
  ADD COLUMN IF NOT EXISTS auth_method TEXT NOT NULL DEFAULT 'email' CHECK (auth_method IN ('email', 'wallet', 'both'));

-- Auth challenges table (nonce-based challenge-response)
CREATE TABLE IF NOT EXISTS auth_challenges (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_address TEXT       NOT NULL,
  nonce         TEXT        NOT NULL UNIQUE,
  expires_at    TIMESTAMPTZ NOT NULL,
  used          BOOLEAN     NOT NULL DEFAULT false,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS: service role only for auth_challenges
ALTER TABLE auth_challenges ENABLE ROW LEVEL SECURITY;

-- No policies = no access except service role (which bypasses RLS)

-- Index for fast lookup by wallet address (rate limiting + lookup)
CREATE INDEX IF NOT EXISTS auth_challenges_wallet_address_idx
  ON auth_challenges (wallet_address, created_at DESC);

CREATE INDEX IF NOT EXISTS auth_challenges_nonce_idx
  ON auth_challenges (nonce);
