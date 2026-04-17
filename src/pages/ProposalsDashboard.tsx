/**
 * Proposals Dashboard — V2 (Studio Editorial design language).
 *
 * Surfaces engagement data per proposal (opens, clicks, delivery status,
 * submission count) in a single glance, applied to the new design language:
 * cream + paper + ink, Cormorant display, Satoshi body, Plex Mono metadata,
 * forest accent.
 */

import { useCallback, useEffect, useMemo, useState } from "react"
import { Link, useNavigate } from "react-router-dom"
import { supabase } from "@/lib/supabase"
import { useAccount } from "@/contexts/AccountContext"
import { useIsAdmin } from "@/lib/useIsAdmin"
import { Check, Copy, LogOut, Plus, Search, Settings, Shield, Users } from "lucide-react"
import ProposlMark from "@/components/brand/ProposlMark"

// ─────────────────────────────────────────────────────────────────────────────
// Filter + sort state
// ─────────────────────────────────────────────────────────────────────────────

type Filter = "all" | "drafts" | "sent" | "submitted"
type SortOrder = "edited" | "newest" | "oldest"

const FILTERS: { key: Filter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "drafts", label: "Drafts" },
  { key: "sent", label: "Sent" },
  { key: "submitted", label: "Submitted" },
]

const SORT_OPTIONS: { key: SortOrder; label: string }[] = [
  { key: "edited", label: "Last edited" },
  { key: "newest", label: "Newest" },
  { key: "oldest", label: "Oldest" },
]

/** Mutually exclusive buckets — every proposal falls into exactly one. */
function bucketOf(row: DashboardRow): Exclude<Filter, "all"> {
  if (row.summary.submissionCount > 0) return "submitted"
  if (row.summary.sendCount > 0) return "sent"
  return "drafts"
}

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface ProposalRow {
  id: string
  slug: string
  title: string
  client_name: string
  status: string | null
  created_at: string
  updated_at: string
}

interface SendRow {
  proposal_id: string
  sent_at: string
  delivery_status: string | null
  open_count: number
  click_count: number
}

interface ProposalSummary {
  latestSentAt: string | null
  latestDeliveryStatus: string | null
  sendCount: number
  openCount: number
  clickCount: number
  submissionCount: number
}

interface DashboardRow extends ProposalRow {
  summary: ProposalSummary
}

// ─────────────────────────────────────────────────────────────────────────────
// Utilities
// ─────────────────────────────────────────────────────────────────────────────

function timeSince(iso: string | null): string {
  if (!iso) return ""
  const secs = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (secs < 60) return "just now"
  if (secs < 3600) return `${Math.floor(secs / 60)}m ago`
  if (secs < 86400) return `${Math.floor(secs / 3600)}h ago`
  if (secs < 2592000) return `${Math.floor(secs / 86400)}d ago`
  if (secs < 31536000) return `${Math.floor(secs / 2592000)}mo ago`
  return `${Math.floor(secs / 31536000)}y ago`
}

// ─────────────────────────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────────────────────────

