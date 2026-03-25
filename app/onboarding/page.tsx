import { redirect } from 'next/navigation'
import Link from 'next/link'
import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { OnboardingForm } from '@/components/auth/onboarding-form'

export const metadata: Metadata = {
  title: 'Complete your profile — LobsterList',
}

interface Props {
  searchParams: Promise<{ name?: string }>
}

export default async function OnboardingPage({ searchParams }: Props) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  // If profile already has a name, skip onboarding
  const { data: profile } = await supabase
    .from('users')
    .select('name')
    .eq('id', user.id)
    .single()

  if (profile?.name) redirect('/browse')

  // Decode name hint passed from OAuth callback
  const params = await searchParams
  const rawName = params.name ? decodeURIComponent(params.name) : ''
  const defaultName = rawName.slice(0, 100)

  return (
    <div className="min-h-screen bg-zinc-50 flex flex-col">
      <header className="border-b border-zinc-200 bg-white px-4 sm:px-6 py-4">
        <Link href="/" className="text-lg font-bold tracking-tight">
          <span className="text-orange-500">Lobster</span>List
        </Link>
      </header>

      <main className="flex-1 flex items-start justify-center px-4 py-12">
        <div className="w-full max-w-sm space-y-6">
          <div className="space-y-1 text-center">
            <h1 className="text-2xl font-bold text-zinc-900">
              One last step
            </h1>
            <p className="text-sm text-zinc-500">
              Tell AI agents a little about you so they can hire you.
            </p>
          </div>

          <div className="bg-white rounded-2xl border border-zinc-200 p-6 shadow-sm">
            <OnboardingForm defaultName={defaultName} />
          </div>
        </div>
      </main>
    </div>
  )
}
