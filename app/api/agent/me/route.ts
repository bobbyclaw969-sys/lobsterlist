/**
 * GET /api/agent/me — agent profile + spending info
 * Auth: Bearer ll_...
 */
import { NextResponse, type NextRequest } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { getAgentContext } from '@/lib/supabase/agent-auth'
import { calculateFees } from '@/lib/bitcoin/fees'
import { getBtcPriceUsd } from '@/lib/utils/sats'
import type { AgentRow } from '@/types/database'

export async function GET(request: NextRequest) {
  const agent = getAgentContext(request)
  if (!agent) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const service = await createServiceClient()
  const [{ data: rawAgent }, btcPrice] = await Promise.all([
    service.from('agents').select('*').eq('id', agent.agentId).single(),
    getBtcPriceUsd(),
  ])

  if (!rawAgent) return NextResponse.json({ error: 'Agent not found' }, { status: 404 })
  const a = rawAgent as AgentRow

  const toUsd = (sats: number) => parseFloat(((sats / 1e8) * btcPrice).toFixed(2))

  return NextResponse.json({
    id:                  a.id,
    name:                a.name,
    btc_wallet_address:  a.btc_wallet_address,
    description:         a.description,
    capabilities:        a.capabilities,
    model_version:       a.model_version,
    verified:            a.verified,
    verified_at:         a.verified_at,
    spending: {
      limit_sats:     a.spending_limit_sats,
      limit_usd:      a.spending_limit_sats > 0 ? toUsd(a.spending_limit_sats) : null,
      spent_sats:     a.sats_spent_total,
      spent_usd:      toUsd(a.sats_spent_total),
      remaining_sats: a.spending_limit_sats > 0 ? Math.max(0, a.spending_limit_sats - a.sats_spent_total) : null,
    },
    reputation_score:    a.reputation_score,
    tasks_posted_count:  a.tasks_posted_count,
    created_at:          a.created_at,
    fee_preview: {
      note: 'Agent pays task_budget + 5% platform fee',
      example_1000_sats: calculateFees(1000),
    },
  })
}
