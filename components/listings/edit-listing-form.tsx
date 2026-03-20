'use client'

import { useActionState, useState } from 'react'
import { updateListing } from '@/app/actions/listings'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { ImageUpload } from '@/components/shared/image-upload'
import type { ListingWithDetail } from '@/types/database'

interface Props {
  listing: ListingWithDetail
  btcPriceUsd: number
}

const CATEGORY_LABELS: Record<string, string> = {
  job: 'Job', gig: 'Gig', service: 'Service', good: 'Digital Good',
}

export function EditListingForm({ listing, btcPriceUsd }: Props) {
  const boundAction = updateListing.bind(null, listing.id)
  const [state, action, pending] = useActionState(boundAction, undefined)
  const [imageUrl,   setImageUrl]   = useState(listing.image_url   ?? '')
  const [imagePath,  setImagePath]  = useState(listing.image_path  ?? '')

  const fe = state?.fieldErrors ?? {}
  const priceUsd = ((listing.price_sats / 1e8) * btcPriceUsd).toFixed(2)

  // Category-specific detail — aliased query returns listing.job, .gig, etc.
  const job     = listing.job     ?? null
  const gig     = listing.gig     ?? null
  const service = listing.service ?? null
  const good    = listing.good    ?? null

  return (
    <form action={action} className="space-y-6">
      <input type="hidden" name="image_url"  value={imageUrl} />
      <input type="hidden" name="image_path" value={imagePath} />

      {/* Photo */}
      <ImageUpload
        variant="human"
        existingUrl={listing.image_url ?? undefined}
        onUpload={(url, path) => { setImageUrl(url); setImagePath(path) }}
        onRemove={() => { setImageUrl(''); setImagePath('') }}
      />

      {/* Category — locked */}
      <div className="space-y-1.5">
        <Label className="text-zinc-300">Category</Label>
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-zinc-900 border border-zinc-700 text-sm">
          <span className="text-white">{CATEGORY_LABELS[listing.category]}</span>
          <span className="text-zinc-600 text-xs">(cannot be changed after posting)</span>
        </div>
      </div>

      {state?.error && (
        <p className="rounded-md bg-red-950 border border-red-800 px-3 py-2 text-sm text-red-300">
          {state.error}
        </p>
      )}

      {/* Title */}
      <div className="space-y-1.5">
        <Label htmlFor="title" className="text-zinc-300">Title</Label>
        <Input
          id="title" name="title" required
          defaultValue={listing.title}
          className="bg-zinc-900 border-zinc-700 text-white placeholder:text-zinc-500 focus:border-orange-500"
        />
        {fe.title && <p className="text-xs text-red-400">{fe.title}</p>}
      </div>

      {/* Description */}
      <div className="space-y-1.5">
        <Label htmlFor="description" className="text-zinc-300">Description</Label>
        <Textarea
          id="description" name="description" rows={5} required
          defaultValue={listing.description}
          className="bg-zinc-900 border-zinc-700 text-white placeholder:text-zinc-500 focus:border-orange-500 resize-none"
        />
        {fe.description && <p className="text-xs text-red-400">{fe.description}</p>}
      </div>

      {/* Price */}
      <div className="space-y-1.5">
        <Label htmlFor="price_usd" className="text-zinc-300">Price</Label>
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 text-sm select-none">$</span>
          <Input
            id="price_usd" name="price_usd" type="text" inputMode="decimal" required
            defaultValue={priceUsd}
            className="bg-zinc-900 border-zinc-700 text-white focus:border-orange-500 pl-7"
          />
        </div>
        <p className="text-xs text-zinc-500">Converted to sats at the live BTC rate.</p>
        {fe.price_usd && <p className="text-xs text-red-400">{fe.price_usd}</p>}
      </div>

      {/* Tags */}
      <div className="space-y-1.5">
        <Label htmlFor="tags" className="text-zinc-300">
          Tags <span className="text-zinc-500 font-normal">(optional)</span>
        </Label>
        <Input
          id="tags" name="tags"
          defaultValue={listing.tags.join(', ')}
          placeholder="react, typescript, ai — comma separated"
          className="bg-zinc-900 border-zinc-700 text-white placeholder:text-zinc-500 focus:border-orange-500"
        />
      </div>

      {/* Category-specific fields */}
      {listing.category === 'job'     && <EditJobFields     job={job}         errors={fe} />}
      {listing.category === 'gig'     && <EditGigFields     gig={gig}         errors={fe} />}
      {listing.category === 'service' && <EditServiceFields service={service} errors={fe} />}
      {listing.category === 'good'    && <EditGoodFields    good={good}       errors={fe} />}

      <Button
        type="submit" disabled={pending}
        className="w-full bg-orange-500 hover:bg-orange-400 text-white font-semibold"
      >
        {pending ? 'Saving…' : 'Save changes'}
      </Button>
    </form>
  )
}

