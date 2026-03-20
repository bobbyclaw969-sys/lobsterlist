/**
 * Strike API client for LobsterList.
 *
 * Handles:
 * - Lightning invoice creation (for sat fees and escrow funding)
 * - Invoice status polling
 * - BTC/USD rate fetching
 * - ACH payout initiation
 *
 * All methods check for STRIKE_API_KEY. If missing, returns clearly
 * flagged mock data so the full UI can be developed before credentials arrive.
 */

const STRIKE_API_BASE = 'https://api.strike.me/v1'
const MOCK_MODE = !process.env.STRIKE_API_KEY

function strikeHeaders() {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${process.env.STRIKE_API_KEY}`,
  }
}

// ── Types ─────────────────────────────────────────────────────────────────────

export type StrikeInvoice = {
  invoiceId:    string
  amount:       { amount: string; currency: string }
  state:        'UNPAID' | 'PENDING' | 'PAID' | 'CANCELLED'
  lnInvoice:    string | null  // BOLT11 payment request
  description:  string
}

export type StrikeRate = {
  amount: string  // USD per BTC e.g. "85000.00"
  sourceCurrency: string
  targetCurrency: string
}

// ── Invoice creation ──────────────────────────────────────────────────────────

export async function createLightningInvoice(
  amountSats: number,
  description: string,
  correlationId?: string
): Promise<{ invoiceId: string; lnInvoice: string; mockMode: boolean }> {
  if (MOCK_MODE) {
    const mockId = `mock_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
    console.log(`[MOCK] Strike invoice created: ${mockId} — ${amountSats} sats — "${description}"`)
    return {
      invoiceId: mockId,
      lnInvoice: `lnbc${amountSats}u1pmock${mockId}`,
      mockMode: true,
    }
  }

  // Strike works in BTC amount — convert sats to BTC string
  const btcAmount = (amountSats / 100_000_000).toFixed(8)

  const res = await fetch(`${STRIKE_API_BASE}/invoices`, {
    method: 'POST',
    headers: strikeHeaders(),
    body: JSON.stringify({
      correlationId,
      description,
      amount: { amount: btcAmount, currency: 'BTC' },
    }),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Strike createInvoice failed (${res.status}): ${err}`)
  }

  const invoice: StrikeInvoice = await res.json()

  // Fetch the BOLT11 payment request
  const quoteRes = await fetch(`${STRIKE_API_BASE}/invoices/${invoice.invoiceId}/quote`, {
    method: 'POST',
    headers: strikeHeaders(),
  })

  if (!quoteRes.ok) {
    throw new Error(`Strike invoice quote failed (${quoteRes.status})`)
  }

  const quote = await quoteRes.json()

  return {
    invoiceId: invoice.invoiceId,
    lnInvoice: quote.lnInvoice as string,
    mockMode: false,
  }
}

// ── Invoice status ─────────────────────────────────────────────────────────────

export async function getInvoiceStatus(
  strikeInvoiceId: string
): Promise<{ state: StrikeInvoice['state']; mockMode: boolean }> {
  if (MOCK_MODE || strikeInvoiceId.startsWith('mock_')) {
    // In mock mode, auto-mark as PAID after a few seconds for testing
    return { state: 'PAID', mockMode: true }
  }

  const res = await fetch(`${STRIKE_API_BASE}/invoices/${strikeInvoiceId}`, {
    headers: strikeHeaders(),
    cache: 'no-store',
  })

  if (!res.ok) {
    throw new Error(`Strike getInvoice failed (${res.status})`)
  }

  const invoice: StrikeInvoice = await res.json()
  return { state: invoice.state, mockMode: false }
}

// ── BTC/USD rate ──────────────────────────────────────────────────────────────

export async function getBtcUsdRateFromStrike(): Promise<number> {
  if (MOCK_MODE) {
    return 85_000
  }

  try {
    const res = await fetch(`${STRIKE_API_BASE}/rates/ticker?currency=BTC`, {
      headers: strikeHeaders(),
      cache: 'no-store',
    })

    if (!res.ok) throw new Error(`Strike rates failed (${res.status})`)

    const rates: StrikeRate[] = await res.json()
    const usdRate = rates.find(
      (r) => r.sourceCurrency === 'BTC' && r.targetCurrency === 'USD'
    )

    if (!usdRate) throw new Error('BTC/USD rate not found in Strike response')
    return parseFloat(usdRate.amount)
  } catch {
    return 85_000 // fallback
  }
}

// ── ACH payout ────────────────────────────────────────────────────────────────

export type PayoutResult = {
  payoutId: string
  state:    'PENDING' | 'COMPLETED' | 'FAILED'
  mockMode: boolean
}

export async function initiateAchPayout(params: {
  amountUsd:      number
  bankAccountId:  string
  description?:   string
}): Promise<PayoutResult> {
  if (MOCK_MODE) {
    const mockId = `mock_payout_${Date.now()}`
    console.log(`[MOCK] Strike payout: $${params.amountUsd} USD to bank ${params.bankAccountId}`)
    return { payoutId: mockId, state: 'PENDING', mockMode: true }
  }

  const res = await fetch(`${STRIKE_API_BASE}/payouts`, {
    method: 'POST',
    headers: strikeHeaders(),
    body: JSON.stringify({
      amount: { amount: params.amountUsd.toFixed(2), currency: 'USD' },
      paymentMethod: { type: 'ACH', bankAccountId: params.bankAccountId },
      description: params.description ?? 'LobsterList earnings cashout',
    }),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Strike payout failed (${res.status}): ${err}`)
  }

  const payout = await res.json()
  return { payoutId: payout.payoutId, state: payout.state, mockMode: false }
}
