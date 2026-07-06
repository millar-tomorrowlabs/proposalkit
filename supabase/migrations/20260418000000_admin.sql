-- Admin console: proposl_admins table + invite_codes revocation/notes
--
-- Enables the in-app admin view (/admin/*) so you don't need to run SQL
-- every time you want to issue an invite, eyeball the waitlist, or bump
-- an account's plan.
--
-- Safe to re-run.

-- =========================================================================
-- 1. proposl_admins — who can access /admin
-- =========================================================================
--
-- Email-keyed (not user_id) so admins can be pre-added before they sign
-- up. Lowercased on insert/compare so case doesn't matter. Single-source
-- of truth: if your email is here, you're admin.

create table if not exists public.proposl_admins (
  email text primary key,
  added_at timestamptz default now() not null,
  notes text
);

alter table public.proposl_admins enable row level security;

-- Admins can read their OWN admin row (so the client can check "am I an
-- admin"). Non-admins see nothing. Writes go through the service role
-- only; there's no insert/update/delete policy for authenticated users
-- on purpose — admins are added manually (via this migration or SQL).
drop policy if exists "admins read own admin row" on public.proposl_admins;
create policy "admins read own admin row" on public.proposl_admins
  for select
  to authenticated
  using (lower(email) = lower(auth.jwt() ->> 'email'));

-- =========================================================================
-- 2. invite_codes: revoked_at + notes
-- =========================================================================
--
-- revoked_at  — lets admins invalidate an unused code (or audit-mark a
--               used one). Unused + revoked = can't be redeemed.
-- notes       — optional internal memo ("met at demo day", "beta tester
--               cohort 2"). Never shown to the invitee.

alter table public.invite_codes
  add column if not exists revoked_at timestamptz;

alter table public.invite_codes
  add column if not exists notes text;

-- Also surface revoked codes in accept-invite rejection logic. We check
-- revoked_at at the edge-function layer (see accept-invite/index.ts);
-- the column is defined here so both functions and admin UI share it.

-- =========================================================================
-- 3. Extend issue_invite to accept a plan argument
-- =========================================================================
--
-- The old signature was issue_invite(p_email text). We add a new two-arg
-- overload that lets an admin specify the plan (friends_family / studio /
-- agency / enterprise). The one-arg version stays for backward-compat.

create or replace function public.issue_invite(p_email text, p_plan text)
returns table(code text, expires_at timestamp with time zone)
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_existing record;
  v_new_code text;
  v_new_id uuid;
  v_new_expires timestamptz;
begin
  -- Reuse a still-valid non-revoked code for the same email+plan.
  select ic.code, ic.expires_at, ic.id
    into v_existing
    from public.invite_codes ic
    where lower(ic.email) = lower(p_email)
      and ic.plan = p_plan
      and ic.used_at is null
      and ic.revoked_at is null
      and ic.expires_at > now()
    order by ic.created_at desc
    limit 1;

  if found then
    code := v_existing.code;
    expires_at := v_existing.expires_at;
    return next;
    return;
  end if;

  v_new_code := upper(substr(translate(gen_random_uuid()::text, '-', ''), 1, 12));
  v_new_expires := now() + interval '30 days';

  insert into public.invite_codes (code, email, plan, expires_at)
    values (v_new_code, lower(p_email), p_plan, v_new_expires)
    returning id into v_new_id;

  update public.waitlist_signups
    set invited_at = now(), invite_code_id = v_new_id
    where lower(email) = lower(p_email);

  code := v_new_code;
  expires_at := v_new_expires;
  return next;
  return;
end;
$$;

grant execute on function public.issue_invite(text, text) to service_role;

-- =========================================================================
-- 4. Seed the first admin
-- =========================================================================
--
-- Only runs if no admins exist yet, so this line is safe to re-apply.
-- Replace the email below with your own if you're bootstrapping a new
-- environment (staging, fresh DB, etc.).

insert into public.proposl_admins (email, notes)
  select 'millar.smith22@gmail.com', 'Initial admin (baseline seed)'
  where not exists (select 1 from public.proposl_admins);
