import { useEffect, useState } from "react"
import { Link, useNavigate } from "react-router-dom"
import { ArrowLeft, Trash2, Send, Shield, ShieldOff, LogOut } from "lucide-react"
import { supabase } from "@/lib/supabase"
import { friendlyError } from "@/lib/errors"
import { useAccount } from "@/contexts/AccountContext"

interface Member {
  id: string
  userId: string
  role: string
  displayName?: string
  joinedAt: string
}

interface Invite {
  id: string
  email: string
  role: string
  createdAt: string
  expiresAt: string
}

const TeamMembersPage = () => {
  const { account, isOwner, membership, refreshAccount } = useAccount()
  const navigate = useNavigate()

  const [members, setMembers] = useState<Member[]>([])
  const [invites, setInvites] = useState<Invite[]>([])
  const [inviteEmail, setInviteEmail] = useState("")
  const [inviteRole, setInviteRole] = useState<"member" | "owner">("member")
  const [sending, setSending] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")

  useEffect(() => {
    loadTeam()
  }, [account.id])

  const loadTeam = async () => {
    const { data: membersData } = await supabase
      .from("account_members")
      .select("*")
      .eq("account_id", account.id)
      .order("created_at")

    if (membersData) {
      setMembers(
        membersData.map((m) => ({
          id: m.id,
          userId: m.user_id,
          role: m.role,
          displayName: m.display_name,
          joinedAt: m.joined_at,
        }))
      )
    }

    const { data: invitesData } = await supabase
      .from("account_invites")
      .select("*")
      .eq("account_id", account.id)
      .is("accepted_at", null)
      .order("created_at", { ascending: false })

    if (invitesData) {
      setInvites(
        invitesData.map((i) => ({
          id: i.id,
          email: i.email,
          role: i.role,
          createdAt: i.created_at,
          expiresAt: i.expires_at,
        }))
      )
    }
  }

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setSuccess("")
    setSending(true)

    const { error: invokeError } = await supabase.functions.invoke(
      "invite-member",
      {
        body: {
          accountId: account.id,
          email: inviteEmail.trim(),
          role: inviteRole,
        },
      }
    )

    setSending(false)
    if (invokeError) {
      // supabase.functions.invoke wraps non-2xx responses in FunctionsHttpError.
      // The actual error body is on invokeError.context (a Response object).
      // Parse it so users see a useful message instead of "non-2xx status code".
      let message = invokeError.message
      const ctx = (invokeError as { context?: Response }).context
      if (ctx && typeof ctx.json === "function") {
        try {
          const body = await ctx.json()
          if (body?.error) message = body.error
        } catch {
          // ignore: fall back to generic message
        }
      }
      setError(friendlyError(message))
      return
    }

    setSuccess(`Invite sent to ${inviteEmail}`)
    setInviteEmail("")
    loadTeam()
  }

  const handleRemoveMember = async (memberId: string) => {
    if (!confirm("Remove this team member? They'll lose access to all proposals.")) return
    await supabase.from("account_members").delete().eq("id", memberId)
    loadTeam()
  }

  const handleRevokeInvite = async (inviteId: string) => {
    await supabase.from("account_invites").delete().eq("id", inviteId)
    loadTeam()
  }

  const handleToggleRole = async (member: Member) => {
    const newRole = member.role === "owner" ? "member" : "owner"

    // Prevent demoting if this is the only owner
    if (member.role === "owner" && newRole === "member") {
      const ownerCount = members.filter((m) => m.role === "owner").length
      if (ownerCount <= 1) {
        setError("Cannot remove the last owner. Transfer ownership first.")
        setTimeout(() => setError(""), 3000)
        return
      }
    }

    const isSelf = member.userId === membership.userId
    const action = newRole === "owner" ? "Make owner" : "Remove as owner"
    const warning = isSelf
      ? "You'll become a regular member and lose access to account settings."
      : `${member.displayName || "This member"} will ${newRole === "owner" ? "gain" : "lose"} access to account settings.`

    if (!confirm(`${action}? ${warning}`)) return

    await supabase
      .from("account_members")
      .update({ role: newRole })
      .eq("id", member.id)

    await refreshAccount()
    loadTeam()
  }

  const handleLeaveTeam = async () => {
    if (!confirm(`Leave ${account.studioName}? You'll lose access to all proposals.`)) return

    await supabase
      .from("account_members")
      .delete()
      .eq("id", membership.id)

    navigate("/onboarding")
  }

  return (
    <div className="mx-auto max-w-2xl px-6 py-12">
      <Link
        to="/settings"
        className="mb-8 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft size={16} /> Account settings
      </Link>

      <h1 className="font-serif text-3xl font-light tracking-tight">Team</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Manage who has access to {account.studioName} proposals.
      </p>

      {error && (
        <p className="mt-4 text-sm text-red-600">{error}</p>
      )}

      {/* Members list */}
      <div className="mt-8 space-y-3">
        <h2 className="text-sm font-medium uppercase tracking-wider text-muted-foreground">
          Members
        </h2>
        {members.map((m) => {
          const isSelf = m.userId === membership.userId
          return (
            <div
              key={m.id}
              className="flex items-center justify-between rounded-md border border-border p-4"
            >
              <div>
                <p className="font-medium">
                  {m.displayName || "Unnamed"}
                  {isSelf && (
                    <span className="ml-2 text-xs text-muted-foreground">
                      (you)
                    </span>
                  )}
                </p>
                <p className="text-sm text-muted-foreground capitalize">
                  {m.role}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {/* Role toggle — owners can change other members' roles */}
                {isOwner && !isSelf && (
                  <button
                    onClick={() => handleToggleRole(m)}
                    className="flex items-center gap-1 rounded-md border border-border px-2.5 py-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground hover:border-foreground"
                    title={m.role === "owner" ? "Remove as owner" : "Make owner"}
                  >
                    {m.role === "owner" ? (
                      <><ShieldOff size={12} /> Remove owner</>
                    ) : (
                      <><Shield size={12} /> Make owner</>
                    )}
                  </button>
                )}
                {/* Self role toggle — owner can demote self if there's another owner */}
                {isOwner && isSelf && members.filter(mm => mm.role === "owner").length > 1 && (
                  <button
                    onClick={() => handleToggleRole(m)}
                    className="flex items-center gap-1 rounded-md border border-border px-2.5 py-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground hover:border-foreground"
                    title="Step down as owner"
                  >
                    <ShieldOff size={12} /> Step down
                  </button>
                )}
                {/* Remove member — owners can remove others */}
                {isOwner && !isSelf && (
                  <button
                    onClick={() => handleRemoveMember(m.id)}
                    className="text-muted-foreground hover:text-red-600 transition-colors"
                    title="Remove member"
                  >
                    <Trash2 size={16} />
                  </button>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* Pending invites */}
      {invites.length > 0 && (
        <div className="mt-8 space-y-3">
          <h2 className="text-sm font-medium uppercase tracking-wider text-muted-foreground">
            Pending invites
          </h2>
          {invites.map((i) => (
            <div
              key={i.id}
              className="flex items-center justify-between rounded-md border border-dashed border-border p-4"
            >
              <div>
                <p className="font-medium">{i.email}</p>
                <p className="text-sm text-muted-foreground capitalize">
                  {i.role} · expires{" "}
                  {new Date(i.expiresAt).toLocaleDateString()}
                </p>
              </div>
              {isOwner && (
                <button
                  onClick={() => handleRevokeInvite(i.id)}
                  className="text-muted-foreground hover:text-red-600 transition-colors"
                >
                  <Trash2 size={16} />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Invite form */}
      {isOwner && (
        <form onSubmit={handleInvite} className="mt-8 rounded-lg border border-border p-6">
          <h2 className="text-sm font-medium uppercase tracking-wider text-muted-foreground">
            Invite a team member
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">
            They'll receive an email with a link to join {account.studioName}.
          </p>

          <div className="mt-5 space-y-4">
            <div>
              <label htmlFor="invite-email" className="mb-1 block text-sm font-medium">
                Email address
              </label>
              <input
                id="invite-email"
                type="email"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                placeholder="colleague@example.com"
                required
                className="builder-input w-full"
              />
            </div>

            <div>
              <label htmlFor="invite-role" className="mb-1 block text-sm font-medium">
                Role
              </label>
              <select
                id="invite-role"
                value={inviteRole}
                onChange={(e) =>
                  setInviteRole(e.target.value as "member" | "owner")
                }
                className="builder-input w-full"
              >
                <option value="member">Member (can create and edit proposals)</option>
                <option value="owner">Owner (full access, including account settings)</option>
              </select>
            </div>

            <button
              type="submit"
              disabled={sending || !inviteEmail.trim()}
              className="inline-flex items-center gap-2 rounded-md bg-foreground px-4 py-2.5 text-sm font-medium text-background transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              <Send size={14} />
              {sending ? "Sending…" : "Send invite"}
            </button>
          </div>

          {success && (
            <p className="mt-3 text-sm text-green-600">{success}</p>
          )}
        </form>
      )}

      {/* Leave team — for non-owners */}
      {!isOwner && (
        <div className="mt-12 rounded-lg border border-red-200 bg-red-50/50 p-6">
          <h2 className="text-sm font-semibold text-red-800">Leave team</h2>
          <p className="mt-1 text-sm text-red-700/70">
            You'll lose access to all {account.studioName} proposals.
          </p>
          <button
            onClick={handleLeaveTeam}
            className="mt-4 inline-flex items-center gap-2 rounded-md border border-red-300 px-4 py-2 text-sm font-medium text-red-700 transition-colors hover:bg-red-100"
          >
            <LogOut size={14} />
            Leave {account.studioName}
          </button>
        </div>
      )}
    </div>
  )
}

export default TeamMembersPage
