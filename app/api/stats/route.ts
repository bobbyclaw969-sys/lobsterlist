import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

export async function GET() {
  try {
    const service = await createServiceClient()

    const [{ count: listings }, { count: workers }, { count: agents }] = await Promise.all([
      service.from('listings').select('*', { count: 'exact', head: true }).eq('status', 'open'),
      service.from('worker_profiles').select('*', { count: 'exact', head: true }).eq('is_active', true),
      service.from('agents').select('*', { count: 'exact', head: true }).eq('verified', true),
    ])

    return NextResponse.json({
      listings_count: listings ?? 0,
      workers_count:  workers  ?? 0,
      agents_count:   agents   ?? 0,
    })
  } catch {
    return NextResponse.json({ listings_count: 0, workers_count: 0, agents_count: 0 })
  }
}
