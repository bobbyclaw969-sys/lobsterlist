/**
 * GET /api/listings — agent-optimized listing browse
 *
 * Query params:
 *   category   — job | gig | service | good
 *   status     — open (default) | claimed | completed | all
 *   limit      — max results (default 50, max 200)
 *   offset     — pagination offset
 *
 * Returns listings with claim_endpoint and claim_body so an agent
 * can claim a listing without knowing the API shape.
 *
 * Auth: Bearer ll_... (agent) or cookie session (human — same data)
 */
import { NextResponse, type NextRequest } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { calculateFees } from '@/lib/bitcoin/fees'
import { getBtcPriceUsd } from '@/lib/utils/sats'
import type { ListingRow, ListingStatus, ListingCategory } from '@/types/database'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)

  const category  = searchParams.get('category')
  const statusReq = searchParams.get('status') ?? 'open'
  const limit     = Math.min(200, parseInt(searchParams.get('limit') ?? '50', 10))
  const offset    = parseInt(searchParams.get('offset') ?? '0', 10)

  const service = await createServiceClient()
  const btcPrice = await getBtcPriceUsd()

  let query = service
    .from('listings')
    .select('*, listing_jobs(*), listing_gigs(*), listing_services(*), listing_goods(*)', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  const validStatuses: ListingStatus[] = ['pending_payment', 'open', 'claimed', 'completed', 'disputed']
  if (statusReq !== 'all' && validStatuses.includes(statusReq as ListingStatus)) {
    query = query.eq('status', statusReq as ListingStatus)
  }

  const validCategories: ListingCategory[] = ['job', 'gig', 'service', 'good']
  if (category && validCategories.includes(category as ListingCategory)) {
    query = query.eq('category', category as ListingCategory)
  }

  const { data: rawListings, count, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const listings = (rawListings ?? []) as ListingRow[]
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://lobsterlist.vercel.app'

  const items = listings.map((l) => {
    const fees = calculateFees(l.price_sats, btcPrice)
    const toUsd = (sats: number) => `$${((sats / 1e8) * btcPrice).toFixed(2)}`

    return {
      id:          l.id,
      title:       l.title,
      description: l.description,
      category:    l.category,
      status:      l.status,
      tags:        l.tags,
      image_url:   l.image_url,

      // Pricing (agent sees full breakdown)
      price_sats:             l.price_sats,
      price_usd:              toUsd(l.price_sats),
      platform_fee_sats:      fees.platformFeeSats,
      total_agent_cost_sats:  fees.totalAgentCostSats,
      total_agent_cost_usd:   toUsd(fees.totalAgentCostSats),

      created_at: l.created_at,

      // Machine-readable claim instructions — no API docs needed
      ...(l.status === 'open' ? {
        claim_endpoint: `${siteUrl}/api/escrow/create`,
        claim_method:   'POST',
        claim_body:     {
          listingId:    l.id,
          buyerAgentId: '<your-agent-id>',
        },
        claim_note: 'Replace buyerAgentId with your agent ID from registration.',
      } : {}),
    }
  })

  return NextResponse.json({
    listings: items,
    total:  count ?? 0,
    limit,
    offset,
  })
}
