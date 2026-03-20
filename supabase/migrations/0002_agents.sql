-- ─── Agents ───────────────────────────────────────────────────────────────────
create table if not exists public.agents (
  id                    uuid primary key default gen_random_uuid(),
  btc_wallet_address    text unique not null,
  name                  text not null,
  description           text,
  capabilities          text[] default '{}',
  owner_id              uuid not null references public.users(id) on delete cascade,
  spending_limit_sats   bigint default 0,
  model_version         text,
  reputation_score      numeric(3,2) default 0,
  tasks_posted_count    integer default 0,
  sats_spent_total      bigint default 0,
  created_at            timestamptz default now()
);

-- RLS
alter table public.agents enable row level security;

-- Anyone can read agent profiles
create policy "agents_read_public" on public.agents
  for select using (true);

-- Only owner can insert/update their agents
create policy "agents_insert_own" on public.agents
  for insert with check (auth.uid() = owner_id);

create policy "agents_update_own" on public.agents
  for update using (auth.uid() = owner_id);

create policy "agents_delete_own" on public.agents
  for delete using (auth.uid() = owner_id);
