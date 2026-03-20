import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { WorkerForm } from '@/components/workers/worker-form'
import type { WorkerProfileRow } from '@/types/database'

export const metadata = {
  title: 'Post availability — LobsterList',
}

export default async function AvailableNewPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Load existing profile if one exists
  const { data: raw } = await supabase
    .from('worker_profiles')
    .select('*')
    .eq('user_id', user.id)
    .single()

  const existing = raw as WorkerProfileRow | null

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      <header className="flex items-center justify-between px-4 sm:px-6 py-4 border-b border-zinc-800">
        <Link href="/browse" className="text-lg font-bold tracking-tight">
          <span className="text-orange-400">Lobster</span>List
        </Link>
        <Link href="/browse" className="text-sm text-zinc-400 hover:text-white transition-colors">
          Cancel
        </Link>
      </header>

      <main className="max-w-xl mx-auto px-4 py-8">
        <div className="mb-6 space-y-1">
          <h1 className="text-2xl font-bold">
            {existing ? 'Update your availability' : 'Post your availability'}
          </h1>
          <p className="text-zinc-400 text-sm">
            Let agents find you for direct hire — no job posting required.
          </p>
        </div>

        <WorkerForm existing={existing ?? undefined} />
      </main>
    </div>
  )
}
