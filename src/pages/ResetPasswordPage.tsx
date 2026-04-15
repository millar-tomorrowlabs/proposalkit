/**
 * Reset password page — /reset-password
 *
 * Users land here from the reset link in the password reset email.
 * Studio Editorial styled via AuthLayout.
 */

import { useState, useEffect } from "react"
import { useNavigate, Link } from "react-router-dom"
import { supabase } from "@/lib/supabase"
import AuthLayout, {
  AuthField,
  AuthInput,
  AuthButton,
} from "@/components/auth/AuthLayout"

export default function ResetPasswordPage() {
  const navigate = useNavigate()
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [ready, setReady] = useState(false)

  // Wait for Supabase to pick up the recovery token from the URL hash
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") setReady(true)
    })
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setReady(true)
    })
    return () => subscription.unsubscribe()
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (password.length < 6) {
      setError("Password must be at least 6 characters.")
      return
    }
    if (password !== confirmPassword) {
      setError("Passwords don't match.")
      return
    }

    setLoading(true)
    const { error: updateError } = await supabase.auth.updateUser({ password })
    if (updateError) {
      setError("Failed to update password. The link may have expired. Try requesting a new one.")
      setLoading(false)
      return
    }
    setSuccess(true)
    setLoading(false)
    setTimeout(() => navigate("/proposals"), 2000)
  }

  // ── Success screen ──────────────────────────────────────────────────────
  if (success) {
    return (
      <AuthLayout
        eyebrow="DONE"
        headline="Password updated."
        subhead="Taking you to your proposals in a moment..."
      >
        <p
          className="text-[11px] uppercase tracking-[0.14em]"
          style={{ fontFamily: "var(--font-mono)", color: "var(--color-forest)" }}
        >
          REDIRECTING...
        </p>
      </AuthLayout>
    )
  }

  // ── Loading/verifying screen ────────────────────────────────────────────
  if (!ready) {
    return (
      <AuthLayout
        eyebrow="VERIFYING"
        headline="Checking your reset link."
        subhead="This should only take a second."
      >
        <p
          className="text-[11px] uppercase tracking-[0.14em]"
          style={{ fontFamily: "var(--font-mono)", color: "var(--color-ink-mute)" }}
        >
          VERIFYING...
        </p>
      </AuthLayout>
    )
  }

  // ── Default: set new password form ─────────────────────────────────────
  return (
    <AuthLayout
      eyebrow="NEW PASSWORD"
      headline="Set a new password."
      subhead="Choose something you'll remember. At least 6 characters."
      topLinkLabel="Back to sign in"
      topLinkTo="/login"
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        <AuthField label="New password">
          <AuthInput
            type="password"
            required
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
          />
        </AuthField>

        <AuthField label="Confirm password">
          <AuthInput
            type="password"
            required
            autoComplete="new-password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="••••••••"
          />
        </AuthField>

        {error && (
          <p className="text-[12px]" style={{ color: "#A33B28" }}>
            {error}
          </p>
        )}

        <AuthButton type="submit" disabled={loading}>
          {loading ? "Updating..." : "Set new password"}
        </AuthButton>

        <p className="text-center text-[13px]" style={{ color: "var(--color-ink-soft)" }}>
          Remembered it?{" "}
          <Link
            to="/login"
            className="font-medium transition-colors hover:opacity-70"
            style={{ color: "var(--color-forest)" }}
          >
            Back to sign in
          </Link>
        </p>
      </form>
    </AuthLayout>
  )
}
