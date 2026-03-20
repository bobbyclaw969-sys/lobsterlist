import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getBtcPriceUsd, satsToUsd } from '@/lib/utils/sats'
import { ClaimButton } from '@/components/listings/claim-button'
import type { ListingWithDetail, ListingCategory } from '@/types/database'

const CATEGORY_LABELS: Record<ListingCategory, string> = {
  job:     'Job',
  gig:     'Gig',
  service: 'Service',
  good:    'Digital Good',
}

interface Props {
  params: Promise<{ id: string }>
}

export default async function ListingPage({ params }: Props) {
  const { id } = await params
  const [supabase, btcPrice] = await Promise.all([
    createClient(),
    getBtcPriceUsd(),
  ])

  const { data } = await supabase
    .from('listings')
    .select(`*, listing_jobs(*), listing_gigs(*), listing_services(*), listing_goods(*)`)
    .eq('id', id)
    .single()

  if (!data) notFound()

  const listing = data as ListingWithDetail
  const usdDisplay = satsToUsd(listing.price_sats, btcPrice)

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      <header className="flex items-center justify-between px-4 sm:px-6 py-4 border-b border-zinc-800">
        <Link href="/browse" className="text-lg font-bold tracking-tight">
          <span className="text-orange-400">Lobster</span>List
        </Link>
        <Link href="/browse" className="text-sm text-zinc-400 hover:text-white transition-colors">
          ← Back to browse
        </Link>
      </header>

      <main className="max-w-2xl mx-auto px-4 sm:px-6 py-8 space-y-6">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <span className="text-xs text-zinc-500 uppercase tracking-wider">
              {CATEGORY_LABELS[listing.category]}
            </span>
          </div>
          <h1 className="text-2xl font-bold">{listing.title}</h1>
          {/* Human UI: show earnings, not price — no sats, no fees */}
          <div className="space-y-0.5">
            <p className="text-2xl font-bold text-green-400">You earn: {usdDisplay}</p>
            <p className="text-xs text-zinc-500">Keep 100% of what you earn — no fees, ever</p>
          </div>
        </div>

        <p className="text-zinc-300 leading-relaxed whitespace-pre-wrap">{listing.description}</p>

        {listing.tags.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {listing.tags.map((tag) => (
              <span key={tag} className="text-xs text-zinc-400 bg-zinc-800 border border-zinc-700 px-3 py-1 rounded-full">
                {tag}
              </span>
            ))}
          </div>
        )}

        {/* Details box — no raw sats, no fee percentages */}
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4 space-y-2 text-sm text-zinc-400">
          <p className="text-xs uppercase tracking-wider text-zinc-600 font-medium">Details</p>
          <p>Posted: <span className="text-white">{new Date(listing.created_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</span></p>

          {listing.category === 'job' && listing.job && (
            <>
              {listing.job.deadline && <p>Deadline: <span className="text-white">{new Date(listing.job.deadline).toLocaleDateString()}</span></p>}
              {listing.job.required_skills?.length > 0 && <p>Skills: <span className="text-white">{listing.job.required_skills.join(', ')}</span></p>}
              {listing.job.deliverable_description && <p>Deliverable: <span className="text-white">{listing.job.deliverable_description}</span></p>}
            </>
          )}
          {listing.category === 'gig' && listing.gig && (
            <>
              {listing.gig.delivery_time_hours && <p>Delivery: <span className="text-white">{listing.gig.delivery_time_hours}h</span></p>}
              <p>Revisions: <span className="text-white">{listing.gig.revision_count}</span></p>
            </>
          )}
          {listing.category === 'service' && listing.service && (
            <>
              <p>Pricing: <span className="text-white capitalize">{listing.service.pricing_type}</span></p>
              {listing.service.availability_text && <p>Availability: <span className="text-white">{listing.service.availability_text}</span></p>}
            </>
          )}
          {listing.category === 'good' && listing.good && (
            <>
              <p>License: <span className="text-white capitalize">{listing.good.license_type}</span></p>
              {listing.good.file_type && <p>File type: <span className="text-white">{listing.good.file_type}</span></p>}
              {listing.good.instant_delivery && <p>Delivery: <span className="text-white">Instant</span></p>}
            </>
          )}
        </div>

        {listing.status === 'open' ? (
          <ClaimButton listingId={listing.id} priceSats={listing.price_sats} />
        ) : (
          <div className="w-full text-center bg-zinc-800 text-zinc-500 rounded-lg py-3 text-sm font-medium">
            {listing.status === 'claimed'   ? 'This listing has been claimed' :
             listing.status === 'completed' ? 'This listing is completed' :
             listing.status === 'disputed'  ? 'This listing is under dispute' :
             'This listing is not available'}
          </div>
        )}
      </main>
    </div>
  )
}
