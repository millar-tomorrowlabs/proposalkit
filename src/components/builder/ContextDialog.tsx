import { useState, useEffect, useCallback } from "react"
import { Plus, X, Link as LinkIcon, FileText, Type } from "lucide-react"
import { supabase } from "@/lib/supabase"
import type { ProposalContextSource } from "@/types/proposal"

interface ContextDialogProps {
  open: boolean
  onClose: () => void
  proposalId: string
}

export default function ContextDialog({ open, onClose, proposalId }: ContextDialogProps) {
  const [sources, setSources] = useState<ProposalContextSource[]>([])
  const [adding, setAdding] = useState<"paste" | "url" | null>(null)
  const [name, setName] = useState("")
  const [content, setContent] = useState("")
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    const { data } = await supabase
      .from("proposal_context")
      .select("*")
      .eq("proposal_id", proposalId)
      .order("created_at")
    if (data) {
      setSources(
        data.map((r) => ({
          id: r.id,
          proposalId: r.proposal_id,
          sourceType: r.source_type,
          name: r.name,
          url: r.url,
          fileSize: r.file_size,
          extractedText: r.extracted_text,
          createdAt: r.created_at,
        })),
      )
    }
  }, [proposalId])

  useEffect(() => {
    if (open) load()
  }, [open, load])

  const handleAdd = async () => {
    if (!name.trim() || !content.trim()) return
    setSaving(true)
    await supabase.from("proposal_context").insert({
      proposal_id: proposalId,
      source_type: adding === "url" ? "url" : "paste",
      name: name.trim(),
      url: adding === "url" ? content.trim() : null,
      extracted_text: content.trim(),
    })
    setName("")
    setContent("")
    setAdding(null)
    setSaving(false)
    await load()
  }

  const handleRemove = async (id: string) => {
    await supabase.from("proposal_context").delete().eq("id", id)
    setSources((prev) => prev.filter((s) => s.id !== id))
  }

  if (!open) return null

  const typeIcon = (t: string) => {
    if (t === "url") return <LinkIcon className="h-3.5 w-3.5" />
    if (t === "file") return <FileText className="h-3.5 w-3.5" />
    return <Type className="h-3.5 w-3.5" />
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-4"
      style={{ background: "rgba(26, 23, 20, 0.6)", backdropFilter: "blur(4px)" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        className="w-full max-w-lg rounded-2xl border p-6"
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
            CONTEXT SOURCES · {sources.length}
          </p>
          <button onClick={onClose} className="transition-colors hover:opacity-70" style={{ color: "var(--color-ink-mute)" }}>
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Source list */}
        <div className="space-y-2">
          {sources.map((s) => (
            <div
              key={s.id}
              className="flex items-center gap-3 rounded-lg border px-3 py-2.5"
              style={{ borderColor: "var(--color-rule)", background: "#fff" }}
            >
              <span style={{ color: "var(--color-forest)" }}>{typeIcon(s.sourceType)}</span>
              <div className="flex-1 min-w-0">
                <p className="truncate text-[12px] font-medium" style={{ color: "var(--color-ink)" }}>{s.name}</p>
                <p className="truncate text-[10px]" style={{ color: "var(--color-ink-mute)", fontFamily: "var(--font-mono)" }}>
                  {s.sourceType.toUpperCase()}{s.fileSize ? ` · ${Math.round(s.fileSize / 1024)}KB` : ""}
                </p>
              </div>
              <button onClick={() => handleRemove(s.id)} className="shrink-0 transition-colors hover:opacity-70" style={{ color: "var(--color-ink-mute)" }}>
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>

        {/* Add new */}
        {!adding && (
          <div className="mt-4 flex gap-2">
            <button
              onClick={() => setAdding("paste")}
              className="flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[11px] font-medium transition-colors hover:opacity-70"
              style={{ borderColor: "var(--color-rule)", color: "var(--color-ink-soft)" }}
            >
              <Plus className="h-3 w-3" /> Paste text
            </button>
            <button
              onClick={() => setAdding("url")}
              className="flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[11px] font-medium transition-colors hover:opacity-70"
              style={{ borderColor: "var(--color-rule)", color: "var(--color-ink-soft)" }}
            >
              <Plus className="h-3 w-3" /> Add URL
            </button>
          </div>
        )}

        {adding && (
          <div className="mt-4 space-y-3 rounded-lg border p-4" style={{ borderColor: "var(--color-rule)" }}>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={adding === "url" ? "Source name" : "Note name"}
              className="w-full rounded-lg border bg-white/50 px-3 py-2 text-[13px] outline-none"
              style={{ borderColor: "var(--color-rule)", color: "var(--color-ink)" }}
            />
            {adding === "url" ? (
              <input
                type="url"
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="https://notion.so/..."
                className="w-full rounded-lg border bg-white/50 px-3 py-2 text-[13px] outline-none"
                style={{ borderColor: "var(--color-rule)", color: "var(--color-ink)" }}
              />
            ) : (
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="Paste call transcript, brief, or notes..."
                rows={4}
                className="w-full resize-none rounded-lg border bg-white/50 px-3 py-2 text-[13px] outline-none"
                style={{ borderColor: "var(--color-rule)", color: "var(--color-ink)" }}
              />
            )}
            <div className="flex gap-2">
              <button
                onClick={() => { setAdding(null); setName(""); setContent("") }}
                className="text-[12px] font-medium transition-colors hover:opacity-70"
                style={{ color: "var(--color-ink-mute)" }}
              >
                Cancel
              </button>
              <button
                onClick={handleAdd}
                disabled={saving || !name.trim() || !content.trim()}
                className="rounded-full px-4 py-1.5 text-[12px] font-medium transition-transform hover:scale-[1.02] disabled:opacity-40"
                style={{ background: "var(--color-forest)", color: "var(--color-cream)" }}
              >
                {saving ? "Adding..." : "Add"}
              </button>
            </div>
          </div>
        )}

        {sources.length === 0 && !adding && (
          <p className="mt-3 text-center text-[12px]" style={{ color: "var(--color-ink-mute)" }}>
            No context sources yet. Add briefs, transcripts, or URLs to help the AI understand the project.
          </p>
        )}
      </div>
    </div>
  )
}
