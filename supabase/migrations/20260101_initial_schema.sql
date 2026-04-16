-- =========================================================================
-- Initial schema baseline for Proposl (public schema only).
--
-- Generated 2026-04-17 via:
--   pg_dump --schema=public --schema-only --no-owner --no-privileges \
--     "$DATABASE_URL" > 20260101_initial_schema.sql
--
-- This is the source-of-truth recreation of the production database
-- schema as it existed the day we started version-controlling it. Prior
-- changes were applied via the Supabase dashboard and are not recoverable
-- as individual migrations — this file captures the end state.
--
-- Dated 20260101 so it sorts *before* all future migrations. Apply this
-- first when bootstrapping a new environment (e.g. staging), then run
-- subsequent migrations in order.
--
-- Does NOT include:
--   - Supabase-managed schemas (auth, storage, realtime, etc.)
--   - Extensions outside the public schema (pg_cron lives in `extensions`;
--     see 20260417_purge_deleted_proposals_cron.sql)
--   - Row data (schema only)
--
-- Safe to re-run: schema and function creation have been made idempotent
-- (IF NOT EXISTS / OR REPLACE) so this can be applied on top of an
-- existing database without error.
-- =========================================================================

--
-- PostgreSQL database dump
--

\restrict nBguVJhStBnIS7p9lvXtSijBtsYvJnfp9kSMGFMP0f1lLu4kVIRBUmedwc9hgff

-- Dumped from database version 17.6
-- Dumped by pg_dump version 18.3

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA IF NOT EXISTS public;


--
-- Name: SCHEMA public; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON SCHEMA public IS 'standard public schema';


