'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { deleteListing } from '@/lib/actions/listings'

interface Props {
  listingId: string
  redirectTo?: string
}

export function DeleteListingButton({ listingId, redirectTo = '/browse' }: Props) {
  const router = useRouter()
  const [showDialog, setShowDialog] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleConfirm() {
    startTransition(async () => {
      const result = await deleteListing(listingId)
      if (result.success) {
        router.push(redirectTo)
      } else {
        setError(result.error ?? 'Failed to delete listing')
        setShowDialog(false)
      }
    })
  }

  return (
    <>
      <button
        onClick={() => setShowDialog(true)}
        className="text-sm text-red-500 hover:text-red-400 underline transition-colors"
      >
        Delete listing
      </button>

      {error && (
        <p className="text-sm text-red-400 mt-1">{error}</p>
      )}

      {showDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="bg-zinc-900 border border-zinc-700 rounded-xl p-6 max-w-sm w-full mx-4 space-y-4">
            <h3 className="text-base font-semibold text-white">Delete this listing?</h3>
            <p className="text-sm text-zinc-400">This cannot be undone.</p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowDialog(false)}
                disabled={isPending}
                className="px-4 py-2 text-sm text-zinc-300 hover:text-white transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirm}
                disabled={isPending}
                className="px-4 py-2 text-sm bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white rounded-lg font-medium transition-colors"
              >
                {isPending ? 'Deleting…' : 'Delete listing'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
