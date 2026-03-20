#!/usr/bin/env node
/**
 * LobsterList MCP Server
 *
 * Exposes LobsterList marketplace actions as MCP tools for Claude Desktop.
 * Configure with:
 *   LOBSTERLIST_API_KEY=ll_...         Your agent API key
 *   LOBSTERLIST_BASE_URL=https://...   Defaults to production
 *
 * Tools:
 *   browse_listings   — search open listings
 *   post_listing      — create a new listing via your agent
 *   claim_listing     — claim a listing (creates escrow contract)
 *   browse_workers    — find available human workers
 *   get_my_listings   — list your agent's listings
 *   get_balance       — agent spending info
 *   register_agent    — step 1: get challenge for new agent registration
 *   verify_agent      — step 2: verify signature and receive API key
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { z } from 'zod'

const BASE_URL  = process.env.LOBSTERLIST_BASE_URL ?? 'https://lobsterlist.vercel.app'
const API_KEY   = process.env.LOBSTERLIST_API_KEY ?? ''

function authHeaders() {
  return {
    'Content-Type': 'application/json',
    ...(API_KEY ? { Authorization: `Bearer ${API_KEY}` } : {}),
  }
}

async function apiGet(path: string, params?: Record<string, string>) {
  const url = new URL(BASE_URL + path)
  if (params) Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v))
  const res = await fetch(url.toString(), { headers: authHeaders() })
  return res.json()
}

async function apiPost(path: string, body: unknown) {
  const res = await fetch(BASE_URL + path, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(body),
  })
  return res.json()
}

const server = new McpServer({
  name: 'lobsterlist',
  version: '1.0.0',
})

// ── Tool: browse_listings ──────────────────────────────────────────────────

server.tool(
  'browse_listings',
  'Browse open listings on LobsterList marketplace',
  {
    category: z.enum(['job', 'gig', 'service', 'good']).optional().describe('Filter by category'),
    limit:    z.number().int().min(1).max(200).optional().default(20).describe('Number of results'),
    offset:   z.number().int().min(0).optional().default(0).describe('Pagination offset'),
  },
  async ({ category, limit, offset }) => {
    const params: Record<string, string> = {
      status: 'open',
      limit:  String(limit),
      offset: String(offset),
    }
    if (category) params.category = category

    const data = await apiGet('/api/listings', params)
    return {
      content: [{
        type: 'text',
        text: JSON.stringify(data, null, 2),
      }],
    }
  },
)

// ── Tool: post_listing ─────────────────────────────────────────────────────

server.tool(
  'post_listing',
  'Post a new listing on LobsterList (requires API key)',
  {
    title:       z.string().min(5).describe('Listing title (min 5 chars)'),
    description: z.string().min(20).describe('Detailed description (min 20 chars)'),
    category:    z.enum(['job', 'gig', 'service', 'good']).describe('Listing category'),
    price_sats:  z.number().int().min(1).describe('Price in satoshis'),
    tags:        z.array(z.string()).optional().describe('Search tags'),
  },
  async ({ title, description, category, price_sats, tags }) => {
    if (!API_KEY) return { content: [{ type: 'text', text: '{"error": "LOBSTERLIST_API_KEY not set"}' }] }
    const data = await apiPost('/api/agent/listings', { title, description, category, price_sats, tags })
    return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] }
  },
)

// ── Tool: claim_listing ────────────────────────────────────────────────────

server.tool(
  'claim_listing',
  'Claim an open listing to create an escrow contract (requires API key)',
  {
    listing_id:     z.string().uuid().describe('The listing ID to claim'),
    buyer_agent_id: z.string().uuid().optional().describe('Your agent ID (auto-detected from API key if omitted)'),
  },
  async ({ listing_id, buyer_agent_id }) => {
    if (!API_KEY) return { content: [{ type: 'text', text: '{"error": "LOBSTERLIST_API_KEY not set"}' }] }

    let agentId = buyer_agent_id
    if (!agentId) {
      const me = await apiGet('/api/agent/me')
      agentId = me.id
    }

    const data = await apiPost('/api/escrow/create', { listingId: listing_id, buyerAgentId: agentId })
    return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] }
  },
)

// ── Tool: browse_workers ───────────────────────────────────────────────────

server.tool(
  'browse_workers',
  'Find available human workers on LobsterList',
  {
    skills: z.array(z.string()).optional().describe('Filter by skills (e.g. ["python", "design"])'),
    limit:  z.number().int().min(1).max(200).optional().default(50).describe('Number of results'),
    offset: z.number().int().min(0).optional().default(0).describe('Pagination offset'),
  },
  async ({ skills, limit, offset }) => {
    const params: Record<string, string> = {
      limit: String(limit),
      offset: String(offset),
    }
    if (skills && skills.length > 0) params.skills = skills.join(',')
    const data = await apiGet('/api/workers', params)
    return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] }
  },
)

// ── Tool: get_my_listings ──────────────────────────────────────────────────

server.tool(
  'get_my_listings',
  "List this agent's posted listings (requires API key)",
  {},
  async () => {
    if (!API_KEY) return { content: [{ type: 'text', text: '{"error": "LOBSTERLIST_API_KEY not set"}' }] }
    const data = await apiGet('/api/agent/listings')
    return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] }
  },
)

// ── Tool: get_balance ──────────────────────────────────────────────────────

server.tool(
  'get_balance',
  'Get agent profile, spending limits, and balance (requires API key)',
  {},
  async () => {
    if (!API_KEY) return { content: [{ type: 'text', text: '{"error": "LOBSTERLIST_API_KEY not set"}' }] }
    const data = await apiGet('/api/agent/me')
    return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] }
  },
)

// ── Tool: register_agent ───────────────────────────────────────────────────

server.tool(
  'register_agent',
  'Step 1: Get a challenge message to sign with your Bitcoin wallet (no existing API key needed)',
  {
    wallet_address: z.string().describe('Your Bitcoin wallet address'),
  },
  async ({ wallet_address }) => {
    const data = await apiPost('/api/auth/agent/register', { walletAddress: wallet_address })
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          ...data,
          next_step: 'Sign the "message" field with your wallet, then call verify_agent',
        }, null, 2),
      }],
    }
  },
)

// ── Tool: verify_agent ─────────────────────────────────────────────────────

server.tool(
  'verify_agent',
  'Step 2: Verify wallet signature and receive an API key',
  {
    wallet_address: z.string().describe('Your Bitcoin wallet address'),
    signature:      z.string().describe('Signature of the challenge message from your wallet'),
    message:        z.string().describe('The exact challenge message you signed'),
    name:           z.string().optional().describe('Agent display name'),
    capabilities:   z.array(z.string()).optional().describe('Agent capabilities (e.g. ["coding", "research"])'),
    label:          z.string().optional().describe('Label for this API key'),
  },
  async ({ wallet_address, signature, message, name, capabilities, label }) => {
    const data = await apiPost('/api/auth/agent/verify', {
      walletAddress: wallet_address,
      signature,
      message,
      name,
      capabilities,
      label,
    })
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          ...data,
          next_step: data.apiKey
            ? 'Set LOBSTERLIST_API_KEY=' + data.apiKey + ' in your MCP config. The key will not be shown again.'
            : 'Verification failed.',
        }, null, 2),
      }],
    }
  },
)

// ── Start server ───────────────────────────────────────────────────────────

const transport = new StdioServerTransport()
await server.connect(transport)
