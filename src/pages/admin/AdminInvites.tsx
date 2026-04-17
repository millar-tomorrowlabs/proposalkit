/**
 * Admin invites — /admin/invites
 *
 * Table of every invite_codes row. Filter tabs (All / Active / Used /
 * Revoked / Expired) + search by email. Per-row actions:
 *  - Copy code
 *  - Revoke (only meaningful for non-used, non-revoked invites; we
 *    allow revoke on used too for audit, but the UI hides it because
 *    that's a confusing action)
 */

import { useCallback, useEffect, useMemo, useState } from "react"
import { Ban, Check, Copy, Search } from "lucide-react"
import { supabase } from "@/lib/supabase"
import { friendlyError } from "@/lib/errors"

type Tab = "all" | "active" | "used" | "revoked" | "expired"

interface InviteRow {
  id: string
  code: string
  email: string
  plan: string
  notes: string | null
  created_at: string
  expires_at: string
  used_at: string | null
  revoked_at: string | null
}

function statusOf(r: InviteRow): "active" | "used" | "revoked" | "expired" {
  if (r.used_at) return "used"
  if (r.revoked_at) return "revoked"
  if (new Date(r.expires_at).getTime() < Date.now()) return "expired"
  return "active"
}

export default function AdminInvites() {
  const [rows, setRows] = useState<InviteRow[]>([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState("")
  const [tab, setTab] = useState<Tab>("all")
  const [revokingId, setRevokingId] = useState<string | null>(null)
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [error, setError] = useState("")

  const load = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase
      .from("invite_codes")
      .select("id, code, email, plan, notes, created_at, expires_at, used_at, revoked_at")
      .order("created_at", { ascending: false })
      .limit(500)
    setRows((data ?? []) as InviteRow[])
    setLoading(false)
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return rows.filter((r) => {
      if (tab !== "all" && statusOf(r) !== tab) return false
      if (q && !r.email.toLowerCase().includes(q) && !r.code.toLowerCase().includes(q)) return false
      return true
    })
  }, [rows, query, tab])

  const counts = useMemo(() => {
    const by: Record<Tab, number> = { all: rows.length, active: 0, used: 0, revoked: 0, expired: 0 }
    for (const r of rows) by[statusOf(r)]++
    return by
  }, [rows])

  const handleRevoke = async (id: string) => {
    if (!confirm("Revoke this invite? It can't be used after this.")) return
    setError("")
    setRevokingId(id)
    const { error: fnError } = await supabase.functions.invoke("admin-revoke-invite", {
      body: { inviteId: id },
    })
    setRevokingId(null)
    if (fnError) {
      let message = fnError.message
      const ctx = (fnError as { context?: Response }).context
      if (ctx && typeof ctx.json === "function") {
        try {
          const body = await ctx.json()
          if (body?.error) message = body.error
        } catch { /* swallow */ }
      }
      setError(friendlyError(message))
      return
    }
    load()
  }

  const handleCopy = (id: string, code: string) => {
    navigator.clipboard.writeText(code).then(() => {
      setCopiedId(id)
      setTimeout(() => setCopiedId((current) => (current === id ? null : current)), 2000)
    })
  }

  return (
    <div className="space-y-6">
      {/* Filter tabs */}
      <div
        className="flex gap-1 overflow-x-auto border-b"
        style={{ borderColor: "var(--color-rule)" }}
      >
        {(["all", "active", "used", "revoked", "expired"] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`relative px-3 py-2 text-[12px] font-medium transition-colors ${tab === t ? "" : "hover:opacity-70"}`}
            style={{
              color: tab === t ? "var(--color-forest)" : "var(--color-ink-mute)",
              fontFamily: "var(--font-sans)",
            }}
          >
            {t.charAt(0).toUpperCase() + t.slice(1)} <span style={{ opacity: 0.5 }}>({counts[t]})</span>
            {tab === t && (
              <span
                className="absolute bottom-0 left-3 right-3 h-[2px] rounded-full"
                style={{ background: "var(--color-forest)" }}
              />
            )}
          </button>
        ))}
      </div>

      {/* Search */}
      <div
        className="flex items-center gap-2 rounded-full border px-4 py-2.5"
        style={{ background: "var(--color-paper)", borderColor: "var(--color-rule)" }}
      >
        <Search className="h-4 w-4" style={{ color: "var(--color-ink-mute)" }} />
        <input
          type="text"
          placeholder="Search by email or code…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="flex-1 bg-transparent text-[14px] outline-none"
          style={{ color: "var(--color-ink)" }}
        />
      </div>

      {error && (
        <p className="text-[12px]" style={{ color: "#A33B28" }}>
          {error}
        </p>
      )}

      {loading ? (
        <p
          className="text-[11px] uppercase tracking-[0.14em]"
          style={{ fontFamily: "var(--font-mono)", color: "var(--color-ink-mute)" }}
        >
          LOADING…
        </p>
      ) : filtered.length === 0 ? (
        <EmptyState tab={tab} query={query} />
      ) : (
        <div
          className="overflow-hidden rounded-2xl border"
          style={{ background: "var(--color-paper)", borderColor: "var(--color-rule)" }}
        >
          <table className="w-full text-[13px]">
            <thead>
              <tr style={{ borderBottom: "1px solid var(--color-rule)" }}>
                <Th>Code</Th>
                <Th>Email</Th>
                <Th>Plan</Th>
                <Th>Status</Th>
                <Th>Notes</Th>
                <Th align="right">Actions</Th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => {
                const status = statusOf(r)
                const canRevoke = status === "active"
                return (
                  <tr
                    key={r.id}
                    style={{ borderBottom: "1px solid var(--color-rule)" }}
                    className="last:border-none"
                  >
                    <Td>
                      <code
                        className="text-[12px] tracking-[0.08em]"
                        style={{ fontFamily: "var(--font-mono)", color: "var(--color-ink)" }}
                      >
                        {r.code}
                      </code>
                    </Td>
                    <Td>{r.email}</Td>
                    <Td muted>
                      <span className="capitalize">{r.plan.replace("_", " ")}</span>
                    </Td>
                    <Td>
                      <StatusPill status={status} />
                    </Td>
                    <Td muted>{r.notes ?? "—"}</Td>
                    <Td align="right">
                      <div className="inline-flex items-center gap-1.5">
                        <button
                          onClick={() => handleCopy(r.id, r.code)}
                          className="inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors hover:opacity-80"
                          style={{ borderColor: "var(--color-rule)", color: "var(--color-ink-soft)" }}
                        >
                          {copiedId === r.id ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                          {copiedId === r.id ? "Copied" : "Copy"}
                        </button>
                        {canRevoke && (
                          <button
                            onClick={() => handleRevoke(r.id)}
                            disabled={revokingId === r.id}
                            className="inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors hover:opacity-80 disabled:opacity-40"
                            style={{ borderColor: "#A33B2840", color: "#A33B28" }}
                          >
                            <Ban className="h-3 w-3" />
                            {revokingId === r.id ? "Revoking…" : "Revoke"}
                          </button>
                        )}
                      </div>
                    </Td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Primitives
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

function StatusPill({ status }: { status: "active" | "used" | "revoked" | "expired" }) {
  const config = {
    active: { bg: "var(--color-forest)", fg: "var(--color-cream)", label: "Active" },
    used: { bg: "var(--color-rule)", fg: "var(--color-ink-soft)", label: "Used" },
    revoked: { bg: "#A33B2820", fg: "#A33B28", label: "Revoked" },
    expired: { bg: "var(--color-rule)", fg: "var(--color-ink-mute)", label: "Expired" },
  }[status]
  return (
    <span
      className="inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] uppercase tracking-[0.12em]"
      style={{ background: config.bg, color: config.fg, fontFamily: "var(--font-mono)" }}
    >
      {config.label}
    </span>
  )
}

function EmptyState({ tab, query }: { tab: Tab; query: string }) {
  let title = "No invites"
  if (query) title = `Nothing matches "${query}"`
  else if (tab !== "all") title = `No ${tab} invites`
  return (
    <div
      className="rounded-2xl border px-8 py-16"
      style={{ background: "var(--color-paper)", borderColor: "var(--color-rule)" }}
    >
      <p
        className="text-[11px] uppercase tracking-[0.14em]"
        style={{ fontFamily: "var(--font-mono)", color: "var(--color-ink-mute)" }}
      >
        {query ? "NO MATCHES" : "NOTHING HERE"}
      </p>
      <h2
        className="mt-3 text-[22px] leading-[1.2] tracking-[-0.01em]"
        style={{ fontFamily: "var(--font-merchant-display)", fontWeight: 500 }}
      >
        {title}
      </h2>
    </div>
  )
}
