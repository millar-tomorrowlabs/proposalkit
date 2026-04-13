import { useState } from "react"
import type { ProposalData } from "@/types/proposal"
import InlineEditable from "./InlineEditable"

type Props = { data: ProposalData["timeline"] }

const TimelineSection = ({ data }: Props) => {
  const [active, setActive] = useState(0)

  const phases = data.phases
  const colors = ["bg-brand-1", "bg-brand-1", "bg-brand-2", "bg-brand-2", "bg-foreground", "bg-foreground"]

  // Clamp active index to valid range when phases are removed
  const safeActive = Math.min(active, phases.length - 1)
  if (safeActive !== active && phases.length > 0) setActive(safeActive)

  if (phases.length === 0) {
    return (
      <section id="timeline" className="px-6 py-24">
        <div className="mx-auto max-w-3xl">
          <h2 className="scroll-reveal font-display text-5xl font-semibold leading-[1.05] tracking-tight text-foreground md:text-7xl lg:text-8xl">
            Timeline
          </h2>
          {data.subtitle && (
            <InlineEditable
              fieldPath="timeline.subtitle"
              value={data.subtitle}
              tag="p"
              className="scroll-reveal delay-100 mt-6 text-lg text-muted-foreground"
            />
          )}
          <p className="mt-6 text-sm text-muted-foreground">No phases configured yet.</p>
        </div>
      </section>
    )
  }

  return (
    <section id="timeline" className="px-6 py-24">
      <div className="mx-auto max-w-3xl">
        <h2 className="scroll-reveal font-display text-5xl font-semibold leading-[1.05] tracking-tight text-foreground md:text-7xl lg:text-8xl">
          Timeline
        </h2>

        <InlineEditable
          fieldPath="timeline.subtitle"
          value={data.subtitle}
          tag="p"
          className="scroll-reveal delay-100 mt-6 text-lg text-muted-foreground"
        />

        <div className="scroll-reveal delay-200 mt-12 flex flex-wrap gap-2">
          {phases.map((phase, i) => (
            <button
              key={phase.name}
              onClick={() => setActive(i)}
              className={`rounded-full border px-4 py-2 text-sm font-medium transition-all duration-200 ${
                safeActive === i
                  ? "border-foreground bg-foreground text-background"
                  : "border-border text-muted-foreground hover:border-foreground hover:text-foreground"
              }`}
            >
              {phase.name}
            </button>
          ))}
        </div>

        <div className="scroll-reveal delay-300 mt-8 rounded-lg border border-border bg-card p-8">
          <div className="flex items-baseline justify-between">
            <InlineEditable
              fieldPath={`timeline.phases.${safeActive}.name`}
              value={phases[safeActive].name}
              tag="h3"
              className="font-display text-2xl font-semibold text-foreground"
            />
            <InlineEditable
              fieldPath={`timeline.phases.${safeActive}.duration`}
              value={phases[safeActive].duration}
              tag="span"
              className="text-sm font-medium text-muted-foreground"
            />
          </div>
          <InlineEditable
            fieldPath={`timeline.phases.${safeActive}.description`}
            value={phases[safeActive].description}
            multiline
            tag="p"
            className="mt-4 leading-relaxed text-muted-foreground"
          />
        </div>

        <div className="scroll-reveal delay-400 mt-6 flex gap-1">
          {phases.map((_, i) => (
            <div
              key={i}
              className={`h-1.5 flex-1 rounded-full transition-colors duration-300 ${
                i <= safeActive ? (colors[i] ?? "bg-foreground") : "bg-border"
              }`}
            />
          ))}
        </div>
      </div>
    </section>
  )
}

export default TimelineSection
