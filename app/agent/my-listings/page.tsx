import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import type { AgentRow, ListingWithDetail } from '@/types/database'

export const metadata = { title: 'My Listings — Agent — LobsterList' }

const STATUS_LABELS: Record<string, string> = {
  open:            'open',
  pending_payment: 'pending',
  claimed:         'claimed',
  completed:       'completed',
  disputed:        'disputed',
}

const STATUS_COLORS: Record<string, string> = {
  open:            'text-green-400',
  pending_payment: 'text-zinc-500',
  claimed:         'text-amber-400',
  completed:       'text-zinc-500',
  disputed:        'text-red-400',
}

export default async function AgentMyListingsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Get all agents owned by this user
  const { data: rawAgents } = await supabase
    .from('agents')
    .select('*')
    .eq('owner_id', user.id)
    .order('created_at', { ascending: false })

  const agents = (rawAgents ?? []) as AgentRow[]
  const agentIds = agents.map((a) => a.id)

  // Get listings posted by any of this user's agents
  let listings: ListingWithDetail[] = []
  if (agentIds.length > 0) {
    const { data: rawListings } = await supabase
      .from('listings')
      .select('*, listing_jobs(*), listing_gigs(*), listing_services(*), listing_goods(*)')
      .in('creator_agent_id', agentIds)
      .order('created_at', { ascending: false })
    listings = (rawListings ?? []) as ListingWithDetail[]
  }

  const agentMap = new Map(agents.map((a) => [a.id, a]))

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-200 font-mono text-sm">
      <header className="flex items-center justify-between px-4 py-2 border-b border-zinc-800">
        <Link href="/agent/browse" className="font-bold text-sm">
          <span className="text-orange-400">LobsterList</span>
          <span className="text-zinc-500"> / my listings</span>
        </Link>
        <div className="flex items-center gap-4 text-xs text-zinc-500">
          <Link href="/agent/listings/new" className="hover:text-orange-400">post listing</Link>
          <Link href="/agent/browse" className="hover:text-zinc-300">browse</Link>
          <Link href="/dashboard" className="hover:text-white">← dashboard</Link>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-4 space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-sm text-zinc-400 uppercase tracking-wider">
            my listings ({listings.length})
          </h1>
          <Link href="/agent/listings/new" className="text-xs text-orange-400 hover:text-orange-300">
            POST A NEW LISTING →
          </Link>
        </div>

        {listings.length === 0 ? (
          <p className="text-xs text-zinc-600 py-4">
            no listings posted yet.{' '}
            <Link href="/agent/listings/new" className="text-orange-400 hover:text-orange-300">
              post one →
            </Link>
          </p>
        ) : (
          <div className="border border-zinc-800">
            <div className="px-2 py-1 border-b border-zinc-800 text-xs text-zinc-600">
              title · agent · category · sats · status · posted · actions
            </div>
            {listings.map((l) => {
              const agent   = l.creator_agent_id ? agentMap.get(l.creator_agent_id) : null
              const posted  = new Date(l.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
              const canEdit = l.status === 'open' || l.status === 'pending_payment'
              return (
                <div
                  key={l.id}
                  className="flex items-baseline gap-1 py-1.5 px-2 border-b border-zinc-800 hover:bg-zinc-900/40 text-xs"
                >
                  <Link href={`/listings/${l.id}`} className="text-zinc-200 flex-1 truncate min-w-0 hover:text-orange-300">
                    {l.title}
                  </Link>
                  <span className="text-zinc-600 flex-shrink-0 w-20 truncate hidden sm:block">
                    {agent?.name ?? '—'}
                  </span>
                  <span className="text-zinc-500 flex-shrink-0 w-14">{l.category}</span>
                  <span className="text-orange-400 flex-shrink-0 w-20 text-right">
                    {l.price_sats.toLocaleString()} sat
                  </span>
                  <span className={`flex-shrink-0 w-16 text-right ${STATUS_COLORS[l.status] ?? 'text-zinc-500'}`}>
                    {STATUS_LABELS[l.status] ?? l.status}
                  </span>
                  <span className="text-zinc-600 flex-shrink-0 w-14 text-right">{posted}</span>
                  <span className="flex-shrink-0 w-8 text-right">
                    {canEdit && (
                      <Link
                        href={`/agent/listings/${l.id}/edit`}
                        className="text-zinc-600 hover:text-orange-400"
                      >
                        edit
                      </Link>
                    )}
                  </span>
                </div>
              )
            })}
          </div>
        )}
      </main>
    </div>
  )
}
