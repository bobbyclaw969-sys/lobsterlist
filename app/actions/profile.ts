'use server'

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
