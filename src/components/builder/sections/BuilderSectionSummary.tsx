import { useBuilderStore } from "@/store/builderStore"
import BuilderField from "../BuilderField"
import SuggestionChip from "../SuggestionChip"
import { Plus, Trash2 } from "lucide-react"

const BuilderSectionSummary = () => {
  const { proposal, updateField, suggestions, dismissSuggestion, dismissedSuggestions } = useBuilderStore()
  const summary = proposal.summary

  const update = (key: keyof typeof summary, value: unknown) => {
    updateField("summary", { ...summary, [key]: value })
  }

  const updatePillar = (index: number, key: "label" | "description", value: string) => {
    const pillars = summary.pillars.map((p, i) =>
      i === index ? { ...p, [key]: value } : p
    )
    update("pillars", pillars)
  }

  const addPillar = () => {
    update("pillars", [...summary.pillars, { label: "", description: "" }])
  }

  const removePillar = (index: number) => {
    update("pillars", summary.pillars.filter((_, i) => i !== index))
  }

  return (
    <div className="space-y-5">
      <h2 className="text-sm font-semibold text-foreground">About the studio</h2>

      <BuilderField label="Studio tagline">
        <input
          type="text"
          value={summary.studioTagline}
          onChange={(e) => update("studioTagline", e.target.value)}
          placeholder="Designing the next generation of commerce systems."
          className="builder-input"
        />
        <SuggestionChip suggestion={suggestions?.summary?.studioTagline} path="summary.studioTagline" onAccept={(v) => update("studioTagline", v)} />
      </BuilderField>

      <BuilderField label="Studio description">
        <textarea
          value={summary.studioDescription}
          onChange={(e) => update("studioDescription", e.target.value)}
          rows={3}
          className="builder-input resize-none"
        />
        <SuggestionChip suggestion={suggestions?.summary?.studioDescription} path="summary.studioDescription" onAccept={(v) => update("studioDescription", v)} />
      </BuilderField>

      <BuilderField label="Studio description (continued)">
        <textarea
          value={summary.studioDescription2}
          onChange={(e) => update("studioDescription2", e.target.value)}
          rows={3}
          className="builder-input resize-none"
        />
        <SuggestionChip suggestion={suggestions?.summary?.studioDescription2} path="summary.studioDescription2" onAccept={(v) => update("studioDescription2", v)} />
      </BuilderField>

      <hr className="border-border" />
      <h2 className="text-sm font-semibold text-foreground">About the project</h2>

      <BuilderField label="Project overview" hint="One sentence shown in the section header area">
        <textarea
          value={summary.projectOverview}
          onChange={(e) => update("projectOverview", e.target.value)}
          rows={2}
          className="builder-input resize-none"
        />
        <SuggestionChip suggestion={suggestions?.summary?.projectOverview} path="summary.projectOverview" onAccept={(v) => update("projectOverview", v)} />
      </BuilderField>

      <BuilderField label="Project detail">
        <textarea
          value={summary.projectDetail}
          onChange={(e) => update("projectDetail", e.target.value)}
          rows={4}
          className="builder-input resize-none"
        />
        <SuggestionChip suggestion={suggestions?.summary?.projectDetail} path="summary.projectDetail" onAccept={(v) => update("projectDetail", v)} />
      </BuilderField>

      <BuilderField label="Project detail (continued)" hint="Optional second paragraph">
        <textarea
          value={summary.projectDetail2 ?? ""}
          onChange={(e) => update("projectDetail2", e.target.value)}
          rows={3}
          className="builder-input resize-none"
        />
        <SuggestionChip suggestion={suggestions?.summary?.projectDetail2} path="summary.projectDetail2" onAccept={(v) => update("projectDetail2", v)} />
      </BuilderField>

      <hr className="border-border" />
      <h2 className="text-sm font-semibold text-foreground">Pillars</h2>

      <BuilderField label="Pillars tagline">
        <input
          type="text"
          value={summary.pillarsTagline}
          onChange={(e) => update("pillarsTagline", e.target.value)}
          placeholder="Three workstreams that define this engagement."
          className="builder-input"
        />
        <SuggestionChip suggestion={suggestions?.summary?.pillarsTagline} path="summary.pillarsTagline" onAccept={(v) => update("pillarsTagline", v)} />
      </BuilderField>

      {/* Suggested pillars panel */}
      {suggestions?.summary?.pillars && suggestions.summary.pillars.length > 0 && !dismissedSuggestions.includes("summary.pillars") && (
        <div className="rounded border border-brand-1/25 bg-brand-1/5 p-3 space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-muted-foreground">Suggested pillars</p>
            <button onClick={() => dismissSuggestion("summary.pillars")} className="text-xs text-muted-foreground hover:text-foreground">Dismiss</button>
          </div>
          {suggestions.summary.pillars.map((p, i) => (
            <div key={i} className="flex items-start justify-between gap-2 rounded bg-background/60 px-2 py-1.5">
              <div>
                <span className="text-xs font-medium text-foreground">{p.label}</span>
                <span className="ml-2 text-xs text-muted-foreground">{p.description}</span>
              </div>
              <button
                onClick={() => {
                  update("pillars", [...summary.pillars, { label: p.label, description: p.description }])
                }}
                className="shrink-0 text-xs font-medium text-brand-1 hover:underline"
              >
                Add
              </button>
            </div>
          ))}
          <button
            onClick={() => {
              update("pillars", [...summary.pillars, ...suggestions!.summary!.pillars!.map(p => ({ label: p.label, description: p.description }))])
              dismissSuggestion("summary.pillars")
            }}
            className="text-xs font-medium text-brand-1 hover:underline"
          >
            Add all
          </button>
        </div>
      )}

      <div className="space-y-3">
        {summary.pillars.map((pillar, i) => (
          <div key={i} className="rounded-lg border border-border p-3 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">Pillar {i + 1}</span>
              <button onClick={() => removePillar(i)} className="text-muted-foreground hover:text-foreground transition-colors">
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
            <input
              type="text"
              value={pillar.label}
              onChange={(e) => updatePillar(i, "label", e.target.value)}
              placeholder="Commerce"
              className="builder-input"
            />
            <input
              type="text"
              value={pillar.description}
              onChange={(e) => updatePillar(i, "description", e.target.value)}
              placeholder="Shopify ecommerce + POS for both stores"
              className="builder-input"
            />
          </div>
        ))}
        <button
          onClick={addPillar}
          className="flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-border py-2.5 text-xs font-medium text-muted-foreground hover:border-foreground hover:text-foreground transition-colors"
        >
          <Plus className="h-3.5 w-3.5" /> Add pillar
        </button>
      </div>
    </div>
  )
}

export default BuilderSectionSummary
