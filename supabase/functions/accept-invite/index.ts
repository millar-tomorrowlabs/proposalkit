/**
 * accept-invite — authenticated endpoint that turns a valid invite code
 * into a fully-provisioned account.
 *
 * Called at the end of the onboarding flow. Replaces the old direct
 * client-side inserts into public.accounts / public.account_members so
 * clients can't create accounts without a valid invite.
 *
 * POST body:
 *   code:           the invite code from the invitation email
 *   studioName:     required
 *   displayName:    required
 *   legalEntity?:   optional
 *   website?:       optional
 *   notifyEmail:    required
 *   ccEmail?:       optional
 *   ctaEmail?:      optional
 *
 * Auth:
 *   Bearer Supabase session token. The session user's email must match
 *   the email the invite code was issued against (case-insensitive).
 *
 * Response:
 *   200 { accountId } on success.
 *   4xx with JSON { error } on validation / auth failure.
 *
 * Deploy:
 *   supabase functions deploy accept-invite --no-verify-jwt \
 *     --project-ref nkygheptubvogevezpap
 */

import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from "jsr:@supabase/supabase-js@2"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
}

// Plan → default caps. Source of truth for what each tier gets.
const PLAN_DEFAULTS: Record<string, { seats: number; sends: number; model: string }> = {
  friends_family: { seats: 3, sends: 10, model: "sonnet" },
  studio: { seats: 5, sends: 10, model: "sonnet" },
  agency: { seats: 20, sends: 30, model: "sonnet" },
  enterprise: { seats: 100, sends: 1000, model: "opus" },
}

interface AcceptInviteBody {
  code?: string
  studioName?: string
  displayName?: string
  legalEntity?: string
  website?: string
  notifyEmail?: string
  ccEmail?: string
  ctaEmail?: string
}

function jsonError(status: number, error: string) {
  return new Response(JSON.stringify({ error }), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  })
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders })
  }
  if (req.method !== "POST") {
    return jsonError(405, "Method not allowed")
  }

  const authHeader = req.headers.get("authorization") ?? ""
  if (!authHeader.toLowerCase().startsWith("bearer ")) {
    return jsonError(401, "Missing authorization")
  }
  const jwt = authHeader.slice(7)

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  )

  // Verify the caller and pull their email out of the token.
  const { data: userData, error: authError } = await admin.auth.getUser(jwt)
  if (authError || !userData?.user) {
    return jsonError(401, "Invalid session")
  }
  const user = userData.user
  const userEmail = (user.email ?? "").toLowerCase()
  if (!userEmail) {
    return jsonError(400, "Session user has no email")
  }

  let body: AcceptInviteBody
  try {
    body = await req.json()
  } catch {
    return jsonError(400, "Invalid JSON body")
  }

  const code = (body.code ?? "").trim()
  const studioName = (body.studioName ?? "").trim()
  const displayName = (body.displayName ?? "").trim()
  const notifyEmail = (body.notifyEmail ?? "").trim()

  if (!code) return jsonError(400, "Invite code is required.")
  if (!studioName) return jsonError(400, "Studio name is required.")
  if (!displayName) return jsonError(400, "Your name is required.")
  if (!notifyEmail) return jsonError(400, "Notification email is required.")

  // Look up the invite code. Case-insensitive on both code and email.
  const { data: invite, error: inviteError } = await admin
    .from("invite_codes")
    .select("*")
    .eq("code", code.toUpperCase())
    .maybeSingle()

  if (inviteError) {
    console.error("accept-invite lookup error:", inviteError)
    return jsonError(500, "Could not validate invite")
  }
  if (!invite) return jsonError(400, "Invite code not found.")
  if (invite.used_at) return jsonError(400, "This invite has already been used.")
  if (new Date(invite.expires_at).getTime() < Date.now()) {
    return jsonError(400, "This invite has expired.")
  }
  if ((invite.email ?? "").toLowerCase() !== userEmail) {
    return jsonError(400, "This invite was issued to a different email.")
  }

  // Safety: don't let someone with an account re-consume an invite.
  const { data: existingMember } = await admin
    .from("account_members")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle()
  if (existingMember) {
    return jsonError(400, "This user already belongs to an account.")
  }

  const plan = invite.plan ?? "friends_family"
  const caps = PLAN_DEFAULTS[plan] ?? PLAN_DEFAULTS.friends_family

  // Create the account + membership. We generate the account id up-front
  // so we can link the waitlist row too without relying on .select() round
  // trips (and to keep the three writes consistent on failure).
  const accountId = crypto.randomUUID()

  const { error: accountError } = await admin.from("accounts").insert({
    id: accountId,
    studio_name: studioName,
    legal_entity: body.legalEntity || null,
    website: body.website || null,
    notify_email: notifyEmail,
    cc_email: body.ccEmail || null,
    sender_name: studioName,
    default_cta_email: body.ctaEmail || null,
    plan,
    max_team_seats: caps.seats,
    max_monthly_sends: caps.sends,
    ai_model_tier: caps.model,
  })
  if (accountError) {
    console.error("accept-invite account insert error:", accountError)
    return jsonError(500, "Could not create account")
  }

  const { error: memberError } = await admin.from("account_members").insert({
    account_id: accountId,
    user_id: user.id,
    role: "owner",
    display_name: displayName,
  })
  if (memberError) {
    // Best-effort cleanup so a failed member insert doesn't strand an
    // orphan account row — the invite is still unused.
    await admin.from("accounts").delete().eq("id", accountId)
    console.error("accept-invite member insert error:", memberError)
    return jsonError(500, "Could not create membership")
  }

  // Mark the invite consumed. Any failure here leaves the account intact
  // (user is in) but flags for manual cleanup — we prefer users over
  // strict bookkeeping on an already-validated signup.
  await admin
    .from("invite_codes")
    .update({ used_at: new Date().toISOString(), used_by_user_id: user.id })
    .eq("id", invite.id)

  // Link the waitlist row if one exists.
  await admin
    .from("waitlist_signups")
    .update({ signup_user_id: user.id })
    .eq("invite_code_id", invite.id)

  return new Response(JSON.stringify({ accountId }), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  })
})
