'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import type { WorkerAvailability } from '@/types/database'

export type WorkerProfileState = {
  error?: string
  fieldErrors?: Record<string, string>
} | undefined

export async function upsertWorkerProfile(
  _prev: WorkerProfileState,
  formData: FormData
): Promise<WorkerProfileState> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'You must be signed in.' }

  const headline      = (formData.get('headline') as string)?.trim()
  const bio           = (formData.get('bio') as string)?.trim()
  const location      = (formData.get('location') as string)?.trim()
  const hourlyRateRaw = (formData.get('hourly_rate') as string)?.trim().replace(/[$,]/g, '')
  const availability  = formData.get('availability') as WorkerAvailability
  const skillsRaw     = (formData.get('skills') as string)?.trim()

  const fieldErrors: Record<string, string> = {}
  if (!headline || headline.length < 5) fieldErrors.headline = 'Headline must be at least 5 characters.'

  const hourlyRate = parseFloat(hourlyRateRaw)
  if (isNaN(hourlyRate) || hourlyRate < 1) fieldErrors.hourly_rate = 'Enter an hourly rate of at least $1.'

  const validAvailability: WorkerAvailability[] = ['full_time', 'part_time', 'weekends']
  if (!validAvailability.includes(availability)) fieldErrors.availability = 'Select your availability.'

  if (Object.keys(fieldErrors).length > 0) return { fieldErrors }

  const hourlyRateCents = Math.round(hourlyRate * 100)
  const skills = skillsRaw ? skillsRaw.split(',').map((s) => s.trim()).filter(Boolean) : []

  const { error } = await supabase
    .from('worker_profiles')
    .upsert(
      {
        user_id: user.id,
        headline,
        bio: bio || null,
        location: location || null,
        hourly_rate_usd_cents: hourlyRateCents,
        availability,
        skills,
        is_active: true,
      },
      { onConflict: 'user_id' }
    )

  if (error) return { error: error.message }

  redirect('/browse?view=workers')
}
