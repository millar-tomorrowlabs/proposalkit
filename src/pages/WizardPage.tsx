import { useState, useRef } from "react"
import { useNavigate, Link } from "react-router-dom"
import { v4 as uuidv4 } from "uuid"
import { supabase } from "@/lib/supabase"
import { ArrowRight, X, Link as LinkIcon, Loader2 } from "lucide-react"
import type { ProposalData, SectionKey } from "@/types/proposal"

type Step = "context" | "details" | "generating"

const LOADING_MESSAGES = [
  "Reading your context…",
  "Understanding the client…",
  "Drafting the proposal…",
  "Building sections…",
  "Almost there…",
]

const WizardPage = () => {
  const navigate = useNavigate()
  const [step, setStep] = useState<Step>("context")

  // Context step
  const [context, setContext] = useState("")
  const [urls, setUrls] = useState<string[]>([])
  const [urlInput, setUrlInput] = useState("")
  const [showUrlInput, setShowUrlInput] = useState(false)
  const urlInputRef = useRef<HTMLInputElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Details step
  const [clientName, setClientName] = useState("")
  const [clientEmail, setClientEmail] = useState("")
  const [ctaEmail, setCTAEmail] = useState("")

  // Generating step
  const [loadingMessage, setLoadingMessage] = useState(LOADING_MESSAGES[0])
  const [error, setError] = useState<string | null>(null)

  const hasContext = context.trim().length > 0 || urls.length > 0

  const addUrl = () => {
    const trimmed = urlInput.trim()
    if (!trimmed) return
    // Basic URL validation
    let url = trimmed
    if (!url.startsWith("http://") && !url.startsWith("https://")) {
      url = "https://" + url
    }
    setUrls((prev) => [...prev, url])
    setUrlInput("")
    setShowUrlInput(false)
  }

  const removeUrl = (index: number) => {
    setUrls((prev) => prev.filter((_, i) => i !== index))
  }

  const handleUrlKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault()
      addUrl()
    } else if (e.key === "Escape") {
      setShowUrlInput(false)
      setUrlInput("")
    }
  }

  const handleContinue = () => {
    if (!hasContext) return
    setStep("details")
  }

  const handleGenerate = async () => {
    setStep("generating")
    setError(null)

    // Cycle loading messages
    let messageIndex = 0
    const interval = setInterval(() => {
      messageIndex = (messageIndex + 1) % LOADING_MESSAGES.length
      setLoadingMessage(LOADING_MESSAGES[messageIndex])
    }, 3000)

    try {
      const { data, error: fnError } = await supabase.functions.invoke(
        "generate-proposal",
        {
          body: {
            context: context.trim(),
            urls,
            clientName: clientName.trim(),
            clientEmail: clientEmail.trim(),
            ctaEmail: ctaEmail.trim(),
          },
        },
      )

      clearInterval(interval)

      if (fnError || data?.error) {
        setError(data?.error || fnError?.message || "Generation failed")
        setStep("details")
        return
      }

      // Build the proposal from the AI draft
      const proposalId = uuidv4()
      const slug = (data.clientName || clientName || "proposal")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)/g, "")

      // Check slug uniqueness — append suffix if taken
      let finalSlug = slug
      const { data: existing } = await supabase
        .from("proposals")
        .select("id")
        .eq("slug", slug)
        .limit(1)

      if (existing && existing.length > 0) {
        finalSlug = `${slug}-${Date.now().toString(36).slice(-4)}`
      }

      const now = new Date().toISOString()
      const sections: SectionKey[] = ["summary", "scope", "timeline", "investment", "cta"]

      const proposal: ProposalData = {
        id: proposalId,
        slug: finalSlug,
        title: data.title || `${clientName} — Proposal`,
        clientName: data.clientName || clientName || "",
        brandColor1: "#000000",
        brandColor2: "#6b7280",
        tagline: data.tagline || "",
        heroDescription: data.heroDescription || "",
        ctaEmail: ctaEmail.trim() || "",
        recommendation: data.recommendation || "",
        brief: data.brief || "",
        sections,
        createdAt: now,
        updatedAt: now,
        summary: {
          studioTagline: data.summary?.studioTagline || "",
          studioDescription: data.summary?.studioDescription || "",
          studioDescription2: data.summary?.studioDescription2 || "",
          projectOverview: data.summary?.projectOverview || "",
          projectDetail: data.summary?.projectDetail || "",
          projectDetail2: data.summary?.projectDetail2 || "",
          pillarsTagline: data.summary?.pillarsTagline || "",
          pillars: data.summary?.pillars || [],
        },
        scope: {
          outcomes: data.scope?.outcomes || [],
          responsibilities: data.scope?.responsibilities || [],
        },
        timeline: {
          subtitle: data.timeline?.subtitle || "",
          phases: data.timeline?.phases || [],
        },
        investment: {
          packages: [],
          addOnCategories: [],
          addOns: [],
        },
      }

      // Save to Supabase
      const { error: saveError } = await supabase.from("proposals").upsert({
        id: proposalId,
        slug: finalSlug,
        title: proposal.title,
        client_name: proposal.clientName,
        brand_color_1: proposal.brandColor1,
        brand_color_2: proposal.brandColor2,
        cta_email: proposal.ctaEmail,
        sections: proposal.sections,
        data: proposal,
      })

      if (saveError) {
        setError(`Save failed: ${saveError.message}`)
        setStep("details")
        return
      }

      // Navigate to builder
      navigate(`/builder/${proposalId}`)
    } catch (err) {
      clearInterval(interval)
      setError(String(err))
      setStep("details")
    }
  }

  const handleTextareaKeyDown = (e: React.KeyboardEvent) => {
    // Cmd/Ctrl+Enter to continue
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter" && hasContext) {
      e.preventDefault()
      handleContinue()
    }
  }

  // Auto-resize textarea
  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setContext(e.target.value)
    const textarea = e.target
    textarea.style.height = "auto"
    textarea.style.height = Math.min(textarea.scrollHeight, 400) + "px"
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4">
      <div className="w-full max-w-2xl">
        {/* Header */}
        <div className="mb-10 text-center">
          <p className="text-xs font-medium uppercase tracking-[0.25em] text-muted-foreground">
            Tomorrow Studios
          </p>
          <h1 className="mt-2 font-display text-2xl font-semibold tracking-tight text-foreground">
            New proposal
          </h1>
        </div>

        {/* ── Step 1: Context ── */}
        {step === "context" && (
          <div className="space-y-4">
            <div className="rounded-xl border border-border bg-card p-1">
              <textarea
                ref={textareaRef}
                value={context}
                onChange={handleTextareaChange}
                onKeyDown={handleTextareaKeyDown}
                placeholder="Paste call notes, transcripts, emails, or anything you have about this client and project…"
                className="w-full resize-none bg-transparent px-4 pt-4 pb-2 text-sm text-foreground placeholder:text-muted-foreground/40 outline-none"
                rows={6}
                autoFocus
              />

              {/* URL chips */}
              {urls.length > 0 && (
                <div className="flex flex-wrap gap-2 px-4 pb-2">
                  {urls.map((url, i) => (
                    <span
                      key={i}
                      className="inline-flex items-center gap-1.5 rounded-full bg-foreground/5 px-3 py-1 text-xs text-muted-foreground"
                    >
                      <LinkIcon className="h-3 w-3" />
                      <span className="max-w-[200px] truncate">
                        {url.replace(/^https?:\/\//, "")}
                      </span>
                      <button
                        onClick={() => removeUrl(i)}
                        className="hover:text-foreground transition-colors"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  ))}
                </div>
              )}

              {/* URL input */}
              {showUrlInput && (
                <div className="flex items-center gap-2 px-4 pb-3">
                  <LinkIcon className="h-3.5 w-3.5 text-muted-foreground" />
                  <input
                    ref={urlInputRef}
                    type="text"
                    value={urlInput}
                    onChange={(e) => setUrlInput(e.target.value)}
                    onKeyDown={handleUrlKeyDown}
                    onBlur={() => {
                      if (!urlInput.trim()) setShowUrlInput(false)
                    }}
                    placeholder="https://clientwebsite.com"
                    className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground/40 outline-none"
                    autoFocus
                  />
                  <button
                    onClick={addUrl}
                    className="text-xs font-medium text-foreground hover:text-brand-1 transition-colors"
                  >
                    Add
                  </button>
                </div>
              )}

              {/* Bottom toolbar */}
              <div className="flex items-center justify-between border-t border-border/50 px-4 py-2.5">
                <button
                  onClick={() => {
                    setShowUrlInput(true)
                    setTimeout(() => urlInputRef.current?.focus(), 50)
                  }}
                  className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  <LinkIcon className="h-3.5 w-3.5" />
                  Add URL
                </button>

                <button
                  onClick={handleContinue}
                  disabled={!hasContext}
                  className="flex items-center gap-1.5 rounded-full bg-foreground px-4 py-1.5 text-xs font-medium text-background transition-colors hover:bg-foreground/80 disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  Continue
                  <ArrowRight className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>

            <p className="text-center text-[11px] text-muted-foreground/50">
              ⌘ Enter to continue
            </p>

            <div className="text-center pt-2">
              <Link
                to="/builder"
                className="text-xs text-muted-foreground/60 hover:text-muted-foreground transition-colors"
              >
                Skip — start blank →
              </Link>
            </div>
          </div>
        )}

        {/* ── Step 2: Details ── */}
        {step === "details" && (
          <div className="space-y-6">
            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">
                  Client name
                </label>
                <input
                  type="text"
                  value={clientName}
                  onChange={(e) => setClientName(e.target.value)}
                  placeholder="e.g. Flush + Seawards"
                  className="w-full rounded-lg border border-border bg-card px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/40 outline-none focus:border-foreground transition-colors"
                  autoFocus
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">
                  Client email
                </label>
                <input
                  type="email"
                  value={clientEmail}
                  onChange={(e) => setClientEmail(e.target.value)}
                  placeholder="client@company.com"
                  className="w-full rounded-lg border border-border bg-card px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/40 outline-none focus:border-foreground transition-colors"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">
                  Your email
                  <span className="ml-1.5 normal-case tracking-normal text-muted-foreground/50">
                    (for the proposal CTA)
                  </span>
                </label>
                <input
                  type="email"
                  value={ctaEmail}
                  onChange={(e) => setCTAEmail(e.target.value)}
                  placeholder="you@tomorrowstudios.io"
                  className="w-full rounded-lg border border-border bg-card px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/40 outline-none focus:border-foreground transition-colors"
                />
              </div>
            </div>

            {error && (
              <div className="rounded-lg border border-red-500/20 bg-red-500/5 px-4 py-3">
                <p className="text-xs text-red-400">{error}</p>
              </div>
            )}

            <div className="flex items-center justify-between pt-2">
              <button
                onClick={() => setStep("context")}
                className="text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                ← Back
              </button>
              <button
                onClick={handleGenerate}
                className="flex items-center gap-2 rounded-full bg-foreground px-5 py-2.5 text-sm font-medium text-background transition-colors hover:bg-foreground/80"
              >
                Generate proposal
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}

        {/* ── Step 3: Generating ── */}
        {step === "generating" && (
          <div className="flex flex-col items-center justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            <p className="mt-6 text-sm text-muted-foreground animate-pulse">
              {loadingMessage}
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

export default WizardPage
