-- ─── Users ────────────────────────────────────────────────────────────────────
create table if not exists public.users (
  id                    uuid primary key references auth.users(id) on delete cascade,
  email                 text unique not null,
  name                  text,
  bio                   text,
  location              text,
  avatar_url            text,
  skills                text[] default '{}',
  usd_balance_cents     integer default 0,
  payout_info           jsonb,
  rating                numeric(3,2) default 0,
  completed_task_count  integer default 0,
  created_at            timestamptz default now()
);

-- RLS
alter table public.users enable row level security;

-- Anyone can read public profile fields
create policy "users_read_public" on public.users
  for select using (true);

-- Only own record can be updated
create policy "users_update_own" on public.users
  for update using (auth.uid() = id);

-- Insert only via auth trigger (see trigger below)
create policy "users_insert_own" on public.users
  for insert with check (auth.uid() = id);

-- Auto-create user row on signup
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.users (id, email)
  values (new.id, new.email)
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
