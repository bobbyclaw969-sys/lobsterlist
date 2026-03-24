import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { initiateAchPayout } from '@/lib/bitcoin/strike'
import { checkRateLimit } from '@/lib/rate-limit'
import type { UserRow } from '@/types/database'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Rate limit: 5 cashout attempts per user per minute
  const cashoutRateOk = await checkRateLimit(`cashout:${user.id}`, 5, 60)
  if (!cashoutRateOk) {
    return NextResponse.json({ error: 'Too many requests. Please wait a moment.' }, { status: 429 })
  }

  let body: { amountUsd?: number; bankAccountId?: string; bankAccountLabel?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }
  const { amountUsd, bankAccountId, bankAccountLabel } = body

  if (!amountUsd || amountUsd < 1) {
    return NextResponse.json({ error: 'Minimum cashout is $1.00' }, { status: 400 })
  }
  if (!bankAccountId) {
    return NextResponse.json({ error: 'bankAccountId required' }, { status: 400 })
  }

  const service = await createServiceClient()
  const { data: raw } = await service.from('users').select('*').eq('id', user.id).single()
  if (!raw) return NextResponse.json({ error: 'User not found' }, { status: 404 })
  const profile = raw as UserRow

  const amountCents = Math.round(amountUsd * 100)
  if (profile.usd_balance_cents < amountCents) {
    return NextResponse.json({
      error: `Insufficient balance. Available: $${(profile.usd_balance_cents / 100).toFixed(2)}`,
    }, { status: 402 })
  }

  // Initiate Strike ACH payout
  const payout = await initiateAchPayout({
    amountUsd,
    bankAccountId,
    description: `LobsterList earnings — ${bankAccountLabel ?? bankAccountId}`,
  })

  // Deduct balance
  await service.from('users').update({
    usd_balance_cents: profile.usd_balance_cents - amountCents,
  }).eq('id', user.id)

  // Record transaction (sats equivalent using cached price)
  const { data: priceCache } = await service.from('btc_price_cache').select('price_usd').eq('id', 1).single()
  const btcPrice = priceCache ? Number(priceCache.price_usd) : 85_000
  const amountSats = Math.round((amountUsd / btcPrice) * 100_000_000)

  await service.from('transactions').insert({
    user_id: user.id,
    tx_type: 'cashout',
    amount_sats: amountSats,
    usd_cents: amountCents,
    reference_id: payout.payoutId,
  })

  return NextResponse.json({
    ok: true,
    payoutId: payout.payoutId,
    state: payout.state,
    mockMode: payout.mockMode,
    newBalanceCents: profile.usd_balance_cents - amountCents,
  })
}
