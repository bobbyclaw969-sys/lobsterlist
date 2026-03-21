/**
 * POST /api/auth/agent/register
 *
 * Step 1 of 2 — generate a challenge message for a wallet address.
 * No human interaction required. Agent calls this, then signs the message,
 * then POSTs to /api/auth/agent/verify to receive an API key.
 *
 * Body: { walletAddress: string }
 * Returns: { message: string, expiresAt: string }
 */
import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { generateChallenge } from '@/lib/bitcoin/wallet-auth'
import { checkRateLimit } from '@/lib/rate-limit'

export async function POST(request: Request) {
  let body: { walletAddress?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const walletAddress = body.walletAddress?.trim()
  if (!walletAddress || walletAddress.length < 10) {
    return NextResponse.json({ error: 'walletAddress is required' }, { status: 400 })
  }

  // IP-based rate limit: 30 challenges per IP per minute across all wallet addresses
  const clientIp = request.headers.get('x-forwarded-for') ?? request.headers.get('x-real-ip') ?? 'unknown'
  const ipRateOk = await checkRateLimit(`challenge:ip:${clientIp}`, 30, 60)
  if (!ipRateOk) {
    return NextResponse.json(
      { error: 'Too many requests. Wait 60 seconds before trying again.' },
      { status: 429 },
    )
  }

  const service = await createServiceClient()

  // Rate limit: max 5 challenges per address in last 60 seconds (DB-backed, survives restarts)
  const cutoff = new Date(Date.now() - 60_000).toISOString()
  const { count } = await service
    .from('auth_challenges')
    .select('id', { count: 'exact', head: true })
    .eq('wallet_address', walletAddress)
    .gte('created_at', cutoff)

  if ((count ?? 0) >= 5) {
    return NextResponse.json(
      { error: 'Too many requests. Wait 60 seconds before trying again.' },
      { status: 429 },
    )
  }

  const message = await generateChallenge(walletAddress)

  // Parse expiry from the message (last line "Expires: <iso>")
  const expiresMatch = message.match(/Expires: (.+)$/)
  const expiresAt = expiresMatch?.[1] ?? new Date(Date.now() + 5 * 60_000).toISOString()

  return NextResponse.json({ message, expiresAt })
}
