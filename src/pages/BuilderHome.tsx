import { useEffect, useRef, useCallback, useState } from "react"
import { useParams, Link } from "react-router-dom"
import { supabase } from "@/lib/supabase"
import { useBuilderStore } from "@/store/builderStore"
import BuilderForm from "@/components/builder/BuilderForm"
import ChatPanel from "@/components/builder/ChatPanel"
import ProposalWrapper from "@/components/proposal/ProposalWrapper"
import type { ProposalData } from "@/types/proposal"

const DEBOUNCE_PREVIEW_MS = 300
const DEBOUNCE_SAVE_MS = 2000

const BuilderHome = () => {
  const { id } = useParams<{ id?: string }>()
  const { proposal, previewProposal, saveStatus, isDirty, flushToPreview, setSaveStatus, initNew, initExisting, chatPanelOpen } = useBuilderStore()

  const previewTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const proposalRef = useRef(proposal)
  proposalRef.current = proposal

  // Resizable divider for form / chat split
  const leftPaneRef = useRef<HTMLDivElement>(null)
  const [formHeight, setFormHeight] = useState<number | null>(null)

  // Preview scaling — render at fixed width, scale to fit container
  const PREVIEW_WIDTH = 1280
  const previewContainerRef = useRef<HTMLDivElement>(null)
  const previewContentRef = useRef<HTMLDivElement>(null)
  const [previewScale, setPreviewScale] = useState(0.5)
  useEffect(() => {
    const container = previewContainerRef.current
    if (!container) return
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const containerWidth = entry.contentRect.width
        setPreviewScale(containerWidth / PREVIEW_WIDTH)
      }
    })
    observer.observe(container)
    return () => observer.disconnect()
  }, [])

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
      supabase
        .from("proposals")
        .select("*")
        .eq("id", id)
        .single()
        .then(({ data }) => {
          if (data) initExisting({ ...data, ...data.data } as ProposalData, data.chat_messages ?? [])
        })
    } else {
      initNew()
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
          slug: proposal.slug || proposal.id,
          title: proposal.title || "Untitled",
          client_name: proposal.clientName || "Unknown",
          brand_color_1: proposal.brandColor1,
          brand_color_2: proposal.brandColor2,
          hero_image_url: proposal.heroImageUrl,
          cta_email: proposal.ctaEmail,
          sections: proposal.sections,
          data: proposal,
          chat_messages: useBuilderStore.getState().chatMessages,
        })
      setSaveStatus(error ? "error" : "saved")
    }, DEBOUNCE_SAVE_MS)

    return () => { if (saveTimer.current) clearTimeout(saveTimer.current) }
  }, [proposal])

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-background">
      {/* Top bar */}
      <div className="flex h-12 shrink-0 items-center justify-between border-b border-border px-4">
        <Link to="/proposals" className="text-xs font-medium text-muted-foreground hover:text-foreground transition-colors">
          ← Proposals
        </Link>
        <p className="text-xs font-medium text-foreground truncate max-w-xs">
          {proposal.title || "New Proposal"}
        </p>
        <span className={`text-xs transition-colors ${
          saveStatus === "saving" ? "text-muted-foreground" :
          saveStatus === "saved" ? "text-brand-1" :
          saveStatus === "error" ? "text-red-500" :
          "text-transparent"
        }`}>
          {saveStatus === "saving" ? "Saving..." : saveStatus === "saved" ? "Saved" : saveStatus === "error" ? "Save failed" : "·"}
        </span>
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
        <div ref={previewContainerRef} className="flex-1 overflow-y-auto bg-muted/20">
          {previewProposal.title ? (
            <div
              ref={previewContentRef}
              className="builder-preview"
              style={{
                width: PREVIEW_WIDTH,
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
  )
}

export default BuilderHome
