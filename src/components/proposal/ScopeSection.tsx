import { useScrollRevealAll } from "@/hooks/useScrollReveal"
import { Check } from "lucide-react"
import type { ProposalData } from "@/types/proposal"

type Props = { data: ProposalData["scope"] }

const ScopeSection = ({ data }: Props) => {
  useScrollRevealAll()

  return (
    <section id="scope" className="px-6 py-24">
      <div className="mx-auto max-w-3xl">
        <h2 className="scroll-reveal font-display text-5xl font-semibold leading-[1.05] tracking-tight text-foreground md:text-7xl lg:text-8xl">
          Scope &amp;
          <br />
          Outcomes
        </h2>

        <p className="scroll-reveal delay-100 mt-10 text-lg text-muted-foreground md:text-xl">
          What this project delivers.
        </p>

        <ul className="scroll-reveal delay-200 mt-8 space-y-4">
          {data.outcomes.map((item) => (
            <li key={item} className="flex items-start gap-3 text-foreground">
              <Check className="mt-1 h-4 w-4 shrink-0 text-brand-1" />
              <span className="text-base leading-relaxed">{item}</span>
            </li>
          ))}
        </ul>

        <div className="my-20 h-px w-full bg-border" />

        <p className="scroll-reveal mb-4 text-sm font-medium uppercase tracking-[0.2em] text-muted-foreground">
          Merchant Responsibilities
        </p>

        <h3 className="scroll-reveal delay-100 font-display text-3xl font-semibold leading-snug tracking-tight text-foreground md:text-4xl">
          What we need from you.
        </h3>

        <ul className="scroll-reveal delay-200 mt-8 space-y-4">
          {data.responsibilities.map((item) => (
            <li key={item} className="flex items-start gap-3 text-foreground">
              <div className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-brand-2" />
              <span className="text-base leading-relaxed">{item}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}

export default ScopeSection
