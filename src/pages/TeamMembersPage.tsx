import { useEffect, useState } from "react"
import { Link } from "react-router-dom"
import { ArrowLeft, Trash2, Send } from "lucide-react"
import { supabase } from "@/lib/supabase"
import { useAccount } from "@/contexts/AccountContext"

interface Member {
  id: string
  userId: string
  role: string
  displayName?: string
  joinedAt: string
  email?: string
}

interface Invite {
  id: string
  email: string
  role: string
  createdAt: string
  expiresAt: string
}

const TeamMembersPage = () => {
  const { account, isOwner, membership } = useAccount()

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
      setError(invokeError.message || "Failed to send invite")
      return
    }

    setSuccess(`Invite sent to ${inviteEmail}`)
    setInviteEmail("")
    loadTeam()
  }

  const handleRemoveMember = async (memberId: string) => {
    if (!confirm("Remove this team member?")) return
    await supabase.from("account_members").delete().eq("id", memberId)
    loadTeam()
  }

  const handleRevokeInvite = async (inviteId: string) => {
    await supabase.from("account_invites").delete().eq("id", inviteId)
    loadTeam()
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

      {/* Members list */}
      <div className="mt-8 space-y-3">
        <h2 className="text-sm font-medium uppercase tracking-wider text-muted-foreground">
          Members
        </h2>
        {members.map((m) => (
          <div
            key={m.id}
            className="flex items-center justify-between rounded-md border border-border p-4"
          >
            <div>
              <p className="font-medium">
                {m.displayName || "Unnamed"}
                {m.userId === membership.userId && (
                  <span className="ml-2 text-xs text-muted-foreground">
                    (you)
                  </span>
                )}
              </p>
              <p className="text-sm text-muted-foreground capitalize">
                {m.role}
              </p>
            </div>
            {isOwner && m.userId !== membership.userId && (
              <button
                onClick={() => handleRemoveMember(m.id)}
                className="text-muted-foreground hover:text-red-600 transition-colors"
              >
                <Trash2 size={16} />
              </button>
            )}
          </div>
        ))}
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
        <form onSubmit={handleInvite} className="mt-8 space-y-4">
          <h2 className="text-sm font-medium uppercase tracking-wider text-muted-foreground">
            Invite a team member
          </h2>
          <div className="flex gap-3">
            <input
              type="email"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              placeholder="colleague@example.com"
              required
              className="builder-input flex-1"
            />
            <select
              value={inviteRole}
              onChange={(e) =>
                setInviteRole(e.target.value as "member" | "owner")
              }
              className="builder-input w-32"
            >
              <option value="member">Member</option>
              <option value="owner">Owner</option>
            </select>
            <button
              type="submit"
              disabled={sending}
              className="inline-flex items-center gap-2 rounded-md bg-foreground px-4 py-2.5 text-sm font-medium text-background transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              <Send size={14} />
              {sending ? "Sending..." : "Invite"}
            </button>
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          {success && (
            <p className="text-sm text-green-600">{success}</p>
          )}
        </form>
      )}
    </div>
  )
}

export default TeamMembersPage
