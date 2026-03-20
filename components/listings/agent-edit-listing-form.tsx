'use client'

import { useActionState, useState } from 'react'
import { updateAgentListing } from '@/app/actions/listings'
import { ImageUpload } from '@/components/shared/image-upload'
import { calculateFees } from '@/lib/bitcoin/fees'
import type { ListingWithDetail, ListingJobRow, ListingGigRow, ListingServiceRow, ListingGoodRow } from '@/types/database'

interface Props {
  listing: ListingWithDetail
  btcPriceUsd: number
}

export function AgentEditListingForm({ listing, btcPriceUsd }: Props) {
  const boundAction = updateAgentListing.bind(null, listing.id)
  const [state, action, pending] = useActionState(boundAction, undefined)
  const [imageUrl,   setImageUrl]   = useState(listing.image_url   ?? '')
  const [imagePath,  setImagePath]  = useState(listing.image_path  ?? '')
  const [budgetSats, setBudgetSats] = useState(listing.price_sats)

  const fe  = state?.fieldErrors ?? {}
  const job     = listing.job     ?? null
  const gig     = listing.gig     ?? null
  const service = listing.service ?? null
  const good    = listing.good    ?? null

  return (
    <form action={action} className="space-y-4 font-mono text-sm">
      <input type="hidden" name="image_url"  value={imageUrl} />
      <input type="hidden" name="image_path" value={imagePath} />

      {state?.error && (
        <p className="text-red-400 text-xs border border-red-800 bg-red-950 px-3 py-2">{state.error}</p>
      )}

      {/* Category locked */}
      <div className="space-y-1">
        <label className="block text-xs text-zinc-400 uppercase tracking-wider">Category</label>
        <div className="text-zinc-300 text-xs">
          {listing.category}{' '}
          <span className="text-zinc-600">(locked)</span>
        </div>
      </div>

      {/* Title */}
      <div className="space-y-1">
        <label htmlFor="ag-edit-title" className="block text-xs text-zinc-400 uppercase tracking-wider">Title</label>
        <input
          id="ag-edit-title" name="title" type="text" required
          defaultValue={listing.title}
          className="w-full bg-zinc-900 border border-zinc-700 text-white px-3 py-2 text-sm placeholder:text-zinc-600 focus:outline-none focus:border-orange-500"
        />
        {fe.title && <p className="text-xs text-red-400">{fe.title}</p>}
      </div>

      {/* Image */}
      <ImageUpload
        variant="agent"
        existingUrl={listing.image_url ?? undefined}
        onUpload={(url, path) => { setImageUrl(url); setImagePath(path) }}
        onRemove={() => { setImageUrl(''); setImagePath('') }}
      />

      {/* Description */}
      <div className="space-y-1">
        <label htmlFor="ag-edit-desc" className="block text-xs text-zinc-400 uppercase tracking-wider">Description</label>
        <textarea
          id="ag-edit-desc" name="description" rows={4} required
          defaultValue={listing.description}
          className="w-full bg-zinc-900 border border-zinc-700 text-white px-3 py-2 text-sm placeholder:text-zinc-600 focus:outline-none focus:border-orange-500 resize-none"
        />
        {fe.description && <p className="text-xs text-red-400">{fe.description}</p>}
      </div>

      {/* Price */}
      <div className="space-y-1">
        <label htmlFor="ag-edit-price" className="block text-xs text-zinc-400 uppercase tracking-wider">Task budget (sats)</label>
        <input
          id="ag-edit-price" name="price_sats" type="number" min={1} required
          defaultValue={listing.price_sats}
          onChange={(e) => setBudgetSats(parseInt(e.target.value, 10) || 0)}
          className="w-full bg-zinc-900 border border-zinc-700 text-white px-3 py-2 text-sm focus:outline-none focus:border-orange-500"
        />
        {fe.price_sats && <p className="text-xs text-red-400">{fe.price_sats}</p>}

        {budgetSats > 0 && (() => {
          const fees = calculateFees(budgetSats, btcPriceUsd)
          const fmtSats = (n: number) => n.toLocaleString()
          const fmtUsd  = (n: number) => `$${n.toFixed(2)}`
          return (
            <div className="mt-2 border border-zinc-700 bg-zinc-900/50 p-2 text-xs text-zinc-400 space-y-0.5 font-mono">
              <p>Human earns:  <span className="text-zinc-200">{fmtSats(fees.humanPayoutSats)} sats (≈ {fmtUsd(fees.humanPayoutUsd)})</span></p>
              <p>Platform fee: <span className="text-zinc-400">{fmtSats(fees.platformFeeSats)} sats (≈ {fmtUsd(fees.platformFeeUsd)})</span></p>
              <p className="border-t border-zinc-700 pt-1 text-zinc-200">You pay: {fmtSats(fees.totalAgentCostSats)} sats (≈ {fmtUsd(fees.totalAgentCostUsd)})</p>
            </div>
          )
        })()}
      </div>

      {/* Tags */}
      <div className="space-y-1">
        <label htmlFor="ag-edit-tags" className="block text-xs text-zinc-400 uppercase tracking-wider">Tags (optional)</label>
        <input
          id="ag-edit-tags" name="tags" type="text"
          defaultValue={listing.tags.join(', ')}
          placeholder="python,scraping,gpt-4"
          className="w-full bg-zinc-900 border border-zinc-700 text-white px-3 py-2 text-sm placeholder:text-zinc-600 focus:outline-none focus:border-orange-500"
        />
      </div>

      {/* Category-specific fields */}
      {listing.category === 'job'     && <AgentEditJobFields     job={job}         errors={fe} />}
      {listing.category === 'gig'     && <AgentEditGigFields     gig={gig}         errors={fe} />}
      {listing.category === 'service' && <AgentEditServiceFields service={service} />}
      {listing.category === 'good'    && <AgentEditGoodFields    good={good}       />}

      <button
        type="submit" disabled={pending}
        className="w-full bg-orange-500 hover:bg-orange-400 disabled:opacity-60 text-white font-semibold py-2 text-sm transition-colors"
      >
        {pending ? 'Saving…' : 'Save changes'}
      </button>
    </form>
  )
}

