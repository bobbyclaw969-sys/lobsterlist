import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { disputeEscrowContract } from '@/lib/bitcoin/bitescrow'
import type { EscrowContractRow } from '@/types/database'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { contractId, reason } = await request.json()
  if (!contractId || !reason?.trim()) {
    return NextResponse.json({ error: 'contractId and reason are required' }, { status: 400 })
  }

  const service = await createServiceClient()
  const { data: raw } = await service.from('escrow_contracts').select('*').eq('id', contractId).single()
  if (!raw) return NextResponse.json({ error: 'Contract not found' }, { status: 404 })
  const contract = raw as EscrowContractRow

  if (!['funded'].includes(contract.status)) {
    return NextResponse.json({ error: `Cannot dispute a ${contract.status} contract` }, { status: 409 })
  }

  const isBuyer = contract.buyer_user_id === user.id
  const isSeller = contract.seller_user_id === user.id
  if (!isBuyer && !isSeller) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // Raise dispute — HTLC escrow via Lightning node in Phase 4
  if (contract.bitescrow_cid) {
    await disputeEscrowContract(contract.bitescrow_cid, reason)
  }

  // Update contract status
  await service.from('escrow_contracts').update({ status: 'disputed' }).eq('id', contractId)
  await service.from('listings').update({ status: 'disputed' }).eq('id', contract.listing_id)

  // Create dispute record
  await service.from('disputes').insert({
    contract_id: contractId,
    raised_by_user_id: user.id,
    reason: reason.trim(),
    status: 'open',
  })

  return NextResponse.json({ ok: true })
}
