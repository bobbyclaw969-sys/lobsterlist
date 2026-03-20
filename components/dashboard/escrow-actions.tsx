'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import type { EscrowStatus } from '@/types/database'

interface EscrowActionsProps {
  contractId: string
  status:     EscrowStatus
  isBuyer:    boolean
  isSeller:   boolean
}

export function EscrowActions({ contractId, status, isBuyer, isSeller }: EscrowActionsProps) {
  const router = useRouter()
  const [disputeReason, setDisputeReason] = useState('')
  const [showDisputeForm, setShowDisputeForm] = useState(false)
  const [loading, setLoading] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function markComplete() {
    setLoading('complete')
    setError(null)
    try {
      const res = await fetch('/api/escrow/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contractId }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error); return }
      router.refresh()
    } finally {
      setLoading(null)
    }
  }

  async function raiseDispute() {
    if (!disputeReason.trim()) return
    setLoading('dispute')
    setError(null)
    try {
      const res = await fetch('/api/escrow/dispute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contractId, reason: disputeReason }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error); return }
      router.refresh()
    } finally {
      setLoading(null)
    }
  }

  if (status !== 'funded') return null

  return (
    <div className="space-y-3">
      {error && (
        <p className="text-sm text-red-400 bg-red-950 border border-red-800 rounded-lg px-3 py-2">
          {error}
        </p>
      )}

      <Button
        onClick={markComplete}
        disabled={!!loading}
        className="w-full bg-green-600 hover:bg-green-500 text-white font-semibold"
      >
        {loading === 'complete' ? 'Processing…' : '✓ Mark work complete & release funds'}
      </Button>

      {!showDisputeForm ? (
        <button
          onClick={() => setShowDisputeForm(true)}
          className="w-full text-sm text-zinc-500 hover:text-red-400 transition-colors py-2"
        >
          Raise a dispute
        </button>
      ) : (
        <div className="space-y-2 rounded-xl border border-red-900 bg-red-950/30 p-4">
          <p className="text-sm font-semibold text-red-400">Raise dispute</p>
          <p className="text-xs text-zinc-400">
            Funds will be frozen. LobsterList will arbitrate. Provide clear details.
          </p>
          <Textarea
            value={disputeReason}
            onChange={(e) => setDisputeReason(e.target.value)}
            placeholder="Describe the issue…"
            rows={3}
            className="bg-zinc-900 border-zinc-700 text-white resize-none"
          />
          <div className="flex gap-2">
            <Button
              onClick={raiseDispute}
              disabled={!!loading || !disputeReason.trim()}
              className="bg-red-600 hover:bg-red-500 text-white text-sm"
            >
              {loading === 'dispute' ? 'Submitting…' : 'Submit dispute'}
            </Button>
            <Button
              onClick={() => setShowDisputeForm(false)}
              variant="outline"
              className="border-zinc-700 text-zinc-300 text-sm"
            >
              Cancel
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
