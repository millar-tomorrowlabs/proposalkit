import { useState } from "react"
import { Link, Navigate } from "react-router-dom"
import { ArrowLeft } from "lucide-react"
import { supabase } from "@/lib/supabase"
import { useAccount } from "@/contexts/AccountContext"

const AccountSettingsPage = () => {
  const { account, isOwner, refreshAccount } = useAccount()
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const [studioName, setStudioName] = useState(account.studioName)
  const [legalEntity, setLegalEntity] = useState(account.legalEntity || "")
  const [website, setWebsite] = useState(account.website || "")
  const [notifyEmail, setNotifyEmail] = useState(account.notifyEmail)
  const [ccEmail, setCcEmail] = useState(account.ccEmail || "")
  const [defaultCtaEmail, setDefaultCtaEmail] = useState(account.defaultCtaEmail || "")
  const [aiDescription, setAiDescription] = useState(account.aiStudioDescription || "")

  if (!isOwner) return <Navigate to="/proposals" replace />

  const handleSave = async () => {
    setSaving(true)
    setSaved(false)

    const { error } = await supabase
      .from("accounts")
      .update({
        studio_name: studioName,
        legal_entity: legalEntity || null,
        website: website || null,
        notify_email: notifyEmail,
        cc_email: ccEmail || null,
        default_cta_email: defaultCtaEmail || null,
        ai_studio_description: aiDescription || null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", account.id)

    setSaving(false)
    if (!error) {
      setSaved(true)
      await refreshAccount()
      setTimeout(() => setSaved(false), 2000)
    }
  }

  return (
    <div className="mx-auto max-w-2xl px-6 py-12">
      <Link
        to="/proposals"
        className="mb-8 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft size={16} /> Back to proposals
      </Link>

      <h1 className="font-serif text-3xl font-light tracking-tight">
        Account settings
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">
        These defaults apply to all new proposals. Existing proposals are not affected.
      </p>

      <div className="mt-8 space-y-6">
        <div>
          <label className="mb-1 block text-sm font-medium">Studio name *</label>
          <input
            type="text"
            value={studioName}
            onChange={(e) => setStudioName(e.target.value)}
            className="builder-input w-full"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium">Legal entity</label>
          <input
            type="text"
            value={legalEntity}
            onChange={(e) => setLegalEntity(e.target.value)}
            placeholder="Shown in proposal footers"
            className="builder-input w-full"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium">Website</label>
          <input
            type="text"
            value={website}
            onChange={(e) => setWebsite(e.target.value)}
            placeholder="yourstudio.com"
            className="builder-input w-full"
          />
        </div>

        <hr className="border-border" />

        <div>
          <label className="mb-1 block text-sm font-medium">
            Notification email *
          </label>
          <input
            type="email"
            value={notifyEmail}
            onChange={(e) => setNotifyEmail(e.target.value)}
            className="builder-input w-full"
          />
          <p className="mt-1 text-xs text-muted-foreground">
            Where proposal submissions are sent.
          </p>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium">CC email</label>
          <input
            type="email"
            value={ccEmail}
            onChange={(e) => setCcEmail(e.target.value)}
            className="builder-input w-full"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium">
            Default CTA email
          </label>
          <input
            type="email"
            value={defaultCtaEmail}
            onChange={(e) => setDefaultCtaEmail(e.target.value)}
            placeholder="hello@yourstudio.com"
            className="builder-input w-full"
          />
          <p className="mt-1 text-xs text-muted-foreground">
            Pre-filled on new proposals. Clients reply here.
          </p>
        </div>

        <hr className="border-border" />

        <div>
          <label className="mb-1 block text-sm font-medium">
            AI studio description
          </label>
          <textarea
            value={aiDescription}
            onChange={(e) => setAiDescription(e.target.value)}
            rows={3}
            placeholder="Describe your studio for AI-generated proposal content..."
            className="builder-input w-full resize-none"
          />
          <p className="mt-1 text-xs text-muted-foreground">
            Used by AI when generating proposal content. Describe your studio's
            focus, services, and voice.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleSave}
            disabled={saving || !studioName.trim() || !notifyEmail.trim()}
            className="rounded-md bg-foreground px-6 py-2.5 text-sm font-medium text-background transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save changes"}
          </button>
          {saved && (
            <span className="text-sm text-muted-foreground">Saved</span>
          )}
        </div>

        <div className="mt-4 rounded-md border border-border p-4">
          <Link
            to="/settings/team"
            className="text-sm font-medium hover:underline"
          >
            Manage team members →
          </Link>
        </div>
      </div>
    </div>
  )
}

export default AccountSettingsPage
