/**
 * Login page — /login
 *
 * Studio Editorial styled via AuthLayout. Also handles the "Forgot password"
 * flow inline (flip a flag, same page).
 */

import { useState } from "react"
import { useNavigate, Link } from "react-router-dom"
import { supabase } from "@/lib/supabase"
import AuthLayout, {
  AuthField,
  AuthInput,
  AuthButton,
} from "@/components/auth/AuthLayout"

export default function LoginPage() {
  const navigate = useNavigate()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [forgotMode, setForgotMode] = useState(false)
  const [resetSent, setResetSent] = useState(false)

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    const { error: authError } = await supabase.auth.signInWithPassword({ email, password })
    if (authError) {
      setError("Incorrect email or password.")
      setLoading(false)
      return
    }
    navigate("/proposals")
  }

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    })
    if (resetError) {
      setError("Something went wrong. Please try again.")
      setLoading(false)
      return
    }
    setResetSent(true)
    setLoading(false)
  }

  // ── Reset sent confirmation ──────────────────────────────────────────────
  if (forgotMode && resetSent) {
    return (
      <AuthLayout
        eyebrow="CHECK YOUR EMAIL"
        headline="We sent you a reset link."
        subhead={`A password reset link is on its way to ${email}. It may take a minute to arrive.`}
        topLinkLabel="Back to sign in"
        topLinkTo="/login"
      >
        <button
          onClick={() => {
            setForgotMode(false)
            setResetSent(false)
            setError(null)
          }}
          className="text-[13px] font-medium transition-colors hover:opacity-70"
          style={{ color: "var(--color-forest)" }}
        >
          Back to sign in ↵
        </button>
      </AuthLayout>
    )
  }

  // ── Forgot password form ────────────────────────────────────────────────
  if (forgotMode) {
    return (
      <AuthLayout
        eyebrow="FORGOT PASSWORD"
        headline="Send me a reset link."
        subhead="Enter the email on your account and we'll send a link to reset your password."
        topLinkLabel="Sign up"
        topLinkTo="/signup"
      >
        <form onSubmit={handleForgotPassword} className="space-y-5">
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

          {error && (
            <p className="text-[12px]" style={{ color: "#A33B28" }}>
              {error}
            </p>
          )}

          <AuthButton type="submit" disabled={loading}>
            {loading ? "Sending..." : "Send reset link"}
          </AuthButton>

          <button
            type="button"
            onClick={() => {
              setForgotMode(false)
              setError(null)
            }}
            className="w-full text-[12px] transition-colors hover:opacity-70"
            style={{ color: "var(--color-ink-mute)" }}
          >
            Back to sign in
          </button>
        </form>
      </AuthLayout>
    )
  }

  // ── Default: sign in form ───────────────────────────────────────────────
  return (
    <AuthLayout
      eyebrow="WELCOME BACK"
      headline="Sign in to Proposl."
      topLinkLabel="Sign up"
      topLinkTo="/signup"
    >
      <form onSubmit={handleSignIn} className="space-y-5">
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
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
          />
        </AuthField>

        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => {
              setForgotMode(true)
              setError(null)
            }}
            className="text-[12px] transition-colors hover:opacity-70"
            style={{ color: "var(--color-ink-mute)" }}
          >
            Forgot password?
          </button>
        </div>

        {error && (
          <p className="text-[12px]" style={{ color: "#A33B28" }}>
            {error}
          </p>
        )}

        <AuthButton type="submit" disabled={loading}>
          {loading ? "Signing in..." : "Sign in"}
        </AuthButton>

        <p
          className="text-center text-[13px]"
          style={{ color: "var(--color-ink-soft)" }}
        >
          New here?{" "}
          <Link
            to="/signup"
            className="font-medium transition-colors hover:opacity-70"
            style={{ color: "var(--color-forest)" }}
          >
            Create an account
          </Link>
        </p>
      </form>
    </AuthLayout>
  )
}
