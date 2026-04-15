import { useEffect, useRef, useCallback, useState } from "react"
import { useParams, Link, useNavigate } from "react-router-dom"
import { Send, Monitor, Tablet, Smartphone, Undo2, Redo2 } from "lucide-react"
import { toast } from "sonner"
import { supabase } from "@/lib/supabase"
import { friendlyError } from "@/lib/errors"
import { useAuth } from "@/contexts/AuthContext"
import { useAccount } from "@/contexts/AccountContext"
import { useBuilderStore } from "@/store/builderStore"
import BuilderForm from "@/components/builder/BuilderForm"
import ChatPanel from "@/components/builder/ChatPanel"
import SettingsPanel from "@/components/builder/SettingsPanel"
import { MessageSquare, Settings, PenTool } from "lucide-react"
import ProposalWrapper from "@/components/proposal/ProposalWrapper"
import SendProposalDialog from "@/components/proposal/SendProposalDialog"
import type { ProposalData } from "@/types/proposal"

const DEBOUNCE_PREVIEW_MS = 300
const DEBOUNCE_SAVE_MS = 2000

const BuilderHome = () => {
  const { id } = useParams<{ id?: string }>()
  const { userId } = useAuth()
  const { account } = useAccount()
  const navigate = useNavigate()
  const { proposal, previewProposal, saveStatus, isDirty, flushToPreview, setSaveStatus, initNew, initExisting, contextBlobs, undo, redo, undoStack, redoStack } = useBuilderStore()

  const previewTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const proposalRef = useRef(proposal)
  proposalRef.current = proposal

  // Loading state for existing proposals
  const [isLoading, setIsLoading] = useState(!!id)

  // Left pane tabs: Chat (default) | Settings | Form
  const [leftTab, setLeftTab] = useState<"chat" | "settings" | "form">("chat")
  const pendingChatPrompt = useBuilderStore((s) => s.pendingChatPrompt)

  // Switch to Chat tab when an AI ghost button triggers a prompt
  useEffect(() => {
    if (pendingChatPrompt) setLeftTab("chat")
  }, [pendingChatPrompt])

  // Send proposal dialog (extracted to SendProposalDialog component)
  const [showSendDialog, setShowSendDialog] = useState(false)

  // Top-bar engagement summary — aggregate across all sends for this proposal
  // so the user can see at a glance whether their client is engaging, without
  // needing to open the send dialog or navigate to the detail page.
  const [engagement, setEngagement] = useState<{
    sendCount: number
    latestSentAt: string | null
    opens: number
    clicks: number
    replies: number
  } | null>(null)

  const loadEngagement = useCallback(async () => {
    if (!proposal.id) return
    const [sendsRes, subsRes] = await Promise.all([
      supabase
        .from("proposal_sends")
        .select("sent_at, open_count, click_count")
        .eq("proposal_id", proposal.id)
        .order("sent_at", { ascending: false }),
      supabase
        .from("submissions")
        .select("id")
        .eq("proposal_id", proposal.id),
    ])
    const sends = sendsRes.data ?? []
    const subs = subsRes.data ?? []
    setEngagement({
      sendCount: sends.length,
      latestSentAt: sends[0]?.sent_at ?? null,
      opens: sends.reduce((acc, s) => acc + (s.open_count ?? 0), 0),
      clicks: sends.reduce((acc, s) => acc + (s.click_count ?? 0), 0),
      replies: subs.length,
    })
  }, [proposal.id])

  useEffect(() => {
    loadEngagement()
  }, [loadEngagement])

  // Preview viewport
  const [previewWidth, setPreviewWidth] = useState(1280)
  const viewports = [
    { label: "Desktop", width: 1280, icon: Monitor },
    { label: "Tablet", width: 768, icon: Tablet },
    { label: "Mobile", width: 375, icon: Smartphone },
  ] as const

  // Reflect a successful send locally so the top bar status updates immediately,
  // and refetch the engagement summary so the count ticks up.
  const handleSendComplete = useCallback(() => {
    if (!proposal.status || proposal.status === "draft") {
      useBuilderStore.getState().updateField("status", "sent")
    }
    loadEngagement()
  }, [proposal.status, loadEngagement])

  const leftPaneRef = useRef<HTMLDivElement>(null)

  // Preview scaling — render at fixed width, scale down to fit container (never zoom in)
  const previewContainerRef = useRef<HTMLDivElement>(null)
  const previewContentRef = useRef<HTMLDivElement>(null)
  const [previewScale, setPreviewScale] = useState(1)
  useEffect(() => {
    const container = previewContainerRef.current
    if (!container) return
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const containerWidth = entry.contentRect.width
        // Scale down if preview is wider than container, otherwise show at 1:1
        setPreviewScale(Math.min(1, containerWidth / previewWidth))
      }
    })
    observer.observe(container)
    return () => observer.disconnect()
  }, [previewWidth])

  // Map a field path from the preview to the correct builder tab
  const fieldPathToSection = (path: string): string => {
    if (path.startsWith("summary.")) return "summary"
    if (path.startsWith("scope.")) return "scope"
    if (path.startsWith("timeline.")) return "timeline"
    if (path.startsWith("investment.")) return "investment"
    // top-level fields like clientName, tagline, heroDescription → meta
    return "meta"
  }

  // Click handler for the preview pane — intercept clicks on data-field-path elements
  const handlePreviewClick = useCallback((e: React.MouseEvent) => {
    // Walk up from the click target to find the nearest [data-field-path]
    let el = e.target as HTMLElement | null
    while (el) {
      // If the element is inline editable, let the browser handle the click
      // (for cursor placement in contentEditable)
      if (el.getAttribute("data-inline-editable") === "true") {
        return // don't intercept — let contentEditable handle it
      }

      // If the click is on a section toolbar, let the toolbar handle it
      if (el.classList.contains("section-toolbar") || el.classList.contains("section-toolbar-btn")) {
        return // don't intercept — let toolbar buttons handle it
      }

      const fieldPath = el.getAttribute("data-field-path")
      if (fieldPath) {
        e.preventDefault()
        e.stopPropagation()

        // Switch to the correct builder tab
        const section = fieldPathToSection(fieldPath)
        useBuilderStore.getState().setActiveSection(section)

        // After React re-renders the new tab, find & focus the matching form field
        setTimeout(() => {
          const input = document.querySelector(`[data-builder-field="${fieldPath}"]`) as HTMLElement | null
          if (input) {
            input.scrollIntoView({ behavior: "smooth", block: "center" })
            input.focus()
            input.classList.add("builder-field-glow")
            setTimeout(() => input.classList.remove("builder-field-glow"), 1500)
          }
        }, 50)
        return
      }
      el = el.parentElement
    }
  }, [])

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
            // Ownership guard — only account members can edit
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

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-background">
      {/* Top bar */}
      <div className="flex h-12 shrink-0 items-center justify-between border-b border-border px-4">
        <Link to="/proposals" className="text-xs font-medium text-muted-foreground hover:text-foreground transition-colors">
          ← Proposals
        </Link>
        {isLoading ? (
          <div className="h-4 w-32 animate-pulse rounded bg-muted" />
        ) : (
          <p className="text-xs font-medium text-foreground truncate max-w-xs">
            {proposal.title || "New Proposal"}
          </p>
        )}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-0.5">
            <button
              onClick={undo}
              disabled={undoStack.length === 0}
              className="rounded-md p-1.5 text-muted-foreground transition-colors hover:text-foreground disabled:opacity-30 disabled:cursor-default disabled:hover:text-muted-foreground"
              title="Undo (⌘Z)"
            >
              <Undo2 className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={redo}
              disabled={redoStack.length === 0}
              className="rounded-md p-1.5 text-muted-foreground transition-colors hover:text-foreground disabled:opacity-30 disabled:cursor-default disabled:hover:text-muted-foreground"
              title="Redo (⌘⇧Z)"
            >
              <Redo2 className="h-3.5 w-3.5" />
            </button>
          </div>
          <span className={`text-xs transition-colors ${
            saveStatus === "saving" ? "text-muted-foreground" :
            saveStatus === "saved" ? "text-brand-1" :
            saveStatus === "error" ? "text-red-500" :
            "text-transparent"
          }`}>
            {saveStatus === "saving" ? "Saving..." : saveStatus === "saved" ? "Saved" : saveStatus === "error" ? "Save failed" : "·"}
          </span>

          {/*
            Engagement summary. Only shows when this proposal has been sent
            at least once. Clickable to open the send dialog (same as the
            Send button) so users can drill into the history quickly.
          */}
          {engagement && engagement.sendCount > 0 && (
            <button
              onClick={() => setShowSendDialog(true)}
              className="flex items-center gap-2 rounded-md border border-border px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.1em] text-muted-foreground transition-colors hover:border-foreground hover:text-foreground"
              style={{ fontFamily: "var(--font-mono)" }}
              title="Open send history"
            >
              <span>SENT</span>
              {engagement.opens > 0 && (
                <>
                  <span className="text-border">·</span>
                  <span>
                    <span style={{ color: "var(--color-forest)" }}>{engagement.opens}</span>{" "}
                    {engagement.opens === 1 ? "OPEN" : "OPENS"}
                  </span>
                </>
              )}
              {engagement.clicks > 0 && (
                <>
                  <span className="text-border">·</span>
                  <span>
                    <span style={{ color: "var(--color-forest-deep)" }}>{engagement.clicks}</span>{" "}
                    {engagement.clicks === 1 ? "CLICK" : "CLICKS"}
                  </span>
                </>
              )}
              {engagement.replies > 0 && (
                <>
                  <span className="text-border">·</span>
                  <span>
                    <span style={{ color: "var(--color-ochre)" }}>{engagement.replies}</span>{" "}
                    {engagement.replies === 1 ? "REPLY" : "REPLIES"}
                  </span>
                </>
              )}
            </button>
          )}

          {proposal.slug && (
            <button
              onClick={() => setShowSendDialog(true)}
              className="flex items-center gap-1.5 rounded-full bg-foreground px-3 py-1.5 text-xs font-medium text-background transition-colors hover:bg-foreground/80"
            >
              <Send className="h-3 w-3" />
              Send
            </button>
          )}
        </div>
      </div>

      {/* Split pane */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left pane — Chat | Settings | Form tabs */}
        <div ref={leftPaneRef} className="w-[400px] shrink-0 flex flex-col border-r border-border">
          {/* Tab bar */}
          <div className="flex shrink-0 border-b border-border">
            {([
              { id: "chat" as const, label: "Chat", icon: MessageSquare },
              { id: "settings" as const, label: "Settings", icon: Settings },
              { id: "form" as const, label: "Form", icon: PenTool },
            ]).map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setLeftTab(id)}
                className={`flex flex-1 items-center justify-center gap-1.5 py-2.5 text-xs font-medium transition-colors ${
                  leftTab === id
                    ? "bg-background text-foreground border-b-2 border-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                {label}
              </button>
            ))}
          </div>

          {/* Tab content */}
          <div className="flex-1 overflow-hidden flex flex-col">
            {leftTab === "chat" && (
              <div className="flex-1 overflow-hidden">
                <ChatPanel alwaysOpen />
              </div>
            )}
            {leftTab === "settings" && (
              <div className="flex-1 overflow-y-auto">
                <SettingsPanel />
              </div>
            )}
            {leftTab === "form" && (
              <div className="flex-1 overflow-y-auto">
                <BuilderForm />
              </div>
            )}
          </div>
        </div>

        {/* Preview — right pane */}
        <div className="flex flex-1 flex-col overflow-hidden bg-muted/20">
          {/* Viewport toggle */}
          <div className="flex h-10 shrink-0 items-center justify-center gap-1 border-b border-border bg-background/50">
            {viewports.map(({ label, width, icon: Icon }) => (
              <button
                key={width}
                onClick={() => setPreviewWidth(width)}
                className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                  previewWidth === width
                    ? "bg-foreground text-background"
                    : "text-muted-foreground hover:text-foreground"
                }`}
                title={`${label} (${width}px)`}
              >
                <Icon className="h-3.5 w-3.5" />
                {label}
              </button>
            ))}
          </div>

          <div ref={previewContainerRef} className="flex-1 overflow-y-auto overflow-x-hidden flex justify-center">
            {isLoading ? (
              <div className="flex h-full items-center justify-center">
                <p className="text-sm text-muted-foreground">Loading proposal...</p>
              </div>
            ) : previewProposal.title ? (
              <div
                ref={previewContentRef}
                className="builder-preview"
                style={{
                  width: previewWidth,
                  maxWidth: previewWidth,
                  overflowX: "hidden",
                  zoom: previewScale,
                }}
                onClickCapture={handlePreviewClick}
              >
                <ProposalWrapper proposal={previewProposal} isPreview viewportWidth={previewWidth} />
              </div>
            ) : (
              <div className="flex h-full items-center justify-center">
                <p className="text-sm text-muted-foreground">Start filling in the form to see a preview</p>
              </div>
            )}
          </div>
        </div>
      </div>

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
  )
}

export default BuilderHome
