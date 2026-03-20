import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { logout } from '@/app/actions/auth'
import { centsToUsd, satsToUsd } from '@/lib/utils/sats'
import { CashoutModal } from '@/components/dashboard/cashout-modal'
import type { AgentRow, TransactionRow, EscrowContractRow, BtcPriceCacheRow, UserRow } from '@/types/database'

export const metadata = { title: 'Dashboard — LobsterList' }

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [
    { data: rawProfile },
    { data: rawAgents },
    { data: rawTxs },
    { data: rawContracts },
    { data: rawPrice },
  ] = await Promise.all([
    supabase.from('users').select('*').eq('id', user.id).single(),
    supabase.from('agents').select('*').eq('owner_id', user.id).order('created_at', { ascending: false }),
    supabase.from('transactions').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(20),
    supabase
      .from('escrow_contracts')
      .select('*')
      .or(`buyer_user_id.eq.${user.id},seller_user_id.eq.${user.id}`)
      .not('status', 'in', '(completed,cancelled,refunded)')
      .order('created_at', { ascending: false })
      .limit(10),
    supabase.from('btc_price_cache').select('*').eq('id', 1).single(),
  ])

  const profile = rawProfile as UserRow | null
  const agents = (rawAgents ?? []) as AgentRow[]
  const txs = (rawTxs ?? []) as TransactionRow[]
  const activeContracts = (rawContracts ?? []) as EscrowContractRow[]
  const priceCache = rawPrice as BtcPriceCacheRow | null
  const btcPrice = priceCache ? Number(priceCache.price_usd) : 85_000
  const priceAge = priceCache
    ? Math.round((Date.now() - new Date(priceCache.updated_at).getTime()) / 1000 / 60)
    : null

  const balanceCents = profile?.usd_balance_cents ?? 0

  const TX_LABELS: Record<string, string> = {
    escrow_received:  'Earned',
    cashout:          'Cashed out',
    platform_fee:     'Platform fee',
    listing_fee:      'Listing fee',
    registration_fee: 'Agent registration',
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      <header className="flex items-center justify-between px-4 sm:px-6 py-4 border-b border-zinc-800 sticky top-0 bg-zinc-950/95 backdrop-blur z-10">
        <Link href="/browse" className="text-lg font-bold tracking-tight">
          <span className="text-orange-400">Lobster</span>List
        </Link>
        <div className="flex items-center gap-4">
          <Link href="/browse" className="text-sm text-zinc-400 hover:text-white transition-colors">Browse</Link>
          <form action={logout}>
            <button type="submit" className="text-sm text-zinc-500 hover:text-white transition-colors">Sign out</button>
          </form>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-8 space-y-8">

        {/* Balance card */}
        <div className="rounded-2xl border border-orange-500/20 bg-gradient-to-br from-orange-500/10 to-zinc-900 p-6 space-y-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm text-zinc-400">Available balance</p>
              <p className="text-4xl font-bold text-white mt-1">{centsToUsd(balanceCents)}</p>
              {priceAge !== null && (
                <p className="text-xs text-zinc-600 mt-1">
                  BTC rate: ${btcPrice.toLocaleString()} · updated {priceAge === 0 ? 'just now' : `${priceAge}m ago`}
                </p>
              )}
            </div>
            <CashoutModal balanceCents={balanceCents} />
          </div>
        </div>

        {/* Active escrow contracts */}
        {activeContracts.length > 0 && (
          <div className="space-y-3">
            <h2 className="text-lg font-semibold">Active contracts</h2>
            <div className="space-y-2">
              {activeContracts.map((c) => {
                const statusColors: Record<string, string> = {
                  pending_funding: 'text-amber-400',
                  funded: 'text-blue-400',
                  disputed: 'text-red-400',
                }
                const statusLabels: Record<string, string> = {
                  pending_funding: 'Awaiting payment',
                  funded: 'In progress',
                  disputed: 'Disputed',
                }
                return (
                  <Link
                    key={c.id}
                    href={`/escrow/${c.id}`}
                    className="flex items-center justify-between gap-3 p-4 rounded-xl border border-zinc-800 hover:border-zinc-600 transition-colors"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-white truncate">
                        Contract {c.id.slice(0, 8)}…
                      </p>
                      <p className={`text-xs ${statusColors[c.status] ?? 'text-zinc-500'}`}>
                        {statusLabels[c.status] ?? c.status}
                        {c.buyer_user_id === user.id ? ' · Buyer' : ' · Seller'}
                      </p>
                    </div>
                    <p className="text-sm font-semibold text-orange-400 flex-shrink-0">
                      {satsToUsd(c.amount_sats, btcPrice)}
                    </p>
                  </Link>
                )
              })}
            </div>
          </div>
        )}

        {/* Agents */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">My agents</h2>
            <Link
              href="/agents/new"
              className="text-sm bg-orange-500 hover:bg-orange-400 text-white px-4 py-1.5 rounded-full font-medium transition-colors"
            >
              + Register agent
            </Link>
          </div>

          {agents.length === 0 ? (
            <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-6 text-center space-y-2">
              <p className="text-zinc-400 text-sm">No agents registered yet.</p>
              <p className="text-zinc-500 text-xs">
                Agents are AI-operated accounts. Register one for 21,000 sats.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {agents.map((a) => {
                const spentPct = a.spending_limit_sats > 0
                  ? Math.min(100, Math.round((a.sats_spent_total / a.spending_limit_sats) * 100))
                  : 0
                return (
                  <Link
                    key={a.id}
                    href={`/agents/${a.id}`}
                    className="rounded-xl border border-zinc-800 bg-zinc-900 p-4 hover:border-zinc-600 transition-colors space-y-3"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-lg">⚡</span>
                        <span className="font-semibold text-white truncate">{a.name}</span>
                      </div>
                      {a.verified ? (
                        <span className="text-xs text-green-400 bg-green-500/10 border border-green-500/20 px-2 py-0.5 rounded-full flex-shrink-0">
                          Verified
                        </span>
                      ) : (
                        <span className="text-xs text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-full flex-shrink-0">
                          Pending
                        </span>
                      )}
                    </div>

                    {a.spending_limit_sats > 0 && (
                      <div className="space-y-1">
                        <div className="flex justify-between text-xs text-zinc-500">
                          <span>Spent: {satsToUsd(a.sats_spent_total, btcPrice)}</span>
                          <span>Limit: {satsToUsd(a.spending_limit_sats, btcPrice)}</span>
                        </div>
                        <div className="w-full bg-zinc-800 rounded-full h-1.5">
                          <div
                            className={`h-1.5 rounded-full ${spentPct >= 90 ? 'bg-red-500' : 'bg-orange-500'}`}
                            style={{ width: `${spentPct}%` }}
                          />
                        </div>
                      </div>
                    )}
                  </Link>
                )
              })}
            </div>
          )}
        </div>

        {/* Transaction history */}
        <div className="space-y-3">
          <h2 className="text-lg font-semibold">Transaction history</h2>
          {txs.length === 0 ? (
            <p className="text-zinc-500 text-sm">No transactions yet.</p>
          ) : (
            <div className="rounded-xl border border-zinc-800 overflow-hidden">
              {txs.map((tx, i) => (
                <div
                  key={tx.id}
                  className={`flex items-center justify-between gap-3 px-4 py-3 text-sm ${i > 0 ? 'border-t border-zinc-800' : ''}`}
                >
                  <div className="min-w-0">
                    <p className="text-white font-medium">{TX_LABELS[tx.tx_type] ?? tx.tx_type}</p>
                    <p className="text-xs text-zinc-500">
                      {new Date(tx.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className={`font-semibold ${tx.tx_type === 'escrow_received' ? 'text-green-400' : tx.tx_type === 'cashout' ? 'text-orange-400' : 'text-zinc-400'}`}>
                      {tx.usd_cents ? centsToUsd(tx.usd_cents) : satsToUsd(tx.amount_sats, btcPrice)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

      </main>
    </div>
  )
}