--
-- Name: issue_invite(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE OR REPLACE FUNCTION public.issue_invite(p_email text) RETURNS TABLE(code text, expires_at timestamp with time zone)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
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


--
-- Name: record_proposal_send_click(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE OR REPLACE FUNCTION public.record_proposal_send_click(p_resend_id text) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
  UPDATE proposal_sends
  SET
    click_count = click_count + 1,
    last_clicked_at = NOW(),
    clicked_at = COALESCE(clicked_at, NOW())
  WHERE resend_id = p_resend_id;
END;
$$;


--
-- Name: record_proposal_send_open(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE OR REPLACE FUNCTION public.record_proposal_send_open(p_resend_id text) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
  v_proposal_id UUID;
BEGIN
  UPDATE proposal_sends
  SET
    open_count = open_count + 1,
    last_opened_at = NOW(),
    opened_at = COALESCE(opened_at, NOW())
  WHERE resend_id = p_resend_id
  RETURNING proposal_id INTO v_proposal_id;

  IF v_proposal_id IS NOT NULL THEN
    UPDATE proposals
    SET status = 'viewed'
    WHERE id = v_proposal_id
      AND (status IS NULL OR status IN ('draft', 'sent'));
  END IF;
END;
$$;


--
-- Name: rls_auto_enable(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE OR REPLACE FUNCTION public.rls_auto_enable() RETURNS event_trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'pg_catalog'
    AS $$
DECLARE
  cmd record;
BEGIN
  FOR cmd IN
    SELECT *
    FROM pg_event_trigger_ddl_commands()
    WHERE command_tag IN ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
      AND object_type IN ('table','partitioned table')
  LOOP
     IF cmd.schema_name IS NOT NULL AND cmd.schema_name IN ('public') AND cmd.schema_name NOT IN ('pg_catalog','information_schema') AND cmd.schema_name NOT LIKE 'pg_toast%' AND cmd.schema_name NOT LIKE 'pg_temp%' THEN
      BEGIN
        EXECUTE format('alter table if exists %s enable row level security', cmd.object_identity);
        RAISE LOG 'rls_auto_enable: enabled RLS on %', cmd.object_identity;
      EXCEPTION
        WHEN OTHERS THEN
          RAISE LOG 'rls_auto_enable: failed to enable RLS on %', cmd.object_identity;
      END;
     ELSE
        RAISE LOG 'rls_auto_enable: skip % (either system schema or not in enforced list: %.)', cmd.object_identity, cmd.schema_name;
     END IF;
  END LOOP;
END;
$$;


--
-- Name: update_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE OR REPLACE FUNCTION public.update_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
  begin
    new.updated_at = now();
    return new;
  end;
  $$;


--
-- Name: user_account_id(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE OR REPLACE FUNCTION public.user_account_id(uid uuid) RETURNS uuid
    LANGUAGE sql STABLE SECURITY DEFINER
    AS $$
  SELECT account_id FROM account_members WHERE user_id = uid LIMIT 1;
$$;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: account_invites; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.account_invites (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    account_id uuid NOT NULL,
    email text NOT NULL,
    role text DEFAULT 'member'::text NOT NULL,
    invited_by uuid,
    token text DEFAULT encode(extensions.gen_random_bytes(32), 'hex'::text) NOT NULL,
    expires_at timestamp with time zone DEFAULT (now() + '7 days'::interval) NOT NULL,
    accepted_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT account_invites_role_check CHECK ((role = ANY (ARRAY['owner'::text, 'member'::text])))
);


--
-- Name: account_members; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.account_members (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    account_id uuid NOT NULL,
    user_id uuid NOT NULL,
    role text DEFAULT 'member'::text NOT NULL,
    display_name text,
    joined_at timestamp with time zone DEFAULT now(),
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT account_members_role_check CHECK ((role = ANY (ARRAY['owner'::text, 'member'::text])))
);


--
-- Name: accounts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.accounts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    studio_name text NOT NULL,
    legal_entity text,
    website text,
    logo_url text,
    notify_email text NOT NULL,
    cc_email text,
    sender_name text,
    default_cta_email text,
    default_brand_color_1 text DEFAULT '#000000'::text,
    default_brand_color_2 text DEFAULT '#6b7280'::text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    default_studio_tagline text,
    default_studio_description text,
    default_studio_description_2 text,
    voice_description text,
    voice_examples text,
    banned_phrases text,
    default_hourly_rate numeric,
    default_currency text,
    ai_tailor_agency_bio boolean DEFAULT true NOT NULL,
    plan text DEFAULT 'friends_family'::text NOT NULL,
    max_team_seats integer DEFAULT 3 NOT NULL,
    max_monthly_sends integer DEFAULT 10 NOT NULL,
    ai_model_tier text DEFAULT 'sonnet'::text NOT NULL,
    CONSTRAINT accounts_ai_model_tier_check CHECK ((ai_model_tier = ANY (ARRAY['haiku'::text, 'sonnet'::text, 'opus'::text]))),
    CONSTRAINT accounts_plan_check CHECK ((plan = ANY (ARRAY['friends_family'::text, 'studio'::text, 'agency'::text, 'enterprise'::text])))
);


--
-- Name: ai_usage; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ai_usage (
    id bigint NOT NULL,
    account_id uuid,
    user_id uuid,
    proposal_id uuid,
    model text NOT NULL,
    input_tokens integer DEFAULT 0 NOT NULL,
    output_tokens integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: ai_usage_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.ai_usage_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: ai_usage_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.ai_usage_id_seq OWNED BY public.ai_usage.id;


--
-- Name: invite_codes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.invite_codes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    code text NOT NULL,
    email text NOT NULL,
    plan text DEFAULT 'friends_family'::text NOT NULL,
    created_by_user_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    expires_at timestamp with time zone DEFAULT (now() + '30 days'::interval) NOT NULL,
    used_at timestamp with time zone,
    used_by_user_id uuid
);


--
-- Name: proposal_context; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.proposal_context (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    proposal_id uuid NOT NULL,
    label text NOT NULL,
    content text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    name text NOT NULL,
    url text,
    file_size integer,
    extracted_text text NOT NULL,
    source_type text NOT NULL,
    CONSTRAINT proposal_context_source_type_check CHECK ((source_type = ANY (ARRAY['file'::text, 'url'::text, 'paste'::text])))
);


--
-- Name: proposal_messages; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.proposal_messages (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    proposal_id uuid NOT NULL,
    role text NOT NULL,
    content text NOT NULL,
    section_context text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT proposal_messages_role_check CHECK ((role = ANY (ARRAY['user'::text, 'assistant'::text])))
);


--
-- Name: proposal_sends; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.proposal_sends (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    proposal_id uuid NOT NULL,
    account_id uuid NOT NULL,
    recipient_email text NOT NULL,
    recipient_name text NOT NULL,
    subject text,
    personal_message text,
    send_type text DEFAULT 'initial'::text NOT NULL,
    sent_by uuid NOT NULL,
    sent_at timestamp with time zone DEFAULT now() NOT NULL,
    resend_id text,
    delivery_status text DEFAULT 'queued'::text,
    delivered_at timestamp with time zone,
    bounced_at timestamp with time zone,
    last_event_at timestamp with time zone,
    last_event_raw jsonb,
    opened_at timestamp with time zone,
    last_opened_at timestamp with time zone,
    open_count integer DEFAULT 0 NOT NULL,
    clicked_at timestamp with time zone,
    last_clicked_at timestamp with time zone,
    click_count integer DEFAULT 0 NOT NULL,
    CONSTRAINT proposal_sends_send_type_check CHECK ((send_type = ANY (ARRAY['initial'::text, 'reminder'::text])))
);


--
-- Name: proposal_snapshots; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.proposal_snapshots (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    proposal_id uuid NOT NULL,
    data jsonb NOT NULL,
    trigger text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: proposals; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.proposals (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    slug text NOT NULL,
    title text NOT NULL,
    client_name text NOT NULL,
    brand_color_1 text DEFAULT '#000000'::text NOT NULL,
    brand_color_2 text DEFAULT '#000000'::text NOT NULL,
    hero_image_url text,
    cta_email text NOT NULL,
    sections text[] DEFAULT '{summary,scope,timeline,investment,cta}'::text[] NOT NULL,
    password_hash text,
    data jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    brief text,
    chat_messages jsonb DEFAULT '[]'::jsonb,
    status text DEFAULT 'draft'::text NOT NULL,
    user_id uuid NOT NULL,
    account_id uuid NOT NULL,
    deleted_at timestamp with time zone
);


--
-- Name: submissions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.submissions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    proposal_id uuid,
    proposal_slug text NOT NULL,
    client_name text NOT NULL,
    client_email text NOT NULL,
    package_id text,
    package_label text,
    package_price numeric,
    add_ons jsonb DEFAULT '[]'::jsonb NOT NULL,
    retainer_hours integer,
    retainer_rate numeric,
    total_price numeric,
    message text,
    created_at timestamp with time zone DEFAULT now(),
    currency text DEFAULT 'USD'::text,
    email_sent boolean DEFAULT false,
    user_id uuid NOT NULL,
    account_id uuid
);


--
-- Name: waitlist_signups; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.waitlist_signups (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    email text NOT NULL,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    invited_at timestamp with time zone,
    invite_code_id uuid,
    signup_user_id uuid
);


--
-- Name: ai_usage id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_usage ALTER COLUMN id SET DEFAULT nextval('public.ai_usage_id_seq'::regclass);


--
-- Name: account_invites account_invites_account_id_email_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.account_invites
    ADD CONSTRAINT account_invites_account_id_email_key UNIQUE (account_id, email);


--
-- Name: account_invites account_invites_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.account_invites
    ADD CONSTRAINT account_invites_pkey PRIMARY KEY (id);


--
-- Name: account_invites account_invites_token_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.account_invites
    ADD CONSTRAINT account_invites_token_key UNIQUE (token);


--
-- Name: account_members account_members_account_id_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.account_members
    ADD CONSTRAINT account_members_account_id_user_id_key UNIQUE (account_id, user_id);


--
-- Name: account_members account_members_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.account_members
    ADD CONSTRAINT account_members_pkey PRIMARY KEY (id);


--
-- Name: accounts accounts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.accounts
    ADD CONSTRAINT accounts_pkey PRIMARY KEY (id);


--
-- Name: ai_usage ai_usage_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_usage
    ADD CONSTRAINT ai_usage_pkey PRIMARY KEY (id);


--
-- Name: invite_codes invite_codes_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invite_codes
    ADD CONSTRAINT invite_codes_code_key UNIQUE (code);


--
-- Name: invite_codes invite_codes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invite_codes
    ADD CONSTRAINT invite_codes_pkey PRIMARY KEY (id);


--
-- Name: proposal_context proposal_context_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.proposal_context
    ADD CONSTRAINT proposal_context_pkey PRIMARY KEY (id);


--
-- Name: proposal_messages proposal_messages_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.proposal_messages
    ADD CONSTRAINT proposal_messages_pkey PRIMARY KEY (id);


--
-- Name: proposal_sends proposal_sends_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.proposal_sends
    ADD CONSTRAINT proposal_sends_pkey PRIMARY KEY (id);


--
-- Name: proposal_snapshots proposal_snapshots_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.proposal_snapshots
    ADD CONSTRAINT proposal_snapshots_pkey PRIMARY KEY (id);


--
-- Name: proposals proposals_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.proposals
    ADD CONSTRAINT proposals_pkey PRIMARY KEY (id);


--
-- Name: proposals proposals_slug_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.proposals
    ADD CONSTRAINT proposals_slug_key UNIQUE (slug);


--
-- Name: submissions submissions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.submissions
    ADD CONSTRAINT submissions_pkey PRIMARY KEY (id);


--
-- Name: waitlist_signups waitlist_signups_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.waitlist_signups
    ADD CONSTRAINT waitlist_signups_pkey PRIMARY KEY (id);


--
-- Name: ai_usage_account_day_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ai_usage_account_day_idx ON public.ai_usage USING btree (account_id, created_at);


--
-- Name: idx_proposal_messages_proposal; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_proposal_messages_proposal ON public.proposal_messages USING btree (proposal_id);


--
-- Name: idx_proposal_sends_proposal; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_proposal_sends_proposal ON public.proposal_sends USING btree (proposal_id);


--
-- Name: idx_proposal_sends_resend_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_proposal_sends_resend_id ON public.proposal_sends USING btree (resend_id) WHERE (resend_id IS NOT NULL);


--
-- Name: idx_proposal_snapshots_proposal; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_proposal_snapshots_proposal ON public.proposal_snapshots USING btree (proposal_id);


--
-- Name: idx_proposals_deleted_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_proposals_deleted_at ON public.proposals USING btree (deleted_at) WHERE (deleted_at IS NOT NULL);


--
-- Name: idx_proposals_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_proposals_user_id ON public.proposals USING btree (user_id);


--
-- Name: invite_codes_email_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX invite_codes_email_idx ON public.invite_codes USING btree (lower(email));


--
-- Name: waitlist_signups_email_uidx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX waitlist_signups_email_uidx ON public.waitlist_signups USING btree (lower(email));


--
-- Name: proposals proposals_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER proposals_updated_at BEFORE UPDATE ON public.proposals FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


--
-- Name: account_invites account_invites_account_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.account_invites
    ADD CONSTRAINT account_invites_account_id_fkey FOREIGN KEY (account_id) REFERENCES public.accounts(id) ON DELETE CASCADE;


--
-- Name: account_invites account_invites_invited_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.account_invites
    ADD CONSTRAINT account_invites_invited_by_fkey FOREIGN KEY (invited_by) REFERENCES auth.users(id);


--
-- Name: account_members account_members_account_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.account_members
    ADD CONSTRAINT account_members_account_id_fkey FOREIGN KEY (account_id) REFERENCES public.accounts(id) ON DELETE CASCADE;


--
-- Name: account_members account_members_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.account_members
    ADD CONSTRAINT account_members_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: ai_usage ai_usage_account_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_usage
    ADD CONSTRAINT ai_usage_account_id_fkey FOREIGN KEY (account_id) REFERENCES public.accounts(id) ON DELETE CASCADE;


--
-- Name: ai_usage ai_usage_proposal_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_usage
    ADD CONSTRAINT ai_usage_proposal_id_fkey FOREIGN KEY (proposal_id) REFERENCES public.proposals(id) ON DELETE CASCADE;


--
-- Name: ai_usage ai_usage_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_usage
    ADD CONSTRAINT ai_usage_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: invite_codes invite_codes_created_by_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invite_codes
    ADD CONSTRAINT invite_codes_created_by_user_id_fkey FOREIGN KEY (created_by_user_id) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: invite_codes invite_codes_used_by_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invite_codes
    ADD CONSTRAINT invite_codes_used_by_user_id_fkey FOREIGN KEY (used_by_user_id) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: proposal_context proposal_context_proposal_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.proposal_context
    ADD CONSTRAINT proposal_context_proposal_id_fkey FOREIGN KEY (proposal_id) REFERENCES public.proposals(id) ON DELETE CASCADE;


--
-- Name: proposal_messages proposal_messages_proposal_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.proposal_messages
    ADD CONSTRAINT proposal_messages_proposal_id_fkey FOREIGN KEY (proposal_id) REFERENCES public.proposals(id) ON DELETE CASCADE;


--
-- Name: proposal_sends proposal_sends_account_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.proposal_sends
    ADD CONSTRAINT proposal_sends_account_id_fkey FOREIGN KEY (account_id) REFERENCES public.accounts(id) ON DELETE CASCADE;


--
-- Name: proposal_sends proposal_sends_proposal_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.proposal_sends
    ADD CONSTRAINT proposal_sends_proposal_id_fkey FOREIGN KEY (proposal_id) REFERENCES public.proposals(id) ON DELETE CASCADE;


--
-- Name: proposal_sends proposal_sends_sent_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.proposal_sends
    ADD CONSTRAINT proposal_sends_sent_by_fkey FOREIGN KEY (sent_by) REFERENCES auth.users(id);


--
-- Name: proposal_snapshots proposal_snapshots_proposal_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.proposal_snapshots
    ADD CONSTRAINT proposal_snapshots_proposal_id_fkey FOREIGN KEY (proposal_id) REFERENCES public.proposals(id) ON DELETE CASCADE;


--
-- Name: proposals proposals_account_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.proposals
    ADD CONSTRAINT proposals_account_id_fkey FOREIGN KEY (account_id) REFERENCES public.accounts(id) ON DELETE CASCADE;


--
-- Name: proposals proposals_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.proposals
    ADD CONSTRAINT proposals_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id);


--
-- Name: submissions submissions_account_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.submissions
    ADD CONSTRAINT submissions_account_id_fkey FOREIGN KEY (account_id) REFERENCES public.accounts(id) ON DELETE CASCADE;


--
-- Name: submissions submissions_proposal_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.submissions
    ADD CONSTRAINT submissions_proposal_id_fkey FOREIGN KEY (proposal_id) REFERENCES public.proposals(id) ON DELETE CASCADE;


--
-- Name: submissions submissions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.submissions
    ADD CONSTRAINT submissions_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id);


--
-- Name: waitlist_signups waitlist_invite_code_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.waitlist_signups
    ADD CONSTRAINT waitlist_invite_code_fk FOREIGN KEY (invite_code_id) REFERENCES public.invite_codes(id) ON DELETE SET NULL;


--
-- Name: waitlist_signups waitlist_signups_signup_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.waitlist_signups
    ADD CONSTRAINT waitlist_signups_signup_user_id_fkey FOREIGN KEY (signup_user_id) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: proposal_context Allow all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow all" ON public.proposal_context USING (true) WITH CHECK (true);


--
-- Name: submissions Allow anon read submissions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow anon read submissions" ON public.submissions FOR SELECT USING (true);


--
-- Name: proposals Anyone can insert proposals; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anyone can insert proposals" ON public.proposals FOR INSERT WITH CHECK (true);


--
-- Name: proposals Anyone can update proposals; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anyone can update proposals" ON public.proposals FOR UPDATE USING (true);


--
-- Name: proposals Public proposals are viewable by everyone; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Public proposals are viewable by everyone" ON public.proposals FOR SELECT USING (true);


--
-- Name: account_invites; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.account_invites ENABLE ROW LEVEL SECURITY;

--
-- Name: account_members; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.account_members ENABLE ROW LEVEL SECURITY;

--
-- Name: accounts; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.accounts ENABLE ROW LEVEL SECURITY;

--
-- Name: ai_usage; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.ai_usage ENABLE ROW LEVEL SECURITY;

--
-- Name: submissions allow_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY allow_all ON public.submissions USING (true) WITH CHECK (true);


--
-- Name: waitlist_signups anon can insert waitlist; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "anon can insert waitlist" ON public.waitlist_signups FOR INSERT TO authenticated, anon WITH CHECK (true);


--
-- Name: accounts authenticated_create_account; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY authenticated_create_account ON public.accounts FOR INSERT TO authenticated WITH CHECK (true);


--
-- Name: invite_codes; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.invite_codes ENABLE ROW LEVEL SECURITY;

--
-- Name: ai_usage members can read own account usage; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "members can read own account usage" ON public.ai_usage FOR SELECT TO authenticated USING ((account_id IN ( SELECT account_members.account_id
   FROM public.account_members
  WHERE (account_members.user_id = auth.uid()))));


--
-- Name: account_members members_leave_account; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY members_leave_account ON public.account_members FOR DELETE TO authenticated USING ((user_id = auth.uid()));


--
-- Name: proposal_sends members_read_sends; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY members_read_sends ON public.proposal_sends FOR SELECT TO authenticated USING ((account_id IN ( SELECT account_members.account_id
   FROM public.account_members
  WHERE (account_members.user_id = auth.uid()))));


--
-- Name: accounts members_view_account; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY members_view_account ON public.accounts FOR SELECT TO authenticated USING ((id = public.user_account_id(auth.uid())));


--
-- Name: account_invites members_view_invites; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY members_view_invites ON public.account_invites FOR SELECT TO authenticated USING ((account_id = public.user_account_id(auth.uid())));


--
-- Name: account_members members_view_teammates; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY members_view_teammates ON public.account_members FOR SELECT TO authenticated USING ((account_id = public.user_account_id(auth.uid())));


--
-- Name: proposal_messages messages_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY messages_insert ON public.proposal_messages FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM (public.proposals p
     JOIN public.account_members am ON ((am.account_id = p.account_id)))
  WHERE ((p.id = proposal_messages.proposal_id) AND (am.user_id = auth.uid())))));


