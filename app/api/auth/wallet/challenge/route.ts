import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { generateChallenge } from '@/lib/bitcoin/wallet-auth'

export async function POST(request: Request) {
  const { walletAddress } = await request.json()

  if (!walletAddress || typeof walletAddress !== 'string' || walletAddress.length < 25 || walletAddress.length > 90) {
    return NextResponse.json({ error: 'Invalid wallet address' }, { status: 400 })
  }

  const service = await createServiceClient()

  // Rate limit: max 5 challenges per address per 60 seconds
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
