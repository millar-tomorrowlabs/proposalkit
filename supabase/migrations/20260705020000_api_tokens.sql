-- INT-26: per-user API tokens for the Proposl MCP server (/api/mcp).
--
-- Tokens are generated CLIENT-side in Account settings (crypto random),
-- shown once, and only their SHA-256 hex hash is stored. The MCP server
-- hashes the presented bearer token and looks it up here with the service
-- role, then scopes every query to the resolved account_id. Revocation is
-- a timestamp so history stays auditable.

CREATE TABLE public.api_tokens (
    id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    account_id uuid NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
    user_id uuid NOT NULL,
    label text NOT NULL,
    token_hash text NOT NULL UNIQUE,
    -- First characters of the token (e.g. "ppk_1a2b3c") so the settings UI
    -- can identify a token without ever storing the secret.
    token_prefix text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    last_used_at timestamp with time zone,
    revoked_at timestamp with time zone
);

CREATE INDEX idx_api_tokens_account ON public.api_tokens (account_id);

ALTER TABLE public.api_tokens ENABLE ROW LEVEL SECURITY;

-- Members see their account's token metadata; only owners mint and revoke.
CREATE POLICY members_view_api_tokens ON public.api_tokens
    FOR SELECT TO authenticated
    USING (account_id = public.user_account_id(auth.uid()));

CREATE POLICY owners_insert_api_tokens ON public.api_tokens
    FOR INSERT TO authenticated
    WITH CHECK (
        account_id = public.user_account_id(auth.uid())
        AND EXISTS (
            SELECT 1 FROM public.account_members m
            WHERE m.user_id = auth.uid()
              AND m.account_id = api_tokens.account_id
              AND m.role = 'owner'
        )
    );

CREATE POLICY owners_update_api_tokens ON public.api_tokens
    FOR UPDATE TO authenticated
    USING (
        account_id = public.user_account_id(auth.uid())
        AND EXISTS (
            SELECT 1 FROM public.account_members m
            WHERE m.user_id = auth.uid()
              AND m.account_id = api_tokens.account_id
              AND m.role = 'owner'
        )
    );
