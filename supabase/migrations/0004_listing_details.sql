-- ─── Listing Jobs ─────────────────────────────────────────────────────────────
create table if not exists public.listing_jobs (
  listing_id              uuid primary key references public.listings(id) on delete cascade,
  deadline                timestamptz,
  required_skills         text[] default '{}',
  deliverable_description text,
  milestone_flag          boolean default false
);

alter table public.listing_jobs enable row level security;
create policy "listing_jobs_read" on public.listing_jobs for select using (true);
create policy "listing_jobs_insert" on public.listing_jobs for insert with check (
  exists (
    select 1 from public.listings l
    where l.id = listing_id
    and (l.creator_user_id = auth.uid()
      or exists (select 1 from public.agents a where a.id = l.creator_agent_id and a.owner_id = auth.uid()))
  )
);
create policy "listing_jobs_update" on public.listing_jobs for update using (
  exists (
    select 1 from public.listings l
    where l.id = listing_id
    and (l.creator_user_id = auth.uid()
      or exists (select 1 from public.agents a where a.id = l.creator_agent_id and a.owner_id = auth.uid()))
  )
);

-- ─── Listing Gigs ─────────────────────────────────────────────────────────────
create table if not exists public.listing_gigs (
  listing_id                  uuid primary key references public.listings(id) on delete cascade,
  delivery_time_hours         integer,
  revision_count              integer default 0,
  recurring                   boolean default false,
  turnaround_guarantee_hours  integer
);

alter table public.listing_gigs enable row level security;
create policy "listing_gigs_read" on public.listing_gigs for select using (true);
create policy "listing_gigs_insert" on public.listing_gigs for insert with check (
  exists (
    select 1 from public.listings l
    where l.id = listing_id
    and (l.creator_user_id = auth.uid()
      or exists (select 1 from public.agents a where a.id = l.creator_agent_id and a.owner_id = auth.uid()))
  )
);
create policy "listing_gigs_update" on public.listing_gigs for update using (
  exists (
    select 1 from public.listings l
    where l.id = listing_id
    and (l.creator_user_id = auth.uid()
      or exists (select 1 from public.agents a where a.id = l.creator_agent_id and a.owner_id = auth.uid()))
  )
);

-- ─── Listing Services ─────────────────────────────────────────────────────────
create table if not exists public.listing_services (
  listing_id              uuid primary key references public.listings(id) on delete cascade,
  pricing_type            pricing_type not null,
  availability_text       text,
  minimum_engagement      text,
  response_time_sla_hours integer
);

alter table public.listing_services enable row level security;
create policy "listing_services_read" on public.listing_services for select using (true);
create policy "listing_services_insert" on public.listing_services for insert with check (
  exists (
    select 1 from public.listings l
    where l.id = listing_id
    and (l.creator_user_id = auth.uid()
      or exists (select 1 from public.agents a where a.id = l.creator_agent_id and a.owner_id = auth.uid()))
  )
);
create policy "listing_services_update" on public.listing_services for update using (
  exists (
    select 1 from public.listings l
    where l.id = listing_id
    and (l.creator_user_id = auth.uid()
      or exists (select 1 from public.agents a where a.id = l.creator_agent_id and a.owner_id = auth.uid()))
  )
);

-- ─── Listing Goods ────────────────────────────────────────────────────────────
create table if not exists public.listing_goods (
  listing_id          uuid primary key references public.listings(id) on delete cascade,
  file_type           text,
  license_type        license_type not null,
  instant_delivery    boolean default true,
  preview_available   boolean default false
);

alter table public.listing_goods enable row level security;
create policy "listing_goods_read" on public.listing_goods for select using (true);
create policy "listing_goods_insert" on public.listing_goods for insert with check (
  exists (
    select 1 from public.listings l
    where l.id = listing_id
    and (l.creator_user_id = auth.uid()
      or exists (select 1 from public.agents a where a.id = l.creator_agent_id and a.owner_id = auth.uid()))
  )
);
create policy "listing_goods_update" on public.listing_goods for update using (
  exists (
    select 1 from public.listings l
    where l.id = listing_id
    and (l.creator_user_id = auth.uid()
      or exists (select 1 from public.agents a where a.id = l.creator_agent_id and a.owner_id = auth.uid()))
  )
);
