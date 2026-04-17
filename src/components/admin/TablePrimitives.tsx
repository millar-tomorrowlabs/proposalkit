/**
 * Shared presentational primitives for admin tables.
 *
 * AdminWaitlist, AdminInvites, and AdminAccounts all need the same
 * `<Th>` / `<Td>` / `<Pill>` / `<EmptyState>` components with the same
 * Studio Editorial styling (mono labels, forest accents, hairline rows).
 * Keeping them here means one place to tweak when the design evolves.
 */

import type { ReactNode } from "react"

// ─────────────────────────────────────────────────────────────────────────────
// Table header + cell
// ─────────────────────────────────────────────────────────────────────────────

export function Th({ children, align }: { children: ReactNode; align?: "right" }) {
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

export function Td({
  children,
  muted,
  align,
}: {
  children: ReactNode
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

// ─────────────────────────────────────────────────────────────────────────────
// Pill — status chip
// ─────────────────────────────────────────────────────────────────────────────
//
// Tones map to specific semantic states. Extend by adding to the palette
// below rather than re-defining at the call site.

export type PillTone = "forest" | "neutral" | "muted" | "warn"

const PILL_PALETTE: Record<PillTone, { bg: string; fg: string }> = {
  forest: { bg: "var(--color-forest)", fg: "var(--color-cream)" },
  neutral: { bg: "var(--color-rule)", fg: "var(--color-ink-soft)" },
  muted: { bg: "var(--color-rule)", fg: "var(--color-ink-mute)" },
  warn: { bg: "#A33B2820", fg: "#A33B28" },
}

export function Pill({ tone, children }: { tone: PillTone; children: ReactNode }) {
  const palette = PILL_PALETTE[tone]
  return (
    <span
      className="inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] uppercase tracking-[0.12em]"
      style={{ background: palette.bg, color: palette.fg, fontFamily: "var(--font-mono)" }}
    >
      {children}
    </span>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// EmptyState — used when a filtered table has no rows
// ─────────────────────────────────────────────────────────────────────────────

export function EmptyState({
  eyebrow,
  title,
}: {
  eyebrow: string
  title: string
}) {
  return (
    <div
      className="rounded-2xl border px-8 py-16"
      style={{ background: "var(--color-paper)", borderColor: "var(--color-rule)" }}
    >
      <p
        className="text-[11px] uppercase tracking-[0.14em]"
        style={{ fontFamily: "var(--font-mono)", color: "var(--color-ink-mute)" }}
      >
        {eyebrow.toUpperCase()}
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