const ProposalsDashboard = () => {
  const { account, isOwner } = useAccount()
  const { isAdmin } = useIsAdmin()
  const [rows, setRows] = useState<DashboardRow[]>([])
  const [loading, setLoading] = useState(true)
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [filter, setFilter] = useState<Filter>("all")
  const [query, setQuery] = useState("")
  const [sort, setSort] = useState<SortOrder>("edited")
  const navigate = useNavigate()

  const handleSignOut = useCallback(async () => {
    await supabase.auth.signOut()
    navigate("/login")
  }, [navigate])

  useEffect(() => {
    const load = async () => {
      // 1. Load proposals for this account (exclude soft-deleted)
      const { data: proposalData } = await supabase
        .from("proposals")
        .select("id, slug, title, client_name, status, created_at, updated_at")
        .eq("account_id", account.id)
        .is("deleted_at", null)
        .order("updated_at", { ascending: false })

      const proposals = (proposalData ?? []) as ProposalRow[]
      if (proposals.length === 0) {
        setRows([])
        setLoading(false)
        return
      }

      const ids = proposals.map((p) => p.id)

      // 2. Load all sends + submissions in parallel
      const [sendsRes, subsRes] = await Promise.all([
        supabase
          .from("proposal_sends")
          .select("proposal_id, sent_at, delivery_status, open_count, click_count")
          .in("proposal_id", ids)
          .order("sent_at", { ascending: false }),
        supabase.from("submissions").select("proposal_id").in("proposal_id", ids),
      ])

      const sends = (sendsRes.data ?? []) as SendRow[]
      const subs = (subsRes.data ?? []) as { proposal_id: string }[]

      // 3. Aggregate sends per proposal
      const summaryMap = new Map<string, ProposalSummary>()
      for (const id of ids) {
        summaryMap.set(id, {
          latestSentAt: null,
          latestDeliveryStatus: null,
          sendCount: 0,
          openCount: 0,
          clickCount: 0,
          submissionCount: 0,
        })
      }

      // Sends are ordered desc by sent_at, so first row per proposal is latest
      for (const s of sends) {
        const summary = summaryMap.get(s.proposal_id)
        if (!summary) continue
        if (summary.sendCount === 0) {
          summary.latestSentAt = s.sent_at
          summary.latestDeliveryStatus = s.delivery_status
        }
        summary.sendCount += 1
        summary.openCount += s.open_count ?? 0
        summary.clickCount += s.click_count ?? 0
      }

      for (const { proposal_id } of subs) {
        const summary = summaryMap.get(proposal_id)
        if (summary) summary.submissionCount += 1
      }

      // 4. Merge and set
      const merged: DashboardRow[] = proposals.map((p) => ({
        ...p,
        summary: summaryMap.get(p.id)!,
      }))

      setRows(merged)
      setLoading(false)
    }
    load()
  }, [account.id])

  const copyLink = useCallback((slug: string, id: string) => {
    const url = `${window.location.origin}/p/${slug}`
    navigator.clipboard.writeText(url)
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 2000)
  }, [])

  // Mutually exclusive bucket counts for the filter cards.
  const counts = useMemo(() => {
    const c = { all: rows.length, drafts: 0, sent: 0, submitted: 0 }
    for (const row of rows) c[bucketOf(row)]++
    return c
  }, [rows])

  // Apply filter + search + sort to produce what the user actually sees.
  const visibleRows = useMemo(() => {
    const q = query.trim().toLowerCase()
    const filtered = rows.filter((row) => {
      if (filter !== "all" && bucketOf(row) !== filter) return false
      if (q) {
        const title = (row.title ?? "").toLowerCase()
        const client = (row.client_name ?? "").toLowerCase()
        if (!title.includes(q) && !client.includes(q)) return false
      }
      return true
    })
    const sorted = [...filtered].sort((a, b) => {
      if (sort === "edited") {
        return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
      }
      const at = new Date(a.created_at).getTime()
      const bt = new Date(b.created_at).getTime()
      return sort === "newest" ? bt - at : at - bt
    })
    return sorted
  }, [rows, filter, query, sort])

  return (
    <div
      className="min-h-screen"
      style={{
        background: "var(--color-cream)",
        color: "var(--color-ink)",
        fontFamily: "var(--font-sans)",
      }}
    >
      {/* ── Header ───────────────────────────────────────────────────── */}
      <header className="mx-auto flex max-w-[1200px] items-center justify-between px-6 pt-8 pb-6 md:px-10">
        <Link to="/" className="flex items-center gap-2.5" style={{ color: "var(--color-forest)" }}>
          <ProposlMark size={32} />
          <span
            className="text-[22px] leading-none"
            style={{
              fontFamily: "var(--font-merchant-display)",
              fontWeight: 500,
              letterSpacing: "-0.01em",
            }}
          >
            proposl
          </span>
        </Link>
        <div className="flex items-center gap-5">
          {isAdmin && (
            <Link
              to="/admin"
              className="flex items-center gap-1.5 text-[13px] transition-colors hover:opacity-70"
              style={{ color: "var(--color-forest)" }}
              title="Proposl admin console"
            >
              <Shield className="h-3.5 w-3.5" />
              Admin
            </Link>
          )}
          {isOwner && (
            <>
              <Link
                to="/settings"
                className="flex items-center gap-1.5 text-[13px] transition-colors hover:opacity-70"
                style={{ color: "var(--color-ink-soft)" }}
                title="Account settings"
              >
                <Settings className="h-3.5 w-3.5" />
                Settings
              </Link>
              <Link
                to="/settings/team"
                className="flex items-center gap-1.5 text-[13px] transition-colors hover:opacity-70"
                style={{ color: "var(--color-ink-soft)" }}
                title="Team members"
              >
                <Users className="h-3.5 w-3.5" />
                Team
              </Link>
            </>
          )}
          <button
            onClick={handleSignOut}
            className="flex items-center gap-1.5 text-[13px] transition-colors hover:opacity-70"
            style={{ color: "var(--color-ink-soft)" }}
            title="Sign out"
          >
            <LogOut className="h-3.5 w-3.5" />
            Sign out
          </button>
          <Link
            to="/builder/new"
            className="flex items-center gap-2 rounded-full px-5 py-2.5 text-[13px] font-medium transition-transform hover:scale-[1.02]"
            style={{
              background: "var(--color-forest)",
              color: "var(--color-cream)",
            }}
          >
            <Plus className="h-4 w-4" />
            New proposal
          </Link>
        </div>
      </header>

      {/* ── Page heading + summary strip ─────────────────────────────── */}
      <section className="mx-auto max-w-[1200px] px-6 pt-16 pb-8 md:px-10 md:pt-24">
        <p
          className="mb-4 text-[11px] uppercase tracking-[0.18em]"
          style={{
            fontFamily: "var(--font-mono)",
            color: "var(--color-ink-mute)",
          }}
        >
          {account.studioName}
        </p>
        <h1
          className="text-[48px] leading-[1.05] tracking-[-0.015em] md:text-[64px]"
          style={{
            fontFamily: "var(--font-merchant-display)",
            fontWeight: 500,
            color: "var(--color-ink)",
          }}
        >
          Proposals
        </h1>

        {!loading && rows.length > 0 && (
          <div className="mt-8 grid grid-cols-2 gap-3 md:grid-cols-4">
            {FILTERS.map((f) => {
              const active = filter === f.key
              const count = counts[f.key]
              return (
                <button
                  key={f.key}
                  onClick={() => setFilter(f.key)}
                  className="rounded-2xl border p-4 text-left transition-colors md:p-5"
                  style={{
                    background: active ? "var(--color-forest)" : "var(--color-paper)",
                    borderColor: active ? "var(--color-forest)" : "var(--color-rule)",
                    color: active ? "var(--color-cream)" : "var(--color-ink)",
                  }}
                >
                  <p
                    className="text-[10px] uppercase tracking-[0.14em]"
                    style={{
                      fontFamily: "var(--font-mono)",
                      color: active ? "var(--color-cream)" : "var(--color-ink-mute)",
                      opacity: active ? 0.8 : 1,
                    }}
                  >
                    {f.label}
                  </p>
                  <p
                    className="mt-1 text-[28px] leading-none tracking-[-0.01em] md:text-[32px]"
                    style={{ fontFamily: "var(--font-merchant-display)", fontWeight: 500 }}
                  >
                    {count}
                  </p>
                </button>
              )
            })}
          </div>
        )}
      </section>

      {/* ── Search + sort controls ───────────────────────────────────── */}
      {!loading && rows.length > 0 && (
        <section className="mx-auto max-w-[1200px] px-6 pt-8 md:px-10">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div
              className="flex flex-1 items-center gap-2 rounded-full border px-4 py-2.5"
              style={{ background: "var(--color-paper)", borderColor: "var(--color-rule)" }}
            >
              <Search className="h-4 w-4" style={{ color: "var(--color-ink-mute)" }} />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search by title or client…"
                className="flex-1 bg-transparent text-[14px] outline-none"
                style={{ color: "var(--color-ink)" }}
              />
            </div>
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as SortOrder)}
              className="rounded-full border px-4 py-2.5 text-[13px] outline-none transition-colors"
              style={{
                background: "var(--color-paper)",
                borderColor: "var(--color-rule)",
                color: "var(--color-ink)",
                fontFamily: "var(--font-sans)",
              }}
            >
              {SORT_OPTIONS.map((o) => (
                <option key={o.key} value={o.key}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
        </section>
      )}

      {/* ── Proposal list ────────────────────────────────────────────── */}
      <section className="mx-auto max-w-[1200px] px-6 pt-6 pb-28 md:px-10">
        {loading ? (
          <p
            className="text-[13px] uppercase tracking-[0.14em]"
            style={{ fontFamily: "var(--font-mono)", color: "var(--color-ink-mute)" }}
          >
            LOADING…
          </p>
        ) : rows.length === 0 ? (
          <EmptyState />
        ) : visibleRows.length === 0 ? (
          <NoMatchesState filter={filter} query={query} onClear={() => { setFilter("all"); setQuery("") }} />
        ) : (
          <div className="space-y-5">
            {visibleRows.map((row) => (
              <ProposalCard
                key={row.id}
                row={row}
                copied={copiedId === row.id}
                onCopy={() => copyLink(row.slug, row.id)}
              />
            ))}
          </div>
        )}
      </section>

      {/* ── Footer ───────────────────────────────────────────────────── */}
      <Footer />
    </div>
  )
}