// ── Detail field sub-components ───────────────────────────────────────────────

import type { ListingJobRow, ListingGigRow, ListingServiceRow, ListingGoodRow } from '@/types/database'

function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <div className="border-t border-zinc-800 pt-6">
      <h2 className="text-sm font-semibold text-zinc-300 uppercase tracking-wider mb-4">{children}</h2>
    </div>
  )
}

function EditJobFields({ job, errors }: { job: ListingJobRow | null; errors: Record<string, string> }) {
  const deadline = job?.deadline ? new Date(job.deadline).toISOString().split('T')[0] : ''
  return (
    <div className="space-y-4">
      <SectionHeader>Job details</SectionHeader>
      <div className="space-y-1.5">
        <Label htmlFor="deliverable_description" className="text-zinc-300">Deliverable</Label>
        <Textarea
          id="deliverable_description" name="deliverable_description" rows={3}
          defaultValue={job?.deliverable_description ?? ''}
          placeholder="What exactly will be delivered?"
          className="bg-zinc-900 border-zinc-700 text-white placeholder:text-zinc-500 focus:border-orange-500 resize-none"
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="required_skills" className="text-zinc-300">
          Required skills <span className="text-zinc-500 font-normal">(optional)</span>
        </Label>
        <Input
          id="required_skills" name="required_skills"
          defaultValue={job?.required_skills?.join(', ') ?? ''}
          placeholder="python, gpt-4 — comma separated"
          className="bg-zinc-900 border-zinc-700 text-white placeholder:text-zinc-500 focus:border-orange-500"
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="deadline" className="text-zinc-300">
          Deadline <span className="text-zinc-500 font-normal">(optional)</span>
        </Label>
        <Input
          id="deadline" name="deadline" type="date"
          defaultValue={deadline}
          className="bg-zinc-900 border-zinc-700 text-white focus:border-orange-500"
        />
      </div>
      {errors.job && <p className="text-xs text-red-400">{errors.job}</p>}
    </div>
  )
}

function EditGigFields({ gig, errors }: { gig: ListingGigRow | null; errors: Record<string, string> }) {
  return (
    <div className="space-y-4">
      <SectionHeader>Gig details</SectionHeader>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="delivery_time_hours" className="text-zinc-300">Delivery time (hours)</Label>
          <Input
            id="delivery_time_hours" name="delivery_time_hours" type="number" min={1}
            defaultValue={gig?.delivery_time_hours ?? ''}
            placeholder="24"
            className="bg-zinc-900 border-zinc-700 text-white placeholder:text-zinc-500 focus:border-orange-500"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="revision_count" className="text-zinc-300">Revisions included</Label>
          <Input
            id="revision_count" name="revision_count" type="number" min={0}
            defaultValue={gig?.revision_count ?? 1}
            className="bg-zinc-900 border-zinc-700 text-white focus:border-orange-500"
          />
        </div>
      </div>
      <label className="flex items-center gap-3 cursor-pointer">
        <input
          type="checkbox" name="recurring"
          defaultChecked={gig?.recurring ?? false}
          className="h-4 w-4 rounded border-zinc-600 bg-zinc-900 accent-orange-500"
        />
        <span className="text-sm text-zinc-300">This gig can be ordered repeatedly</span>
      </label>
      {errors.gig && <p className="text-xs text-red-400">{errors.gig}</p>}
    </div>
  )
}

