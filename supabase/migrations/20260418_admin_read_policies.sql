-- Admin console: RLS read access for admins
--
-- The 20260418_admin.sql migration added proposl_admins but didn't
-- grant the admin UI read access to the underlying tables. Without
-- this, the admin dashboard sees empty tables because RLS blocks
-- reads for anyone who isn't a member/owner of the specific account.
--
-- Writes still flow through edge functions (service role); these
-- policies only add SELECT access for admins.
--
-- Safe to re-run.

-- Helper: is the caller a Proposl admin?
--
-- SECURITY DEFINER so the policy can read proposl_admins without
-- hitting its own RLS recursion. STABLE so the planner can cache it
-- within a query.
create or replace function public.is_current_user_admin() returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.proposl_admins
    where lower(email) = lower(auth.jwt() ->> 'email')
  );
$$;

grant execute on function public.is_current_user_admin() to authenticated;

-- waitlist_signups — admins can read every row
drop policy if exists "admins read waitlist" on public.waitlist_signups;
create policy "admins read waitlist" on public.waitlist_signups
  for select to authenticated
  using (public.is_current_user_admin());

-- invite_codes — admins can read every row (UI filters client-side
-- by status, search term, etc.)
drop policy if exists "admins read invites" on public.invite_codes;
create policy "admins read invites" on public.invite_codes
  for select to authenticated
  using (public.is_current_user_admin());

-- accounts — admins can read every account for /admin/accounts
drop policy if exists "admins read accounts" on public.accounts;
create policy "admins read accounts" on public.accounts
  for select to authenticated
  using (public.is_current_user_admin());

-- account_members — admins need to aggregate member counts per account
drop policy if exists "admins read account_members" on public.account_members;
create policy "admins read account_members" on public.account_members
  for select to authenticated
  using (public.is_current_user_admin());

-- proposal_sends — admins need to count sends per account this month
drop policy if exists "admins read proposal_sends" on public.proposal_sends;
create policy "admins read proposal_sends" on public.proposal_sends
  for select to authenticated
  using (public.is_current_user_admin());
