import { useEffect, useRef, useState } from "react"
import { Lock, LockOpen } from "lucide-react"
import { useBuilderStore } from "@/store/builderStore"
import BuilderField from "../BuilderField"
import SuggestionChip from "../SuggestionChip"
import ImageUpload from "../ImageUpload"
import SectionOrder from "../SectionOrder"
import { supabase } from "@/lib/supabase"
import { CURRENCIES } from "@/lib/currency"
import { useAccount } from "@/contexts/AccountContext"

const BuilderSectionMeta = () => {
  const { proposal, updateField, suggestions } = useBuilderStore()
  const { account } = useAccount()
  const [slugStatus, setSlugStatus] = useState<"idle" | "checking" | "available" | "taken">("idle")
  const slugTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Password protection
  const [passwordEnabled, setPasswordEnabled] = useState(false)
  const [passwordInput, setPasswordInput] = useState("")
  const [passwordSaving, setPasswordSaving] = useState(false)
  const [passwordSaved, setPasswordSaved] = useState(false)

  // Init password state from proposal
  useEffect(() => {
    // password_hash comes from the raw DB row merged into proposal
    setPasswordEnabled(!!(proposal as unknown as Record<string, unknown>).password_hash)
  }, [proposal.id]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleSavePassword = async () => {
    if (!proposal.id) return
    setPasswordSaving(true)
    await supabase.functions.invoke("set-proposal-password", {
      body: { proposalId: proposal.id, password: passwordInput || null },
    })
    setPasswordSaving(false)
    setPasswordSaved(true)
    setPasswordEnabled(!!passwordInput)
    setTimeout(() => setPasswordSaved(false), 2000)
  }

  const handleRemovePassword = async () => {
    if (!proposal.id) return
    setPasswordSaving(true)
    await supabase.functions.invoke("set-proposal-password", {
      body: { proposalId: proposal.id, password: null },
    })
    setPasswordSaving(false)
    setPasswordEnabled(false)
    setPasswordInput("")
    setPasswordSaved(true)
    setTimeout(() => setPasswordSaved(false), 2000)
  }

  useEffect(() => {
    if (slugTimer.current) clearTimeout(slugTimer.current)
    if (!proposal.slug) { setSlugStatus("idle"); return }
    setSlugStatus("checking")
    slugTimer.current = setTimeout(async () => {
      const { data } = await supabase
        .from("proposals")
        .select("id")
        .eq("slug", proposal.slug)
        .neq("id", proposal.id)
        .maybeSingle()
      setSlugStatus(data ? "taken" : "available")
    }, 500)
    return () => { if (slugTimer.current) clearTimeout(slugTimer.current) }
  }, [proposal.slug, proposal.id])

  return (
    <div className="space-y-5">
      <BuilderField label="Section order" hint="Drag to reorder. Remove or add sections.">
        <SectionOrder />
      </BuilderField>

      <div className="border-t border-border pt-4" />

      <h2 className="text-sm font-semibold text-foreground">Proposal details</h2>

      <BuilderField label="Title">
        <input
          type="text"
          value={proposal.title}
          onChange={(e) => updateField("title", e.target.value)}
          placeholder="Flush & Seawards — Shopify Migration"
          className="builder-input"
        />
        <SuggestionChip suggestion={suggestions?.title} path="title" onAccept={(v) => updateField("title", v)} />
      </BuilderField>

      <BuilderField label="Header text" hint={`Shown in the top-left nav. Defaults to '${account.studioName}'.`}>
        <input
          type="text"
          value={proposal.studioName ?? ""}
          onChange={(e) => updateField("studioName", e.target.value)}
          placeholder={account.studioName}
          className="builder-input"
        />
      </BuilderField>

      <BuilderField label="Client name">
        <input
          type="text"
          value={proposal.clientName}
          onChange={(e) => updateField("clientName", e.target.value)}
          placeholder="Flush + Seawards"
          data-builder-field="clientName"
          className="builder-input"
        />
        <SuggestionChip suggestion={suggestions?.clientName} path="clientName" onAccept={(v) => updateField("clientName", v)} />
      </BuilderField>

      <BuilderField label="Slug" hint="Used in the proposal URL: /p/your-slug">
        <input
          type="text"
          value={proposal.slug}
          onChange={(e) => updateField("slug", e.target.value.toLowerCase().replace(/\s+/g, "-"))}
          placeholder="flush-seawards"
          className={`builder-input ${slugStatus === "taken" ? "border-red-500 focus:border-red-500" : ""}`}
        />
        {slugStatus === "checking" && <p className="text-xs text-muted-foreground">Checking...</p>}
        {slugStatus === "taken" && <p className="text-xs text-red-500">This slug is already taken.</p>}
        {slugStatus === "available" && <p className="text-xs text-brand-1">Available</p>}
      </BuilderField>

      <div className="grid grid-cols-2 gap-4">
        <BuilderField label="CTA email">
          <input
            type="email"
            value={proposal.ctaEmail}
            onChange={(e) => updateField("ctaEmail", e.target.value)}
            placeholder={account.defaultCtaEmail || "you@example.com"}
            className="builder-input"
          />
        </BuilderField>
        <BuilderField label="Currency">
          <select
            value={proposal.currency ?? "USD"}
            onChange={(e) => updateField("currency", e.target.value)}
            className="builder-input"
          >
            {CURRENCIES.map((c) => (
              <option key={c.code} value={c.code}>{c.label}</option>
            ))}
          </select>
        </BuilderField>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <BuilderField label="Brand color 1">
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={proposal.brandColor1}
              onChange={(e) => updateField("brandColor1", e.target.value)}
              className="h-8 w-10 cursor-pointer rounded border border-border bg-transparent"
            />
            <input
              type="text"
              value={proposal.brandColor1}
              onChange={(e) => updateField("brandColor1", e.target.value)}
              className="builder-input flex-1 font-mono text-xs"
            />
          </div>
        </BuilderField>
        <BuilderField label="Brand color 2">
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={proposal.brandColor2}
              onChange={(e) => updateField("brandColor2", e.target.value)}
              className="h-8 w-10 cursor-pointer rounded border border-border bg-transparent"
            />
            <input
              type="text"
              value={proposal.brandColor2}
              onChange={(e) => updateField("brandColor2", e.target.value)}
              className="builder-input flex-1 font-mono text-xs"
            />
          </div>
        </BuilderField>
      </div>

      <hr className="border-border" />
      <h2 className="text-sm font-semibold text-foreground">Hero</h2>

      <ImageUpload
        value={proposal.heroImageUrl}
        onChange={(url) => updateField("heroImageUrl", url)}
        storagePath={`${proposal.id}/hero.jpg`}
        label="Hero image"
        hint="JPG, PNG or WebP"
        aspectHint="Landscape recommended"
      />

      <ImageUpload
        value={proposal.clientLogoUrl}
        onChange={(url) => updateField("clientLogoUrl", url)}
        storagePath={`${proposal.id}/logo.png`}
        label="Client logo"
        hint="PNG with transparency works best"
        aspectHint="Optional"
      />

      {proposal.clientLogoUrl && (
        <label className="flex cursor-pointer items-center gap-3">
          <div
            onClick={() => updateField("heroLogoLarge", !proposal.heroLogoLarge)}
            className={`relative h-5 w-9 rounded-full transition-colors ${proposal.heroLogoLarge ? "bg-foreground" : "bg-border"}`}
          >
            <div className={`absolute top-0.5 h-4 w-4 rounded-full bg-background shadow transition-transform ${proposal.heroLogoLarge ? "translate-x-4" : "translate-x-0.5"}`} />
          </div>
          <span className="text-xs text-muted-foreground">
            Use large logo in hero <span className="text-muted-foreground/50">(hides client name)</span>
          </span>
        </label>
      )}

      <BuilderField label="Tagline">
        <input
          type="text"
          value={proposal.tagline}
          onChange={(e) => updateField("tagline", e.target.value)}
          placeholder="Two stores. One platform."
          data-builder-field="tagline"
          className="builder-input"
        />
        <SuggestionChip suggestion={suggestions?.tagline} path="tagline" onAccept={(v) => updateField("tagline", v)} />
      </BuilderField>

      <BuilderField label="Hero description">
        <textarea
          value={proposal.heroDescription}
          onChange={(e) => updateField("heroDescription", e.target.value)}
          rows={3}
          placeholder="A brief description shown under the tagline..."
          data-builder-field="heroDescription"
          className="builder-input resize-none"
        />
        <SuggestionChip suggestion={suggestions?.heroDescription} path="heroDescription" onAccept={(v) => updateField("heroDescription", v)} />
      </BuilderField>

      <BuilderField label="Recommendation" hint="Our recommendation is to... (continues the phrase)">
        <textarea
          value={proposal.recommendation ?? ""}
          onChange={(e) => updateField("recommendation", e.target.value)}
          rows={4}
          placeholder="proceed with the Total package to ensure..."
          data-builder-field="recommendation"
          className="builder-input resize-none"
        />
        <SuggestionChip suggestion={suggestions?.recommendation} path="recommendation" onAccept={(v) => updateField("recommendation", v)} />
      </BuilderField>

      {/* Password protection */}
      <div className="border-t border-border pt-4 mt-2">
        <div className="flex items-center gap-2 mb-2">
          {passwordEnabled ? (
            <Lock className="h-3.5 w-3.5 text-foreground" />
          ) : (
            <LockOpen className="h-3.5 w-3.5 text-muted-foreground" />
          )}
          <span className="text-sm font-medium">Password protection</span>
          {passwordEnabled && (
            <span className="text-[10px] font-medium text-emerald-600 bg-emerald-500/10 px-1.5 py-0.5 rounded-full">Active</span>
          )}
        </div>
        <p className="text-xs text-muted-foreground mb-3">
          {passwordEnabled
            ? "Viewers must enter a password to access this proposal."
            : "Optionally require a password to view this proposal."}
        </p>
        <div className="flex gap-2">
          <input
            type="text"
            value={passwordInput}
            onChange={(e) => setPasswordInput(e.target.value)}
            placeholder={passwordEnabled ? "Enter new password" : "Set a password"}
            className="builder-input flex-1"
          />
          <button
            onClick={handleSavePassword}
            disabled={passwordSaving || !passwordInput.trim()}
            className="shrink-0 rounded-md bg-foreground px-3 py-1.5 text-xs font-medium text-background transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {passwordSaving ? "Saving..." : passwordSaved ? "Saved!" : passwordEnabled ? "Update" : "Set"}
          </button>
        </div>
        {passwordEnabled && (
          <button
            onClick={handleRemovePassword}
            className="mt-2 text-xs text-red-600 hover:text-red-700 transition-colors"
          >
            Remove password
          </button>
        )}
      </div>
    </div>
  )
}

export default BuilderSectionMeta
