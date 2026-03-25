import { useState } from "react"
import { ArrowRight, X } from "lucide-react"
import { formatPrice as formatCurrency } from "@/lib/currency"
import type { ConfirmedSelection } from "@/types/proposal"

interface CTASectionProps {
  proposalId: string
  proposalSlug: string
  proposalTitle: string
  ctaEmail: string
  studioName: string
  brandColor1?: string
  brandColor2?: string
  currency?: string
  confirmedSelection: ConfirmedSelection | null
  isPreview?: boolean
}

const CTASection = ({
  proposalId,
  proposalSlug,
  proposalTitle,
  studioName,
  brandColor1,
  brandColor2,
  currency = "USD",
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
  const [error, setError] = useState<string | null>(null)

  const openModal = () => {
    if (isPreview) return
    setShowModal(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim() || !email.trim()) return
    setSubmitting(true)
    setError(null)

    try {
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/submit-proposal`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            proposalId,
            proposalSlug,
            proposalTitle,
            studioName,
            brandColor1,
            brandColor2,
            clientName: name.trim(),
            clientEmail: email.trim(),
            currency,
            packageId: confirmedSelection?.packageId,
            packageLabel: confirmedSelection?.packageLabel,
            packagePrice: confirmedSelection?.packagePrice,
            addOns: confirmedSelection?.addOns,
            retainerHours: confirmedSelection?.retainerHours,
            retainerRate: confirmedSelection?.retainerRate,
            grandTotal: confirmedSelection?.grandTotal,
            message: message.trim() || undefined,
          }),
        }
      )

      if (!res.ok) throw new Error("Request failed")

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
                Confirm package selection and any add-ons
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
              <span className="font-serif text-sm font-medium tracking-tight text-muted-foreground">
                {studioName}
              </span>
              <p className="text-xs text-muted-foreground">
                © {new Date().getFullYear()} Tomorrow Labs Inc. · This proposal is
                confidential and intended solely for the recipient.
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
                  We'll be in touch.
                </h3>
                <p className="mt-3 text-sm text-muted-foreground">
                  Thanks {name.split(" ")[0]}. We've received your submission and will
                  follow up shortly with next steps.
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
                ) : (
                  <div className="rounded-lg border border-dashed border-border bg-card p-4 text-sm text-muted-foreground">
                    No package selected yet — scroll up to confirm your selection, or submit below to get in touch.
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
                  disabled={submitting}
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
