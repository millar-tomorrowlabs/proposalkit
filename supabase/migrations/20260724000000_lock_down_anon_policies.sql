-- Lock down anon access. INT-27 and INT-33.
--
-- Before this migration the anon role, whose key ships in the browser bundle on
-- every published proposal page, could:
--   * read, update and delete every row in submissions, across all accounts
--   * read every proposal, including other accounts' drafts
--   * insert and update any proposal
--   * read and write every proposal_context row
--   * read every unaccepted invite token, which is an account takeover vector
--
-- Two pages still need unauthenticated reads: the public proposal page and the
-- invite acceptance page. Each secret already lives in the URL (the proposal
-- slug, the invite token), so each gets a SECURITY DEFINER function that takes
-- that secret and returns only the fields the page renders. The pages keep
-- working, the tables stop being enumerable, and internal columns stop reaching
-- the browser.
--
-- One caveat worth stating plainly. Proposal slugs are derived from the client
-- name, so they are guessable in a way invite tokens are not. This migration
-- ends bulk enumeration and stops internal fields leaking, but a correctly
-- guessed slug still returns that proposal, draft included. Gating the public
-- read on status would close that, and would also break sharing a link before
-- the proposal is formally sent, so it is left alone here and tracked
-- separately. Password protection remains the way to lock a specific proposal.

begin;

-- ---------------------------------------------------------------------------
-- 1. submissions
-- ---------------------------------------------------------------------------
-- allow_all carried no FOR clause, so it granted SELECT, INSERT, UPDATE and
-- DELETE, and no TO clause, so it applied to PUBLIC including anon.
-- Inserts run through the service role client in the submit-proposal edge
-- function, which bypasses RLS, so dropping these breaks nothing legitimate.
-- submissions_select_account remains as the only read path.

drop policy if exists allow_all on public.submissions;
drop policy if exists "Allow anon read submissions" on public.submissions;

-- ---------------------------------------------------------------------------
-- 2. proposals
-- ---------------------------------------------------------------------------

drop policy if exists "Anyone can insert proposals" on public.proposals;
drop policy if exists "Anyone can update proposals" on public.proposals;
drop policy if exists "Public proposals are viewable by everyone" on public.proposals;
drop policy if exists proposals_select_open on public.proposals;

-- The builder and dashboard read a user's own proposals with their session and
-- until now leaned on the open policy above. Without this they would see nothing.
drop policy if exists proposals_select_account on public.proposals;
create policy proposals_select_account on public.proposals
  for select to authenticated
  using (account_id = public.user_account_id(auth.uid()));

-- ---------------------------------------------------------------------------
-- 3. proposal_context
-- ---------------------------------------------------------------------------
-- Replace the blanket policy with the account scoped pattern already used by
-- proposal_messages and proposal_snapshots. proposal_context has no account_id
-- of its own, so it reaches the account through its proposal.

drop policy if exists "Allow all" on public.proposal_context;

drop policy if exists context_select on public.proposal_context;
create policy context_select on public.proposal_context
  for select using (exists (
    select 1
    from public.proposals p
    join public.account_members am on am.account_id = p.account_id
    where p.id = proposal_context.proposal_id and am.user_id = auth.uid()
  ));

drop policy if exists context_insert on public.proposal_context;
create policy context_insert on public.proposal_context
  for insert with check (exists (
    select 1
    from public.proposals p
    join public.account_members am on am.account_id = p.account_id
    where p.id = proposal_context.proposal_id and am.user_id = auth.uid()
  ));

drop policy if exists context_update on public.proposal_context;
create policy context_update on public.proposal_context
  for update using (exists (
    select 1
    from public.proposals p
    join public.account_members am on am.account_id = p.account_id
    where p.id = proposal_context.proposal_id and am.user_id = auth.uid()
  ));

drop policy if exists context_delete on public.proposal_context;
create policy context_delete on public.proposal_context
  for delete using (exists (
    select 1
    from public.proposals p
    join public.account_members am on am.account_id = p.account_id
    where p.id = proposal_context.proposal_id and am.user_id = auth.uid()
  ));

-- ---------------------------------------------------------------------------
-- 4. account_invites
-- ---------------------------------------------------------------------------
-- public_read_invites_by_token was TO anon USING (true), so it exposed every
-- invite in the workspace, token included. Anyone could read a pending token and
-- join an account they were never invited to. The acceptance page now goes
-- through get_invite_by_token below, which requires the token itself.

drop policy if exists public_read_invites_by_token on public.account_invites;

-- ---------------------------------------------------------------------------
-- 5. account_members: joining an account requires an invite. INT-35.
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
-- 6. Public proposal read, by slug only
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
-- 7. Invite read, by token only
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
