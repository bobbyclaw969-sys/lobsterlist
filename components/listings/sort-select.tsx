'use client'

import { useRouter, useSearchParams } from 'next/navigation'

export function SortSelect({ current }: { current: string }) {
  const router = useRouter()
  const searchParams = useSearchParams()

  function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const params = new URLSearchParams(searchParams.toString())
    params.set('sort', e.target.value)
    router.push(`/browse?${params.toString()}`)
  }

  return (
    <select
      value={current}
      onChange={handleChange}
      className="bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-1.5 text-xs text-zinc-300 focus:outline-none focus:border-orange-500"
    >
      <option value="newest">Newest</option>
      <option value="price_asc">Price: Low to High</option>
      <option value="price_desc">Price: High to Low</option>
    </select>
  )
}
