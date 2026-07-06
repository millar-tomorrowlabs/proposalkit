import { createContext, useContext } from "react"
import type { ProposalData, SectionId } from "@/types/proposal"

interface BuilderPreviewContextValue {
  isEditable: boolean
  updateField: <K extends keyof ProposalData>(key: K, value: ProposalData[K]) => void
  updateAtPath: (path: string, value: unknown) => void
  addSection: (relativeTo: SectionId, position: "above" | "below") => void
  removeSection: (key: SectionId) => void
  focusComposer?: (prefill?: string) => void
}

const BuilderPreviewContext = createContext<BuilderPreviewContextValue>({
  isEditable: false,
  updateField: () => {},
  updateAtPath: () => {},
  addSection: () => {},
  removeSection: () => {},
  focusComposer: undefined,
})

export const useBuilderPreview = () => useContext(BuilderPreviewContext)

export default BuilderPreviewContext
