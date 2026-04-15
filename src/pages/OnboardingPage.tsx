/**
 * Onboarding page — /onboarding
 *
 * Post-signup 2-step flow: studio basics, then notification preferences.
 * Creates the account + membership row on finish, then redirects to
 * /proposals. Styled via AuthLayout in Studio Editorial.
 */

import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { supabase } from "@/lib/supabase"
import { useAuth } from "@/contexts/AuthContext"
import { friendlyError } from "@/lib/errors"
import AuthLayout, {
  AuthField,
  AuthInput,
  AuthButton,
} from "@/components/auth/AuthLayout"

export default function OnboardingPage() {
  const navigate = useNavigate()
  const { userId, session } = useAuth()

  const [step, setStep] = useState<1 | 2>(1)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  // Step 1: Studio basics
  const [studioName, setStudioName] = useState("")
  const [displayName, setDisplayName] = useState(
    session.user.user_metadata?.display_name || "",
  )
  const [legalEntity, setLegalEntity] = useState("")
  const [website, setWebsite] = useState("")

  // Step 2: Notifications
  const [notifyEmail, setNotifyEmail] = useState(session.user.email || "")
  const [ccEmail, setCcEmail] = useState("")
  const [ctaEmail, setCtaEmail] = useState(session.user.email || "")

  const handleContinue = () => {
    if (!studioName.trim() || !displayName.trim()) return
    setStep(2)
  }

  const handleFinish = async () => {
    setError("")
    setLoading(true)

    // Generate account ID client-side so we can insert into both tables
    // without needing .select() (which fails because the SELECT policy
    // requires account_members membership that doesn't exist yet)
    const accountId = crypto.randomUUID()

    const { error: accountError } = await supabase.from("accounts").insert({
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

  // ── Step 1: Studio basics ──────────────────────────────────────────────
  if (step === 1) {
    return (
      <AuthLayout
        eyebrow="STEP 01 OF 02"
        headline="Set up your studio."
        subhead="Tell us the basics. You can change any of this later."
      >
        <form
          onSubmit={(e) => {
            e.preventDefault()
            handleContinue()
          }}
          className="space-y-5"
        >
          <AuthField label="Studio or agency name">
            <AuthInput
              type="text"
              required
              value={studioName}
              onChange={(e) => setStudioName(e.target.value)}
              placeholder="Acme Design Studio"
            />
          </AuthField>

          <AuthField label="Your name">
            <AuthInput
              type="text"
              required
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Jane Smith"
            />
          </AuthField>

          <div>
            <AuthField label="Legal entity (optional)">
              <AuthInput
                type="text"
                value={legalEntity}
                onChange={(e) => setLegalEntity(e.target.value)}
                placeholder="Acme Design Inc."
              />
            </AuthField>
            <p
              className="mt-1.5 text-[11px] uppercase tracking-[0.12em]"
              style={{
                fontFamily: "var(--font-mono)",
                color: "var(--color-ink-mute)",
              }}
            >
              SHOWN IN PROPOSAL FOOTERS
            </p>
          </div>

          <AuthField label="Website (optional)">
            <AuthInput
              type="text"
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
              placeholder="acmedesign.co"
            />
          </AuthField>

          <AuthButton type="submit" disabled={!studioName.trim() || !displayName.trim()}>
            Continue →
          </AuthButton>
        </form>
      </AuthLayout>
    )
  }

  // ── Step 2: Notification preferences ──────────────────────────────────
  return (
    <AuthLayout
      eyebrow="STEP 02 OF 02"
      headline="Where should we send notifications?"
      subhead="When a client submits a proposal, this is where we send the alert."
    >
      <div className="space-y-5">
        <div>
          <AuthField label="Notification email">
            <AuthInput
              type="email"
              required
              value={notifyEmail}
              onChange={(e) => setNotifyEmail(e.target.value)}
              placeholder="team@acmedesign.co"
            />
          </AuthField>
          <p
            className="mt-1.5 text-[11px] uppercase tracking-[0.12em]"
            style={{
              fontFamily: "var(--font-mono)",
              color: "var(--color-ink-mute)",
            }}
          >
            WHERE SUBMISSIONS ARE SENT
          </p>
        </div>

        <AuthField label="CC email (optional)">
          <AuthInput
            type="email"
            value={ccEmail}
            onChange={(e) => setCcEmail(e.target.value)}
            placeholder="admin@acmedesign.co"
          />
        </AuthField>

        <div>
          <AuthField label="Default CTA email (optional)">
            <AuthInput
              type="email"
              value={ctaEmail}
              onChange={(e) => setCtaEmail(e.target.value)}
              placeholder="hello@acmedesign.co"
            />
          </AuthField>
          <p
            className="mt-1.5 text-[11px] uppercase tracking-[0.12em]"
            style={{
              fontFamily: "var(--font-mono)",
              color: "var(--color-ink-mute)",
            }}
          >
            PRE-FILLED ON NEW PROPOSALS. CLIENTS REPLY HERE.
          </p>
        </div>

        {error && (
          <p className="text-[12px]" style={{ color: "#A33B28" }}>
            {error}
          </p>
        )}

        <div className="flex gap-3">
          <button
            onClick={() => setStep(1)}
            className="flex-1 rounded-full border px-5 py-3.5 text-[14px] font-medium transition-colors hover:opacity-80"
            style={{
              borderColor: "var(--color-rule)",
              color: "var(--color-ink-soft)",
            }}
          >
            ← Back
          </button>
          <div className="flex-1">
            <AuthButton
              onClick={handleFinish}
              disabled={loading || !notifyEmail.trim()}
            >
              {loading ? "Setting up..." : "Finish setup"}
            </AuthButton>
          </div>
        </div>
      </div>
    </AuthLayout>
  )
}
