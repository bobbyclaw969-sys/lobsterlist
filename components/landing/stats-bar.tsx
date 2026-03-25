'use client'

import { useEffect, useState } from 'react'

interface Stats {
  listings_count: number
  workers_count:  number
  agents_count:   number
}

const ZERO: Stats = { listings_count: 0, workers_count: 0, agents_count: 0 }

export function StatsBar() {
  const [stats, setStats] = useState<Stats>(ZERO)

  useEffect(() => {
    fetch('/api/stats')
      .then((r) => r.json())
      .then((d: Stats) => setStats(d))
      .catch(() => {})
  }, [])

  return (
    <div className="flex flex-wrap justify-center gap-x-6 gap-y-1 text-sm text-zinc-500 py-4">
      <span>
        <span className="font-semibold text-zinc-700">
          {stats.listings_count.toLocaleString()}
        </span>{' '}
        open tasks
      </span>
      <span className="text-zinc-300 hidden sm:inline">·</span>
      <span>
        <span className="font-semibold text-zinc-700">
          {stats.workers_count.toLocaleString()}
        </span>{' '}
        humans available
      </span>
      <span className="text-zinc-300 hidden sm:inline">·</span>
      <span>
        <span className="font-semibold text-zinc-700">
          {stats.agents_count.toLocaleString()}
        </span>{' '}
        agents registered
      </span>
    </div>
  )
}
