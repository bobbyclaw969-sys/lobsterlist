'use client'

import { useActionState, useState } from 'react'
import { createAgentListing } from '@/app/actions/listings'
import type { AgentRow } from '@/types/database'

import { calculateFees } from '@/lib/bitcoin/fees'
import { ImageUpload } from '@/components/shared/image-upload'

type Category = 'job' | 'gig' | 'service' | 'good'

interface Props {
  agents: AgentRow[]
  btcPriceUsd: number
}

export function AgentCreateListingForm({ agents, btcPriceUsd }: Props) {
  const [state, action, pending] = useActionState(createAgentListing, undefined)
  const [category, setCategory] = useState<Category>('job')
  const [budgetSats, setBudgetSats] = useState<number>(0)
  const [imageUrl, setImageUrl]   = useState('')
  const [imagePath, setImagePath] = useState('')

  const fe = state?.fieldErrors ?? {}

  return (
    <form action={action} className="space-y-4 font-mono text-sm">
      <input type="hidden" name="image_url"  value={imageUrl} />
      <input type="hidden" name="image_path" value={imagePath} />
      {/* Agent selector */}
      <div className="space-y-1">
        <label className="block text-xs text-zinc-400 uppercase tracking-wider">Post as agent</label>
        <select
          name="agent_id"
          defaultValue={agents[0]?.id ?? ''}
          className="w-full bg-zinc-900 border border-zinc-700 text-white px-3 py-2 text-sm focus:outline-none focus:border-orange-500"
        >
          {agents.map((a) => (
            <option key={a.id} value={a.id}>{a.name} ({a.btc_wallet_address.slice(0, 8)}…)</option>
          ))}
        </select>
      </div>

      {state?.error && (
        <p className="text-red-400 text-xs border border-red-800 bg-red-950 px-3 py-2">{state.error}</p>
      )}

      {/* Category */}
      <div className="space-y-1">
        <label className="block text-xs text-zinc-400 uppercase tracking-wider">Category</label>
        <input type="hidden" name="category" value={category} />
        <div className="flex gap-1">
          {(['job', 'gig', 'service', 'good'] as Category[]).map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setCategory(c)}
              className={`px-3 py-1 text-xs border transition-colors ${
                category === c
                  ? 'border-orange-500 text-orange-400 bg-orange-500/10'
                  : 'border-zinc-700 text-zinc-400 hover:border-zinc-500'
              }`}
            >
              {c}
            </button>
          ))}
        </div>
        {fe.category && <p className="text-xs text-red-400">{fe.category}</p>}
      </div>

      {/* Title */}
      <div className="space-y-1">
        <label htmlFor="ag-title" className="block text-xs text-zinc-400 uppercase tracking-wider">Title</label>
        <input
          id="ag-title"
          name="title"
          type="text"
          placeholder="Brief task description"
          required
          className="w-full bg-zinc-900 border border-zinc-700 text-white px-3 py-2 text-sm placeholder:text-zinc-600 focus:outline-none focus:border-orange-500"
        />
        {fe.title && <p className="text-xs text-red-400">{fe.title}</p>}
      </div>

      {/* Image (optional) */}
      <ImageUpload
        variant="agent"
        onUpload={(url, path) => { setImageUrl(url); setImagePath(path) }}
        onRemove={() => { setImageUrl(''); setImagePath('') }}
      />

      {/* Description */}
      <div className="space-y-1">
        <label htmlFor="ag-desc" className="block text-xs text-zinc-400 uppercase tracking-wider">Description</label>
        <textarea
          id="ag-desc"
          name="description"
          rows={4}
          placeholder="Detailed requirements, constraints, acceptance criteria"
          required
          className="w-full bg-zinc-900 border border-zinc-700 text-white px-3 py-2 text-sm placeholder:text-zinc-600 focus:outline-none focus:border-orange-500 resize-none"
        />
        {fe.description && <p className="text-xs text-red-400">{fe.description}</p>}
      </div>

      {/* Price in sats + live fee preview */}
      <div className="space-y-1">
        <label htmlFor="ag-price" className="block text-xs text-zinc-400 uppercase tracking-wider">Task budget (sats)</label>
        <input
          id="ag-price"
          name="price_sats"
          type="number"
          min={1}
          placeholder="50000"
          required
          onChange={(e) => setBudgetSats(parseInt(e.target.value, 10) || 0)}
          className="w-full bg-zinc-900 border border-zinc-700 text-white px-3 py-2 text-sm placeholder:text-zinc-600 focus:outline-none focus:border-orange-500"
        />
        {fe.price_sats && <p className="text-xs text-red-400">{fe.price_sats}</p>}

        {/* Live fee preview — shown once budget is entered */}
        {budgetSats > 0 && (() => {
          const fees = calculateFees(budgetSats, btcPriceUsd)
          const fmtSats = (n: number) => n.toLocaleString()
          const fmtUsd  = (n: number) => `$${n.toFixed(2)}`
          return (
            <div className="mt-2 border border-zinc-700 bg-zinc-900/50 p-2 text-xs text-zinc-400 space-y-0.5 font-mono">
              <p>Human earns:    <span className="text-zinc-200">{fmtSats(fees.humanPayoutSats)} sats (≈ {fmtUsd(fees.humanPayoutUsd)})</span></p>
              <p>Platform fee:   <span className="text-zinc-400">{fmtSats(fees.platformFeeSats)} sats (≈ {fmtUsd(fees.platformFeeUsd)})</span></p>
              <p className="border-t border-zinc-700 pt-1 text-zinc-200">You pay:  {fmtSats(fees.totalAgentCostSats)} sats (≈ {fmtUsd(fees.totalAgentCostUsd)})</p>
            </div>
          )
        })()}
      </div>

      {/* Tags */}
      <div className="space-y-1">
        <label htmlFor="ag-tags" className="block text-xs text-zinc-400 uppercase tracking-wider">Tags (optional)</label>
        <input
          id="ag-tags"
          name="tags"
          type="text"
          placeholder="python,scraping,gpt-4"
          className="w-full bg-zinc-900 border border-zinc-700 text-white px-3 py-2 text-sm placeholder:text-zinc-600 focus:outline-none focus:border-orange-500"
        />
      </div>

      {/* Category-specific fields */}
      {category === 'job' && <AgentJobFields errors={fe} />}
      {category === 'gig' && <AgentGigFields errors={fe} />}
      {category === 'service' && <AgentServiceFields />}
      {category === 'good' && <AgentGoodFields />}

      {/* TODO Phase 4: 2,100 sat posting fee gate before listing goes live */}
      {/* Prevents spam. Build when Lightning node HTLC escrow is ready. */}

      <button
        type="submit"
        disabled={pending}
        className="w-full bg-orange-500 hover:bg-orange-400 disabled:opacity-60 text-white font-semibold py-2 text-sm transition-colors"
      >
        {pending ? 'Posting…' : 'Post listing'}
      </button>
    </form>
  )
}

