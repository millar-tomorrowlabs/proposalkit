-- proposal_context.label and .content are legacy columns from before the
-- name/extracted_text rename. The app stopped writing them, but they kept
-- their NOT NULL constraints, so every insert from the Context dialog
-- ("Paste text" / "Add URL") failed with a not-null violation that the UI
-- swallowed. Relax the constraints so the current insert shape is valid.
--
-- The client also writes label/content again (mirroring name/extracted_text)
-- as a belt-and-braces measure for environments that deploy the app before
-- this migration runs. Once this migration is applied everywhere, a later
-- cleanup can drop the two columns and remove those writes.

ALTER TABLE public.proposal_context
  ALTER COLUMN label DROP NOT NULL,
  ALTER COLUMN content DROP NOT NULL;
