# Proposl improvements from the Jan & Jul dogfood (2026-07-05)

> **Status (build-out session, 2026-07-05, branch `claude/focused-ptolemy-57c455`)**
>
> | Item | Linear | State |
> | --- | --- | --- |
> | Bug 1: chat truncation | INT-14 | Code complete, verified |
> | Bug 2: paste-text context source | INT-15 | Code complete; migration pending `supabase db push` |
> | Bug 3: CTA not editable | INT-16 | Code complete, verified |
> | Bug 4: "+-CA$" credits render | INT-17 | Code complete, verified |
> | A1 verbatim import | INT-18 | Code complete, verified (45K-char round trip, byte-identical) |
> | A2 custom sections | INT-19 | Code complete, verified |
> | A3 workspace next-steps default | INT-20 | Code complete; needs post-deploy round-trip QA |
> | A4 first-class credits | INT-21 | Code complete, verified |
> | A5 workspace writing rules | INT-22 | Code complete; prompt guardrail included |
> | A6 package validity/price lock | INT-23 | Code complete, verified |
> | A7 undo/version history check | INT-24 | Answered below (history exists; INT-1 caveat) |
> | A8 local /api dev | INT-25 | Code complete, verified, README'd |
> | B Proposl MCP server v1 | INT-26 | Code complete; 26/26 harness checks pass; needs api_tokens migration on deploy |
>
> Deploy steps: merge the branch, `supabase db push` (staging, then prod) for the three new migrations (proposal_context relax, account columns, api_tokens), then the post-deploy QA listed on the tickets.

Source: Claude built a full client proposal (18 sections, 2 packages, add-ons, credits, retainer) in the Proposl builder via browser automation, driving the builder AI chat. This doc captures everything that fought back. It is the companion to the four bugs already being fixed in the bug-fix session:

1. Builder AI chat silently truncates input around ~2,500 characters (no error, content just cut mid-sentence)
2. Context sources "Paste text" modal fails silently (shows 0 SOURCES after Add, reproduced twice)
3. Bottom CTA block is a fixed template ("Review and sign the Master Services Agreement"), not editable via the builder AI
4. Credits modeled as negative add-ons render as "+-CA$1,500"

Everything below is additional scope, roughly in priority order.

---

## A. Feature and UX improvements

### A1. Verbatim content import (highest value)
**What happened:** the only way to load prepared copy was the AI chat. With the ~2.5K truncation, an 18-section proposal had to be fed in 16 chunks with a "reply only 'ready'" protocol. Even then the AI paraphrased, dropped two sections, and renamed the proposal with an em dash. Corrective messages fixed it, but fidelity was never guaranteed.
**Build:** an import path that accepts a structured markdown document (e.g. `## SECTION: <name>` headings) and maps it to proposal sections one to one, with zero AI rewriting. Show a mapping preview (which heading lands in which section), then apply verbatim. File upload or large paste, no length ceiling.
**Done when:** a 20K-character markdown doc round-trips into a proposal with byte-identical section content.

### A2. Flexible section schema
**What happened:** the fixed schema (summary / scope / timeline / investment / CTA) forced 18 logical sections to be squeezed and concatenated into 5 slots.
**Build:** custom sections: add, remove, rename, reorder. Keep the special-behavior blocks (investment, CTA) as typed sections; everything else is free-form.

### A3. Editable next-steps / CTA templates
**What happened:** bug 3 above is the symptom. The feature is: per-workspace and per-proposal next-steps templates. Tomorrow Studios closes with PandaSign and a "build agreement" signed after a requirements phase; "Master Services Agreement" is wrong for every TS proposal, not just this one.
**Build:** CTA block content editable like any section, with a workspace default template. Later: e-signature link field (PandaSign now, provider-agnostic).

