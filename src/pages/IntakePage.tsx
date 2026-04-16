/**
 * IntakePage — replaces the old WizardPage.
 *
 * Step 1: Context Upload — drop zone for briefs, URLs, text pastes.
 * Step 2: Conversational Chat — AI-guided follow-up (UI only for now).
 * On "Generate proposal": creates a proposal row + saves context/messages,
 * then navigates to /builder/:id.
 */

import { useRef, useState } from "react"
import { Link, useNavigate } from "react-router-dom"
import { ArrowLeft, Upload, X, Send, Plus } from "lucide-react"
import ProposlMark from "@/components/brand/ProposlMark"
import { supabase } from "@/lib/supabase"
import { useAuth } from "@/contexts/AuthContext"
import { useAccount } from "@/contexts/AccountContext"

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

type SourceType = "text" | "url"

interface ContextSource {
  id: string
  sourceType: SourceType
  name: string
  content: string
}

interface Message {
  id: string
  role: "assistant" | "user"
  content: string
}

type AddingMode = "paste" | "url" | null

// ─────────────────────────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────────────────────────

export default function IntakePage() {
  const { userId } = useAuth()
  const { account } = useAccount()
  const navigate = useNavigate()

  const [step, setStep] = useState<1 | 2>(1)
  const [contextSources, setContextSources] = useState<ContextSource[]>([])
  const [messages, setMessages] = useState<Message[]>([])
  const [adding, setAdding] = useState<AddingMode>(null)
  const [pasteText, setPasteText] = useState("")
  const [urlValue, setUrlValue] = useState("")
  const [chatInput, setChatInput] = useState("")
  const [generating, setGenerating] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // ── Step 1 helpers ──────────────────────────────────────────────────────

  function addPasteSource() {
    const text = pasteText.trim()
    if (!text) return
    const snippet = text.slice(0, 40).replace(/\s+/g, " ")
    setContextSources((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        sourceType: "text",
        name: snippet.length < text.length ? `${snippet}…` : snippet,
        content: text,
      },
    ])
    setPasteText("")
    setAdding(null)
  }

  function addUrlSource() {
    const url = urlValue.trim()
    if (!url) return
    setContextSources((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        sourceType: "url",
        name: url,
        content: url,
      },
    ])
    setUrlValue("")
    setAdding(null)
  }

  function removeSource(id: string) {
    setContextSources((prev) => prev.filter((s) => s.id !== id))
  }

  // ── Step 2 helpers ──────────────────────────────────────────────────────

  function enterChat(skipped: boolean) {
    const welcomeContent = skipped
      ? "Let's start with the basics. Who is this proposal for?"
      : "I've read through your materials. Let me ask a few follow-up questions before drafting the proposal. Who is the primary contact at the client's organisation?"

    setMessages([
      {
        id: crypto.randomUUID(),
        role: "assistant",
        content: welcomeContent,
      },
    ])
    setStep(2)
  }

  function sendMessage() {
    const text = chatInput.trim()
    if (!text) return
    setMessages((prev) => [
      ...prev,
      { id: crypto.randomUUID(), role: "user", content: text },
    ])
    setChatInput("")
    // Scroll to bottom after state update
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
    }, 50)
  }

  function handleChatKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  // ── Generate proposal ───────────────────────────────────────────────────

  async function handleGenerate() {
    setGenerating(true)
    try {
      const proposalId = crypto.randomUUID()

      const { error: propError } = await supabase.from("proposals").insert({
        id: proposalId,
        account_id: account.id,
        user_id: userId,
        title: "Untitled proposal",
        slug: proposalId.slice(0, 8),
        client_name: "",
        brand_color_1: account.defaultBrandColor1 || "#000000",
        brand_color_2: account.defaultBrandColor2 || "#6b7280",
        cta_email: account.defaultCtaEmail || "",
        sections: ["summary", "scope", "timeline", "investment", "cta"],
        status: "draft",
        data: {},
      })

      if (propError) {
        console.error("Failed to create proposal:", propError)
        setGenerating(false)
        return
      }

      // Save context sources
      for (const ctx of contextSources) {
        await supabase.from("proposal_context").insert({
          proposal_id: proposalId,
          source_type: ctx.sourceType,
          name: ctx.name,
          extracted_text: ctx.content,
        })
      }

      // Save messages
      for (const msg of messages) {
        await supabase.from("proposal_messages").insert({
          proposal_id: proposalId,
          role: msg.role,
          content: msg.content,
        })
      }

      navigate(`/builder/${proposalId}`)
    } catch (err) {
      console.error("Unexpected error generating proposal:", err)
      setGenerating(false)
    }
  }

  const hasUserMessages = messages.some((m) => m.role === "user")

  // ─────────────────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────────────────

  return (
    <div
      className="min-h-screen"
      style={{ background: "var(--color-cream)", color: "var(--color-ink)" }}
    >
      {/* ── Shared header ─────────────────────────────────────────────── */}
      <header className="flex items-center justify-between px-6 pt-7 pb-5 md:px-10">
        <Link
          to="/proposals"
          style={{ color: "var(--color-forest)" }}
          className="flex items-center gap-2"
        >
          <ProposlMark size={28} />
        </Link>
        <Link
          to="/proposals"
          className="flex items-center gap-1.5 text-[12px] transition-opacity hover:opacity-70"
          style={{
            fontFamily: "var(--font-mono)",
            color: "var(--color-ink-soft)",
          }}
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Dashboard
        </Link>
      </header>

      {step === 1 ? (
        <Step1
          contextSources={contextSources}
          adding={adding}
          pasteText={pasteText}
          urlValue={urlValue}
          onSetAdding={setAdding}
          onPasteChange={setPasteText}
          onUrlChange={setUrlValue}
          onAddPaste={addPasteSource}
          onAddUrl={addUrlSource}
          onRemove={removeSource}
          onContinue={() => enterChat(false)}
          onSkip={() => enterChat(true)}
        />
      ) : (
        <Step2
          messages={messages}
          chatInput={chatInput}
          generating={generating}
          hasUserMessages={hasUserMessages}
          messagesEndRef={messagesEndRef}
          onChatInputChange={setChatInput}
          onSend={sendMessage}
          onKeyDown={handleChatKeyDown}
          onGenerate={handleGenerate}
        />
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Step 1: Context Upload
// ─────────────────────────────────────────────────────────────────────────────

interface Step1Props {
  contextSources: ContextSource[]
  adding: AddingMode
  pasteText: string
  urlValue: string
  onSetAdding: (mode: AddingMode) => void
  onPasteChange: (v: string) => void
  onUrlChange: (v: string) => void
  onAddPaste: () => void
  onAddUrl: () => void
  onRemove: (id: string) => void
  onContinue: () => void
  onSkip: () => void
}

function Step1({
  contextSources,
  adding,
  pasteText,
  urlValue,
  onSetAdding,
  onPasteChange,
  onUrlChange,
  onAddPaste,
  onAddUrl,
  onRemove,
  onContinue,
  onSkip,
}: Step1Props) {
  return (
    <main className="mx-auto flex max-w-[620px] flex-col px-6 pt-14 pb-24 md:px-0 md:pt-20">
      {/* Eyebrow */}
      <p
        className="mb-5 text-[10px] uppercase tracking-[0.2em]"
        style={{
          fontFamily: "var(--font-mono)",
          color: "var(--color-ink-mute)",
        }}
      >
        CONTEXT
      </p>

      {/* Headline */}
      <h1
        className="mb-3 text-[32px] leading-[1.1] tracking-[-0.01em]"
        style={{
          fontFamily: "var(--font-merchant-display)",
          fontWeight: 500,
          color: "var(--color-ink)",
        }}
      >
        What should I read first?
      </h1>

      {/* Subhead */}
      <p
        className="mb-10 text-[13px] leading-[1.6]"
        style={{
          fontFamily: "var(--font-sans)",
          color: "var(--color-ink-soft)",
        }}
      >
        Drop in the brief, call transcripts, Notion pages, anything. I'll read
        it all before asking you anything.
      </p>

      {/* Drop zone */}
      <div
        className="mb-4 flex flex-col items-center gap-3 rounded-2xl border-2 border-dashed px-8 py-12"
        style={{ borderColor: "var(--color-rule)" }}
      >
        <Upload
          className="h-7 w-7 opacity-30"
          style={{ color: "var(--color-ink)" }}
        />
        <p
          className="text-[14px]"
          style={{
            fontFamily: "var(--font-sans)",
            color: "var(--color-ink-soft)",
          }}
        >
          Paste text or enter a URL
        </p>
        <p
          className="text-[10px] tracking-[0.16em]"
          style={{
            fontFamily: "var(--font-mono)",
            color: "var(--color-ink-mute)",
          }}
        >
          TXT · PDF · NOTION · PASTE
        </p>

        {/* Add buttons */}
        {adding === null && (
          <div className="mt-2 flex gap-3">
            <button
              onClick={() => onSetAdding("paste")}
              className="flex items-center gap-1.5 rounded-full border px-4 py-2 text-[12px] transition-opacity hover:opacity-70"
              style={{
                fontFamily: "var(--font-sans)",
                borderColor: "var(--color-rule)",
                color: "var(--color-ink-soft)",
              }}
            >
              <Plus className="h-3.5 w-3.5" />
              Paste text
            </button>
            <button
              onClick={() => onSetAdding("url")}
              className="flex items-center gap-1.5 rounded-full border px-4 py-2 text-[12px] transition-opacity hover:opacity-70"
              style={{
                fontFamily: "var(--font-sans)",
                borderColor: "var(--color-rule)",
                color: "var(--color-ink-soft)",
              }}
            >
              <Plus className="h-3.5 w-3.5" />
              Add URL
            </button>
          </div>
        )}

        {/* Paste form */}
        {adding === "paste" && (
          <div className="mt-2 w-full space-y-2">
            <textarea
              autoFocus
              rows={5}
              value={pasteText}
              onChange={(e) => onPasteChange(e.target.value)}
              placeholder="Paste your brief, call notes, or any context here..."
              className="w-full resize-none rounded-xl border px-4 py-3 text-[13px] outline-none transition-colors focus:border-current"
              style={{
                fontFamily: "var(--font-sans)",
                borderColor: "var(--color-rule)",
                background: "var(--color-paper)",
                color: "var(--color-ink)",
              }}
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => onSetAdding(null)}
                className="rounded-full px-4 py-1.5 text-[12px] transition-opacity hover:opacity-70"
                style={{
                  fontFamily: "var(--font-sans)",
                  color: "var(--color-ink-mute)",
                }}
              >
                Cancel
              </button>
              <button
                onClick={onAddPaste}
                disabled={!pasteText.trim()}
                className="rounded-full px-4 py-1.5 text-[12px] font-medium transition-opacity hover:opacity-80 disabled:opacity-40"
                style={{
                  background: "var(--color-forest)",
                  color: "var(--color-cream)",
                  fontFamily: "var(--font-sans)",
                }}
              >
                Add
              </button>
            </div>
          </div>
        )}

        {/* URL form */}
        {adding === "url" && (
          <div className="mt-2 w-full space-y-2">
            <input
              autoFocus
              type="url"
              value={urlValue}
              onChange={(e) => onUrlChange(e.target.value)}
              placeholder="https://notion.so/your-brief"
              className="w-full rounded-xl border px-4 py-3 text-[13px] outline-none transition-colors focus:border-current"
              style={{
                fontFamily: "var(--font-sans)",
                borderColor: "var(--color-rule)",
                background: "var(--color-paper)",
                color: "var(--color-ink)",
              }}
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => onSetAdding(null)}
                className="rounded-full px-4 py-1.5 text-[12px] transition-opacity hover:opacity-70"
                style={{
                  fontFamily: "var(--font-sans)",
                  color: "var(--color-ink-mute)",
                }}
              >
                Cancel
              </button>
              <button
                onClick={onAddUrl}
                disabled={!urlValue.trim()}
                className="rounded-full px-4 py-1.5 text-[12px] font-medium transition-opacity hover:opacity-80 disabled:opacity-40"
                style={{
                  background: "var(--color-forest)",
                  color: "var(--color-cream)",
                  fontFamily: "var(--font-sans)",
                }}
              >
                Add
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Attached items */}
      {contextSources.length > 0 && (
        <ul className="mb-6 space-y-2">
          {contextSources.map((src) => (
            <li
              key={src.id}
              className="flex items-center gap-3 rounded-xl border px-4 py-3"
              style={{
                background: "var(--color-paper)",
                borderColor: "var(--color-rule)",
              }}
            >
              {/* Green status dot */}
              <span
                className="h-2 w-2 shrink-0 rounded-full"
                style={{ background: "#3a7c52" }}
              />
              <span
                className="min-w-0 flex-1 truncate text-[13px]"
                style={{
                  fontFamily: "var(--font-sans)",
                  color: "var(--color-ink)",
                }}
              >
                {src.name}
              </span>
              <span
                className="shrink-0 text-[10px] uppercase tracking-[0.14em]"
                style={{
                  fontFamily: "var(--font-mono)",
                  color: "var(--color-ink-mute)",
                }}
              >
                {src.sourceType === "url" ? "URL" : "TEXT"}
              </span>
              <button
                onClick={() => onRemove(src.id)}
                className="shrink-0 transition-opacity hover:opacity-70"
                style={{ color: "var(--color-ink-mute)" }}
                aria-label="Remove"
              >
                <X className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
      )}

      {/* Footer actions */}
      <div className="flex items-center justify-between">
        <button
          onClick={onSkip}
          className="text-[13px] transition-opacity hover:opacity-70"
          style={{
            fontFamily: "var(--font-mono)",
            color: "var(--color-ink-mute)",
          }}
        >
          Skip -- start from scratch
        </button>
        <button
          onClick={onContinue}
          disabled={contextSources.length === 0}
          className="rounded-full px-6 py-2.5 text-[13px] font-medium transition-all hover:scale-[1.02] disabled:opacity-40 disabled:cursor-not-allowed"
          style={{
            background: "var(--color-forest)",
            color: "var(--color-cream)",
            fontFamily: "var(--font-sans)",
          }}
        >
          Continue
        </button>
      </div>
    </main>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Step 2: Conversational Chat
// ─────────────────────────────────────────────────────────────────────────────

interface Step2Props {
  messages: Message[]
  chatInput: string
  generating: boolean
  hasUserMessages: boolean
  messagesEndRef: React.RefObject<HTMLDivElement | null>
  onChatInputChange: (v: string) => void
  onSend: () => void
  onKeyDown: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void
  onGenerate: () => void
}

function Step2({
  messages,
  chatInput,
  generating,
  hasUserMessages,
  messagesEndRef,
  onChatInputChange,
  onSend,
  onKeyDown,
  onGenerate,
}: Step2Props) {
  return (
    <main className="mx-auto flex h-[calc(100vh-80px)] max-w-[680px] flex-col px-6 md:px-0">
      {/* Message list */}
      <div className="flex-1 overflow-y-auto py-6">
        <div className="flex flex-col gap-4">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className="max-w-[80%] rounded-2xl px-5 py-3.5 text-[14px] leading-[1.6]"
                style={
                  msg.role === "assistant"
                    ? {
                        background: "var(--color-paper)",
                        border: "1px solid var(--color-rule)",
                        color: "var(--color-ink)",
                        fontFamily: "var(--font-sans)",
                      }
                    : {
                        background: "var(--color-forest)",
                        color: "var(--color-cream)",
                        fontFamily: "var(--font-sans)",
                      }
                }
              >
                {msg.content}
              </div>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Composer + generate */}
      <div className="shrink-0 pb-6 space-y-3">
        {/* Generate button — shown after first user message */}
        {hasUserMessages && (
          <div className="flex justify-center">
            <button
              onClick={onGenerate}
              disabled={generating}
              className="rounded-full px-7 py-2.5 text-[13px] font-medium transition-all hover:scale-[1.02] disabled:opacity-60"
              style={{
                background: "var(--color-forest)",
                color: "var(--color-cream)",
                fontFamily: "var(--font-sans)",
              }}
            >
              {generating ? "Creating proposal…" : "Generate proposal"}
            </button>
          </div>
        )}

        {/* Chat input */}
        <div
          className="flex items-end gap-3 rounded-2xl border px-4 py-3"
          style={{
            background: "var(--color-paper)",
            borderColor: "var(--color-rule)",
          }}
        >
          <textarea
            rows={2}
            value={chatInput}
            onChange={(e) => onChatInputChange(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Reply…"
            className="flex-1 resize-none bg-transparent text-[14px] outline-none leading-[1.5]"
            style={{
              fontFamily: "var(--font-sans)",
              color: "var(--color-ink)",
            }}
          />
          <button
            onClick={onSend}
            disabled={!chatInput.trim()}
            className="mb-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition-opacity hover:opacity-80 disabled:opacity-30"
            style={{ background: "var(--color-forest)", color: "var(--color-cream)" }}
            aria-label="Send"
          >
            <Send className="h-3.5 w-3.5" />
          </button>
        </div>
        <p
          className="text-center text-[11px]"
          style={{
            fontFamily: "var(--font-mono)",
            color: "var(--color-ink-mute)",
          }}
        >
          ENTER to send · SHIFT+ENTER for new line
        </p>
      </div>
    </main>
  )
}
