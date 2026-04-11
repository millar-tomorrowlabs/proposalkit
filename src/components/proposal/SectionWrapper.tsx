import { useState, useCallback, useRef } from "react"
import { useBuilderPreview } from "@/contexts/BuilderPreviewContext"
import { useBuilderStore } from "@/store/builderStore"
import SectionToolbar from "./SectionToolbar"
import type { SectionKey } from "@/types/proposal"

const ALL_SECTIONS: SectionKey[] = ["summary", "scope", "timeline", "investment", "cta"]

interface SectionWrapperProps {
  sectionKey: SectionKey
  children: React.ReactNode
}

const SectionWrapper = ({ sectionKey, children }: SectionWrapperProps) => {
  const { isEditable, addSection, removeSection } = useBuilderPreview()
  const currentSections = useBuilderStore((s) => s.previewProposal.sections)
  const canAdd = ALL_SECTIONS.some((s) => !currentSections.includes(s))
  const [isHovered, setIsHovered] = useState(false)
  const hoverTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Debounced hover — small delay before showing toolbar to avoid flicker
  const handleMouseEnter = useCallback(() => {
    if (!isEditable) return
    if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current)
    hoverTimeoutRef.current = setTimeout(() => setIsHovered(true), 80)
  }, [isEditable])

  const handleMouseLeave = useCallback(() => {
    if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current)
    hoverTimeoutRef.current = setTimeout(() => setIsHovered(false), 150)
  }, [])

  // Non-editable mode: render children without wrapper
  if (!isEditable) return <>{children}</>

  const canRemove = sectionKey !== "cta"

  return (
    <div
      className={`section-wrapper ${isHovered ? "section-wrapper--active" : ""}`}
      data-section-key={sectionKey}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {isHovered && (
        <SectionToolbar
          sectionKey={sectionKey}
          onAddAbove={() => addSection(sectionKey, "above")}
          onAddBelow={() => addSection(sectionKey, "below")}
          onRemove={() => removeSection(sectionKey)}
          canRemove={canRemove}
          canAdd={canAdd}
        />
      )}
      {children}
    </div>
  )
}

export default SectionWrapper
