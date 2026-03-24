import { createServiceClient } from '@/lib/supabase/server'

/**
 * Strict signature validation for Bitcoin wallet authentication.
 *
 * Implements:
 * - BIP-62 signature malleability protection
 * - Low-S (low-r) signature enforcement for SegWit
 * - Proper nonce handling via challenge system
 */

// Low-S enforcement constant (BIP-62)
// Signatures with S > curve_order/2 are malleable
const CURVE_ORDER_HALF = BigInt('0x7FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF5D576E7357A4501DDFE92F46681B20A0')

/**
 * Parse and validate a DER-encoded signature for malleability.
 * Returns { r, s } as bigints if valid and non-malleable, null otherwise.
 */
function parseAndCheckMalleability(signature: Buffer): { r: bigint; s: bigint } | null {
  try {
    // DER encoding: 0x30 [totalLen] 0x02 [rLen] [r] 0x02 [sLen] [s]
    if (signature[0] !== 0x30) return null

    const totalLen = signature[1]
    if (totalLen !== signature.length - 2) return null

    let offset = 2

    // Parse r
    if (signature[offset] !== 0x02) return null
    const rLen = signature[offset + 1]
    offset += 2
    const r = BigInt('0x' + signature.slice(offset, offset + rLen).toString('hex'))
    offset += rLen

    // Parse s
    if (signature[offset] !== 0x02) return null
    const sLen = signature[offset + 1]
    offset += 2
    const s = BigInt('0x' + signature.slice(offset, offset + sLen).toString('hex'))

    // Check for malleability: S must be <= curve_order/2
    if (s > CURVE_ORDER_HALF) {
      // S is malleable — use the complement: curve_order - s
      // This is what libsecp256k1 does automatically
      return null // Reject malleable signatures
    }

    // Additional validation: r and s must be non-zero and < curve order
    if (r === BigInt(0) || s === BigInt(0)) return null
    if (r >= CURVE_ORDER_HALF || s >= CURVE_ORDER_HALF) return null

    return { r, s }
  } catch {
    return null
  }
}

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
    // bitcoinjs-message is server-side only; signature input is strictly validated.
    // Elliptic advisory GHSA-848j-6mx2-7j84: package.json overrides elliptic to 6.6.1.
    // Additional S-malleability check below provides defense-in-depth.
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
      return false
    }

    // Additional security: Check signature for malleability (BIP-62)
    // This catches signatures with S > curve_order/2 that would allow malleability attacks
    try {
      // bitcoinjs-message returns signature in DER format when available
      // For hex signatures, parse and check S value
      const sigBuffer = Buffer.from(signature, signature.includes(' ') ? 'base64' : 'hex')
      const malleabilityCheck = parseAndCheckMalleability(sigBuffer)
      
      if (malleabilityCheck === null) {
        // Signature is malleable or malformed — reject
        console.warn('[wallet-auth] verify failed — malleable signature rejected', { walletAddress, timestamp: new Date().toISOString() })
        return false
      }
    } catch (sigParseErr) {
      // If we can't parse the signature format, rely on bitcoinjs-message's verification
      // This handles wallet-specific signature formats we may not parse
      console.warn('[wallet-auth] could not check malleability, relying on bitcoinjs-message verification')
    }

    return true
  } catch (err) {
    console.error('[wallet-auth] verify error', { walletAddress, timestamp: new Date().toISOString(), error: String(err) })
    return false
  }
}
