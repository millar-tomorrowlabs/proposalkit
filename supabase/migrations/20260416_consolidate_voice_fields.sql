-- Consolidate AI context fields.
--
-- `ai_studio_description` and `ai_studio_tagline` used to serve two
-- unrelated purposes: they provided "what does this studio do" context
-- AND implicit voice guidance to the AI. Now that we have proper
-- `voice_description` and `voice_examples` fields, they're redundant.
--
-- Preserve any existing content by folding it into voice_description
-- for accounts that haven't filled in the new field yet, then drop the
-- old columns.
UPDATE accounts
SET voice_description = ai_studio_description
WHERE voice_description IS NULL
  AND ai_studio_description IS NOT NULL;

ALTER TABLE accounts
  DROP COLUMN IF EXISTS ai_studio_description,
  DROP COLUMN IF EXISTS ai_studio_tagline;
