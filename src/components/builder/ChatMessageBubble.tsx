import type { UIMessage } from "ai"
import { useBuilderStore } from "@/store/builderStore"
import ChatDiff from "./ChatDiff"
import type { ProposedEdit } from "@/types/proposal"

interface ChatMessageBubbleProps {
  message: UIMessage
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

  // Extract text from parts
  const text = message.parts
    .filter((p) => p.type === "text")
    .map((p) => (p as { type: "text"; text: string }).text)
    .join("")

  // Extract edits from tool parts (dynamic-tool type in AI SDK v6)
  const edits: ProposedEdit[] = []
  for (const part of message.parts) {
    // AI SDK v6: untyped tools come as "dynamic-tool"
    if (part.type === "dynamic-tool") {
      const dynPart = part as { type: "dynamic-tool"; toolName: string; args?: Record<string, unknown>; state?: string }
      if (dynPart.toolName === "propose_edits" && dynPart.args?.edits) {
        edits.push(...(dynPart.args.edits as ProposedEdit[]))
      }
    }
    // Also handle typed tool parts (type: "tool-propose_edits")
    if (typeof part.type === "string" && part.type.startsWith("tool-")) {
      const toolPart = part as { type: string; args?: Record<string, unknown> }
      if (part.type === "tool-propose_edits" && toolPart.args?.edits) {
        edits.push(...(toolPart.args.edits as ProposedEdit[]))
      }
    }
  }

  const editsApplied = appliedEditIds.has(message.id)

  return (
    <div className="flex justify-start">
      <div className="max-w-[90%]">
        {text && (
          <div className="chat-message-assistant whitespace-pre-wrap">{text}</div>
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
