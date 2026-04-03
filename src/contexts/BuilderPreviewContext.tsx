import { createContext, useContext } from "react"
import type { ProposalData } from "@/types/proposal"

interface BuilderPreviewContextValue {
  isEditable: boolean
  updateField: <K extends keyof ProposalData>(key: K, value: ProposalData[K]) => void
  updateAtPath: (path: string, value: unknown) => void
}

const BuilderPreviewContext = createContext<BuilderPreviewContextValue>({
  isEditable: false,
  updateField: () => {},
  updateAtPath: () => {},
})

export const useBuilderPreview = () => useContext(BuilderPreviewContext)

export default BuilderPreviewContext
