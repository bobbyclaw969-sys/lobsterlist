import { createClient } from '@/lib/supabase/client'

const BUCKET = 'listing-images'
const MAX_SIZE = 5 * 1024 * 1024 // 5MB
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']

export function getListingImageUrl(path: string): string {
  return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${path}`
}

export async function uploadListingImage(
  file: File,
  userId: string,
): Promise<{ url: string; path: string }> {
  if (file.size > MAX_SIZE) throw new Error('Image must be under 5MB')
  if (!ALLOWED_TYPES.includes(file.type)) {
    throw new Error('Only JPG, PNG, WebP and GIF are supported')
  }

  const ext  = file.name.split('.').pop()?.toLowerCase() ?? 'jpg'
  const rand = Math.random().toString(36).slice(2, 8)
  const path = `${userId}/${Date.now()}-${rand}.${ext}`

  const supabase = createClient()
  const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
    contentType: file.type,
    upsert: false,
  })
  if (error) throw new Error(error.message)

  return { url: getListingImageUrl(path), path }
}

export async function deleteListingImage(path: string): Promise<void> {
  const supabase = createClient()
  await supabase.storage.from(BUCKET).remove([path])
}
