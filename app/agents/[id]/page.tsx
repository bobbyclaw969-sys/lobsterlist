import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getBtcPriceUsd, satsToUsd } from '@/lib/utils/sats'
import type { AgentRow, ListingWithDetail } from '@/types/database'

interface Props {
  params: Promise<{ id: string }>
}

export default async function AgentPage({ params }: Props) {
  const { id } = await params
  const [supabase, btcPrice] = await Promise.all([createClient(), getBtcPriceUsd()])
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: rawAgent } = await supabase
    .from('agents')
    .select('*')
    .eq('id', id)
    .single()

  if (!rawAgent) notFound()
  const agent = rawAgent as AgentRow

  // Only owner can view this page
  if (agent.owner_id !== user.id) notFound()

  const { data: rawListings } = await supabase
    .from('listings')
    .select('*, listing_jobs(*), listing_gigs(*), listing_services(*), listing_goods(*)')
    .eq('creator_agent_id', id)
    .order('created_at', { ascending: false })
    .limit(20)

  const listings = (rawListings ?? []) as ListingWithDetail[]

  const spentPct = agent.spending_limit_sats > 0
    ? Math.min(100, Math.round((agent.sats_spent_total / agent.spending_limit_sats) * 100))
    : 0

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      <header className="flex items-center justify-between px-4 sm:px-6 py-4 border-b border-zinc-800">
        <Link href="/dashboard" className="text-lg font-bold tracking-tight">
          <span className="text-orange-400">Lobster</span>List
        </Link>
        <Link href="/dashboard" className="text-sm text-zinc-400 hover:text-white transition-colors">
          ← Dashboard
        </Link>
      </header>

      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-8 space-y-8">
        {/* Agent header */}
        <div className="flex items-start gap-4">
          <div className="w-14 h-14 rounded-full bg-blue-500/20 border border-blue-500/30 flex items-center justify-center text-xl font-bold text-blue-400 flex-shrink-0">
            ⚡
          </div>
          <div className="space-y-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl font-bold">{agent.name}</h1>
              {agent.verified ? (
                <span className="text-xs bg-green-500/10 border border-green-500/20 text-green-400 px-2 py-0.5 rounded-full">
                  Verified ⚡
                </span>
              ) : (
                <span className="text-xs bg-amber-500/10 border border-amber-500/20 text-amber-400 px-2 py-0.5 rounded-full">
                  Pending payment
                </span>
              )}
            </div>
            <p className="text-sm text-zinc-500 font-mono break-all">{agent.btc_wallet_address}</p>
            {agent.description && <p className="text-sm text-zinc-300">{agent.description}</p>}
            {agent.capabilities.length > 0 && (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {agent.capabilities.map((c) => (
                  <span key={c} className="text-xs text-zinc-400 bg-zinc-800 border border-zinc-700 px-2 py-0.5 rounded-full">
                    {c}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Spending limit */}
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5 space-y-4">
          <h2 className="text-sm font-semibold text-zinc-300 uppercase tracking-wider">Spending limit</h2>

          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <p className="text-lg font-bold text-white">{satsToUsd(agent.sats_spent_total, btcPrice)}</p>
              <p className="text-xs text-zinc-500">Spent</p>
            </div>
            <div>
              <p className="text-lg font-bold text-orange-400">
                {agent.spending_limit_sats > 0
                  ? satsToUsd(agent.spending_limit_sats - agent.sats_spent_total, btcPrice)
                  : '∞'}
              </p>
              <p className="text-xs text-zinc-500">Remaining</p>
            </div>
            <div>
              <p className="text-lg font-bold text-white">
                {agent.spending_limit_sats > 0 ? satsToUsd(agent.spending_limit_sats, btcPrice) : 'No limit'}
              </p>
              <p className="text-xs text-zinc-500">Limit</p>
            </div>
          </div>

          {agent.spending_limit_sats > 0 && (
            <div className="w-full bg-zinc-800 rounded-full h-2">
              <div
                className={`h-2 rounded-full transition-all ${spentPct >= 90 ? 'bg-red-500' : spentPct >= 70 ? 'bg-amber-500' : 'bg-orange-500'}`}
                style={{ width: `${spentPct}%` }}
              />
            </div>
          )}

          <SpendingLimitForm agentId={id} currentLimit={agent.spending_limit_sats} />
        </div>

        {/* Listings */}
        <div className="space-y-3">
          <h2 className="text-lg font-semibold">Listings by this agent</h2>
          {listings.length === 0 ? (
            <p className="text-zinc-500 text-sm">No listings yet.</p>
          ) : (
            <div className="space-y-2">
              {listings.map((l) => (
                <Link
                  key={l.id}
                  href={`/listings/${l.id}`}
                  className="flex items-center justify-between gap-3 p-3 rounded-lg border border-zinc-800 hover:border-zinc-600 transition-colors"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-white truncate">{l.title}</p>
                    <p className="text-xs text-zinc-500 capitalize">{l.status} · {l.category}</p>
                  </div>
                  <p className="text-sm font-semibold text-orange-400 flex-shrink-0">
                    {satsToUsd(l.price_sats, btcPrice)}
                  </p>
                </Link>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  )
}

// Inline spending limit editor (client component)
import { SpendingLimitForm } from '@/components/agents/spending-limit-form'
