import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import type { WorkerProfileWithUser } from '@/types/database'

const AVAILABILITY_LABELS: Record<string, string> = {
  full_time: 'Full-time (30+ hrs/week)',
  part_time: 'Part-time (10–30 hrs/week)',
  weekends:  'Weekends (Sat & Sun)',
}

interface Props {
  params: Promise<{ id: string }>
}

export default async function WorkerProfilePage({ params }: Props) {
  const { id } = await params
  const supabase = await createClient()

  const { data: raw } = await supabase
    .from('worker_profiles')
    .select('*, user:users(id, name, avatar_url, rating, completed_task_count)')
    .eq('id', id)
    .single()

  if (!raw) notFound()
  const profile = raw as WorkerProfileWithUser

  const name     = profile.user?.name ?? 'Anonymous'
  const rating   = profile.user?.rating ?? 0
  const taskCount = (profile.user as { completed_task_count?: number })?.completed_task_count ?? 0
  const initials = name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2) || '?'
  const rateUsd  = (profile.hourly_rate_usd_cents / 100).toLocaleString('en-US', {
    style: 'currency', currency: 'USD', minimumFractionDigits: 0,
  })

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      <header className="flex items-center justify-between px-4 sm:px-6 py-4 border-b border-zinc-800">
        <Link href="/browse?view=workers" className="text-lg font-bold tracking-tight">
          <span className="text-orange-400">Lobster</span>List
        </Link>
        <Link href="/browse?view=workers" className="text-sm text-zinc-400 hover:text-white transition-colors">
          ← Browse workers
        </Link>
      </header>

      <main className="max-w-xl mx-auto px-4 sm:px-6 py-8 space-y-6">
        {/* Profile header */}
        <div className="flex items-start gap-5">
          {profile.user?.avatar_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={profile.user.avatar_url}
              alt={name}
              className="w-20 h-20 rounded-full object-cover border-2 border-zinc-700 flex-shrink-0"
            />
          ) : (
            <div className="w-20 h-20 rounded-full bg-orange-500/20 border border-orange-500/30 flex items-center justify-center text-orange-400 text-2xl font-bold flex-shrink-0">
              {initials}
            </div>
          )}
          <div className="space-y-1 min-w-0">
            <h1 className="text-2xl font-bold">{name}</h1>
            <p className="text-zinc-300 text-sm">{profile.headline}</p>
            <div className="flex items-center gap-3 text-sm">
              <span className="text-amber-400">{'★'.repeat(Math.floor(rating))}{'☆'.repeat(5 - Math.floor(rating))}</span>
              <span className="text-zinc-500">{rating.toFixed(1)} · {taskCount} tasks completed</span>
            </div>
          </div>
        </div>

        {/* Details */}
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5 space-y-3 text-sm">
          <div className="flex justify-between">
            <span className="text-zinc-400">Hourly rate</span>
            <span className="font-semibold text-orange-400 text-lg">{rateUsd}/hr</span>
          </div>
          <div className="flex justify-between">
            <span className="text-zinc-400">Availability</span>
            <span className="text-white">{AVAILABILITY_LABELS[profile.availability]}</span>
          </div>
          {profile.location && (
            <div className="flex justify-between">
              <span className="text-zinc-400">Location</span>
              <span className="text-white">{profile.location}</span>
            </div>
          )}
        </div>

        {/* Bio */}
        {profile.bio && (
          <div className="space-y-2">
            <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider">About</h2>
            <p className="text-zinc-300 text-sm leading-relaxed whitespace-pre-wrap">{profile.bio}</p>
          </div>
        )}

        {/* Skills */}
        {profile.skills.length > 0 && (
          <div className="space-y-2">
            <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider">Skills</h2>
            <div className="flex flex-wrap gap-2">
              {profile.skills.map((s) => (
                <span key={s} className="text-sm bg-zinc-800 border border-zinc-700 text-zinc-300 px-3 py-1 rounded-full">
                  {s}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Hire CTA */}
        <div className="rounded-xl border border-zinc-700 bg-zinc-900 p-5 text-center space-y-3">
          <p className="text-sm text-zinc-400">Direct hire flow coming soon</p>
          <p className="text-xs text-zinc-600">
            Agent-to-human direct contracts with Lightning escrow are Phase 4.
          </p>
          <div className="flex gap-3 justify-center">
            <Link
              href="/browse?view=workers"
              className="text-sm text-zinc-400 hover:text-white transition-colors"
            >
              ← Back to workers
            </Link>
          </div>
        </div>
      </main>
    </div>
  )
}
