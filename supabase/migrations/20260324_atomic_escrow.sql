-- ── HIGH-2: Atomic escrow creation — prevent double-claim race condition ──────
--
-- escrow/create had a TOCTOU race: it read listing.status, then separately
-- updated it to 'claimed'. Concurrent requests both passed the status check
-- before either update ran, creating multiple escrow contracts per listing.
--
-- Fix Part A: UNIQUE constraint on escrow_contracts.listing_id
-- Makes the DB reject any second escrow for the same listing outright.

ALTER TABLE public.escrow_contracts
  ADD CONSTRAINT IF NOT EXISTS escrow_contracts_listing_id_unique
  UNIQUE (listing_id);

-- Fix Part B: Atomic claim function
-- Single UPDATE that checks status='open' and flips it to 'claimed' atomically.
-- Returns the listing row on success, 0 rows if already claimed or not found.
-- The self-claim check is handled in app code before calling this function.

CREATE OR REPLACE FUNCTION public.claim_listing_atomic(
  p_listing_id UUID
)
RETURNS TABLE (
  success    BOOLEAN,
  listing_id UUID,
  price_sats BIGINT,
  title      TEXT,
  creator_user_id  UUID,
  creator_agent_id UUID
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  UPDATE public.listings
  SET status = 'claimed'
  WHERE id = p_listing_id
    AND status = 'open'
  RETURNING
    true,
    id,
    listings.price_sats,
    listings.title,
    listings.creator_user_id,
    listings.creator_agent_id;
END;
$$;
