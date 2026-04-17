/**
 * admin-revoke-invite — invalidate an invite code.
 *
 * POST body:
 *   inviteId: required, the UUID of the invite to revoke
 *
 * Behavior:
 *   - Sets revoked_at = now() on the invite.
 *   - Unused invites become unclaimable. (accept-invite checks
 *     revoked_at before honoring the code.)
 *   - Used invites get revoked_at stamped as an audit-only flag —
 *     we do NOT delete the resulting account or remove the user.
 *     Kicking existing accounts is a separate, scarier operation.
 *
 * Returns:
 *   { success: true, inviteId, revokedAt }
 *
 * Auth: Bearer token + caller in proposl_admins.
 *
 * Deploy:
 *   npx supabase functions deploy admin-revoke-invite \
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

interface Body {
  inviteId?: string
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

  const inviteId = (body.inviteId ?? "").trim()
  if (!inviteId) return jsonError(400, "inviteId is required")

  const { data: existing, error: fetchErr } = await admin
    .from("invite_codes")
    .select("id, revoked_at")
    .eq("id", inviteId)
    .maybeSingle()

  if (fetchErr) {
    console.error("admin-revoke-invite fetch error:", fetchErr)
    return jsonError(500, "Could not look up invite")
  }
  if (!existing) return jsonError(404, "Invite not found")
  if (existing.revoked_at) {
    // Idempotent — treat re-revoke as a no-op success.
    return jsonOk({ success: true, inviteId, revokedAt: existing.revoked_at })
  }

  const revokedAt = new Date().toISOString()
  const { error: updateErr } = await admin
    .from("invite_codes")
    .update({ revoked_at: revokedAt })
    .eq("id", inviteId)

  if (updateErr) {
    console.error("admin-revoke-invite update error:", updateErr)
    return jsonError(500, "Could not revoke invite")
  }

  return jsonOk({ success: true, inviteId, revokedAt })
})
