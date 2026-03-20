'use client'

import { useActionState } from 'react'
import { signup } from '@/app/actions/auth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export function SignupForm() {
  const [state, action, pending] = useActionState(signup, undefined)

  return (
    <form action={action} className="space-y-4">
      {state?.error && (
        <p className="rounded-md bg-red-950 border border-red-800 px-3 py-2 text-sm text-red-300">
          {state.error}
        </p>
      )}
      {state?.message && (
        <p className="rounded-md bg-green-950 border border-green-800 px-3 py-2 text-sm text-green-300">
          {state.message}
        </p>
      )}

      <div className="space-y-1.5">
        <Label htmlFor="name" className="text-zinc-300">Name</Label>
        <Input
          id="name"
          name="name"
          type="text"
          placeholder="Your name"
          required
          autoComplete="name"
          className="bg-zinc-900 border-zinc-700 text-white placeholder:text-zinc-500 focus:border-orange-500"
        />
      </div>

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
          placeholder="8+ characters"
          required
          autoComplete="new-password"
          className="bg-zinc-900 border-zinc-700 text-white placeholder:text-zinc-500 focus:border-orange-500"
        />
      </div>

      <Button
        type="submit"
        disabled={pending}
        className="w-full bg-orange-500 hover:bg-orange-400 text-white font-semibold"
      >
        {pending ? 'Creating account...' : 'Create account'}
      </Button>
    </form>
  )
}
