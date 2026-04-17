/**
 * IssueInviteModal — shared modal for minting an invite code.
 *
 * Used in two places:
 *  - /admin dashboard (quick action)
 *  - /admin/waitlist (pre-filled with a waitlist row's email)
 *
 * Calls the admin-issue-invite edge function, which requires the caller
 * to be in proposl_admins (server-side check, not trusting this UI).
 */

import { useEffect, useState } from "react"
import { Check, Copy } from "lucide-react"
import { supabase } from "@/lib/supabase"
import { extractEdgeFunctionError } from "@/lib/errors"
import type { Plan } from "@/types/account"
import ModalShell from "@/components/admin/ModalShell"

interface Props {
  open: boolean
  onClose: () => void
  onIssued: () => void
  prefillEmail?: string
}

interface Result {
  code: string
  expiresAt: string
  emailSent: boolean
  emailError: string | null
}

export default function IssueInviteModal({ open, onClose, onIssued, prefillEmail }: Props) {
  const [email, setEmail] = useState(prefillEmail ?? "")
  const [plan, setPlan] = useState<Plan>("friends_family")
  const [notes, setNotes] = useState("")
  const [sendEmail, setSendEmail] = useState(true)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [result, setResult] = useState<Result | null>(null)
  const [copied, setCopied] = useState(false)

  // Reset form when the modal is (re-)opened.
  useEffect(() => {
    if (open) {
      setEmail(prefillEmail ?? "")
      setPlan("friends_family")
      setNotes("")
      setSendEmail(true)
      setError("")
      setResult(null)
      setCopied(false)
    }
  }, [open, prefillEmail])

  const handleIssue = async () => {
    setError("")
    setLoading(true)

    const { data, error: fnError } = await supabase.functions.invoke<Result>(
      "admin-issue-invite",
      {
        body: {
          email: email.trim().toLowerCase(),
          plan,
          notes: notes.trim() || undefined,
          sendEmail,
        },
      },
    )

    if (fnError) {
      setError(await extractEdgeFunctionError(fnError))
      setLoading(false)
      return
    }

    if (!data) {
      setError("Something went wrong. Please try again.")
      setLoading(false)
      return
    }

    setResult(data)
    setLoading(false)
    onIssued()
  }

  const handleCopy = () => {
    if (!result) return
    navigator.clipboard.writeText(result.code).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  return (
    <ModalShell
      open={open}
      onClose={onClose}
      eyebrow={result ? "Invite ready" : "New invite"}
      title={result ? "Invite code minted" : "Issue an invite"}
    >
      {result ? (
          <div className="space-y-4">
            <div
              className="rounded-xl border p-4"
              style={{
                background: "var(--color-cream)",
                borderColor: "var(--color-rule)",
              }}
            >
              <p
                className="text-[10px] uppercase tracking-[0.14em]"
                style={{
                  fontFamily: "var(--font-mono)",
                  color: "var(--color-ink-mute)",
                }}
              >
                CODE
              </p>
              <div className="mt-1 flex items-center justify-between gap-3">
                <code
                  className="text-[20px] font-semibold tracking-[0.08em]"
                  style={{ fontFamily: "var(--font-mono)" }}
                >
                  {result.code}
                </code>
                <button
                  onClick={handleCopy}
                  className="flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-[12px] font-medium transition-colors hover:opacity-80"
                  style={{
                    borderColor: "var(--color-forest)",
                    color: "var(--color-forest)",
                  }}
                >
                  {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                  {copied ? "Copied" : "Copy"}
                </button>
              </div>
            </div>

            <p className="text-[13px]" style={{ color: "var(--color-ink-soft)" }}>
              Expires {new Date(result.expiresAt).toLocaleDateString()}.{" "}
              {result.emailSent ? (
                <>Email sent to <span style={{ color: "var(--color-ink)" }}>{email}</span>.</>
              ) : result.emailError ? (
                <>Email failed ({result.emailError}). Send the code manually.</>
              ) : (
                <>Email not sent (toggle was off). Share the code manually.</>
              )}
            </p>

            <button
              onClick={onClose}
              className="w-full rounded-full py-3 text-[14px] font-medium transition-transform hover:scale-[1.01]"
              style={{ background: "var(--color-forest)", color: "var(--color-cream)" }}
            >
              Done
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <label
                className="text-[11px] uppercase tracking-[0.12em]"
                style={{ fontFamily: "var(--font-mono)", color: "var(--color-ink-mute)" }}
              >
                EMAIL
              </label>
              <input
                type="email"
                autoFocus
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="person@example.com"
                className="mt-1.5 w-full rounded-lg border px-3 py-2.5 text-[14px] outline-none focus:border-[color:var(--color-forest)]"
                style={{
                  background: "var(--color-cream)",
                  borderColor: "var(--color-rule)",
                  color: "var(--color-ink)",
                }}
              />
            </div>

            <div>
              <label
                className="text-[11px] uppercase tracking-[0.12em]"
                style={{ fontFamily: "var(--font-mono)", color: "var(--color-ink-mute)" }}
              >
                PLAN
              </label>
              <select
                value={plan}
                onChange={(e) => setPlan(e.target.value as Plan)}
                className="mt-1.5 w-full rounded-lg border px-3 py-2.5 text-[14px] outline-none focus:border-[color:var(--color-forest)]"
                style={{
                  background: "var(--color-cream)",
                  borderColor: "var(--color-rule)",
                  color: "var(--color-ink)",
                }}
              >
                <option value="friends_family">Friends & Family</option>
                <option value="studio">Studio</option>
                <option value="agency">Agency</option>
                <option value="enterprise">Enterprise</option>
              </select>
            </div>

            <div>
              <label
                className="text-[11px] uppercase tracking-[0.12em]"
                style={{ fontFamily: "var(--font-mono)", color: "var(--color-ink-mute)" }}
              >
                NOTES (INTERNAL)
              </label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Met at demo day, cohort 2…"
                className="mt-1.5 w-full rounded-lg border px-3 py-2.5 text-[14px] outline-none focus:border-[color:var(--color-forest)]"
                style={{
                  background: "var(--color-cream)",
                  borderColor: "var(--color-rule)",
                  color: "var(--color-ink)",
                }}
              />
            </div>

            <label className="flex items-center gap-2.5 text-[13px]" style={{ color: "var(--color-ink-soft)" }}>
              <input
                type="checkbox"
                checked={sendEmail}
                onChange={(e) => setSendEmail(e.target.checked)}
                className="h-4 w-4 accent-[color:var(--color-forest)]"
              />
              Email the code to the invitee
            </label>

            {error && (
              <p className="text-[12px]" style={{ color: "#A33B28" }}>
                {error}
              </p>
            )}

            <div className="flex gap-2.5">
              <button
                onClick={onClose}
                disabled={loading}
                className="flex-1 rounded-full border py-2.5 text-[14px] font-medium transition-colors hover:opacity-80 disabled:opacity-40"
                style={{ borderColor: "var(--color-rule)", color: "var(--color-ink-soft)" }}
              >
                Cancel
              </button>
              <button
                onClick={handleIssue}
                disabled={loading || !email.trim()}
                className="flex-1 rounded-full py-2.5 text-[14px] font-medium transition-transform hover:scale-[1.01] disabled:opacity-40"
                style={{ background: "var(--color-forest)", color: "var(--color-cream)" }}
              >
                {loading ? "Issuing…" : "Issue invite"}
              </button>
            </div>
          </div>
        )}
    </ModalShell>
  )
}
