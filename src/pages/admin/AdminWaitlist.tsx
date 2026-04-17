/**
 * Admin waitlist — /admin/waitlist
 *
 * Table of every waitlist signup. Search by email. Per-row action:
 * issue an invite from this row (opens modal pre-filled).
 *
 * Waitlist rows with invited_at set show the minted code; we still
 * allow re-issuing (issue_invite reuses any still-valid code).
 */

import { useCallback, useEffect, useMemo, useState } from "react"
import { Search, UserPlus } from "lucide-react"
import { supabase } from "@/lib/supabase"
import IssueInviteModal from "@/components/admin/IssueInviteModal"

interface WaitlistRow {
  id: string
  email: string
  notes: string | null
  created_at: string
  invited_at: string | null
  invite_code_id: string | null
}

export default function AdminWaitlist() {
  const [rows, setRows] = useState<WaitlistRow[]>([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState("")
  const [modalEmail, setModalEmail] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase
      .from("waitlist_signups")
      .select("id, email, notes, created_at, invited_at, invite_code_id")
      .order("created_at", { ascending: false })
      .limit(500)
    setRows((data ?? []) as WaitlistRow[])
    setLoading(false)
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return rows
    return rows.filter((r) => r.email.toLowerCase().includes(q))
  }, [rows, query])

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div
          className="flex flex-1 items-center gap-2 rounded-full border px-4 py-2.5"
          style={{ background: "var(--color-paper)", borderColor: "var(--color-rule)" }}
        >
          <Search className="h-4 w-4" style={{ color: "var(--color-ink-mute)" }} />
          <input
            type="text"
            placeholder="Search by email…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="flex-1 bg-transparent text-[14px] outline-none"
            style={{ color: "var(--color-ink)" }}
          />
        </div>
        <p
          className="text-[11px] uppercase tracking-[0.12em]"
          style={{ fontFamily: "var(--font-mono)", color: "var(--color-ink-mute)" }}
        >
          {filtered.length} / {rows.length}
        </p>
      </div>

      {loading ? (
        <p
          className="text-[11px] uppercase tracking-[0.14em]"
          style={{ fontFamily: "var(--font-mono)", color: "var(--color-ink-mute)" }}
        >
          LOADING…
        </p>
      ) : filtered.length === 0 ? (
        <EmptyState query={query} />
      ) : (
        <div
          className="overflow-hidden rounded-2xl border"
          style={{ background: "var(--color-paper)", borderColor: "var(--color-rule)" }}
        >
          <table className="w-full text-[13px]">
            <thead>
              <tr style={{ borderBottom: "1px solid var(--color-rule)" }}>
                <Th>Email</Th>
                <Th>Status</Th>
                <Th>Signed up</Th>
                <Th>Notes</Th>
                <Th align="right">Action</Th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <tr
                  key={r.id}
                  style={{ borderBottom: "1px solid var(--color-rule)" }}
                  className="last:border-none"
                >
                  <Td>
                    <span className="font-medium" style={{ color: "var(--color-ink)" }}>
                      {r.email}
                    </span>
                  </Td>
                  <Td>
                    {r.invited_at ? (
                      <Pill tone="forest">Invited</Pill>
                    ) : (
                      <Pill tone="neutral">Waiting</Pill>
                    )}
                  </Td>
                  <Td muted>{new Date(r.created_at).toLocaleDateString()}</Td>
                  <Td muted>{r.notes ?? "—"}</Td>
                  <Td align="right">
                    <button
                      onClick={() => setModalEmail(r.email)}
                      className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[12px] font-medium transition-colors hover:opacity-80"
                      style={{
                        borderColor: "var(--color-forest)",
                        color: "var(--color-forest)",
                      }}
                    >
                      <UserPlus className="h-3.5 w-3.5" />
                      Issue invite
                    </button>
                  </Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <IssueInviteModal
        open={modalEmail !== null}
        onClose={() => setModalEmail(null)}
        onIssued={load}
        prefillEmail={modalEmail ?? ""}
      />
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Table primitives & pills
// ─────────────────────────────────────────────────────────────────────────────

function Th({ children, align }: { children: React.ReactNode; align?: "right" }) {
  return (
    <th
      className={`px-4 py-3 text-[10px] uppercase tracking-[0.14em] ${
        align === "right" ? "text-right" : "text-left"
      }`}
      style={{ fontFamily: "var(--font-mono)", color: "var(--color-ink-mute)", fontWeight: 500 }}
    >
      {children}
    </th>
  )
}

function Td({
  children,
  muted,
  align,
}: {
  children: React.ReactNode
  muted?: boolean
  align?: "right"
}) {
  return (
    <td
      className={`px-4 py-3 ${align === "right" ? "text-right" : "text-left"}`}
      style={{ color: muted ? "var(--color-ink-mute)" : "var(--color-ink)" }}
    >
      {children}
    </td>
  )
}

function Pill({ tone, children }: { tone: "forest" | "neutral" | "warn"; children: React.ReactNode }) {
  const palette = {
    forest: { bg: "var(--color-forest)", fg: "var(--color-cream)" },
    neutral: { bg: "var(--color-rule)", fg: "var(--color-ink-soft)" },
    warn: { bg: "#A33B2820", fg: "#A33B28" },
  }[tone]
  return (
    <span
      className="inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] uppercase tracking-[0.12em]"
      style={{
        background: palette.bg,
        color: palette.fg,
        fontFamily: "var(--font-mono)",
      }}
    >
      {children}
    </span>
  )
}

function EmptyState({ query }: { query: string }) {
  return (
    <div
      className="rounded-2xl border px-8 py-16"
      style={{ background: "var(--color-paper)", borderColor: "var(--color-rule)" }}
    >
      <p
        className="text-[11px] uppercase tracking-[0.14em]"
        style={{ fontFamily: "var(--font-mono)", color: "var(--color-ink-mute)" }}
      >
        {query ? "NO MATCHES" : "NO SIGNUPS"}
      </p>
      <h2
        className="mt-3 text-[22px] leading-[1.2] tracking-[-0.01em]"
        style={{ fontFamily: "var(--font-merchant-display)", fontWeight: 500 }}
      >
        {query ? `Nothing matches "${query}"` : "Waitlist is empty"}
      </h2>
    </div>
  )
}
