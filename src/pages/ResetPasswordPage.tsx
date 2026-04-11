import { useState, useEffect } from "react"
import { useNavigate, Link } from "react-router-dom"
import { supabase } from "@/lib/supabase"

const ResetPasswordPage = () => {
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
      if (event === "PASSWORD_RECOVERY") {
        setReady(true)
      }
    })

    // Also check if we already have a session (e.g., if the event fired before this mounted)
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
      setError("Failed to update password. The link may have expired — try requesting a new one.")
      setLoading(false)
      return
    }

    setSuccess(true)
    setLoading(false)

    // Redirect to dashboard after a moment
    setTimeout(() => navigate("/proposals"), 2000)
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm">
        <div className="mb-10 text-center">
          <h1 className="font-display text-3xl font-semibold tracking-tight text-foreground">
            Proposl
          </h1>
        </div>

        {success ? (
          <div className="text-center space-y-3">
            <p className="text-sm text-foreground">Password updated successfully.</p>
            <p className="text-xs text-muted-foreground">Redirecting to your dashboard...</p>
          </div>
        ) : !ready ? (
          <div className="text-center space-y-4">
            <div className="h-4 w-48 mx-auto animate-pulse rounded bg-muted" />
            <p className="text-xs text-muted-foreground">Verifying reset link...</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <p className="text-sm text-muted-foreground mb-2">
              Choose a new password for your account.
            </p>

            <div className="space-y-1.5">
              <label className="text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">
                New password
              </label>
              <input
                type="password"
                required
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full rounded-lg border border-border bg-card px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/40 outline-none focus:border-foreground transition-colors"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">
                Confirm password
              </label>
              <input
                type="password"
                required
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full rounded-lg border border-border bg-card px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/40 outline-none focus:border-foreground transition-colors"
              />
            </div>

            {error && <p className="text-xs text-red-500">{error}</p>}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-full bg-foreground px-6 py-3 text-sm font-medium text-background transition-colors hover:bg-foreground/80 disabled:opacity-50 mt-2"
            >
              {loading ? "Updating..." : "Set new password"}
            </button>

            <p className="text-center">
              <Link to="/login" className="text-sm text-muted-foreground underline hover:text-foreground">
                Back to sign in
              </Link>
            </p>
          </form>
        )}
      </div>
    </div>
  )
}

export default ResetPasswordPage
