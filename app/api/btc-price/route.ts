import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { getBtcUsdRateFromStrike } from '@/lib/bitcoin/strike'
import type { BtcPriceCacheRow } from '@/types/database'

const CACHE_TTL_SECONDS = 60

export async function GET() {
  const supabase = await createServiceClient()

  // Read cached price
  const { data: rawCache } = await supabase
    .from('btc_price_cache')
    .select('*')
    .eq('id', 1)
    .single()
  const cache = rawCache as BtcPriceCacheRow | null

  const now = Date.now()
  const updatedAt = cache ? new Date(cache.updated_at).getTime() : 0
  const stale = now - updatedAt > CACHE_TTL_SECONDS * 1000

  if (!stale && cache) {
    return NextResponse.json({
      priceUsd: Number(cache.price_usd),
      updatedAt: cache.updated_at,
      cached: true,
    })
  }

  // Refresh from Strike
  const freshPrice = await getBtcUsdRateFromStrike()

  await supabase
    .from('btc_price_cache')
    .upsert({ id: 1, price_usd: freshPrice, updated_at: new Date().toISOString() })

  return NextResponse.json({
    priceUsd: freshPrice,
    updatedAt: new Date().toISOString(),
    cached: false,
  })
}
