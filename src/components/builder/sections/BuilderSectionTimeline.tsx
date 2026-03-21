import { useBuilderStore } from "@/store/builderStore"
import BuilderField from "../BuilderField"
import { Plus, Trash2 } from "lucide-react"
import type { TimelinePhase } from "@/types/proposal"

const BuilderSectionTimeline = () => {
  const { proposal, updateField } = useBuilderStore()
  const timeline = proposal.timeline

  const updatePhase = (index: number, key: keyof TimelinePhase, value: string) => {
    const phases = timeline.phases.map((p, i) =>
      i === index ? { ...p, [key]: value } : p
    )
    updateField("timeline", { ...timeline, phases })
  }

  const addPhase = () => {
    updateField("timeline", {
      ...timeline,
      phases: [...timeline.phases, { name: "", duration: "", description: "" }],
    })
  }

  const removePhase = (index: number) => {
    updateField("timeline", {
      ...timeline,
      phases: timeline.phases.filter((_, i) => i !== index),
    })
  }

  return (
    <div className="space-y-5">
      <h2 className="text-sm font-semibold text-foreground">Timeline</h2>

      <BuilderField label="Subtitle">
        <input
          type="text"
          value={timeline.subtitle}
          onChange={(e) => updateField("timeline", { ...timeline, subtitle: e.target.value })}
          placeholder="Launch by end of May."
          className="builder-input"
        />
      </BuilderField>

      <div className="space-y-3">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-[0.1em]">Phases</p>
        {timeline.phases.map((phase, i) => (
          <div key={i} className="rounded-lg border border-border p-3 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">Phase {i + 1}</span>
              <button onClick={() => removePhase(i)} className="text-muted-foreground hover:text-foreground transition-colors">
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <input
                type="text"
                value={phase.name}
                onChange={(e) => updatePhase(i, "name", e.target.value)}
                placeholder="Kickoff & Setup"
                className="builder-input"
              />
              <input
                type="text"
                value={phase.duration}
                onChange={(e) => updatePhase(i, "duration", e.target.value)}
                placeholder="Week 1"
                className="builder-input"
              />
            </div>
            <textarea
              value={phase.description}
              onChange={(e) => updatePhase(i, "description", e.target.value)}
              rows={2}
              placeholder="What happens during this phase..."
              className="builder-input resize-none"
            />
          </div>
        ))}
        <button
          onClick={addPhase}
          className="flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-border py-2.5 text-xs font-medium text-muted-foreground hover:border-foreground hover:text-foreground transition-colors"
        >
          <Plus className="h-3.5 w-3.5" /> Add phase
        </button>
      </div>
    </div>
  )
}

export default BuilderSectionTimeline
