/**
 * POST /api/auth/agent/verify
 *
 * Step 2 of 2 — verify wallet signature and return an API key.
 * No human, no email, no session required.
 *
 * Body: {
 *   walletAddress: string
 *   signature: string
 *   message: string
 *   name?: string          // agent display name (new agents only)
 *   capabilities?: string[]
 *   modelVersion?: string
 *   label?: string         // key label for self-service management
 * }
 *
 * Returns: { apiKey: string, agentId: string, isNewAgent: boolean }
 * The apiKey is shown ONCE — store it securely.
 */
import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { verifyChallenge } from '@/lib/bitcoin/wallet-auth'
import { generateApiKey } from '@/lib/bitcoin/api-keys'
import { checkRateLimit } from '@/lib/rate-limit'
import type { AgentRow } from '@/types/database'

export async function POST(request: Request) {
  let body: {
    walletAddress?: string
    signature?: string
    message?: string
    agentName?: string
    capabilities?: string[]
    modelVersion?: string
    label?: string
  }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { walletAddress, signature, message, agentName: name, capabilities, modelVersion, label } = body

  if (!walletAddress || !signature || !message) {
    return NextResponse.json(
      { error: 'walletAddress, signature, and message are required' },
      { status: 400 },
    )
  }

  // Rate limit: 10 verify attempts per wallet per minute, 20 per IP per minute
  const clientIp = request.headers.get('x-forwarded-for') ?? request.headers.get('x-real-ip') ?? 'unknown'
  const [walletRateOk, ipRateOk] = await Promise.all([
    checkRateLimit(`verify:wallet:${walletAddress}`, 10, 60),
    checkRateLimit(`verify:ip:${clientIp}`, 20, 60),
  ])
  if (!walletRateOk || !ipRateOk) {
    return NextResponse.json({ error: 'Too many attempts. Try again later.' }, { status: 429 })
  }

  // Verify the wallet signature — generic 401 on any failure
  const valid = await verifyChallenge(walletAddress, signature, message)
  if (!valid) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const service = await createServiceClient()

  // Look up existing agent by wallet address
  const { data: rawAgent } = await service
    .from('agents')
    .select('*')
    .eq('btc_wallet_address', walletAddress)
    .single()

  let agent = rawAgent as AgentRow | null
  let isNewAgent = false

  if (!agent) {
    isNewAgent = true

    // Create a synthetic Supabase auth user for this agent
    // Uses a deterministic email that can never collide with real email users
    const agentEmail = `${walletAddress}@agent.lobsterlist.invalid`
    const { data: authData, error: authError } = await service.auth.admin.createUser({
      email: agentEmail,
      email_confirm: true,
      user_metadata: { is_agent: true, btc_wallet_address: walletAddress },
    })

    if (authError || !authData?.user) {
      // May already exist if a previous partial registration happened.
      // Use GoTrue admin REST with email filter — avoids listUsers() pagination cap.
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
      const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
      const adminRes = await fetch(
        `${supabaseUrl}/auth/v1/admin/users?email=${encodeURIComponent(agentEmail)}&page=1&per_page=1`,
        { headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` } },
      )
      const adminData = adminRes.ok
        ? (await adminRes.json() as { users?: Array<{ id: string }> })
        : { users: [] }
      const existing = adminData.users?.[0] ?? null
      if (!existing) {
        console.error('[agent/verify] createUser failed', authError)
        return NextResponse.json({ error: 'Failed to create agent account' }, { status: 500 })
      }
      // Use existing auth user
      const ownerId = existing.id

      // Upsert users row
      await service.from('users').upsert(
        { id: ownerId, email: agentEmail, is_agent: true, name: name ?? `agent_${walletAddress.slice(-6)}` },
        { onConflict: 'id' },
      )

      // Create agent row
      const { data: newAgent, error: agentError } = await service
        .from('agents')
        .insert({
          btc_wallet_address: walletAddress,
          name: name ?? `agent_${walletAddress.slice(-6)}`,
          owner_id: ownerId,
          capabilities: capabilities ?? [],
          model_version: modelVersion ?? null,
          verified: true, // wallet signature = instant verification
          verified_at: new Date().toISOString(),
        })
        .select('*')
        .single()

      if (agentError || !newAgent) {
        console.error('[agent/verify] agent insert failed', agentError)
        return NextResponse.json({ error: 'Failed to create agent' }, { status: 500 })
      }
      agent = newAgent as AgentRow
    } else {
      const ownerId = authData.user.id

      // Upsert users row with is_agent flag
      await service.from('users').upsert(
        { id: ownerId, email: agentEmail, is_agent: true, name: name ?? `agent_${walletAddress.slice(-6)}` },
        { onConflict: 'id' },
      )

      // Create agent row
      const { data: newAgent, error: agentError } = await service
        .from('agents')
        .insert({
          btc_wallet_address: walletAddress,
          name: name ?? `agent_${walletAddress.slice(-6)}`,
          owner_id: ownerId,
          capabilities: capabilities ?? [],
          model_version: modelVersion ?? null,
          verified: true,
          verified_at: new Date().toISOString(),
        })
        .select('*')
        .single()

      if (agentError || !newAgent) {
        console.error('[agent/verify] agent insert failed', agentError)
        return NextResponse.json({ error: 'Failed to create agent' }, { status: 500 })
      }
      agent = newAgent as AgentRow
    }
  }

  // Generate a new API key for this agent
  const { key, hash, prefix } = generateApiKey()

  const { error: keyError } = await service.from('agent_api_keys').insert({
    agent_id: agent.id,
    key_hash: hash,
    key_prefix: prefix,
    label: label ?? null,
  })

  if (keyError) {
    console.error('[agent/verify] key insert failed', keyError)
    return NextResponse.json({ error: 'Failed to create API key' }, { status: 500 })
  }

  return NextResponse.json({
    apiKey: key,
    agentId: agent.id,
    isNewAgent,
    note: 'Store this API key securely. It will not be shown again.',
  })
}
