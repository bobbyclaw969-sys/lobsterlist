'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { updateAvatar, removeAvatar } from '@/app/actions/profile'

const BUCKET  = 'listing-images'
const MAX_SIZE = 5 * 1024 * 1024
const ACCEPT  = 'image/jpeg,image/png,image/webp,image/gif'

interface Props {
  currentUrl: string | null
  displayName: string
}

export function AvatarUpload({ currentUrl, displayName }: Props) {
  const router   = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [previewUrl, setPreviewUrl] = useState<string | null>(currentUrl)
  const [error, setError] = useState<string | null>(null)

  const initial = (displayName || '?')[0].toUpperCase()

  async function handleFile(file: File) {
    setError(null)
    if (file.size > MAX_SIZE) { setError('Image must be under 5MB'); return }
    if (!['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(file.type)) {
      setError('Only JPG, PNG, WebP and GIF are supported')
      return
    }

    setPreviewUrl(URL.createObjectURL(file))
    setUploading(true)

    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not signed in')

      const ext  = file.name.split('.').pop()?.toLowerCase() ?? 'jpg'
      const path = `${user.id}/avatar.${ext}`

      const { error: uploadError } = await supabase.storage
        .from(BUCKET)
        .upload(path, file, { contentType: file.type, upsert: true })
      if (uploadError) throw new Error(uploadError.message)

      const url = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${path}`
      const { error: dbError } = await updateAvatar(url)
      if (dbError) throw new Error(dbError)

      setPreviewUrl(url)
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed')
      setPreviewUrl(currentUrl)
    } finally {
      setUploading(false)
    }
  }

  async function handleRemove() {
    setUploading(true)
    await removeAvatar()
    setPreviewUrl(null)
    if (inputRef.current) inputRef.current.value = ''
    setUploading(false)
    router.refresh()
  }

  return (
    <div className="flex items-center gap-4">
      {/* Avatar circle */}
      <button
        type="button"
        onClick={() => !uploading && inputRef.current?.click()}
        className="relative w-16 h-16 rounded-full overflow-hidden flex-shrink-0 group"
        title="Change photo"
      >
        {previewUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={previewUrl} alt={displayName} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full bg-orange-500/20 border border-orange-500/30 flex items-center justify-center text-2xl font-bold text-orange-400">
            {initial}
          </div>
        )}
        {uploading && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/50">
            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
          </div>
        )}
        {!uploading && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/0 group-hover:bg-black/40 transition-colors">
            <span className="opacity-0 group-hover:opacity-100 text-white text-xs font-medium transition-opacity">Edit</span>
          </div>
        )}
      </button>

      <div className="space-y-1">
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="text-sm text-orange-400 hover:text-orange-300 disabled:opacity-50 transition-colors"
        >
          {uploading ? 'Uploading…' : 'Change photo'}
        </button>
        {previewUrl && !uploading && (
          <button
            type="button"
            onClick={handleRemove}
            className="block text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
          >
            Remove
          </button>
        )}
        {error && <p className="text-xs text-red-400">{error}</p>}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) handleFile(file)
        }}
      />
    </div>
  )
}