// ── Agent detail sub-components ───────────────────────────────────────────────

function AgentEditJobFields({ job, errors }: { job: ListingJobRow | null; errors: Record<string, string> }) {
  const deadline = job?.deadline ? new Date(job.deadline).toISOString().split('T')[0] : ''
  return (
    <div className="space-y-3 border-t border-zinc-800 pt-4">
      <p className="text-xs text-zinc-500 uppercase tracking-wider">Job details</p>
      <div className="space-y-1">
        <label className="block text-xs text-zinc-400">Deliverable</label>
        <textarea
          name="deliverable_description" rows={2}
          defaultValue={job?.deliverable_description ?? ''}
          placeholder="Exact output expected"
          className="w-full bg-zinc-900 border border-zinc-700 text-white px-3 py-2 text-sm placeholder:text-zinc-600 focus:outline-none focus:border-orange-500 resize-none"
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <label className="block text-xs text-zinc-400">Required skills</label>
          <input
            name="required_skills" type="text"
            defaultValue={job?.required_skills?.join(', ') ?? ''}
            placeholder="python,ml"
            className="w-full bg-zinc-900 border border-zinc-700 text-white px-3 py-2 text-sm placeholder:text-zinc-600 focus:outline-none focus:border-orange-500"
          />
        </div>
        <div className="space-y-1">
          <label className="block text-xs text-zinc-400">Deadline</label>
          <input
            name="deadline" type="date"
            defaultValue={deadline}
            className="w-full bg-zinc-900 border border-zinc-700 text-white px-3 py-2 text-sm focus:outline-none focus:border-orange-500"
          />
        </div>
      </div>
      {errors.job && <p className="text-xs text-red-400">{errors.job}</p>}
    </div>
  )
}

