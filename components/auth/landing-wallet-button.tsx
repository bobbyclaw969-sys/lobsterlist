'use client'

import { WalletConnectButton } from '@/components/auth/wallet-connect-button'

export function LandingWalletButton() {
  return (
    <WalletConnectButton
      variant="secondary"
      redirectTo="/browse"
      className="text-sm px-4 py-1.5 rounded-full"
    />
  )
}
