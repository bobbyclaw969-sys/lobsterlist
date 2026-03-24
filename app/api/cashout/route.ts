import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { initiateAchPayout } from '@/lib/bitcoin/strike'
import { checkRateLimit } from '@/lib/rate-limit'

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
  const amountCents = Math.round(amountUsd * 100)

  // ── Atomic balance deduction ────────────────────────────────────────────────
  // Single UPDATE WHERE balance >= amount — only one concurrent request wins.
  // Prevents double-spend: two concurrent requests can no longer both pass the
  // old read-check-update pattern and both initiate Strike payouts.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: deducted } = await (service as any).rpc('deduct_balance_atomic', {
    p_user_id: user.id,
    p_amount_cents: amountCents,
  }) as { data: Array<{ success: boolean; remaining_balance: number }> | null }

  if (!deducted || deducted.length === 0 || !deducted[0].success) {
    return NextResponse.json({ error: 'Insufficient balance' }, { status: 402 })
  }

  const remainingBalance = deducted[0].remaining_balance

  // ── Initiate Strike ACH payout ──────────────────────────────────────────────
  // Balance is already deducted. If Strike fails, refund atomically.
  let payout: Awaited<ReturnType<typeof initiateAchPayout>>
  try {
    payout = await initiateAchPayout({
      amountUsd,
      bankAccountId,
      description: `LobsterList earnings — ${bankAccountLabel ?? bankAccountId}`,
    })
  } catch (err) {
    // Refund atomically so the user's balance is restored
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (service as any).rpc('refund_balance', {
      p_user_id: user.id,
      p_amount_cents: amountCents,
    })
    console.error('[cashout] Strike payout failed — balance refunded', err)
    return NextResponse.json({ error: 'Payout failed. Your balance has been restored.' }, { status: 502 })
  }

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
    newBalanceCents: remainingBalance,
  })
}
