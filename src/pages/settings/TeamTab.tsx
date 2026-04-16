/**
 * Team members tab — /settings/team
 *
 * Studio Editorial styling. Members, pending invites, invite form.
 */

import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
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

const labelClass = "mb-1.5 block text-[10px] uppercase tracking-[0.12em]"
const labelStyle = { fontFamily: "var(--font-mono)", color: "var(--color-ink-mute)" }
const inputClass = "w-full rounded-lg border bg-white/50 px-3 py-2.5 text-[14px] outline-none focus:ring-1"
const inputStyle = { borderColor: "var(--color-rule)", color: "var(--color-ink)" }

export default function TeamTab() {
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

    const { error: invokeError } = await supabase.functions.invoke("invite-member", {
      body: {
        accountId: account.id,
        email: inviteEmail.trim(),
        role: inviteRole,
      },
    })

    setSending(false)
    if (invokeError) {
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

  const handleResendInvite = async (invite: Invite) => {
    setError("")
    setSuccess("")
    // Re-invoke invite-member with same email/role to generate a fresh invite
    const { error: invokeError } = await supabase.functions.invoke("invite-member", {
      body: {
        accountId: account.id,
        email: invite.email,
        role: invite.role,
      },
    })
    if (invokeError) {
      let message = invokeError.message
      const ctx = (invokeError as { context?: Response }).context
      if (ctx && typeof ctx.json === "function") {
        try {
          const body = await ctx.json()
          if (body?.error) message = body.error
        } catch {
          // ignore
        }
      }
      setError(friendlyError(message))
      return
    }
    setSuccess(`Invite resent to ${invite.email}`)
    loadTeam()
  }

  const handleToggleRole = async (member: Member) => {
    const newRole = member.role === "owner" ? "member" : "owner"

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

  const eyebrowClass = "text-[10px] uppercase tracking-[0.12em]"
  const eyebrowStyle = { fontFamily: "var(--font-mono)", color: "var(--color-ink-mute)" }

  // Seat accounting for plan enforcement. Pending invites count against
  // the cap so someone can't queue up 100 invites on a 3-seat plan and
  // have them all accept.
  const maxSeats = account.maxTeamSeats ?? 3
  const seatsUsed = members.length + invites.length
  const atSeatCap = seatsUsed >= maxSeats

  return (
    <div className="space-y-8">
      {/* Feedback messages */}
      {error && (
        <p className="rounded-lg px-4 py-3 text-[13px]" style={{ background: "#A33B2810", color: "#A33B28" }}>
          {error}
        </p>
      )}
      {success && (
        <p
          className="rounded-lg px-4 py-3 text-[13px]"
          style={{ background: "var(--color-forest)10", color: "var(--color-forest)" }}
        >
          {success}
        </p>
      )}

      {/* Members list */}
      <section className="space-y-3">
        <p className={eyebrowClass} style={eyebrowStyle}>
          Members
        </p>
        {members.map((m) => {
          const isSelf = m.userId === membership.userId
          return (
            <div
              key={m.id}
              className="flex items-center justify-between rounded-xl border px-5 py-4"
              style={{ borderColor: "var(--color-rule)" }}
            >
              <div>
                <p className="text-[14px] font-medium" style={{ color: "var(--color-ink)" }}>
                  {m.displayName || "Unnamed"}
                  {isSelf && (
                    <span
                      className="ml-2 text-[11px]"
                      style={{ fontFamily: "var(--font-mono)", color: "var(--color-ink-mute)" }}
                    >
                      (you)
                    </span>
                  )}
                </p>
                {/* Role badge */}
                <span
                  className="mt-0.5 inline-block text-[9px] uppercase tracking-[0.1em]"
                  style={{
                    fontFamily: "var(--font-mono)",
                    color: m.role === "owner" ? "var(--color-forest)" : "var(--color-ink-mute)",
                  }}
                >
                  {m.role}
                </span>
              </div>
              <div className="flex items-center gap-2">
                {/* Role toggle for owners changing others */}
                {isOwner && !isSelf && (
                  <button
                    onClick={() => handleToggleRole(m)}
                    className="rounded-full border px-3 py-1.5 text-[11px] transition-colors hover:opacity-70"
                    style={{
                      fontFamily: "var(--font-mono)",
                      borderColor: "var(--color-rule)",
                      color: "var(--color-ink-mute)",
                    }}
                  >
                    {m.role === "owner" ? "Remove owner" : "Make owner"}
                  </button>
                )}
                {/* Self role step-down when multiple owners */}
                {isOwner && isSelf && members.filter((mm) => mm.role === "owner").length > 1 && (
                  <button
                    onClick={() => handleToggleRole(m)}
                    className="rounded-full border px-3 py-1.5 text-[11px] transition-colors hover:opacity-70"
                    style={{
                      fontFamily: "var(--font-mono)",
                      borderColor: "var(--color-rule)",
                      color: "var(--color-ink-mute)",
                    }}
                  >
                    Step down
                  </button>
                )}
                {/* Remove member */}
                {isOwner && !isSelf && (
                  <button
                    onClick={() => handleRemoveMember(m.id)}
                    className="rounded-full border px-3 py-1.5 text-[11px] transition-colors hover:opacity-70"
                    style={{
                      fontFamily: "var(--font-mono)",
                      borderColor: "#A33B2840",
                      color: "#A33B28",
                    }}
                  >
                    Remove
                  </button>
                )}
              </div>
            </div>
          )
        })}
      </section>

      {/* Pending invites */}
      {invites.length > 0 && (
        <section className="space-y-3">
          <p className={eyebrowClass} style={eyebrowStyle}>
            Pending invites
          </p>
          {invites.map((i) => {
            const expires = new Date(i.expiresAt)
            const now = new Date()
            const daysLeft = Math.ceil((expires.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
            return (
              <div
                key={i.id}
                className="flex items-center justify-between rounded-xl border border-dashed px-5 py-4"
                style={{ borderColor: "var(--color-rule)" }}
              >
                <div>
                  <p className="text-[14px]" style={{ color: "var(--color-ink)" }}>
                    {i.email}
                  </p>
                  <span
                    className="mt-0.5 inline-block text-[9px] uppercase tracking-[0.1em]"
                    style={{ fontFamily: "var(--font-mono)", color: "var(--color-ink-mute)" }}
                  >
                    {i.role} &middot; {daysLeft > 0 ? `expires in ${daysLeft}d` : "expired"}
                  </span>
                </div>
                {isOwner && (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleResendInvite(i)}
                      className="rounded-full border px-3 py-1.5 text-[11px] transition-colors hover:opacity-70"
                      style={{
                        fontFamily: "var(--font-mono)",
                        borderColor: "var(--color-rule)",
                        color: "var(--color-ink-mute)",
                      }}
                    >
                      Resend
                    </button>
                    <button
                      onClick={() => handleRevokeInvite(i.id)}
                      className="rounded-full border px-3 py-1.5 text-[11px] transition-colors hover:opacity-70"
                      style={{
                        fontFamily: "var(--font-mono)",
                        borderColor: "#A33B2840",
                        color: "#A33B28",
                      }}
                    >
                      Revoke
                    </button>
                  </div>
                )}
              </div>
            )
          })}
        </section>
      )}

      {/* Invite form */}
      {isOwner && (
        <section
          className="rounded-xl border p-6"
          style={{ borderColor: "var(--color-rule)" }}
        >
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className={eyebrowClass} style={eyebrowStyle}>
                Invite member
              </p>
              <p className="mt-1 text-[13px]" style={{ color: "var(--color-ink-soft)" }}>
                They'll receive an email with a link to join {account.studioName}.
              </p>
            </div>
            <span
              className="rounded-full border px-2.5 py-1 text-[10px] uppercase tracking-[0.12em]"
              style={{
                fontFamily: "var(--font-mono)",
                borderColor: atSeatCap ? "#A33B2840" : "var(--color-rule)",
                color: atSeatCap ? "#A33B28" : "var(--color-ink-mute)",
              }}
            >
              {seatsUsed} / {maxSeats} SEATS
            </span>
          </div>

          {atSeatCap && (
            <p
              className="mt-4 rounded-lg px-4 py-3 text-[12px]"
              style={{ background: "#A33B2810", color: "#A33B28" }}
            >
              You've used all {maxSeats} seats on the Friends &amp; Family plan. Remove a member or revoke a pending invite to free one up.
            </p>
          )}

          <form onSubmit={handleInvite} className="mt-5 space-y-4">
            <div>
              <label htmlFor="invite-email" className={labelClass} style={labelStyle}>
                Email address
              </label>
              <input
                id="invite-email"
                type="email"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                placeholder="colleague@example.com"
                required
                disabled={atSeatCap}
                className={inputClass}
                style={inputStyle}
              />
            </div>

            <div>
              <label htmlFor="invite-role" className={labelClass} style={labelStyle}>
                Role
              </label>
              <select
                id="invite-role"
                value={inviteRole}
                onChange={(e) => setInviteRole(e.target.value as "member" | "owner")}
                disabled={atSeatCap}
                className={inputClass}
                style={inputStyle}
              >
                <option value="member">Member (can create and edit proposals)</option>
                <option value="owner">Owner (full access, including account settings)</option>
              </select>
            </div>

            <button
              type="submit"
              disabled={sending || !inviteEmail.trim() || atSeatCap}
              className="rounded-full px-6 py-3 text-[14px] font-medium transition-transform hover:scale-[1.01] disabled:cursor-not-allowed disabled:opacity-50"
              style={{ background: "var(--color-forest)", color: "var(--color-cream)" }}
            >
              {sending ? "Sending..." : "Send invite"}
            </button>
          </form>
        </section>
      )}

      {/* Leave team — for non-owners */}
      {!isOwner && (
        <section
          className="rounded-xl border p-6"
          style={{ borderColor: "#A33B2840", background: "#A33B2808" }}
        >
          <p
            className="text-[10px] uppercase tracking-[0.12em]"
            style={{ fontFamily: "var(--font-mono)", color: "#A33B28" }}
          >
            Leave team
          </p>
          <p className="mt-2 text-[13px]" style={{ color: "var(--color-ink-soft)" }}>
            You'll lose access to all {account.studioName} proposals.
          </p>
          <button
            onClick={handleLeaveTeam}
            className="mt-4 rounded-full border px-5 py-2.5 text-[13px] font-medium transition-colors hover:opacity-80"
            style={{ borderColor: "#A33B28", color: "#A33B28" }}
          >
            Leave {account.studioName}
          </button>
        </section>
      )}
    </div>
  )
}
