/**
 * /api/agent/listings — agent listing management via API
 *
 * GET  — list this agent's listings
 * POST — create a new listing
 *
 * Auth: Bearer ll_...
 */
import { NextResponse, type NextRequest } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { getAgentContext } from '@/lib/supabase/agent-auth'
import { getBtcPriceUsd } from '@/lib/utils/sats'
import { calculateFees } from '@/lib/bitcoin/fees'
import type { AgentRow, ListingCategory } from '@/types/database'

export async function GET(request: NextRequest) {
  const agent = getAgentContext(request)
  if (!agent) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const service = await createServiceClient()
  const { data, error } = await service
    .from('listings')
    .select('*, listing_jobs(*), listing_gigs(*), listing_services(*), listing_goods(*)')
    .eq('creator_agent_id', agent.agentId)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ listings: data ?? [] })
}

export async function POST(request: NextRequest) {
  const agentCtx = getAgentContext(request)
  if (!agentCtx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: {
    title?: string
    description?: string
    category?: string
    price_sats?: number
    tags?: string[]
    image_url?: string | null
  }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { title, description, category, price_sats, tags, image_url } = body

  // Validation
  if (!title || title.length < 5)        return NextResponse.json({ error: 'title must be at least 5 characters' }, { status: 422 })
  if (!description || description.length < 20) return NextResponse.json({ error: 'description must be at least 20 characters' }, { status: 422 })
  if (!['job', 'gig', 'service', 'good'].includes(category ?? '')) return NextResponse.json({ error: 'category must be job | gig | service | good' }, { status: 422 })
  if (!price_sats || price_sats < 1)     return NextResponse.json({ error: 'price_sats must be at least 1' }, { status: 422 })

  const service = await createServiceClient()

  // Verify agent ownership + verification
  const { data: rawAgent } = await service.from('agents').select('*').eq('id', agentCtx.agentId).single()
  if (!rawAgent) return NextResponse.json({ error: 'Agent not found' }, { status: 404 })
  const agent = rawAgent as AgentRow

  if (!agent.verified) {
    return NextResponse.json({ error: 'Agent must complete registration before posting' }, { status: 402 })
  }

  // Spending limit check
  const btcPrice = await getBtcPriceUsd()
  const fees = calculateFees(price_sats, btcPrice)
  if (agent.spending_limit_sats > 0) {
    if (agent.sats_spent_total + fees.totalAgentCostSats > agent.spending_limit_sats) {
      return NextResponse.json({
        error: 'Spending limit exceeded',
        spending: {
          limit_sats: agent.spending_limit_sats,
          spent_sats: agent.sats_spent_total,
          required_sats: fees.totalAgentCostSats,
        },
      }, { status: 402 })
    }
  }

  const { data: listing, error: insertError } = await service
    .from('listings')
    .insert({
      title,
      description,
      category:         category as ListingCategory,
      price_sats,
      tags:             tags ?? [],
      creator_agent_id: agentCtx.agentId,
      image_url:        image_url ?? null,
    })
    .select('id, title, category, price_sats, status, created_at')
    .single()

  if (insertError || !listing) {
    return NextResponse.json({ error: insertError?.message ?? 'Insert failed' }, { status: 500 })
  }

  return NextResponse.json({
    listing,
    fees: {
      budget_sats:           price_sats,
      platform_fee_sats:     fees.platformFeeSats,
      total_agent_cost_sats: fees.totalAgentCostSats,
    },
  }, { status: 201 })
}
