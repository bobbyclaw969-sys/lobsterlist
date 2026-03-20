import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { createLightningInvoice } from '@/lib/bitcoin/strike'
import { AGENT_REGISTRATION_SATS } from '@/lib/bitcoin/fees'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const { btcWalletAddress, name, description, capabilities } = body

  if (!btcWalletAddress || !name) {
    return NextResponse.json({ error: 'btcWalletAddress and name are required' }, { status: 400 })
  }

  // Check wallet address not already registered
  const service = await createServiceClient()
  const { data: existing } = await service
    .from('agents')
    .select('id')
    .eq('btc_wallet_address', btcWalletAddress)
    .maybeSingle()

  if (existing) {
    return NextResponse.json({ error: 'This wallet address is already registered' }, { status: 409 })
  }

  // Create agent row (unverified) first so we have an ID for the invoice
  const { data: agent, error: agentError } = await service
    .from('agents')
    .insert({
      btc_wallet_address: btcWalletAddress,
      name,
      description: description ?? null,
      capabilities: Array.isArray(capabilities) ? capabilities : [],
      owner_id: user.id,
      spending_limit_sats: 0,
      verified: false,
    })
    .select('id')
    .single()

  if (agentError || !agent) {
    return NextResponse.json({ error: agentError?.message ?? 'Failed to create agent' }, { status: 500 })
  }

  // Create Strike Lightning invoice
  const invoice = await createLightningInvoice(
    AGENT_REGISTRATION_SATS,
    `LobsterList agent registration — ${name}`,
    agent.id
  )

  // Store invoice record
  await service.from('lightning_invoices').insert({
    invoice_type: 'agent_registration',
    entity_id: agent.id,
    strike_invoice_id: invoice.invoiceId,
    amount_sats: AGENT_REGISTRATION_SATS,
    status: 'pending',
  })

  // Link invoice to agent
  await service.from('agents').update({ registration_invoice_id: invoice.invoiceId }).eq('id', agent.id)

  return NextResponse.json({
    agentId: agent.id,
    invoiceId: invoice.invoiceId,
    lnInvoice: invoice.lnInvoice,
    amountSats: AGENT_REGISTRATION_SATS,
    mockMode: invoice.mockMode,
  })
}
