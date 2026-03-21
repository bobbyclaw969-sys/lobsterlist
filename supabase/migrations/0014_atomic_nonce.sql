-- Atomic nonce consumption for exactly-once challenge verification.
-- Returns the challenge row if the nonce was valid, unexpired, and not yet used.
-- Returns 0 rows if nonce was not found, already used, expired, or wrong address.
-- The single UPDATE with WHERE used = false ensures only one concurrent request
-- can ever consume a given nonce, eliminating the read→write→check race condition.

CREATE OR REPLACE FUNCTION consume_auth_challenge(
  p_nonce TEXT,
  p_wallet_address TEXT
)
RETURNS TABLE (
  id UUID,
  wallet_address TEXT,
  expires_at TIMESTAMPTZ,
  was_used BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  UPDATE auth_challenges
  SET used = true
  WHERE
    nonce = p_nonce
    AND wallet_address = p_wallet_address
    AND used = false
    AND expires_at > now()
  RETURNING
    id,
    wallet_address,
    expires_at,
    false AS was_used;  -- row returned means it was NOT previously used
END;
$$;
