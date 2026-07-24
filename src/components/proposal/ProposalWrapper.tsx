import { useState, useCallback, useEffect, useMemo, useRef } from "react"
import { useScrollRevealAll } from "@/hooks/useScrollReveal"
import BuilderPreviewContext from "@/contexts/BuilderPreviewContext"
import { useBuilderStore } from "@/store/builderStore"
import { loadSelection, saveSelection, clearSelection } from "@/lib/selectionPersistence"
import type {
  ProposalData,
  SectionKey,
  ConfirmedSelection,
  InvestmentConfig,
} from "@/types/proposal"
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

/**
 * A restored selection is only good while the proposal still offers what it
 * names. The studio can rename a package or delete an add-on after the client
 * confirmed, and a stale id would pass the CTA's blocking check, reach
 * submit-proposal, and come back as a 400 the client has no way out of. When
 * it no longer resolves we drop it, which puts the client back in front of the
 * live options with a choice to make.
 */
function resolveStoredSelection(
  selection: ConfirmedSelection | null,
  investment: InvestmentConfig | undefined
): ConfirmedSelection | null {
  if (!selection) return null
  const packages = investment?.packages ?? []
  const addOns = investment?.addOns ?? []
  if (!packages.some((p) => p.id === selection.packageId)) return null
  if (!selection.addOns.every((a) => addOns.some((candidate) => candidate.id === a.id))) return null
  return selection
}

const ProposalWrapper = ({ proposal, isPreview = false, viewportWidth }: ProposalWrapperProps) => {
  const studioName = proposal.studioName || ""
  const studioLogoUrl = proposal.studioLogoUrl
  const heroImageLoading = useBuilderStore((s) => s.heroImageLoading)

  // A confirmed selection survives a reload. The proposal id can arrive
  // asynchronously, so the first read is keyed on it and a later id change
  // re-reads rather than leaving stale state behind. We only ever write in
  // response to an explicit confirm, so nothing empty can clobber storage.
  const restoredSelection = useMemo(() => loadSelection(proposal.id), [proposal.id])
  const storedSelection = useMemo(
    () => resolveStoredSelection(restoredSelection, proposal.investment),
    [restoredSelection, proposal.investment]
  )
  const [confirmedSelection, setConfirmedSelection] = useState<ConfirmedSelection | null>(
    storedSelection
  )
  const hydratedForId = useRef(proposal.id)
  useEffect(() => {
    if (hydratedForId.current === proposal.id) return
    hydratedForId.current = proposal.id
    setConfirmedSelection(storedSelection)
  }, [proposal.id, storedSelection])

  const [addMenuTarget, setAddMenuTarget] = useState<{ relativeTo: SectionKey; position: "above" | "below" } | null>(null)
  useScrollRevealAll({ disabled: isPreview })

  const handleConfirm = useCallback(
    (selection: ConfirmedSelection | null) => {
      setConfirmedSelection(selection)
      if (selection) saveSelection(proposal.id, selection)
      else clearSelection(proposal.id)
    },
    [proposal.id]
  )

  // The client can only be held to a package choice when there is one to make.
  const hasInvestment =
    proposal.sections.includes("investment") &&
    (proposal.investment?.packages?.length ?? 0) > 0

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
        // Keyed on the proposal so a different proposal remounts with its own
        // restored selection rather than inheriting the last one.
        key={`investment-${proposal.id}`}
        data={proposal.investment}
        currency={proposal.currency}
        recommendation={proposal.recommendation}
        initialConfirmed={storedSelection}
        onConfirm={handleConfirm}
      />
    ),
    cta: (
      <CTASection
        key="cta"
        proposalId={proposal.id}
        proposalSlug={proposal.slug}
        studioName={studioName}
        currency={proposal.currency}
        hasInvestment={hasInvestment}
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
