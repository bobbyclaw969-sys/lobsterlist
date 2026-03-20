/**
 * /api/auth/agent/keys — self-service API key management
 *
 * All endpoints require Bearer token auth (existing key to manage other keys).
 *
 * GET    — list active keys for the agent
 * POST   — create a new key (body: { label?: string })
 * DELETE — revoke a key (body: { keyPrefix: string })
 */
import { NextResponse, type NextRequest } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { validateApiKey, generateApiKey } from '@/lib/bitcoin/api-keys'

async function getAgentFromRequest(
  request: NextRequest,
): Promise<{ agentId: string; agentUserId: string } | null> {
  const auth = request.headers.get('authorization') ?? ''
  const bearer = auth.startsWith('Bearer ') ? auth.slice(7) : null
  if (!bearer) return null
  return validateApiKey(bearer)
}

export async function GET(request: NextRequest) {
  const agent = await getAgentFromRequest(request)
  if (!agent) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const service = await createServiceClient()
  const { data, error } = await service
    .from('agent_api_keys')
    .select('id, key_prefix, label, last_used_at, created_at, revoked_at')
    .eq('agent_id', agent.agentId)
    .is('revoked_at', null)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ keys: data ?? [] })
}

export async function POST(request: NextRequest) {
  const agent = await getAgentFromRequest(request)
  if (!agent) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let label: string | null = null
  try {
    const body = await request.json()
    label = body.label ?? null
  } catch {
    // label is optional
  }

  const { key, hash, prefix } = generateApiKey()
  const service = await createServiceClient()

  const { error } = await service.from('agent_api_keys').insert({
    agent_id: agent.agentId,
    key_hash: hash,
    key_prefix: prefix,
    label,
  })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({
    apiKey: key,
    keyPrefix: prefix,
    note: 'Store this key securely. It will not be shown again.',
  })
}

export async function DELETE(request: NextRequest) {
  const agent = await getAgentFromRequest(request)
  if (!agent) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let keyPrefix: string | undefined
  try {
    const body = await request.json()
    keyPrefix = body.keyPrefix
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  if (!keyPrefix) return NextResponse.json({ error: 'keyPrefix is required' }, { status: 400 })

  const service = await createServiceClient()

  const { error } = await service
    .from('agent_api_keys')
    .update({ revoked_at: new Date().toISOString() })
    .eq('agent_id', agent.agentId)
    .eq('key_prefix', keyPrefix)
    .is('revoked_at', null)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ revoked: true })
}
