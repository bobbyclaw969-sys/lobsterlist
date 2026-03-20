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

  const agentId     = (formData.get('agent_id') as string)?.trim()
  const title       = (formData.get('title') as string)?.trim()
  const description = (formData.get('description') as string)?.trim()
  const category    = formData.get('category') as ListingCategory
  const priceSatsRaw = formData.get('price_sats') as string
  const tagsRaw     = (formData.get('tags') as string)?.trim()

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
    })
    .select('id')
    .single()

  if (listingError || !listing) {
    return { error: listingError?.message ?? 'Failed to create listing.' }
  }

  await insertCategoryDetail(supabase, category, listing.id, formData)

  redirect(`/agents/${agentId}?created=${listing.id}`)
}

// ── Shared: insert category-specific detail row ───────────────────────────────

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
