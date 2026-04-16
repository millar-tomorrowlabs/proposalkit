/**
 * HistoryPopover — Lovable-style rollback list.
 *
 * Loads the 30 most recent proposal_snapshots for the current proposal and
 * lets the user restore any of them. Restoring saves the CURRENT state as a
 * new snapshot first (so the restore itself is undoable), then swaps the
 * proposal data in-place.
 *
 * Rendered as an anchored popover below the top-bar History button. Uses
 * the same dismiss protocol as SettingsPopover: click outside, Escape, or
 * the X button in the header.
 */

import { useEffect, useRef, useState, useCallback } from "react"
import { X, RotateCcw, Clock } from "lucide-react"
import { supabase } from "@/lib/supabase"
import { useBuilderStore } from "@/store/builderStore"
import type { ProposalData } from "@/types/proposal"

interface HistoryPopoverProps {
  open: boolean
  onClose: () => void
  proposalId: string
  anchorRef?: React.RefObject<HTMLElement | null>
}

interface SnapshotRow {
  id: string
  trigger: string
  created_at: string
  data: ProposalData
}

const TRIGGER_LABELS: Record<string, string> = {
  "ai-edit": "AI edit",
  "manual-edit": "Manual edit",
  "before-restore": "Before restore",
  "initial": "Initial version",
}

function formatRelativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const seconds = Math.floor(diff / 1000)
  if (seconds < 60) return `${seconds}s ago`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d ago`
  return new Date(iso).toLocaleDateString()
}

export default function HistoryPopover({ open, onClose, proposalId, anchorRef }: HistoryPopoverProps) {
  const popoverRef = useRef<HTMLDivElement>(null)
  const [snapshots, setSnapshots] = useState<SnapshotRow[]>([])
  const [loading, setLoading] = useState(false)
  const [restoringId, setRestoringId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase
      .from("proposal_snapshots")
      .select("id, trigger, created_at, data")
      .eq("proposal_id", proposalId)
      .order("created_at", { ascending: false })
      .limit(30)
    setSnapshots((data ?? []) as SnapshotRow[])
    setLoading(false)
  }, [proposalId])

  useEffect(() => {
    if (open) load()
  }, [open, load])

  // Dismiss on click-outside and Escape.
  useEffect(() => {
    if (!open) return
    const onMouseDown = (e: MouseEvent) => {
      const target = e.target as Node
      if (popoverRef.current?.contains(target)) return
      if (anchorRef?.current?.contains(target)) return
      onClose()
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
    }
    document.addEventListener("mousedown", onMouseDown)
    document.addEventListener("keydown", onKey)
    return () => {
      document.removeEventListener("mousedown", onMouseDown)
      document.removeEventListener("keydown", onKey)
    }
  }, [open, onClose, anchorRef])

  const handleRestore = async (snap: SnapshotRow) => {
    const store = useBuilderStore.getState()
    setRestoringId(snap.id)
    try {
      // Save the CURRENT state first so the user can undo the restore.
      await supabase.from("proposal_snapshots").insert({
        proposal_id: proposalId,
        data: store.proposal,
        trigger: "before-restore",
      })
      // Apply the chosen snapshot in-place.
      store.setProposal(snap.data)
      // Refresh the list so the new "before-restore" snapshot appears.
      await load()
    } finally {
      setRestoringId(null)
    }
  }

  if (!open) return null

  return (
    <div
      ref={popoverRef}
      className="absolute right-0 top-full mt-2 z-50 w-[360px] rounded-xl border shadow-lg"
      style={{
        background: "var(--color-cream)",
        borderColor: "var(--color-rule)",
        boxShadow: "0 8px 24px rgba(0,0,0,0.08)",
      }}
    >
      <div
        className="flex items-center justify-between border-b px-5 py-3"
        style={{ borderColor: "var(--color-rule)" }}
      >
        <p
          className="text-[10px] uppercase tracking-[0.14em]"
          style={{ fontFamily: "var(--font-mono)", color: "var(--color-ink-mute)" }}
        >
          HISTORY
        </p>
        <button
          onClick={onClose}
          className="inline-flex h-6 w-6 items-center justify-center rounded-full transition-colors hover:bg-black/5"
          style={{ color: "var(--color-ink-mute)" }}
          title="Close (Esc)"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="max-h-[60vh] overflow-y-auto">
        {loading && snapshots.length === 0 ? (
          <div
            className="px-5 py-8 text-center text-[12px]"
            style={{ color: "var(--color-ink-mute)" }}
          >
            Loading history...
          </div>
        ) : snapshots.length === 0 ? (
          <div
            className="px-5 py-8 text-center text-[12px]"
            style={{ color: "var(--color-ink-mute)" }}
          >
            No earlier versions yet. Changes made here will show up as you work.
          </div>
        ) : (
          <ul>
            {snapshots.map((snap, idx) => {
              const label = TRIGGER_LABELS[snap.trigger] ?? snap.trigger
              const title = (snap.data as { title?: string })?.title ?? "Untitled"
              const isRestoring = restoringId === snap.id
              const isTop = idx === 0
              return (
                <li
                  key={snap.id}
                  className="flex items-center justify-between gap-3 border-b px-5 py-3 last:border-b-0"
                  style={{ borderColor: "var(--color-rule)" }}
                >
                  <div className="flex min-w-0 flex-1 items-start gap-2.5">
                    <Clock
                      className="mt-0.5 h-3.5 w-3.5 shrink-0"
                      style={{ color: "var(--color-ink-mute)" }}
                    />
                    <div className="min-w-0 flex-1">
                      <div
                        className="truncate text-[12px] font-medium"
                        style={{ color: "var(--color-ink)" }}
                        title={title}
                      >
                        {title}
                      </div>
                      <div
                        className="text-[10px] uppercase tracking-[0.10em]"
                        style={{ fontFamily: "var(--font-mono)", color: "var(--color-ink-mute)" }}
                      >
                        {label} · {formatRelativeTime(snap.created_at)}
                        {isTop ? " · MOST RECENT" : ""}
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => handleRestore(snap)}
                    disabled={isRestoring}
                    className="flex items-center gap-1 rounded-full border px-2.5 py-1 text-[10px] uppercase tracking-[0.12em] transition-colors hover:bg-black/5 disabled:opacity-50"
                    style={{
                      fontFamily: "var(--font-mono)",
                      borderColor: "var(--color-rule)",
                      color: "var(--color-ink-soft)",
                    }}
                    title="Restore this version"
                  >
                    <RotateCcw className="h-3 w-3" />
                    {isRestoring ? "..." : "Restore"}
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </div>
  )
}