function EditServiceFields({ service, errors }: { service: ListingServiceRow | null; errors: Record<string, string> }) {
  return (
    <div className="space-y-4">
      <SectionHeader>Service details</SectionHeader>
      <div className="space-y-1.5">
        <Label className="text-zinc-300">Pricing type</Label>
        <div className="flex gap-3">
          {(['fixed', 'hourly'] as const).map((type) => (
            <label key={type} className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio" name="pricing_type" value={type}
                defaultChecked={(service?.pricing_type ?? 'fixed') === type}
                className="accent-orange-500"
              />
              <span className="text-sm text-zinc-300 capitalize">{type}</span>
            </label>
          ))}
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="availability_text" className="text-zinc-300">
          Availability <span className="text-zinc-500 font-normal">(optional)</span>
        </Label>
        <Input
          id="availability_text" name="availability_text"
          defaultValue={service?.availability_text ?? ''}
          placeholder="Mon–Fri, 9am–5pm PT"
          className="bg-zinc-900 border-zinc-700 text-white placeholder:text-zinc-500 focus:border-orange-500"
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="response_time_sla_hours" className="text-zinc-300">
          Response SLA (hours) <span className="text-zinc-500 font-normal">(optional)</span>
        </Label>
        <Input
          id="response_time_sla_hours" name="response_time_sla_hours" type="number" min={1}
          defaultValue={service?.response_time_sla_hours ?? ''}
          placeholder="24"
          className="bg-zinc-900 border-zinc-700 text-white placeholder:text-zinc-500 focus:border-orange-500"
        />
      </div>
      {errors.service && <p className="text-xs text-red-400">{errors.service}</p>}
    </div>
  )
}

function EditGoodFields({ good, errors }: { good: ListingGoodRow | null; errors: Record<string, string> }) {
  return (
    <div className="space-y-4">
      <SectionHeader>Digital good details</SectionHeader>
      <div className="space-y-1.5">
        <Label className="text-zinc-300">License type</Label>
        <div className="flex flex-wrap gap-3">
          {(['personal', 'commercial', 'exclusive'] as const).map((lic) => (
            <label key={lic} className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio" name="license_type" value={lic}
                defaultChecked={(good?.license_type ?? 'personal') === lic}
                className="accent-orange-500"
              />
              <span className="text-sm text-zinc-300 capitalize">{lic}</span>
            </label>
          ))}
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="file_type" className="text-zinc-300">
          File type <span className="text-zinc-500 font-normal">(optional)</span>
        </Label>
        <Input
          id="file_type" name="file_type"
          defaultValue={good?.file_type ?? ''}
          placeholder="PDF, CSV, JSON…"
          className="bg-zinc-900 border-zinc-700 text-white placeholder:text-zinc-500 focus:border-orange-500"
        />
      </div>
      <div className="flex flex-col gap-2">
        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox" name="instant_delivery"
            defaultChecked={good?.instant_delivery ?? true}
            className="h-4 w-4 rounded border-zinc-600 bg-zinc-900 accent-orange-500"
          />
          <span className="text-sm text-zinc-300">Instant delivery after payment</span>
        </label>
        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox" name="preview_available"
            defaultChecked={good?.preview_available ?? false}
            className="h-4 w-4 rounded border-zinc-600 bg-zinc-900 accent-orange-500"
          />
          <span className="text-sm text-zinc-300">Preview available before purchase</span>
        </label>
      </div>
      {errors.good && <p className="text-xs text-red-400">{errors.good}</p>}
    </div>
  )
}
