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
  const { walletAddress } = body

  const BTC_ADDRESS_RE = /^(1|3)[a-km-zA-HJ-NP-Z1-9]{24,33}$|^bc1[a-z0-9]{6,87}$/
  if (!walletAddress || typeof walletAddress !== 'string' || !BTC_ADDRESS_RE.test(walletAddress)) {
    return NextResponse.json({ error: 'Invalid Bitcoin wallet address' }, { status: 400 })
  }

  // IP-based rate limit: 30 challenges per IP per minute across all wallet addresses
  const clientIp = request.headers.get('x-forwarded-for') ?? request.headers.get('x-real-ip') ?? 'unknown'
  const ipRateOk = await checkRateLimit(`challenge:ip:${clientIp}`, 30, 60)
  if (!ipRateOk) {
    return NextResponse.json({ error: 'Too many requests. Please wait a moment.' }, { status: 429 })
  }

  const service = await createServiceClient()

  // Rate limit: max 5 challenges per address per 60 seconds (DB-backed, survives restarts)
  const since = new Date(Date.now() - 60_000).toISOString()
  const { count } = await service
    .from('auth_challenges')
    .select('*', { count: 'exact', head: true })
    .eq('wallet_address', walletAddress)
    .gte('created_at', since)

  if ((count ?? 0) >= 5) {
    return NextResponse.json({ error: 'Too many requests. Please wait a moment.' }, { status: 429 })
  }

  const message = await generateChallenge(walletAddress)
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString()

  return NextResponse.json({ message, expiresAt })
}
