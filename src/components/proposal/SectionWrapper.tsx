import { useState, useCallback, useRef } from "react"
import { useBuilderPreview } from "@/contexts/BuilderPreviewContext"
import { useBuilderStore } from "@/store/builderStore"
import SectionToolbar from "./SectionToolbar"
import { sectionLabel, type SectionId } from "@/types/proposal"

interface SectionWrapperProps {
  sectionKey: SectionId
  children: React.ReactNode
}

const SectionWrapper = ({ sectionKey, children }: SectionWrapperProps) => {
  const { isEditable, addSection, removeSection } = useBuilderPreview()
  const customSections = useBuilderStore((s) => s.previewProposal.customSections)
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
  // A custom section can always be added, so the add buttons never disappear.
  const canAdd = true

  return (
    <div
      className={`section-wrapper ${isHovered ? "section-wrapper--active" : ""}`}
      data-section-key={sectionKey}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {isHovered && (
        <SectionToolbar
          label={sectionLabel(sectionKey, customSections)}
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
