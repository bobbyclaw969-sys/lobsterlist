export const AGENT_REGISTRATION_SATS = 21_000
export const LISTING_FEE_SATS = 2_100
export const PLATFORM_FEE_BPS = 500 // 5%

export function calculatePlatformFee(amountSats: number): number {
  return Math.round(amountSats * (PLATFORM_FEE_BPS / 10_000))
}

export function sellerReceives(amountSats: number): number {
  return amountSats - calculatePlatformFee(amountSats)
}
