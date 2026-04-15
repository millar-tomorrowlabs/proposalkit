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
import { Plus, Copy, Check, LogOut, Settings, Users } from "lucide-react"
import ProposlMark from "@/components/brand/ProposlMark"

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
  const [rows, setRows] = useState<DashboardRow[]>([])
  const [loading, setLoading] = useState(true)
  const [copiedId, setCopiedId] = useState<string | null>(null)
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

  // Top summary strip: total, sent, opened, replied
  const summary = useMemo(() => {
    const total = rows.length
    const sent = rows.filter((r) => r.summary.sendCount > 0).length
    const viewed = rows.filter((r) => r.summary.openCount > 0).length
    const replied = rows.filter((r) => r.summary.submissionCount > 0).length
    return { total, sent, viewed, replied }
  }, [rows])

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
            to="/new"
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
          <p
            className="mt-6 text-[11px] uppercase tracking-[0.14em]"
            style={{
              fontFamily: "var(--font-mono)",
              color: "var(--color-ink-soft)",
            }}
          >
            <span style={{ color: "var(--color-forest)" }}>{summary.total}</span>{" "}
            {summary.total === 1 ? "PROPOSAL" : "PROPOSALS"}
            {summary.sent > 0 && (
              <>
                {" · "}
                <span style={{ color: "var(--color-forest)" }}>{summary.sent}</span> SENT
              </>
            )}
            {summary.viewed > 0 && (
              <>
                {" · "}
                <span style={{ color: "var(--color-forest)" }}>{summary.viewed}</span> VIEWED
              </>
            )}
            {summary.replied > 0 && (
              <>
                {" · "}
                <span style={{ color: "var(--color-forest)" }}>{summary.replied}</span>{" "}
                {summary.replied === 1 ? "REPLY" : "REPLIES"}
              </>
            )}
          </p>
        )}
      </section>

      {/* ── Proposal list ────────────────────────────────────────────── */}
      <section className="mx-auto max-w-[1200px] px-6 pb-28 md:px-10">
        {loading ? (
          <p
            className="text-[13px] uppercase tracking-[0.14em]"
            style={{ fontFamily: "var(--font-mono)", color: "var(--color-ink-mute)" }}
          >
            LOADING…
          </p>
        ) : rows.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="space-y-5">
            {rows.map((row) => (
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

      <div className="relative z-10 flex flex-col gap-5 px-6 py-6 md:flex-row md:items-start md:justify-between md:gap-8 md:px-8 md:py-7">
        {/* Left: title + client + metadata — pointer-events-none so clicks fall through to the overlay Link */}
        <div className="pointer-events-none min-w-0 flex-1">
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

        {/* Right: actions — own pointer-events so they sit above the overlay Link */}
        <div className="relative z-20 flex shrink-0 items-center gap-5">
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
        to="/new"
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
