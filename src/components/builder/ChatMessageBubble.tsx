import { useEffect, useRef } from "react"
import type { UIMessage } from "ai"
import { useBuilderStore } from "@/store/builderStore"
import ChatDiff from "./ChatDiff"
import type { ProposedEdit } from "@/types/proposal"

interface ChatMessageBubbleProps {
  message: UIMessage
}

/**
 * Parse proposal-edits JSON blocks from assistant text.
 * The AI outputs edits as:
 * ```proposal-edits
 * [{ "fieldPath": "...", "oldValue": "...", "newValue": "...", "label": "..." }]
 * ```
 */
function parseEditsFromText(text: string): { cleanText: string; edits: ProposedEdit[] } {
  const edits: ProposedEdit[] = []
  // Match ```proposal-edits ... ``` blocks
  const cleanText = text.replace(
    /```proposal-edits\s*\n([\s\S]*?)```/g,
    (_match, json: string) => {
      try {
        const parsed = JSON.parse(json.trim())
        if (Array.isArray(parsed)) {
          edits.push(...(parsed as ProposedEdit[]))
        }
      } catch {
        // If JSON parsing fails, leave the block as text
        return _match
      }
      return "" // Remove the code block from displayed text
    },
  ).trim()

  return { cleanText, edits }
}

const ChatMessageBubble = ({ message }: ChatMessageBubbleProps) => {
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

  // Register parsed edits with the store so applyChatEdits can find them
  const registeredRef = useRef<string | null>(null)
  useEffect(() => {
    if (edits.length > 0 && registeredRef.current !== message.id) {
      useBuilderStore.getState().registerChatEdits(message.id, edits)
      registeredRef.current = message.id
    }
  }, [edits.length, message.id])

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
