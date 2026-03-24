import type { ProposalData } from "@/types/proposal"

type Props = { data: ProposalData["summary"] }

const SummarySection = ({ data }: Props) => {

  return (
    <section id="summary" className="px-6 py-24">
      <div className="mx-auto max-w-3xl">
        <p className="scroll-reveal mb-4 text-sm font-medium uppercase tracking-[0.2em] text-muted-foreground">
          About Tomorrow Studios
        </p>

        <h3 data-field-path="summary.studioTagline" className="scroll-reveal delay-100 font-display text-3xl font-semibold leading-snug tracking-tight text-foreground md:text-4xl">
          {data.studioTagline}
        </h3>

        <p data-field-path="summary.studioDescription" className="scroll-reveal delay-200 mt-8 text-lg leading-relaxed text-muted-foreground">
          {data.studioDescription}
        </p>

        <p data-field-path="summary.studioDescription2" className="scroll-reveal delay-300 mt-6 text-lg leading-relaxed text-muted-foreground">
          {data.studioDescription2}
        </p>

        <div className="my-20 h-px w-full bg-border" />

        <h2 className="scroll-reveal font-display text-5xl font-semibold leading-[1.05] tracking-tight text-foreground md:text-7xl lg:text-8xl">
          Project
          <br />
          Overview
        </h2>

        <p data-field-path="summary.projectOverview" className="scroll-reveal delay-100 mt-10 text-lg leading-relaxed text-muted-foreground md:text-xl">
          {data.projectOverview}
        </p>

        <p data-field-path="summary.projectDetail" className="scroll-reveal delay-200 mt-6 text-lg leading-relaxed text-muted-foreground">
          {data.projectDetail}
        </p>

        {data.projectDetail2 && (
          <p data-field-path="summary.projectDetail2" className="scroll-reveal delay-300 mt-4 text-lg leading-relaxed text-muted-foreground">
            {data.projectDetail2}
          </p>
        )}

        <div className="my-20 h-px w-full bg-border" />

        <p className="scroll-reveal mb-4 text-sm font-medium uppercase tracking-[0.2em] text-muted-foreground">
          Project Pillars
        </p>
        <h3 className="scroll-reveal delay-100 font-display text-3xl font-semibold leading-snug tracking-tight text-foreground md:text-4xl">
          {data.pillarsTagline}
        </h3>

        <div className="mt-10 grid gap-6 md:grid-cols-3">
          {data.pillars.map((item, i) => (
            <div
              key={item.label}
              className={`scroll-reveal delay-${(i + 2) * 100} rounded-lg border border-border bg-card p-6`}
            >
              <p className="font-display text-2xl font-semibold text-foreground">
                {item.label}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                {item.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

export default SummarySection
