import { ArrowRight } from "lucide-react"

interface CTASectionProps {
  ctaEmail: string
  studioName: string
  confirmedBody: string | null
}

const CTASection = ({ ctaEmail, studioName, confirmedBody }: CTASectionProps) => {

  const mailtoHref =
    `mailto:${ctaEmail}?subject=` +
    encodeURIComponent("Proposal — Ready to proceed") +
    (confirmedBody ? "&body=" + encodeURIComponent(confirmedBody) : "")

  return (
    <section id="cta" className="px-6 py-24">
      <div className="mx-auto max-w-3xl text-center">
        <h2 className="scroll-reveal font-display text-5xl font-semibold leading-[1.05] tracking-tight text-foreground md:text-7xl lg:text-8xl">
          Next Steps
        </h2>

        <div className="scroll-reveal delay-100 mx-auto mt-12 max-w-xl text-left">
          <ol className="space-y-4">
            <li className="flex items-start gap-3 text-base text-foreground">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-1 text-xs font-semibold text-white">
                1
              </span>
              Confirm package selection and any add-ons
            </li>
            <li className="flex items-start gap-3 text-base text-foreground">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-2 text-xs font-semibold text-white">
                2
              </span>
              Review and sign the Master Services Agreement
            </li>
            <li className="flex items-start gap-3 text-base text-foreground">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-foreground text-xs font-semibold text-background">
                3
              </span>
              Schedule kickoff to align on workflows, timelines, and responsibilities
            </li>
          </ol>
        </div>

        <div className="scroll-reveal delay-200 mt-10 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
          <a
            href={mailtoHref}
            className="inline-flex h-12 items-center gap-2 rounded-full bg-foreground px-8 text-sm font-medium text-background transition-colors hover:bg-foreground/80"
          >
            Let's Go
            <ArrowRight className="h-4 w-4" />
          </a>
        </div>

        <div className="mt-32 border-t border-border pt-8">
          <div className="flex flex-col items-center gap-4">
            <span className="font-serif text-sm font-medium tracking-tight text-muted-foreground">
              {studioName}
            </span>
            <p className="text-xs text-muted-foreground">
              © {new Date().getFullYear()} Tomorrow Labs Inc. · This proposal is
              confidential and intended solely for the recipient.
            </p>
          </div>
        </div>
      </div>
    </section>
  )
}

export default CTASection
