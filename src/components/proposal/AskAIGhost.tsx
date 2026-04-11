import { Sparkles } from "lucide-react"
import { useBuilderPreview } from "@/contexts/BuilderPreviewContext"
import { useBuilderStore } from "@/store/builderStore"

interface AskAIGhostProps {
  /** The value to check — if empty/falsy, the ghost button appears */
  value: string | undefined
  /** The prompt to send to the AI chat when clicked */
  prompt: string
  /** Optional custom label (defaults to "Ask AI to write this") */
  label?: string
  /** Additional CSS classes */
  className?: string
}

const AskAIGhost = ({ value, prompt, label = "Ask AI to write this", className = "" }: AskAIGhostProps) => {
  const { isEditable } = useBuilderPreview()

  // Only show in builder when the field is empty
  if (!isEditable || (value && value.trim())) return null

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    e.preventDefault()

    // Switch to chat tab and send the prompt
    useBuilderStore.getState().setPendingChatPrompt(prompt)
  }

  return (
    <button
      onClick={handleClick}
      className={`flex items-center gap-1.5 rounded-md border border-dashed border-border/60 px-3 py-2 text-xs text-muted-foreground/50 hover:text-muted-foreground hover:border-border transition-colors ${className}`}
      contentEditable={false}
    >
      <Sparkles className="h-3 w-3" />
      {label}
    </button>
  )
}

export default AskAIGhost
