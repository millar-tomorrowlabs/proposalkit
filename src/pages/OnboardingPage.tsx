/**
 * Onboarding page — /onboarding
 *
 * Post-signup 2-step flow: studio basics, then notification preferences.
 * During invite-only beta, an invite code is required. On finish we call
 * the accept-invite edge function (which validates the code server-side
 * and creates the account/membership with the F&F plan).
 *
 * The invite code can come from:
 *   - The ?invite= query string (passed through from /signup)
 *   - A field the user fills in here if they navigated directly
 */

import { useState } from "react"
import { useNavigate, useSearchParams } from "react-router-dom"
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
  const { session } = useAuth()
  const [searchParams] = useSearchParams()
  const codeFromUrl = (searchParams.get("invite") ?? "").trim().toUpperCase()

  const [step, setStep] = useState<1 | 2>(1)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  // Step 1: Studio basics
  const [inviteCode, setInviteCode] = useState(codeFromUrl)
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
    if (!inviteCode.trim() || !studioName.trim() || !displayName.trim()) return
    setStep(2)
  }

  const handleFinish = async () => {
    setError("")
    setLoading(true)

    // Call the edge function that validates the invite code, creates the
    // account with the F&F plan + limits, and links the waitlist row. All
    // of this runs under service-role server-side so clients can't bypass.
    const { data, error: fnError } = await supabase.functions.invoke(
      "accept-invite",
      {
        body: {
          code: inviteCode.trim().toUpperCase(),
          studioName,
          displayName,
          legalEntity: legalEntity || undefined,
          website: website || undefined,
          notifyEmail,
          ccEmail: ccEmail || undefined,
          ctaEmail: ctaEmail || undefined,
        },
      },
    )

    if (fnError) {
      // supabase-js wraps non-2xx responses with a generic message. The
      // real, user-facing error is inside fnError.context as an HTTP
      // Response; dig it out so users get "This invite was already used"
      // instead of "Edge Function returned a non-2xx status code".
      let message = fnError.message
      const ctx = (fnError as { context?: Response }).context
      if (ctx && typeof ctx.json === "function") {
        try {
          const body = await ctx.json()
          if (body?.error) message = body.error
        } catch {
          // fall through to the friendlyError fallback
        }
      }
      setError(friendlyError(message))
      setLoading(false)
      return
    }
    if (data?.error) {
      setError(friendlyError(data.error))
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
          {!codeFromUrl && (
            <div>
              <AuthField label="Invite code">
                <AuthInput
                  type="text"
                  required
                  value={inviteCode}
                  onChange={(e) =>
                    setInviteCode(e.target.value.trim().toUpperCase())
                  }
                  placeholder="PASTE YOUR CODE"
                />
              </AuthField>
              <p
                className="mt-1.5 text-[11px] uppercase tracking-[0.12em]"
                style={{
                  fontFamily: "var(--font-mono)",
                  color: "var(--color-ink-mute)",
                }}
              >
                BETA IS INVITE-ONLY. CHECK YOUR INVITE EMAIL FOR THE CODE.
              </p>
            </div>
          )}

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

          <AuthField label="Website">
            <AuthInput
              type="text"
              required
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
              placeholder="acmedesign.co"
            />
          </AuthField>

          <AuthButton
            type="submit"
            disabled={
              !inviteCode.trim() ||
              !studioName.trim() ||
              !displayName.trim() ||
              !website.trim()
            }
          >
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
