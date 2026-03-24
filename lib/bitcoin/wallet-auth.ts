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
    if (s > CURVE_ORDER_HALF) return null

    // Additional validation
    if (r === BigInt(0) || s === BigInt(0)) return null
    if (r >= CURVE_ORDER_HALF || s >= CURVE_ORDER_HALF) return null

    return { r, s }
  } catch {
    return null
  }
}

/**
 * Generate a challenge message for wallet signature verification.
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
 * Returns true only if signature is cryptographically valid and strictly compliant.
 */
export async function verifyChallenge(
  walletAddress: string,
  signature: string,
  message: string,
): Promise<boolean> {
  // 1. Strict Message Structure Check
  // Prevent social engineering where user signs a misleading message that coincidentally contains the nonce.
  const EXPECTED_PREAMBLE = "Sign this message to log in to LobsterList."
  if (!message.startsWith(EXPECTED_PREAMBLE)) {
    console.warn('[wallet-auth] verify failed — invalid message preamble')
    return false
  }

  // Extract nonce
  const nonceMatch = message.match(/^Nonce: (.+)$/m)
  if (!nonceMatch) {
    console.warn('[wallet-auth] verify failed — nonce not found in message')
    return false
  }
  const nonce = nonceMatch[1].trim()

  const service = await createServiceClient()

  // 2. Atomic consume: UPDATE WHERE used=false AND expires_at > now()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const consumeResult = await (service as any).rpc('consume_auth_challenge', {
    p_nonce: nonce,
    p_wallet_address: walletAddress,
  })
  const consumed = consumeResult.data as Array<{ id: string; wallet_address: string }> | null

  if (!consumed || consumed.length === 0) {
    console.warn('[wallet-auth] verify failed — nonce not found, already used, or expired')
    return false
  }

  // 3. Verify signature
  try {
    const bitcoinjsMessage = await import('bitcoinjs-message')
    const verify = bitcoinjsMessage.default?.verify ?? bitcoinjsMessage.verify

    let valid = false
    try {
      valid = verify(message, walletAddress, signature)
    } catch {
      try {
        // Try segwit
        valid = verify(message, walletAddress, signature, undefined, true)
      } catch {
        console.warn('[wallet-auth] verify failed — invalid signature format')
        return false
      }
    }

    if (!valid) {
      console.warn('[wallet-auth] verify failed — signature verification failed')
      return false
    }

    // 4. Malleability Check (BIP-62)
    try {
      const sigBuffer = Buffer.from(signature, signature.includes(' ') ? 'base64' : 'hex')
      const malleabilityCheck = parseAndCheckMalleability(sigBuffer)
      
      if (malleabilityCheck === null) {
        // FAIL CLOSED: if we can't parse it or it's malleable, reject.
        // This is stricter than the previous implementation.
        console.warn('[wallet-auth] verify failed — signature is malleable or malformed')
        return false
      }
    } catch {
      console.warn('[wallet-auth] verify failed — signature parsing exception')
      return false
    }

    return true
  } catch (err) {
    console.error('[wallet-auth] verify error', err)
    return false
  }
}
