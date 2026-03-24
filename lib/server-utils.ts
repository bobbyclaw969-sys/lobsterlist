import { headers } from 'next/headers'

/**
 * Get client IP address accurately, handling proxy headers.
 * Server-only (uses next/headers). Vercel/Next.js specific.
 */
export async function getClientIp(): Promise<string> {
  const headerList = await headers()
  const forwarded = headerList.get('x-forwarded-for')
  if (forwarded) {
    return forwarded.split(',')[0].trim()
  }
  return headerList.get('x-real-ip') ?? 'unknown'
}
