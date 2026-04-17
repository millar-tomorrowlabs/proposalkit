/**
 * admin-update-account — change an account's plan + caps.
 *
 * POST body:
 *   accountId:         required, UUID of the account
 *   plan?:             friends_family | studio | agency | enterprise
 *   maxTeamSeats?:     integer, overrides plan default
 *   maxMonthlySends?:  integer, overrides plan default
 *   aiModelTier?:      'sonnet' | 'opus' | 'haiku'
 *   resetCapsToPlan?:  if true, snap caps/model to the plan's defaults
 *                      (individual cap fields above still win if also set)
 *
 * Returns:
 *   { success: true, account: { ... updated fields ... } }
 *
 * Auth: Bearer token + caller in proposl_admins.
 *
 * Deploy:
 *   npx supabase functions deploy admin-update-account \
 *     --project-ref nkygheptubvogevezpap --no-verify-jwt
 */

import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import {
  adminClient,
  corsHeaders,
  jsonError,
  jsonOk,
  requireAdmin,
} from "../_shared/admin.ts"

const ALLOWED_PLANS = new Set(["friends_family", "studio", "agency", "enterprise"])
const ALLOWED_TIERS = new Set(["haiku", "sonnet", "opus"])

const PLAN_DEFAULTS: Record<string, { seats: number; sends: number; model: string }> = {
  friends_family: { seats: 3, sends: 10, model: "sonnet" },
  studio: { seats: 5, sends: 10, model: "sonnet" },
  agency: { seats: 20, sends: 30, model: "sonnet" },
  enterprise: { seats: 100, sends: 1000, model: "opus" },
}

interface Body {
  accountId?: string
  plan?: string
  maxTeamSeats?: number
  maxMonthlySends?: number
  aiModelTier?: string
  resetCapsToPlan?: boolean
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders })
  if (req.method !== "POST") return jsonError(405, "Method not allowed")

  const admin = adminClient()
  const auth = await requireAdmin(req, admin)
  if (auth instanceof Response) return auth

  let body: Body
  try {
    body = await req.json()
  } catch {
    return jsonError(400, "Invalid JSON body")
  }

  const accountId = (body.accountId ?? "").trim()
  if (!accountId) return jsonError(400, "accountId is required")

  // Nothing to do? Bail loud so the UI knows.
  if (
    body.plan === undefined &&
    body.maxTeamSeats === undefined &&
    body.maxMonthlySends === undefined &&
    body.aiModelTier === undefined &&
    !body.resetCapsToPlan
  ) {
    return jsonError(400, "No fields to update")
  }

  // Validate each field before we touch the DB.
  const updates: Record<string, unknown> = {}

  if (body.plan !== undefined) {
    if (!ALLOWED_PLANS.has(body.plan)) return jsonError(400, "Unknown plan")
    updates.plan = body.plan
  }

  // If resetCapsToPlan is set, snap caps to the target plan's defaults.
  // (Use the plan from this request if provided, else the current plan.)
  if (body.resetCapsToPlan) {
    let targetPlan = body.plan
    if (!targetPlan) {
      const { data: current } = await admin
        .from("accounts")
        .select("plan")
        .eq("id", accountId)
        .maybeSingle()
      targetPlan = (current?.plan as string | undefined) ?? "friends_family"
    }
    const defaults = PLAN_DEFAULTS[targetPlan] ?? PLAN_DEFAULTS.friends_family
    updates.max_team_seats = defaults.seats
    updates.max_monthly_sends = defaults.sends
    updates.ai_model_tier = defaults.model
  }

  // Individual cap fields override the plan-reset above.
  if (body.maxTeamSeats !== undefined) {
    if (!Number.isInteger(body.maxTeamSeats) || body.maxTeamSeats < 1) {
      return jsonError(400, "maxTeamSeats must be a positive integer")
    }
    updates.max_team_seats = body.maxTeamSeats
  }
  if (body.maxMonthlySends !== undefined) {
    if (!Number.isInteger(body.maxMonthlySends) || body.maxMonthlySends < 0) {
      return jsonError(400, "maxMonthlySends must be >= 0")
    }
    updates.max_monthly_sends = body.maxMonthlySends
  }
  if (body.aiModelTier !== undefined) {
    if (!ALLOWED_TIERS.has(body.aiModelTier)) return jsonError(400, "Unknown aiModelTier")
    updates.ai_model_tier = body.aiModelTier
  }

  const { data: updated, error } = await admin
    .from("accounts")
    .update(updates)
    .eq("id", accountId)
    .select("id, plan, max_team_seats, max_monthly_sends, ai_model_tier, studio_name")
    .maybeSingle()

  if (error) {
    console.error("admin-update-account error:", error)
    return jsonError(500, "Could not update account")
  }
  if (!updated) return jsonError(404, "Account not found")

  return jsonOk({ success: true, account: updated })
})
