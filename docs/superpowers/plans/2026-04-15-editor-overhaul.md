# Editor Overhaul Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the split-pane builder with a document-first, AI-native editor and bring all remaining app pages into the Studio Editorial design language.

**Architecture:** Full-width WYSIWYG document rendering with a floating bottom composer for AI interaction. Intake flow replaces the wizard with a context-upload + conversational step. Settings and team pages move under a shared `/settings` shell with horizontal tabs.

**Tech Stack:** React 18, TypeScript, Vite, Tailwind v4, Zustand, Supabase (Postgres + Edge Functions), React Router v6, dnd-kit, Lucide icons

**Spec:** `docs/superpowers/specs/2026-04-15-editor-overhaul-design.md`

---

## File Structure

### New files

| File | Responsibility |
|---|---|
| `supabase/migrations/20260415_context_messages_snapshots.sql` | DB migration: 3 new tables |
| `src/pages/SettingsShell.tsx` | Shared settings layout with horizontal tabs |
| `src/pages/settings/AccountTab.tsx` | Account settings (replaces AccountSettingsPage) |
| `src/pages/settings/TeamTab.tsx` | Team members (replaces TeamMembersPage) |
| `src/pages/IntakePage.tsx` | New proposal intake: context upload + conversational chat |
| `src/components/builder/BuilderTopBar.tsx` | Top bar for the document-first builder |
| `src/components/builder/FloatingComposer.tsx` | Floating bottom chat composer |
| `src/components/builder/SettingsPopover.tsx` | Settings popover (brand, slug, password, sections) |
| `src/components/builder/ContextDialog.tsx` | Dialog for viewing/adding/removing context sources |
| `src/components/builder/ViewportSwitcher.tsx` | Desktop/Tablet/Mobile toggle |

### Modified files

| File | Changes |
|---|---|
| `src/App.tsx` | Update routes: `/settings/*`, `/builder/new`, remove `/new` |
| `src/pages/BuilderHome.tsx` | Full rewrite: document-first layout, no split pane |
| `src/pages/ProposalDetailPage.tsx` | Fix delete dialog |
| `src/pages/NotFound.tsx` | Apply Studio Editorial |
| `src/store/builderStore.ts` | Add composer visibility, active section context, viewport state |
| `src/types/proposal.ts` | Add `ProposalContextSource`, `ProposalMessage` types |
| `src/components/proposal/AskAIGhost.tsx` | Bridge to floating composer |
| `src/contexts/BuilderPreviewContext.tsx` | Add `focusComposer` callback |

### Deleted files (Phase 6)

`WizardPage.tsx`, `ChatPanel.tsx`, `SettingsPanel.tsx`, `BuilderForm.tsx`, `BuilderField.tsx`, `ChatMessageBubble.tsx`, `SuggestionChip.tsx`, `ChatDiff.tsx`, `BuilderSectionContext.tsx`, `BuilderSectionInvestment.tsx`, `BuilderSectionMeta.tsx`, `BuilderSectionScope.tsx`, `BuilderSectionSummary.tsx`, `BuilderSectionTimeline.tsx`

---

## Phase 1: Foundation

### Task 1: Database migration

**Files:**
- Create: `supabase/migrations/20260415_context_messages_snapshots.sql`

- [ ] **Step 1: Write the migration file**

```sql
-- proposal_context: individual context sources per proposal
CREATE TABLE proposal_context (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  proposal_id UUID NOT NULL REFERENCES proposals(id) ON DELETE CASCADE,
  source_type TEXT NOT NULL CHECK (source_type IN ('file', 'url', 'paste')),
  name TEXT NOT NULL,
  url TEXT,
  file_size INTEGER,
  extracted_text TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_proposal_context_proposal ON proposal_context(proposal_id);

-- proposal_messages: persistent chat history
CREATE TABLE proposal_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  proposal_id UUID NOT NULL REFERENCES proposals(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  section_context TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_proposal_messages_proposal ON proposal_messages(proposal_id);

-- proposal_snapshots: undo history for AI edits
CREATE TABLE proposal_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  proposal_id UUID NOT NULL REFERENCES proposals(id) ON DELETE CASCADE,
  data JSONB NOT NULL,
  trigger TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_proposal_snapshots_proposal ON proposal_snapshots(proposal_id);

-- RLS: all three tables scoped via proposal -> account membership
ALTER TABLE proposal_context ENABLE ROW LEVEL SECURITY;
ALTER TABLE proposal_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE proposal_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "context_select" ON proposal_context FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM proposals p
    JOIN account_members am ON am.account_id = p.account_id
    WHERE p.id = proposal_context.proposal_id
    AND am.user_id = auth.uid()
  )
);
CREATE POLICY "context_insert" ON proposal_context FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM proposals p
    JOIN account_members am ON am.account_id = p.account_id
    WHERE p.id = proposal_context.proposal_id
    AND am.user_id = auth.uid()
  )
);
CREATE POLICY "context_delete" ON proposal_context FOR DELETE USING (
  EXISTS (
    SELECT 1 FROM proposals p
    JOIN account_members am ON am.account_id = p.account_id
    WHERE p.id = proposal_context.proposal_id
    AND am.user_id = auth.uid()
  )
);

CREATE POLICY "messages_select" ON proposal_messages FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM proposals p
    JOIN account_members am ON am.account_id = p.account_id
    WHERE p.id = proposal_messages.proposal_id
    AND am.user_id = auth.uid()
  )
);
CREATE POLICY "messages_insert" ON proposal_messages FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM proposals p
    JOIN account_members am ON am.account_id = p.account_id
    WHERE p.id = proposal_messages.proposal_id
    AND am.user_id = auth.uid()
  )
);

CREATE POLICY "snapshots_select" ON proposal_snapshots FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM proposals p
    JOIN account_members am ON am.account_id = p.account_id
    WHERE p.id = proposal_snapshots.proposal_id
    AND am.user_id = auth.uid()
  )
);
CREATE POLICY "snapshots_insert" ON proposal_snapshots FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM proposals p
    JOIN account_members am ON am.account_id = p.account_id
    WHERE p.id = proposal_snapshots.proposal_id
    AND am.user_id = auth.uid()
  )
);
CREATE POLICY "snapshots_delete" ON proposal_snapshots FOR DELETE USING (
  EXISTS (
    SELECT 1 FROM proposals p
    JOIN account_members am ON am.account_id = p.account_id
    WHERE p.id = proposal_snapshots.proposal_id
    AND am.user_id = auth.uid()
  )
);
```

- [ ] **Step 2: Run the migration against Supabase**

```bash
npx supabase db push --project-ref nkygheptubvogevezpap
```

If `db push` is not available, run the SQL directly in the Supabase SQL editor at https://supabase.com/dashboard/project/nkygheptubvogevezpap/sql/new

- [ ] **Step 3: Add TypeScript types**

Modify: `src/types/proposal.ts` -- add at the end of the file:

```typescript
export interface ProposalContextSource {
  id: string
  proposalId: string
  sourceType: "file" | "url" | "paste"
  name: string
  url?: string
  fileSize?: number
  extractedText: string
  createdAt: string
}

export interface ProposalMessage {
  id: string
  proposalId: string
  role: "user" | "assistant"
  content: string
  sectionContext?: string
  createdAt: string
}

export interface ProposalSnapshot {
  id: string
  proposalId: string
  data: ProposalData
  trigger: string
  createdAt: string
}
```

