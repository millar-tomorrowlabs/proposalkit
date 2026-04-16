/**
 * Signup page — /signup
 *
 * Invite-only during beta. Requires ?invite=CODE in the URL. Without a
 * code we redirect to the landing page, which has the waitlist form.
 *
 * The code is validated server-side at the *onboarding* step (via the
 * accept-invite edge function) to prevent client-side spoofing. Here we
 * just gate the UI and pass the code through to /onboarding so the user
 * can complete their account.
 *
 * Studio Editorial styled via AuthLayout.
 */

import { useEffect, useState } from "react"
import { useNavigate, Link, useSearchParams, Navigate } from "react-router-dom"
import { supabase } from "@/lib/supabase"
import { friendlyError } from "@/lib/errors"
import AuthLayout, {
  AuthField,
  AuthInput,
  AuthButton,
} from "@/components/auth/AuthLayout"

export default function SignupPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const inviteCode = (searchParams.get("invite") ?? "").trim().toUpperCase()

  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const [emailSent, setEmailSent] = useState(false)

  // Redirect to waitlist if no invite code present. A short format check
  // avoids sending obvious junk to the auth endpoint.
  useEffect(() => {
    if (!inviteCode || inviteCode.length < 6) return
  }, [inviteCode])

  if (!inviteCode || inviteCode.length < 6) {
    return <Navigate to="/" replace />
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setLoading(true)

    const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { display_name: name } },
    })

    if (signUpError) {
      setError(friendlyError(signUpError.message))
      setLoading(false)
      return
    }

    if (signUpData?.user?.identities?.length === 0) {
      setError("An account with this email already exists.")
      setLoading(false)
      return
    }

    if (signUpData?.session) {
      // Auto-confirmed, hand the invite code off to onboarding.
      navigate(`/onboarding?invite=${inviteCode}`)
    } else {
      setEmailSent(true)
      setLoading(false)
    }
  }

  // ── Post-signup confirmation screen ──────────────────────────────────────
  if (emailSent) {
    return (
      <AuthLayout
        eyebrow="CHECK YOUR EMAIL"
        headline="Confirm your account."
        subhead={`We sent a confirmation link to ${email}. Click it to verify your account, then you'll be guided through studio setup.`}
        topLinkLabel="Sign in"
        topLinkTo="/login"
      >
        <Link
          to="/login"
          className="inline-block text-[13px] font-medium transition-colors hover:opacity-70"
          style={{ color: "var(--color-forest)" }}
        >
          Back to sign in ↵
        </Link>
      </AuthLayout>
    )
  }

  // ── Signup form ─────────────────────────────────────────────────────────
  return (
    <AuthLayout
      eyebrow={`INVITE ${inviteCode}`}
      headline="Claim your account."
      subhead="Your invite is valid for 30 days. Create your login, then we'll set up your studio."
      topLinkLabel="Sign in"
      topLinkTo="/login"
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        <AuthField label="Your name">
          <AuthInput
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Jane Smith"
          />
        </AuthField>

        <AuthField label="Email">
          <AuthInput
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
          />
        </AuthField>
        <p
          className="-mt-3 text-[11px] uppercase tracking-[0.12em]"
          style={{ fontFamily: "var(--font-mono)", color: "var(--color-ink-mute)" }}
        >
          USE THE EMAIL YOUR INVITE WAS SENT TO
        </p>

        <AuthField label="Password">
          <AuthInput
            type="password"
            required
            minLength={6}
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="At least 6 characters"
          />
        </AuthField>

        {error && (
          <p className="text-[12px]" style={{ color: "#A33B28" }}>
            {error}
          </p>
        )}

        <AuthButton type="submit" disabled={loading}>
          {loading ? "Creating account..." : "Create account"}
        </AuthButton>

        <p
          className="text-center text-[13px]"
          style={{ color: "var(--color-ink-soft)" }}
        >
          Already have an account?{" "}
          <Link
            to="/login"
            className="font-medium transition-colors hover:opacity-70"
            style={{ color: "var(--color-forest)" }}
          >
            Sign in
          </Link>
        </p>
      </form>
    </AuthLayout>
  )
}
