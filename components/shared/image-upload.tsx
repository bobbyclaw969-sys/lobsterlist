'use client'

import { useState, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { uploadListingImage, deleteListingImage } from '@/lib/supabase/storage'

const ACCEPT = 'image/jpeg,image/png,image/webp,image/gif'

interface Props {
  variant: 'human' | 'agent'
  onUpload: (url: string, path: string) => void
  onRemove: () => void
  existingUrl?: string
  className?: string
}

export function ImageUpload({ variant, onUpload, onRemove, existingUrl, className }: Props) {
  const [uploading, setUploading] = useState(false)
  const [previewUrl, setPreviewUrl] = useState<string | null>(existingUrl ?? null)
  const [storagePath, setStoragePath] = useState<string | null>(null)
  const [fileName, setFileName] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  async function handleFile(file: File) {
    setError(null)

    // Client-side validation
    if (file.size > 5 * 1024 * 1024) {
      setError('Image must be under 5MB')
      return
    }
    if (!['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(file.type)) {
      setError('Only JPG, PNG, WebP, and GIF are supported')
      return
    }

    // Show local preview immediately (human only — agent just shows filename)
    if (variant === 'human') {
      setPreviewUrl(URL.createObjectURL(file))
    }
    setFileName(file.name)
    setUploading(true)

    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not signed in')

      const { url, path } = await uploadListingImage(file, user.id)
      setStoragePath(path)
      setUploading(false)
      onUpload(url, path)
    } catch (err) {
      setUploading(false)
      setPreviewUrl(null)
      setFileName(null)
      setError(err instanceof Error ? err.message : 'Upload failed')
    }
  }

  async function handleRemove() {
    if (storagePath) {
      await deleteListingImage(storagePath).catch(() => {})
    }
    setPreviewUrl(null)
    setFileName(null)
    setStoragePath(null)
    setError(null)
    if (inputRef.current) inputRef.current.value = ''
    onRemove()
  }

  // ── Human variant ────────────────────────────────────────────────────────────
  if (variant === 'human') {
    return (
      <div className={className}>
        {previewUrl ? (
          <div className="relative">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={previewUrl}
              alt="Listing photo"
              className="w-full h-48 object-cover rounded-2xl"
            />
            {uploading && (
              <div className="absolute inset-0 flex items-center justify-center rounded-2xl bg-black/50">
                <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
              </div>
            )}
            {!uploading && (
              <button
                type="button"
                onClick={handleRemove}
                className="absolute top-2 right-2 w-7 h-7 flex items-center justify-center bg-black/60 hover:bg-black/80 text-white rounded-full text-sm transition-colors"
                aria-label="Remove photo"
              >
                ✕
              </button>
            )}
          </div>
        ) : (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
            className="w-full min-h-[180px] flex flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-zinc-700 bg-zinc-900/50 hover:border-orange-500/60 hover:bg-orange-500/5 transition-colors disabled:opacity-50"
          >
            <span className="text-3xl">📷</span>
            <div className="text-center">
              <p className="text-sm font-medium text-white">Tap to add a photo</p>
              <p className="text-xs text-zinc-500 mt-0.5">JPG, PNG, WebP up to 5MB</p>
            </div>
          </button>
        )}

        {error && (
          <p className="mt-2 text-xs text-red-400">{error}</p>
        )}

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

  // ── Agent variant (Craigslist-minimal) ───────────────────────────────────────
  return (
    <div className={className}>
      <div className="flex items-center gap-2">
        <label className="text-xs text-zinc-400 uppercase tracking-wider">
          Attach image (optional)
        </label>
      </div>
      <div className="flex items-center gap-2 mt-1">
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPT}
          disabled={uploading}
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (file) handleFile(file)
          }}
          className="text-xs text-zinc-400 file:mr-2 file:py-1 file:px-2 file:border file:border-zinc-600 file:bg-zinc-800 file:text-zinc-300 file:text-xs file:cursor-pointer hover:file:border-zinc-400 disabled:opacity-50"
        />
        {uploading && (
          <span className="text-xs text-zinc-500">Uploading…</span>
        )}
        {fileName && !uploading && (
          <button
            type="button"
            onClick={handleRemove}
            className="text-xs text-zinc-500 hover:text-zinc-300 underline"
          >
            remove
          </button>
        )}
      </div>
      {fileName && !uploading && (
        <p className="text-xs text-zinc-500 mt-1">✓ {fileName}</p>
      )}
      {error && (
        <p className="text-xs text-red-400 mt-1">{error}</p>
      )}
    </div>
  )
}
