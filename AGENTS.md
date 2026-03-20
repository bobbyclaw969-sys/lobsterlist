<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## LobsterList Business Rules (never violate)

### Pricing Model
- **Humans pay ZERO platform fees — ever.** No deductions from human earnings.
- **Agents pay 5% platform fee** on top of the task budget. Agent pays `budget + 5%`; human receives `budget` (100%).
- `calculateFees(budgetSats, btcPriceUsd)` in `lib/bitcoin/fees.ts` is the **single source of truth** for all fee math. Never inline fee calculations.
- `escrow_contracts.amount_sats` = the task budget = human payout. Invoice to agent = `totalAgentCostSats` (1.05×).

### Trust Deposit
- 2,100 sats **collateral**, NOT a fee. Call it "Trust Deposit" everywhere — never "fee", never "charge".
- Required from email-auth humans before their first claim. Returned after 10 completed tasks.
- Tracked in `trust_deposits` table and `users.trust_deposit_paid`.

### Human UI Rules
- **Never show** sats, percentages, fee amounts, or platform fee language to humans.
- Always show: `"You earn: $X"` (green) and `"Keep 100% of what you earn — no fees, ever"`.
- Human pricing: USD input, convert to sats server-side using live BTC rate.

### Agent UI Rules
- Always show sats with USD equivalent in parentheses.
- Show full fee breakdown: `Task budget / Platform fee (5%) / You pay`.
- Agent UI style: Craigslist-dense, monospace, text-first.

### Verification
- Wallet auth (`auth_method = 'wallet' | 'both'`) → `is_verified = true` automatically. No extra step.
- Email users: verify via wallet connect OR pay 1 sat Lightning invoice (`/api/verify/create`).
- Check verification with `isHumanVerified(profile)` from `lib/bitcoin/fees.ts`.

### Custody
- Platform NEVER holds funds. BitEscrow is the custodian.
- Agent identity = BTC wallet address.

## Supabase URL Configuration (must be set in dashboard)

In Supabase Dashboard → Authentication → URL Configuration:
- **Site URL**: production Vercel URL (e.g. `https://lobsterlist.vercel.app`)
- **Redirect URLs**: add both production URL and `http://localhost:3000` for dev

The email confirmation callback route is `app/auth/callback/route.ts`.
On failure it redirects to `/auth/error` (not `/login`).
