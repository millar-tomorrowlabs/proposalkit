import { useState, useRef, useEffect } from "react"
import { Sparkles, Paperclip, X, RotateCcw, ChevronDown } from "lucide-react"

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
  pendingPrompt?: string | null
  onClearPendingPrompt?: () => void
  /** Override the default input placeholder. Useful for intake mode. */
  placeholder?: string
  /**
   * Vertical placement of the composer panel.
   * - "bottom" (default): pinned near the bottom, matches the editor layout
   *   where the document occupies the rest of the viewport.
   * - "center": raised into the lower-middle of the viewport — used during
   *   intake so the input doesn't feel buried under the hero copy.
   */
  position?: "bottom" | "center"
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
  pendingPrompt,
  onClearPendingPrompt,
  placeholder,
  position = "bottom",
}: FloatingComposerProps) {
  const [input, setInput] = useState("")
  const [expanded, setExpanded] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  // Cmd+K to toggle. Escape: if the chat history is expanded, collapse
  // it first; if already collapsed, hide the whole composer.
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault()
        onToggle()
        return
      }
      if (e.key === "Escape" && visible) {
        // Don't steal Escape from inputs in dialogs/popovers. Only act when
        // nothing else is focused on the input inside the composer. A more
        // nuanced check: if the active element is outside the composer, skip.
        const active = document.activeElement
        const insideComposer = active && inputRef.current?.contains(active as Node)
        if (!insideComposer) return
        e.preventDefault()
        if (expanded && messages.length > 0) {
          setExpanded(false)
        } else {
          onToggle()
        }
      }
    }
    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  }, [onToggle, visible, expanded, messages.length])

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

  // Pre-fill input from pending prompt (e.g. AskAIGhost button)
  useEffect(() => {
    if (pendingPrompt) {
      setInput(pendingPrompt)
      onClearPendingPrompt?.()
      // Focus after a tick to ensure the composer is visible
      requestAnimationFrame(() => inputRef.current?.focus())
    }
  }, [pendingPrompt])

  // Auto-grow the textarea as the user types a multi-line message. Without
  // this, `rows={1}` keeps the visible area at one line and earlier lines
  // scroll out of view when content wraps. Capped at 80px to match the
  // inline maxHeight — past that the textarea scrolls internally.
  useEffect(() => {
    const ta = inputRef.current
    if (!ta) return
    ta.style.height = "auto"
    ta.style.height = `${Math.min(ta.scrollHeight, 80)}px`
  }, [input])

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

  // When anchored in "center" mode the composer sits roughly a third from
  // the bottom — the history expands upward, keeping the input near the
  // optical centerline as the conversation grows.
  const positionClasses =
    position === "center" ? "bottom-[30vh]" : "bottom-4"

  return (
    <div
      className={`fixed left-1/2 z-50 w-[520px] max-w-[90vw] -translate-x-1/2 rounded-2xl border ${positionClasses}`}
      style={{
        background: "var(--color-cream)",
        borderColor: "var(--color-rule)",
        boxShadow: "0 12px 32px rgba(0,0,0,0.12), 0 2px 6px rgba(0,0,0,0.06)",
      }}
    >
      {/* Conversation history */}
      {showHistory && (
        <div
          className="border-b"
          style={{ borderColor: "var(--color-rule)" }}
        >
          <div className="flex items-center justify-between px-4 pt-2.5 pb-1.5">
            <span
              className="text-[10px] uppercase tracking-[0.14em]"
              style={{ fontFamily: "var(--font-mono)", color: "var(--color-ink-mute)" }}
            >
              Chat with AI
            </span>
            <button
              onClick={() => setExpanded(false)}
              className="flex items-center gap-1 rounded-full px-2 py-1 text-[10px] uppercase tracking-[0.12em] transition-colors hover:bg-black/5"
              style={{ fontFamily: "var(--font-mono)", color: "var(--color-ink-mute)" }}
              title="Collapse history (Esc)"
            >
              <ChevronDown className="h-3 w-3" />
              Collapse
            </button>
          </div>
          <div
            ref={scrollRef}
            className="max-h-[45vh] overflow-y-auto px-4 pb-3"
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
            placeholder ??
            (sectionContext
              ? `Ask AI about ${sectionContext}...`
              : "Ask AI anything, or \u2318K to toggle...")
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
          className="mb-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full transition-colors hover:bg-black/5"
          style={{ color: "var(--color-ink-mute)" }}
          title="Hide composer (Esc or ⌘K)"
          aria-label="Hide chat composer"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}
