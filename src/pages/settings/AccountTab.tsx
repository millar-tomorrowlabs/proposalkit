/**
 * Account settings tab — /settings
 *
 * Studio Editorial styling. Owner-only gate.
 */

import { useState } from "react"
import { Navigate, useNavigate } from "react-router-dom"
import { supabase } from "@/lib/supabase"
import { friendlyError } from "@/lib/errors"
import { useAccount } from "@/contexts/AccountContext"
import ImageUpload from "@/components/builder/ImageUpload"

const labelClass = "mb-1.5 block text-[10px] uppercase tracking-[0.12em]"
const labelStyle = { fontFamily: "var(--font-mono)", color: "var(--color-ink-mute)" }
const inputClass = "w-full rounded-lg border bg-white/50 px-3 py-2.5 text-[14px] outline-none focus:ring-1"
const inputStyle = { borderColor: "var(--color-rule)", color: "var(--color-ink)" }
const helperClass = "mt-1.5 text-[11px] uppercase tracking-[0.12em]"
const helperStyle = { fontFamily: "var(--font-mono)", color: "var(--color-ink-mute)" }

export default function AccountTab() {
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
    if (deleteConfirmText.toLowerCase() !== "delete") return
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
    <div className="space-y-8">
      {/* Studio identity */}
      <section className="space-y-5">
        <div>
          <label className={labelClass} style={labelStyle}>
            Studio name <span style={{ color: "var(--color-forest)" }}>*</span>
          </label>
          <input
            type="text"
            value={studioName}
            onChange={(e) => setStudioName(e.target.value)}
            className={inputClass}
            style={inputStyle}
          />
        </div>

        <div>
          <label className={labelClass} style={labelStyle}>
            Logo
          </label>
          <ImageUpload
            value={logoUrl}
            onChange={(url) => setLogoUrl(url ?? "")}
            storagePath={`account-assets/${account.id}/logo`}
            label="Studio logo"
            hint="Used in proposals and emails"
          />
        </div>

        <div>
          <label className={labelClass} style={labelStyle}>
            Legal entity
          </label>
          <input
            type="text"
            value={legalEntity}
            onChange={(e) => setLegalEntity(e.target.value)}
            placeholder="Shown in proposal footers"
            className={inputClass}
            style={inputStyle}
          />
        </div>

        <div>
          <label className={labelClass} style={labelStyle}>
            Website
          </label>
          <input
            type="text"
            value={website}
            onChange={(e) => setWebsite(e.target.value)}
            placeholder="yourstudio.com"
            className={inputClass}
            style={inputStyle}
          />
        </div>
      </section>

      <hr style={{ borderColor: "var(--color-rule)" }} />

      {/* Email settings */}
      <section className="space-y-5">
        <div>
          <label className={labelClass} style={labelStyle}>
            Notification email <span style={{ color: "var(--color-forest)" }}>*</span>
          </label>
          <input
            type="email"
            value={notifyEmail}
            onChange={(e) => setNotifyEmail(e.target.value)}
            className={inputClass}
            style={inputStyle}
          />
          <p className={helperClass} style={helperStyle}>
            Where submissions are sent
          </p>
        </div>

        <div>
          <label className={labelClass} style={labelStyle}>
            CC email
          </label>
          <input
            type="email"
            value={ccEmail}
            onChange={(e) => setCcEmail(e.target.value)}
            className={inputClass}
            style={inputStyle}
          />
        </div>

        <div>
          <label className={labelClass} style={labelStyle}>
            Default CTA email
          </label>
          <input
            type="email"
            value={defaultCtaEmail}
            onChange={(e) => setDefaultCtaEmail(e.target.value)}
            placeholder="hello@yourstudio.com"
            className={inputClass}
            style={inputStyle}
          />
          <p className={helperClass} style={helperStyle}>
            Pre-filled on new proposals. Clients reply here.
          </p>
        </div>
      </section>

      <hr style={{ borderColor: "var(--color-rule)" }} />

      {/* AI settings */}
      <section className="space-y-5">
        <div>
          <label className={labelClass} style={labelStyle}>
            AI studio description
          </label>
          <textarea
            value={aiDescription}
            onChange={(e) => setAiDescription(e.target.value)}
            rows={3}
            placeholder="Describe your studio for AI-generated proposal content..."
            className={inputClass + " resize-none"}
            style={inputStyle}
          />
          <p className={helperClass} style={helperStyle}>
            Used by AI when generating proposal content
          </p>
        </div>
      </section>

      <hr style={{ borderColor: "var(--color-rule)" }} />

      {/* Proposal defaults */}
      <section className="space-y-5">
        <div>
          <p
            className="text-[10px] uppercase tracking-[0.12em]"
            style={{ fontFamily: "var(--font-mono)", color: "var(--color-ink-mute)" }}
          >
            Proposal defaults
          </p>
          <p className="mt-1 text-[13px]" style={{ color: "var(--color-ink-soft)" }}>
            These populate the About section on every new proposal. You can still edit them per-proposal.
          </p>
        </div>

        <div>
          <label className={labelClass} style={labelStyle}>
            Studio tagline
          </label>
          <input
            type="text"
            value={studioTagline}
            onChange={(e) => setStudioTagline(e.target.value)}
            placeholder="e.g. A design and technology studio exploring the future of commerce"
            className={inputClass}
            style={inputStyle}
          />
        </div>

        <div>
          <label className={labelClass} style={labelStyle}>
            Studio description
          </label>
          <textarea
            value={studioDescription}
            onChange={(e) => setStudioDescription(e.target.value)}
            rows={3}
            placeholder="First paragraph of your studio's About section..."
            className={inputClass + " resize-none"}
            style={inputStyle}
          />
        </div>

        <div>
          <label className={labelClass} style={labelStyle}>
            Studio description (continued)
          </label>
          <textarea
            value={studioDescription2}
            onChange={(e) => setStudioDescription2(e.target.value)}
            rows={3}
            placeholder="Optional second paragraph..."
            className={inputClass + " resize-none"}
            style={inputStyle}
          />
        </div>
      </section>

      {/* Save */}
      <div className="flex items-center gap-4">
        <button
          onClick={handleSave}
          disabled={saving || !studioName.trim() || !notifyEmail.trim()}
          className="flex items-center justify-center rounded-full px-6 py-3 text-[14px] font-medium transition-transform hover:scale-[1.01] disabled:opacity-50"
          style={{ background: "var(--color-forest)", color: "var(--color-cream)" }}
        >
          {saving ? "Saving..." : "Save changes"}
        </button>
        {saved && (
          <span
            className="text-[13px]"
            style={{ fontFamily: "var(--font-mono)", color: "var(--color-forest)" }}
          >
            Saved
          </span>
        )}
      </div>

      <hr style={{ borderColor: "var(--color-rule)" }} />

      {/* Danger zone */}
      <section
        className="rounded-xl border p-6"
        style={{ borderColor: "#A33B2840", background: "#A33B2808" }}
      >
        <p
          className="text-[10px] uppercase tracking-[0.12em]"
          style={{ fontFamily: "var(--font-mono)", color: "#A33B28" }}
        >
          Danger zone
        </p>
        <p className="mt-2 text-[13px]" style={{ color: "var(--color-ink-soft)" }}>
          Deleting your account will permanently remove all proposals, submissions, team members, and account data. This cannot be undone.
        </p>

        {!showDeleteConfirm ? (
          <button
            onClick={() => setShowDeleteConfirm(true)}
            className="mt-4 rounded-full border px-5 py-2.5 text-[13px] font-medium transition-colors hover:opacity-80"
            style={{ borderColor: "#A33B28", color: "#A33B28" }}
          >
            Delete account
          </button>
        ) : (
          <div className="mt-4 space-y-3">
            <p className="text-[13px]" style={{ color: "#A33B28" }}>
              Type <strong>DELETE</strong> to confirm (case-insensitive):
            </p>
            <input
              type="text"
              value={deleteConfirmText}
              onChange={(e) => setDeleteConfirmText(e.target.value)}
              placeholder="DELETE"
              className="w-full rounded-lg border bg-white/50 px-3 py-2.5 text-[14px] outline-none"
              style={{ borderColor: "#A33B2860", color: "var(--color-ink)" }}
            />
            {deleteError && (
              <p className="text-[13px]" style={{ color: "#A33B28" }}>
                {deleteError}
              </p>
            )}
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowDeleteConfirm(false)
                  setDeleteConfirmText("")
                }}
                className="rounded-full border px-5 py-2.5 text-[13px] font-medium transition-colors hover:opacity-70"
                style={{ borderColor: "var(--color-rule)", color: "var(--color-ink-mute)" }}
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteAccount}
                disabled={deleting || deleteConfirmText.toLowerCase() !== "delete"}
                className="rounded-full px-5 py-2.5 text-[13px] font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
                style={{ background: "#A33B28" }}
              >
                {deleting ? "Deleting..." : "Permanently delete account"}
              </button>
            </div>
          </div>
        )}
      </section>
    </div>
  )
}
