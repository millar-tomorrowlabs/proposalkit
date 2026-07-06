// src/components/builder/IntakePanel.tsx

import { useEffect, useMemo, useRef, useState } from "react"
import { Paperclip, Sparkles } from "lucide-react"
import { parseDraftReadyMarker } from "@/lib/parseDraftReadyMarker"
import { MAX_CHAT_MESSAGE_LENGTH, formatCharCount } from "@/lib/chatLimits"

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
  "Tell me about the project. The client, what they're trying to do, anything you already know.",
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

  // Block over-limit sends instead of letting the server cut them silently.
  const overLimit = input.length > MAX_CHAT_MESSAGE_LENGTH

  const handleSubmit = () => {
    const trimmed = input.trim()
    if (!trimmed || loading || overLimit) return
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

      {overLimit && (
        <div
          className="border-t px-4 py-2 text-[11px] leading-[1.5]"
          style={{
            borderColor: "var(--color-rule)",
            background: "var(--color-cream)",
            color: "var(--color-ink-soft)",
          }}
          role="alert"
        >
          This message is {formatCharCount(input.length)} characters. The chat
          takes up to {formatCharCount(MAX_CHAT_MESSAGE_LENGTH)}. Attach the
          full text as context with the paperclip instead, so nothing gets cut.
        </div>
      )}
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
          disabled={!input.trim() || loading || overLimit}
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
