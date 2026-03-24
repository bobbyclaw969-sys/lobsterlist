import { NextResponse, type NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'

const PROTECTED_PATHS = ['/profile', '/listings/new', '/my-listings', '/dashboard', '/agents', '/escrow', '/agent', '/available/new']
const AUTH_PATHS = ['/login', '/signup']

/** SHA-256 via Web Crypto (edge + Node compatible) */
async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input)
  const hash = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

export async function proxy(request: NextRequest) {
  // ── Strip internal identity headers from EVERY incoming request ───────────
  // Prevents client-injected header spoofing. x-agent-* headers may ONLY be
  // set by this proxy after cryptographic Bearer token validation below.
  // Without this, a cookie-authenticated attacker can inject x-agent-id to
  // impersonate any agent on /api/agent/* routes.
  const strippedHeaders = new Headers(request.headers)
  strippedHeaders.delete('x-agent-id')
  strippedHeaders.delete('x-agent-user-id')
  strippedHeaders.delete('x-is-agent')
  strippedHeaders.delete('x-auth-method')

  let response = NextResponse.next({ request: { headers: strippedHeaders } })

  // ── Bearer token auth (agents) ────────────────────────────────────────────
  const authHeader = request.headers.get('authorization') ?? ''
  const bearer = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null

  if (bearer?.startsWith('ll_')) {
    const hash = await sha256Hex(bearer)
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

    // Direct REST lookup — no cookie session needed for agent auth
    const res = await fetch(
      `${supabaseUrl}/rest/v1/agent_api_keys?key_hash=eq.${encodeURIComponent(hash)}&revoked_at=is.null&select=agent_id,agents!inner(owner_id)`,
      {
        headers: {
          apikey: serviceKey,
          Authorization: `Bearer ${serviceKey}`,
          Accept: 'application/json',
        },
      },
    )

    if (res.ok) {
      const rows = await res.json() as Array<{ agent_id: string; agents: { owner_id: string } | { owner_id: string }[] }>

      if (rows.length > 0) {
        const { agent_id, agents } = rows[0]
        const ownerRow = Array.isArray(agents) ? agents[0] : agents
        const owner_id = ownerRow?.owner_id ?? ''

        // Inject agent identity headers — built on strippedHeaders so client
        // values are always discarded before our validated values are set.
        const reqHeaders = new Headers(strippedHeaders)
        reqHeaders.set('x-agent-id', agent_id)
        reqHeaders.set('x-agent-user-id', owner_id)
        reqHeaders.set('x-is-agent', 'true')

        // Update last_used_at — fire and forget
        fetch(
          `${supabaseUrl}/rest/v1/agent_api_keys?key_hash=eq.${encodeURIComponent(hash)}`,
          {
            method: 'PATCH',
            headers: {
              apikey: serviceKey,
              Authorization: `Bearer ${serviceKey}`,
              'Content-Type': 'application/json',
              Prefer: 'return=minimal',
            },
            body: JSON.stringify({ last_used_at: new Date().toISOString() }),
          },
        ).catch(() => {})

        return NextResponse.next({ request: { headers: reqHeaders } })
      }
    }

    // Invalid bearer token — always 401 JSON (never redirect agents)
    return NextResponse.json({ error: 'Invalid API key' }, { status: 401 })
  }

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          response = NextResponse.next({ request: { headers: strippedHeaders } })
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()
  const path = request.nextUrl.pathname

  // Agent API routes must be reached via Bearer token (handled above).
  // Cookie sessions are accepted here as a convenience for the dashboard UI,
  // but unauthenticated requests get JSON 401 — never an HTML redirect.
  if (!user && path.startsWith('/api/agent/')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

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