--
-- Name: proposal_messages messages_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY messages_select ON public.proposal_messages FOR SELECT USING ((EXISTS ( SELECT 1
   FROM (public.proposals p
     JOIN public.account_members am ON ((am.account_id = p.account_id)))
  WHERE ((p.id = proposal_messages.proposal_id) AND (am.user_id = auth.uid())))));


--
-- Name: account_invites owners_create_invites; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY owners_create_invites ON public.account_invites FOR INSERT TO authenticated WITH CHECK ((account_id IN ( SELECT account_members.account_id
   FROM public.account_members
  WHERE ((account_members.user_id = auth.uid()) AND (account_members.role = 'owner'::text)))));


--
-- Name: accounts owners_delete_account; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY owners_delete_account ON public.accounts FOR DELETE TO authenticated USING ((id IN ( SELECT account_members.account_id
   FROM public.account_members
  WHERE ((account_members.user_id = auth.uid()) AND (account_members.role = 'owner'::text)))));


--
-- Name: account_invites owners_delete_invites; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY owners_delete_invites ON public.account_invites FOR DELETE TO authenticated USING ((account_id IN ( SELECT account_members.account_id
   FROM public.account_members
  WHERE ((account_members.user_id = auth.uid()) AND (account_members.role = 'owner'::text)))));


