import { useRef, useEffect, useState, useCallback, useMemo } from "react"
import { ChevronUp, ChevronDown, Send, Square } from "lucide-react"
import { useChat } from "@ai-sdk/react"
import { DefaultChatTransport } from "ai"
import { useBuilderStore } from "@/store/builderStore"
import { useAccount } from "@/contexts/AccountContext"
import { useAuth } from "@/contexts/AuthContext"
import { supabase } from "@/lib/supabase"
import ChatMessageBubble from "./ChatMessageBubble"

interface ChatPanelProps {
  alwaysOpen?: boolean
}

const ChatPanel = ({ alwaysOpen = false }: ChatPanelProps) => {
  const { account } = useAccount()
  const { session } = useAuth()
  const {
    chatPanelOpen,
    setChatPanelOpen,
    proposal,
    pendingChatPrompt,
    setPendingChatPrompt,
  } = useBuilderStore()

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const [input, setInput] = useState("")

  // Build transport with auth headers and proposal context
  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/chat",
        headers: async () => {
          const { data } = await supabase.auth.getSession()
          const token = data.session?.access_token ?? session.access_token
          return { Authorization: `Bearer ${token}` }
        },
        body: {
          proposal,
          accountContext: {
            studioName: account.studioName,
            studioDescription: account.aiStudioDescription,
            studioTagline: account.aiStudioTagline,
            brief: proposal.brief,
          },
        },
      }),
    // Intentionally depend on proposal so body stays current
    [proposal, account, session],
  )

  const {
    messages,
    sendMessage,
    status,
    stop,
    error,
  } = useChat({
    id: `chat-${proposal.id}`,
    transport,
    onError: (err) => {
      console.error("Chat error:", err)
    },
  })

  const isStreaming = status === "streaming" || status === "submitted"

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages.length, status])

  // Auto-resize textarea
  useEffect(() => {
    const ta = textareaRef.current
    if (ta) {
      ta.style.height = "auto"
      ta.style.height = Math.min(ta.scrollHeight, 120) + "px"
    }
  }, [input])

  // Handle sending a message
  const handleSend = useCallback(() => {
    const trimmed = input.trim()
    if (!trimmed || isStreaming) return
    setInput("")
    sendMessage({ text: trimmed })
  }, [input, isStreaming, sendMessage])

  // Auto-send pending chat prompt (triggered by AskAIGhost buttons)
  useEffect(() => {
    if (pendingChatPrompt && !isStreaming) {
      const prompt = pendingChatPrompt
      setPendingChatPrompt(null)
      setTimeout(() => sendMessage({ text: prompt }), 0)
    }
  }, [pendingChatPrompt, isStreaming, setPendingChatPrompt, sendMessage])

  // Sync messages to Zustand store for DB persistence
  useEffect(() => {
    if (messages.length > 0 && status === "ready") {
      useBuilderStore.getState().syncChatFromUIMessages(messages)
    }
  }, [messages, status])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const isOpen = alwaysOpen || chatPanelOpen

  return (
    <div className={`flex h-full flex-col ${alwaysOpen ? "" : "border-t border-border"} bg-background`}>
      {/* Header — hidden when alwaysOpen (tab provides the header) */}
      {!alwaysOpen && (
        <button
          onClick={() => setChatPanelOpen(!chatPanelOpen)}
          className="flex h-9 shrink-0 items-center justify-between px-4 text-xs font-semibold text-foreground hover:bg-muted/50 transition-colors"
        >
          <span>Chat</span>
          {chatPanelOpen ? (
            <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
          ) : (
            <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" />
          )}
        </button>
      )}

      {isOpen && (
        <>
          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
            {messages.length === 0 && (
              <p className="text-center text-xs text-muted-foreground py-8">
                Ask the AI to edit your proposal. Try "make the tagline punchier" or "add a QA phase to the timeline".
              </p>
            )}
            {messages.map((msg) => (
              <ChatMessageBubble key={msg.id} message={msg} />
            ))}
            {isStreaming && messages[messages.length - 1]?.role !== "assistant" && (
              <div className="chat-typing-indicator">
                <span />
                <span />
                <span />
              </div>
            )}
            {error && (
              <p className="text-xs text-red-500 px-1">
                Something went wrong. Please try again.
              </p>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="shrink-0 border-t border-border p-3">
            <div className="flex items-end gap-2">
              <textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Describe a change..."
                rows={1}
                className="builder-input flex-1 resize-none !py-2"
              />
              {isStreaming ? (
                <button
                  onClick={stop}
                  className="shrink-0 rounded-md bg-foreground p-2 text-background transition-colors hover:bg-foreground/80"
                  title="Stop generating"
                >
                  <Square className="h-3.5 w-3.5" />
                </button>
              ) : (
                <button
                  onClick={handleSend}
                  disabled={!input.trim()}
                  className="shrink-0 rounded-md bg-foreground p-2 text-background transition-colors hover:bg-foreground/80 disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  <Send className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}

export default ChatPanel