export default ProposalsDashboard

// ─────────────────────────────────────────────────────────────────────────────
// ProposalCard
// ─────────────────────────────────────────────────────────────────────────────

function ProposalCard({
  row,
  copied,
  onCopy,
}: {
  row: DashboardRow
  copied: boolean
  onCopy: () => void
}) {
  const { summary } = row
  const hasBeenSent = summary.sendCount > 0
  const status = hasBeenSent ? summary.latestDeliveryStatus || "sent" : "draft"

  return (
    <article
      className="group relative rounded-2xl border transition-all hover:shadow-[0_1px_3px_rgba(0,0,0,0.05),0_8px_24px_rgba(0,0,0,0.04)]"
      style={{
        background: "var(--color-paper)",
        borderColor: "var(--color-rule)",
      }}
    >
      {/*
        The whole card is a link to the detail page. Using an absolute-
        positioned Link overlay so the action buttons on the right can
        still be independently clickable without nesting <a> tags.
      */}
      <Link
        to={`/proposals/${row.id}`}
        className="absolute inset-0 z-0 rounded-2xl"
        aria-label={`Open ${row.title}`}
      >
        <span className="sr-only">Open {row.title}</span>
      </Link>

      {/*
        Content layer. `pointer-events-none` is on the OUTER div so that
        clicks anywhere in the card's padding or between child elements
        fall through to the overlay Link underneath. The actions div
        on the right re-enables pointer events so its buttons still work.
      */}
      <div className="pointer-events-none relative z-10 flex flex-col gap-5 px-6 py-6 md:flex-row md:items-start md:justify-between md:gap-8 md:px-8 md:py-7">
        {/* Left: title + client + metadata */}
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
            className="text-[24px] leading-[1.2] tracking-[-0.01em] transition-colors group-hover:opacity-90 md:text-[28px]"
            style={{
              fontFamily: "var(--font-merchant-display)",
              fontWeight: 500,
              color: "var(--color-ink)",
            }}
          >
            {row.title}
          </h2>

          {/* Mono metadata strip */}
          <p
            className="mt-3 text-[11px] uppercase tracking-[0.12em]"
            style={{
              fontFamily: "var(--font-mono)",
              color: "var(--color-ink-soft)",
            }}
          >
            <StatusPill status={status} />
            {hasBeenSent && summary.latestSentAt && (
              <>
                {" · "}
                SENT {timeSince(summary.latestSentAt).toUpperCase()}
              </>
            )}
            {!hasBeenSent && row.updated_at && (
              <>
                {" · "}
                EDITED {timeSince(row.updated_at).toUpperCase()}
              </>
            )}
            {summary.openCount > 0 && (
              <>
                {" · "}
                <span style={{ color: "var(--color-forest)" }}>{summary.openCount}</span>{" "}
                {summary.openCount === 1 ? "OPEN" : "OPENS"}
              </>
            )}
            {summary.clickCount > 0 && (
              <>
                {" · "}
                <span style={{ color: "var(--color-forest)" }}>{summary.clickCount}</span>{" "}
                {summary.clickCount === 1 ? "CLICK" : "CLICKS"}
              </>
            )}
            {summary.submissionCount > 0 && (
              <>
                {" · "}
                <span style={{ color: "var(--color-forest)" }}>{summary.submissionCount}</span>{" "}
                {summary.submissionCount === 1 ? "REPLY" : "REPLIES"}
              </>
            )}
          </p>
        </div>

        {/* Right: actions — re-enable pointer-events so buttons are clickable again */}
        <div className="pointer-events-auto relative z-20 flex shrink-0 items-center gap-5">
          <button
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
              onCopy()
            }}
            className="flex items-center gap-1.5 text-[12px] transition-colors hover:opacity-70"
            style={{ color: "var(--color-ink-soft)" }}
            title="Copy proposal link"
          >
            {copied ? (
              <>
                <Check className="h-3.5 w-3.5" style={{ color: "var(--color-forest)" }} />
                <span style={{ color: "var(--color-forest)" }}>Copied</span>
              </>
            ) : (
              <>
                <Copy className="h-3.5 w-3.5" />
                Copy link
              </>
            )}
          </button>
          <a
            href={`/p/${row.slug}`}
            target="_blank"
            rel="noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="text-[12px] transition-colors hover:opacity-70"
            style={{ color: "var(--color-ink-soft)" }}
          >
            View
          </a>
          <Link
            to={`/builder/${row.id}`}
            onClick={(e) => e.stopPropagation()}
            className="text-[12px] font-medium transition-colors hover:opacity-70"
            style={{ color: "var(--color-forest)" }}
          >
            Edit →
          </Link>
        </div>
      </div>
    </article>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// StatusPill
