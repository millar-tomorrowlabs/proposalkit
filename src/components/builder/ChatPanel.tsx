import { useRef, useEffect, useState, useCallback } from "react"
import { v4 as uuidv4 } from "uuid"
import { ChevronUp, ChevronDown, Send } from "lucide-react"
import { useBuilderStore } from "@/store/builderStore"
import { useAccount } from "@/contexts/AccountContext"
import { supabase } from "@/lib/supabase"
import ChatMessageBubble from "./ChatMessageBubble"
import type { ChatMessage } from "@/types/proposal"

const ChatPanel = () => {
  const { account } = useAccount()
  const {
    chatMessages,
    chatLoading,
    chatPanelOpen,
    setChatPanelOpen,
    addChatMessage,
    setChatLoading,
    proposal,
  } = useBuilderStore()

  const [input, setInput] = useState("")
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [chatMessages.length, chatLoading])

  // Auto-resize textarea
  useEffect(() => {
    const ta = textareaRef.current
    if (ta) {
      ta.style.height = "auto"
      ta.style.height = Math.min(ta.scrollHeight, 120) + "px"
    }
  }, [input])

  const sendMessage = useCallback(async () => {
    const trimmed = input.trim()
    if (!trimmed || chatLoading) return

    setInput("")

    // Add user message
    const userMsg: ChatMessage = {
      id: uuidv4(),
      role: "user",
      content: trimmed,
      createdAt: new Date().toISOString(),
    }
    addChatMessage(userMsg)
    setChatLoading(true)

    try {
      // Build conversation history (stripped to role + content)
      const history = chatMessages.map((m) => ({
        role: m.role,
        content: m.content,
      }))

      const { data, error } = await supabase.functions.invoke("chat-edit-proposal", {
        body: {
          messages: history,
          proposal,
          userMessage: trimmed,
          accountContext: {
            studioName: account.studioName,
            studioDescription: account.aiStudioDescription,
          },
        },
      })

      if (error) throw error

      const assistantMsg: ChatMessage = {
        id: uuidv4(),
        role: "assistant",
        content: data.content || "I couldn't generate a response.",
        edits: data.edits?.length ? data.edits : undefined,
        createdAt: new Date().toISOString(),
      }
      addChatMessage(assistantMsg)
    } catch (err) {
      const errorMsg: ChatMessage = {
        id: uuidv4(),
        role: "assistant",
        content: `Something went wrong: ${err instanceof Error ? err.message : String(err)}`,
        createdAt: new Date().toISOString(),
      }
      addChatMessage(errorMsg)
    } finally {
      setChatLoading(false)
    }
  }, [input, chatLoading, chatMessages, proposal, addChatMessage, setChatLoading])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  return (
    <div className="flex h-full flex-col border-t border-border bg-background">
      {/* Header */}
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

      {chatPanelOpen && (
        <>
          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
            {chatMessages.length === 0 && (
              <p className="text-center text-xs text-muted-foreground py-8">
                Ask the AI to edit your proposal. Try "make the tagline punchier" or "add a QA phase to the timeline".
              </p>
            )}
            {chatMessages.map((msg) => (
              <ChatMessageBubble key={msg.id} message={msg} />
            ))}
            {chatLoading && (
              <div className="chat-typing-indicator">
                <span />
                <span />
                <span />
              </div>
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
              <button
                onClick={sendMessage}
                disabled={!input.trim() || chatLoading}
                className="shrink-0 rounded-md bg-foreground p-2 text-background transition-colors hover:bg-foreground/80 disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <Send className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

export default ChatPanel
