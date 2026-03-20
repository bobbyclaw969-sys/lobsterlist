import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getBtcPriceUsd, satsToUsd } from '@/lib/utils/sats'
import { calculateFees } from '@/lib/bitcoin/fees'
import { EscrowActions } from '@/components/dashboard/escrow-actions'
import type { EscrowContractRow, ListingRow } from '@/types/database'

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  pending_funding: { label: 'Awaiting payment',  color: 'text-amber-400' },
  funded:          { label: 'In progress',        color: 'text-blue-400' },
  completed:       { label: 'Completed',          color: 'text-green-400' },
  disputed:        { label: 'Disputed',           color: 'text-red-400' },
  cancelled:       { label: 'Cancelled',          color: 'text-zinc-400' },
  refunded:        { label: 'Refunded',           color: 'text-zinc-400' },
}

interface Props {
  params: Promise<{ id: string }>
}

export default async function EscrowPage({ params }: Props) {
  const { id } = await params
  const [supabase, btcPrice] = await Promise.all([createClient(), getBtcPriceUsd()])
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: rawContract } = await supabase
    .from('escrow_contracts')
    .select('*')
    .eq('id', id)
    .single()

  if (!rawContract) notFound()
  const contract = rawContract as EscrowContractRow

  const { data: rawListing } = await supabase
    .from('listings')
    .select('id, title, category, price_sats')
    .eq('id', contract.listing_id)
    .single()
  const listing = rawListing as Pick<ListingRow, 'id' | 'title' | 'category' | 'price_sats'> | null

  const isBuyer  = contract.buyer_user_id === user.id || contract.buyer_agent_id !== null
  const isSeller = contract.seller_user_id === user.id

  const statusInfo = STATUS_LABELS[contract.status] ?? { label: contract.status, color: 'text-zinc-400' }
  const fees = calculateFees(contract.amount_sats, btcPrice)

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

      <main className="max-w-2xl mx-auto px-4 sm:px-6 py-8 space-y-6">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className={`text-sm font-semibold ${statusInfo.color}`}>{statusInfo.label}</span>
          </div>
          <h1 className="text-2xl font-bold">{listing?.title ?? 'Escrow contract'}</h1>
          <p className="text-zinc-500 text-sm">Contract ID: <span className="font-mono">{id.slice(0, 8)}…</span></p>
        </div>

        {/* Payment summary — role-aware */}
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5 space-y-3">
          <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider">Payment summary</h2>

          {isSeller ? (
            // Human seller: show only what they earn — no fees, ever
            <div className="space-y-2 text-sm">
              <div className="flex justify-between border-t border-zinc-700 pt-2">
                <span className="text-zinc-300 font-medium">You earn</span>
                <div className="text-right">
                  <span className="font-bold text-green-400 text-lg">{satsToUsd(fees.humanPayoutSats, btcPrice)}</span>
                </div>
              </div>
              <p className="text-xs text-green-600">Keep 100% of what you earn — no fees, ever</p>
            </div>
          ) : (
            // Agent buyer: show full fee breakdown
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-zinc-400">Task budget</span>
                <span className="text-white">{satsToUsd(fees.humanPayoutSats, btcPrice)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-400">Platform fee (5%)</span>
                <span className="text-zinc-400">{satsToUsd(fees.platformFeeSats, btcPrice)}</span>
              </div>
              <div className="flex justify-between border-t border-zinc-700 pt-2">
                <span className="text-zinc-300">Total you pay</span>
                <span className="font-semibold text-white">{satsToUsd(fees.totalAgentCostSats, btcPrice)}</span>
              </div>
              <p className="text-xs text-zinc-600">
                Humans keep 100% — you pay the platform fee.
              </p>
            </div>
          )}

          <p className="text-xs text-zinc-600">
            Funds held in non-custodial escrow. LobsterList never holds your money.
          </p>
        </div>

        {/* Parties */}
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5 space-y-2 text-sm">
          <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider mb-3">Parties</h2>
          <div className="flex justify-between">
            <span className="text-zinc-400">Buyer {contract.buyer_user_id === user.id ? '(you)' : ''}</span>
            <span className="font-mono text-xs text-zinc-300">
              {contract.buyer_user_id?.slice(0, 8) ?? contract.buyer_agent_id?.slice(0, 8)}…
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-zinc-400">Seller {isSeller ? '(you)' : ''}</span>
            <span className="font-mono text-xs text-zinc-300">
              {contract.seller_user_id?.slice(0, 8) ?? contract.seller_agent_id?.slice(0, 8)}…
            </span>
          </div>
        </div>

        {/* Actions */}
        {(isBuyer || isSeller) && (
          <EscrowActions
            contractId={id}
            status={contract.status}
            isBuyer={isBuyer}
            isSeller={isSeller}
          />
        )}
      </main>
    </div>
  )
}
