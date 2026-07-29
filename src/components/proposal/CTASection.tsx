import { useState } from "react"
import { ArrowRight, X } from "lucide-react"
import { formatPrice as formatCurrency } from "@/lib/currency"
import type { ConfirmedSelection, SelectionChoice } from "@/types/proposal"

interface CTASectionProps {
  proposalId: string
  proposalSlug: string
  studioName: string
  currency?: string
  /** True when this proposal has an investment section with at least one package. */
  hasInvestment: boolean
  confirmedSelection: ConfirmedSelection | null
  isPreview?: boolean
}

/** What the submit-proposal function returns. Emails can fail after the row saves. */
interface SubmitResponse {
  success?: boolean
  submissionId?: string
  teamEmailSent?: boolean
  clientEmailSent?: boolean
  /** Set on every non-200. Written to be shown to the client as it stands. */
  error?: string
}

const CTASection = ({
  proposalId,
  proposalSlug,
  studioName,
  currency = "USD",
  hasInvestment,
  confirmedSelection,
  isPreview = false,
}: CTASectionProps) => {
  const formatPrice = (n: number) => formatCurrency(n, currency)

  const [showModal, setShowModal] = useState(false)
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [message, setMessage] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [emailFailed, setEmailFailed] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // A proposal with packages needs a confirmed choice before it can be sent.
  const needsSelection = hasInvestment && !confirmedSelection

  const openModal = () => {
    if (isPreview) return
    setShowModal(true)
  }

  const goToInvestment = () => {
    setShowModal(false)
    document.getElementById("investment")?.scrollIntoView({ behavior: "smooth" })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim() || !email.trim() || needsSelection) return
    setSubmitting(true)
    setError(null)

    // Ids and the client's own details only. Every price, label, email and brand
    // value is derived server-side from the proposal row. A proposal with
    // packages cannot reach this line unconfirmed, so what goes out is either a
    // confirmed choice or no choice at all. Never a half made one.
    const selection: SelectionChoice | null = confirmedSelection
      ? {
          packageId: confirmedSelection.packageId,
          addOnIds: confirmedSelection.addOns.map((a) => a.id),
          retainerHours: confirmedSelection.retainerHours,
          postLaunchSelected: confirmedSelection.postLaunchSelected,
        }
      : null

    try {
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/submit-proposal`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            proposalId,
            proposalSlug,
            clientName: name.trim(),
            clientEmail: email.trim(),
            message: message.trim() || undefined,
            confirmed: confirmedSelection !== null,
            selection,
          }),
        }
      )

      const result: SubmitResponse | null = await res.json().catch(() => null)

      if (!res.ok || !result?.success) {
        // The function writes copy for this screen on every outcome the client
        // can act on: a rate limit says to wait, a proposal that is gone says
        // to stop. Answering either with "try again" sends them back to the one
        // thing that cannot work. A 5xx is ours to explain, not theirs.
        const serverMessage = res.status < 500 ? result?.error : null
        setError(serverMessage || "Something went wrong. Please try again.")
        setSubmitting(false)
        return
      }

      // The row can save while an email fails. Say so rather than showing a
      // clean confirmation the client cannot rely on.
      setEmailFailed(result.teamEmailSent === false || result.clientEmailSent === false)
      setSubmitting(false)
      setSubmitted(true)
    } catch {
      setError("Something went wrong. Please try again.")
      setSubmitting(false)
    }
  }

  return (
    <>
      <section id="cta" className="px-6 py-24">
        <div className="mx-auto max-w-3xl text-center">
          <h2 className="scroll-reveal font-display text-5xl font-semibold leading-[1.05] tracking-tight text-foreground md:text-7xl lg:text-8xl">
            Next Steps
          </h2>

          <div className="scroll-reveal delay-100 mx-auto mt-12 max-w-xl text-left">
            <ol className="space-y-4">
              <li className="flex items-start gap-3 text-base text-foreground">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-1 text-xs font-semibold text-white">
                  1
                </span>
                Choose your package and any add-ons, then confirm your selection
              </li>
              <li className="flex items-start gap-3 text-base text-foreground">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-2 text-xs font-semibold text-white">
                  2
                </span>
                Review and sign the Master Services Agreement
              </li>
              <li className="flex items-start gap-3 text-base text-foreground">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-foreground text-xs font-semibold text-background">
                  3
                </span>
                Schedule kickoff to align on workflows, timelines, and responsibilities
              </li>
            </ol>
          </div>

          <div className="scroll-reveal delay-200 mt-10 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
            <button
              onClick={openModal}
              className="inline-flex h-12 items-center gap-2 rounded-full bg-foreground px-8 text-sm font-medium text-background transition-colors hover:bg-foreground/80 disabled:opacity-50"
              disabled={isPreview}
            >
              Let's Go
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>

          <div className="mt-32 border-t border-border pt-8">
            <div className="flex flex-col items-center gap-4">
              {studioName && (
                <span className="font-serif text-sm font-medium tracking-tight text-muted-foreground">
                  {studioName}
                </span>
              )}
              <p className="text-xs text-muted-foreground">
                © {new Date().getFullYear()}
                {studioName ? ` ${studioName} · ` : " "}
                This proposal is confidential and intended solely for the recipient.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Submission modal */}
      {showModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4"
          onClick={(e) => { if (e.target === e.currentTarget) setShowModal(false) }}
        >
          <div className="relative w-full max-w-lg rounded-2xl bg-background border border-border p-8 shadow-2xl">
            <button
              onClick={() => setShowModal(false)}
              className="absolute right-5 top-5 text-muted-foreground hover:text-foreground transition-colors"
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </button>

            {submitted ? (
              /* Success state */
              <div className="py-6 text-center">
                <div className="mx-auto mb-5 flex h-12 w-12 items-center justify-center rounded-full bg-brand-1">
                  <ArrowRight className="h-5 w-5 text-white" />
                </div>
                <h3 className="font-display text-2xl font-semibold text-foreground">
                  {emailFailed ? "Saved." : "We'll be in touch."}
                </h3>
                <p className="mt-3 text-sm text-muted-foreground">
                  {emailFailed ? (
                    <>
                      Thanks {name.split(" ")[0]}. We could not email your copy, but we
                      have your submission and will follow up shortly.
                    </>
                  ) : (
                    <>
                      Thanks {name.split(" ")[0]}. We've received your submission and will
                      follow up shortly with next steps.
                    </>
                  )}
                </p>
              </div>
            ) : (
              /* Form */
              <form onSubmit={handleSubmit} className="space-y-5">
                <div>
                  <h3 className="font-display text-xl font-semibold text-foreground">
                    Let's get started
                  </h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    We'll reach out to confirm details and send over next steps.
                  </p>
                </div>

                {/* Selection summary */}
                {confirmedSelection ? (
                  <div className="rounded-lg border border-border bg-card p-4 text-sm space-y-1.5">
                    <p className="font-medium text-foreground">{confirmedSelection.packageLabel}</p>
                    {confirmedSelection.addOns.map((a) => (
                      <p key={a.id} className="text-muted-foreground">+ {a.label}</p>
                    ))}
                    <div className="border-t border-border pt-2 mt-2 flex justify-between">
                      <span className="text-muted-foreground">Total</span>
                      <span className="font-semibold text-foreground">
                        {formatPrice(confirmedSelection.grandTotal)}
                      </span>
                    </div>
                    {confirmedSelection.retainerHours && confirmedSelection.retainerRate && (
                      <p className="text-xs text-muted-foreground">
                        + {confirmedSelection.retainerHours} hrs/mo retainer (
                        {formatPrice(confirmedSelection.retainerHours * confirmedSelection.retainerRate)}/mo)
                      </p>
                    )}
                  </div>
                ) : needsSelection ? (
                  /* Blocking state. A proposal with packages needs a choice first. */
                  <div className="rounded-lg border border-border bg-card p-4 text-sm space-y-3">
                    <p className="text-muted-foreground">
                      Pick a package before you send this. Confirm the one you want and it
                      will appear here.
                    </p>
                    <button
                      type="button"
                      onClick={goToInvestment}
                      className="w-full rounded-full border border-foreground px-6 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-foreground hover:text-background"
                    >
                      Choose your package
                    </button>
                  </div>
                ) : (
                  <div className="rounded-lg border border-dashed border-border bg-card p-4 text-sm text-muted-foreground">
                    No package selected yet. Scroll up to confirm your selection, or submit below to get in touch.
                  </div>
                )}

                {/* Name */}
                <div className="space-y-1.5">
                  <label className="text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">
                    Your name
                  </label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Jane Smith"
                    className="w-full rounded-lg border border-border bg-card px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/50 outline-none focus:border-foreground transition-colors"
                  />
                </div>

                {/* Email */}
                <div className="space-y-1.5">
                  <label className="text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">
                    Email
                  </label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="jane@company.com"
                    className="w-full rounded-lg border border-border bg-card px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/50 outline-none focus:border-foreground transition-colors"
                  />
                </div>

                {/* Message */}
                <div className="space-y-1.5">
                  <label className="text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">
                    Message{" "}
                    <span className="normal-case tracking-normal font-normal text-muted-foreground/60">
                      (optional)
                    </span>
                  </label>
                  <textarea
                    rows={3}
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="Any questions or context before we kick off?"
                    className="w-full rounded-lg border border-border bg-card px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/50 outline-none focus:border-foreground transition-colors resize-none"
                  />
                </div>

                {error && (
                  <p className="text-xs text-red-500">{error}</p>
                )}

                <button
                  type="submit"
                  disabled={submitting || needsSelection}
                  className="w-full rounded-full bg-foreground px-6 py-3 text-sm font-medium text-background transition-colors hover:bg-foreground/80 disabled:opacity-50"
                >
                  {submitting ? "Submitting…" : "Submit"}
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  )
}

export default CTASection
