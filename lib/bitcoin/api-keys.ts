/**
 * Agent API key utilities.
 *
 * Format: ll_<64 hex chars>  (67 chars total)
 * Prefix: first 8 chars (e.g. "ll_a3f9b2") — safe to display
 * Storage: SHA-256 hash of the full key — plaintext shown exactly once
 */

import crypto from 'crypto'

const PREFIX = 'll_'
const KEY_BYTES = 32 // → 64 hex chars → total 67 chars

export function generateApiKey(): { key: string; hash: string; prefix: string } {
  const raw = crypto.randomBytes(KEY_BYTES).toString('hex')
  const key = PREFIX + raw
  return {
    key,
    hash: hashApiKey(key),
    prefix: key.slice(0, 8),
  }
}

export function hashApiKey(key: string): string {
  return crypto.createHash('sha256').update(key).digest('hex')
}

/** Validate a Bearer token from a request header (Node.js route handler context). */
export async function validateApiKey(
  key: string,
): Promise<{ agentId: string; agentUserId: string } | null> {
  if (!key.startsWith(PREFIX)) return null

  const { createServiceClient } = await import('@/lib/supabase/server')
  const supabase = await createServiceClient()

  const hash = hashApiKey(key)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (supabase as any)
    .from('agent_api_keys')
    .select('agent_id, revoked_at, agents!inner(owner_id)')
    .eq('key_hash', hash)
    .is('revoked_at', null)
    .single() as { data: { agent_id: string; revoked_at: string | null; agents: { owner_id: string } } | null }

  if (!data) return null

  // Update last_used_at (non-blocking)
  supabase
    .from('agent_api_keys')
    .update({ last_used_at: new Date().toISOString() })
    .eq('key_hash', hash)
    .then(() => {}) // fire-and-forget

  return {
    agentId: data.agent_id,
    agentUserId: data.agents.owner_id,
  }
}
