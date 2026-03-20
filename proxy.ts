import { NextResponse, type NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'

const PROTECTED_PATHS = ['/profile', '/listings/new', '/dashboard']
const AUTH_PATHS = ['/login', '/signup']

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          response = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()
  const path = request.nextUrl.pathname

  // Redirect unauthenticated users away from protected routes
  if (!user && PROTECTED_PATHS.some((p) => path.startsWith(p))) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  // Redirect authenticated users away from auth pages
  if (user && AUTH_PATHS.includes(path)) {
    return NextResponse.redirect(new URL('/browse', request.url))
  }

  return response
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|auth/callback|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
