-- ── Security Hardening: Audit Pass 2026-03-24 ─────────────────────────────────

-- ═══════════════════════════════════════════════════════════════════════════════
-- CRIT-1: Restrict users_update_own RLS policy
--
-- The original policy allowed any user to update ANY column on their own row,
-- including financial fields: usd_balance_cents, trust_deposit_paid, is_verified,
-- rating, completed_task_count, is_agent, auth_method.
-- A user could self-credit balance, self-verify, or bypass the trust deposit.
--
-- Fix: Restrict to profile fields only. Financial/status fields can only be
-- updated by the service role (which bypasses RLS).
-- ═══════════════════════════════════════════════════════════════════════════════

DROP POLICY IF EXISTS "users_update_own" ON public.users;

CREATE POLICY "users_update_profile_own" ON public.users
  FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (
    auth.uid() = id
    -- Prevent self-modification of financial/status fields
    -- These columns must remain identical to their current values when updated via anon key.
    -- Service role bypasses RLS and can update these freely.
    AND usd_balance_cents     IS NOT DISTINCT FROM (SELECT u.usd_balance_cents     FROM public.users u WHERE u.id = auth.uid())
    AND trust_deposit_paid    IS NOT DISTINCT FROM (SELECT u.trust_deposit_paid    FROM public.users u WHERE u.id = auth.uid())
    AND trust_deposit_sats    IS NOT DISTINCT FROM (SELECT u.trust_deposit_sats    FROM public.users u WHERE u.id = auth.uid())
    AND trust_deposit_returned IS NOT DISTINCT FROM (SELECT u.trust_deposit_returned FROM public.users u WHERE u.id = auth.uid())
    AND is_verified           IS NOT DISTINCT FROM (SELECT u.is_verified           FROM public.users u WHERE u.id = auth.uid())
    AND verification_method   IS NOT DISTINCT FROM (SELECT u.verification_method   FROM public.users u WHERE u.id = auth.uid())
    AND is_agent              IS NOT DISTINCT FROM (SELECT u.is_agent              FROM public.users u WHERE u.id = auth.uid())
    AND rating                IS NOT DISTINCT FROM (SELECT u.rating                FROM public.users u WHERE u.id = auth.uid())
    AND completed_task_count  IS NOT DISTINCT FROM (SELECT u.completed_task_count  FROM public.users u WHERE u.id = auth.uid())
    AND auth_method           IS NOT DISTINCT FROM (SELECT u.auth_method           FROM public.users u WHERE u.id = auth.uid())
  );

-- ═══════════════════════════════════════════════════════════════════════════════
-- CRIT-2: Restrict agents_update_own RLS policy
--
-- The original policy allowed agent owners to update ANY column on their agents,
-- including: verified, reputation_score, sats_spent_total, tasks_posted_count.
-- An owner could self-verify their agent and bypass the registration fee.
--
-- Fix: Restrict to safe display fields. Operational fields (verified, spending)
-- can only be updated via service role.
-- ═══════════════════════════════════════════════════════════════════════════════

DROP POLICY IF EXISTS "agents_update_own" ON public.agents;

CREATE POLICY "agents_update_safe_own" ON public.agents
  FOR UPDATE
  USING (auth.uid() = owner_id)
  WITH CHECK (
    auth.uid() = owner_id
    -- Prevent self-verification and balance manipulation
    AND verified           IS NOT DISTINCT FROM (SELECT a.verified           FROM public.agents a WHERE a.id = agents.id)
    AND verified_at        IS NOT DISTINCT FROM (SELECT a.verified_at        FROM public.agents a WHERE a.id = agents.id)
    AND reputation_score   IS NOT DISTINCT FROM (SELECT a.reputation_score   FROM public.agents a WHERE a.id = agents.id)
    AND sats_spent_total   IS NOT DISTINCT FROM (SELECT a.sats_spent_total   FROM public.agents a WHERE a.id = agents.id)
    AND tasks_posted_count IS NOT DISTINCT FROM (SELECT a.tasks_posted_count FROM public.agents a WHERE a.id = agents.id)
  );

-- ═══════════════════════════════════════════════════════════════════════════════
-- HIGH-3a: Enable RLS on rate_limits table
--
-- rate_limits had no RLS. Any authenticated user could read or delete
-- rate limit counters via the anon key, bypassing all rate limits.
-- ═══════════════════════════════════════════════════════════════════════════════

ALTER TABLE IF EXISTS public.rate_limits ENABLE ROW LEVEL SECURITY;
-- No policies = service role only (anon key cannot access)

-- ═══════════════════════════════════════════════════════════════════════════════
-- HIGH-3b: Enable RLS on audit_logs table
--
-- audit_logs had no RLS. Authenticated users could read all audit entries
-- (information disclosure) or INSERT arbitrary fake audit records.
-- ═══════════════════════════════════════════════════════════════════════════════

ALTER TABLE IF EXISTS public.audit_logs ENABLE ROW LEVEL SECURITY;
-- No policies = service role only

-- ═══════════════════════════════════════════════════════════════════════════════
-- MEDIUM: Restrict trust_deposits INSERT policy
--
-- The original trust_deposits_insert_own policy allowed users to insert records
-- with arbitrary status values. While this didn't directly bypass trust_deposit_paid
-- on the users table, it allowed DB pollution.
-- ═══════════════════════════════════════════════════════════════════════════════

DROP POLICY IF EXISTS "trust_deposits_insert_own" ON public.trust_deposits;

CREATE POLICY "trust_deposits_insert_own" ON public.trust_deposits
  FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND status = 'pending'       -- Users can only insert pending records
    AND amount_sats = 2100       -- Enforce the canonical amount
  );
