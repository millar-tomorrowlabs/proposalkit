/**
 * Resend webhook handler
 * ----------------------
 * Receives delivery events from Resend (https://resend.com/docs/dashboard/webhooks/introduction)
 * and updates the corresponding proposal_sends row by resend_id.
 *
 * Deploy:
 *   npx supabase functions deploy resend-webhook --project-ref nkygheptubvogevezpap --no-verify-jwt
 *
 * Configure in Resend dashboard:
 *   1. Go to https://resend.com/webhooks → Add endpoint
 *   2. URL: https://nkygheptubvogevezpap.supabase.co/functions/v1/resend-webhook
 *   3. Select events: email.sent, email.delivered, email.delivery_delayed,
 *      email.bounced, email.complained, email.failed, email.opened, email.clicked
 *   4. Copy the "Signing secret" (starts with "whsec_...")
 *   5. Add to Supabase secrets:
 *      npx supabase secrets set RESEND_WEBHOOK_SECRET=whsec_... --project-ref nkygheptubvogevezpap
 */

import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from "jsr:@supabase/supabase-js@2"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "svix-id, svix-timestamp, svix-signature, content-type",
}

// Svix signature verification.
// Format: v1,base64(hmac_sha256(secret, svix-id + "." + svix-timestamp + "." + body))
// The secret is prefixed with "whsec_" which we strip before decoding the base64.
async function verifySvixSignature(
  secret: string,
  svixId: string,
  svixTimestamp: string,
  svixSignature: string,
  body: string,
): Promise<boolean> {
  try {
    const secretBytes = atob(secret.replace(/^whsec_/, ""))
    const keyBytes = new Uint8Array(secretBytes.length)
    for (let i = 0; i < secretBytes.length; i++) keyBytes[i] = secretBytes.charCodeAt(i)

    const key = await crypto.subtle.importKey(
      "raw",
      keyBytes,
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"],
    )

    const toSign = `${svixId}.${svixTimestamp}.${body}`
    const signatureBytes = await crypto.subtle.sign(
      "HMAC",
      key,
      new TextEncoder().encode(toSign),
    )
    const expected = btoa(String.fromCharCode(...new Uint8Array(signatureBytes)))

    // svixSignature header is space-separated list of "v1,<sig>" entries.
    // Any match is accepted (Svix rotates signatures when secrets rotate).
    const signatures = svixSignature.split(" ").map((s) => s.replace(/^v1,/, ""))
    return signatures.includes(expected)
  } catch (e) {
    console.error("Signature verification error:", e)
    return false
  }
}

// Delivery events map to our delivery_status column.
function statusForEvent(eventType: string): string | null {
  switch (eventType) {
    case "email.sent": return "sent"
    case "email.delivered": return "delivered"
    case "email.delivery_delayed": return "delivery_delayed"
    case "email.bounced": return "bounced"
    case "email.complained": return "complained"
    case "email.failed": return "failed"
    default: return null
  }
}

// Engagement events (opens, clicks) go through dedicated RPCs that atomically
// increment counters and update first/last timestamps.
function isEngagementEvent(eventType: string): "open" | "click" | null {
  if (eventType === "email.opened") return "open"
  if (eventType === "email.clicked") return "click"
  return null
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

  const webhookSecret = Deno.env.get("RESEND_WEBHOOK_SECRET")
  if (!webhookSecret) {
    console.error("RESEND_WEBHOOK_SECRET not configured")
    return new Response(JSON.stringify({ error: "Webhook not configured" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    })
  }

  const rawBody = await req.text()
  const svixId = req.headers.get("svix-id")
  const svixTimestamp = req.headers.get("svix-timestamp")
  const svixSignature = req.headers.get("svix-signature")

  if (!svixId || !svixTimestamp || !svixSignature) {
    return new Response(JSON.stringify({ error: "Missing Svix headers" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    })
  }

  const valid = await verifySvixSignature(
    webhookSecret,
    svixId,
    svixTimestamp,
    svixSignature,
    rawBody,
  )
  if (!valid) {
    console.error("Invalid Svix signature")
    return new Response(JSON.stringify({ error: "Invalid signature" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    })
  }

  let event: Record<string, unknown>
  try {
    event = JSON.parse(rawBody)
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    })
  }

  const eventType = event.type as string | undefined
  const data = event.data as Record<string, unknown> | undefined
  const emailId = data?.email_id as string | undefined

  if (!eventType || !emailId) {
    // Acknowledge so Resend doesn't retry, but log for visibility.
    console.warn("Webhook event missing type or email_id:", eventType, emailId)
    return new Response(JSON.stringify({ received: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    })
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  )

  // Engagement events: opens and clicks get atomic counter updates via RPC.
  const engagement = isEngagementEvent(eventType)
  if (engagement === "open") {
    const { error: rpcError } = await supabase.rpc("record_proposal_send_open", {
      p_resend_id: emailId,
    })
    if (rpcError) console.error("record_proposal_send_open failed:", rpcError)
    return new Response(JSON.stringify({ received: true, type: "open" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    })
  }
  if (engagement === "click") {
    const { error: rpcError } = await supabase.rpc("record_proposal_send_click", {
      p_resend_id: emailId,
    })
    if (rpcError) console.error("record_proposal_send_click failed:", rpcError)
    return new Response(JSON.stringify({ received: true, type: "click" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    })
  }

  // Delivery events: update the delivery_status column.
  const newStatus = statusForEvent(eventType)
  if (!newStatus) {
    // Unknown event type — acknowledge but skip the update.
    return new Response(JSON.stringify({ received: true, skipped: eventType }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    })
  }

  const now = new Date().toISOString()
  const update: Record<string, unknown> = {
    delivery_status: newStatus,
    last_event_at: now,
    last_event_raw: event,
  }
  if (newStatus === "delivered") update.delivered_at = now
  if (newStatus === "bounced" || newStatus === "failed") update.bounced_at = now

  const { error: updateError } = await supabase
    .from("proposal_sends")
    .update(update)
    .eq("resend_id", emailId)

  if (updateError) {
    console.error("Failed to update proposal_sends:", updateError)
    // Still return 200 so Resend doesn't hammer us with retries for a DB bug.
    // The event is logged above for debugging.
  }

  return new Response(JSON.stringify({ received: true, status: newStatus }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  })
})
