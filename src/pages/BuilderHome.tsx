import { useEffect, useRef, useCallback, useState } from "react"
import { useParams, useNavigate } from "react-router-dom"
import { toast } from "sonner"
import { supabase } from "@/lib/supabase"
import { friendlyError } from "@/lib/errors"
import { useAuth } from "@/contexts/AuthContext"
import { useAccount } from "@/contexts/AccountContext"
import { useBuilderStore } from "@/store/builderStore"
import BuilderPreviewContext from "@/contexts/BuilderPreviewContext"
import ProposalWrapper from "@/components/proposal/ProposalWrapper"
import SendProposalDialog from "@/components/proposal/SendProposalDialog"
import BuilderTopBar from "@/components/builder/BuilderTopBar"
import FloatingComposer from "@/components/builder/FloatingComposer"
import SettingsPopover from "@/components/builder/SettingsPopover"
import ContextDialog from "@/components/builder/ContextDialog"
import { VIEWPORT_WIDTHS } from "@/components/builder/ViewportSwitcher"
import type { ProposalData, SectionKey } from "@/types/proposal"

const DEBOUNCE_PREVIEW_MS = 300
const DEBOUNCE_SAVE_MS = 2000

const ALL_SECTIONS: SectionKey[] = ["summary", "scope", "timeline", "investment", "cta"]

