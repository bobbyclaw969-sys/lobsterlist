import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getBtcPriceUsd } from '@/lib/utils/sats'
import { ListingCard } from '@/components/listings/listing-card'
import { MyListingsOpenSection } from '@/components/listings/my-listings-open-section'
import type { ListingWithDetail } from '@/types/database'

export const metadata = { title: 'My Listings — LobsterList' }

const STATUS_BADGES: Record<string, { label: string; className: string }> = {
  open:            { label: 'Open',      className: 'bg-green-500/10 text-green-400 border-green-500/20' },
  pending_payment: { label: 'Pending',   className: 'bg-zinc-700 text-zinc-400 border-zinc-600' },
  claimed:         { label: 'Claimed',   className: 'bg-amber-500/10 text-amber-400 border-amber-500/20' },
  completed:       { label: 'Completed', className: 'bg-zinc-700 text-zinc-500 border-zinc-600' },
  disputed:        { label: 'Disputed',  className: 'bg-red-500/10 text-red-400 border-red-500/20' },
}

export default async function MyListingsPage() {
  const [supabase, btcPrice] = await Promise.all([createClient(), getBtcPriceUsd()])
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: rawListings } = await supabase
    .from('listings')
    .select('*, listing_jobs(*), listing_gigs(*), listing_services(*), listing_goods(*)')
    .eq('creator_user_id', user.id)
    .order('created_at', { ascending: false })

  const listings = (rawListings ?? []) as ListingWithDetail[]

  const grouped = {
    open:      listings.filter((l) => l.status === 'open'),
    active:    listings.filter((l) => ['claimed', 'disputed'].includes(l.status)),
    completed: listings.filter((l) => l.status === 'completed'),
    other:     listings.filter((l) => l.status === 'pending_payment'),
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      <header className="flex items-center justify-between px-4 sm:px-6 py-4 border-b border-zinc-800 sticky top-0 bg-zinc-950/95 backdrop-blur z-10">
        <Link href="/browse" className="text-lg font-bold tracking-tight">
          <span className="text-orange-400">Lobster</span>List
        </Link>
        <div className="flex items-center gap-4">
          <Link href="/browse" className="text-sm text-zinc-400 hover:text-white transition-colors">Browse</Link>
          <Link href="/dashboard" className="text-sm text-zinc-400 hover:text-white transition-colors">Dashboard</Link>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8 space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">My Listings</h1>
            <p className="text-zinc-400 text-sm mt-1">{listings.length} total</p>
          </div>
          <Link
            href="/listings/new"
            className="bg-orange-500 hover:bg-orange-400 text-white px-5 py-2 rounded-full text-sm font-medium transition-colors"
          >
            + New listing
          </Link>
        </div>

        {listings.length === 0 ? (
          <div className="text-center py-20 space-y-4">
            <p className="text-zinc-400">You haven&apos;t posted any listings yet.</p>
            <Link
              href="/listings/new"
              className="inline-block bg-orange-500 hover:bg-orange-400 text-white px-6 py-2.5 rounded-full text-sm font-medium transition-colors"
            >
              Post your first listing
            </Link>
          </div>
        ) : (
          <div className="space-y-10">
            {grouped.open.length > 0 && (
              <section className="space-y-4">
                <h2 className="text-base font-semibold text-zinc-300 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-green-400 inline-block" />
                  Open ({grouped.open.length})
                </h2>
                <MyListingsOpenSection
                  listings={grouped.open}
                  btcPriceUsd={btcPrice}
                  currentUserId={user.id}
                />
              </section>
            )}

            {grouped.active.length > 0 && (
              <section className="space-y-4">
                <h2 className="text-base font-semibold text-zinc-300 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-amber-400 inline-block" />
                  In Progress ({grouped.active.length})
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {grouped.active.map((listing) => (
                    <div key={listing.id} className="relative">
                      <ListingCard listing={listing} btcPriceUsd={btcPrice} />
                      <StatusBadge status={listing.status} />
                    </div>
                  ))}
                </div>
              </section>
            )}

            {grouped.completed.length > 0 && (
              <section className="space-y-4">
                <h2 className="text-base font-semibold text-zinc-300 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-zinc-500 inline-block" />
                  Completed ({grouped.completed.length})
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 opacity-70">
                  {grouped.completed.map((listing) => (
                    <div key={listing.id} className="relative">
                      <ListingCard listing={listing} btcPriceUsd={btcPrice} />
                      <StatusBadge status={listing.status} />
                    </div>
                  ))}
                </div>
              </section>
            )}
          </div>
        )}
      </main>

      {/* FAB — post new listing */}
      <div className="fixed bottom-6 right-6">
        <Link
          href="/listings/new"
          className="flex items-center gap-2 bg-orange-500 hover:bg-orange-400 text-white px-5 py-3 rounded-full font-medium shadow-lg transition-colors"
        >
          <span className="text-lg leading-none">+</span>
          <span className="text-sm">Post listing</span>
        </Link>
      </div>
    </div>
  )
}

function StatusBadge({ status }: { status: string }) {
  const badge = STATUS_BADGES[status]
  if (!badge) return null
  return (
    <span className={`absolute top-3 right-3 text-xs font-medium px-2 py-0.5 rounded-full border ${badge.className}`}>
      {badge.label}
    </span>
  )
}
