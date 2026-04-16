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
  const [studioTagline, setStudioTagline] = useState(account.defaultStudioTagline || "")
  const [studioDescription, setStudioDescription] = useState(account.defaultStudioDescription || "")
  const [studioDescription2, setStudioDescription2] = useState(account.defaultStudioDescription2 || "")
  // AI voice & pricing defaults — passed into the chat system prompt
  const [voiceDescription, setVoiceDescription] = useState(account.voiceDescription || "")
  const [voiceExamples, setVoiceExamples] = useState(account.voiceExamples || "")
  const [bannedPhrases, setBannedPhrases] = useState(account.bannedPhrases || "")
  const [defaultHourlyRate, setDefaultHourlyRate] = useState<string>(
    account.defaultHourlyRate != null ? String(account.defaultHourlyRate) : "",
  )
  const [defaultCurrency, setDefaultCurrency] = useState(account.defaultCurrency || "")
  const [aiTailorAgencyBio, setAiTailorAgencyBio] = useState<boolean>(
    account.aiTailorAgencyBio !== false, // undefined or true → true
  )

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
        default_studio_tagline: studioTagline || null,
        default_studio_description: studioDescription || null,
        default_studio_description_2: studioDescription2 || null,
        voice_description: voiceDescription || null,
        voice_examples: voiceExamples || null,
        banned_phrases: bannedPhrases || null,
        default_hourly_rate: defaultHourlyRate.trim() === "" ? null : Number(defaultHourlyRate),
        default_currency: defaultCurrency.trim() === "" ? null : defaultCurrency.trim().toUpperCase(),
        ai_tailor_agency_bio: aiTailorAgencyBio,
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

  // Plan display metadata. We show this as a small read-only badge so
  // the user knows which limits apply. Plan assignment is admin-only
  // (changed via SQL) so there's no edit affordance here.
  const planLabel = (() => {
    switch (account.plan) {
      case "friends_family": return "Friends & Family — Feedback"
      case "studio": return "Studio"
      case "agency": return "Agency"
      case "enterprise": return "Enterprise"
      default: return "Friends & Family — Feedback"
    }
  })()
  const maxSeats = account.maxTeamSeats ?? 3
  const maxSends = account.maxMonthlySends ?? 10

  return (
    <div className="space-y-8">
      {/* Plan badge */}
      <section
        className="rounded-xl border p-5"
        style={{ borderColor: "var(--color-rule)", background: "var(--color-cream)" }}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <p
              className="text-[10px] uppercase tracking-[0.14em]"
              style={{ fontFamily: "var(--font-mono)", color: "var(--color-ink-mute)" }}
            >
              CURRENT PLAN
            </p>
            <p
              className="mt-1 text-[15px] font-medium"
              style={{ color: "var(--color-ink)" }}
            >
              {planLabel}
            </p>
            <p
              className="mt-2 text-[12px]"
              style={{ color: "var(--color-ink-soft)" }}
            >
              Up to {maxSeats} team members. {maxSends} sent proposals per month. Paid plans coming soon — you'll be the first to know.
            </p>
          </div>
        </div>
      </section>

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

      {/* ── AI voice & pricing defaults ─────────────────────────────── */}
      <section className="space-y-5">
        <div>
          <p
            className="text-[11px] uppercase tracking-[0.14em]"
            style={{ fontFamily: "var(--font-mono)", color: "var(--color-ink-mute)" }}
          >
            AI Voice & Pricing
          </p>
          <p
            className="mt-1.5 text-[13px]"
            style={{ color: "var(--color-ink-soft)" }}
          >
            Grounds the in-app AI so drafts sound like you, not like a generic assistant. The AI sees these on every turn.
          </p>
        </div>

        <div>
          <label className={labelClass} style={labelStyle}>
            Voice description
          </label>
          <textarea
            value={voiceDescription}
            onChange={(e) => setVoiceDescription(e.target.value)}
            rows={3}
            placeholder="Direct, opinionated, plainspoken. Use active voice. Avoid agency jargon. Short sentences mixed with long ones."
            className={inputClass + " resize-none"}
            style={inputStyle}
          />
          <p
            className="mt-1.5 text-[11px] uppercase tracking-[0.12em]"
            style={{ fontFamily: "var(--font-mono)", color: "var(--color-ink-mute)" }}
          >
            Tell the AI how you write
          </p>
        </div>

        <div>
          <label className={labelClass} style={labelStyle}>
            Writing samples
          </label>
          <textarea
            value={voiceExamples}
            onChange={(e) => setVoiceExamples(e.target.value)}
            rows={6}
            placeholder="Paste 1-3 paragraphs from proposals you're proud of. The AI matches their rhythm and word choice."
            className={inputClass + " resize-none"}
            style={inputStyle}
          />
          <p
            className="mt-1.5 text-[11px] uppercase tracking-[0.12em]"
            style={{ fontFamily: "var(--font-mono)", color: "var(--color-ink-mute)" }}
          >
            Show, don't tell. Paste real examples.
          </p>
        </div>

        <div>
          <label className={labelClass} style={labelStyle}>
            Banned phrases
          </label>
          <input
            type="text"
            value={bannedPhrases}
            onChange={(e) => setBannedPhrases(e.target.value)}
            placeholder="partner, ecosystem, solutions (comma-separated)"
            className={inputClass}
            style={inputStyle}
          />
          <p
            className="mt-1.5 text-[11px] uppercase tracking-[0.12em]"
            style={{ fontFamily: "var(--font-mono)", color: "var(--color-ink-mute)" }}
          >
            Studio-specific additions to the universal banned list
          </p>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelClass} style={labelStyle}>
              Default hourly rate
            </label>
            <input
              type="number"
              min="0"
              step="1"
              value={defaultHourlyRate}
              onChange={(e) => setDefaultHourlyRate(e.target.value)}
              placeholder="150"
              className={inputClass}
              style={inputStyle}
            />
          </div>
          <div>
            <label className={labelClass} style={labelStyle}>
              Default currency
            </label>
            <input
              type="text"
              maxLength={3}
              value={defaultCurrency}
              onChange={(e) => setDefaultCurrency(e.target.value.toUpperCase())}
              placeholder="USD"
              className={inputClass}
              style={inputStyle}
            />
            <p
              className="mt-1.5 text-[11px] uppercase tracking-[0.12em]"
              style={{ fontFamily: "var(--font-mono)", color: "var(--color-ink-mute)" }}
            >
              ISO 4217 (USD, EUR, GBP...)
            </p>
          </div>
        </div>

        {/* AI tailoring toggle for the agency bio */}
        <div className="mt-2">
          <label className="flex items-start gap-3 cursor-pointer group">
            <input
              type="checkbox"
              checked={aiTailorAgencyBio}
              onChange={(e) => setAiTailorAgencyBio(e.target.checked)}
              className="mt-0.5 h-4 w-4 cursor-pointer"
              style={{ accentColor: "var(--color-forest)" }}
            />
            <div className="flex-1">
              <div className="text-[13px] font-medium" style={{ color: "var(--color-ink)" }}>
                Let AI tailor the agency bio per proposal
              </div>
              <p className="mt-1 text-[12px]" style={{ color: "var(--color-ink-soft)" }}>
                When on, the AI keeps the core of your default agency description but adjusts phrasing to name the client or project type. Turn off to force the bio to render verbatim in every proposal.
              </p>
            </div>
          </label>
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
