/**
 * Mock escrow service for LobsterList.
 *
 * BitEscrow was considered but archived June 2025.
 * Real escrow will use HTLC escrow via Lightning node — Phase 4.
 *
 * All functions return mock data. No external API calls.
 */

// ── Types ─────────────────────────────────────────────────────────────────────

export type EscrowStatus =
  | 'created'
  | 'funding'
  | 'active'
  | 'closed'
  | 'disputed'
  | 'cancelled'

export type EscrowContract = {
  cid:            string
  status:         EscrowStatus
  amountSats:     number
  fundingAddress: string | null
  createdAt:      string
}

// ── Create contract ───────────────────────────────────────────────────────────

export async function createEscrowContract(params: {
  listingId:       string
  buyerId:         string
  sellerId:        string
  amountSats:      number
  platformFeeSats: number
  description:     string
}): Promise<{ cid: string; fundingAddress: string | null; mockMode: boolean }> {
  const cid = `escrow_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
  console.log(`[MOCK] Escrow contract created: ${cid} — ${params.amountSats} sats — HTLC escrow via Lightning node in Phase 4`)
  return { cid, fundingAddress: null, mockMode: true }
}

// ── Get contract ──────────────────────────────────────────────────────────────

export async function getEscrowContract(cid: string): Promise<{
  status: EscrowStatus
  mockMode: boolean
}> {
  // HTLC escrow via Lightning node — Phase 4
  return { status: 'active', mockMode: true }
}

// ── Release funds ─────────────────────────────────────────────────────────────

export async function releaseEscrowContract(cid: string): Promise<{ mockMode: boolean }> {
  console.log(`[MOCK] Escrow release: ${cid} — HTLC escrow via Lightning node in Phase 4`)
  return { mockMode: true }
}

// ── Raise dispute ─────────────────────────────────────────────────────────────

export async function disputeEscrowContract(
  cid: string,
  reason: string
): Promise<{ mockMode: boolean }> {
  console.log(`[MOCK] Escrow dispute: ${cid} — ${reason} — HTLC escrow via Lightning node in Phase 4`)
  return { mockMode: true }
}
