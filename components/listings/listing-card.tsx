import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { satsToUsd } from '@/lib/utils/sats'
import type { ListingWithDetail, ListingCategory } from '@/types/database'

const CATEGORY_COLORS: Record<ListingCategory, string> = {
  job:     'bg-blue-500/10 text-blue-300 border-blue-500/20',
  gig:     'bg-purple-500/10 text-purple-300 border-purple-500/20',
  service: 'bg-green-500/10 text-green-300 border-green-500/20',
  good:    'bg-amber-500/10 text-amber-300 border-amber-500/20',
}

const CATEGORY_LABELS: Record<ListingCategory, string> = {
  job:     'Job',
  gig:     'Gig',
  service: 'Service',
  good:    'Digital Good',
}

interface ListingCardProps {
  listing: ListingWithDetail
  btcPriceUsd: number
}

export function ListingCard({ listing, btcPriceUsd }: ListingCardProps) {
  const usdDisplay = satsToUsd(listing.price_sats, btcPriceUsd)
  const colorClass = CATEGORY_COLORS[listing.category]

  // Category-specific detail line
  let detail: string | null = null
  if (listing.category === 'job' && listing.job?.deadline) {
    const d = new Date(listing.job.deadline)
    detail = `Due ${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`
  } else if (listing.category === 'gig' && listing.gig?.delivery_time_hours) {
    detail = `${listing.gig.delivery_time_hours}h delivery`
  } else if (listing.category === 'service') {
    detail = listing.service?.pricing_type === 'hourly' ? 'Hourly rate' : 'Fixed price'
  } else if (listing.category === 'good') {
    const g = listing.good
    if (g) detail = [g.instant_delivery ? 'Instant delivery' : null, g.license_type].filter(Boolean).join(' · ')
  }

  return (
    <Link
      href={`/listings/${listing.id}`}
      className="flex flex-col gap-3 p-4 rounded-xl border border-zinc-800 bg-zinc-900 hover:border-zinc-600 hover:bg-zinc-800/60 transition-colors group"
    >
      <div className="flex items-start justify-between gap-2">
        <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${colorClass}`}>
          {CATEGORY_LABELS[listing.category]}
        </span>
        <span className="text-sm font-semibold text-orange-400 flex-shrink-0">{usdDisplay}</span>
      </div>

      <div className="space-y-1">
        <h3 className="text-sm font-semibold text-white line-clamp-2 group-hover:text-orange-300 transition-colors">
          {listing.title}
        </h3>
        <p className="text-xs text-zinc-400 line-clamp-2 leading-relaxed">
          {listing.description}
        </p>
      </div>

      {detail && (
        <p className="text-xs text-zinc-500">{detail}</p>
      )}

      {listing.tags.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-auto pt-1">
          {listing.tags.slice(0, 4).map((tag) => (
            <span
              key={tag}
              className="text-xs text-zinc-500 bg-zinc-800 px-2 py-0.5 rounded-full border border-zinc-700"
            >
              {tag}
            </span>
          ))}
          {listing.tags.length > 4 && (
            <span className="text-xs text-zinc-600">+{listing.tags.length - 4}</span>
          )}
        </div>
      )}
    </Link>
  )
}
