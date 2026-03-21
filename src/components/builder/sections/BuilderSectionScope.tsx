import { useBuilderStore } from "@/store/builderStore"
import { Plus, Trash2 } from "lucide-react"

const BuilderSectionScope = () => {
  const { proposal, updateField } = useBuilderStore()
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
      <hr className="border-border" />
      {renderList("responsibilities", "Client responsibilities", "Provide supplier spreadsheets for product catalog")}
    </div>
  )
}

export default BuilderSectionScope
