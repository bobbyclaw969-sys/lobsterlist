import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { releaseEscrowContract } from '@/lib/bitcoin/bitescrow'
import type { EscrowContractRow } from '@/types/database'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { contractId } = await request.json()
  if (!contractId) return NextResponse.json({ error: 'contractId required' }, { status: 400 })

  const service = await createServiceClient()
  const { data: raw } = await service.from('escrow_contracts').select('*').eq('id', contractId).single()
  if (!raw) return NextResponse.json({ error: 'Contract not found' }, { status: 404 })
  const contract = raw as EscrowContractRow

  if (contract.status !== 'funded') {
    return NextResponse.json({ error: `Contract is ${contract.status}, not funded` }, { status: 409 })
  }

  // Only buyer or seller can mark complete
  const isBuyer = contract.buyer_user_id === user.id
  const isSeller = contract.seller_user_id === user.id
  if (!isBuyer && !isSeller) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // Release escrow — HTLC escrow via Lightning node in Phase 4
  if (contract.bitescrow_cid) {
    await releaseEscrowContract(contract.bitescrow_cid)
  }

  // Human receives 100% of the agreed budget (amount_sats).
  // Platform fee was charged to the agent on top and is separate.
  const sellerPayout = contract.amount_sats

  // Update contract status
  await service.from('escrow_contracts').update({
    status: 'completed',
    settled_at: new Date().toISOString(),
  }).eq('id', contractId)

  // Update listing status
  await service.from('listings').update({ status: 'completed' }).eq('id', contract.listing_id)

  // Credit seller's USD balance
  if (contract.seller_user_id) {
    // Fetch BTC price from cache
    const { data: priceCache } = await service.from('btc_price_cache').select('price_usd').eq('id', 1).single()
    const btcPrice = priceCache ? Number(priceCache.price_usd) : 85_000
    const usdCents = Math.round((sellerPayout / 100_000_000) * btcPrice * 100)

    const { data: seller } = await service.from('users').select('usd_balance_cents').eq('id', contract.seller_user_id).single()
    const currentBalance = (seller as { usd_balance_cents: number } | null)?.usd_balance_cents ?? 0
    await service.from('users').update({ usd_balance_cents: currentBalance + usdCents }).eq('id', contract.seller_user_id)

    // Record transaction
    await service.from('transactions').insert({
      user_id: contract.seller_user_id,
      tx_type: 'escrow_received',
      amount_sats: sellerPayout,
      usd_cents: usdCents,
      reference_id: contractId,
    })
  }

  return NextResponse.json({ ok: true, sellerPayoutSats: sellerPayout })
}
