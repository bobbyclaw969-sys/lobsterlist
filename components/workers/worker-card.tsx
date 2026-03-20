import Link from 'next/link'
import type { WorkerProfileWithUser } from '@/types/database'

const AVAILABILITY_LABELS: Record<string, string> = {
  full_time: 'Full-time',
  part_time: 'Part-time',
  weekends:  'Weekends',
}

function StarRating({ rating }: { rating: number }) {
  const full  = Math.floor(rating)
  const empty = 5 - full
  return (
    <span className="text-sm text-amber-400 leading-none">
      {'★'.repeat(full)}{'☆'.repeat(empty)}
      <span className="text-zinc-500 text-xs ml-1">{rating.toFixed(1)}</span>
    </span>
  )
}

export function WorkerCard({ profile }: { profile: WorkerProfileWithUser }) {
  const name     = profile.user?.name ?? 'Anonymous'
  const rating   = profile.user?.rating ?? 0
  const initials = name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2) || '?'
  const rateUsd  = (profile.hourly_rate_usd_cents / 100).toLocaleString('en-US', {
    style: 'currency', currency: 'USD', minimumFractionDigits: 0,
  })

  return (
    <div className="rounded-2xl border border-zinc-200 bg-white shadow-sm overflow-hidden flex flex-col">
      {/* Photo area */}
      <div className="bg-gradient-to-br from-orange-50 to-amber-50 px-5 pt-5 pb-3 flex items-center gap-4">
        {profile.user?.avatar_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={profile.user.avatar_url}
            alt={name}
            className="w-14 h-14 rounded-full object-cover border-2 border-white shadow"
          />
        ) : (
          <div className="w-14 h-14 rounded-full bg-orange-400 flex items-center justify-center text-white text-xl font-bold shadow">
            {initials}
          </div>
        )}
        <div className="min-w-0">
          <p className="font-semibold text-zinc-900 truncate">{name}</p>
          <StarRating rating={rating} />
        </div>
      </div>

      {/* Content */}
      <div className="px-5 py-4 flex-1 space-y-2">
        <p className="text-sm font-medium text-zinc-800 leading-snug">{profile.headline}</p>
        {profile.location && (
          <p className="text-xs text-zinc-500">📍 {profile.location}</p>
        )}
        {profile.skills.length > 0 && (
          <div className="flex flex-wrap gap-1 pt-1">
            {profile.skills.slice(0, 4).map((s) => (
              <span key={s} className="text-xs bg-orange-50 text-orange-700 border border-orange-200 px-2 py-0.5 rounded-full">
                {s}
              </span>
            ))}
            {profile.skills.length > 4 && (
              <span className="text-xs text-zinc-400">+{profile.skills.length - 4}</span>
            )}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="px-5 pb-4 flex items-center justify-between">
        <div>
          <p className="text-lg font-bold text-zinc-900">{rateUsd}<span className="text-xs font-normal text-zinc-500">/hr</span></p>
          <p className="text-xs text-zinc-400">{AVAILABILITY_LABELS[profile.availability]}</p>
        </div>
        <Link
          href={`/available/${profile.id}`}
          className="bg-orange-500 hover:bg-orange-400 text-white text-sm font-semibold px-4 py-2 rounded-full transition-colors"
        >
          Hire me
        </Link>
      </div>
    </div>
  )
}
