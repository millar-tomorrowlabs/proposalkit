import type { ChatMessage } from "@/types/proposal"
import { useBuilderStore } from "@/store/builderStore"
import ChatDiff from "./ChatDiff"

interface ChatMessageBubbleProps {
  message: ChatMessage
}

const ChatMessageBubble = ({ message }: ChatMessageBubbleProps) => {
  const applyChatEdits = useBuilderStore((s) => s.applyChatEdits)

  if (message.role === "user") {
    return (
      <div className="flex justify-end">
        <div className="chat-message-user max-w-[85%]">
          {message.content}
        </div>
      </div>
    )
  }

  return (
    <div className="flex justify-start">
      <div className="max-w-[90%]">
        <div className="chat-message-assistant whitespace-pre-wrap">
          {message.content}
        </div>
        {message.edits && message.edits.length > 0 && (
          <ChatDiff
            edits={message.edits}
            applied={message.editsApplied ?? false}
            onApply={() => applyChatEdits(message.id)}
          />
        )}
      </div>
    </div>
  )
}

export default ChatMessageBubble
