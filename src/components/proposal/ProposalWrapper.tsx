import { useState, useCallback, useMemo } from "react"
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
import SectionWrapper from "./SectionWrapper"

interface ProposalWrapperProps {
  proposal: ProposalData
  isPreview?: boolean
  viewportWidth?: number
}

const ALL_SECTIONS: SectionKey[] = ["summary", "scope", "timeline", "investment", "cta"]

const SECTION_LABELS: Record<SectionKey, string> = {
  summary: "Summary",
  scope: "Scope",
  timeline: "Timeline",
  investment: "Investment",
  cta: "Next Steps",
}

const ProposalWrapper = ({ proposal, isPreview = false, viewportWidth }: ProposalWrapperProps) => {
  const studioName = proposal.studioName || ""
  const studioLogoUrl = proposal.studioLogoUrl
  const heroImageLoading = useBuilderStore((s) => s.heroImageLoading)
  const [confirmedSelection, setConfirmedSelection] = useState<ConfirmedSelection | null>(null)
  const [addMenuTarget, setAddMenuTarget] = useState<{ relativeTo: SectionKey; position: "above" | "below" } | null>(null)
  useScrollRevealAll({ disabled: isPreview })

  // Section management: add a section relative to another
  const addSection = useCallback((relativeTo: SectionKey, position: "above" | "below") => {
    const store = useBuilderStore.getState()
    const sections = store.proposal.sections
    const available = ALL_SECTIONS.filter((s) => !sections.includes(s))
    if (available.length === 0) return

    // If only one option, insert it directly
    if (available.length === 1) {
      const idx = sections.indexOf(relativeTo)
      if (idx === -1) return
      const insertAt = position === "below" ? idx + 1 : idx
      const next = [...sections]
      next.splice(insertAt, 0, available[0])
      store.updateField("sections", next)
      // Flush immediately so preview updates without waiting for debounce
      setTimeout(() => useBuilderStore.getState().flushToPreview(), 0)
      return
    }

    // Multiple options — show picker menu
    setAddMenuTarget({ relativeTo, position })
  }, [])

  const insertSection = useCallback((key: SectionKey) => {
    if (!addMenuTarget) return
    const store = useBuilderStore.getState()
    const sections = store.proposal.sections
    const idx = sections.indexOf(addMenuTarget.relativeTo)
    if (idx === -1) { setAddMenuTarget(null); return }
    const insertAt = addMenuTarget.position === "below" ? idx + 1 : idx
    const next = [...sections]
    next.splice(insertAt, 0, key)
    store.updateField("sections", next)
    setAddMenuTarget(null)
    // Flush immediately so preview updates without waiting for debounce
    setTimeout(() => useBuilderStore.getState().flushToPreview(), 0)
  }, [addMenuTarget])

  // Section management: remove a section
  const removeSection = useCallback((key: SectionKey) => {
    if (key === "cta") return // CTA cannot be removed
    const store = useBuilderStore.getState()
    const sections = store.proposal.sections
    store.updateField("sections", sections.filter((s) => s !== key))
    // Flush immediately so preview updates without waiting for debounce
    setTimeout(() => useBuilderStore.getState().flushToPreview(), 0)
  }, [])

  const contextValue = useMemo(() => ({
    isEditable: isPreview,
    updateField: useBuilderStore.getState().updateField,
    updateAtPath: useBuilderStore.getState().updateAtPath,
    addSection,
    removeSection,
  }), [isPreview, addSection, removeSection])

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
        <ProposalNav
          sections={proposal.sections}
          studioName={studioName}
          studioLogoUrl={studioLogoUrl}
          isPreview={isPreview}
          viewportWidth={viewportWidth}
        />
        <HeroSection
          clientName={proposal.clientName}
          heroImageUrl={proposal.heroImageUrl}
          clientLogoUrl={proposal.clientLogoUrl}
          heroLogoLarge={proposal.heroLogoLarge}
          tagline={proposal.tagline}
          description={proposal.heroDescription}
          imageLoading={heroImageLoading}
        />
        {proposal.sections.map((key) => (
          <SectionWrapper key={key} sectionKey={key}>
            {sectionMap[key]}
          </SectionWrapper>
        ))}

        {/* Section picker menu — shown when adding a section with multiple options */}
        {addMenuTarget && (
          <div
            className="fixed inset-0 z-50"
            onClick={() => setAddMenuTarget(null)}
          >
            <div
              className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-xl border border-border bg-background p-3 shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <p className="mb-2 text-xs font-medium text-muted-foreground">Add section</p>
              <div className="flex flex-col gap-1">
                {ALL_SECTIONS.filter((s) => !proposal.sections.includes(s)).map((key) => (
                  <button
                    key={key}
                    onClick={() => insertSection(key)}
                    className="rounded-md px-3 py-1.5 text-left text-sm font-medium text-foreground hover:bg-muted transition-colors"
                  >
                    {SECTION_LABELS[key]}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </BuilderPreviewContext.Provider>
  )
}

export default ProposalWrapper