const BuilderHome = () => {
  const { id } = useParams<{ id?: string }>()
  const { userId } = useAuth()
  const { account } = useAccount()
  const navigate = useNavigate()
  const {
    proposal,
    previewProposal,
    saveStatus,
    isDirty,
    flushToPreview,
    setSaveStatus,
    initNew,
    initExisting,
    contextBlobs,
    updateField,
    chatMessages,
    chatLoading,
    addChatMessage,
    composerVisible,
    setComposerVisible,
    viewport,
    setViewport,
  } = useBuilderStore()

  const previewTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const proposalRef = useRef(proposal)
  proposalRef.current = proposal

  // Loading state for existing proposals
  const [isLoading, setIsLoading] = useState(!!id)

  // Document-first editor state
  const [previewMode, setPreviewMode] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [showContext, setShowContext] = useState(false)
  const [showSendDialog, setShowSendDialog] = useState(false)
  const settingsButtonRef = useRef<HTMLButtonElement>(null)

  // Init on mount
  useEffect(() => {
    if (id) {
      // Load existing proposal
      setIsLoading(true)
      supabase
        .from("proposals")
        .select("*")
        .eq("id", id)
        .single()
        .then(({ data }) => {
          if (data) {
            // Ownership guard -- only account members can edit
            if (data.account_id && data.account_id !== account.id) {
              navigate("/proposals")
              return
            }
            const merged = { ...data, ...data.data } as ProposalData
            // Backfill studio branding from account if missing (for proposals created
            // before denormalization was added). This auto-heals existing rows: the
            // auto-save will persist the patch on next dirty flush.
            if (!merged.studioName && account.studioName) {
              merged.studioName = account.studioName
            }
            if (!merged.studioLogoUrl && account.logoUrl) {
              merged.studioLogoUrl = account.logoUrl
            }
            initExisting(merged, data.chat_messages ?? [])
            // Restore persisted context blobs (without triggering auto-save)
            if (merged.contextBlobs?.length) {
              useBuilderStore.setState({ contextBlobs: merged.contextBlobs, isDirty: false })
            }
          }
          setIsLoading(false)
        })
    } else {
      initNew({
        studioName: account.studioName,
        studioLogoUrl: account.logoUrl,
        ctaEmail: account.defaultCtaEmail,
        brandColor1: account.defaultBrandColor1,
        brandColor2: account.defaultBrandColor2,
      })
      setIsLoading(false)
    }
  }, [id])

  // Debounce preview flush
  useEffect(() => {
    if (previewTimer.current) clearTimeout(previewTimer.current)
    previewTimer.current = setTimeout(() => {
      flushToPreview()
    }, DEBOUNCE_PREVIEW_MS)
    return () => { if (previewTimer.current) clearTimeout(previewTimer.current) }
  }, [proposal])

  // Undo / redo keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const isMod = e.metaKey || e.ctrlKey
      if (!isMod || e.key.toLowerCase() !== "z") return

      e.preventDefault()
      const store = useBuilderStore.getState()
      if (e.shiftKey) {
        // Ctrl/Cmd+Shift+Z = redo
        if (store.canRedo()) {
          store.redo()
          toast.info("Redo")
        }
      } else {
        // Ctrl/Cmd+Z = undo
        if (store.canUndo()) {
          store.undo()
          toast.info("Undo")
        }
      }
    }
    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  }, [])

  // Debounce auto-save
  useEffect(() => {
    if (saveTimer.current) clearTimeout(saveTimer.current)
    if (!isDirty) return // skip save triggered by init/load
    if (!proposal.slug && !proposal.title) return // don't save empty state

    setSaveStatus("saving")
    saveTimer.current = setTimeout(async () => {
      const { error } = await supabase
        .from("proposals")
        .upsert({
          id: proposal.id,
          account_id: account.id,
          user_id: userId,
          slug: proposal.slug || proposal.id,
          title: proposal.title || "Untitled",
          client_name: proposal.clientName || "Unknown",
          brand_color_1: proposal.brandColor1,
          brand_color_2: proposal.brandColor2,
          hero_image_url: proposal.heroImageUrl,
          cta_email: proposal.ctaEmail,
          status: proposal.status || "draft",
          sections: proposal.sections,
          data: { ...proposal, contextBlobs: useBuilderStore.getState().contextBlobs },
          chat_messages: useBuilderStore.getState().chatMessages,
        })
      if (error) {
        setSaveStatus("error")
        toast.error(friendlyError(error.message))
      } else {
        setSaveStatus("saved")
      }
    }, DEBOUNCE_SAVE_MS)

    return () => { if (saveTimer.current) clearTimeout(saveTimer.current) }
  }, [proposal, contextBlobs])

  // Section management for BuilderPreviewContext
  const addSection = useCallback((relativeTo: SectionKey, position: "above" | "below") => {
    const current = useBuilderStore.getState().proposal.sections
    const available = ALL_SECTIONS.filter((s) => !current.includes(s))
    if (available.length === 0) return
    const newSection = available[0]
    const idx = current.indexOf(relativeTo)
    if (idx === -1) return
    const updated = [...current]
    updated.splice(position === "above" ? idx : idx + 1, 0, newSection)
    useBuilderStore.getState().updateField("sections", updated)
  }, [])

  const removeSection = useCallback((key: SectionKey) => {
    const current = useBuilderStore.getState().proposal.sections
    useBuilderStore.getState().updateField(
      "sections",
      current.filter((s) => s !== key),
    )
  }, [])

  // Reflect a successful send locally so the top bar status updates immediately
  const handleSendComplete = useCallback(() => {
    if (!proposal.status || proposal.status === "draft") {
      useBuilderStore.getState().updateField("status", "sent")
    }
    setShowSendDialog(false)
  }, [proposal.status])

  // Show nothing while loading existing proposal
  if (isLoading) return null

  return (
    <BuilderPreviewContext.Provider
      value={{
        isEditable: !previewMode,
        updateField: useBuilderStore.getState().updateField,
        updateAtPath: useBuilderStore.getState().updateAtPath,
        addSection,
        removeSection,
      }}
    >
      <div className="min-h-screen" style={{ background: "var(--color-paper)" }}>
        <BuilderTopBar
          title={proposal.title}
          onTitleChange={(t) => updateField("title", t)}
          status={proposal.status || "draft"}
          viewport={viewport}
          onViewportChange={setViewport}
          previewMode={previewMode}
          onTogglePreview={() => {
            setPreviewMode(!previewMode)
            if (!previewMode) setComposerVisible(false)
            else setComposerVisible(true)
          }}
          onOpenSettings={() => setShowSettings(!showSettings)}
          onOpenContext={() => setShowContext(true)}
          onSend={() => setShowSendDialog(true)}
          saveStatus={saveStatus}
        />

        {/* Settings popover -- positioned below top bar, right-aligned */}
        <div className="relative">
          <div className="absolute right-4 top-0 z-50">
            <SettingsPopover
              open={showSettings}
              onClose={() => setShowSettings(false)}
              anchorRef={settingsButtonRef}
            />
          </div>
        </div>

        {/* Document area */}
        <div className="pt-11">
          <div
            className="builder-preview mx-auto transition-all duration-200"
            style={{
              maxWidth: VIEWPORT_WIDTHS[viewport] || undefined,
            }}
          >
            <ProposalWrapper proposal={previewProposal} isPreview viewportWidth={viewport === "tablet" ? 768 : viewport === "mobile" ? 375 : undefined} />
          </div>
        </div>

        {/* Floating composer */}
        {!previewMode && (
          <FloatingComposer
            messages={chatMessages.map((m) => ({
              id: m.id,
              role: m.role,
              content: m.content,
              createdAt: m.createdAt,
            }))}
            loading={chatLoading}
            onSend={(text) => {
              // For now, just add user message to store
              // AI integration will be connected in a later task
              addChatMessage({
                id: crypto.randomUUID(),
                role: "user",
                content: text,
                createdAt: new Date().toISOString(),
              })
            }}
            onAttach={() => setShowContext(true)}
            visible={composerVisible}
            onToggle={() => setComposerVisible(!composerVisible)}
          />
        )}

        {/* Context dialog */}
        <ContextDialog
          open={showContext}
          onClose={() => setShowContext(false)}
          proposalId={proposal.id}
        />

        {/* Send dialog */}
        <SendProposalDialog
          open={showSendDialog}
          onClose={() => setShowSendDialog(false)}
          proposal={proposal}
          account={{
            studioName: account.studioName,
            senderName: account.senderName,
            website: account.website,
          }}
          onSendComplete={handleSendComplete}
        />
      </div>
    </BuilderPreviewContext.Provider>
  )
}

export default BuilderHome
