-- ── HIGH-1: Restrict users and agents SELECT to safe public fields ────────────
--
-- users_read_public used USING (true) — any anon request could read ALL columns
-- including usd_balance_cents, payout_info (bank account data), email, and
-- trust deposit financials for every user on the platform.
--
-- Fix: replace the broad policy with own-record-only access. Expose safe
-- public profile fields via a view so the browse/profile pages still work.

-- ── Users ─────────────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "users_read_public" ON public.users;

-- Own record: full access (dashboard, profile edit, balance display)
CREATE POLICY "users_read_own" ON public.users
  FOR SELECT
  USING (auth.uid() = id);

-- Public profile view — safe fields only, no financial or contact data
CREATE OR REPLACE VIEW public.public_profiles AS
  SELECT
    id,
    name,
    avatar_url,
    bio,
    location,
    skills,
    rating,
    completed_task_count,
    is_agent,
    created_at
  FROM public.users;

GRANT SELECT ON public.public_profiles TO anon, authenticated;

-- ── Agents ────────────────────────────────────────────────────────────────────
-- agents_read_public exposed spending_limit_sats and sats_spent_total to anyone.

DROP POLICY IF EXISTS "agents_read_public" ON public.agents;

-- Owner can read all their agent data (spending limits, financial state)
CREATE POLICY "agents_read_own" ON public.agents
  FOR SELECT
  USING (auth.uid() = owner_id);

-- Public agent view — operational data without financial internals
CREATE OR REPLACE VIEW public.public_agents AS
  SELECT
    id,
    name,
    description,
    capabilities,
    btc_wallet_address,
    reputation_score,
    tasks_posted_count,
    verified,
    created_at
  FROM public.agents;

GRANT SELECT ON public.public_agents TO anon, authenticated;
