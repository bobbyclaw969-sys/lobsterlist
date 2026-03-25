'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export async function updateAvatar(avatarUrl: string): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not signed in' }

  const { error } = await supabase
    .from('users')
    .update({ avatar_url: avatarUrl })
    .eq('id', user.id)

  return error ? { error: error.message } : {}
}

export async function removeAvatar(): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not signed in' }

  const { error } = await supabase
    .from('users')
    .update({ avatar_url: null })
    .eq('id', user.id)

  return error ? { error: error.message } : {}
}

export type OnboardingState = { error?: string } | undefined

export async function completeOnboarding(
  _prev: OnboardingState,
  formData: FormData,
): Promise<OnboardingState> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not signed in' }

  const name     = (formData.get('name') as string)?.trim()
  const location = (formData.get('location') as string)?.trim() || null
  const skillsRaw = (formData.get('skills') as string)?.trim()
  const skills   = skillsRaw
    ? skillsRaw.split(',').map((s) => s.trim()).filter(Boolean)
    : []

  if (!name || name.length < 2) return { error: 'Name must be at least 2 characters.' }

  const { error } = await supabase
    .from('users')
    .update({ name, location, skills })
    .eq('id', user.id)

  if (error) return { error: error.message }

  redirect('/browse')
}
