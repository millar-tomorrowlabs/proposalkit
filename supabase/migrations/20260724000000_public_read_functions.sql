-- Phase 1 of the anon lockdown. INT-35, plus the read paths INT-27 and INT-33 need.
--
-- Deliberately ADDITIVE, apart from the account_members swap. Nothing here
-- removes access the live frontend depends on, so it is safe to apply to
-- production before the new bundle ships. Phase 2
-- (20260724010000_lock_down_anon_policies.sql) does the removals and must not
-- run until the frontend that uses these functions is live, because the current
-- bundle still reads public.proposals directly.
--
-- Split this way so there is no window in which a client cannot open a
-- proposal. Applying the removals first would break every open tab; shipping
-- the frontend first would call functions that do not exist yet.
--
-- The account_members change is here rather than in phase 2 because it closes a
-- live account takeover (INT-35) and no frontend read path depends on it. The
-- invite acceptance page keeps working: it holds a real invite, which is
-- exactly what the new policy requires.

begin;

-- ---------------------------------------------------------------------------
-- 1. account_members: joining an account requires an invite. INT-35.
-- ---------------------------------------------------------------------------
-- self_join_account was FOR INSERT TO authenticated WITH CHECK (user_id =
-- auth.uid()). It checked only that you were adding yourself, never that you
-- had been invited, so any signed up user could insert themselves into any
-- account_id as owner and take it over. Verified end to end on staging: the
-- insert returns 201 and the caller can then read that account's proposals and
-- submissions, update the account, and remove the real owner.
--
-- Onboarding does not need this policy. The accept-invite edge function
-- provisions brand new accounts with the service role, which bypasses RLS.
-- The only client side caller is InviteAcceptPage, which is exactly the case
-- that should have to prove an invite.

-- The check has to run SECURITY DEFINER. A policy's subqueries are themselves
-- subject to RLS, and account_invites is now readable only by existing members
-- (members_view_invites), so an invitee cannot see the very invite that would
-- let them join. Same pattern as user_account_id above.
create or replace function public.has_valid_invite(p_account_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.account_invites i
    where i.account_id = p_account_id
      and lower(i.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
      and i.accepted_at is null
      and i.expires_at > now()
  );
$$;

revoke all on function public.has_valid_invite(uuid) from public;
grant execute on function public.has_valid_invite(uuid) to authenticated;

drop policy if exists self_join_account on public.account_members;
drop policy if exists join_account_with_invite on public.account_members;

create policy join_account_with_invite on public.account_members
  for insert to authenticated
  with check (
    user_id = auth.uid()
    and public.has_valid_invite(account_id)
  );

-- ---------------------------------------------------------------------------
-- 2. Public proposal read, by slug only
-- ---------------------------------------------------------------------------
-- Deliberately omits password_hash, brief, chat_messages, user_id, account_id
-- and cta_email. The first three are internal and were previously served to the
-- client's browser. has_password tells the viewer whether to show the gate
-- without handing over the hash to brute force offline.
--
-- Omitting the columns is not enough on its own. proposals.data is a
-- denormalised snapshot written by the builder (BuilderHome spreads the whole
-- store into it), so it carries its own copies of ctaEmail, brief,
-- contextBlobs, password_hash, user_id and account_id, plus a nested legacy
-- 'data' object holding all of it again. Returning p.data whole would hand back
-- everything the column list just withheld.
--
-- So data is rebuilt from an allow list of the keys the public page renders.
-- An allow list rather than a blocklist, so a new internal field added to the
-- builder store later cannot leak by default. heroImageQuery is excluded on
-- purpose: it is internal prompt input and is never rendered.

create or replace function public.get_public_proposal(p_slug text)
returns table (
  id uuid,
  slug text,
  title text,
  client_name text,
  brand_color_1 text,
  brand_color_2 text,
  hero_image_url text,
  sections text[],
  data jsonb,
  status text,
  has_password boolean
)
language sql
stable
security definer
set search_path = public
as $$
  select
    p.id,
    p.slug,
    p.title,
    p.client_name,
    p.brand_color_1,
    p.brand_color_2,
    p.hero_image_url,
    p.sections,
    (
      select coalesce(jsonb_object_agg(entry.key, entry.value), '{}'::jsonb)
      from jsonb_each(p.data) as entry
      where entry.key in (
        'title', 'clientName', 'tagline', 'heroDescription',
        'brandColor1', 'brandColor2', 'heroImageUrl',
        'clientLogoUrl', 'heroLogoLarge',
        'studioName', 'studioLogoUrl',
        'currency', 'recommendation', 'sections', 'status',
        'summary', 'scope', 'timeline', 'investment', 'cta'
      )
    ) as data,
    p.status,
    (p.password_hash is not null) as has_password
  from public.proposals p
  where p.slug = p_slug
    and p.deleted_at is null
  limit 1;
$$;

revoke all on function public.get_public_proposal(text) from public;
grant execute on function public.get_public_proposal(text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 3. Invite read, by token only
-- ---------------------------------------------------------------------------
-- Returns nothing for an already accepted invite, so a used link cannot be
-- replayed. Expired invites are still returned, with their expires_at, so the
-- page can say "this invite has expired" rather than "invalid". Whoever holds
-- the token is the intended recipient, so that distinction costs nothing.
-- The token is never returned, only proven.

create or replace function public.get_invite_by_token(p_token text)
returns table (
  id uuid,
  email text,
  role text,
  account_id uuid,
  studio_name text,
  expires_at timestamp with time zone
)
language sql
stable
security definer
set search_path = public
as $$
  select
    i.id,
    i.email,
    i.role,
    i.account_id,
    a.studio_name,
    i.expires_at
  from public.account_invites i
  join public.accounts a on a.id = i.account_id
  where i.token = p_token
    and i.accepted_at is null
  limit 1;
$$;

revoke all on function public.get_invite_by_token(text) from public;
grant execute on function public.get_invite_by_token(text) to anon, authenticated;
commit;
