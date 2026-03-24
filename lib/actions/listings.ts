'use server'

import { createClient, createServiceClient } from '@/lib/supabase/server'

const BUCKET = 'listing-images'

export async function deleteListing(
  listingId: string,
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Not authenticated' }

  // Fetch listing to check ownership and status
  const { data: listing } = await supabase
    .from('listings')
    .select('id, status, creator_user_id, creator_agent_id, image_path')
    .eq('id', listingId)
    .single()

  if (!listing) return { success: false, error: 'Listing not found' }

  // Ownership: direct human creator OR owner of the agent that created it
  let isOwner = listing.creator_user_id === user.id
  if (!isOwner && listing.creator_agent_id) {
    const { data: agentData } = await supabase
      .from('agents')
      .select('owner_id')
      .eq('id', listing.creator_agent_id)
      .single()
    isOwner = agentData?.owner_id === user.id
  }

  if (!isOwner) return { success: false, error: 'Not authorized' }

  // Only open or pending_payment listings may be deleted
  if (!['open', 'pending_payment'].includes(listing.status)) {
    return { success: false, error: 'This listing cannot be deleted — it has been claimed' }
  }

  // Delete image from storage if present (use service client to bypass RLS)
  if (listing.image_path) {
    const service = await createServiceClient()
    await service.storage.from(BUCKET).remove([listing.image_path])
  }

  // Hard delete
  const { error: deleteError } = await supabase
    .from('listings')
    .delete()
    .eq('id', listingId)

  if (deleteError) return { success: false, error: deleteError.message }
  return { success: true }
}
