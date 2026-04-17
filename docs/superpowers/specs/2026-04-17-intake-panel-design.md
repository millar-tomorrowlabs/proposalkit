# Intake Panel Redesign (Option C)

**Status:** Design approved, pending implementation plan
**Date:** 2026-04-17
**Scope:** Replace the current `IntakeHero` + floating `FloatingComposer` (centered) intake experience with a unified "intake panel" — a single bordered surface that contains the AI conversation and the composer, with the hero text living above it.

## Problem

The current intake renders two independent surfaces in the same vertical band of the viewport:

1. `IntakeHero` — vertically centered hero text ("What are we proposing?") with hint copy and "Attach context" / "Skip" buttons.
2. `FloatingComposer` — the global chat composer, positioned at `bottom-[30vh]` in "center" mode during intake.

As the conversation grows, the floating composer's expandable message history panel expands upward and collides with the hero text. The two elements occupy the same visual band and fight for space. The separation between "document" (hero) and "chat" (composer) also misrepresents the intake: the AI conversation *is* the intake — it's not a separate utility hovering over a document.

## Goals

1. A single visual surface owns the intake conversation — no floating-over-hero collision.
2. The multi-turn chat pattern is preserved and made more conversational — the AI should ask for all key information (timeline, budget, client, scope) that's not already supplied via uploaded context, and should signal when it's ready to draft.
3. Uploading context is positioned as the preferred starting move, because better inputs → better first draft.
4. Drafting gets triggered conversationally by default (AI judges affirmation), with a structured fallback (AI emits a marker that renders a "Draft v1" button) and a persistent escape chip for users who want to skip ahead.
5. The whole thing looks and feels like the rest of Proposl — Studio Editorial tokens (cream / paper / forest / ink, Cormorant + Satoshi + Plex Mono), not a generic SaaS chat widget.
6. Mobile-first responsive behavior — panel goes full-width, chips stack, max-height adapts to viewport.
7. Intake conversation survives accidental reloads via localStorage persistence.

## Non-goals

- Replacing the floating composer in the editor (post-draft) view. The floating composer keeps its current behavior once the proposal has any content.
- Changing the `DraftingReveal` overlay or the drafting→editor transition. Those stay as-is.
- Redesigning the context dialog (`ContextDialog`). We still open it for file/URL uploads, but we surface attached context more prominently in the intake panel.

## Design

### Layout

```
┌───────────────────────── top bar ─────────────────────────┐

                        NEW PROPOSAL
                  What are we proposing?         ← hero, dims + shrinks
                                                   once chat begins

  ┌────────────────── intake panel ──────────────────┐
  │  CONTEXT  [flush-brief.pdf]              + ADD   │  ← only when
  │ ─────────────────────────────────────────────── │    context attached
  │  (scrollable messages, oldest fade out at top)   │
  │  ┌────────────────────────────────┐              │
  │  │ AI: Tell me about the project… │              │  ← AI greeting
  │  └────────────────────────────────┘              │    is seeded when
  │                                                  │    panel mounts
  │         ┌──────────────────────────────┐         │
  │         │ USER: E-commerce for Flush…  │         │
  │         └──────────────────────────────┘         │
  │  ┌────────────────────────────────┐              │
  │  │ AI: What's the timeline?       │              │
  │  └────────────────────────────────┘              │
  │ ─────────────────────────────────────────────── │
  │  ✦  Reply…                            📎   ↑    │  ← composer
  │                                                  │    pinned to
  │                                                  │    panel bottom
  └──────────────────────────────────────────────────┘

        [ ATTACH CONTEXT ]   [ SKIP · START BLANK ]    ← persistent chips
                                                         below panel;
                                                         right chip
                                                         changes copy
                                                         based on state
```

### Key surfaces and behavior

