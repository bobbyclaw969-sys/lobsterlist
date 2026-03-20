import Link from 'next/link'
import { redirect } from 'next/navigation'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getBtcPriceUsd } from '@/lib/utils/sats'
import { EditListingForm } from '@/components/listings/edit-listing-form'
import type { ListingWithDetail } from '@/types/database'

interface Props {
  params: Promise<{ id: string }>
}

export default async function EditListingPage({ params }: Props) {
  const { id } = await params
  const [supabase, btcPriceUsd] = await Promise.all([createClient(), getBtcPriceUsd()])
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data } = await supabase
    .from('listings')
    .select('*, job:listing_jobs(*), gig:listing_gigs(*), service:listing_services(*), good:listing_goods(*)')
    .eq('id', id)
    .single()

  if (!data) notFound()

  const listing = data as ListingWithDetail

  if (listing.creator_user_id !== user.id) redirect('/browse')

  if (!['open', 'pending_payment'].includes(listing.status)) {
    return (
      <div className="min-h-screen bg-zinc-950 text-white flex items-center justify-center px-4">
        <div className="max-w-md w-full text-center space-y-4">
          <p className="text-zinc-400">This listing can no longer be edited — it has been claimed or completed.</p>
          <Link href={`/listings/${id}`} className="text-orange-400 hover:text-orange-300 text-sm underline">
            View listing →
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      <header className="flex items-center justify-between px-4 sm:px-6 py-4 border-b border-zinc-800">
        <Link href="/browse" className="text-lg font-bold tracking-tight">
          <span className="text-orange-400">Lobster</span>List
        </Link>
        <Link href={`/listings/${id}`} className="text-sm text-zinc-400 hover:text-white transition-colors">
          Cancel
        </Link>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold">Edit listing</h1>
          <p className="text-zinc-400 text-sm mt-1">
            Changes apply immediately. Claimed listings cannot be edited.
          </p>
        </div>

        <EditListingForm listing={listing} btcPriceUsd={btcPriceUsd} />
      </main>
    </div>
  )
}
