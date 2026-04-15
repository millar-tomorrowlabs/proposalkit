import type { ProposalData } from "@/types/proposal"
import InlineEditable from "./InlineEditable"
import AskAIGhost from "./AskAIGhost"

type Props = { data: ProposalData["summary"]; studioName?: string }

const SummarySection = ({ data, studioName }: Props) => {

  return (
    <section id="summary" className="px-6 py-24">
      <div className="mx-auto max-w-3xl">
        <p className="scroll-reveal mb-4 text-sm font-medium uppercase tracking-[0.2em] text-muted-foreground">
          About {studioName || "Us"}
        </p>

        <InlineEditable
          fieldPath="summary.studioTagline"
          value={data.studioTagline}
          tag="h3"
          className="scroll-reveal delay-100 font-display text-3xl font-semibold leading-snug tracking-tight text-foreground md:text-4xl"
        />

        <InlineEditable
          fieldPath="summary.studioDescription"
          value={data.studioDescription}
          multiline
          tag="p"
          className="scroll-reveal delay-200 mt-8 text-lg leading-relaxed text-muted-foreground"
        />

        <InlineEditable
          fieldPath="summary.studioDescription2"
          value={data.studioDescription2}
          multiline
          tag="p"
          className="scroll-reveal delay-300 mt-6 text-lg leading-relaxed text-muted-foreground"
        />

        <div className="my-20 h-px w-full bg-border" />

        <h2 className="scroll-reveal font-display text-5xl font-semibold leading-[1.05] tracking-tight text-foreground md:text-7xl lg:text-8xl">
          Project
          <br />
          Overview
        </h2>

        <InlineEditable
          fieldPath="summary.projectOverview"
          value={data.projectOverview}
          multiline
          tag="p"
          className="scroll-reveal delay-100 mt-10 text-lg leading-relaxed text-muted-foreground md:text-xl"
        />
        <AskAIGhost value={data.projectOverview} prompt="Write a project overview paragraph. Describe the client's situation, the opportunity, and what this project will achieve. Never use em dashes." />

        <InlineEditable
          fieldPath="summary.projectDetail"
          value={data.projectDetail}
          multiline
          tag="p"
          className="scroll-reveal delay-200 mt-6 text-lg leading-relaxed text-muted-foreground"
        />

        {data.projectDetail2 && (
          <InlineEditable
            fieldPath="summary.projectDetail2"
            value={data.projectDetail2}
            multiline
            tag="p"
            className="scroll-reveal delay-300 mt-4 text-lg leading-relaxed text-muted-foreground"
          />
        )}

        <div className="my-20 h-px w-full bg-border" />

        <p className="scroll-reveal mb-4 text-sm font-medium uppercase tracking-[0.2em] text-muted-foreground">
          Project Pillars
        </p>

        <InlineEditable
          fieldPath="summary.pillarsTagline"
          value={data.pillarsTagline}
          tag="h3"
          className="scroll-reveal delay-100 font-display text-3xl font-semibold leading-snug tracking-tight text-foreground md:text-4xl"
        />

        <div className="mt-10 grid gap-6 md:grid-cols-3">
          {(data.pillars ?? []).map((item, i) => (
            <div
              key={item.label}
              className={`scroll-reveal delay-${(i + 2) * 100} rounded-lg border border-border bg-card p-6`}
            >
              <InlineEditable
                fieldPath={`summary.pillars.${i}.label`}
                value={item.label}
                tag="p"
                className="font-display text-2xl font-semibold text-foreground"
              />
              <InlineEditable
                fieldPath={`summary.pillars.${i}.description`}
                value={item.description}
                multiline
                tag="p"
                className="mt-1 text-sm text-muted-foreground"
              />
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

export default SummarySection
