-- Squarely accounts in Supabase.
--
-- Sign-in is Supabase Auth (auth.users). Everything else a person saves
-- lives here, one row per person, keyed by their auth user id:
--
--   accounts         their deal library, saved sections and listing alerts
--   subscriptions    Squarely Plus, as Stripe last reported it
--   account_private  the code that confirms an alerts email (never readable by the person)
--   usage            daily counts for paid features (blueprints, Ask Squarely)
--
-- Row level security is on for every table. A signed-in person can read
-- their own account and subscription and nothing else. All writes go
-- through the Squarely server (the Cloudflare Worker), which checks and
-- cleans what is saved and uses the service role key. The browser's anon
-- key can't write anything.
--
-- Run this once in the Supabase dashboard's SQL editor (or `supabase db push`).

create table if not exists public.accounts (
  user_id uuid primary key references auth.users (id) on delete cascade,
  login_email text not null default '',
  -- The deal library: numbers, deals and settings. The newest save wins.
  library jsonb,
  library_updated_at bigint not null default 0,
  -- Saved sections: the renter profile, saved homes, applications, tenancies and landlord workspaces.
  profile jsonb not null default '{}'::jsonb,
  saved jsonb not null default '[]'::jsonb,
  applications jsonb not null default '[]'::jsonb,
  tenancies jsonb not null default '[]'::jsonb,
  workspaces jsonb not null default '[]'::jsonb,
  -- Listing alerts, and the confirmed email they go to.
  alerts jsonb not null default '[]'::jsonb,
  alert_email text not null default '',
  alert_email_verified boolean not null default false,
  -- The savings-month email is on (copied from the library so the daily run can find it).
  remind_ready boolean not null default false,
  last_sent date,
  ready_sent text not null default '',
  -- The account this one was moved from, before Squarely used Supabase.
  legacy_id text unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint accounts_library_size check (library is null or pg_column_size(library) < 2000000),
  constraint accounts_alerts_array check (jsonb_typeof(alerts) = 'array')
);

create table if not exists public.subscriptions (
  user_id uuid primary key references auth.users (id) on delete cascade,
  status text not null default '',
  customer text not null default '',
  subscription text not null default '',
  until bigint not null default 0,
  cancel_at bigint not null default 0,
  updated_at timestamptz not null default now()
);
create index if not exists subscriptions_customer on public.subscriptions (customer) where customer <> '';

create table if not exists public.account_private (
  user_id uuid primary key references auth.users (id) on delete cascade,
  pending_email text not null default '',
  code_hash text not null default '',
  code_until bigint not null default 0,
  code_tries integer not null default 0,
  codes_hour bigint not null default 0,
  codes_sent integer not null default 0
);

create table if not exists public.usage (
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  day date not null,
  count integer not null default 0,
  primary key (user_id, name, day)
);

-- ---- row level security ----

alter table public.accounts enable row level security;
alter table public.subscriptions enable row level security;
alter table public.account_private enable row level security;
alter table public.usage enable row level security;

drop policy if exists "Read your own account" on public.accounts;
create policy "Read your own account" on public.accounts
  for select to authenticated using ((select auth.uid()) = user_id);

drop policy if exists "Read your own subscription" on public.subscriptions;
create policy "Read your own subscription" on public.subscriptions
  for select to authenticated using ((select auth.uid()) = user_id);

-- account_private and usage have no policies: only the server can touch them.

revoke insert, update, delete, truncate on public.accounts, public.subscriptions from anon, authenticated;
revoke all on public.account_private, public.usage from anon, authenticated;
revoke all on public.accounts, public.subscriptions from anon;

-- ---- keeping rows in step ----

create or replace function public.squarely_touch()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists accounts_touch on public.accounts;
create trigger accounts_touch before update on public.accounts
  for each row execute function public.squarely_touch();
drop trigger if exists subscriptions_touch on public.subscriptions;
create trigger subscriptions_touch before update on public.subscriptions
  for each row execute function public.squarely_touch();

-- Every new sign-up gets an empty account row.
create or replace function public.squarely_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.accounts (user_id, login_email)
  values (new.id, coalesce(lower(new.email), ''))
  on conflict (user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists squarely_on_signup on auth.users;
create trigger squarely_on_signup after insert on auth.users
  for each row execute function public.squarely_new_user();

-- ---- server-only functions ----

-- Save the library unless a newer one is already kept. Returns { updatedAt, stale }.
create or replace function public.squarely_write_library(p_user uuid, p_data jsonb, p_at bigint, p_remind boolean)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  kept bigint;
begin
  insert into public.accounts (user_id) values (p_user) on conflict (user_id) do nothing;
  update public.accounts
     set library = p_data, library_updated_at = p_at, remind_ready = p_remind
   where user_id = p_user and library_updated_at <= p_at;
  if found then
    return jsonb_build_object('updatedAt', p_at, 'stale', false);
  end if;
  select library_updated_at into kept from public.accounts where user_id = p_user;
  return jsonb_build_object('updatedAt', kept, 'stale', true);
end;
$$;

-- One more use of something costly today, if it's under the day's limit. True when allowed.
create or replace function public.squarely_use(p_user uuid, p_name text, p_max integer, p_day date)
returns boolean
language plpgsql
set search_path = ''
as $$
declare
  used integer;
begin
  insert into public.usage as u (user_id, name, day, count)
  values (p_user, p_name, p_day, 1)
  on conflict (user_id, name, day) do update set count = u.count + 1
  where u.count < p_max
  returning count into used;
  return used is not null;
end;
$$;

-- The accounts the daily run emails: a confirmed email, something to send, not yet sent today.
create or replace function public.squarely_due_alerts(p_today date, p_limit integer)
returns setof public.accounts
language sql
stable
set search_path = ''
as $$
  select *
    from public.accounts
   where alert_email_verified
     and alert_email <> ''
     and (jsonb_array_length(alerts) > 0 or remind_ready)
     and (last_sent is null or last_sent < p_today)
   order by last_sent nulls first, user_id
   limit p_limit;
$$;

revoke all on function public.squarely_write_library(uuid, jsonb, bigint, boolean) from public, anon, authenticated;
revoke all on function public.squarely_use(uuid, text, integer, date) from public, anon, authenticated;
revoke all on function public.squarely_due_alerts(date, integer) from public, anon, authenticated;
revoke all on function public.squarely_new_user() from public, anon, authenticated;
grant execute on function public.squarely_write_library(uuid, jsonb, bigint, boolean) to service_role;
grant execute on function public.squarely_use(uuid, text, integer, date) to service_role;
grant execute on function public.squarely_due_alerts(date, integer) to service_role;
grant all on public.accounts, public.subscriptions, public.account_private, public.usage to service_role;
