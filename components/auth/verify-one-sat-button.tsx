'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { LightningInvoice } from '@/components/bitcoin/lightning-invoice'

interface Props {
  userId: string
}

type State = 'idle' | 'loading' | 'invoice' | 'done' | 'error'

interface InvoiceData {
  invoiceId:  string
  lnInvoice:  string
  amountSats: number
  mockMode:   boolean
}

export function VerifyOneSatButton({ userId: _userId }: Props) {
  const router = useRouter()
  const [state, setState] = useState<State>('idle')
  const [invoice, setInvoice] = useState<InvoiceData | null>(null)
  const [errorMsg, setErrorMsg] = useState('')

  async function handleClick() {
    setState('loading')
    try {
      const res = await fetch('/api/verify/create', { method: 'POST' })
      if (res.status === 409) {
        // Already verified — just refresh
        router.refresh()
        return
      }
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error ?? 'Failed to create invoice')
      }
      const data = await res.json() as InvoiceData
      setInvoice(data)
      setState('invoice')
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Something went wrong')
      setState('error')
    }
  }

  function handlePaid() {
    setState('done')
    // Refresh page so dashboard re-renders with verified state
    setTimeout(() => router.refresh(), 1000)
  }

  if (state === 'done') {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-green-500/30 bg-green-500/10 px-4 py-3 text-sm text-green-400">
        <span>✓</span>
        <span>Verified! Refreshing…</span>
      </div>
    )
  }

  if (state === 'invoice' && invoice) {
    return (
      <div className="rounded-lg border border-zinc-700 bg-zinc-900 p-4 space-y-3">
        <div className="space-y-0.5">
          <p className="text-sm font-medium text-white">Send 1 sat to verify</p>
          <p className="text-xs text-zinc-500">
            Confirms you have a real Bitcoin wallet. Non-refundable (it&apos;s literally 1 sat).
          </p>
        </div>
        <LightningInvoice
          lnInvoice={invoice.lnInvoice}
          invoiceId={invoice.invoiceId}
          amountSats={invoice.amountSats}
          mockMode={invoice.mockMode}
          pollUrl="/api/invoices/status"
          onPaid={handlePaid}
        />
      </div>
    )
  }

  if (state === 'error') {
    return (
      <div className="space-y-2">
        <p className="text-xs text-red-400">{errorMsg}</p>
        <button
          onClick={() => setState('idle')}
          className="text-xs text-zinc-400 underline"
        >
          Try again
        </button>
      </div>
    )
  }

  return (
    <button
      onClick={handleClick}
      disabled={state === 'loading'}
      className="flex items-center gap-2 rounded-lg border border-zinc-700 bg-zinc-900 px-4 py-3 text-sm hover:border-orange-500 transition-colors disabled:opacity-60 w-full text-left"
    >
      <span className="text-orange-400">⚡</span>
      <div>
        <p className="font-medium text-white">
          {state === 'loading' ? 'Creating invoice…' : 'Pay 1 sat to verify'}
        </p>
        <p className="text-xs text-zinc-500">Send 1 sat to confirm you have a real Bitcoin wallet</p>
      </div>
    </button>
  )
}
