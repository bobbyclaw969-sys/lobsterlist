'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

type WalletId = 'unisat' | 'xverse' | 'leather'
type Step = 'idle' | 'detecting' | 'wallet-picker' | 'connecting' | 'signing' | 'verifying' | 'success' | 'error'

interface WalletConnectButtonProps {
  variant?: 'primary' | 'secondary'
  onSuccess?: (isNewUser: boolean) => void
  onError?: (error: string) => void
  redirectTo?: string
  className?: string
  /** When true, calls /api/auth/wallet/link instead of /api/auth/wallet/verify */
  linkMode?: boolean
}

interface DetectedWallet {
  id: WalletId
  label: string
}

function detectWallets(): DetectedWallet[] {
  if (typeof window === 'undefined') return []
  const wallets: DetectedWallet[] = []
  // Access via index to avoid TypeScript errors (types in bitcoin-wallets.d.ts)
  const win = window as unknown as Record<string, unknown>
  if (win['unisat']) wallets.push({ id: 'unisat', label: 'Unisat' })
  if (win['BitcoinProvider']) wallets.push({ id: 'xverse', label: 'Xverse' })
  if (win['LeatherProvider']) wallets.push({ id: 'leather', label: 'Leather' })
  return wallets
}

async function getUnisatAccount(): Promise<string> {
  const unisat = (window as unknown as Record<string, unknown>)['unisat'] as {
    requestAccounts(): Promise<string[]>
  } | undefined
  if (!unisat) throw new Error('Unisat not found')
  const accounts = await unisat.requestAccounts()
  if (!accounts[0]) throw new Error('No account returned')
  return accounts[0]
}

async function getXverseLeatherAccount(): Promise<string> {
  const { getAddress, AddressPurpose, BitcoinNetworkType } = await import('sats-connect')
  return new Promise((resolve, reject) => {
    getAddress({
      payload: {
        purposes: [AddressPurpose.Payment],
        message: 'Connect your wallet to LobsterList',
        network: { type: BitcoinNetworkType.Mainnet },
      },
      onFinish: (response: { addresses: Array<{ address: string; purpose: string }> }) => {
        const addr = response.addresses.find(a => a.purpose === AddressPurpose.Payment)
        if (addr) resolve(addr.address)
        else reject(new Error('No payment address returned'))
      },
      onCancel: () => reject(new Error('Connection cancelled')),
    })
  })
}

async function signWithUnisat(address: string, message: string): Promise<string> {
  const unisat = (window as unknown as Record<string, unknown>)['unisat'] as {
    signMessage(message: string, type?: string): Promise<string>
  } | undefined
  if (!unisat) throw new Error('Unisat not found')
  return unisat.signMessage(message, 'ecdsa')
}

async function signWithSatsConnect(walletId: WalletId, address: string, message: string): Promise<string> {
  const { signMessage, BitcoinNetworkType } = await import('sats-connect')
  return new Promise((resolve, reject) => {
    signMessage({
      payload: {
        network: { type: BitcoinNetworkType.Mainnet },
        address,
        message,
      },
      onFinish: (response: string) => resolve(response),
      onCancel: () => reject(new Error('Signing cancelled')),
    })
  })
}

