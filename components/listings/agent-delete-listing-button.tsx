'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { deleteListing } from '@/lib/actions/listings'

interface Props {
  listingId: string
  redirectTo?: string
}

export function AgentDeleteListingButton({ listingId, redirectTo = '/agent/browse' }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  function handleDelete() {
    if (!confirm('Delete this listing? This cannot be undone.')) return
    startTransition(async () => {
      const result = await deleteListing(listingId)
      if (result.success) {
        router.push(redirectTo)
      }
    })
  }

  return (
    <button
      onClick={handleDelete}
      disabled={isPending}
      className="text-red-500 hover:text-red-400 disabled:opacity-50 transition-colors"
    >
      {isPending ? '…' : 'delete'}
    </button>
  )
}
