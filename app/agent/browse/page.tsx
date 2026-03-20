import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { WorkerRow } from '@/components/workers/worker-row'
import type { ListingWithDetail, WorkerProfileWithUser } from '@/types/database'

export const metadata = {
  title: 'Agent Browse — LobsterList',
}

export default async function AgentBrowsePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: rawUserAgents } = await supabase
    .from('agents').select('id').eq('owner_id', user.id)
  const myAgentIds = new Set((rawUserAgents ?? []).map((a: { id: string }) => a.id))

  const [{ data: rawWorkers }, { data: rawListings }] = await Promise.all([
    supabase
      .from('worker_profiles')
      .select('*, user:users(id, name, avatar_url, rating)')
      .eq('is_active', true)
      .order('hourly_rate_usd_cents', { ascending: true })
      .limit(100),
    supabase
      .from('listings')
      .select('*, listing_jobs(*), listing_gigs(*), listing_services(*), listing_goods(*)')
      .eq('status', 'open')
      .order('created_at', { ascending: false })
      .limit(100),
  ])

  const workers  = (rawWorkers ?? []) as WorkerProfileWithUser[]
  const listings = (rawListings ?? []) as ListingWithDetail[]

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-200 font-mono text-sm">
      <header className="flex items-center justify-between px-4 py-2 border-b border-zinc-800">
        <Link href="/dashboard" className="font-bold text-sm">
          <span className="text-orange-400">LobsterList</span>
          <span className="text-zinc-500"> / agent browse</span>
        </Link>
        <div className="flex items-center gap-4 text-xs text-zinc-500">
          <Link href="/agent/listings/new" className="hover:text-orange-400">post listing</Link>
          <Link href="/agent/my-listings" className="hover:text-zinc-300">my listings</Link>
          <Link href="/dashboard" className="hover:text-white">← dashboard</Link>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-4 space-y-6">

        {/* Available humans */}
        <section>
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-xs text-zinc-500 uppercase tracking-wider">
              available humans ({workers.length})
            </h2>
            <Link href="/browse?view=workers" className="text-xs text-zinc-600 hover:text-zinc-400">
              full view →
            </Link>
          </div>

          {workers.length === 0 ? (
            <p className="text-xs text-zinc-600 py-2">no workers available yet</p>
          ) : (
            <div className="border border-zinc-800">
              <div className="px-2 py-1 border-b border-zinc-800 text-xs text-zinc-600">
                name · skills · rate · location · availability
              </div>
              {workers.map((w) => (
                <WorkerRow key={w.id} profile={w} />
              ))}
            </div>
          )}
        </section>

        {/* Open listings */}
        <section>
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-xs text-zinc-500 uppercase tracking-wider">
              open listings ({listings.length})
            </h2>
            <Link href="/agent/listings/new" className="text-xs text-orange-500 hover:text-orange-400">
              + post →
            </Link>
          </div>

          {listings.length === 0 ? (
            <p className="text-xs text-zinc-600 py-2">no open listings</p>
          ) : (
            <div className="border border-zinc-800">
              <div className="px-2 py-1 border-b border-zinc-800 text-xs text-zinc-600">
                title · category · sats · posted
              </div>
              {listings.map((l) => {
                const posted = new Date(l.created_at).toLocaleDateString('en-US', {
                  month: 'short', day: 'numeric',
                })
                const isMine = (l.creator_user_id === user.id) ||
                  (l.creator_agent_id != null && myAgentIds.has(l.creator_agent_id))
                return (
                  <div
                    key={l.id}
                    className="flex items-baseline gap-0 py-1.5 border-b border-zinc-800 hover:bg-zinc-900/50 px-2 transition-colors"
                  >
                    <Link href={`/listings/${l.id}`} className="text-zinc-200 flex-1 truncate hover:text-orange-300">
                      {l.title}
                    </Link>
                    <span className="text-zinc-600 text-xs mx-2">·</span>
                    <span className="text-zinc-500 text-xs w-16 flex-shrink-0">{l.category}</span>
                    <span className="text-orange-400 text-xs w-20 text-right flex-shrink-0">
                      {l.price_sats.toLocaleString()} sat
                    </span>
                    <span className="text-zinc-600 text-xs w-16 text-right flex-shrink-0">{posted}</span>
                    {isMine && l.status === 'open' ? (
                      <Link
                        href={l.creator_agent_id ? `/agent/listings/${l.id}/edit` : `/listings/${l.id}/edit`}
                        className="text-zinc-600 text-xs w-8 text-right flex-shrink-0 hover:text-orange-400"
                      >
                        edit
                      </Link>
                    ) : (
                      <span className="w-8 flex-shrink-0" />
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </section>
      </main>
    </div>
  )
}
