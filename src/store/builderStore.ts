import { create } from "zustand"
import { v4 as uuidv4 } from "uuid"
import type { UIMessage } from "ai"
import type { ProposalData, AISuggestions, ContextBlob, ChatMessage, ProposedEdit } from "@/types/proposal"
import { setAtPath } from "@/lib/fieldPath"
import { extractEditsFromText } from "@/lib/proposalEdits"

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

  // Applied edits tracking (message IDs whose edits have been applied)
  appliedEditIds: Set<string>
  // Edits extracted from UIMessage tool parts (indexed by message ID)
  _uiChatEdits: Record<string, ProposedEdit[]>

  // Document-first editor UI
  composerVisible: boolean
  viewport: "desktop" | "tablet" | "mobile"

  // Chat
  chatMessages: ChatMessage[]
  chatLoading: boolean
  chatPanelOpen: boolean
  /**
   * Prefill the composer input with text so the user can review/edit/send.
   * FloatingComposer consumes this and calls onClearPendingPrompt when done.
   */
  pendingChatPrompt: string | null
  /**
   * Fire-and-forget: send a message immediately without routing through the
   * composer input. Used by "Skip intake" and similar shortcuts where we
   * don't want the prompt text to sit in the textbox afterward.
   */
  autoSendChatPrompt: string | null

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
  initNew: (accountDefaults?: { studioName?: string; studioLogoUrl?: string; ctaEmail?: string; brandColor1?: string; brandColor2?: string }) => void
  initExisting: (proposal: ProposalData, chatMessages?: ChatMessage[]) => void
  setContextBlobs: (blobs: ContextBlob[]) => void
  setSuggestions: (s: AISuggestions | null) => void
  dismissSuggestion: (path: string) => void
  setSuggestionsLoading: (loading: boolean) => void
  setChatMessages: (messages: ChatMessage[]) => void
  addChatMessage: (message: ChatMessage) => void
  applyChatEdits: (messageId: string) => void
  registerChatEdits: (messageId: string, edits: ProposedEdit[]) => void
  setChatLoading: (loading: boolean) => void
  setComposerVisible: (visible: boolean) => void
  setViewport: (viewport: "desktop" | "tablet" | "mobile") => void
  setChatPanelOpen: (open: boolean) => void
  setPendingChatPrompt: (prompt: string | null) => void
  setAutoSendChatPrompt: (prompt: string | null) => void
  syncChatFromUIMessages: (uiMessages: UIMessage[]) => void
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
  appliedEditIds: new Set(),
  _uiChatEdits: {},
  composerVisible: true,
  viewport: "desktop" as const,
  chatMessages: [],
  chatLoading: false,
  chatPanelOpen: false,
  pendingChatPrompt: null,
  autoSendChatPrompt: null,

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

  initNew: (accountDefaults?: { studioName?: string; studioLogoUrl?: string; ctaEmail?: string; brandColor1?: string; brandColor2?: string }) => {
    const fresh = {
      ...DEFAULT_PROPOSAL,
      id: uuidv4(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      studioName: accountDefaults?.studioName ?? "",
      studioLogoUrl: accountDefaults?.studioLogoUrl,
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

  registerChatEdits: (messageId, edits) =>
    set((state) => ({
      _uiChatEdits: { ...state._uiChatEdits, [messageId]: edits },
    })),

  applyChatEdits: (messageId) =>
    set((state) => {
      if (state.appliedEditIds.has(messageId)) return state

      // Try old format first (legacy chatMessages)
      const msg = state.chatMessages.find((m) => m.id === messageId)
      const edits: ProposedEdit[] = msg?.edits ?? []

      // If no edits found in legacy format, check uiChatEdits
      const finalEdits = edits.length > 0 ? edits : state._uiChatEdits[messageId] ?? []
      if (finalEdits.length === 0) return state

      let updated = state.proposal
      for (const edit of finalEdits) {
        updated = setAtPath(updated, edit.fieldPath, edit.newValue)
      }

      const newApplied = new Set(state.appliedEditIds)
      newApplied.add(messageId)

      // Also update legacy format if applicable
      const newMessages = state.chatMessages.map((m) =>
        m.id === messageId ? { ...m, editsApplied: true } : m,
      )

      return {
        undoStack: [...state.undoStack, state.proposal].slice(-MAX_UNDO_STACK),
        redoStack: [],
        proposal: { ...updated, updatedAt: new Date().toISOString() },
        previewProposal: { ...updated, updatedAt: new Date().toISOString() },
        isDirty: true,
        appliedEditIds: newApplied,
        chatMessages: newMessages,
      }
    }),

  setChatLoading: (chatLoading) => set({ chatLoading }),

  setComposerVisible: (composerVisible) => set({ composerVisible }),

  setViewport: (viewport) => set({ viewport }),

  setChatPanelOpen: (chatPanelOpen) => set({ chatPanelOpen }),

  setPendingChatPrompt: (pendingChatPrompt) => set({ pendingChatPrompt }),

  setAutoSendChatPrompt: (autoSendChatPrompt) => set({ autoSendChatPrompt }),

  // Sync UIMessage[] from useChat hook to legacy chatMessages for DB persistence
  syncChatFromUIMessages: (uiMessages) => {
    const legacy: ChatMessage[] = uiMessages.map((msg) => {
      const textParts = msg.parts.filter((p) => p.type === "text") as Array<{ type: "text"; text: string }>
      const content = textParts.map((p) => p.text).join("")

      const edits: ProposedEdit[] = []
      for (const part of msg.parts) {
        // AI SDK v6: untyped tools come as "dynamic-tool"
        if (part.type === "dynamic-tool") {
          const dynPart = part as unknown as { toolName: string; args?: Record<string, unknown> }
          if (dynPart.toolName === "propose_edits" && dynPart.args?.edits) {
            edits.push(...(dynPart.args.edits as ProposedEdit[]))
          }
        }
        // Typed tool parts: "tool-propose_edits"
        if (typeof part.type === "string" && part.type === "tool-propose_edits") {
          const toolPart = part as unknown as { args?: Record<string, unknown> }
          if (toolPart.args?.edits) {
            edits.push(...(toolPart.args.edits as ProposedEdit[]))
          }
        }
      }

      // Also extract edits from `proposal-edits` code blocks the AI emits
      // in the message text (current /api/chat format — text-streamed,
      // not tool-call-based).
      if (msg.role === "assistant") {
        edits.push(...extractEditsFromText(content))
      }

      return {
        id: msg.id,
        role: msg.role as "user" | "assistant",
        content,
        edits: edits.length > 0 ? edits : undefined,
        editsApplied: get().appliedEditIds.has(msg.id),
        createdAt: new Date().toISOString(),
      }
    })

    // Also build edits map for applyChatEdits to find
    const editsMap: Record<string, ProposedEdit[]> = {}
    for (const msg of legacy) {
      if (msg.edits && msg.edits.length > 0) {
        editsMap[msg.id] = msg.edits
      }
    }

    set({ chatMessages: legacy, _uiChatEdits: editsMap, isDirty: true })
  },
}))
