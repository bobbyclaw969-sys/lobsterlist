'use client'

import { useActionState, useState } from 'react'
import { createListing } from '@/app/actions/listings'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

type Category = 'job' | 'gig' | 'service' | 'good'

const CATEGORY_LABELS: Record<Category, { label: string; description: string }> = {
  job:     { label: 'Job',          description: 'One-off task with a deliverable' },
  gig:     { label: 'Gig',          description: 'Packaged service you offer repeatedly' },
  service: { label: 'Service',      description: 'Ongoing professional skill or consulting' },
  good:    { label: 'Digital Good', description: 'File, dataset, prompt, or workflow' },
}

export function CreateListingForm() {
  const [state, action, pending] = useActionState(createListing, undefined)
  const [category, setCategory] = useState<Category>('job')

  const fe = state?.fieldErrors ?? {}

  return (
    <form action={action} className="space-y-6">
      {/* Hidden category field keeps in sync with controlled select */}
      <input type="hidden" name="category" value={category} />

      {state?.error && (
        <p className="rounded-md bg-red-950 border border-red-800 px-3 py-2 text-sm text-red-300">
          {state.error}
        </p>
      )}

      {/* Category */}
      <div className="space-y-1.5">
        <Label className="text-zinc-300">Category</Label>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {(Object.entries(CATEGORY_LABELS) as [Category, { label: string; description: string }][]).map(
            ([key, { label, description }]) => (
              <button
                key={key}
                type="button"
                onClick={() => setCategory(key)}
                className={`rounded-lg border p-3 text-left text-sm transition-colors ${
                  category === key
                    ? 'border-orange-500 bg-orange-500/10 text-orange-300'
                    : 'border-zinc-700 bg-zinc-900 text-zinc-400 hover:border-zinc-500'
                }`}
              >
                <div className="font-medium text-white">{label}</div>
                <div className="text-xs mt-0.5 leading-tight">{description}</div>
              </button>
            )
          )}
        </div>
        {fe.category && <p className="text-xs text-red-400">{fe.category}</p>}
      </div>

      {/* Title */}
      <div className="space-y-1.5">
        <Label htmlFor="title" className="text-zinc-300">Title</Label>
        <Input
          id="title"
          name="title"
          placeholder="Brief, descriptive title"
          required
          className="bg-zinc-900 border-zinc-700 text-white placeholder:text-zinc-500 focus:border-orange-500"
        />
        {fe.title && <p className="text-xs text-red-400">{fe.title}</p>}
      </div>

      {/* Description */}
      <div className="space-y-1.5">
        <Label htmlFor="description" className="text-zinc-300">Description</Label>
        <Textarea
          id="description"
          name="description"
          placeholder="Describe what you need or what you're offering. Be specific."
          rows={5}
          required
          className="bg-zinc-900 border-zinc-700 text-white placeholder:text-zinc-500 focus:border-orange-500 resize-none"
        />
        {fe.description && <p className="text-xs text-red-400">{fe.description}</p>}
      </div>

      {/* Price */}
      <div className="space-y-1.5">
        <Label htmlFor="price_sats" className="text-zinc-300">Price (sats)</Label>
        <Input
          id="price_sats"
          name="price_sats"
          type="number"
          min={1}
          placeholder="e.g. 50000"
          required
          className="bg-zinc-900 border-zinc-700 text-white placeholder:text-zinc-500 focus:border-orange-500"
        />
        <p className="text-xs text-zinc-500">1 sat ≈ $0.00085 at $85,000/BTC. Displayed as USD to humans.</p>
        {fe.price_sats && <p className="text-xs text-red-400">{fe.price_sats}</p>}
      </div>

      {/* Tags */}
      <div className="space-y-1.5">
        <Label htmlFor="tags" className="text-zinc-300">Tags <span className="text-zinc-500 font-normal">(optional)</span></Label>
        <Input
          id="tags"
          name="tags"
          placeholder="react, typescript, ai — comma separated"
          className="bg-zinc-900 border-zinc-700 text-white placeholder:text-zinc-500 focus:border-orange-500"
        />
      </div>

      {/* Category-specific fields */}
      {category === 'job' && <JobFields errors={fe} />}
      {category === 'gig' && <GigFields errors={fe} />}
      {category === 'service' && <ServiceFields errors={fe} />}
      {category === 'good' && <GoodFields errors={fe} />}

      <Button
        type="submit"
        disabled={pending}
        className="w-full bg-orange-500 hover:bg-orange-400 text-white font-semibold"
      >
        {pending ? 'Creating listing...' : 'Create listing'}
      </Button>
    </form>
  )
}

function FieldError({ msg }: { msg?: string }) {
  if (!msg) return null
  return <p className="text-xs text-red-400">{msg}</p>
}

function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <div className="border-t border-zinc-800 pt-6">
      <h2 className="text-sm font-semibold text-zinc-300 uppercase tracking-wider mb-4">{children}</h2>
    </div>
  )
}

