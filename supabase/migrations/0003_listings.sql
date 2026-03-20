-- ─── Enums ────────────────────────────────────────────────────────────────────
create type listing_category as enum ('job', 'gig', 'service', 'good');
create type listing_status   as enum ('open', 'claimed', 'completed', 'disputed');
create type pricing_type     as enum ('hourly', 'fixed');
create type license_type     as enum ('personal', 'commercial', 'exclusive');

-- ─── Listings (base) ──────────────────────────────────────────────────────────
create table if not exists public.listings (
  id                    uuid primary key default gen_random_uuid(),
  title                 text not null,
  description           text not null,
  price_sats            bigint not null,

  -- Exactly one of these must be set
  creator_user_id       uuid references public.users(id)   on delete cascade,
  creator_agent_id      uuid references public.agents(id)  on delete cascade,
  constraint exactly_one_creator check (
    (creator_user_id is not null)::int + (creator_agent_id is not null)::int = 1
  ),

  -- Phase 2 readiness — who claimed this listing
  claimed_by_user_id    uuid references public.users(id)   on delete set null,
  claimed_by_agent_id   uuid references public.agents(id)  on delete set null,
  claimed_at            timestamptz,
  constraint at_most_one_claimant check (
    (claimed_by_user_id is not null)::int + (claimed_by_agent_id is not null)::int <= 1
  ),

  category              listing_category not null,
  status                listing_status not null default 'open',
  tags                  text[] default '{}',
  created_at            timestamptz default now(),
  updated_at            timestamptz default now()
);

-- Keep updated_at current
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger listings_updated_at
  before update on public.listings
  for each row execute procedure public.set_updated_at();

-- Indexes for browse/search performance
create index listings_category_idx    on public.listings(category);
create index listings_status_idx      on public.listings(status);
create index listings_created_at_idx  on public.listings(created_at desc);
create index listings_price_sats_idx  on public.listings(price_sats);
create index listings_tags_idx        on public.listings using gin(tags);
create index listings_fts_idx         on public.listings
  using gin(to_tsvector('english', title || ' ' || description));

-- RLS
alter table public.listings enable row level security;

-- Anyone can read open listings
create policy "listings_read_open" on public.listings
  for select using (status = 'open');

-- Creator (human) can read all their own listings regardless of status
create policy "listings_read_own_user" on public.listings
  for select using (auth.uid() = creator_user_id);

-- Creator (human) can insert
create policy "listings_insert_user" on public.listings
  for insert with check (auth.uid() = creator_user_id);

-- Creator (human) can update/delete their own open listings
create policy "listings_update_own_user" on public.listings
  for update using (auth.uid() = creator_user_id);

create policy "listings_delete_own_user" on public.listings
  for delete using (auth.uid() = creator_user_id and status = 'open');

-- Agent-owned listings: owner of the agent can manage them
create policy "listings_insert_agent" on public.listings
  for insert with check (
    creator_agent_id is not null and
    exists (select 1 from public.agents where id = creator_agent_id and owner_id = auth.uid())
  );

create policy "listings_update_agent" on public.listings
  for update using (
    creator_agent_id is not null and
    exists (select 1 from public.agents where id = creator_agent_id and owner_id = auth.uid())
  );

create policy "listings_delete_agent" on public.listings
  for delete using (
    creator_agent_id is not null and status = 'open' and
    exists (select 1 from public.agents where id = creator_agent_id and owner_id = auth.uid())
  );
