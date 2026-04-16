# Editor Overhaul + App-Wide Design Language

**Date:** 2026-04-15
**Status:** Design approved, pending implementation plan

## Overview

Rethink the Proposl editor from a split-pane form-based builder into a document-first, AI-native editing experience. The proposal itself fills the screen. Editing happens through inline text editing (click to type) and a floating AI chat composer (Cursor-style). Settings, context, and configuration live behind lightweight popovers. The old WizardPage, ChatPanel, SettingsPanel, and BuilderForm tabs are all replaced.

Simultaneously, apply the Studio Editorial design language to every remaining app page: the settings shell (account + team), and fix outstanding bugs (delete dialog).

## 1. Design Language Reference

All surfaces use the Studio Editorial token system already established on the dashboard, detail page, auth pages, and landing page:

- **Fonts:** Cormorant Garamond (display/headings), Satoshi (body), IBM Plex Mono (labels/metadata/eyebrows)
- **Colors:** `--color-cream` (#FAF8F3) bg, `--color-paper` (#F4F1E8) secondary bg, `--color-ink` (#1A1714), `--color-forest` (#2C4A3F) accent, `--color-forest-deep` (#1F3830), `--color-ochre` (#C9922C), `--color-ink-soft`, `--color-ink-mute`, `--color-rule` (#D8D2C4)
- **Patterns:** Mono eyebrow labels (uppercase, 10-11px, tracked), Cormorant headlines, rounded-full pill buttons with forest bg, cream cards with rule borders, rounded-2xl containers

## 2. Intake Flow (replaces WizardPage)

**Route:** `/builder/new` (replaces current wizard)

### Step 1: Context upload

Full-page screen styled with Studio Editorial. Layout:

- **Eyebrow:** `CONTEXT` (mono, ink-mute)
- **Headline:** "What should I read first?" (Cormorant)
- **Subhead:** "Drop in the brief, call transcripts, Notion pages, anything. I'll read it all before asking you anything." (Satoshi)
- **Drop zone:** Dashed border, centered `+` icon, accepts file drop, paste, or URL input
- **Supported formats:** PDF, DOCX, TXT, Notion URLs, Google Docs URLs, pasted text
- **Attached items:** Listed below the drop zone as cards with dot indicator, filename, type badge, and remove button
- **Footer:** "Skip -- start from scratch" link (left), "Read and continue" pill button (right)

Context is stored in the proposal record (new `context_sources` JSONB column on `proposals` table) so it persists and can be referenced throughout editing.

### Step 2: Conversational follow-up

After the user hits "Read and continue" (or "Skip"), they land in a dedicated full-screen chat view (not the builder yet -- the document doesn't exist until the AI generates v1):

- AI reads all attached context first
- AI asks follow-up questions one at a time, adapting based on what the context already covered
- With rich context (brief + transcript), the AI may skip straight to: "Here's what I got from the brief. Anything I should know that wasn't in there?"
- With no context (skipped), the AI asks: "Who's the client?", "What's the scope?", "Budget range?", "Timeline?" etc.
- The user can also just type a freeform prompt like "Proposal for Cherry Pao Pao, restaurant rebrand, 8 weeks, 25k"
- At any point the user can say "go" or "generate" and the AI produces v1

### Transition to builder

Once the AI generates the first draft, the screen transitions to the builder with the document rendered and the floating composer showing the generation result. The user is not locked into the intake output -- everything is editable from here.

## 3. Builder (replaces BuilderHome split-pane)

**Route:** `/builder/:id`

### 3.1 Layout

The builder is a single full-width surface:

- **Background:** `--color-paper` (#F4F1E8)
- **Top bar:** Fixed at top, cream bg, full width
- **Document:** Centered, max-width ~680px, white bg, rule border, rounded corners. Rendered proposal sections scroll vertically. This is the actual proposal content (HeroSection, SummarySection, ScopeSection, etc.) rendered exactly as a client would see it, but with inline editing enabled.
- **Floating composer:** Fixed at bottom center, ~520px wide, cream bg, rule border, rounded-xl, drop shadow. Contains a single-line input that expands to show conversation history when active.

### 3.2 Top bar

Left to right:

| Element | Behavior |
|---|---|
| Proposl mark (← back) | Navigates to `/proposals` (dashboard) |
| Proposal title | Inline-editable text field. This is `proposals.title` (the admin/email title), separate from the hero tagline |
| Status badge | DRAFT / SENT / etc. Mono, uppercase, 9px, colored dot |
| Context button | Opens context dialog (same layout as intake Step 1) to view/add/remove context sources |
| Settings button | Opens settings popover (see 3.4) |
| Preview toggle | Hides the floating composer for a clean document preview. Label: "Preview" / "Edit" toggle |
| Send button | Primary pill (forest bg), opens SendProposalDialog |

Styled: cream bg, rule bottom border, compact (44px height). All text in Satoshi/mono.

### 3.3 Floating composer

The primary AI interaction surface. Inspired by Cursor's command bar.

**Collapsed state (default):**
- Single input row: sparkle icon, "Ask AI anything, or Cmd+K for commands..." placeholder, send button (forest pill)
- Attach button (paperclip) for inline file/URL attachment
- Sits 16px above the bottom of the viewport
- Cream bg, rule border, rounded-xl, elevated shadow

**Expanded state (on focus or when conversation is active):**
- Input row stays at bottom
- Conversation history scrolls above (AI bubbles left-aligned in paper bg, user bubbles right-aligned in forest bg)
- Max height ~50% of viewport, scrollable
- Dashed rule separates history from input

**Dismiss:**
- Small X button on the composer, or click "Preview" in the top bar
- Cmd+K toggles the composer back on
- When dismissed, a small floating "Ask AI... (Cmd+K)" pill remains at bottom-right as a re-entry point

**Capabilities:**
- Text prompts for editing ("rewrite the scope section", "add a timeline deliverable", "make it more concise")
- File/URL attachment (same as intake -- adds to persistent context)
- Section-aware: if the user has clicked into a section (via inline editing), the composer is contextually aware of which section is active
- Streaming responses with real-time document updates

### 3.4 Settings popover

Triggered by "Settings" button in top bar. Opens as a popover (not a full panel) anchored to the button.

**Contents:**

- **Brand colors:** Two color pickers for `brand_color_1` and `brand_color_2`
- **Client name:** Text input
- **Proposal slug:** Text input with `/p/` prefix shown
- **CTA email:** Email input (pre-filled from account default)
- **Password gate:** Toggle switch + password input (shown when enabled)
- **Section order:** Compact list of sections with drag handles (dnd-kit), add/remove buttons. Sections: hero, summary, scope, timeline, investment, cta

**Styling:** Cream bg, rule border, rounded-xl, max-width ~340px, shadow. Labels in mono uppercase. Inputs match AuthInput style.

### 3.5 Inline editing

The existing `InlineEditable` component continues to work. When the user clicks text in the rendered proposal (headings, descriptions, deliverable names, etc.), it becomes editable in place. Changes update the proposal data via `updateAtPath`.

Inline editing and the floating composer coexist naturally: click to fix a typo, use the composer to rewrite a whole section.

### 3.6 Section management

Sections in the document get hover-triggered toolbars (the existing `SectionToolbar` pattern):

- **Drag handle:** Reorder sections by dragging
- **Add section:** Insert a new section above/below
- **Delete section:** Remove the section (with confirmation)

This is the primary section management surface. The settings popover section list is a secondary fallback.

### 3.7 What gets deleted

The following components are replaced and can be removed:

| Component | Replaced by |
|---|---|
| `WizardPage.tsx` (443 lines) | Intake flow (Step 1 + Step 2) |
| `ChatPanel.tsx` (202 lines) | Floating composer |
| `SettingsPanel.tsx` (226 lines) | Settings popover |
| `BuilderForm.tsx` (53 lines) | Settings popover + inline editing |
| `BuilderField.tsx` (17 lines) | Settings popover inputs |
| `ChatMessageBubble.tsx` | Floating composer message bubbles |
| `SuggestionChip.tsx` | Floating composer (suggestions as AI messages) |
| `ChatDiff.tsx` | Floating composer (diffs shown inline in document) |

`BuilderHome.tsx` itself gets rewritten from scratch rather than incrementally modified. The new version is structurally different (no left/right pane split, no tab system).

## 4. Settings Shell (new)

**Route:** `/settings` with sub-routes `/settings/account` and `/settings/team`

### 4.1 Shell layout

- Cream bg full page
- Proposl mark top-left (links to dashboard)
- Horizontal tab bar beneath the header with tabs: **Account** / **Team**
- Active tab content renders below
- Extensible for future tabs (Billing, Integrations, etc.)

Styled like the auth pages: centered max-width container (~640px), Cormorant headline, Satoshi body, mono labels.

### 4.2 Account tab (replaces AccountSettingsPage)

Rewrite of the current 327-line page with Studio Editorial tokens. Same fields:

- Studio/agency name
- Legal entity
- Website
- Notification email (with "WHERE SUBMISSIONS ARE SENT" helper)
- CC email
- Default CTA email (with "PRE-FILLED ON NEW PROPOSALS" helper)
- Save button (forest pill)

### 4.3 Team tab (replaces TeamMembersPage)

Rewrite of the current 366-line page. Same functionality:

- Member list with name, email, role badge (OWNER / MEMBER), joined date
- Invite button opens invite dialog
- Remove member (with confirmation)
- Pending invites section with resend/revoke actions

## 5. Bug Fixes

### 5.1 Delete dialog (ProposalDetailPage)

**Problem:** The `DeleteConfirmDialog` asks users to type the client name to confirm, but:
1. The label says `TYPE "{clientName.toUpperCase()}"` (uppercase), while the match check compares against the original case -- so typing what the label says never matches
2. When `clientName` is empty/missing, the dialog asks you to type nothing

**Fix:** Change confirmation to `TYPE "DELETE" TO CONFIRM` with a case-insensitive match against the literal string "delete". Stable, always works, no dependency on proposal data.

## 6. Pages Audit Summary

| Page | Current state | Action |
|---|---|---|
| LandingPage | Studio Editorial | No changes |
| LoginPage | Studio Editorial | No changes |
| SignupPage | Studio Editorial | No changes |
| ResetPasswordPage | Studio Editorial | No changes |
| OnboardingPage | Studio Editorial | No changes |
| InviteAcceptPage | Studio Editorial | No changes |
| ProposalsDashboard | Studio Editorial | No changes |
| ProposalDetailPage | Studio Editorial | Fix delete dialog only |
| DeletedProposalsPage | Studio Editorial | No changes |
| WizardPage | Old shadcn | Delete, replace with intake flow |
| BuilderHome | Old shadcn | Full rewrite as document-first builder |
| AccountSettingsPage | Old shadcn | Rewrite inside settings shell |
| TeamMembersPage | Old shadcn | Rewrite inside settings shell |
| NotFound | Unknown | Apply Studio Editorial if not already |
| ProposalViewer | Client-facing | No changes (different design language) |

## 7. Data Model Changes

### New table: `proposal_context`

Each context source is its own row so the user can see, add, and remove individual items at any time.

```sql
CREATE TABLE proposal_context (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  proposal_id UUID NOT NULL REFERENCES proposals(id) ON DELETE CASCADE,
  source_type TEXT NOT NULL CHECK (source_type IN ('file', 'url', 'paste')),
  name TEXT NOT NULL,
  url TEXT,                    -- for source_type = 'url'
  file_size INTEGER,           -- for source_type = 'file', in bytes
  extracted_text TEXT NOT NULL, -- text content the AI can reference
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_proposal_context_proposal ON proposal_context(proposal_id);
```

- Each row is one context source (a file, a URL, or pasted text)
- `extracted_text` is the parsed content (not the original binary) so the AI can reference it throughout editing
- RLS scoped by account_id via the parent proposal
- The UI shows these as a clear list: name, type badge, size, added date, remove button

## 8. Out of Scope

- Proposal section components (HeroSection, ScopeSection, etc.) -- these are client-facing and use a different design language
- ProposalViewer (the `/p/:slug` client view)
- Landing page hero screenshot (separate task, needs curation)
- Email templates in edge functions
- Open tracking / reminder sequences
- Billing / subscription (future settings tab)
