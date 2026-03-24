'use client'

import { useState, useTransition } from 'react'
import { Trash2 } from 'lucide-react'
import { ListingCard } from '@/components/listings/listing-card'
import { deleteListing } from '@/lib/actions/listings'
import type { ListingWithDetail } from '@/types/database'

interface Props {
  listings: ListingWithDetail[]
  btcPriceUsd: number
  currentUserId: string
}

export function MyListingsOpenSection({ listings, btcPriceUsd, currentUserId }: Props) {
  const [visibleIds, setVisibleIds] = useState(() => listings.map((l) => l.id))
  const [confirmId, setConfirmId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [, startTransition] = useTransition()

  const shown = listings.filter((l) => visibleIds.includes(l.id))

  function handleDelete(listingId: string) {
    // Optimistic remove
    setVisibleIds((prev) => prev.filter((id) => id !== listingId))
    setConfirmId(null)

    startTransition(async () => {
      const result = await deleteListing(listingId)
      if (!result.success) {
        // Restore card on error
        setVisibleIds((prev) => [...prev, listingId])
        setError(result.error ?? 'Failed to delete listing')
      }
    })
  }

  return (
    <>
      {error && (
        <p className="text-sm text-red-400 bg-red-950 border border-red-800 rounded-lg px-3 py-2 mb-2">
          {error}
        </p>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {shown.map((listing) => (
          <div key={listing.id} className="relative">
            <ListingCard listing={listing} btcPriceUsd={btcPriceUsd} currentUserId={currentUserId} />
            <button
              onClick={() => setConfirmId(listing.id)}
              className="absolute bottom-3 right-3 p-1.5 rounded-md bg-zinc-900 border border-zinc-700 text-red-400 hover:text-red-300 hover:border-red-800 transition-colors"
              aria-label="Delete listing"
            >
              <Trash2 size={14} />
            </button>
          </div>
        ))}
      </div>

      {confirmId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="bg-zinc-900 border border-zinc-700 rounded-xl p-6 max-w-sm w-full mx-4 space-y-4">
            <h3 className="text-base font-semibold text-white">Delete this listing?</h3>
            <p className="text-sm text-zinc-400">This cannot be undone.</p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setConfirmId(null)}
                className="px-4 py-2 text-sm text-zinc-300 hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDelete(confirmId)}
                className="px-4 py-2 text-sm bg-red-600 hover:bg-red-500 text-white rounded-lg font-medium transition-colors"
              >
                Delete listing
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
