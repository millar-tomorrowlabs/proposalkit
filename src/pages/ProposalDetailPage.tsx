/**
 * Proposal Detail Page — /proposals/:id
 *
 * Everything about one proposal at a glance:
 *   - Header with status, client, quick stats strip
 *   - Quick actions: Edit, Send, Copy link, View as client
 *   - Activity timeline (merged chronological feed with color pops)
 *   - Sends grouped by recipient
 *   - Submissions (CTA replies from clients)
 *   - Danger zone: delete (soft delete)
 *
 * Styled in the Studio Editorial language to match the dashboard
 * and landing page.
 */

import { useCallback, useEffect, useMemo, useState } from "react"
import { Link, useNavigate, useParams } from "react-router-dom"
import { supabase } from "@/lib/supabase"
import { useAccount } from "@/contexts/AccountContext"
import {
  ArrowLeft,
  Check,
  Copy,
  Edit2,
  ExternalLink,
  Send,
  Trash2,
} from "lucide-react"
import ProposlMark from "@/components/brand/ProposlMark"
import SendProposalDialog from "@/components/proposal/SendProposalDialog"
import type { ProposalData } from "@/types/proposal"

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface SendRecord {
  id: string
  recipient_name: string
  recipient_email: string
  subject: string
  send_type: string
  sent_at: string
  delivery_status: string | null
  delivered_at: string | null
  bounced_at: string | null
  opened_at: string | null
  last_opened_at: string | null
  open_count: number
  clicked_at: string | null
  last_clicked_at: string | null
  click_count: number
}

interface Submission {
  id: string
  client_name: string
  client_email: string
  message: string | null
  package_label: string | null
  total_price: number | null
  currency: string | null
  created_at: string
}

type TimelineEventType =
  | "created"
  | "edited"
  | "sent"
  | "delivered"
  | "opened"
  | "clicked"
  | "bounced"
  | "submission"

interface TimelineEvent {
  id: string
  timestamp: string
  type: TimelineEventType
  label: string
  detail?: string
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

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  })
}

function colorForEvent(type: TimelineEventType): string {
  switch (type) {
    case "created":
    case "edited":
      return "var(--color-ink-mute)"
    case "sent":
      return "var(--color-ochre)"
    case "delivered":
    case "opened":
      return "var(--color-forest)"
    case "clicked":
      return "var(--color-forest-deep)"
    case "submission":
      return "var(--color-ochre)"
    case "bounced":
      return "#A33B28"
    default:
      return "var(--color-ink-mute)"
  }
}

/**
 * Build a merged timeline from the proposal, its sends, and its submissions.
 * Sorted newest-first.
 */
function buildTimeline(
  proposal: ProposalData,
  sends: SendRecord[],
  submissions: Submission[],
): TimelineEvent[] {
  const events: TimelineEvent[] = []

  // Created
  if (proposal.createdAt) {
    events.push({
      id: `${proposal.id}-created`,
      timestamp: proposal.createdAt,
      type: "created",
      label: "Proposal created",
    })
  }

  // Edited (only if noticeably different from created — > 60s apart)
  if (
    proposal.updatedAt &&
    proposal.createdAt &&
    new Date(proposal.updatedAt).getTime() -
      new Date(proposal.createdAt).getTime() >
      60_000
  ) {
    events.push({
      id: `${proposal.id}-edited`,
      timestamp: proposal.updatedAt,
      type: "edited",
      label: "Proposal edited",
    })
  }

  // Sends and their lifecycle
  for (const send of sends) {
    events.push({
      id: `${send.id}-sent`,
      timestamp: send.sent_at,
      type: "sent",
      label: `Sent to ${send.recipient_name}`,
      detail: send.recipient_email,
    })
    if (send.delivered_at) {
      events.push({
        id: `${send.id}-delivered`,
        timestamp: send.delivered_at,
        type: "delivered",
        label: "Delivered",
        detail: send.recipient_email,
      })
    }
    if (send.bounced_at) {
      events.push({
        id: `${send.id}-bounced`,
        timestamp: send.bounced_at,
        type: "bounced",
        label: "Bounced",
        detail: send.recipient_email,
      })
    }
    // First open. Apple Mail pre-fetch check: if opened within 5s of
    // delivery, suppress the event entirely (almost certainly not a human).
    if (send.opened_at) {
      const delta =
        send.delivered_at
          ? new Date(send.opened_at).getTime() -
            new Date(send.delivered_at).getTime()
          : Infinity
      const isPrefetch = delta >= 0 && delta < 5000
      if (!isPrefetch) {
        events.push({
          id: `${send.id}-opened`,
          timestamp: send.opened_at,
          type: "opened",
          label:
            send.open_count > 1
              ? `Opened ${send.open_count} times`
              : "Opened",
          detail: send.recipient_name,
        })
      }
    }
    if (send.clicked_at) {
      events.push({
        id: `${send.id}-clicked`,
        timestamp: send.clicked_at,
        type: "clicked",
        label:
          send.click_count > 1
            ? `Clicked ${send.click_count} times`
            : "Clicked the link",
        detail: send.recipient_name,
      })
    }
  }

  // Submissions (the big wins)
  for (const sub of submissions) {
    events.push({
      id: `${sub.id}-submitted`,
      timestamp: sub.created_at,
      type: "submission",
      label: `${sub.client_name} replied`,
      detail: sub.package_label ? `Selected: ${sub.package_label}` : undefined,
    })
  }

  // Sort newest first
  events.sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
  )

  return events
}

