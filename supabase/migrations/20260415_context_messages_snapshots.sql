-- proposal_context: individual context sources per proposal
CREATE TABLE IF NOT EXISTS proposal_context (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  proposal_id UUID NOT NULL REFERENCES proposals(id) ON DELETE CASCADE,
  source_type TEXT NOT NULL CHECK (source_type IN ('file', 'url', 'paste')),
  name TEXT NOT NULL,
  url TEXT,
  file_size INTEGER,
  extracted_text TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_proposal_context_proposal ON proposal_context(proposal_id);

-- proposal_messages: persistent chat history
CREATE TABLE IF NOT EXISTS proposal_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  proposal_id UUID NOT NULL REFERENCES proposals(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  section_context TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_proposal_messages_proposal ON proposal_messages(proposal_id);

-- proposal_snapshots: undo history for AI edits
CREATE TABLE IF NOT EXISTS proposal_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  proposal_id UUID NOT NULL REFERENCES proposals(id) ON DELETE CASCADE,
  data JSONB NOT NULL,
  trigger TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_proposal_snapshots_proposal ON proposal_snapshots(proposal_id);

-- RLS: all three tables scoped via proposal -> account membership
ALTER TABLE proposal_context ENABLE ROW LEVEL SECURITY;
ALTER TABLE proposal_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE proposal_snapshots ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "context_select" ON proposal_context;
CREATE POLICY "context_select" ON proposal_context FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM proposals p
    JOIN account_members am ON am.account_id = p.account_id
    WHERE p.id = proposal_context.proposal_id
    AND am.user_id = auth.uid()
  )
);
DROP POLICY IF EXISTS "context_insert" ON proposal_context;
CREATE POLICY "context_insert" ON proposal_context FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM proposals p
    JOIN account_members am ON am.account_id = p.account_id
    WHERE p.id = proposal_context.proposal_id
    AND am.user_id = auth.uid()
  )
);
DROP POLICY IF EXISTS "context_delete" ON proposal_context;
CREATE POLICY "context_delete" ON proposal_context FOR DELETE USING (
  EXISTS (
    SELECT 1 FROM proposals p
    JOIN account_members am ON am.account_id = p.account_id
    WHERE p.id = proposal_context.proposal_id
    AND am.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "messages_select" ON proposal_messages;
CREATE POLICY "messages_select" ON proposal_messages FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM proposals p
    JOIN account_members am ON am.account_id = p.account_id
    WHERE p.id = proposal_messages.proposal_id
    AND am.user_id = auth.uid()
  )
);
DROP POLICY IF EXISTS "messages_insert" ON proposal_messages;
CREATE POLICY "messages_insert" ON proposal_messages FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM proposals p
    JOIN account_members am ON am.account_id = p.account_id
    WHERE p.id = proposal_messages.proposal_id
    AND am.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "snapshots_select" ON proposal_snapshots;
CREATE POLICY "snapshots_select" ON proposal_snapshots FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM proposals p
    JOIN account_members am ON am.account_id = p.account_id
    WHERE p.id = proposal_snapshots.proposal_id
    AND am.user_id = auth.uid()
  )
);
DROP POLICY IF EXISTS "snapshots_insert" ON proposal_snapshots;
CREATE POLICY "snapshots_insert" ON proposal_snapshots FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM proposals p
    JOIN account_members am ON am.account_id = p.account_id
    WHERE p.id = proposal_snapshots.proposal_id
    AND am.user_id = auth.uid()
  )
);
DROP POLICY IF EXISTS "snapshots_delete" ON proposal_snapshots;
CREATE POLICY "snapshots_delete" ON proposal_snapshots FOR DELETE USING (
  EXISTS (
    SELECT 1 FROM proposals p
    JOIN account_members am ON am.account_id = p.account_id
    WHERE p.id = proposal_snapshots.proposal_id
    AND am.user_id = auth.uid()
  )
);
