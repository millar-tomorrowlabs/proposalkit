-- INT-22: free-text workspace writing rules injected into the builder AI
-- system prompt as hard requirements.
-- INT-20: workspace default for the proposal "Next Steps" block; new
-- proposals seed cta.steps from it, unset falls back to the stock copy.

ALTER TABLE public.accounts
  ADD COLUMN IF NOT EXISTS writing_rules text,
  ADD COLUMN IF NOT EXISTS default_cta_steps text[];
