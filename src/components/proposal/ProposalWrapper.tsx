import { useState, Fragment } from "react"
import { useScrollRevealAll } from "@/hooks/useScrollReveal"
import type { ProposalData, SectionKey, ConfirmedSelection } from "@/types/proposal"
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

const DEFAULT_STUDIO_NAME = "Tomorrow Studios."

const ProposalWrapper = ({ proposal, isPreview = false }: ProposalWrapperProps) => {
  const studioName = proposal.studioName || DEFAULT_STUDIO_NAME
  const [confirmedSelection, setConfirmedSelection] = useState<ConfirmedSelection | null>(null)
  useScrollRevealAll({ disabled: isPreview })

  const sectionMap: Record<SectionKey, React.ReactNode> = {
    summary: <SummarySection key="summary" data={proposal.summary} />,
    scope: <ScopeSection key="scope" data={proposal.scope} />,
    timeline: <TimelineSection key="timeline" data={proposal.timeline} />,
    investment: (
      <InvestmentSection
        key="investment"
        data={proposal.investment}
        currency={proposal.currency}
        recommendation={proposal.recommendation}
        onConfirm={setConfirmedSelection}
      />
    ),
    cta: (
      <CTASection
        key="cta"
        proposalId={proposal.id}
        proposalSlug={proposal.slug}
        proposalTitle={proposal.title}
        ctaEmail={proposal.ctaEmail}
        studioName={studioName}
        currency={proposal.currency}
        confirmedSelection={confirmedSelection}
        isPreview={isPreview}
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
      {!isPreview && <ProposalNav sections={proposal.sections} studioName={studioName} />}
      <HeroSection
        clientName={proposal.clientName}
        heroImageUrl={proposal.heroImageUrl}
        clientLogoUrl={proposal.clientLogoUrl}
        heroLogoLarge={proposal.heroLogoLarge}
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
