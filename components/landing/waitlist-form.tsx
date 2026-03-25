'use client'

import { useState } from 'react'

export function WaitlistForm() {
  const [email, setEmail]   = useState('')
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [message, setMessage] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setStatus('loading')
    try {
      const res  = await fetch('/api/waitlist', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ email }),
      })
      const data = await res.json()
      if (data.success) {
        setStatus('success')
      } else {
        setStatus('error')
        setMessage(data.error ?? 'Something went wrong.')
      }
    } catch {
      setStatus('error')
      setMessage('Something went wrong. Please try again.')
    }
  }

  if (status === 'success') {
    return (
      <p className="text-green-600 font-medium text-sm">
        You&apos;re on the list. We&apos;ll be in touch.
      </p>
    )
  }

  return (
    <div className="space-y-2">
      <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-2 max-w-md mx-auto">
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="your@email.com"
          required
          className="flex-1 px-4 py-3 rounded-full border border-zinc-300 bg-white text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-orange-400 text-sm min-h-[48px]"
        />
        <button
          type="submit"
          disabled={status === 'loading'}
          className="bg-orange-500 hover:bg-orange-400 disabled:opacity-60 text-white px-6 py-3 rounded-full font-semibold text-sm transition-colors whitespace-nowrap min-h-[48px]"
        >
          {status === 'loading' ? 'Joining…' : 'Join waitlist'}
        </button>
      </form>
      {status === 'error' && (
        <p className="text-red-500 text-xs text-center">{message}</p>
      )}
    </div>
  )
}
