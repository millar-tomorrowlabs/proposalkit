import { useState, Fragment, useMemo } from "react"
import { useScrollRevealAll } from "@/hooks/useScrollReveal"
import BuilderPreviewContext from "@/contexts/BuilderPreviewContext"
import { useBuilderStore } from "@/store/builderStore"
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
  viewportWidth?: number
}

const DEFAULT_STUDIO_NAME = "Proposl"

const ProposalWrapper = ({ proposal, isPreview = false, viewportWidth }: ProposalWrapperProps) => {
  const studioName = proposal.studioName || DEFAULT_STUDIO_NAME
  const [confirmedSelection, setConfirmedSelection] = useState<ConfirmedSelection | null>(null)
  useScrollRevealAll({ disabled: isPreview })

  const contextValue = useMemo(() => ({
    isEditable: isPreview,
    updateField: useBuilderStore.getState().updateField,
    updateAtPath: useBuilderStore.getState().updateAtPath,
  }), [isPreview])

  const sectionMap: Record<SectionKey, React.ReactNode> = {
    summary: <SummarySection key="summary" data={proposal.summary} studioName={studioName} />,
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
        brandColor1={proposal.brandColor1}
        brandColor2={proposal.brandColor2}
        currency={proposal.currency}
        confirmedSelection={confirmedSelection}
        isPreview={isPreview}
      />
    ),
  }

  return (
    <BuilderPreviewContext.Provider value={contextValue}>
      <div
        style={
          {
            "--brand-1": proposal.brandColor1,
            "--brand-2": proposal.brandColor2,
          } as React.CSSProperties
        }
      >
        <ProposalNav sections={proposal.sections} studioName={studioName} isPreview={isPreview} viewportWidth={viewportWidth} />
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
    </BuilderPreviewContext.Provider>
  )
}

export default ProposalWrapper
