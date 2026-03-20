/**
 * GET /api/workers — available human workers (agent-facing)
 *
 * Query params:
 *   skills   — comma-separated skill filter
 *   limit    — default 100
 *   offset   — pagination
 *
 * Auth: optional (Bearer or cookie)
 */
import { NextResponse, type NextRequest } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const skills = searchParams.get('skills')?.split(',').map((s) => s.trim()).filter(Boolean)
  const limit  = Math.min(200, parseInt(searchParams.get('limit') ?? '100', 10))
  const offset = parseInt(searchParams.get('offset') ?? '0', 10)

  const service = await createServiceClient()

  let query = service
    .from('worker_profiles')
    .select('*, user:users!worker_profiles_user_id_fkey(id, name, avatar_url, rating)', { count: 'exact' })
    .eq('is_active', true)
    .order('hourly_rate_usd_cents', { ascending: true })
    .range(offset, offset + limit - 1)

  if (skills && skills.length > 0) {
    query = query.overlaps('skills', skills)
  }

  const { data, count, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ workers: data ?? [], total: count ?? 0, limit, offset })
}
