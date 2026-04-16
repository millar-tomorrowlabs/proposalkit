import { useRef, useEffect } from "react"
import { X } from "lucide-react"
import { useBuilderStore } from "@/store/builderStore"
import type { SectionKey } from "@/types/proposal"

interface SettingsPopoverProps {
  open: boolean
  onClose: () => void
  /** Optional anchor element. Clicks inside it are ignored so the button
   *  that toggles the popover doesn't re-open it on the same mousedown. */
  anchorRef?: React.RefObject<HTMLElement | null>
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

  // Close on click outside, and on Escape.
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
      <div className="mb-4 flex items-center justify-between">
        <p
          className="text-[10px] uppercase tracking-[0.14em]"
          style={{ fontFamily: "var(--font-mono)", color: "var(--color-ink-mute)" }}
        >
          PROPOSAL SETTINGS
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

        {/* Currency */}
        <div>
          <span className={labelClass} style={labelStyle}>CURRENCY</span>
          <select
            value={proposal.currency || ""}
            onChange={(e) => updateField("currency", e.target.value || undefined)}
            className={inputClass}
            style={inputStyle}
          >
            <option value="">Use studio default</option>
            <option value="USD">USD · US Dollar ($)</option>
            <option value="EUR">EUR · Euro (€)</option>
            <option value="GBP">GBP · British Pound (£)</option>
            <option value="CAD">CAD · Canadian Dollar</option>
            <option value="AUD">AUD · Australian Dollar</option>
            <option value="JPY">JPY · Japanese Yen (¥)</option>
            <option value="CHF">CHF · Swiss Franc</option>
            <option value="NZD">NZD · New Zealand Dollar</option>
            <option value="SEK">SEK · Swedish Krona</option>
            <option value="NOK">NOK · Norwegian Krone</option>
            <option value="DKK">DKK · Danish Krone</option>
          </select>
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
