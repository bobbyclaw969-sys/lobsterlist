import Link from 'next/link'
import type { WorkerProfileWithUser } from '@/types/database'

const AVAIL_SHORT: Record<string, string> = {
  full_time: 'full-time',
  part_time: 'part-time',
  weekends:  'weekends',
}

export function WorkerRow({ profile }: { profile: WorkerProfileWithUser }) {
  const name    = profile.user?.name ?? 'anon'
  const rateUsd = (profile.hourly_rate_usd_cents / 100).toFixed(0)

  return (
    <Link
      href={`/available/${profile.id}`}
      className="block py-1.5 border-b border-zinc-800 hover:bg-zinc-900/50 transition-colors px-2"
    >
      <span className="text-zinc-200 text-sm font-medium">{name}</span>
      {profile.skills.length > 0 && (
        <span className="text-zinc-500 text-sm"> · {profile.skills.slice(0, 3).join(', ')}</span>
      )}
      <span className="text-orange-400 text-sm"> · ${rateUsd}/hr</span>
      {profile.location && (
        <span className="text-zinc-500 text-sm"> · {profile.location}</span>
      )}
      <span className="text-zinc-600 text-sm"> · {AVAIL_SHORT[profile.availability]}</span>
    </Link>
  )
}
