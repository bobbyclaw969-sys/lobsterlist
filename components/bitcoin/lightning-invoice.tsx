'use client'

import { useState, useEffect, useCallback } from 'react'
import { QRCodeSVG } from 'qrcode.react'

interface LightningInvoiceProps {
  lnInvoice:  string
  invoiceId:  string
  amountSats: number
  mockMode?:  boolean
  onPaid?:    () => void
  pollUrl?:   string  // API route to poll for status
}

export function LightningInvoice({
  lnInvoice,
  invoiceId,
  amountSats,
  mockMode = false,
  onPaid,
  pollUrl,
}: LightningInvoiceProps) {
  const [copied, setCopied] = useState(false)
  const [status, setStatus] = useState<'waiting' | 'paid' | 'expired'>('waiting')

  const checkStatus = useCallback(async () => {
    if (!pollUrl) return
    try {
      const res = await fetch(`${pollUrl}?invoiceId=${invoiceId}`)
      if (!res.ok) return
      const data = await res.json()
      if (data.state === 'PAID') {
        setStatus('paid')
        onPaid?.()
      } else if (data.state === 'CANCELLED') {
        setStatus('expired')
      }
    } catch {
      // ignore polling errors
    }
  }, [invoiceId, pollUrl, onPaid])

  // Poll every 3 seconds while waiting
  useEffect(() => {
    if (status !== 'waiting' || !pollUrl) return
    const interval = setInterval(checkStatus, 3000)
    return () => clearInterval(interval)
  }, [status, checkStatus, pollUrl])

  function copyInvoice() {
    navigator.clipboard.writeText(lnInvoice)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  if (status === 'paid') {
    return (
      <div className="flex flex-col items-center gap-3 py-8 text-center">
        <div className="text-4xl">⚡</div>
        <p className="text-lg font-semibold text-green-400">Payment received!</p>
        <p className="text-sm text-zinc-400">Redirecting…</p>
      </div>
    )
  }

  if (status === 'expired') {
    return (
      <div className="text-center py-8 space-y-2">
        <p className="text-red-400 font-semibold">Invoice expired</p>
        <p className="text-sm text-zinc-400">Please go back and try again.</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {mockMode && (
        <div className="bg-amber-950 border border-amber-700 rounded-lg px-3 py-2 text-xs text-amber-300">
          Dev mode — Strike API key not set. Invoice will auto-complete in 3s.
        </div>
      )}

      <div className="flex justify-center">
        <div className="bg-white p-3 rounded-xl">
          <QRCodeSVG value={lnInvoice} size={200} />
        </div>
      </div>

      <div className="space-y-2">
        <p className="text-xs text-zinc-400 text-center">
          Scan with any Lightning wallet · {amountSats.toLocaleString()} sats
        </p>
        <div className="flex gap-2">
          <code className="flex-1 bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-xs text-zinc-300 truncate">
            {lnInvoice}
          </code>
          <button
            onClick={copyInvoice}
            className="flex-shrink-0 bg-zinc-800 hover:bg-zinc-700 border border-zinc-600 text-zinc-300 text-xs px-3 py-2 rounded-lg transition-colors"
          >
            {copied ? 'Copied!' : 'Copy'}
          </button>
        </div>
      </div>

      <div className="flex items-center justify-center gap-2 text-xs text-zinc-500">
        <div className="w-2 h-2 rounded-full bg-orange-400 animate-pulse" />
        Waiting for payment…
      </div>
    </div>
  )
}
