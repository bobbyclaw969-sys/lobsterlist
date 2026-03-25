'use client'

import { useActionState } from 'react'
import { login } from '@/app/actions/auth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { WalletConnectButton } from '@/components/auth/wallet-connect-button'
import { OAuthButtons } from '@/components/shared/oauth-buttons'

function Divider({ label }: { label: string }) {
  return (
    <div className="relative flex items-center gap-3">
      <div className="flex-1 border-t border-zinc-800" />
      <span className="text-xs text-zinc-600 flex-shrink-0">{label}</span>
      <div className="flex-1 border-t border-zinc-800" />
    </div>
  )
}

export function LoginForm() {
  const [state, action, pending] = useActionState(login, undefined)

  return (
    <div className="space-y-4">
      {/* 1 — OAuth (fastest path) */}
      <div className="space-y-2">
        <p className="text-center text-xs text-zinc-500">Use your existing account</p>
        <OAuthButtons />
      </div>

      <Divider label="or continue with" />

      {/* 2 — Wallet */}
      <div className="space-y-1.5">
        <WalletConnectButton
          variant="primary"
          redirectTo="/browse"
          className="rounded-lg"
        />
        <p className="text-center text-xs text-zinc-600">
          Unisat, Xverse, and Leather supported
        </p>
      </div>

      <Divider label="or" />

      {/* 3 — Email / password */}
      <form action={action} className="space-y-4">
        {state?.error && (
          <p className="rounded-md bg-red-950 border border-red-800 px-3 py-2 text-sm text-red-300">
            {state.error}
          </p>
        )}

        <div className="space-y-1.5">
          <Label htmlFor="email" className="text-zinc-300">Email</Label>
          <Input
            id="email"
            name="email"
            type="email"
            placeholder="you@example.com"
            required
            autoComplete="email"
            className="bg-zinc-900 border-zinc-700 text-white placeholder:text-zinc-500 focus:border-orange-500"
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="password" className="text-zinc-300">Password</Label>
          <Input
            id="password"
            name="password"
            type="password"
            placeholder="Your password"
            required
            autoComplete="current-password"
            className="bg-zinc-900 border-zinc-700 text-white placeholder:text-zinc-500 focus:border-orange-500"
          />
        </div>

        <Button
          type="submit"
          disabled={pending}
          className="w-full bg-orange-500 hover:bg-orange-400 text-white font-semibold"
        >
          {pending ? 'Signing in…' : 'Sign in with email'}
        </Button>
      </form>
    </div>
  )
}