- [ ] **Step 4: Verify types compile**

```bash
cd /Users/millarsmith/proposalkit && ./node_modules/.bin/tsc --noEmit
```

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260415_context_messages_snapshots.sql src/types/proposal.ts
git commit -m "feat: add proposal_context, proposal_messages, proposal_snapshots tables"
```

---

### Task 2: Fix delete dialog bug

**Files:**
- Modify: `src/pages/ProposalDetailPage.tsx`

- [ ] **Step 1: Fix the DeleteConfirmDialog**

In `src/pages/ProposalDetailPage.tsx`, find the `DeleteConfirmDialog` function (around line 1048). Make these changes:

Replace the `match` check and label:

```typescript
// Old:
const match = confirmText.trim() === clientName.trim()
// New:
const match = confirmText.trim().toLowerCase() === "delete"
```

Replace the label text:

```typescript
// Old:
TYPE "{clientName.toUpperCase()}" TO CONFIRM
// New:
TYPE "DELETE" TO CONFIRM
```

Replace the placeholder:

```typescript
// Old:
placeholder={clientName}
// New:
placeholder="delete"
```

Remove the `clientName` prop from the component signature and the call site. The component no longer needs it.

- [ ] **Step 2: Verify it compiles**

```bash
cd /Users/millarsmith/proposalkit && ./node_modules/.bin/tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add src/pages/ProposalDetailPage.tsx
git commit -m "fix: delete dialog uses 'DELETE' confirmation instead of client name"
```

---

### Task 3: NotFound page Studio Editorial

**Files:**
- Modify: `src/pages/NotFound.tsx`

- [ ] **Step 1: Rewrite NotFound with Studio Editorial styling**

Replace the entire file content with:

```tsx
import { Link } from "react-router-dom"
import ProposlMark from "@/components/brand/ProposlMark"

const NotFound = () => {
  return (
    <div
      className="flex min-h-screen flex-col items-center justify-center gap-6 px-6"
      style={{ background: "var(--color-cream)", color: "var(--color-ink)" }}
    >
      <Link to="/" className="mb-4">
        <ProposlMark />
      </Link>
      <p
        className="text-[11px] uppercase tracking-[0.14em]"
        style={{ fontFamily: "var(--font-mono)", color: "var(--color-ink-mute)" }}
      >
        404
      </p>
      <h1
        className="text-center text-[36px] leading-[1.1] tracking-[-0.01em]"
        style={{ fontFamily: "var(--font-merchant-display)", fontWeight: 500 }}
      >
        Page not found.
      </h1>
      <Link
        to="/proposals"
        className="mt-2 inline-block text-[13px] font-medium transition-colors hover:opacity-70"
        style={{ color: "var(--color-forest)" }}
      >
        Back to proposals
      </Link>
    </div>
  )
}

export default NotFound
```

- [ ] **Step 2: Verify it compiles**

```bash
cd /Users/millarsmith/proposalkit && ./node_modules/.bin/tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add src/pages/NotFound.tsx
git commit -m "style: apply Studio Editorial to NotFound page"
```

---

## Phase 2: Settings Shell

### Task 4: Settings shell layout + routing

**Files:**
- Create: `src/pages/SettingsShell.tsx`
- Create: `src/pages/settings/AccountTab.tsx` (placeholder)
- Create: `src/pages/settings/TeamTab.tsx` (placeholder)
- Modify: `src/App.tsx`

- [ ] **Step 1: Create the settings directory**

```bash
mkdir -p /Users/millarsmith/proposalkit/src/pages/settings
```

- [ ] **Step 2: Write SettingsShell.tsx**

```tsx
/**
 * Settings shell — /settings
 *
 * Shared layout with horizontal tabs: Account | Team.
 * Styled in Studio Editorial. Extensible for future tabs.
 */

import { NavLink, Outlet, Link } from "react-router-dom"
import ProposlMark from "@/components/brand/ProposlMark"

const tabs = [
  { label: "Account", to: "/settings" },
  { label: "Team", to: "/settings/team" },
]

