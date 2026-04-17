# Intake Panel Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the current `IntakeHero` + floating-`FloatingComposer` empty-state with a unified `IntakeScreen` — hero text above one bordered panel that holds the AI conversation, composer, and context chips.

**Architecture:** Two new React components (`IntakePanel` for conversation+composer, `IntakeScreen` wrapping it with hero+chips). Two pure utilities (`parseDraftReadyMarker` for the AI-emitted draft signal, `intakePersistence` for localStorage hydration). System prompt update in `api/chat.ts` teaches the AI the checklist + marker protocol. `BuilderHome` is rewired to render `IntakeScreen` when the proposal is empty, hide `FloatingComposer` during intake, and hydrate/clear conversation state from localStorage keyed by proposal id.

**Tech Stack:** React 19, TypeScript, Tailwind v4, Vite, Vercel AI SDK (`@ai-sdk/react` `useChat`), Anthropic SDK, CSS custom properties (Studio Editorial tokens), localStorage. No test framework in this project — verification is typecheck (`npm run build`), lint (`npm run lint`), and manual browser verification via `preview_*` MCP tools.

---

## File Structure

New files:
- `src/lib/parseDraftReadyMarker.ts` — strips `[[DRAFT_READY]]` marker from assistant text, returns `{ displayText, isReady }`.
- `src/lib/intakePersistence.ts` — `loadIntake` / `saveIntake` / `clearIntake` localStorage helpers keyed by proposal id.
- `src/components/builder/IntakePanel.tsx` — the bordered surface: optional context header, scrollable message list (with seeded greeting when empty), draft-ready button, composer at the bottom.
- `src/components/builder/IntakeScreen.tsx` — wraps `IntakePanel` with the hero (with shrink-on-conversation behavior) and the two persistent footer chips.

Modified files:
- `api/chat.ts` — system prompt updated with the information checklist, marker protocol, and explicit readiness signaling.
- `src/index.css` — new CSS classes for hero shrink, message entry, draft-ready button fade, and the reduced-motion fallback.
- `src/pages/BuilderHome.tsx` — hydrate `useChat` initial messages from localStorage, render `IntakeScreen` when `isProposalEmpty`, suppress `FloatingComposer` during intake, save/clear conversation on changes.
- `src/components/builder/FloatingComposer.tsx` — drop the `position="center"` code path now that the composer is editor-only.

---

## Task 1: Update `api/chat.ts` system prompt

**Files:**
- Modify: `api/chat.ts` (system prompt section only)

Goal: teach the model (a) the information checklist it should aim to cover before drafting, (b) how to emit the `[[DRAFT_READY]]` marker, (c) that when the user affirms it should begin drafting immediately without re-confirming.

- [ ] **Step 1: Read the current system prompt to find the exact location.**

```bash
grep -n "system" /Users/millarsmith/proposalkit/api/chat.ts | head -20
```

Also read the full intake-related prompt section (search for "intake" / "draft" / "tagline" / the `proposal-edits` format instructions). You need to preserve the existing `proposal-edits` JSON contract — the marker additions are layered on top, not a replacement.

- [ ] **Step 2: Add the intake-phase block to the system prompt.**

Locate the section of the system prompt that describes the intake / empty-proposal phase. Insert the following paragraphs into that section (exact phrasing — edit only if the surrounding tone demands it):

```
## Intake — gathering the brief

When the proposal is empty (no tagline, no sections, no packages), you are in intake mode. Your job is to conversationally gather enough information to write a strong first draft. Not an interview — a conversation. Ask one question at a time, respond to what the user says before asking the next thing, and prefer natural phrasing ("How's the timeline looking?") over form-style prompts.

Before signaling readiness, aim to know:
- Client name and industry.
- Primary outcomes the client is trying to reach with this work.
- Scope / deliverables the proposal should cover.
- Timeline, including any hard dates (launch, pitch, campaign).
- Budget range.
- Who's the decision-maker on their side.
- How you should anchor the draft in any attached context.

If the user has attached a brief, transcript, or other context, READ IT and do not re-ask anything already answered there. Acknowledge what you found and only ask for what's still missing.

If the user says they don't know something or pushes back on a question, take a reasonable stab and note it as a placeholder the user can adjust post-draft. Don't stall on missing info.

## Signaling readiness

When you judge you have enough, write one short assistant message summarizing what you'll build and confirming you're ready. End that message with a line containing ONLY the marker `[[DRAFT_READY]]` on its own line, with no surrounding text or code fence. The client will strip this marker from the visible message and render a "Draft v1" button attached to your message.

Example:
```
Got it. I'll draft a three-tier proposal for Flush Bath anchored to the brief you attached, with a 10-week timeline and €18–25k investment range.

