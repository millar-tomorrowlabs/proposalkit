-- Studio voice and pricing defaults for AI prompt grounding.
-- These flow into the /api/chat system prompt so each studio gets its own voice.
ALTER TABLE accounts
  ADD COLUMN IF NOT EXISTS voice_description   TEXT,
  ADD COLUMN IF NOT EXISTS voice_examples      TEXT,
  ADD COLUMN IF NOT EXISTS banned_phrases      TEXT,
  ADD COLUMN IF NOT EXISTS default_hourly_rate NUMERIC,
  ADD COLUMN IF NOT EXISTS default_currency    TEXT;
