import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { createLightningInvoice } from '@/lib/bitcoin/strike'
import { LISTING_FEE_SATS } from '@/lib/bitcoin/fees'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const { listingId } = body

  if (!listingId) {
    return NextResponse.json({ error: 'listingId is required' }, { status: 400 })
  }

  const service = await createServiceClient()

  // Verify listing belongs to this user and is in pending_payment state
  const { data: listing } = await service
    .from('listings')
    .select('id, title, creator_user_id, status, post_fee_paid')
    .eq('id', listingId)
    .single()

  if (!listing) return NextResponse.json({ error: 'Listing not found' }, { status: 404 })
  if (listing.creator_user_id !== user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  if (listing.post_fee_paid) return NextResponse.json({ error: 'Listing fee already paid' }, { status: 409 })

  // Create Strike invoice
  const invoice = await createLightningInvoice(
    LISTING_FEE_SATS,
    `LobsterList listing fee — ${listing.title}`,
    listingId
  )

  // Store invoice record
  await service.from('lightning_invoices').insert({
    invoice_type: 'listing_fee',
    entity_id: listingId,
    strike_invoice_id: invoice.invoiceId,
    amount_sats: LISTING_FEE_SATS,
    status: 'pending',
  })

  // Link invoice to listing
  await service.from('listings').update({ post_invoice_id: invoice.invoiceId }).eq('id', listingId)

  return NextResponse.json({
    listingId,
    invoiceId: invoice.invoiceId,
    lnInvoice: invoice.lnInvoice,
    amountSats: LISTING_FEE_SATS,
    mockMode: invoice.mockMode,
  })
}
