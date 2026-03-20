-- ─── New Pricing Model ────────────────────────────────────────────────────────
-- Humans pay ZERO platform fees — ever.
-- Agents pay budget + 5% platform fee. Human receives 100% of budget.
-- Trust Deposit = 2,100 sats collateral (not a fee), returned after 10 completions.

-- ─── User verification + trust deposit fields ─────────────────────────────────
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS is_verified            BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS verification_method    TEXT CHECK (
    verification_method IN ('wallet', 'sat_payment', 'phone')
  ),
  ADD COLUMN IF NOT EXISTS trust_deposit_paid     BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS trust_deposit_sats     INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS trust_deposit_returned BOOLEAN NOT NULL DEFAULT false;

-- Wallet-auth users are automatically verified (wallet signature = proof of life)
UPDATE public.users
SET
  is_verified = true,
  verification_method = 'wallet'
WHERE auth_method IN ('wallet', 'both') AND NOT is_verified;

-- ─── Fee breakdown columns on listings ────────────────────────────────────────
-- Nullable, derived from price_sats × 1.05 fee model.
ALTER TABLE public.listings
  ADD COLUMN IF NOT EXISTS platform_fee_sats     INTEGER,
  ADD COLUMN IF NOT EXISTS total_agent_cost_sats INTEGER,
  ADD COLUMN IF NOT EXISTS human_payout_sats     INTEGER;

-- Backfill existing listings
UPDATE public.listings
SET
  human_payout_sats     = price_sats,
  platform_fee_sats     = ROUND(price_sats * 0.05),
  total_agent_cost_sats = price_sats + ROUND(price_sats * 0.05);

-- ─── Trust deposits table ─────────────────────────────────────────────────────
-- Separate from escrow_contracts. Per-user collateral, not per-listing.
CREATE TABLE IF NOT EXISTS public.trust_deposits (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID REFERENCES public.users(id) ON DELETE CASCADE UNIQUE NOT NULL,
  amount_sats  INTEGER NOT NULL DEFAULT 2100,
  invoice_id   TEXT,
  status       TEXT NOT NULL DEFAULT 'pending' CHECK (
    status IN ('pending', 'paid', 'returned', 'forfeited')
  ),
  created_at   TIMESTAMPTZ DEFAULT now(),
  returned_at  TIMESTAMPTZ,
  forfeited_at TIMESTAMPTZ
);

ALTER TABLE public.trust_deposits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "trust_deposits_read_own" ON public.trust_deposits
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "trust_deposits_insert_own" ON public.trust_deposits
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- ─── New invoice types ────────────────────────────────────────────────────────
ALTER TYPE invoice_type ADD VALUE IF NOT EXISTS 'trust_deposit';
ALTER TYPE invoice_type ADD VALUE IF NOT EXISTS 'verification';
