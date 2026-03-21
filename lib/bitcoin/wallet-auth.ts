import { createServiceClient } from '@/lib/supabase/server'
import type { AuthChallengeRow } from '@/types/database'

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

  // Look up challenge.
  // walletAddress is provided by the caller; we bind the nonce to the address
  // server-side in generateChallenge(), so this check confirms the caller
  // possesses the nonce that was issued for this specific address.
  // Signature verification below then confirms key ownership.
  const { data: rawChallenge } = await service
    .from('auth_challenges')
    .select('*')
    .eq('nonce', nonce)
    .eq('wallet_address', walletAddress)
    .single()
  const challenge = rawChallenge as AuthChallengeRow | null

  if (!challenge) {
    console.warn('[wallet-auth] verify failed — nonce not found', { walletAddress, timestamp: new Date().toISOString() })
    return false
  }

  // Mark used immediately (before checking anything else — prevents timing attacks)
  await service
    .from('auth_challenges')
    .update({ used: true })
    .eq('id', challenge.id)

  if (challenge.used) {
    console.warn('[wallet-auth] verify failed — nonce already used', { walletAddress, timestamp: new Date().toISOString() })
    return false
  }

  if (new Date(challenge.expires_at) < new Date()) {
    console.warn('[wallet-auth] verify failed — nonce expired', { walletAddress, timestamp: new Date().toISOString() })
    return false
  }

  // Verify signature
  try {
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
