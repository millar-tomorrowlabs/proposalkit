import { useEffect, useState } from "react"
import { useParams, useNavigate, Link } from "react-router-dom"
import { supabase } from "@/lib/supabase"

interface InviteInfo {
  id: string
  email: string
  role: string
  accountName: string
  accountId: string
  expired: boolean
}

const InviteAcceptPage = () => {
  const { token } = useParams<{ token: string }>()
  const navigate = useNavigate()

  const [invite, setInvite] = useState<InviteInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [accepting, setAccepting] = useState(false)

  // Signup form (for users without an account)
  const [name, setName] = useState("")
  const [password, setPassword] = useState("")
  const [needsSignup, setNeedsSignup] = useState(false)

  useEffect(() => {
    loadInvite()
  }, [token])

  const loadInvite = async () => {
    if (!token) {
      setError("Invalid invite link")
      setLoading(false)
      return
    }

    const { data, error: fetchError } = await supabase
      .from("account_invites")
      .select("*, accounts(studio_name)")
      .eq("token", token)
      .is("accepted_at", null)
      .maybeSingle()

    if (fetchError || !data) {
      setError("This invite link is invalid or has already been used.")
      setLoading(false)
      return
    }

    const expired = new Date(data.expires_at) < new Date()
    const accountRow = data.accounts as { studio_name: string } | null

    setInvite({
      id: data.id,
      email: data.email,
      role: data.role,
      accountName: accountRow?.studio_name || "Unknown",
      accountId: data.account_id,
      expired,
    })

    // Check if user is already logged in
    const { data: sessionData } = await supabase.auth.getSession()
    if (!sessionData.session) {
      setNeedsSignup(true)
    }

    setLoading(false)
  }

  const acceptInvite = async (userId: string) => {
    if (!invite) return

    // Create membership
    const { error: memberError } = await supabase
      .from("account_members")
      .insert({
        account_id: invite.accountId,
        user_id: userId,
        role: invite.role,
        display_name: name || undefined,
      })

    if (memberError) {
      setError(memberError.message)
      setAccepting(false)
      return
    }

    // Mark invite as accepted
    await supabase
      .from("account_invites")
      .update({ accepted_at: new Date().toISOString() })
      .eq("id", invite.id)

    navigate("/proposals")
  }

  const handleAcceptLoggedIn = async () => {
    setAccepting(true)
    const { data: sessionData } = await supabase.auth.getSession()
    if (!sessionData.session) {
      setNeedsSignup(true)
      setAccepting(false)
      return
    }
    await acceptInvite(sessionData.session.user.id)
  }

  const handleSignupAndAccept = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!invite) return
    setError("")
    setAccepting(true)

    const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
      email: invite.email,
      password,
      options: { data: { display_name: name } },
    })

    if (signUpError) {
      setError(signUpError.message)
      setAccepting(false)
      return
    }

    if (signUpData.user) {
      await acceptInvite(signUpData.user.id)
    }
  }

  if (loading) return null

  if (error && !invite) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <div className="text-center space-y-4">
          <h1 className="font-serif text-2xl">Invalid invite</h1>
          <p className="text-muted-foreground">{error}</p>
          <Link to="/login" className="text-sm underline hover:text-foreground">
            Go to login
          </Link>
        </div>
      </div>
    )
  }

  if (invite?.expired) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <div className="text-center space-y-4">
          <h1 className="font-serif text-2xl">Invite expired</h1>
          <p className="text-muted-foreground">
            This invite has expired. Ask your team to send a new one.
          </p>
          <Link to="/login" className="text-sm underline hover:text-foreground">
            Go to login
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm space-y-8">
        <div className="text-center">
          <p className="text-xs font-medium uppercase tracking-[4px] text-muted-foreground">
            You're invited
          </p>
          <h1 className="mt-2 font-serif text-3xl font-light tracking-tight">
            Join {invite?.accountName}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            You've been invited as a {invite?.role}.
          </p>
        </div>

        {needsSignup ? (
          <form onSubmit={handleSignupAndAccept} className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium">Email</label>
              <input
                type="email"
                value={invite?.email || ""}
                disabled
                className="builder-input w-full opacity-60"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">
                Your name
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Jane Smith"
                required
                className="builder-input w-full"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">
                Create a password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 6 characters"
                required
                minLength={6}
                className="builder-input w-full"
              />
            </div>

            {error && <p className="text-sm text-red-600">{error}</p>}

            <button
              type="submit"
              disabled={accepting}
              className="w-full rounded-md bg-foreground px-4 py-3 text-sm font-medium text-background transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {accepting ? "Joining..." : "Join team"}
            </button>

            <p className="text-center text-sm text-muted-foreground">
              Already have an account?{" "}
              <Link to="/login" className="underline hover:text-foreground">
                Sign in first
              </Link>
            </p>
          </form>
        ) : (
          <div className="space-y-4">
            {error && <p className="text-sm text-red-600">{error}</p>}
            <button
              onClick={handleAcceptLoggedIn}
              disabled={accepting}
              className="w-full rounded-md bg-foreground px-4 py-3 text-sm font-medium text-background transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {accepting ? "Joining..." : "Accept invitation"}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

export default InviteAcceptPage
