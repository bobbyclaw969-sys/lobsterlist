'use client'

import { useActionState } from 'react'
import { upsertWorkerProfile } from '@/app/actions/workers'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'

const AVAILABILITY_OPTIONS = [
  { value: 'full_time',  label: 'Full-time',  detail: '30+ hrs/week' },
  { value: 'part_time',  label: 'Part-time',  detail: '10–30 hrs/week' },
  { value: 'weekends',   label: 'Weekends',   detail: 'Sat & Sun' },
] as const

interface Props {
  existing?: {
    headline: string
    bio: string | null
    location: string | null
    hourly_rate_usd_cents: number
    availability: string
    skills: string[]
  }
}

export function WorkerForm({ existing }: Props) {
  const [state, action, pending] = useActionState(upsertWorkerProfile, undefined)
  const fe = state?.fieldErrors ?? {}

  const defaultRate = existing
    ? (existing.hourly_rate_usd_cents / 100).toFixed(2)
    : ''

  return (
    <form action={action} className="space-y-6">
      {state?.error && (
        <p className="rounded-md bg-red-950 border border-red-800 px-3 py-2 text-sm text-red-300">
          {state.error}
        </p>
      )}

      {/* Headline */}
      <div className="space-y-1.5">
        <Label htmlFor="headline" className="text-zinc-300">
          What you can do <span className="text-zinc-500 font-normal text-xs">— your tagline</span>
        </Label>
        <Input
          id="headline"
          name="headline"
          defaultValue={existing?.headline}
          placeholder="I can deliver packages in Austin, TX"
          required
          className="bg-zinc-900 border-zinc-700 text-white placeholder:text-zinc-500 focus:border-orange-500"
        />
        {fe.headline && <p className="text-xs text-red-400">{fe.headline}</p>}
      </div>

      {/* Bio */}
      <div className="space-y-1.5">
        <Label htmlFor="bio" className="text-zinc-300">
          About you <span className="text-zinc-500 font-normal text-xs">(optional)</span>
        </Label>
        <Textarea
          id="bio"
          name="bio"
          defaultValue={existing?.bio ?? ''}
          placeholder="A bit about your background, experience, and what makes you reliable."
          rows={4}
          className="bg-zinc-900 border-zinc-700 text-white placeholder:text-zinc-500 focus:border-orange-500 resize-none"
        />
      </div>

      {/* Location + Rate */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="location" className="text-zinc-300">Location</Label>
          <Input
            id="location"
            name="location"
            defaultValue={existing?.location ?? ''}
            placeholder="Austin, TX or Remote"
            className="bg-zinc-900 border-zinc-700 text-white placeholder:text-zinc-500 focus:border-orange-500"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="hourly_rate" className="text-zinc-300">Hourly rate</Label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 text-sm select-none">$</span>
            <Input
              id="hourly_rate"
              name="hourly_rate"
              type="text"
              inputMode="decimal"
              defaultValue={defaultRate}
              placeholder="25.00"
              required
              className="bg-zinc-900 border-zinc-700 text-white placeholder:text-zinc-500 focus:border-orange-500 pl-7"
            />
          </div>
          {fe.hourly_rate && <p className="text-xs text-red-400">{fe.hourly_rate}</p>}
        </div>
      </div>

      {/* Skills */}
      <div className="space-y-1.5">
        <Label htmlFor="skills" className="text-zinc-300">
          Skills <span className="text-zinc-500 font-normal text-xs">(optional, comma-separated)</span>
        </Label>
        <Input
          id="skills"
          name="skills"
          defaultValue={existing?.skills.join(', ')}
          placeholder="driving, data entry, research, customer service"
          className="bg-zinc-900 border-zinc-700 text-white placeholder:text-zinc-500 focus:border-orange-500"
        />
      </div>

      {/* Availability */}
      <div className="space-y-2">
        <Label className="text-zinc-300">Availability</Label>
        <div className="grid grid-cols-3 gap-2">
          {AVAILABILITY_OPTIONS.map(({ value, label, detail }) => (
            <label key={value} className="cursor-pointer">
              <input
                type="radio"
                name="availability"
                value={value}
                defaultChecked={existing ? existing.availability === value : value === 'part_time'}
                className="sr-only peer"
              />
              <div className="border border-zinc-700 bg-zinc-900 rounded-lg p-3 text-center transition-colors peer-checked:border-orange-500 peer-checked:bg-orange-500/10 hover:border-zinc-500">
                <p className="text-sm font-medium text-white">{label}</p>
                <p className="text-xs text-zinc-500 mt-0.5">{detail}</p>
              </div>
            </label>
          ))}
        </div>
        {fe.availability && <p className="text-xs text-red-400">{fe.availability}</p>}
      </div>

      <Button
        type="submit"
        disabled={pending}
        className="w-full bg-orange-500 hover:bg-orange-400 text-white font-semibold"
      >
        {pending ? 'Saving…' : existing ? 'Update profile' : 'Post availability'}
      </Button>
    </form>
  )
}
