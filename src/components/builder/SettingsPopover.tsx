import { useRef, useEffect } from "react"
import { useBuilderStore } from "@/store/builderStore"
import type { SectionKey } from "@/types/proposal"

interface SettingsPopoverProps {
  open: boolean
  onClose: () => void
  anchorRef: React.RefObject<HTMLElement | null>
}

const SECTION_LABELS: Record<SectionKey, string> = {
  summary: "Summary",
  scope: "Scope",
  timeline: "Timeline",
  investment: "Investment",
  cta: "Call to Action",
}

export default function SettingsPopover({ open, onClose, anchorRef }: SettingsPopoverProps) {
  const popoverRef = useRef<HTMLDivElement>(null)
  const { proposal, updateField } = useBuilderStore()

  // Close on click outside
  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(e.target as Node) &&
        anchorRef.current &&
        !anchorRef.current.contains(e.target as Node)
      ) {
        onClose()
      }
    }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [open, onClose, anchorRef])

  if (!open) return null

  const inputClass =
    "w-full rounded-lg border bg-white/50 px-3 py-2 text-[13px] outline-none"
  const inputStyle = {
    borderColor: "var(--color-rule)",
    color: "var(--color-ink)",
  }
  const labelClass = "mb-1.5 block text-[10px] uppercase tracking-[0.12em]"
  const labelStyle = {
    fontFamily: "var(--font-mono)",
    color: "var(--color-ink-mute)",
  }

  return (
    <div
      ref={popoverRef}
      className="absolute right-0 top-full mt-2 z-50 w-[340px] rounded-xl border p-5 shadow-lg"
      style={{
        background: "var(--color-cream)",
        borderColor: "var(--color-rule)",
        boxShadow: "0 8px 24px rgba(0,0,0,0.08)",
      }}
    >
      <p
        className="mb-4 text-[10px] uppercase tracking-[0.14em]"
        style={{ fontFamily: "var(--font-mono)", color: "var(--color-ink-mute)" }}
      >
        PROPOSAL SETTINGS
      </p>

      <div className="space-y-4">
        {/* Brand colors */}
        <div>
          <span className={labelClass} style={labelStyle}>BRAND COLORS</span>
          <div className="flex gap-3">
            <label className="flex items-center gap-2">
              <input
                type="color"
                value={proposal.brandColor1}
                onChange={(e) => updateField("brandColor1", e.target.value)}
                className="h-8 w-8 cursor-pointer rounded border"
                style={{ borderColor: "var(--color-rule)" }}
              />
              <span className="text-[11px]" style={{ color: "var(--color-ink-soft)" }}>Primary</span>
            </label>
            <label className="flex items-center gap-2">
              <input
                type="color"
                value={proposal.brandColor2}
                onChange={(e) => updateField("brandColor2", e.target.value)}
                className="h-8 w-8 cursor-pointer rounded border"
                style={{ borderColor: "var(--color-rule)" }}
              />
              <span className="text-[11px]" style={{ color: "var(--color-ink-soft)" }}>Secondary</span>
            </label>
          </div>
        </div>

        {/* Client name */}
        <div>
          <span className={labelClass} style={labelStyle}>CLIENT NAME</span>
          <input
            type="text"
            value={proposal.clientName}
            onChange={(e) => updateField("clientName", e.target.value)}
            className={inputClass}
            style={inputStyle}
            placeholder="Acme Corp"
          />
        </div>

        {/* Slug */}
        <div>
          <span className={labelClass} style={labelStyle}>PROPOSAL URL</span>
          <div className="flex items-center gap-0">
            <span
              className="rounded-l-lg border border-r-0 bg-white/30 px-2.5 py-2 text-[13px]"
              style={{ borderColor: "var(--color-rule)", color: "var(--color-ink-mute)" }}
            >
              /p/
            </span>
            <input
              type="text"
              value={proposal.slug}
              onChange={(e) => updateField("slug", e.target.value)}
              className="flex-1 rounded-r-lg border bg-white/50 px-2.5 py-2 text-[13px] outline-none"
              style={inputStyle}
              placeholder="cherry-pao-pao"
            />
          </div>
        </div>

        {/* CTA email */}
        <div>
          <span className={labelClass} style={labelStyle}>CTA EMAIL</span>
          <input
            type="email"
            value={proposal.ctaEmail}
            onChange={(e) => updateField("ctaEmail", e.target.value)}
            className={inputClass}
            style={inputStyle}
            placeholder="hello@studio.com"
          />
        </div>

        {/* Section order */}
        <div>
          <span className={labelClass} style={labelStyle}>SECTIONS</span>
          <div className="space-y-1.5">
            {proposal.sections.map((key) => (
              <div
                key={key}
                className="flex items-center justify-between rounded-lg border px-3 py-1.5 text-[12px]"
                style={{ borderColor: "var(--color-rule)", color: "var(--color-ink-soft)" }}
              >
                <span>{SECTION_LABELS[key] || key}</span>
                <button
                  onClick={() => {
                    updateField(
                      "sections",
                      proposal.sections.filter((s) => s !== key),
                    )
                  }}
                  className="text-[10px] transition-colors hover:opacity-70"
                  style={{ color: "var(--color-ink-mute)" }}
                >
                  x
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
