/**
 * In-memory rate limiter for serverless auth endpoints.
 *
 * TODO: In-memory state resets on serverless cold starts (Vercel function restarts).
 * This is acceptable for low-volume auth endpoints — a cold start resets the count,
 * so a sustained attack needs O(1/restart) effort. For production-grade per-IP limits
 * that survive cold starts, replace this with Supabase counting or Redis (e.g. Upstash).
 */

const store = new Map<string, { count: number; resetAt: number }>()

/**
 * Check and increment rate limit for a key.
 * @returns true if the request is allowed, false if limit exceeded.
 */
export async function checkRateLimit(key: string, max: number, windowSecs: number): Promise<boolean> {
  const now = Date.now()
  const entry = store.get(key)
  if (!entry || now > entry.resetAt) {
    store.set(key, { count: 1, resetAt: now + windowSecs * 1000 })
    return true
  }
  if (entry.count >= max) return false
  entry.count++
  return true
}
