/**
 * Invite accept page — /invite/:token
 *
 * Users land here from a team invite email. Either accepts immediately
 * if they're logged in, or prompts them to sign up with the invited email.
 * Styled via AuthLayout in Studio Editorial.
 */

import { useEffect, useState } from "react"
import { useParams, useNavigate, Link } from "react-router-dom"
import { supabase } from "@/lib/supabase"
import { friendlyError } from "@/lib/errors"
import AuthLayout, {
  AuthField,
  AuthInput,
  AuthButton,
} from "@/components/auth/AuthLayout"

interface InviteInfo {
  id: string
  email: string
  role: string
  accountName: string
  accountId: string
  expired: boolean
}

export default function InviteAcceptPage() {
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

      const { data: sessionData } = await supabase.auth.getSession()
      if (!sessionData.session) setNeedsSignup(true)

      setLoading(false)
    }
    loadInvite()
  }, [token])

  const acceptInvite = async (userId: string) => {
    if (!invite) return

    const { error: memberError } = await supabase
      .from("account_members")
      .insert({
        account_id: invite.accountId,
        user_id: userId,
        role: invite.role,
        display_name: name || undefined,
      })

    if (memberError) {
      setError(friendlyError(memberError.message))
      setAccepting(false)
      return
    }

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
      setError(friendlyError(signUpError.message))
      setAccepting(false)
      return
    }

    if (signUpData.user) {
      await acceptInvite(signUpData.user.id)
    }
  }

  // Avoid flashing layout while we fetch the invite
  if (loading) return null

  // Invalid invite
  if (error && !invite) {
    return (
      <AuthLayout
        eyebrow="INVALID INVITE"
        headline="This invite doesn't work."
        subhead={error}
      >
        <Link
          to="/login"
          className="inline-block text-[13px] font-medium transition-colors hover:opacity-70"
          style={{ color: "var(--color-forest)" }}
        >
          Go to sign in ↵
        </Link>
      </AuthLayout>
    )
  }

  // Expired
  if (invite?.expired) {
    return (
      <AuthLayout
        eyebrow="INVITE EXPIRED"
        headline="This invite has expired."
        subhead="Ask your team to send a new one."
      >
        <Link
          to="/login"
          className="inline-block text-[13px] font-medium transition-colors hover:opacity-70"
          style={{ color: "var(--color-forest)" }}
        >
          Go to sign in ↵
        </Link>
      </AuthLayout>
    )
  }

  // Needs signup — create account + accept invite in one flow
  if (needsSignup) {
    return (
      <AuthLayout
        eyebrow="YOU'RE INVITED"
        headline={`Join ${invite?.accountName}.`}
        subhead={`You've been invited as a ${invite?.role}. Set up your account to join the team.`}
      >
        <form onSubmit={handleSignupAndAccept} className="space-y-5">
          <AuthField label="Email">
            <AuthInput
              type="email"
              value={invite?.email || ""}
              disabled
              style={{ opacity: 0.6 }}
            />
          </AuthField>

          <AuthField label="Your name">
            <AuthInput
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Jane Smith"
            />
          </AuthField>

          <AuthField label="Create a password">
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

          <AuthButton type="submit" disabled={accepting}>
            {accepting ? "Joining..." : "Join team"}
          </AuthButton>

          <p className="text-center text-[13px]" style={{ color: "var(--color-ink-soft)" }}>
            Already have an account?{" "}
            <Link
              to="/login"
              className="font-medium transition-colors hover:opacity-70"
              style={{ color: "var(--color-forest)" }}
            >
              Sign in first
            </Link>
          </p>
        </form>
      </AuthLayout>
    )
  }

  // Logged in — single-click accept
  return (
    <AuthLayout
      eyebrow="YOU'RE INVITED"
      headline={`Join ${invite?.accountName}.`}
      subhead={`You've been invited as a ${invite?.role}.`}
    >
      <div className="space-y-5">
        {error && (
          <p className="text-[12px]" style={{ color: "#A33B28" }}>
            {error}
          </p>
        )}
        <AuthButton onClick={handleAcceptLoggedIn} disabled={accepting}>
          {accepting ? "Joining..." : "Accept invitation"}
        </AuthButton>
      </div>
    </AuthLayout>
  )
}
