/**
 * Agent auth helpers for route handlers.
 *
 * When a request comes in with a valid Bearer API key, proxy.ts injects:
 *   x-agent-id      — agents.id
 *   x-agent-user-id — agents.owner_id (the synthetic Supabase user)
 *   x-is-agent      — 'true'
 *
 * Route handlers call getAgentContext() to get these values without
 * touching the database again (proxy already validated the key).
 */
import type { NextRequest } from 'next/server'

export type AgentContext = {
  agentId: string
  agentUserId: string
  isAgent: true
}

/** Returns agent context if request was authenticated via Bearer key, otherwise null. */
export function getAgentContext(request: NextRequest | Request): AgentContext | null {
  const headers = request.headers

  const agentId = headers.get('x-agent-id')
  const agentUserId = headers.get('x-agent-user-id')
  const isAgent = headers.get('x-is-agent') === 'true'

  if (!isAgent || !agentId || !agentUserId) return null

  return { agentId, agentUserId, isAgent: true }
}

/** True if the response should be JSON (agent or explicit Accept: application/json). */
export function wantsJson(request: NextRequest | Request): boolean {
  const hdrs = request.headers
  const accept = hdrs.get('accept') ?? ''
  const isAgent = hdrs.get('x-is-agent') === 'true'
  return isAgent || accept.includes('application/json')
}
