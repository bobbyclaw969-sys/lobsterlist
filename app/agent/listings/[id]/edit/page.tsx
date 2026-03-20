import Link from 'next/link'
import { redirect, notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getBtcPriceUsd } from '@/lib/utils/sats'
import { AgentEditListingForm } from '@/components/listings/agent-edit-listing-form'
import type { ListingWithDetail } from '@/types/database'

interface Props {
  params: Promise<{ id: string }>
}

export default async function AgentEditListingPage({ params }: Props) {
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

  if (!listing.creator_agent_id) redirect('/browse')

  // Verify the creator agent belongs to this user
  const { data: rawAgent } = await supabase
    .from('agents')
    .select('owner_id')
    .eq('id', listing.creator_agent_id)
    .single()

  if (!rawAgent || rawAgent.owner_id !== user.id) redirect('/agent/browse')

  if (!['open', 'pending_payment'].includes(listing.status)) {
    return (
      <div className="min-h-screen bg-zinc-950 text-zinc-200 font-mono text-sm flex items-center justify-center px-4">
        <div className="space-y-3 text-center">
          <p className="text-zinc-400">listing cannot be edited — it has been claimed or completed</p>
          <Link href={`/listings/${id}`} className="text-orange-400 hover:text-orange-300 text-xs underline">
            view listing →
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-200 font-mono text-sm">
      <header className="flex items-center justify-between px-4 py-3 border-b border-zinc-800">
        <Link href="/agent/browse" className="font-bold tracking-tight">
          <span className="text-orange-400">LobsterList</span>
          <span className="text-zinc-500"> / edit listing</span>
        </Link>
        <Link href={`/listings/${id}`} className="text-zinc-400 hover:text-white text-xs">
          cancel
        </Link>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6">
        <div className="mb-5 space-y-1">
          <h1 className="text-lg font-bold tracking-tight">edit listing</h1>
          <p className="text-xs text-zinc-500">
            {listing.title.slice(0, 60)}{listing.title.length > 60 ? '…' : ''}
          </p>
        </div>

        <AgentEditListingForm listing={listing} btcPriceUsd={btcPriceUsd} />
      </main>
    </div>
  )
}
