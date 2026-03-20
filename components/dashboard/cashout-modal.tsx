'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { centsToUsd } from '@/lib/utils/sats'

interface CashoutModalProps {
  balanceCents: number
}

export function CashoutModal({ balanceCents }: CashoutModalProps) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [amountUsd, setAmountUsd] = useState('')
  const [bankAccountId, setBankAccountId] = useState('')
  const [bankAccountLabel, setBankAccountLabel] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const maxUsd = balanceCents / 100

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSuccess(null)

    const amount = parseFloat(amountUsd)
    if (!amount || amount < 1) { setError('Minimum cashout is $1.00'); return }
    if (amount > maxUsd) { setError('Amount exceeds available balance'); return }
    if (!bankAccountId.trim()) { setError('Bank account ID is required'); return }

    setLoading(true)
    try {
      const res = await fetch('/api/cashout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amountUsd: amount, bankAccountId: bankAccountId.trim(), bankAccountLabel: bankAccountLabel.trim() }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error); return }
      setSuccess(`Payout initiated${data.mockMode ? ' (mock mode)' : ''}. Payout ID: ${data.payoutId}`)
      setAmountUsd('')
      setBankAccountId('')
      setBankAccountLabel('')
      router.refresh()
    } finally {
      setLoading(false)
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        disabled={balanceCents < 100}
        className="bg-orange-500 hover:bg-orange-400 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold px-5 py-2.5 rounded-xl text-sm transition-colors flex-shrink-0"
      >
        Cash Out
      </button>
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="bg-zinc-900 border border-zinc-700 rounded-2xl p-6 w-full max-w-md space-y-5">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold">Cash Out</h2>
          <button onClick={() => { setOpen(false); setError(null); setSuccess(null) }} className="text-zinc-500 hover:text-white text-xl leading-none">×</button>
        </div>

        <p className="text-sm text-zinc-400">
          Available: <span className="text-white font-semibold">{centsToUsd(balanceCents)}</span>
        </p>

        {success ? (
          <div className="space-y-4">
            <p className="text-sm text-green-400 bg-green-950 border border-green-800 rounded-lg px-3 py-2">{success}</p>
            <button
              onClick={() => { setOpen(false); setSuccess(null) }}
              className="w-full bg-zinc-700 hover:bg-zinc-600 text-white rounded-lg py-2.5 text-sm font-medium transition-colors"
            >
              Close
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <p className="text-sm text-red-400 bg-red-950 border border-red-800 rounded-lg px-3 py-2">{error}</p>
            )}

            <div className="space-y-1.5">
              <label className="text-xs text-zinc-400 uppercase tracking-wider">Amount (USD)</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400">$</span>
                <input
                  type="number"
                  step="0.01"
                  min="1"
                  max={maxUsd}
                  value={amountUsd}
                  onChange={(e) => setAmountUsd(e.target.value)}
                  placeholder="0.00"
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg pl-7 pr-4 py-2.5 text-white placeholder-zinc-600 focus:outline-none focus:border-orange-500 text-sm"
                  required
                />
              </div>
              <button
                type="button"
                onClick={() => setAmountUsd(maxUsd.toFixed(2))}
                className="text-xs text-orange-400 hover:text-orange-300"
              >
                Use max ({centsToUsd(balanceCents)})
              </button>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs text-zinc-400 uppercase tracking-wider">Bank Account ID</label>
              <input
                type="text"
                value={bankAccountId}
                onChange={(e) => setBankAccountId(e.target.value)}
                placeholder="Strike bank account ID"
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2.5 text-white placeholder-zinc-600 focus:outline-none focus:border-orange-500 text-sm"
                required
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs text-zinc-400 uppercase tracking-wider">Account Label (optional)</label>
              <input
                type="text"
                value={bankAccountLabel}
                onChange={(e) => setBankAccountLabel(e.target.value)}
                placeholder="e.g. Chase checking"
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2.5 text-white placeholder-zinc-600 focus:outline-none focus:border-orange-500 text-sm"
              />
            </div>

            <p className="text-xs text-zinc-600">
              Payouts are processed via ACH through Strike. Allow 1–3 business days.
            </p>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => { setOpen(false); setError(null) }}
                className="flex-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg py-2.5 text-sm font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="flex-1 bg-orange-500 hover:bg-orange-400 disabled:opacity-60 text-white rounded-lg py-2.5 text-sm font-semibold transition-colors"
              >
                {loading ? 'Processing…' : 'Request Payout'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
