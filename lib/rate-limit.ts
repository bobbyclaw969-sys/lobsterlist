/**
 * Supabase-backed rate limiter that survives serverless cold starts.
 *
 * Uses a dedicated rate_limits table in Supabase for persistent counting.
 * Falls back to in-memory if table doesn't exist (for dev/migration).
 */

import { createServiceClient } from '@/lib/supabase/server'

const FALLBACK_IN_MEMORY = false // Set true only during table creation/migration
const FALLBACK_STORE = new Map<string, { count: number; resetAt: number }>()

// Default limits (can be overridden per-check)
const DEFAULTS = {
  windowSecs: 60,
  max: 10,
}

/**
 * Check and increment rate limit for a key.
 * Uses Supabase for persistence, falls back to memory if table missing.
 *
 * @param key - Rate limit key (e.g., "verify:wallet:bc1q...")
 * @param max - Max requests per window (default 10)
 * @param windowSecs - Window in seconds (default 60)
 */
export async function checkRateLimit(
  key: string,
  max: number = DEFAULTS.max,
  windowSecs: number = DEFAULTS.windowSecs
): Promise<boolean> {
  // Always allow in development without Supabase
  if (process.env.NODE_ENV === 'development' && !process.env.NEXT_PUBLIC_SUPABASE_URL) {
    return true
  }

  if (FALLBACK_IN_MEMORY) {
    return checkRateLimitMemory(key, max, windowSecs)
  }

  try {
    const service = await createServiceClient()
    const now = Date.now()
    const windowMs = windowSecs * 1000
    const windowStart = new Date(now - windowMs).toISOString()

    // Atomic check-and-increment via RPC
    // Returns { allowed: boolean, current_count: number }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (service as any).rpc('check_rate_limit', {
      p_key: key,
      p_max: max,
      p_window_secs: windowSecs,
      p_window_start: windowStart,
    }) as { data: { allowed: boolean; current_count: number } | null; error: any }

    if (error) {
      console.warn('[rate-limit] RPC failed, falling back to memory:', error.message)
      return checkRateLimitMemory(key, max, windowSecs)
    }

    return data?.allowed ?? false
  } catch (err) {
    console.error('[rate-limit] DB error — failing closed:', err)
    // Fail CLOSED: an unavailable rate limiter must not open access.
    // Return false (blocked) in all environments.
    return false
  }
}

/**
 * In-memory fallback (used during migration or if RPC unavailable).
 */
async function checkRateLimitMemory(
  key: string,
  max: number,
  windowSecs: number
): Promise<boolean> {
  const now = Date.now()
  const entry = FALLBACK_STORE.get(key)

  if (!entry || now > entry.resetAt) {
    FALLBACK_STORE.set(key, { count: 1, resetAt: now + windowSecs * 1000 })
    return true
  }

  if (entry.count >= max) return false
  entry.count++
  return true
}

/**
 * Manual reset for testing or admin purposes.
 */
export async function resetRateLimit(key: string): Promise<void> {
  if (FALLBACK_IN_MEMORY) {
    FALLBACK_STORE.delete(key)
    return
  }

  try {
    const service = await createServiceClient()
    await service.from('rate_limits').delete().eq('key_prefix', key)
  } catch {
    // Ignore errors on reset
  }
}
