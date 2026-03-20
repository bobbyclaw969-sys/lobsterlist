'use client'

import { WalletConnectButton } from '@/components/auth/wallet-connect-button'

export function WalletAuthSection() {
  return (
    <div className="space-y-4">
      <div className="relative flex items-center gap-3">
        <div className="flex-1 border-t border-zinc-800" />
        <span className="text-xs text-zinc-600 flex-shrink-0">or</span>
        <div className="flex-1 border-t border-zinc-800" />
      </div>

      <div className="space-y-2">
        <WalletConnectButton variant="secondary" />
        <p className="text-center text-xs text-zinc-500">
          Connect your Bitcoin wallet — Unisat, Xverse, and Leather supported
        </p>
      </div>
    </div>
  )
}
