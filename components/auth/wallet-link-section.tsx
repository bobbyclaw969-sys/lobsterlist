'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { WalletConnectButton } from '@/components/auth/wallet-connect-button'

interface WalletLinkSectionProps {
  walletAddress: string | null
}

export function WalletLinkSection({ walletAddress }: WalletLinkSectionProps) {
  const router = useRouter()
  const [removing, setRemoving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function removeWallet() {
    setRemoving(true)
    setError(null)
    try {
      const res = await fetch('/api/auth/wallet/unlink', { method: 'POST' })
      const data = await res.json()
      if (!res.ok) { setError(data.error); return }
      router.refresh()
    } finally {
      setRemoving(false)
    }
  }

  return (
    <div className="space-y-3">
      <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider">Bitcoin Wallet</h2>

      {error && (
        <p className="text-sm text-red-400 bg-red-950 border border-red-800 rounded-lg px-3 py-2">{error}</p>
      )}

      {walletAddress ? (
        <div className="flex items-center justify-between gap-3 rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-3">
          <div className="space-y-0.5">
            <p className="text-xs text-zinc-500">Linked wallet</p>
            <p className="font-mono text-sm text-zinc-200" title={walletAddress}>
              {walletAddress.slice(0, 8)}…{walletAddress.slice(-6)}
            </p>
          </div>
          <button
            onClick={removeWallet}
            disabled={removing}
            className="text-xs text-zinc-500 hover:text-red-400 transition-colors flex-shrink-0"
          >
            {removing ? 'Removing…' : 'Remove'}
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          <p className="text-sm text-zinc-500">Connect a Bitcoin wallet for faster sign-in.</p>
          <WalletConnectButton
            variant="secondary"
            linkMode={true}
            onSuccess={() => router.refresh()}
          />
        </div>
      )}
    </div>
  )
}