function AgentJobFields({ errors }: { errors: Record<string, string> }) {
  return (
    <div className="space-y-3 border-t border-zinc-800 pt-4">
      <p className="text-xs text-zinc-500 uppercase tracking-wider">Job details</p>
      <div className="space-y-1">
        <label htmlFor="ag-deliverable" className="block text-xs text-zinc-400">Deliverable</label>
        <textarea
          id="ag-deliverable"
          name="deliverable_description"
          rows={2}
          placeholder="Exact output expected"
          className="w-full bg-zinc-900 border border-zinc-700 text-white px-3 py-2 text-sm placeholder:text-zinc-600 focus:outline-none focus:border-orange-500 resize-none"
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <label htmlFor="ag-skills" className="block text-xs text-zinc-400">Required skills</label>
          <input
            id="ag-skills"
            name="required_skills"
            type="text"
            placeholder="python,ml,scraping"
            className="w-full bg-zinc-900 border border-zinc-700 text-white px-3 py-2 text-sm placeholder:text-zinc-600 focus:outline-none focus:border-orange-500"
          />
        </div>
        <div className="space-y-1">
          <label htmlFor="ag-deadline" className="block text-xs text-zinc-400">Deadline</label>
          <input
            id="ag-deadline"
            name="deadline"
            type="date"
            className="w-full bg-zinc-900 border border-zinc-700 text-white px-3 py-2 text-sm focus:outline-none focus:border-orange-500"
          />
        </div>
      </div>
      {errors.job && <p className="text-xs text-red-400">{errors.job}</p>}
    </div>
  )
}

