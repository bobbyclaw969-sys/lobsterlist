'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getBtcPriceUsd, usdToSats } from '@/lib/utils/sats'
import type { ListingCategory, AgentRow } from '@/types/database'

export type ListingState = {
  error?: string
  fieldErrors?: Record<string, string>
} | undefined

// ── Flow 2: Human posts a listing ─────────────────────────────────────────────
// Price is entered in USD and converted server-side using the live BTC rate.

export async function createListing(_prev: ListingState, formData: FormData): Promise<ListingState> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return { error: 'You must be signed in to create a listing.' }

  const title        = (formData.get('title') as string)?.trim()
  const description  = (formData.get('description') as string)?.trim()
  const category     = formData.get('category') as ListingCategory
  const priceUsdRaw  = (formData.get('price_usd') as string)?.trim()
  const tagsRaw      = (formData.get('tags') as string)?.trim()
  const imageUrl     = (formData.get('image_url') as string)?.trim() || null
  const imagePath    = (formData.get('image_path') as string)?.trim() || null

  const fieldErrors: Record<string, string> = {}
  if (!title || title.length < 5)        fieldErrors.title       = 'Title must be at least 5 characters.'
  if (!description || description.length < 20) fieldErrors.description = 'Description must be at least 20 characters.'
  if (!['job', 'gig', 'service', 'good'].includes(category)) fieldErrors.category = 'Select a category.'

  const priceUsd = parseFloat(priceUsdRaw?.replace(/[$,]/g, '') ?? '')
  if (isNaN(priceUsd) || priceUsd < 0.01) fieldErrors.price_usd = 'Enter a price of at least $0.01.'

  if (Object.keys(fieldErrors).length > 0) return { fieldErrors }

  const btcPrice = await getBtcPriceUsd()
  const priceSats = usdToSats(priceUsd, btcPrice)
  const tags = tagsRaw ? tagsRaw.split(',').map((t) => t.trim()).filter(Boolean) : []

  const { data: listing, error: listingError } = await supabase
    .from('listings')
    .insert({
      title,
      description,
      category,
      price_sats: priceSats,
      tags,
      creator_user_id: user.id,
      ...(imageUrl  ? { image_url:  imageUrl  } : {}),
      ...(imagePath ? { image_path: imagePath } : {}),
    })
    .select('id')
    .single()

  if (listingError || !listing) {
    return { error: listingError?.message ?? 'Failed to create listing.' }
  }

  await insertCategoryDetail(supabase, category, listing.id, formData)

  redirect(`/browse?created=${listing.id}`)
}

// ── Flow 1: Agent posts a listing ─────────────────────────────────────────────
// Price is entered in sats (agents work natively in sats).
// Listing is attributed to creator_agent_id, not creator_user_id.

export async function createAgentListing(_prev: ListingState, formData: FormData): Promise<ListingState> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return { error: 'You must be signed in.' }

  const agentId      = (formData.get('agent_id') as string)?.trim()
  const title        = (formData.get('title') as string)?.trim()
  const description  = (formData.get('description') as string)?.trim()
  const category     = formData.get('category') as ListingCategory
  const priceSatsRaw = formData.get('price_sats') as string
  const tagsRaw      = (formData.get('tags') as string)?.trim()
  const imageUrl     = (formData.get('image_url') as string)?.trim() || null
  const imagePath    = (formData.get('image_path') as string)?.trim() || null

  if (!agentId) return { error: 'No agent selected.' }

  // Verify ownership
  const { data: rawAgent } = await supabase.from('agents').select('*').eq('id', agentId).single()
  if (!rawAgent) return { error: 'Agent not found.' }
  const agent = rawAgent as AgentRow
  if (agent.owner_id !== user.id) return { error: 'You do not own this agent.' }
  if (!agent.verified) return { error: 'Agent must complete registration payment before posting.' }

  const fieldErrors: Record<string, string> = {}
  if (!title || title.length < 5)        fieldErrors.title       = 'Title must be at least 5 characters.'
  if (!description || description.length < 20) fieldErrors.description = 'Description must be at least 20 characters.'
  if (!['job', 'gig', 'service', 'good'].includes(category)) fieldErrors.category = 'Select a category.'

  const priceSats = parseInt(priceSatsRaw, 10)
  if (isNaN(priceSats) || priceSats < 1) fieldErrors.price_sats = 'Price must be at least 1 sat.'

  if (Object.keys(fieldErrors).length > 0) return { fieldErrors }

  const tags = tagsRaw ? tagsRaw.split(',').map((t) => t.trim()).filter(Boolean) : []

  const { data: listing, error: listingError } = await supabase
    .from('listings')
    .insert({
      title,
      description,
      category,
      price_sats: priceSats,
      tags,
      creator_agent_id: agentId,
      ...(imageUrl  ? { image_url:  imageUrl  } : {}),
      ...(imagePath ? { image_path: imagePath } : {}),
    })
    .select('id')
    .single()

  if (listingError || !listing) {
    return { error: listingError?.message ?? 'Failed to create listing.' }
  }

  await insertCategoryDetail(supabase, category, listing.id, formData)

  redirect(`/agents/${agentId}?created=${listing.id}`)
}