[[DRAFT_READY]]
```

After you've emitted the marker, if the user replies with any affirmation ("go", "yes", "sounds good", "let's do it", "please", etc.), begin the `proposal-edits` JSON block in your next message immediately. Do not re-confirm. Do not ask another question unless something critical is missing.

If the user pushes back after the marker ("wait, can we actually do X instead?"), drop back into conversation and re-emit the marker only when you're ready again.
```

- [ ] **Step 3: Typecheck the change.**

Run: `cd /Users/millarsmith/proposalkit && npm run build`
Expected: PASS (no new TS errors). The prompt is a string; typecheck validates surrounding code wasn't broken.

- [ ] **Step 4: Commit.**

```bash
cd /Users/millarsmith/proposalkit
git add api/chat.ts
git commit -m "chat: teach intake checklist and [[DRAFT_READY]] marker protocol"
```

---

## Task 2: Add `parseDraftReadyMarker` utility

**Files:**
- Create: `src/lib/parseDraftReadyMarker.ts`

Pure function, strips the marker off the end of an assistant message and returns a flag.

- [ ] **Step 1: Create the file with the full implementation.**

```ts
// src/lib/parseDraftReadyMarker.ts

const MARKER_PATTERN = /\s*\[\[DRAFT_READY\]\]\s*$/

/**
 * Inspect an assistant message for the [[DRAFT_READY]] trailer marker.
 *
 * The marker is emitted by the intake AI when it judges it has enough
 * context to begin drafting. The UI strips the marker from the visible
 * text and uses the `isReady` flag to render a "Draft v1" button
 * attached to that assistant message bubble.
 *
 * Tolerant of trailing whitespace and partial streams — returns
 * `isReady: false` when the marker isn't fully present, so a streaming
 * assistant message only flips the button on once the marker has
 * fully arrived.
 */
export function parseDraftReadyMarker(content: string): {
  displayText: string
  isReady: boolean
} {
  if (!content) return { displayText: "", isReady: false }
  const isReady = MARKER_PATTERN.test(content)
  const displayText = isReady ? content.replace(MARKER_PATTERN, "") : content
  return { displayText, isReady }
}
```

- [ ] **Step 2: Typecheck.**

Run: `cd /Users/millarsmith/proposalkit && npm run build`
Expected: PASS.

- [ ] **Step 3: Commit.**

```bash
cd /Users/millarsmith/proposalkit
git add src/lib/parseDraftReadyMarker.ts
git commit -m "lib: add parseDraftReadyMarker for intake draft signal"
```

---

## Task 3: Add `intakePersistence` utility

**Files:**
- Create: `src/lib/intakePersistence.ts`

Keyed localStorage helpers. Handles missing / disabled storage gracefully. The shape stored is whatever the AI SDK's `UIMessage` is — we treat it as opaque and stringify with `JSON.stringify`.

- [ ] **Step 1: Create the file.**

```ts
// src/lib/intakePersistence.ts

import type { UIMessage } from "ai"

const KEY_PREFIX = "proposl:intake:"

function storageKey(proposalId: string) {
  return `${KEY_PREFIX}${proposalId}`
}

function hasStorage(): boolean {
  try {
    return typeof window !== "undefined" && !!window.localStorage
  } catch {
    return false
  }
}

export function loadIntake(proposalId: string): UIMessage[] | null {
  if (!proposalId || !hasStorage()) return null
  try {
    const raw = window.localStorage.getItem(storageKey(proposalId))
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (!parsed || !Array.isArray(parsed.messages)) return null
    return parsed.messages as UIMessage[]
  } catch {
    return null
  }
}

export function saveIntake(proposalId: string, messages: UIMessage[]): void {
  if (!proposalId || !hasStorage()) return
  try {
    const payload = JSON.stringify({ messages, savedAt: Date.now() })
    window.localStorage.setItem(storageKey(proposalId), payload)
  } catch {
    // Quota exceeded or storage disabled — fail silently. In-memory
    // conversation continues to work; we just lose reload resilience.
  }
}

export function clearIntake(proposalId: string): void {
  if (!proposalId || !hasStorage()) return
  try {
    window.localStorage.removeItem(storageKey(proposalId))
  } catch {
    // Ignore.
  }
}
```

- [ ] **Step 2: Typecheck.**

Run: `cd /Users/millarsmith/proposalkit && npm run build`
Expected: PASS. If `UIMessage` import path is wrong, the error will name the correct module — adjust the import line accordingly.

- [ ] **Step 3: Commit.**

```bash
cd /Users/millarsmith/proposalkit
git add src/lib/intakePersistence.ts
git commit -m "lib: add intakePersistence helpers keyed by proposal id"
```

---

## Task 4: Add intake CSS (`src/index.css`)

