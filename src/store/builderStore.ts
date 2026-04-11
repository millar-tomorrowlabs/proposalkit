import { create } from "zustand"
import { v4 as uuidv4 } from "uuid"
import type { ProposalData, AISuggestions, ContextBlob, ChatMessage } from "@/types/proposal"
import { setAtPath } from "@/lib/fieldPath"

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

const MAX_UNDO_STACK = 50

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

  // Undo / redo
  undoStack: ProposalData[]
  redoStack: ProposalData[]

  // Chat
  chatMessages: ChatMessage[]
  chatLoading: boolean
  chatPanelOpen: boolean

  // Actions
  setProposal: (proposal: ProposalData) => void
  updateField: <K extends keyof ProposalData>(key: K, value: ProposalData[K]) => void
  updateAtPath: (path: string, value: unknown) => void
  flushToPreview: () => void
  undo: () => void
  redo: () => void
  canUndo: () => boolean
  canRedo: () => boolean
  setSaveStatus: (status: SaveStatus) => void
  setActiveSection: (section: string) => void
  initNew: (accountDefaults?: { studioName?: string; ctaEmail?: string; brandColor1?: string; brandColor2?: string }) => void
  initExisting: (proposal: ProposalData, chatMessages?: ChatMessage[]) => void
  setContextBlobs: (blobs: ContextBlob[]) => void
  setSuggestions: (s: AISuggestions | null) => void
  dismissSuggestion: (path: string) => void
  setSuggestionsLoading: (loading: boolean) => void
  setChatMessages: (messages: ChatMessage[]) => void
  addChatMessage: (message: ChatMessage) => void
  applyChatEdits: (messageId: string) => void
  setChatLoading: (loading: boolean) => void
  setChatPanelOpen: (open: boolean) => void
}

export const useBuilderStore = create<BuilderState>((set, get) => ({
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
  undoStack: [],
  redoStack: [],
  chatMessages: [],
  chatLoading: false,
  chatPanelOpen: false,

  setProposal: (proposal) => set({ proposal, previewProposal: proposal }),

  updateField: (key, value) => {
    set((state) => ({
      undoStack: [...state.undoStack, state.proposal].slice(-MAX_UNDO_STACK),
      redoStack: [],
      proposal: { ...state.proposal, [key]: value, updatedAt: new Date().toISOString() },
      isDirty: true,
    }))
  },

  updateAtPath: (path, value) => {
    set((state) => ({
      undoStack: [...state.undoStack, state.proposal].slice(-MAX_UNDO_STACK),
      redoStack: [],
      proposal: { ...setAtPath(state.proposal, path, value), updatedAt: new Date().toISOString() },
      isDirty: true,
    }))
  },

  undo: () => {
    const { undoStack, proposal } = get()
    if (undoStack.length === 0) return
    const previous = undoStack[undoStack.length - 1]
    set((state) => ({
      undoStack: state.undoStack.slice(0, -1),
      redoStack: [...state.redoStack, proposal].slice(-MAX_UNDO_STACK),
      proposal: previous,
      previewProposal: previous,
      isDirty: true,
    }))
  },

  redo: () => {
    const { redoStack, proposal } = get()
    if (redoStack.length === 0) return
    const next = redoStack[redoStack.length - 1]
    set((state) => ({
      redoStack: state.redoStack.slice(0, -1),
      undoStack: [...state.undoStack, proposal].slice(-MAX_UNDO_STACK),
      proposal: next,
      previewProposal: next,
      isDirty: true,
    }))
  },

  canUndo: () => get().undoStack.length > 0,
  canRedo: () => get().redoStack.length > 0,

  flushToPreview: () => {
    set((state) => ({ previewProposal: state.proposal }))
  },

  setSaveStatus: (saveStatus) => set({ saveStatus }),

  setActiveSection: (activeSection) => set({ activeSection }),

  initNew: (accountDefaults?: { studioName?: string; ctaEmail?: string; brandColor1?: string; brandColor2?: string }) => {
    const fresh = {
      ...DEFAULT_PROPOSAL,
      id: uuidv4(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      studioName: accountDefaults?.studioName ?? "",
      ctaEmail: accountDefaults?.ctaEmail ?? "",
      brandColor1: accountDefaults?.brandColor1 ?? DEFAULT_PROPOSAL.brandColor1,
      brandColor2: accountDefaults?.brandColor2 ?? DEFAULT_PROPOSAL.brandColor2,
    }
    set({ proposal: fresh, previewProposal: fresh, isNewProposal: true, isDirty: false, saveStatus: "idle", undoStack: [], redoStack: [] })
  },

  initExisting: (proposal, chatMessages) => {
    set({ proposal, previewProposal: proposal, isNewProposal: false, isDirty: false, saveStatus: "idle", chatMessages: chatMessages ?? [], undoStack: [], redoStack: [] })
  },

  setContextBlobs: (contextBlobs) => set({ contextBlobs, isDirty: true }),

  setSuggestions: (suggestions) => set({ suggestions, dismissedSuggestions: [] }),

  dismissSuggestion: (path) =>
    set((state) => ({ dismissedSuggestions: [...state.dismissedSuggestions, path] })),

  setSuggestionsLoading: (suggestionsLoading) => set({ suggestionsLoading }),

  setChatMessages: (chatMessages) => set({ chatMessages }),

  addChatMessage: (message) =>
    set((state) => ({
      chatMessages: [...state.chatMessages, message],
      isDirty: true,
    })),

  applyChatEdits: (messageId) =>
    set((state) => {
      const msgIndex = state.chatMessages.findIndex((m) => m.id === messageId)
      if (msgIndex === -1) return state
      const msg = state.chatMessages[msgIndex]
      if (!msg.edits || msg.editsApplied) return state

      let updated = state.proposal
      for (const edit of msg.edits) {
        updated = setAtPath(updated, edit.fieldPath, edit.newValue)
      }

      const newMessages = [...state.chatMessages]
      newMessages[msgIndex] = { ...msg, editsApplied: true }

      return {
        proposal: { ...updated, updatedAt: new Date().toISOString() },
        isDirty: true,
        chatMessages: newMessages,
      }
    }),

  setChatLoading: (chatLoading) => set({ chatLoading }),

  setChatPanelOpen: (chatPanelOpen) => set({ chatPanelOpen }),
}))
