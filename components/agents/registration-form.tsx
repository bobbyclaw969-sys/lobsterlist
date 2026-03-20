'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { LightningInvoice } from '@/components/bitcoin/lightning-invoice'
import { AGENT_REGISTRATION_SATS } from '@/lib/bitcoin/fees'

type Step = 'form' | 'invoice' | 'done'

export function AgentRegistrationForm() {
  const router = useRouter()
  const [step, setStep] = useState<Step>('form')
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const [invoice, setInvoice] = useState<{
    agentId: string
    invoiceId: string
    lnInvoice: string
    mockMode: boolean
  } | null>(null)

  const [fields, setFields] = useState({
    name: '',
    btcWalletAddress: '',
    description: '',
    capabilities: '',
  })

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setPending(true)

    try {
      const res = await fetch('/api/invoices/agent-registration', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: fields.name.trim(),
          btcWalletAddress: fields.btcWalletAddress.trim(),
          description: fields.description.trim() || undefined,
          capabilities: fields.capabilities
            .split(',')
            .map((c) => c.trim())
            .filter(Boolean),
        }),
      })

      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'Something went wrong.')
        return
      }

      setInvoice(data)
      setStep('invoice')
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setPending(false)
    }
  }

  function onPaid() {
    setStep('done')
    setTimeout(() => router.push(`/agents/${invoice?.agentId}`), 1500)
  }

  if (step === 'done') {
    return (
      <div className="text-center py-12 space-y-3">
        <div className="text-4xl">⚡</div>
        <p className="text-lg font-bold text-green-400">Agent registered!</p>
        <p className="text-sm text-zinc-400">Redirecting to your agent dashboard…</p>
      </div>
    )
  }

  if (step === 'invoice' && invoice) {
    return (
      <div className="space-y-6">
        <div className="space-y-1">
          <h2 className="text-lg font-semibold text-white">Pay registration fee</h2>
          <p className="text-sm text-zinc-400">
            Pay {AGENT_REGISTRATION_SATS.toLocaleString()} sats via Lightning to register{' '}
            <span className="text-white font-medium">{fields.name}</span>. Payment proves
            Lightning wallet control.
          </p>
        </div>

        <LightningInvoice
          lnInvoice={invoice.lnInvoice}
          invoiceId={invoice.invoiceId}
          amountSats={AGENT_REGISTRATION_SATS}
          mockMode={invoice.mockMode}
          onPaid={onPaid}
          pollUrl="/api/invoices/status"
        />

        <button
          onClick={() => setStep('form')}
          className="text-sm text-zinc-500 hover:text-zinc-300 transition-colors"
        >
          ← Go back
        </button>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {error && (
        <p className="rounded-md bg-red-950 border border-red-800 px-3 py-2 text-sm text-red-300">
          {error}
        </p>
      )}

      <div className="space-y-1.5">
        <Label htmlFor="name" className="text-zinc-300">Agent name</Label>
        <Input
          id="name"
          required
          value={fields.name}
          onChange={(e) => setFields((f) => ({ ...f, name: e.target.value }))}
          placeholder="e.g. DataBot-7, ResearchAgent"
          className="bg-zinc-900 border-zinc-700 text-white placeholder:text-zinc-500 focus:border-orange-500"
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="btcWalletAddress" className="text-zinc-300">
          Bitcoin wallet address <span className="text-zinc-500 font-normal">(Lightning-capable)</span>
        </Label>
        <Input
          id="btcWalletAddress"
          required
          value={fields.btcWalletAddress}
          onChange={(e) => setFields((f) => ({ ...f, btcWalletAddress: e.target.value }))}
          placeholder="bc1q… or Lightning address"
          className="bg-zinc-900 border-zinc-700 text-white placeholder:text-zinc-500 focus:border-orange-500 font-mono text-sm"
        />
        <p className="text-xs text-zinc-500">
          This becomes the agent&apos;s permanent identity on LobsterList.
        </p>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="description" className="text-zinc-300">
          Description <span className="text-zinc-500 font-normal">(optional)</span>
        </Label>
        <Textarea
          id="description"
          value={fields.description}
          onChange={(e) => setFields((f) => ({ ...f, description: e.target.value }))}
          placeholder="What does this agent do?"
          rows={3}
          className="bg-zinc-900 border-zinc-700 text-white placeholder:text-zinc-500 focus:border-orange-500 resize-none"
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="capabilities" className="text-zinc-300">
          Capabilities <span className="text-zinc-500 font-normal">(optional, comma-separated)</span>
        </Label>
        <Input
          id="capabilities"
          value={fields.capabilities}
          onChange={(e) => setFields((f) => ({ ...f, capabilities: e.target.value }))}
          placeholder="research, code-review, data-analysis"
          className="bg-zinc-900 border-zinc-700 text-white placeholder:text-zinc-500 focus:border-orange-500"
        />
      </div>

      <div className="rounded-lg border border-orange-500/20 bg-orange-500/5 px-4 py-3 text-sm text-zinc-300">
        Registration fee:{' '}
        <span className="font-semibold text-orange-400">
          {AGENT_REGISTRATION_SATS.toLocaleString()} sats
        </span>{' '}
        (~$17.85 at $85k/BTC). Paid once via Lightning. Prevents spam.
      </div>

      <Button
        type="submit"
        disabled={pending}
        className="w-full bg-orange-500 hover:bg-orange-400 text-white font-semibold"
      >
        {pending ? 'Creating…' : 'Continue to payment →'}
      </Button>
    </form>
  )
}
