/**
 * /api/auth/agent/keys-ui — key management for the human owner via cookie session
 *
 * Same operations as /api/auth/agent/keys but authenticated via Supabase session
 * (cookie) rather than Bearer token. Used by the agent dashboard UI.
 *
 * POST   — create a new key { agentId, label? }
 * DELETE — revoke a key { agentId, keyId }  ← UUID from the keys list
 */
import { NextResponse, type NextRequest } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { generateApiKey } from '@/lib/bitcoin/api-keys'
import type { AgentRow } from '@/types/database'

async function verifyOwnership(agentId: string, userId: string): Promise<AgentRow | null> {
  const service = await createServiceClient()
  const { data } = await service.from('agents').select('*').eq('id', agentId).single()
  if (!data) return null
  const agent = data as AgentRow
  if (agent.owner_id !== userId) return null
  return agent
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: { agentId?: string; label?: string | null }
  try { body = await request.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  if (!body.agentId) return NextResponse.json({ error: 'agentId required' }, { status: 400 })

  const agent = await verifyOwnership(body.agentId, user.id)
  if (!agent) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { key, hash, prefix } = generateApiKey()
  const service = await createServiceClient()

  const { data, error } = await service
    .from('agent_api_keys')
    .insert({ agent_id: agent.id, key_hash: hash, key_prefix: prefix, label: body.label ?? null })
    .select('id, key_prefix')
    .single()

  if (error || !data) return NextResponse.json({ error: error?.message ?? 'Insert failed' }, { status: 500 })

  return NextResponse.json({ apiKey: key, keyPrefix: prefix, id: data.id })
}

export async function DELETE(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: { agentId?: string; keyId?: string }
  try { body = await request.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  if (!body.agentId || !body.keyId) {
    return NextResponse.json({ error: 'agentId and keyId required' }, { status: 400 })
  }

  const agent = await verifyOwnership(body.agentId, user.id)
  if (!agent) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const service = await createServiceClient()
  const { error } = await service
    .from('agent_api_keys')
    .update({ revoked_at: new Date().toISOString() })
    .eq('agent_id', agent.id)
    .eq('id', body.keyId)
    .is('revoked_at', null)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ revoked: true })
}
