import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code   = searchParams.get('code')
  const next   = searchParams.get('next') ?? '/browse'
  const source = searchParams.get('source') // 'oauth' for social login flows

  if (code) {
    const supabase = await createClient()
    const { data: { session }, error } = await supabase.auth.exchangeCodeForSession(code)

    if (!error && session) {
      // OAuth users may not have a name yet — send them to onboarding
      if (source === 'oauth') {
        const service = await createServiceClient()
        const { data: profile } = await service
          .from('users')
          .select('name')
          .eq('id', session.user.id)
          .single()

        if (!profile?.name) {
          // Pass any name hint from OAuth provider metadata
          const oauthName =
            (session.user.user_metadata?.name as string | undefined) ??
            (session.user.user_metadata?.full_name as string | undefined) ??
            ''
          const onboardingUrl = new URL(`${origin}/onboarding`)
          if (oauthName) onboardingUrl.searchParams.set('name', encodeURIComponent(oauthName))
          return NextResponse.redirect(onboardingUrl.toString())
        }
      }

      return NextResponse.redirect(`${origin}${next}`)
    }
  }

  return NextResponse.redirect(`${origin}/auth/error`)
}