// ─────────────────────────────────────────────────────────────────────────────

function StatusPill({ status }: { status: string }) {
  const normalized = status.toLowerCase()
  const label =
    normalized === "delivered"
      ? "DELIVERED"
      : normalized === "bounced"
      ? "BOUNCED"
      : normalized === "failed"
      ? "FAILED"
      : normalized === "complained"
      ? "SPAM"
      : normalized === "delivery_delayed"
      ? "DELAYED"
      : normalized === "sent"
      ? "SENT"
      : normalized === "draft"
      ? "DRAFT"
      : normalized.toUpperCase()

  // Forest for good states, muted for draft, warm amber for attention, red for errors
  const isError = ["bounced", "failed", "complained"].includes(normalized)
  const isWarn = ["delivery_delayed"].includes(normalized)
  const isGood = ["delivered", "sent"].includes(normalized)

  const color = isError
    ? "#A33B28"
    : isWarn
    ? "#B5821C"
    : isGood
    ? "var(--color-forest)"
    : "var(--color-ink-mute)"

  return <span style={{ color }}>{label}</span>
}

// ─────────────────────────────────────────────────────────────────────────────
// EmptyState
// ─────────────────────────────────────────────────────────────────────────────

function NoMatchesState({
  filter,
  query,
  onClear,
}: {
  filter: Filter
  query: string
  onClear: () => void
}) {
  const filterLabel = FILTERS.find((f) => f.key === filter)?.label
  const eyebrow = query ? "No matches" : "Nothing here"
  const title = query
    ? `Nothing matches "${query}"`
    : filter === "drafts"
      ? "No drafts right now."
      : filter === "sent"
        ? "Nothing sent that hasn't come back yet."
        : filter === "submitted"
          ? "No submissions yet."
          : "Nothing here."
  const subtitle =
    filter !== "all" && !query && filterLabel
      ? `Try another filter or clear the current one.`
      : null
  return (
    <div
      className="flex flex-col items-start gap-5 rounded-2xl border px-8 py-12 md:px-10 md:py-14"
      style={{ background: "var(--color-paper)", borderColor: "var(--color-rule)" }}
    >
      <p
        className="text-[11px] uppercase tracking-[0.14em]"
        style={{ fontFamily: "var(--font-mono)", color: "var(--color-ink-mute)" }}
      >
        {eyebrow}
      </p>
      <h2
        className="max-w-[20ch] text-[26px] leading-[1.2] tracking-[-0.01em] md:text-[30px]"
        style={{ fontFamily: "var(--font-merchant-display)", fontWeight: 500 }}
      >
        {title}
      </h2>
      {subtitle && (
        <p className="text-[14px]" style={{ color: "var(--color-ink-soft)" }}>
          {subtitle}
        </p>
      )}
      <button
        onClick={onClear}
        className="rounded-full border px-4 py-2 text-[12px] font-medium transition-colors hover:opacity-80"
        style={{ borderColor: "var(--color-forest)", color: "var(--color-forest)" }}
      >
        Clear filters
      </button>
    </div>
  )
}