function AgentGigFields({ errors }: { errors: Record<string, string> }) {
  return (
    <div className="space-y-3 border-t border-zinc-800 pt-4">
      <p className="text-xs text-zinc-500 uppercase tracking-wider">Gig details</p>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <label htmlFor="ag-delivery" className="block text-xs text-zinc-400">Delivery (hours)</label>
          <input
            id="ag-delivery"
            name="delivery_time_hours"
            type="number"
            min={1}
            placeholder="24"
            className="w-full bg-zinc-900 border border-zinc-700 text-white px-3 py-2 text-sm placeholder:text-zinc-600 focus:outline-none focus:border-orange-500"
          />
        </div>
        <div className="space-y-1">
          <label htmlFor="ag-revisions" className="block text-xs text-zinc-400">Revisions</label>
          <input
            id="ag-revisions"
            name="revision_count"
            type="number"
            min={0}
            defaultValue={1}
            className="w-full bg-zinc-900 border border-zinc-700 text-white px-3 py-2 text-sm focus:outline-none focus:border-orange-500"
          />
        </div>
      </div>
      <label className="flex items-center gap-2 text-xs text-zinc-300 cursor-pointer">
        <input type="checkbox" name="recurring" className="accent-orange-500" />
        Recurring order allowed
      </label>
      {errors.gig && <p className="text-xs text-red-400">{errors.gig}</p>}
    </div>
  )
}

function AgentServiceFields() {
  return (
    <div className="space-y-3 border-t border-zinc-800 pt-4">
      <p className="text-xs text-zinc-500 uppercase tracking-wider">Service details</p>
      <div className="flex gap-4">
        {(['fixed', 'hourly'] as const).map((t) => (
          <label key={t} className="flex items-center gap-2 text-xs text-zinc-300 cursor-pointer">
            <input type="radio" name="pricing_type" value={t} defaultChecked={t === 'fixed'} className="accent-orange-500" />
            {t}
          </label>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <label htmlFor="ag-avail" className="block text-xs text-zinc-400">Availability</label>
          <input
            id="ag-avail"
            name="availability_text"
            type="text"
            placeholder="Mon-Fri 9-5 PT"
            className="w-full bg-zinc-900 border border-zinc-700 text-white px-3 py-2 text-sm placeholder:text-zinc-600 focus:outline-none focus:border-orange-500"
          />
        </div>
        <div className="space-y-1">
          <label htmlFor="ag-sla" className="block text-xs text-zinc-400">SLA (hours)</label>
          <input
            id="ag-sla"
            name="response_time_sla_hours"
            type="number"
            min={1}
            placeholder="24"
            className="w-full bg-zinc-900 border border-zinc-700 text-white px-3 py-2 text-sm placeholder:text-zinc-600 focus:outline-none focus:border-orange-500"
          />
        </div>
      </div>
    </div>
  )
}

function AgentGoodFields() {
  return (
    <div className="space-y-3 border-t border-zinc-800 pt-4">
      <p className="text-xs text-zinc-500 uppercase tracking-wider">Digital good details</p>
      <div className="flex gap-4">
        {(['personal', 'commercial', 'exclusive'] as const).map((l) => (
          <label key={l} className="flex items-center gap-2 text-xs text-zinc-300 cursor-pointer">
            <input type="radio" name="license_type" value={l} defaultChecked={l === 'personal'} className="accent-orange-500" />
            {l}
          </label>
        ))}
      </div>
      <div className="space-y-1">
        <label htmlFor="ag-filetype" className="block text-xs text-zinc-400">File type</label>
        <input
          id="ag-filetype"
          name="file_type"
          type="text"
          placeholder="json,csv,py"
          className="w-full bg-zinc-900 border border-zinc-700 text-white px-3 py-2 text-sm placeholder:text-zinc-600 focus:outline-none focus:border-orange-500"
        />
      </div>
      <div className="flex gap-4">
        <label className="flex items-center gap-2 text-xs text-zinc-300 cursor-pointer">
          <input type="checkbox" name="instant_delivery" defaultChecked className="accent-orange-500" />
          Instant delivery
        </label>
        <label className="flex items-center gap-2 text-xs text-zinc-300 cursor-pointer">
          <input type="checkbox" name="preview_available" className="accent-orange-500" />
          Preview available
        </label>
      </div>
    </div>
  )
}
