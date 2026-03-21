import { create } from "zustand"
import { v4 as uuidv4 } from "uuid"
import type { ProposalData, AISuggestions, ContextBlob } from "@/types/proposal"

const DEFAULT_PROPOSAL: ProposalData = {
  id: uuidv4(),
  slug: "",
  title: "",
  clientName: "",
  brandColor1: "#000000",
  brandColor2: "#6b7280",
  heroImageUrl: undefined,
  clientLogoUrl: undefined,
  tagline: "",
  heroDescription: "",
  ctaEmail: "",
  recommendation: "",
  sections: ["summary", "scope", "timeline", "investment", "cta"],
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  summary: {
    studioTagline: "",
    studioDescription: "",
    studioDescription2: "",
    projectOverview: "",
    projectDetail: "",
    pillarsTagline: "",
    pillars: [],
  },
  scope: {
    outcomes: [],
    responsibilities: [],
  },
  timeline: {
    subtitle: "",
    phases: [],
  },
  investment: {
    packages: [],
    addOnCategories: [],
    addOns: [],
  },
}

type SaveStatus = "idle" | "saving" | "saved" | "error"

interface BuilderState {
  proposal: ProposalData
  previewProposal: ProposalData
  saveStatus: SaveStatus
  activeSection: string
  isNewProposal: boolean
  isDirty: boolean
  contextBlobs: ContextBlob[]
  suggestions: AISuggestions | null
  dismissedSuggestions: string[]
  suggestionsLoading: boolean

  // Actions
  setProposal: (proposal: ProposalData) => void
  updateField: <K extends keyof ProposalData>(key: K, value: ProposalData[K]) => void
  flushToPreview: () => void
  setSaveStatus: (status: SaveStatus) => void
  setActiveSection: (section: string) => void
  initNew: () => void
  initExisting: (proposal: ProposalData) => void
  setContextBlobs: (blobs: ContextBlob[]) => void
  setSuggestions: (s: AISuggestions | null) => void
  dismissSuggestion: (path: string) => void
  setSuggestionsLoading: (loading: boolean) => void
}

export const useBuilderStore = create<BuilderState>((set) => ({
  proposal: DEFAULT_PROPOSAL,
  previewProposal: DEFAULT_PROPOSAL,
  saveStatus: "idle",
  activeSection: "meta",
  isNewProposal: true,
  isDirty: false,
  contextBlobs: [],
  suggestions: null,
  dismissedSuggestions: [],
  suggestionsLoading: false,

  setProposal: (proposal) => set({ proposal, previewProposal: proposal }),

  updateField: (key, value) => {
    set((state) => ({
      proposal: { ...state.proposal, [key]: value, updatedAt: new Date().toISOString() },
      isDirty: true,
    }))
  },

  flushToPreview: () => {
    set((state) => ({ previewProposal: state.proposal }))
  },

  setSaveStatus: (saveStatus) => set({ saveStatus }),

  setActiveSection: (activeSection) => set({ activeSection }),

  initNew: () => {
    const fresh = { ...DEFAULT_PROPOSAL, id: uuidv4(), createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }
    set({ proposal: fresh, previewProposal: fresh, isNewProposal: true, isDirty: false, saveStatus: "idle" })
  },

  initExisting: (proposal) => {
    set({ proposal, previewProposal: proposal, isNewProposal: false, isDirty: false, saveStatus: "idle" })
  },

  setContextBlobs: (contextBlobs) => set({ contextBlobs }),

  setSuggestions: (suggestions) => set({ suggestions, dismissedSuggestions: [] }),

  dismissSuggestion: (path) =>
    set((state) => ({ dismissedSuggestions: [...state.dismissedSuggestions, path] })),

  setSuggestionsLoading: (suggestionsLoading) => set({ suggestionsLoading }),
}))
