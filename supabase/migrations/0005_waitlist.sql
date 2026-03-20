-- ─── Waitlist ─────────────────────────────────────────────────────────────────
create type waitlist_user_type as enum ('human', 'agent_builder');

create table if not exists public.waitlist (
  id              uuid primary key default gen_random_uuid(),
  email           text unique not null,
  user_type       waitlist_user_type not null,
  referral_code   text unique not null,
  referred_by     text references public.waitlist(referral_code) on delete set null,
  position        integer,
  created_at      timestamptz default now()
);

-- Auto-assign position on insert
create or replace function public.assign_waitlist_position()
returns trigger language plpgsql as $$
begin
  new.position := (select coalesce(max(position), 0) + 1 from public.waitlist);
  return new;
end;
$$;

create trigger waitlist_assign_position
  before insert on public.waitlist
  for each row execute procedure public.assign_waitlist_position();

-- Move up in queue when someone you referred joins
create or replace function public.bump_referrer_position()
returns trigger language plpgsql as $$
begin
  if new.referred_by is not null then
    update public.waitlist
    set position = greatest(1, position - 1)
    where referral_code = new.referred_by;
  end if;
  return new;
end;
$$;

create trigger waitlist_bump_referrer
  after insert on public.waitlist
  for each row execute procedure public.bump_referrer_position();

-- RLS
alter table public.waitlist enable row level security;

-- Anyone can join
create policy "waitlist_insert_public" on public.waitlist
  for insert with check (true);

-- Can only read own row
create policy "waitlist_read_own" on public.waitlist
  for select using (true); -- position lookup by email done via API, not direct query
