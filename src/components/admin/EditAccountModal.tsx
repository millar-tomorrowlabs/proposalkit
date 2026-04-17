/**
 * EditAccountModal — admin edits to an account's plan + caps.
 *
 * "Reset caps to plan defaults" snaps the seat/send/model caps to the
 * chosen plan's baseline. Leave it off to nudge caps individually
 * (e.g. grant one studio extra sends without moving them off F&F).
 */

import { useEffect, useState } from "react"
import { X } from "lucide-react"
import { supabase } from "@/lib/supabase"
import { friendlyError } from "@/lib/errors"

type Plan = "friends_family" | "studio" | "agency" | "enterprise"
type Tier = "haiku" | "sonnet" | "opus"

export interface EditableAccount {
  id: string
  studio_name: string
  plan: string
  max_team_seats: number
  max_monthly_sends: number
  ai_model_tier: string
}

interface Props {
  open: boolean
  account: EditableAccount | null
  onClose: () => void
  onSaved: () => void
}

export default function EditAccountModal({ open, account, onClose, onSaved }: Props) {
  const [plan, setPlan] = useState<Plan>("friends_family")
  const [maxTeamSeats, setMaxTeamSeats] = useState(3)
  const [maxMonthlySends, setMaxMonthlySends] = useState(10)
  const [aiModelTier, setAiModelTier] = useState<Tier>("sonnet")
  const [resetCaps, setResetCaps] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  // Re-seed local state when the modal opens with a different account.
  useEffect(() => {
    if (open && account) {
      setPlan((account.plan as Plan) ?? "friends_family")
      setMaxTeamSeats(account.max_team_seats ?? 3)
      setMaxMonthlySends(account.max_monthly_sends ?? 10)
      setAiModelTier((account.ai_model_tier as Tier) ?? "sonnet")
      setResetCaps(false)
      setError("")
    }
  }, [open, account])

  const handleSave = async () => {
    if (!account) return
    setError("")
    setLoading(true)

    const body: Record<string, unknown> = {
      accountId: account.id,
      plan,
      resetCapsToPlan: resetCaps,
    }
    if (!resetCaps) {
      body.maxTeamSeats = maxTeamSeats
      body.maxMonthlySends = maxMonthlySends
      body.aiModelTier = aiModelTier
    }

    const { error: fnError } = await supabase.functions.invoke("admin-update-account", { body })
    setLoading(false)

    if (fnError) {
      let message = fnError.message
      const ctx = (fnError as { context?: Response }).context
      if (ctx && typeof ctx.json === "function") {
        try {
          const parsed = await ctx.json()
          if (parsed?.error) message = parsed.error
        } catch { /* swallow */ }
      }
      setError(friendlyError(message))
      return
    }

    onSaved()
    onClose()
  }

  if (!open || !account) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(17, 24, 17, 0.4)" }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-2xl border p-6 md:p-7"
        style={{ background: "var(--color-paper)", borderColor: "var(--color-rule)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between">
          <div>
            <p
              className="text-[11px] uppercase tracking-[0.14em]"
              style={{ fontFamily: "var(--font-mono)", color: "var(--color-ink-mute)" }}
            >
              EDIT ACCOUNT
            </p>
            <h2
              className="mt-1 text-[22px] leading-[1.2] tracking-[-0.01em]"
              style={{ fontFamily: "var(--font-merchant-display)", fontWeight: 500 }}
            >
              {account.studio_name}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="rounded-full p-1.5 transition-colors hover:opacity-70"
            style={{ color: "var(--color-ink-mute)" }}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-5 space-y-4">
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
              className="mt-1.5 w-full rounded-lg border px-3 py-2.5 text-[14px] outline-none"
              style={{ background: "var(--color-cream)", borderColor: "var(--color-rule)", color: "var(--color-ink)" }}
            >
              <option value="friends_family">Friends & Family</option>
              <option value="studio">Studio</option>
              <option value="agency">Agency</option>
              <option value="enterprise">Enterprise</option>
            </select>
          </div>

          <label className="flex items-center gap-2.5 text-[13px]" style={{ color: "var(--color-ink-soft)" }}>
            <input
              type="checkbox"
              checked={resetCaps}
              onChange={(e) => setResetCaps(e.target.checked)}
              className="h-4 w-4 accent-[color:var(--color-forest)]"
            />
            Reset seats/sends/model to this plan's defaults
          </label>

          {!resetCaps && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label
                    className="text-[11px] uppercase tracking-[0.12em]"
                    style={{ fontFamily: "var(--font-mono)", color: "var(--color-ink-mute)" }}
                  >
                    SEATS
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={maxTeamSeats}
                    onChange={(e) => setMaxTeamSeats(parseInt(e.target.value, 10) || 1)}
                    className="mt-1.5 w-full rounded-lg border px-3 py-2.5 text-[14px] outline-none"
                    style={{ background: "var(--color-cream)", borderColor: "var(--color-rule)", color: "var(--color-ink)" }}
                  />
                </div>
                <div>
                  <label
                    className="text-[11px] uppercase tracking-[0.12em]"
                    style={{ fontFamily: "var(--font-mono)", color: "var(--color-ink-mute)" }}
                  >
                    SENDS / MO
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={maxMonthlySends}
                    onChange={(e) => setMaxMonthlySends(parseInt(e.target.value, 10) || 0)}
                    className="mt-1.5 w-full rounded-lg border px-3 py-2.5 text-[14px] outline-none"
                    style={{ background: "var(--color-cream)", borderColor: "var(--color-rule)", color: "var(--color-ink)" }}
                  />
                </div>
              </div>

              <div>
                <label
                  className="text-[11px] uppercase tracking-[0.12em]"
                  style={{ fontFamily: "var(--font-mono)", color: "var(--color-ink-mute)" }}
                >
                  AI MODEL
                </label>
                <select
                  value={aiModelTier}
                  onChange={(e) => setAiModelTier(e.target.value as Tier)}
                  className="mt-1.5 w-full rounded-lg border px-3 py-2.5 text-[14px] outline-none"
                  style={{ background: "var(--color-cream)", borderColor: "var(--color-rule)", color: "var(--color-ink)" }}
                >
                  <option value="haiku">Haiku (fastest, cheapest)</option>
                  <option value="sonnet">Sonnet (default)</option>
                  <option value="opus">Opus (best, expensive)</option>
                </select>
              </div>
            </>
          )}

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
              onClick={handleSave}
              disabled={loading}
              className="flex-1 rounded-full py-2.5 text-[14px] font-medium transition-transform hover:scale-[1.01] disabled:opacity-40"
              style={{ background: "var(--color-forest)", color: "var(--color-cream)" }}
            >
              {loading ? "Saving…" : "Save changes"}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
