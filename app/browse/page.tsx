import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { logout } from '@/app/actions/auth'
import { ListingCard } from '@/components/listings/listing-card'
import { getBtcPriceUsd } from '@/lib/utils/sats'
import type { ListingCategory, ListingWithDetail } from '@/types/database'

export const metadata = {
  title: 'Browse — LobsterList',
}

const CATEGORIES: { value: ListingCategory | 'all'; label: string }[] = [
  { value: 'all',     label: 'All' },
  { value: 'job',     label: 'Jobs' },
  { value: 'gig',     label: 'Gigs' },
  { value: 'service', label: 'Services' },
  { value: 'good',    label: 'Digital Goods' },
]

interface BrowsePageProps {
  searchParams: Promise<{
    q?: string
    category?: string
    sort?: string
  }>
}

export default async function BrowsePage({ searchParams }: BrowsePageProps) {
  const params = await searchParams
  const q = params.q?.trim() ?? ''
  const category = (params.category ?? 'all') as ListingCategory | 'all'
  const sort = params.sort ?? 'newest'

  const [supabase, btcPrice] = await Promise.all([
    createClient(),
    getBtcPriceUsd(),
  ])

  const { data: { user } } = await supabase.auth.getUser()

  // Build query
  let query = supabase
    .from('listings')
    .select(`
      *,
      listing_jobs(*),
      listing_gigs(*),
      listing_services(*),
      listing_goods(*)
    `)
    .eq('status', 'open')

  if (category !== 'all') query = query.eq('category', category)

  if (q) {
    query = query.ilike('title', `%${q}%`)
  }

  if (sort === 'price_asc')  query = query.order('price_sats', { ascending: true })
  if (sort === 'price_desc') query = query.order('price_sats', { ascending: false })
  else                       query = query.order('created_at', { ascending: false })

  query = query.limit(48)

  const { data: rawListings } = await query

  const listings = (rawListings ?? []) as ListingWithDetail[]

  return (
    <div className="min-h-screen bg-zinc-950 text-white flex flex-col">
      {/* Nav */}
      <header className="flex items-center justify-between px-4 sm:px-6 py-4 border-b border-zinc-800 sticky top-0 bg-zinc-950/95 backdrop-blur z-10">
        <Link href="/" className="text-lg font-bold tracking-tight flex-shrink-0">
          <span className="text-orange-400">Lobster</span>List
        </Link>

        <div className="flex items-center gap-3">
          {user && (
            <Link
              href="/listings/new"
              className="text-sm bg-orange-500 hover:bg-orange-400 text-white px-4 py-1.5 rounded-full font-medium transition-colors"
            >
              + New listing
            </Link>
          )}
          {user ? (
            <form action={logout}>
              <button type="submit" className="text-sm text-zinc-500 hover:text-white transition-colors">
                Sign out
              </button>
            </form>
          ) : (
            <Link href="/login" className="text-sm text-zinc-400 hover:text-white transition-colors">
              Sign in
            </Link>
          )}
        </div>
      </header>

      <main className="flex-1 max-w-6xl mx-auto w-full px-4 sm:px-6 py-6 space-y-6">
        {/* Search + filters */}
        <form method="GET" className="space-y-3">
          <div className="flex gap-2">
            <input
              name="q"
              defaultValue={q}
              placeholder="Search listings…"
              className="flex-1 bg-zinc-900 border border-zinc-700 rounded-lg px-4 py-2.5 text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:border-orange-500"
            />
            <button
              type="submit"
              className="bg-orange-500 hover:bg-orange-400 text-white px-4 py-2.5 rounded-lg text-sm font-medium transition-colors"
            >
              Search
            </button>
          </div>

          <div className="flex flex-wrap gap-2 items-center">
            {/* Category pills */}
            <div className="flex gap-1.5 flex-wrap">
              {CATEGORIES.map(({ value, label }) => (
                <a
                  key={value}
                  href={`/browse?${new URLSearchParams({ ...(q && { q }), ...(value !== 'all' && { category: value }), ...(sort !== 'newest' && { sort }) }).toString()}`}
                  className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                    category === value
                      ? 'bg-orange-500 text-white'
                      : 'bg-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-700'
                  }`}
                >
                  {label}
                </a>
              ))}
            </div>

            <div className="ml-auto">
              <select
                name="sort"
                defaultValue={sort}
                onChange={() => {}} // handled by form submit
                className="bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-1.5 text-xs text-zinc-300 focus:outline-none focus:border-orange-500"
              >
                <option value="newest">Newest</option>
                <option value="price_asc">Price: Low to High</option>
                <option value="price_desc">Price: High to Low</option>
              </select>
            </div>
          </div>
        </form>

        {/* Results */}
        {listings.length === 0 ? (
          <div className="text-center py-20 space-y-3">
            <p className="text-zinc-400 text-lg">No listings found</p>
            {q && (
              <p className="text-zinc-500 text-sm">
                Try different keywords or{' '}
                <a href="/browse" className="text-orange-400 underline">clear search</a>
              </p>
            )}
            {user && (
              <Link
                href="/listings/new"
                className="inline-block mt-2 bg-orange-500 hover:bg-orange-400 text-white px-6 py-2.5 rounded-full text-sm font-medium transition-colors"
              >
                Be the first to post
              </Link>
            )}
          </div>
        ) : (
          <>
            <p className="text-xs text-zinc-500">
              {listings.length} listing{listings.length !== 1 ? 's' : ''}
              {q && ` for "${q}"`}
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {listings.map((listing) => (
                <ListingCard key={listing.id} listing={listing} btcPriceUsd={btcPrice} />
              ))}
            </div>
          </>
        )}
      </main>
    </div>
  )
}
