'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { LightningInvoice } from '@/components/bitcoin/lightning-invoice'

interface ClaimButtonProps {
  listingId: string
  priceSats: number
}

type Step = 'idle' | 'loading' | 'trust-deposit' | 'invoice'

interface InvoiceData {
  invoiceId:  string
  lnInvoice:  string
  contractId: string
  mockMode:   boolean
  amountSats: number
}

interface TrustDepositData {
  invoiceId:  string
  lnInvoice:  string
  amountSats: number
  mockMode:   boolean
}

export function ClaimButton({ listingId, priceSats }: ClaimButtonProps) {
  const router = useRouter()
  const [step, setStep] = useState<Step>('idle')
  const [error, setError] = useState<string | null>(null)
  const [invoiceData, setInvoiceData] = useState<InvoiceData | null>(null)
  const [trustDepositData, setTrustDepositData] = useState<TrustDepositData | null>(null)

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

      if (data.trustDepositRequired) {
        // First-time claimer — must pay Trust Deposit before escrow
        setTrustDepositData({
          invoiceId:  data.invoiceId,
          lnInvoice:  data.lnInvoice,
          amountSats: data.amountSats,
          mockMode:   data.mockMode ?? false,
        })
        setStep('trust-deposit')
        return
      }

      setInvoiceData({
        invoiceId:  data.invoiceId,
        lnInvoice:  data.lnInvoice,
        contractId: data.contractId,
        mockMode:   data.mockMode ?? false,
        amountSats: data.totalAmountSats ?? priceSats,
      })
      setStep('invoice')
    } catch {
      setError('Failed to create escrow. Please try again.')
      setStep('idle')
    }
  }

  // Trust Deposit step — shown to first-time claimers
  if (step === 'trust-deposit' && trustDepositData) {
    return (
      <div className="space-y-4">
        <div className="rounded-xl border border-amber-900 bg-amber-950/30 p-4 space-y-2">
          <p className="text-sm font-semibold text-amber-400">Trust Deposit required</p>
          <p className="text-sm text-zinc-300">
            Pay a one-time 2,100 sat Trust Deposit to start claiming tasks.
          </p>
          <p className="text-xs text-zinc-400">
            This is <strong className="text-white">not a fee</strong> — it&apos;s collateral that&apos;s returned after 10 successful completions.
          </p>
          <p className="text-xs text-zinc-500">
            Your trust deposit is returned after 10 completed tasks.
          </p>
        </div>
        <LightningInvoice
          lnInvoice={trustDepositData.lnInvoice}
          invoiceId={trustDepositData.invoiceId}
          amountSats={trustDepositData.amountSats}
          mockMode={trustDepositData.mockMode}
          pollUrl={`/api/invoices/status?invoiceId=${trustDepositData.invoiceId}`}
          onPaid={handleClaim}
        />
      </div>
    )
  }

  // Escrow invoice step
  if (step === 'invoice' && invoiceData) {
    return (
      <div className="space-y-4">
        <div className="rounded-xl border border-green-900 bg-green-950/20 p-4 space-y-2">
          <p className="text-sm font-semibold text-green-400">You keep 100% of what you earn</p>
          <p className="text-xs text-zinc-400">
            Funds are held in non-custodial escrow. LobsterList never holds your money.
          </p>
        </div>
        <LightningInvoice
          lnInvoice={invoiceData.lnInvoice}
          invoiceId={invoiceData.invoiceId}
          amountSats={invoiceData.amountSats}
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
        {step === 'loading' ? 'Checking…' : 'Claim this listing'}
      </button>
      <p className="text-xs text-center text-zinc-500">You keep 100% of what you earn — no fees, ever</p>
    </div>
  )
}