export default function SettingsShell() {
  return (
    <div
      className="min-h-screen"
      style={{ background: "var(--color-cream)", color: "var(--color-ink)" }}
    >
      {/* Header */}
      <header
        className="border-b px-6 py-5"
        style={{ borderColor: "var(--color-rule)" }}
      >
        <div className="mx-auto flex max-w-2xl items-center justify-between">
          <Link to="/proposals">
            <ProposlMark />
          </Link>
          <Link
            to="/proposals"
            className="text-[11px] uppercase tracking-[0.12em] transition-colors hover:opacity-70"
            style={{ fontFamily: "var(--font-mono)", color: "var(--color-ink-mute)" }}
          >
            ← Dashboard
          </Link>
        </div>
      </header>

      {/* Title + tabs */}
      <div className="mx-auto max-w-2xl px-6 pt-10">
        <h1
          className="text-[32px] leading-[1.1] tracking-[-0.01em]"
          style={{ fontFamily: "var(--font-merchant-display)", fontWeight: 500 }}
        >
          Settings
        </h1>

        <nav
          className="mt-6 flex gap-1 border-b"
          style={{ borderColor: "var(--color-rule)" }}
        >
          {tabs.map((tab) => (
            <NavLink
              key={tab.to}
              to={tab.to}
              end={tab.to === "/settings"}
              className={({ isActive }) =>
                `relative px-4 py-2.5 text-[13px] font-medium transition-colors ${
                  isActive ? "" : "hover:opacity-70"
                }`
              }
              style={({ isActive }) => ({
                color: isActive ? "var(--color-forest)" : "var(--color-ink-mute)",
                fontFamily: "var(--font-sans)",
              })}
            >
              {({ isActive }) => (
                <>
                  {tab.label}
                  {isActive && (
                    <span
                      className="absolute bottom-0 left-4 right-4 h-[2px] rounded-full"
                      style={{ background: "var(--color-forest)" }}
                    />
                  )}
                </>
              )}
            </NavLink>
          ))}
        </nav>
      </div>

      {/* Tab content */}
      <div className="mx-auto max-w-2xl px-6 py-8">
        <Outlet />
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Write placeholder AccountTab.tsx**

```tsx
export default function AccountTab() {
  return <p style={{ color: "var(--color-ink-mute)" }}>Account settings loading...</p>
}
```

- [ ] **Step 4: Write placeholder TeamTab.tsx**

```tsx
export default function TeamTab() {
  return <p style={{ color: "var(--color-ink-mute)" }}>Team settings loading...</p>
}
```

- [ ] **Step 5: Update App.tsx routes**

In `src/App.tsx`:

Add imports at top:
```tsx
import SettingsShell from "@/pages/SettingsShell"
const AccountTab = lazy(() => import("@/pages/settings/AccountTab"))
const TeamTab = lazy(() => import("@/pages/settings/TeamTab"))
```

Replace the old settings routes:
```tsx
// Old:
<Route path="/settings" element={<AccountSettingsPage />} />
<Route path="/settings/team" element={<TeamMembersPage />} />

// New:
<Route path="/settings" element={<SettingsShell />}>
  <Route index element={<AccountTab />} />
  <Route path="team" element={<TeamTab />} />
</Route>
```

Remove the old lazy imports for `AccountSettingsPage` and `TeamMembersPage` (keep the files for now as reference, delete in Phase 6).

- [ ] **Step 6: Verify it compiles**

```bash
cd /Users/millarsmith/proposalkit && ./node_modules/.bin/tsc --noEmit
```

- [ ] **Step 7: Commit**

```bash
git add src/pages/SettingsShell.tsx src/pages/settings/AccountTab.tsx src/pages/settings/TeamTab.tsx src/App.tsx
git commit -m "feat: add settings shell with Account/Team tabs and routes"
```

---

### Task 5: Account settings tab

**Files:**
- Modify: `src/pages/settings/AccountTab.tsx`
- Reference: `src/pages/AccountSettingsPage.tsx` (for logic)

- [ ] **Step 1: Implement AccountTab with Studio Editorial styling**

Rewrite `src/pages/settings/AccountTab.tsx` using the same state management and save logic from `AccountSettingsPage.tsx`, but styled with Studio Editorial tokens. Use `AuthField`, `AuthInput`, `AuthButton` patterns from the auth pages:

- Import `useAccount` from `@/contexts/AccountContext`
- Import `supabase` from `@/lib/supabase`
- Import `friendlyError` from `@/lib/errors`
- All fields use mono uppercase labels (11px, tracked, `--font-mono`, `--color-ink-mute`)
- Helper text below fields: "WHERE SUBMISSIONS ARE SENT", "PRE-FILLED ON NEW PROPOSALS"
- Input style: `rounded-lg border bg-white/50 px-3 py-2.5 text-[14px]` with `borderColor: var(--color-rule)`
- Save button: forest pill (`rounded-full`, `bg: var(--color-forest)`, `color: var(--color-cream)`)
- Include the `ImageUpload` component for studio logo (import from `@/components/builder/ImageUpload`)
- Include the "AI studio description" textarea, studio tagline, and studio description fields from the original page
- Include the account delete section (danger zone) with the same confirmation pattern as the original, but using "type DELETE to confirm" instead of the studio name
- Gate the page with `if (!isOwner) return <Navigate to="/proposals" replace />`

All field state, save handler, and delete handler logic can be copied from `AccountSettingsPage.tsx` lines 9-98 with style updates.

- [ ] **Step 2: Verify it compiles**

```bash
cd /Users/millarsmith/proposalkit && ./node_modules/.bin/tsc --noEmit
```

- [ ] **Step 3: Visually verify** by navigating to `http://localhost:5173/settings` in the dev server. Confirm cream bg, mono labels, forest pill button.

- [ ] **Step 4: Commit**

```bash
git add src/pages/settings/AccountTab.tsx
git commit -m "feat: account settings tab with Studio Editorial styling"
```

---

### Task 6: Team members tab

**Files:**
- Modify: `src/pages/settings/TeamTab.tsx`
- Reference: `src/pages/TeamMembersPage.tsx` (for logic)

- [ ] **Step 1: Implement TeamTab with Studio Editorial styling**

Rewrite `src/pages/settings/TeamTab.tsx` using the same state management and team logic from `TeamMembersPage.tsx`, but styled with Studio Editorial tokens:

- Import `useAccount` from `@/contexts/AccountContext`
- Member list: each row is a cream card (`rounded-xl border`, `borderColor: var(--color-rule)`) with name, email, role badge (mono, uppercase, 9px: OWNER in forest, MEMBER in ink-mute), joined date (mono, ink-mute)
- Invite section: mono eyebrow "INVITE MEMBER", email input + role select + "Send invite" forest pill
- Pending invites: separate list with email, expiry countdown, Resend/Revoke buttons
- Remove member: styled like the new delete dialog pattern
- All state, handlers, and Supabase queries from `TeamMembersPage.tsx` lines 24-180

- [ ] **Step 2: Verify it compiles**

```bash
cd /Users/millarsmith/proposalkit && ./node_modules/.bin/tsc --noEmit
```

- [ ] **Step 3: Visually verify** by navigating to `http://localhost:5173/settings/team`.

- [ ] **Step 4: Commit**

```bash
git add src/pages/settings/TeamTab.tsx
git commit -m "feat: team members tab with Studio Editorial styling"
```

---

## Phase 3: Builder Core

### Task 7: Viewport switcher component

**Files:**
- Create: `src/components/builder/ViewportSwitcher.tsx`

- [ ] **Step 1: Write ViewportSwitcher**

```tsx
import { Monitor, Tablet, Smartphone } from "lucide-react"

export type Viewport = "desktop" | "tablet" | "mobile"

const VIEWPORT_WIDTHS: Record<Viewport, string | undefined> = {
  desktop: undefined,    // full width
  tablet: "768px",
  mobile: "375px",
}

interface ViewportSwitcherProps {
  viewport: Viewport
  onChange: (v: Viewport) => void
}

export { VIEWPORT_WIDTHS }

export default function ViewportSwitcher({ viewport, onChange }: ViewportSwitcherProps) {
  const items: { key: Viewport; icon: typeof Monitor; label: string }[] = [
    { key: "desktop", icon: Monitor, label: "Desktop" },
    { key: "tablet", icon: Tablet, label: "Tablet" },
    { key: "mobile", icon: Smartphone, label: "Mobile" },
  ]

  return (
    <div
      className="flex items-center gap-0.5 rounded-full border p-0.5"
      style={{ borderColor: "var(--color-rule)" }}
    >
      {items.map(({ key, icon: Icon, label }) => (
        <button
          key={key}
          onClick={() => onChange(key)}
          title={label}
          className="flex items-center justify-center rounded-full p-1.5 transition-colors"
          style={{
            background: viewport === key ? "var(--color-forest)" : "transparent",
            color: viewport === key ? "var(--color-cream)" : "var(--color-ink-mute)",
          }}
        >
          <Icon className="h-3.5 w-3.5" />
        </button>
      ))}
    </div>
  )
}
```

- [ ] **Step 2: Verify it compiles**

```bash
cd /Users/millarsmith/proposalkit && ./node_modules/.bin/tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add src/components/builder/ViewportSwitcher.tsx
git commit -m "feat: viewport switcher component (Desktop/Tablet/Mobile)"
```

---

### Task 8: Builder top bar

**Files:**
- Create: `src/components/builder/BuilderTopBar.tsx`

- [ ] **Step 1: Write BuilderTopBar**

The top bar spans the full width. Props:

```tsx
import { Link } from "react-router-dom"
import { Settings, FileText, Eye, Edit2, Send } from "lucide-react"
import ProposlMark from "@/components/brand/ProposlMark"
import ViewportSwitcher, { type Viewport } from "./ViewportSwitcher"

interface BuilderTopBarProps {
  title: string
  onTitleChange: (title: string) => void
  status: string
  viewport: Viewport
  onViewportChange: (v: Viewport) => void
  previewMode: boolean
  onTogglePreview: () => void
  onOpenSettings: () => void
  onOpenContext: () => void
  onSend: () => void
  saveStatus: string
}

export default function BuilderTopBar({
  title,
  onTitleChange,
  status,
  viewport,
  onViewportChange,
  previewMode,
  onTogglePreview,
  onOpenSettings,
  onOpenContext,
  onSend,
  saveStatus,
}: BuilderTopBarProps) {
  return (
    <header
      className="fixed top-0 right-0 left-0 z-40 flex h-11 items-center justify-between border-b px-4"
      style={{
        background: "var(--color-cream)",
        borderColor: "var(--color-rule)",
        fontFamily: "var(--font-sans)",
      }}
    >
      {/* Left: mark + title + status */}
      <div className="flex items-center gap-3">
        <Link to="/proposals" className="flex items-center gap-1.5 transition-opacity hover:opacity-70">
          <ProposlMark />
        </Link>
        <span className="text-[var(--color-rule)]">/</span>
        <input
          type="text"
          value={title}
          onChange={(e) => onTitleChange(e.target.value)}
          className="bg-transparent text-[13px] font-medium outline-none"
          style={{ color: "var(--color-ink)", minWidth: "120px" }}
          placeholder="Untitled proposal"
        />
        <span
          className="rounded-full border px-2 py-0.5 text-[9px] uppercase tracking-[0.12em]"
          style={{
            fontFamily: "var(--font-mono)",
            borderColor: "var(--color-rule)",
            color: status === "draft" ? "var(--color-ink-mute)" : "var(--color-forest)",
          }}
        >
          {status || "draft"}
        </span>
      </div>

      {/* Right: actions */}
      <div className="flex items-center gap-2">
        <span
          className="mr-1 text-[9px] uppercase tracking-[0.12em]"
          style={{ fontFamily: "var(--font-mono)", color: "var(--color-ink-mute)" }}
        >
          {saveStatus === "saving" ? "Saving..." : saveStatus === "saved" ? "Saved" : ""}
        </span>

        <button
          onClick={onOpenContext}
          className="flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors hover:opacity-70"
          style={{ borderColor: "var(--color-rule)", color: "var(--color-ink-soft)" }}
          title="Context sources"
        >
          <FileText className="h-3 w-3" />
          Context
        </button>

        <button
          onClick={onOpenSettings}
          className="flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors hover:opacity-70"
          style={{ borderColor: "var(--color-rule)", color: "var(--color-ink-soft)" }}
          title="Settings"
        >
          <Settings className="h-3 w-3" />
        </button>

        <ViewportSwitcher viewport={viewport} onChange={onViewportChange} />

        <button
          onClick={onTogglePreview}
          className="flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors hover:opacity-70"
          style={{ borderColor: "var(--color-rule)", color: "var(--color-ink-soft)" }}
        >
          {previewMode ? <Edit2 className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
          {previewMode ? "Edit" : "Preview"}
        </button>

        <button
          onClick={onSend}
          className="flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[11px] font-medium transition-transform hover:scale-[1.02]"
          style={{ background: "var(--color-forest)", color: "var(--color-cream)" }}
        >
          <Send className="h-3 w-3" />
          Send
        </button>
      </div>
    </header>
  )
}
```

- [ ] **Step 2: Verify it compiles**

```bash
cd /Users/millarsmith/proposalkit && ./node_modules/.bin/tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add src/components/builder/BuilderTopBar.tsx
git commit -m "feat: builder top bar with title, viewport, settings, send"
```

---

### Task 9: Floating composer

**Files:**
- Create: `src/components/builder/FloatingComposer.tsx`

- [ ] **Step 1: Write the FloatingComposer component**

This is the largest new component. Key behaviors:
- Collapsed: single input row with sparkle icon, placeholder, send button, attach button
- Expanded: conversation history scrolls above the input
- Dismiss: X button hides it, leaves a small re-entry pill at bottom-right
- Cmd+K toggles visibility
- Messages come from the builder store's `chatMessages`
- On submit, calls a provided `onSend(text: string)` callback
- Shows "Revert" button after AI messages

```tsx
import { useState, useRef, useEffect, useCallback } from "react"
import { Sparkles, Paperclip, X, RotateCcw } from "lucide-react"

interface ComposerMessage {
  id: string
  role: "user" | "assistant"
  content: string
  createdAt: string
}

interface FloatingComposerProps {
  messages: ComposerMessage[]
  loading: boolean
  onSend: (text: string) => void
  onAttach?: () => void
  onRevert?: () => void
  canRevert?: boolean
  visible: boolean
  onToggle: () => void
  sectionContext?: string
}

export default function FloatingComposer({
  messages,
  loading,
  onSend,
  onAttach,
  onRevert,
  canRevert,
  visible,
  onToggle,
  sectionContext,
}: FloatingComposerProps) {
  const [input, setInput] = useState("")
  const [expanded, setExpanded] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  // Cmd+K toggle
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault()
        onToggle()
      }
    }
    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  }, [onToggle])

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages.length])

  // Focus input when becoming visible
  useEffect(() => {
    if (visible) inputRef.current?.focus()
  }, [visible])

  const handleSubmit = () => {
    const trimmed = input.trim()
    if (!trimmed || loading) return
    onSend(trimmed)
    setInput("")
    setExpanded(true)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    }
  }

  // Collapsed re-entry pill when hidden
  if (!visible) {
    return (
      <button
        onClick={onToggle}
        className="fixed bottom-4 right-4 z-50 flex items-center gap-2 rounded-full border px-3.5 py-2 text-[11px] font-medium shadow-lg transition-transform hover:scale-[1.02]"
        style={{
          background: "var(--color-cream)",
          borderColor: "var(--color-rule)",
          color: "var(--color-ink-soft)",
        }}
      >
        <Sparkles className="h-3.5 w-3.5" style={{ color: "var(--color-forest)" }} />
        Ask AI...
        <kbd
          className="ml-1 rounded border px-1 py-0.5 text-[9px]"
          style={{
            borderColor: "var(--color-rule)",
            color: "var(--color-ink-mute)",
            fontFamily: "var(--font-mono)",
          }}
        >
          {"\u2318"}K
        </kbd>
      </button>
    )
  }

  const showHistory = expanded && messages.length > 0

  return (
    <div
      className="fixed bottom-4 left-1/2 z-50 w-[520px] max-w-[90vw] -translate-x-1/2 rounded-2xl border"
      style={{
        background: "var(--color-cream)",
        borderColor: "var(--color-rule)",
        boxShadow: "0 12px 32px rgba(0,0,0,0.12), 0 2px 6px rgba(0,0,0,0.06)",
      }}
    >
      {/* Conversation history */}
      {showHistory && (
        <div
          ref={scrollRef}
          className="max-h-[45vh] overflow-y-auto border-b px-4 py-3"
          style={{ borderColor: "var(--color-rule)" }}
        >
          <div className="flex flex-col gap-2.5">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`max-w-[90%] rounded-xl px-3.5 py-2.5 text-[12px] leading-[1.5] ${
                  msg.role === "user" ? "ml-auto" : ""
                }`}
                style={{
                  background:
                    msg.role === "user" ? "var(--color-forest)" : "var(--color-paper)",
                  color: msg.role === "user" ? "var(--color-cream)" : "var(--color-ink)",
                  border: msg.role === "assistant" ? "1px solid var(--color-rule)" : "none",
                  borderRadius:
                    msg.role === "user"
                      ? "12px 12px 2px 12px"
                      : "12px 12px 12px 2px",
                }}
              >
                {msg.content}
              </div>
            ))}
            {loading && (
              <div
                className="max-w-[90%] rounded-xl px-3.5 py-2.5 text-[12px]"
                style={{
                  background: "var(--color-paper)",
                  border: "1px solid var(--color-rule)",
                  color: "var(--color-ink-mute)",
                  borderRadius: "12px 12px 12px 2px",
                }}
              >
                Thinking...
              </div>
            )}
          </div>
          {/* Revert button after AI messages */}
          {canRevert && !loading && messages.length > 0 && messages[messages.length - 1].role === "assistant" && (
            <button
              onClick={onRevert}
              className="mt-2 flex items-center gap-1.5 text-[10px] uppercase tracking-[0.12em] transition-colors hover:opacity-70"
              style={{ fontFamily: "var(--font-mono)", color: "var(--color-ink-mute)" }}
            >
              <RotateCcw className="h-3 w-3" />
              Revert last change
            </button>
          )}
        </div>
      )}

      {/* Input row */}
      <div className="flex items-end gap-2 px-4 py-3">
        <Sparkles className="mb-1 h-4 w-4 shrink-0" style={{ color: "var(--color-forest)" }} />
        <textarea
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onFocus={() => messages.length > 0 && setExpanded(true)}
          onKeyDown={handleKeyDown}
          placeholder={
            sectionContext
              ? `Ask AI about ${sectionContext}...`
              : "Ask AI anything, or \u2318K to toggle..."
          }
          rows={1}
          className="flex-1 resize-none bg-transparent text-[13px] leading-[1.5] outline-none"
          style={{ color: "var(--color-ink)", maxHeight: "80px" }}
        />
        {onAttach && (
          <button
            onClick={onAttach}
            className="mb-1 shrink-0 transition-colors hover:opacity-70"
            style={{ color: "var(--color-ink-mute)" }}
            title="Attach file or URL"
          >
            <Paperclip className="h-4 w-4" />
          </button>
        )}
        <button
          onClick={handleSubmit}
          disabled={!input.trim() || loading}
          className="mb-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[12px] transition-transform hover:scale-[1.05] disabled:opacity-40"
          style={{ background: "var(--color-forest)", color: "var(--color-cream)" }}
        >
          ↑
        </button>
        <button
          onClick={onToggle}
          className="mb-1 shrink-0 transition-colors hover:opacity-70"
          style={{ color: "var(--color-ink-mute)" }}
          title="Hide composer"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verify it compiles**

```bash
cd /Users/millarsmith/proposalkit && ./node_modules/.bin/tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add src/components/builder/FloatingComposer.tsx
git commit -m "feat: floating composer component with Cmd+K, history, revert"
```

---

### Task 10: Settings popover

**Files:**
- Create: `src/components/builder/SettingsPopover.tsx`

- [ ] **Step 1: Write SettingsPopover**

A popover anchored to the Settings button. Contains brand colors, client name, slug, CTA email, password toggle, and section order. Uses the `useBuilderStore` directly.

```tsx
import { useRef, useEffect } from "react"
import { useBuilderStore } from "@/store/builderStore"
import type { SectionKey } from "@/types/proposal"

interface SettingsPopoverProps {
  open: boolean
  onClose: () => void
  anchorRef: React.RefObject<HTMLElement | null>
}

const SECTION_LABELS: Record<SectionKey, string> = {
  summary: "Summary",
  scope: "Scope",
  timeline: "Timeline",
  investment: "Investment",
  cta: "Call to Action",
}

export default function SettingsPopover({ open, onClose, anchorRef }: SettingsPopoverProps) {
  const popoverRef = useRef<HTMLDivElement>(null)
  const { proposal, updateField } = useBuilderStore()

  // Close on click outside
  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(e.target as Node) &&
        anchorRef.current &&
        !anchorRef.current.contains(e.target as Node)
      ) {
        onClose()
      }
    }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [open, onClose, anchorRef])

  if (!open) return null

  const inputClass =
    "w-full rounded-lg border bg-white/50 px-3 py-2 text-[13px] outline-none"
  const inputStyle = {
    borderColor: "var(--color-rule)",
    color: "var(--color-ink)",
  }
  const labelClass = "mb-1.5 block text-[10px] uppercase tracking-[0.12em]"
  const labelStyle = {
    fontFamily: "var(--font-mono)",
    color: "var(--color-ink-mute)",
  }

  return (
    <div
      ref={popoverRef}
      className="absolute right-0 top-full mt-2 z-50 w-[340px] rounded-xl border p-5 shadow-lg"
      style={{
        background: "var(--color-cream)",
        borderColor: "var(--color-rule)",
        boxShadow: "0 8px 24px rgba(0,0,0,0.08)",
      }}
    >
      <p
        className="mb-4 text-[10px] uppercase tracking-[0.14em]"
        style={{ fontFamily: "var(--font-mono)", color: "var(--color-ink-mute)" }}
      >
        PROPOSAL SETTINGS
      </p>

      <div className="space-y-4">
        {/* Brand colors */}
        <div>
          <span className={labelClass} style={labelStyle}>BRAND COLORS</span>
          <div className="flex gap-3">
            <label className="flex items-center gap-2">
              <input
                type="color"
                value={proposal.brandColor1}
                onChange={(e) => updateField("brandColor1", e.target.value)}
                className="h-8 w-8 cursor-pointer rounded border"
                style={{ borderColor: "var(--color-rule)" }}
              />
              <span className="text-[11px]" style={{ color: "var(--color-ink-soft)" }}>Primary</span>
            </label>
            <label className="flex items-center gap-2">
              <input
                type="color"
                value={proposal.brandColor2}
                onChange={(e) => updateField("brandColor2", e.target.value)}
                className="h-8 w-8 cursor-pointer rounded border"
                style={{ borderColor: "var(--color-rule)" }}
              />
              <span className="text-[11px]" style={{ color: "var(--color-ink-soft)" }}>Secondary</span>
            </label>
          </div>
        </div>

        {/* Client name */}
        <div>
          <span className={labelClass} style={labelStyle}>CLIENT NAME</span>
          <input
            type="text"
            value={proposal.clientName}
            onChange={(e) => updateField("clientName", e.target.value)}
            className={inputClass}
            style={inputStyle}
            placeholder="Acme Corp"
          />
        </div>

        {/* Slug */}
        <div>
          <span className={labelClass} style={labelStyle}>PROPOSAL URL</span>
          <div className="flex items-center gap-0">
            <span
              className="rounded-l-lg border border-r-0 bg-white/30 px-2.5 py-2 text-[13px]"
              style={{ borderColor: "var(--color-rule)", color: "var(--color-ink-mute)" }}
            >
              /p/
            </span>
            <input
              type="text"
              value={proposal.slug}
              onChange={(e) => updateField("slug", e.target.value)}
              className="flex-1 rounded-r-lg border bg-white/50 px-2.5 py-2 text-[13px] outline-none"
              style={inputStyle}
              placeholder="cherry-pao-pao"
            />
          </div>
        </div>

        {/* CTA email */}
        <div>
          <span className={labelClass} style={labelStyle}>CTA EMAIL</span>
          <input
            type="email"
            value={proposal.ctaEmail}
            onChange={(e) => updateField("ctaEmail", e.target.value)}
            className={inputClass}
            style={inputStyle}
            placeholder="hello@studio.com"
          />
        </div>

        {/* Section order */}
        <div>
          <span className={labelClass} style={labelStyle}>SECTIONS</span>
          <div className="space-y-1.5">
            {proposal.sections.map((key) => (
              <div
                key={key}
                className="flex items-center justify-between rounded-lg border px-3 py-1.5 text-[12px]"
                style={{ borderColor: "var(--color-rule)", color: "var(--color-ink-soft)" }}
              >
                <span>{SECTION_LABELS[key] || key}</span>
                <button
                  onClick={() => {
                    updateField(
                      "sections",
                      proposal.sections.filter((s) => s !== key),
                    )
                  }}
                  className="text-[10px] transition-colors hover:opacity-70"
                  style={{ color: "var(--color-ink-mute)" }}
                >
                  x
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verify it compiles**

```bash
cd /Users/millarsmith/proposalkit && ./node_modules/.bin/tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add src/components/builder/SettingsPopover.tsx
git commit -m "feat: settings popover (brand, slug, CTA, sections)"
```

---

### Task 11: Context dialog

**Files:**
- Create: `src/components/builder/ContextDialog.tsx`

- [ ] **Step 1: Write ContextDialog**

A modal dialog that lists existing context sources and allows adding new ones (paste text, enter URL). Uses `supabase` to CRUD `proposal_context` rows.

```tsx
import { useState, useEffect, useCallback } from "react"
import { Plus, X, Link as LinkIcon, FileText, Type } from "lucide-react"
import { supabase } from "@/lib/supabase"
import type { ProposalContextSource } from "@/types/proposal"

interface ContextDialogProps {
  open: boolean
  onClose: () => void
  proposalId: string
}

export default function ContextDialog({ open, onClose, proposalId }: ContextDialogProps) {
  const [sources, setSources] = useState<ProposalContextSource[]>([])
  const [adding, setAdding] = useState<"paste" | "url" | null>(null)
  const [name, setName] = useState("")
  const [content, setContent] = useState("")
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    const { data } = await supabase
      .from("proposal_context")
      .select("*")
      .eq("proposal_id", proposalId)
      .order("created_at")
    if (data) {
      setSources(
        data.map((r) => ({
          id: r.id,
          proposalId: r.proposal_id,
          sourceType: r.source_type,
          name: r.name,
          url: r.url,
          fileSize: r.file_size,
          extractedText: r.extracted_text,
          createdAt: r.created_at,
        })),
      )
    }
  }, [proposalId])

  useEffect(() => {
    if (open) load()
  }, [open, load])

  const handleAdd = async () => {
    if (!name.trim() || !content.trim()) return
    setSaving(true)
    await supabase.from("proposal_context").insert({
      proposal_id: proposalId,
      source_type: adding === "url" ? "url" : "paste",
      name: name.trim(),
      url: adding === "url" ? content.trim() : null,
      extracted_text: content.trim(),
    })
    setName("")
    setContent("")
    setAdding(null)
    setSaving(false)
    await load()
  }

  const handleRemove = async (id: string) => {
    await supabase.from("proposal_context").delete().eq("id", id)
    setSources((prev) => prev.filter((s) => s.id !== id))
  }

  if (!open) return null

  const typeIcon = (t: string) => {
    if (t === "url") return <LinkIcon className="h-3.5 w-3.5" />
    if (t === "file") return <FileText className="h-3.5 w-3.5" />
    return <Type className="h-3.5 w-3.5" />
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-4"
      style={{ background: "rgba(26, 23, 20, 0.6)", backdropFilter: "blur(4px)" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        className="w-full max-w-lg rounded-2xl border p-6"
        style={{
          background: "var(--color-cream)",
          borderColor: "var(--color-rule)",
          boxShadow: "0 4px 12px rgba(0,0,0,0.08), 0 32px 64px rgba(0,0,0,0.12)",
        }}
      >
        <div className="mb-4 flex items-center justify-between">
          <p
            className="text-[10px] uppercase tracking-[0.14em]"
            style={{ fontFamily: "var(--font-mono)", color: "var(--color-ink-mute)" }}
          >
            CONTEXT SOURCES · {sources.length}
          </p>
          <button onClick={onClose} className="transition-colors hover:opacity-70" style={{ color: "var(--color-ink-mute)" }}>
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Source list */}
        <div className="space-y-2">
          {sources.map((s) => (
            <div
              key={s.id}
              className="flex items-center gap-3 rounded-lg border px-3 py-2.5"
              style={{ borderColor: "var(--color-rule)", background: "#fff" }}
            >
              <span style={{ color: "var(--color-forest)" }}>{typeIcon(s.sourceType)}</span>
              <div className="flex-1 min-w-0">
                <p className="truncate text-[12px] font-medium" style={{ color: "var(--color-ink)" }}>{s.name}</p>
                <p className="truncate text-[10px]" style={{ color: "var(--color-ink-mute)", fontFamily: "var(--font-mono)" }}>
                  {s.sourceType.toUpperCase()}{s.fileSize ? ` · ${Math.round(s.fileSize / 1024)}KB` : ""}
                </p>
              </div>
              <button onClick={() => handleRemove(s.id)} className="shrink-0 transition-colors hover:opacity-70" style={{ color: "var(--color-ink-mute)" }}>
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>

        {/* Add new */}
        {!adding && (
          <div className="mt-4 flex gap-2">
            <button
              onClick={() => setAdding("paste")}
              className="flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[11px] font-medium transition-colors hover:opacity-70"
              style={{ borderColor: "var(--color-rule)", color: "var(--color-ink-soft)" }}
            >
              <Plus className="h-3 w-3" /> Paste text
            </button>
            <button
              onClick={() => setAdding("url")}
              className="flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[11px] font-medium transition-colors hover:opacity-70"
              style={{ borderColor: "var(--color-rule)", color: "var(--color-ink-soft)" }}
            >
              <Plus className="h-3 w-3" /> Add URL
            </button>
          </div>
        )}

        {adding && (
          <div className="mt-4 space-y-3 rounded-lg border p-4" style={{ borderColor: "var(--color-rule)" }}>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={adding === "url" ? "Source name" : "Note name"}
              className="w-full rounded-lg border bg-white/50 px-3 py-2 text-[13px] outline-none"
              style={{ borderColor: "var(--color-rule)", color: "var(--color-ink)" }}
            />
            {adding === "url" ? (
              <input
                type="url"
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="https://notion.so/..."
                className="w-full rounded-lg border bg-white/50 px-3 py-2 text-[13px] outline-none"
                style={{ borderColor: "var(--color-rule)", color: "var(--color-ink)" }}
              />
            ) : (
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="Paste call transcript, brief, or notes..."
                rows={4}
                className="w-full resize-none rounded-lg border bg-white/50 px-3 py-2 text-[13px] outline-none"
                style={{ borderColor: "var(--color-rule)", color: "var(--color-ink)" }}
              />
            )}
            <div className="flex gap-2">
              <button
                onClick={() => { setAdding(null); setName(""); setContent("") }}
                className="text-[12px] font-medium transition-colors hover:opacity-70"
                style={{ color: "var(--color-ink-mute)" }}
              >
                Cancel
              </button>
              <button
                onClick={handleAdd}
                disabled={saving || !name.trim() || !content.trim()}
                className="rounded-full px-4 py-1.5 text-[12px] font-medium transition-transform hover:scale-[1.02] disabled:opacity-40"
                style={{ background: "var(--color-forest)", color: "var(--color-cream)" }}
              >
                {saving ? "Adding..." : "Add"}
              </button>
            </div>
          </div>
        )}

        {sources.length === 0 && !adding && (
          <p className="mt-3 text-center text-[12px]" style={{ color: "var(--color-ink-mute)" }}>
            No context sources yet. Add briefs, transcripts, or URLs to help the AI understand the project.
          </p>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verify it compiles**

```bash
cd /Users/millarsmith/proposalkit && ./node_modules/.bin/tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add src/components/builder/ContextDialog.tsx
git commit -m "feat: context dialog for viewing/adding/removing context sources"
```

---

### Task 12: Rewrite BuilderHome as document-first editor

**Files:**
- Modify: `src/pages/BuilderHome.tsx` (full rewrite)
- Modify: `src/store/builderStore.ts` (add `composerVisible`, `viewport` state)

- [ ] **Step 1: Add new state to builderStore**

In `src/store/builderStore.ts`, add to the `BuilderState` interface:

```typescript
composerVisible: boolean
viewport: "desktop" | "tablet" | "mobile"
setComposerVisible: (visible: boolean) => void
setViewport: (viewport: "desktop" | "tablet" | "mobile") => void
```

Add to the store creation:

```typescript
composerVisible: true,
viewport: "desktop" as const,
setComposerVisible: (composerVisible) => set({ composerVisible }),
setViewport: (viewport) => set({ viewport }),
```

- [ ] **Step 2: Rewrite BuilderHome.tsx**

Complete rewrite. The new layout:
- Full `--color-paper` background, `pt-11` for top bar clearance
- `BuilderTopBar` at top
- Document area: centered wrapper with width controlled by `VIEWPORT_WIDTHS[viewport]`, containing `ProposalWrapper` for full-bleed WYSIWYG rendering
- `FloatingComposer` at bottom
- `SettingsPopover` anchored to settings button
- `ContextDialog` for context management
- `SendProposalDialog` for sending

Key details:
- Preserve all existing save logic (debounced autosave, Supabase upsert)
- Preserve `useBuilderStore` for proposal state management
- Preserve `BuilderPreviewContext.Provider` wrapping `ProposalWrapper` so inline editing works
- Remove: tab system (chat/settings/form), split pane, left/right layout
- Remove: engagement summary from top bar (lives on detail page now)
- Remove: inline imports of `ChatPanel`, `SettingsPanel`, `BuilderForm`
- The `ProposalWrapper` renders inside a container div whose `maxWidth` is set by `VIEWPORT_WIDTHS[viewport]` (undefined for desktop = full width)
- When `previewMode` is true, hide the composer and disable inline editing (set `isEditable: false` in `BuilderPreviewContext`)

The file should import:
```typescript
import BuilderTopBar from "@/components/builder/BuilderTopBar"
import FloatingComposer from "@/components/builder/FloatingComposer"
import SettingsPopover from "@/components/builder/SettingsPopover"
import ContextDialog from "@/components/builder/ContextDialog"
import { VIEWPORT_WIDTHS, type Viewport } from "@/components/builder/ViewportSwitcher"
import SendProposalDialog from "@/components/proposal/SendProposalDialog"
import ProposalWrapper from "@/components/proposal/ProposalWrapper"
import BuilderPreviewContext from "@/contexts/BuilderPreviewContext"
```

The existing load/save logic from the current `BuilderHome.tsx` (lines 21-175 approximately: `useParams`, `useAuth`, `useAccount`, save debouncing, `loadProposal`, `handleSave`, `initNew`, `initExisting`) should be preserved. Only the render return and tab/panel system changes.

Additionally, the autosave flow should persist chat messages to `proposal_messages`:
- On each autosave cycle, sync `chatMessages` from the store to the `proposal_messages` table
- On load (`initExisting`), fetch messages from `proposal_messages` and pass them to the store
- Map between store's `ChatMessage` type and the `proposal_messages` table columns (`role`, `content`, `section_context`, `created_at`)

- [ ] **Step 3: Verify it compiles**

```bash
cd /Users/millarsmith/proposalkit && ./node_modules/.bin/tsc --noEmit
```

- [ ] **Step 4: Visually verify** by running the dev server and navigating to an existing proposal at `/builder/:id`. Confirm: paper bg, full-width document, floating composer at bottom, top bar with title/send/settings.

- [ ] **Step 5: Commit**

```bash
git add src/pages/BuilderHome.tsx src/store/builderStore.ts
git commit -m "feat: rewrite BuilderHome as document-first editor with floating composer"
```

---

## Phase 4: Intake Flow

### Task 13: Intake page

**Files:**
- Create: `src/pages/IntakePage.tsx`
- Modify: `src/App.tsx`

- [ ] **Step 1: Write IntakePage**

Two-step page: Step 1 is context upload, Step 2 is conversational chat. After chat generates v1, navigate to `/builder/:id`.

Step 1 layout:
- Styled with Studio Editorial (cream bg, Cormorant headline, mono eyebrow)
- Drop zone for paste/URL (file upload can be added later)
- List of attached context sources
- "Skip" and "Read and continue" buttons

Step 2 layout:
- Full-screen chat UI (not the floating composer -- this is pre-document)
- AI bubbles left, user bubbles right (forest bg)
- Input composer at bottom
- AI asks follow-up questions or generates based on context + user input
- When AI generates, create the proposal in Supabase, save context sources, then navigate to `/builder/:newId`

Use `AuthLayout`-style centering for Step 1. Step 2 is a full-height chat.

- [ ] **Step 2: Update routes in App.tsx**

Replace:
```tsx
<Route path="/new" element={<WizardPage />} />
```

With:
```tsx
<Route path="/builder/new" element={<IntakePage />} />
```

Add import:
```tsx
import IntakePage from "@/pages/IntakePage"
```

Update any links to `/new` in other files (check `ProposalsDashboard.tsx` for the "New Proposal" button).

- [ ] **Step 3: Update dashboard "New Proposal" link**

In `src/pages/ProposalsDashboard.tsx`, find the "New Proposal" button/link and change its `to` from `/new` to `/builder/new`.

- [ ] **Step 4: Verify it compiles**

```bash
cd /Users/millarsmith/proposalkit && ./node_modules/.bin/tsc --noEmit
```

- [ ] **Step 5: Commit**

```bash
git add src/pages/IntakePage.tsx src/App.tsx src/pages/ProposalsDashboard.tsx
git commit -m "feat: intake page with context upload + conversational follow-up"
```

---

## Phase 5: Integration

### Task 14: AskAIGhost composer bridge

**Files:**
- Modify: `src/components/proposal/AskAIGhost.tsx`
- Modify: `src/contexts/BuilderPreviewContext.tsx`

- [ ] **Step 1: Add focusComposer to BuilderPreviewContext**

In `src/contexts/BuilderPreviewContext.tsx`, add to the interface:

```typescript
focusComposer?: (prefill?: string) => void
```

Add default to the context:
```typescript
focusComposer: undefined,
```

- [ ] **Step 2: Update AskAIGhost to use focusComposer**

In `src/components/proposal/AskAIGhost.tsx`, instead of using `setPendingChatPrompt` from the builder store, call `focusComposer` from `BuilderPreviewContext`:

```tsx
import { useBuilderPreview } from "@/contexts/BuilderPreviewContext"

// Inside the component:
const { focusComposer } = useBuilderPreview()

// On click:
onClick={() => {
  if (focusComposer) {
    focusComposer(prompt)
  }
}
```

- [ ] **Step 3: Wire focusComposer in BuilderHome**

In the rewritten `BuilderHome.tsx`, pass a `focusComposer` function into `BuilderPreviewContext.Provider` that:
1. Sets `composerVisible` to true
2. Pre-fills the composer input (pass via a new ref or state)

- [ ] **Step 4: Verify it compiles**

```bash
cd /Users/millarsmith/proposalkit && ./node_modules/.bin/tsc --noEmit
```

- [ ] **Step 5: Commit**

```bash
git add src/components/proposal/AskAIGhost.tsx src/contexts/BuilderPreviewContext.tsx src/pages/BuilderHome.tsx
git commit -m "feat: AskAIGhost buttons bridge to floating composer"
```

---

### Task 15: Snapshot-based undo

**Files:**
- Modify: `src/pages/BuilderHome.tsx` (add snapshot logic)

- [ ] **Step 1: Add snapshot functions to BuilderHome**

Before each AI edit (when a chat response is processed), save a snapshot:

```typescript
const saveSnapshot = async (trigger: string) => {
  if (!proposal.id) return
  await supabase.from("proposal_snapshots").insert({
    proposal_id: proposal.id,
    data: proposal,
    trigger,
  })
  // Prune old snapshots (keep latest 50)
  const { data: all } = await supabase
    .from("proposal_snapshots")
    .select("id")
    .eq("proposal_id", proposal.id)
    .order("created_at", { ascending: true })
  if (all && all.length > 50) {
    const toDelete = all.slice(0, all.length - 50).map((s) => s.id)
    await supabase.from("proposal_snapshots").delete().in("id", toDelete)
  }
}

const revertToLatestSnapshot = async () => {
  const { data } = await supabase
    .from("proposal_snapshots")
    .select("*")
    .eq("proposal_id", proposal.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle()
  if (data) {
    useBuilderStore.getState().setProposal(data.data as ProposalData)
    // Delete the snapshot we just reverted to
    await supabase.from("proposal_snapshots").delete().eq("id", data.id)
  }
}
```

Pass `onRevert={revertToLatestSnapshot}` and `canRevert={true}` to `FloatingComposer`.

- [ ] **Step 2: Verify it compiles**

```bash
cd /Users/millarsmith/proposalkit && ./node_modules/.bin/tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add src/pages/BuilderHome.tsx
git commit -m "feat: snapshot-based undo for AI edits"
```

---

## Phase 6: Cleanup

### Task 16: Delete old components and update routes

**Files:**
- Delete: `src/pages/WizardPage.tsx`
- Delete: `src/pages/AccountSettingsPage.tsx`
- Delete: `src/pages/TeamMembersPage.tsx`
- Delete: `src/components/builder/ChatPanel.tsx`
- Delete: `src/components/builder/SettingsPanel.tsx`
- Delete: `src/components/builder/BuilderForm.tsx`
- Delete: `src/components/builder/BuilderField.tsx`
- Delete: `src/components/builder/ChatMessageBubble.tsx`
- Delete: `src/components/builder/SuggestionChip.tsx`
- Delete: `src/components/builder/ChatDiff.tsx`
- Delete: `src/components/builder/sections/BuilderSectionContext.tsx`
- Delete: `src/components/builder/sections/BuilderSectionInvestment.tsx`
- Delete: `src/components/builder/sections/BuilderSectionMeta.tsx`
- Delete: `src/components/builder/sections/BuilderSectionScope.tsx`
- Delete: `src/components/builder/sections/BuilderSectionSummary.tsx`
- Delete: `src/components/builder/sections/BuilderSectionTimeline.tsx`
- Modify: `src/App.tsx` (remove old imports)

- [ ] **Step 1: Delete files**

```bash
cd /Users/millarsmith/proposalkit
rm src/pages/WizardPage.tsx
rm src/pages/AccountSettingsPage.tsx
rm src/pages/TeamMembersPage.tsx
rm src/components/builder/ChatPanel.tsx
rm src/components/builder/SettingsPanel.tsx
rm src/components/builder/BuilderForm.tsx
rm src/components/builder/BuilderField.tsx
rm src/components/builder/ChatMessageBubble.tsx
rm src/components/builder/SuggestionChip.tsx
rm src/components/builder/ChatDiff.tsx
rm -rf src/components/builder/sections/
```

- [ ] **Step 2: Clean up imports in App.tsx**

Remove any remaining imports of deleted files. Remove the old lazy imports for `AccountSettingsPage` and `TeamMembersPage` if they still exist. Remove the `WizardPage` import.

- [ ] **Step 3: Search for broken imports across the codebase**

```bash
cd /Users/millarsmith/proposalkit && grep -r "WizardPage\|ChatPanel\|SettingsPanel\|BuilderForm\|BuilderField\|ChatMessageBubble\|SuggestionChip\|ChatDiff\|BuilderSection" src/ --include="*.tsx" --include="*.ts" -l
```

Fix any remaining references.

- [ ] **Step 4: Verify it compiles**

```bash
cd /Users/millarsmith/proposalkit && ./node_modules/.bin/tsc --noEmit
```

- [ ] **Step 5: Verify the build succeeds**

```bash
cd /Users/millarsmith/proposalkit && npm run build
```

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "chore: remove old split-pane builder components and wizard"
```

---

## Phase 7: Final verification

### Task 17: End-to-end visual verification

- [ ] **Step 1: Start dev server**

```bash
cd /Users/millarsmith/proposalkit && npm run dev
```

- [ ] **Step 2: Verify each page visually using Playwright**

Check these routes (use real pointer clicks, not JS `.click()`):

1. `/settings` — cream bg, horizontal tabs, Account tab active
2. `/settings/team` — team list, invite section
3. `/builder/new` — intake page with context upload
4. `/builder/:id` — document-first builder with floating composer, top bar, settings popover
5. `/proposals/:id` — delete dialog works with "type DELETE"
6. `/404-anything` — Studio Editorial not-found page

- [ ] **Step 3: Run production build**

```bash
cd /Users/millarsmith/proposalkit && npm run build
```

- [ ] **Step 4: Push to main**

```bash
git push origin main
```

- [ ] **Step 5: Verify on production** at `https://proposl.app` after Vercel deploy completes.
