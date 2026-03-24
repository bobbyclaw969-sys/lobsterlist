/**
 * Security middleware for CSRF and origin validation.
 * Apply to all state-changing API routes.
 */

import { NextRequest, NextResponse } from 'next/server'

// Allowed origins for CORS
const ALLOWED_ORIGINS = new Set([
  'https://lobsterlist.vercel.app',
  'https://lobsterlist.com',
  'http://localhost:3000',
  'http://127.0.0.1:3000',
])

// Endpoints that require origin validation (state-changing)
const STATE_CHANGING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE'])

/**
 * Validate origin header for state-changing requests.
 * Returns null if valid, error response if invalid.
 */
export function validateOrigin(request: NextRequest): NextResponse | null {
  if (!STATE_CHANGING_METHODS.has(request.method)) {
    return null
  }

  const origin = request.headers.get('origin')
  const referer = request.headers.get('referer')

  if (!origin && !referer && process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Invalid origin' }, { status: 403 })
  }

  if (origin) {
    const originHost = origin.replace(/^https?:\/\//, '')
    const isAllowed = Array.from(ALLOWED_ORIGINS).some(allowed => 
      origin === allowed || originHost === allowed.replace(/^https?:\/\//, '')
    )
    
    if (!isAllowed) {
      console.warn('[security] Blocked request with origin:', origin)
      return NextResponse.json({ error: 'Invalid origin' }, { status: 403 })
    }
  }

  return null
}

/**
 * Get the allowed origins list
 */
export function getAllowedOrigins(): string[] {
  return Array.from(ALLOWED_ORIGINS)
}

/**
 * Add security headers to response
 */
export function addSecurityHeaders(response: NextResponse): NextResponse {
  response.headers.set('X-Content-Type-Options', 'nosniff')
  response.headers.set('X-Frame-Options', 'DENY')
  response.headers.set('X-XSS-Protection', '1; mode=block')
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
  response.headers.set(
    'Strict-Transport-Security',
    'max-age=31536000; includeSubDomains'
  )
  return response
}
