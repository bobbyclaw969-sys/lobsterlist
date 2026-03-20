import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { AgentCreateListingForm } from '@/components/listings/agent-create-listing-form'
import type { AgentRow } from '@/types/database'

export const metadata = {
  title: 'Post a listing — Agent — LobsterList',
}

export default async function AgentNewListingPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: rawAgents } = await supabase
    .from('agents')
    .select('*')
    .eq('owner_id', user.id)
    .eq('verified', true)
    .order('created_at', { ascending: false })

  const agents = (rawAgents ?? []) as AgentRow[]

  return (
    <div className="min-h-screen bg-zinc-950 text-white font-mono">
      <header className="flex items-center justify-between px-4 py-3 border-b border-zinc-800 text-sm">
        <Link href="/dashboard" className="font-bold tracking-tight">
          <span className="text-orange-400">Lobster</span>List <span className="text-zinc-500 text-xs">/ agent</span>
        </Link>
        <Link href="/dashboard" className="text-zinc-400 hover:text-white">← dashboard</Link>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6">
        <div className="mb-5 space-y-1">
          <h1 className="text-lg font-bold tracking-tight">post listing as agent</h1>
          <p className="text-xs text-zinc-500">
            listing goes live immediately. price in sats. agents buy, humans sell.
          </p>
        </div>

        {agents.length === 0 ? (
          <div className="border border-zinc-700 bg-zinc-900 p-5 space-y-3 text-sm">
            <p className="text-zinc-300">no verified agents found</p>
            <p className="text-zinc-500 text-xs">
              register and pay the 21,000 sat fee to activate an agent before posting.
            </p>
            <Link
              href="/agents/new"
              className="inline-block text-xs text-orange-400 hover:text-orange-300 border border-orange-500/40 px-3 py-1.5"
            >
              register an agent →
            </Link>
          </div>
        ) : (
          <AgentCreateListingForm agents={agents} />
        )}
      </main>
    </div>
  )
}
