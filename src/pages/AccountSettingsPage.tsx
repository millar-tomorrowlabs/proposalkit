import { useState } from "react"
import { Link, Navigate, useNavigate } from "react-router-dom"
import { ArrowLeft } from "lucide-react"
import { supabase } from "@/lib/supabase"
import { friendlyError } from "@/lib/errors"
import { useAccount } from "@/contexts/AccountContext"
import ImageUpload from "@/components/builder/ImageUpload"

const AccountSettingsPage = () => {
  const { account, isOwner, refreshAccount } = useAccount()
  const navigate = useNavigate()
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const [studioName, setStudioName] = useState(account.studioName)
  const [legalEntity, setLegalEntity] = useState(account.legalEntity || "")
  const [website, setWebsite] = useState(account.website || "")
  const [logoUrl, setLogoUrl] = useState(account.logoUrl || "")
  const [notifyEmail, setNotifyEmail] = useState(account.notifyEmail)
  const [ccEmail, setCcEmail] = useState(account.ccEmail || "")
  const [defaultCtaEmail, setDefaultCtaEmail] = useState(account.defaultCtaEmail || "")
  const [aiDescription, setAiDescription] = useState(account.aiStudioDescription || "")
  const [studioTagline, setStudioTagline] = useState(account.defaultStudioTagline || "")
  const [studioDescription, setStudioDescription] = useState(account.defaultStudioDescription || "")
  const [studioDescription2, setStudioDescription2] = useState(account.defaultStudioDescription2 || "")

  // Delete account state
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deleteConfirmText, setDeleteConfirmText] = useState("")
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState("")

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
        logo_url: logoUrl || null,
        notify_email: notifyEmail,
        cc_email: ccEmail || null,
        default_cta_email: defaultCtaEmail || null,
        ai_studio_description: aiDescription || null,
        default_studio_tagline: studioTagline || null,
        default_studio_description: studioDescription || null,
        default_studio_description_2: studioDescription2 || null,
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

  const handleDeleteAccount = async () => {
    if (deleteConfirmText !== account.studioName) return
    setDeleting(true)
    setDeleteError("")

    const { error } = await supabase
      .from("accounts")
      .delete()
      .eq("id", account.id)

    if (error) {
      setDeleteError(friendlyError(error.message))
      setDeleting(false)
      return
    }

    await supabase.auth.signOut()
    navigate("/login")
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
          <label className="mb-2 block text-sm font-medium">Logo</label>
          <ImageUpload
            value={logoUrl}
            onChange={(url) => setLogoUrl(url ?? "")}
            storagePath={`account-assets/${account.id}/logo`}
            label="Studio logo"
            hint="Used in proposals and emails"
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

        <hr className="border-border" />

        <h2 className="text-sm font-semibold text-foreground">Proposal defaults</h2>
        <p className="text-xs text-muted-foreground -mt-4">
          These populate the "About" section on every new proposal. You can still edit them per-proposal.
        </p>

        <div>
          <label className="mb-1 block text-sm font-medium">Studio tagline</label>
          <input
            type="text"
            value={studioTagline}
            onChange={(e) => setStudioTagline(e.target.value)}
            placeholder="e.g. A design and technology studio exploring the future of commerce"
            className="builder-input w-full"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium">Studio description</label>
          <textarea
            value={studioDescription}
            onChange={(e) => setStudioDescription(e.target.value)}
            rows={3}
            placeholder="First paragraph of your studio's About section..."
            className="builder-input w-full resize-none"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium">Studio description (continued)</label>
          <textarea
            value={studioDescription2}
            onChange={(e) => setStudioDescription2(e.target.value)}
            rows={3}
            placeholder="Optional second paragraph..."
            className="builder-input w-full resize-none"
          />
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

        {/* Danger Zone */}
        <hr className="border-border" />

        <div className="rounded-lg border border-red-200 bg-red-50/50 p-6">
          <h2 className="text-sm font-semibold text-red-800">Danger zone</h2>
          <p className="mt-1 text-sm text-red-700/70">
            Deleting your account will permanently remove all proposals,
            submissions, team members, and account data. This cannot be undone.
          </p>

          {!showDeleteConfirm ? (
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="mt-4 rounded-md border border-red-300 px-4 py-2 text-sm font-medium text-red-700 transition-colors hover:bg-red-100"
            >
              Delete account
            </button>
          ) : (
            <div className="mt-4 space-y-3">
              <p className="text-sm text-red-800">
                Type <strong>{account.studioName}</strong> to confirm:
              </p>
              <input
                type="text"
                value={deleteConfirmText}
                onChange={(e) => setDeleteConfirmText(e.target.value)}
                placeholder={account.studioName}
                className="w-full rounded-md border border-red-300 bg-white px-3 py-2 text-sm outline-none focus:border-red-500"
              />
              {deleteError && (
                <p className="text-sm text-red-600">{deleteError}</p>
              )}
              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setShowDeleteConfirm(false)
                    setDeleteConfirmText("")
                  }}
                  className="rounded-md border border-border px-4 py-2 text-sm font-medium transition-colors hover:bg-muted/50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDeleteAccount}
                  disabled={deleting || deleteConfirmText !== account.studioName}
                  className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
                >
                  {deleting ? "Deleting..." : "Permanently delete account"}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default AccountSettingsPage
