-- Per-account toggle controlling whether the AI is permitted to tailor the
-- agency bio (summary.studioDescription) on a per-proposal basis. When off,
-- the default description renders verbatim in every proposal. Default true
-- preserves the existing behaviour for existing accounts.

alter table public.accounts
  add column if not exists ai_tailor_agency_bio boolean not null default true;
