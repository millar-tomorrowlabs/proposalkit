/**
 * SendProposalDialog — reusable modal for sending a proposal to a client.
 *
 * Used by both the builder (top bar Send button) and the proposal detail
 * page (`/proposals/:id`). Owns the form state, send API call, send history
 * query, empty-section warnings, and reminder flow. The parent only needs
 * to pass the proposal data and handle open/close.
 *
 * Styled in Studio Editorial — cream + forest tokens. Matches the detail
 * page and landing page aesthetic.
 */

import { useCallback, useEffect, useMemo, useState } from "react"
import { AlertTriangle, Check, Send, X } from "lucide-react"
import { supabase } from "@/lib/supabase"
import { validateProposalForSend } from "@/lib/proposalValidation"
import type { ProposalData } from "@/types/proposal"

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface SendHistoryRow {
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

interface AccountContext {
  studioName?: string
  senderName?: string
  website?: string
}

interface Props {
  open: boolean
  onClose: () => void
  proposal: ProposalData
  account: AccountContext
  /** Called after a successful send so the parent can refresh its data. */
  onSendComplete?: () => void
}

// ─────────────────────────────────────────────────────────────────────────────
// Utils
// ─────────────────────────────────────────────────────────────────────────────

function timeSince(iso: string | null): string {
  if (!iso) return "never"
  const secs = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (secs < 60) return "just now"
  if (secs < 3600) return `${Math.floor(secs / 60)}m ago`
  if (secs < 86400) return `${Math.floor(secs / 3600)}h ago`
  if (secs < 2592000) return `${Math.floor(secs / 86400)}d ago`
  return `${Math.floor(secs / 2592000)}mo ago`
}

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

export default function SendProposalDialog({
  open,
  onClose,
  proposal,
  account,
  onSendComplete,
}: Props) {
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [subject, setSubject] = useState("")
  const [message, setMessage] = useState("")
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle")
  const [sendType, setSendType] = useState<"initial" | "reminder">("initial")
  const [history, setHistory] = useState<SendHistoryRow[]>([])

  // Escape key closes the dialog (in addition to the X button and backdrop click).
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
    }
    document.addEventListener("keydown", onKey)
    return () => document.removeEventListener("keydown", onKey)
  }, [open, onClose])

  // Empty-section pre-flight warnings
  const warnings = useMemo(
    () => (open ? validateProposalForSend(proposal) : []),
    [open, proposal],
  )

  // Load send history
  const loadHistory = useCallback(async () => {
    if (!proposal.id) return
    const { data } = await supabase
      .from("proposal_sends")
      .select(
        "id, recipient_name, recipient_email, subject, send_type, sent_at, delivery_status, delivered_at, bounced_at, opened_at, last_opened_at, open_count, clicked_at, last_clicked_at, click_count",
      )
      .eq("proposal_id", proposal.id)
      .order("sent_at", { ascending: false })
    setHistory((data ?? []) as SendHistoryRow[])
  }, [proposal.id])

  // Reset state when dialog opens
  useEffect(() => {
    if (open) {
      setStatus("idle")
      setSendType("initial")
      loadHistory()
    }
  }, [open, loadHistory])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim() || !email.trim()) return
    setStatus("sending")

    const proposalUrl = `${window.location.origin}/p/${proposal.slug || proposal.id}`

    try {
      const { error } = await supabase.functions.invoke("send-proposal", {
        body: {
          proposalId: proposal.id,
          recipientName: name.trim(),
          recipientEmail: email.trim(),
          proposalTitle: subject.trim() || proposal.title,
          clientName: proposal.clientName,
          proposalUrl,
          studioName: proposal.studioName || account.studioName,
          senderName: account.senderName || account.studioName,
          website: account.website,
          brandColor1: proposal.brandColor1,
          brandColor2: proposal.brandColor2,
          personalMessage: message.trim() || undefined,
          sendType,
          subject: subject.trim() || undefined,
        },
      })
      if (error) {
        setStatus("error")
        return
      }
      setStatus("sent")
      loadHistory()
      onSendComplete?.()
    } catch {
      setStatus("error")
    }
  }

  const handleStartReminder = useCallback((row: SendHistoryRow) => {
    setName(row.recipient_name)
    setEmail(row.recipient_email)
    setSubject("")
    setMessage("")
    setSendType("reminder")
    setStatus("idle")
  }, [])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-4"
      style={{ background: "rgba(26, 23, 20, 0.55)", backdropFilter: "blur(4px)" }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        className="relative w-full max-w-md overflow-hidden rounded-2xl border shadow-[0_4px_12px_rgba(0,0,0,0.08),0_32px_64px_rgba(0,0,0,0.12)]"
        style={{
          background: "var(--color-cream)",
          borderColor: "var(--color-rule)",
          fontFamily: "var(--font-sans)",
          color: "var(--color-ink)",
        }}
      >
        <button
          onClick={onClose}
          className="absolute right-4 top-4 transition-opacity hover:opacity-60"
          style={{ color: "var(--color-ink-mute)" }}
          aria-label="Close"
        >
          <X className="h-4 w-4" />
        </button>

        {status === "sent" ? (
          <SentConfirmation email={email} onClose={onClose} />
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4 px-7 py-8">
            <div>
              <p
                className="mb-2 text-[11px] uppercase tracking-[0.14em]"
                style={{ fontFamily: "var(--font-mono)", color: "var(--color-ink-mute)" }}
              >
                {sendType === "reminder" ? "FOLLOW UP" : "SEND PROPOSAL"}
              </p>
              <h3
                className="text-[22px] leading-[1.2] tracking-[-0.01em]"
                style={{ fontFamily: "var(--font-merchant-display)", fontWeight: 500 }}
              >
                {sendType === "reminder" ? "Nudge them gently." : "Ready to ship."}
              </h3>
              <p
                className="mt-1 text-[13px]"
                style={{ color: "var(--color-ink-soft)" }}
              >
                A branded email with a link to this proposal.
              </p>
            </div>

            {warnings.length > 0 && (
              <div
                className="rounded-xl border p-3"
                style={{
                  borderColor: "var(--color-rule)",
                  background: "var(--color-paper)",
                }}
              >
                <div className="flex items-start gap-2.5">
                  <AlertTriangle
                    className="mt-0.5 h-4 w-4 flex-shrink-0"
                    style={{ color: "#B5821C" }}
                  />
                  <div className="flex-1 min-w-0">
                    <p
                      className="text-[11px] font-semibold uppercase tracking-[0.12em]"
                      style={{ color: "#B5821C", fontFamily: "var(--font-mono)" }}
                    >
                      {warnings.length === 1
                        ? "1 SECTION LOOKS INCOMPLETE"
                        : `${warnings.length} SECTIONS LOOK INCOMPLETE`}
                    </p>
                    <ul className="mt-1.5 space-y-1">
                      {warnings.map((w, i) => (
                        <li key={i} className="text-[12px]" style={{ color: "var(--color-ink-soft)" }}>
                          <span className="font-medium">{w.label}:</span> {w.reason}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            )}

            <FormField label="Recipient name">
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Sarah Chen"
                className="w-full rounded-lg border bg-white/50 px-3 py-2.5 text-[14px] outline-none transition-colors"
                style={{
                  borderColor: "var(--color-rule)",
                  color: "var(--color-ink)",
                }}
              />
            </FormField>

            <FormField label="Recipient email">
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="sarah@client.com"
                className="w-full rounded-lg border bg-white/50 px-3 py-2.5 text-[14px] outline-none transition-colors"
                style={{
                  borderColor: "var(--color-rule)",
                  color: "var(--color-ink)",
                }}
              />
            </FormField>

            <FormField label="Subject line">
              <input
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder={proposal.title}
                className="w-full rounded-lg border bg-white/50 px-3 py-2.5 text-[14px] outline-none transition-colors"
                style={{
                  borderColor: "var(--color-rule)",
                  color: "var(--color-ink)",
                }}
              />
            </FormField>

            <FormField label="Personal message" optional>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={3}
                placeholder="Hey Sarah, here's the proposal we discussed..."
                className="w-full rounded-lg border bg-white/50 px-3 py-2.5 text-[14px] outline-none transition-colors resize-none"
                style={{
                  borderColor: "var(--color-rule)",
                  color: "var(--color-ink)",
                }}
              />
            </FormField>

            {status === "error" && (
              <p className="text-[12px]" style={{ color: "#A33B28" }}>
                Something went wrong. Please try again.
              </p>
            )}

            <button
              type="submit"
              disabled={status === "sending"}
              className="flex w-full items-center justify-center gap-2 rounded-full px-4 py-3 text-[14px] font-medium transition-transform hover:scale-[1.01] disabled:opacity-50"
              style={{
                background: "var(--color-forest)",
                color: "var(--color-cream)",
              }}
            >
              {status === "sending" ? (
                "Sending..."
              ) : (
                <>
                  <Send className="h-4 w-4" />
                  {sendType === "reminder" ? "Send reminder" : "Send proposal"}
                </>
              )}
            </button>

            {sendType === "reminder" && (
              <button
                type="button"
                onClick={() => {
                  setSendType("initial")
                  setName("")
                  setEmail("")
                  setMessage("")
                }}
                className="w-full text-[12px] transition-colors hover:opacity-60"
                style={{ color: "var(--color-ink-mute)" }}
              >
                Cancel reminder, send as new
              </button>
            )}
          </form>
        )}

        {history.length > 0 && status !== "sent" && (
          <div
            className="border-t px-7 py-5"
            style={{
              borderColor: "var(--color-rule)",
              background: "var(--color-paper)",
            }}
          >
            <p
              className="mb-3 text-[11px] uppercase tracking-[0.14em]"
              style={{ fontFamily: "var(--font-mono)", color: "var(--color-ink-mute)" }}
            >
              SEND HISTORY
            </p>
            <div className="max-h-40 space-y-3 overflow-y-auto">
              {history.map((row) => (
                <SendHistoryItem
                  key={row.id}
                  row={row}
                  onRemind={() => handleStartReminder(row)}
                  showRemind={status !== "sending"}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Subcomponents
// ─────────────────────────────────────────────────────────────────────────────

function FormField({
  label,
  children,
  optional,
}: {
  label: string
  children: React.ReactNode
  optional?: boolean
}) {
  return (
    <label className="block space-y-1.5">
      <span
        className="text-[11px] uppercase tracking-[0.12em]"
        style={{ fontFamily: "var(--font-mono)", color: "var(--color-ink-mute)" }}
      >
        {label}
        {optional && <span className="ml-1.5 opacity-70">(OPTIONAL)</span>}
      </span>
      {children}
    </label>
  )
}

function SentConfirmation({ email, onClose }: { email: string; onClose: () => void }) {
  return (
    <div className="px-7 py-12 text-center">
      <div
        className="mx-auto mb-5 flex h-12 w-12 items-center justify-center rounded-full"
        style={{ background: "var(--color-forest)" }}
      >
        <Check className="h-5 w-5" style={{ color: "var(--color-cream)" }} />
      </div>
      <h3
        className="text-[24px] leading-[1.2] tracking-[-0.01em]"
        style={{ fontFamily: "var(--font-merchant-display)", fontWeight: 500 }}
      >
        Sent.
      </h3>
      <p className="mt-2 text-[14px]" style={{ color: "var(--color-ink-soft)" }}>
        Delivered to {email}
      </p>
      <button
        onClick={onClose}
        className="mt-6 text-[12px] font-medium transition-colors hover:opacity-70"
        style={{ color: "var(--color-forest)" }}
      >
        Close ↵
      </button>
    </div>
  )
}

function SendHistoryItem({
  row,
  onRemind,
  showRemind,
}: {
  row: SendHistoryRow
  onRemind: () => void
  showRemind: boolean
}) {
  // Delivery status label
  const deliveryStatus = row.delivery_status || "sent"
  const statusLabel =
    deliveryStatus === "delivered"
      ? "DELIVERED"
      : deliveryStatus === "bounced"
      ? "BOUNCED"
      : deliveryStatus === "failed"
      ? "FAILED"
      : deliveryStatus === "complained"
      ? "SPAM"
      : deliveryStatus === "delivery_delayed"
      ? "DELAYED"
      : "SENT"

  const isError = ["bounced", "failed", "complained"].includes(deliveryStatus)
  const isWarn = deliveryStatus === "delivery_delayed"
  const statusColor = isError
    ? "#A33B28"
    : isWarn
    ? "#B5821C"
    : "var(--color-forest)"

  // Apple Mail pre-fetch heuristic
  const isPrefetch =
    row.opened_at &&
    row.delivered_at &&
    new Date(row.opened_at).getTime() - new Date(row.delivered_at).getTime() < 5000

  return (
    <div className="flex items-center justify-between gap-3 text-[12px]">
      <div className="min-w-0 flex-1">
        <div
          className="truncate"
          style={{ color: "var(--color-ink)", fontWeight: 500 }}
        >
          {row.recipient_name}
        </div>
        <div
          className="mt-0.5 truncate text-[10px] uppercase tracking-[0.12em]"
          style={{ fontFamily: "var(--font-mono)", color: "var(--color-ink-mute)" }}
        >
          <span style={{ color: statusColor }}>{statusLabel}</span>
          {" · "}
          {timeSince(row.sent_at).toUpperCase()}
          {row.open_count > 0 && !isPrefetch && (
            <>
              {" · "}
              <span style={{ color: "var(--color-forest)" }}>{row.open_count}</span>{" "}
              {row.open_count === 1 ? "OPEN" : "OPENS"}
            </>
          )}
          {row.open_count > 0 && isPrefetch && (
            <>
              {" · "}
              <span>PRE-FETCH</span>
            </>
          )}
          {row.click_count > 0 && (
            <>
              {" · "}
              <span style={{ color: "var(--color-forest-deep)" }}>{row.click_count}</span>{" "}
              {row.click_count === 1 ? "CLICK" : "CLICKS"}
            </>
          )}
        </div>
      </div>
      {showRemind && (
        <button
          onClick={onRemind}
          className="shrink-0 text-[11px] font-medium transition-colors hover:opacity-70"
          style={{ color: "var(--color-forest)" }}
        >
          Follow up →
        </button>
      )}
    </div>
  )
}
