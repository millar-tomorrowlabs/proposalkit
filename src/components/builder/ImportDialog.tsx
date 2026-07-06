import { useMemo, useRef, useState } from "react"
import { toast } from "sonner"
import { Upload, X, ArrowRight } from "lucide-react"
import { useBuilderStore } from "@/store/builderStore"
import { parseImportDoc, targetLabel } from "@/lib/proposalImport"

interface ImportDialogProps {
  open: boolean
  onClose: () => void
}

/**
 * Verbatim document import (INT-18). Paste or upload a markdown doc with
 * `## SECTION: <name>` headings, review the mapping, apply. No AI touches
 * the content; bodies land byte for byte.
 */
export default function ImportDialog({ open, onClose }: ImportDialogProps) {
  const [text, setText] = useState("")
  const fileInputRef = useRef<HTMLInputElement>(null)
  const customSections = useBuilderStore((s) => s.proposal.customSections)
  const applyImport = useBuilderStore((s) => s.applyImport)

  const parsed = useMemo(
    () => parseImportDoc(text, customSections),
    [text, customSections],
  )

  if (!open) return null

  const handleFile = (file: File) => {
    const reader = new FileReader()
    reader.onload = () => setText(String(reader.result ?? ""))
    reader.readAsText(file)
  }

  const handleApply = () => {
    if (parsed.sections.length === 0) return
    applyImport(parsed.sections)
    toast.success(
      `Imported ${parsed.sections.length} ${parsed.sections.length === 1 ? "section" : "sections"} verbatim.`,
    )
    setText("")
    onClose()
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-4"
      style={{ background: "rgba(26, 23, 20, 0.6)", backdropFilter: "blur(4px)" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        className="w-full max-w-2xl rounded-2xl border p-6"
        style={{
          background: "var(--color-cream)",
          borderColor: "var(--color-rule)",
          boxShadow: "0 4px 12px rgba(0,0,0,0.08), 0 32px 64px rgba(0,0,0,0.12)",
        }}
      >
        <div className="mb-4 flex items-center justify-between">
          <p
            className="text-[10px] uppercase tracking-[0.14em]"
            style={{ fontFamily: "var(--font-mono)", color: "var(--color-ink-mute)" }}
          >
            IMPORT DOCUMENT · VERBATIM, NO AI
          </p>
          <button onClick={onClose} className="transition-colors hover:opacity-70" style={{ color: "var(--color-ink-mute)" }}>
            <X className="h-4 w-4" />
          </button>
        </div>

        <p className="mb-3 text-[12px] leading-[1.55]" style={{ color: "var(--color-ink-soft)" }}>
          Split your document with <code style={{ fontFamily: "var(--font-mono)" }}>## SECTION: Name</code> headings.
          Reserved names Tagline, Hero description, and Next steps fill those fields; every other
          heading becomes its own section, content untouched. Re-importing a heading that matches an
          existing section replaces its body.
        </p>

        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={"## SECTION: Tagline\nYour store, rebuilt.\n\n## SECTION: Why us\nWe build..."}
          rows={10}
          className="w-full resize-none rounded-lg border bg-white/50 px-3 py-2 text-[12px] outline-none"
          style={{ borderColor: "var(--color-rule)", color: "var(--color-ink)", fontFamily: "var(--font-mono)" }}
        />

        <div className="mt-2 flex items-center justify-between">
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[11px] font-medium transition-colors hover:opacity-70"
            style={{ borderColor: "var(--color-rule)", color: "var(--color-ink-soft)" }}
          >
            <Upload className="h-3 w-3" /> Upload .md
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".md,.markdown,.txt"
            className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f) }}
          />
          {text.length > 0 && (
            <span className="text-[10px]" style={{ fontFamily: "var(--font-mono)", color: "var(--color-ink-mute)" }}>
              {text.length.toLocaleString()} characters
            </span>
          )}
        </div>

        {/* Mapping preview */}
        {text.trim().length > 0 && (
          <div className="mt-4 max-h-[30vh] space-y-1.5 overflow-y-auto rounded-lg border p-3" style={{ borderColor: "var(--color-rule)", background: "var(--color-paper)" }}>
            {parsed.sections.length === 0 ? (
              <p className="text-[12px]" style={{ color: "var(--color-ink-mute)" }}>
                No <code style={{ fontFamily: "var(--font-mono)" }}>## SECTION:</code> headings found yet.
              </p>
            ) : (
              parsed.sections.map((s, i) => (
                <div key={i} className="flex items-center gap-2 text-[12px]" style={{ color: "var(--color-ink)" }}>
                  <span className="truncate font-medium">{s.heading}</span>
                  <ArrowRight className="h-3 w-3 shrink-0" style={{ color: "var(--color-ink-mute)" }} />
                  <span className="shrink-0" style={{ color: "var(--color-forest)" }}>{targetLabel(s)}</span>
                  <span className="ml-auto shrink-0 text-[10px]" style={{ fontFamily: "var(--font-mono)", color: "var(--color-ink-mute)" }}>
                    {s.body.length.toLocaleString()} chars
                  </span>
                </div>
              ))
            )}
            {parsed.hasPreamble && (
              <p className="pt-1 text-[10px]" style={{ fontFamily: "var(--font-mono)", color: "var(--color-ink-mute)" }}>
                Text before the first heading is skipped.
              </p>
            )}
          </div>
        )}

        <div className="mt-4 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="text-[12px] font-medium transition-colors hover:opacity-70"
            style={{ color: "var(--color-ink-mute)" }}
          >
            Cancel
          </button>
          <button
            onClick={handleApply}
            disabled={parsed.sections.length === 0}
            className="rounded-full px-4 py-1.5 text-[12px] font-medium transition-transform hover:scale-[1.02] disabled:opacity-40"
            style={{ background: "var(--color-forest)", color: "var(--color-cream)" }}
          >
            Apply {parsed.sections.length > 0 ? `${parsed.sections.length} ${parsed.sections.length === 1 ? "section" : "sections"}` : ""}
          </button>
        </div>
      </div>
    </div>
  )
}