--
-- Name: account_members owners_manage_members; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY owners_manage_members ON public.account_members FOR INSERT TO authenticated WITH CHECK ((account_id IN ( SELECT account_members_1.account_id
   FROM public.account_members account_members_1
  WHERE ((account_members_1.user_id = auth.uid()) AND (account_members_1.role = 'owner'::text)))));


--
-- Name: account_members owners_remove_members; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY owners_remove_members ON public.account_members FOR DELETE TO authenticated USING ((account_id IN ( SELECT account_members_1.account_id
   FROM public.account_members account_members_1
  WHERE ((account_members_1.user_id = auth.uid()) AND (account_members_1.role = 'owner'::text)))));


--
-- Name: accounts owners_update_account; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY owners_update_account ON public.accounts FOR UPDATE TO authenticated USING ((id IN ( SELECT account_members.account_id
   FROM public.account_members
  WHERE ((account_members.user_id = auth.uid()) AND (account_members.role = 'owner'::text)))));


--
-- Name: proposal_context; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.proposal_context ENABLE ROW LEVEL SECURITY;

--
-- Name: proposal_messages; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.proposal_messages ENABLE ROW LEVEL SECURITY;

--
-- Name: proposal_sends; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.proposal_sends ENABLE ROW LEVEL SECURITY;

