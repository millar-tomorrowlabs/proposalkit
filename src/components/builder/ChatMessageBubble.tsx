import { useEffect, useRef } from "react"
import type { UIMessage } from "ai"
import { useBuilderStore } from "@/store/builderStore"
import ChatDiff from "./ChatDiff"
import type { ProposedEdit } from "@/types/proposal"

interface ChatMessageBubbleProps {
  message: UIMessage
  isStreaming?: boolean
}

/**
 * Parse proposal-edits JSON blocks from assistant text and strip them
 * completely from the visible output. Uses aggressive stripping to ensure
 * no code blocks, JSON, or technical artifacts are ever visible to the user
 * — even mid-stream.
 */
function parseEditsFromText(text: string): { cleanText: string; edits: ProposedEdit[] } {
  const edits: ProposedEdit[] = []

  // Step 1: Extract edits from complete ```proposal-edits ... ``` blocks
  const withoutComplete = text.replace(
    /```proposal-edits[\s\S]*?```/g,
    (match) => {
      // Extract JSON from inside the block
      const jsonMatch = match.match(/```proposal-edits\s*\n?([\s\S]*?)```/)
      if (jsonMatch?.[1]) {
        try {
          const parsed = JSON.parse(jsonMatch[1].trim())
          if (Array.isArray(parsed)) {
            edits.push(...(parsed as ProposedEdit[]))
          }
        } catch {
          // Malformed JSON — still strip the block
        }
      }
      return ""
    },
  )

  // Step 2: Aggressively strip anything after the first ``` in the remaining text.
  // Code blocks should NEVER be visible in the chat. If we see triple backticks,
  // everything from that point is either a partial code block (streaming) or
  // something that shouldn't be shown.
  const firstBackticks = withoutComplete.indexOf("```")
  const cleaned = firstBackticks !== -1
    ? withoutComplete.slice(0, firstBackticks)
    : withoutComplete

  return { cleanText: cleaned.trim(), edits }
}

const ChatMessageBubble = ({ message, isStreaming = false }: ChatMessageBubbleProps) => {
  const { applyChatEdits } = useBuilderStore()
  const appliedEditIds = useBuilderStore((s) => s.appliedEditIds)

  if (message.role === "user") {
    const text = message.parts
      .filter((p) => p.type === "text")
      .map((p) => (p as { type: "text"; text: string }).text)
      .join("")

    return (
      <div className="flex justify-end">
        <div className="chat-message-user max-w-[85%]">{text}</div>
      </div>
    )
  }

  // Extract raw text from parts
  const rawText = message.parts
    .filter((p) => p.type === "text")
    .map((p) => (p as { type: "text"; text: string }).text)
    .join("")

  // Parse edits from proposal-edits code blocks in text
  const { cleanText, edits: textEdits } = parseEditsFromText(rawText)

  // Also check tool parts (for future when tool calls are re-enabled)
  const toolEdits: ProposedEdit[] = []
  for (const part of message.parts) {
    if (part.type === "dynamic-tool") {
      const dynPart = part as { type: "dynamic-tool"; toolName: string; args?: Record<string, unknown> }
      if (dynPart.toolName === "propose_edits" && dynPart.args?.edits) {
        toolEdits.push(...(dynPart.args.edits as ProposedEdit[]))
      }
    }
  }

  const edits = [...textEdits, ...toolEdits]
  const editsApplied = appliedEditIds.has(message.id)

  // Register edits and auto-apply when streaming completes
  const appliedRef = useRef<string | null>(null)
  useEffect(() => {
    if (
      !isStreaming &&
      edits.length > 0 &&
      !editsApplied &&
      appliedRef.current !== message.id
    ) {
      appliedRef.current = message.id
      const store = useBuilderStore.getState()
      store.registerChatEdits(message.id, edits)
      // Apply immediately after registration (Zustand set is synchronous)
      store.applyChatEdits(message.id)
    }
  }, [isStreaming, edits.length, editsApplied, message.id])

  return (
    <div className="flex justify-start">
      <div className="max-w-[90%]">
        {cleanText && (
          <div className="chat-message-assistant whitespace-pre-wrap">{cleanText}</div>
        )}
        {edits.length > 0 && (
          <ChatDiff
            edits={edits}
            applied={editsApplied}
            onApply={() => applyChatEdits(message.id)}
          />
        )}
      </div>
    </div>
  )
}

export default ChatMessageBubble