export function WalletConnectButton({
  variant = 'secondary',
  onSuccess,
  onError,
  redirectTo,
  className = '',
  linkMode = false,
}: WalletConnectButtonProps) {
  const router = useRouter()
  const [step, setStep] = useState<Step>('idle')
  const [availableWallets, setAvailableWallets] = useState<DetectedWallet[]>([])
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  function handleError(msg: string) {
    setErrorMsg(msg)
    setStep('error')
    onError?.(msg)
  }

  async function startConnect() {
    setStep('detecting')
    setErrorMsg(null)
    const wallets = detectWallets()

    if (wallets.length === 0) {
      setStep('idle')
      setErrorMsg('no-wallet')
      return
    }

    if (wallets.length === 1) {
      await connectWallet(wallets[0].id)
    } else {
      setAvailableWallets(wallets)
      setStep('wallet-picker')
    }
  }

  async function connectWallet(walletId: WalletId) {
    setStep('connecting')
    try {
      let address: string
      if (walletId === 'unisat') {
        address = await getUnisatAccount()
      } else {
        address = await getXverseLeatherAccount()
      }

      // Fetch challenge
      setStep('signing')
      const challengeRes = await fetch('/api/auth/wallet/challenge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ walletAddress: address }),
      })
      const challengeData = await challengeRes.json()
      if (!challengeRes.ok) { handleError(challengeData.error ?? 'Failed to get challenge'); return }

      // Sign message
      let signature: string
      if (walletId === 'unisat') {
        signature = await signWithUnisat(address, challengeData.message)
      } else {
        signature = await signWithSatsConnect(walletId, address, challengeData.message)
      }

      // Verify or link
      setStep('verifying')
      const endpoint = linkMode ? '/api/auth/wallet/link' : '/api/auth/wallet/verify'
      const verifyRes = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ walletAddress: address, signature, message: challengeData.message, walletType: walletId }),
      })
      const verifyData = await verifyRes.json()
      if (!verifyRes.ok) { handleError(verifyData.error ?? 'Authentication failed'); return }

      if (!linkMode && verifyData.accessToken) {
        const supabase = createClient()
        await supabase.auth.setSession({
          access_token: verifyData.accessToken,
          refresh_token: verifyData.refreshToken,
        })
      }

      setStep('success')
      onSuccess?.(verifyData.isNewUser ?? false)

      if (redirectTo) {
        router.push(redirectTo)
      } else if (!linkMode) {
        router.push(verifyData.isNewUser ? '/profile' : '/browse')
        router.refresh()
      } else {
        router.refresh()
      }
    } catch (err) {
      handleError(err instanceof Error ? err.message : 'Connection failed')
    }
  }

  const isPrimary = variant === 'primary'
  const baseBtn = isPrimary
    ? 'w-full bg-orange-500 hover:bg-orange-400 disabled:opacity-60 text-white font-semibold py-3 text-sm transition-colors'
    : 'w-full border border-zinc-700 hover:border-zinc-500 bg-zinc-900 hover:bg-zinc-800 text-zinc-200 font-medium py-3 text-sm rounded-xl transition-colors'

  const busy = ['detecting', 'connecting', 'signing', 'verifying'].includes(step)

  if (errorMsg === 'no-wallet') {
    return (
      <div className="space-y-2 text-center">
        <p className="text-sm text-zinc-400">No Bitcoin wallet detected.</p>
        <div className="flex justify-center gap-4 text-sm">
          <a
            href="https://unisat.io/download"
            target="_blank"
            rel="noopener noreferrer"
            className="text-orange-400 hover:text-orange-300 underline"
          >
            Install Unisat
          </a>
          <a
            href="https://www.xverse.app/download"
            target="_blank"
            rel="noopener noreferrer"
            className="text-zinc-400 hover:text-zinc-300 underline"
          >
            Install Xverse
          </a>
        </div>
        <button
          onClick={() => setErrorMsg(null)}
          className="text-xs text-zinc-600 hover:text-zinc-400"
        >
          Try again
        </button>
      </div>
    )
  }

  if (step === 'wallet-picker') {
    return (
      <div className="space-y-2">
        <p className="text-xs text-zinc-500 text-center">Choose your wallet</p>
        {availableWallets.map((w) => (
          <button
            key={w.id}
            onClick={() => connectWallet(w.id)}
            className={`${baseBtn} ${className}`}
          >
            {w.label}
          </button>
        ))}
        <button
          onClick={() => setStep('idle')}
          className="w-full text-xs text-zinc-600 hover:text-zinc-400 py-1"
        >
          Cancel
        </button>
      </div>
    )
  }

  if (step === 'error') {
    return (
      <div className="space-y-2">
        <p className="text-sm text-red-400 text-center">{errorMsg}</p>
        <button
          onClick={() => { setStep('idle'); setErrorMsg(null) }}
          className={`${baseBtn} ${className}`}
        >
          Try again
        </button>
      </div>
    )
  }

  const label = busy
    ? step === 'detecting'  ? 'Detecting wallets…'
    : step === 'connecting' ? 'Connecting…'
    : step === 'signing'    ? 'Waiting for signature…'
    : 'Verifying…'
    : step === 'success'    ? '✓ Connected'
    : 'Connect Bitcoin wallet'

  return (
    <button
      onClick={startConnect}
      disabled={busy || step === 'success'}
      className={`${baseBtn} ${className}`}
    >
      {label}
    </button>
  )
}