// ─────────────────────────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────────────────────────

export default function ProposalDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { account } = useAccount()

  const [proposal, setProposal] = useState<ProposalData | null>(null)
  const [sends, setSends] = useState<SendRecord[]>([])
  const [submissions, setSubmissions] = useState<Submission[]>([])
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [showSendDialog, setShowSendDialog] = useState(false)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [copied, setCopied] = useState(false)

  // Load everything
  const load = useCallback(async () => {
    if (!id) return
    setLoading(true)

    const [proposalRes, sendsRes, subsRes] = await Promise.all([
      supabase
        .from("proposals")
        .select("*")
        .eq("id", id)
        .is("deleted_at", null)
        .maybeSingle(),
      supabase
        .from("proposal_sends")
        .select(
          "id, recipient_name, recipient_email, subject, send_type, sent_at, delivery_status, delivered_at, bounced_at, opened_at, last_opened_at, open_count, clicked_at, last_clicked_at, click_count",
        )
        .eq("proposal_id", id)
        .order("sent_at", { ascending: false }),
      supabase
        .from("submissions")
        .select("id, client_name, client_email, message, package_label, total_price, currency, created_at")
        .eq("proposal_id", id)
        .order("created_at", { ascending: false }),
    ])

    if (!proposalRes.data) {
      setNotFound(true)
      setLoading(false)
      return
    }

    // Flatten proposal.data JSONB into the ProposalData shape
    const raw = proposalRes.data
    const flat: ProposalData = {
      ...(raw.data ?? {}),
      id: raw.id,
      slug: raw.slug,
      title: raw.title,
      clientName: raw.client_name,
      brandColor1: raw.brand_color_1 ?? "#000000",
      brandColor2: raw.brand_color_2 ?? "#6b7280",
      heroImageUrl: raw.hero_image_url ?? undefined,
      ctaEmail: raw.cta_email ?? "",
      status: raw.status,
      sections: raw.sections ?? ["summary", "scope", "timeline", "investment", "cta"],
      createdAt: raw.created_at,
      updatedAt: raw.updated_at,
    }

    setProposal(flat)
    setSends((sendsRes.data ?? []) as SendRecord[])
    setSubmissions((subsRes.data ?? []) as Submission[])
    setLoading(false)
  }, [id])

  useEffect(() => {
    load()
  }, [load])

  // Aggregate summary
  const summary = useMemo(() => {
    const sendCount = sends.length
    const totalOpens = sends.reduce((acc, s) => acc + (s.open_count || 0), 0)
    const totalClicks = sends.reduce((acc, s) => acc + (s.click_count || 0), 0)
    const submissionCount = submissions.length
    const latestSent = sends[0]?.sent_at ?? null
    const latestStatus = sends[0]?.delivery_status ?? null
    return {
      sendCount,
      totalOpens,
      totalClicks,
      submissionCount,
      latestSent,
      latestStatus,
    }
  }, [sends, submissions])

  const timeline = useMemo(
    () => (proposal ? buildTimeline(proposal, sends, submissions) : []),
    [proposal, sends, submissions],
  )

  // Sends grouped by recipient
  const sendsByRecipient = useMemo(() => {
    const map = new Map<string, SendRecord[]>()
    for (const send of sends) {
      const existing = map.get(send.recipient_email) ?? []
      existing.push(send)
      map.set(send.recipient_email, existing)
    }
    return Array.from(map.entries()).map(([email, rows]) => ({
      email,
      name: rows[0].recipient_name,
      rows,
      latestSent: rows[0].sent_at,
      totalOpens: rows.reduce((acc, r) => acc + (r.open_count || 0), 0),
      totalClicks: rows.reduce((acc, r) => acc + (r.click_count || 0), 0),
    }))
  }, [sends])

  const copyLink = useCallback(() => {
    if (!proposal) return
    navigator.clipboard.writeText(
      `${window.location.origin}/p/${proposal.slug || proposal.id}`,
    )
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }, [proposal])

  const handleDelete = useCallback(async () => {
    if (!proposal?.id) return
    await supabase
      .from("proposals")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", proposal.id)
    navigate("/proposals")
  }, [proposal?.id, navigate])

  // ── Render ──────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div
        className="min-h-screen"
        style={{ background: "var(--color-cream)", color: "var(--color-ink)" }}
      >
        <DetailHeader />
        <div className="mx-auto max-w-[1000px] px-6 pt-24 md:px-10">
          <p
            className="text-[11px] uppercase tracking-[0.14em]"
            style={{ fontFamily: "var(--font-mono)", color: "var(--color-ink-mute)" }}
          >
            LOADING…
          </p>
        </div>
      </div>
    )
  }

  if (notFound || !proposal) {
    return (
      <div
        className="min-h-screen"
        style={{ background: "var(--color-cream)", color: "var(--color-ink)" }}
      >
        <DetailHeader />
        <div className="mx-auto max-w-[1000px] px-6 pt-24 md:px-10">
          <p
            className="text-[11px] uppercase tracking-[0.14em]"
            style={{ fontFamily: "var(--font-mono)", color: "var(--color-ink-mute)" }}
          >
            NOT FOUND
          </p>
          <h1
            className="mt-4 text-[40px] leading-[1.1] tracking-[-0.01em]"
            style={{
              fontFamily: "var(--font-merchant-display)",
              fontWeight: 500,
            }}
          >
            This proposal doesn't exist or has been deleted.
          </h1>
          <Link
            to="/proposals"
            className="mt-8 inline-flex items-center gap-2 text-[14px] font-medium transition-colors hover:opacity-70"
            style={{ color: "var(--color-forest)" }}
          >
            <ArrowLeft className="h-4 w-4" />
            Back to proposals
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div
      className="min-h-screen"
      style={{
        background: "var(--color-cream)",
        color: "var(--color-ink)",
        fontFamily: "var(--font-sans)",
      }}
    >
      <DetailHeader />

      {/* ── Back link ───────────────────────────────────────────────── */}
      <div className="mx-auto max-w-[1000px] px-6 pt-8 md:px-10">
        <Link
          to="/proposals"
          className="inline-flex items-center gap-2 text-[12px] uppercase tracking-[0.14em] transition-colors hover:opacity-60"
          style={{ fontFamily: "var(--font-mono)", color: "var(--color-ink-mute)" }}
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          BACK TO PROPOSALS
        </Link>
      </div>

      {/* ── Title block ─────────────────────────────────────────────── */}
      <section className="mx-auto max-w-[1000px] px-6 pt-8 pb-6 md:px-10 md:pt-12">
        <p
          className="mb-3 text-[11px] uppercase tracking-[0.18em]"
          style={{ fontFamily: "var(--font-mono)", color: "var(--color-ink-mute)" }}
        >
          {proposal.clientName || "UNKNOWN CLIENT"}
        </p>
        <h1
          className="text-[40px] leading-[1.05] tracking-[-0.015em] md:text-[56px]"
          style={{
            fontFamily: "var(--font-merchant-display)",
            fontWeight: 500,
          }}
        >
          {proposal.title}
        </h1>

        {/* Mono stats strip */}
        <p
          className="mt-5 text-[11px] uppercase tracking-[0.14em]"
          style={{
            fontFamily: "var(--font-mono)",
            color: "var(--color-ink-soft)",
          }}
        >
          {summary.sendCount === 0 ? (
            <span>DRAFT · NEVER SENT</span>
          ) : (
            <>
              <StatusPill status={summary.latestStatus || "sent"} />
              {summary.latestSent && (
                <>
                  {" · "}
                  SENT {timeSince(summary.latestSent).toUpperCase()}
                </>
              )}
              {summary.totalOpens > 0 && (
                <>
                  {" · "}
                  <span style={{ color: "var(--color-forest)" }}>
                    {summary.totalOpens}
                  </span>{" "}
                  {summary.totalOpens === 1 ? "OPEN" : "OPENS"}
                </>
              )}
              {summary.totalClicks > 0 && (
                <>
                  {" · "}
                  <span style={{ color: "var(--color-forest-deep)" }}>
                    {summary.totalClicks}
                  </span>{" "}
                  {summary.totalClicks === 1 ? "CLICK" : "CLICKS"}
                </>
              )}
              {summary.submissionCount > 0 && (
                <>
                  {" · "}
                  <span style={{ color: "var(--color-ochre)" }}>
                    {summary.submissionCount}
                  </span>{" "}
                  {summary.submissionCount === 1 ? "REPLY" : "REPLIES"}
                </>
              )}
            </>
          )}
        </p>
      </section>

      {/* ── Quick actions ───────────────────────────────────────────── */}
      <section className="mx-auto max-w-[1000px] px-6 pb-12 md:px-10">
        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={() => setShowSendDialog(true)}
            className="flex items-center gap-2 rounded-full px-5 py-2.5 text-[13px] font-medium transition-transform hover:scale-[1.02]"
            style={{
              background: "var(--color-forest)",
              color: "var(--color-cream)",
            }}
          >
            <Send className="h-4 w-4" />
            {summary.sendCount > 0 ? "Send again" : "Send proposal"}
          </button>
          <Link
            to={`/builder/${proposal.id}`}
            className="flex items-center gap-2 rounded-full border px-5 py-2.5 text-[13px] font-medium transition-colors hover:opacity-80"
            style={{
              borderColor: "var(--color-rule)",
              color: "var(--color-ink)",
            }}
          >
            <Edit2 className="h-4 w-4" />
            Edit
          </Link>
          <button
            onClick={copyLink}
            className="flex items-center gap-2 rounded-full border px-5 py-2.5 text-[13px] font-medium transition-colors hover:opacity-80"
            style={{
              borderColor: "var(--color-rule)",
              color: "var(--color-ink)",
            }}
          >
            {copied ? (
              <>
                <Check className="h-4 w-4" style={{ color: "var(--color-forest)" }} />
                <span style={{ color: "var(--color-forest)" }}>Copied</span>
              </>
            ) : (
              <>
                <Copy className="h-4 w-4" />
                Copy link
              </>
            )}
          </button>
          <a
            href={`/p/${proposal.slug || proposal.id}`}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-2 rounded-full border px-5 py-2.5 text-[13px] font-medium transition-colors hover:opacity-80"
            style={{
              borderColor: "var(--color-rule)",
              color: "var(--color-ink)",
            }}
          >
            <ExternalLink className="h-4 w-4" />
            View as client
          </a>
        </div>
      </section>

      {/* ── Activity timeline ───────────────────────────────────────── */}
      <section
        className="border-t px-6 py-14 md:px-10"
        style={{ borderColor: "var(--color-rule)" }}
      >
        <div className="mx-auto max-w-[1000px]">
          <p
            className="mb-8 text-[11px] uppercase tracking-[0.18em]"
            style={{
              fontFamily: "var(--font-mono)",
              color: "var(--color-ink-mute)",
            }}
          >
            ACTIVITY
          </p>
          {timeline.length === 0 ? (
            <p
              className="text-[13px]"
              style={{ color: "var(--color-ink-soft)" }}
            >
              Nothing to show yet. When you send this proposal, activity will appear here.
            </p>
          ) : (
            <ol className="relative">
              {/* Vertical rule line */}
              <span
                aria-hidden="true"
                className="absolute left-[5px] top-2 bottom-2 w-px"
                style={{ background: "var(--color-rule)" }}
              />
              {timeline.map((event) => (
                <li
                  key={event.id}
                  className="relative flex gap-5 pb-6 last:pb-0"
                >
                  <span
                    className="relative z-10 mt-1.5 h-[11px] w-[11px] flex-shrink-0 rounded-full"
                    style={{
                      background: colorForEvent(event.type),
                      boxShadow: "0 0 0 3px var(--color-cream)",
                    }}
                  />
                  <div className="flex-1 min-w-0">
                    <p
                      className="text-[15px]"
                      style={{ color: "var(--color-ink)" }}
                    >
                      {event.label}
                    </p>
                    <p
                      className="mt-1 text-[11px] uppercase tracking-[0.12em]"
                      style={{
                        fontFamily: "var(--font-mono)",
                        color: "var(--color-ink-mute)",
                      }}
                    >
                      {timeSince(event.timestamp).toUpperCase()}
                      {event.detail && ` · ${event.detail.toUpperCase()}`}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </div>
      </section>

      {/* ── Sends by recipient ──────────────────────────────────────── */}
      {sendsByRecipient.length > 0 && (
        <section
          className="border-t px-6 py-14 md:px-10"
          style={{ borderColor: "var(--color-rule)" }}
        >
          <div className="mx-auto max-w-[1000px]">
            <p
              className="mb-8 text-[11px] uppercase tracking-[0.18em]"
              style={{
                fontFamily: "var(--font-mono)",
                color: "var(--color-ink-mute)",
              }}
            >
              SENDS
            </p>
            <div className="space-y-6">
              {sendsByRecipient.map((group) => (
                <div
                  key={group.email}
                  className="rounded-2xl border p-6 md:p-7"
                  style={{
                    background: "var(--color-paper)",
                    borderColor: "var(--color-rule)",
                  }}
                >
                  <div className="flex flex-col gap-2 md:flex-row md:items-baseline md:justify-between">
                    <div>
                      <h3
                        className="text-[20px] leading-[1.2] tracking-[-0.01em]"
                        style={{
                          fontFamily: "var(--font-merchant-display)",
                          fontWeight: 500,
                        }}
                      >
                        {group.name}
                      </h3>
                      <p
                        className="mt-0.5 text-[12px]"
                        style={{ color: "var(--color-ink-soft)" }}
                      >
                        {group.email}
                      </p>
                    </div>
                    <p
                      className="text-[11px] uppercase tracking-[0.12em]"
                      style={{
                        fontFamily: "var(--font-mono)",
                        color: "var(--color-ink-soft)",
                      }}
                    >
                      {group.rows.length} {group.rows.length === 1 ? "SEND" : "SENDS"}
                      {group.totalOpens > 0 && (
                        <>
                          {" · "}
                          <span style={{ color: "var(--color-forest)" }}>
                            {group.totalOpens}
                          </span>{" "}
                          {group.totalOpens === 1 ? "OPEN" : "OPENS"}
                        </>
                      )}
                      {group.totalClicks > 0 && (
                        <>
                          {" · "}
                          <span style={{ color: "var(--color-forest-deep)" }}>
                            {group.totalClicks}
                          </span>{" "}
                          {group.totalClicks === 1 ? "CLICK" : "CLICKS"}
                        </>
                      )}
                    </p>
                  </div>
                  <div
                    className="mt-5 space-y-3 border-t pt-4"
                    style={{ borderColor: "var(--color-rule)" }}
                  >
                    {group.rows.map((row) => (
                      <div
                        key={row.id}
                        className="flex items-center justify-between gap-4 text-[12px]"
                      >
                        <span style={{ color: "var(--color-ink-soft)" }}>
                          {row.send_type === "reminder" ? "Reminder" : "Initial send"}{" "}
                          · {formatDateTime(row.sent_at)}
                        </span>
                        <StatusPill status={row.delivery_status || "sent"} />
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ── Submissions ─────────────────────────────────────────────── */}
      {submissions.length > 0 && (
        <section
          className="border-t px-6 py-14 md:px-10"
          style={{ borderColor: "var(--color-rule)" }}
        >
          <div className="mx-auto max-w-[1000px]">
            <p
              className="mb-8 text-[11px] uppercase tracking-[0.18em]"
              style={{
                fontFamily: "var(--font-mono)",
                color: "var(--color-ink-mute)",
              }}
            >
              SUBMISSIONS
            </p>
            <div className="space-y-5">
              {submissions.map((sub) => (
                <div
                  key={sub.id}
                  className="rounded-2xl border p-6 md:p-7"
                  style={{
                    background: "var(--color-paper)",
                    borderColor: "var(--color-rule)",
                  }}
                >
                  <div className="flex flex-col gap-2 md:flex-row md:items-baseline md:justify-between">
                    <div>
                      <h3
                        className="text-[20px] leading-[1.2] tracking-[-0.01em]"
                        style={{
                          fontFamily: "var(--font-merchant-display)",
                          fontWeight: 500,
                        }}
                      >
                        {sub.client_name}
                      </h3>
                      <p
                        className="mt-0.5 text-[12px]"
                        style={{ color: "var(--color-ink-soft)" }}
                      >
                        {sub.client_email}
                      </p>
                    </div>
                    <p
                      className="text-[11px] uppercase tracking-[0.12em]"
                      style={{
                        fontFamily: "var(--font-mono)",
                        color: "var(--color-ochre)",
                      }}
                    >
                      {timeSince(sub.created_at).toUpperCase()}
                    </p>
                  </div>
                  {sub.package_label && (
                    <p
                      className="mt-4 text-[13px]"
                      style={{ color: "var(--color-ink-soft)" }}
                    >
                      Selected package:{" "}
                      <span style={{ color: "var(--color-ink)" }}>
                        {sub.package_label}
                      </span>
                      {sub.total_price != null && (
                        <>
                          {" "}·{" "}
                          {new Intl.NumberFormat("en-US", {
                            style: "currency",
                            currency: sub.currency || "USD",
                            minimumFractionDigits: 0,
                          }).format(sub.total_price)}
                        </>
                      )}
                    </p>
                  )}
                  {sub.message && (
                    <blockquote
                      className="mt-4 border-l-2 pl-4 text-[14px] leading-[1.55]"
                      style={{
                        borderColor: "var(--color-forest)",
                        color: "var(--color-ink-soft)",
                      }}
                    >
                      {sub.message}
                    </blockquote>
                  )}
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ── Danger zone ─────────────────────────────────────────────── */}
      <section
        className="border-t px-6 py-14 md:px-10"
        style={{ borderColor: "var(--color-rule)" }}
      >
        <div className="mx-auto max-w-[1000px]">
          <p
            className="mb-3 text-[11px] uppercase tracking-[0.18em]"
            style={{
              fontFamily: "var(--font-mono)",
              color: "#A33B28",
            }}
          >
            DANGER ZONE
          </p>
          <div className="flex flex-col gap-4 rounded-2xl border p-6 md:flex-row md:items-center md:justify-between md:p-7" style={{
            borderColor: "#E5C9C1",
            background: "#F9F0ED",
          }}>
            <div>
              <p
                className="text-[14px] font-medium"
                style={{ color: "var(--color-ink)" }}
              >
                Delete this proposal
              </p>
              <p
                className="mt-1 text-[13px]"
                style={{ color: "var(--color-ink-soft)" }}
              >
                It will be moved to Recently Deleted and can be restored for 30 days.
              </p>
            </div>
            <button
              onClick={() => setShowDeleteDialog(true)}
              className="flex items-center gap-2 rounded-full border px-5 py-2.5 text-[13px] font-medium transition-colors hover:opacity-80"
              style={{
                borderColor: "#A33B28",
                color: "#A33B28",
              }}
            >
              <Trash2 className="h-4 w-4" />
              Delete proposal
            </button>
          </div>
        </div>
      </section>

      {/* ── Footer ──────────────────────────────────────────────────── */}
      <DetailFooter />

      {/* Dialogs */}
      <SendProposalDialog
        open={showSendDialog}
        onClose={() => setShowSendDialog(false)}
        proposal={proposal}
        account={{
          studioName: account.studioName,
          senderName: account.senderName,
          website: account.website,
        }}
        onSendComplete={load}
      />

      <DeleteConfirmDialog
        open={showDeleteDialog}
        onClose={() => setShowDeleteDialog(false)}
        proposalTitle={proposal.title}
        onConfirm={handleDelete}
      />
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// DetailHeader
// ─────────────────────────────────────────────────────────────────────────────

function DetailHeader() {
  return (
    <header className="mx-auto flex max-w-[1200px] items-center justify-between px-6 pt-8 pb-6 md:px-10">
      <Link
        to="/proposals"
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
  )
}

function DetailFooter() {
  return (
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
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// StatusPill (inline, same color system as dashboard)
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
// DeleteConfirmDialog
// ─────────────────────────────────────────────────────────────────────────────

function DeleteConfirmDialog({
  open,
  onClose,
  proposalTitle,
  onConfirm,
}: {
  open: boolean
  onClose: () => void
  proposalTitle: string
  onConfirm: () => void
}) {
  const [confirmText, setConfirmText] = useState("")

  if (!open) return null

  const match = confirmText.trim().toLowerCase() === "delete"

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-4"
      style={{
        background: "rgba(26, 23, 20, 0.6)",
        backdropFilter: "blur(4px)",
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        className="w-full max-w-md rounded-2xl border p-7 shadow-[0_4px_12px_rgba(0,0,0,0.08),0_32px_64px_rgba(0,0,0,0.12)]"
        style={{
          background: "var(--color-cream)",
          borderColor: "var(--color-rule)",
          fontFamily: "var(--font-sans)",
          color: "var(--color-ink)",
        }}
      >
        <p
          className="mb-3 text-[11px] uppercase tracking-[0.14em]"
          style={{ fontFamily: "var(--font-mono)", color: "#A33B28" }}
        >
          DELETE PROPOSAL
        </p>
        <h2
          className="text-[24px] leading-[1.2] tracking-[-0.01em]"
          style={{
            fontFamily: "var(--font-merchant-display)",
            fontWeight: 500,
          }}
        >
          Delete "{proposalTitle}"?
        </h2>
        <p
          className="mt-3 text-[13px] leading-[1.55]"
          style={{ color: "var(--color-ink-soft)" }}
        >
          This will move the proposal to Recently Deleted. You can restore it
          within 30 days. After that it's gone for good.
        </p>

        <label className="mt-5 block">
          <span
            className="mb-1.5 block text-[11px] uppercase tracking-[0.12em]"
            style={{ fontFamily: "var(--font-mono)", color: "var(--color-ink-mute)" }}
          >
            TYPE "DELETE" TO CONFIRM
          </span>
          <input
            type="text"
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            placeholder="delete"
            className="w-full rounded-lg border bg-white/50 px-3 py-2.5 text-[14px] outline-none"
            style={{
              borderColor: "var(--color-rule)",
              color: "var(--color-ink)",
            }}
          />
        </label>

        <div className="mt-6 flex items-center justify-end gap-3">
          <button
            onClick={onClose}
            className="text-[13px] font-medium transition-colors hover:opacity-70"
            style={{ color: "var(--color-ink-soft)" }}
          >
            Cancel
          </button>
          <button
            onClick={() => {
              if (match) {
                onConfirm()
                setConfirmText("")
              }
            }}
            disabled={!match}
            className="flex items-center gap-2 rounded-full px-5 py-2.5 text-[13px] font-medium transition-opacity disabled:opacity-40"
            style={{
              background: "#A33B28",
              color: "var(--color-cream)",
            }}
          >
            <Trash2 className="h-4 w-4" />
            Delete proposal
          </button>
        </div>
      </div>
    </div>
  )
}
