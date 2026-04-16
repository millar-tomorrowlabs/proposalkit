import { Link } from "react-router-dom"
import { Settings, FileText, Eye, Edit2, Send } from "lucide-react"
import ProposlMark from "@/components/brand/ProposlMark"
import ViewportSwitcher, { type Viewport } from "./ViewportSwitcher"

interface BuilderTopBarProps {
  title: string
  onTitleChange: (title: string) => void
  status: string
  viewport: Viewport
  onViewportChange: (v: Viewport) => void
  previewMode: boolean
  onTogglePreview: () => void
  onOpenSettings: () => void
  onOpenContext: () => void
  onSend: () => void
  saveStatus: string
}

export default function BuilderTopBar({
  title,
  onTitleChange,
  status,
  viewport,
  onViewportChange,
  previewMode,
  onTogglePreview,
  onOpenSettings,
  onOpenContext,
  onSend,
  saveStatus,
}: BuilderTopBarProps) {
  return (
    <header
      className="fixed top-0 right-0 left-0 z-40 flex h-11 items-center justify-between border-b px-4"
      style={{
        background: "var(--color-cream)",
        borderColor: "var(--color-rule)",
        fontFamily: "var(--font-sans)",
      }}
    >
      {/* Left: mark + title + status */}
      <div className="flex items-center gap-3">
        <Link to="/proposals" className="flex items-center gap-1.5 transition-opacity hover:opacity-70">
          <ProposlMark />
        </Link>
        <span className="text-[var(--color-rule)]">/</span>
        <input
          type="text"
          value={title}
          onChange={(e) => onTitleChange(e.target.value)}
          className="bg-transparent text-[13px] font-medium outline-none"
          style={{ color: "var(--color-ink)", minWidth: "120px" }}
          placeholder="Untitled proposal"
        />
        <span
          className="rounded-full border px-2 py-0.5 text-[9px] uppercase tracking-[0.12em]"
          style={{
            fontFamily: "var(--font-mono)",
            borderColor: "var(--color-rule)",
            color: status === "draft" ? "var(--color-ink-mute)" : "var(--color-forest)",
          }}
        >
          {status || "draft"}
        </span>
      </div>

      {/* Right: actions */}
      <div className="flex items-center gap-2">
        <span
          className="mr-1 text-[9px] uppercase tracking-[0.12em]"
          style={{ fontFamily: "var(--font-mono)", color: "var(--color-ink-mute)" }}
        >
          {saveStatus === "saving" ? "Saving..." : saveStatus === "saved" ? "Saved" : ""}
        </span>

        <button
          onClick={onOpenContext}
          className="flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors hover:opacity-70"
          style={{ borderColor: "var(--color-rule)", color: "var(--color-ink-soft)" }}
          title="Context sources"
        >
          <FileText className="h-3 w-3" />
          Context
        </button>

        <button
          onClick={onOpenSettings}
          className="flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors hover:opacity-70"
          style={{ borderColor: "var(--color-rule)", color: "var(--color-ink-soft)" }}
          title="Settings"
        >
          <Settings className="h-3 w-3" />
        </button>

        <ViewportSwitcher viewport={viewport} onChange={onViewportChange} />

        <button
          onClick={onTogglePreview}
          className="flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors hover:opacity-70"
          style={{ borderColor: "var(--color-rule)", color: "var(--color-ink-soft)" }}
        >
          {previewMode ? <Edit2 className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
          {previewMode ? "Edit" : "Preview"}
        </button>

        <button
          onClick={onSend}
          className="flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[11px] font-medium transition-transform hover:scale-[1.02]"
          style={{ background: "var(--color-forest)", color: "var(--color-cream)" }}
        >
          <Send className="h-3 w-3" />
          Send
        </button>
      </div>
    </header>
  )
}
