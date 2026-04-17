/**
 * Admin dashboard — /admin
 *
 * Landing page of the admin console. Three summary cards (waitlist,
 * invites, accounts) each showing total count + last 5 rows, with a
 * "view all" link to the dedicated page. One quick action: issue an
 * invite (opens modal).
 */

import { useCallback, useEffect, useState } from "react"
import { Link } from "react-router-dom"
import { ArrowRight, Plus } from "lucide-react"
import { supabase } from "@/lib/supabase"
import IssueInviteModal from "@/components/admin/IssueInviteModal"

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface WaitlistRow {
  id: string
  email: string
  created_at: string
  invited_at: string | null
}

interface InviteRow {
  id: string
  code: string
  email: string
  plan: string
  used_at: string | null
  revoked_at: string | null
  expires_at: string
  created_at: string
}

interface AccountRow {
  id: string
  studio_name: string
  plan: string
  created_at: string
}

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

export default function AdminDashboard() {
  const [waitlist, setWaitlist] = useState<{ count: number; rows: WaitlistRow[] }>({ count: 0, rows: [] })
  const [invites, setInvites] = useState<{ count: number; rows: InviteRow[] }>({ count: 0, rows: [] })
  const [accounts, setAccounts] = useState<{ count: number; rows: AccountRow[] }>({ count: 0, rows: [] })
  const [modalOpen, setModalOpen] = useState(false)

  const load = useCallback(async () => {
    const [{ data: wRows, count: wCount }, { data: iRows, count: iCount }, { data: aRows, count: aCount }] = await Promise.all([
      supabase
        .from("waitlist_signups")
        .select("id, email, created_at, invited_at", { count: "exact" })
        .order("created_at", { ascending: false })
        .limit(5),
      supabase
        .from("invite_codes")
        .select("id, code, email, plan, used_at, revoked_at, expires_at, created_at", { count: "exact" })
        .order("created_at", { ascending: false })
        .limit(5),
      supabase
        .from("accounts")
        .select("id, studio_name, plan, created_at", { count: "exact" })
        .order("created_at", { ascending: false })
        .limit(5),
    ])

    setWaitlist({ count: wCount ?? 0, rows: (wRows ?? []) as WaitlistRow[] })
    setInvites({ count: iCount ?? 0, rows: (iRows ?? []) as InviteRow[] })
    setAccounts({ count: aCount ?? 0, rows: (aRows ?? []) as AccountRow[] })
  }, [])

  useEffect(() => {
    load()
  }, [load])

  return (
    <div className="space-y-8">
      {/* Quick actions */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => setModalOpen(true)}
          className="flex items-center gap-2 rounded-full px-5 py-2.5 text-[13px] font-medium transition-transform hover:scale-[1.02]"
          style={{ background: "var(--color-forest)", color: "var(--color-cream)" }}
        >
          <Plus className="h-4 w-4" />
          Issue invite
        </button>
      </div>

      {/* Summary cards */}
      <div className="grid gap-5 md:grid-cols-3">
        <SummaryCard
          label="Waitlist"
          count={waitlist.count}
          viewAllHref="/admin/waitlist"
          rows={waitlist.rows.map((r) => ({
            key: r.id,
            title: r.email,
            subtitle: `${r.invited_at ? "invited · " : "waiting · "}${timeSince(r.created_at)}`,
          }))}
          emptyCopy="No signups yet."
        />
        <SummaryCard
          label="Invites"
          count={invites.count}
          viewAllHref="/admin/invites"
          rows={invites.rows.map((r) => {
            let status = "active"
            if (r.used_at) status = "used"
            else if (r.revoked_at) status = "revoked"
            else if (new Date(r.expires_at).getTime() < Date.now()) status = "expired"
            return {
              key: r.id,
              title: r.email,
              subtitle: `${r.code} · ${status}`,
            }
          })}
          emptyCopy="No invites issued."
        />
        <SummaryCard
          label="Accounts"
          count={accounts.count}
          viewAllHref="/admin/accounts"
          rows={accounts.rows.map((r) => ({
            key: r.id,
            title: r.studio_name,
            subtitle: `${r.plan.replace("_", " ")} · ${timeSince(r.created_at)}`,
          }))}
          emptyCopy="No accounts yet."
        />
      </div>

      <IssueInviteModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onIssued={load}
      />
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// SummaryCard
// ─────────────────────────────────────────────────────────────────────────────

function SummaryCard({
  label,
  count,
  rows,
  viewAllHref,
  emptyCopy,
}: {
  label: string
  count: number
  rows: { key: string; title: string; subtitle: string }[]
  viewAllHref: string
  emptyCopy: string
}) {
  return (
    <div
      className="flex flex-col rounded-2xl border p-5 md:p-6"
      style={{ background: "var(--color-paper)", borderColor: "var(--color-rule)" }}
    >
      <div className="flex items-baseline justify-between">
        <p
          className="text-[11px] uppercase tracking-[0.14em]"
          style={{ fontFamily: "var(--font-mono)", color: "var(--color-ink-mute)" }}
        >
          {label.toUpperCase()}
        </p>
        <span
          className="text-[28px] leading-none tracking-[-0.01em]"
          style={{ fontFamily: "var(--font-merchant-display)", fontWeight: 500 }}
        >
          {count}
        </span>
      </div>

      <div className="mt-4 flex-1">
        {rows.length === 0 ? (
          <p
            className="text-[12px]"
            style={{ color: "var(--color-ink-mute)", fontFamily: "var(--font-mono)" }}
          >
            {emptyCopy.toUpperCase()}
          </p>
        ) : (
          <ul className="space-y-2.5">
            {rows.map((r) => (
              <li key={r.key} className="text-[13px]">
                <p className="truncate" style={{ color: "var(--color-ink)" }}>
                  {r.title}
                </p>
                <p
                  className="truncate text-[11px] uppercase tracking-[0.1em]"
                  style={{ fontFamily: "var(--font-mono)", color: "var(--color-ink-mute)" }}
                >
                  {r.subtitle}
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>

      <Link
        to={viewAllHref}
        className="mt-5 flex items-center gap-1.5 text-[12px] font-medium transition-colors hover:opacity-70"
        style={{ color: "var(--color-forest)" }}
      >
        View all
        <ArrowRight className="h-3.5 w-3.5" />
      </Link>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Utilities
// ─────────────────────────────────────────────────────────────────────────────

function timeSince(iso: string): string {
  const secs = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (secs < 60) return "just now"
  if (secs < 3600) return `${Math.floor(secs / 60)}m ago`
  if (secs < 86400) return `${Math.floor(secs / 3600)}h ago`
  if (secs < 2592000) return `${Math.floor(secs / 86400)}d ago`
  if (secs < 31536000) return `${Math.floor(secs / 2592000)}mo ago`
  return `${Math.floor(secs / 31536000)}y ago`
}
