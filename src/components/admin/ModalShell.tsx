/**
 * ModalShell — shared backdrop + header for small admin modals.
 *
 * Both IssueInviteModal and EditAccountModal were reinventing the same
 * fixed-overlay backdrop (dim, click-outside-closes) and header row
 * (mono eyebrow, display title, X close button). This consolidates
 * them so future admin modals stay visually consistent.
 *
 * Body content is the child — styling/padding inside the body is the
 * caller's responsibility. The shell owns chrome only.
 */

import type { ReactNode } from "react"
import { X } from "lucide-react"

interface Props {
  open: boolean
  eyebrow: string
  title: string
  onClose: () => void
  children: ReactNode
  maxWidth?: string
}

export default function ModalShell({
  open,
  eyebrow,
  title,
  onClose,
  children,
  maxWidth = "max-w-md",
}: Props) {
  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(17, 24, 17, 0.4)" }}
      onClick={onClose}
    >
      <div
        className={`w-full ${maxWidth} rounded-2xl border p-6 md:p-7`}
        style={{ background: "var(--color-paper)", borderColor: "var(--color-rule)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between">
          <div>
            <p
              className="text-[11px] uppercase tracking-[0.14em]"
              style={{ fontFamily: "var(--font-mono)", color: "var(--color-ink-mute)" }}
            >
              {eyebrow.toUpperCase()}
            </p>
            <h2
              className="mt-1 text-[22px] leading-[1.2] tracking-[-0.01em]"
              style={{ fontFamily: "var(--font-merchant-display)", fontWeight: 500 }}
            >
              {title}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="rounded-full p-1.5 transition-colors hover:opacity-70"
            style={{ color: "var(--color-ink-mute)" }}
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="mt-5">{children}</div>
      </div>
    </div>
  )
}
