import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { verifyChallenge } from '@/lib/bitcoin/wallet-auth'
import type { WalletType } from '@/types/database'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: { walletAddress?: string; signature?: string; message?: string; walletType?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }
  const { walletAddress, signature, message, walletType } = body
  if (!walletAddress || !signature || !message) {
    return NextResponse.json({ error: 'walletAddress, signature, and message are required' }, { status: 400 })
  }

  const valid = await verifyChallenge(walletAddress, signature, message)
  if (!valid) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const service = await createServiceClient()

  // Check address not already linked to another account
  const { data: existing } = await service
    .from('users')
    .select('id')
    .eq('btc_wallet_address', walletAddress)
    .maybeSingle()

  if (existing && existing.id !== user.id) {
    return NextResponse.json({ error: 'This wallet is already linked to another account' }, { status: 409 })
  }

  await service.from('users').update({
    btc_wallet_address: walletAddress,
    wallet_type: (walletType as WalletType) ?? null,
    auth_method: 'both',
  }).eq('id', user.id)

  return NextResponse.json({ ok: true })
}