--
-- Name: proposal_snapshots; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.proposal_snapshots ENABLE ROW LEVEL SECURITY;

--
-- Name: proposals; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.proposals ENABLE ROW LEVEL SECURITY;

--
-- Name: proposals proposals_delete_account; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY proposals_delete_account ON public.proposals FOR DELETE TO authenticated USING ((account_id = public.user_account_id(auth.uid())));


--
-- Name: proposals proposals_insert_account; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY proposals_insert_account ON public.proposals FOR INSERT TO authenticated WITH CHECK ((account_id = public.user_account_id(auth.uid())));


--
-- Name: proposals proposals_select_open; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY proposals_select_open ON public.proposals FOR SELECT USING (true);


--
-- Name: proposals proposals_update_account; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY proposals_update_account ON public.proposals FOR UPDATE TO authenticated USING ((account_id = public.user_account_id(auth.uid())));


--
-- Name: account_invites public_read_invites_by_token; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY public_read_invites_by_token ON public.account_invites FOR SELECT TO anon USING (true);


--
-- Name: account_members self_join_account; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY self_join_account ON public.account_members FOR INSERT TO authenticated WITH CHECK ((user_id = auth.uid()));


--
-- Name: ai_usage service role full access ai_usage; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "service role full access ai_usage" ON public.ai_usage TO service_role USING (true) WITH CHECK (true);


