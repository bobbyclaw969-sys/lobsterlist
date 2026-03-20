/**
 * BitEscrow API client for LobsterList.
 *
 * Handles non-custodial 2-of-2 multisig escrow contracts.
 * Platform is registered as Carol (arbitrator).
 *
 * When BITESCROW_API_KEY is not set, returns clearly flagged mock data.
 */

const BITESCROW_API_BASE = 'https://api.bitescrow.dev/v1'
const MOCK_MODE = !process.env.BITESCROW_API_KEY

function bitescrowHeaders() {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${process.env.BITESCROW_API_KEY}`,
  }
}

// ── Types ─────────────────────────────────────────────────────────────────────

export type BitEscrowStatus =
  | 'created'
  | 'funding'
  | 'active'
  | 'closed'
  | 'disputed'
  | 'cancelled'

export type BitEscrowContract = {
  cid:          string
  status:       BitEscrowStatus
  amountSats:   number
  buyerPubkey:  string
  sellerPubkey: string
  fundingAddress: string | null  // pay here to fund
  createdAt:    string
}

// ── Create contract ───────────────────────────────────────────────────────────

export async function createEscrowContract(params: {
  listingId:    string
  buyerId:      string
  sellerId:     string
  amountSats:   number
  platformFeeSats: number
  description:  string
}): Promise<{ cid: string; fundingAddress: string | null; mockMode: boolean }> {
  if (MOCK_MODE) {
    const cid = `mock_escrow_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
    console.log(`[MOCK] BitEscrow contract created: ${cid} — ${params.amountSats} sats`)
    return { cid, fundingAddress: null, mockMode: true }
  }

  const res = await fetch(`${BITESCROW_API_BASE}/contracts`, {
    method: 'POST',
    headers: bitescrowHeaders(),
    body: JSON.stringify({
      listingRef: params.listingId,
      buyerRef:   params.buyerId,
      sellerRef:  params.sellerId,
      amount:     params.amountSats,
      platformFee: params.platformFeeSats,
      description: params.description,
    }),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`BitEscrow createContract failed (${res.status}): ${err}`)
  }

  const contract: BitEscrowContract = await res.json()
  return { cid: contract.cid, fundingAddress: contract.fundingAddress, mockMode: false }
}

// ── Get contract ──────────────────────────────────────────────────────────────

export async function getEscrowContract(cid: string): Promise<{
  status: BitEscrowStatus
  mockMode: boolean
}> {
  if (MOCK_MODE || cid.startsWith('mock_escrow_')) {
    return { status: 'active', mockMode: true }
  }

  const res = await fetch(`${BITESCROW_API_BASE}/contracts/${cid}`, {
    headers: bitescrowHeaders(),
    cache: 'no-store',
  })

  if (!res.ok) throw new Error(`BitEscrow getContract failed (${res.status})`)

  const contract: BitEscrowContract = await res.json()
  return { status: contract.status, mockMode: false }
}

// ── Release funds ─────────────────────────────────────────────────────────────

export async function releaseEscrowContract(cid: string): Promise<{ mockMode: boolean }> {
  if (MOCK_MODE || cid.startsWith('mock_escrow_')) {
    console.log(`[MOCK] BitEscrow release: ${cid}`)
    return { mockMode: true }
  }

  const res = await fetch(`${BITESCROW_API_BASE}/contracts/${cid}/release`, {
    method: 'POST',
    headers: bitescrowHeaders(),
  })

  if (!res.ok) throw new Error(`BitEscrow releaseContract failed (${res.status})`)
  return { mockMode: false }
}

// ── Raise dispute ─────────────────────────────────────────────────────────────

export async function disputeEscrowContract(
  cid: string,
  reason: string
): Promise<{ mockMode: boolean }> {
  if (MOCK_MODE || cid.startsWith('mock_escrow_')) {
    console.log(`[MOCK] BitEscrow dispute: ${cid} — ${reason}`)
    return { mockMode: true }
  }

  const res = await fetch(`${BITESCROW_API_BASE}/contracts/${cid}/dispute`, {
    method: 'POST',
    headers: bitescrowHeaders(),
    body: JSON.stringify({ reason }),
  })

  if (!res.ok) throw new Error(`BitEscrow disputeContract failed (${res.status})`)
  return { mockMode: false }
}
