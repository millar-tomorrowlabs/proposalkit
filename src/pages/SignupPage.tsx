/**
 * Signup page — /signup
 *
 * Studio Editorial styled via AuthLayout.
 */

import { useState } from "react"
import { useNavigate, Link } from "react-router-dom"
import { supabase } from "@/lib/supabase"
import { friendlyError } from "@/lib/errors"
import AuthLayout, {
  AuthField,
  AuthInput,
  AuthButton,
} from "@/components/auth/AuthLayout"

export default function SignupPage() {
  const navigate = useNavigate()
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const [emailSent, setEmailSent] = useState(false)

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
      // Auto-confirmed, redirect to onboarding
      navigate("/onboarding")
    } else {
      // Email confirmation required
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
        subhead={`We sent a confirmation link to ${email}. Click it to verify your account and get started.`}
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
      eyebrow="START FREE"
      headline="Create your Proposl account."
      subhead="Free while in beta. No credit card. Takes about a minute."
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
