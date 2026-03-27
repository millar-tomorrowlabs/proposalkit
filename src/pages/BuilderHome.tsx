import { useEffect, useRef, useCallback, useState } from "react"
import { useParams, Link, useNavigate } from "react-router-dom"
import { Send, X, Monitor, Tablet, Smartphone } from "lucide-react"
import { supabase } from "@/lib/supabase"
import { useAuth } from "@/contexts/AuthContext"
import { useAccount } from "@/contexts/AccountContext"
import { useBuilderStore } from "@/store/builderStore"
import BuilderForm from "@/components/builder/BuilderForm"
import ChatPanel from "@/components/builder/ChatPanel"
import ProposalWrapper from "@/components/proposal/ProposalWrapper"
import type { ProposalData } from "@/types/proposal"

const DEBOUNCE_PREVIEW_MS = 300
const DEBOUNCE_SAVE_MS = 2000

const BuilderHome = () => {
  const { id } = useParams<{ id?: string }>()
  const { userId } = useAuth()
  const { account } = useAccount()
  const navigate = useNavigate()
  const { proposal, previewProposal, saveStatus, isDirty, flushToPreview, setSaveStatus, initNew, initExisting, chatPanelOpen, contextBlobs } = useBuilderStore()

  const previewTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const proposalRef = useRef(proposal)
  proposalRef.current = proposal

  // Loading state for existing proposals
  const [isLoading, setIsLoading] = useState(!!id)

  // Send proposal modal
  const [showSendModal, setShowSendModal] = useState(false)
  const [sendName, setSendName] = useState("")
  const [sendEmail, setSendEmail] = useState("")
  const [sendSubject, setSendSubject] = useState("")
  const [sendMessage, setSendMessage] = useState("")
  const [sendStatus, setSendStatus] = useState<"idle" | "sending" | "sent" | "error">("idle")
  const [markAsSent, setMarkAsSent] = useState(true)

  // Preview viewport
  const [previewWidth, setPreviewWidth] = useState(1280)
  const viewports = [
    { label: "Desktop", width: 1280, icon: Monitor },
    { label: "Tablet", width: 768, icon: Tablet },
    { label: "Mobile", width: 375, icon: Smartphone },
  ] as const

  const handleSendProposal = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!sendName.trim() || !sendEmail.trim()) return
    setSendStatus("sending")

    const proposalUrl = `${window.location.origin}/p/${proposal.slug || proposal.id}`

    try {
      const { error: sendError } = await supabase.functions.invoke("send-proposal", {
        body: {
          proposalId: proposal.id,
          recipientName: sendName.trim(),
          recipientEmail: sendEmail.trim(),
          proposalTitle: sendSubject.trim() || proposal.title,
          clientName: proposal.clientName,
          proposalUrl,
          studioName: proposal.studioName || account.studioName,
          senderName: account.senderName || account.studioName,
          website: account.website,
          brandColor1: proposal.brandColor1,
          brandColor2: proposal.brandColor2,
          personalMessage: sendMessage.trim() || undefined,
        },
      })
      if (!sendError) {
        setSendStatus("sent")
        // Update proposal status if "Mark as Sent" is checked
        if (markAsSent) {
          useBuilderStore.getState().updateField("status", "sent")
        }
      } else {
        setSendStatus("error")
      }
    } catch {
      setSendStatus("error")
    }
  }

  // Resizable divider for form / chat split
  const leftPaneRef = useRef<HTMLDivElement>(null)
  const [formHeight, setFormHeight] = useState<number | null>(null)

  // Preview scaling — render at fixed width, scale to fit container
  const previewContainerRef = useRef<HTMLDivElement>(null)
  const previewContentRef = useRef<HTMLDivElement>(null)
  const [previewScale, setPreviewScale] = useState(0.5)
  useEffect(() => {
    const container = previewContainerRef.current
    if (!container) return
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const containerWidth = entry.contentRect.width
        setPreviewScale(containerWidth / previewWidth)
      }
    })
    observer.observe(container)
    return () => observer.disconnect()
  }, [previewWidth])

  const handleDividerMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    const startY = e.clientY
    const startHeight = formHeight ?? (leftPaneRef.current?.offsetHeight ?? 600) * 0.6

    const onMouseMove = (ev: MouseEvent) => {
      const paneHeight = leftPaneRef.current?.offsetHeight ?? 600
      const delta = ev.clientY - startY
      const newHeight = Math.max(200, Math.min(paneHeight - 200, startHeight + delta))
      setFormHeight(newHeight)
    }

    const onMouseUp = () => {
      document.removeEventListener("mousemove", onMouseMove)
      document.removeEventListener("mouseup", onMouseUp)
    }

    document.addEventListener("mousemove", onMouseMove)
    document.addEventListener("mouseup", onMouseUp)
  }, [formHeight])

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
            initExisting(merged, data.chat_messages ?? [])
            // Restore persisted context blobs (without triggering auto-save)
            if (merged.contextBlobs?.length) {
              useBuilderStore.setState({ contextBlobs: merged.contextBlobs, isDirty: false })
            }
          }
          setIsLoading(false)
        })
    } else {
      initNew()
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
      setSaveStatus(error ? "error" : "saved")
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
        <p className="text-xs font-medium text-foreground truncate max-w-xs">
          {isLoading ? "" : proposal.title || "New Proposal"}
        </p>
        <div className="flex items-center gap-3">
          <span className={`text-xs transition-colors ${
            saveStatus === "saving" ? "text-muted-foreground" :
            saveStatus === "saved" ? "text-brand-1" :
            saveStatus === "error" ? "text-red-500" :
            "text-transparent"
          }`}>
            {saveStatus === "saving" ? "Saving..." : saveStatus === "saved" ? "Saved" : saveStatus === "error" ? "Save failed" : "·"}
          </span>
          {proposal.slug && (
            <button
              onClick={() => { setShowSendModal(true); setSendStatus("idle"); setSendSubject(proposal.title) }}
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
        {/* Left pane — form + chat */}
        <div ref={leftPaneRef} className="w-[480px] shrink-0 flex flex-col border-r border-border">
          {/* Form area */}
          <div
            className="overflow-y-auto"
            style={
              chatPanelOpen
                ? formHeight
                  ? { height: formHeight, flexShrink: 0 }
                  : { flex: 3 }
                : { flex: 1 }
            }
          >
            <BuilderForm />
          </div>

          {/* Resizable divider */}
          {chatPanelOpen && (
            <div
              className="h-1 shrink-0 cursor-row-resize bg-border hover:bg-brand-1 transition-colors"
              onMouseDown={handleDividerMouseDown}
            />
          )}

          {/* Chat panel — flex:2 gives ~40% when open without explicit height */}
          <div className={chatPanelOpen ? "flex-[2] overflow-hidden" : ""}>
            <ChatPanel />
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

          <div ref={previewContainerRef} className="flex-1 overflow-y-auto">
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
                  zoom: previewScale,
                }}
                onClickCapture={handlePreviewClick}
              >
                <ProposalWrapper proposal={previewProposal} isPreview />
              </div>
            ) : (
              <div className="flex h-full items-center justify-center">
                <p className="text-sm text-muted-foreground">Start filling in the form to see a preview</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Send proposal modal */}
      {showSendModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4"
          onClick={(e) => { if (e.target === e.currentTarget) setShowSendModal(false) }}
        >
          <div className="relative w-full max-w-md rounded-2xl bg-background border border-border p-8 shadow-2xl">
            <button
              onClick={() => setShowSendModal(false)}
              className="absolute right-5 top-5 text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="h-4 w-4" />
            </button>

            {sendStatus === "sent" ? (
              <div className="py-4 text-center">
                <div className="mx-auto mb-4 flex h-10 w-10 items-center justify-center rounded-full bg-brand-1">
                  <Send className="h-4 w-4 text-white" />
                </div>
                <h3 className="font-display text-xl font-semibold text-foreground">Sent!</h3>
                <p className="mt-2 text-sm text-muted-foreground">
                  Proposal sent to {sendEmail}
                </p>
                <button
                  onClick={() => setShowSendModal(false)}
                  className="mt-4 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
                >
                  Close
                </button>
              </div>
            ) : (
              <form onSubmit={handleSendProposal} className="space-y-4">
                <div>
                  <h3 className="font-display text-lg font-semibold text-foreground">Send proposal</h3>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Send a branded email with a link to view this proposal.
                  </p>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">Recipient name</label>
                  <input
                    type="text"
                    required
                    value={sendName}
                    onChange={(e) => setSendName(e.target.value)}
                    placeholder="Sarah Chen"
                    className="builder-input"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">Recipient email</label>
                  <input
                    type="email"
                    required
                    value={sendEmail}
                    onChange={(e) => setSendEmail(e.target.value)}
                    placeholder="sarah@client.com"
                    className="builder-input"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">Subject line</label>
                  <input
                    type="text"
                    value={sendSubject}
                    onChange={(e) => setSendSubject(e.target.value)}
                    placeholder={proposal.title}
                    className="builder-input"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">
                    Personal message <span className="font-normal text-muted-foreground/60">(optional)</span>
                  </label>
                  <textarea
                    value={sendMessage}
                    onChange={(e) => setSendMessage(e.target.value)}
                    rows={3}
                    placeholder="Hey Sarah, here's the proposal we discussed..."
                    className="builder-input resize-none"
                  />
                </div>

                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={markAsSent}
                    onChange={(e) => setMarkAsSent(e.target.checked)}
                    className="h-3.5 w-3.5 rounded border-border accent-brand-1"
                  />
                  <span className="text-xs text-muted-foreground">Mark proposal as sent</span>
                </label>

                {sendStatus === "error" && (
                  <p className="text-xs text-red-500">Something went wrong. Please try again.</p>
                )}

                <button
                  type="submit"
                  disabled={sendStatus === "sending"}
                  className="w-full rounded-full bg-foreground px-4 py-2.5 text-sm font-medium text-background transition-colors hover:bg-foreground/80 disabled:opacity-50"
                >
                  {sendStatus === "sending" ? "Sending..." : "Send proposal"}
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default BuilderHome