### A4. First-class credits ("your team owns this work")
**What happened:** carve-out credits (client's in-house team takes static pages, design, marketing tags; price drops accordingly) had to be faked as negative-price add-ons, which produced the "+-CA$" render and fragile totals.
**Build:** a native line-item type `credit`: label, negative amount rendered as "Credit: -CA$1,800" (or brand-appropriate formatting), optional note (e.g. "we keep migration, code, and QA"), correct totals math when toggled. This is a core agency pattern, worth productizing rather than just fixing the render.

### A5. Workspace writing rules for the builder AI
**What happened:** the builder AI injected an em dash into the proposal title. Tomorrow Studios has a hard no-em-dash rule and a defined register (professional, no slang, full forms in commitments).
**Build:** a workspace-level "writing rules" text field injected into the builder AI's system prompt. Simple v1: free text, applied to every generation. Also enforce: the AI must never rename a proposal or restructure sections unless explicitly asked (fidelity guardrail).

### A6. Package-level validity and price-lock metadata
**What happened:** the J&J deal uses an event-based price lock ("retail price held through the wholesale build") and a proposal-level expiry (July 31). Both had to be hand-written into body copy.
**Build:** optional per-package fields: valid-until date OR free-text lock condition, rendered on the package card. Proposal-level expiry stays as the default.

### A7. Check: undo / version history for AI edits
**What happened:** AI edits were only recoverable by asking the AI to re-edit. Not verified whether a history exists; if it does not, even a linear snapshot-per-AI-turn with restore would make the builder chat safe to experiment in.

**Answer (verified 2026-07-05, INT-24):** history exists and is exactly the shape wished for here.
- A snapshot is written to `proposal_snapshots` before each AI edit batch applies (trigger `ai-edit`, `BuilderHome.saveSnapshot`, `src/pages/BuilderHome.tsx`).
- One-click revert to the last pre-AI state: `revertToLatestSnapshot` (the "Revert last change" affordance in the floating composer). The revert itself snapshots first, so it is undoable.
- `HistoryPopover` restores any of the recent versions (capped at 200 stored).
- Cmd+Z / Cmd+Shift+Z undo-redo also covers AI edits in-session (each batch pushes one undo entry).

**Caveat that makes this a live issue anyway:** INT-1 reports `proposal_snapshots` inserts storming 403s on prod during AI drafts. If those inserts fail, every layer above quietly loses its restore points. The UI existed all along; it may not have been persisting on prod. Fix INT-1 before trusting history in production. During the J&J session the revert affordance also only appears in the floating composer after an AI reply with edits, which is easy to miss; worth a UX pass once INT-1 lands.

### A8. DX: builder AI unusable in local dev
**What happened (known issue):** `vite dev` does not serve `/api/chat`, so builder-AI work requires a Vercel preview deploy per iteration.
**Build:** `vercel dev` docs in the README, or a vite proxy config that forwards `/api/*` to a local handler or a designated preview URL. This directly speeds up the bug-fix session's own loop.

---

## B. Proposl MCP server (proposed, new workstream)

**Goal:** let Claude (Code and claude.ai) read and write proposals directly through tools instead of browser automation of the builder UI. In the J&J build this would have replaced a multi-hour chunked-chat browser session with roughly eight tool calls, and it makes post-meeting price adjustments a two-minute edit. It is also a customer-facing differentiator: agencies running Claude can drive their proposals from their own sessions.

### Architecture
- **Transport:** remote MCP over streamable HTTP, hosted in the existing Vercel app (e.g. `/api/mcp`) using the Vercel MCP adapter (`mcp-handler`) or the official TypeScript SDK. Alternative: a Supabase Edge Function (remember `--no-verify-jwt` on deploy); Vercel preferred since `/api` already exists and the domain is proposl.app.
- **Auth v1:** per-user API token, generated in app settings, stored hashed in Supabase, sent as a bearer header. Server resolves the token to a user and uses an RLS-scoped Supabase client so tools inherit workspace boundaries. OAuth 2.1 later if this ships to customers.
- **Client setup:** `claude mcp add --transport http proposl https://proposl.app/api/mcp --header "Authorization: Bearer <token>"`.

### v1 tool surface (small on purpose)
| Tool | Purpose |
| --- | --- |
| `list_proposals` | id, title, client, status, updated_at |
| `get_proposal` | full section tree + investment config as JSON |
| `create_proposal` | title, client, optional template |
| `set_section_content` | verbatim write by section id (no AI in the loop) |
| `set_investment` | packages, add-ons, credits, retainer, validity/lock fields |
| `set_next_steps` | CTA block content (depends on A3) |
| `add_context_source` | text or file source (bypasses the broken modal) |
| `get_preview_url` | shareable draft preview link |

**Deliberately excluded from v1:** `send_proposal`. Sending is outward-facing; keep it a human action in the UI for now. If added later, it must require an explicit confirmation parameter and should be a separate permission.

### Rollout
1. Internal token for the Tomorrow Studios workspace, dogfood on the next live deal.
2. Harden (rate limits, audit log of tool writes on the proposal timeline).
3. Optional: publish as a Proposl feature with OAuth.

**Note:** the MCP does not replace the A-items. Human users still hit the chat truncation, the fixed CTA, and the credits render; those fixes stand on their own.
