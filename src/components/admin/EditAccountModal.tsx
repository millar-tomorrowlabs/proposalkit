/**
 * EditAccountModal — admin edits to an account's plan + caps.
 *
 * "Reset caps to plan defaults" snaps the seat/send/model caps to the
 * chosen plan's baseline. Leave it off to nudge caps individually
 * (e.g. grant one studio extra sends without moving them off F&F).
 */

import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"
import { extractEdgeFunctionError } from "@/lib/errors"
import type { AiModelTier, Plan } from "@/types/account"
import ModalShell from "@/components/admin/ModalShell"

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
  const [aiModelAiModelTier, setAiModelAiModelTier] = useState<AiModelTier>("sonnet")
  const [resetCaps, setResetCaps] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  // Re-seed local state when the modal opens with a different account.
  useEffect(() => {
    if (open && account) {
      setPlan((account.plan as Plan) ?? "friends_family")
      setMaxTeamSeats(account.max_team_seats ?? 3)
      setMaxMonthlySends(account.max_monthly_sends ?? 10)
      setAiModelAiModelTier((account.ai_model_tier as AiModelTier) ?? "sonnet")
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
      body.aiModelAiModelTier = aiModelAiModelTier
    }

    const { error: fnError } = await supabase.functions.invoke("admin-update-account", { body })
    setLoading(false)

    if (fnError) {
      setError(await extractEdgeFunctionError(fnError))
      return
    }

    onSaved()
    onClose()
  }

  if (!account) return null

  return (
    <ModalShell
      open={open}
      onClose={onClose}
      eyebrow="Edit account"
      title={account.studio_name}
    >
        <div className="space-y-4">
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
                  value={aiModelAiModelTier}
                  onChange={(e) => setAiModelAiModelTier(e.target.value as AiModelTier)}
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
    </ModalShell>
  )
}
