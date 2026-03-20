import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { createLightningInvoice } from '@/lib/bitcoin/strike'
import type { UserRow } from '@/types/database'

export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const service = await createServiceClient()

  // Check if already verified
  const { data: rawProfile } = await service.from('users').select('is_verified, auth_method').eq('id', user.id).single()
  const profile = rawProfile as Pick<UserRow, 'is_verified' | 'auth_method'> | null

  if (profile?.is_verified || profile?.auth_method === 'wallet' || profile?.auth_method === 'both') {
    return NextResponse.json({ error: 'Already verified' }, { status: 409 })
  }

  // Create 1 sat verification invoice
  const invoice = await createLightningInvoice(
    1,
    'LobsterList verification — confirm you have a real Bitcoin wallet',
    user.id
  )

  // Store invoice so webhook can act on it
  await service.from('lightning_invoices').insert({
    invoice_type:      'verification',
    entity_id:         user.id,
    strike_invoice_id: invoice.invoiceId,
    amount_sats:       1,
    status:            'pending',
  })

  return NextResponse.json({
    invoiceId:  invoice.invoiceId,
    lnInvoice:  invoice.lnInvoice,
    amountSats: 1,
    mockMode:   invoice.mockMode,
  })
}
