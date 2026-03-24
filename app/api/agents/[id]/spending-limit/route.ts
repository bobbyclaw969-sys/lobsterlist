import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: { spendingLimitSats?: string | number }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }
  const limit = parseInt(String(body.spendingLimitSats ?? ''), 10)
  if (isNaN(limit) || limit < 0) {
    return NextResponse.json({ error: 'Invalid spending limit' }, { status: 400 })
  }

  const service = await createServiceClient()

  // Verify ownership
  const { data: agent } = await service.from('agents').select('owner_id').eq('id', id).single()
  if (!agent || agent.owner_id !== user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  await service.from('agents').update({ spending_limit_sats: limit }).eq('id', id)

  return NextResponse.json({ ok: true, spendingLimitSats: limit })
}
