import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { createEscrowContract } from '@/lib/bitcoin/bitescrow'
import { createLightningInvoice } from '@/lib/bitcoin/strike'
import { calculateFees, needsTrustDeposit, TRUST_DEPOSIT_SATS } from '@/lib/bitcoin/fees'
import type { ListingRow, AgentRow, UserRow } from '@/types/database'

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

    // Agents pay total cost (budget + 5% fee) against their spending limit
    const fees = calculateFees(listing.price_sats)
    if (agent.spending_limit_sats > 0) {
      const newTotal = agent.sats_spent_total + fees.totalAgentCostSats
      if (newTotal > agent.spending_limit_sats) {
        return NextResponse.json({
          error: `Spending limit exceeded. Limit: ${agent.spending_limit_sats} sats, spent: ${agent.sats_spent_total}, needed: ${fees.totalAgentCostSats} (budget + 5% fee)`,
        }, { status: 402 })
      }
    }
  }

  // ── Trust Deposit gate (humans only, first-time claimers) ─────────────────
  // Trust Deposit = 2,100 sat collateral. NOT a fee. Returned after 10 completions.
  if (!buyerAgentId) {
    const { data: rawProfile } = await service.from('users').select('trust_deposit_paid').eq('id', user.id).single()
    const profile = rawProfile as Pick<UserRow, 'trust_deposit_paid'> | null

    if (profile && needsTrustDeposit(profile)) {
      // Check if there's already a pending trust deposit invoice
      const { data: existing } = await service
        .from('trust_deposits')
        .select('invoice_id, status')
        .eq('user_id', user.id)
        .maybeSingle()

      if (!existing || existing.status === 'pending') {
        // Create the Trust Deposit Lightning invoice
        const trustInvoice = await createLightningInvoice(
          TRUST_DEPOSIT_SATS,
          'LobsterList Trust Deposit — returned after 10 completed tasks',
          user.id
        )

        // Store or update trust_deposits record
        if (!existing) {
          await service.from('trust_deposits').insert({
            user_id: user.id,
            amount_sats: TRUST_DEPOSIT_SATS,
            invoice_id: trustInvoice.invoiceId,
            status: 'pending',
          })
        } else {
          await service.from('trust_deposits').update({
            invoice_id: trustInvoice.invoiceId,
          }).eq('user_id', user.id)
        }

        // Store in lightning_invoices so webhook can act on it
        await service.from('lightning_invoices').insert({
          invoice_type: 'trust_deposit',
          entity_id: user.id,
          strike_invoice_id: trustInvoice.invoiceId,
          amount_sats: TRUST_DEPOSIT_SATS,
          status: 'pending',
        })

        return NextResponse.json({
          trustDepositRequired: true,
          invoiceId: trustInvoice.invoiceId,
          lnInvoice: trustInvoice.lnInvoice,
          amountSats: TRUST_DEPOSIT_SATS,
          mockMode: trustInvoice.mockMode,
        })
      }
    }
  }

  // ── Fee calculation ────────────────────────────────────────────────────────
  // Human receives 100% of budget. Agent pays budget + 5% platform fee.
  const fees = calculateFees(listing.price_sats)

  // Determine seller IDs
  const sellerUserId  = listing.creator_user_id ?? null
  const sellerAgentId = listing.creator_agent_id ?? null

  // Create mock escrow contract — HTLC escrow via Lightning node in Phase 4
  const escrow = await createEscrowContract({
    listingId,
    buyerId: buyerAgentId ?? user.id,
    sellerId: sellerUserId ?? sellerAgentId ?? user.id,
    amountSats: listing.price_sats,       // budget = human payout
    platformFeeSats: fees.platformFeeSats, // 5% charged to agent
    description: listing.title,
  })

  // Store escrow contract
  // amount_sats = budget = what human earns (100%)
  // platform_fee_sats = 5% charged to agent on top
  const { data: contract, error: contractError } = await service
    .from('escrow_contracts')
    .insert({
      listing_id:         listingId,
      bitescrow_cid:      escrow.cid,
      buyer_user_id:      buyerAgentId ? null : user.id,
      buyer_agent_id:     buyerAgentId ?? null,
      seller_user_id:     sellerUserId,
      seller_agent_id:    sellerAgentId,
      amount_sats:        listing.price_sats,       // human payout = 100% of budget
      platform_fee_sats:  fees.platformFeeSats,     // 5% on top, paid by agent
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
  // Agent pays: budget + platform fee = totalAgentCostSats
  const invoiceAmountSats = fees.totalAgentCostSats
  const invoice = await createLightningInvoice(
    invoiceAmountSats,
    `LobsterList escrow — ${listing.title}`,
    contract.id
  )

  // Store invoice
  await service.from('lightning_invoices').insert({
    invoice_type:      'escrow_funding',
    entity_id:         contract.id,
    strike_invoice_id: invoice.invoiceId,
    amount_sats:       invoiceAmountSats,
    status:            'pending',
  })

  return NextResponse.json({
    contractId:        contract.id,
    bitescrowCid:      escrow.cid,
    invoiceId:         invoice.invoiceId,
    lnInvoice:         invoice.lnInvoice,
    amountSats:        listing.price_sats,      // budget (what human earns)
    totalAmountSats:   invoiceAmountSats,        // what agent actually pays
    platformFeeSats:   fees.platformFeeSats,
    mockMode:          invoice.mockMode,
  })
}
