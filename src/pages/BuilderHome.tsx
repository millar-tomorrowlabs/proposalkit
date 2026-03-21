import { useEffect, useRef } from "react"
import { useParams, Link } from "react-router-dom"
import { supabase } from "@/lib/supabase"
import { useBuilderStore } from "@/store/builderStore"
import BuilderForm from "@/components/builder/BuilderForm"
import ProposalWrapper from "@/components/proposal/ProposalWrapper"
import type { ProposalData } from "@/types/proposal"

const DEBOUNCE_PREVIEW_MS = 300
const DEBOUNCE_SAVE_MS = 2000

const BuilderHome = () => {
  const { id } = useParams<{ id?: string }>()
  const { proposal, previewProposal, saveStatus, isDirty, flushToPreview, setSaveStatus, initNew, initExisting } = useBuilderStore()

  const previewTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const proposalRef = useRef(proposal)
  proposalRef.current = proposal

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
          if (data) initExisting({ ...data, ...data.data } as ProposalData)
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
        {/* Form — left pane */}
        <div className="w-[480px] shrink-0 overflow-y-auto border-r border-border">
          <BuilderForm />
        </div>

        {/* Preview — right pane */}
        <div className="flex-1 overflow-y-auto bg-muted/20">
          {previewProposal.title ? (
            <div className="pointer-events-none" style={{ zoom: 0.55 }}>
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
