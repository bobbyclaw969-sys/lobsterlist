/**
 * Sats/USD conversion utilities.
 * Price sourced from Strike API, cached in Supabase btc_price_cache.
 * Falls back to mempool.space or $85,000 constant if unavailable.
 */

export function satsToUsd(sats: number, btcPriceUsd: number): string {
  const usd = (sats / 100_000_000) * btcPriceUsd
  if (usd < 0.01) return '<$0.01'
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(usd)
}

export function usdToSats(usd: number, btcPriceUsd: number): number {
  return Math.round((usd / btcPriceUsd) * 100_000_000)
}

export function centsToUsd(cents: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100)
}

/** Fetches BTC price — tries /api/btc-price (Supabase+Strike cache) first, falls back to mempool.space */
export async function getBtcPriceUsd(): Promise<number> {
  // Server-side: try the internal API route
  try {
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'
    const res = await fetch(`${siteUrl}/api/btc-price`, { cache: 'no-store' })
    if (res.ok) {
      const data = await res.json()
      return data.priceUsd as number
    }
  } catch {
    // fall through to mempool
  }

  // Fallback: mempool.space
  try {
    const res = await fetch('https://mempool.space/api/v1/prices', { next: { revalidate: 300 } })
    const data = await res.json()
    return data.USD as number
  } catch {
    return 85_000
  }
}

export function generateReferralCode(): string {
  return Math.random().toString(36).substring(2, 10).toUpperCase()
}
