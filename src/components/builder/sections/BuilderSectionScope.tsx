import { useBuilderStore } from "@/store/builderStore"
import { Plus, Trash2 } from "lucide-react"

const SuggestedList = ({
  items,
  path,
  onAddAll,
  onAddOne,
}: {
  items: string[]
  path: string
  onAddAll: () => void
  onAddOne: (item: string) => void
}) => {
  const { dismissedSuggestions, dismissSuggestion } = useBuilderStore()
  if (!items.length || dismissedSuggestions.includes(path)) return null
  return (
    <div className="rounded border border-brand-1/25 bg-brand-1/5 p-3 space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-muted-foreground">Suggestions</p>
        <button onClick={() => dismissSuggestion(path)} className="text-xs text-muted-foreground hover:text-foreground">Dismiss</button>
      </div>
      {items.map((item, i) => (
        <div key={i} className="flex items-start justify-between gap-2 rounded bg-background/60 px-2 py-1.5">
          <p className="flex-1 text-xs text-foreground/80 leading-relaxed">{item}</p>
          <button onClick={() => onAddOne(item)} className="shrink-0 text-xs font-medium text-brand-1 hover:underline">Add</button>
        </div>
      ))}
      <button onClick={() => { onAddAll(); dismissSuggestion(path) }} className="text-xs font-medium text-brand-1 hover:underline">Add all</button>
    </div>
  )
}

const BuilderSectionScope = () => {
  const { proposal, updateField, suggestions } = useBuilderStore()
  const scope = proposal.scope

  const updateList = (key: keyof typeof scope, index: number, value: string) => {
    const list = [...scope[key]]
    list[index] = value
    updateField("scope", { ...scope, [key]: list })
  }

  const addItem = (key: keyof typeof scope) => {
    updateField("scope", { ...scope, [key]: [...scope[key], ""] })
  }

  const removeItem = (key: keyof typeof scope, index: number) => {
    updateField("scope", { ...scope, [key]: scope[key].filter((_, i) => i !== index) })
  }

  const renderList = (key: keyof typeof scope, label: string, placeholder: string) => (
    <div className="space-y-2">
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-[0.1em]">{label}</p>
      {scope[key].map((item, i) => (
        <div key={i} className="flex items-start gap-2">
          <textarea
            value={item}
            onChange={(e) => updateList(key, i, e.target.value)}
            rows={2}
            placeholder={placeholder}
            className="builder-input flex-1 resize-none"
          />
          <button onClick={() => removeItem(key, i)} className="mt-2 text-muted-foreground hover:text-foreground transition-colors shrink-0">
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      ))}
      <button
        onClick={() => addItem(key)}
        className="flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-border py-2.5 text-xs font-medium text-muted-foreground hover:border-foreground hover:text-foreground transition-colors"
      >
        <Plus className="h-3.5 w-3.5" /> Add item
      </button>
    </div>
  )

  return (
    <div className="space-y-6">
      <h2 className="text-sm font-semibold text-foreground">Scope</h2>
      {renderList("outcomes", "Outcomes", "Flush and Seawards live on Shopify by end of May")}
      {suggestions?.scope?.outcomes && (
        <SuggestedList
          items={suggestions.scope.outcomes}
          path="scope.outcomes"
          onAddOne={(item) => updateField("scope", { ...scope, outcomes: [...scope.outcomes, item] })}
          onAddAll={() => updateField("scope", { ...scope, outcomes: [...scope.outcomes, ...suggestions!.scope!.outcomes!] })}
        />
      )}
      <hr className="border-border" />
      {renderList("responsibilities", "Client responsibilities", "Provide supplier spreadsheets for product catalog")}
      {suggestions?.scope?.responsibilities && (
        <SuggestedList
          items={suggestions.scope.responsibilities}
          path="scope.responsibilities"
          onAddOne={(item) => updateField("scope", { ...scope, responsibilities: [...scope.responsibilities, item] })}
          onAddAll={() => updateField("scope", { ...scope, responsibilities: [...scope.responsibilities, ...suggestions!.scope!.responsibilities!] })}
        />
      )}
    </div>
  )
}

export default BuilderSectionScope
