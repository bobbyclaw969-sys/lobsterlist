import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import type { LightningInvoiceRow } from '@/types/database'

/**
 * Strike webhook handler.
 * Strike calls this when an invoice is paid.
 *
 * Payload shape (Strike webhook):
 * {
 *   eventType: "invoice.updated",
 *   data: { entityId: "<strike_invoice_id>", invoice: { state: "PAID", ... } }
 * }
 *
 * We verify the webhook signature using STRIKE_WEBHOOK_SECRET,
 * then update our DB accordingly.
 */
export async function POST(request: Request) {
  const rawBody = await request.text()

  // Signature verification (when STRIKE_WEBHOOK_SECRET is set)
  const secret = process.env.STRIKE_WEBHOOK_SECRET
  if (secret) {
    const signature = request.headers.get('x-strike-signature')
    if (!signature) {
      return NextResponse.json({ error: 'Missing signature' }, { status: 401 })
    }

    // Strike uses HMAC-SHA256
    const encoder = new TextEncoder()
    const key = await crypto.subtle.importKey(
      'raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
    )
    const sig = await crypto.subtle.sign('HMAC', key, encoder.encode(rawBody))
    const expected = Buffer.from(sig).toString('hex')
    if (signature !== expected) {
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
    }
  }

  const payload = JSON.parse(rawBody)

  if (payload.eventType !== 'invoice.updated') {
    return NextResponse.json({ ok: true }) // ignore other event types
  }

  const strikeInvoiceId: string = payload.data?.entityId
  const state: string = payload.data?.invoice?.state

  if (!strikeInvoiceId || state !== 'PAID') {
    return NextResponse.json({ ok: true })
  }

  const service = await createServiceClient()

  // Find our invoice record
  const { data: rawInvoice } = await service
    .from('lightning_invoices')
    .select('*')
    .eq('strike_invoice_id', strikeInvoiceId)
    .maybeSingle()
  const invoice = rawInvoice as LightningInvoiceRow | null

  if (!invoice || invoice.status === 'paid') {
    return NextResponse.json({ ok: true }) // already processed or unknown
  }

  // Mark invoice as paid
  await service
    .from('lightning_invoices')
    .update({ status: 'paid', paid_at: new Date().toISOString() })
    .eq('id', invoice.id)

  // Act based on invoice type
  if (invoice.invoice_type === 'agent_registration') {
    const agentId = invoice.entity_id

    // Verify the agent
    const { data: agent } = await service.from('agents').select('owner_id, name').eq('id', agentId).single()
    if (agent) {
      await service.from('agents').update({
        verified: true,
        verified_at: new Date().toISOString(),
      }).eq('id', agentId)

      // Record transaction for the owner
      await service.from('transactions').insert({
        user_id: agent.owner_id,
        tx_type: 'registration_fee',
        amount_sats: invoice.amount_sats,
        reference_id: invoice.id,
      })
    }

  } else if (invoice.invoice_type === 'listing_fee') {
    const listingId = invoice.entity_id

    // Activate the listing
    await service.from('listings').update({
      status: 'open',
      post_fee_paid: true,
    }).eq('id', listingId)

    // Record transaction for the creator
    const { data: listing } = await service
      .from('listings')
      .select('creator_user_id')
      .eq('id', listingId)
      .single()

    if (listing?.creator_user_id) {
      await service.from('transactions').insert({
        user_id: listing.creator_user_id,
        tx_type: 'listing_fee',
        amount_sats: invoice.amount_sats,
        reference_id: invoice.id,
      })
    }

  } else if (invoice.invoice_type === 'trust_deposit') {
    // Mark trust deposit as paid; update user record
    const userId = invoice.entity_id
    await service.from('trust_deposits').update({
      status: 'paid',
    }).eq('user_id', userId)
    await service.from('users').update({
      trust_deposit_paid: true,
      trust_deposit_sats: invoice.amount_sats,
    }).eq('id', userId)

  } else if (invoice.invoice_type === 'verification') {
    // 1 sat proof-of-life payment — mark user as verified
    const userId = invoice.entity_id
    await service.from('users').update({
      is_verified: true,
      verification_method: 'sat_payment',
    }).eq('id', userId)

  } else if (invoice.invoice_type === 'escrow_funding') {
    // Mark escrow contract as funded
    const contractId = invoice.entity_id
    await service.from('escrow_contracts').update({
      status: 'funded',
      funded_at: new Date().toISOString(),
    }).eq('id', contractId)

    // Update listing status to claimed
    const { data: contract } = await service
      .from('escrow_contracts')
      .select('listing_id, buyer_user_id')
      .eq('id', contractId)
      .single()

    if (contract) {
      await service.from('listings').update({
        status: 'claimed',
        claimed_by_user_id: contract.buyer_user_id,
        claimed_at: new Date().toISOString(),
      }).eq('id', contract.listing_id)
    }
  }

  return NextResponse.json({ ok: true })
}
