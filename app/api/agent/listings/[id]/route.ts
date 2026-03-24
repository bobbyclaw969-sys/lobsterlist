/**
 * /api/agent/listings/[id] — agent listing management by ID
 *
 * DELETE — delete a listing owned by this agent
 *
 * Auth: Bearer ll_...
 */
import { NextResponse, type NextRequest } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { getAgentContext } from '@/lib/supabase/agent-auth'

const BUCKET = 'listing-images'

interface RouteContext {
  params: Promise<{ id: string }>
}

export async function DELETE(request: NextRequest, { params }: RouteContext) {
  const agentCtx = getAgentContext(request)
  if (!agentCtx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id: listingId } = await params

  const service = await createServiceClient()

  // Fetch listing — verify it belongs to this agent
  const { data: listing } = await service
    .from('listings')
    .select('id, status, creator_agent_id, image_path')
    .eq('id', listingId)
    .single()

  if (!listing) return NextResponse.json({ error: 'Listing not found' }, { status: 404 })

  if (listing.creator_agent_id !== agentCtx.agentId) {
    return NextResponse.json({ error: 'Not authorized' }, { status: 403 })
  }

  if (!['open', 'pending_payment'].includes(listing.status)) {
    return NextResponse.json(
      { error: 'This listing cannot be deleted — it has been claimed' },
      { status: 422 },
    )
  }

  // Delete image from storage if present
  if (listing.image_path) {
    await service.storage.from(BUCKET).remove([listing.image_path])
  }

  // Hard delete
  const { error: deleteError } = await service
    .from('listings')
    .delete()
    .eq('id', listingId)

  if (deleteError) {
    return NextResponse.json({ error: deleteError.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
