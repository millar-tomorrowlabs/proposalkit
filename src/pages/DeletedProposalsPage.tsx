/**
 * Recently Deleted page — /proposals/deleted
 *
 * Lists soft-deleted proposals (deleted_at IS NOT NULL) with the option
 * to restore. Linked from the main proposals dashboard.
 */

import { useCallback, useEffect, useState } from "react"
import { Link, useNavigate } from "react-router-dom"
import { ArrowLeft, RotateCcw, Trash2 } from "lucide-react"
import { supabase } from "@/lib/supabase"
import { useAccount } from "@/contexts/AccountContext"
import ProposlMark from "@/components/brand/ProposlMark"

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface DeletedRow {
  id: string
  title: string
  client_name: string
  deleted_at: string
  created_at: string
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

function daysLeft(deletedAt: string): number {
  const deletedMs = new Date(deletedAt).getTime()
  const expiresMs = deletedMs + 30 * 24 * 60 * 60 * 1000
  const remainingMs = expiresMs - Date.now()
  return Math.max(0, Math.ceil(remainingMs / (24 * 60 * 60 * 1000)))
}

// ─────────────────────────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────────────────────────

export default function DeletedProposalsPage() {
  const { account } = useAccount()
  const navigate = useNavigate()
  const [rows, setRows] = useState<DeletedRow[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase
      .from("proposals")
      .select("id, title, client_name, deleted_at, created_at")
      .eq("account_id", account.id)
      .not("deleted_at", "is", null)
      .order("deleted_at", { ascending: false })
    setRows((data ?? []) as DeletedRow[])
    setLoading(false)
  }, [account.id])

  useEffect(() => {
    load()
  }, [load])

  const handleRestore = useCallback(
    async (id: string) => {
      await supabase
        .from("proposals")
        .update({ deleted_at: null })
        .eq("id", id)
      setRows((prev) => prev.filter((r) => r.id !== id))
    },
    [],
  )

  // Hard delete. Removes the proposal row and cascades to
  // proposal_sends, proposal_messages, proposal_snapshots, proposal_context,
  // and submissions via their on-delete-cascade FKs. Irreversible, so gate
  // behind a confirm.
  const handlePurge = useCallback(async (id: string, title: string) => {
    const label = title && title.trim() ? `"${title}"` : "this proposal"
    if (!confirm(`Permanently delete ${label}? This can't be undone.`)) return
    await supabase.from("proposals").delete().eq("id", id)
    setRows((prev) => prev.filter((r) => r.id !== id))
  }, [])

  return (
    <div
      className="min-h-screen"
      style={{
        background: "var(--color-cream)",
        color: "var(--color-ink)",
        fontFamily: "var(--font-sans)",
      }}
    >
      {/* Header */}
      <header className="mx-auto flex max-w-[1200px] items-center justify-between px-6 pt-8 pb-6 md:px-10">
        <Link
          to="/"
          className="flex items-center gap-2.5"
          style={{ color: "var(--color-forest)" }}
        >
          <ProposlMark size={28} />
          <span
            className="text-[18px] leading-none"
            style={{
              fontFamily: "var(--font-merchant-display)",
              fontWeight: 500,
              letterSpacing: "-0.01em",
            }}
          >
            proposl
          </span>
        </Link>
        <Link
          to="/new"
          className="rounded-full px-4 py-2 text-[13px] font-medium transition-transform hover:scale-[1.02]"
          style={{
            background: "var(--color-forest)",
            color: "var(--color-cream)",
          }}
        >
          New proposal
        </Link>
      </header>

      {/* Back link */}
      <div className="mx-auto max-w-[1000px] px-6 pt-8 md:px-10">
        <button
          onClick={() => navigate("/proposals")}
          className="inline-flex items-center gap-2 text-[12px] uppercase tracking-[0.14em] transition-colors hover:opacity-60"
          style={{
            fontFamily: "var(--font-mono)",
            color: "var(--color-ink-mute)",
          }}
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          BACK TO PROPOSALS
        </button>
      </div>

      {/* Title */}
      <section className="mx-auto max-w-[1000px] px-6 pt-8 pb-8 md:px-10 md:pt-12">
        <p
          className="mb-3 text-[11px] uppercase tracking-[0.18em]"
          style={{
            fontFamily: "var(--font-mono)",
            color: "var(--color-ink-mute)",
          }}
        >
          TRASH
        </p>
        <h1
          className="text-[40px] leading-[1.05] tracking-[-0.015em] md:text-[56px]"
          style={{
            fontFamily: "var(--font-merchant-display)",
            fontWeight: 500,
          }}
        >
          Recently deleted
        </h1>
        <p
          className="mt-4 max-w-[52ch] text-[14px] leading-[1.55]"
          style={{ color: "var(--color-ink-soft)" }}
        >
          Proposals stay here for 30 days after deletion. You can restore them
          until then. After 30 days, they're removed permanently.
        </p>
      </section>

      {/* List */}
      <section className="mx-auto max-w-[1000px] px-6 pb-28 md:px-10">
        {loading ? (
          <p
            className="text-[11px] uppercase tracking-[0.14em]"
            style={{ fontFamily: "var(--font-mono)", color: "var(--color-ink-mute)" }}
          >
            LOADING…
          </p>
        ) : rows.length === 0 ? (
          <div
            className="rounded-2xl border px-8 py-16 md:px-12 md:py-20"
            style={{
              background: "var(--color-paper)",
              borderColor: "var(--color-rule)",
            }}
          >
            <p
              className="text-[11px] uppercase tracking-[0.14em]"
              style={{
                fontFamily: "var(--font-mono)",
                color: "var(--color-ink-mute)",
              }}
            >
              NOTHING HERE
            </p>
            <h2
              className="mt-4 max-w-[20ch] text-[24px] leading-[1.2] tracking-[-0.01em] md:text-[28px]"
              style={{
                fontFamily: "var(--font-merchant-display)",
                fontWeight: 500,
              }}
            >
              No deleted proposals. Keep it that way.
            </h2>
          </div>
        ) : (
          <div className="space-y-4">
            {rows.map((row) => (
              <DeletedCard
                key={row.id}
                row={row}
                onRestore={() => handleRestore(row.id)}
                onPurge={() => handlePurge(row.id, row.title)}
              />
            ))}
          </div>
        )}
      </section>

      {/* Footer */}
      <footer
        className="border-t px-6 py-10 md:px-10"
        style={{ borderColor: "var(--color-rule)" }}
      >
        <div className="mx-auto flex max-w-[1200px] flex-col items-start gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-2.5" style={{ color: "var(--color-forest)" }}>
            <ProposlMark size={22} />
            <span
              className="text-[16px] leading-none"
              style={{
                fontFamily: "var(--font-merchant-display)",
                fontWeight: 500,
                letterSpacing: "-0.01em",
              }}
            >
              proposl
            </span>
          </div>
          <p
            className="text-[11px] uppercase tracking-[0.14em]"
            style={{ fontFamily: "var(--font-mono)", color: "var(--color-ink-mute)" }}
          >
            MADE BY{" "}
            <a
              href="https://tomorrowstudios.io"
              target="_blank"
              rel="noreferrer"
              className="underline-offset-4 transition-colors hover:underline"
              style={{ color: "var(--color-ink-soft)" }}
            >
              TOMORROW STUDIOS
            </a>
            {" · VANCOUVER"}
          </p>
        </div>
      </footer>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// DeletedCard
// ─────────────────────────────────────────────────────────────────────────────

function DeletedCard({
  row,
  onRestore,
  onPurge,
}: {
  row: DeletedRow
  onRestore: () => void
  onPurge: () => void
}) {
  const remaining = daysLeft(row.deleted_at)
  const urgent = remaining <= 3

  return (
    <article
      className="rounded-2xl border px-6 py-5 md:px-8 md:py-6"
      style={{
        background: "var(--color-paper)",
        borderColor: "var(--color-rule)",
        // Muted overall — everything is one shade softer than active cards
        opacity: 0.85,
      }}
    >
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between md:gap-8">
        <div className="min-w-0 flex-1">
          <p
            className="mb-1.5 text-[11px] uppercase tracking-[0.14em]"
            style={{
              fontFamily: "var(--font-mono)",
              color: "var(--color-ink-mute)",
            }}
          >
            {row.client_name || "UNKNOWN CLIENT"}
          </p>
          <h2
            className="text-[22px] leading-[1.2] tracking-[-0.01em] md:text-[24px]"
            style={{
              fontFamily: "var(--font-merchant-display)",
              fontWeight: 500,
              color: "var(--color-ink-soft)",
            }}
          >
            {row.title}
          </h2>
          <p
            className="mt-2.5 text-[11px] uppercase tracking-[0.12em]"
            style={{
              fontFamily: "var(--font-mono)",
              color: "var(--color-ink-mute)",
            }}
          >
            DELETED {timeSince(row.deleted_at).toUpperCase()}
            {" · "}
            <span
              style={{
                color: urgent ? "#A33B28" : "var(--color-ink-mute)",
                fontWeight: urgent ? 600 : 400,
              }}
            >
              {remaining} {remaining === 1 ? "DAY" : "DAYS"} LEFT
            </span>
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <button
            onClick={onRestore}
            className="flex items-center gap-2 rounded-full border px-5 py-2.5 text-[13px] font-medium transition-colors hover:opacity-80"
            style={{
              borderColor: "var(--color-forest)",
              color: "var(--color-forest)",
            }}
          >
            <RotateCcw className="h-4 w-4" />
            Restore
          </button>
          <button
            onClick={onPurge}
            className="flex items-center gap-2 rounded-full border px-4 py-2.5 text-[13px] font-medium transition-colors hover:opacity-80"
            style={{
              borderColor: "#A33B2840",
              color: "#A33B28",
            }}
            title="Permanently delete this proposal"
          >
            <Trash2 className="h-4 w-4" />
            Delete
          </button>
        </div>
      </div>
    </article>
  )
}
