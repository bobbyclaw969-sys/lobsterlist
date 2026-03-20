'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { LightningInvoice } from '@/components/bitcoin/lightning-invoice'

interface ClaimButtonProps {
  listingId: string
  priceSats: number
}

export function ClaimButton({ listingId, priceSats }: ClaimButtonProps) {
  const router = useRouter()
  const [step, setStep] = useState<'idle' | 'loading' | 'invoice'>('idle')
  const [error, setError] = useState<string | null>(null)
  const [invoiceData, setInvoiceData] = useState<{
    invoiceId: string
    lnInvoice: string
    contractId: string
    mockMode: boolean
  } | null>(null)

  async function handleClaim() {
    setStep('loading')
    setError(null)
    try {
      const res = await fetch('/api/escrow/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ listingId }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error); setStep('idle'); return }
      setInvoiceData({
        invoiceId: data.invoiceId,
        lnInvoice: data.lnInvoice,
        contractId: data.contractId,
        mockMode: data.mockMode ?? false,
      })
      setStep('invoice')
    } catch {
      setError('Failed to create escrow. Please try again.')
      setStep('idle')
    }
  }

  if (step === 'invoice' && invoiceData) {
    return (
      <div className="space-y-4">
        <div className="rounded-xl border border-blue-900 bg-blue-950/30 p-4 space-y-2">
          <p className="text-sm font-semibold text-blue-400">Pay to claim this listing</p>
          <p className="text-xs text-zinc-400">
            Funds are held in non-custodial escrow (BitEscrow). LobsterList never holds your money.
          </p>
        </div>
        <LightningInvoice
          lnInvoice={invoiceData.lnInvoice}
          invoiceId={invoiceData.invoiceId}
          amountSats={priceSats}
          mockMode={invoiceData.mockMode}
          pollUrl={`/api/invoices/status?invoiceId=${invoiceData.invoiceId}`}
          onPaid={() => router.push(`/escrow/${invoiceData.contractId}`)}
        />
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {error && (
        <p className="text-sm text-red-400 bg-red-950 border border-red-800 rounded-lg px-3 py-2">{error}</p>
      )}
      <button
        onClick={handleClaim}
        disabled={step === 'loading'}
        className="w-full bg-orange-500 hover:bg-orange-400 disabled:opacity-60 text-white font-semibold rounded-lg py-3 text-sm transition-colors"
      >
        {step === 'loading' ? 'Creating escrow…' : 'Claim this listing'}
      </button>
    </div>
  )
}