// ── updateListing — human owner edits their own listing ───────────────────────

export async function updateListing(
  listingId: string,
  _prev: ListingState,
  formData: FormData,
): Promise<ListingState> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'You must be signed in.' }

  // Ownership + editability check (always server-side)
  const { data: rawListing } = await supabase
    .from('listings')
    .select('id, creator_user_id, status, category, price_sats')
    .eq('id', listingId)
    .single()

  if (!rawListing) return { error: 'Listing not found.' }
  if (rawListing.creator_user_id !== user.id) return { error: 'You do not own this listing.' }
  if (!['open', 'pending_payment'].includes(rawListing.status)) {
    return { error: 'This listing can no longer be edited because it has been claimed or completed.' }
  }

  const title        = (formData.get('title') as string)?.trim()
  const description  = (formData.get('description') as string)?.trim()
  const priceUsdRaw  = (formData.get('price_usd') as string)?.trim()
  const tagsRaw      = (formData.get('tags') as string)?.trim()
  const imageUrl     = ((formData.get('image_url')  as string) ?? '').trim() || null
  const imagePath    = ((formData.get('image_path') as string) ?? '').trim() || null

  const fieldErrors: Record<string, string> = {}
  if (!title || title.length < 5) fieldErrors.title = 'Title must be at least 5 characters.'
  if (!description || description.length < 20) fieldErrors.description = 'Description must be at least 20 characters.'

  const priceUsd = parseFloat(priceUsdRaw?.replace(/[$,]/g, '') ?? '')
  if (isNaN(priceUsd) || priceUsd < 0.01) fieldErrors.price_usd = 'Enter a price of at least $0.01.'

  if (Object.keys(fieldErrors).length > 0) return { fieldErrors }

  const btcPrice  = await getBtcPriceUsd()
  const priceSats = usdToSats(priceUsd, btcPrice)
  const tags      = tagsRaw ? tagsRaw.split(',').map((t) => t.trim()).filter(Boolean) : []

  const { error: updateError } = await supabase
    .from('listings')
    .update({ title, description, price_sats: priceSats, tags, image_url: imageUrl, image_path: imagePath })
    .eq('id', listingId)

  if (updateError) return { error: updateError.message }

  // Update category-specific detail (category cannot change on edit)
  await upsertCategoryDetail(supabase, rawListing.category as ListingCategory, listingId, formData)

  redirect(`/listings/${listingId}`)
}

// ── updateAgentListing — agent owner edits their agent's listing ───────────────

export async function updateAgentListing(
  listingId: string,
  _prev: ListingState,
  formData: FormData,
): Promise<ListingState> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'You must be signed in.' }

  const { data: rawListing } = await supabase
    .from('listings')
    .select('id, creator_agent_id, status, category')
    .eq('id', listingId)
    .single()

  if (!rawListing) return { error: 'Listing not found.' }
  if (!['open', 'pending_payment'].includes(rawListing.status)) {
    return { error: 'This listing can no longer be edited.' }
  }
  if (!rawListing.creator_agent_id) return { error: 'Listing not found.' }

  // Verify the creator agent is owned by this user
  const { data: rawAgent } = await supabase
    .from('agents')
    .select('owner_id')
    .eq('id', rawListing.creator_agent_id)
    .single()

  if (!rawAgent || rawAgent.owner_id !== user.id) return { error: 'You do not own this listing.' }

  const title        = (formData.get('title') as string)?.trim()
  const description  = (formData.get('description') as string)?.trim()
  const priceSatsRaw = formData.get('price_sats') as string
  const tagsRaw      = (formData.get('tags') as string)?.trim()
  const imageUrl     = ((formData.get('image_url')  as string) ?? '').trim() || null
  const imagePath    = ((formData.get('image_path') as string) ?? '').trim() || null

  const fieldErrors: Record<string, string> = {}
  if (!title || title.length < 5) fieldErrors.title = 'Title must be at least 5 characters.'
  if (!description || description.length < 20) fieldErrors.description = 'Description must be at least 20 characters.'

  const priceSats = parseInt(priceSatsRaw, 10)
  if (isNaN(priceSats) || priceSats < 1) fieldErrors.price_sats = 'Price must be at least 1 sat.'

  if (Object.keys(fieldErrors).length > 0) return { fieldErrors }

  const tags = tagsRaw ? tagsRaw.split(',').map((t) => t.trim()).filter(Boolean) : []

  const { error: updateError } = await supabase
    .from('listings')
    .update({ title, description, price_sats: priceSats, tags, image_url: imageUrl, image_path: imagePath })
    .eq('id', listingId)

  if (updateError) return { error: updateError.message }

  await upsertCategoryDetail(supabase, rawListing.category as ListingCategory, listingId, formData)

  redirect(`/listings/${listingId}`)
}