function EmptyState() {
  return (
    <div
      className="flex flex-col items-start gap-6 rounded-2xl border px-8 py-16 md:px-12 md:py-20"
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
        NOTHING HERE YET
      </p>
      <h2
        className="max-w-[18ch] text-[32px] leading-[1.1] tracking-[-0.01em] md:text-[40px]"
        style={{
          fontFamily: "var(--font-merchant-display)",
          fontWeight: 500,
          color: "var(--color-ink)",
        }}
      >
        No proposals yet. Your first one takes about three minutes.
      </h2>
      <Link
        to="/builder/new"
        className="inline-flex items-center gap-2 rounded-full px-6 py-3 text-[13px] font-medium transition-transform hover:scale-[1.02]"
        style={{
          background: "var(--color-forest)",
          color: "var(--color-cream)",
        }}
      >
        <Plus className="h-4 w-4" />
        Start a proposal
      </Link>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Footer
// ─────────────────────────────────────────────────────────────────────────────

function Footer() {
  return (
    <footer
      className="border-t px-6 py-10 md:px-10"
      style={{ borderColor: "var(--color-rule)" }}
    >
      <div className="mx-auto flex max-w-[1200px] flex-col items-start gap-6 md:flex-row md:items-center md:justify-between">
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
        <Link
          to="/proposals/deleted"
          className="text-[11px] uppercase tracking-[0.14em] transition-colors hover:opacity-70"
          style={{
            fontFamily: "var(--font-mono)",
            color: "var(--color-ink-mute)",
          }}
        >
          RECENTLY DELETED →
        </Link>
        <p
          className="text-[11px] uppercase tracking-[0.14em]"
          style={{
            fontFamily: "var(--font-mono)",
            color: "var(--color-ink-mute)",
          }}
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
  )
}
