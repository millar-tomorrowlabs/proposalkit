import { useBuilderStore } from "@/store/builderStore"

interface SuggestionChipProps {
  suggestion: string | undefined
  path: string
  onAccept: (value: string) => void
}

const SuggestionChip = ({ suggestion, path, onAccept }: SuggestionChipProps) => {
  const { dismissedSuggestions, dismissSuggestion } = useBuilderStore()

  if (!suggestion || dismissedSuggestions.includes(path)) return null

  return (
    <div className="mt-1.5 rounded border border-brand-1/25 bg-brand-1/5 px-3 py-2">
      <p className="mb-1.5 text-xs font-medium text-muted-foreground">Suggestion</p>
      <p className="text-xs text-foreground/80 leading-relaxed line-clamp-3">{suggestion}</p>
      <div className="mt-2 flex gap-3">
        <button
          onClick={() => { onAccept(suggestion); dismissSuggestion(path) }}
          className="text-xs font-medium text-brand-1 hover:underline"
        >
          Accept
        </button>
        <button
          onClick={() => dismissSuggestion(path)}
          className="text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          Dismiss
        </button>
      </div>
    </div>
  )
}

export default SuggestionChip
