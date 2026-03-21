import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { verifyChallenge } from '@/lib/bitcoin/wallet-auth'
import type { UserRow, WalletType } from '@/types/database'

async function createSessionForUser(email: string): Promise<{ accessToken: string; refreshToken: string } | null> {
  const service = await createServiceClient()
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!

  // Generate a magic link (admin call — does NOT send email)
  const { data: linkData, error: linkError } = await service.auth.admin.generateLink({
    type: 'magiclink',
    email,
  })
  if (linkError || !linkData) {
    console.error('[wallet/verify] generateLink failed', linkError)
    return null
  }

  // Extract the token from the action_link
  const actionUrl = new URL(linkData.properties.action_link)
  const token = actionUrl.searchParams.get('token')
  if (!token) return null

  // Exchange token for a session via GoTrue REST
  // Using redirect:manual so we can extract tokens from the Location header
  const verifyUrl = `${supabaseUrl}/auth/v1/verify?token=${encodeURIComponent(token)}&type=magiclink`
  const verifyRes = await fetch(verifyUrl, {
    method: 'GET',
    redirect: 'manual',
    headers: { apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY! },
  })

  // GoTrue redirects to redirect_to#access_token=...&refresh_token=...
  const location = verifyRes.headers.get('location')
  if (!location) return null

  // Tokens can be in hash fragment or query params depending on GoTrue version
  let params: URLSearchParams
  try {
    const locUrl = new URL(location)
    // Try fragment first (standard OAuth)
    params = new URLSearchParams(locUrl.hash.slice(1))
    if (!params.get('access_token')) {
      // Fall back to query string
      params = locUrl.searchParams
    }
  } catch {
    // location may be a relative URL like /browse#access_token=...
    const hashIdx = location.indexOf('#')
    const qIdx = location.indexOf('?')
    if (hashIdx !== -1) {
      params = new URLSearchParams(location.slice(hashIdx + 1))
    } else if (qIdx !== -1) {
      params = new URLSearchParams(location.slice(qIdx + 1))
    } else {
      return null
    }
  }

  const accessToken = params.get('access_token')
  const refreshToken = params.get('refresh_token')
  if (!accessToken || !refreshToken) return null

  return { accessToken, refreshToken }
}

export async function POST(request: Request) {
  const { walletAddress, signature, message, walletType } = await request.json()

  if (!walletAddress || !signature || !message) {
    return NextResponse.json({ error: 'walletAddress, signature, and message are required' }, { status: 400 })
  }

  const valid = await verifyChallenge(walletAddress, signature, message)
  if (!valid) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const service = await createServiceClient()

  // Look up existing user by wallet address
  const { data: rawUser } = await service
    .from('users')
    .select('*')
    .eq('btc_wallet_address', walletAddress)
    .maybeSingle()
  const existingUser = rawUser as UserRow | null

  let userEmail: string
  let isNewUser: boolean

  if (existingUser) {
    // Get email from auth.users for this profile
    const { data: authUser } = await service.auth.admin.getUserById(existingUser.id)
    userEmail = authUser.user?.email ?? ''
    isNewUser = false
  } else {
    // Create new Supabase auth user with synthetic email
    const syntheticEmail = `${walletAddress.toLowerCase().replace(/[^a-z0-9]/g, '_')}@wallet.lobsterlist.invalid`
    const { data: newAuthUser, error: createError } = await service.auth.admin.createUser({
      email: syntheticEmail,
      email_confirm: true,
      user_metadata: { name: `user_${walletAddress.slice(-6)}` },
    })

    if (createError || !newAuthUser.user) {
      console.error('[wallet/verify] failed to create user', createError)
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    userEmail = syntheticEmail

    // Update the users row created by the DB trigger
    await service.from('users').update({
      btc_wallet_address: walletAddress,
      wallet_type: (walletType as WalletType) ?? null,
      auth_method: 'wallet',
      name: `user_${walletAddress.slice(-6)}`,
    }).eq('id', newAuthUser.user.id)

    isNewUser = true
  }

  // Create session via magic link exchange
  const session = await createSessionForUser(userEmail)
  if (!session) {
    console.error('[wallet/verify] failed to create session for', userEmail)
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  return NextResponse.json({
    accessToken: session.accessToken,
    refreshToken: session.refreshToken,
    isNewUser,
  })
}
