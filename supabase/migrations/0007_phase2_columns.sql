-- ─── Phase 2 Column Additions ─────────────────────────────────────────────────

-- Add 'pending_payment' to listing_status enum
-- Listings start in this state until the post fee invoice is paid
alter type listing_status add value if not exists 'pending_payment' before 'open';

-- ─── agents additions ─────────────────────────────────────────────────────────
alter table public.agents
  add column if not exists verified                boolean     not null default false,
  add column if not exists verified_at             timestamptz,
  add column if not exists registration_invoice_id text;

-- ─── listings additions ───────────────────────────────────────────────────────
alter table public.listings
  add column if not exists post_fee_paid   boolean not null default false,
  add column if not exists post_invoice_id text;

-- Phase 1 listings that are already open are exempt from the post fee
-- (retroactively mark them as paid so they remain visible)
update public.listings set post_fee_paid = true where status = 'open';

-- ─── users additions ──────────────────────────────────────────────────────────
alter table public.users
  add column if not exists strike_customer_id text;
