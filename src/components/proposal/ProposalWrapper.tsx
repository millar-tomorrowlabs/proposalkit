import { useState, Fragment } from "react"
import { useScrollRevealAll } from "@/hooks/useScrollReveal"
import type { ProposalData, SectionKey } from "@/types/proposal"
import ProposalNav from "./ProposalNav"
import HeroSection from "./HeroSection"
import SummarySection from "./SummarySection"
import ScopeSection from "./ScopeSection"
import TimelineSection from "./TimelineSection"
import InvestmentSection from "./InvestmentSection"
import CTASection from "./CTASection"

interface ProposalWrapperProps {
  proposal: ProposalData
  isPreview?: boolean
}

const STUDIO_NAME = "Tomorrow Studios."

const ProposalWrapper = ({ proposal, isPreview = false }: ProposalWrapperProps) => {
  const [confirmedBody, setConfirmedBody] = useState<string | null>(null)
  useScrollRevealAll({ disabled: isPreview })

  const sectionMap: Record<SectionKey, React.ReactNode> = {
    summary: <SummarySection key="summary" data={proposal.summary} />,
    scope: <ScopeSection key="scope" data={proposal.scope} />,
    timeline: <TimelineSection key="timeline" data={proposal.timeline} />,
    investment: (
      <InvestmentSection
        key="investment"
        data={proposal.investment}
        recommendation={proposal.recommendation}
        onConfirm={setConfirmedBody}
      />
    ),
    cta: (
      <CTASection
        key="cta"
        ctaEmail={proposal.ctaEmail}
        studioName={STUDIO_NAME}
        confirmedBody={confirmedBody}
      />
    ),
  }

  return (
    <div
      style={
        {
          "--brand-1": proposal.brandColor1,
          "--brand-2": proposal.brandColor2,
        } as React.CSSProperties
      }
    >
      <ProposalNav sections={proposal.sections} studioName={STUDIO_NAME} />
      <HeroSection
        clientName={proposal.clientName}
        heroImageUrl={proposal.heroImageUrl}
        tagline={proposal.tagline}
        description={proposal.heroDescription}
      />
      {proposal.sections.map((key) => (
        <Fragment key={key}>{sectionMap[key]}</Fragment>
      ))}
    </div>
  )
}

export default ProposalWrapper
