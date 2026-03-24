-- ── HIGH-3: Atomic cashout — prevent double-spend race condition ──────────────
--
-- cashout/route.ts read usd_balance_cents, checked it, then updated it in
-- separate operations. Two concurrent requests could both pass the balance
-- check and both initiate Strike payouts — spending more than the balance.
--
-- Fix: single UPDATE with WHERE usd_balance_cents >= amount.
-- Returns 0 rows if balance is insufficient (concurrent request already won).

CREATE OR REPLACE FUNCTION public.deduct_balance_atomic(
  p_user_id     UUID,
  p_amount_cents INTEGER
)
RETURNS TABLE (
  success           BOOLEAN,
  remaining_balance INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_new_balance INTEGER;
BEGIN
  UPDATE public.users
  SET usd_balance_cents = usd_balance_cents - p_amount_cents
  WHERE id = p_user_id
    AND usd_balance_cents >= p_amount_cents
  RETURNING usd_balance_cents INTO v_new_balance;

  IF NOT FOUND THEN
    RETURN QUERY SELECT false, NULL::INTEGER;
    RETURN;
  END IF;

  RETURN QUERY SELECT true, v_new_balance;
END;
$$;

-- Refund function: called if Strike payout fails after deduction.
-- Restores the balance atomically so no funds are stranded.

CREATE OR REPLACE FUNCTION public.refund_balance(
  p_user_id     UUID,
  p_amount_cents INTEGER
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.users
  SET usd_balance_cents = usd_balance_cents + p_amount_cents
  WHERE id = p_user_id;
END;
$$;
