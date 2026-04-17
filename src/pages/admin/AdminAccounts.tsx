/**
 * Admin accounts — /admin/accounts
 *
 * Table of every paying (or free-tier) customer account. Search by
 * studio name. Per-row action: Edit (opens plan/cap edit modal).
 *
 * Usage counts (seats used, sends used this month) are computed
 * alongside the base row so admins can see "3 / 5 seats" at a glance.
 */

import { useCallback, useEffect, useMemo, useState } from "react"
import { Pencil, Search } from "lucide-react"
import { supabase } from "@/lib/supabase"
import EditAccountModal, { type EditableAccount } from "@/components/admin/EditAccountModal"
import { EmptyState, Td, Th } from "@/components/admin/TablePrimitives"

interface AccountRow extends EditableAccount {
  created_at: string
  notify_email: string
  seats_used: number
  sends_this_month: number
}

// Pull accounts plus (a) member counts and (b) send counts in the current
// calendar month. Done client-side via three parallel queries instead of
// a view/RPC to stay close to the existing pattern.
async function loadAccounts(): Promise<AccountRow[]> {
  const { data: accounts } = await supabase
    .from("accounts")
    .select("id, studio_name, plan, max_team_seats, max_monthly_sends, ai_model_tier, notify_email, created_at")
    .order("created_at", { ascending: false })
    .limit(500)

  const list = (accounts ?? []) as Omit<AccountRow, "seats_used" | "sends_this_month">[]
  if (list.length === 0) return []

  const ids = list.map((a) => a.id)
  const since = new Date()
  since.setDate(1)
  since.setHours(0, 0, 0, 0)

  const [{ data: memberRows }, { data: sendRows }] = await Promise.all([
    supabase.from("account_members").select("account_id").in("account_id", ids),
    supabase
      .from("proposal_sends")
      .select("account_id, sent_at")
      .in("account_id", ids)
      .gte("sent_at", since.toISOString()),
  ])

  const seatsByAccount = new Map<string, number>()
  for (const r of (memberRows ?? []) as { account_id: string }[]) {
    seatsByAccount.set(r.account_id, (seatsByAccount.get(r.account_id) ?? 0) + 1)
  }
  const sendsByAccount = new Map<string, number>()
  for (const r of (sendRows ?? []) as { account_id: string }[]) {
    sendsByAccount.set(r.account_id, (sendsByAccount.get(r.account_id) ?? 0) + 1)
  }

  return list.map((a) => ({
    ...a,
    seats_used: seatsByAccount.get(a.id) ?? 0,
    sends_this_month: sendsByAccount.get(a.id) ?? 0,
  }))
}

export default function AdminAccounts() {
  const [rows, setRows] = useState<AccountRow[]>([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState("")
  const [editing, setEditing] = useState<AccountRow | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      setRows(await loadAccounts())
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return rows
    return rows.filter(
      (r) =>
        r.studio_name.toLowerCase().includes(q) ||
        r.notify_email.toLowerCase().includes(q),
    )
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
            placeholder="Search by studio or email…"
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
        <EmptyState
          eyebrow={query ? "No matches" : "No accounts"}
          title={query ? `Nothing matches "${query}"` : "No accounts yet"}
        />
      ) : (
        <div
          className="overflow-hidden rounded-2xl border"
          style={{ background: "var(--color-paper)", borderColor: "var(--color-rule)" }}
        >
          <table className="w-full text-[13px]">
            <thead>
              <tr style={{ borderBottom: "1px solid var(--color-rule)" }}>
                <Th>Studio</Th>
                <Th>Plan</Th>
                <Th>Seats</Th>
                <Th>Sends (mo)</Th>
                <Th>Model</Th>
                <Th>Created</Th>
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
                    <div className="font-medium" style={{ color: "var(--color-ink)" }}>
                      {r.studio_name}
                    </div>
                    <div
                      className="text-[11px] uppercase tracking-[0.1em]"
                      style={{ fontFamily: "var(--font-mono)", color: "var(--color-ink-mute)" }}
                    >
                      {r.notify_email}
                    </div>
                  </Td>
                  <Td>
                    <span className="capitalize">{r.plan.replace("_", " ")}</span>
                  </Td>
                  <Td>
                    <Usage used={r.seats_used} max={r.max_team_seats} />
                  </Td>
                  <Td>
                    <Usage used={r.sends_this_month} max={r.max_monthly_sends} />
                  </Td>
                  <Td muted>
                    <span className="capitalize">{r.ai_model_tier}</span>
                  </Td>
                  <Td muted>{new Date(r.created_at).toLocaleDateString()}</Td>
                  <Td align="right">
                    <button
                      onClick={() => setEditing(r)}
                      className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[12px] font-medium transition-colors hover:opacity-80"
                      style={{ borderColor: "var(--color-forest)", color: "var(--color-forest)" }}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                      Edit
                    </button>
                  </Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <EditAccountModal
        open={editing !== null}
        account={editing}
        onClose={() => setEditing(null)}
        onSaved={load}
      />
    </div>
  )
}

function Usage({ used, max }: { used: number; max: number }) {
  const pct = max === 0 ? 0 : Math.min(1, used / max)
  const warn = pct >= 0.8
  return (
    <span
      style={{
        color: warn ? "#A33B28" : "var(--color-ink)",
        fontFamily: "var(--font-mono)",
        fontWeight: warn ? 600 : 400,
      }}
    >
      {used} / {max}
    </span>
  )
}