**Files:**
- Modify: `src/index.css` — append new classes at the end of the file.

All animations use transform + opacity only (plus `min-height` on the hero container, which is explicitly reserved layout space). Matches `DraftingReveal`'s easing token.

- [ ] **Step 1: Read current index.css end-of-file to understand token / layering.**

Open `src/index.css` and scroll to the bottom so the next step appends in the right place.

- [ ] **Step 2: Append the intake CSS block.**

Add the following to the end of `src/index.css`:

```css
/* ---------- Intake screen ---------- */

/* Hero container reserves fixed vertical space at each state; the text
   inside uses transform so content doesn't reflow during the shrink. */
.intake-hero {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 200px;
  transition: min-height 420ms cubic-bezier(0.32, 0.72, 0, 1);
}
.intake-hero--active {
  min-height: 80px;
}
.intake-hero__text {
  display: flex;
  flex-direction: column;
  align-items: center;
  transform-origin: top center;
  transition:
    transform 420ms cubic-bezier(0.32, 0.72, 0, 1),
    opacity 420ms cubic-bezier(0.32, 0.72, 0, 1);
}
.intake-hero--active .intake-hero__text {
  transform: scale(0.55);
  opacity: 0.45;
}

/* Panel surface — always full-width on mobile, capped on desktop. */
.intake-panel {
  width: 100%;
  max-width: 640px;
  margin: 0 auto;
  background: var(--color-paper);
  border: 1px solid var(--color-rule);
  border-radius: 16px;
  box-shadow: 0 12px 32px rgba(0, 0, 0, 0.08), 0 2px 6px rgba(0, 0, 0, 0.05);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  max-height: min(55vh, 520px);
}

@media (max-width: 640px) {
  .intake-panel {
    max-height: min(60vh, 420px);
  }
}

/* Scrollable message area with top-fade to indicate hidden content. */
.intake-panel__messages {
  flex: 1 1 auto;
  overflow-y: auto;
  padding: 16px 18px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  position: relative;
}
.intake-panel__messages::before {
  content: "";
  position: sticky;
  top: 0;
  left: 0;
  right: 0;
  height: 24px;
  margin-bottom: -24px;
  background: linear-gradient(180deg, var(--color-paper), rgba(255,255,255,0));
  pointer-events: none;
  z-index: 1;
}

/* Message entry animation — fade + tiny upward lift. */
.intake-message--enter {
  animation: intake-message-enter 240ms cubic-bezier(0.32, 0.72, 0, 1) both;
}
@keyframes intake-message-enter {
  from { opacity: 0; transform: translateY(4px); }
  to   { opacity: 1; transform: translateY(0); }
}

/* Draft-ready button fades in once the marker has been fully parsed. */
.intake-draft-ready-btn {
  animation: intake-draft-ready-enter 180ms cubic-bezier(0.32, 0.72, 0, 1) both;
}
@keyframes intake-draft-ready-enter {
  from { opacity: 0; }
  to   { opacity: 1; }
}

/* Reduced motion — instant state changes for accessibility. */
@media (prefers-reduced-motion: reduce) {
  .intake-hero,
  .intake-hero__text,
  .intake-message--enter,
  .intake-draft-ready-btn {
    transition: none !important;
    animation: none !important;
  }
}
```

- [ ] **Step 3: Typecheck / build (catches Tailwind / PostCSS issues).**

