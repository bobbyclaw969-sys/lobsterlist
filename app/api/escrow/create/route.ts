import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { createEscrowContract } from '@/lib/bitcoin/bitescrow'
import { createLightningInvoice } from '@/lib/bitcoin/strike'
import { calculatePlatformFee } from '@/lib/bitcoin/fees'
import type { ListingRow, AgentRow } from '@/types/database'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const { listingId, buyerAgentId } = body  // buyerAgentId optional — if claiming via agent

  if (!listingId) return NextResponse.json({ error: 'listingId required' }, { status: 400 })

  const service = await createServiceClient()

  // Fetch listing
  const { data: rawListing } = await service.from('listings').select('*').eq('id', listingId).single()
  if (!rawListing) return NextResponse.json({ error: 'Listing not found' }, { status: 404 })
  const listing = rawListing as ListingRow

  if (listing.status !== 'open') {
    return NextResponse.json({ error: 'Listing is not available to claim' }, { status: 409 })
  }

  // Cannot claim own listing
  if (listing.creator_user_id === user.id) {
    return NextResponse.json({ error: 'You cannot claim your own listing' }, { status: 400 })
  }

  // If claiming via agent, verify ownership + spending limit
  if (buyerAgentId) {
    const { data: rawAgent } = await service.from('agents').select('*').eq('id', buyerAgentId).single()
    if (!rawAgent) return NextResponse.json({ error: 'Agent not found' }, { status: 404 })
    const agent = rawAgent as AgentRow

    if (agent.owner_id !== user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    if (!agent.verified) return NextResponse.json({ error: 'Agent not verified — pay registration fee first' }, { status: 402 })

    // Spending limit check
    if (agent.spending_limit_sats > 0) {
      const newTotal = agent.sats_spent_total + listing.price_sats
      if (newTotal > agent.spending_limit_sats) {
        return NextResponse.json({
          error: `Spending limit exceeded. Limit: ${agent.spending_limit_sats} sats, spent: ${agent.sats_spent_total}, needed: ${listing.price_sats}`,
        }, { status: 402 })
      }
    }
  }

  const platformFee = calculatePlatformFee(listing.price_sats)

  // Determine seller IDs
  const sellerUserId = listing.creator_user_id ?? null
  const sellerAgentId = listing.creator_agent_id ?? null

  // Create mock escrow contract — HTLC escrow via Lightning node in Phase 4
  const escrow = await createEscrowContract({
    listingId,
    buyerId: buyerAgentId ?? user.id,
    sellerId: sellerUserId ?? sellerAgentId ?? user.id,
    amountSats: listing.price_sats,
    platformFeeSats: platformFee,
    description: listing.title,
  })

  // Store escrow contract
  const { data: contract, error: contractError } = await service
    .from('escrow_contracts')
    .insert({
      listing_id: listingId,
      bitescrow_cid: escrow.cid,
      buyer_user_id: buyerAgentId ? null : user.id,
      buyer_agent_id: buyerAgentId ?? null,
      seller_user_id: sellerUserId,
      seller_agent_id: sellerAgentId,
      amount_sats: listing.price_sats,
      platform_fee_sats: platformFee,
      status: 'pending_funding',
    })
    .select('id')
    .single()

  if (contractError || !contract) {
    return NextResponse.json({ error: contractError?.message ?? 'Failed to create contract' }, { status: 500 })
  }

  // Mark listing as claimed so no other buyer can race to claim it
  await service.from('listings').update({ status: 'claimed' }).eq('id', listingId)

  // Create Lightning invoice for escrow funding
  const invoice = await createLightningInvoice(
    listing.price_sats,
    `LobsterList escrow — ${listing.title}`,
    contract.id
  )

  // Store invoice
  await service.from('lightning_invoices').insert({
    invoice_type: 'escrow_funding',
    entity_id: contract.id,
    strike_invoice_id: invoice.invoiceId,
    amount_sats: listing.price_sats,
    status: 'pending',
  })

  return NextResponse.json({
    contractId: contract.id,
    bitescrowCid: escrow.cid,
    invoiceId: invoice.invoiceId,
    lnInvoice: invoice.lnInvoice,
    amountSats: listing.price_sats,
    platformFeeSats: platformFee,
    mockMode: invoice.mockMode,
  })
}
