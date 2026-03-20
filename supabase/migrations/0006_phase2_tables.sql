-- ─── Phase 2 Tables ───────────────────────────────────────────────────────────

-- ─── Lightning Invoices ───────────────────────────────────────────────────────
-- Tracks all Strike Lightning invoices for sat fees and escrow funding.
-- Written only by service role (webhook handler), never directly by users.

create table if not exists public.lightning_invoices (
  id                uuid        primary key default gen_random_uuid(),
  invoice_type      text        not null check (invoice_type in ('agent_registration', 'listing_fee', 'escrow_funding')),
  entity_id         uuid        not null, -- agent_id or listing_id depending on invoice_type
  strike_invoice_id text        unique not null,
  amount_sats       bigint      not null,
  status            text        not null default 'pending' check (status in ('pending', 'paid', 'expired')),
  created_at        timestamptz default now(),
  paid_at           timestamptz
);

alter table public.lightning_invoices enable row level security;

-- Only service role can read/write lightning_invoices (webhook handler uses service role)
create policy "lightning_invoices_service_only" on public.lightning_invoices
  for all using (false);

create index lightning_invoices_entity_idx       on public.lightning_invoices(entity_id);
create index lightning_invoices_strike_id_idx    on public.lightning_invoices(strike_invoice_id);
create index lightning_invoices_status_idx       on public.lightning_invoices(status);


-- ─── Escrow Contracts ─────────────────────────────────────────────────────────
-- One record per claimed listing. Holds BitEscrow contract state.

create table if not exists public.escrow_contracts (
  id                uuid        primary key default gen_random_uuid(),
  listing_id        uuid        not null references public.listings(id) on delete restrict,
  bitescrow_cid     text        unique, -- null until BitEscrow contract is created

  -- Buyer: the party paying (claiming the listing)
  buyer_user_id     uuid        references public.users(id) on delete restrict,
  buyer_agent_id    uuid        references public.agents(id) on delete restrict,
  constraint exactly_one_buyer check (
    (buyer_user_id is not null)::int + (buyer_agent_id is not null)::int = 1
  ),

  -- Seller: the listing creator (receiving payment)
  seller_user_id    uuid        references public.users(id) on delete restrict,
  seller_agent_id   uuid        references public.agents(id) on delete restrict,
  constraint exactly_one_seller check (
    (seller_user_id is not null)::int + (seller_agent_id is not null)::int = 1
  ),

  amount_sats       bigint      not null,
  platform_fee_sats bigint      not null, -- 5% of amount_sats

  status            text        not null default 'pending_funding'
    check (status in ('pending_funding', 'funded', 'completed', 'disputed', 'cancelled', 'refunded')),

  created_at        timestamptz default now(),
  funded_at         timestamptz,
  settled_at        timestamptz
);

alter table public.escrow_contracts enable row level security;

-- Buyers can read their own contracts
create policy "escrow_buyer_user_read" on public.escrow_contracts
  for select using (auth.uid() = buyer_user_id);

-- Sellers can read their own contracts
create policy "escrow_seller_user_read" on public.escrow_contracts
  for select using (auth.uid() = seller_user_id);

-- Agent owners can read contracts where their agent is buyer/seller
create policy "escrow_agent_buyer_read" on public.escrow_contracts
  for select using (
    buyer_agent_id is not null and
    exists (select 1 from public.agents where id = buyer_agent_id and owner_id = auth.uid())
  );

create policy "escrow_agent_seller_read" on public.escrow_contracts
  for select using (
    seller_agent_id is not null and
    exists (select 1 from public.agents where id = seller_agent_id and owner_id = auth.uid())
  );

create index escrow_contracts_listing_idx   on public.escrow_contracts(listing_id);
create index escrow_contracts_buyer_idx     on public.escrow_contracts(buyer_user_id);
create index escrow_contracts_seller_idx    on public.escrow_contracts(seller_user_id);
create index escrow_contracts_status_idx    on public.escrow_contracts(status);


-- ─── Disputes ─────────────────────────────────────────────────────────────────
-- Dispute cases raised by either party on a funded escrow contract.

create table if not exists public.disputes (
  id                  uuid        primary key default gen_random_uuid(),
  contract_id         uuid        not null references public.escrow_contracts(id) on delete restrict,
  raised_by_user_id   uuid        not null references public.users(id) on delete restrict,
  reason              text        not null,
  status              text        not null default 'open'
    check (status in ('open', 'resolved', 'cancelled')),
  resolution_notes    text,
  created_at          timestamptz default now(),
  resolved_at         timestamptz
);

alter table public.disputes enable row level security;

-- Raiser can read and insert their own disputes
create policy "disputes_raiser_read" on public.disputes
  for select using (auth.uid() = raised_by_user_id);

create policy "disputes_raiser_insert" on public.disputes
  for insert with check (auth.uid() = raised_by_user_id);

create index disputes_contract_idx on public.disputes(contract_id);


-- ─── Transactions ─────────────────────────────────────────────────────────────
-- Append-only financial ledger. Written by service role only.

create table if not exists public.transactions (
  id            uuid        primary key default gen_random_uuid(),
  user_id       uuid        not null references public.users(id) on delete restrict,
  tx_type       text        not null
    check (tx_type in ('escrow_received', 'cashout', 'platform_fee', 'listing_fee', 'registration_fee')),
  amount_sats   bigint      not null,
  usd_cents     integer,    -- USD equivalent at time of tx
  reference_id  text,       -- contract_id, invoice_id, etc.
  created_at    timestamptz default now()
);

alter table public.transactions enable row level security;

-- Users can only read their own transactions
create policy "transactions_read_own" on public.transactions
  for select using (auth.uid() = user_id);

create index transactions_user_idx      on public.transactions(user_id);
create index transactions_created_idx   on public.transactions(created_at desc);


-- ─── BTC Price Cache ──────────────────────────────────────────────────────────
-- Single-row table holding the latest cached BTC/USD rate.
-- Updated by the /api/btc-price route, read by all server-side code.

create table if not exists public.btc_price_cache (
  id          integer     primary key default 1 check (id = 1), -- enforce single row
  price_usd   numeric(12,2) not null default 85000,
  updated_at  timestamptz default now()
);

-- Seed the single row
insert into public.btc_price_cache (id, price_usd) values (1, 85000)
  on conflict (id) do nothing;

alter table public.btc_price_cache enable row level security;

-- Anyone can read the BTC price (needed by browse page server rendering)
create policy "btc_price_public_read" on public.btc_price_cache
  for select using (true);