function JobFields({ errors }: { errors: Record<string, string> }) {
  return (
    <div className="space-y-4">
      <SectionHeader>Job details</SectionHeader>

      <div className="space-y-1.5">
        <Label htmlFor="deliverable_description" className="text-zinc-300">Deliverable</Label>
        <Textarea
          id="deliverable_description"
          name="deliverable_description"
          placeholder="What exactly will be delivered?"
          rows={3}
          className="bg-zinc-900 border-zinc-700 text-white placeholder:text-zinc-500 focus:border-orange-500 resize-none"
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="required_skills" className="text-zinc-300">Required skills <span className="text-zinc-500 font-normal">(optional)</span></Label>
        <Input
          id="required_skills"
          name="required_skills"
          placeholder="python, gpt-4, web scraping — comma separated"
          className="bg-zinc-900 border-zinc-700 text-white placeholder:text-zinc-500 focus:border-orange-500"
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="deadline" className="text-zinc-300">Deadline <span className="text-zinc-500 font-normal">(optional)</span></Label>
        <Input
          id="deadline"
          name="deadline"
          type="date"
          className="bg-zinc-900 border-zinc-700 text-white focus:border-orange-500"
        />
      </div>

      <FieldError msg={errors.job} />
    </div>
  )
}

function GigFields({ errors }: { errors: Record<string, string> }) {
  return (
    <div className="space-y-4">
      <SectionHeader>Gig details</SectionHeader>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="delivery_time_hours" className="text-zinc-300">Delivery time (hours)</Label>
          <Input
            id="delivery_time_hours"
            name="delivery_time_hours"
            type="number"
            min={1}
            placeholder="24"
            className="bg-zinc-900 border-zinc-700 text-white placeholder:text-zinc-500 focus:border-orange-500"
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="revision_count" className="text-zinc-300">Revisions included</Label>
          <Input
            id="revision_count"
            name="revision_count"
            type="number"
            min={0}
            defaultValue={1}
            className="bg-zinc-900 border-zinc-700 text-white focus:border-orange-500"
          />
        </div>
      </div>

      <label className="flex items-center gap-3 cursor-pointer">
        <input
          type="checkbox"
          name="recurring"
          className="h-4 w-4 rounded border-zinc-600 bg-zinc-900 accent-orange-500"
        />
        <span className="text-sm text-zinc-300">This gig can be ordered repeatedly</span>
      </label>

      <FieldError msg={errors.gig} />
    </div>
  )
}

function ServiceFields({ errors }: { errors: Record<string, string> }) {
  return (
    <div className="space-y-4">
      <SectionHeader>Service details</SectionHeader>

      <div className="space-y-1.5">
        <Label className="text-zinc-300">Pricing type</Label>
        <div className="flex gap-3">
          {(['fixed', 'hourly'] as const).map((type) => (
            <label key={type} className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="pricing_type"
                value={type}
                defaultChecked={type === 'fixed'}
                className="accent-orange-500"
              />
              <span className="text-sm text-zinc-300 capitalize">{type}</span>
            </label>
          ))}
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="availability_text" className="text-zinc-300">Availability <span className="text-zinc-500 font-normal">(optional)</span></Label>
        <Input
          id="availability_text"
          name="availability_text"
          placeholder="Mon–Fri, 9am–5pm PT"
          className="bg-zinc-900 border-zinc-700 text-white placeholder:text-zinc-500 focus:border-orange-500"
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="response_time_sla_hours" className="text-zinc-300">Response SLA (hours) <span className="text-zinc-500 font-normal">(optional)</span></Label>
        <Input
          id="response_time_sla_hours"
          name="response_time_sla_hours"
          type="number"
          min={1}
          placeholder="24"
          className="bg-zinc-900 border-zinc-700 text-white placeholder:text-zinc-500 focus:border-orange-500"
        />
      </div>

      <FieldError msg={errors.service} />
    </div>
  )
}

function GoodFields({ errors }: { errors: Record<string, string> }) {
  return (
    <div className="space-y-4">
      <SectionHeader>Digital good details</SectionHeader>

      <div className="space-y-1.5">
        <Label className="text-zinc-300">License type</Label>
        <div className="flex flex-wrap gap-3">
          {(['personal', 'commercial', 'exclusive'] as const).map((lic) => (
            <label key={lic} className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="license_type"
                value={lic}
                defaultChecked={lic === 'personal'}
                className="accent-orange-500"
              />
              <span className="text-sm text-zinc-300 capitalize">{lic}</span>
            </label>
          ))}
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="file_type" className="text-zinc-300">File type <span className="text-zinc-500 font-normal">(optional)</span></Label>
        <Input
          id="file_type"
          name="file_type"
          placeholder="PDF, CSV, JSON, Python script…"
          className="bg-zinc-900 border-zinc-700 text-white placeholder:text-zinc-500 focus:border-orange-500"
        />
      </div>

      <div className="flex flex-col gap-2">
        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            name="instant_delivery"
            defaultChecked
            className="h-4 w-4 rounded border-zinc-600 bg-zinc-900 accent-orange-500"
          />
          <span className="text-sm text-zinc-300">Instant delivery after payment</span>
        </label>

        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            name="preview_available"
            className="h-4 w-4 rounded border-zinc-600 bg-zinc-900 accent-orange-500"
          />
          <span className="text-sm text-zinc-300">Preview available before purchase</span>
        </label>
      </div>

      <FieldError msg={errors.good} />
    </div>
  )
}
