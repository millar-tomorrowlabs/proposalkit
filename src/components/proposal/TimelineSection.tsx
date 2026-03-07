import { useState } from "react"
import { useScrollRevealAll } from "@/hooks/useScrollReveal"
import type { ProposalData } from "@/types/proposal"

type Props = { data: ProposalData["timeline"] }

const TimelineSection = ({ data }: Props) => {
  useScrollRevealAll()
  const [active, setActive] = useState(0)

  const phases = data.phases
  const colors = ["bg-brand-1", "bg-brand-1", "bg-brand-2", "bg-brand-2", "bg-foreground", "bg-foreground"]

  return (
    <section id="timeline" className="px-6 py-24">
      <div className="mx-auto max-w-3xl">
        <h2 className="scroll-reveal font-display text-5xl font-semibold leading-[1.05] tracking-tight text-foreground md:text-7xl lg:text-8xl">
          Timeline
        </h2>

        <p className="scroll-reveal delay-100 mt-6 text-lg text-muted-foreground">
          {data.subtitle}
        </p>

        <div className="scroll-reveal delay-200 mt-12 flex flex-wrap gap-2">
          {phases.map((phase, i) => (
            <button
              key={phase.name}
              onClick={() => setActive(i)}
              className={`rounded-full border px-4 py-2 text-sm font-medium transition-all duration-200 ${
                active === i
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
            <h3 className="font-display text-2xl font-semibold text-foreground">
              {phases[active].name}
            </h3>
            <span className="text-sm font-medium text-muted-foreground">
              {phases[active].duration}
            </span>
          </div>
          <p className="mt-4 leading-relaxed text-muted-foreground">
            {phases[active].description}
          </p>
        </div>

        <div className="scroll-reveal delay-400 mt-6 flex gap-1">
          {phases.map((_, i) => (
            <div
              key={i}
              className={`h-1.5 flex-1 rounded-full transition-colors duration-300 ${
                i <= active ? (colors[i] ?? "bg-foreground") : "bg-border"
              }`}
            />
          ))}
        </div>
      </div>
    </section>
  )
}

export default TimelineSection
