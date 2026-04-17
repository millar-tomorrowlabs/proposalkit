/**
 * Shared helpers for admin-gated edge functions.
 *
 * Every admin-* function runs the same auth check: pull the Supabase
 * session off the Authorization header, require it to belong to a user
 * whose email is in public.proposl_admins. This file centralizes that so
 * we don't drift.
 */

import { createClient, SupabaseClient } from "jsr:@supabase/supabase-js@2"

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
}

export function jsonError(status: number, error: string): Response {
  return new Response(JSON.stringify({ error }), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  })
}

export function jsonOk(body: Record<string, unknown>): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  })
}

export function adminClient(): SupabaseClient {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  )
}

/**
 * Verifies the bearer token on the request and that the user is a
 * Proposl admin. Returns the authenticated email on success, or a
 * Response you should short-circuit return on failure.
 */
export async function requireAdmin(
  req: Request,
  admin: SupabaseClient,
): Promise<{ email: string; userId: string } | Response> {
  const authHeader = req.headers.get("authorization") ?? ""
  if (!authHeader.toLowerCase().startsWith("bearer ")) {
    return jsonError(401, "Missing authorization")
  }

  const jwt = authHeader.slice(7)
  const { data: userData, error } = await admin.auth.getUser(jwt)
  if (error || !userData?.user) {
    return jsonError(401, "Invalid session")
  }

  const email = (userData.user.email ?? "").toLowerCase()
  if (!email) {
    return jsonError(400, "Session user has no email")
  }

  const { data: adminRow } = await admin
    .from("proposl_admins")
    .select("email")
    .eq("email", email)
    .maybeSingle()

  if (!adminRow) {
    return jsonError(403, "Admin access required")
  }

  return { email, userId: userData.user.id }
}
