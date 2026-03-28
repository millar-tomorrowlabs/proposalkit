import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { supabase } from "@/lib/supabase"
import { useAuth } from "@/contexts/AuthContext"
import { friendlyError } from "@/lib/errors"

const OnboardingPage = () => {
  const navigate = useNavigate()
  const { userId, session } = useAuth()

  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  // Step 1: Studio basics
  const [studioName, setStudioName] = useState("")
  const [displayName, setDisplayName] = useState(
    session.user.user_metadata?.display_name || ""
  )
  const [legalEntity, setLegalEntity] = useState("")
  const [website, setWebsite] = useState("")

  // Step 2: Notifications
  const [notifyEmail, setNotifyEmail] = useState(session.user.email || "")
  const [ccEmail, setCcEmail] = useState("")
  const [ctaEmail, setCtaEmail] = useState(session.user.email || "")

  const handleFinish = async () => {
    setError("")
    setLoading(true)

    // Generate account ID client-side so we can insert into both tables
    // without needing .select() (which fails because the SELECT policy
    // requires account_members membership that doesn't exist yet)
    const accountId = crypto.randomUUID()

    // Create account
    const { error: accountError } = await supabase
      .from("accounts")
      .insert({
        id: accountId,
        studio_name: studioName,
        legal_entity: legalEntity || null,
        website: website || null,
        notify_email: notifyEmail,
        cc_email: ccEmail || null,
        sender_name: studioName,
        default_cta_email: ctaEmail || null,
      })

    if (accountError) {
      setError(friendlyError(accountError.message))
      setLoading(false)
      return
    }

    // Add self as owner
    const { error: memberError } = await supabase
      .from("account_members")
      .insert({
        account_id: accountId,
        user_id: userId,
        role: "owner",
        display_name: displayName,
      })

    if (memberError) {
      setError(friendlyError(memberError.message))
      setLoading(false)
      return
    }

    navigate("/proposals")
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center">
          <p className="text-xs font-medium uppercase tracking-[4px] text-muted-foreground">
            Step {step} of 2
          </p>
          <h1 className="mt-2 font-serif text-3xl font-light tracking-tight">
            {step === 1 ? "Set up your studio" : "Notification preferences"}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {step === 1
              ? "Tell us about your agency or studio."
              : "Where should we send proposal notifications?"}
          </p>
        </div>

        {step === 1 && (
          <div className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium">
                Studio / agency name *
              </label>
              <input
                type="text"
                value={studioName}
                onChange={(e) => setStudioName(e.target.value)}
                placeholder="Acme Design Studio"
                required
                className="builder-input w-full"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">
                Your name *
              </label>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Jane Smith"
                required
                className="builder-input w-full"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">
                Legal entity
              </label>
              <input
                type="text"
                value={legalEntity}
                onChange={(e) => setLegalEntity(e.target.value)}
                placeholder="Acme Design Inc."
                className="builder-input w-full"
              />
              <p className="mt-1 text-xs text-muted-foreground">
                Shown in proposal footers. Optional.
              </p>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Website</label>
              <input
                type="text"
                value={website}
                onChange={(e) => setWebsite(e.target.value)}
                placeholder="acmedesign.co"
                className="builder-input w-full"
              />
            </div>

            <button
              onClick={() => {
                if (!studioName.trim() || !displayName.trim()) return
                setStep(2)
              }}
              disabled={!studioName.trim() || !displayName.trim()}
              className="w-full rounded-md bg-foreground px-4 py-3 text-sm font-medium text-background transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              Continue
            </button>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium">
                Notification email *
              </label>
              <input
                type="email"
                value={notifyEmail}
                onChange={(e) => setNotifyEmail(e.target.value)}
                placeholder="team@acmedesign.co"
                required
                className="builder-input w-full"
              />
              <p className="mt-1 text-xs text-muted-foreground">
                Where proposal submissions are sent.
              </p>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">
                CC email
              </label>
              <input
                type="email"
                value={ccEmail}
                onChange={(e) => setCcEmail(e.target.value)}
                placeholder="admin@acmedesign.co"
                className="builder-input w-full"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">
                Default CTA email
              </label>
              <input
                type="email"
                value={ctaEmail}
                onChange={(e) => setCtaEmail(e.target.value)}
                placeholder="hello@acmedesign.co"
                className="builder-input w-full"
              />
              <p className="mt-1 text-xs text-muted-foreground">
                Pre-filled on new proposals. Clients reply here.
              </p>
            </div>

            {error && <p className="text-sm text-red-600">{error}</p>}

            <div className="flex gap-3">
              <button
                onClick={() => setStep(1)}
                className="flex-1 rounded-md border border-border px-4 py-3 text-sm font-medium transition-colors hover:bg-muted/50"
              >
                Back
              </button>
              <button
                onClick={handleFinish}
                disabled={loading || !notifyEmail.trim()}
                className="flex-1 rounded-md bg-foreground px-4 py-3 text-sm font-medium text-background transition-opacity hover:opacity-90 disabled:opacity-50"
              >
                {loading ? "Setting up..." : "Finish setup"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default OnboardingPage
