-- Atomic invoice claim for exactly-once webhook processing.
-- Returns the invoice row if it was in 'pending' state and we claimed it;
-- returns 0 rows if it was already 'paid' or doesn't exist.
-- This eliminates the race condition in read→check→write webhook patterns.

CREATE OR REPLACE FUNCTION claim_invoice_for_processing(
  p_strike_invoice_id TEXT
)
RETURNS TABLE (
  id UUID,
  status TEXT,
  invoice_type TEXT,
  entity_id UUID,
  amount_sats BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  UPDATE lightning_invoices
  SET
    status = 'paid',
    paid_at = now()
  WHERE
    strike_invoice_id = p_strike_invoice_id
    AND status = 'pending'
  RETURNING
    id,
    status,
    invoice_type,
    entity_id,
    amount_sats;
END;
$$;
