/**
 * submit-waitlist — anonymous endpoint for landing-page email capture.
 *
 * POST { email: string, notes?: string }
 * Inserts a row into public.waitlist_signups, deduping on lowercased email
 * so repeat submissions from the same address don't fill the table.
 *
 * Returns 200 { ok: true } on success or on harmless duplicate. Errors
 * fall through with a generic message so we don't leak DB state to the
 * public endpoint.
 *
 * Deploy: supabase functions deploy submit-waitlist --no-verify-jwt \
 *   --project-ref nkygheptubvogevezpap
 */

import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from "jsr:@supabase/supabase-js@2"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
}

function emailLooksValid(s: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s)
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders })
  }
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    })
  }

  try {
    const body = await req.json().catch(() => ({}))
    const email = typeof body?.email === "string" ? body.email.trim() : ""
    const notes = typeof body?.notes === "string" ? body.notes.slice(0, 500) : null

    if (!emailLooksValid(email)) {
      return new Response(JSON.stringify({ error: "Please enter a valid email." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    )

    // Insert with upsert-ish behaviour: unique index on lower(email) will
    // reject duplicates, which we treat as success so the UI doesn't leak
    // "you're already on the list" information.
    const { error } = await supabase
      .from("waitlist_signups")
      .insert({ email: email.toLowerCase(), notes })

    if (error && !error.message.toLowerCase().includes("duplicate")) {
      console.error("submit-waitlist insert error:", error)
      return new Response(JSON.stringify({ error: "Something went wrong. Please try again." }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    })
  } catch (e) {
    console.error("submit-waitlist error:", e)
    return new Response(JSON.stringify({ error: "Internal error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    })
  }
})
