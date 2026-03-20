/**
 * Fee calculation — single source of truth.
 *
 * New pricing model:
 *   Human receives 100% of agreed budget. No fees, ever.
 *   Agent pays budget + 5% platform fee.
 *
 * Example: $100 task
 *   Human earns:   $100  (100,000 sats)
 *   Platform fee:    $5  (5,000 sats)
 *   Agent pays:    $105  (105,000 sats)
 */

export const AGENT_REGISTRATION_SATS = 21_000
export const LISTING_FEE_SATS        = 2_100   // TODO Phase 4: gate on posting
export const TRUST_DEPOSIT_SATS      = 2_100   // Collateral, not a fee — returned after 10 completions
export const PLATFORM_FEE_BPS        = 500     // 5% — charged to agent only

/**
 * Calculate fee breakdown for any task budget.
 *
 * @param budgetSats  The agreed task price (what human earns, in sats)
 * @param btcPriceUsd Current BTC price for USD display (defaults to $85k)
 */
export function calculateFees(budgetSats: number, btcPriceUsd = 85_000) {
  const platformFeeSats    = Math.round(budgetSats * PLATFORM_FEE_BPS / 10_000)
  const humanPayoutSats    = budgetSats                   // Human keeps 100%
  const totalAgentCostSats = budgetSats + platformFeeSats // Agent pays 105%

  const toUsd = (sats: number) => (sats / 100_000_000) * btcPriceUsd

  return {
    humanPayoutSats,
    platformFeeSats,
    totalAgentCostSats,
    humanPayoutUsd:    toUsd(humanPayoutSats),
    platformFeeUsd:    toUsd(platformFeeSats),
    totalAgentCostUsd: toUsd(totalAgentCostSats),
  }
}

/**
 * A human is verified if they authenticated via Bitcoin wallet
 * (wallet signature = automatic proof of life) OR paid the 1 sat
 * verification invoice.
 */
export function isHumanVerified(profile: {
  is_verified?: boolean
  auth_method?: string
}): boolean {
  return (
    profile.is_verified === true ||
    profile.auth_method === 'wallet' ||
    profile.auth_method === 'both'
  )
}

/**
 * Returns true if this human has not yet paid the Trust Deposit.
 * The Trust Deposit is collateral (2,100 sats), not a fee.
 * It is returned after 10 successful task completions.
 */
export function needsTrustDeposit(profile: { trust_deposit_paid?: boolean }): boolean {
  return !profile.trust_deposit_paid
}

// ── Legacy aliases — do not add new call sites ────────────────────────────────

/** @deprecated Use calculateFees(budgetSats).platformFeeSats */
export function calculatePlatformFee(amountSats: number): number {
  return calculateFees(amountSats).platformFeeSats
}

/** @deprecated Use calculateFees(budgetSats).humanPayoutSats */
export function sellerReceives(amountSats: number): number {
  return calculateFees(amountSats).humanPayoutSats
}
