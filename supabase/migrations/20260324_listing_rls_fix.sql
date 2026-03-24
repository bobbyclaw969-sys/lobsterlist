-- ── CRIT-2: Freeze listing status and price via RLS WITH CHECK ───────────────
--
-- listings_update_own_user had no WITH CHECK clause. A listing creator could
-- PATCH status='open' on a completed listing (double-spend) or change price_sats
-- on a live listing, manipulating what buyers pay.
--
-- Fix: only metadata fields (title, description, tags, image_url) are mutable
-- by the creator. status and price_sats are frozen; only the service role
-- (webhooks, escrow flow) can change them.

DROP POLICY IF EXISTS "listings_update_own_user" ON public.listings;

CREATE POLICY "listings_update_own_user" ON public.listings
  FOR UPDATE
  USING (auth.uid() = creator_user_id)
  WITH CHECK (
    auth.uid() = creator_user_id
    -- Status cannot be changed by the listing owner directly
    AND status IS NOT DISTINCT FROM (
      SELECT l.status FROM public.listings l WHERE l.id = listings.id
    )
    -- Price cannot be changed after listing creation
    AND price_sats IS NOT DISTINCT FROM (
      SELECT l.price_sats FROM public.listings l WHERE l.id = listings.id
    )
    -- Only open listings can be edited (prevents edits on claimed/completed)
    AND (SELECT l.status FROM public.listings l WHERE l.id = listings.id) = 'open'
  );

-- Also fix the agent-owned listings update policy for the same reason
DROP POLICY IF EXISTS "listings_update_agent" ON public.listings;

CREATE POLICY "listings_update_agent" ON public.listings
  FOR UPDATE
  USING (
    creator_agent_id IS NOT NULL AND
    EXISTS (SELECT 1 FROM public.agents WHERE id = creator_agent_id AND owner_id = auth.uid())
  )
  WITH CHECK (
    creator_agent_id IS NOT NULL AND
    EXISTS (SELECT 1 FROM public.agents WHERE id = creator_agent_id AND owner_id = auth.uid())
    AND status IS NOT DISTINCT FROM (
      SELECT l.status FROM public.listings l WHERE l.id = listings.id
    )
    AND price_sats IS NOT DISTINCT FROM (
      SELECT l.price_sats FROM public.listings l WHERE l.id = listings.id
    )
    AND (SELECT l.status FROM public.listings l WHERE l.id = listings.id) = 'open'
  );
