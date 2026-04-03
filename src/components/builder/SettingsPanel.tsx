import { useEffect, useRef, useState } from "react"
import { Lock, LockOpen } from "lucide-react"
import { useBuilderStore } from "@/store/builderStore"
import BuilderField from "./BuilderField"
import ImageUpload from "./ImageUpload"
import SectionOrder from "./SectionOrder"
import { supabase } from "@/lib/supabase"
import { CURRENCIES } from "@/lib/currency"
import { useAccount } from "@/contexts/AccountContext"

const SettingsPanel = () => {
  const { proposal, updateField } = useBuilderStore()
  const { account } = useAccount()
  const [slugStatus, setSlugStatus] = useState<"idle" | "checking" | "available" | "taken">("idle")
  const slugTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Password protection
  const [passwordEnabled, setPasswordEnabled] = useState(false)
  const [passwordInput, setPasswordInput] = useState("")
  const [passwordSaving, setPasswordSaving] = useState(false)
  const [passwordSaved, setPasswordSaved] = useState(false)

  useEffect(() => {
    setPasswordEnabled(!!(proposal as unknown as Record<string, unknown>).password_hash)
  }, [proposal.id]) // eslint-disable-line react-hooks/exhaustive-deps

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

  const handleSavePassword = async () => {
    if (!proposal.id) return
    setPasswordSaving(true)
    await supabase.functions.invoke("set-proposal-password", {
      body: { proposalId: proposal.id, password: passwordInput || null },
    })
    setPasswordSaving(false)
    setPasswordEnabled(!!passwordInput)
    setPasswordSaved(true)
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

  return (
    <div className="space-y-4 p-5">
      <h2 className="text-xs font-semibold uppercase tracking-[0.15em] text-muted-foreground">Settings</h2>

      <BuilderField label="Title">
        <input
          type="text"
          value={proposal.title}
          onChange={(e) => updateField("title", e.target.value)}
          placeholder="Project title"
          className="builder-input"
        />
      </BuilderField>

      <BuilderField label="Header text" hint={`Defaults to '${account.studioName}'.`}>
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
          placeholder="Client Co."
          className="builder-input"
        />
      </BuilderField>

      <BuilderField label="Slug" hint="/p/your-slug">
        <input
          type="text"
          value={proposal.slug}
          onChange={(e) => updateField("slug", e.target.value.toLowerCase().replace(/\s+/g, "-"))}
          placeholder="project-slug"
          className={`builder-input ${slugStatus === "taken" ? "border-red-500" : ""}`}
        />
        {slugStatus === "checking" && <p className="text-xs text-muted-foreground">Checking...</p>}
        {slugStatus === "taken" && <p className="text-xs text-red-500">Slug taken.</p>}
        {slugStatus === "available" && <p className="text-xs text-brand-1">Available</p>}
      </BuilderField>

      <div className="grid grid-cols-2 gap-3">
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

      <div className="grid grid-cols-2 gap-3">
        <BuilderField label="Color 1">
          <div className="flex items-center gap-2">
            <input type="color" value={proposal.brandColor1} onChange={(e) => updateField("brandColor1", e.target.value)} className="h-7 w-8 cursor-pointer rounded border border-border bg-transparent" />
            <input type="text" value={proposal.brandColor1} onChange={(e) => updateField("brandColor1", e.target.value)} className="builder-input flex-1 font-mono text-xs" />
          </div>
        </BuilderField>
        <BuilderField label="Color 2">
          <div className="flex items-center gap-2">
            <input type="color" value={proposal.brandColor2} onChange={(e) => updateField("brandColor2", e.target.value)} className="h-7 w-8 cursor-pointer rounded border border-border bg-transparent" />
            <input type="text" value={proposal.brandColor2} onChange={(e) => updateField("brandColor2", e.target.value)} className="builder-input flex-1 font-mono text-xs" />
          </div>
        </BuilderField>
      </div>

      <hr className="border-border" />

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
          <span className="text-xs text-muted-foreground">Large logo in hero</span>
        </label>
      )}

      <hr className="border-border" />

      <BuilderField label="Section order" hint="Drag to reorder.">
        <SectionOrder />
      </BuilderField>

      <hr className="border-border" />

      {/* Password protection */}
      <div>
        <div className="flex items-center gap-2 mb-2">
          {passwordEnabled ? <Lock className="h-3.5 w-3.5 text-foreground" /> : <LockOpen className="h-3.5 w-3.5 text-muted-foreground" />}
          <span className="text-xs font-medium">Password protection</span>
          {passwordEnabled && <span className="text-[10px] font-medium text-emerald-600 bg-emerald-500/10 px-1.5 py-0.5 rounded-full">Active</span>}
        </div>
        <div className="flex gap-2">
          <input
            type="text"
            value={passwordInput}
            onChange={(e) => setPasswordInput(e.target.value)}
            placeholder={passwordEnabled ? "New password" : "Set password"}
            className="builder-input flex-1"
          />
          <button
            onClick={handleSavePassword}
            disabled={passwordSaving || !passwordInput.trim()}
            className="shrink-0 rounded-md bg-foreground px-3 py-1.5 text-xs font-medium text-background transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {passwordSaving ? "..." : passwordSaved ? "Saved" : passwordEnabled ? "Update" : "Set"}
          </button>
        </div>
        {passwordEnabled && (
          <button onClick={handleRemovePassword} className="mt-1.5 text-xs text-red-600 hover:text-red-700 transition-colors">
            Remove password
          </button>
        )}
      </div>
    </div>
  )
}

export default SettingsPanel
