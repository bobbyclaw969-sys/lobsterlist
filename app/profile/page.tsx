import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { logout } from '@/app/actions/auth'
import { ListingCard } from '@/components/listings/listing-card'
import { WalletLinkSection } from '@/components/auth/wallet-link-section'
import { getBtcPriceUsd } from '@/lib/utils/sats'
import type { ListingWithDetail, UserRow } from '@/types/database'

export const metadata = { title: 'My Profile — LobsterList' }

export default async function MyProfilePage() {
  const [supabase, btcPrice] = await Promise.all([createClient(), getBtcPriceUsd()])
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [{ data: rawProfile }, { data: rawListings }] = await Promise.all([
    supabase.from('users').select('*').eq('id', user.id).single(),
    supabase
      .from('listings')
      .select('*, listing_jobs(*), listing_gigs(*), listing_services(*), listing_goods(*)')
      .eq('creator_user_id', user.id)
      .order('created_at', { ascending: false }),
  ])

  const profile = rawProfile as UserRow | null
  const listings = (rawListings ?? []) as ListingWithDetail[]

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      <header className="flex items-center justify-between px-4 sm:px-6 py-4 border-b border-zinc-800">
        <Link href="/browse" className="text-lg font-bold tracking-tight">
          <span className="text-orange-400">Lobster</span>List
        </Link>
        <form action={logout}>
          <button type="submit" className="text-sm text-zinc-500 hover:text-white transition-colors">
            Sign out
          </button>
        </form>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-8 space-y-8">
        {/* Profile header */}
        <div className="flex items-start gap-4">
          <div className="w-16 h-16 rounded-full bg-orange-500/20 border border-orange-500/30 flex items-center justify-center text-2xl font-bold text-orange-400 flex-shrink-0">
            {(profile?.name ?? user.email ?? '?')[0].toUpperCase()}
          </div>
          <div className="space-y-1 min-w-0">
            <h1 className="text-xl font-bold">{profile?.name ?? 'Anonymous'}</h1>
            <p className="text-sm text-zinc-400">{user.email}</p>
            {profile?.bio && <p className="text-sm text-zinc-300 mt-2">{profile.bio}</p>}
            {profile?.location && <p className="text-xs text-zinc-500">{profile.location}</p>}
            {profile?.skills && profile.skills.length > 0 && (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {profile.skills.map((s: string) => (
                  <span key={s} className="text-xs text-zinc-400 bg-zinc-800 border border-zinc-700 px-2 py-0.5 rounded-full">{s}</span>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="flex gap-4 pt-2">
          <Link
            href="/listings/new"
            className="bg-orange-500 hover:bg-orange-400 text-white px-5 py-2 rounded-full text-sm font-medium transition-colors"
          >
            + New listing
          </Link>
        </div>

        {/* Wallet */}
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5">
          <WalletLinkSection walletAddress={profile?.btc_wallet_address ?? null} />
        </div>

        {/* My listings */}
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">My listings</h2>
          {listings.length === 0 ? (
            <p className="text-zinc-500 text-sm">No listings yet.</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {listings.map((listing) => (
                <ListingCard key={listing.id} listing={listing} btcPriceUsd={btcPrice} />
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
