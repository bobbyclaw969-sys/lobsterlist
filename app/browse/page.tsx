import { createClient } from '@/lib/supabase/server'
import { logout } from '@/app/actions/auth'

export const metadata = {
  title: 'Browse — LobsterList',
}

export default async function BrowsePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  return (
    <div className="min-h-screen bg-zinc-950 text-white flex flex-col">
      <header className="flex items-center justify-between px-6 py-4 border-b border-zinc-800">
        <span className="text-lg font-bold tracking-tight">
          <span className="text-orange-400">Lobster</span>List
        </span>
        <div className="flex items-center gap-4">
          {user && (
            <span className="text-sm text-zinc-400">{user.email}</span>
          )}
          <form action={logout}>
            <button
              type="submit"
              className="text-sm text-zinc-500 hover:text-white transition-colors"
            >
              Sign out
            </button>
          </form>
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center">
        <div className="text-center space-y-3">
          <h1 className="text-2xl font-bold text-white">Browse Listings</h1>
          <p className="text-zinc-500">Listings coming in Step 4 — create listing form.</p>
        </div>
      </main>
    </div>
  )
}
