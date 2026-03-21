import { createServiceClient } from '@/lib/supabase/server'

/**
 * Generate a challenge message for wallet signature verification.
 * Stores a nonce in auth_challenges (5 minute TTL, single-use).
 */
export async function generateChallenge(walletAddress: string): Promise<string> {
  const service = await createServiceClient()
  const nonce = crypto.randomUUID()
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString()
  const expiresDisplay = new Date(expiresAt).toUTCString()

  await service.from('auth_challenges').insert({
    wallet_address: walletAddress,
    nonce,
    expires_at: expiresAt,
  })

  const message =
    `Sign this message to log in to LobsterList.\n\n` +
    `Wallet: ${walletAddress}\n` +
    `Nonce: ${nonce}\n` +
    `Expires: ${expiresDisplay}\n\n` +
    `This request will not trigger a blockchain transaction or cost any fees.`

  return message
}

/**
 * Verify a wallet signature against a stored challenge.
 * Marks the nonce as used immediately to prevent replay attacks.
 * Returns true only if signature is cryptographically valid.
 */
export async function verifyChallenge(
  walletAddress: string,
  signature: string,
  message: string,
): Promise<boolean> {
  // Extract nonce from message
  const nonceMatch = message.match(/^Nonce: (.+)$/m)
  if (!nonceMatch) {
    console.warn('[wallet-auth] verify failed — nonce not found in message', { walletAddress, timestamp: new Date().toISOString() })
    return false
  }
  const nonce = nonceMatch[1].trim()

  const service = await createServiceClient()

  // Atomic consume: UPDATE WHERE used=false AND expires_at > now()
  // Only one concurrent request can ever consume a given nonce.
  // Returns 0 rows if nonce not found, already used, expired, or wrong address.
  // All failure cases return false with no information leakage about which check failed.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const consumeResult = await (service as any).rpc('consume_auth_challenge', {
    p_nonce: nonce,
    p_wallet_address: walletAddress,
  })
  const consumed = consumeResult.data as Array<{ id: string; wallet_address: string }> | null

  if (!consumed || consumed.length === 0) {
    console.warn('[wallet-auth] verify failed — nonce not found, already used, or expired', { walletAddress, timestamp: new Date().toISOString() })
    return false
  }

  // Verify signature
  try {
    // TODO: Monitor bitcoinjs-message for elliptic patch (advisory GHSA-848j-6mx2-7j84).
    // Current mitigation: server-side only; never exposed to untrusted input beyond
    // the signature string. package.json overrides elliptic to 6.6.1 (latest available).
    // Dynamic import to handle potential CJS/ESM issues with bitcoinjs-message
    const bitcoinjsMessage = await import('bitcoinjs-message')
    const verify = bitcoinjsMessage.default?.verify ?? bitcoinjsMessage.verify

    // Try standard verification (works for P2PKH, P2WPKH)
    let valid = false
    try {
      valid = verify(message, walletAddress, signature)
    } catch {
      // P2TR (taproot) and some Unisat signatures use a different format
      // Try with checkSegwitAlways=true for native segwit
      try {
        valid = verify(message, walletAddress, signature, undefined, true)
      } catch {
        console.warn('[wallet-auth] verify failed — unsupported address type or signature format', { walletAddress, timestamp: new Date().toISOString() })
        return false
      }
    }

    if (!valid) {
      console.warn('[wallet-auth] verify failed — invalid signature', { walletAddress, timestamp: new Date().toISOString() })
    }
    return valid
  } catch (err) {
    console.error('[wallet-auth] verify error', { walletAddress, timestamp: new Date().toISOString(), error: String(err) })
    return false
  }
}
