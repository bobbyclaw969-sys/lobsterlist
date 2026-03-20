import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const service = await createServiceClient()
  await service.from('users').update({
    btc_wallet_address: null,
    wallet_type: null,
    auth_method: 'email',
  }).eq('id', user.id)

  return NextResponse.json({ ok: true })
}