function AgentEditGigFields({ gig, errors }: { gig: ListingGigRow | null; errors: Record<string, string> }) {
  return (
    <div className="space-y-3 border-t border-zinc-800 pt-4">
      <p className="text-xs text-zinc-500 uppercase tracking-wider">Gig details</p>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <label className="block text-xs text-zinc-400">Delivery (hours)</label>
          <input
            name="delivery_time_hours" type="number" min={1}
            defaultValue={gig?.delivery_time_hours ?? ''}
            placeholder="24"
            className="w-full bg-zinc-900 border border-zinc-700 text-white px-3 py-2 text-sm placeholder:text-zinc-600 focus:outline-none focus:border-orange-500"
          />
        </div>
        <div className="space-y-1">
          <label className="block text-xs text-zinc-400">Revisions</label>
          <input
            name="revision_count" type="number" min={0}
            defaultValue={gig?.revision_count ?? 1}
            className="w-full bg-zinc-900 border border-zinc-700 text-white px-3 py-2 text-sm focus:outline-none focus:border-orange-500"
          />
        </div>
      </div>
      <label className="flex items-center gap-2 text-xs text-zinc-300 cursor-pointer">
        <input type="checkbox" name="recurring" defaultChecked={gig?.recurring ?? false} className="accent-orange-500" />
        Recurring order allowed
      </label>
      {errors.gig && <p className="text-xs text-red-400">{errors.gig}</p>}
    </div>
  )
}

function AgentEditServiceFields({ service }: { service: ListingServiceRow | null }) {
  return (
    <div className="space-y-3 border-t border-zinc-800 pt-4">
      <p className="text-xs text-zinc-500 uppercase tracking-wider">Service details</p>
      <div className="flex gap-4">
        {(['fixed', 'hourly'] as const).map((t) => (
          <label key={t} className="flex items-center gap-2 text-xs text-zinc-300 cursor-pointer">
            <input
              type="radio" name="pricing_type" value={t}
              defaultChecked={(service?.pricing_type ?? 'fixed') === t}
              className="accent-orange-500"
            />
            {t}
          </label>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <label className="block text-xs text-zinc-400">Availability</label>
          <input
            name="availability_text" type="text"
            defaultValue={service?.availability_text ?? ''}
            placeholder="Mon-Fri 9-5 PT"
            className="w-full bg-zinc-900 border border-zinc-700 text-white px-3 py-2 text-sm placeholder:text-zinc-600 focus:outline-none focus:border-orange-500"
          />
        </div>
        <div className="space-y-1">
          <label className="block text-xs text-zinc-400">SLA (hours)</label>
          <input
            name="response_time_sla_hours" type="number" min={1}
            defaultValue={service?.response_time_sla_hours ?? ''}
            placeholder="24"
            className="w-full bg-zinc-900 border border-zinc-700 text-white px-3 py-2 text-sm placeholder:text-zinc-600 focus:outline-none focus:border-orange-500"
          />
        </div>
      </div>
    </div>
  )
}

function AgentEditGoodFields({ good }: { good: ListingGoodRow | null }) {
  return (
    <div className="space-y-3 border-t border-zinc-800 pt-4">
      <p className="text-xs text-zinc-500 uppercase tracking-wider">Digital good details</p>
      <div className="flex gap-4">
        {(['personal', 'commercial', 'exclusive'] as const).map((l) => (
          <label key={l} className="flex items-center gap-2 text-xs text-zinc-300 cursor-pointer">
            <input
              type="radio" name="license_type" value={l}
              defaultChecked={(good?.license_type ?? 'personal') === l}
              className="accent-orange-500"
            />
            {l}
          </label>
        ))}
      </div>
      <div className="space-y-1">
        <label className="block text-xs text-zinc-400">File type</label>
        <input
          name="file_type" type="text"
          defaultValue={good?.file_type ?? ''}
          placeholder="json,csv,py"
          className="w-full bg-zinc-900 border border-zinc-700 text-white px-3 py-2 text-sm placeholder:text-zinc-600 focus:outline-none focus:border-orange-500"
        />
      </div>
      <div className="flex gap-4">
        <label className="flex items-center gap-2 text-xs text-zinc-300 cursor-pointer">
          <input type="checkbox" name="instant_delivery" defaultChecked={good?.instant_delivery ?? true} className="accent-orange-500" />
          Instant delivery
        </label>
        <label className="flex items-center gap-2 text-xs text-zinc-300 cursor-pointer">
          <input type="checkbox" name="preview_available" defaultChecked={good?.preview_available ?? false} className="accent-orange-500" />
          Preview available
        </label>
      </div>
    </div>
  )
}
