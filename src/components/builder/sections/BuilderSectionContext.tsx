import { useBuilderStore } from "@/store/builderStore"
import { useAccount } from "@/contexts/AccountContext"
import { supabase } from "@/lib/supabase"
import { friendlyError } from "@/lib/errors"
import { toast } from "sonner"
import { Plus, Trash2, Sparkles } from "lucide-react"
import { v4 as uuidv4 } from "uuid"
import type { ContextBlob } from "@/types/proposal"

const BuilderSectionContext = () => {
  const { account } = useAccount()
  const {
    proposal,
    contextBlobs,
    setContextBlobs,
    setSuggestions,
    setSuggestionsLoading,
    suggestionsLoading,
    suggestions,
  } = useBuilderStore()

  const addBlob = () => {
    const blob: ContextBlob = { id: uuidv4().slice(0, 8), label: "", content: "" }
    setContextBlobs([...contextBlobs, blob])
  }

  const updateBlob = (id: string, key: "label" | "content", value: string) => {
    setContextBlobs(contextBlobs.map((b) => (b.id === id ? { ...b, [key]: value } : b)))
  }

  const removeBlob = (id: string) => {
    setContextBlobs(contextBlobs.filter((b) => b.id !== id))
  }

  const hasContent = contextBlobs.some((b) => b.content.trim().length > 0)

  const generate = async () => {
    if (!hasContent || suggestionsLoading) return
    setSuggestionsLoading(true)
    try {
      const { data, error } = await supabase.functions.invoke("generate-suggestions", {
        body: {
          contextBlobs,
          proposal,
          accountContext: {
            studioName: account.studioName,
            studioDescription: account.aiStudioDescription,
          },
        },
      })
      if (error) {
        toast.error(friendlyError(error.message))
      } else {
        setSuggestions(data)
        toast.success("Suggestions ready. Check each section tab.")
      }
    } finally {
      setSuggestionsLoading(false)
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-sm font-semibold text-foreground">Deal context</h2>
        <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
          Paste discovery notes, emails, or briefs. Claude will read everything and suggest content across all sections of the proposal.
        </p>
      </div>

      <div className="space-y-4">
        {contextBlobs.map((blob) => (
          <div key={blob.id} className="rounded-lg border border-border p-4 space-y-2">
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={blob.label}
                onChange={(e) => updateBlob(blob.id, "label", e.target.value)}
                placeholder="Label (e.g. Discovery call notes)"
                className="builder-input flex-1 text-xs font-medium"
              />
              <button
                onClick={() => removeBlob(blob.id)}
                className="shrink-0 text-muted-foreground hover:text-foreground transition-colors"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
            <textarea
              value={blob.content}
              onChange={(e) => updateBlob(blob.id, "content", e.target.value)}
              placeholder="Paste context here. Emails, call notes, briefs..."
              rows={8}
              className="builder-input resize-none text-xs leading-relaxed"
            />
          </div>
        ))}

        <button
          onClick={addBlob}
          className="flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-border py-2.5 text-xs font-medium text-muted-foreground hover:border-foreground hover:text-foreground transition-colors"
        >
          <Plus className="h-3.5 w-3.5" /> Add context
        </button>
      </div>

      {suggestions && (
        <p className="text-xs text-brand-1 font-medium">
          Suggestions generated. Check each section for chips to accept or dismiss.
        </p>
      )}

      <button
        onClick={generate}
        disabled={!hasContent || suggestionsLoading}
        className="flex w-full items-center justify-center gap-2 rounded-lg bg-foreground px-4 py-3 text-xs font-medium text-background transition-colors hover:bg-foreground/80 disabled:opacity-40 disabled:cursor-not-allowed"
      >
        <Sparkles className="h-3.5 w-3.5" />
        {suggestionsLoading ? "Generating suggestions..." : suggestions ? "Re-generate suggestions" : "Generate suggestions"}
      </button>
    </div>
  )
}

export default BuilderSectionContext
