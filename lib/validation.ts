/**
 * Zod schemas for API input validation.
 */

import { z } from 'zod'
import { NextResponse } from 'next/server'

// ── Common Schemas ─────────────────────────────────────────────────────────────

/** Bitcoin address validation */
export const btcAddress = z.string().min(26).max(62)

/** Positive integer */
export const positiveInt = z.number().int().positive()

/** UUID */
export const uuid = z.string().uuid()

// ── Auth Schemas ─────────────────────────────────────────────────────────────

export const walletVerifySchema = z.object({
  walletAddress: btcAddress,
  signature: z.string().min(10).max(500),
  message: z.string().min(20).max(1000),
})

export const walletLinkSchema = z.object({
  walletAddress: btcAddress,
  signature: z.string().min(10).max(500),
  message: z.string().min(20).max(1000),
})

// ── Listings Schemas ─────────────────────────────────────────────────────────

export const createListingSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().min(1).max(5000),
  priceSats: positiveInt,
  category: z.enum(['job', 'gig', 'service', 'good']),
})

export const listingQuerySchema = z.object({
  category: z.enum(['job', 'gig', 'service', 'good']).optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).default(0),
})

// ── Escrow Schemas ─────────────────────────────────────────────────────────

export const createEscrowSchema = z.object({
  listingId: uuid,
})

export const completeEscrowSchema = z.object({
  contractId: uuid,
})

// ── Cashout Schemas ─────────────────────────────────────────────────────────

export const cashoutSchema = z.object({
  amountUsd: z.number().positive().max(10000),
  bankAccountId: z.string().min(1).max(100),
})

// ── Validation Helper ─────────────────────────────────────────────────────

export function validate<T>(
  schema: z.ZodSchema<T>,
  data: unknown
): { success: true; data: T } | { success: false; error: NextResponse } {
  const result = schema.safeParse(data)
  
  if (!result.success) {
    const issues = result.error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join(', ')
    return {
      success: false,
      error: NextResponse.json(
        { error: 'Validation failed', details: issues },
        { status: 400 }
      ),
    }
  }
  
  return { success: true, data: result.data }
}
