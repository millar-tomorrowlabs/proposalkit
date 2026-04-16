-- Waitlist + invite-code gated signup + Friends & Family plan
--
-- Adds three things to the schema:
-- 1. Plan metadata on accounts (plan name, seat/send caps, AI model tier)
-- 2. Waitlist + invite-code tables for gated signup
-- 3. ai_usage logging table so we have data when it's time to price tiers
--
-- Safe to re-run. Designed to be applied directly in the Supabase SQL
-- editor if `npx supabase db push` is flaky (it has been for this project).

-- =========================================================================
-- 1. Account plan metadata
-- =========================================================================

alter table public.accounts
  add column if not exists plan text not null default 'friends_family',
  add column if not exists max_team_seats int not null default 3,
  add column if not exists max_monthly_sends int not null default 10,
  add column if not exists ai_model_tier text not null default 'sonnet';

-- Guard against junk values landing here via direct writes.
do $$ begin
  if not exists (
    select 1 from pg_constraint where conname = 'accounts_plan_check'
  ) then
    alter table public.accounts
      add constraint accounts_plan_check
      check (plan in ('friends_family', 'studio', 'agency', 'enterprise'));
  end if;
  if not exists (
    select 1 from pg_constraint where conname = 'accounts_ai_model_tier_check'
  ) then
    alter table public.accounts
      add constraint accounts_ai_model_tier_check
      check (ai_model_tier in ('haiku', 'sonnet', 'opus'));
  end if;
end $$;

-- =========================================================================
-- 2. Waitlist + invite codes
-- =========================================================================

create table if not exists public.waitlist_signups (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  notes text,
  created_at timestamptz not null default now(),
  invited_at timestamptz,
  invite_code_id uuid,
  signup_user_id uuid references auth.users(id) on delete set null
);

-- Unique on lowercased email so "Jane@x.com" and "jane@x.com" don't double-list.
create unique index if not exists waitlist_signups_email_uidx
  on public.waitlist_signups (lower(email));

create table if not exists public.invite_codes (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  email text not null,
  plan text not null default 'friends_family',
  created_by_user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '30 days'),
  used_at timestamptz,
  used_by_user_id uuid references auth.users(id) on delete set null
);

create index if not exists invite_codes_email_idx on public.invite_codes (lower(email));

-- Link waitlist to invite_codes now that both exist.
do $$ begin
  if not exists (
    select 1 from pg_constraint where conname = 'waitlist_invite_code_fk'
  ) then
    alter table public.waitlist_signups
      add constraint waitlist_invite_code_fk
      foreign key (invite_code_id) references public.invite_codes(id) on delete set null;
  end if;
end $$;

-- RLS: waitlist_signups
alter table public.waitlist_signups enable row level security;

drop policy if exists "anon can insert waitlist" on public.waitlist_signups;
create policy "anon can insert waitlist" on public.waitlist_signups
  for insert to anon, authenticated
  with check (true);

-- No SELECT / UPDATE / DELETE for clients. Admin reads through the
-- Supabase dashboard (service role). Edge functions use service role too.
drop policy if exists "service role full access waitlist" on public.waitlist_signups;
create policy "service role full access waitlist" on public.waitlist_signups
  for all to service_role using (true) with check (true);

-- RLS: invite_codes
alter table public.invite_codes enable row level security;

drop policy if exists "service role full access invite_codes" on public.invite_codes;
create policy "service role full access invite_codes" on public.invite_codes
  for all to service_role using (true) with check (true);

-- Clients get zero access; all reads/writes go through edge functions.

-- =========================================================================
-- 3. AI usage log (for future pricing + abuse detection)
-- =========================================================================

create table if not exists public.ai_usage (
  id bigserial primary key,
  account_id uuid references public.accounts(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  proposal_id uuid references public.proposals(id) on delete set null,
  model text not null,
  input_tokens int not null default 0,
  output_tokens int not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists ai_usage_account_day_idx
  on public.ai_usage (account_id, created_at);

alter table public.ai_usage enable row level security;

drop policy if exists "members can read own account usage" on public.ai_usage;
create policy "members can read own account usage" on public.ai_usage
  for select to authenticated
  using (
    account_id in (
      select account_id from public.account_members where user_id = auth.uid()
    )
  );

drop policy if exists "service role full access ai_usage" on public.ai_usage;
create policy "service role full access ai_usage" on public.ai_usage
  for all to service_role using (true) with check (true);

-- =========================================================================
-- 4. Admin helper — issue_invite('email@x.com')
-- =========================================================================
--
-- Admin runs this in the Supabase SQL editor to mint a code for a
-- waitlisted user. Returns the code so you can paste it into a message
-- (or the companion Resend path will send automatically once wired).
--
-- Usage:
--   select issue_invite('jane@acme.co');
--
-- Idempotent on email: if an active (unused, unexpired) code already
-- exists, it's returned unchanged.

create or replace function public.issue_invite(p_email text)
returns table (code text, expires_at timestamptz)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_existing record;
  v_new_code text;
  v_new_id uuid;
  v_new_expires timestamptz;
begin
  -- Reuse any still-valid code first.
  select ic.code, ic.expires_at, ic.id
    into v_existing
    from public.invite_codes ic
    where lower(ic.email) = lower(p_email)
      and ic.used_at is null
      and ic.expires_at > now()
    order by ic.created_at desc
    limit 1;

  if found then
    code := v_existing.code;
    expires_at := v_existing.expires_at;
    return next;
    return;
  end if;

  -- Otherwise generate a fresh one. 12-char base62-ish: readable + enough
  -- entropy for a waitlist gate (not a secret).
  v_new_code := upper(substr(translate(gen_random_uuid()::text, '-', ''), 1, 12));
  v_new_expires := now() + interval '30 days';

  insert into public.invite_codes (code, email, expires_at)
    values (v_new_code, lower(p_email), v_new_expires)
    returning id into v_new_id;

  -- Link the waitlist entry if present, marking it invited.
  update public.waitlist_signups
    set invited_at = now(), invite_code_id = v_new_id
    where lower(email) = lower(p_email);

  code := v_new_code;
  expires_at := v_new_expires;
  return next;
  return;
end;
$$;

-- Only service role + authenticated (for internal use if ever needed) can call.
revoke all on function public.issue_invite(text) from public;
grant execute on function public.issue_invite(text) to service_role;