--
-- Name: invite_codes service role full access invite_codes; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "service role full access invite_codes" ON public.invite_codes TO service_role USING (true) WITH CHECK (true);


--
-- Name: waitlist_signups service role full access waitlist; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "service role full access waitlist" ON public.waitlist_signups TO service_role USING (true) WITH CHECK (true);


--
-- Name: proposal_snapshots snapshots_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY snapshots_delete ON public.proposal_snapshots FOR DELETE USING ((EXISTS ( SELECT 1
   FROM (public.proposals p
     JOIN public.account_members am ON ((am.account_id = p.account_id)))
  WHERE ((p.id = proposal_snapshots.proposal_id) AND (am.user_id = auth.uid())))));


--
-- Name: proposal_snapshots snapshots_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY snapshots_insert ON public.proposal_snapshots FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM (public.proposals p
     JOIN public.account_members am ON ((am.account_id = p.account_id)))
  WHERE ((p.id = proposal_snapshots.proposal_id) AND (am.user_id = auth.uid())))));


--
-- Name: proposal_snapshots snapshots_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY snapshots_select ON public.proposal_snapshots FOR SELECT USING ((EXISTS ( SELECT 1
   FROM (public.proposals p
     JOIN public.account_members am ON ((am.account_id = p.account_id)))
  WHERE ((p.id = proposal_snapshots.proposal_id) AND (am.user_id = auth.uid())))));


--
-- Name: submissions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.submissions ENABLE ROW LEVEL SECURITY;

--
-- Name: submissions submissions_select_account; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY submissions_select_account ON public.submissions FOR SELECT TO authenticated USING ((account_id = public.user_account_id(auth.uid())));


--
-- Name: waitlist_signups; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.waitlist_signups ENABLE ROW LEVEL SECURITY;

--
-- PostgreSQL database dump complete
--

\unrestrict nBguVJhStBnIS7p9lvXtSijBtsYvJnfp9kSMGFMP0f1lLu4kVIRBUmedwc9hgff