**Hero**
- Renders at top of the intake view, above the panel.
- Copy preserved: `NEW PROPOSAL` mono label, "What are we proposing?" serif headline.
- Sub-copy (today's "Describe the project in the chat below, or attach a brief…") is removed — that guidance now lives in the AI's seeded greeting inside the panel.
- On conversation start (first user message sent), hero transitions to a dimmed + shrunk state: reduced font size (roughly 22px vs 56px), opacity 0.45, no sub-copy. Stays visible but visually demoted so the chat is clearly the focus.
- Hero does not pin — it scrolls with page content. On a long enough conversation the user can scroll past it.

**Panel**
- One bordered, rounded, shadowed surface (`var(--color-paper)` background, `var(--color-rule)` border, 16px radius, existing soft shadow treatment).
- Centered on page, max width 640px on desktop; full-width (minus 16px side margin) on mobile.
- Max-height: `min(55vh, 520px)` on desktop, `min(60vh, 420px)` on mobile. See Responsive section.
- Internally flex column: optional context header → scrollable messages → composer footer.

**Context header (conditional)**
- Only renders when `contextSources.length > 0`.
- Shows `CONTEXT` mono label, chips for each source (file name / URL), and a `+ ADD` action that opens `ContextDialog`.
- Adding context after the conversation has started does not reset the conversation; the AI can reference new context in its next turn via the existing system prompt pipeline.

**Messages**
- Scrollable container, oldest messages scroll off the top when content exceeds the max height.
- Soft linear-gradient fade at top indicates hidden content.
- Auto-scrolls to latest message on new content (same as today's `FloatingComposer` behavior).
- Seeded AI greeting: when the panel first mounts for an empty proposal and localStorage has no prior conversation, a hardcoded assistant message renders before the user has sent anything — copy along the lines of "Tell me about the project — the client, what they're trying to do, anything you already know. If you've got a brief or a call transcript, attach it and I'll work from there."
  - This seeded greeting is UI-only. It does not get sent to the model. Once the user sends a message, the seeded greeting is replaced by the real assistant/user transcript.
- Message bubble styling matches the current floating composer: user messages use `var(--color-forest)` background + cream text, assistant uses `var(--color-paper)` + rule border + ink text.

**Composer**
- Pinned to panel bottom, above a rule border.
- Textarea auto-grows (same behavior as current `FloatingComposer`, capped around 80–120px then scrolls internally).
- `✦` accent on left (forest), paperclip button (opens `ContextDialog`), send button (forest circle with `↑`).
- Placeholder changes based on state: empty ("Describe the project…") vs mid-conversation ("Reply…").

**Below-panel chips**
- Two mono-label chips rendered as a row under the panel, centered.
- Left chip: `ATTACH CONTEXT` — opens `ContextDialog`. Copy shifts to `ADD MORE CONTEXT` once sources exist. Gets soft bordered chip treatment (paper bg, rule border).
- Right chip: `SKIP · START BLANK` before first message, `DRAFT NOW` once the conversation has started. Unbordered / ghost chip treatment. Triggers the same drafting flow as today's "Skip" path (sends `autoSendChatPrompt = "Skip the questions and draft v1 with whatever you have."` then `setIsDrafting(true)`).

### Draft trigger — three reinforcing paths

The goal is a conversational trigger with a reliable structured fallback. We don't want fragile keyword matching ("did the user actually mean 'go'?"), but we also don't want to force every user through a button click. The AI judges, and the AI itself emits the structured signal when it decides the user is ready.

**Path A — natural language, interpreted by the AI (primary):**
- User says anything that signals approval: "go", "yes", "sounds good", "let's do it", "build it", etc.
- Because the affirmation is interpreted by the model (not regex-matched in the client), nuance works: "sure go for it" lands, "yes that summary is right but I want to add X" doesn't.
- The model's next turn either (a) starts the `proposal-edits` JSON block immediately, or (b) acknowledges and asks one last clarifying question before drafting.
- System prompt directs: when you judge go-ahead has been given, start drafting. Do not re-confirm.

**Path B — structured action button emitted by AI (fallback):**
- When the AI decides it has enough info, its assistant message ends with a parseable trailer marker. Proposed syntax: a line containing only `[[DRAFT_READY]]` at the end of the message.
- Client renders the assistant message with the marker stripped from the visible text, and shows a primary "Draft v1" button attached to that message bubble.
- Clicking the button sends a synthetic user message ("go ahead and draft") which routes through Path A. One code path triggers drafting, not two.
- This is the robustness net: if the user is hesitant to type, or wants to click away from the keyboard, the button is there. It's also useful while streaming — the marker can appear late in the AI's turn, so the button materializes when the AI reaches its ready state.

**Path C — persistent escape chip (always available):**
- `DRAFT NOW` chip below the panel. Always clickable. Bypasses the conversational handshake entirely.
- Used when user wants to skip even the AI's approval step (e.g. they know exactly what they want, or they're impatient).
- Sends the same "skip the questions and draft v1 with whatever you have" prompt as today's skip path.

All three paths converge on the same client action: `setIsDrafting(true)` + send the synthetic user affirmation so the AI's next turn emits `proposal-edits`.

### System prompt changes (api/chat.ts)

The intake system prompt today doesn't reliably ask for timeline or budget; the user reported that test intakes shipped to draft without those being captured, and the AI guessed. New requirements for the system prompt, to be worked out in the implementation plan:

1. **Checklist of information the AI should aim to gather before drafting:** client name + industry, primary objective / outcomes the client wants, scope / deliverables, timeline (including any hard dates), budget range, decision-maker, any attached context the AI should anchor the draft in.
2. **Check uploaded context before asking.** If a brief / transcript already answers a checklist item, the AI should not ask it again — acknowledge and move on.
3. **Conversation, not interview.** Ask one question at a time. Respond to what the user said before asking the next thing. If the user gives incomplete information and says "just draft it", take a stab with explicit flags.
4. **Signal readiness explicitly.** When the checklist is complete (or the user waives remaining items), the AI emits a "ready when you are" style message and appends the `[[DRAFT_READY]]` marker on its own line at the end of the message. The marker powers Path B (see Draft trigger section). System prompt defines the marker format exactly so the client's parser is deterministic.
5. **Interpret user affirmation directly.** When the AI judges the user has given go-ahead (Path A), its next turn starts the `proposal-edits` block immediately. No re-confirmation, no new questions unless something critical is missing.
6. **Seeded greeting handling.** The greeting is UI-only and never sent to the model. The system prompt is unaware of the greeting text; the first turn the model actually sees is the user's first real message.

This prompt work is part of the same feature but called out as its own workstream because it's behavioral tuning that will need iteration after the UI ships.

### Component structure

New component: `src/components/builder/IntakeScreen.tsx`
- Props: same inputs as the current intake integration — `messages`, `loading`, `onSend`, `pendingPrompt`, `onClearPendingPrompt`, `onAttach`, `onStartDraft` (triggers the "skip to draft" path), `contextSources`, `onOpenContext`.
- Owns the hero + panel + chips layout.
- Internally composes three presentational children: `IntakeHero` (stripped-down), `IntakePanel` (messages + composer), `IntakeFooterChips`.
- Does not use `FloatingComposer` at all — the panel's composer is its own textarea.

Changes to `src/pages/BuilderHome.tsx`:
- When `isProposalEmpty`, render `<IntakeScreen … />` instead of `IntakeHero`.
- When `isProposalEmpty`, do not render `FloatingComposer` at all — the intake panel owns the chat. (Preview mode and post-draft states keep `FloatingComposer`.)
- Pass existing `sendMessage`, `uiMessages`, `isStreaming`, `pendingChatPrompt`, `autoSendChatPrompt`, `contextSources` into the `IntakeScreen`.
- The existing `DraftingReveal` overlay still mounts when `isDrafting` flips true; no change.

Changes to `src/components/builder/FloatingComposer.tsx`:
- Remove `position="center"` code path. The prop is no longer needed — `FloatingComposer` is only used in post-draft editor contexts, which always want `bottom-4`. Simplify the component by dropping the prop.

### Responsive / mobile

Breakpoint: Tailwind `sm` (640px). Below that, the intake collapses to a mobile-first layout.

- **Panel width:** full-width with 16px side margin on mobile; caps at ~640px on desktop.
- **Hero headline:** 32px on mobile, 56px on desktop (matches the existing responsive step on `IntakeHero`). Keep `leading-[1.05]`.
- **Chips row:** horizontal on desktop, stacks vertically on mobile with `flex-col gap-2`. Both chips remain full-width tap targets.
- **Panel max-height:** `min(60vh, 420px)` on mobile to account for browser chrome eating viewport; `min(55vh, 520px)` on desktop.
- **Context chip row (when attached):** on mobile, enable horizontal scroll (`overflow-x-auto`) so many attached sources don't wrap onto multiple rows and eat vertical space.
- **Textarea initial height:** slightly tighter on mobile (36px vs 44px) to leave more visible message area.
- **Composer send/paperclip buttons:** scale up to 32px tap targets on mobile (iOS guidance ≥44×44; 32 + surrounding padding hits that).

### Persistence (localStorage)

The intake conversation is ephemeral today — a page refresh loses everything. For a brief to take 10 minutes of back-and-forth and then evaporate on accidental reload is painful. Add simple localStorage persistence so the current intake survives reloads, scoped to the browser/device.

- **Key:** `proposl:intake:${proposalId}` where `proposalId` is the current proposal's id. New proposals always have an id at mount time (the route creates the proposal first), so this is defined.
- **Shape:** `{ messages: UIMessage[], savedAt: number }`.
- **Write:** `useEffect` on `uiMessages` changes, debounced 200ms. Write-through; no optimistic split.
- **Read:** on `IntakeScreen` mount, hydrate `useChat`'s initial messages from localStorage if the entry exists. If not, start with the seeded greeting only.
- **Clear:** when the proposal becomes non-empty (`isProposalEmpty` flips false) OR when drafting starts (`setIsDrafting(true)`). Either way, once the user has committed to a draft, the intake transcript is no longer needed.
- **Size bound:** localStorage per origin is typically 5MB. A long intake (50+ messages of ~500 chars) is well under 100KB. No pruning needed for the foreseeable product lifetime.
- **Not synced across devices.** Intentional simplification. If someone starts intake on laptop and continues on phone, they see the seeded greeting again. Fine for v1.

### Animation strategy

Principles:
- Only animate `transform` and `opacity`. No layout-affecting properties (width, height, margin, padding). Prevents reflow and paint cost.
- Easing: `cubic-bezier(0.32, 0.72, 0, 1)` (matches `DraftingReveal` — feels considered rather than bouncy).
- Durations: 420ms for meaningful state changes (hero shrink), 240ms for message entry, 180ms for micro-interactions (button hover).
- Reserve layout space upfront so animations don't reflow surrounding content mid-flight.

**Hero shrink-on-first-user-message:**
- Hero container has a fixed `min-height` that transitions from ~200px (idle) to ~80px (active) over 420ms. This is the one layout-affecting transition we accept — it's a single property, bounded, and the content inside uses `transform: scale()` so the hero text itself doesn't reflow.
- Hero text element applies `transform: scale(0.55)` + `opacity: 0.45` on active, with `transform-origin: top center`. Transform transitions in sync with the container's min-height.
- Trigger: a class on the intake container (`.intake--conversation-started`) toggled when `uiMessages.some(m => m.role === "user")`.

**Panel expansion:**
- No explicit animation. Panel uses `height: auto` with `max-height: min(55vh, 520px)` and grows naturally as messages arrive. Once at max-height, scroll overflow takes over.
- As the hero shrinks (above), the intake container's flex layout naturally reclaims the vertical space for the panel. The user perceives this as the panel "taking over the screen" — no JavaScript coordination needed.

**Message entry:**
- New messages fade+translateY: `opacity: 0 → 1`, `transform: translateY(4px) → translateY(0)` over 240ms.
- Applied via a CSS class on the message bubble's first render, removed after the animation ends.

**Draft-ready button:**
- When the `[[DRAFT_READY]]` marker is detected in a streaming assistant message, the button fades in (180ms, opacity only) attached to the bottom of that message bubble.
- The button uses the same styling language as the send-circle in the composer (forest fill, cream text) but is rectangular and labeled "Draft v1."

**Reduced-motion fallback:**
- Wrap all transitions in `@media (prefers-reduced-motion: no-preference)` so users with reduced-motion see instant state changes. Matches the existing `DraftingReveal` posture.

### Data flow / state

Intake-specific state lives in `BuilderHome` (existing) plus `IntakeScreen` (new):
- `uiMessages` (from `useChat`) — the real conversation. Hydrated from localStorage on mount, written through on change.
- `contextSources` (already loaded via `loadContextSources`).
- `isDrafting` — already exists.
- `autoSendChatPrompt` — already exists, used by the skip path and the Path B button.

Derived signals:
- "Conversation has started" (hero shrink trigger): `uiMessages.some(m => m.role === "user")`.
- "AI has signaled draft-ready" (Path B button visibility): the most recent assistant message contains the `[[DRAFT_READY]]` marker.

The seeded AI greeting is **not** a real message. It's rendered by `IntakePanel` when `uiMessages.length === 0`. Once a real assistant message exists, the seeded greeting is not shown and the panel renders the actual message history.

### Edge cases

- **User attaches context then refreshes page mid-conversation.** Context sources are persisted server-side; the panel reflects attached context on mount. Conversation is restored from localStorage (see Persistence).
- **User opens an existing proposal that's empty because they deleted all sections.** `isProposalEmpty` becomes true again. New behavior: if localStorage has prior intake messages for this proposal id, hydrate them. If not, start with seeded greeting only.
- **Context dialog opened mid-conversation.** Adding more sources updates the context header's chip row. No reset of conversation.
- **AI fails to signal readiness.** User uses the `DRAFT NOW` escape chip — forces the draft path.
- **User types ambiguous affirmation.** AI interprets; may push back with a clarifying question. Acceptable worst-case.
- **Streaming message contains `[[DRAFT_READY]]` marker mid-stream.** Client detects marker as each chunk arrives; button appears once the marker is fully received. Marker is stripped from displayed text.
- **Marker emitted in wrong context (e.g. AI misfires).** User can ignore the button and keep chatting. Next AI message without the marker removes the button again.
- **localStorage disabled / quota exceeded.** Write throws silently; conversation works in-memory for the session only. No hard failure.
- **Two tabs open on the same proposal.** Both read/write the same localStorage key. Last-write-wins. Acceptable — users rarely open the same intake in two tabs.

## Open questions

Resolved during brainstorm:
- **Draft trigger:** three-path design (natural language + AI-emitted marker button + escape chip).
- **Mobile layout:** full-width panel, stacked chips, mobile-specific max-height.
- **Persistence:** localStorage keyed by proposal id.
- **Panel max-height:** `min(55vh, 520px)` desktop / `min(60vh, 420px)` mobile.
- **Hero shrink:** transform + opacity on text, min-height transition on container, no layout reflow.
- **Seeded greeting:** UI-only, never hits the model.
- **Hero scroll behavior:** scrolls with page; does not pin.

No open questions remaining before plan.

## Out of scope (parked)

- Cross-device sync of intake transcripts (server-side persistence).
- Contextual AI greetings that reference attached context by name.
- Auto-saving partial intake answers as a structured "brief" object separate from the final proposal.

## Visual reference

Mockups explored during brainstorm:
- `.superpowers/brainstorm/<session>/content/reference-patterns.html` — Lovable vs ChatGPT vs Hybrid pattern comparison
- `.superpowers/brainstorm/<session>/content/panel-anatomy.html` — Option C v1
- `.superpowers/brainstorm/<session>/content/panel-anatomy-v2.html` — Option C v2 with brand tokens + AI-greets-first + no counter (approved)