Run: `cd /Users/millarsmith/proposalkit && npm run build`
Expected: PASS. If `--color-paper` / `--color-rule` aren't defined globally, the build won't fail (they're CSS custom props, resolved at runtime) — but verify the tokens exist by grepping:

```bash
grep -n "\-\-color-paper\|\-\-color-rule" /Users/millarsmith/proposalkit/src/index.css
```

Expected: both tokens defined earlier in the file.

- [ ] **Step 4: Commit.**

```bash
cd /Users/millarsmith/proposalkit
git add src/index.css
git commit -m "css: intake screen styles — hero shrink, panel, message entry, draft-ready fade"
```

---

## Task 5: Build `IntakePanel` component

**Files:**
- Create: `src/components/builder/IntakePanel.tsx`

Owns the bordered surface: context header (conditional), message list with seeded greeting, draft-ready button attached to the latest assistant message when the marker is present, and the composer (auto-growing textarea, send, paperclip).

- [ ] **Step 1: Create the component.**

```tsx
// src/components/builder/IntakePanel.tsx

import { useEffect, useMemo, useRef, useState } from "react"
import { Paperclip, Sparkles } from "lucide-react"
import { parseDraftReadyMarker } from "@/lib/parseDraftReadyMarker"

export interface IntakePanelMessage {
  id: string
  role: "user" | "assistant"
  content: string
}

export interface ContextChip {
  id: string
  label: string
}

interface IntakePanelProps {
  messages: IntakePanelMessage[]
  loading: boolean
  onSend: (text: string) => void
  onAttach: () => void
  onDraftReady: () => void
  contextChips: ContextChip[]
}

const SEEDED_GREETING = [
  "Tell me about the project — the client, what they're trying to do, anything you already know.",
  "If you've got a brief, a call transcript, or a Notion page, attach it with the paperclip and I'll work from there.",
].join(" ")

export default function IntakePanel({
  messages,
  loading,
  onSend,
  onAttach,
  onDraftReady,
  contextChips,
}: IntakePanelProps) {
  const [input, setInput] = useState("")
  const scrollRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Show seeded greeting only when there's no real conversation yet.
  const hasRealMessages = messages.length > 0
  const renderedMessages = useMemo(() => {
    return messages.map((m) => {
      if (m.role === "assistant") {
        const { displayText, isReady } = parseDraftReadyMarker(m.content)
        return { ...m, content: displayText, isReady }
      }
      return { ...m, isReady: false }
    })
  }, [messages])

  const lastAssistantIdx = useMemo(() => {
    for (let i = renderedMessages.length - 1; i >= 0; i--) {
      if (renderedMessages[i].role === "assistant") return i
    }
    return -1
  }, [renderedMessages])

  // Auto-scroll to bottom when message count or loading changes.
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    el.scrollTop = el.scrollHeight
  }, [renderedMessages.length, loading])

  // Auto-grow textarea.
  useEffect(() => {
    const ta = textareaRef.current
    if (!ta) return
    ta.style.height = "auto"
    ta.style.height = `${Math.min(ta.scrollHeight, 120)}px`
  }, [input])

  const handleSubmit = () => {
    const trimmed = input.trim()
    if (!trimmed || loading) return
    onSend(trimmed)
    setInput("")
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    }
  }

  return (
    <div className="intake-panel">
      {contextChips.length > 0 && (
        <div
          className="flex items-center gap-2 border-b px-4 py-2.5"
          style={{ borderColor: "var(--color-rule)" }}
        >
          <span
            className="text-[9px] uppercase tracking-[0.14em]"
            style={{ fontFamily: "var(--font-mono)", color: "var(--color-ink-mute)" }}
          >
            CONTEXT
          </span>
          <div className="flex flex-1 gap-1.5 overflow-x-auto">
            {contextChips.map((c) => (
              <span
                key={c.id}
                className="whitespace-nowrap rounded-full border px-2.5 py-1 text-[11px]"
                style={{
                  background: "var(--color-cream)",
                  borderColor: "var(--color-rule)",
                  color: "var(--color-ink-soft)",
                }}
              >
                {c.label}
              </span>
            ))}
          </div>
          <button
            onClick={onAttach}
            className="text-[9px] uppercase tracking-[0.14em] transition-opacity hover:opacity-70"
            style={{ fontFamily: "var(--font-mono)", color: "var(--color-ink-mute)" }}
          >
            + ADD
          </button>
        </div>
      )}

      <div ref={scrollRef} className="intake-panel__messages">
        {!hasRealMessages && (
          <div
            className="intake-message--enter max-w-[85%] rounded-xl border px-3.5 py-2.5 text-[13px] leading-[1.55]"
            style={{
              background: "var(--color-cream)",
              borderColor: "var(--color-rule)",
              color: "var(--color-ink)",
              borderRadius: "12px 12px 12px 2px",
            }}
          >
            {SEEDED_GREETING}
          </div>
        )}

        {renderedMessages.map((msg, idx) => (
          <div key={msg.id} className="flex flex-col gap-1.5">
            <div
              className={`intake-message--enter max-w-[85%] rounded-xl px-3.5 py-2.5 text-[13px] leading-[1.55] ${
                msg.role === "user" ? "ml-auto" : ""
              }`}
              style={{
                background:
                  msg.role === "user" ? "var(--color-forest)" : "var(--color-cream)",
                border:
                  msg.role === "assistant" ? "1px solid var(--color-rule)" : "none",
                color:
                  msg.role === "user" ? "var(--color-cream)" : "var(--color-ink)",
                borderRadius:
                  msg.role === "user"
                    ? "12px 12px 2px 12px"
                    : "12px 12px 12px 2px",
              }}
            >
              {msg.content}
            </div>
            {msg.role === "assistant" &&
              idx === lastAssistantIdx &&
              msg.isReady &&
              !loading && (
                <button
                  onClick={onDraftReady}
                  className="intake-draft-ready-btn mt-1 self-start rounded-full px-4 py-1.5 text-[12px] font-medium transition-transform hover:scale-[1.02]"
                  style={{ background: "var(--color-forest)", color: "var(--color-cream)" }}
                >
                  Draft v1
                </button>
              )}
          </div>
        ))}

        {loading && (
          <div
            className="max-w-[85%] rounded-xl border px-3.5 py-2.5 text-[12px]"
            style={{
              background: "var(--color-cream)",
              borderColor: "var(--color-rule)",
              color: "var(--color-ink-mute)",
              borderRadius: "12px 12px 12px 2px",
            }}
          >
            Thinking...
          </div>
        )}
      </div>

      <div
        className="flex items-end gap-2 border-t px-4 py-3"
        style={{ borderColor: "var(--color-rule)" }}
      >
        <Sparkles
          className="mb-1 h-4 w-4 shrink-0"
          style={{ color: "var(--color-forest)" }}
        />
        <textarea
          ref={textareaRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={
            hasRealMessages ? "Reply..." : "Describe the project..."
          }
          rows={1}
          className="flex-1 resize-none bg-transparent text-[13px] leading-[1.5] outline-none"
          style={{ color: "var(--color-ink)", maxHeight: "120px" }}
        />
        <button
          onClick={onAttach}
          className="mb-1 shrink-0 transition-opacity hover:opacity-70"
          style={{ color: "var(--color-ink-mute)" }}
          title="Attach file or URL"
          aria-label="Attach context"
        >
          <Paperclip className="h-4 w-4" />
        </button>
        <button
          onClick={handleSubmit}
          disabled={!input.trim() || loading}
          className="mb-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[12px] transition-transform hover:scale-[1.05] disabled:opacity-40"
          style={{ background: "var(--color-forest)", color: "var(--color-cream)" }}
          aria-label="Send message"
        >
          ↑
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Typecheck.**

Run: `cd /Users/millarsmith/proposalkit && npm run build`
Expected: PASS. If the `@/lib/parseDraftReadyMarker` alias fails, substitute `../../lib/parseDraftReadyMarker` — check `tsconfig.json` for the `@/*` path alias to decide.

- [ ] **Step 3: Lint.**

Run: `cd /Users/millarsmith/proposalkit && npm run lint`
Expected: PASS for the new file. Fix any unused-imports warnings inline.

- [ ] **Step 4: Commit.**

```bash
cd /Users/millarsmith/proposalkit
git add src/components/builder/IntakePanel.tsx
git commit -m "builder: add IntakePanel — conversation, composer, draft-ready button"
```

---

## Task 6: Build `IntakeScreen` component

**Files:**
- Create: `src/components/builder/IntakeScreen.tsx`

Wraps `IntakePanel` with the hero (applies shrink state from message presence) and the two persistent footer chips.

- [ ] **Step 1: Create the component.**

```tsx
// src/components/builder/IntakeScreen.tsx

import IntakePanel, {
  type ContextChip,
  type IntakePanelMessage,
} from "./IntakePanel"

interface IntakeScreenProps {
  messages: IntakePanelMessage[]
  loading: boolean
  onSend: (text: string) => void
  onAttach: () => void
  onDraftReady: () => void
  onDraftNow: () => void
  contextChips: ContextChip[]
}

export default function IntakeScreen({
  messages,
  loading,
  onSend,
  onAttach,
  onDraftReady,
  onDraftNow,
  contextChips,
}: IntakeScreenProps) {
  const conversationStarted = messages.some((m) => m.role === "user")
  const hasContext = contextChips.length > 0

  return (
    <div className="flex min-h-[calc(100vh-11rem)] flex-col items-center px-4 pb-10 pt-8 sm:px-6">
      <div
        className={`intake-hero w-full ${
          conversationStarted ? "intake-hero--active" : ""
        }`}
      >
        <div className="intake-hero__text">
          <div
            className="mb-3 text-[11px] uppercase tracking-[0.14em]"
            style={{ fontFamily: "var(--font-mono)", color: "var(--color-ink-mute)" }}
          >
            NEW PROPOSAL
          </div>
          <h1
            className="text-center text-[36px] leading-[1.05] tracking-[-0.01em] sm:text-[56px]"
            style={{
              fontFamily: "var(--font-merchant-display)",
              fontWeight: 500,
              color: "var(--color-ink)",
            }}
          >
            What are we proposing?
          </h1>
        </div>
      </div>

      <div className="w-full">
        <IntakePanel
          messages={messages}
          loading={loading}
          onSend={onSend}
          onAttach={onAttach}
          onDraftReady={onDraftReady}
          contextChips={contextChips}
        />
      </div>

      <div className="mt-4 flex w-full max-w-[640px] flex-col items-center gap-2 sm:flex-row sm:justify-center sm:gap-3">
        <button
          onClick={onAttach}
          className="rounded-full border px-3.5 py-1.5 text-[10px] uppercase tracking-[0.14em] transition-colors hover:bg-black/5"
          style={{
            background: "var(--color-paper)",
            borderColor: "var(--color-rule)",
            color: "var(--color-ink-soft)",
            fontFamily: "var(--font-mono)",
          }}
        >
          {hasContext ? "ADD MORE CONTEXT" : "ATTACH CONTEXT"}
        </button>
        <button
          onClick={onDraftNow}
          className="rounded-full px-3.5 py-1.5 text-[10px] uppercase tracking-[0.14em] transition-opacity hover:opacity-70"
          style={{
            color: "var(--color-ink-mute)",
            fontFamily: "var(--font-mono)",
          }}
        >
          {conversationStarted ? "DRAFT NOW" : "SKIP · START BLANK"}
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Typecheck.**

Run: `cd /Users/millarsmith/proposalkit && npm run build`
Expected: PASS.

- [ ] **Step 3: Lint.**

Run: `cd /Users/millarsmith/proposalkit && npm run lint`
Expected: PASS.

- [ ] **Step 4: Commit.**

```bash
cd /Users/millarsmith/proposalkit
git add src/components/builder/IntakeScreen.tsx
git commit -m "builder: add IntakeScreen — hero + panel + footer chips"
```

---

## Task 7: Wire `IntakeScreen` into `BuilderHome`

**Files:**
- Modify: `src/pages/BuilderHome.tsx`

Wire up: hydrate initial messages from localStorage at mount; render `IntakeScreen` instead of `IntakeHero` when `isProposalEmpty`; suppress `FloatingComposer` during intake; save messages to localStorage on change; clear persistence when drafting begins or proposal becomes non-empty.

- [ ] **Step 1: Add imports at the top of `BuilderHome.tsx`.**

Open `src/pages/BuilderHome.tsx`. Locate the existing imports for builder components. Add:

```ts
import IntakeScreen from "@/components/builder/IntakeScreen"
import {
  loadIntake,
  saveIntake,
  clearIntake,
} from "@/lib/intakePersistence"
```

(Verify the existing imports already use `@/` aliases; adjust to relative paths if the file uses relative imports throughout.)

- [ ] **Step 2: Hydrate `useChat` with stored messages.**

Locate the `useChat({ ... })` call (around line 139 per the pre-change file). Replace with:

```tsx
const initialIntakeMessages = useMemo(
  () => loadIntake(proposal.id) ?? undefined,
  // Only load at mount — we don't want to reset the conversation mid-session.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  [],
)

const {
  messages: uiMessages,
  sendMessage,
  status: chatStatus,
} = useChat({
  id: `chat-${proposal.id}`,
  transport,
  initialMessages: initialIntakeMessages,
  onError: (err) => {
    console.error("Chat error:", err)
    toast.error("AI request failed. Please try again.")
  },
})
```

If `useChat` in this version of `@ai-sdk/react` rejects `initialMessages`, check the hook's type — equivalent names are `messages` (controlled) or `initialInput`. The intent is: on mount, pre-seed the message array from localStorage. Adjust the property to whatever the installed SDK exposes.

- [ ] **Step 3: Add a persistence effect for save + clear.**

Below the existing effects in `BuilderHome`, add:

```tsx
// Persist intake conversation to localStorage (debounced) while the
// proposal is empty. Clear once drafting starts or the proposal gets
// populated — the transcript is no longer useful post-draft.
useEffect(() => {
  if (!proposal.id) return
  if (!isProposalEmpty || isDrafting) {
    clearIntake(proposal.id)
    return
  }
  const t = setTimeout(() => {
    saveIntake(proposal.id, uiMessages)
  }, 200)
  return () => clearTimeout(t)
}, [proposal.id, uiMessages, isProposalEmpty, isDrafting])
```

(Place it near the other `useEffect` hooks — check for the hook that loads context sources and follow that pattern.)

- [ ] **Step 4: Replace the `IntakeHero` render branch with `IntakeScreen`.**

Find this block in `BuilderHome.tsx`:

```tsx
{isProposalEmpty ? (
  <IntakeHero
    onAddContext={() => setShowContext(true)}
    contextCount={contextSources.length}
    onSkip={() => {
      setComposerVisible(true)
      setIsDrafting(true)
      setAutoSendChatPrompt(
        "Skip the questions and draft v1 with whatever you have.",
      )
    }}
  />
) : (
  ...
)}
```

Replace the `<IntakeHero .../>` element with:

```tsx
<IntakeScreen
  messages={uiMessages.map((m) => {
    const textParts = m.parts.filter((p) => p.type === "text") as Array<{
      type: "text"
      text: string
    }>
    const raw = textParts.map((p) => p.text).join("")
    const visible =
      m.role === "assistant" ? stripStreamingEditsBlock(raw) : raw
    return {
      id: m.id,
      role: m.role as "user" | "assistant",
      content: visible,
    }
  })}
  loading={isStreaming}
  onSend={(text) => sendMessage({ text })}
  onAttach={() => setShowContext(true)}
  onDraftReady={() => {
    // Path B — user clicked the AI-emitted "Draft v1" button.
    // Mirrors Path A: send the affirmation as a real message so
    // the AI's next turn emits the proposal-edits block, and
    // fire the reveal overlay.
    setIsDrafting(true)
    sendMessage({ text: "Go ahead with the draft." })
  }}
  onDraftNow={() => {
    // Path C — escape hatch. Force draft regardless of AI state.
    setIsDrafting(true)
    setAutoSendChatPrompt(
      "Skip the questions and draft v1 with whatever you have.",
    )
  }}
  contextChips={contextSources.map((c) => ({
    id: c.id,
    label: c.label ?? c.url ?? c.filename ?? "Context",
  }))}
/>
```

(If the existing `contextSources` item shape uses different property names than `label / url / filename`, read the existing `ContextDialog` usage and match — the label expression is just a best-available fallback.)

- [ ] **Step 5: Suppress `FloatingComposer` during intake.**

Find the existing `FloatingComposer` block (around line 594 per the pre-change file):

```tsx
{!previewMode && (
  <FloatingComposer ... />
)}
```

Replace the condition with:

```tsx
{!previewMode && !isProposalEmpty && (
  <FloatingComposer ... />
)}
```

And **remove** the `placeholder={...}` and `position={...}` props from the `FloatingComposer` invocation — the composer is now only used post-draft, always at `bottom`, always with its default placeholder.

- [ ] **Step 6: Remove the now-unused `IntakeHero` component from the file.**

Scroll to the bottom of `BuilderHome.tsx`. Delete the `IntakeHero` function component and its `IntakeHeroProps` interface. Also remove its import if one exists at the top (it's typically defined inline in the same file). Leave the surrounding `BuilderTopBar` / other helpers alone.

- [ ] **Step 7: Typecheck.**

Run: `cd /Users/millarsmith/proposalkit && npm run build`
Expected: PASS. If `useChat`'s `initialMessages` prop name is wrong, fix per hook's actual type. If `stripStreamingEditsBlock` is unused elsewhere now, leave it — it's still used for the FloatingComposer branch.

- [ ] **Step 8: Lint.**

Run: `cd /Users/millarsmith/proposalkit && npm run lint`
Expected: PASS.

- [ ] **Step 9: Commit.**

```bash
cd /Users/millarsmith/proposalkit
git add src/pages/BuilderHome.tsx
git commit -m "builder: wire IntakeScreen, hide FloatingComposer during intake, persist intake to localStorage"
```

---

## Task 8: Remove `position` prop from `FloatingComposer`

**Files:**
- Modify: `src/components/builder/FloatingComposer.tsx`
- (BuilderHome.tsx already updated in Task 7 — no further change there.)

The `position="center"` code path is dead now. Drop it.

- [ ] **Step 1: Edit `FloatingComposer.tsx`.**

Remove the `position?: "bottom" | "center"` prop from `FloatingComposerProps`, remove the default parameter in the function signature, and delete the `positionClasses` computation.

Find (around line 28-32, 48, 164-165):

```tsx
  /**
   * Vertical placement of the composer panel.
   * - "bottom" (default): pinned near the bottom, matches the editor layout
   *   where the document occupies the rest of the viewport.
   * - "center": raised into the lower-middle of the viewport — used during
   *   intake so the input doesn't feel buried under the hero copy.
   */
  position?: "bottom" | "center"
```

Delete the entire comment block + prop declaration.

Find the destructured parameter in the function signature:

```tsx
  position = "bottom",
```

Delete that line.

Find the `positionClasses` declaration (around line 164-165):

```tsx
  const positionClasses =
    position === "center" ? "bottom-[30vh]" : "bottom-4"
```

Delete these two lines.

Find the container element using `positionClasses` (around line 169):

```tsx
<div
  className={`fixed left-1/2 z-50 w-[520px] max-w-[90vw] -translate-x-1/2 rounded-2xl border ${positionClasses}`}
```

Change to:

```tsx
<div
  className="fixed bottom-4 left-1/2 z-50 w-[520px] max-w-[90vw] -translate-x-1/2 rounded-2xl border"
```

- [ ] **Step 2: Typecheck.**

Run: `cd /Users/millarsmith/proposalkit && npm run build`
Expected: PASS. (BuilderHome.tsx should no longer pass the prop after Task 7.)

- [ ] **Step 3: Lint.**

Run: `cd /Users/millarsmith/proposalkit && npm run lint`
Expected: PASS.

- [ ] **Step 4: Commit.**

```bash
cd /Users/millarsmith/proposalkit
git add src/components/builder/FloatingComposer.tsx
git commit -m "composer: drop position prop — intake now owns its own surface"
```

---

## Task 9: Visual verification

No code changes — manual check via preview MCP.

- [ ] **Step 1: Start the dev server.**

Use `preview_start`. When it's up, navigate to a freshly-created proposal (the builder route for a new/empty proposal).

- [ ] **Step 2: Screenshot empty state.**

Use `preview_screenshot`. Expected: hero at full size, seeded AI greeting visible inside the panel, attach/skip chips below panel.

Check with `preview_snapshot` that the greeting text matches the seeded string from `IntakePanel.tsx`.

- [ ] **Step 3: Send a user message and watch hero shrink.**

Use `preview_fill` to type into the composer textarea. Use `preview_click` on the send button.

Use `preview_screenshot` after the send. Expected: hero is dimmed + shrunk to a smaller height; panel remains at consistent size; the user's message is in the panel; an AI "Thinking..." bubble appears briefly.

- [ ] **Step 4: Verify draft-ready button path (Path B).**

Continue the conversation until the AI emits `[[DRAFT_READY]]` (the system prompt now instructs this at natural readiness — may take 3-5 turns depending on the test prompts). Once the marker is emitted:

Use `preview_snapshot` to verify the marker text itself is NOT visible in the assistant message (it was stripped), and that a "Draft v1" button is attached to the bottom of that bubble. Click it with `preview_click`. Verify `DraftingReveal` overlay appears.

If the AI doesn't emit the marker within 5-6 turns during testing, use the next step to verify the escape path instead and note the marker behavior for tuning in a follow-up.

- [ ] **Step 5: Verify escape chip (Path C).**

Hard-refresh the page to return to intake empty state. Type one message, then click the "DRAFT NOW" chip below the panel. Verify `DraftingReveal` fires.

- [ ] **Step 6: Verify localStorage persistence.**

Start a fresh intake, send 2-3 messages, refresh the page (do NOT click Draft / Skip — stay in intake). Verify the messages are restored inside the panel and the hero is in shrunk state (since `uiMessages.some(m => m.role === "user")` is true after hydration).

Use `preview_eval` to inspect localStorage directly if needed:

```js
Object.keys(localStorage).filter((k) => k.startsWith("proposl:intake:"))
```

Expected: one entry keyed by the current proposal id.

- [ ] **Step 7: Verify mobile layout.**

Use `preview_resize` to set viewport to 375×812 (iPhone-ish). Screenshot. Expected: panel takes full width minus margin, chips stack vertically, hero headline is smaller (~36px), no horizontal overflow.

- [ ] **Step 8: Verify that `FloatingComposer` appears once drafting starts.**

After triggering a draft (Path B or C), wait for `DraftingReveal` to finish and the proposal sections to populate. Screenshot the editor state. Expected: intake is gone, the document is rendered, `FloatingComposer` is at `bottom-4` (not center).

- [ ] **Step 9: Report.**

Report each step's result (pass/fail + screenshot path) in the handoff message. Flag any visual regressions or animation jank for a polish pass.

---

## Self-review notes

- **Spec coverage checked:** Each section of the spec (hero, panel, context header, composer, three draft paths, system prompt, component structure, responsive, persistence, animations) has a mapped task. The `system prompt` section lands in Task 1, `panel` in Task 5, `hero shrink` in Task 6 + CSS in Task 4, `persistence` in Tasks 3 and 7, `three-path trigger` is split across Tasks 1 (system prompt marker instruction), 2 (marker parser), 5 (button render), 7 (button/chip wiring).
- **Placeholder scan:** No TBD / TODO / "add appropriate X" phrasing. Each step ships specific code or specific commands.
- **Type consistency:** `IntakePanelMessage` and `ContextChip` are defined in `IntakePanel.tsx` and re-exported/imported by `IntakeScreen.tsx`. `BuilderHome.tsx` adapts `uiMessages` (from `useChat`) into the `IntakePanelMessage` shape via the same `.parts`-flatten transform the existing `FloatingComposer` branch uses. `parseDraftReadyMarker` returns `{ displayText, isReady }` consistently.
- **`useChat` initial-messages prop:** Specified as `initialMessages` based on common AI SDK patterns; Task 7 Step 2 includes a fallback note if the installed version uses a different name — the implementer should check the hook's type signature at integration time rather than trusting the spec blindly. (Not fixed inline because version-specific API shape can't be verified from the plan-writing context alone.)
