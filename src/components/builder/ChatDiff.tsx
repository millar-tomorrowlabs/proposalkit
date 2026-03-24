import { Check } from "lucide-react"
import type { ProposedEdit } from "@/types/proposal"
import { useBuilderStore } from "@/store/builderStore"
import { formatPrice } from "@/lib/currency"

interface ChatDiffProps {
  edits: ProposedEdit[]
  applied: boolean
  onApply: () => void
}

const formatValue = (value: unknown, fieldPath: string, currency: string): string => {
  if (value == null) return "(empty)"
  if (typeof value === "number") {
    const isPrice = /price|Price|rate|Rate|basePrice|hourlyRate/.test(fieldPath)
    return isPrice ? formatPrice(value, currency) : String(value)
  }
  if (typeof value === "string") {
    if (value.length === 0) return "(empty)"
    return value.length > 100 ? value.slice(0, 100) + "..." : value
  }
  if (typeof value === "boolean") return value ? "Yes" : "No"
  return JSON.stringify(value).slice(0, 80)
}

const ChatDiff = ({ edits, applied, onApply }: ChatDiffProps) => {
  const currency = useBuilderStore((s) => s.proposal.currency ?? "USD")

  return (
    <div className="mt-2 rounded-lg border border-brand-1/25 bg-brand-1/5 p-3 space-y-2">
      {edits.map((edit, i) => (
        <div key={i} className="space-y-0.5">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            {edit.label}
          </p>
          <div className="flex flex-col gap-0.5 text-xs">
            <p className="text-muted-foreground/70 line-through">
              {formatValue(edit.oldValue, edit.fieldPath, currency)}
            </p>
            <p className="text-foreground">
              {formatValue(edit.newValue, edit.fieldPath, currency)}
            </p>
          </div>
        </div>
      ))}

      {applied ? (
        <div className="flex items-center gap-1.5 pt-1 text-xs font-medium text-brand-1">
          <Check className="h-3 w-3" />
          Applied
        </div>
      ) : (
        <button
          onClick={onApply}
          className="mt-1 rounded-md bg-foreground px-3 py-1.5 text-xs font-medium text-background transition-colors hover:bg-foreground/80"
        >
          Apply all
        </button>
      )}
    </div>
  )
}

export default ChatDiff