// ── Shared: insert category-specific detail row ───────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function upsertCategoryDetail(supabase: any, category: ListingCategory, listingId: string, formData: FormData) {
  if (category === 'job') {
    const deadline    = (formData.get('deadline') as string) || null
    const skills      = (formData.get('required_skills') as string)?.split(',').map((s) => s.trim()).filter(Boolean) ?? []
    const deliverable = (formData.get('deliverable_description') as string)?.trim() || null
    await supabase.from('listing_jobs').upsert(
      { listing_id: listingId, deadline, required_skills: skills, deliverable_description: deliverable },
      { onConflict: 'listing_id' }
    )
  } else if (category === 'gig') {
    const deliveryHours = parseInt(formData.get('delivery_time_hours') as string, 10)
    const revisions     = parseInt(formData.get('revision_count') as string, 10)
    await supabase.from('listing_gigs').upsert(
      {
        listing_id: listingId,
        delivery_time_hours: isNaN(deliveryHours) ? null : deliveryHours,
        revision_count: isNaN(revisions) ? 0 : revisions,
        recurring: formData.get('recurring') === 'on',
      },
      { onConflict: 'listing_id' }
    )
  } else if (category === 'service') {
    const pricingType  = (formData.get('pricing_type') as 'hourly' | 'fixed') || 'fixed'
    const availability = (formData.get('availability_text') as string)?.trim() || null
    const sla          = parseInt(formData.get('response_time_sla_hours') as string, 10)
    await supabase.from('listing_services').upsert(
      { listing_id: listingId, pricing_type: pricingType, availability_text: availability, response_time_sla_hours: isNaN(sla) ? null : sla },
      { onConflict: 'listing_id' }
    )
  } else if (category === 'good') {
    const licenseType = (formData.get('license_type') as 'personal' | 'commercial' | 'exclusive') || 'personal'
    const fileType    = (formData.get('file_type') as string)?.trim() || null
    await supabase.from('listing_goods').upsert(
      { listing_id: listingId, license_type: licenseType, file_type: fileType, instant_delivery: formData.get('instant_delivery') === 'on', preview_available: formData.get('preview_available') === 'on' },
      { onConflict: 'listing_id' }
    )
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function insertCategoryDetail(supabase: any, category: ListingCategory, listingId: string, formData: FormData) {
  if (category === 'job') {
    const deadline    = formData.get('deadline') as string | null
    const skills      = (formData.get('required_skills') as string)?.split(',').map((s) => s.trim()).filter(Boolean) ?? []
    const deliverable = (formData.get('deliverable_description') as string)?.trim()

    await supabase.from('listing_jobs').insert({
      listing_id: listingId,
      deadline: deadline || null,
      required_skills: skills,
      deliverable_description: deliverable || null,
    })
  } else if (category === 'gig') {
    const deliveryHours = parseInt(formData.get('delivery_time_hours') as string, 10)
    const revisions     = parseInt(formData.get('revision_count') as string, 10)

    await supabase.from('listing_gigs').insert({
      listing_id: listingId,
      delivery_time_hours: isNaN(deliveryHours) ? null : deliveryHours,
      revision_count: isNaN(revisions) ? 0 : revisions,
      recurring: formData.get('recurring') === 'on',
    })
  } else if (category === 'service') {
    const pricingType  = (formData.get('pricing_type') as 'hourly' | 'fixed') || 'fixed'
    const availability = (formData.get('availability_text') as string)?.trim()
    const sla          = parseInt(formData.get('response_time_sla_hours') as string, 10)

    await supabase.from('listing_services').insert({
      listing_id: listingId,
      pricing_type: pricingType,
      availability_text: availability || null,
      response_time_sla_hours: isNaN(sla) ? null : sla,
    })
  } else if (category === 'good') {
    const licenseType = (formData.get('license_type') as 'personal' | 'commercial' | 'exclusive') || 'personal'
    const fileType    = (formData.get('file_type') as string)?.trim()

    await supabase.from('listing_goods').insert({
      listing_id: listingId,
      license_type: licenseType,
      file_type: fileType || null,
      instant_delivery: formData.get('instant_delivery') === 'on',
      preview_available: formData.get('preview_available') === 'on',
    })
  }
}
