-- Phase 2 of the anon lockdown. INT-27 and INT-33.
--
-- DO NOT APPLY until the frontend from PR #5 is live. This drops the open read
-- on public.proposals, and the current bundle reads that table directly. Phase 1
-- (20260724000000_public_read_functions.sql) adds the replacement functions and
-- is safe to apply at any time.
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
commit;
