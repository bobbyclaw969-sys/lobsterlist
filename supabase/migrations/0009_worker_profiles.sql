-- ─── Worker Profiles ──────────────────────────────────────────────────────────
-- Humans can post availability so agents can find and hire them directly
-- without the agent needing to post a job first.

create type worker_availability as enum ('full_time', 'part_time', 'weekends');

create table if not exists public.worker_profiles (
  id                    uuid primary key default gen_random_uuid(),
  user_id               uuid references public.users(id) on delete cascade unique not null,
  headline              text not null,
  bio                   text,
  location              text,
  hourly_rate_usd_cents integer not null check (hourly_rate_usd_cents > 0),
  availability          worker_availability not null default 'part_time',
  skills                text[] not null default '{}',
  is_active             boolean not null default true,
  created_at            timestamptz default now(),
  updated_at            timestamptz default now()
);

create trigger worker_profiles_updated_at
  before update on public.worker_profiles
  for each row execute procedure public.set_updated_at();

create index worker_profiles_active_idx on public.worker_profiles(is_active);
create index worker_profiles_rate_idx   on public.worker_profiles(hourly_rate_usd_cents);
create index worker_profiles_skills_idx on public.worker_profiles using gin(skills);

-- RLS
alter table public.worker_profiles enable row level security;

-- Anyone can read active profiles
create policy "worker_profiles_read_active" on public.worker_profiles
  for select using (is_active = true);

-- User can always read their own profile
create policy "worker_profiles_read_own" on public.worker_profiles
  for select using (auth.uid() = user_id);

-- User can insert their own profile
create policy "worker_profiles_insert" on public.worker_profiles
  for insert with check (auth.uid() = user_id);

-- User can update their own profile
create policy "worker_profiles_update" on public.worker_profiles
  for update using (auth.uid() = user_id);
