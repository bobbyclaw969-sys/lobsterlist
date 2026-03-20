/**
 * Converts satoshis to a USD display string.
 * Uses a cached BTC price fetched server-side.
 */
export function satsToUsd(sats: number, btcPriceUsd: number): string {
  const usd = (sats / 100_000_000) * btcPriceUsd
  if (usd < 0.01) return '<$0.01'
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(usd)
}

export function usdToSats(usd: number, btcPriceUsd: number): number {
  return Math.round((usd / btcPriceUsd) * 100_000_000)
}

let cachedPrice: number | null = null
let cacheTime = 0
const CACHE_TTL_MS = 5 * 60 * 1000 // 5 minutes

export async function getBtcPriceUsd(): Promise<number> {
  if (cachedPrice && Date.now() - cacheTime < CACHE_TTL_MS) return cachedPrice
  try {
    const res = await fetch('https://mempool.space/api/v1/prices', { next: { revalidate: 300 } })
    const data = await res.json()
    cachedPrice = data.USD
    cacheTime = Date.now()
    return cachedPrice ?? 85000
  } catch {
    return cachedPrice ?? 85000 // fallback
  }
}

export function generateReferralCode(): string {
  return Math.random().toString(36).substring(2, 10).toUpperCase()
}
